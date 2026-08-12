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

      ${payslipSectionHtml(emp, from, to, row)}

      <div class="dtr-signatures">
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Employee's Signature Over Printed Name</div></div>
        <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Human Resource Department</div></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#dtr-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#dtr-print-btn').addEventListener('click', () => window.print());
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
        <div class="payslip-title">PAYSLIP</div>
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
              <tr><td>${emp.payType === 'Daily' ? 'Daily Rate' : 'Monthly Rate'}</td><td>:</td><td class="num">${fmtMoney(emp.payType === 'Daily' ? emp.rate : row.basePay)}</td></tr>
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
  // Deferred a beat so it doesn't compete with the login->portal transition/initial render.
  // Wrapped defensively -- a setTimeout callback that throws fails completely silently
  // (no visible error, nothing in the console the user could report), which would look
  // exactly like "nothing happens." try/catch here turns that into a visible signal.
  // Shows at most one of the two prompts per login -- the install prompt when there's
  // still an install step to do (the iOS prerequisite for push), otherwise the push-enable
  // prompt, so employees are never stacked with two modals back to back.
  setTimeout(() => {
    if (shouldShowInstallPrompt()) {
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
