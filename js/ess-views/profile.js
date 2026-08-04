window.EssViews.profile = (function () {
  function documentStatusBadge(status) {
    const map = { Pending: 'badge-yellow', Verified: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function render(main, emp) {
    const history = Store.employmentHistoryForEmployee(emp.id);
    const docs = Store.employeeDocumentsForEmployee(emp.id);

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">My Profile</div>
      <div class="ess-card" style="text-align:center;">
        <div style="font-size:18px; font-weight:700;">${escapeHtml(emp.name)}</div>
        <div class="ess-sub">${escapeHtml(emp.position || '—')}</div>
      </div>
      <div class="ess-card">
        <div class="ess-row"><span class="label">Employee ID</span><span class="value">${escapeHtml(emp.employeeCode || '—')}</span></div>
        <div class="ess-row"><span class="label">Category</span><span class="value">${escapeHtml(emp.category)}</span></div>
        <div class="ess-row"><span class="label">Employment Status</span><span class="value">${escapeHtml(emp.employmentStatus)}</span></div>
        <div class="ess-row"><span class="label">Date Hired</span><span class="value">${fmtDate(emp.dateHired)}</span></div>
      </div>
      <div class="ess-card">
        <div class="ess-card-label">Contact</div>
        <div class="ess-row"><span class="label">Phone</span><span class="value">${escapeHtml(emp.phone || '—')}</span></div>
        <div class="ess-row"><span class="label">Email</span><span class="value">${escapeHtml(emp.email || '—')}</span></div>
      </div>
      <div class="ess-card">
        <div class="ess-card-label">Bank Details</div>
        <div class="ess-sub" style="margin-bottom:8px;">Only visible to you and HR — used to send your payroll.</div>
        <div class="ess-row"><span class="label">Bank Account No.</span><span class="value">${escapeHtml(emp.bankAccountNumber || '—')}</span></div>
        <div id="qr-preview-wrap" style="text-align:center; margin-top:10px;"></div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-edit-profile" style="width:100%; justify-content:center; margin-bottom:6px;">✏️ Edit Profile</button>
      <div class="ess-sub" style="text-align:center; margin-bottom:14px;">Employee ID, category, status, and pay details can only be changed by HR.</div>

      <div class="ess-section-title">Employment History</div>
      <div class="ess-card">
        ${history.length ? history.map(h => `
          <div class="ess-row" style="align-items:flex-start;">
            <span class="label">${fmtDate(h.effectiveDate)}${h.reason ? ' · ' + escapeHtml(h.reason) : ''}</span>
            <span class="value" style="text-align:right;">${escapeHtml(h.position)}${h.rate ? '<br/>' + fmtMoney(h.rate) + (h.payType === 'Daily' ? ' / day' : ' / cutoff') : ''}</span>
          </div>
        `).join('') : '<div class="ess-empty">No history logged yet.</div>'}
      </div>

      <div class="ess-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>201 File</span>
        <button type="button" class="link-btn" id="btn-upload-doc">+ Upload</button>
      </div>
      <div class="ess-sub" style="margin-bottom:10px;">Valid ID, SSS, PhilHealth, Pag-IBIG, TIN, and other requirements. HR reviews each upload.</div>
      ${docs.length ? docs.map(d => `
        <div class="ess-card" data-doc-id="${d.id}">
          <div class="ess-row"><span class="label">${escapeHtml(d.category)}</span>${documentStatusBadge(d.status)}</div>
          <div class="ess-row"><span class="value" style="font-size:12.5px;">${escapeHtml(d.fileName)}</span></div>
          ${d.verifyNotes ? `<div class="ess-sub" style="margin-top:4px;">HR: ${escapeHtml(d.verifyNotes)}</div>` : ''}
          <div class="modal-actions" style="justify-content:flex-start; margin-top:8px; padding-top:0;">
            <button type="button" class="link-btn" data-view-doc="${d.filePath}">View</button>
            <button type="button" class="link-btn" data-delete-doc="${d.id}" data-path="${d.filePath}" style="color:var(--red);">Delete</button>
          </div>
        </div>
      `).join('') : '<div class="ess-empty">No documents uploaded yet.</div>'}
    `;

    const qrWrap = qs('#qr-preview-wrap', main);
    if (emp.bankQrPath) {
      qrWrap.innerHTML = `<div class="ess-sub">Loading QR code…</div>`;
      Store.getSignedBankQrUrl(emp.bankQrPath).then((url) => {
        if (!qs('#qr-preview-wrap', main)) return; // view changed while the signed URL was loading
        qrWrap.innerHTML = url
          ? `<img src="${url}" alt="Bank QR code" style="max-width:180px; width:100%; border:1px solid var(--border-soft); border-radius:8px;" />`
          : `<div class="ess-sub">Could not load QR code.</div>`;
      });
    } else {
      qrWrap.innerHTML = `<div class="ess-sub">No QR code uploaded yet.</div>`;
    }

    qs('#btn-edit-profile', main).addEventListener('click', () => openEditProfile(main, emp));
    qs('#btn-upload-doc', main).addEventListener('click', () => openUploadDocumentForm(main, emp));
    qsa('[data-view-doc]', main).forEach(b => b.addEventListener('click', () => {
      const win = window.open('', '_blank');
      Store.getSignedEmployeeDocumentUrl(b.dataset.viewDoc).then((url) => {
        if (url && win) win.location.href = url;
        else if (win) win.close();
      });
    }));
    qsa('[data-delete-doc]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this document? This cannot be undone.')) return;
      await Store.deleteEmployeeDocument(b.dataset.deleteDoc, b.dataset.path);
      toast('✔ Document deleted.');
      render(main, emp);
    }));
  }

  // Same DOCUMENT_CATEGORIES list and storage path convention (js/store.js
  // uploadEmployeeDocument) as the admin's own upload on the Employees page, so both
  // sides land in the same 201 File list -- every upload starts 'Pending' regardless of
  // who uploads it; only HR can move it to Verified/Rejected.
  function openUploadDocumentForm(main, emp) {
    openEssModal(`
      <h2>Upload Document</h2>
      <form id="doc-upload-form">
        <div class="modal-grid">
          <div class="field full"><label>Category</label>
            <select name="category">${DOCUMENT_CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>File</label><input type="file" name="file" required /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Upload</button>
        </div>
      </form>
    `, (bd) => {
      qs('#doc-upload-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const file = fd.get('file');
        if (!file || !file.size) { toast('Choose a file first.'); return; }
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading…';
        try {
          await Store.uploadEmployeeDocument(emp.id, file, fd.get('category'), emp.email || emp.employeeCode);
          toast('✔ Document uploaded — HR will review it.');
          closeEssModal();
          render(main, emp);
        } catch (e) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Upload';
        }
      });
    });
  }

  function openEditProfile(main, emp) {
    let qrFile = null;
    let removeQr = false;

    openEssModal(`
      <h2>Edit Profile</h2>
      <div class="modal-sub">Update your contact info and bank details. Other fields are managed by HR.</div>
      <form id="profile-form">
        <div class="modal-grid">
          <div class="field full"><label>Phone</label><input name="phone" value="${escapeHtml(emp.phone || '')}" /></div>
          <div class="field full"><label>Email</label><input type="email" name="email" value="${escapeHtml(emp.email || '')}" /></div>
          <div class="field full"><label>Bank Account Number</label><input name="bankAccountNumber" value="${escapeHtml(emp.bankAccountNumber || '')}" placeholder="e.g. GCash / bank account number" /></div>
          <div class="field full">
            <label>Bank QR Code</label>
            ${emp.bankQrPath ? `
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <span class="ess-sub" id="qr-current-label" style="margin:0;">Current QR code on file — pick a new image to replace it.</span>
              </div>
              <button type="button" class="link-btn" id="btn-remove-qr" style="margin-bottom:6px;">🗑 Remove current QR code</button>
            ` : ''}
            <input type="file" accept="image/*" name="bankQr" id="input-bank-qr" />
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `, (bd) => {
      const removeBtn = qs('#btn-remove-qr', bd);
      if (removeBtn) removeBtn.addEventListener('click', () => {
        removeQr = true;
        qs('#qr-current-label', bd).textContent = 'Current QR code will be removed on save.';
        removeBtn.disabled = true;
      });
      qs('#input-bank-qr', bd).addEventListener('change', (ev) => {
        qrFile = ev.target.files[0] || null;
        if (qrFile) removeQr = false;
      });

      qs('#profile-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const patch = {
            phone: fd.get('phone').trim(),
            email: fd.get('email').trim(),
            bankAccountNumber: fd.get('bankAccountNumber').trim(),
          };
          const oldQrPath = emp.bankQrPath;
          if (qrFile) {
            patch.bankQrPath = await Store.uploadBankQr(emp.id, qrFile);
          } else if (removeQr) {
            patch.bankQrPath = null;
          }
          await Store.updateEmployee(emp.id, patch);
          if ((qrFile || removeQr) && oldQrPath) await Store.deleteBankQrPhoto(oldQrPath);
          Object.assign(emp, patch);
          toast('✔ Profile updated.');
          closeEssModal();
          render(main, emp);
        } catch (e) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save';
        }
      });
    });
  }

  return { render };
})();
