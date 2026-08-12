/* App shell: router + shared UI helpers. Views register themselves on window.Views. */

window.Views = window.Views || {};

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

function closeModal() {
  const bd = qs('.modal-backdrop');
  if (bd) bd.remove();
}

function openModal(innerHtml, onMount) {
  closeModal();
  closeDrawer();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeModal(); });
  bd.innerHTML = '<div class="modal-wrap"><div class="modal">' +
    '<button class="modal-close" data-close-modal>&times;</button>' + innerHtml + '</div></div>';
  document.body.appendChild(bd);
  qsa('[data-close-modal]', bd).forEach(el => el.addEventListener('click', closeModal));
  if (onMount) onMount(bd);
  return bd;
}

function closeDrawer() {
  const dr = qs('.drawer');
  const bg = qs('.drawer-backdrop');
  if (dr) dr.remove();
  if (bg) bg.remove();
}

function openDrawer(innerHtml, onMount) {
  closeDrawer();
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'drawer-backdrop';
  bg.addEventListener('click', closeDrawer);
  document.body.appendChild(bg);
  const dr = document.createElement('div');
  dr.className = 'drawer';
  dr.innerHTML = innerHtml;
  document.body.appendChild(dr);
  if (onMount) onMount(dr);
  return dr;
}

// Printable Daily Time Record for one employee over a date range (typically a payroll
// cutoff). Opens as a fixed overlay; @media print rules in styles.css hide everything
// else on the page so "Print" (or the browser's Print > Save as PDF) yields a clean sheet.
function openDTR(emp, from, to) {
  // Guard against stacking multiple DTRs in the DOM (e.g. clicking "DTR →" more than once
  // without closing) — each one would render on its own printed page since printing
  // renders every .dtr-overlay in document order, not just the visually-topmost one.
  qsa('.dtr-overlay').forEach(el => el.remove());

  const records = Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id);
  const recByDate = {};
  records.forEach(r => { recByDate[r.date] = r; });

  const holidays = Store.holidaysInRange(from, to);
  const holidayByDate = {};
  holidays.forEach(h => { holidayByDate[h.date] = h; });

  const workDays = workDaysInRange(from, to);
  const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (workDays > 0 ? emp.rate / workDays : 0);
  // Same shared computeRow() the Payroll tab and My Payroll use, so the DTR's total pay
  // always matches those exactly -- gross/net for the whole cutoff, not just the NSD/OT/
  // Holiday premiums computed below.
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
// COLA etc., and a highlighted NET PAY bar) -- built from the same computeRow() the
// Payroll tab uses, so every figure here always matches there exactly.
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

function employeeOptions(selectedId, categoryFilter) {
  let emps = Store.listEmployees();
  if (categoryFilter) emps = emps.filter(e => e.category === categoryFilter);
  return emps.map(e => '<option value="' + e.id + '"' + (e.id === selectedId ? ' selected' : '') + '>' +
    escapeHtml(e.name) + ' (' + e.category + ')</option>').join('');
}

function employeeName(id) {
  const e = Store.getEmployee(id);
  return e ? e.name : '—';
}

function caseStatusBadge(status) {
  const map = {
    'Notice Issued': 'badge-orange',
    'Awaiting Response': 'badge-yellow',
    'Under Investigation': 'badge-blue',
    'Resolved': 'badge-green',
    'Escalated': 'badge-red',
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status) + '</span>';
}

function complaintStatusBadge(status) {
  const map = {
    'Open': 'badge-red',
    'In Progress': 'badge-yellow',
    'Resolved': 'badge-green',
    'Closed': 'badge-gray',
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status) + '</span>';
}

// Stored values stay Low/Medium/High (existing data, existing form option values) --
// only the displayed wording changed, to something more specific than a bare "High".
const PRIORITY_LABELS = { High: 'Urgent', Medium: 'Standard', Low: 'Low Priority' };

function priorityBadge(priority) {
  const map = { High: 'badge-red', Medium: 'badge-yellow', Low: 'badge-gray' };
  return '<span class="badge ' + (map[priority] || 'badge-gray') + '">' + escapeHtml(PRIORITY_LABELS[priority] || priority) + '</span>';
}

function employmentStatusBadge(status) {
  const map = { Regular: 'badge-blue', Probationary: 'badge-yellow', Contractual: 'badge-orange' };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status || '—') + '</span>';
}

function daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO + 'T00:00:00') - new Date(fromISO + 'T00:00:00')) / 86400000);
}

