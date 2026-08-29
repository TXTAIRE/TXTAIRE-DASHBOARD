/* Employee Self-Service (ESS) portal shell — deliberately separate and small from the
 * admin app.js/index.html. Employees sign in with an Employee ID (mapped to a hidden
 * synthetic email behind the scenes) and get a 4-button, view-only, mobile-first portal.
 * Reuses js/store.js as-is: RLS already restricts a linked employee's session to their
 * own rows, so Store.init() and computeRow() work unmodified here.
 */

window.EssViews = window.EssViews || {};

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function toast(msg) {
  const old = qs('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function closeEssModal() {
  const bd = qs('.modal-backdrop');
  if (bd) bd.remove();
}

function openEssModal(innerHtml, onMount) {
  closeEssModal();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeEssModal(); });
  bd.innerHTML = '<div class="modal-wrap"><div class="modal">' +
    '<button class="modal-close" data-close-modal>&times;</button>' + innerHtml + '</div></div>';
  document.body.appendChild(bd);
  qsa('[data-close-modal]', bd).forEach(el => el.addEventListener('click', closeEssModal));
  if (onMount) onMount(bd);
  return bd;
}

// Captured as early as possible (top-level, not inside a function) -- Chrome/Edge/Android
// only ever fire 'beforeinstallprompt' once, before any user interaction, and only if
// nothing else on the page has already called preventDefault() on it. Held onto until
// startEss() decides whether to actually show the install nudge.
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

const ESS_ROUTES = ['attendance', 'payroll', 'leave', 'discipline', 'profile', 'notifications', 'settings'];
let essRoute = 'attendance';
let myEmployee = null;

function essEmailFor(employeeCode) {
  return employeeCode.trim().toLowerCase() + '@employees.txtaire.local';
}

// ---- Push notifications outside the portal (approvals, payroll released, NTE issued) ----
// Mirrors js/app.js's admin-side equivalents exactly -- duplicated rather than shared
// since ess.html and index.html are deliberately separate script bundles that don't load
// each other's files. See supabase/functions/employee-notification-push and the
// notify_employee_push trigger in supabase/schema.sql for the server side.
function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
// iOS/iPadOS Safari only exposes the Push API to a site "Added to Home Screen" and
// opened from there (iOS 16.4+) -- a plain Safari tab never has PushManager, on any iOS
// version. Every other modern browser supports push in a normal tab, no install needed.
function pushUnsupportedReason() {
  if ('serviceWorker' in navigator && 'PushManager' in window) return null;
  if (isIosDevice() && !isStandaloneDisplay()) {
    return 'On iPhone/iPad: tap the Share button, then "Add to Home Screen." Open My Portal from that icon (not from Safari) to enable notifications — iOS only allows this for installed apps.';
  }
  if (isIosDevice()) {
    return 'Push notifications need iOS/iPadOS 16.4 or later. Update iOS to enable this.';
  }
  return 'Push notifications aren\'t supported on this browser — try Chrome, Firefox, or Edge.';
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getCurrentEssPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
  const lookup = (async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  })();
  return Promise.race([lookup, timeout]);
}

async function enableEssPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast('Push notifications aren\'t supported on this browser/device.');
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast(permission === 'denied'
      ? 'Notifications are blocked for this site — enable them in your browser\'s site settings.'
      : 'Notification permission was not granted.');
    return false;
  }
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
  await Store.saveEmployeePushSubscription(sub, myEmployee.id);
  return true;
}

async function disableEssPushNotifications() {
  const sub = await getCurrentEssPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await Store.deleteEmployeePushSubscriptionByEndpoint(endpoint);
}

// Same three-note chime as the admin dashboard's playReminderTone -- a service worker
// can't play audio itself, so this only ever plays while a portal tab is actually open;
// closed/backgrounded devices get the OS's own default notification sound instead.
function playEssNotificationTone(debug) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const startedAsState = ctx.state;
    const play = () => {
      const notes = [880, 1108.73, 1318.51];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.55);
      });
      setTimeout(() => ctx.close(), 1200);
      if (debug) toast('Played (was ' + startedAsState + ', now ' + ctx.state + ')');
    };
    // iOS Safari routinely creates a new AudioContext already 'suspended' even inside a
    // tap handler -- scheduling notes before resuming just silently drops them. Resuming
    // first (and only scheduling once that resolves) is what actually makes sound come out.
    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch((err) => { if (debug) toast('Resume failed: ' + (err && err.message)); });
    } else {
      play();
    }
  } catch (err) {
    // Autoplay/audio can be blocked until the user interacts with the page — silently
    // skip the tone rather than throwing; the visual toast still shows.
    if (debug) toast('Tone error: ' + (err && err.message ? err.message : String(err)));
  }
}

// Lets a pinned announcement reach employees who aren't logged in at all yet (e.g. a
// shift reminder or office closure someone needs to see before they even sign in) --
// relies on a dedicated "public reads pinned announcements" RLS policy (supabase/
// schema.sql) since the login screen only ever has the anon key, no session. Only
// pinned announcements are exposed this way; the full history still requires signing in.
async function fetchPublicPinnedAnnouncements() {
  try {
    const { data, error } = await sb.from('announcements')
      .select('title, body, created_at')
      .eq('pinned', true)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) return [];
    return data || [];
  } catch (err) {
    return [];
  }
}

async function renderLoginAnnouncements() {
  const box = qs('#ess-login-announcements');
  if (!box) return;
  const items = await fetchPublicPinnedAnnouncements();
  if (!items.length) { box.innerHTML = ''; return; }
  box.innerHTML = `
    <div class="ess-card" style="text-align:left; width:100%;">
      <div class="ess-card-label">📣 Company Announcements</div>
      ${items.map(a => `
        <div style="padding:8px 0; border-bottom:1px solid var(--border-soft);">
          <div style="font-weight:600; font-size:13px; margin-bottom:3px;">${escapeHtml(a.title)}</div>
          <div class="ess-sub" style="white-space:pre-wrap;">${escapeHtml(a.body)}</div>
        </div>
      `).join('')}
    </div>
  `;
  qs('.ess-card > div:last-child', box).style.borderBottom = 'none';
}

