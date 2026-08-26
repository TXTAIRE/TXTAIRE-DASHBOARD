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
window.EssViews.expenses = (function () {
  const ENTITY_OPTIONS = ['TXTAIRE OPC', 'TXTAIRE REF', 'AVISO'];

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

  async function handleReceiptFile(main, emp, file) {
    const statusEl = qs('#expense-status', main);
    qs('#expense-review-wrap', main).innerHTML = '';
    statusEl.textContent = 'Uploading photo…';

    let receiptPath = null;
    try {
      receiptPath = await Store.uploadReceiptPhoto(file, file.name);
    } catch (err) {
      statusEl.textContent = 'Could not upload the photo — try again.';
      return;
    }

    statusEl.textContent = 'Scanning receipt…';
    let fields = emptyFields();
    try {
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch('https://fmgqqrmsxleyeiadnhyd.supabase.co/functions/v1/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
        body: JSON.stringify({ receiptPath }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        fields = Object.assign(emptyFields(), json.fields, { date: json.fields.date || emptyFields().date });
        statusEl.textContent = '✔ Receipt scanned — please check the details below before saving.';
      } else {
        statusEl.textContent = (json.error || 'Could not read that receipt') + ' — please fill in the fields manually below.';
      }
    } catch (err) {
      statusEl.textContent = 'Could not reach the scanning service — please fill in the fields manually below.';
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