function lengthOfService(dateHired) {
  if (!dateHired) return '—';
  const today = todayISO();
  if (dateHired > today) return '—';
  const start = new Date(dateHired + 'T00:00:00');
  const end = new Date(today + 'T00:00:00');
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  const parts = [];
  if (years) parts.push(years + (years === 1 ? ' yr' : ' yrs'));
  if (months || !years) parts.push(months + (months === 1 ? ' mo' : ' mos'));
  return parts.join(' ');
}

function employeeStatusDot(status) {
  const map = { Active: 'on', 'On Leave': 'late', Off: 'off', Terminated: 'absent' };
  return '<span class="status-dot ' + (map[status] || '') + '">' + escapeHtml(status) + '</span>';
}

const ROUTES = ['overview', 'staff', 'recruitment', 'probation', 'disciplinary', 'attendance', 'payroll', 'complaints', 'leaveRequests', 'attendanceCorrections', 'auditLog', 'finance', 'adminFiles', 'materials'];

function currentRoute() {
  const h = (location.hash || '').replace('#', '').split('/')[0];
  return ROUTES.includes(h) ? h : 'overview';
}

function setActiveNav(route) {
  qsa('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

function render() {
  closeModal();
  closeDrawer();
  const route = currentRoute();
  setActiveNav(route);
  const main = qs('#main-content');
  main.innerHTML = '';
  const view = window.Views[route];
  if (view && view.render) {
    view.render(main);
  } else {
    main.innerHTML = '<div class="empty">Not found.</div>';
  }
}

// Every view re-renders by wholesale replacing main.innerHTML -- after saving a form,
// applying a filter, editing a row, etc. -- which was silently resetting scroll position
// (both the page itself and any wide table's horizontal scroll) back to the top/start
// every single time. Fixed once, system-wide, via a MutationObserver on the shared
// container instead of patching every individual view's render function.
function preserveScrollAcrossRerenders(container) {
  // #main-content/.main has no height or overflow-y of its own -- the page scrolls at the
  // document level, not on this element -- so the vertical position has to be tracked
  // there. The horizontal case (a wide table like the Calendar) is different: that really
  // is its own overflow-x:auto element nested inside container, so that one IS read/set
  // directly.
  const scroller = document.scrollingElement || document.documentElement;
  let scrollTop = 0;
  let panelScrollLeft = 0;

  // Captured synchronously at the moment of interaction (click/submit/change), not via the
  // "scroll" event -- confirmed the hard way (fixing the Attendance Calendar tab) that
  // "scroll" doesn't fire promptly/reliably enough for this to work.
  function capture() {
    scrollTop = scroller.scrollTop;
    const panel = qs('.panel', container);
    if (panel) panelScrollLeft = panel.scrollLeft;
  }
  ['click', 'submit', 'change'].forEach(evt => container.addEventListener(evt, capture, true));
  window.addEventListener('scroll', capture, { passive: true });

  function restore() {
    scroller.scrollTop = scrollTop;
    const panel = qs('.panel', container);
    if (panel) panel.scrollLeft = panelScrollLeft;
  }
  const observer = new MutationObserver(() => {
    restore();
    // Also deferred a tick -- setting scrollTop/scrollLeft immediately after new content
    // is inserted, before the browser has laid it out, can get silently clamped to 0.
    setTimeout(restore, 0);
  });
  observer.observe(container, { childList: true });
}

let appStarted = false;
let signedInEmail = null;
function currentUserEmail() { return signedInEmail; }

// ---- Payroll cutoff reminder push notifications (this device only) ----
// iPadOS reports itself as "MacIntel" with no "iPad" in the UA string once desktop-class
// Safari became the default, so the classic UA sniff alone misses it -- the touch-points
// check catches that case (a real Mac never reports maxTouchPoints > 1).
function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandaloneDisplay() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
// iOS/iPadOS Safari only exposes the Push API to a site that's been "Added to Home
// Screen" and opened from there (iOS 16.4+) -- opening it as a normal Safari tab, no
// matter how recent the device, will never have PushManager at all. Every other modern
// browser (Chrome, Firefox, Edge, desktop Safari 16+, Samsung Internet, ...) supports
// push in a plain tab, no install required -- this only special-cases iOS specifically,
// with an actionable next step, instead of a flat "not supported."
function pushUnsupportedReason() {
  if ('serviceWorker' in navigator && 'PushManager' in window) return null;
  if (isIosDevice() && !isStandaloneDisplay()) {
    return 'On iPhone/iPad: tap the Share button, then "Add to Home Screen." Open it from that icon (not from Safari) to enable notifications — iOS only allows this for installed apps.';
  }
  if (isIosDevice()) {
    return 'Push notifications need iOS/iPadOS 16.4 or later. Update iOS to enable this.';
  }
  return 'Push notifications aren\'t supported on this browser — try Chrome, Firefox, or Edge.';
}

// pushManager.subscribe() needs the VAPID public key as a raw byte array, not the
// base64url string it's stored/transmitted as.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getCurrentPushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  // Guards against the status card getting stuck on "Checking this device…" forever if
  // the browser's push backend is ever slow/unreachable (e.g. no network) — falls back to
  // "not enabled" rather than hanging the UI.
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
  const lookup = (async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  })();
  return Promise.race([lookup, timeout]);
}