function showEssLogin(errorMessage) {
  qs('#ess-app').classList.add('hidden');
  const screen = qs('#ess-login');
  screen.classList.remove('hidden');
  screen.innerHTML = `
    <div class="ess-login-wrap">
      <div class="ess-login-card">
        <img src="assets/logo.svg" alt="TxTAIRE" class="ess-login-logo" />
        <h1>TXTAIRE MY PORTAL</h1>
        <div class="page-sub" style="margin-bottom:18px;">Sign in with your Employee ID</div>
        ${errorMessage ? `<div class="auth-error">${escapeHtml(errorMessage)}</div>` : ''}
        <form id="ess-login-form">
          <div class="field full" style="margin-bottom:12px;">
            <label>Employee ID</label>
            <input name="employeeCode" required autocomplete="username" placeholder="e.g. TXT001" />
          </div>
          <div class="field full" style="margin-bottom:18px;">
            <label>Password</label>
            <input type="password" name="password" required autocomplete="current-password" />
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Sign in</button>
        </form>
        <div class="page-sub" style="margin-top:18px; font-size:12px;">Don't have a login? Ask HR to set one up for you.</div>
      </div>
      <div id="ess-login-announcements"></div>
    </div>
  `;
  qs('#ess-login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({
      email: essEmailFor(fd.get('employeeCode')),
      password: fd.get('password'),
    });
    if (error) showEssLogin('Incorrect Employee ID or password.');
  });
  renderLoginAnnouncements();
}

function setActiveEssNav(route) {
  qsa('.ess-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
}

function renderEssRoute() {
  const main = qs('#ess-main');
  main.innerHTML = '';
  setActiveEssNav(essRoute);
  applyEssNavLang();
  const view = window.EssViews[essRoute];
  if (view && view.render) view.render(main, myEmployee);
  // Landing tab only (My Attendance is the first thing an employee sees after signing
  // in) -- runs after the view's own render since every view's render() replaces
  // main.innerHTML wholesale, so this has to prepend rather than render first.
  if (essRoute === 'attendance') renderHomeAnnouncementBanner(main);
  updateEssBellBadge();
}

const ANNOUNCEMENT_DISMISS_KEY = 'essDismissedAnnouncements';
function dismissedAnnouncementIds() {
  try { return JSON.parse(localStorage.getItem(ANNOUNCEMENT_DISMISS_KEY) || '[]'); } catch (err) { return []; }
}
function dismissAnnouncement(id) {
  try {
    const ids = dismissedAnnouncementIds();
    if (!ids.includes(id)) ids.push(id);
    localStorage.setItem(ANNOUNCEMENT_DISMISS_KEY, JSON.stringify(ids.slice(-50)));
  } catch (err) { /* ignore */ }
}

// Surfaces pinned announcements right on the portal home tab, not just as a truncated
// ping in Notifications -- an employee who never opens the bell still sees them. Each
// can be dismissed individually (remembered per-device via localStorage); dismissing
// only hides it here, it's still readable in full under Notifications afterwards.
function renderHomeAnnouncementBanner(main) {
  const dismissed = dismissedAnnouncementIds();
  const items = Store.listAnnouncements().filter(a => a.pinned && !dismissed.includes(a.id));
  if (!items.length) return;
  const html = items.map(a => `
    <div class="ess-card" data-announcement-id="${escapeHtml(a.id)}" style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
        <div class="ess-card-label" style="margin-bottom:6px;">📣 ${escapeHtml(a.title)}</div>
        <button type="button" class="link-btn" data-dismiss-announcement="${escapeHtml(a.id)}" title="Dismiss" style="flex-shrink:0;">&times;</button>
      </div>
      <div class="ess-sub" style="white-space:pre-wrap;">${escapeHtml(a.body)}</div>
    </div>
  `).join('');
  main.insertAdjacentHTML('afterbegin', html);
  qsa('[data-dismiss-announcement]', main).forEach(btn => btn.addEventListener('click', () => {
    dismissAnnouncement(btn.dataset.dismissAnnouncement);
    const card = btn.closest('[data-announcement-id]');
    if (card) card.remove();
  }));
}

function updateEssBellBadge() {
  if (!myEmployee) return;
  const badge = qs('#ess-nav-notif-badge');
  if (!badge) return;
  const count = Store.unreadNotificationCount(myEmployee.id);
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

// Lazy-loaded CDN libraries for the Image/PDF download buttons below -- same pattern as
// the admin dashboard's js/app.js (and the heic2any lazy-load used elsewhere): check
// window.<lib> first, cache the load Promise, inject a <script> tag pointed at a pinned
// jsdelivr CDN URL (already allow-listed in ess.html's script-src CSP).
let html2canvasLoadPromise = null;
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  if (html2canvasLoadPromise) return html2canvasLoadPromise;
  html2canvasLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.onload = () => resolve(window.html2canvas);
    script.onerror = () => { html2canvasLoadPromise = null; reject(new Error('load failed')); };
    document.head.appendChild(script);
  });
  return html2canvasLoadPromise;
}
let jspdfLoadPromise = null;
function loadJsPdf() {
  if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  if (jspdfLoadPromise) return jspdfLoadPromise;
  jspdfLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.onload = () => resolve(window.jspdf && window.jspdf.jsPDF);
    script.onerror = () => { jspdfLoadPromise = null; reject(new Error('load failed')); };
    document.head.appendChild(script);
  });
  return jspdfLoadPromise;
}
function downloadFilenameFor(emp, label, from, to) {
  return (label + '_' + emp.name + '_' + from + '_to_' + to).replace(/[^a-z0-9]+/gi, '_');
}
// Safari (iOS and Mac alike) needs two workarounds neither other engine does:
// (1) it has never reliably honored the `download` attribute on a blob:/data: URL --
//     clicking such a link just opens or ignores the file -- so the fallback there is
//     to open the file in a new tab instead, where the user can long-press (iPhone) or
//     right-click (Mac) to save it;
// (2) a blob: URL opened via window.open() in a NEW tab is a long-standing WebKit bug
//     (the tab opens but the resource never actually loads -- it just spins forever),
//     so that new tab must be given a data: URL instead, never a blob: URL.
// window.open() itself must also happen synchronously, in direct response to the click,
// or Safari's popup blocker silently kills it -- awaiting the html2canvas render first
// and calling window.open() afterward is too late. So the tab is opened blank right at
// the top of downloadCapture, before any awaited work, and only gets its real content
// (or gets closed, if navigator.share() ends up handling it instead) once that's ready.
const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Safari blocks navigating a tab's own address/location to a data: URL -- an
// anti-phishing protection in place since ~2018 (it's how "fake login page with a
// blank-looking address bar" attacks worked) -- so setting safariTab.location.href to
// one gets silently discarded and the tab just sits at about:blank forever. A data: URL
// is still allowed as the *source* of embedded content though, so instead the tab's
// blank document is overwritten with a small HTML page containing an <img>/<embed> whose
// src is the data: URL -- that's a resource load, not a navigation, so it isn't blocked,
// and it gives the user Safari's normal long-press "Save Image" / PDF toolbar to save it.
function showInSafariTab(tab, dataUrl, mimeType, filename) {
  const body = mimeType === 'application/pdf'
    ? '<embed src="' + dataUrl + '" type="application/pdf" style="position:fixed;inset:0;width:100%;height:100%;border:0;">'
    : '<img src="' + dataUrl + '" style="max-width:100%;height:auto;display:block;margin:0 auto;">';
  tab.document.open();
  tab.document.write('<!doctype html><html><head><title>' + escapeHtml(filename) + '</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#333;">' + body + '</body></html>');
  tab.document.close();
}

