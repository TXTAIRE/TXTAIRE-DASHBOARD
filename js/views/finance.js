window.Views.finance = (function () {
  let activeTab = 'expenses';
  // Matches the office's existing Google Sheets expense register exactly -- both the
  // entity tabs and the short "Particulars/Items" labels actually used in that sheet.
  // Particulars is a free-text field (not a locked dropdown, since the real register has
  // used all sorts of labels over time) with these as autocomplete suggestions only.
  const ENTITY_OPTIONS = ['TXTAIRE OPC', 'TXTAIRE REF', 'AVISO'];
  const PARTICULARS_SUGGESTIONS = [
    'MATERIALS', 'MEALS', 'TRANSPORTATION', 'GASOLINE', 'PARKING', 'DRINKS',
    'UTILITIES', 'OFFICE SUPPLIES', 'ELECTRONICS', 'APPAREL', 'ESSENTIALS', 'RENT', 'OTHER',
  ];
  const BILL_CATEGORIES = ['Rent', 'Utilities', 'Other'];

  let expenseMonth = todayISO().slice(0, 7); // 'YYYY-MM'
  // Which date the month filter (and Print Report/Export Excel) group by -- 'encoded'
  // (created_at, when it was actually entered into the system) or 'issued' (the receipt's
  // own Date Issued). Defaults to 'encoded': a receipt from May keyed in during a August
  // catch-up session should land in August's report, not get scattered back into May's.
  let expenseFilterBy = 'encoded'; // 'encoded' | 'issued'
  let voucherMonth = todayISO().slice(0, 7); // 'YYYY-MM'

  function renderView(main) {
    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Office &amp; Finance</h1>
          <div class="page-sub">Expense/receipt log, bill reminders, and payment vouchers. Admin-only -- not part of the employee portal. Office file storage moved to Admin Files, on the sidebar below.</div>
        </div>
        ${activeTab === 'expenses' ? '<button class="btn btn-primary" id="btn-new-expense">+ Add expense</button>' : ''}
        ${activeTab === 'bills' ? '<button class="btn btn-primary" id="btn-new-bill">+ Add bill</button>' : ''}
        ${activeTab === 'vouchers' ? '<button class="btn btn-primary" id="btn-new-voucher">+ Add payment voucher</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Expenses &amp; Receipts</div>
        <div class="tab ${activeTab === 'bills' ? 'active' : ''}" data-tab="bills">Bill Reminders</div>
        <div class="tab ${activeTab === 'vouchers' ? 'active' : ''}" data-tab="vouchers">Payment Vouchers</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnNewExp = qs('#btn-new-expense', main);
    if (btnNewExp) btnNewExp.addEventListener('click', () => openExpenseForm(main));
    const btnNewBill = qs('#btn-new-bill', main);
    if (btnNewBill) btnNewBill.addEventListener('click', () => openBillForm(main));
    const btnNewVoucher = qs('#btn-new-voucher', main);
    if (btnNewVoucher) btnNewVoucher.addEventListener('click', () => openVoucherForm(main));

    if (activeTab === 'expenses') renderExpensesTab(qs('#tab-body', main), main);
    else if (activeTab === 'bills') renderBillsTab(qs('#tab-body', main), main);
    else renderVouchersTab(qs('#tab-body', main), main);
  }

  // ---------------- Expenses & Receipts ----------------

  // Matches the office's existing Google Sheets expense register exactly: one sheet per
  // entity (always all 3, even if empty this month, same as the template), same column
  // headers/order. ExcelJS is already loaded globally (index.html) for the Overview
  // page's employee-records export, same styling convention reused here.
  const EXPENSE_EXPORT_COLUMNS = ['Date Issued', 'Service/Sales Invoice Number', 'Vendor Name', 'TIN Number', 'Location', 'Particulars/Items', 'Amount'];
  const EXPENSE_EXPORT_BLUE = 'FF2F6FED'; // matches css/styles.css --accent

  function addExpenseEntitySheet(workbook, entityName, rows) {
    const sheet = workbook.addWorksheet(entityName);
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const headerRow = sheet.addRow(EXPENSE_EXPORT_COLUMNS);
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXPENSE_EXPORT_BLUE } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    rows.forEach((r) => {
      sheet.addRow([
        new Date(r.date + 'T00:00:00'), r.invoiceNumber || '', r.vendor,
        r.tinNumber || '', r.location || '', r.category, Number(r.amount) || 0,
      ]);
    });

    sheet.getColumn(1).numFmt = 'mm/dd/yyyy';
    sheet.getColumn(7).numFmt = '#,##0.00';
    sheet.columns.forEach((col, i) => {
      col.width = Math.max(EXPENSE_EXPORT_COLUMNS[i].length + 2, 16);
    });
  }

  async function downloadExpensesWorkbook(rows, monthLabel) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'TxTAIRE Dashboard';
    workbook.created = new Date();
    ENTITY_OPTIONS.forEach((entity) => {
      addExpenseEntitySheet(workbook, entity, rows.filter(r => (r.entity || ENTITY_OPTIONS[0]) === entity));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${monthLabel.replace(/[\s,]+/g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    Store.logAudit('expenses.export', 'expenses', null, { period: monthLabel, count: rows.length });
    toast('✔ Expenses downloaded.');
  }

  // Printable version of the same list shown on screen (same columns as the Excel export),
  // for a physical/PDF expense report to file or route for approval -- reuses the DTR's
  // print overlay/table classes (js/app.js openDTR, css/styles.css .dtr-*) rather than
  // duplicating that CSS, since they're already a generic print-ready document layout.
  function openExpenseReportPrintView(rows, monthLabel, total, filterLabel) {
    const overlay = document.createElement('div');
    overlay.className = 'dtr-overlay';
    overlay.innerHTML = `
      <div class="dtr-print">
        <div class="dtr-actions no-print">
          <button class="btn btn-ghost btn-sm" id="report-close">Close</button>
          <button class="btn btn-primary btn-sm" id="report-print-btn">Print / Save as PDF</button>
        </div>
        <div class="dtr-header">
          <img src="assets/logo.svg" class="dtr-logo" alt="TxTAIRE" />
          <h2>Expense Report</h2>
        </div>
        <div class="dtr-meta">
          <div><strong>Period:</strong> ${escapeHtml(monthLabel)} (by ${escapeHtml(filterLabel || 'Date Encoded')})</div>
          <div><strong>Entries:</strong> ${rows.length}</div>
        </div>
        <div class="dtr-table-wrap">
        <table class="dtr-table">
          <thead><tr><th>Date Issued</th><th>Date Encoded</th><th>Entity</th><th>Vendor</th><th>Invoice #</th><th>TIN</th><th>Location</th><th>Particulars</th><th class="num">Amount</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${fmtDate(r.date)}</td>
                <td>${fmtDate((r.created_at || '').slice(0, 10))}</td>
                <td>${escapeHtml(r.entity || ENTITY_OPTIONS[0])}</td>
                <td>${escapeHtml(r.vendor)}</td>
                <td>${escapeHtml(r.invoiceNumber || '—')}</td>
                <td>${escapeHtml(r.tinNumber || '—')}</td>
                <td>${escapeHtml(r.location || '—')}</td>
                <td>${escapeHtml(r.category)}</td>
                <td class="num">${fmtMoney(r.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="8" style="text-align:right;font-weight:600;">Total</td>
            <td class="num" style="font-weight:600;">${fmtMoney(total)}</td>
          </tr></tfoot>
        </table>
        </div>
        <div class="dtr-signatures">
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Prepared By</div></div>
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Approved By</div></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#report-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#report-print-btn').addEventListener('click', () => window.print());
  }

  function sheetsBackupCard(main) {
    const url = Store.getAppSetting('expenseSheetWebhookUrl', '');
    const sheetUrl = Store.getAppSetting('expenseSheetSpreadsheetUrl', '');
    return `
      <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span>🔗 Google Sheets Backup: ${url ? '<span class="badge badge-green">Connected</span>' : '<span class="badge badge-gray">Not connected</span>'}</span>
        <span class="dim" style="font-size:12px;">${url ? 'Every add/edit/delete is mirrored live to your Google Sheet.' : 'Not saving a live copy to Google Sheets yet.'}</span>
        ${url && sheetUrl ? `<a href="${escapeHtml(sheetUrl)}" target="_blank" rel="noopener" class="link-btn">Open Spreadsheet ↗</a>` : ''}
        <button type="button" class="link-btn" id="btn-sheets-backup-settings">${url ? 'Manage' : 'Connect'}</button>
      </div>
    `;
  }

  function openSheetsBackupSettingsModal(main) {
    const url = Store.getAppSetting('expenseSheetWebhookUrl', '');
    const secret = Store.getAppSetting('expenseSheetWebhookSecret', '');
    const sheetUrl = Store.getAppSetting('expenseSheetSpreadsheetUrl', '');
    openModal(`
      <h2>🔗 Google Sheets Backup</h2>
      <div class="modal-sub" style="margin-bottom:10px;">Every expense added, edited, or deleted here is also sent live to a Google Sheet as a real-time backup — separate from Supabase, which stays the actual source of truth. Set this up once: deploy the provided Apps Script as a Web App in your target Google Sheet, then paste its URL and the shared secret you set inside it below.</div>
      <form id="sheets-backup-form">
        <div class="modal-grid">
          <div class="field full"><label>Web App URL</label><input name="url" value="${escapeHtml(url)}" placeholder="https://script.google.com/macros/s/.../exec" /></div>
          <div class="field full"><label>Shared secret</label><input name="secret" value="${escapeHtml(secret)}" placeholder="A password only this app and the script know" /></div>
          <div class="field full"><label>Spreadsheet link <span class="dim" style="font-weight:400;">(optional — just for the "Open Spreadsheet" shortcut, not used by the sync itself)</span></label><input name="sheetUrl" value="${escapeHtml(sheetUrl)}" placeholder="https://docs.google.com/spreadsheets/d/.../edit" /></div>
        </div>
        <div class="modal-actions">
          ${url ? '<button type="button" class="btn btn-ghost" id="btn-disconnect-sheets" style="margin-right:auto;">Disconnect</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `, (bd) => {
      qs('#sheets-backup-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.setAppSetting('expenseSheetWebhookUrl', fd.get('url').trim());
        await Store.setAppSetting('expenseSheetWebhookSecret', fd.get('secret').trim());
        await Store.setAppSetting('expenseSheetSpreadsheetUrl', fd.get('sheetUrl').trim());
        toast('✔ Google Sheets backup settings saved.');
        closeModal();
        renderView(main);
      });
      const disconnectBtn = qs('#btn-disconnect-sheets', bd);
      if (disconnectBtn) disconnectBtn.addEventListener('click', async () => {
        if (!confirm('Disconnect the Google Sheets backup? Past edits already sent stay in the sheet; nothing new will sync until reconnected.')) return;
        await Store.setAppSetting('expenseSheetWebhookUrl', '');
        toast('Disconnected.');
        closeModal();
        renderView(main);
      });
    });
  }

  function renderExpensesTab(body, main) {
    const from = expenseMonth + '-01';
    const to = expenseMonth + '-31';
    const rows = (expenseFilterBy === 'encoded'
      ? Store.listExpenses().filter(e => { const d = (e.created_at || '').slice(0, 10); return d >= from && d <= to; })
      : Store.expensesInRange(from, to)
    ).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const monthLabel = new Date(expenseMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const filterLabel = expenseFilterBy === 'encoded' ? 'Date Encoded' : 'Date Issued';

    body.innerHTML = `
      ${sheetsBackupCard(main)}
      <div class="filters">
        <div class="field"><label>Month</label><input type="month" id="expense-month-input" value="${expenseMonth}" /></div>
        <div class="field"><label>Filter &amp; group by</label>
          <div class="seg" id="seg-expense-filter-by">
            <button data-val="encoded" class="${expenseFilterBy === 'encoded' ? 'active' : ''}">Date Encoded</button>
            <button data-val="issued" class="${expenseFilterBy === 'issued' ? 'active' : ''}">Date Issued</button>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-print-expenses" style="align-self:flex-end;" ${rows.length ? '' : 'disabled'}>🖨 Print Report</button>
        <button class="btn btn-ghost btn-sm" id="btn-export-expenses" style="align-self:flex-end;">📥 Export Excel</button>
      </div>
      <div class="page-sub" style="margin-bottom:10px;">${expenseFilterBy === 'encoded'
        ? 'Groups by when each receipt was entered into the system -- a May/June/July receipt encoded during August shows up (and prints) under August.'
        : 'Groups by the date printed on the receipt itself, regardless of when it was entered.'}</div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Expenses — ${monthLabel} (by ${filterLabel})</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(total)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Date Issued</th><th>Date Encoded</th><th>Entity</th><th>Vendor</th><th>Invoice #</th><th>TIN</th><th>Location</th><th>Particulars</th><th class="num">Amount</th><th>Description</th><th>Receipt</th><th>Entered By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="dim">${fmtDate(r.date)}</td>
                <td class="dim">${fmtDate((r.created_at || '').slice(0, 10))}</td>
                <td class="dim">${escapeHtml(r.entity || ENTITY_OPTIONS[0])}</td>
                <td class="name">${escapeHtml(r.vendor)}</td>
                <td class="dim">${escapeHtml(r.invoiceNumber || '—')}</td>
                <td class="dim">${escapeHtml(r.tinNumber || '—')}</td>
                <td class="dim">${escapeHtml(r.location || '—')}</td>
                <td><span class="badge badge-gray">${escapeHtml(r.category)}</span></td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim" style="max-width:220px;">${escapeHtml(r.description || '—')}</td>
                <td>${r.receiptPath ? `<button class="link-btn" data-view-receipt="${r.receiptPath}">View</button>` : '<span class="dim">—</span>'}</td>
                <td class="dim">${escapeHtml(r.enteredBy || '—')}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-edit-expense="${r.id}">Edit</button>
                  <button class="link-btn" data-delete-expense="${r.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No expenses logged for this month.</div>'}
      </div>
    `;

    qs('#expense-month-input', body).addEventListener('change', (ev) => { expenseMonth = ev.target.value; renderExpensesTab(body, main); });
    qsa('#seg-expense-filter-by button', body).forEach(b => b.addEventListener('click', () => { expenseFilterBy = b.dataset.val; renderExpensesTab(body, main); }));
    const printExpensesBtn = qs('#btn-print-expenses', body);
    if (printExpensesBtn && !printExpensesBtn.disabled) printExpensesBtn.addEventListener('click', () => openExpenseReportPrintView(rows, monthLabel, total, filterLabel));
    qs('#btn-export-expenses', body).addEventListener('click', () => downloadExpensesWorkbook(rows, monthLabel));
    const backupBtn = qs('#btn-sheets-backup-settings', body);
    if (backupBtn) backupBtn.addEventListener('click', () => openSheetsBackupSettingsModal(main));
    qsa('[data-view-receipt]', body).forEach(b => b.addEventListener('click', async () => {
      const win = window.open('', '_blank');
      const url = await Store.getSignedReceiptUrl(b.dataset.viewReceipt);
      if (url && win) win.location.href = url; else if (win) win.close();
    }));
    qsa('[data-edit-expense]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getExpense(b.dataset.editExpense);
      if (r) openExpenseForm(main, r);
    }));
    qsa('[data-delete-expense]', body).forEach(b => b.addEventListener('click', async () => {
      const r = Store.getExpense(b.dataset.deleteExpense);
      if (!r) return;
      if (!confirm(`Delete this expense (${r.vendor}, ${fmtMoney(r.amount)})? This cannot be undone.`)) return;
      if (r.receiptPath) await Store.deleteReceiptPhoto(r.receiptPath);
      await Store.deleteExpense(r.id);
      toast('✔ Expense deleted.');
      renderExpensesTab(body, main);
    }));
  }

  function openExpenseForm(main, editing) {
    const e = editing || {
      date: todayISO(), entity: ENTITY_OPTIONS[0], invoiceNumber: '', vendor: '',
      tinNumber: '', location: '', category: '', amount: '', description: '',
    };
    openModal(`
      <h2>${editing ? 'Edit Expense' : 'Add Expense'}</h2>
      <form id="expense-form">
        <div class="modal-grid">
          <div class="field"><label>Date Issued</label><input type="date" name="date" value="${e.date}" required /></div>
          <div class="field"><label>Entity</label>
            <select name="entity">${ENTITY_OPTIONS.map(v => `<option ${v === (e.entity || ENTITY_OPTIONS[0]) ? 'selected' : ''}>${v}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Vendor Name</label><input name="vendor" value="${escapeHtml(e.vendor)}" required /></div>
          <div class="field"><label>Service/Sales Invoice Number</label><input name="invoiceNumber" value="${escapeHtml(e.invoiceNumber || '')}" /></div>
          <div class="field"><label>TIN Number</label><input name="tinNumber" value="${escapeHtml(e.tinNumber || '')}" placeholder="e.g. 237-683-535-00000" /></div>
          <div class="field full"><label>Location</label><input name="location" value="${escapeHtml(e.location || '')}" placeholder="e.g. QUEZON CITY, NCR" /></div>
          <div class="field"><label>Particulars</label>
            <input name="category" list="particulars-suggestions" value="${escapeHtml(e.category || '')}" required placeholder="e.g. MATERIALS" />
            <datalist id="particulars-suggestions">${PARTICULARS_SUGGESTIONS.map(p => `<option value="${p}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${e.amount}" required /></div>
          <div class="field full"><label>Description (optional, internal note)</label><textarea name="description" rows="2">${escapeHtml(e.description || '')}</textarea></div>
          <div class="field full"><label>Receipt photo/scan (optional)</label><input type="file" name="receipt" accept="image/*,.pdf" /></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-expense">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add expense'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#expense-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const patch = {
            date: fd.get('date'),
            entity: fd.get('entity'),
            vendor: fd.get('vendor').trim(),
            invoiceNumber: fd.get('invoiceNumber').trim(),
            tinNumber: fd.get('tinNumber').trim(),
            location: fd.get('location').trim(),
            category: fd.get('category').trim(),
            amount: Number(fd.get('amount')) || 0,
            description: fd.get('description').trim(),
          };
          const file = fd.get('receipt');
          if (file && file.size > 0) {
            const oldPath = editing ? editing.receiptPath : null;
            patch.receiptPath = await Store.uploadReceiptPhoto(file, file.name);
            if (oldPath) await Store.deleteReceiptPhoto(oldPath);
          }
          if (editing) {
            await Store.updateExpense(editing.id, patch);
            toast('✔ Expense updated.');
          } else {
            patch.enteredBy = currentUserEmail();
            await Store.addExpense(patch);
            toast('✔ Expense added.');
          }
          closeModal();
          renderView(main);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? 'Save changes' : 'Add expense';
        }
      });
      const delBtn = qs('#btn-del-expense', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this expense? This cannot be undone.')) return;
        if (editing.receiptPath) await Store.deleteReceiptPhoto(editing.receiptPath);
        await Store.deleteExpense(editing.id);
        closeModal();
        toast('✔ Expense deleted.');
        renderView(main);
      });
    });
  }

  // ---------------- Bill Reminders ----------------

  function billUrgencyClass(bill) {
    if (bill.status === 'Paid') return '';
    const days = Math.floor((new Date(bill.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
    if (days < 0) return 'red';
    if (days <= 7) return 'yellow';
    return '';
  }

  function renderBillsTab(body, main) {
    const rows = Store.listBills().slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const unpaid = rows.filter(b => b.status !== 'Paid');
    const overdueCount = unpaid.filter(b => b.dueDate < todayISO()).length;
    const dueSoonCount = unpaid.filter(b => {
      const days = Math.floor((new Date(b.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
      return days >= 0 && days <= 7;
    }).length;

    body.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Overdue</div><div class="kpi-value ${overdueCount ? 'red' : ''}" style="font-size:20px;">${overdueCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Due within 7 days</div><div class="kpi-value ${dueSoonCount ? 'yellow' : ''}" style="font-size:20px;">${dueSoonCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Unpaid</div><div class="kpi-value" style="font-size:20px;">${unpaid.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Bill</th><th>Category</th><th class="num">Amount</th><th>Due Date</th><th>Recurrence</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(b => `
              <tr>
                <td class="name">${escapeHtml(b.name)}${b.notes ? `<div class="dim" style="font-size:11px;">${escapeHtml(b.notes)}</div>` : ''}</td>
                <td><span class="badge badge-gray">${escapeHtml(b.category)}</span></td>
                <td class="num">${fmtMoney(b.amount)}</td>
                <td class="${billUrgencyClass(b)}" style="font-weight:${billUrgencyClass(b) ? '700' : '400'};">${fmtDate(b.dueDate)}</td>
                <td class="dim">${escapeHtml(b.recurrence)}</td>
                <td>${b.status === 'Paid' ? `<span class="badge badge-green">Paid ${fmtDate(b.paidDate)}</span>` : billUrgencyClass(b) === 'red' ? '<span class="badge badge-red">Overdue</span>' : billUrgencyClass(b) === 'yellow' ? '<span class="badge badge-yellow">Due soon</span>' : '<span class="badge badge-gray">Unpaid</span>'}</td>
                <td style="white-space:nowrap;">
                  ${b.status !== 'Paid' ? `<button class="link-btn" data-pay-bill="${b.id}">Mark Paid</button>` : ''}
                  <button class="link-btn" data-edit-bill="${b.id}">Edit</button>
                  <button class="link-btn" data-delete-bill="${b.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No bills added yet.</div>'}
      </div>
    `;

    qsa('[data-pay-bill]', body).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Mark this bill as Paid? If it recurs, the next occurrence will be created automatically.')) return;
      await Store.payBill(b.dataset.payBill);
      toast('✔ Bill marked Paid.');
      renderBillsTab(body, main);
    }));
    qsa('[data-edit-bill]', body).forEach(b => b.addEventListener('click', () => {
      const bill = Store.getBill(b.dataset.editBill);
      if (bill) openBillForm(main, bill);
    }));
    qsa('[data-delete-bill]', body).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this bill reminder? This cannot be undone.')) return;
      await Store.deleteBill(b.dataset.deleteBill);
      toast('✔ Bill deleted.');
      renderBillsTab(body, main);
    }));
  }

  function openBillForm(main, editing) {
    const b = editing || { name: '', category: 'Utilities', amount: '', dueDate: todayISO(), recurrence: 'Monthly', notes: '' };
    openModal(`
      <h2>${editing ? 'Edit Bill' : 'Add Bill'}</h2>
      <form id="bill-form">
        <div class="modal-grid">
          <div class="field full"><label>Bill name</label><input name="name" value="${escapeHtml(b.name)}" required placeholder="e.g. Office Rent" /></div>
          <div class="field"><label>Category</label>
            <select name="category">${BILL_CATEGORIES.map(c => `<option ${c === b.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${b.amount}" required /></div>
          <div class="field"><label>Due date</label><input type="date" name="dueDate" value="${b.dueDate}" required /></div>
          <div class="field"><label>Recurrence</label>
            <select name="recurrence">${['One-time', 'Monthly', 'Yearly'].map(r => `<option ${r === b.recurrence ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Notes (optional)</label><textarea name="notes" rows="2">${escapeHtml(b.notes || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add bill'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#bill-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          name: fd.get('name').trim(),
          category: fd.get('category'),
          amount: Number(fd.get('amount')) || 0,
          dueDate: fd.get('dueDate'),
          recurrence: fd.get('recurrence'),
          notes: fd.get('notes').trim(),
        };
        if (editing) {
          await Store.updateBill(editing.id, patch);
          toast('✔ Bill updated.');
        } else {
          await Store.addBill(patch);
          toast('✔ Bill added.');
        }
        closeModal();
        renderView(main);
      });
    });
  }

  // ---------------- Payment Vouchers ----------------

  const PAYMENT_METHODS = ['Cash', 'Check'];

  function renderVouchersTab(body, main) {
    const from = voucherMonth + '-01';
    const to = voucherMonth + '-31';
    const rows = Store.paymentVouchersInRange(from, to).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const monthLabel = new Date(voucherMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    body.innerHTML = `
      <div class="filters">
        <div class="field"><label>Month</label><input type="month" id="voucher-month-input" value="${voucherMonth}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-print-vouchers" style="align-self:flex-end;" ${rows.length ? '' : 'disabled'}>🖨 Print Vouchers (4-up)</button>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Vouchers — ${monthLabel}</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(total)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Ref No</th><th>Date</th><th class="num">Amount</th><th>Method</th><th>To</th><th>Being</th><th>Approved By</th><th>Paid By</th><th>Entered By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.refNo)}</td>
                <td class="dim">${fmtDate(r.date)}</td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim">${escapeHtml(r.paymentMethod)}${r.paymentMethod === 'Check' && r.checkNumber ? ' #' + escapeHtml(r.checkNumber) : ''}</td>
                <td class="dim">${escapeHtml(r.payTo)}</td>
                <td class="dim" style="max-width:200px;">${escapeHtml(r.being || '—')}</td>
                <td class="dim">${escapeHtml(r.approvedBy || '—')}</td>
                <td class="dim">${escapeHtml(r.paidBy || '—')}</td>
                <td class="dim">${escapeHtml(r.enteredBy || '—')}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-print-voucher="${r.id}">Print</button>
                  <button class="link-btn" data-edit-voucher="${r.id}">Edit</button>
                  <button class="link-btn" data-delete-voucher="${r.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No payment vouchers logged for this month.</div>'}
      </div>
    `;

    qs('#voucher-month-input', body).addEventListener('change', (ev) => { voucherMonth = ev.target.value; renderVouchersTab(body, main); });
    const printAllBtn = qs('#btn-print-vouchers', body);
    if (printAllBtn && !printAllBtn.disabled) printAllBtn.addEventListener('click', () => openVoucherPrintView(rows));
    qsa('[data-print-voucher]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getPaymentVoucher(b.dataset.printVoucher);
      if (r) openVoucherPrintView([r]);
    }));
    qsa('[data-edit-voucher]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getPaymentVoucher(b.dataset.editVoucher);
      if (r) openVoucherForm(main, r);
    }));
    qsa('[data-delete-voucher]', body).forEach(b => b.addEventListener('click', async () => {
      const r = Store.getPaymentVoucher(b.dataset.deleteVoucher);
      if (!r) return;
      if (!confirm(`Delete payment voucher ${r.refNo} (${fmtMoney(r.amount)})? This cannot be undone.`)) return;
      await Store.deletePaymentVoucher(r.id);
      toast('✔ Payment voucher deleted.');
      renderVouchersTab(body, main);
    }));
  }

  function openVoucherForm(main, editing) {
    const v = editing || {
      date: todayISO(), amount: '', paymentMethod: 'Cash', checkNumber: '',
      payTo: '', being: '', approvedBy: '', paidBy: '',
    };
    openModal(`
      <h2>${editing ? 'Edit Payment Voucher' : 'Add Payment Voucher'}</h2>
      ${editing ? `<div class="modal-sub">Ref No: <strong>${escapeHtml(editing.refNo)}</strong></div>` : '<div class="modal-sub">A Ref No. is assigned automatically when saved.</div>'}
      <form id="voucher-form">
        <div class="modal-grid">
          <div class="field"><label>Date</label><input type="date" name="date" value="${v.date}" required /></div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${v.amount}" required /></div>
          <div class="field"><label>Method of Payment</label>
            <select name="paymentMethod">${PAYMENT_METHODS.map(m => `<option ${m === v.paymentMethod ? 'selected' : ''}>${m}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Check # <span class="dim" style="font-weight:400;">(if Check)</span></label><input name="checkNumber" value="${escapeHtml(v.checkNumber || '')}" /></div>
          <div class="field full"><label>To (Payee Name)</label><input name="payTo" value="${escapeHtml(v.payTo)}" required /></div>
          <div class="field full"><label>Being <span class="dim" style="font-weight:400;">(purpose/description)</span></label><textarea name="being" rows="2">${escapeHtml(v.being || '')}</textarea></div>
          <div class="field"><label>Approved By</label><input name="approvedBy" value="${escapeHtml(v.approvedBy || '')}" /></div>
          <div class="field"><label>Paid By</label><input name="paidBy" value="${escapeHtml(v.paidBy || '')}" /></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-voucher">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add voucher'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#voucher-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const amount = Number(fd.get('amount')) || 0;
          const patch = {
            date: fd.get('date'),
            amount,
            paymentMethod: fd.get('paymentMethod'),
            checkNumber: fd.get('checkNumber').trim(),
            payTo: fd.get('payTo').trim(),
            sumOfWords: amountToWords(amount),
            being: fd.get('being').trim(),
            approvedBy: fd.get('approvedBy').trim(),
            paidBy: fd.get('paidBy').trim(),
          };
          if (editing) {
            await Store.updatePaymentVoucher(editing.id, patch);
            toast('✔ Payment voucher updated.');
          } else {
            patch.enteredBy = currentUserEmail();
            await Store.addPaymentVoucher(patch);
            toast('✔ Payment voucher added.');
          }
          closeModal();
          renderView(main);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? 'Save changes' : 'Add voucher';
        }
      });
      const delBtn = qs('#btn-del-voucher', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this payment voucher? This cannot be undone.')) return;
        await Store.deletePaymentVoucher(editing.id);
        closeModal();
        toast('✔ Payment voucher deleted.');
        renderView(main);
      });
    });
  }

  // One printable card per voucher, matching the office's paper Payment Voucher template
  // (Ref No/Amount/Date, Method of Payment, To, The Sum of, Being/Payee, Approved By/Paid
  // By/Signature) -- 4 per A4 sheet (2x2) so several can be printed and cut apart in one
  // go, same overlay/print pattern as the DTR (js/app.js openDTR).
  function voucherCardHtml(v) {
    if (!v) return '<div class="voucher-card empty"></div>';
    return `
      <div class="voucher-card">
        <div class="voucher-header">
          <img src="assets/logo.svg" class="voucher-logo" alt="TxTAIRE" />
          <div class="voucher-title">Payment Voucher</div>
        </div>
        <div class="voucher-refno">Ref No: <strong>${escapeHtml(v.refNo)}</strong></div>
        <div class="voucher-row">
          <div><span class="voucher-label">Amount</span><br/><span class="voucher-value">${fmtMoney(v.amount)}</span></div>
          <div><span class="voucher-label">Date</span><br/><span class="voucher-value">${fmtDate(v.date)}</span></div>
        </div>
        <div class="voucher-method-header">Method of Payment</div>
        <div class="voucher-row">
          <div><span class="voucher-label">Cash</span><br/>${v.paymentMethod === 'Cash' ? '✔' : ''}</div>
          <div><span class="voucher-label">Check #</span><br/>${v.paymentMethod === 'Check' ? escapeHtml(v.checkNumber || '') : ''}</div>
        </div>
        <div class="voucher-full"><span class="voucher-label">To</span><br/><span class="voucher-value">${escapeHtml(v.payTo)}</span></div>
        <div class="voucher-full"><span class="voucher-label">The Sum of</span><br/>${escapeHtml(v.sumOfWords || amountToWords(v.amount))}</div>
        <div class="voucher-row">
          <div><span class="voucher-label">Being</span><br/>${escapeHtml(v.being || '—')}</div>
          <div><span class="voucher-label">Payee</span><br/>${escapeHtml(v.payTo)}</div>
        </div>
        <div class="voucher-footer">
          <div><span class="voucher-label">Approved By</span><br/>${escapeHtml(v.approvedBy || '')}</div>
          <div><span class="voucher-label">Paid By</span><br/>${escapeHtml(v.paidBy || '')}</div>
          <div><span class="voucher-label">Signature</span></div>
        </div>
      </div>
    `;
  }

  function openVoucherPrintView(vouchers) {
    const pages = [];
    for (let i = 0; i < vouchers.length; i += 4) pages.push(vouchers.slice(i, i + 4));
    if (!pages.length) pages.push([]);

    const overlay = document.createElement('div');
    overlay.className = 'voucher-overlay';
    overlay.innerHTML = `
      <div class="voucher-print">
        <div class="voucher-actions no-print">
          <button class="btn btn-ghost btn-sm" id="voucher-close">Close</button>
          <button class="btn btn-primary btn-sm" id="voucher-print-btn">Print / Save as PDF</button>
        </div>
        ${pages.map(page => `
          <div class="voucher-page">
            ${[0, 1, 2, 3].map(i => voucherCardHtml(page[i])).join('')}
          </div>
        `).join('')}
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#voucher-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#voucher-print-btn').addEventListener('click', () => window.print());
  }

  return { render: renderView };
})();
