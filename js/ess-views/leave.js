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
          <div class="modal-actions" style="justify-content:flex-start; margin-top:10px; padding-top:0;">
            <button type="button" class="link-btn" data-edit-leave="${r.id}">✏️ Edit</button>
            <button type="button" class="link-btn" data-delete-leave="${r.id}" style="color:var(--red);">🗑 Delete</button>
          </div>
        </div>
      `).join('') : '<div class="ess-empty">No leave requests yet.</div>'}
    `;

    qs('#btn-new-leave', main).addEventListener('click', () => openLeaveForm(main, emp));
    qsa('[data-edit-leave]', main).forEach(b => b.addEventListener('click', () => {
      const r = rows.find(x => x.id === b.dataset.editLeave);
      if (r) openLeaveForm(main, emp, r);
    }));
    qsa('[data-delete-leave]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this leave request? This cannot be undone.')) return;
      await Store.deleteLeaveRequest(b.dataset.deleteLeave);
      toast('✔ Leave request deleted.');
      render(main, emp);
    }));
  }

  // Editing an already-Approved/Rejected request re-opens it for HR review (the
  // trigger-enforced RLS policy resets status back to Pending server-side) -- shown here
  // so the employee isn't surprised when a decided request reverts after they change it.
  function openLeaveForm(main, emp, existing) {
    const r = existing || { leaveType: 'Vacation', startDate: todayISO(), endDate: todayISO(), reason: '' };
    openEssModal(`
      <h2>${existing ? 'Edit Leave Request' : 'New Leave Request'}</h2>
      ${existing && existing.status !== 'Pending' ? `<div class="modal-sub">Editing this will send it back to HR for review.</div>` : ''}
      <form id="leave-form">
        <div class="modal-grid">
          <div class="field full"><label>Type</label>
            <select name="leaveType">${['Vacation', 'Sick', 'Emergency', 'Other'].map(t => `<option ${t === r.leaveType ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Start date</label><input type="date" name="startDate" value="${r.startDate}" required /></div>
          <div class="field"><label>End date</label><input type="date" name="endDate" value="${r.endDate}" required /></div>
          <div class="field full"><label>Reason</label><textarea name="reason" rows="3">${escapeHtml(r.reason || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Submit'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#leave-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        if (fd.get('endDate') < fd.get('startDate')) { toast('End date must be on or after start date.'); return; }
        const patch = {
          leaveType: fd.get('leaveType'),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          reason: fd.get('reason').trim(),
        };
        if (existing) {
          await Store.updateLeaveRequest(existing.id, patch);
          toast('✔ Leave request updated.');
        } else {
          await Store.addLeaveRequest(Object.assign({ employeeId: emp.id }, patch));
          toast('✔ Leave request submitted.');
        }
        closeEssModal();
        render(main, emp);
      });
    });
  }

  return { render };
})();