// TEMPORARY diagnostic build: writes a live, persistent on-page log (Safari only) instead
// of an alert() -- an alert() only shows in the tab that ran the code, but the very first
// thing downloadCapture does is open a new tab, which iOS Safari immediately switches to,
// so any alert() sitting on the original (now-background) tab was easy to miss or catch
// mid-animation. A log written straight into the DOM stays visible across tab switches
// and updates in real time, so it's still there no matter when the screenshot happens.
// Remove this whole panel once the actual iOS Safari download bug is found and fixed.
let debugPanelEl = null;
function dbg(msg) {
  if (!isSafariBrowser) return;
  if (!debugPanelEl) {
    debugPanelEl = document.createElement('div');
    debugPanelEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.95);color:#0f0;font:12px/1.5 monospace;padding:16px;z-index:999999;overflow:auto;white-space:pre-wrap;';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close debug log';
    closeBtn.style.cssText = 'display:block;margin-bottom:12px;padding:10px 16px;font-size:14px;';
    closeBtn.addEventListener('click', () => { debugPanelEl.remove(); debugPanelEl = null; });
    const pre = document.createElement('pre');
    pre.id = 'debug-log-pre';
    debugPanelEl.appendChild(closeBtn);
    debugPanelEl.appendChild(pre);
    document.body.appendChild(debugPanelEl);
  }
  debugPanelEl.querySelector('#debug-log-pre').textContent += msg + '\n';
}

// A plain <a download> only ever lands a file in the Downloads folder -- on iOS it's
// largely ignored (Safari just opens the image), and on Android it doesn't reach the
// Photos/Gallery app either. The Web Share API's file sharing (iOS 16.4+, Android
// Chrome/Samsung Internet) is the only cross-platform way to get the OS's native
// "Save Image"/"Save to Photos" option, so it's tried first; desktop Chrome/Edge/
// Firefox/Safari on Mac and Windows don't support sharing files and fall back to the
// normal Downloads-folder save, which is the correct/expected behavior there. On Safari
// specifically, if share() isn't available or fails, safariTab (opened synchronously by
// the caller before any of this ran) is filled in via showInSafariTab above.
async function shareOrDownload(blob, filename, mimeType, safariTab, getDataUrl) {
  dbg('shareOrDownload: mimeType=' + mimeType + ' safariTab=' + !!safariTab);
  const file = new File([blob], filename, { type: mimeType });
  const canShareResult = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  dbg('navigator.share exists=' + !!navigator.share + ' canShare(files)=' + canShareResult);
  if (canShareResult) {
    try {
      await navigator.share({ files: [file] });
      dbg('navigator.share() succeeded');
      if (safariTab) safariTab.close();
      return;
    } catch (err) {
      dbg('navigator.share() threw: ' + err.name + ': ' + err.message);
      if (err && err.name === 'AbortError') { if (safariTab) safariTab.close(); return; } // user cancelled the share sheet
      // fall through if sharing itself failed
    }
  }
  if (safariTab) {
    dbg('filling safariTab via showInSafariTab');
    showInSafariTab(safariTab, getDataUrl(), mimeType, filename);
    dbg('showInSafariTab returned normally');
    toast('Opened in a new tab — press and hold (iPhone) or right-click (Mac) the file to save it.');
  } else if (isSafariBrowser) {
    dbg('safariTab is null on Safari -- popup was likely blocked');
    toast('Please allow pop-ups for this site, then try again.');
  } else {
    dbg('using plain downloadBlob (<a download>)');
    downloadBlob(blob, filename);
  }
}

