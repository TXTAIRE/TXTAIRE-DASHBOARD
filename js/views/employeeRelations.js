window.Views.employeeRelations = (function () {
  // Confidential by design (Safe Spaces Act, RA 11313) -- RLS on "employeeRelationsCases"
  // only lets accounts listed in "adminCodiMembers" read case rows at all, so a non-member
  // admin who lands here sees zero cases regardless of what this view renders. Membership
  // management itself stays open to every admin (matches the "adminCodiMembers" RLS,
  // which is is_admin()-gated, not membership-gated) -- otherwise there'd be no way for
  // the first member to ever be granted access.
  let filterStatus = 'Open';

  function statusBadge(status) {
    const map = { Filed: 'badge-yellow', 'Under Review': 'badge-blue', Resolved: 'badge-green' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function renderMembersCard(main) {
    const members = Store.listAdminCodiMembers();
    return `
      <div class="section-title">Committee Members</div>
      <div class="panel" style="padding:10px 14px; margin-bottom:18px;">
        <div class="page-sub" style="margin-bottom:8px;">Only these email addresses can view case details below, regardless of admin status.</div>
        ${members.length ? members.map(m => `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 0;">
            <span>${escapeHtml(m.email)}</span>
            <button class="link-btn" data-remove-member="${m.id}" style="color:var(--red);">Remove</button>
          </div>
        `).join('') : '<div class="page-sub">No committee members yet.</div>'}
        <form id="add-member-form" style="display:flex; gap:8px; margin-top:10px;">
          <input type="email" name="email" placeholder="admin@email.com" required style="flex:1;" />
          <button type="submit" class="btn btn-ghost btn-sm">+ Add</button>
        </form>
      </div>
    `;
  }

  function render(main) {
    const isMember = Store.currentAdminIsCodiMember(currentUserEmail());
    const membersHtml = renderMembersCard(main);

    if (!isMember) {
      main.innerHTML = `
        <div class="crumb">Records</div>
        <div class="page-head">
          <div>
            <h1 class="page-title">Employee Relations</h1>
            <div class="page-sub">Safe Spaces Act (RA 11313) case handling — confidential, Committee on Decorum and Investigation (CODI) members only.</div>
          </div>
        </div>
        <div class="panel" style="padding:14px; margin-bottom:14px;">
          <div class="page-sub">You're not currently a designated committee member, so case details aren't visible to you. Add your own email below to grant yourself access, or manage who else is a member.</div>
        </div>
        ${membersHtml}
      `;
      wireMembersForm(main);
      return;
    }

    const all = Store.listEmployeeRelationsCases();
    // 'Open' is a synthetic filter (not a real stored status) meaning "not yet Resolved" --
    // matches the same convention Complaints uses for its default queue view.
    let rows = all.slice();
    if (filterStatus === 'Open') rows = rows.filter(c => c.status !== 'Resolved');
    else if (filterStatus !== 'All') rows = rows.filter(c => c.status === filterStatus);
    rows.sort((a, b) => b.dateFiled.localeCompare(a.dateFiled));

    main.innerHTML = `
      <div class="crumb">Records</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Employee Relations</h1>
          <div class="page-sub">Safe Spaces Act (RA 11313) case handling — confidential, visible only to committee members.</div>
        </div>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${[['Open', 'Not Resolved'], ['Filed', 'Filed'], ['Under Review', 'Under Review'], ['Resolved', 'Resolved'], ['All', 'All']].map(([val, label]) => `<button data-val="${val}" class="${filterStatus === val ? 'active' : ''}">${label}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Date Filed</th><th>Category</th><th>Description</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td class="dim">${fmtDate(c.dateFiled)}</td>
                <td class="dim">${escapeHtml(c.category || '—')}</td>
                <td class="name row-link" data-open="${c.id}" style="max-width:320px;">${escapeHtml(c.description.length > 70 ? c.description.slice(0, 70) + '…' : c.description)}</td>
                <td>${statusBadge(c.status)}</td>
                <td><button class="link-btn" data-open="${c.id}">Open →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No cases match this filter.</div>'}
      </div>

      <div style="margin-top:24px;">${membersHtml}</div>
    `;

    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; render(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
    wireMembersForm(main);
  }

  function wireMembersForm(main) {
    qsa('[data-remove-member]', main).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Remove this committee member?')) return;
      await Store.removeAdminCodiMember(btn.dataset.removeMember);
      toast('✔ Removed.');
      render(main);
    }));
    const form = qs('#add-member-form', main);
    if (form) form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = new FormData(ev.target).get('email').trim();
      await Store.addAdminCodiMember(email, currentUserEmail());
      toast('✔ Committee member added.');
      render(main);
    });
  }

  function openDetail(main, id) {
    const c = Store.getEmployeeRelationsCase(id);
    if (!c) return;
    const complainant = c.complainantEmployeeId ? Store.getEmployee(c.complainantEmployeeId) : null;
    const respondent = c.respondentEmployeeId ? Store.getEmployee(c.respondentEmployeeId) : null;

    openDrawer(`
      <h2>Case filed ${fmtDate(c.dateFiled)}</h2>
      <div style="margin-bottom:14px;">${statusBadge(c.status)}</div>
      <div class="page-sub">Complainant: ${complainant ? escapeHtml(complainant.name) : 'On file, name withheld in this view'}</div>
      <div class="page-sub">Respondent: ${respondent ? escapeHtml(respondent.name) : (c.respondentEmployeeId ? 'On file' : 'Not specified')}</div>
      <div class="section-title">Description</div>
      <div class="page-sub">${escapeHtml(c.description)}</div>

      <div class="section-title">Committee Notes</div>
      <div class="field full"><textarea id="committee-notes" rows="4" placeholder="Confidential notes -- visible only to committee members.">${escapeHtml(c.committeeNotes || '')}</textarea></div>

      <div class="modal-grid">
        <div class="field"><label>Status</label>
          <select id="status-select">${['Filed', 'Under Review', 'Resolved'].map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      ${c.status === 'Resolved' || c.resolutionSummary ? `<div class="field full"><label>Resolution summary</label><textarea id="resolution-summary" rows="3">${escapeHtml(c.resolutionSummary || '')}</textarea></div>` : ''}

      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" id="btn-save-case">Save</button>
      </div>
    `, (dr) => {
      qs('#btn-save-case', dr).addEventListener('click', async () => {
        const status = qs('#status-select', dr).value;
        const patch = { committeeNotes: qs('#committee-notes', dr).value.trim(), status };
        const resInput = qs('#resolution-summary', dr);
        if (resInput) patch.resolutionSummary = resInput.value.trim();
        if (status === 'Resolved' && c.status !== 'Resolved') patch.resolvedDate = todayISO();
        await Store.updateEmployeeRelationsCase(c.id, patch);
        toast('✔ Case updated.');
        closeDrawer();
        render(main);
      });
    });
  }

  return { render };
})();