async function enablePushReminders() {
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
  await Store.savePushSubscription(sub, currentUserEmail());
  return true;
}

async function disablePushReminders() {
  const sub = await getCurrentPushSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await Store.deletePushSubscriptionByEndpoint(endpoint);
}

// Plays a short "ringtone" tone via the Web Audio API — used both as a live preview
// (Test Sound button) and when a push notification arrives while a dashboard tab is
// actually open (see the service worker 'message' relay wired in startApp below). A
// service worker itself can't play audio, so with the app fully closed only the OS's own
// default notification sound plays — that's a platform limitation, not something fixable
// from here.
function playReminderTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1108.73, 1318.51]; // A5, C#6, E6 -- a simple three-note chime
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
    // Autoplay/audio can be blocked by the browser until the user interacts with the
    // page — silently skip the tone rather than throwing; the visual toast still shows.
  }
}

// ---- Two-factor authentication (TOTP) -- Settings -> Security ----
// Enrolling here is what actually turns on enforcement: the database's is_admin()
// requires an aal2 session once any verified TOTP factor exists on the account (see the
// "Require two-factor authentication" migration in supabase/schema.sql), so this isn't
// just a profile toggle -- it changes what the account can do without the second factor.
async function openSecurityModal() {
  openModal(`<h2>Security</h2><div class="modal-sub">Checking your account…</div>`);
  const { data: factorsData } = await sb.auth.mfa.listFactors();
  const verified = factorsData && factorsData.totp && factorsData.totp.find(f => f.status === 'verified');
  if (verified) renderSecurityEnabled(verified);
  else renderSecurityDisabled();
}

function renderSecurityEnabled(factor) {
  openModal(`
    <h2>Security</h2>
    <div class="modal-sub">Two-factor authentication (TOTP) is enabled on this account.</div>
    <div class="page-sub" style="margin:10px 0;">Every sign-in now requires a code from your authenticator app, in addition to your password.</div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close-modal>Close</button>
      <button type="button" class="btn btn-danger" id="btn-mfa-disable">Disable Two-Factor Authentication</button>
    </div>
  `, (bd) => {
    qs('#btn-mfa-disable', bd).addEventListener('click', async () => {
      if (!confirm('Disable two-factor authentication? Your account will only need a password to sign in.')) return;
      const { error } = await sb.auth.mfa.unenroll({ factorId: factor.id });
      if (error) { toast('Could not disable: ' + error.message); return; }
      toast('Two-factor authentication disabled.');
      closeModal();
    });
  });
}

function renderSecurityDisabled() {
  openModal(`
    <h2>Security</h2>
    <div class="modal-sub">Two-factor authentication (TOTP) is not enabled on this account.</div>
    <div class="page-sub" style="margin:10px 0;">Adds a code from an authenticator app (Google Authenticator, Authy, etc.) as a second requirement on top of your password.</div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
      <button type="button" class="btn btn-primary" id="btn-mfa-enable">Enable Two-Factor Authentication</button>
    </div>
  `, (bd) => {
    qs('#btn-mfa-enable', bd).addEventListener('click', async () => {
      const btn = qs('#btn-mfa-enable', bd);
      btn.disabled = true;
      btn.textContent = 'Setting up…';
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' });
      if (error) { toast('Could not start setup: ' + error.message); btn.disabled = false; btn.textContent = 'Enable Two-Factor Authentication'; return; }
      renderSecurityEnroll(data);
    });
  });
}

