window.Views.attendance = (function () {
  let selectedDate = todayISO();

  function statusDotClass(status) {
    return { Present: 'on', Late: 'late', Absent: 'absent', 'On Leave': 'off' }[status] || '';
  }

  function renderView(main) {
    const employees = Store.listEmployees().filter(e => e.status !== 'Terminated');
    const records = Store.attendanceForDate(selectedDate);
    const recByEmp = {};
    records.forEach(r => { recByEmp[r.employeeId] = r; });

    const present = records.filter(r => r.status === 'Present' || r.status === 'Late').length;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Attendance</h1>
          <div class="page-sub">Daily attendance and leave monitoring across all staff.</div>
        </div>
        <button class="btn btn-primary" id="btn-log-attendance">+ Log attendance</button>
      </div>

      <div class="filters">
        <div class="field"><label>Date</label><input type="date" id="date-picker" value="${selectedDate}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-prev-day">← Prev</button>
        <button class="btn btn-ghost btn-sm" id="btn-today">Today</button>
        <button class="btn btn-ghost btn-sm" id="btn-next-day">Next →</button>
      </div>

      <div class="page-sub" style="margin-bottom:10px;">${employees.length} staff members · ${present} on shift on ${fmtDate(selectedDate)}</div>

      <div class="panel">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Status</th><th>Time In</th><th>Time Out</th><th class="num">Hours</th><th></th></tr></thead>
          <tbody>
            ${employees.map(e => {
              const r = recByEmp[e.id];
              return `
              <tr>
                <td class="name">${escapeHtml(e.name)}</td>
                <td class="dim">${e.category}</td>
                <td>${r ? `<span class="status-dot ${statusDotClass(r.status)}">${r.status}</span>` : '<span class="status-dot">Not logged</span>'}</td>
                <td class="dim">${r ? to12Hour(r.timeIn) : '—'}</td>
                <td class="dim">${r ? to12Hour(r.timeOut) : '—'}</td>
                <td class="num">${r ? r.hours : '—'}</td>
                <td><button class="link-btn" data-emp="${e.id}" data-rec="${r ? r.id : ''}">${r ? 'Edit →' : 'Log →'}</button></td>
              </tr>
            `; }).join('')}
          </tbody>
        </table>
      </div>
    `;

    qs('#date-picker', main).addEventListener('change', (e) => { selectedDate = e.target.value; renderView(main); });
    qs('#btn-prev-day', main).addEventListener('click', () => { selectedDate = addDays(selectedDate, -1); renderView(main); });
    qs('#btn-today', main).addEventListener('click', () => { selectedDate = todayISO(); renderView(main); });
    qs('#btn-next-day', main).addEventListener('click', () => { selectedDate = addDays(selectedDate, 1); renderView(main); });
    qs('#btn-log-attendance', main).addEventListener('click', () => openAttendanceModal(main, null, null));
    qsa('[data-emp]', main).forEach(b => b.addEventListener('click', () => openAttendanceModal(main, b.dataset.emp, b.dataset.rec || null)));
  }

  function openAttendanceModal(main, empId, recId) {
    const rec = recId ? Store.listAttendance().find(a => a.id === recId) : null;
    const r = rec || { employeeId: empId || '', date: selectedDate, status: 'Present', timeIn: '08:00', timeOut: '17:00', hours: 8 };

    openModal(`
      <h2>${rec ? 'Edit attendance' : 'Log attendance'}</h2>
      <form id="att-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select name="employeeId">${employeeOptions(r.employeeId)}</select></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${r.date}" /></div>
          <div class="field"><label>Status</label>
            <select name="status">${['Present', 'Late', 'Absent', 'On Leave'].map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Time in</label><input type="time" name="timeIn" value="${r.timeIn}" /></div>
          <div class="field"><label>Time out</label><input type="time" name="timeOut" value="${r.timeOut}" /></div>
          <div class="field"><label>Hours</label><input type="number" step="0.1" name="hours" value="${r.hours}" /></div>
        </div>
        <div class="modal-actions">
          ${rec ? '<button type="button" class="btn btn-danger" id="btn-del-att">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${rec ? 'Save changes' : 'Log attendance'}</button>
        </div>
      </form>
    `, (bd) => {
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
