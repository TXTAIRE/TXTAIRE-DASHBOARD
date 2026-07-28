window.Views.leaveRequests = (function () {
  let filterStatus = 'Pending';

  function statusBadge(status) {
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function renderList(main) {
    const all = Store.listLeaveRequests();
    let rows = all.slice();
    if (filterStatus !== 'All') rows = rows.filter(r => r.status === filterStatus);
    rows.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Leave Requests</h1>
          <div class="page-sub">Submitted from the Employee Self-Service portal. Review and approve or reject each request.</div>
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
          <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Reason</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name row-link" data-open="${r.id}">${escapeHtml(employeeName(r.employeeId))}</td>
                <td class="dim">${escapeHtml(r.leaveType)}</td>
                <td class="dim">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}</td>
                <td class="dim" style="max-width:220px;">${escapeHtml(r.reason || '—')}</td>
                <td>${statusBadge(r.status)}</td>
                <td><button class="link-btn" data-open="${r.id}">Review →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No leave requests match this filter.</div>'}
      </div>
    `;

    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
  }

  function openDetail(main, id) {
    const r = Store.getLeaveRequest(id);
    if (!r) return;
    const emp = Store.getEmployee(r.employeeId);

    openDrawer(`
      <h2>${escapeHtml(emp ? emp.name : 'Unknown employee')}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${emp ? escapeHtml(emp.position) : ''}</div>
      <div style="margin-bottom:10px;">${statusBadge(r.status)}</div>
      <div class="page-sub">
        Type: ${escapeHtml(r.leaveType)}<br/>
        Dates: ${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}<br/>
        Submitted: ${fmtDate((r.created_at || '').slice(0, 10))}
      </div>
      <div class="section-title">Reason</div>
      <div class="page-sub">${escapeHtml(r.reason || '—')}</div>
      ${r.reviewedBy ? `
      <div class="section-title">Review</div>
      <div class="page-sub">By ${escapeHtml(r.reviewedBy)} on ${fmtDate(r.reviewedDate)}${r.reviewNotes ? '<br/>' + escapeHtml(r.reviewNotes) : ''}</div>
      ` : ''}
      ${r.status === 'Pending' ? `
      <div class="section-title">Decision</div>
      <div class="field full"><label>Notes (optional)</label><textarea id="review-notes" rows="2"></textarea></div>
      <div class="modal-actions" style="justify-content:flex-start; margin-top:10px;">
        <button class="btn btn-ghost" id="btn-reject" style="color:var(--red);border-color:var(--red);">Reject</button>
        <button class="btn btn-primary" id="btn-approve">Approve</button>
      </div>
      ` : ''}
    `, (dr) => {
      const approveBtn = qs('#btn-approve', dr);
      if (approveBtn) approveBtn.addEventListener('click', async () => {
        await Store.reviewLeaveRequest(r.id, 'Approved', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('Leave request approved.');
        closeDrawer();
        renderList(main);
      });
      const rejectBtn = qs('#btn-reject', dr);
      if (rejectBtn) rejectBtn.addEventListener('click', async () => {
        await Store.reviewLeaveRequest(r.id, 'Rejected', currentUserEmail(), qs('#review-notes', dr).value.trim());
        toast('Leave request rejected.');
        closeDrawer();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
