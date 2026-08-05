window.Views.attendanceCorrections = (function () {
  let filterStatus = 'Pending';

  function statusBadge(status) {
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function renderList(main) {
    const all = Store.listAttendanceCorrections();
    let rows = all.slice();
    if (filterStatus !== 'All') rows = rows.filter(c => c.status === filterStatus);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Attendance Corrections</h1>
          <div class="page-sub">"Report Attendance Concern" submissions from the Employee Self-Service portal. Approving here does not change the attendance record itself — use the link to edit it directly on the Attendance page.</div>
        </div>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Pending', 'All', 'Approved', 'Rejected'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>Concern</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td class="name row-link" data-open="${c.id}">${escapeHtml(employeeName(c.employeeId))}</td>
                <td class="dim">${fmtDate(c.date)}</td>
                <td class="dim" style="max-width:280px;">${escapeHtml(c.description)}</td>
                <td>${statusBadge(c.status)}</td>
                <td><button class="link-btn" data-open="${c.id}">Review →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No attendance concerns match this filter.</div>'}
      </div>
    `;

    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
  }

  function openDetail(main, id) {
    const c = Store.getAttendanceCorrection(id);
    if (!c) return;
    const emp = Store.getEmployee(c.employeeId);
    const existingRec = Store.listAttendance().find(a => a.employeeId === c.employeeId && a.date === c.date);

    openDrawer(`
      <h2>${escapeHtml(emp ? emp.name : 'Unknown employee')}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${emp ? escapeHtml(emp.position) : ''}</div>
      <div style="margin-bottom:10px;">${statusBadge(c.status)}</div>
      <div class="page-sub">
        Date concerned: ${fmtDate(c.date)}<br/>
        ${c.requestedTimeIn || c.requestedTimeOut ? `Requested: ${c.requestedTimeIn ? to12Hour(c.requestedTimeIn) : '—'} – ${c.requestedTimeOut ? to12Hour(c.requestedTimeOut) : '—'}<br/>` : ''}
        Current record: ${existingRec ? `${to12Hour(existingRec.timeIn)} – ${to12Hour(existingRec.timeOut)} (${existingRec.status})` : 'Not logged'}<br/>
        Submitted: ${fmtDate((c.created_at || '').slice(0, 10))}
      </div>
      <div class="section-title">Employee's description</div>
      <div class="page-sub">${escapeHtml(c.description)}</div>
      ${c.reviewedBy ? `
      <div class="section-title">Decision</div>
      <div class="page-sub">By ${escapeHtml(c.reviewedBy)} on ${fmtDate(c.reviewedDate)}</div>
      ` : ''}
      <div class="modal-actions" style="justify-content:flex-start; margin-top:14px;">
        <button class="btn btn-ghost btn-sm" id="btn-edit-attendance">Edit attendance record →</button>
      </div>
      <div class="section-title">Notes</div>
      <div class="page-sub" style="margin-bottom:6px;">Visible to this employee alongside the decision — add or update anytime, whether or not the concern has been decided yet.</div>
      <div class="field full"><textarea id="review-notes" rows="3">${escapeHtml(c.reviewNotes || '')}</textarea></div>
      <div class="modal-actions" style="justify-content:space-between; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-danger btn-sm" id="btn-delete-correction">Delete</button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="btn-save-notes">Save Notes</button>
          ${c.status === 'Pending' ? `
          <button class="btn btn-ghost" id="btn-reject" style="color:var(--red);border-color:var(--red);">Reject</button>
          <button class="btn btn-primary" id="btn-approve">Approve</button>
          ` : ''}
        </div>
      </div>
    `, (dr) => {
      qs('#btn-edit-attendance', dr).addEventListener('click', () => {
        closeDrawer();
        location.hash = '#attendance';
        // openAttendanceModal (js/views/attendance.js) needs the attendance view mounted first.
        setTimeout(() => {
          if (window.Views.attendance && window.Views.attendance.openFor) {
            window.Views.attendance.openFor(c.employeeId, c.date);
          }
        }, 50);
      });
      const saveNotesBtn = qs('#btn-save-notes', dr);
      saveNotesBtn.addEventListener('click', async () => {
        await Store.updateAttendanceCorrectionNotes(c.id, qs('#review-notes', dr).value.trim());
        toast('✔ Notes saved.');
        closeDrawer();
        renderList(main);
      });
      const approveBtn = qs('#btn-approve', dr);
      if (approveBtn) approveBtn.addEventListener('click', async () => {
        await Store.reviewAttendanceCorrection(c.id, 'Approved', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('Correction approved — remember to edit the attendance record.');
        closeDrawer();
        renderList(main);
      });
      const rejectBtn = qs('#btn-reject', dr);
      if (rejectBtn) rejectBtn.addEventListener('click', async () => {
        await Store.reviewAttendanceCorrection(c.id, 'Rejected', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('Correction rejected.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-delete-correction', dr).addEventListener('click', async () => {
        if (!confirm(`Delete this attendance concern from ${emp ? emp.name : 'this employee'}? This cannot be undone.`)) return;
        await Store.deleteAttendanceCorrection(c.id);
        toast('✔ Attendance concern deleted.');
        closeDrawer();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
