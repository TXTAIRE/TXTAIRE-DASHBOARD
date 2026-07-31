window.Views.attendance = (function () {
  let selectedDate = todayISO();
  let filterCategory = 'All';
  let activeTab = 'daily';

  const calToday = new Date(todayISO() + 'T00:00:00');
  let calGroup = '10-20';
  let calYear = calToday.getFullYear();
  let calMonth = calToday.getMonth() + 1;

  function setCalGroup(g) {
    calGroup = g;
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

  function countPendingRequests() {
    return Store.listAttendance().reduce((n, r) =>
      n + (r.nsdStatus === 'Requested' ? 1 : 0) + (r.otStatus === 'Requested' ? 1 : 0) + (r.holidayStatus === 'Requested' ? 1 : 0), 0);
  }

  function renderView(main) {
    const pendingCount = countPendingRequests();
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
        <div class="tab ${activeTab === 'requests' ? 'active' : ''}" data-tab="requests">Requests${pendingCount ? ` <span class="badge badge-yellow">${pendingCount}</span>` : ''}</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnLog = qs('#btn-log-attendance', main);
    if (btnLog) btnLog.addEventListener('click', () => openAttendanceModal(main, null, null));

    if (activeTab === 'daily') renderDailyTab(qs('#tab-body', main), main);
    else if (activeTab === 'calendar') renderCalendarTab(qs('#tab-body', main), main);
    else renderRequestsTab(qs('#tab-body', main), main);
  }

  // NSD/OT/Holiday pay employees requested from My Portal, awaiting HR approval — nothing
  // here counts toward payroll until approved (js/store.js computeDayPay checks for
  // 'Approved' specifically). "If approved" previews the exact amount using the same
  // shared pay math the Payroll tab uses, so there's no separate calculation to keep in sync.
  function renderRequestsTab(body, main) {
    const empById = {};
    Store.listEmployees().forEach(e => { empById[e.id] = e; });
    const holidayByDate = {};
    Store.listHolidays().forEach(h => { holidayByDate[h.date] = h; });

    const pending = Store.listAttendance()
      .filter(r => r.nsdStatus === 'Requested' || r.otStatus === 'Requested' || r.holidayStatus === 'Requested')
      .sort((a, b) => b.date.localeCompare(a.date));

    body.innerHTML = `
      <div class="page-sub" style="margin-bottom:10px;">Night Shift Differential, Overtime, and Holiday pay only count toward payroll once approved here.</div>
      <div class="panel">
        ${pending.length ? `
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>Type</th><th class="num">If approved</th><th></th></tr></thead>
          <tbody>
            ${pending.map(r => {
              const emp = empById[r.employeeId];
              if (!emp) return '';
              const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(r.date, r.date) || 1));
              const holiday = holidayByDate[r.date];
              const previewPay = computeDayPay(dailyRateEq, Object.assign({}, r, { nsdStatus: 'Approved', otStatus: 'Approved', holidayStatus: 'Approved' }), holiday);
              const rows = [];
              if (r.nsdStatus === 'Requested') rows.push({ kind: 'nsd', label: 'Night Shift Diff.', amount: fmtMoney(previewPay.nsdPay) });
              if (r.otStatus === 'Requested') rows.push({ kind: 'ot', label: 'Overtime', amount: fmtMoney(previewPay.otPay) });
              if (r.holidayStatus === 'Requested' && holiday) rows.push({ kind: 'holiday', label: `Holiday Pay (${escapeHtml(holiday.name)})`, amount: fmtMoney(previewPay.holidayPay) });
              return rows.map(row => `
                <tr>
                  <td class="name">${escapeHtml(emp.name)}</td>
                  <td class="dim">${fmtDate(r.date)}</td>
                  <td>${row.label}</td>
                  <td class="num">${row.amount}</td>
                  <td style="white-space:nowrap;">
                    <button class="btn btn-primary btn-sm" data-approve="${row.kind}" data-rec-id="${r.id}">Approve</button>
                    <button class="btn btn-ghost btn-sm" data-reject="${row.kind}" data-rec-id="${r.id}">Reject</button>
                  </td>
                </tr>
              `).join('');
            }).join('')}
          </tbody>
        </table>` : '<div class="empty">No pending NSD/OT/Holiday requests.</div>'}
      </div>
    `;

    qsa('[data-approve]', body).forEach(b => b.addEventListener('click', async () => {
      await Store.updateAttendance(b.dataset.recId, { [b.dataset.approve + 'Status']: 'Approved' });
      toast('✔ Approved');
      renderView(main);
    }));
    qsa('[data-reject]', body).forEach(b => b.addEventListener('click', async () => {
      await Store.updateAttendance(b.dataset.recId, { [b.dataset.reject + 'Status']: 'Rejected' });
      toast('Rejected');
      renderView(main);
    }));
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

  // Which payroll cutoff (of the two whose END falls in the displayed month) a given day
  // belongs to — used only to tint/group day columns for readability. Days after cutoff
  // B's end belong to a cutoff that ENDS next month, so they get no Net Pay column here;
  // they'll show up as the "A" tail when the admin navigates to next month instead.
  function cutoffClassFor(date, cutoffs) {
    if (date <= cutoffs[0].to) return 'cal-cutoff-a';
    if (date <= cutoffs[1].to) return 'cal-cutoff-b';
    return 'cal-cutoff-next';
  }

  function renderCalendarTab(body, main) {
    const cutoffs = payCutoffs(calGroup, calYear, calMonth);
    const monthValue = `${calYear}-${pad2(calMonth)}`;
    const monthLabel = new Date(calYear, calMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const last = daysInMonth(calYear, calMonth);
    const monthFrom = `${calYear}-${pad2(calMonth)}-01`;
    const monthTo = `${calYear}-${pad2(calMonth)}-${pad2(last)}`;

    // Days after cutoff B's end belong to a THIRD cutoff (this month's "next cutoff A")
    // that won't close until next month -- without a column for it, days visibly logged
    // in that tail (e.g. the 19th-31st) looked like they weren't counting toward anything,
    // which read as "not automatically computing." This shows what's accrued so far.
    let nextM = calMonth + 1, nextY = calYear;
    if (nextM > 12) { nextM = 1; nextY += 1; }
    const upcoming = payCutoffs(calGroup, nextY, nextM)[0];

    const employees = Store.listEmployees().filter(e => e.payCycle === calGroup && e.status !== 'Terminated').sort((a, b) => a.name.localeCompare(b.name));
    const holidays = Store.holidaysInRange(monthFrom, monthTo);
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = h; });

    const days = [];
    for (let day = 1; day <= last; day++) days.push(`${calYear}-${pad2(calMonth)}-${pad2(day)}`);
    const cutoffBStart = days.find(date => date > cutoffs[0].to);
    const nextCutoffStart = days.find(date => date > cutoffs[1].to);

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Pay group</label>
          <div class="seg" id="cal-seg-group">
            <button data-val="10-20" class="${calGroup === '10-20' ? 'active' : ''}">Admins</button>
            <button data-val="15-30" class="${calGroup === '15-30' ? 'active' : ''}">Technicians</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" id="cal-btn-edit-cutoff" style="align-self:flex-end;">✏️ Edit Cutoff Days</button>
      </div>
      <div class="filters">
        <button class="btn btn-ghost btn-sm" id="cal-btn-prev-month">← Prev month</button>
        <div class="field"><label>Month</label><input type="month" id="cal-month-input" value="${monthValue}" /></div>
        <div class="field"><label>Year</label><input type="number" id="cal-year-input" value="${calYear}" min="2000" max="2100" step="1" style="width:90px;" /></div>
        <button class="btn btn-ghost btn-sm" id="cal-btn-next-month">Next month →</button>
      </div>
      <div class="page-sub" style="margin-bottom:10px;">
        ${monthLabel} · Cutoff A: ${cutoffs[0].label} · Cutoff B: ${cutoffs[1].label} · click an empty cell to instantly log a shift, or a logged cell to fine-tune it. Days after the ${ordinal(new Date(cutoffs[1].to + 'T00:00:00').getDate())} belong to the next cutoff (ending ${fmtDate(upcoming.to)}) — see "Upcoming (partial)".
      </div>

      <div class="panel" style="overflow-x:auto;">
        ${employees.length ? `
        <table class="cal-table">
          <thead>
            <tr>
              <th class="cal-name-col">Staff</th>
              ${days.map(date => {
                const dt = new Date(date + 'T00:00:00');
                const boundary = (date === cutoffBStart || date === nextCutoffStart) ? ' cal-cutoff-start' : '';
                return `<th class="cal-day-col ${cutoffClassFor(date, cutoffs)}${boundary} ${holidayByDate[date] ? 'cal-holiday-col' : ''}">${dt.toLocaleDateString('en-US', { weekday: 'short' })}<br/>${dt.getDate()}</th>`;
              }).join('')}
              <th class="num cal-net-col">Cutoff A Net</th>
              <th class="num cal-net-col">Cutoff B Net</th>
              <th class="num cal-net-col">Upcoming <span class="dim" style="font-weight:400;">(partial)</span></th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const records = Store.attendanceInRange(monthFrom, monthTo).filter(a => a.employeeId === emp.id);
              const recByDate = {};
              records.forEach(r => { recByDate[r.date] = r; });
              const rowA = computeRow(emp, cutoffs[0].from, cutoffs[0].to);
              const rowB = computeRow(emp, cutoffs[1].from, cutoffs[1].to);
              const rowUpcoming = computeRow(emp, upcoming.from, upcoming.to);
              return `
                <tr>
                  <td class="cal-name-col name">${escapeHtml(emp.name)}</td>
                  ${days.map(date => {
                    const boundary = (date === cutoffBStart || date === nextCutoffStart) ? ' cal-cutoff-start' : '';
                    return calDayCell(emp, date, recByDate[date], holidayByDate[date]).replace('class="cal-cell', `class="cal-cell ${cutoffClassFor(date, cutoffs)}${boundary}`);
                  }).join('')}
                  <td class="num cal-net-col" style="font-weight:700;">${fmtMoney(rowA.net)}</td>
                  <td class="num cal-net-col" style="font-weight:700;">${fmtMoney(rowB.net)}</td>
                  <td class="num cal-net-col" style="font-weight:700;">${fmtMoney(rowUpcoming.net)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>` : '<div class="empty">No staff assigned to this pay schedule.</div>'}
      </div>
    `;

    // Scroll position (both the page and this table's horizontal scroll) is preserved
    // system-wide by preserveScrollAcrossRerenders (js/app.js) -- no per-view handling
    // needed here anymore.

    qsa('#cal-seg-group button', body).forEach(b => b.addEventListener('click', () => { setCalGroup(b.dataset.val); renderCalendarTab(body, main); }));
    qs('#cal-btn-edit-cutoff', body).addEventListener('click', () => openEditCutoffModal(body, main));
    qs('#cal-month-input', body).addEventListener('change', (ev) => {
      const [y, m] = ev.target.value.split('-').map(Number);
      calYear = y; calMonth = m;
      renderCalendarTab(body, main);
    });
    qs('#cal-year-input', body).addEventListener('change', (ev) => {
      const y = Number(ev.target.value);
      if (y >= 2000 && y <= 2100) { calYear = y; renderCalendarTab(body, main); }
    });
    qs('#cal-btn-prev-month', body).addEventListener('click', () => { shiftCalMonth(-1); renderCalendarTab(body, main); });
    qs('#cal-btn-next-month', body).addEventListener('click', () => { shiftCalMonth(1); renderCalendarTab(body, main); });
    qsa('.cal-cell', body).forEach(cell => cell.addEventListener('click', async (ev) => {
      const photoEl = ev.target.closest('[data-view-photo]');
      if (photoEl) { viewPhoto(photoEl.dataset.viewPhoto); return; }
      const empId = cell.dataset.emp, date = cell.dataset.date;
      const rec = Store.listAttendance().find(a => a.employeeId === empId && a.date === date);
      if (!rec) {
        // One-click quick log: an empty cell instantly gets a default shift, no form —
        // NSD/OT/holiday badges compute automatically from it just like any other record.
        // Click the now-logged cell again to fine-tune exact times or delete it.
        cell.style.opacity = '0.5';
        await Store.addAttendance({ employeeId: empId, date, status: 'Present', ...defaultShiftFor(empId) });
        toast('✔ Logged a default shift — click it again to fine-tune the times.');
        renderCalendarTab(body, main);
        return;
      }
      selectedDate = date;
      openAttendanceModal(main, empId, rec.id);
    }));
  }

  // Lets HR change where each cutoff half ends (and its payday) for the currently
  // selected pay group — replaces what used to be hardcoded. Warns (but doesn't block,
  // in case of a deliberate one-off business reason) if a change would push either half
  // over the Labor Code's 16-day maximum cutoff length.
  function openEditCutoffModal(body, main) {
    const s = Store.getPayCutoffSetting(calGroup) || DEFAULT_CUTOFF_SETTINGS[calGroup];
    const groupName = calGroup === '15-30' ? 'Technicians' : 'Admins';

    function warningHtml(cutoffAEndDay, cutoffBEndDay) {
      const { spanA, spanB } = cutoffSpans(cutoffAEndDay, cutoffBEndDay);
      const problems = [];
      if (spanA > 16) problems.push(`Cutoff A could reach ${spanA} days`);
      if (spanB > 16) problems.push(`Cutoff B could reach ${spanB} days`);
      if (!problems.length) return '';
      return `<div class="modal-sub" style="color:#b45309;">⚠ ${problems.join(' and ')} — exceeds the Labor Code's 16-day maximum in some months. You can still save, but double-check this is intended.</div>`;
    }

    openModal(`
      <h2>Edit Cutoff Days — ${groupName}</h2>
      <div class="modal-sub">Changes apply to every future month for this pay group and recompute Net Pay automatically.</div>
      <form id="cutoff-form">
        <div class="modal-grid">
          <div class="field"><label>Cutoff A ends on day</label><input type="number" name="cutoffAEndDay" min="1" max="31" required value="${s.cutoffAEndDay}" /></div>
          <div class="field"><label>Cutoff A payday</label><input type="number" name="paydayADay" min="1" max="31" required value="${s.paydayADay}" /></div>
          <div class="field"><label>Cutoff B ends on day</label><input type="number" name="cutoffBEndDay" min="1" max="31" required value="${s.cutoffBEndDay}" /></div>
          <div class="field"><label>Cutoff B payday</label><input type="number" name="paydayBDay" min="1" max="31" required value="${s.paydayBDay}" /></div>
        </div>
        <div id="cutoff-warning">${warningHtml(s.cutoffAEndDay, s.cutoffBEndDay)}</div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `, (bd) => {
      const recheck = () => {
        const a = Number(qs('input[name="cutoffAEndDay"]', bd).value) || 0;
        const b = Number(qs('input[name="cutoffBEndDay"]', bd).value) || 0;
        qs('#cutoff-warning', bd).innerHTML = warningHtml(a, b);
      };
      qs('input[name="cutoffAEndDay"]', bd).addEventListener('input', recheck);
      qs('input[name="cutoffBEndDay"]', bd).addEventListener('input', recheck);

      qs('#cutoff-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          cutoffAEndDay: Number(fd.get('cutoffAEndDay')),
          paydayADay: Number(fd.get('paydayADay')),
          cutoffBEndDay: Number(fd.get('cutoffBEndDay')),
          paydayBDay: Number(fd.get('paydayBDay')),
        };
        await Store.updatePayCutoffSetting(calGroup, patch);
        toast('✔ Cutoff days updated.');
        closeModal();
        renderCalendarTab(body, main);
      });
    });
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

  // Who approved this OT/NSD/Holiday pay and when -- stamped automatically by a database
  // trigger the instant the status actually transitions to 'Approved' (see
  // stamp_attendance_approvals in supabase/schema.sql), never set by this app code
  // directly. Only shown once actually Approved, since that's the only state the stamp
  // is guaranteed to correspond to.
  function approvalStampHtml(status, approvedBy, approvedAt) {
    if (status !== 'Approved' || !approvedBy) return '';
    const when = approvedAt ? new Date(approvedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `<div class="page-sub" style="margin-top:2px; font-size:11px;">Approved by ${escapeHtml(approvedBy)}${when ? ' on ' + when : ''}</div>`;
  }

  // Shared-table holiday (HR-curated, authoritative) takes priority; falls back to the
  // fixed-date PH holiday reference (js/store.js FIXED_PH_HOLIDAYS) when this date isn't
  // on the Holidays list yet.
  function holidayContext(date) {
    const sharedHoliday = Store.holidaysInRange(date, date)[0] || null;
    const fixedHoliday = detectFixedPhHoliday(date);
    return { sharedHoliday, fixedHoliday, effective: sharedHoliday || fixedHoliday };
  }

  function holidayHintHtml(date, ctx) {
    if (ctx.sharedHoliday) return `${escapeHtml(ctx.sharedHoliday.name)} is on the Holidays list for this date.`;
    if (ctx.fixedHoliday) {
      return `🎌 ${escapeHtml(ctx.fixedHoliday.name)} — a recognized Philippine ${ctx.fixedHoliday.type} holiday for this date, auto-detected. Not yet on your Holidays list.
        <button type="button" class="link-btn" data-add-holiday data-date="${date}" data-name="${escapeHtml(ctx.fixedHoliday.name)}" data-type="${ctx.fixedHoliday.type}">+ Add to Holidays list</button>`;
    }
    return '';
  }

  function openAttendanceModal(main, empId, recId) {
    const rec = recId ? Store.listAttendance().find(a => a.id === recId) : null;
    const r = rec || Object.assign({ employeeId: empId || '', date: selectedDate, status: 'Present' }, defaultShiftFor(empId));
    const holidayCtx = holidayContext(r.date);
    const holiday = holidayCtx.effective;

    openModal(`
      <h2>${rec ? 'Edit attendance' : 'Log attendance'}</h2>
      <form id="att-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select name="employeeId" id="att-employee">${employeeOptions(r.employeeId)}</select></div>
          <div class="field"><label>Date</label><input type="date" name="date" id="att-date" value="${r.date}" /></div>
          <div class="field"><label>Status</label>
            <select name="status">${['Present', 'Late', 'Absent', 'On Leave'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Time in</label><input type="time" name="timeIn" id="att-time-in" value="${r.timeIn}" /></div>
          <div class="field"><label>Time out</label><input type="time" name="timeOut" id="att-time-out" value="${r.timeOut}" /></div>
          <div class="field"><label>Hours</label><input type="number" step="0.1" name="hours" value="${r.hours}" /></div>
          <div class="field"><label>Night Shift Diff.</label>
            <label style="display:flex; align-items:center; gap:6px; font-weight:400; padding-top:8px;">
              <input type="checkbox" name="nsdApproved" ${r.nsdStatus === 'Approved' ? 'checked' : ''} style="width:auto;" /> Approved
              ${r.nsdStatus === 'Requested' ? '<span class="badge badge-yellow" style="margin-left:4px;">Pending request</span>' : ''}
            </label>
            ${approvalStampHtml(r.nsdStatus, r.nsdApprovedBy, r.nsdApprovedAt)}
          </div>
          <div class="field"><label>Overtime</label>
            <label style="display:flex; align-items:center; gap:6px; font-weight:400; padding-top:8px;">
              <input type="checkbox" name="otApproved" ${r.otStatus === 'Approved' ? 'checked' : ''} style="width:auto;" /> Approved
              ${r.otStatus === 'Requested' ? '<span class="badge badge-yellow" style="margin-left:4px;">Pending request</span>' : ''}
            </label>
            <div style="display:flex; align-items:center; gap:6px; margin-top:6px;">
              <label for="att-ot-hours" style="font-weight:400; margin:0; font-size:12px; color:var(--text-faint);">OT hours</label>
              <input type="number" step="0.1" min="0" name="otHours" id="att-ot-hours" style="width:80px;"
                value="${r.otHours != null ? r.otHours : Math.max(0, Number(r.hours) - 8).toFixed(2)}" />
            </div>
            ${approvalStampHtml(r.otStatus, r.otApprovedBy, r.otApprovedAt)}
          </div>
          <div class="field full"><label>Holiday</label>
            <select name="holidayType" id="att-holiday-type">
              <option value="">None</option>
              <option value="Regular" ${r.holidayType === 'Regular' || (!r.holidayType && holiday && holiday.type === 'Regular') ? 'selected' : ''}>Regular Holiday</option>
              <option value="Special" ${r.holidayType === 'Special' || (!r.holidayType && holiday && holiday.type === 'Special') ? 'selected' : ''}>Special (Non-working) Holiday</option>
            </select>
            <div id="holiday-hint" class="page-sub" style="margin-top:6px;">${holidayHintHtml(r.date, holidayCtx)}</div>
            ${r.holidayStatus === 'Requested' ? '<div class="badge badge-yellow" style="margin-top:6px;">Pending request</div>' : ''}
            ${approvalStampHtml(r.holidayStatus, r.holidayApprovedBy, r.holidayApprovedAt)}
          </div>
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
      qs('#att-date', bd).addEventListener('change', (ev) => {
        const ctx = holidayContext(ev.target.value);
        qs('#holiday-hint', bd).innerHTML = holidayHintHtml(ev.target.value, ctx);
        // Only fill in a suggestion if nothing was already picked — never override an
        // admin's own explicit choice just because the date changed.
        const selectEl = qs('#att-holiday-type', bd);
        if (!selectEl.value && ctx.effective) selectEl.value = ctx.effective.type;
      });
      qs('#holiday-hint', bd).addEventListener('click', async (ev) => {
        const btn = ev.target.closest('[data-add-holiday]');
        if (!btn) return;
        await Store.addHoliday({ date: btn.dataset.date, name: btn.dataset.name, type: btn.dataset.type });
        toast(`✔ Added ${btn.dataset.name} to the Holidays list.`);
        const ctx = holidayContext(btn.dataset.date);
        qs('#holiday-hint', bd).innerHTML = holidayHintHtml(btn.dataset.date, ctx);
      });
      qs('#att-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const holidayType = fd.get('holidayType') || null;
        const patch = {
          employeeId: fd.get('employeeId'),
          date: fd.get('date'),
          status: fd.get('status'),
          timeIn: fd.get('timeIn'),
          timeOut: fd.get('timeOut'),
          hours: Number(fd.get('hours')) || 0,
          // Checking a box always approves it; leaving it unchecked never clobbers a
          // pending employee request (still visible/actionable in the Requests tab) —
          // it only ever clears an already-Approved flag back to undecided.
          nsdStatus: fd.get('nsdApproved') === 'on' ? 'Approved' : (r.nsdStatus === 'Requested' ? r.nsdStatus : null),
          otStatus: fd.get('otApproved') === 'on' ? 'Approved' : (r.otStatus === 'Requested' ? r.otStatus : null),
          otHours: fd.get('otHours') !== '' ? Number(fd.get('otHours')) : null,
          holidayType,
          holidayStatus: holidayType ? 'Approved' : (r.holidayStatus === 'Requested' ? r.holidayStatus : null),
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
