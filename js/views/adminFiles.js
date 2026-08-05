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
  let pasteListenerAttached = false;

  // Recursively expands a dropped FileSystemEntry (from DataTransferItem.webkitGetAsEntry)
  // into its underlying File objects -- lets dragging a whole folder from the desktop onto
  // a dropzone upload everything inside it (including subfolders), not just top-level files.
  function readEntryFiles(entry) {
    return new Promise((resolve) => {
      if (!entry) { resolve([]); return; }
      if (entry.isFile) {
        entry.file((file) => resolve([file]), () => resolve([]));
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const collected = [];
        // readEntries only returns entries in batches (spec caps ~100 per call) --
        // must keep calling it until it comes back empty.
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (!entries.length) {
              const results = await Promise.all(collected.map(readEntryFiles));
              resolve(results.flat());
              return;
            }
            collected.push(...entries);
            readBatch();
          }, () => resolve([]));
        };
        readBatch();
      } else {
        resolve([]);
      }
    });
  }

  // Reads whatever was dropped -- individual files, or one or more whole folders -- into a
  // flat array of File objects. Entries must be pulled out of `items` synchronously (before
  // any await), since some browsers invalidate the DataTransfer once the drop handler yields.
  // webkitGetAsEntry() can come back null for an item that's still a real file (seen with
  // non-OS-drag sources) -- per-item fall back to getAsFile() rather than silently dropping
  // it, and fall back to the plain file list wholesale if the entry API isn't usable at all.
  async function filesFromDataTransfer(dataTransfer) {
    const items = dataTransfer && dataTransfer.items;
    if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
      const results = await Promise.all([...items].map((it) => {
        const entry = it.webkitGetAsEntry();
        if (entry) return readEntryFiles(entry);
        const file = typeof it.getAsFile === 'function' ? it.getAsFile() : null;
        return Promise.resolve(file ? [file] : []);
      }));
      const flat = results.flat();
      if (flat.length) return flat;
    }
    return [...((dataTransfer && dataTransfer.files) || [])];
  }

  // Shared by the Upload/Scan modal, drag-and-drop, and paste -- uploads a batch of files
  // into one folder sequentially (so one bad file doesn't block the rest), calling
  // onProgress(index, total, fileName) as it goes. Returns how many actually succeeded.
  async function uploadBatch(files, category, onProgress) {
    let succeeded = 0;
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(i, files.length, files[i].name);
      try {
        await Store.uploadOfficeFile(files[i], category, currentUserEmail());
        succeeded++;
      } catch (err) {
        // Keep going -- one failed page shouldn't block the rest of the batch.
      }
    }
    return succeeded;
  }

  function reportBatchResult(succeeded, total) {
    if (succeeded === total) {
      toast(`✔ ${succeeded} file${succeeded === 1 ? '' : 's'} uploaded.`);
    } else {
      toast(`⚠ ${succeeded} of ${total} uploaded — some failed. Try the rest again.`);
    }
  }

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
    qsa('[data-folder]', main).forEach(b => {
      b.addEventListener('click', () => { activeFolder = b.dataset.folder; renderView(main); });
      // Drop files straight onto a folder card to upload into it without opening it first
      // -- same drag-and-drop convention as dropping files onto a folder in File Explorer.
      b.addEventListener('dragover', (ev) => { ev.preventDefault(); b.classList.add('drag-over'); });
      b.addEventListener('dragleave', () => b.classList.remove('drag-over'));
      b.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        b.classList.remove('drag-over');
        const files = await filesFromDataTransfer(ev.dataTransfer);
        if (!files.length) return;
        const folder = b.dataset.folder;
        toast(`Uploading ${files.length} file${files.length === 1 ? '' : 's'} to ${folder}…`);
        const succeeded = await uploadBatch(files, folder);
        reportBatchResult(succeeded, files.length);
        if (activeFolder === null) renderView(main); // still on the grid -- refresh counts
      });
    });
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
          <button class="btn btn-ghost" id="btn-upload-folder">📁 Upload Folder</button>
          <button class="btn btn-primary" id="btn-upload-doc">+ Upload File</button>
        </div>
      </div>
      <div class="page-sub" style="margin-bottom:8px;">Or drag files (or a whole folder) here, or paste (Ctrl/Cmd+V), to upload straight into this folder.</div>
      <div class="panel" id="folder-dropzone">
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
        </table>` : '<div class="empty">No files in this folder yet. Drag files here, paste, or use the buttons above.</div>'}
      </div>
    `;

    qs('#btn-back-folders', main).addEventListener('click', () => { activeFolder = null; renderView(main); });
    qs('#btn-upload-doc', main).addEventListener('click', () => openUploadModal(main, 'file'));
    qs('#btn-scan-doc', main).addEventListener('click', () => openUploadModal(main, 'scan'));
    qs('#btn-upload-folder', main).addEventListener('click', () => openUploadModal(main, 'folder'));
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

    const dropzone = qs('#folder-dropzone', main);
    dropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropzone.classList.add('drag-over'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      dropzone.classList.remove('drag-over');
      const files = await filesFromDataTransfer(ev.dataTransfer);
      if (!files.length) return;
      toast(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
      const succeeded = await uploadBatch(files, activeFolder);
      reportBatchResult(succeeded, files.length);
      renderFolderDetail(main);
    });

    // Attached once (document-level, so it works no matter what's focused on the page) --
    // only acts while a folder is actually open, and only if the paste actually carries
    // files (so normal text copy/paste elsewhere on the page is never intercepted).
    if (!pasteListenerAttached) {
      pasteListenerAttached = true;
      document.addEventListener('paste', async (ev) => {
        if (!activeFolder) return;
        const files = [...(ev.clipboardData && ev.clipboardData.files || [])];
        if (!files.length) return;
        ev.preventDefault();
        toast(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
        const succeeded = await uploadBatch(files, activeFolder);
        reportBatchResult(succeeded, files.length);
        renderFolderDetail(main);
      });
    }
  }

  // "Scan Document" is the same upload under the hood -- a browser can't drive a physical
  // scanner/TWAIN driver directly -- but on a phone/tablet, accept="image/*" plus
  // capture="environment" makes the file picker open the camera directly instead of the
  // photo library, which is the closest thing to "scan" available from a web app. Desktop
  // browsers just fall back to the normal file picker. Both modes allow selecting multiple
  // files at once (a scanner utility that saved a whole stack of pages as separate images,
  // or a phone gallery's multi-select) -- uploaded sequentially so progress can be shown
  // and one bad file doesn't abort the rest of the batch.
  // mode: 'file' (pick one or more files) | 'scan' (camera capture on mobile) | 'folder'
  // (pick a whole folder -- webkitdirectory hands back every file inside it, including
  // subfolders, as a flat FileList; uploaded the same way as any other batch).
  function openUploadModal(main, mode) {
    const isScan = mode === 'scan';
    const isFolder = mode === 'folder';
    const title = isScan ? 'Scan Document(s)' : isFolder ? 'Upload Folder' : 'Upload File(s)';
    const sub = isScan
      ? 'On a phone or tablet this opens your camera. On desktop, or if your device allows picking more than one image at once, you can select multiple pages to upload together.'
      : isFolder
        ? 'Pick a folder from this computer -- every file inside it (including subfolders) uploads into this folder in one batch.'
        : 'Select multiple files to upload them all at once -- e.g. every page a scanner saved as a separate image.';
    openModal(`
      <h2>${title} — ${escapeHtml(activeFolder)}</h2>
      <div class="modal-sub">${sub}</div>
      <form id="admin-file-form">
        <div class="modal-grid">
          <div class="field full"><label>${isFolder ? 'Folder' : 'File(s)'}</label>
            <input type="file" name="file" required
              ${isFolder ? 'webkitdirectory directory' : 'multiple'}
              ${isScan ? 'accept="image/*" capture="environment"' : ''} />
          </div>
        </div>
        <div id="upload-progress" class="modal-sub hidden" style="margin-top:6px;"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-do-upload">${isScan ? 'Capture & Upload' : 'Upload'}</button>
        </div>
      </form>
    `, (bd) => {
      const fileInput = qs('input[name="file"]', bd);
      const submitBtn = qs('#btn-do-upload', bd);
      const baseLabel = isScan ? 'Capture & Upload' : 'Upload';
      fileInput.addEventListener('change', () => {
        const n = fileInput.files.length;
        submitBtn.textContent = n > 1 ? `${baseLabel} (${n})` : baseLabel;
      });

      qs('#admin-file-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const files = [...fileInput.files];
        if (!files.length) { toast('Choose at least one file first.'); return; }
        submitBtn.disabled = true;
        const progress = qs('#upload-progress', bd);
        progress.classList.remove('hidden');

        const succeeded = await uploadBatch(files, activeFolder, (i, total, name) => {
          progress.textContent = `Uploading ${i + 1} of ${total}: ${name}`;
        });
        reportBatchResult(succeeded, files.length);

        if (succeeded === files.length) {
          closeModal();
          renderView(main);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = baseLabel;
          progress.classList.add('hidden');
        }
      });
    });
  }

  return { render: renderView };
})();
