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
  qs('[data-close-modal]', bd).addEventListener('click', closeModal);
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
        <div class="page-sub" style="margin-top:6px;">Daily-rate equivalent used for these computations: ${fmtMoney(dailyRateEq)} / day (${fmtMoney(dailyRateEq / 8)} / hour). This excludes base pay, COLA, and housing allowance — see the Payroll tab for full gross and net pay.</div>
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

function priorityBadge(priority) {
  const map = { High: 'badge-red', Medium: 'badge-yellow', Low: 'badge-gray' };
  return '<span class="badge ' + (map[priority] || 'badge-gray') + '">' + escapeHtml(priority) + '</span>';
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

const ROUTES = ['overview', 'staff', 'recruitment', 'probation', 'disciplinary', 'attendance', 'payroll', 'complaints', 'leaveRequests', 'attendanceCorrections', 'auditLog'];

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

let appStarted = false;
let signedInEmail = null;
function currentUserEmail() { return signedInEmail; }

async function startApp(session) {
  if (appStarted) return;
  appStarted = true;
  signedInEmail = session.user.email;

  hideAuthScreen();
  qs('#user-email').textContent = session.user.email;
  qs('#btn-logout').addEventListener('click', () => sb.auth.signOut());

  qsa('.nav-item').forEach(a => {
    a.addEventListener('click', function () {
      location.hash = '#' + a.dataset.route;
    });
  });
  window.addEventListener('hashchange', render);

  qs('#main-content').innerHTML = '<div class="empty">Loading…</div>';
  await Store.init();

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

async function boot() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
      await startApp(session);
    } else {
      showAuthScreen();
    }

    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await startApp(session);
      } else if (event === 'SIGNED_OUT') {
        location.reload();
      }
    });
  } catch (err) {
    showAuthScreen('Cannot reach Supabase. Check js/supabase-config.js.');
  }
}

document.addEventListener('DOMContentLoaded', boot);
