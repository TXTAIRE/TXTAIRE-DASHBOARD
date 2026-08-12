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
                <td class="dim">${e.payCycle ? paydayLabel(e.payCycle) : '—'}</td>
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

  function documentStatusBadge(status) {
    const map = { Pending: 'badge-yellow', Verified: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function openEmployeeDetail(main, id) {
    const e = Store.getEmployee(id);
    if (!e) return;
    const cases = Store.listCases().filter(c => c.employeeId === id);
    const history = Store.employmentHistoryForEmployee(id);
    const docs = Store.employeeDocumentsForEmployee(id);
    openDrawer(`
      <h2>${escapeHtml(e.name)}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${e.category} · ${escapeHtml(e.position)}</div>
      <div class="kpi-row" style="grid-template-columns:1fr 1fr;">
        <div class="kpi-card"><div class="kpi-label">Status</div><div class="kpi-value" style="font-size:16px;">${employeeStatusDot(e.status)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Employment</div><div class="kpi-value" style="font-size:16px;">${employmentStatusBadge(e.employmentStatus)}</div></div>
      </div>
      <div class="section-title" style="margin-top:18px;">Profile <span class="dim" style="font-weight:400;">(same info this employee sees on My Portal → My Profile)</span></div>
      <div class="page-sub">
        Employee ID: ${e.employeeCode ? `<strong>${escapeHtml(e.employeeCode)}</strong>` : '<span class="dim">not assigned</span>'}<br/>
        Category: ${escapeHtml(e.category)}<br/>
        Employment status: ${escapeHtml(e.employmentStatus)}<br/>
        Date hired: ${fmtDate(e.dateHired)} · Length of service: ${lengthOfService(e.dateHired)}<br/>
        Phone: ${escapeHtml(e.phone || '—')}<br/>
        Email: ${escapeHtml(e.email || '—')}
      </div>
      <div class="section-title">Pay</div>
      <div class="page-sub">
        Rate: ${e.payType === 'Daily' ? fmtMoney(e.rate) + ' / day' : fmtMoney(e.rate) + ' / cutoff'}<br/>
        ${e.allowancePerDay ? 'COLA: ' + fmtMoney(e.allowancePerDay) + ' / day<br/>' : ''}
        ${e.fixedAllowance ? 'Fixed COLA: ' + fmtMoney(e.fixedAllowance) + ' / cutoff<br/>' : ''}
        ${e.housingAllowance ? 'Housing Allowance: ' + fmtMoney(e.housingAllowance) + ' / cutoff<br/>' : ''}
        Payday: ${e.payCycle ? paydayLabel(e.payCycle) : '—'}
      </div>
      ${e.notes ? `<div class="section-title">Notes</div><div class="page-sub">${escapeHtml(e.notes)}</div>` : ''}
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Employment History <span class="dim" style="font-weight:400;">(position &amp; salary track record — also editable by this employee on My Profile)</span></span>
        <button class="link-btn" id="btn-add-history">+ Add entry</button>
      </div>
      ${history.length ? `<div class="timeline">${history.map(h => `
        <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
          <div class="tl-title">${escapeHtml(h.position)}${h.rate ? ' — ' + fmtMoney(h.rate) + (h.payType === 'Daily' ? ' / day' : ' / cutoff') : ''}</div>
          <div class="tl-meta">${fmtDate(h.effectiveDate)}${h.reason ? ' · ' + escapeHtml(h.reason) : ''}</div>
          ${h.notes ? `<div class="page-sub" style="margin-top:2px;">${escapeHtml(h.notes)}</div>` : ''}
          <button class="link-btn" data-edit-history="${h.id}" style="font-size:11px; margin-top:2px;">Edit</button>
          <button class="link-btn" data-del-history="${h.id}" style="font-size:11px; margin-top:2px;">Delete</button>
        </div></div>
      `).join('')}</div>` : '<div class="page-sub">No employment history logged yet — current position/rate above is all that\'s on file.</div>'}
      <div class="section-title">Bank Details <span class="dim" style="font-weight:400;">(payroll disbursement — visible only to HR/admins and this employee)</span></div>
      <div class="page-sub">
        Account number: ${e.bankAccountNumber ? `<strong>${escapeHtml(e.bankAccountNumber)}</strong>` : '<span class="dim">not set</span>'}
      </div>
      ${e.bankQrPath ? `<button class="btn btn-ghost btn-sm" id="btn-view-bank-qr" style="margin-top:6px;">View QR code</button>` : ''}
      <div class="section-title">Employee Self-Service</div>
      <div class="page-sub">
        Portal access: ${e.authUserId ? '<span class="badge badge-green">Enabled</span>' : '<span class="badge badge-gray">Not enabled</span>'}
      </div>
      <div class="modal-actions" style="margin-top:8px; justify-content:flex-start;">
        ${e.authUserId
          ? `<button class="btn btn-ghost btn-sm" id="btn-reset-ess-password">Reset portal password</button>
             <button class="btn btn-ghost btn-sm" id="btn-revoke-ess">Revoke portal access</button>`
          : `<button class="btn btn-ghost btn-sm" id="btn-grant-ess">Grant portal access</button>`}
      </div>
      <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>201 File <span class="dim" style="font-weight:400;">(requirements &amp; records — valid ID, SSS, PhilHealth, etc.)</span></span>
        <button class="link-btn" id="btn-upload-document">+ Upload document</button>
      </div>
      ${docs.length ? `
      <div class="panel" style="margin-bottom:14px;">
        <table>
          <thead><tr><th>Category</th><th>File</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${docs.map(d => `
              <tr>
                <td class="dim">${escapeHtml(d.category)}${d.category === 'Valid ID' && d.idType ? ' — ' + escapeHtml(d.idType) : ''}</td>
                <td class="name">${escapeHtml(d.fileName)}</td>
                <td>${documentStatusBadge(d.status)}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-view-doc="${d.filePath}">View</button>
                  <button class="link-btn" data-manage-doc="${d.id}">Manage</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : '<div class="page-sub" style="margin-bottom:14px;">No documents uploaded yet.</div>'}
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
      const viewQrBtn = qs('#btn-view-bank-qr', dr);
      if (viewQrBtn) viewQrBtn.addEventListener('click', () => {
        const win = window.open('', '_blank');
        Store.getSignedBankQrUrl(e.bankQrPath).then((url) => {
          if (url && win) win.location.href = url;
          else if (win) win.close();
        });
      });
      const grantBtn = qs('#btn-grant-ess', dr);
      if (grantBtn) grantBtn.addEventListener('click', () => openGrantEssAccess(main, e));
      const resetPwBtn = qs('#btn-reset-ess-password', dr);
      if (resetPwBtn) resetPwBtn.addEventListener('click', () => openResetEssPasswordModal(main, e));
      const revokeBtn = qs('#btn-revoke-ess', dr);
      if (revokeBtn) revokeBtn.addEventListener('click', async () => {
        if (confirm(`Revoke ${e.name}'s Employee Self-Service login? They will no longer be able to sign into the portal.`)) {
          await Store.updateEmployee(e.id, { authUserId: null });
          toast('Portal access revoked.');
          closeDrawer();
          renderList(main);
        }
      });
      qs('#btn-add-history', dr).addEventListener('click', () => openEmploymentHistoryForm(main, e));
      qsa('[data-edit-history]', dr).forEach(b => b.addEventListener('click', () => {
        const h = history.find(x => x.id === b.dataset.editHistory);
        if (h) openEmploymentHistoryForm(main, e, h);
      }));
      qsa('[data-del-history]', dr).forEach(b => b.addEventListener('click', async () => {
        if (!confirm('Delete this employment history entry?')) return;
        await Store.deleteEmploymentHistory(b.dataset.delHistory);
        toast('Entry deleted.');
        closeDrawer();
        openEmployeeDetail(main, id);
      }));
      qs('#btn-upload-document', dr).addEventListener('click', () => openUploadDocumentModal(main, e));
      qsa('[data-view-doc]', dr).forEach(b => b.addEventListener('click', () => {
        const win = window.open('', '_blank');
        Store.getSignedEmployeeDocumentUrl(b.dataset.viewDoc).then((url) => {
          if (url && win) win.location.href = url;
          else if (win) win.close();
        });
      }));
      qsa('[data-manage-doc]', dr).forEach(b => b.addEventListener('click', () => {
        const doc = docs.find(d => d.id === b.dataset.manageDoc);
        if (doc) openManageDocumentModal(main, e, doc);
      }));
    });
  }

  // Position/salary change log. Entries are also created automatically (see
  // openEmployeeModal's submit handler below, which detects a position/rate change and
  // logs it here) whenever HR promotes/adjusts someone through the normal Edit Employee
  // form -- this form is for adding an entry by hand (e.g. backfilling old history) or,
  // via the drawer's "Edit" link, correcting an existing one. Never touches the
  // employee's actual current record.
  function openEmploymentHistoryForm(main, e, existing) {
    const h = existing || { effectiveDate: todayISO(), reason: 'Promotion', position: e.position, payType: e.payType, rate: e.rate, notes: '' };
    openModal(`
      <h2>${existing ? 'Edit' : 'Add'} Employment History Entry</h2>
      <div class="modal-sub">${escapeHtml(e.name)} — logs a position/salary change; doesn't affect the employee's current record above.</div>
      <form id="history-form">
        <div class="modal-grid">
          <div class="field"><label>Effective date</label><input type="date" name="effectiveDate" value="${h.effectiveDate}" required /></div>
          <div class="field"><label>Reason</label>
            <select name="reason">${['New Hire', 'Promotion', 'Salary Adjustment', 'Transfer', 'Other'].map(r => `<option ${r === h.reason ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Position</label><input name="position" required value="${escapeHtml(h.position)}" /></div>
          <div class="field"><label>Pay type</label>
            <select name="payType">${['Monthly', 'Daily'].map(p => `<option ${p === h.payType ? 'selected' : ''}>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Rate (PHP)</label><input type="number" name="rate" min="0" step="0.01" value="${h.rate || ''}" /></div>
          <div class="field full"><label>Notes</label><textarea name="notes" rows="2">${escapeHtml(h.notes || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add entry'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#history-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          effectiveDate: fd.get('effectiveDate'),
          reason: fd.get('reason'),
          position: fd.get('position').trim(),
          payType: fd.get('payType'),
          rate: Number(fd.get('rate')) || 0,
          notes: fd.get('notes').trim(),
        };
        if (existing) {
          await Store.updateEmploymentHistory(existing.id, patch);
          toast('✔ Employment history entry updated.');
        } else {
          await Store.addEmploymentHistory(Object.assign({ employeeId: e.id, category: e.category }, patch));
          toast('✔ Employment history entry added.');
        }
        closeModal();
        openEmployeeDetail(main, e.id);
      });
    });
  }

  // Admin uploads a document on the employee's behalf -- same DOCUMENT_CATEGORIES list and
  // storage path convention (js/store.js uploadEmployeeDocument) as the employee's own
  // upload on My Portal -> My Profile, so both sides show up in the same 201 File list.
  function openUploadDocumentModal(main, e) {
    openModal(`
      <h2>Upload Document — ${escapeHtml(e.name)}</h2>
      <form id="doc-upload-form">
        <div class="modal-grid">
          <div class="field full"><label>Category</label>
            <select name="category">${DOCUMENT_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="field full" id="field-id-type" style="display:none;"><label>ID Type</label>
            <select name="idType">${PH_VALID_ID_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>File</label><input type="file" name="file" required /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Upload</button>
        </div>
      </form>
    `, (bd) => {
      const catSel = qs('select[name="category"]', bd);
      const idTypeField = qs('#field-id-type', bd);
      const toggleIdType = () => { idTypeField.style.display = catSel.value === 'Valid ID' ? '' : 'none'; };
      catSel.addEventListener('change', toggleIdType);
      toggleIdType();
      qs('#doc-upload-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const file = fd.get('file');
        if (!file || !file.size) { toast('Choose a file first.'); return; }
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading…';
        try {
          await Store.uploadEmployeeDocument(e.id, file, fd.get('category'), currentUserEmail(), fd.get('idType'));
          toast('✔ Document uploaded.');
          closeModal();
          openEmployeeDetail(main, e.id);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Upload';
        }
      });
    });
  }

  // View + edit (category/notes) + verify, all in one place -- the actual file itself is
  // immutable once uploaded (delete and re-upload to replace it), consistent with how every
  // other upload-only record in this app works (deductions, bonuses, office files).
  function openManageDocumentModal(main, e, d) {
    openModal(`
      <h2>Manage Document — ${escapeHtml(e.name)}</h2>
      <div class="modal-sub">${escapeHtml(d.fileName)}${d.uploadedBy ? ' · uploaded by ' + escapeHtml(d.uploadedBy) : ''}</div>
      <form id="doc-manage-form">
        <div class="modal-grid">
          <div class="field"><label>Category</label>
            <select name="category">${DOCUMENT_CATEGORIES.map(c => `<option ${c === d.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Status</label>
            <select name="status">${['Pending', 'Verified', 'Rejected'].map(s => `<option ${s === d.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field full" id="field-id-type" style="display:none;"><label>ID Type</label>
            <select name="idType">${PH_VALID_ID_TYPES.map(t => `<option ${t === d.idType ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Verification Notes</label><textarea name="verifyNotes" rows="2">${escapeHtml(d.verifyNotes || '')}</textarea></div>
        </div>
        ${d.verifiedBy ? `<div class="page-sub">Last reviewed by ${escapeHtml(d.verifiedBy)} on ${fmtDate(d.verifiedDate)}</div>` : ''}
        <div class="modal-actions" style="justify-content:space-between;">
          <button type="button" class="btn btn-danger" id="btn-delete-doc">Delete</button>
          <div style="display:flex; gap:8px;">
            <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </div>
      </form>
    `, (bd) => {
      const catSel = qs('select[name="category"]', bd);
      const idTypeField = qs('#field-id-type', bd);
      const toggleIdType = () => { idTypeField.style.display = catSel.value === 'Valid ID' ? '' : 'none'; };
      catSel.addEventListener('change', toggleIdType);
      toggleIdType();
      qs('#doc-manage-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const status = fd.get('status');
        const category = fd.get('category');
        const patch = { category, idType: category === 'Valid ID' ? fd.get('idType') : null, status, verifyNotes: fd.get('verifyNotes').trim() };
        if (status !== d.status) {
          patch.verifiedBy = currentUserEmail();
          patch.verifiedDate = todayISO();
        }
        await Store.updateEmployeeDocument(d.id, patch);
        toast('✔ Document updated.');
        closeModal();
        openEmployeeDetail(main, e.id);
      });
      qs('#btn-delete-doc', bd).addEventListener('click', async () => {
        if (!confirm(`Delete "${d.fileName}"? This cannot be undone.`)) return;
        await Store.deleteEmployeeDocument(d.id, d.filePath);
        toast('✔ Document deleted.');
        closeModal();
        openEmployeeDetail(main, e.id);
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

  function generateStrongPassword() {
    // Excludes visually-ambiguous characters (0/O, 1/l/I) since this is meant to be read
    // off-screen and typed/relayed to the employee, not just copy-pasted.
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const arr = new Uint32Array(14);
    crypto.getRandomValues(arr);
    let pw = '';
    for (let i = 0; i < arr.length; i++) pw += chars[arr[i] % chars.length];
    return pw;
  }

  // Resets an employee's My Portal login password via the admin-reset-employee-password
  // Edge Function (server-side, using the service role key -- only Supabase's Admin API
  // can set another user's password; that key can never be exposed to client-side code,
  // which is why this can't just be a Store.* call like everything else on this page).
  // The new password only ever exists in plain text here, briefly, between being
  // generated and sent -- shown once on a confirmation screen afterward so HR can copy it
  // to give the employee, then never retrievable again by anyone, including this app.
  function openResetEssPasswordModal(main, e) {
    openModal(`
      <h2>Reset Portal Password — ${escapeHtml(e.name)}</h2>
      <div class="modal-sub" style="margin-bottom:10px;">Sets a new My Portal login password for this employee. You'll need to share it with them directly — it won't be shown again after this.</div>
      <div id="reset-pw-error"></div>
      <form id="reset-pw-form">
        <div class="modal-grid">
          <div class="field full">
            <label>New password</label>
            <div style="display:flex; gap:8px;">
              <input type="text" name="password" id="reset-pw-input" required minlength="8" value="${escapeHtml(generateStrongPassword())}" style="flex:1;" />
              <button type="button" class="btn btn-ghost btn-sm" id="btn-regen-pw">🔄 Generate new</button>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Reset Password</button>
        </div>
      </form>
    `, (bd) => {
      qs('#btn-regen-pw', bd).addEventListener('click', () => {
        qs('#reset-pw-input', bd).value = generateStrongPassword();
      });
      qs('#reset-pw-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const newPassword = qs('#reset-pw-input', bd).value;
        const errEl = qs('#reset-pw-error', bd);
        errEl.innerHTML = '';
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Resetting…';
        try {
          const { data: { session } } = await sb.auth.getSession();
          const res = await fetch('https://fmgqqrmsxleyeiadnhyd.supabase.co/functions/v1/admin-reset-employee-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify({ employeeId: e.id, newPassword }),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(result.error || 'Reset failed — try again.');

          // Best-effort -- never includes the password itself, only that a reset happened.
          Store.logAudit('employees.resetEssPassword', 'employees', e.id, { employeeName: e.name });

          openModal(`
            <h2>✔ Password Reset</h2>
            <div class="modal-sub" style="margin-bottom:14px;">${escapeHtml(e.name)}'s new My Portal password — copy it now and share it with them directly. It will not be shown again.</div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
              <input type="text" readonly value="${escapeHtml(newPassword)}" id="new-pw-display" style="flex:1; font-family:monospace; font-size:15px;" onclick="this.select()" />
              <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-new-pw">📋 Copy</button>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" data-close-modal>Done</button>
            </div>
          `, (bd2) => {
            qs('#btn-copy-new-pw', bd2).addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(newPassword);
                toast('✔ Password copied.');
              } catch (err) {
                qs('#new-pw-display', bd2).select();
                toast('Select and copy manually (clipboard access blocked).');
              }
            });
          });
        } catch (err) {
          errEl.innerHTML = `<div class="auth-error">${escapeHtml(err.message || 'Something went wrong.')}</div>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reset Password';
        }
      });
    });
  }

  function openEmployeeModal(main, id) {
    const editing = id ? Store.getEmployee(id) : null;
    const e = editing || { name: '', category: 'Admin', position: '', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: '', allowancePerDay: 0, fixedAllowance: 0, housingAllowance: 0, nightShiftDifferential: false, payCycle: '10-20', notes: '', bankAccountNumber: '' };

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
              <option value="10-20" ${e.payCycle === '10-20' ? 'selected' : ''}>Admins (${paydayLabel('10-20')})</option>
              <option value="15-30" ${e.payCycle === '15-30' ? 'selected' : ''}>Technicians (${paydayLabel('15-30')})</option>
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
          <div class="field full"><label>Bank Account Number <span class="dim">(payroll — visible only to HR/admins and this employee)</span></label><input name="bankAccountNumber" value="${escapeHtml(e.bankAccountNumber || '')}" placeholder="e.g. GCash / bank account number" /></div>
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
          bankAccountNumber: fd.get('bankAccountNumber').trim(),
          notes: fd.get('notes').trim(),
        };
        if (editing) {
          // Auto-detect a promotion/salary adjustment: if position or rate actually
          // changed, log it to Employment History automatically (with the previous
          // position/rate for context) instead of requiring HR to separately remember to
          // add an entry — the manual "+ Add entry" form still exists for backfilling or
          // correcting old history.
          const positionChanged = patch.position !== editing.position;
          const rateChanged = Number(patch.rate) !== Number(editing.rate || 0);
          const payTypeChanged = patch.payType !== editing.payType;
          await Store.updateEmployee(editing.id, patch);
          if (positionChanged || rateChanged || payTypeChanged) {
            const prevRateText = editing.rate ? fmtMoney(editing.rate) + (editing.payType === 'Daily' ? ' / day' : ' / cutoff') : 'no rate on file';
            await Store.addEmploymentHistory({
              employeeId: editing.id,
              category: patch.category,
              effectiveDate: todayISO(),
              reason: positionChanged ? 'Promotion' : 'Salary Adjustment',
              position: patch.position,
              payType: patch.payType,
              rate: patch.rate,
              notes: `Auto-logged — previously ${editing.position} (${prevRateText}).`,
            });
          }
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
