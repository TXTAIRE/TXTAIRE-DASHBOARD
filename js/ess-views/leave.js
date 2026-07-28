window.EssViews.leave = (function () {
  function statusBadge(status) {
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function render(main, emp) {
    const rows = Store.leaveRequestsForEmployee(emp.id).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">My Leave Requests</div>
      <button class="btn btn-primary btn-sm" id="btn-new-leave" style="width:100%; justify-content:center; margin-bottom:14px;">+ New Leave Request</button>
      ${rows.length ? rows.map(r => `
        <div class="ess-card">
          <div class="ess-row"><span class="label">${escapeHtml(r.leaveType)}</span>${statusBadge(r.status)}</div>
          <div class="ess-row"><span class="label">Dates</span><span class="value">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}</span></div>
          ${r.reason ? `<div class="ess-sub" style="margin-top:6px;">${escapeHtml(r.reason)}</div>` : ''}
          ${r.reviewNotes ? `<div class="ess-sub" style="margin-top:6px;">HR: ${escapeHtml(r.reviewNotes)}</div>` : ''}
        </div>
      `).join('') : '<div class="ess-empty">No leave requests yet.</div>'}
    `;

    qs('#btn-new-leave', main).addEventListener('click', () => openLeaveForm(main, emp));
  }

  function openLeaveForm(main, emp) {
    openEssModal(`
      <h2>New Leave Request</h2>
      <form id="leave-form">
        <div class="modal-grid">
          <div class="field full"><label>Type</label>
            <select name="leaveType">${['Vacation', 'Sick', 'Emergency', 'Other'].map(t => `<option>${t}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Start date</label><input type="date" name="startDate" value="${todayISO()}" required /></div>
          <div class="field"><label>End date</label><input type="date" name="endDate" value="${todayISO()}" required /></div>
          <div class="field full"><label>Reason</label><textarea name="reason" rows="3"></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (bd) => {
      qs('#leave-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        if (fd.get('endDate') < fd.get('startDate')) { toast('End date must be on or after start date.'); return; }
        await Store.addLeaveRequest({
          employeeId: emp.id,
          leaveType: fd.get('leaveType'),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          reason: fd.get('reason').trim(),
        });
        toast('✔ Leave request submitted.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  return { render };
})();
