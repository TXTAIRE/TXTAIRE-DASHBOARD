window.Views.scheduleRequests = (function () {
  let filterStatus = 'Pending';

  function statusBadge(status) {
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function renderList(main) {
    const all = Store.listScheduleChangeRequests();
    let rows = all.slice();
    if (filterStatus !== 'All') rows = rows.filter(r => r.status === filterStatus);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Schedule Requests</h1>
          <div class="page-sub">Default Time In/Out change requests submitted from My Portal. Approving here applies the new schedule immediately.</div>
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
          <thead><tr><th>Employee</th><th>Current</th><th>Requested</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => {
              const emp = Store.getEmployee(r.employeeId);
              const current = emp && emp.defaultTimeIn && emp.defaultTimeOut ? `${to12Hour(emp.defaultTimeIn)} – ${to12Hour(emp.defaultTimeOut)}` : 'Not set';
              return `
              <tr>
                <td class="name row-link" data-open="${r.id}">${escapeHtml(emp ? emp.name : 'Unknown employee')}</td>
                <td class="dim">${current}</td>
                <td>${to12Hour(r.requestedTimeIn)} – ${to12Hour(r.requestedTimeOut)}</td>
                <td class="dim" style="max-width:220px;">${escapeHtml(r.reason || '—')}</td>
                <td>${statusBadge(r.status)}</td>
                <td><button class="link-btn" data-open="${r.id}">Review →</button></td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>` : '<div class="empty">No schedule requests match this filter.</div>'}
      </div>
    `;

    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
  }

  function openDetail(main, id) {
    const r = Store.getScheduleChangeRequest(id);
    if (!r) return;
    const emp = Store.getEmployee(r.employeeId);
    const current = emp && emp.defaultTimeIn && emp.defaultTimeOut ? `${to12Hour(emp.defaultTimeIn)} – ${to12Hour(emp.defaultTimeOut)}` : 'Not set';

    openDrawer(`
      <h2>${escapeHtml(emp ? emp.name : 'Unknown employee')}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${emp ? escapeHtml(emp.position) : ''}</div>
      <div style="margin-bottom:10px;">${statusBadge(r.status)}</div>
      <div class="page-sub">
        Current schedule: ${current}<br/>
        Requested schedule: <strong>${to12Hour(r.requestedTimeIn)} – ${to12Hour(r.requestedTimeOut)}</strong><br/>
        Submitted: ${fmtDate((r.created_at || '').slice(0, 10))}
      </div>
      ${r.reason ? `<div class="section-title">Employee's reason</div><div class="page-sub">${escapeHtml(r.reason)}</div>` : ''}
      ${r.reviewedBy ? `
      <div class="section-title">Decision</div>
      <div class="page-sub">By ${escapeHtml(r.reviewedBy)} on ${fmtDate(r.reviewedDate)}</div>
      ` : ''}
      <div class="section-title">Notes</div>
      <div class="page-sub" style="margin-bottom:6px;">Visible to this employee alongside the decision — add or update anytime, whether or not the request has been decided yet.</div>
      <div class="field full"><textarea id="review-notes" rows="3">${escapeHtml(r.reviewNotes || '')}</textarea></div>
      <div class="modal-actions" style="justify-content:space-between; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-danger btn-sm" id="btn-delete-request">Delete</button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="btn-save-notes">Save Notes</button>
          ${r.status === 'Pending' ? `
          <button class="btn btn-ghost" id="btn-reject" style="color:var(--red);border-color:var(--red);">Reject</button>
          <button class="btn btn-primary" id="btn-approve">Approve — apply schedule</button>
          ` : ''}
        </div>
      </div>
    `, (dr) => {
      const saveNotesBtn = qs('#btn-save-notes', dr);
      saveNotesBtn.addEventListener('click', async () => {
        await Store.updateScheduleChangeRequestNotes(r.id, qs('#review-notes', dr).value.trim());
        toast('✔ Notes saved.');
        closeDrawer();
        renderList(main);
      });
      const approveBtn = qs('#btn-approve', dr);
      if (approveBtn) approveBtn.addEventListener('click', async () => {
        await Store.reviewScheduleChangeRequest(r.id, 'Approved', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('✔ Approved — schedule updated.');
        closeDrawer();
        renderList(main);
      });
      const rejectBtn = qs('#btn-reject', dr);
      if (rejectBtn) rejectBtn.addEventListener('click', async () => {
        await Store.reviewScheduleChangeRequest(r.id, 'Rejected', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('Request rejected.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-delete-request', dr).addEventListener('click', async () => {
        if (!confirm(`Delete this schedule request from ${emp ? emp.name : 'this employee'}? This cannot be undone.`)) return;
        await Store.deleteScheduleChangeRequest(r.id);
        toast('✔ Schedule request deleted.');
        closeDrawer();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
