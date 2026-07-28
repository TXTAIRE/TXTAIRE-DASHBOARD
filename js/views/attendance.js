window.Views.attendance = (function () {
  let selectedDate = todayISO();
  let filterCategory = 'All';
  let activeTab = 'daily';

  const calToday = new Date(todayISO() + 'T00:00:00');
  let calGroup = '10-20';
  let calPos = defaultCutoffPosition(calGroup, calToday.getFullYear(), calToday.getMonth() + 1, calToday.getDate());
  let calYear = calPos.year;
  let calMonth = calPos.month;
  let calHalf = calPos.half;

  function setCalGroup(g) {
    calGroup = g;
    const t = new Date(todayISO() + 'T00:00:00');
    const p = defaultCutoffPosition(calGroup, t.getFullYear(), t.getMonth() + 1, t.getDate());
    calYear = p.year; calMonth = p.month; calHalf = p.half;
  }
  function shiftCalMonth(delta) {
    let m = calMonth + delta, y = calYear;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    calMonth = m; calYear = y;
  }

  function statusDotClass(status) {
    return { Present: 'on', Late: 'late', Absent: 'absent', 'On Leave': 'off' }[status] || '';
  }

  // Opens a self-clock-in/out photo. Opens the tab synchronously (on the click itself) so
  // browsers don't treat it as an unrequested popup, then points it at the signed URL once
  // fetched — createSignedUrl is async and the tab must already exist before that resolves.
  function viewPhoto(path) {
    if (!path) return;
    const win = window.open('', '_blank');
    Store.getSignedPhotoUrl(path).then((url) => {
      if (url && win) win.location.href = url;
      else if (win) win.close();
    });
  }

  function attendanceTable(employees, recByEmp) {
    if (!employees.length) return '<div class="empty">No staff in this group.</div>';
    return `
      <table>
        <thead><tr><th>Name</th><th>Position</th><th>Status</th><th>Time In</th><th>Time Out</th><th class="num">Hours</th><th></th><th></th></tr></thead>
        <tbody>
          ${employees.map(e => {
            const r = recByEmp[e.id];
            const photos = [r && r.timeInPhotoPath, r && r.timeOutPhotoPath].filter(Boolean);
            return `
            <tr>
              <td class="name">${escapeHtml(e.name)}</td>
              <td class="dim">${escapeHtml(e.position || '—')}</td>
              <td>${r ? `<span class="status-dot ${statusDotClass(r.status)}">${r.status}</span>` : '<span class="status-dot">Not logged</span>'}</td>
              <td class="dim">${r ? to12Hour(r.timeIn) : '—'}</td>
              <td class="dim">${r ? to12Hour(r.timeOut) : '—'}</td>
              <td class="num">${r ? r.hours : '—'}</td>
              <td>${photos.length ? photos.map((p, i) => `<button class="link-btn" data-photo="${p}" title="Self-clock-in photo proof">📷${photos.length > 1 ? (i === 0 ? ' In' : ' Out') : ''}</button>`).join(' ') : ''}</td>
              <td><button class="link-btn" data-emp="${e.id}" data-rec="${r ? r.id : ''}">${r ? 'Edit →' : 'Log →'}</button></td>
            </tr>
          `; }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderView(main) {
    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Attendance</h1>
          <div class="page-sub">Daily attendance and leave monitoring, separated by Admins and Technicians.</div>
        </div>
        ${activeTab === 'daily' ? '<button class="btn btn-primary" id="btn-log-attendance">+ Log attendance</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'daily' ? 'active' : ''}" data-tab="daily">Daily</div>
        <div class="tab ${activeTab === 'calendar' ? 'active' : ''}" data-tab="calendar">Calendar</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnLog = qs('#btn-log-attendance', main);
    if (btnLog) btnLog.addEventListener('click', () => openAttendanceModal(main, null, null));

    if (activeTab === 'daily') renderDailyTab(qs('#tab-body', main), main);
    else renderCalendarTab(qs('#tab-body', main), main);
  }

  function renderDailyTab(body, main) {
    const employees = Store.listEmployees().filter(e => e.status !== 'Terminated').sort((a, b) => a.name.localeCompare(b.name));
    const admins = employees.filter(e => e.category === 'Admin');
    const technicians = employees.filter(e => e.category === 'Technician');
    const records = Store.attendanceForDate(selectedDate);
    const recByEmp = {};
    records.forEach(r => { recByEmp[r.employeeId] = r; });

    const present = records.filter(r => r.status === 'Present' || r.status === 'Late').length;

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Category</label>
          <div class="seg" id="seg-category">
            ${['All'].concat(CATEGORIES).map(c => `<button data-val="${c}" class="${filterCategory === c ? 'active' : ''}">${c}</button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Date</label><input type="date" id="date-picker" value="${selectedDate}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-prev-day">← Prev</button>
        <button class="btn btn-ghost btn-sm" id="btn-today">Today</button>
        <button class="btn btn-ghost btn-sm" id="btn-next-day">Next →</button>
      </div>

      <div class="page-sub" style="margin-bottom:10px;">${employees.length} staff members · ${present} on shift on ${fmtDate(selectedDate)}</div>

      ${filterCategory === 'All' || filterCategory === 'Admin' ? `
      <div class="section-title" style="margin-top:0;">Admins <span class="dim" style="font-weight:400;">(${admins.length})</span></div>
      <div class="panel">${attendanceTable(admins, recByEmp)}</div>
      ` : ''}

      ${filterCategory === 'All' || filterCategory === 'Technician' ? `
      <div class="section-title" ${filterCategory === 'Technician' ? 'style="margin-top:0;"' : ''}>Technicians <span class="dim" style="font-weight:400;">(${technicians.length})</span></div>
      <div class="panel">${attendanceTable(technicians, recByEmp)}</div>
      ` : ''}
    `;

    qsa('#seg-category button', body).forEach(b => b.addEventListener('click', () => { filterCategory = b.dataset.val; renderDailyTab(body, main); }));
    qs('#date-picker', body).addEventListener('change', (e) => { selectedDate = e.target.value; renderDailyTab(body, main); });
    qs('#btn-prev-day', body).addEventListener('click', () => { selectedDate = addDays(selectedDate, -1); renderDailyTab(body, main); });
    qs('#btn-today', body).addEventListener('click', () => { selectedDate = todayISO(); renderDailyTab(body, main); });
    qs('#btn-next-day', body).addEventListener('click', () => { selectedDate = addDays(selectedDate, 1); renderDailyTab(body, main); });
    qsa('[data-emp]', body).forEach(b => b.addEventListener('click', () => openAttendanceModal(main, b.dataset.emp, b.dataset.rec || null)));
    qsa('[data-photo]', body).forEach(b => b.addEventListener('click', () => viewPhoto(b.dataset.photo)));
  }

  // Calendar tab: rows = employees in the selected pay group, columns = every day in the
  // selected payroll cutoff, click any cell to log/edit that day. Each employee's row ends
  // with the automatically computed Net Pay for that cutoff (via the shared computeRow()),
  // so the calendar doubles as a live per-cutoff pay preview — no separate calculation.
  function calDayCell(emp, date, rec, holiday) {
    const dow = new Date(date + 'T00:00:00').getDay();
    const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(date, date) || 1));
    const pay = rec ? computeDayPay(dailyRateEq, rec, holiday) : null;
    const badges = [];
    if (pay && pay.nsdHrs) badges.push('<span class="badge badge-blue" title="Night Shift Differential">NSD</span>');
    if (pay && pay.otHrs) badges.push('<span class="badge badge-orange" title="Overtime">OT</span>');
    if (holiday) badges.push(`<span class="badge ${holiday.type === 'Regular' ? 'badge-blue' : 'badge-yellow'}" title="${escapeHtml(holiday.name)}">HOL</span>`);
    if (rec && (rec.timeInPhotoPath || rec.timeOutPhotoPath)) {
      badges.push(`<span class="badge badge-gray" data-view-photo="${rec.timeOutPhotoPath || rec.timeInPhotoPath}" title="Self-clock-in photo proof">📷</span>`);
    }

    let cls = 'cal-cell';
    if (rec) {
      if (rec.status === 'Present') cls += ' cal-present';
      else if (rec.status === 'Late') cls += ' cal-late';
      else if (rec.status === 'Absent') cls += ' cal-absent';
      else if (rec.status === 'On Leave') cls += ' cal-leave';
    } else if (dow === 0) cls += ' cal-restday';

    return `
      <td class="${cls}" data-emp="${emp.id}" data-date="${date}">
        ${rec ? `
          <div class="cal-time">${to12Hour(rec.timeIn)}</div>
          <div class="cal-time">${rec.timeOut ? to12Hour(rec.timeOut) : '—'}</div>
          <div class="cal-hours">${rec.hours}h</div>
          ${badges.length ? `<div class="cal-badges">${badges.join('')}</div>` : ''}
        ` : `<div class="cal-empty-cell">${dow === 0 ? '—' : '+'}</div>`}
      </td>
    `;
  }

  function renderCalendarTab(body, main) {
    const cutoffs = payCutoffs(calGroup, calYear, calMonth);
    const selected = cutoffs.find(c => c.key === calHalf) || cutoffs[0];
    const monthValue = `${calYear}-${pad2(calMonth)}`;
    const monthLabel = new Date(calYear, calMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const employees = Store.listEmployees().filter(e => e.payCycle === calGroup && e.status !== 'Terminated').sort((a, b) => a.name.localeCompare(b.name));
    const holidays = Store.holidaysInRange(selected.from, selected.to);
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = h; });

    const days = [];
    let d = selected.from;
    while (d <= selected.to) { days.push(d); d = addDays(d, 1); }

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Pay group</label>
          <div class="seg" id="cal-seg-group">
            <button data-val="10-20" class="${calGroup === '10-20' ? 'active' : ''}">Admins</button>
            <button data-val="15-30" class="${calGroup === '15-30' ? 'active' : ''}">Technicians</button>
          </div>
        </div>
      </div>
      <div class="filters">
        <button class="btn btn-ghost btn-sm" id="cal-btn-prev-month">← Prev month</button>
        <div class="field"><label>Month</label><input type="month" id="cal-month-input" value="${monthValue}" /></div>
        <button class="btn btn-ghost btn-sm" id="cal-btn-next-month">Next month →</button>
        <div class="field">
          <label>Cutoff</label>
          <div class="seg" id="cal-seg-cutoff">
            ${cutoffs.map(c => `<button data-val="${c.key}" class="${calHalf === c.key ? 'active' : ''}">${c.label}</button>`).join('')}
          </div>
        </div>
      </div>
      <div class="page-sub" style="margin-bottom:10px;">${monthLabel} · ${selected.label} · payday ${fmtDate(selected.payDate)} · click any cell to log or edit that day</div>

      <div class="panel">
        ${employees.length ? `
        <table class="cal-table">
          <thead>
            <tr>
              <th class="cal-name-col">Staff</th>
              ${days.map(date => {
                const dt = new Date(date + 'T00:00:00');
                return `<th class="cal-day-col ${holidayByDate[date] ? 'cal-holiday-col' : ''}">${dt.toLocaleDateString('en-US', { weekday: 'short' })}<br/>${dt.getDate()}</th>`;
              }).join('')}
              <th class="num cal-net-col">Net Pay</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const records = Store.attendanceInRange(selected.from, selected.to).filter(a => a.employeeId === emp.id);
              const recByDate = {};
              records.forEach(r => { recByDate[r.date] = r; });
              const row = computeRow(emp, selected.from, selected.to);
              return `
                <tr>
                  <td class="cal-name-col name">${escapeHtml(emp.name)}</td>
                  ${days.map(date => calDayCell(emp, date, recByDate[date], holidayByDate[date])).join('')}
                  <td class="num cal-net-col" style="font-weight:700;">${fmtMoney(row.net)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>` : '<div class="empty">No staff assigned to this pay schedule.</div>'}
      </div>
    `;

    qsa('#cal-seg-group button', body).forEach(b => b.addEventListener('click', () => { setCalGroup(b.dataset.val); renderCalendarTab(body, main); }));
    qsa('#cal-seg-cutoff button', body).forEach(b => b.addEventListener('click', () => { calHalf = b.dataset.val; renderCalendarTab(body, main); }));
    qs('#cal-month-input', body).addEventListener('change', (ev) => {
      const [y, m] = ev.target.value.split('-').map(Number);
      calYear = y; calMonth = m;
      renderCalendarTab(body, main);
    });
    qs('#cal-btn-prev-month', body).addEventListener('click', () => { shiftCalMonth(-1); renderCalendarTab(body, main); });
    qs('#cal-btn-next-month', body).addEventListener('click', () => { shiftCalMonth(1); renderCalendarTab(body, main); });
    qsa('.cal-cell', body).forEach(cell => cell.addEventListener('click', (ev) => {
      const photoEl = ev.target.closest('[data-view-photo]');
      if (photoEl) { viewPhoto(photoEl.dataset.viewPhoto); return; }
      const empId = cell.dataset.emp, date = cell.dataset.date;
      const rec = Store.listAttendance().find(a => a.employeeId === empId && a.date === date);
      selectedDate = date;
      openAttendanceModal(main, empId, rec ? rec.id : null);
    }));
  }

  // Employees flagged as typically working nights (Store.getEmployee(...).nightShiftDifferential)
  // get a night-shift default (10pm-6am) instead of the standard day-shift default, so HR
  // doesn't have to retype it every time. This only affects the form's starting values —
  // NSD pay itself is always computed from whatever time in/out actually gets logged.
  function defaultShiftFor(employeeId) {
    const emp = employeeId ? Store.getEmployee(employeeId) : null;
    if (emp && emp.nightShiftDifferential) return { timeIn: '22:00', timeOut: '06:00', hours: 8 };
    return { timeIn: '09:00', timeOut: '18:00', hours: 8 };
  }

  function openAttendanceModal(main, empId, recId) {
    const rec = recId ? Store.listAttendance().find(a => a.id === recId) : null;
    const r = rec || Object.assign({ employeeId: empId || '', date: selectedDate, status: 'Present' }, defaultShiftFor(empId));

    openModal(`
      <h2>${rec ? 'Edit attendance' : 'Log attendance'}</h2>
      <form id="att-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select name="employeeId" id="att-employee">${employeeOptions(r.employeeId)}</select></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${r.date}" /></div>
          <div class="field"><label>Status</label>
            <select name="status">${['Present', 'Late', 'Absent', 'On Leave'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Time in</label><input type="time" name="timeIn" id="att-time-in" value="${r.timeIn}" /></div>
          <div class="field"><label>Time out</label><input type="time" name="timeOut" id="att-time-out" value="${r.timeOut}" /></div>
          <div class="field"><label>Hours</label><input type="number" step="0.1" name="hours" value="${r.hours}" /></div>
        </div>
        <div class="modal-actions">
          ${rec ? '<button type="button" class="btn btn-danger" id="btn-del-att">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${rec ? 'Save changes' : 'Log attendance'}</button>
        </div>
      </form>
    `, (bd) => {
      if (!rec) {
        qs('#att-employee', bd).addEventListener('change', (ev) => {
          const shift = defaultShiftFor(ev.target.value);
          qs('#att-time-in', bd).value = shift.timeIn;
          qs('#att-time-out', bd).value = shift.timeOut;
        });
      }
      qs('#att-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          employeeId: fd.get('employeeId'),
          date: fd.get('date'),
          status: fd.get('status'),
          timeIn: fd.get('timeIn'),
          timeOut: fd.get('timeOut'),
          hours: Number(fd.get('hours')) || 0,
        };
        if (rec) { await Store.updateAttendance(rec.id, patch); toast('Attendance updated.'); }
        else { await Store.addAttendance(patch); toast('Attendance logged.'); }
        closeModal();
        renderView(main);
      });
      const delBtn = qs('#btn-del-att', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        await Store.deleteAttendance(rec.id);
        closeModal();
        toast('Record deleted.');
        renderView(main);
      });
    });
  }

  // Jumps straight to editing (or logging) one employee's attendance for one date —
  // used by the Attendance Corrections review screen's "Edit attendance record" link.
  function openFor(employeeId, date) {
    const main = qs('#main-content');
    if (!main) return;
    selectedDate = date;
    renderView(main);
    const rec = Store.listAttendance().find(a => a.employeeId === employeeId && a.date === date);
    openAttendanceModal(main, employeeId, rec ? rec.id : null);
  }

  return { render: renderView, openFor };
})();
