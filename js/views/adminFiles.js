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
  let selectedFolders = new Set(); // folder names checked on the "All Folders" grid
  // Which column the currently-open folder's file table is sorted by -- click a header to
  // sort by it, click again to flip direction. Defaults to newest-first, matching the
  // fixed sort this table always used before column sorting existed.
  let fileSortKey = 'created_at';
  let fileSortDir = 'desc'; // 'asc' | 'desc'
  // Folder checkboxes stay hidden by default (keeps the grid clean) -- only appear once
  // "Select" is chosen from a folder's right-click menu. Automatically turns back off
  // once nothing is selected, so a stray click doesn't leave checkboxes stuck on.
  let folderSelectMode = false;

  // ---- Watch a local folder for new scans (File System Access API, Chrome/Edge only) ----
  // Lets IJ Scan Utility (or any scanner software) save straight into a fixed folder on
  // this PC, which the dashboard then polls and auto-uploads from -- no manual drag or
  // "+ Upload File" needed per scan. A browser can't be handed a file the instant it's
  // written (no OS-level file-watch event exposed to the web), so this polls every few
  // seconds instead; a file also has to read the same size on two consecutive polls
  // before it's uploaded, so a scan that's still being written is never grabbed mid-save.
  // Only one watch is active at a time, global across the whole Admin Files page (there's
  // realistically one scan folder for the office) -- watchState is null when inactive.
  let watchState = null; // { dirHandle, destinationFolder, seenFiles: Set<string>, candidates: Map<string,number> }
  let watchTimer = null;
  let watchResumeAttempted = false;
  let watchPollInFlight = false; // guards against an overlapping poll if an upload runs long
  const WATCH_POLL_MS = 4000;
  const WATCH_DB_NAME = 'txtaire-fs-handles';
  const WATCH_DB_KEY = 'scanWatch';

  function folderWatchUnsupportedReason() {
    if ('showDirectoryPicker' in window) return null;
    return 'Watching a folder for new scans needs Chrome or Edge on a desktop computer.';
  }

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(WATCH_DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('kv');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function persistWatchState() {
    if (!watchState) { idbSet(WATCH_DB_KEY, null); return; }
    idbSet(WATCH_DB_KEY, {
      dirHandle: watchState.dirHandle,
      destinationFolder: watchState.destinationFolder,
      seenFiles: [...watchState.seenFiles],
    });
  }

  function stopWatching(main) {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = null;
    watchState = null;
    persistWatchState();
    // Safe to call from a direct button click (page is obviously showing) or from the
    // background poll timer (page may have navigated elsewhere since) alike.
    if (main && currentRoute() === 'adminFiles') renderView(main);
  }

  // Walks the watched folder at any depth. Yields one entry per file, with `path` (full
  // relative path -- the stable identity used for dedup, since a filename alone can
  // collide across different client subfolders) and `topFolder` (the first path segment
  // -- e.g. "ABRIO 2026/Invoices/scan.jpg" -> "ABRIO 2026" -- or null for a file sitting
  // directly at the watched root).
  async function* walkWatchedTree(dirHandle, relDir) {
    for await (const [name, handle] of dirHandle.entries()) {
      const relPath = relDir ? relDir + '/' + name : name;
      if (handle.kind === 'file') {
        yield { path: relPath, handle, topFolder: relDir ? relDir.split('/')[0] : null };
      } else if (handle.kind === 'directory') {
        yield* walkWatchedTree(handle, relPath);
      }
    }
  }

  // Client subfolder names (e.g. "ABRIO 2026") rarely match an existing Admin Files
  // folder -- auto-create one, matching the local structure, the same way
  // openNewFolderModal does (case-insensitive check, kept before "Other").
  async function ensureAdminFolderExists(name) {
    const folders = getFolders();
    if (folders.some(f => f.toLowerCase() === name.toLowerCase())) return;
    const otherIndex = folders.findIndex(f => f.toLowerCase() === 'other');
    const updated = otherIndex >= 0 ? [...folders.slice(0, otherIndex), name, ...folders.slice(otherIndex)] : [...folders, name];
    await saveFolders(updated);
  }

  // The stability check described above: a path new to this poll is only recorded as a
  // "candidate" with its current size; it's uploaded on a LATER poll once its size comes
  // back unchanged, meaning the scanner has finished writing it.
  async function pollWatchedFolder(main) {
    if (!watchState || watchPollInFlight) return;
    watchPollInFlight = true;
    try {
      const seenPaths = new Set();
      try {
        for await (const entry of walkWatchedTree(watchState.dirHandle, '')) {
          const { path, handle, topFolder } = entry;
          seenPaths.add(path);
          if (watchState.seenFiles.has(path)) continue;
          const file = await handle.getFile();
          const prevSize = watchState.candidates.get(path);
          if (prevSize === file.size) {
            watchState.candidates.delete(path);
            watchState.seenFiles.add(path);
            persistWatchState();
            const destination = topFolder || watchState.destinationFolder;
            try {
              if (topFolder) await ensureAdminFolderExists(topFolder);
              await Store.uploadOfficeFile(file, destination, currentUserEmail());
              toast(`✔ Auto-uploaded "${file.name}" to ${destination}.`);
              // The watch timer keeps running no matter which page is open (that's the
              // whole point), but #main-content is the one shared container the whole
              // app's router reuses -- only safe to re-render it if Admin Files is still
              // what's showing, or this would silently blow away whatever other page the
              // admin navigated to.
              if (currentRoute() === 'adminFiles' && activeFolder === destination) renderView(main);
            } catch (err) {
              // Leave it marked seen either way -- retrying a failed upload forever on
              // every poll would just spam toasts; the file's still on disk to upload by
              // hand if needed.
            }
          } else {
            watchState.candidates.set(path, file.size);
          }
        }
      } catch (err) {
        // Permission revoked, drive unplugged, folder deleted, etc. -- stop cleanly
        // rather than error-looping every 4 seconds.
        stopWatching(main);
        toast('⚠ Stopped watching for scans — the folder became unavailable.');
        return;
      }
      // Forget candidates for files that disappeared before stabilizing (renamed/deleted
      // before we got to them) so they don't linger in memory forever.
      [...watchState.candidates.keys()].forEach((path) => { if (!seenPaths.has(path)) watchState.candidates.delete(path); });
    } finally {
      watchPollInFlight = false;
    }
  }

  function startWatchingTimer(main) {
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(() => pollWatchedFolder(main), WATCH_POLL_MS);
  }

  async function beginWatch(main, destinationFolder) {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    } catch (err) {
      return; // user cancelled the picker
    }
    watchState = { dirHandle, destinationFolder, seenFiles: new Set(), candidates: new Map() };
    persistWatchState();
    startWatchingTimer(main);
    toast(`👁 Watching "${dirHandle.name}" (including subfolders) — files upload to a matching Admin Files folder per subfolder, or ${destinationFolder} if loose at the top level.`);
    renderView(main);
  }

  // Runs once, the first time this view renders -- resumes a previously-connected watch
  // if the browser still silently grants read access (it often does, within the same
  // browser profile), otherwise leaves it for the "Resume watching" banner to ask for a
  // fresh click (permission can only ever be (re-)granted from a real user gesture).
  async function tryResumeWatch(main) {
    if (watchResumeAttempted) return;
    watchResumeAttempted = true;
    if (folderWatchUnsupportedReason()) return;
    let saved;
    try { saved = await idbGet(WATCH_DB_KEY); } catch (err) { return; }
    if (!saved || !saved.dirHandle) return;
    try {
      const perm = await saved.dirHandle.queryPermission({ mode: 'read' });
      if (perm === 'granted') {
        watchState = { dirHandle: saved.dirHandle, destinationFolder: saved.destinationFolder, seenFiles: new Set(saved.seenFiles || []), candidates: new Map() };
        startWatchingTimer(main);
      } else {
        // Keep the handle around (pendingResume) so the banner can request permission
        // with one click instead of re-running the folder picker from scratch.
        watchState = { pendingResume: true, dirHandle: saved.dirHandle, destinationFolder: saved.destinationFolder, seenFiles: new Set(saved.seenFiles || []), candidates: new Map() };
      }
      // This resolves asynchronously, well after renderView's own synchronous render --
      // by then the admin may have already navigated to a different page on the shared
      // #main-content container, so re-rendering here is only safe if Admin Files is
      // still actually what's on screen.
      if (currentRoute() === 'adminFiles') renderView(main);
    } catch (err) { /* stored handle no longer valid -- ignore, treat as never connected */ }
  }

  async function resumePendingWatch(main) {
    if (!watchState || !watchState.pendingResume) return;
    try {
      const perm = await watchState.dirHandle.requestPermission({ mode: 'read' });
      if (perm !== 'granted') { toast('Access not granted — still not watching.'); return; }
    } catch (err) { toast('Could not resume — pick the folder again.'); watchState = null; renderView(main); return; }
    watchState = { dirHandle: watchState.dirHandle, destinationFolder: watchState.destinationFolder, seenFiles: watchState.seenFiles, candidates: new Map() };
    startWatchingTimer(main);
    toast(`👁 Resumed watching — uploading to ${watchState.destinationFolder}.`);
    renderView(main);
  }

  function watchBannerHtml() {
    const unsupported = folderWatchUnsupportedReason();
    if (unsupported) return '';
    if (watchState && watchState.pendingResume) {
      return `
        <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; outline:2px dashed var(--accent); outline-offset:-2px;">
          <span>👁 Resume watching for new scans → uploads to <strong>${escapeHtml(watchState.destinationFolder)}</strong>?</span>
          <button type="button" class="btn btn-primary btn-sm" id="btn-resume-watch">Resume</button>
          <button type="button" class="link-btn" id="btn-forget-watch">Forget</button>
        </div>`;
    }
    if (watchState) {
      const canRetarget = activeFolder && activeFolder !== watchState.destinationFolder;
      return `
        <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <span>👁 Watching <strong>${escapeHtml(watchState.dirHandle.name)}</strong> (incl. subfolders) — each subfolder auto-creates/uploads to its own matching Admin Files folder; loose top-level files go to <strong>${escapeHtml(watchState.destinationFolder)}</strong></span>
          ${canRetarget ? `<button type="button" class="link-btn" id="btn-retarget-watch">Change top-level destination to "${escapeHtml(activeFolder)}"</button>` : ''}
          <button type="button" class="link-btn" id="btn-stop-watch" style="color:var(--red);">Stop watching</button>
        </div>`;
    }
    return '';
  }

  function wireWatchBanner(main) {
    const resumeBtn = qs('#btn-resume-watch', main);
    if (resumeBtn) resumeBtn.addEventListener('click', () => resumePendingWatch(main));
    const forgetBtn = qs('#btn-forget-watch', main);
    if (forgetBtn) forgetBtn.addEventListener('click', () => stopWatching(main));
    const stopBtn = qs('#btn-stop-watch', main);
    if (stopBtn) stopBtn.addEventListener('click', () => stopWatching(main));
    const retargetBtn = qs('#btn-retarget-watch', main);
    if (retargetBtn) retargetBtn.addEventListener('click', () => {
      watchState.destinationFolder = activeFolder;
      persistWatchState();
      renderView(main);
    });
  }
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

  // ---- Generic right-click context menu -- same actions as the existing "..." buttons,
  // just reachable faster via right-click too (folder cards on the grid, file rows in a
  // folder). items: [{ label, danger, onClick }]. Only one open at a time; closes on any
  // outside click, matching the "..." row-menu's own behavior.
  let contextMenuEl = null;
  function closeContextMenu() {
    if (contextMenuEl) { contextMenuEl.remove(); contextMenuEl = null; }
  }
  function showContextMenu(x, y, items) {
    closeAllRowMenus();
    closeContextMenu();
    const menu = document.createElement('div');
    menu.className = 'row-menu context-menu';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = items.map((it, i) => `<button type="button" data-idx="${i}" class="${it.danger ? 'danger' : ''}">${escapeHtml(it.label)}</button>`).join('');
    document.body.appendChild(menu);
    contextMenuEl = menu;
    qsa('button[data-idx]', menu).forEach((btn) => {
      btn.addEventListener('click', () => {
        const it = items[Number(btn.dataset.idx)];
        closeContextMenu();
        if (it.onClick) it.onClick();
      });
    });
    // Nudge back on-screen if the cursor was near the right/bottom edge.
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = Math.max(4, window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = Math.max(4, window.innerHeight - rect.height - 8) + 'px';
  }
  // Closes on a later left click anywhere. Deliberately NOT also closing on a later
  // contextmenu event: the very right-click that OPENS a menu always bubbles up to
  // document too, with ev.target still the row/card that was clicked (never inside the
  // menu, since it didn't exist yet when the event started) -- listening for
  // 'contextmenu' here would immediately close every menu the instant it opens. Right-
  // clicking a DIFFERENT row/card while one is already open still works correctly, since
  // showContextMenu() itself closes the previous one before opening the next.
  document.addEventListener('click', closeContextMenu);

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

  // Sortable columns for the file table inside an open folder.
  const FILE_SORT_COLUMNS = [
    { key: 'fileName', label: 'File' },
    { key: 'fileSize', label: 'Size' },
    { key: 'created_at', label: 'Uploaded' },
    { key: 'uploadedBy', label: 'By' },
  ];
  function compareFiles(a, b, key) {
    if (key === 'fileSize') return (a.fileSize || 0) - (b.fileSize || 0);
    if (key === 'created_at') return (a.created_at || '').localeCompare(b.created_at || '');
    return (a[key] || '').toLowerCase().localeCompare((b[key] || '').toLowerCase());
  }
  function sortedFileRows(rows) {
    const sorted = [...rows].sort((a, b) => compareFiles(a, b, fileSortKey));
    return fileSortDir === 'desc' ? sorted.reverse() : sorted;
  }

  function renderView(main) {
    tryResumeWatch(main);
    if (activeFolder) renderFolderDetail(main);
    else renderFolderGrid(main);
  }

  function renderFolderGrid(main) {
    const all = Store.listOfficeFiles();
    const folders = getFolders();
    // Drop any selected names that no longer exist (renamed/deleted elsewhere) so the
    // "N selected" count is never stale.
    selectedFolders = new Set([...selectedFolders].filter(f => folders.includes(f)));
    if (!selectedFolders.size) folderSelectMode = false;
    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Admin Files</h1>
          <div class="page-sub">Company document library, organized by folder. Open a folder to upload a file or scan one straight from this device, or upload a whole exported folder below and it'll sort itself into the matching folders. Right-click a folder for quick actions.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-new-folder">+ New Folder</button>
          <button class="btn btn-ghost" id="btn-upload-folder-autosort">📁 Upload Folder (auto-sort)</button>
        </div>
      </div>
      ${watchBannerHtml()}
      ${selectedFolders.size ? `
      <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <strong>${selectedFolders.size} folder${selectedFolders.size === 1 ? '' : 's'} selected</strong>
        <button class="btn btn-danger btn-sm" id="btn-delete-selected-folders">🗑 Delete Selected</button>
        <button type="button" class="link-btn" id="btn-clear-folder-selection">Clear</button>
      </div>` : ''}
      <div class="page-sub" style="margin-bottom:8px;">Or drag a folder from your computer here — if it has subfolders named after these categories (e.g. "HR", "Billing Invoice"), each file sorts into the matching one automatically; anything else goes to Other.</div>
      <div class="file-folder-grid" id="folder-grid-dropzone">
        ${folders.map(f => {
          const count = all.filter(x => (x.category || 'Other') === f).length;
          const isOther = f.toLowerCase() === 'other';
          return `
            <div class="file-folder-card" data-folder-card="${escapeHtml(f)}">
              ${folderSelectMode ? `<input type="checkbox" class="file-folder-select" data-folder-select="${escapeHtml(f)}" ${selectedFolders.has(f) ? 'checked' : ''} ${isOther ? 'disabled title="The Other folder can\'t be deleted"' : 'title="Select folder"'} />` : ''}
              ${!isOther ? `<button type="button" class="file-folder-rename-btn" data-folder-rename="${escapeHtml(f)}" title="Rename folder">✏️</button>` : ''}
              <button type="button" class="file-folder-open" data-folder="${escapeHtml(f)}">
                <div class="file-folder-icon">📁</div>
                <div class="file-folder-name">${escapeHtml(f)}</div>
                <div class="file-folder-count">${count} file${count === 1 ? '' : 's'}</div>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;
    qs('#btn-new-folder', main).addEventListener('click', () => openNewFolderModal(main));
    qsa('[data-folder]', main).forEach(b => {
      b.addEventListener('click', () => { activeFolder = b.dataset.folder; selectedFileIds = new Set(); renderView(main); });
    });
    qsa('[data-folder-select]', main).forEach(cb => {
      cb.addEventListener('click', (ev) => ev.stopPropagation());
      cb.addEventListener('change', () => {
        const name = cb.dataset.folderSelect;
        if (cb.checked) selectedFolders.add(name); else selectedFolders.delete(name);
        if (!selectedFolders.size) folderSelectMode = false;
        renderFolderGrid(main);
      });
    });
    qsa('[data-folder-rename]', main).forEach(b => b.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openRenameFolderModal(main, b.dataset.folderRename);
    }));
    const btnDeleteSelectedFolders = qs('#btn-delete-selected-folders', main);
    if (btnDeleteSelectedFolders) btnDeleteSelectedFolders.addEventListener('click', () => deleteSelectedFolders(main));
    const btnClearFolderSelection = qs('#btn-clear-folder-selection', main);
    if (btnClearFolderSelection) btnClearFolderSelection.addEventListener('click', () => { selectedFolders = new Set(); folderSelectMode = false; renderFolderGrid(main); });

    qsa('[data-folder-card]', main).forEach(card => {
      const folderName = card.dataset.folderCard;
      // Drop files straight onto a folder card to upload into it without opening it first
      // -- same drag-and-drop convention as dropping files onto a folder in File Explorer.
      // stopPropagation so this doesn't also trigger the grid's own auto-sort dropzone below.
      card.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.stopPropagation(); card.classList.add('drag-over'); });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        card.classList.remove('drag-over');
        const files = await filesFromDataTransfer(ev.dataTransfer);
        if (!files.length) return;
        toast(`Uploading ${files.length} file${files.length === 1 ? '' : 's'} to ${folderName}…`);
        const succeeded = await uploadBatch(files, folderName);
        reportBatchResult(succeeded, files.length);
        if (activeFolder === null) renderView(main); // still on the grid -- refresh counts
      });
      card.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        const items = [
          { label: 'Open', onClick: () => { activeFolder = folderName; selectedFileIds = new Set(); renderView(main); } },
        ];
        if (folderName.toLowerCase() !== 'other') {
          items.push({ label: 'Rename', onClick: () => openRenameFolderModal(main, folderName) });
          // Turns on the checkboxes (hidden the rest of the time to keep the grid clean)
          // and pre-selects this folder, matching how right-click "Select" behaves in a
          // real file manager -- from here more folders can be checked before deleting.
          items.push({ label: 'Select', onClick: () => {
            folderSelectMode = true;
            selectedFolders.add(folderName);
            renderFolderGrid(main);
          } });
          items.push({ label: 'Delete', danger: true, onClick: () => { selectedFolders = new Set([folderName]); deleteSelectedFolders(main); } });
        }
        showContextMenu(ev.clientX, ev.clientY, items);
      });
    });

    qs('#btn-upload-folder-autosort', main).addEventListener('click', () => openUploadFolderAutoSortModal(main));
    wireWatchBanner(main);
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

  // Renaming a folder is really renaming every file's category to match -- "folder" is
  // just a label on officeFiles rows (see the module comment up top), so nothing would
  // point at the new name otherwise and every file inside would silently vanish from view.
  function openRenameFolderModal(main, oldName) {
    openModal(`
      <h2>Rename Folder</h2>
      <form id="rename-folder-form">
        <div class="modal-grid">
          <div class="field full"><label>Folder name</label><input name="name" value="${escapeHtml(oldName)}" required maxlength="60" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Rename</button>
        </div>
      </form>
    `, (bd) => {
      qs('#rename-folder-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const newName = new FormData(ev.target).get('name').trim();
        if (!newName || newName === oldName) { closeModal(); return; }
        const folders = getFolders();
        if (folders.some(f => f.toLowerCase() === newName.toLowerCase() && f.toLowerCase() !== oldName.toLowerCase())) {
          toast('A folder with that name already exists.');
          return;
        }
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Renaming…';
        await saveFolders(folders.map(f => (f === oldName ? newName : f)));
        const affected = Store.listOfficeFiles().filter(x => (x.category || 'Other') === oldName);
        for (const file of affected) {
          try { await Store.updateOfficeFile(file.id, { category: newName }); } catch (err) { /* keep going -- one failed file shouldn't block the rest */ }
        }
        if (activeFolder === oldName) activeFolder = newName;
        toast(`✔ Renamed to "${newName}"${affected.length ? ` (${affected.length} file${affected.length === 1 ? '' : 's'} moved with it)` : ''}.`);
        closeModal();
        renderView(main);
      });
    });
  }

  // Bulk delete from the "All Folders" grid -- deliberately more capable than the single
  // "Delete Folder" button inside a folder (which stays empty-only, unchanged): this one
  // deletes the files inside too, since the actual use case (clearing out folders that
  // came from test scans, a bad auto-sort, etc.) usually isn't empty. Always confirms with
  // an exact count first since this can't be undone.
  async function deleteSelectedFolders(main) {
    const names = [...selectedFolders].filter(f => f.toLowerCase() !== 'other');
    if (!names.length) return;
    const all = Store.listOfficeFiles();
    const filesByFolder = names.map(name => ({ name, files: all.filter(x => (x.category || 'Other') === name) }));
    const totalFiles = filesByFolder.reduce((s, f) => s + f.files.length, 0);
    const msg = totalFiles
      ? `Delete ${names.length} folder${names.length === 1 ? '' : 's'} AND all ${totalFiles} file${totalFiles === 1 ? '' : 's'} inside ${names.length === 1 ? 'it' : 'them'}? This cannot be undone.`
      : `Delete ${names.length} empty folder${names.length === 1 ? '' : 's'}? This cannot be undone.`;
    if (!confirm(msg)) return;

    for (const { files } of filesByFolder) {
      for (const f of files) {
        try { await Store.deleteOfficeFile(f.id, f.filePath); } catch (err) { /* keep going -- one failed delete shouldn't block the rest */ }
      }
    }
    await saveFolders(getFolders().filter(f => !names.includes(f)));
    if (names.includes(activeFolder)) activeFolder = null;
    selectedFolders = new Set();
    toast(`✔ Deleted ${names.length} folder${names.length === 1 ? '' : 's'}${totalFiles ? ` and ${totalFiles} file${totalFiles === 1 ? '' : 's'}` : ''}.`);
    renderView(main);
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
    const rows = sortedFileRows(Store.listOfficeFiles().filter(f => (f.category || 'Other') === activeFolder));
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
          ${!watchState || watchState.pendingResume ? `<button class="btn btn-ghost" id="btn-start-watch" ${folderWatchUnsupportedReason() ? 'disabled' : ''} title="${folderWatchUnsupportedReason() || 'Auto-upload new files a scanner saves into a folder on this PC -- subfolders (e.g. per client) each become their own matching Admin Files folder automatically'}">📡 Watch for new scans</button>` : ''}
          <button class="btn btn-ghost" id="btn-scan-doc">📷 Scan Document</button>
          <button class="btn btn-ghost" id="btn-upload-folder">📁 Upload Folder</button>
          <button class="btn btn-primary" id="btn-upload-doc">+ Upload File</button>
        </div>
      </div>
      ${watchBannerHtml()}
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
            ${FILE_SORT_COLUMNS.map(c => `<th class="sortable-th" data-sort-key="${c.key}" title="Sort by ${c.label}">${c.label}${fileSortKey === c.key ? (fileSortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>`).join('')}
            <th></th>
          </tr></thead>
          <tbody>
            ${rows.map(f => `
              <tr data-file-row="${f.id}">
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

    qsa('[data-sort-key]', main).forEach(th => th.addEventListener('click', () => {
      const key = th.dataset.sortKey;
      if (fileSortKey === key) fileSortDir = fileSortDir === 'asc' ? 'desc' : 'asc';
      else { fileSortKey = key; fileSortDir = key === 'created_at' ? 'desc' : 'asc'; }
      renderFolderDetail(main);
    }));
    qs('#btn-back-folders', main).addEventListener('click', () => { activeFolder = null; selectedFileIds = new Set(); renderView(main); });
    qs('#btn-upload-doc', main).addEventListener('click', () => openUploadModal(main, 'file'));
    qs('#btn-scan-doc', main).addEventListener('click', () => openUploadModal(main, 'scan'));
    qs('#btn-upload-folder', main).addEventListener('click', () => openUploadModal(main, 'folder'));
    const btnStartWatch = qs('#btn-start-watch', main);
    if (btnStartWatch && !btnStartWatch.disabled) btnStartWatch.addEventListener('click', () => beginWatch(main, activeFolder));
    wireWatchBanner(main);
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

    // Right-click a file row -- same actions as its "..." menu, just reachable faster.
    qsa('[data-file-row]', main).forEach(tr => tr.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const f = rows.find(x => x.id === tr.dataset.fileRow);
      if (!f) return;
      showContextMenu(ev.clientX, ev.clientY, [
        { label: 'View', onClick: async () => {
          const win = window.open('', '_blank');
          const url = await Store.getSignedOfficeFileUrl(f.filePath);
          if (url && win) win.location.href = url; else if (win) win.close();
        } },
        { label: 'Info', onClick: () => openFileInfoModal(f) },
        { label: 'Rename', onClick: () => openRenameFileModal(main, f) },
        { label: 'Move to...', onClick: () => openMoveToModal(main, [f]) },
        { label: selectedFileIds.has(f.id) ? 'Deselect' : 'Select', onClick: () => {
          if (selectedFileIds.has(f.id)) selectedFileIds.delete(f.id); else selectedFileIds.add(f.id);
          renderFolderDetail(main);
        } },
        { label: 'Delete', danger: true, onClick: async () => {
          if (!confirm('Delete this file? This cannot be undone.')) return;
          await Store.deleteOfficeFile(f.id, f.filePath);
          toast('✔ File deleted.');
          renderFolderDetail(main);
        } },
      ]);
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
