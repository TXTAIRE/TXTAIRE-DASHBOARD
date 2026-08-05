window.Views.adminFiles = (function () {
  // Same taxonomy as the company's existing shared drive, so this mirrors what the office
  // already organizes documents into. Files are just officeFiles rows (js/store.js) with
  // one of these as their category -- "folder" is purely a client-side grouping, no new
  // table/bucket needed.
  const FOLDERS = [
    'Billing Invoice', 'Billing Statements', 'Bills', 'Delivery Receipt', 'Excel Encoded',
    'Gate Pass', 'HR', 'Materials Request', 'Office', 'Plant Activity Report',
    'Quarterly Self-Monitoring Report', 'Receipts', 'Sales Invoice', 'Service Report',
    'Start-Up and Commissioning Report', 'Trouble Call Report', 'TxTAIRE Logo & Org Chart', 'Other',
  ];
  let activeFolder = null; // null = folder grid

  function fmtFileSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  function fmtWhen(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function renderView(main) {
    if (activeFolder) renderFolderDetail(main);
    else renderFolderGrid(main);
  }

  function renderFolderGrid(main) {
    const all = Store.listOfficeFiles();
    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Admin Files</h1>
          <div class="page-sub">Company document library, organized by folder. Open a folder to upload a file or scan one straight from this device.</div>
        </div>
      </div>
      <div class="file-folder-grid">
        ${FOLDERS.map(f => {
          const count = all.filter(x => (x.category || 'Other') === f).length;
          return `
            <button type="button" class="file-folder-card" data-folder="${escapeHtml(f)}">
              <div class="file-folder-icon">📁</div>
              <div class="file-folder-name">${escapeHtml(f)}</div>
              <div class="file-folder-count">${count} file${count === 1 ? '' : 's'}</div>
            </button>
          `;
        }).join('')}
      </div>
    `;
    qsa('[data-folder]', main).forEach(b => b.addEventListener('click', () => { activeFolder = b.dataset.folder; renderView(main); }));
  }

  function renderFolderDetail(main) {
    const rows = Store.listOfficeFiles()
      .filter(f => (f.category || 'Other') === activeFolder)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <button type="button" class="link-btn" id="btn-back-folders" style="margin-bottom:6px;">← All Folders</button>
          <h1 class="page-title">📁 ${escapeHtml(activeFolder)}</h1>
          <div class="page-sub">${rows.length} file${rows.length === 1 ? '' : 's'} in this folder.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-scan-doc">📷 Scan Document</button>
          <button class="btn btn-primary" id="btn-upload-doc">+ Upload File</button>
        </div>
      </div>
      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>File</th><th>Size</th><th>Uploaded</th><th>By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(f => `
              <tr>
                <td class="name">${escapeHtml(f.fileName)}</td>
                <td class="dim">${fmtFileSize(f.fileSize)}</td>
                <td class="dim">${fmtWhen(f.created_at)}</td>
                <td class="dim">${escapeHtml(f.uploadedBy || '—')}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-view-file="${f.filePath}">View</button>
                  <button class="link-btn" data-delete-file="${f.id}" data-path="${f.filePath}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No files in this folder yet.</div>'}
      </div>
    `;

    qs('#btn-back-folders', main).addEventListener('click', () => { activeFolder = null; renderView(main); });
    qs('#btn-upload-doc', main).addEventListener('click', () => openUploadModal(main, false));
    qs('#btn-scan-doc', main).addEventListener('click', () => openUploadModal(main, true));
    qsa('[data-view-file]', main).forEach(b => b.addEventListener('click', async () => {
      const win = window.open('', '_blank');
      const url = await Store.getSignedOfficeFileUrl(b.dataset.viewFile);
      if (url && win) win.location.href = url; else if (win) win.close();
    }));
    qsa('[data-delete-file]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this file? This cannot be undone.')) return;
      await Store.deleteOfficeFile(b.dataset.deleteFile, b.dataset.path);
      toast('✔ File deleted.');
      renderFolderDetail(main);
    }));
  }

  // "Scan Document" is the same upload under the hood -- a browser can't drive a physical
  // scanner/TWAIN driver directly -- but on a phone/tablet, accept="image/*" plus
  // capture="environment" makes the file picker open the camera directly instead of the
  // photo library, which is the closest thing to "scan" available from a web app. Desktop
  // browsers just fall back to the normal file picker.
  function openUploadModal(main, isScan) {
    openModal(`
      <h2>${isScan ? 'Scan Document' : 'Upload File'} — ${escapeHtml(activeFolder)}</h2>
      ${isScan ? '<div class="modal-sub">On a phone or tablet this opens your camera to capture the document. On desktop it opens the normal file picker.</div>' : ''}
      <form id="admin-file-form">
        <div class="modal-grid">
          <div class="field full"><label>File</label><input type="file" name="file" required ${isScan ? 'accept="image/*" capture="environment"' : ''} /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${isScan ? 'Capture & Upload' : 'Upload'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#admin-file-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const file = fd.get('file');
        if (!file || !file.size) { toast('Choose a file first.'); return; }
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading…';
        try {
          await Store.uploadOfficeFile(file, activeFolder, currentUserEmail());
          toast('✔ File uploaded.');
          closeModal();
          renderView(main);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = isScan ? 'Capture & Upload' : 'Upload';
        }
      });
    });
  }

  return { render: renderView };
})();