function renderSecurityEnroll(enrollData) {
  const factorId = enrollData.id;
  const qrSrc = enrollData.totp.qr_code; // already a data: URI (SVG) from Supabase
  openModal(`
    <h2>Set Up Two-Factor Authentication</h2>
    <div class="modal-sub">Scan this with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.</div>
    <div style="text-align:center; margin:14px 0;">
      <img src="${qrSrc}" alt="QR code for authenticator app" style="width:180px; height:180px; background:#fff; padding:8px; border-radius:8px;" />
      <div class="page-sub" style="margin-top:8px;">Can't scan? Enter this code manually:</div>
      <code style="font-size:12px; word-break:break-all;">${escapeHtml(enrollData.totp.secret)}</code>
    </div>
    <form id="mfa-enroll-form">
      <div class="modal-grid">
        <div class="field full"><label>6-digit code</label>
          <input name="code" inputmode="numeric" pattern="[0-9]*" maxlength="6" required autofocus />
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Verify &amp; Enable</button>
      </div>
    </form>
  `, (bd) => {
    // Enrolling (above) creates the factor immediately but it stays 'unverified' -- and
    // useless for enforcement -- until a real code from the app is verified here. If the
    // admin cancels/closes without verifying, the factor is left behind unverified; clean
    // it up so it doesn't linger or confuse a later listFactors() call.
    let verified = false;
    qsa('[data-close-modal]', bd).forEach(el => el.addEventListener('click', () => { if (!verified) sb.auth.mfa.unenroll({ factorId }); }));
    qs('#mfa-enroll-form', bd).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = new FormData(ev.target).get('code').trim();
      const btn = qs('button[type="submit"]', bd);
      btn.disabled = true;
      btn.textContent = 'Verifying…';
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code });
      if (error) {
        toast('Incorrect code — try again.');
        btn.disabled = false;
        btn.textContent = 'Verify & Enable';
        return;
      }
      verified = true;
      toast('✔ Two-factor authentication enabled.');
      closeModal();
    });
  });
}

async function startApp(session) {
  if (appStarted) return;
  appStarted = true;

  // This dashboard is HR/Admin only — an Employee Self-Service account (linked to an
  // employees row) belongs on the ess.html portal instead. is_admin() is the same
  // security-definer check RLS itself uses, so this mirrors the server-side boundary
  // rather than trusting anything client-side.
  const { data: isAdmin, error: adminCheckError } = await sb.rpc('is_admin');
  if (adminCheckError || !isAdmin) {
    await sb.auth.signOut();
    showAuthScreen('This dashboard is for HR/Admin accounts only. Employees should sign in at the My Portal link instead.');
    return;
  }

  signedInEmail = session.user.email;

  hideAuthScreen();
  qs('#user-email').textContent = session.user.email;
  qs('#btn-logout').addEventListener('click', () => sb.auth.signOut());
  qs('#btn-security').addEventListener('click', () => openSecurityModal());

  qsa('.nav-item').forEach(a => {
    a.addEventListener('click', function () {
      location.hash = '#' + a.dataset.route;
    });
  });
  window.addEventListener('hashchange', render);

  qs('#main-content').innerHTML = '<div class="empty">Loading…</div>';
  preserveScrollAcrossRerenders(qs('#main-content'));
  await Store.init();

  // Relayed from the service worker's 'push' handler (sw.js) whenever a payroll cutoff
  // reminder arrives while this tab is open — plays the ringtone here, since a service
  // worker has no audio output of its own. The OS's own notification (with its default
  // sound/vibration) is shown regardless, by the service worker itself.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'payroll-reminder-push') {
        playReminderTone();
        toast('🔔 ' + event.data.title);
      }
    });
  }

  // Live updates from other devices: any remote change refetches that table and
  // re-renders the current view. Debounced, and skipped while a modal/drawer is open
  // so we don't yank a form out from under someone mid-edit.
  let renderTimer = null;
  Store.onRemoteChange(() => {
    if (qs('.modal-backdrop') || qs('.drawer')) {
      toast('Updated elsewhere — close this to see the latest.');
      return;
    }
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 150);
  });

  render();
}

// A password-only session is "aal1". Once an admin has enrolled a TOTP factor (see the
// Security panel), is_admin() in the database requires "aal2" -- i.e. the second factor
// was actually verified this session -- so a signed-in-but-not-yet-challenged session
// must be routed to the MFA challenge screen before startApp()'s is_admin() check, or
// they'd be incorrectly told "this dashboard is for HR/Admin accounts only."
async function routeSession(session) {
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    await showMfaChallengeScreen();
  } else {
    await startApp(session);
  }
}

async function boot() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await routeSession(session);
    } else {
      showAuthScreen();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await routeSession(session);
      } else if (event === 'SIGNED_OUT') {
        location.reload();
      }
    });
  } catch (err) {
    showAuthScreen('Cannot reach Supabase. Check js/supabase-config.js.');
  }
}

document.addEventListener('DOMContentLoaded', boot);
