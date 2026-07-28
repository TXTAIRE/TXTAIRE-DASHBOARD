window.Views.staff = (function () {
  let filterCategory = 'All';
  let filterStatus = 'All';
  let filterEmployment = 'All';

  function renderList(main) {
    const all = Store.listEmployees();
    let rows = all.slice();
    if (filterCategory !== 'All') rows = rows.filter(e => e.category === filterCategory);
    if (filterStatus !== 'All') rows = rows.filter(e => e.status === filterStatus);
    if (filterEmployment !== 'All') rows = rows.filter(e => e.employmentStatus === filterEmployment);
    rows.sort((a, b) => a.name.localeCompare(b.name));

    const activeCount = all.filter(e => e.status === 'Active').length;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Employees</h1>
          <div class="page-sub">Centralized employee records for Admin and Technician staff.</div>
        </div>
        <button class="btn btn-primary" id="btn-add-employee">+ Add employee</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Category</label>
          <div class="seg" id="seg-category">
            ${['All'].concat(CATEGORIES).map(c => `<button data-val="${c}" class="${filterCategory === c ? 'active' : ''}">${c}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['All', 'Active', 'On Leave', 'Off', 'Terminated'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
        <div class="field">
          <label>Employment</label>
          <div class="seg" id="seg-employment">
            ${['All', 'Regular', 'Probationary', 'Contractual'].map(s => `<button data-val="${s}" class="${filterEmployment === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="page-sub" style="margin-bottom:10px;">${all.length} employees · ${activeCount} active</div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead>
            <tr>
              <th>Name</th><th>Category</th><th>Position</th><th>Status</th><th>Employment</th>
              <th>Rate</th><th>COLA</th><th>Payday</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(e => `
              <tr data-id="${e.id}">
                <td class="name row-link" data-open="${e.id}">${escapeHtml(e.name)}</td>
                <td><span class="badge badge-gray">${e.category}</span></td>
                <td class="dim">${escapeHtml(e.position)}</td>
                <td>${employeeStatusDot(e.status)}</td>
                <td>${employmentStatusBadge(e.employmentStatus)}</td>
                <td class="dim">${e.payType === 'Daily' ? fmtMoney(e.rate) + '/day' : fmtMoney(e.rate) + '/cutoff'}</td>
                <td class="dim">${(e.allowancePerDay || e.fixedAllowance) ? [e.allowancePerDay ? fmtMoney(e.allowancePerDay) + '/day' : null, e.fixedAllowance ? fmtMoney(e.fixedAllowance) + '/cutoff' : null].filter(Boolean).join(' + ') : '—'}</td>
                <td class="dim">${PAY_CYCLES[e.payCycle] ? PAY_CYCLES[e.payCycle].cutoffLabels.join(' & ') : '—'}</td>
                <td><button class="link-btn" data-edit="${e.id}">Edit →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No employees match these filters.</div>'}
      </div>
    `;

    qs('#btn-add-employee', main).addEventListener('click', () => openEmployeeModal(main, null));
    qsa('#seg-category button', main).forEach(b => b.addEventListener('click', () => { filterCategory = b.dataset.val; renderList(main); }));
    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('#seg-employment button', main).forEach(b => b.addEventListener('click', () => { filterEmployment = b.dataset.val; renderList(main); }));
    qsa('[data-edit]', main).forEach(b => b.addEventListener('click', () => openEmployeeModal(main, b.dataset.edit)));
    qsa('[data-open]', main).forEach(b => b.addEventListener('click', () => openEmployeeDetail(main, b.dataset.open)));
  }

  function openEmployeeDetail(main, id) {
    const e = Store.getEmployee(id);
    if (!e) return;
    const cases = Store.listCases().filter(c => c.employeeId === id);
    openDrawer(`
      <h2>${escapeHtml(e.name)}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${e.category} · ${escapeHtml(e.position)}</div>
      <div class="kpi-row" style="grid-template-columns:1fr 1fr;">
        <div class="kpi-card"><div class="kpi-label">Status</div><div class="kpi-value" style="font-size:16px;">${employeeStatusDot(e.status)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Employment</div><div class="kpi-value" style="font-size:16px;">${employmentStatusBadge(e.employmentStatus)}</div></div>
      </div>
      <div class="page-sub" style="margin-top:10px;">Date hired: ${fmtDate(e.dateHired)} · Length of service: ${lengthOfService(e.dateHired)}</div>
      <div class="section-title" style="margin-top:18px;">Contact</div>
      <div class="page-sub">Phone: ${escapeHtml(e.phone || '—')}<br/>Email: ${escapeHtml(e.email || '—')}</div>
      <div class="section-title">Pay</div>
      <div class="page-sub">
        Rate: ${e.payType === 'Daily' ? fmtMoney(e.rate) + ' / day' : fmtMoney(e.rate) + ' / cutoff'}<br/>
        ${e.allowancePerDay ? 'COLA: ' + fmtMoney(e.allowancePerDay) + ' / day<br/>' : ''}
        ${e.fixedAllowance ? 'Fixed COLA: ' + fmtMoney(e.fixedAllowance) + ' / cutoff<br/>' : ''}
        ${e.housingAllowance ? 'Housing Allowance: ' + fmtMoney(e.housingAllowance) + ' / cutoff<br/>' : ''}
        Payday: ${PAY_CYCLES[e.payCycle] ? PAY_CYCLES[e.payCycle].cutoffLabels.join(' & ') : '—'}
      </div>
      ${e.notes ? `<div class="section-title">Notes</div><div class="page-sub">${escapeHtml(e.notes)}</div>` : ''}
      <div class="section-title">Employee Self-Service</div>
      <div class="page-sub">
        Employee ID: ${e.employeeCode ? `<strong>${escapeHtml(e.employeeCode)}</strong>` : '<span class="dim">not assigned</span>'}<br/>
        Portal access: ${e.authUserId ? '<span class="badge badge-green">Enabled</span>' : '<span class="badge badge-gray">Not enabled</span>'}
      </div>
      <div class="modal-actions" style="margin-top:8px; justify-content:flex-start;">
        ${e.authUserId
          ? `<button class="btn btn-ghost btn-sm" id="btn-revoke-ess">Revoke portal access</button>`
          : `<button class="btn btn-ghost btn-sm" id="btn-grant-ess">Grant portal access</button>`}
      </div>
      <div class="section-title">Disciplinary History</div>
      ${cases.length ? `<div class="timeline">${cases.map(c => `
        <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
          <div class="tl-title">${escapeHtml(c.violation)}</div>
          <div class="tl-meta">${fmtDate(c.dateIssued)} · ${c.status}</div>
        </div></div>
      `).join('')}</div>` : '<div class="page-sub">No disciplinary cases on file.</div>'}
      <div class="modal-actions" style="margin-top:20px;">
        <button class="btn btn-ghost" id="drawer-edit">Edit</button>
      </div>
    `, (dr) => {
      qs('#drawer-edit', dr).addEventListener('click', () => { closeDrawer(); openEmployeeModal(main, id); });
      const grantBtn = qs('#btn-grant-ess', dr);
      if (grantBtn) grantBtn.addEventListener('click', () => openGrantEssAccess(main, e));
      const revokeBtn = qs('#btn-revoke-ess', dr);
      if (revokeBtn) revokeBtn.addEventListener('click', async () => {
        if (confirm(`Revoke ${e.name}'s Employee Self-Service login? They will no longer be able to sign into the portal.`)) {
          await Store.updateEmployee(e.id, { authUserId: null });
          toast('Portal access revoked.');
          closeDrawer();
          renderList(main);
        }
      });
    });
  }

  // Links this employee's row to a Supabase Auth user so they can sign into ess.html.
  // The actual auth account is created manually in the Supabase Dashboard (Authentication
  // → Add user, synthetic email `<employeeCode-lowercased>@employees.txtaire.local`) —
  // same invite-only process already used for HR/Admin logins. This just pastes in the
  // resulting user's UUID and, if missing, assigns an Employee ID.
  function openGrantEssAccess(main, e) {
    const suggestedCode = e.employeeCode || '';
    openModal(`
      <h2>Grant portal access — ${escapeHtml(e.name)}</h2>
      <div class="modal-sub">
        First, create the login in Supabase Dashboard → Authentication → Add user, using the
        email <code>${escapeHtml((e.employeeCode || 'EMPLOYEE-ID').toLowerCase())}@employees.txtaire.local</code>
        and an initial password. Then paste that user's UUID here.
      </div>
      <form id="ess-grant-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee ID</label><input name="employeeCode" required value="${escapeHtml(suggestedCode)}" placeholder="e.g. TXT021" /></div>
          <div class="field full"><label>Supabase Auth User UUID</label><input name="authUserId" required placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Grant access</button>
        </div>
      </form>
    `, (bd) => {
      qs('#ess-grant-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.updateEmployee(e.id, {
          employeeCode: fd.get('employeeCode').trim(),
          authUserId: fd.get('authUserId').trim(),
        });
        toast('Portal access granted.');
        closeModal();
        renderList(main);
      });
    });
  }

  function openEmployeeModal(main, id) {
    const editing = id ? Store.getEmployee(id) : null;
    const e = editing || { name: '', category: 'Admin', position: '', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: '', allowancePerDay: 0, fixedAllowance: 0, housingAllowance: 0, nightShiftDifferential: false, payCycle: '10-20', notes: '' };

    openModal(`
      <h2>${editing ? 'Edit employee' : 'Add employee'}</h2>
      <div class="modal-sub">${editing ? 'Update employee record.' : 'Add a new employee to the centralized HR database.'}</div>
      <form id="employee-form">
        <div class="modal-grid">
          <div class="field full"><label>Full name</label><input name="name" required value="${escapeHtml(e.name)}" /></div>
          <div class="field"><label>Category</label>
            <select name="category">${CATEGORIES.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Position</label><input name="position" required value="${escapeHtml(e.position)}" /></div>
          <div class="field"><label>Employee ID</label><input name="employeeCode" value="${escapeHtml(e.employeeCode || '')}" placeholder="e.g. TXT001" /></div>
          <div class="field"><label>Status</label>
            <select name="status">${['Active', 'On Leave', 'Off', 'Terminated'].map(s => `<option ${s === e.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Employment status</label>
            <select name="employmentStatus">${['Regular', 'Probationary', 'Contractual'].map(s => `<option ${s === e.employmentStatus ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Date hired</label><input type="date" name="dateHired" value="${e.dateHired}" /></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(e.phone)}" /></div>
          <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(e.email)}" /></div>
          <div class="field"><label>Pay cycle</label>
            <select name="payCycle">
              <option value="10-20" ${e.payCycle === '10-20' ? 'selected' : ''}>10th &amp; 20th (Admins)</option>
              <option value="15-30" ${e.payCycle === '15-30' ? 'selected' : ''}>15th &amp; 30th/31st (Technicians)</option>
            </select>
          </div>
          <div class="field"><label>Pay type</label>
            <select name="payType">${['Monthly', 'Daily'].map(p => `<option ${p === e.payType ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Rate (PHP)</label><input type="number" name="rate" min="0" step="0.01" value="${e.rate}" /></div>
          <div class="field"><label>Cost of Living Allowance (COLA) / day</label><input type="number" name="allowancePerDay" min="0" step="0.01" value="${e.allowancePerDay || 0}" /></div>
          <div class="field"><label>Fixed COLA / cutoff (PHP)</label><input type="number" name="fixedAllowance" min="0" step="0.01" value="${e.fixedAllowance || 0}" /></div>
          <div class="field"><label>Housing Allowance / cutoff (PHP)</label><input type="number" name="housingAllowance" min="0" step="0.01" value="${e.housingAllowance || 0}" /></div>
          <div class="field" style="display:flex; align-items:flex-end; gap:8px; padding-bottom:6px;">
            <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer;">
              <input type="checkbox" name="nightShiftDifferential" ${e.nightShiftDifferential ? 'checked' : ''} style="width:auto;" />
              Typically works night shift
            </label>
          </div>
          <div class="field full"><label>Notes</label><textarea name="notes" rows="2">${escapeHtml(e.notes || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-emp">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add employee'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#employee-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          name: fd.get('name').trim(),
          category: fd.get('category'),
          position: fd.get('position').trim(),
          employeeCode: fd.get('employeeCode').trim().toUpperCase(),
          status: fd.get('status'),
          employmentStatus: fd.get('employmentStatus'),
          dateHired: fd.get('dateHired'),
          phone: fd.get('phone').trim(),
          email: fd.get('email').trim(),
          payCycle: fd.get('payCycle'),
          payType: fd.get('payType'),
          rate: Number(fd.get('rate')) || 0,
          allowancePerDay: Number(fd.get('allowancePerDay')) || 0,
          fixedAllowance: Number(fd.get('fixedAllowance')) || 0,
          housingAllowance: Number(fd.get('housingAllowance')) || 0,
          nightShiftDifferential: fd.get('nightShiftDifferential') === 'on',
          notes: fd.get('notes').trim(),
        };
        if (editing) {
          await Store.updateEmployee(editing.id, patch);
          toast('Employee updated.');
        } else {
          await Store.addEmployee(patch);
          toast('Employee added.');
        }
        closeModal();
        renderList(main);
      });
      const delBtn = qs('#btn-del-emp', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (confirm('Delete ' + editing.name + '? This cannot be undone.')) {
          await Store.deleteEmployee(editing.id);
          closeModal();
          toast('Employee deleted.');
          renderList(main);
        }
      });
    });
  }

  return { render: renderList };
})();
