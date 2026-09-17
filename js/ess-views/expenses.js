// "Add Expense" via receipt scanning -- opt-in per employee (myEmployee.canEncodeExpenses,
// js/ess-app.js hides the nav tab entirely unless it's set). Takes a photo/upload of a
// receipt, sends it to the scan-receipt Edge Function (Gemini vision API) to extract the
// fields, then shows them in an editable review form -- nothing saves until the employee
// confirms, since OCR can misread an amount or vendor name and this is real accounting
// data. Saving goes through the exact same Store.addExpense() the admin Finance tab uses,
// so it appears there and syncs to the Google Sheet automatically, with no separate code
// path to maintain. Also shows a "My Submitted Expenses" history list (own submissions
// only, scoped server-side via RLS on expenses.submittedByEmployeeId -- see
// supabase/schema.sql) with Edit/Delete, going through the same Store.updateExpense()/
// deleteExpense() the admin Finance tab uses, so Google Sheets sync fires the same way.
//
// A repeat vendor's TIN and location don't change between visits -- only the amount does
// -- so instead of trusting OCR to re-read the same fine print correctly every single
// time, a scanned vendor name is checked against two sources (in order) before falling
// back to whatever the scan itself read: (1) the admin-maintained "vendorDirectory" table
// (supabase/schema.sql), and (2) this employee's own past submissions for that vendor.
window.EssViews.expenses = (function () {
  const ENTITY_OPTIONS = ['TXTAIRE OPC', 'TXTAIRE REF', 'AVISO'];
  // admin-portal.html is a standalone satellite page (js/admin-portal.js) -- unlike the
  // main dashboard/My Portal, it never wires Store.onRemoteChange, so nothing here
  // re-renders on its own when a receipt/expense changes elsewhere (another encoder's
  // submission, an admin edit, etc.). A silent background auto-refresh would be easy to
  // miss entirely on a page someone's actively scanning receipts on, so this is
  // deliberately a visible control instead: a "last updated" timestamp plus a manual
  // Refresh button, backed by a real network refetch (not just a re-paint of whatever's
  // already cached) so clicking it actually means something.
  const HISTORY_AUTO_REFRESH_MS = 30000;
  let historyRefreshTimer = null;

  let vendorDirectory = null;
  async function loadVendorDirectory() {
    if (vendorDirectory) return vendorDirectory;
    const { data, error } = await sb.from('vendorDirectory').select('*');
    vendorDirectory = error ? [] : (data || []);
    return vendorDirectory;
  }

  function normalizeVendor(v) {
    // Any run of non-alphanumeric characters (hyphens, dots, extra spaces) becomes a single
    // space, so "7-ELEVEN" and "7 ELEVEN" -- same vendor, different punctuation -- match.
    return (v || '').toString().toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  }

  // Applies known TIN/location for a vendor onto freshly-scanned fields, in place --
  // directory match wins over the employee's own history, and either only fills in a
  // field the scan left blank/wrong, never overrides a field the directory doesn't have.
  function applyKnownVendorDetails(fields) {
    const norm = normalizeVendor(fields.vendor);
    if (!norm) return;

    const dirMatch = (vendorDirectory || []).find(v => normalizeVendor(v.vendorName) === norm);
    if (dirMatch) {
      if (dirMatch.tinNumber) fields.tinNumber = dirMatch.tinNumber;
      if (dirMatch.location) fields.location = dirMatch.location;
      return;
    }

    const ownMatch = Store.listExpenses()
      .filter(r => normalizeVendor(r.vendor) === norm)
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))) [0];
    if (ownMatch) {
      if (!fields.tinNumber && ownMatch.tinNumber) fields.tinNumber = ownMatch.tinNumber;
      if (!fields.location && ownMatch.location) fields.location = ownMatch.location;
    }
  }

  function emptyFields() {
    return { date: todayISO(), invoiceNumber: '', vendor: '', tinNumber: '', location: '', category: '', amount: '', entity: ENTITY_OPTIONS[0] };
  }

  function render(main, emp) {
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">${t('title_expenses')}</div>
      <div class="ess-sub" style="margin-bottom:12px;">Take a photo of a receipt, or upload one — the details below will be filled in for you to check before saving.</div>
      <div class="ess-card">
        <div class="ess-card-label">Receipt Photo</div>
        <input type="file" id="expense-receipt-input" accept="image/*" capture="environment" />
        <div class="ess-sub" style="margin:8px 0;">Have a stack of receipts? Shoot them all first with your phone's own camera app (no waiting between shots), then add them here all at once:</div>
        <input type="file" id="expense-receipt-batch-input" accept="image/*" multiple />
      </div>
      <div id="expense-status" class="ess-sub" style="margin-top:8px;"></div>
      <div id="expense-review-wrap"></div>
      <div class="ess-section-title" style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
        <span>My Submitted Expenses</span>
        <span style="display:flex; align-items:center; gap:8px; font-weight:400;">
          <span id="expense-history-updated" class="ess-sub" style="font-size:11px;"></span>
          <button type="button" class="link-btn" id="btn-refresh-history">🔄 Refresh</button>
        </span>
      </div>
      <div id="expense-history-wrap"></div>
    `;

    qs('#expense-receipt-input', main).addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      ev.target.value = '';
      if (file) handleReceiptFile(main, emp, file);
    });
    qs('#expense-receipt-batch-input', main).addEventListener('change', (ev) => {
      const files = [...ev.target.files];
      ev.target.value = '';
      if (files.length) handleReceiptFiles(main, emp, files);
    });

    qs('#btn-refresh-history', main).addEventListener('click', () => refreshHistory(main, emp, true));

    // Re-renders every 30s so a change made elsewhere (another encoder's submission, an
    // admin edit/delete) shows up without anyone having to think to click Refresh -- still
    // visible, not silent, since the "Updated ..." timestamp moves and the list itself
    // visibly redraws. Only one interval ever runs at a time: render() is only called once
    // per page load (js/admin-portal.js's bootAdminPortal), so there's nothing to leak.
    if (historyRefreshTimer) clearInterval(historyRefreshTimer);
    historyRefreshTimer = setInterval(() => refreshHistory(main, emp, true), HISTORY_AUTO_REFRESH_MS);

    refreshHistory(main, emp, false);
  }

  // fromNetwork: true does a real refetch (manual click, or the 30s timer) so "Refresh"
  // actually means something over the network, not just a re-paint of whatever's already
  // cached; false (the initial render) skips it since Store.init() just loaded everything
  // fresh moments ago.
  async function refreshHistory(main, emp, fromNetwork) {
    if (fromNetwork) {
      try { await Store.refetchExpenses(); } catch (err) { /* keep showing whatever's already cached */ }
    }
    renderHistory(main, emp);
    const updatedEl = qs('#expense-history-updated', main);
    if (updatedEl) updatedEl.textContent = 'Updated ' + new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  function renderHistory(main, emp) {
    const wrap = qs('#expense-history-wrap', main);
    const rows = Store.listExpenses().slice().sort((a, b) => {
      return (b.date || '').localeCompare(a.date || '') || String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    if (!rows.length) {
      wrap.innerHTML = '<div class="ess-sub">No expenses submitted yet.</div>';
      return;
    }

    wrap.innerHTML = rows.map((r) => `
      <div class="ess-card" style="margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div>
            <div style="font-weight:700;">${escapeHtml(r.vendor || '(no vendor)')}</div>
            <div class="ess-sub">${escapeHtml(r.date || '')} · ${escapeHtml(r.category || '')}</div>
          </div>
          <div style="font-weight:700; white-space:nowrap;">₱${Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div style="display:flex; gap:16px; margin-top:8px;">
          <button type="button" class="link-btn" data-edit-expense="${r.id}">Edit</button>
          <button type="button" class="link-btn" data-delete-expense="${r.id}" style="color:var(--red, #dc2626);">Delete</button>
        </div>
      </div>
    `).join('');

    qsa('[data-edit-expense]', wrap).forEach((b) => b.addEventListener('click', () => {
      const row = Store.getExpense(b.dataset.editExpense);
      if (row) renderReviewForm(main, emp, row, row.receiptPath, row);
    }));

    qsa('[data-delete-expense]', wrap).forEach((b) => b.addEventListener('click', async () => {
      const row = Store.getExpense(b.dataset.deleteExpense);
      if (!row) return;
      const ok = confirm('Delete this expense (' + row.vendor + ', ₱' + Number(row.amount || 0).toLocaleString() + ')? This cannot be undone.');
      if (!ok) return;
      try {
        if (row.receiptPath) await Store.deleteReceiptPhoto(row.receiptPath);
        await Store.deleteExpense(row.id);
        toast('✔ Expense deleted.');
        renderHistory(main, emp);
      } catch (err) {
        toast('Could not delete the expense — try again.');
      }
    }));
  }

  // Phone camera photos are often 3-8MB -- resizing before sending anywhere cuts both the
  // upload time and how long the vision model takes to process it. Uses canvas.toBlob
  // (not canvas.toDataURL + fetch(dataUrl)) since converting a data: URL back to a Blob
  // via fetch() ran into trouble under this app's Content-Security-Policy on some mobile
  // browsers -- canvas.toBlob and FileReader are both purely local, no network step, so
  // CSP's connect-src can't affect either one.
  function resizeImageToBlob(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let width = img.naturalWidth;
          let height = img.naturalHeight;
          if (width > maxDim || height > maxDim) {
            if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
            else { width = Math.round(width * (maxDim / height)); height = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob); else reject(new Error('Could not process image'));
          }, 'image/jpeg', quality);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
      reader.readAsDataURL(blob);
    });
  }

  async function scanReceiptOnce(base64Data, mimeType) {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch('https://fmgqqrmsxleyeiadnhyd.supabase.co/functions/v1/scan-receipt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
      body: JSON.stringify({ imageBase64: base64Data, mimeType }),
    });
    const json = await res.json();
    return { ok: res.ok, json };
  }

  // Retries as separate, fresh function calls (not a loop inside one call) -- Gemini's
  // free tier occasionally returns a transient "busy" error (see scan-receipt/index.ts),
  // and each fresh call gets its own execution-time budget instead of stacking delays
  // inside a single one, which previously got the function killed by the platform itself.
  async function scanReceiptWithRetry(base64Data, mimeType, statusEl) {
    const maxAttempts = 3;
    let result;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      result = await scanReceiptOnce(base64Data, mimeType);
      if (result.ok || !result.json || !result.json.retryable || attempt === maxAttempts) {
        return result;
      }
      statusEl.textContent = 'Scanning service is busy — retrying (' + (attempt + 1) + '/' + maxAttempts + ')…';
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
    return result;
  }

  // Shared by both the single-shot and batch flows below -- uploads (for the permanent
  // record) and scans a receipt photo at the same time, since the scan doesn't need the
  // photo already in storage, so waiting for the upload first would add its time on top of
  // the scan's instead of overlapping them. `onStatus(text)` reports progress back to
  // whichever status element the caller is showing (a shared one for a single photo, a
  // per-item one when processing a batch).
  async function scanOneReceipt(file, onStatus) {
    onStatus('Preparing photo…');
    let resizedBlob;
    try {
      resizedBlob = await resizeImageToBlob(file, 1600, 0.82);
    } catch (err) {
      return { fields: emptyFields(), receiptPath: null, statusHtml: 'Could not read that photo — try again.', failed: true };
    }

    onStatus('Scanning receipt…');
    const uploadPromise = Store.uploadReceiptPhoto(resizedBlob, 'receipt.jpg');
    const scanPromise = blobToBase64(resizedBlob).then((base64Data) =>
      scanReceiptWithRetry(base64Data, 'image/jpeg', { set textContent(v) { onStatus(v); } })
    );
    const [uploadResult, scanResult] = await Promise.allSettled([uploadPromise, scanPromise]);

    if (uploadResult.status !== 'fulfilled') {
      return { fields: emptyFields(), receiptPath: null, statusHtml: 'Could not upload the photo — try again.', failed: true };
    }
    const receiptPath = uploadResult.value;

    let fields = emptyFields();
    let statusHtml;
    if (scanResult.status === 'fulfilled' && scanResult.value.ok && scanResult.value.json.success) {
      const scanned = scanResult.value.json.fields;
      fields = Object.assign(emptyFields(), scanned, { date: scanned.date || emptyFields().date });
      // The API call itself can succeed while genuinely extracting nothing (a blurry/dark
      // photo, or the vision model just not finding anything on it) -- vendor blank AND no
      // amount is a real receipt failing to be read, not a receipt with no vendor or a free
      // item. Showing the same green "✔ Receipt scanned" message in that case looked like a
      // false success -- the form was blank with nothing telling the encoder WHY, so
      // re-taking the exact same photo kept "succeeding" empty over and over with no signal
      // that repeating it wasn't going to help.
      if (!fields.vendor && !fields.amount) {
        statusHtml = '<strong style="color:var(--red, #dc2626);">⚠️ Couldn\'t read any details from this photo.</strong> Try a closer, well-lit, non-blurry shot with the receipt filling the frame — or fill in the fields below manually.';
      } else {
        statusHtml = '✔ Receipt scanned — please check the details below before saving.';
      }
    } else {
      const errMsg = scanResult.status === 'fulfilled' ? (scanResult.value.json.error || 'Could not read that receipt') : 'Could not reach the scanning service';
      statusHtml = errMsg + ' — please fill in the fields manually below.';
    }

    if (fields.vendor) {
      try {
        await loadVendorDirectory();
        applyKnownVendorDetails(fields);
      } catch (err) { /* best-effort -- the scanned/blank values still work fine without this */ }
    }

    return { fields, receiptPath, statusHtml, failed: false };
  }

  async function handleReceiptFile(main, emp, file) {
    const statusEl = qs('#expense-status', main);
    qs('#expense-review-wrap', main).innerHTML = '';
    const result = await scanOneReceipt(file, (text) => { statusEl.textContent = text; });
    statusEl.innerHTML = result.statusHtml;
    renderReviewForm(main, emp, result.fields, result.receiptPath);
  }

  // Processes a batch of already-taken photos one at a time (not in parallel -- keeps the
  // per-item progress readable and avoids bursting the scan-receipt function with
  // simultaneous requests), appending a review card for each as soon as it's done rather
  // than waiting for the whole batch -- the encoder can start reviewing/saving the first
  // ones while later ones are still scanning. This is the actual point of "batch add from
  // gallery": all the photo-taking happens up front, at normal camera-app speed with no
  // per-shot waiting, and the scanning/reviewing happens afterward as one pass instead of
  // being interleaved with it.
  async function handleReceiptFiles(main, emp, files) {
    const statusEl = qs('#expense-status', main);
    const wrap = qs('#expense-review-wrap', main);
    for (let i = 0; i < files.length; i++) {
      const itemEl = document.createElement('div');
      wrap.appendChild(itemEl);
      const progressPrefix = 'Photo ' + (i + 1) + ' of ' + files.length + ': ';
      statusEl.textContent = progressPrefix + 'Preparing…';
      const result = await scanOneReceipt(files[i], (text) => { statusEl.textContent = progressPrefix + text; });
      renderReviewForm(main, emp, result.fields, result.receiptPath, null, itemEl);
      const noticeEl = document.createElement('div');
      noticeEl.className = 'ess-sub';
      noticeEl.style.marginTop = '-4px';
      noticeEl.style.marginBottom = '10px';
      noticeEl.innerHTML = result.statusHtml;
      itemEl.insertBefore(noticeEl, itemEl.firstChild);
    }
    statusEl.textContent = '✔ Done — ' + files.length + ' photo' + (files.length > 1 ? 's' : '') + ' processed. Review each below before saving.';
  }

  // `existing` is the real expenses row when editing a past submission (fields === existing
  // in that case), or omitted when reviewing a fresh scan before its first save.
  // `targetEl`, when given, renders into that specific element instead of the shared
  // #expense-review-wrap -- used by the batch flow above so multiple review cards can
  // coexist side by side, each independently editable/savable, instead of one replacing
  // another. All lookups below are scoped to whichever container is actually in play, so
  // the (duplicate, one per card) #expense-review-form id inside each one never collides
  // with another card's.
  function renderReviewForm(main, emp, fields, receiptPath, existing, targetEl) {
    const wrap = targetEl || qs('#expense-review-wrap', main);
    const isEdit = !!existing;
    const entity = fields.entity || ENTITY_OPTIONS[0];

    wrap.innerHTML = `
      <form id="expense-review-form" class="ess-card" style="margin-top:12px; display:flex; flex-direction:column; gap:10px;">
        ${isEdit ? '<div class="ess-section-title" style="margin-top:0;">Edit Expense</div>' : ''}
        <div class="field"><label>Date Issued</label><input type="date" name="date" value="${escapeHtml(fields.date)}" required /></div>
        <div class="field"><label>Entity</label>
          <select name="entity">${ENTITY_OPTIONS.map(v => `<option${v === entity ? ' selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Vendor Name</label><input name="vendor" value="${escapeHtml(fields.vendor)}" required /></div>
        <div class="field"><label>Service/Sales Invoice Number</label><input name="invoiceNumber" value="${escapeHtml(fields.invoiceNumber)}" /></div>
        <div class="field"><label>TIN Number</label><input name="tinNumber" value="${escapeHtml(fields.tinNumber)}" placeholder="e.g. 237-683-535-00000" /></div>
        <div class="field"><label>Location</label><input name="location" value="${escapeHtml(fields.location)}" placeholder="e.g. QUEZON CITY, NCR" /></div>
        <div class="field"><label>Particulars</label><input name="category" value="${escapeHtml(fields.category)}" required placeholder="e.g. MATERIALS" /></div>
        <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${escapeHtml(String(fields.amount || ''))}" required /></div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">${isEdit ? 'Save Changes' : 'Save Expense'}</button>
        ${isEdit ? '<button type="button" id="expense-edit-cancel" class="btn btn-ghost" style="width:100%; justify-content:center;">Cancel</button>' : ''}
      </form>
    `;

    if (isEdit) {
      qs('#expense-edit-cancel', wrap).addEventListener('click', () => { wrap.innerHTML = ''; });
    }

    qs('#expense-review-form', wrap).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const submitBtn = qs('button[type="submit"]', wrap);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';

      const payload = {
        date: fd.get('date'),
        entity: fd.get('entity'),
        vendor: fd.get('vendor').trim(),
        invoiceNumber: fd.get('invoiceNumber').trim(),
        tinNumber: fd.get('tinNumber').trim(),
        location: fd.get('location').trim(),
        category: fd.get('category').trim(),
        amount: Number(fd.get('amount')) || 0,
      };

      try {
        if (isEdit) {
          await Store.updateExpense(existing.id, payload);
          toast('✔ Expense updated.');
        } else {
          await Store.addExpense(Object.assign({}, payload, {
            description: '', receiptPath, enteredBy: emp.name, submittedByEmployeeId: emp.id,
          }));
          toast('✔ Expense saved.');
        }
        // A full render(main, emp) would wipe #expense-review-wrap entirely -- fine for the
        // single-shot/edit flow (nothing else is in there), but a batch review can have
        // several OTHER still-unsaved cards sitting alongside this one. When this is a
        // batch card (targetEl was passed in), only remove this one card and refresh the
        // history list -- everything else pending stays exactly as the encoder left it.
        if (targetEl) {
          targetEl.remove();
          refreshHistory(main, emp, true);
        } else {
          render(main, emp);
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Save Expense';
        toast('Could not save the expense — try again.');
      }
    });
  }

  return { render };
})();
