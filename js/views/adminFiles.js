window.Views.adminFiles = (function () {
  // Starting taxonomy, mirroring what the office's existing shared drive already used --
  // admins can add/remove folders from here at runtime (see getFolders/saveFolders below).
  // Files are just officeFiles rows (js/store.js) with a folder name as their category --
  // "folder" is purely a label, no new table/bucket needed. The actual live list is stored
  // in appSettings (key 'adminFileFolders', admin-only, already realtime-synced) so it
  // persists and stays in sync across every admin's browser; this array is only the
  // fallback used the very first time, before anyone has customized it.
  const DEFAULT_FOLDERS = [
    'Billing Invoice', 'Billing Statements', 'Bills', 'Delivery Receipt', 'Excel Encoded',
    'Gate Pass', 'HR', 'Materials Request', 'Office', 'Plant Activity Report',
    'Quarterly Self-Monitoring Report', 'Receipts', 'Sales Invoice', 'Service Report',
    'Start-Up and Commissioning Report', 'Trouble Call Report', 'TxTAIRE Logo & Org Chart', 'Other',
  ];
  function getFolders() { return Store.getAppSetting('adminFileFolders', DEFAULT_FOLDERS); }
  async function saveFolders(list) { await Store.setAppSetting('adminFileFolders', list); }

  let activeFolder = null; // null = folder grid
  let pasteListenerAttached = false;
  let selectedFileIds = new Set(); // ids checked in the currently open folder's table
  // Desktop-file-explorer-style Cut/Copy + Paste. { mode: 'copy'|'cut', sourceFolder, files }
  // -- files is a snapshot (not just ids) so Paste still works even if the source rows
  // change/refetch in the meantime. Survives navigating between folders on purpose (that's
  // the whole point -- copy here, walk to another folder, paste there); only cleared by an
  // explicit Cancel, or automatically after a Cut is pasted (a Copy can be pasted into
  // several folders in a row, same as a real file manager).
  let clipboard = null;
  let openMenuId = null; // id of the file whose "..." row menu is currently open (one at a time)
  let menuOutsideClickAttached = false;

  function closeAllRowMenus() {
    qsa('.row-menu').forEach(m => m.classList.add('hidden'));
    openMenuId = null;
  }

  // Recursively expands a dropped FileSystemEntry (from DataTransferItem.webkitGetAsEntry)
  // into its underlying files -- lets dragging a whole folder from the desktop onto a
  // dropzone upload everything inside it (including subfolders), not just top-level files.
  // Keeps each file's path relative to the dropped root (via entry.fullPath) alongside it,
  // so callers that care which subfolder a file came from (auto-sort-by-folder-name) can
  // use it -- callers that don't just read .file and ignore .relPath.
  function readEntryFiles(entry) {
    return new Promise((resolve) => {
      if (!entry) { resolve([]); return; }
      if (entry.isFile) {
        entry.file((file) => resolve([{ file, relPath: entry.fullPath.replace(/^\//, '') }]), () => resolve([]));
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
  // flat array of {file, relPath} entries. Entries must be pulled out of `items`
  // synchronously (before any await), since some browsers invalidate the DataTransfer once
  // the drop handler yields. webkitGetAsEntry() can come back null for an item that's still
  // a real file (seen with non-OS-drag sources) -- per-item fall back to getAsFile() rather
  // than silently dropping it, and fall back to the plain file list wholesale if the entry
  // API isn't usable at all.
  async function entriesFromDataTransfer(dataTransfer) {
    const items = dataTransfer && dataTransfer.items;
    if (items && items.length && typeof items[0].webkitGetAsEntry === 'function') {
      const results = await Promise.all([...items].map((it) => {
        const entry = it.webkitGetAsEntry();
        if (entry) return readEntryFiles(entry);
        const file = typeof it.getAsFile === 'function' ? it.getAsFile() : null;
        return Promise.resolve(file ? [{ file, relPath: file.name }] : []);
      }));
      const flat = results.flat();
      if (flat.length) return flat;
    }
    return [...((dataTransfer && dataTransfer.files) || [])].map((file) => ({ file, relPath: file.webkitRelativePath || file.name }));
  }

  // Most call sites just want the File objects (they upload everything into one fixed
  // folder and don't care where each file came from).
  async function filesFromDataTransfer(dataTransfer) {
    return (await entriesFromDataTransfer(dataTransfer)).map((x) => x.file);
  }

  // Matches a file's nearest containing subfolder name against our known categories
  // (case-insensitive) -- e.g. "MyExport/HR/file.pdf" -> 'HR'. Checked from the deepest
  // folder outward so a category name nested a few levels deep still matches. Returns null
  // if nothing in the path matches (file sits directly in the picked/dropped root, or under
  // a folder name we don't recognize) -- callers fall back to 'Other'.
  function categoryForPath(relPath) {
    const folders = getFolders();
    const parts = (relPath || '').split('/').filter(Boolean);
    parts.pop(); // drop the filename itself
    for (let i = parts.length - 1; i >= 0; i--) {
      const match = folders.find(f => f.toLowerCase() === parts[i].toLowerCase());
      if (match) return match;
    }
    return null;
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

  // Like uploadBatch, but resolves each file's category from its own path inside the
  // dropped/picked folder (categoryForPath) instead of one fixed folder -- lets an admin
  // upload a whole local export (already organized into subfolders named after our
  // categories, e.g. "Payroll Export/HR/...", "Payroll Export/Receipts/...") in one go and
  // have everything land where it belongs, instead of opening one folder at a time. Files
  // that don't sit under a recognized subfolder name fall back to 'Other'.
  async function uploadBatchAutoSort(entries, onProgress) {
    let succeeded = 0, unmatched = 0;
    for (let i = 0; i < entries.length; i++) {
      const { file, relPath } = entries[i];
      const category = categoryForPath(relPath);
      if (!category) unmatched++;
      if (onProgress) onProgress(i, entries.length, file.name);
      try {
        await Store.uploadOfficeFile(file, category || 'Other', currentUserEmail());
        succeeded++;
      } catch (err) {
        // Keep going -- one failed file shouldn't block the rest of the batch.
      }
    }
    return { succeeded, unmatched };
  }

  function reportAutoSortResult(succeeded, total, unmatched) {
    if (succeeded === total) {
      toast(`✔ ${succeeded} file${succeeded === 1 ? '' : 's'} sorted into folders automatically.${unmatched ? ` ${unmatched} without a matching folder name went to Other.` : ''}`);
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
    const folders = getFolders();
    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Admin Files</h1>
          <div class="page-sub">Company document library, organized by folder. Open a folder to upload a file or scan one straight from this device, or upload a whole exported folder below and it'll sort itself into the matching folders.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-new-folder">+ New Folder</button>
          <button class="btn btn-ghost" id="btn-upload-folder-autosort">📁 Upload Folder (auto-sort)</button>
        </div>
      </div>
      <div class="page-sub" style="margin-bottom:8px;">Or drag a folder from your computer here — if it has subfolders named after these categories (e.g. "HR", "Billing Invoice"), each file sorts into the matching one automatically; anything else goes to Other.</div>
      <div class="file-folder-grid" id="folder-grid-dropzone">
        ${folders.map(f => {
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
    qs('#btn-new-folder', main).addEventListener('click', () => openNewFolderModal(main));
    qsa('[data-folder]', main).forEach(b => {
      b.addEventListener('click', () => { activeFolder = b.dataset.folder; selectedFileIds = new Set(); renderView(main); });
      // Drop files straight onto a folder card to upload into it without opening it first
      // -- same drag-and-drop convention as dropping files onto a folder in File Explorer.
      // stopPropagation so this doesn't also trigger the grid's own auto-sort dropzone below.
      b.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.stopPropagation(); b.classList.add('drag-over'); });
      b.addEventListener('dragleave', () => b.classList.remove('drag-over'));
      b.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
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

    qs('#btn-upload-folder-autosort', main).addEventListener('click', () => openUploadFolderAutoSortModal(main));
    const gridDropzone = qs('#folder-grid-dropzone', main);
    gridDropzone.addEventListener('dragover', (ev) => { ev.preventDefault(); gridDropzone.classList.add('drag-over'); });
    gridDropzone.addEventListener('dragleave', (ev) => { if (ev.target === gridDropzone) gridDropzone.classList.remove('drag-over'); });
    gridDropzone.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      gridDropzone.classList.remove('drag-over');
      const entries = await entriesFromDataTransfer(ev.dataTransfer);
      if (!entries.length) return;
      toast(`Sorting and uploading ${entries.length} file${entries.length === 1 ? '' : 's'}…`);
      const { succeeded, unmatched } = await uploadBatchAutoSort(entries);
      reportAutoSortResult(succeeded, entries.length, unmatched);
      renderView(main);
    });
  }

  // Auto-sort variant of openUploadModal -- one webkitdirectory pick, each file routed to
  // the category matching its immediate subfolder name (categoryForPath), same as dropping
  // a folder onto the grid background.
  function openUploadFolderAutoSortModal(main) {
    openModal(`
      <h2>Upload Folder (auto-sort)</h2>
      <div class="modal-sub">Pick a folder from this computer. If it has subfolders named after our categories (e.g. "HR", "Billing Invoice"), each file inside sorts into the matching folder automatically; anything else goes to Other.</div>
      <form id="admin-file-autosort-form">
        <div class="modal-grid">
          <div class="field full"><label>Folder</label>
            <input type="file" name="file" required webkitdirectory directory />
          </div>
        </div>
        <div id="autosort-progress" class="modal-sub hidden" style="margin-top:6px;"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-do-autosort-upload">Upload</button>
        </div>
      </form>
    `, (bd) => {
      const fileInput = qs('input[name="file"]', bd);
      const submitBtn = qs('#btn-do-autosort-upload', bd);
      fileInput.addEventListener('change', () => {
        const n = fileInput.files.length;
        submitBtn.textContent = n > 1 ? `Upload (${n})` : 'Upload';
      });

      qs('#admin-file-autosort-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const entries = [...fileInput.files].map((file) => ({ file, relPath: file.webkitRelativePath || file.name }));
        if (!entries.length) { toast('Choose a folder first.'); return; }
        submitBtn.disabled = true;
        const progress = qs('#autosort-progress', bd);
        progress.classList.remove('hidden');

        const { succeeded, unmatched } = await uploadBatchAutoSort(entries, (i, total, name) => {
          progress.textContent = `Uploading ${i + 1} of ${total}: ${name}`;
        });
        reportAutoSortResult(succeeded, entries.length, unmatched);

        if (succeeded === entries.length) {
          closeModal();
          renderView(main);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Upload';
          progress.classList.add('hidden');
        }
      });
    });
  }

  function openNewFolderModal(main) {
    openModal(`
      <h2>New Folder</h2>
      <form id="new-folder-form">
        <div class="modal-grid">
          <div class="field full"><label>Folder name</label><input name="name" required maxlength="60" placeholder="e.g. Warranty Claims" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Create Folder</button>
        </div>
      </form>
    `, (bd) => {
      qs('#new-folder-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const name = new FormData(ev.target).get('name').trim();
        if (!name) { toast('Enter a folder name.'); return; }
        const folders = getFolders();
        if (folders.some(f => f.toLowerCase() === name.toLowerCase())) {
          toast('A folder with that name already exists.');
          return;
        }
        // Keep 'Other' as the last entry, matching its role as the catch-all fallback.
        const otherIndex = folders.findIndex(f => f.toLowerCase() === 'other');
        const updated = otherIndex >= 0 ? [...folders.slice(0, otherIndex), name, ...folders.slice(otherIndex)] : [...folders, name];
        await saveFolders(updated);
        toast('✔ Folder created.');
        closeModal();
        renderView(main);
      });
    });
  }

  // Shared by the per-file "Move to..." menu item and the bulk-selection bar's "Move to..."
  // button -- a one-step alternative to Cut + navigate + Paste for the common case of just
  // relocating something to a specific folder right now. files is an array (one file for
  // the per-row action, several for the bulk one).
  function openMoveToModal(main, files) {
    const destinations = getFolders().filter(f => f !== activeFolder);
    openModal(`
      <h2>Move ${files.length} file${files.length === 1 ? '' : 's'}</h2>
      <div class="modal-sub">${files.length === 1 ? escapeHtml(files[0].fileName) : files.length + ' files selected'}</div>
      <form id="move-to-form">
        <div class="modal-grid">
          <div class="field full"><label>Destination folder</label>
            <select name="folder">${destinations.map(f => `<option>${escapeHtml(f)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Move</button>
        </div>
      </form>
    `, (bd) => {
      qs('#move-to-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const dest = new FormData(ev.target).get('folder');
        let succeeded = 0;
        for (const f of files) {
          try {
            await Store.updateOfficeFile(f.id, { category: dest });
            succeeded++;
          } catch (err) {
            // Keep going -- one failed file shouldn't block the rest of the batch.
          }
        }
        selectedFileIds = new Set();
        toast(succeeded === files.length
          ? `✔ Moved to ${dest}.`
          : `⚠ ${succeeded} of ${files.length} moved — some failed. Try the rest again.`);
        closeModal();
        renderView(main);
      });
    });
  }

  async function pasteClipboardInto(main, targetFolder) {
    if (!clipboard) return;
    const { mode, files } = clipboard;
    let succeeded = 0;
    for (const f of files) {
      try {
        if (mode === 'cut') await Store.updateOfficeFile(f.id, { category: targetFolder });
        else await Store.duplicateOfficeFile(f, targetFolder, currentUserEmail());
        succeeded++;
      } catch (err) {
        // Keep going -- one failed file shouldn't block the rest of the batch.
      }
    }
    const verb = mode === 'cut' ? 'moved' : 'copied';
    toast(succeeded === files.length
      ? `✔ ${succeeded} file${succeeded === 1 ? '' : 's'} ${verb} to ${targetFolder}.`
      : `⚠ ${succeeded} of ${files.length} ${verb} — some failed. Try the rest again.`);
    if (mode === 'cut') clipboard = null; // one-shot, like a real file manager's Cut+Paste
    renderView(main);
  }

  function openFileInfoModal(f) {
    openModal(`
      <h2>File Info</h2>
      <div class="modal-grid">
        <div class="field full"><label>Name</label><div>${escapeHtml(f.fileName)}</div></div>
        <div class="field"><label>Folder</label><div>${escapeHtml(f.category || 'Other')}</div></div>
        <div class="field"><label>Size</label><div>${fmtFileSize(f.fileSize)}</div></div>
        <div class="field"><label>Type</label><div>${escapeHtml(f.mimeType || 'Unknown')}</div></div>
        <div class="field"><label>Uploaded</label><div>${fmtWhen(f.created_at)}</div></div>
        <div class="field"><label>Uploaded by</label><div>${escapeHtml(f.uploadedBy || '—')}</div></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" data-close-modal>Close</button>
      </div>
    `);
  }

  function openRenameFileModal(main, f) {
    const dot = f.fileName.lastIndexOf('.');
    const base = dot > 0 ? f.fileName.slice(0, dot) : f.fileName;
    const ext = dot > 0 ? f.fileName.slice(dot) : '';
    openModal(`
      <h2>Rename File</h2>
      <form id="rename-file-form">
        <div class="modal-grid">
          <div class="field full"><label>File name</label>
            <div style="display:flex; align-items:center; gap:6px;">
              <input name="base" value="${escapeHtml(base)}" required style="flex:1;" />
              ${ext ? `<span class="dim">${escapeHtml(ext)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Rename</button>
        </div>
      </form>
    `, (bd) => {
      qs('#rename-file-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const newBase = new FormData(ev.target).get('base').trim();
        if (!newBase) { toast('Enter a file name.'); return; }
        await Store.updateOfficeFile(f.id, { fileName: newBase + ext });
        toast('✔ File renamed.');
        closeModal();
        renderView(main);
      });
    });
  }

  function renderFolderDetail(main) {
    const rows = Store.listOfficeFiles()
      .filter(f => (f.category || 'Other') === activeFolder)
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    // Drop any selected ids that no longer exist in this folder (deleted elsewhere, or a
    // stale selection from before a refetch) so the "N selected" count is never wrong.
    selectedFileIds = new Set([...selectedFileIds].filter(id => rows.some(f => f.id === id)));
    const selectedCount = selectedFileIds.size;

    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <button type="button" class="link-btn" id="btn-back-folders" style="margin-bottom:6px;">← All Folders</button>
          <h1 class="page-title">📁 ${escapeHtml(activeFolder)}</h1>
          <div class="page-sub">${rows.length} file${rows.length === 1 ? '' : 's'} in this folder.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-delete-folder" ${rows.length || activeFolder === 'Other' ? 'disabled' : ''} title="${activeFolder === 'Other' ? '\'Other\' is the built-in fallback folder and can\'t be deleted' : rows.length ? 'Move or delete every file in this folder first' : 'Delete this empty folder'}">🗑 Delete Folder</button>
          <button class="btn btn-ghost" id="btn-scan-doc">📷 Scan Document</button>
          <button class="btn btn-ghost" id="btn-upload-folder">📁 Upload Folder</button>
          <button class="btn btn-primary" id="btn-upload-doc">+ Upload File</button>
        </div>
      </div>
      <div class="page-sub" style="margin-bottom:8px;">Or drag files (or a whole folder) here, or paste (Ctrl/Cmd+V), to upload straight into this folder.</div>
      ${clipboard ? `
      <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; outline:2px dashed var(--accent); outline-offset:-2px;">
        <span>${clipboard.mode === 'copy' ? '📋' : '✂️'} ${clipboard.files.length} file${clipboard.files.length === 1 ? '' : 's'} ${clipboard.mode === 'copy' ? 'copied' : 'cut'}${clipboard.sourceFolder === activeFolder ? ' — already here' : ', ready to paste'}</span>
        <button class="btn btn-primary btn-sm" id="btn-paste" ${clipboard.sourceFolder === activeFolder ? 'disabled' : ''}>📌 Paste Here</button>
        <button type="button" class="link-btn" id="btn-clear-clipboard">Cancel</button>
      </div>` : ''}
      ${selectedCount ? `
      <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <strong>${selectedCount} selected</strong>
        <button class="btn btn-ghost btn-sm" id="btn-move-selected">📂 Move to...</button>
        <button class="btn btn-ghost btn-sm" id="btn-copy-selected">📋 Copy</button>
        <button class="btn btn-ghost btn-sm" id="btn-cut-selected">✂️ Cut</button>
        <button class="btn btn-danger btn-sm" id="btn-delete-selected">🗑 Delete Selected</button>
        <button type="button" class="link-btn" id="btn-clear-selection">Clear</button>
      </div>` : ''}
      <div class="panel" id="folder-dropzone">
        ${rows.length ? `
        <table>
          <thead><tr>
            <th style="width:32px;"><input type="checkbox" id="chk-select-all" ${rows.every(f => selectedFileIds.has(f.id)) ? 'checked' : ''} /></th>
            <th>File</th><th>Size</th><th>Uploaded</th><th>By</th><th></th>
          </tr></thead>
          <tbody>
            ${rows.map(f => `
              <tr>
                <td><input type="checkbox" data-select-file="${f.id}" ${selectedFileIds.has(f.id) ? 'checked' : ''} /></td>
                <td class="name">${escapeHtml(f.fileName)}</td>
                <td class="dim">${fmtFileSize(f.fileSize)}</td>
                <td class="dim">${fmtWhen(f.created_at)}</td>
                <td class="dim">${escapeHtml(f.uploadedBy || '—')}</td>
                <td>
                  <div class="row-menu-wrap">
                    <button type="button" class="row-menu-btn" data-menu-toggle="${f.id}" title="More actions">⋯</button>
                    <div class="row-menu ${openMenuId === f.id ? '' : 'hidden'}" data-menu="${f.id}">
                      <button type="button" data-view-file="${f.filePath}">View</button>
                      <button type="button" data-info-file="${f.id}">Info</button>
                      <button type="button" data-rename-file="${f.id}">Rename</button>
                      <button type="button" data-move-file="${f.id}">Move to...</button>
                      <button type="button" data-toggle-select="${f.id}">${selectedFileIds.has(f.id) ? 'Deselect' : 'Select'}</button>
                      <button type="button" class="danger" data-delete-file="${f.id}" data-path="${f.filePath}">Delete</button>
                    </div>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No files in this folder yet. Drag files here, paste, or use the buttons above.</div>'}
      </div>
    `;

    qs('#btn-back-folders', main).addEventListener('click', () => { activeFolder = null; selectedFileIds = new Set(); renderView(main); });
    qs('#btn-upload-doc', main).addEventListener('click', () => openUploadModal(main, 'file'));
    qs('#btn-scan-doc', main).addEventListener('click', () => openUploadModal(main, 'scan'));
    qs('#btn-upload-folder', main).addEventListener('click', () => openUploadModal(main, 'folder'));
    const btnDeleteFolder = qs('#btn-delete-folder', main);
    if (btnDeleteFolder && !btnDeleteFolder.disabled) btnDeleteFolder.addEventListener('click', async () => {
      if (!confirm('Delete the "' + activeFolder + '" folder? This cannot be undone.')) return;
      await saveFolders(getFolders().filter(f => f !== activeFolder));
      toast('✔ Folder deleted.');
      activeFolder = null;
      renderView(main);
    });
    qsa('[data-menu-toggle]', main).forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openMenuId = openMenuId === b.dataset.menuToggle ? null : b.dataset.menuToggle;
      renderFolderDetail(main);
    }));
    if (!menuOutsideClickAttached) {
      menuOutsideClickAttached = true;
      // Attached once, document-level -- clicking anywhere outside a "..." menu (including
      // switching folders/tabs) closes whichever one is open. Clicks on the menu's own
      // items are handled by closeAllRowMenus() inside each item's own handler below.
      document.addEventListener('click', (ev) => {
        if (!ev.target.closest('.row-menu-wrap')) closeAllRowMenus();
      });
    }
    qsa('[data-view-file]', main).forEach(b => b.addEventListener('click', async () => {
      closeAllRowMenus();
      const win = window.open('', '_blank');
      const url = await Store.getSignedOfficeFileUrl(b.dataset.viewFile);
      if (url && win) win.location.href = url; else if (win) win.close();
    }));
    qsa('[data-info-file]', main).forEach(b => b.addEventListener('click', () => {
      closeAllRowMenus();
      const f = rows.find(x => x.id === b.dataset.infoFile);
      if (f) openFileInfoModal(f);
    }));
    qsa('[data-rename-file]', main).forEach(b => b.addEventListener('click', () => {
      closeAllRowMenus();
      const f = rows.find(x => x.id === b.dataset.renameFile);
      if (f) openRenameFileModal(main, f);
    }));
    qsa('[data-move-file]', main).forEach(b => b.addEventListener('click', () => {
      closeAllRowMenus();
      const f = rows.find(x => x.id === b.dataset.moveFile);
      if (f) openMoveToModal(main, [f]);
    }));
    qsa('[data-toggle-select]', main).forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.toggleSelect;
      if (selectedFileIds.has(id)) selectedFileIds.delete(id); else selectedFileIds.add(id);
      openMenuId = null;
      renderFolderDetail(main);
    }));
    qsa('[data-delete-file]', main).forEach(b => b.addEventListener('click', async () => {
      closeAllRowMenus();
      if (!confirm('Delete this file? This cannot be undone.')) return;
      await Store.deleteOfficeFile(b.dataset.deleteFile, b.dataset.path);
      toast('✔ File deleted.');
      renderFolderDetail(main);
    }));

    const btnPaste = qs('#btn-paste', main);
    if (btnPaste) btnPaste.addEventListener('click', () => pasteClipboardInto(main, activeFolder));
    const btnClearClipboard = qs('#btn-clear-clipboard', main);
    if (btnClearClipboard) btnClearClipboard.addEventListener('click', () => { clipboard = null; renderFolderDetail(main); });

    const btnMoveSelected = qs('#btn-move-selected', main);
    if (btnMoveSelected) btnMoveSelected.addEventListener('click', () => {
      openMoveToModal(main, rows.filter(f => selectedFileIds.has(f.id)));
    });
    const btnCopySelected = qs('#btn-copy-selected', main);
    if (btnCopySelected) btnCopySelected.addEventListener('click', () => {
      const files = rows.filter(f => selectedFileIds.has(f.id));
      clipboard = { mode: 'copy', sourceFolder: activeFolder, files };
      selectedFileIds = new Set();
      toast(`📋 ${files.length} file${files.length === 1 ? '' : 's'} copied. Open a folder and click Paste Here.`);
      renderFolderDetail(main);
    });
    const btnCutSelected = qs('#btn-cut-selected', main);
    if (btnCutSelected) btnCutSelected.addEventListener('click', () => {
      const files = rows.filter(f => selectedFileIds.has(f.id));
      clipboard = { mode: 'cut', sourceFolder: activeFolder, files };
      selectedFileIds = new Set();
      toast(`✂️ ${files.length} file${files.length === 1 ? '' : 's'} cut. Open a folder and click Paste Here to move ${files.length === 1 ? 'it' : 'them'} there.`);
      renderFolderDetail(main);
    });

    const selectAllCb = qs('#chk-select-all', main);
    if (selectAllCb) selectAllCb.addEventListener('change', () => {
      if (selectAllCb.checked) rows.forEach(f => selectedFileIds.add(f.id));
      else rows.forEach(f => selectedFileIds.delete(f.id));
      renderFolderDetail(main);
    });
    qsa('[data-select-file]', main).forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) selectedFileIds.add(cb.dataset.selectFile);
      else selectedFileIds.delete(cb.dataset.selectFile);
      renderFolderDetail(main);
    }));
    const btnClearSelection = qs('#btn-clear-selection', main);
    if (btnClearSelection) btnClearSelection.addEventListener('click', () => { selectedFileIds = new Set(); renderFolderDetail(main); });
    const btnDeleteSelected = qs('#btn-delete-selected', main);
    if (btnDeleteSelected) btnDeleteSelected.addEventListener('click', async () => {
      const targets = rows.filter(f => selectedFileIds.has(f.id));
      if (!targets.length) return;
      if (!confirm(`Delete ${targets.length} selected file${targets.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
      btnDeleteSelected.disabled = true;
      btnDeleteSelected.textContent = 'Deleting…';
      let succeeded = 0;
      for (const f of targets) {
        try {
          await Store.deleteOfficeFile(f.id, f.filePath);
          succeeded++;
        } catch (err) {
          // Keep going -- one failed delete shouldn't block the rest of the batch.
        }
      }
      selectedFileIds = new Set();
      toast(succeeded === targets.length
        ? `✔ ${succeeded} file${succeeded === 1 ? '' : 's'} deleted.`
        : `⚠ ${succeeded} of ${targets.length} deleted — some failed. Try the rest again.`);
      renderFolderDetail(main);
    });

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
