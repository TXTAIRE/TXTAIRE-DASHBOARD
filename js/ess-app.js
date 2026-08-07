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

const ESS_ROUTES = ['attendance', 'payroll', 'leave', 'profile', 'notifications', 'settings'];
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
function playEssNotificationTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (err) {
    // Autoplay/audio can be blocked until the user interacts with the page — silently
    // skip the tone rather than throwing; the visual toast still shows.
  }
}

function showEssLogin(errorMessage) {
  qs('#ess-app').classList.add('hidden');
  const screen = qs('#ess-login');
  screen.classList.remove('hidden');
  screen.innerHTML = `
    <div class="ess-login-card">
      <img src="assets/logo.svg" alt="TxTAIRE" class="ess-login-logo" />
      <h1>My Portal</h1>
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
}

function setActiveEssNav(route) {
  qsa('.ess-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
}

function renderEssRoute() {
  const main = qs('#ess-main');
  main.innerHTML = '';
  setActiveEssNav(essRoute);
  const view = window.EssViews[essRoute];
  if (view && view.render) view.render(main, myEmployee);
  updateEssBellBadge();
}

function updateEssBellBadge() {
  if (!myEmployee) return;
  const badge = qs('#ess-nav-notif-badge');
  if (!badge) return;
  const count = Store.unreadNotificationCount(myEmployee.id);
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

// Printable Daily Time Record — same overlay/markup as the admin dashboard's DTR
// (js/app.js openDTR), duplicated here rather than shared since each entry point already
// keeps its own small self-contained helpers (qs/qsa/escapeHtml/toast/etc. above). Only
// depends on globals that already exist identically in both js/store.js and here, so it
// renders and prints the same way for an employee viewing their own record.
function openDTR(emp, from, to) {
  qsa('.dtr-overlay').forEach(el => el.remove());

  const records = Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id);
  const recByDate = {};
  records.forEach(r => { recByDate[r.date] = r; });

  const holidays = Store.holidaysInRange(from, to);
  const holidayByDate = {};
  holidays.forEach(h => { holidayByDate[h.date] = h; });

  const workDays = workDaysInRange(from, to);
  const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (workDays > 0 ? emp.rate / workDays : 0);
  // Same shared computeRow() My Payroll uses, so the DTR's total pay always matches --
  // gross/net for the whole cutoff, not just the NSD/OT/Holiday premiums computed below.
  const row = computeRow(emp, from, to);

  const days = [];
  let d = from;
  while (d <= to) { days.push(d); d = addDays(d, 1); }

  let totalHours = 0, totalNsdHrs = 0, totalNsdPay = 0, totalOtHrs = 0, totalOtPay = 0, totalHolidayPay = 0;
  const dayRows = days.map(date => {
    const r = recByDate[date];
    const holiday = holidayByDate[date];
    const pay = computeDayPay(dailyRateEq, r, holiday);
    const hrs = r ? (Number(r.hours) || 0) : 0;
    totalHours += hrs;
    totalNsdHrs += pay.nsdHrs;
    totalNsdPay += pay.nsdPay;
    totalOtHrs += pay.otHrs;
    totalOtPay += pay.otPay;
    totalHolidayPay += pay.holidayPay;
    return { date, r, holiday, pay, hrs };
  });

  const overlay = document.createElement('div');
  overlay.className = 'dtr-overlay';
  overlay.innerHTML = `
    <div class="dtr-print">
      <div class="dtr-actions no-print">
        <button class="btn btn-ghost btn-sm" id="dtr-close">Close</button>
        <button class="btn btn-primary btn-sm" id="dtr-print-btn">Print / Save as PDF</button>
      </div>
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
              <td>${r ? hrs : ''}</td>
              <td class="num">${pay.nsdHrs ? pay.nsdHrs.toFixed(2) : ''}</td>
              <td class="num">${pay.otHrs ? pay.otHrs.toFixed(2) : ''}</td>
              <td>${escapeHtml(statusParts.join(' · '))}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr>
          <td colspan="4" style="text-align:right;font-weight:600;">Total</td>
          <td style="font-weight:600;">${totalHours}</td>
          <td class="num" style="font-weight:600;">${totalNsdHrs.toFixed(2)}</td>
          <td class="num" style="font-weight:600;">${totalOtHrs.toFixed(2)}</td>
          <td></td>
        </tr></tfoot>
      </table>
      </div>

      <div class="dtr-summary">
        <div class="dtr-summary-title">Pay computation (per the Labor Code of the Philippines)</div>
        <table class="dtr-table">
          <thead><tr><th>Component</th><th>Basis</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td>Night Shift Differential</td><td class="dim">${totalNsdHrs.toFixed(2)} hr(s) worked 10:00 PM–6:00 AM &times; 10% of hourly rate</td><td class="num">${fmtMoney(totalNsdPay)}</td></tr>
            <tr><td>Overtime Pay</td><td class="dim">${totalOtHrs.toFixed(2)} hr(s) beyond 8/day &times; 125% ordinary / 169% special holiday / 260% regular holiday</td><td class="num">${fmtMoney(totalOtPay)}</td></tr>
            <tr><td>Holiday Pay</td><td class="dim">200% (regular) / 130% (special) if worked; full day's pay if an unworked regular holiday</td><td class="num">${fmtMoney(totalHolidayPay)}</td></tr>
            <tr><td style="font-weight:700;">Total NSD + OT + Holiday</td><td></td><td class="num" style="font-weight:700;">${fmtMoney(totalNsdPay + totalOtPay + totalHolidayPay)}</td></tr>
          </tbody>
        </table>
        <div class="page-sub" style="margin-top:6px;">Daily-rate equivalent used for these computations: ${fmtMoney(dailyRateEq)} / day (${fmtMoney(dailyRateEq / 8)} / hour).</div>
      </div>

      <div class="dtr-summary">
        <div class="dtr-summary-title">Total Pay — ${fmtDate(from)} to ${fmtDate(to)}</div>
        <table class="dtr-table">
          <thead><tr><th>Component</th><th class="num">Amount</th></tr></thead>
          <tbody>
            <tr><td>Gross Pay</td><td class="num">${fmtMoney(row.gross)}</td></tr>
            <tr><td>Withholding Tax</td><td class="num">${row.tax ? '−' + fmtMoney(row.tax) : fmtMoney(0)}</td></tr>
            <tr><td>Deductions</td><td class="num">${row.dedTotal ? '−' + fmtMoney(row.dedTotal) : fmtMoney(0)}</td></tr>
            ${row.bonusTotal ? `<tr><td>Bonus</td><td class="num">+${fmtMoney(row.bonusTotal)}</td></tr>` : ''}
            <tr><td style="font-weight:700;">Net Pay</td><td class="num" style="font-weight:700;">${fmtMoney(row.net)}</td></tr>
          </tbody>
        </table>
      </div>

      <div class="dtr-signatures">
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Employee Signature</div></div>
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Supervisor / HR Signature</div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#dtr-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#dtr-print-btn').addEventListener('click', () => window.print());
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
  observer.observe(container, { childList: true });
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