async function downloadCapture(captureEl, filenameBase, format, btn) {
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  dbg('downloadCapture start: format=' + format + ' isSafariBrowser=' + isSafariBrowser + ' UA=' + navigator.userAgent);
  const safariTab = isSafariBrowser ? window.open('', '_blank') : null;
  dbg('window.open result: safariTab=' + (safariTab ? 'opened' : 'null/blocked'));
  try {
    dbg('loading html2canvas...');
    const html2canvas = await loadHtml2Canvas();
    dbg('html2canvas loaded=' + !!html2canvas);
    const canvas = await html2canvas(captureEl, { scale: 2, backgroundColor: '#ffffff' });
    dbg('canvas rendered: ' + canvas.width + 'x' + canvas.height);
    if (format === 'image') {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      dbg('blob created: size=' + (blob ? blob.size : 'NULL'));
      await shareOrDownload(blob, filenameBase + '.png', 'image/png', safariTab, () => canvas.toDataURL('image/png'));
    } else {
      dbg('loading jsPDF...');
      const JsPDF = await loadJsPdf();
      dbg('jsPDF loaded=' + !!JsPDF);
      const imgData = canvas.toDataURL('image/jpeg', 0.92);
      const pdf = new JsPDF({ orientation: canvas.width >= canvas.height ? 'landscape' : 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');
      dbg('pdf blob created: size=' + (pdfBlob ? pdfBlob.size : 'NULL'));
      await shareOrDownload(pdfBlob, filenameBase + '.pdf', 'application/pdf', safariTab, () => pdf.output('datauristring'));
    }
    dbg('downloadCapture finished normally');
  } catch (err) {
    dbg('CAUGHT ERROR: ' + err.name + ': ' + err.message);
    if (safariTab) safariTab.close();
    toast('Could not generate the download — try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

// Printable payslip — same overlay/markup as the admin dashboard's (js/app.js
// openPayslip), duplicated here rather than shared since each entry point already keeps
// its own small self-contained helpers (qs/qsa/escapeHtml/toast/etc. above). Only
// depends on globals that already exist identically in both js/store.js and here, so it
// renders and prints the same way for an employee viewing their own record. A separate
// print from the Daily Time Record below (openDTR).
function openPayslip(emp, from, to) {
  qsa('.dtr-overlay').forEach(el => el.remove());

  const row = computeRow(emp, from, to);

  const overlay = document.createElement('div');
  overlay.className = 'dtr-overlay';
  overlay.innerHTML = `
    <div class="dtr-print">
      <div class="dtr-actions no-print">
        <button class="btn btn-ghost btn-sm" id="dtr-close">Close</button>
        <button class="btn btn-ghost btn-sm" id="dtr-download-image">⬇ Image</button>
        <button class="btn btn-ghost btn-sm" id="dtr-download-pdf">⬇ PDF</button>
        <button class="btn btn-primary btn-sm" id="dtr-print-btn">Print / Save as PDF</button>
      </div>
      <div class="dtr-capture">
      ${payslipSectionHtml(emp, from, to, row)}

      <div class="dtr-signatures">
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Employee's Signature Over Printed Name</div></div>
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Human Resource Department</div></div>
      </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Start fetching html2canvas/jsPDF the moment this document is opened, not on button
  // click -- Safari treats the "user just tapped something" permission window very
  // strictly, and burning it on a CDN fetch is what made navigator.share() silently fail
  // there. By click time the library is already cached, leaving only the (fast) render
  // step before share() is called.
  loadHtml2Canvas().catch(() => {});
  loadJsPdf().catch(() => {});
  const captureEl = overlay.querySelector('.dtr-capture');
  const filenameBase = downloadFilenameFor(emp, 'Payslip', from, to);
  overlay.querySelector('#dtr-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#dtr-print-btn').addEventListener('click', () => window.print());
  overlay.querySelector('#dtr-download-image').addEventListener('click', (ev) => downloadCapture(captureEl, filenameBase, 'image', ev.currentTarget));
  overlay.querySelector('#dtr-download-pdf').addEventListener('click', (ev) => downloadCapture(captureEl, filenameBase, 'pdf', ev.currentTarget));
}

// Printable Daily Time Record (day-by-day log) — a separate print from the Payslip
// above (openPayslip). Same overlay/print pattern.
function openDTR(emp, from, to) {
  qsa('.dtr-overlay').forEach(el => el.remove());

  const records = Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id);
  const recByDate = dedupeAttendanceByDate(records);

  const holidays = Store.holidaysInRange(from, to);
  const holidayByDate = {};
  holidays.forEach(h => { holidayByDate[h.date] = h; });

  const workDays = workDaysInRange(from, to);
  const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (workDays > 0 ? emp.rate / workDays : 0);
  const row = computeRow(emp, from, to);
  const silDays = silDaysInRange(emp.id, from, to);

  const days = [];
  let d = from;
  while (d <= to) { days.push(d); d = addDays(d, 1); }

  let totalHours = 0, totalNsdHrs = 0, totalOtHrs = 0;
  const dayRows = days.map(date => {
    const r = recByDate[date];
    const holiday = holidayByDate[date];
    const pay = computeDayPay(dailyRateEq, r, holiday, emp);
    const hrs = dtrDisplayHours(r, emp);
    totalHours += hrs;
    totalNsdHrs += pay.nsdHrs;
    totalOtHrs += pay.otHrs;
    return { date, r, holiday, pay, hrs };
  });

  const overlay = document.createElement('div');
  overlay.className = 'dtr-overlay';
  overlay.innerHTML = `
    <div class="dtr-print">
      <div class="dtr-actions no-print">
        <button class="btn btn-ghost btn-sm" id="dtr-close">Close</button>
        <button class="btn btn-ghost btn-sm" id="dtr-download-image">⬇ Image</button>
        <button class="btn btn-ghost btn-sm" id="dtr-download-pdf">⬇ PDF</button>
        <button class="btn btn-primary btn-sm" id="dtr-print-btn">Print / Save as PDF</button>
      </div>
      <div class="dtr-capture">
      <div class="dtr-header">
        <img src="assets/logo.svg" class="dtr-logo" alt="TxTAIRE" />
        <h2>Daily Time Record</h2>
      </div>
      <div class="dtr-meta">
        <div><strong>Name:</strong> ${escapeHtml(emp.name)}</div>
        <div><strong>Position:</strong> ${escapeHtml(emp.position || '—')}</div>
        <div><strong>Category:</strong> ${escapeHtml(emp.category)}</div>
        <div><strong>Pay period:</strong> ${fmtDate(from)} – ${fmtDate(to)}</div>
      </div>
      <div class="dtr-table-wrap">
      <table class="dtr-table">
        <thead><tr><th>Date</th><th>Day</th><th>Time In</th><th>Time Out</th><th>Hours</th><th class="num">NSD Hrs</th><th class="num">OT Hrs</th><th>Status</th></tr></thead>
        <tbody>
          ${dayRows.map(({ date, r, holiday, pay, hrs }) => {
            const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
            const statusParts = [];
            if (r) statusParts.push(r.status); else if (dow === 'Sun') statusParts.push('Rest Day');
            if (holiday) statusParts.push(holiday.type === 'Regular' ? 'Regular Holiday' : 'Special Non-Working');
            return `<tr>
              <td>${fmtDate(date)}</td>
              <td>${dow}</td>
              <td>${r ? to12Hour(r.timeIn) : ''}</td>
              <td>${r ? to12Hour(r.timeOut) : ''}</td>
              <td>${r ? Math.round(hrs) : ''}</td>
              <td class="num">${pay.nsdHrs ? pay.nsdHrs.toFixed(2) : ''}</td>
              <td class="num">${pay.otHrs ? pay.otHrs.toFixed(2) : ''}</td>
              <td>${escapeHtml(statusParts.join(' · '))}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:600;">Total</td>
          <td style="font-weight:600;">${Math.round(totalHours)}</td>
          <td class="num" style="font-weight:600;">${totalNsdHrs.toFixed(2)}</td>
          <td class="num" style="font-weight:600;">${totalOtHrs.toFixed(2)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      </div>
      <div class="dtr-meta" style="margin-top:12px;">
        <div><strong>SIL (Service Incentive Leave):</strong> ${silDays} day(s)</div>
        <div><strong>Holiday Pay:</strong> ${fmtMoney(row.holidayPay)}</div>
      </div>

      <div class="dtr-signatures">
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Employee's Signature Over Printed Name</div></div>
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Human Resource Department</div></div>
      </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Start fetching html2canvas/jsPDF the moment this document is opened, not on button
  // click -- Safari treats the "user just tapped something" permission window very
  // strictly, and burning it on a CDN fetch is what made navigator.share() silently fail
  // there. By click time the library is already cached, leaving only the (fast) render
  // step before share() is called.
  loadHtml2Canvas().catch(() => {});
  loadJsPdf().catch(() => {});
  const captureEl = overlay.querySelector('.dtr-capture');
  const filenameBase = downloadFilenameFor(emp, 'DTR', from, to);
  overlay.querySelector('#dtr-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#dtr-print-btn').addEventListener('click', () => window.print());
  overlay.querySelector('#dtr-download-image').addEventListener('click', (ev) => downloadCapture(captureEl, filenameBase, 'image', ev.currentTarget));
  overlay.querySelector('#dtr-download-pdf').addEventListener('click', (ev) => downloadCapture(captureEl, filenameBase, 'pdf', ev.currentTarget));
}

// Matches the office's existing payslip template (Pay Period/Designation/Employee's Name/
// Employee No. header, side-by-side Earnings/Deductions columns, an Additional block for
// COLA etc., and a highlighted NET PAY bar) -- built from the same computeRow() My Payroll
// uses, so every figure here always matches there exactly.
function payslipSectionHtml(emp, from, to, row) {
  const deds = Store.deductionsInRange(from, to).filter(d => d.employeeId === emp.id);
  const dedByKind = (kind) => deds.filter(d => d.kind === kind).reduce((s, d) => s + Number(d.amount), 0);
  const pagibigDed = dedByKind('Pag-IBIG Premium');
  const sssDed = dedByKind('SSS Contribution');
  const philhealthDed = dedByKind('PhilHealth');
  const namedDed = pagibigDed + sssDed + philhealthDed;
  // Everything else -- Cash Advance/Tardy/Damage/Other manual deductions, plus the
  // absence and late/undertime deductions computeRow() already folds into dedTotal --
  // rolls up into one line instead of cluttering the payslip with every ad-hoc kind.
  const otherDed = Math.max(0, row.dedTotal - namedDed);
  const totalDed = row.tax + row.dedTotal;
  const totalBeforeDed = row.gross + row.bonusTotal;

  return `
      <div class="payslip">
        <div class="payslip-title-row">
          <img src="assets/logo.svg" class="payslip-logo" alt="TxTAIRE" />
          <div class="payslip-title">PAYSLIP</div>
        </div>
        <div class="payslip-meta">
          <div><b>Pay Period</b> : ${fmtDate(from)} – ${fmtDate(to)}</div>
          <div><b>Designation</b> : ${escapeHtml(emp.position || '—')}</div>
          <div><b>Employee's Name</b> : ${escapeHtml(emp.name)}</div>
          <div><b>Employee No.</b> : ${escapeHtml(emp.employeeCode || '—')}</div>
        </div>
        <div class="payslip-columns">
          <div class="payslip-col">
            <div class="payslip-col-title">EARNINGS</div>
            <table class="payslip-table">
              <tr><td>No. of Days worked</td><td>:</td><td class="num">${row.daysPresent}</td></tr>
              <tr><td>SIL (Service Incentive Leave)</td><td>:</td><td class="num">${silDaysInRange(emp.id, from, to)} day(s)</td></tr>
              <tr><td>${emp.payType === 'Daily' ? 'Daily Rate' : (emp.payType === 'Per Cutoff' ? 'Rate per Cutoff' : 'Monthly Rate')}</td><td>:</td><td class="num">${fmtMoney(emp.payType === 'Daily' ? emp.rate : row.basePay)}</td></tr>
              <tr><td>Overtime Pay</td><td>:</td><td class="num">${fmtMoney(row.otPay)}</td></tr>
              <tr><td>Night Differential</td><td>:</td><td class="num">${fmtMoney(row.nsdPay)}</td></tr>
              <tr><td>Holiday Pay</td><td>:</td><td class="num">${fmtMoney(row.holidayPay)}</td></tr>
              <tr class="payslip-total"><td>Gross Pay</td><td>:</td><td class="num">${fmtMoney(row.taxableGross)}</td></tr>
            </table>
          </div>
          <div class="payslip-col">
            <div class="payslip-col-title">DEDUCTIONS</div>
            <table class="payslip-table">
              <tr><td>Withholding tax</td><td>:</td><td class="num">${row.tax ? fmtMoney(row.tax) : '-'}</td></tr>
              <tr><td>Pag-ibig Premium</td><td>:</td><td class="num">${pagibigDed ? fmtMoney(pagibigDed) : '-'}</td></tr>
              <tr><td>SSS Regular Contribution</td><td>:</td><td class="num">${sssDed ? fmtMoney(sssDed) : '-'}</td></tr>
              <tr><td>Philhealth</td><td>:</td><td class="num">${philhealthDed ? fmtMoney(philhealthDed) : '-'}</td></tr>
              ${otherDed ? `<tr><td>Other Deductions</td><td>:</td><td class="num">${fmtMoney(otherDed)}</td></tr>` : ''}
              <tr class="payslip-total"><td>Total Deductions</td><td>:</td><td class="num">${fmtMoney(totalDed)}</td></tr>
            </table>
          </div>
        </div>
        <div class="payslip-additional">
          <div class="payslip-col-title">Additional</div>
          <table class="payslip-table">
            <tr><td>Cost of Living Allowance (COLA)</td><td>:</td><td class="num">${fmtMoney(row.colaPay)}</td></tr>
            ${row.housingPay ? `<tr><td>Housing Allowance</td><td>:</td><td class="num">${fmtMoney(row.housingPay)}</td></tr>` : ''}
            ${row.retroPay ? `<tr><td>Retro Pay</td><td>:</td><td class="num">${fmtMoney(row.retroPay)}</td></tr>` : ''}
            ${row.bonusTotal ? `<tr><td>Bonus</td><td>:</td><td class="num">${fmtMoney(row.bonusTotal)}</td></tr>` : ''}
            <tr class="payslip-total"><td>Total Pay before deduction</td><td>:</td><td class="num">${fmtMoney(totalBeforeDed)}</td></tr>
          </table>
        </div>
        <div class="payslip-net">
          <div>NET PAY</div>
          <div>${fmtMoney(row.net)}</div>
        </div>
        <div class="payslip-ack">I hereby acknowledge receipt of my salaries as indicated in the NET PAY portion representing payment for my services rendered in payroll period as specified in this payslip.</div>
      </div>
  `;
}

// Every view re-renders by wholesale replacing main.innerHTML -- after saving a form,
// requesting OT, editing a day, etc. -- which was silently resetting scroll position back
// to the top every single time. Fixed once, system-wide, via a MutationObserver on the
// shared container instead of patching every individual view's render function.
function preserveScrollAcrossRerenders(container) {
  // #ess-main has no height or overflow-y of its own -- the page scrolls at the document
  // level, not on this element -- so the position has to be tracked/restored there.
  const scroller = document.scrollingElement || document.documentElement;
  let scrollTop = 0;

  // Captured synchronously at the moment of interaction (click/submit/change), not via the
  // "scroll" event -- confirmed the hard way (fixing the admin dashboard's Attendance
  // Calendar tab) that "scroll" doesn't fire promptly/reliably enough for this to work.
  function capture() { scrollTop = scroller.scrollTop; }
  ['click', 'submit', 'change'].forEach(evt => container.addEventListener(evt, capture, true));
  window.addEventListener('scroll', capture, { passive: true });

  function restore() { scroller.scrollTop = scrollTop; }
  const observer = new MutationObserver(() => {
    restore();
    // Also deferred a tick -- setting scrollTop immediately after new content is inserted,
    // before the browser has laid it out, can get silently clamped to 0.
    setTimeout(restore, 0);
  });
  // subtree: true is required -- a nested sub-container re-rendering (not #ess-main
  // itself) never fired a childList-only observer on the outer container.
  observer.observe(container, { childList: true, subtree: true });
}

// ---- "Add to Home Screen" nudge, shown once per login (throttled) ----
// This is what actually makes push notifications reachable on iPhone/iPad -- iOS only
// exposes the Push API to an installed home-screen app, never a normal Safari tab (see
// pushUnsupportedReason() above) -- so prompting for this right after login gives
// employees the single step that unlocks notifications there, instead of leaving it
// buried in Settings for them to discover on their own.
const INSTALL_PROMPT_DISMISS_KEY = 'essInstallPromptDismissedAt';
const INSTALL_PROMPT_REASK_DAYS = 14;

function shouldShowInstallPrompt() {
  if (isStandaloneDisplay()) return false; // already installed and running as an app
  // Safari in Private Browsing (and some MDM-locked-down iPhones) can throw on
  // localStorage access instead of just returning null -- if that throw isn't caught
  // here, it silently kills this whole feature with zero visible symptom, since it's
  // called from inside a setTimeout callback. Treat a throw as "never dismissed."
  let dismissedAt = 0;
  try { dismissedAt = Number(localStorage.getItem(INSTALL_PROMPT_DISMISS_KEY) || 0); } catch (err) { dismissedAt = 0; }
  if (dismissedAt && (Date.now() - dismissedAt) < INSTALL_PROMPT_REASK_DAYS * 86400000) return false;
  // Only worth interrupting the employee for if there's something they can actually do:
  // a real one-tap install (Chrome/Edge/Android) or iOS's manual Share -> Add to Home
  // Screen steps. Browsers with neither (e.g. desktop Firefox) get no popup at all.
  return !!deferredInstallPrompt || isIosDevice();
}

function dismissInstallPrompt() {
  try { localStorage.setItem(INSTALL_PROMPT_DISMISS_KEY, String(Date.now())); } catch (err) { /* ignore */ }
  closeEssModal();
}

function maybeShowInstallPrompt() {
  if (!shouldShowInstallPrompt()) return;
  const isIos = isIosDevice();
  openEssModal(`
    <h2>📲 Add My Portal to Your Home Screen</h2>
    <div class="modal-sub">${isIos
      ? 'Tap the Share button below, then "Add to Home Screen." This gives you one-tap access and is required on iPhone/iPad to receive notifications.'
      : 'Get one-tap access from your home screen, and enable notifications for approvals, payroll releases, and request updates.'}</div>
    ${isIos ? `
    <div class="ess-card" style="text-align:center; margin:14px 0;">
      <div style="font-size:13px;">1. Tap <strong>Share</strong> ⬆️ in Safari's toolbar</div>
      <div style="font-size:13px; margin-top:6px;">2. Scroll down and tap <strong>"Add to Home Screen"</strong></div>
    </div>` : ''}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="btn-install-later">Maybe Later</button>
      ${isIos
        ? '<button type="button" class="btn btn-primary" id="btn-install-got-it">Got it</button>'
        : '<button type="button" class="btn btn-primary" id="btn-install-now">Add to Home Screen</button>'}
    </div>
  `, (bd) => {
    qs('#btn-install-later', bd).addEventListener('click', dismissInstallPrompt);
    const gotItBtn = qs('#btn-install-got-it', bd);
    if (gotItBtn) gotItBtn.addEventListener('click', dismissInstallPrompt);
    const installNowBtn = qs('#btn-install-now', bd);
    if (installNowBtn) installNowBtn.addEventListener('click', async () => {
      if (!deferredInstallPrompt) { dismissInstallPrompt(); return; }
      deferredInstallPrompt.prompt();
      try { await deferredInstallPrompt.userChoice; } catch (err) { /* ignore */ }
      deferredInstallPrompt = null; // a captured prompt event can only ever be used once
      dismissInstallPrompt();
    });
  });
}

// ---- "Enable Notifications" nudge, shown once per login (throttled) ----
// Separate from the install prompt above: that one only gets iOS installed to the home
// screen (a prerequisite there), it never actually turns push on. This is the step that
// does -- real OS-level push, with sound, even when My Portal isn't open at all, unlike
// playEssNotificationTone() above which only ever plays while a portal tab is open.
const PUSH_PROMPT_DISMISS_KEY = 'essPushPromptDismissedAt';
const PUSH_PROMPT_REASK_DAYS = 14;

function dismissPushPrompt() {
  try { localStorage.setItem(PUSH_PROMPT_DISMISS_KEY, String(Date.now())); } catch (err) { /* ignore */ }
  closeEssModal();
}

async function maybeShowPushPrompt() {
  // Nothing to offer yet if this browser/device can't do push at all (e.g. iOS not
  // installed to the home screen yet) -- the install prompt is the correct nudge there,
  // not this one.
  if (pushUnsupportedReason()) return;
  // Already explicitly denied at the browser level -- our own "Enable" button can't
  // override that (only the browser's own site settings can), so re-asking here would
  // just be a dead-end button shown every 14 days.
  if (typeof Notification !== 'undefined' && Notification.permission === 'denied') return;
  let dismissedAt = 0;
  try { dismissedAt = Number(localStorage.getItem(PUSH_PROMPT_DISMISS_KEY) || 0); } catch (err) { dismissedAt = 0; }
  if (dismissedAt && (Date.now() - dismissedAt) < PUSH_PROMPT_REASK_DAYS * 86400000) return;
  const existing = await getCurrentEssPushSubscription();
  if (existing) return; // already enabled on this device

  openEssModal(`
    <h2>🔔 Turn On Notifications</h2>
    <div class="modal-sub">Get notified the instant your leave request is approved, payroll is released, or an NTE is issued — with sound, even when My Portal isn't open.</div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="btn-push-later">Not Now</button>
      <button type="button" class="btn btn-primary" id="btn-push-enable">Enable Notifications</button>
    </div>
  `, (bd) => {
    qs('#btn-push-later', bd).addEventListener('click', dismissPushPrompt);
    qs('#btn-push-enable', bd).addEventListener('click', async () => {
      const btn = qs('#btn-push-enable', bd);
      btn.disabled = true;
      btn.textContent = 'Enabling…';
      let ok = false;
      try { ok = await enableEssPushNotifications(); } catch (err) { /* toasted inside enableEssPushNotifications */ }
      if (ok) {
        toast('✔ Notifications enabled on this device.');
        dismissPushPrompt();
      } else {
        btn.disabled = false;
        btn.textContent = 'Enable Notifications';
      }
    });
  });
}

// ---- Birthday celebration -- My Portal only, never the admin dashboard ----
// HR sets birthDate on the employee record (js/views/staff.js); when today's month/day
// matches it, this pops up automatically -- a plain client-side date comparison, no cron
// job or push notification involved. Shown at most once per employee per calendar day
// (localStorage-gated below), so re-renders/re-logins the same day don't repeat it.
const BIRTHDAY_SHOWN_KEY = 'essBirthdayShownOn';

function isEmployeeBirthdayToday(emp) {
  if (!emp || !emp.birthDate) return false;
  const bd = new Date(emp.birthDate + 'T00:00:00');
  if (isNaN(bd.getTime())) return false;
  const today = new Date();
  return bd.getMonth() === today.getMonth() && bd.getDate() === today.getDate();
}
function birthdayAlreadyShownToday(emp) {
  try {
    const shown = JSON.parse(localStorage.getItem(BIRTHDAY_SHOWN_KEY) || '{}');
    return shown[emp.id] === todayISO();
  } catch (err) { return false; }
}
function markBirthdayShownToday(emp) {
  try {
    const shown = JSON.parse(localStorage.getItem(BIRTHDAY_SHOWN_KEY) || '{}');
    shown[emp.id] = todayISO();
    localStorage.setItem(BIRTHDAY_SHOWN_KEY, JSON.stringify(shown));
  } catch (err) { /* ignore */ }
}

const CONFETTI_COLORS = ['#ff5e7e', '#ffd166', '#06d6a0', '#4f8dff', '#a78bfa', '#ff9f43'];
function spawnConfetti(container, count) {
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = (Math.random() * 100) + '%';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = (2.2 + Math.random() * 1.8) + 's';
    piece.style.animationDelay = (Math.random() * 0.8) + 's';
    piece.style.setProperty('--rot', (Math.random() * 360) + 'deg');
    container.appendChild(piece);
  }
}

// A dedicated full-screen overlay (not openEssModal) -- both for the confetti layer
// underneath it and so a once-a-year moment visually stands apart from every other
// routine modal in the app. Reuses the same chime as every other push notification, a
// small deliberate touch (sound + vibration-adjacent confetti) rather than a silent popup.
function showEssBirthdayCelebration(emp) {
  markBirthdayShownToday(emp);
  const overlay = document.createElement('div');
  overlay.className = 'birthday-overlay';
  const firstName = (emp.name || '').trim().split(' ')[0] || emp.name;
  overlay.innerHTML = `
    <div class="birthday-confetti-layer"></div>
    <div class="birthday-card">
      <button type="button" class="birthday-close" aria-label="Close">&times;</button>
      <img src="assets/logo.svg" alt="TxTAIRE" class="birthday-logo" />
      <div class="birthday-emoji">🎉🎂🎉</div>
      <h2>Happy Birthday, ${escapeHtml(firstName)}!</h2>
      <div class="ess-sub" style="margin-top:6px;">From your TXTAIRE family — wishing you a great year ahead. 🎈</div>
      <iframe class="birthday-audio" title="Birthday song" frameborder="0" allow="autoplay"></iframe>
      <button type="button" class="link-btn" id="birthday-play-btn" style="margin-top:8px;">🎵 Play birthday song</button>
    </div>
  `;
  document.body.appendChild(overlay);
  spawnConfetti(qs('.birthday-confetti-layer', overlay), 70);
  try { playEssNotificationTone(); } catch (err) { /* best-effort */ }
  // Audio only, no visible video -- a 1x1 iframe still plays the embedded video's audio
  // track. Autoplay-with-sound is attempted immediately (works on browsers that grant it
  // based on the earlier login-form user gesture, e.g. Chrome/Android), but that's never
  // guaranteed -- iOS Safari in particular blocks unmuted autoplay outright regardless of
  // any prior gesture. The button re-points the same iframe at a fresh URL from directly
  // inside a click handler, which every browser's autoplay policy allows unconditionally,
  // so sound always has a one-tap fallback that actually works.
  const audioFrame = qs('.birthday-audio', overlay);
  const playBtn = qs('#birthday-play-btn', overlay);
  const songUrl = (cacheBust) => 'https://www.youtube.com/embed/2du6HVW28aw?autoplay=1&mute=0&rel=0&playsinline=1&cb=' + cacheBust;
  audioFrame.src = songUrl(0);
  playBtn.addEventListener('click', () => {
    audioFrame.src = songUrl(Date.now());
    playBtn.textContent = '🎵 Playing…';
  });
  const close = () => overlay.remove();
  qs('.birthday-close', overlay).addEventListener('click', close);
  overlay.addEventListener('mousedown', (ev) => { if (ev.target === overlay) close(); });
  setTimeout(close, 9000);
}

let essStarted = false;
async function startEss(session) {
  if (essStarted) return;

  await Store.init();
  const employees = Store.listEmployees();
  // RLS already restricts a linked employee's session to their own row; if it comes back
  // empty, this account isn't linked to an employee (e.g. an admin login, or access was
  // revoked) — the ESS portal isn't for them.
  if (!employees.length) {
    await sb.auth.signOut();
    showEssLogin('This login isn\'t linked to an employee portal account. Contact HR.');
    return;
  }
  myEmployee = employees[0];
  essStarted = true;

  qs('#ess-login').classList.add('hidden');
  qs('#ess-app').classList.remove('hidden');
  qs('#ess-logout').addEventListener('click', () => sb.auth.signOut());
  // Admin-only tools (currently just AI receipt-scanning expense encoding, admin-portal.html)
  // live on a separate page, not in this personal nav bar -- only a header link is shown,
  // and only to whoever's been granted canEncodeExpenses (set by HR directly in Supabase).
  if (myEmployee.canEncodeExpenses) qs('#ess-admin-portal-link').classList.remove('hidden');
  qsa('.ess-nav-btn').forEach(b => b.addEventListener('click', () => { essRoute = b.dataset.route; renderEssRoute(); }));
  qs('#ess-fab-clock').addEventListener('click', () => {
    if (essRoute !== 'attendance') { essRoute = 'attendance'; renderEssRoute(); }
    const view = window.EssViews.attendance;
    if (view && view.quickClock) view.quickClock(qs('#ess-main'), myEmployee);
  });
  preserveScrollAcrossRerenders(qs('#ess-main'));

  // Relayed from the service worker's 'push' handler (sw.js, shared with the admin
  // dashboard) whenever an approval/payroll-release/NTE push arrives while this tab is
  // open -- plays the tone here since a service worker has no audio output of its own.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'payroll-reminder-push') {
        playEssNotificationTone();
        toast('🔔 ' + event.data.title);
      }
    });
  }

  Store.onRemoteChange(() => {
    if (qs('.modal-backdrop')) { updateEssBellBadge(); return; }
    renderEssRoute();
  });

  renderEssRoute();
  // Deferred a beat so it doesn't compete with the login->portal transition/initial render.
  // Wrapped defensively -- a setTimeout callback that throws fails completely silently
  // (no visible error, nothing in the console the user could report), which would look
  // exactly like "nothing happens." try/catch here turns that into a visible signal.
  // Shows at most one of these per login -- a birthday takes priority over everything
  // else on that one day (see isEmployeeBirthdayToday above), then the onboarding tour on
  // a brand-new device (orient first, ask for anything else after), then the install
  // prompt when there's still an install step to do (the iOS prerequisite for push),
  // otherwise the push-enable prompt -- so employees are never stacked with two modals
  // back to back.
  setTimeout(() => {
    if (isEmployeeBirthdayToday(myEmployee) && !birthdayAlreadyShownToday(myEmployee)) {
      try { showEssBirthdayCelebration(myEmployee); } catch (err) { toast('Birthday celebration error: ' + (err && err.message ? err.message : err)); }
    } else if (shouldShowEssTutorial()) {
      try { startEssTutorial(); } catch (err) { toast('Tour error: ' + (err && err.message ? err.message : err)); }
    } else if (shouldShowInstallPrompt()) {
      try { maybeShowInstallPrompt(); } catch (err) { toast('Install prompt error: ' + (err && err.message ? err.message : err)); }
    } else {
      maybeShowPushPrompt().catch((err) => toast('Notification prompt error: ' + (err && err.message ? err.message : err)));
    }
  }, 1200);
}

async function bootEss() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await startEss(session);
  } else {
    showEssLogin();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await startEss(session);
    } else if (event === 'SIGNED_OUT') {
      location.reload();
    }
  });
}

document.addEventListener('DOMContentLoaded', bootEss);
