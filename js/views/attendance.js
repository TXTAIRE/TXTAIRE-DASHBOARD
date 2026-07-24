window.Views.attendance = (function () {
  let selectedDate = todayISO();
  let filterCategory = 'All';

  function statusDotClass(status) {
    return { Present: 'on', Late: 'late', Absent: 'absent', 'On Leave': 'off' }[status] || '';
  }

  function attendanceTable(employees, recByEmp) {
    if (!employees.length) return '<div class="empty">No staff in this group.</div>';
    return `
      <table>
        <thead><tr><th>Name</th><th>Position</th><th>Status</th><th>Time In</th><th>Time Out</th><th class="num">Hours</th><th></th></tr></thead>
        <tbody>
          ${employees.map(e => {
            const r = recByEmp[e.id];
            return `
            <tr>
              <td class="name">${escapeHtml(e.name)}</td>
              <td class="dim">${escapeHtml(e.position || '—')}</td>
              <td>${r ? `<span class="status-dot ${statusDotClass(r.status)}">${r.status}</span>` : '<span class="status-dot">Not logged</span>'}</td>
              <td class="dim">${r ? to12Hour(r.timeIn) : '—'}</td>
              <td class="dim">${r ? to12Hour(r.timeOut) : '—'}</td>
              <td class="num">${r ? r.hours : '—'}</td>
              <td><button class="link-btn" data-emp="${e.id}" data-rec="${r ? r.id : ''}">${r ? 'Edit →' : 'Log →'}</button></td>
            </tr>
          `; }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderView(main) {
    const employees = Store.listEmployees().filter(e => e.status !== 'Terminated');
    const admins = employees.filter(e => e.category === 'Admin');
    const technicians = employees.filter(e => e.category === 'Technician');
    const records = Store.attendanceForDate(selectedDate);
    const recByEmp = {};
    records.forEach(r => { recByEmp[r.employeeId] = r; });

    const present = records.filter(r => r.status === 'Present' || r.status === 'Late').length;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Attendance</h1>
          <div class="page-sub">Daily attendance and leave monitoring, separated by Admins and Technicians.</div>
        </div>
        <button class="btn btn-primary" id="btn-log-attendance">+ Log attendance</button>
      </div>

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

    qsa('#seg-category button', main).forEach(b => b.addEventListener('click', () => { filterCategory = b.dataset.val; renderView(main); }));
    qs('#date-picker', main).addEventListener('change', (e) => { selectedDate = e.target.value; renderView(main); });
    qs('#btn-prev-day', main).addEventListener('click', () => { selectedDate = addDays(selectedDate, -1); renderView(main); });
    qs('#btn-today', main).addEventListener('click', () => { selectedDate = todayISO(); renderView(main); });
    qs('#btn-next-day', main).addEventListener('click', () => { selectedDate = addDays(selectedDate, 1); renderView(main); });
    qs('#btn-log-attendance', main).addEventListener('click', () => openAttendanceModal(main, null, null));
    qsa('[data-emp]', main).forEach(b => b.addEventListener('click', () => openAttendanceModal(main, b.dataset.emp, b.dataset.rec || null)));
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

  return { render: renderView };
})();
