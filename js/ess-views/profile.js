window.EssViews.profile = (function () {
  function documentStatusBadge(status) {
    const map = { Pending: 'badge-yellow', Verified: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }
  function scheduleStatusBadge(status) {
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Rejected: 'badge-red' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  // Synchronous data: URL -> Blob, no async callback involved at all (see the "why not
  // canvas.toBlob" note at its one call site below).
  function dataUrlToBlob(dataUrl) {
    const [meta, base64] = dataUrl.split(',');
    const mime = (meta.match(/:(.*?);/) || [, 'image/jpeg'])[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  // Loaded lazily (only when a photo actually needs converting) from the same jsdelivr CDN
  // already allow-listed in index.html/ess.html's CSP script-src for supabase-js/exceljs --
  // no new CSP change needed. Cached so picking a second HEIC photo doesn't re-fetch it.
  let heic2anyLoadPromise = null;
  function loadHeic2Any() {
    if (window.heic2any) return Promise.resolve(window.heic2any);
    if (heic2anyLoadPromise) return heic2anyLoadPromise;
    heic2anyLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
      script.onload = () => resolve(window.heic2any);
      script.onerror = () => { heic2anyLoadPromise = null; reject(new Error('load failed')); };
      document.head.appendChild(script);
    });
    return heic2anyLoadPromise;
  }

  // Pan/zoom crop for a just-picked profile photo -- always outputs a square JPEG blob
  // (the avatar is displayed circular via CSS border-radius everywhere else, so a square
  // source keeps that consistent without baking the circle into the file itself). Built as
  // its own hand-rolled overlay (same technique as the DTR/Voucher print overlays) rather
  // than going through openEssModal, since that function closes whatever modal is already
  // open -- this needs to sit on TOP of the still-open Edit Profile modal without losing
  // whatever the employee already typed into phone/email/bank fields there.
  async function openPhotoCropOverlay(file, onCropped) {
    const VIEWPORT = 260;
    const OUTPUT = 640;
    const img = new Image();
    let scale = 1, minScale = 1, x = 0, y = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, startX = 0, startY = 0;
    const controller = new AbortController();

    const overlay = document.createElement('div');
    overlay.className = 'crop-overlay';
    overlay.innerHTML = `
      <div class="crop-card">
        <h2 style="margin:0 0 4px;">Adjust Photo</h2>
        <div class="ess-sub" style="margin-bottom:14px;">Drag to reposition, use the slider to zoom.</div>
        <div class="crop-viewport" id="crop-viewport">
          <img id="crop-img" draggable="false" alt="" />
          <div id="crop-status" class="ess-sub" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; text-align:center; padding:10px; color:#fff;">Loading photo…</div>
        </div>
        <input type="range" id="crop-zoom" min="0" max="100" value="0" style="width:100%; margin:14px 0 6px;" />
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="crop-cancel">Cancel</button>
          <button type="button" class="btn btn-primary" id="crop-confirm">Use Photo</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const viewport = overlay.querySelector('#crop-viewport');
    const imgEl = overlay.querySelector('#crop-img');
    const zoomSlider = overlay.querySelector('#crop-zoom');
    const statusEl = overlay.querySelector('#crop-status');
    const confirmBtn = overlay.querySelector('#crop-confirm');
    confirmBtn.disabled = true; // stays disabled until the photo actually decodes successfully

    function applyTransform() {
      imgEl.style.width = (img.naturalWidth * scale) + 'px';
      imgEl.style.height = (img.naturalHeight * scale) + 'px';
      imgEl.style.transform = `translate(${x}px, ${y}px)`;
    }
    // Keeps the image covering the full viewport no matter how far it's dragged -- clamps
    // each axis to the range where neither edge can pull inward past the viewport border.
    function clamp() {
      const dispW = img.naturalWidth * scale;
      const dispH = img.naturalHeight * scale;
      x = Math.max(Math.min(0, VIEWPORT - dispW), Math.min(0, x));
      y = Math.max(Math.min(0, VIEWPORT - dispH), Math.min(0, y));
    }
    let objectUrl = null;
    img.onload = () => {
      minScale = Math.max(VIEWPORT / img.naturalWidth, VIEWPORT / img.naturalHeight);
      scale = minScale;
      x = (VIEWPORT - img.naturalWidth * scale) / 2;
      y = (VIEWPORT - img.naturalHeight * scale) / 2;
      applyTransform();
      statusEl.style.display = 'none';
      confirmBtn.disabled = false;
    };
    // Whenever the browser can't natively decode the picked file (HEIC being the common
    // real-world case -- an iPhone camera roll photo -- but this deliberately doesn't try
    // to detect that upfront: file.type/name have proven unreliable across iOS versions/
    // browsers, sometimes empty, sometimes a generic value that doesn't actually match what
    // the bytes are), fall back to converting it and retrying exactly once. Only shows the
    // final "can't load this" message if that fallback also fails.
    let heicFallbackAttempted = false;
    img.onerror = async () => {
      if (heicFallbackAttempted) {
        if (!controller.signal.aborted) statusEl.textContent = "Couldn't load this photo — it may be an unsupported format. Try a different photo, or a screenshot of it.";
        return;
      }
      heicFallbackAttempted = true;
      statusEl.textContent = 'Converting photo…';
      try {
        const heic2any = await loadHeic2Any();
        const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
        const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
        if (controller.signal.aborted) return;
        setSrc(convertedBlob);
      } catch (err) {
        if (!controller.signal.aborted) statusEl.textContent = "Couldn't load this photo — it may be an unsupported format. Try a different photo, or a screenshot of it.";
      }
    };
    function setSrc(blob) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;
      imgEl.src = objectUrl;
    }

    zoomSlider.addEventListener('input', () => {
      const t = Number(zoomSlider.value) / 100;
      scale = minScale + t * (minScale * 3 - minScale);
      clamp();
      applyTransform();
    }, { signal: controller.signal });

    function pointerDown(cx, cy) { dragging = true; dragStartX = cx; dragStartY = cy; startX = x; startY = y; }
    function pointerMove(cx, cy) { if (!dragging) return; x = startX + (cx - dragStartX); y = startY + (cy - dragStartY); clamp(); applyTransform(); }
    function pointerUp() { dragging = false; }

    viewport.addEventListener('mousedown', (ev) => pointerDown(ev.clientX, ev.clientY), { signal: controller.signal });
    window.addEventListener('mousemove', (ev) => pointerMove(ev.clientX, ev.clientY), { signal: controller.signal });
    window.addEventListener('mouseup', pointerUp, { signal: controller.signal });
    viewport.addEventListener('touchstart', (ev) => { const t = ev.touches[0]; pointerDown(t.clientX, t.clientY); }, { signal: controller.signal, passive: true });
    viewport.addEventListener('touchmove', (ev) => { ev.preventDefault(); const t = ev.touches[0]; pointerMove(t.clientX, t.clientY); }, { signal: controller.signal, passive: false });
    viewport.addEventListener('touchend', pointerUp, { signal: controller.signal });

    function close() {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      overlay.remove();
    }
    overlay.querySelector('#crop-cancel').addEventListener('click', close, { signal: controller.signal });

    // Always try the file exactly as picked first -- img.onerror above automatically falls
    // back to HEIC conversion if the browser can't decode it natively.
    setSrc(file);
    overlay.querySelector('#crop-confirm').addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const ctx = canvas.getContext('2d');
      const sSize = VIEWPORT / scale;
      ctx.drawImage(img, -x / scale, -y / scale, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
      // toDataURL (synchronous) instead of canvas.toBlob (callback-based) -- toBlob's
      // callback can be deferred indefinitely while the page is backgrounded, which
      // happens easily right here: many mobile browsers briefly background the page while
      // their native photo picker sheet is on screen, i.e. exactly during this flow.
      const blob = dataUrlToBlob(canvas.toDataURL('image/jpeg', 0.9));
      close();
      onCropped(blob);
    }, { signal: controller.signal });
  }

  function render(main, emp) {
    const history = Store.employmentHistoryForEmployee(emp.id);
    const docs = Store.employeeDocumentsForEmployee(emp.id);
    const scheduleRequests = Store.scheduleChangeRequestsForEmployee(emp.id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">${t('title_profile')}</div>
      <div class="ess-card" style="text-align:center;">
        <div style="position:relative; width:88px; height:88px; margin:0 auto 10px;">
          <div id="profile-photo-wrap" style="width:100%; height:100%;"></div>
          <button type="button" id="btn-edit-photo-pen" title="Edit Profile Picture" style="position:absolute; bottom:-2px; right:-2px; width:28px; height:28px; border-radius:50%; background:var(--accent); color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; border:2px solid var(--bg-card); padding:0; cursor:pointer;">✏️</button>
          <input type="file" accept="image/*" id="input-avatar-photo" style="display:none;" />
        </div>
        <div style="font-size:18px; font-weight:700;">${escapeHtml(emp.name)}</div>
        <div class="ess-sub">${escapeHtml(emp.position || '—')}</div>
      </div>
      <div class="ess-card">
        <div class="ess-row"><span class="label">Employee ID</span><span class="value">${escapeHtml(emp.employeeCode || '—')}</span></div>
        <div class="ess-row"><span class="label">Category</span><span class="value">${escapeHtml(emp.category)}</span></div>
        <div class="ess-row"><span class="label">Employment Status</span><span class="value">${escapeHtml(emp.employmentStatus)}</span></div>
        <div class="ess-row"><span class="label">Date Hired</span><span class="value">${fmtDate(emp.dateHired)}</span></div>
        <div class="ess-row"><span class="label">Birthday</span><span class="value">${emp.birthDate ? fmtDate(emp.birthDate) : '—'}</span></div>
      </div>
      <div class="ess-card">
        <div class="ess-card-label">Contact</div>
        <div class="ess-row"><span class="label">Phone</span><span class="value">${escapeHtml(emp.phone || '—')}</span></div>
        <div class="ess-row"><span class="label">Email</span><span class="value">${escapeHtml(emp.email || '—')}</span></div>
      </div>
      <div class="ess-card">
        <div class="ess-card-label" style="display:flex; justify-content:space-between; align-items:center;">
          <span>Working Schedule</span>
          <button type="button" class="link-btn" id="btn-request-schedule">Request Change</button>
        </div>
        <div class="ess-row"><span class="label">Default Time In</span><span class="value">${emp.defaultTimeIn ? to12Hour(emp.defaultTimeIn) : '—'}</span></div>
        <div class="ess-row"><span class="label">Default Time Out</span><span class="value">${emp.defaultTimeOut ? to12Hour(emp.defaultTimeOut) : '—'}</span></div>
        ${scheduleRequests.length ? scheduleRequests.map(r => `
          <div class="ess-sub" style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-soft);">
            ${to12Hour(r.requestedTimeIn)} – ${to12Hour(r.requestedTimeOut)} ${scheduleStatusBadge(r.status)}
            ${r.reviewNotes ? `<br/>HR: ${escapeHtml(r.reviewNotes)}` : ''}
          </div>
        `).join('') : ''}
      </div>
      <div class="ess-card">
        <div class="ess-card-label">Bank Details</div>
        <div class="ess-sub" style="margin-bottom:8px;">Only visible to you and HR — used to send your payroll.</div>
        <div class="ess-row"><span class="label">Bank Account No.</span><span class="value">${escapeHtml(emp.bankAccountNumber || '—')}</span></div>
        <div id="qr-preview-wrap" style="text-align:center; margin-top:10px;"></div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-edit-profile" style="width:100%; justify-content:center; margin-bottom:6px;">✏️ Edit Profile</button>
      <div class="ess-sub" style="text-align:center; margin-bottom:14px;">Employee ID, category, status, and pay details can only be changed by HR.</div>

      <div class="ess-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>Employment History</span>
        <button type="button" class="link-btn" id="btn-add-history" title="Add entry">✏️</button>
      </div>
      ${history.length ? history.map(h => `
        <div class="ess-card" data-history-id="${h.id}">
          <div class="ess-row" style="align-items:flex-start;">
            <span class="label">${fmtDate(h.effectiveDate)}${h.reason ? ' · ' + escapeHtml(h.reason) : ''}</span>
            <span class="value" style="text-align:right;">${escapeHtml(h.position)}${h.rate ? '<br/>' + fmtMoney(h.rate) + (h.payType === 'Daily' ? ' / day' : ' / cutoff') : ''}</span>
          </div>
          ${h.notes ? `<div class="ess-sub" style="margin-top:4px;">${escapeHtml(h.notes)}</div>` : ''}
          <div class="modal-actions" style="justify-content:flex-start; margin-top:8px; padding-top:0;">
            <button type="button" class="link-btn" data-edit-history="${h.id}">Edit</button>
            <button type="button" class="link-btn" data-delete-history="${h.id}" style="color:var(--red);">Delete</button>
          </div>
        </div>
      `).join('') : '<div class="ess-card"><div class="ess-empty">No history logged yet.</div></div>'}

      <div class="ess-section-title" style="display:flex; justify-content:space-between; align-items:center;">
        <span>201 File</span>
        <button type="button" class="link-btn" id="btn-upload-doc">+ Upload</button>
      </div>
      <div class="ess-sub" style="margin-bottom:10px;">Valid ID, SSS, PhilHealth, Pag-IBIG, TIN, and other requirements. HR reviews each upload.</div>
      ${docs.length ? docs.map(d => `
        <div class="ess-card" data-doc-id="${d.id}">
          <div class="ess-row"><span class="label">${escapeHtml(d.category)}${d.category === 'Valid ID' && d.idType ? ' — ' + escapeHtml(d.idType) : ''}</span>${documentStatusBadge(d.status)}</div>
          <div class="ess-row"><span class="value" style="font-size:12.5px;">${escapeHtml(d.fileName)}</span></div>
          ${d.verifyNotes ? `<div class="ess-sub" style="margin-top:4px;">HR: ${escapeHtml(d.verifyNotes)}</div>` : ''}
          <div class="modal-actions" style="justify-content:flex-start; margin-top:8px; padding-top:0;">
            <button type="button" class="link-btn" data-view-doc="${d.filePath}">View</button>
            <button type="button" class="link-btn" data-delete-doc="${d.id}" data-path="${d.filePath}" style="color:var(--red);">Delete</button>
          </div>
        </div>
      `).join('') : '<div class="ess-empty">No documents uploaded yet.</div>'}
    `;

    const photoWrap = qs('#profile-photo-wrap', main);
    const avatarStyle = 'width:100%; height:100%; border-radius:50%; object-fit:cover; border:1px solid var(--border-soft);';
    qs('#btn-edit-photo-pen', main).addEventListener('click', () => qs('#input-avatar-photo', main).click());
    qs('#input-avatar-photo', main).addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      openPhotoCropOverlay(file, async (croppedBlob) => {
        const oldPath = emp.photoPath;
        try {
          const newPath = await Store.uploadEmployeePhoto(emp.id, croppedBlob);
          await Store.updateEmployee(emp.id, { photoPath: newPath });
          if (oldPath) await Store.deleteEmployeePhoto(oldPath);
          emp.photoPath = newPath;
          toast('✔ Profile picture updated.');
          render(main, emp);
        } catch (err) {
          toast('Could not update photo — try again.');
        }
      });
    });
    if (emp.photoPath) {
      photoWrap.innerHTML = `<div class="ess-sub">Loading photo…</div>`;
      Store.getSignedEmployeePhotoUrl(emp.photoPath).then((url) => {
        if (!qs('#profile-photo-wrap', main)) return; // view changed while the signed URL was loading
        photoWrap.innerHTML = url
          ? `<img src="${url}" alt="Profile photo" style="${avatarStyle}" />`
          : `<div style="${avatarStyle} display:flex; align-items:center; justify-content:center; background:var(--bg-elevated);">📷</div>`;
      });
    } else {
      photoWrap.innerHTML = `<div style="${avatarStyle} display:flex; align-items:center; justify-content:center; background:var(--bg-elevated); font-size:32px;">👤</div>`;
    }

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
    qs('#btn-request-schedule', main).addEventListener('click', () => openRequestScheduleModal(main, emp));
    qs('#btn-add-history', main).addEventListener('click', () => openEmploymentHistoryForm(main, emp));
    qsa('[data-edit-history]', main).forEach(b => b.addEventListener('click', () => {
      const h = history.find(x => x.id === b.dataset.editHistory);
      if (h) openEmploymentHistoryForm(main, emp, h);
    }));
    qsa('[data-delete-history]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this employment history entry? This cannot be undone.')) return;
      await Store.deleteEmploymentHistory(b.dataset.deleteHistory);
      toast('✔ Entry deleted.');
      render(main, emp);
    }));
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
          <div class="field full" id="field-id-type" style="display:none;"><label>ID Type</label>
            <select name="idType">${PH_VALID_ID_TYPES.map(t => `<option>${t}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>File(s)</label><input type="file" name="file" multiple required /></div>
        </div>
        <div id="upload-doc-progress" class="modal-sub hidden" style="margin-top:6px;"></div>
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
      const fileInput = qs('input[name="file"]', bd);
      const submitBtn = qs('button[type="submit"]', bd);
      fileInput.addEventListener('change', () => {
        const n = fileInput.files.length;
        submitBtn.textContent = n > 1 ? `Upload (${n})` : 'Upload';
      });
      qs('#doc-upload-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const files = [...fileInput.files];
        if (!files.length) { toast('Choose at least one file first.'); return; }
        submitBtn.disabled = true;
        const progress = qs('#upload-doc-progress', bd);
        progress.classList.remove('hidden');
        let succeeded = 0;
        for (let i = 0; i < files.length; i++) {
          progress.textContent = `Uploading ${i + 1} of ${files.length}: ${files[i].name}`;
          try {
            await Store.uploadEmployeeDocument(emp.id, files[i], fd.get('category'), emp.email || emp.employeeCode, fd.get('idType'));
            succeeded++;
          } catch (e) { /* keep going -- one failed file shouldn't block the rest */ }
        }
        if (succeeded === files.length) {
          toast(succeeded === 1 ? '✔ Document uploaded — HR will review it.' : `✔ ${succeeded} documents uploaded — HR will review them.`);
          closeEssModal();
          render(main, emp);
        } else {
          toast(`⚠ ${succeeded} of ${files.length} uploaded — some failed. Try the rest again.`);
          submitBtn.disabled = false;
          submitBtn.textContent = files.length > 1 ? `Upload (${files.length})` : 'Upload';
          progress.classList.add('hidden');
        }
      });
    });
  }

  // Same fields/table as the admin Employees drawer's version -- an employee can correct
  // or remove their own position/salary track record entries; edits never touch the
  // employee's actual current record (position/rate above), only this log.
  function openEmploymentHistoryForm(main, emp, existing) {
    const h = existing || { effectiveDate: todayISO(), reason: 'Promotion', position: emp.position, payType: emp.payType, rate: emp.rate, notes: '' };
    openEssModal(`
      <h2>${existing ? 'Edit' : 'Add'} Employment History Entry</h2>
      <form id="history-form">
        <div class="modal-grid">
          <div class="field"><label>Effective date</label><input type="date" name="effectiveDate" value="${h.effectiveDate}" required /></div>
          <div class="field"><label>Reason</label>
            <select name="reason">${['New Hire', 'Promotion', 'Salary Adjustment', 'Transfer', 'Other'].map(r => `<option ${r === h.reason ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Position</label><input name="position" required value="${escapeHtml(h.position)}" /></div>
          <div class="field"><label>Pay type</label>
            <select name="payType">${['Monthly', 'Per Cutoff', 'Daily'].map(p => `<option ${p === h.payType ? 'selected' : ''}>${p}</option>`).join('')}</select>
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
          await Store.addEmploymentHistory(Object.assign({ employeeId: emp.id, category: emp.category }, patch));
          toast('✔ Employment history entry added.');
        }
        closeEssModal();
        render(main, emp);
      });
    });
  }

  // Employee-submitted request for a new Default Time In/Out -- doesn't change anything
  // directly (js/store.js addScheduleChangeRequest just inserts a Pending row); HR reviews
  // and approves it on the Schedule Requests dashboard page, which is what actually applies
  // the new schedule (js/store.js reviewScheduleChangeRequest).
  function openRequestScheduleModal(main, emp) {
    openEssModal(`
      <h2>Request Schedule Change</h2>
      <div class="modal-sub">HR will review and approve before it takes effect.</div>
      <form id="schedule-request-form">
        <div class="modal-grid">
          <div class="field"><label>Requested Time In</label><input type="time" name="requestedTimeIn" value="${escapeHtml(emp.defaultTimeIn || '')}" required /></div>
          <div class="field"><label>Requested Time Out</label><input type="time" name="requestedTimeOut" value="${escapeHtml(emp.defaultTimeOut || '')}" required /></div>
          <div class="field full"><label>Reason <span class="dim" style="font-weight:400;">(optional)</span></label><textarea name="reason" rows="2"></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (bd) => {
      qs('#schedule-request-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addScheduleChangeRequest({
          employeeId: emp.id,
          requestedTimeIn: fd.get('requestedTimeIn'),
          requestedTimeOut: fd.get('requestedTimeOut'),
          reason: fd.get('reason').trim(),
        });
        toast('✔ Schedule change requested — HR will review it.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  function openEditProfile(main, emp) {
    let qrFile = null;
    let removeQr = false;
    let photoFile = null;
    let removePhoto = false;

    openEssModal(`
      <h2>Edit Profile</h2>
      <div class="modal-sub">Update your contact info and bank details. Other fields are managed by HR.</div>
      <form id="profile-form">
        <div class="modal-grid">
          <div class="field full">
            <label>Profile Photo</label>
            ${emp.photoPath ? `
              <div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">
                <span class="ess-sub" id="photo-current-label" style="margin:0;">Current photo on file — pick a new image to replace it.</span>
              </div>
              <button type="button" class="link-btn" id="btn-remove-photo" style="margin-bottom:6px;">🗑 Remove current photo</button>
            ` : ''}
            <input type="file" accept="image/*" name="photo" id="input-photo" />
            <div id="photo-crop-preview"></div>
          </div>
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
      const removePhotoBtn = qs('#btn-remove-photo', bd);
      if (removePhotoBtn) removePhotoBtn.addEventListener('click', () => {
        removePhoto = true;
        qs('#photo-current-label', bd).textContent = 'Current photo will be removed on save.';
        removePhotoBtn.disabled = true;
      });
      qs('#input-photo', bd).addEventListener('change', (ev) => {
        const file = ev.target.files[0];
        ev.target.value = ''; // clear so picking the same file again after Cancel still fires 'change'
        if (!file) return;
        openPhotoCropOverlay(file, (croppedBlob) => {
          photoFile = croppedBlob;
          removePhoto = false;
          const previewUrl = URL.createObjectURL(croppedBlob);
          qs('#photo-crop-preview', bd).innerHTML =
            `<img src="${previewUrl}" alt="Cropped preview" style="width:64px; height:64px; border-radius:50%; object-fit:cover; margin-top:8px; border:1px solid var(--border-soft);" />`;
        });
      });
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
          const oldPhotoPath = emp.photoPath;
          if (photoFile) {
            patch.photoPath = await Store.uploadEmployeePhoto(emp.id, photoFile);
          } else if (removePhoto) {
            patch.photoPath = null;
          }
          const oldQrPath = emp.bankQrPath;
          if (qrFile) {
            patch.bankQrPath = await Store.uploadBankQr(emp.id, qrFile);
          } else if (removeQr) {
            patch.bankQrPath = null;
          }
          await Store.updateEmployee(emp.id, patch);
          if ((photoFile || removePhoto) && oldPhotoPath) await Store.deleteEmployeePhoto(oldPhotoPath);
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
