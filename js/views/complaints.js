window.Views.complaints = (function () {
  let filterStatus = 'Open';

  function renderList(main) {
    const all = Store.listComplaints();
    let rows = all.slice();
    if (filterStatus === 'Open') rows = rows.filter(c => c.status === 'Open' || c.status === 'In Progress');
    else if (filterStatus !== 'All') rows = rows.filter(c => c.status === filterStatus);
    rows.sort((a, b) => b.dateReceived.localeCompare(a.dateReceived));

    main.innerHTML = `
      <div class="crumb">Records</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Customer Complaints</h1>
          <div class="page-sub">Log, assign, and track customer complaints through to resolution.</div>
        </div>
        <button class="btn btn-primary" id="btn-log-complaint">+ Log complaint</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Open', 'All', 'Resolved', 'Closed'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Customer</th><th>Description</th><th>Assigned</th><th>Priority</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td class="name row-link" data-open="${c.id}">${escapeHtml(c.customerName)}</td>
                <td class="dim" style="max-width:280px;">${escapeHtml(c.description.length > 60 ? c.description.slice(0, 60) + '…' : c.description)}</td>
                <td class="dim">${c.assignedTo ? escapeHtml(employeeName(c.assignedTo)) : '—'}</td>
                <td>${priorityBadge(c.priority)}</td>
                <td>${complaintStatusBadge(c.status)}</td>
                <td class="dim">${fmtDate(c.dateReceived)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No complaints match this filter.</div>'}
      </div>
    `;

    qs('#btn-log-complaint', main).addEventListener('click', () => openComplaintForm(main));
    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openComplaintDetail(main, el.dataset.open)));
  }

  function openComplaintDetail(main, id) {
    const c = Store.getComplaint(id);
    if (!c) return;

    openDrawer(`
      <h2>${escapeHtml(c.customerName)}</h2>
      <div class="page-sub" style="margin-bottom:10px;">${escapeHtml(c.contact || '—')}</div>
      <div style="margin-bottom:14px; display:flex; gap:8px;">${priorityBadge(c.priority)}${complaintStatusBadge(c.status)}</div>
      <div class="section-title">Description</div>
      <div class="page-sub">${escapeHtml(c.description)}</div>
      <div class="page-sub" style="margin-top:8px;">Received: ${fmtDate(c.dateReceived)}<br/>Assigned to: ${c.assignedTo ? escapeHtml(employeeName(c.assignedTo)) : 'Unassigned'}</div>
      ${c.resolutionNotes ? `<div class="section-title">Resolution Notes</div><div class="page-sub">${escapeHtml(c.resolutionNotes)}</div>` : ''}

      <div class="section-title">Update</div>
      <div class="modal-grid">
        <div class="field"><label>Assign to</label><select id="assign-select">${employeeOptions(c.assignedTo)}</select></div>
        <div class="field"><label>Status</label>
          <select id="status-select">${['Open', 'In Progress', 'Resolved', 'Closed'].map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field full"><label>Resolution notes</label><textarea id="notes-input" rows="2">${escapeHtml(c.resolutionNotes || '')}</textarea></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn btn-primary btn-sm" id="btn-save-complaint">Save update</button>
        <button class="btn btn-ghost btn-sm" id="btn-del-complaint">Delete</button>
      </div>
    `, (dr) => {
      qs('#btn-save-complaint', dr).addEventListener('click', () => {
        const status = qs('#status-select', dr).value;
        const patch = {
          assignedTo: qs('#assign-select', dr).value || null,
          status,
          resolutionNotes: qs('#notes-input', dr).value.trim(),
        };
        if (status === 'Resolved' && c.status !== 'Resolved') patch.resolvedDate = todayISO();
        Store.updateComplaint(c.id, patch);
        toast('Complaint updated.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-del-complaint', dr).addEventListener('click', () => {
        if (confirm('Delete this complaint?')) {
          Store.deleteComplaint(c.id);
          closeDrawer();
          toast('Complaint deleted.');
          renderList(main);
        }
      });
    });
  }

  function openComplaintForm(main) {
    openModal(`
      <h2>Log complaint</h2>
      <form id="complaint-form">
        <div class="modal-grid">
          <div class="field full"><label>Customer name</label><input name="customerName" required /></div>
          <div class="field"><label>Contact</label><input name="contact" placeholder="Phone or email" /></div>
          <div class="field"><label>Date received</label><input type="date" name="dateReceived" value="${todayISO()}" /></div>
          <div class="field"><label>Priority</label>
            <select name="priority">${['Low', 'Medium', 'High'].map(p => `<option ${p === 'Medium' ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Assign to</label><select name="assignedTo"><option value="">Unassigned</option>${employeeOptions()}</select></div>
          <div class="field full"><label>Description</label><textarea name="description" rows="3" required></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Log complaint</button>
        </div>
      </form>
    `, (bd) => {
      qs('#complaint-form', bd).addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        Store.addComplaint({
          customerName: fd.get('customerName').trim(),
          contact: fd.get('contact').trim(),
          dateReceived: fd.get('dateReceived'),
          priority: fd.get('priority'),
          assignedTo: fd.get('assignedTo') || null,
          description: fd.get('description').trim(),
          status: 'Open',
          resolutionNotes: '',
          resolvedDate: null,
        });
        toast('Complaint logged.');
        closeModal();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
