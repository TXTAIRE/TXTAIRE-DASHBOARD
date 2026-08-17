window.Views.safetyIncidents = (function () {
  let filterStatus = 'Open';

  function statusBadge(status) {
    return `<span class="badge ${status === 'Open' ? 'badge-yellow' : 'badge-green'}">${escapeHtml(status)}</span>`;
  }

  function renderList(main) {
    const all = Store.listSafetyIncidents();
    let rows = filterStatus === 'All' ? all.slice() : all.filter(s => s.status === filterStatus);
    rows.sort((a, b) => b.incidentDate.localeCompare(a.incidentDate));

    main.innerHTML = `
      <div class="crumb">Records</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Safety Incidents</h1>
          <div class="page-sub">Occupational Safety and Health (RA 11058) incident log — workplace injuries, near-misses, and hazards.</div>
        </div>
        <button class="btn btn-primary" id="btn-log-incident">+ Log incident</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Open', 'All', 'Resolved'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Date</th><th>Employee</th><th>Location</th><th>Description</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr>
                <td class="dim">${fmtDate(s.incidentDate)}</td>
                <td class="name row-link" data-open="${s.id}">${s.employeeId ? escapeHtml(employeeName(s.employeeId)) : '—'}</td>
                <td class="dim">${escapeHtml(s.location || '—')}</td>
                <td class="dim" style="max-width:280px;">${escapeHtml(s.description.length > 60 ? s.description.slice(0, 60) + '…' : s.description)}</td>
                <td>${statusBadge(s.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No safety incidents match this filter.</div>'}
      </div>
    `;

    qs('#btn-log-incident', main).addEventListener('click', () => openForm(main));
    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
  }

  function openDetail(main, id) {
    const s = Store.getSafetyIncident(id);
    if (!s) return;

    openDrawer(`
      <h2>${s.employeeId ? escapeHtml(employeeName(s.employeeId)) : 'Safety Incident'}</h2>
      <div class="page-sub" style="margin-bottom:10px;">${fmtDate(s.incidentDate)} — ${escapeHtml(s.location || 'No location on file')}</div>
      <div style="margin-bottom:14px;">${statusBadge(s.status)}</div>
      <div class="section-title">Description</div>
      <div class="page-sub">${escapeHtml(s.description)}</div>
      ${s.injuryType ? `<div class="page-sub" style="margin-top:8px;">Injury type: ${escapeHtml(s.injuryType)}</div>` : ''}
      ${s.ppeInvolved ? `<div class="page-sub">PPE involved: ${escapeHtml(s.ppeInvolved)}</div>` : ''}
      <div class="page-sub" style="margin-top:8px;">Reported by: ${escapeHtml(s.reportedBy || '—')}</div>

      <div class="section-title">Corrective Action</div>
      <div class="field full"><textarea id="corrective-action" rows="3" placeholder="What was done to prevent this from happening again?">${escapeHtml(s.correctiveAction || '')}</textarea></div>

      <div class="modal-actions" style="justify-content:space-between; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-danger btn-sm" id="btn-delete-incident">Delete</button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="btn-save-action">Save Notes</button>
          ${s.status === 'Open' ? '<button class="btn btn-primary" id="btn-resolve">Mark Resolved</button>' : ''}
        </div>
      </div>
    `, (dr) => {
      qs('#btn-save-action', dr).addEventListener('click', async () => {
        await Store.updateSafetyIncident(s.id, { correctiveAction: qs('#corrective-action', dr).value.trim() });
        toast('✔ Notes saved.');
        closeDrawer();
        renderList(main);
      });
      const resolveBtn = qs('#btn-resolve', dr);
      if (resolveBtn) resolveBtn.addEventListener('click', async () => {
        await Store.resolveSafetyIncident(s.id, qs('#corrective-action', dr).value.trim());
        toast('✔ Marked resolved.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-delete-incident', dr).addEventListener('click', async () => {
        if (!confirm('Delete this safety incident report? This cannot be undone.')) return;
        await Store.deleteSafetyIncident(s.id);
        toast('✔ Deleted.');
        closeDrawer();
        renderList(main);
      });
    });
  }

  function openForm(main) {
    openModal(`
      <h2>Log Safety Incident</h2>
      <form id="incident-form">
        <div class="modal-grid">
          <div class="field"><label>Date</label><input type="date" name="incidentDate" value="${todayISO()}" required /></div>
          <div class="field"><label>Employee involved</label><select name="employeeId"><option value="">Not specific to one employee</option>${employeeOptions()}</select></div>
          <div class="field"><label>Location</label><input name="location" placeholder="e.g. Client site, warehouse" /></div>
          <div class="field"><label>Injury type</label><input name="injuryType" placeholder="e.g. Cut, burn, none" /></div>
          <div class="field full"><label>Description</label><textarea name="description" rows="3" required></textarea></div>
          <div class="field full"><label>PPE involved</label><input name="ppeInvolved" placeholder="e.g. Gloves, safety goggles" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Log incident</button>
        </div>
      </form>
    `, (bd) => {
      qs('#incident-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addSafetyIncident({
          incidentDate: fd.get('incidentDate'),
          employeeId: fd.get('employeeId') || null,
          location: fd.get('location').trim(),
          description: fd.get('description').trim(),
          injuryType: fd.get('injuryType').trim(),
          ppeInvolved: fd.get('ppeInvolved').trim(),
          reportedBy: currentUserEmail(),
        });
        toast('✔ Incident logged.');
        closeModal();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
