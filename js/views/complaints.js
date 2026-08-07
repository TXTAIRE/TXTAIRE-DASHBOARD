window.Views.complaints = (function () {
  // 'Open' is the underlying stored status value (existing data, existing detail-drawer
  // dropdown) -- only its displayed label changed, to "Waiting Queue" so the default view
  // reads as the queue of complaints HR hasn't gotten to yet, same idea as Leave Requests
  // opening on Pending.
  const STATUS_FILTER_LABELS = { Open: 'Waiting Queue', All: 'All', Resolved: 'Resolved', Closed: 'Closed' };
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
          <div class="page-sub">Log, assign, and track customer complaints through to resolution. Share the public link so customers can submit their own.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-copy-complaint-link">🔗 Copy public link</button>
          <button class="btn btn-primary" id="btn-log-complaint">+ Log complaint</button>
        </div>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Open', 'All', 'Resolved', 'Closed'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${STATUS_FILTER_LABELS[s]}</button>`).join('')}
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
                <td>
                  <div class="seg priority-seg" data-priority-for="${c.id}">
                    ${['High', 'Medium', 'Low'].map(p => `<button type="button" data-priority="${p}" class="${c.priority === p ? 'active' : ''}">${PRIORITY_LABELS[p]}</button>`).join('')}
                  </div>
                </td>
                <td>${complaintStatusBadge(c.status)}</td>
                <td class="dim">${fmtDate(c.dateReceived)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No complaints match this filter.</div>'}
      </div>
    `;

    qs('#btn-log-complaint', main).addEventListener('click', () => openComplaintForm(main));
    qs('#btn-copy-complaint-link', main).addEventListener('click', () => copyPublicComplaintLink());
    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openComplaintDetail(main, el.dataset.open)));
    qsa('[data-priority-for]', main).forEach(seg => {
      qsa('button', seg).forEach(btn => btn.addEventListener('click', async () => {
        await Store.updateComplaint(seg.dataset.priorityFor, { priority: btn.dataset.priority });
        toast('✔ Priority set to ' + PRIORITY_LABELS[btn.dataset.priority] + '.');
        renderList(main);
      }));
    });
  }

  // The shareable link customers use to submit a complaint themselves (complaint.html --
  // a small, unauthenticated page, separate from this admin dashboard). Resolved relative
  // to the current page so it still works whichever path/subpath this app is served from.
  async function copyPublicComplaintLink() {
    const url = new URL('complaint.html', location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      toast('✔ Link copied — share it with the customer.');
    } catch (err) {
      openModal(`
        <h2>Public complaint link</h2>
        <div class="page-sub" style="margin-bottom:10px;">Copy this link to share with a customer:</div>
        <input type="text" value="${escapeHtml(url)}" readonly onclick="this.select()" style="width:100%;" />
      `);
    }
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
      qs('#btn-save-complaint', dr).addEventListener('click', async () => {
        const status = qs('#status-select', dr).value;
        const patch = {
          assignedTo: qs('#assign-select', dr).value || null,
          status,
          resolutionNotes: qs('#notes-input', dr).value.trim(),
        };
        if (status === 'Resolved' && c.status !== 'Resolved') patch.resolvedDate = todayISO();
        await Store.updateComplaint(c.id, patch);
        toast('Complaint updated.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-del-complaint', dr).addEventListener('click', async () => {
        if (confirm('Delete this complaint?')) {
          await Store.deleteComplaint(c.id);
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
            <select name="priority">${['Low', 'Medium', 'High'].map(p => `<option value="${p}" ${p === 'Medium' ? 'selected' : ''}>${PRIORITY_LABELS[p]}</option>`).join('')}</select>
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
      qs('#complaint-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addComplaint({
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
