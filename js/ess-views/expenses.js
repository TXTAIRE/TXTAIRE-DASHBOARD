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
      </div>
      <div id="expense-status" class="ess-sub" style="margin-top:8px;"></div>
      <div id="expense-review-wrap"></div>
      <div class="ess-section-title">My Submitted Expenses</div>
      <div id="expense-history-wrap"></div>
    `;

    qs('#expense-receipt-input', main).addEventListener('change', (ev) => {
      const file = ev.target.files[0];
      if (file) handleReceiptFile(main, emp, file);
    });

    renderHistory(main, emp);
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

  async function handleReceiptFile(main, emp, file) {
    const statusEl = qs('#expense-status', main);
    qs('#expense-review-wrap', main).innerHTML = '';
    statusEl.textContent = 'Preparing photo…';

    let resizedBlob;
    try {
      resizedBlob = await resizeImageToBlob(file, 1600, 0.82);
    } catch (err) {
      statusEl.textContent = 'Could not read that photo — try again.';
      return;
    }

    statusEl.textContent = 'Scanning receipt…';

    // Upload (for the permanent record) and the Gemini scan run at the same time -- the
    // scan doesn't need the photo to already be in storage, so waiting for the upload
    // first would add its time on top of the scan's instead of overlapping them.
    const uploadPromise = Store.uploadReceiptPhoto(resizedBlob, 'receipt.jpg');

    const scanPromise = blobToBase64(resizedBlob).then((base64Data) =>
      sb.auth.getSession().then(({ data: { session } }) =>
        fetch('https://fmgqqrmsxleyeiadnhyd.supabase.co/functions/v1/scan-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
          body: JSON.stringify({ imageBase64: base64Data, mimeType: 'image/jpeg' }),
        }).then(res => res.json().then(json => ({ ok: res.ok, json })))
      )
    );

    const [uploadResult, scanResult] = await Promise.allSettled([uploadPromise, scanPromise]);

    if (uploadResult.status !== 'fulfilled') {
      statusEl.textContent = 'Could not upload the photo — try again.';
      return;
    }
    const receiptPath = uploadResult.value;

    let fields = emptyFields();
    if (scanResult.status === 'fulfilled' && scanResult.value.ok && scanResult.value.json.success) {
      const scanned = scanResult.value.json.fields;
      fields = Object.assign(emptyFields(), scanned, { date: scanned.date || emptyFields().date });
      statusEl.textContent = '✔ Receipt scanned — please check the details below before saving.';
    } else {
      const errMsg = scanResult.status === 'fulfilled' ? (scanResult.value.json.error || 'Could not read that receipt') : 'Could not reach the scanning service';
      statusEl.textContent = errMsg + ' — please fill in the fields manually below.';
    }

    if (fields.vendor) {
      try {
        await loadVendorDirectory();
        applyKnownVendorDetails(fields);
      } catch (err) { /* best-effort -- the scanned/blank values still work fine without this */ }
    }

    renderReviewForm(main, emp, fields, receiptPath);
  }

  // `existing` is the real expenses row when editing a past submission (fields === existing
  // in that case), or omitted when reviewing a fresh scan before its first save.
  function renderReviewForm(main, emp, fields, receiptPath, existing) {
    const wrap = qs('#expense-review-wrap', main);
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
        render(main, emp);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Save Changes' : 'Save Expense';
        toast('Could not save the expense — try again.');
      }
    });
  }

  return { render };
})();
