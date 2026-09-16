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
  let billingInvoiceMonth = todayISO().slice(0, 7); // 'YYYY-MM'
  let thirteenthMonthYear = new Date(todayISO() + 'T00:00:00').getFullYear();

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
        ${activeTab === 'billingInvoices' ? '<button class="btn btn-primary" id="btn-new-billing-invoice">+ Add billing invoice</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Expenses &amp; Receipts</div>
        <div class="tab ${activeTab === 'bills' ? 'active' : ''}" data-tab="bills">Bill Reminders</div>
        <div class="tab ${activeTab === 'vouchers' ? 'active' : ''}" data-tab="vouchers">Payment Vouchers</div>
        <div class="tab ${activeTab === 'billingInvoices' ? 'active' : ''}" data-tab="billingInvoices">Billing Invoices</div>
        <div class="tab ${activeTab === 'thirteenthMonth' ? 'active' : ''}" data-tab="thirteenthMonth">13th Month Pay</div>
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
    const btnNewBillingInvoice = qs('#btn-new-billing-invoice', main);
    if (btnNewBillingInvoice) btnNewBillingInvoice.addEventListener('click', () => openBillingInvoiceForm(main));

    if (activeTab === 'expenses') renderExpensesTab(qs('#tab-body', main), main);
    else if (activeTab === 'bills') renderBillsTab(qs('#tab-body', main), main);
    else if (activeTab === 'vouchers') renderVouchersTab(qs('#tab-body', main), main);
    else if (activeTab === 'billingInvoices') renderBillingInvoicesTab(qs('#tab-body', main), main);
    else render13thMonthTab(qs('#tab-body', main), main);
  }

  // ---------------- 13th Month Pay ----------------

  function render13thMonthTab(body, main) {
    const rows = Store.listThirteenthMonthPay(thirteenthMonthYear).slice()
      .sort((a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)));
    const totalAmount = rows.reduce((s, r) => s + Number(r.amount), 0);

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Year</label>
          <input type="number" id="thirteenth-year" value="${thirteenthMonthYear}" style="width:100px;" />
        </div>
        <div style="display:flex; align-items:flex-end; gap:8px;">
          <button class="btn btn-primary btn-sm" id="btn-compute-13th">Compute for all employees</button>
          <button class="btn btn-ghost btn-sm" id="btn-print-13th" ${!rows.length ? 'disabled' : ''}>🖨️ Print Summary</button>
        </div>
      </div>
      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Employee</th><th>Basic Salary Earned</th><th>13th Month Pay</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(employeeName(r.employeeId))}</td>
                <td class="dim">${fmtMoney(r.basicSalaryEarned)}</td>
                <td>${fmtMoney(r.amount)}</td>
                <td><span class="badge ${r.status === 'Released' ? 'badge-green' : 'badge-yellow'}">${escapeHtml(r.status)}</span></td>
                <td>${r.status !== 'Released' ? `<button class="link-btn" data-release="${r.id}">Release →</button>` : `<span class="dim">${fmtDate(r.releaseDate)}</span>`}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr style="font-weight:700;"><td colspan="2">Total</td><td>${fmtMoney(totalAmount)}</td><td colspan="2"></td></tr></tfoot>
        </table>` : `<div class="empty">No 13th Month Pay computed for ${thirteenthMonthYear} yet — click "Compute for all employees."</div>`}
      </div>
    `;

    qs('#thirteenth-year', body).addEventListener('change', (ev) => {
      thirteenthMonthYear = Number(ev.target.value) || thirteenthMonthYear;
      render13thMonthTab(body, main);
    });
    qs('#btn-compute-13th', body).addEventListener('click', async () => {
      const btn = qs('#btn-compute-13th', body);
      btn.disabled = true;
      btn.textContent = 'Computing…';
      await Store.compute13thMonthForAllEmployees(thirteenthMonthYear, currentUserEmail());
      toast('✔ 13th Month Pay computed for ' + thirteenthMonthYear + '.');
      render13thMonthTab(body, main);
    });
    qsa('[data-release]', body).forEach(btn => btn.addEventListener('click', async () => {
      if (!confirm('Mark this employee\'s 13th Month Pay as released?')) return;
      await Store.release13thMonthPay(btn.dataset.release);
      toast('✔ Released.');
      render13thMonthTab(body, main);
    }));
    const printBtn = qs('#btn-print-13th', body);
    if (printBtn) printBtn.addEventListener('click', () => open13thMonthPrintView(rows, thirteenthMonthYear, totalAmount));
  }

  // Reuses the same generic .dtr-overlay/.dtr-print/.dtr-table CSS classes already used
  // for the DTR, Expense Report, and Final Pay Computation sheet.
  function open13thMonthPrintView(rows, year, total) {
    const sorted = rows.slice().sort((a, b) => employeeName(a.employeeId).localeCompare(employeeName(b.employeeId)));
    const overlay = document.createElement('div');
    overlay.className = 'dtr-overlay';
    overlay.innerHTML = `
      <div class="dtr-print">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h2 style="margin:0;">13th Month Pay — ${year}</h2>
          <div>
            <button class="btn btn-ghost btn-sm" id="btn-close-print">Close</button>
            <button class="btn btn-primary btn-sm" id="btn-do-print">Print</button>
          </div>
        </div>
        <table class="dtr-table">
          <thead><tr><th>Employee</th><th>Basic Salary Earned</th><th>13th Month Pay</th><th>Status</th></tr></thead>
          <tbody>
            ${sorted.map(r => `<tr><td>${escapeHtml(employeeName(r.employeeId))}</td><td style="text-align:right;">${fmtMoney(r.basicSalaryEarned)}</td><td style="text-align:right;">${fmtMoney(r.amount)}</td><td>${escapeHtml(r.status)}</td></tr>`).join('')}
            <tr style="font-weight:700; border-top:2px solid #000;"><td colspan="2">TOTAL</td><td style="text-align:right;">${fmtMoney(total)}</td><td></td></tr>
          </tbody>
        </table>
      </div>
    `;
    document.body.appendChild(overlay);
    qs('#btn-close-print', overlay).addEventListener('click', () => overlay.remove());
    qs('#btn-do-print', overlay).addEventListener('click', () => window.print());
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
  function openExpenseReportPrintView(rowsIn, monthLabel, total, filterLabel) {
    // Printed report always reads oldest-to-newest (a ledger/chronological convention),
    // independent of whatever order the on-screen table is currently sorted in.
    const rows = rowsIn.slice().sort((a, b) => a.date.localeCompare(b.date));
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
    ).slice().sort((a, b) => a.date.localeCompare(b.date));
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

  // Letterhead content for the printed Billing Invoice, one per entity -- transcribed
  // from the company's actual invoice paper stock so a printed invoice from this app
  // matches the real one exactly. AVISO's logo is a raster export (assets/aviso-logo.png,
  // cropped from a scanned invoice) since no vector source exists, unlike the other two
  // entities' shared wave logo (assets/logo.svg).
  const BILLING_LETTERHEADS = {
    'TXTAIRE REF': {
      logo: 'assets/logo.svg', logoHeight: 46,
      name: 'TXTAIRE REFRIGERATION AND AIRCONDITIONING SERVICES',
      lines: [
        'p: (049) 549 2847 / (049) 546 6253&nbsp;&nbsp;&nbsp;m: 0995-550-0300 / 0991-390-5952',
        'a: 112 Lawin St. San Jose Village, Brgy. Biñan, Biñan City, Laguna 4024',
        'e: service@txtaire.com',
      ],
      vatTin: '902-637-379-00000',
      payInOrderOf: 'TXTAIRE REFRIGERATION AND AIRCONDITIONING SERVICES',
    },
    'TXTAIRE OPC': {
      logo: 'assets/logo.svg', logoHeight: 46,
      name: 'TXTAIRE OPC',
      nameSuffix: '(SEC Company Reg. No.: 2024090170638-11)',
      tagline: 'Refrigeration and Air-conditioning Solutions',
      lines: [
        'Tel No.: (049) 549 2847 / (049) 546 6253&nbsp;&nbsp;&nbsp;Mobile: +63969 647 0000&nbsp;&nbsp;&nbsp;Email: service@txtaire.com',
        'Main Office: No.112 Lawin St. San Jose Village, Brgy.Biñan, City of Biñan, Laguna 4024',
        'Field Offices: Unit 301, 141-Q BGC Residence, East Rembo, Makati City',
      ],
      vatTin: '902-637-379-00000',
      payInOrderOf: 'TXTAIRE OPC',
    },
    'AVISO': {
      logo: 'assets/aviso-logo.png', logoHeight: 40,
      lines: [
        'No.112 Lawin St. San Jose Village, Brgy. Biñan, Biñan City, Laguna',
        'Contact Details: +6349 539 2847 / +63917 323 2644',
        'Email: engr.jmaviso@gmail.com',
      ],
      vatTin: '',
      payInOrderOf: 'JOEL M. AVISO',
    },
  };

  // Seed client roster per entity, transcribed from the office's own 2026 receivables
  // ledger (TXTAIRE RECEIVABLES 2026.xlsx) -- lets a Billing Invoice pick a client already
  // on file, with their TIN and contact person filled in, even before this app has ever
  // billed them itself. A client actually billed through this app (Store.listBillingInvoices)
  // always overrides this seed, so the list only gets more accurate over time, never less.
  const BILLING_CLIENTS = {
    'TXTAIRE REF': {
      'The Residences at Greenbelt Condominium Corp': { tin: '006-958-571-000', contactPerson: 'Pamela Tolentino', contactNumber: '9953164738' },
      'GMV Materials Inc': { tin: '241-242-600-000', contactPerson: 'SG', contactNumber: '' },
      'SouthEastAsia Retail Inc': { tin: '008-909-992-00000', contactPerson: 'Azielle Cristel Coprado', contactNumber: '' },
      'Ayala Property Management Corp.': { tin: '000-106-866-000', contactPerson: 'Rona Grace Diaz', contactNumber: '' },
      'Alveo Land Corp': { tin: '000-004-818-977', contactPerson: 'Rochelle Mae Tasarra', contactNumber: '9171877036' },
      'Avida Towers Asten Condominium Corp': { tin: '009-936-709-00000', contactPerson: '', contactNumber: '' },
      'High Park Towers Condominium Corp': { tin: '010-616-355-00000', contactPerson: 'Frankie Nicole Avila', contactNumber: '' },
      'East Gallery Place Condominium Corp': { tin: '600-222-535-00000', contactPerson: 'Jeremiah Reyes', contactNumber: '' },
      'Amaia Skies Shaw Condominium Corp': { tin: '', contactPerson: 'Domingo Paguyo', contactNumber: '' },
      'Avida Towers San Lorenzo Condominium Corp': { tin: '', contactPerson: 'Emmanuel Dellosa', contactNumber: '' },
      'Avida Towers Vireo Condominium Corp.': { tin: '603-687-401-00000', contactPerson: 'Clariz Paras', contactNumber: '9666303161' },
      'Abrio Homeowners Association Inc.': { tin: '278-127-321', contactPerson: '', contactNumber: '' },
      'Avida Towers Vita Condominium Corp.': { tin: '', contactPerson: 'Arriane Mabag', contactNumber: '' },
      'Serendra Condominium Corporation': { tin: '006-990-491-000', contactPerson: 'H. Capo', contactNumber: '' },
    },
    'TXTAIRE OPC': {
      'High Park Towers Condominium Corp.': { tin: '010-616-355', contactPerson: 'Frankie Nicolle A. Avila', contactNumber: '' },
      'G2G All Spice Eatery': { tin: '637-564-111', contactPerson: 'Daisyrie G Cerdeña', contactNumber: '9566235446' },
      'FERNDALE VILLAS': { tin: '477-543-022', contactPerson: '', contactNumber: '' },
      'Avida Towers Prime Taft Condominium Corp.': { tin: '010-007-359', contactPerson: 'Arly B. Pabelico', contactNumber: '' },
      'East Gallery Place Condominium Corp': { tin: '600-222-535', contactPerson: 'J. Reyes', contactNumber: '' },
      'High Park Towers': { tin: '010-616-355', contactPerson: 'Frankie Nicolle Avila', contactNumber: '' },
      'Amaia Parkway Nuvali Condominium Corp.': { tin: '010-312-394', contactPerson: 'Althea Jeanne Moya', contactNumber: '' },
      'West Gallery Place Condominium Corp.': { tin: '609-458-064', contactPerson: 'Jaye Ann Bellezo', contactNumber: '' },
      'Advanced Global Water Technologies Philippines Inc.': { tin: '009-934-692', contactPerson: 'Marineth S. Gerando', contactNumber: '' },
      'Abrio Homeowners Association Inc.': { tin: '278-127-321', contactPerson: 'Josie V. Ponce', contactNumber: '' },
      'Aquagen Technologies Inc.': { tin: '', contactPerson: 'Princess Peras', contactNumber: '' },
      'Santierra Homeowners Association Inc.': { tin: '439-630-028', contactPerson: 'Jen', contactNumber: '' },
      'The Lerato Condominium': { tin: '009-161-993', contactPerson: 'Winilyn P. Estojero', contactNumber: '' },
      'Tapa King Inc.': { tin: '000-503-513-000', contactPerson: 'Jeffrey Lopez', contactNumber: '' },
    },
    'AVISO': {
      'AGWT': { tin: '009-934-692-000', contactPerson: 'Marineth Geranco', contactNumber: '' },
      'Sorrento Oasis Pasig Condominium': { tin: '008-200-035-000', contactPerson: '', contactNumber: '' },
      'West Gallery Place': { tin: '609-458-064-000', contactPerson: '', contactNumber: '' },
      'East Gallery Place': { tin: '600-222-535-00000', contactPerson: 'J. Reyes', contactNumber: '' },
      'Avida Towers Sola': { tin: '605-203-214-00000', contactPerson: '', contactNumber: '' },
      'Advanced Global Water Technologies': { tin: '009-934-692-000', contactPerson: 'Marineth S. Geranco', contactNumber: '' },
      'Sunproperties Development Corp.': { tin: '', contactPerson: '', contactNumber: '' },
      'Universal Re Condominium Corporation': { tin: '', contactPerson: '', contactNumber: '' },
      'Avida Towers Asten Condominium Corp.': { tin: '009-936-709-00000', contactPerson: '', contactNumber: '' },
    },
  };

  // Curated from the same ledger's own recurring Particulars phrasing -- a fixed list
  // instead of free text, so HR selects the service instead of re-typing/misspelling it.
  // "Other" is the one escape hatch, for the genuinely one-off job.
  const BILLING_PARTICULARS_OPTIONS = [
    'AC Preventive Maintenance Service (PMS)',
    'Quarterly AC Preventive Maintenance Service (PMS)',
    'System Reprocess',
    'System Flushing, Vacuum & Leak Test',
    'Leak Testing and Leak Repair',
    'Recharging of Refrigerant',
    'Repair Works',
    'Emergency Repair',
    'Supply and Delivery of AC Unit',
    'Supply and Installation of AC Unit',
    'Supply and Delivery of Parts',
    'Replacement of Parts',
    'Nitrogen Gas for Leak Testing',
    'Progress Billing',
    'Down Payment',
    'Project Completion Payment',
    'Consolidated Charges',
    'Quarterly Billing',
    'Bi-monthly Billing',
    'PME Certification Services',
  ];
  const BILLING_QUARTER_LABELS = { Q1: '1st', Q2: '2nd', Q3: '3rd', Q4: '4th' };
  const BILLING_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // The printed line item is still one plain string (billingInvoiceCardHtml, and the
  // "billingInvoices" table, are unchanged) -- particulars/quarter/month/year are form-only
  // inputs that compose into it. "Other" bypasses composition entirely, and an item
  // carried over from before this feature (plain free-typed description, no particulars
  // recorded) is treated the same way once re-opened, so nothing already saved is lost.
  //
  // Year is its own selectable field, not silently read off the invoice's own Date --
  // a real, common case in the office's own ledger is billing a quarter/month AFTER it
  // ends (e.g. "QUARTERLY BILLING (OCT-NOV-DEC2024)" invoiced into the following year), so
  // the period being billed and the date the invoice is issued are not always the same
  // year. dateStr only supplies the INITIAL default the first time a period is picked.
  function composeBillingParticulars(it, dateStr) {
    if (it.particulars === '__other__') return (it.customParticulars || '').trim();
    if (!it.particulars) return '';
    const year = it.year || (dateStr || todayISO()).slice(0, 4);
    if (it.quarter) return `${BILLING_QUARTER_LABELS[it.quarter]} Quarter ${it.particulars} ${year}`;
    if (it.month) return `${it.particulars} – ${BILLING_MONTH_NAMES[Number(it.month) - 1]} ${year}`;
    return it.particulars;
  }

  // Three layers, each overriding the one before: the static ledger seed above; a client
  // HR explicitly registered via "+ New client" (Store.billingClients -- deliberate roster
  // data, not tied to any one invoice); then a client actually billed through this app,
  // the freshest source of truth for their TIN/address/contact. Entity-scoped throughout,
  // since TXTAIRE REF/OPC and AVISO are separate legal entities that may bill the "same"
  // client (e.g. East Gallery Place) under different terms.
  function computeKnownBillingClients(entity) {
    const known = {};
    const seed = BILLING_CLIENTS[entity] || {};
    Object.keys(seed).forEach((name) => {
      const c = seed[name];
      known[name.toLowerCase()] = { clientName: name, clientTin: c.tin || '', clientAddress: '', contactPerson: c.contactPerson || '', contactNumber: c.contactNumber || '' };
    });
    Store.billingClientsForEntity(entity).forEach((c) => {
      const name = (c.name || '').trim();
      if (!name) return;
      known[name.toLowerCase()] = {
        clientName: name, clientTin: c.tin || '', clientAddress: c.address || '',
        contactPerson: c.contactPerson || '', contactNumber: c.contactNumber || '',
      };
    });
    Store.listBillingInvoices()
      .filter(inv => inv.entity === entity)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((inv) => {
        const name = (inv.clientName || '').trim();
        if (!name) return;
        known[name.toLowerCase()] = {
          clientName: name, clientTin: inv.clientTin || '', clientAddress: inv.clientAddress || '',
          contactPerson: inv.contactPerson || '', contactNumber: inv.contactNumber || '',
        };
      });
    return known;
  }

  function voucherSignatoryDefaultsCard(main) {
    const cName = Store.getAppSetting('voucherCertifiedCorrectByDefault', '');
    const aName = Store.getAppSetting('voucherApprovedByDefault', '');
    return `
      <div class="panel" style="margin-bottom:8px; padding:10px 14px; display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span>✍️ Default Signatories:</span>
        <span class="dim" style="font-size:12px;">${cName ? escapeHtml(cName) : '(not set)'} — Certified Correct By &middot; ${aName ? escapeHtml(aName) : '(not set)'} — Approved By</span>
        <button type="button" class="link-btn" id="btn-voucher-signatory-settings">Manage</button>
      </div>
    `;
  }

  function openVoucherSignatoryDefaultsModal(main) {
    const cName = Store.getAppSetting('voucherCertifiedCorrectByDefault', '');
    const cTitle = Store.getAppSetting('voucherCertifiedCorrectByTitleDefault', '');
    const aName = Store.getAppSetting('voucherApprovedByDefault', '');
    const aTitle = Store.getAppSetting('voucherApprovedByTitleDefault', '');
    openModal(`
      <h2>✍️ Default Voucher Signatories</h2>
      <div class="modal-sub" style="margin-bottom:10px;">Pre-fills every NEW payment voucher's Certified Correct By / Approved By fields — still editable per voucher afterward, and doesn't change any voucher already saved.</div>
      <form id="voucher-signatory-form">
        <div class="modal-grid">
          <div class="field"><label>Certified Correct By — Name</label><input name="cName" value="${escapeHtml(cName)}" /></div>
          <div class="field"><label>Certified Correct By — Title</label><input name="cTitle" value="${escapeHtml(cTitle)}" /></div>
          <div class="field"><label>Approved By — Name</label><input name="aName" value="${escapeHtml(aName)}" /></div>
          <div class="field"><label>Approved By — Title</label><input name="aTitle" value="${escapeHtml(aTitle)}" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Save</button>
        </div>
      </form>
    `, (bd) => {
      qs('#voucher-signatory-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.setAppSetting('voucherCertifiedCorrectByDefault', fd.get('cName').trim());
        await Store.setAppSetting('voucherCertifiedCorrectByTitleDefault', fd.get('cTitle').trim());
        await Store.setAppSetting('voucherApprovedByDefault', fd.get('aName').trim());
        await Store.setAppSetting('voucherApprovedByTitleDefault', fd.get('aTitle').trim());
        toast('✔ Default signatories saved.');
        closeModal();
        renderView(main);
      });
    });
  }

  function renderVouchersTab(body, main) {
    const from = voucherMonth + '-01';
    const to = voucherMonth + '-31';
    const rows = Store.paymentVouchersInRange(from, to).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const monthLabel = new Date(voucherMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    body.innerHTML = `
      ${voucherSignatoryDefaultsCard(main)}
      <div class="filters">
        <div class="field"><label>Month</label><input type="month" id="voucher-month-input" value="${voucherMonth}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-print-vouchers" style="align-self:flex-end;" ${rows.length ? '' : 'disabled'}>🖨 Print Vouchers (2 copies/page)</button>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Vouchers — ${monthLabel}</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(total)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>No.</th><th>Date</th><th class="num">Amount</th><th>Method</th><th>Payee</th><th>Certified Correct By</th><th>Approved By</th><th>Entered By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.refNo)}</td>
                <td class="dim">${fmtDate(r.date)}</td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim">${escapeHtml(r.paymentMethod)}${r.paymentMethod === 'Check' && r.checkNumber ? ' #' + escapeHtml(r.checkNumber) : ''}</td>
                <td class="dim">${escapeHtml(r.payTo)}</td>
                <td class="dim">${escapeHtml(r.certifiedCorrectBy || '—')}</td>
                <td class="dim">${escapeHtml(r.approvedBy || '—')}</td>
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
    const backupBtn = qs('#btn-voucher-signatory-settings', body);
    if (backupBtn) backupBtn.addEventListener('click', () => openVoucherSignatoryDefaultsModal(main));
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
      date: todayISO(), paymentMethod: 'Cash', checkNumber: '', bankName: '',
      payTo: '', payeeAccountInfo: '',
      certifiedCorrectBy: Store.getAppSetting('voucherCertifiedCorrectByDefault', ''),
      certifiedCorrectByTitle: Store.getAppSetting('voucherCertifiedCorrectByTitleDefault', ''),
      approvedBy: Store.getAppSetting('voucherApprovedByDefault', ''),
      approvedByTitle: Store.getAppSetting('voucherApprovedByTitleDefault', ''),
    };
    // Working copy of the itemized particulars -- always at least one row so the editor
    // never renders empty. Amount may be blank on a row that's purely an annotation (e.g.
    // "REQUESTED BY: JRB"), matching the real paper form's particulars column.
    let particulars = (Array.isArray(v.particulars) && v.particulars.length)
      ? v.particulars.map(p => ({ text: p.text || '', amount: p.amount === '' || p.amount == null ? '' : p.amount }))
      : [{ text: '', amount: '' }];

    openModal(`
      <h2>${editing ? 'Edit Payment Voucher' : 'Add Payment Voucher'}</h2>
      ${editing ? `<div class="modal-sub">No.: <strong>${escapeHtml(editing.refNo)}</strong></div>` : '<div class="modal-sub">A voucher No. is assigned automatically when saved.</div>'}
      <form id="voucher-form">
        <div class="modal-grid">
          <div class="field"><label>Date</label><input type="date" name="date" value="${v.date}" required /></div>
          <div class="field"><label>Method of Payment</label>
            <select name="paymentMethod">${PAYMENT_METHODS.map(m => `<option ${m === v.paymentMethod ? 'selected' : ''}>${m}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Bank <span class="dim" style="font-weight:400;">(if Check)</span></label><input name="bankName" value="${escapeHtml(v.bankName || '')}" /></div>
          <div class="field"><label>Check # <span class="dim" style="font-weight:400;">(if Check)</span></label><input name="checkNumber" value="${escapeHtml(v.checkNumber || '')}" /></div>
          <div class="field full"><label>Payee</label><input name="payTo" value="${escapeHtml(v.payTo)}" required /></div>
          <div class="field full"><label>Payee Payment Details <span class="dim" style="font-weight:400;">(optional — bank/GCash account, printed under the payee name)</span></label><textarea name="payeeAccountInfo" rows="2">${escapeHtml(v.payeeAccountInfo || '')}</textarea></div>
          <div class="field full">
            <label>Particulars</label>
            <div id="voucher-particulars-rows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-add-particular" style="align-self:flex-start; margin-top:6px;">+ Add line</button>
            <div class="dim" style="margin-top:6px;">Total Amount: <strong id="voucher-particulars-total">${fmtMoney(0)}</strong></div>
          </div>
          <div class="field"><label>Certified Correct By — Name</label><input name="certifiedCorrectBy" value="${escapeHtml(v.certifiedCorrectBy || '')}" /></div>
          <div class="field"><label>Certified Correct By — Title</label><input name="certifiedCorrectByTitle" value="${escapeHtml(v.certifiedCorrectByTitle || '')}" /></div>
          <div class="field"><label>Approved By — Name</label><input name="approvedBy" value="${escapeHtml(v.approvedBy || '')}" /></div>
          <div class="field"><label>Approved By — Title</label><input name="approvedByTitle" value="${escapeHtml(v.approvedByTitle || '')}" /></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-voucher">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add voucher'}</button>
        </div>
      </form>
    `, (bd) => {
      function particularsTotal() {
        return particulars.reduce((s, p) => s + (Number(p.amount) || 0), 0);
      }
      function renderParticularRows() {
        const wrap = qs('#voucher-particulars-rows', bd);
        wrap.innerHTML = particulars.map((p, i) => `
          <div style="display:flex; gap:8px; margin-bottom:6px;">
            <input type="text" placeholder="Particular / description" value="${escapeHtml(p.text)}" data-particular-text="${i}" style="flex:1;" />
            <input type="number" min="0" step="0.01" placeholder="Amount" value="${p.amount === '' ? '' : p.amount}" data-particular-amount="${i}" style="width:110px;" />
            <button type="button" class="link-btn" data-remove-particular="${i}" style="color:var(--red);">✕</button>
          </div>
        `).join('');
        qsa('[data-particular-text]', wrap).forEach(el => el.addEventListener('input', () => {
          particulars[Number(el.dataset.particularText)].text = el.value;
        }));
        qsa('[data-particular-amount]', wrap).forEach(el => el.addEventListener('input', () => {
          particulars[Number(el.dataset.particularAmount)].amount = el.value === '' ? '' : Number(el.value);
          qs('#voucher-particulars-total', bd).textContent = fmtMoney(particularsTotal());
        }));
        qsa('[data-remove-particular]', wrap).forEach(el => el.addEventListener('click', () => {
          particulars.splice(Number(el.dataset.removeParticular), 1);
          if (!particulars.length) particulars.push({ text: '', amount: '' });
          renderParticularRows();
          qs('#voucher-particulars-total', bd).textContent = fmtMoney(particularsTotal());
        }));
      }
      renderParticularRows();
      qs('#voucher-particulars-total', bd).textContent = fmtMoney(particularsTotal());
      qs('#btn-add-particular', bd).addEventListener('click', () => {
        particulars.push({ text: '', amount: '' });
        renderParticularRows();
      });

      qs('#voucher-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const cleanParticulars = particulars
            .filter(p => p.text.trim() || p.amount !== '')
            .map(p => ({ text: p.text.trim(), amount: p.amount === '' ? '' : Number(p.amount) }));
          const amount = particularsTotal();
          const patch = {
            date: fd.get('date'),
            amount,
            paymentMethod: fd.get('paymentMethod'),
            bankName: fd.get('bankName').trim(),
            checkNumber: fd.get('checkNumber').trim(),
            payTo: fd.get('payTo').trim(),
            payeeAccountInfo: fd.get('payeeAccountInfo').trim(),
            particulars: cleanParticulars,
            sumOfWords: amountToWords(amount),
            certifiedCorrectBy: fd.get('certifiedCorrectBy').trim(),
            certifiedCorrectByTitle: fd.get('certifiedCorrectByTitle').trim(),
            approvedBy: fd.get('approvedBy').trim(),
            approvedByTitle: fd.get('approvedByTitle').trim(),
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

  // One printable card per voucher, matching the company's real paper Payment Voucher
  // form (Payee + payment details, No./Date, itemized Particulars/Amount, Distribution of
  // Account, Bank/Check No., and the four signature roles) -- printed TWICE per landscape
  // A4 sheet (office copy + payee copy), same as the paper form, not two different
  // vouchers side by side. Same overlay/print pattern as the DTR (js/app.js openDTR).
  function voucherCardHtml(v) {
    if (!v) return '<div class="voucher-card empty"></div>';
    const particulars = Array.isArray(v.particulars) ? v.particulars : [];
    const total = particulars.length ? particulars.reduce((s, p) => s + (Number(p.amount) || 0), 0) : Number(v.amount) || 0;
    const blankAccountTable = `
      <table class="voucher-account-table">
        <thead><tr><th>Account Title</th><th>Debit</th><th>Credit</th></tr></thead>
        <tbody><tr><td>&nbsp;</td><td></td><td></td></tr></tbody>
        <tfoot><tr><td>Total</td><td>—</td><td>—</td></tr></tfoot>
      </table>
    `;
    return `
      <div class="voucher-card">
        <div class="voucher-header">
          <img src="assets/logo.svg" class="voucher-logo" alt="TxTAIRE" />
          <div class="voucher-title">Payment Voucher</div>
        </div>
        <div class="voucher-row">
          <div>
            <span class="voucher-label">Payee</span><br/><span class="voucher-value">${escapeHtml(v.payTo)}</span>
            ${v.payeeAccountInfo ? `<div class="voucher-subtext">${escapeHtml(v.payeeAccountInfo).replace(/\n/g, '<br/>')}</div>` : ''}
          </div>
          <div>
            <span class="voucher-label">No.</span><br/><span class="voucher-value">${escapeHtml(v.refNo)}</span><br/>
            <span class="voucher-label">Date</span><br/><span class="voucher-value">${fmtDate(v.date)}</span>
          </div>
        </div>
        <table class="voucher-particulars-table">
          <thead><tr><th>Particulars</th><th>Amount</th></tr></thead>
          <tbody>
            ${(particulars.length ? particulars : [{ text: '', amount: '' }]).map(p => `
              <tr><td>${escapeHtml(p.text)}</td><td class="num">${p.amount === '' || p.amount == null ? '' : fmtMoney(Number(p.amount))}</td></tr>
            `).join('')}
          </tbody>
          <tfoot><tr><td>TOTAL AMOUNT</td><td class="num">${fmtMoney(total)}</td></tr></tfoot>
        </table>
        <div class="voucher-distribution">
          <span class="voucher-label">Distribution of Account — Pesos:</span> ${escapeHtml(v.sumOfWords || amountToWords(total))}
        </div>
        <div class="voucher-accounts">${blankAccountTable}${blankAccountTable}</div>
        <div class="voucher-row">
          <div><span class="voucher-label">Bank</span><br/>${escapeHtml(v.bankName || '')}</div>
          <div><span class="voucher-label">Check No.</span><br/>${escapeHtml(v.paymentMethod === 'Check' ? (v.checkNumber || '') : '')}</div>
        </div>
        <div class="voucher-footer">
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Received Payment by</span></div>
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Prepared by</span></div>
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Certified Correct by</span><br/><span class="voucher-value">${escapeHtml(v.certifiedCorrectBy || '')}</span><br/><span class="voucher-sig-title">${escapeHtml(v.certifiedCorrectByTitle || '')}</span></div>
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Approved by</span><br/><span class="voucher-value">${escapeHtml(v.approvedBy || '')}</span><br/><span class="voucher-sig-title">${escapeHtml(v.approvedByTitle || '')}</span></div>
        </div>
      </div>
    `;
  }

  function openVoucherPrintView(vouchersIn) {
    // Printed vouchers always read oldest-to-newest (a ledger/chronological convention,
    // same as the Expense Report), independent of whatever order the on-screen table is
    // currently sorted in. Two DIFFERENT vouchers stacked per portrait page (not the same
    // voucher twice) -- fits two consecutive vouchers per sheet. Portrait matches the
    // default @page rule already in place for the DTR, so no per-view page-size override
    // is needed here.
    const vouchers = vouchersIn.slice().sort((a, b) => a.date.localeCompare(b.date));
    const pages = [];
    if (vouchers.length) {
      for (let i = 0; i < vouchers.length; i += 2) pages.push([vouchers[i], vouchers[i + 1] || null]);
    } else {
      pages.push([null, null]);
    }

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
            ${page.map(v => voucherCardHtml(v)).join('')}
          </div>
        `).join('')}
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#voucher-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#voucher-print-btn').addEventListener('click', () => window.print());
  }

  // ---------------- Billing Invoices ----------------

  function renderBillingInvoicesTab(body, main) {
    const from = billingInvoiceMonth + '-01';
    const to = billingInvoiceMonth + '-31';
    const rows = Store.billingInvoicesInRange(from, to).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const monthLabel = new Date(billingInvoiceMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    body.innerHTML = `
      <div class="filters">
        <div class="field"><label>Month</label><input type="month" id="billing-invoice-month-input" value="${billingInvoiceMonth}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-print-billing-invoices" style="align-self:flex-end;" ${rows.length ? '' : 'disabled'}>🖨 Print Invoices</button>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Billed — ${monthLabel}</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(total)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>BI No.</th><th>Date</th><th>Entity</th><th>Client</th><th class="num">Amount</th><th>Entered By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.biNo)}</td>
                <td class="dim">${fmtDate(r.date)}</td>
                <td class="dim">${escapeHtml(r.entity)}</td>
                <td class="dim">${escapeHtml(r.clientName)}</td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim">${escapeHtml(r.enteredBy || '—')}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-print-billing-invoice="${r.id}">Print</button>
                  <button class="link-btn" data-edit-billing-invoice="${r.id}">Edit</button>
                  <button class="link-btn" data-delete-billing-invoice="${r.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No billing invoices logged for this month.</div>'}
      </div>
    `;

    qs('#billing-invoice-month-input', body).addEventListener('change', (ev) => { billingInvoiceMonth = ev.target.value; renderBillingInvoicesTab(body, main); });
    const printAllBtn = qs('#btn-print-billing-invoices', body);
    if (printAllBtn && !printAllBtn.disabled) printAllBtn.addEventListener('click', () => openBillingInvoicePrintView(rows));
    qsa('[data-print-billing-invoice]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getBillingInvoice(b.dataset.printBillingInvoice);
      if (r) openBillingInvoicePrintView([r]);
    }));
    qsa('[data-edit-billing-invoice]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getBillingInvoice(b.dataset.editBillingInvoice);
      if (r) openBillingInvoiceForm(main, r);
    }));
    qsa('[data-delete-billing-invoice]', body).forEach(b => b.addEventListener('click', async () => {
      const r = Store.getBillingInvoice(b.dataset.deleteBillingInvoice);
      if (!r) return;
      if (!confirm(`Delete billing invoice ${r.biNo} (${fmtMoney(r.amount)})? This cannot be undone.`)) return;
      await Store.deleteBillingInvoice(r.id);
      toast('✔ Billing invoice deleted.');
      renderBillingInvoicesTab(body, main);
    }));
  }

  function openBillingInvoiceForm(main, editing) {
    const letterheadFor = (entity) => BILLING_LETTERHEADS[entity] || BILLING_LETTERHEADS['TXTAIRE OPC'];
    const v = editing || {
      entity: 'TXTAIRE OPC', date: todayISO(),
      clientName: '', clientTin: '', clientAddress: '',
      purchaseOrderNo: '', contactPerson: '', contactNumber: '', invoiceNo: '',
      terms: '30 days upon receipt of invoice',
      payInOrderOf: letterheadFor('TXTAIRE OPC').payInOrderOf,
      preparedBy: '', preparedByTitle: '', approvedBy: '', approvedByTitle: '',
    };
    // A client already on file (seeded from the ledger, or billed before through this app)
    // shouldn't have to be re-typed -- keyed case-insensitively, re-scoped to whichever
    // entity is currently selected (see computeKnownBillingClients).
    let knownClients = computeKnownBillingClients(v.entity);
    // Working copy of the itemized line items -- always at least one row so the editor
    // never renders empty, same convention as the voucher's particulars editor. Amount is
    // derived (qty * unitPrice), not directly typed, matching the real form's math.
    // particulars/quarter/month are new, form-only selection state (see
    // composeBillingParticulars) -- an item saved before this feature existed has none of
    // them, so it's treated as a free-typed "Other" entry, preserving its exact wording
    // rather than discarding it.
    let items = (Array.isArray(v.items) && v.items.length)
      ? v.items.map(it => ({
          qty: it.qty === '' || it.qty == null ? '' : it.qty, unit: it.unit || '',
          particulars: it.particulars || (it.description ? '__other__' : ''),
          customParticulars: it.particulars ? (it.customParticulars || '') : (it.description || ''),
          quarter: it.quarter || '', month: it.month || '', year: it.year || '',
          description: it.description || '', unitPrice: it.unitPrice === '' || it.unitPrice == null ? '' : it.unitPrice,
        }))
      : [{ qty: 1, unit: 'lot', particulars: '', customParticulars: '', quarter: '', month: '', year: '', description: '', unitPrice: '' }];

    openModal(`
      <h2>${editing ? 'Edit Billing Invoice' : 'Add Billing Invoice'}</h2>
      ${editing ? `<div class="modal-sub">BI No.: <strong>${escapeHtml(editing.biNo)}</strong></div>` : '<div class="modal-sub">A BI No. is assigned automatically when saved.</div>'}
      <form id="billing-invoice-form">
        <div class="modal-grid">
          <div class="field"><label>Entity (issuing letterhead)</label>
            <select name="entity" id="billing-invoice-entity">${ENTITY_OPTIONS.map(e => `<option ${e === v.entity ? 'selected' : ''}>${e}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${v.date}" required /></div>
          <div class="field full"><label>Client Name</label>
            <div style="display:flex; gap:8px;">
              <input name="clientName" id="billing-invoice-client-name" list="billing-known-clients" value="${escapeHtml(v.clientName)}" autocomplete="off" required style="flex:1;" />
              <button type="button" class="btn btn-ghost btn-sm" id="btn-new-billing-client">+ New client</button>
            </div>
            <datalist id="billing-known-clients">${Object.values(knownClients).map(c => `<option value="${escapeHtml(c.clientName)}">`).join('')}</datalist>
            <div class="dim" style="margin-top:4px;">Pick a name already on file to fill in their TIN, address, and contact details, or add a new one.</div>
            <div id="billing-new-client-panel" style="display:none; margin-top:8px; border:1px solid var(--border-soft); border-radius:8px; padding:10px;">
              <div class="modal-grid">
                <div class="field full"><label>New client's name</label><input id="new-client-name" /></div>
                <div class="field"><label>TIN</label><input id="new-client-tin" placeholder="e.g. 000-000-000-000" /></div>
                <div class="field"><label>Contact Person</label><input id="new-client-contact-person" /></div>
                <div class="field"><label>Contact Number</label><input id="new-client-contact-number" /></div>
                <div class="field"><label>Address</label><input id="new-client-address" /></div>
              </div>
              <div class="dim" style="margin:2px 0 8px;">Saved for <strong id="new-client-entity-label">${escapeHtml(v.entity)}</strong> -- switch Entity above first if this client bills under a different one.</div>
              <div style="display:flex; gap:8px;">
                <button type="button" class="btn btn-primary btn-sm" id="btn-save-new-client">Save client</button>
                <button type="button" class="btn btn-ghost btn-sm" id="btn-cancel-new-client">Cancel</button>
              </div>
            </div>
          </div>
          <div class="field"><label>Client TIN</label><input name="clientTin" value="${escapeHtml(v.clientTin || '')}" placeholder="e.g. 000-000-000-000" /></div>
          <div class="field"><label>Client Address</label><input name="clientAddress" value="${escapeHtml(v.clientAddress || '')}" /></div>
          <div class="field"><label>Purchase Order No.</label><input name="purchaseOrderNo" value="${escapeHtml(v.purchaseOrderNo || '')}" /></div>
          <div class="field"><label>Contact Person</label><input name="contactPerson" value="${escapeHtml(v.contactPerson || '')}" /></div>
          <div class="field"><label>Contact Number</label><input name="contactNumber" value="${escapeHtml(v.contactNumber || '')}" /></div>
          <div class="field"><label>Invoice No. <span class="dim" style="font-weight:400;">(Sales/Service Invoice, optional)</span></label><input name="invoiceNo" value="${escapeHtml(v.invoiceNo || '')}" /></div>
          <div class="field"><label>Terms</label><input name="terms" value="${escapeHtml(v.terms || '')}" /></div>
          <div class="field full">
            <label>Items</label>
            <div id="billing-invoice-items-rows"></div>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-add-billing-item" style="align-self:flex-start; margin-top:6px;">+ Add line</button>
            <div class="dim" style="margin-top:6px;" id="billing-invoice-totals"></div>
          </div>
          <div class="field"><label>Pay In Order Of</label><input name="payInOrderOf" value="${escapeHtml(v.payInOrderOf || '')}" /></div>
          <div class="field"></div>
          <div class="field"><label>Prepared By — Name</label><input name="preparedBy" value="${escapeHtml(v.preparedBy || '')}" /></div>
          <div class="field"><label>Prepared By — Title</label><input name="preparedByTitle" value="${escapeHtml(v.preparedByTitle || '')}" /></div>
          <div class="field"><label>Approved By — Name</label><input name="approvedBy" value="${escapeHtml(v.approvedBy || '')}" /></div>
          <div class="field"><label>Approved By — Title</label><input name="approvedByTitle" value="${escapeHtml(v.approvedByTitle || '')}" /></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-billing-invoice">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add invoice'}</button>
        </div>
      </form>
    `, (bd) => {
      function itemAmount(it) { return (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); }
      function netTotal() { return items.reduce((s, it) => s + itemAmount(it), 0); }
      function renderTotals() {
        const net = netTotal();
        const vat = net * 0.12;
        qs('#billing-invoice-totals', bd).innerHTML =
          `Net of VAT: <strong>${fmtMoney(net)}</strong> &nbsp;+&nbsp; 12% VAT: <strong>${fmtMoney(vat)}</strong> &nbsp;=&nbsp; Total: <strong>${fmtMoney(net + vat)}</strong>`;
      }
      function itemDateStr() { return qs('input[name="date"]', bd).value || v.date; }
      // A few years back (a quarter/month can be billed late -- see composeBillingParticulars)
      // through one year ahead, centered on the invoice's own year by default.
      function billingYearOptions() {
        const base = Number(itemDateStr().slice(0, 4)) || Number(todayISO().slice(0, 4));
        const years = [];
        for (let y = base - 3; y <= base + 1; y++) years.push(y);
        return years;
      }
      function renderItemRows() {
        const wrap = qs('#billing-invoice-items-rows', bd);
        wrap.innerHTML = items.map((it, i) => `
          <div style="border:1px solid var(--border-soft); border-radius:8px; padding:8px; margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:flex-start; flex-wrap:wrap;">
              <input type="number" min="0" step="0.01" placeholder="Qty" value="${it.qty === '' ? '' : it.qty}" data-item-qty="${i}" style="width:70px;" />
              <input type="text" placeholder="Unit" value="${escapeHtml(it.unit)}" data-item-unit="${i}" style="width:70px;" />
              <select data-item-particulars="${i}" style="flex:1; min-width:200px;">
                <option value="">Select particulars…</option>
                ${BILLING_PARTICULARS_OPTIONS.map(p => `<option value="${escapeHtml(p)}" ${it.particulars === p ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
                <option value="__other__" ${it.particulars === '__other__' ? 'selected' : ''}>Other (type below)…</option>
              </select>
              <input type="number" min="0" step="0.01" placeholder="Unit Price" value="${it.unitPrice === '' ? '' : it.unitPrice}" data-item-price="${i}" style="width:110px;" />
              <span class="dim" style="width:90px; text-align:right; padding-top:8px;" data-item-amount="${i}">${fmtMoney(itemAmount(it))}</span>
              <button type="button" class="link-btn" data-remove-item="${i}" style="color:var(--red);">✕</button>
            </div>
            <div style="display:flex; gap:10px; align-items:center; margin-top:6px; flex-wrap:wrap;">
              ${it.particulars === '__other__' ? `
                <input type="text" placeholder="Custom particulars" value="${escapeHtml(it.customParticulars || '')}" data-item-custom="${i}" style="flex:1; min-width:220px;" />
              ` : it.particulars ? `
                <label class="dim" style="display:flex; align-items:center; gap:4px; font-size:12px;">Quarter
                  <select data-item-quarter="${i}" style="width:auto;">
                    <option value="">—</option>
                    ${['Q1', 'Q2', 'Q3', 'Q4'].map(q => `<option value="${q}" ${it.quarter === q ? 'selected' : ''}>${q}</option>`).join('')}
                  </select>
                </label>
                <label class="dim" style="display:flex; align-items:center; gap:4px; font-size:12px;">Month
                  <select data-item-month="${i}" style="width:auto;">
                    <option value="">—</option>
                    ${BILLING_MONTH_NAMES.map((m, idx) => `<option value="${idx + 1}" ${it.month === String(idx + 1) ? 'selected' : ''}>${m}</option>`).join('')}
                  </select>
                </label>
                <label class="dim" style="display:flex; align-items:center; gap:4px; font-size:12px;">Year
                  <select data-item-year="${i}" style="width:auto;">
                    ${billingYearOptions().map(y => `<option value="${y}" ${String(it.year || itemDateStr().slice(0, 4)) === String(y) ? 'selected' : ''}>${y}</option>`).join('')}
                  </select>
                </label>
                <span class="dim" style="font-size:11.5px;">${escapeHtml(composeBillingParticulars(it, itemDateStr()))}</span>
              ` : ''}
            </div>
          </div>
        `).join('');
        qsa('[data-item-qty]', wrap).forEach(el => el.addEventListener('input', () => {
          items[Number(el.dataset.itemQty)].qty = el.value === '' ? '' : Number(el.value);
          syncItemRow(Number(el.dataset.itemQty));
        }));
        qsa('[data-item-unit]', wrap).forEach(el => el.addEventListener('input', () => {
          items[Number(el.dataset.itemUnit)].unit = el.value;
        }));
        qsa('[data-item-particulars]', wrap).forEach(el => el.addEventListener('change', () => {
          const it = items[Number(el.dataset.itemParticulars)];
          it.particulars = el.value;
          it.description = composeBillingParticulars(it, itemDateStr());
          renderItemRows();
          renderTotals();
        }));
        qsa('[data-item-custom]', wrap).forEach(el => el.addEventListener('input', () => {
          const it = items[Number(el.dataset.itemCustom)];
          it.customParticulars = el.value;
          it.description = composeBillingParticulars(it, itemDateStr());
        }));
        qsa('[data-item-quarter]', wrap).forEach(el => el.addEventListener('change', () => {
          const it = items[Number(el.dataset.itemQuarter)];
          it.quarter = el.value;
          if (el.value) { it.month = ''; if (!it.year) it.year = itemDateStr().slice(0, 4); }
          it.description = composeBillingParticulars(it, itemDateStr());
          renderItemRows();
        }));
        qsa('[data-item-month]', wrap).forEach(el => el.addEventListener('change', () => {
          const it = items[Number(el.dataset.itemMonth)];
          it.month = el.value;
          if (el.value) { it.quarter = ''; if (!it.year) it.year = itemDateStr().slice(0, 4); }
          it.description = composeBillingParticulars(it, itemDateStr());
          renderItemRows();
        }));
        qsa('[data-item-year]', wrap).forEach(el => el.addEventListener('change', () => {
          const it = items[Number(el.dataset.itemYear)];
          it.year = el.value;
          it.description = composeBillingParticulars(it, itemDateStr());
          renderItemRows();
        }));
        qsa('[data-item-price]', wrap).forEach(el => el.addEventListener('input', () => {
          items[Number(el.dataset.itemPrice)].unitPrice = el.value === '' ? '' : Number(el.value);
          syncItemRow(Number(el.dataset.itemPrice));
        }));
        qsa('[data-remove-item]', wrap).forEach(el => el.addEventListener('click', () => {
          items.splice(Number(el.dataset.removeItem), 1);
          if (!items.length) items.push({ qty: 1, unit: 'lot', particulars: '', customParticulars: '', quarter: '', month: '', year: '', description: '', unitPrice: '' });
          renderItemRows();
          renderTotals();
        }));
        function syncItemRow(i) {
          const amountEl = wrap.querySelector(`[data-item-amount="${i}"]`);
          if (amountEl) amountEl.textContent = fmtMoney(itemAmount(items[i]));
          renderTotals();
        }
      }
      renderItemRows();
      renderTotals();
      qs('#btn-add-billing-item', bd).addEventListener('click', () => {
        items.push({ qty: 1, unit: 'lot', particulars: '', customParticulars: '', quarter: '', month: '', year: '', description: '', unitPrice: '' });
        renderItemRows();
        renderTotals();
      });
      // Typing/picking a client name already on file fills in their TIN, address, and
      // contact details -- only into fields still blank, so it never overwrites something
      // the user is deliberately correcting for this particular invoice.
      qs('#billing-invoice-client-name', bd).addEventListener('input', (ev) => {
        const known = knownClients[ev.target.value.trim().toLowerCase()];
        if (!known) return;
        const setIfBlank = (fieldName, value) => {
          const el = qs(`[name="${fieldName}"]`, bd);
          if (el && !el.value.trim() && value) el.value = value;
        };
        setIfBlank('clientTin', known.clientTin);
        setIfBlank('clientAddress', known.clientAddress);
        setIfBlank('contactPerson', known.contactPerson);
        setIfBlank('contactNumber', known.contactNumber);
      });
      // Switching the issuing entity mid-form re-defaults Pay In Order Of to that entity's
      // own name (unless already changed to something else), and refreshes the known-client
      // list/datalist to that entity's own roster -- TXTAIRE REF/OPC and AVISO are separate
      // legal entities with separate client rosters.
      qs('#billing-invoice-entity', bd).addEventListener('change', (ev) => {
        const payField = qs('input[name="payInOrderOf"]', bd);
        const stillDefault = !editing && Object.values(BILLING_LETTERHEADS).some(l => l.payInOrderOf === payField.value);
        if (stillDefault) payField.value = letterheadFor(ev.target.value).payInOrderOf;
        knownClients = computeKnownBillingClients(ev.target.value);
        qs('#billing-known-clients', bd).innerHTML = Object.values(knownClients).map(c => `<option value="${escapeHtml(c.clientName)}">`).join('');
        qs('#new-client-entity-label', bd).textContent = ev.target.value;
      });
      // Changing the invoice date changes which year a Quarter/Month composes into.
      qs('input[name="date"]', bd).addEventListener('change', () => {
        items.forEach((it) => { it.description = composeBillingParticulars(it, itemDateStr()); });
        renderItemRows();
      });

      // "+ New client" -- registers a client (Store.billingClients) for whichever entity is
      // currently selected, so it's pickable from the datalist immediately, without first
      // having to bill them through an actual invoice. Also fills THIS invoice's own client
      // fields right away, so adding the client and using it on the invoice being filled in
      // is one step, not two.
      qs('#btn-new-billing-client', bd).addEventListener('click', () => {
        qs('#billing-new-client-panel', bd).style.display = '';
        qs('#new-client-name', bd).value = qs('#billing-invoice-client-name', bd).value.trim();
        qs('#new-client-name', bd).focus();
      });
      qs('#btn-cancel-new-client', bd).addEventListener('click', () => {
        qs('#billing-new-client-panel', bd).style.display = 'none';
      });
      qs('#btn-save-new-client', bd).addEventListener('click', async () => {
        const name = qs('#new-client-name', bd).value.trim();
        if (!name) { toast('Enter the client’s name first.'); return; }
        const payload = {
          entity: qs('#billing-invoice-entity', bd).value,
          name,
          tin: qs('#new-client-tin', bd).value.trim(),
          address: qs('#new-client-address', bd).value.trim(),
          contactPerson: qs('#new-client-contact-person', bd).value.trim(),
          contactNumber: qs('#new-client-contact-number', bd).value.trim(),
        };
        const btn = qs('#btn-save-new-client', bd);
        btn.disabled = true;
        btn.textContent = 'Saving…';
        try {
          await Store.addBillingClient(payload);
        } catch (e) {
          btn.disabled = false;
          btn.textContent = 'Save client';
          return;   // Store.addBillingClient has already said what went wrong
        }
        toast('✔ Client added.');
        knownClients = computeKnownBillingClients(payload.entity);
        qs('#billing-known-clients', bd).innerHTML = Object.values(knownClients).map(c => `<option value="${escapeHtml(c.clientName)}">`).join('');
        qs('#billing-invoice-client-name', bd).value = payload.name;
        qs('[name="clientTin"]', bd).value = payload.tin;
        qs('[name="clientAddress"]', bd).value = payload.address;
        qs('[name="contactPerson"]', bd).value = payload.contactPerson;
        qs('[name="contactNumber"]', bd).value = payload.contactNumber;
        ['#new-client-name', '#new-client-tin', '#new-client-address', '#new-client-contact-person', '#new-client-contact-number'].forEach((sel) => { qs(sel, bd).value = ''; });
        qs('#billing-new-client-panel', bd).style.display = 'none';
        btn.disabled = false;
        btn.textContent = 'Save client';
      });

      qs('#billing-invoice-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const cleanItems = items
            .map(it => Object.assign({}, it, { description: composeBillingParticulars(it, fd.get('date')) }))
            .filter(it => it.description.trim() || it.unitPrice !== '')
            .map(it => ({
              qty: it.qty === '' ? '' : Number(it.qty), unit: it.unit.trim(),
              particulars: it.particulars || '', customParticulars: it.particulars === '__other__' ? it.customParticulars.trim() : '',
              quarter: it.quarter || '', month: it.month || '', year: it.year || '',
              description: it.description.trim(), unitPrice: it.unitPrice === '' ? '' : Number(it.unitPrice), amount: itemAmount(it),
            }));
          const net = cleanItems.reduce((s, it) => s + (Number(it.amount) || 0), 0);
          const total = net * 1.12;
          const patch = {
            entity: fd.get('entity'),
            date: fd.get('date'),
            clientName: fd.get('clientName').trim(),
            clientTin: fd.get('clientTin').trim(),
            clientAddress: fd.get('clientAddress').trim(),
            purchaseOrderNo: fd.get('purchaseOrderNo').trim(),
            contactPerson: fd.get('contactPerson').trim(),
            contactNumber: fd.get('contactNumber').trim(),
            invoiceNo: fd.get('invoiceNo').trim(),
            terms: fd.get('terms').trim(),
            items: cleanItems,
            amount: total,
            amountInWords: amountToWords(total),
            payInOrderOf: fd.get('payInOrderOf').trim(),
            preparedBy: fd.get('preparedBy').trim(),
            preparedByTitle: fd.get('preparedByTitle').trim(),
            approvedBy: fd.get('approvedBy').trim(),
            approvedByTitle: fd.get('approvedByTitle').trim(),
          };
          if (editing) {
            await Store.updateBillingInvoice(editing.id, patch);
            toast('✔ Billing invoice updated.');
          } else {
            patch.enteredBy = currentUserEmail();
            await Store.addBillingInvoice(patch);
            toast('✔ Billing invoice added.');
          }
          closeModal();
          renderView(main);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? 'Save changes' : 'Add invoice';
        }
      });
      const delBtn = qs('#btn-del-billing-invoice', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this billing invoice? This cannot be undone.')) return;
        await Store.deleteBillingInvoice(editing.id);
        closeModal();
        toast('✔ Billing invoice deleted.');
        renderView(main);
      });
    });
  }

  function billingInvoiceCardHtml(v) {
    const lh = BILLING_LETTERHEADS[v.entity] || BILLING_LETTERHEADS['TXTAIRE OPC'];
    const items = Array.isArray(v.items) ? v.items : [];
    const net = items.length ? items.reduce((s, it) => s + (Number(it.amount) || 0), 0) : (Number(v.amount) || 0) / 1.12;
    const vat = net * 0.12;
    const total = Number(v.amount) || (net + vat);
    return `
      <div class="billing-card">
        <div class="billing-header">
          <img src="${lh.logo}" class="billing-logo" style="height:${lh.logoHeight}px;" alt="${escapeHtml(v.entity)}" />
          <div class="billing-header-text">
            ${lh.name ? `<div class="billing-company-name">${escapeHtml(lh.name)} ${lh.nameSuffix ? `<span class="billing-company-suffix">${escapeHtml(lh.nameSuffix)}</span>` : ''}</div>` : ''}
            ${lh.tagline ? `<div class="billing-tagline">"${escapeHtml(lh.tagline)}"</div>` : ''}
            ${lh.lines.map(l => `<div class="billing-contact-line">${l}</div>`).join('')}
            ${lh.vatTin ? `<div class="billing-contact-line">VAT Reg. TIN: <strong>${escapeHtml(lh.vatTin)}</strong></div>` : ''}
          </div>
        </div>
        <div class="billing-title">BILLING INVOICE</div>
        <div class="billing-meta-table">
          <div class="billing-meta-row">
            <div class="billing-meta-cell wide">
              <div class="billing-label">Client Name</div>
              <div class="billing-value">${escapeHtml(v.clientName)}</div>
              ${v.clientTin ? `<div class="billing-value">TIN: ${escapeHtml(v.clientTin)}</div>` : ''}
            </div>
            <div class="billing-meta-cell wide">
              <div class="billing-label">Client Address</div>
              <div class="billing-value">${escapeHtml(v.clientAddress || '').replace(/\n/g, '<br/>')}</div>
            </div>
            <div class="billing-meta-cell">
              <div class="billing-label">Date</div>
              <div class="billing-value">${fmtDate(v.date)}</div>
            </div>
          </div>
          <div class="billing-meta-row">
            <div class="billing-meta-cell wide">
              <div class="billing-label">Purchase Order No.</div>
              <div class="billing-value">${escapeHtml(v.purchaseOrderNo || '—')}</div>
            </div>
            <div class="billing-meta-cell wide">
              <div class="billing-label">Contact Person</div>
              <div class="billing-value">${escapeHtml(v.contactPerson || '—')}</div>
              <div class="billing-label" style="margin-top:4px;">Contact Number</div>
              <div class="billing-value">${escapeHtml(v.contactNumber || '—')}</div>
            </div>
            <div class="billing-meta-cell">
              <div class="billing-label">Invoice No.</div>
              <div class="billing-value">${escapeHtml(v.invoiceNo || '—')}</div>
              <div class="billing-label" style="margin-top:4px;">Terms</div>
              <div class="billing-value">${escapeHtml(v.terms || '—')}</div>
            </div>
          </div>
        </div>
        <table class="billing-items-table">
          <thead><tr><th class="item">Item</th><th class="qty">Qty</th><th class="unit">Unit</th><th>Description</th><th class="price">Unit Price</th><th class="price">Amount</th></tr></thead>
          <tbody>
            ${items.map((it, i) => `
              <tr>
                <td class="item">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] || (i + 1)}</td>
                <td class="qty">${it.qty === '' || it.qty == null ? '' : Number(it.qty).toLocaleString()}</td>
                <td class="unit">${escapeHtml(it.unit || '')}</td>
                <td>${escapeHtml(it.description || '')}</td>
                <td class="price">${it.unitPrice === '' || it.unitPrice == null ? '' : fmtMoney(Number(it.unitPrice))}</td>
                <td class="price">${it.amount === '' || it.amount == null ? '' : fmtMoney(Number(it.amount))}</td>
              </tr>
            `).join('')}
            <tr><td colspan="6" class="billing-nothing-follows">** NOTHING FOLLOWS **</td></tr>
            <tr class="billing-fill-row"><td colspan="6"></td></tr>
            <tr>
              <td colspan="4" rowspan="3" class="billing-words-cell">
                <div class="billing-label">Amount In Words:</div>
                <div class="billing-value">${escapeHtml(v.amountInWords || amountToWords(total))}</div>
                <div class="billing-label" style="margin-top:8px;">Pay In Order Of:</div>
                <div class="billing-value" style="text-decoration:underline;">${escapeHtml(v.payInOrderOf || '')}</div>
              </td>
              <td class="billing-total-label">Net of VAT</td><td class="price">${fmtMoney(net)}</td>
            </tr>
            <tr><td class="billing-total-label">Add: 12% VAT</td><td class="price">${fmtMoney(vat)}</td></tr>
            <tr class="billing-total-final"><td class="billing-total-label">Total Amount</td><td class="price">${fmtMoney(total)}</td></tr>
          </tbody>
        </table>
        <div class="billing-footer">
          <div><span class="billing-label">Prepared By:</span><div class="billing-sig-blank"></div><span class="billing-value">${escapeHtml(v.preparedBy || '')}</span><br/><span class="billing-sig-title">${escapeHtml(v.preparedByTitle || '')}</span></div>
          <div><span class="billing-label">Approved By:</span><div class="billing-sig-blank"></div><span class="billing-value">${escapeHtml(v.approvedBy || '')}</span><br/><span class="billing-sig-title">${escapeHtml(v.approvedByTitle || '')}</span></div>
          <div><span class="billing-label">Received By:</span><div class="billing-sig-blank"></div><span class="billing-sig-title">Printed Name &amp; Signature</span></div>
        </div>
      </div>
    `;
  }

  function openBillingInvoicePrintView(invoicesIn) {
    // Oldest-to-newest, same ledger convention as vouchers/expense reports. Unlike
    // vouchers (2 short slips per sheet), a real Billing Invoice is a full standalone
    // page, so one invoice = one page here.
    const invoices = invoicesIn.slice().sort((a, b) => a.date.localeCompare(b.date));
    const overlay = document.createElement('div');
    overlay.className = 'billing-overlay';
    overlay.innerHTML = `
      <div class="billing-print">
        <div class="billing-actions no-print">
          <button class="btn btn-ghost btn-sm" id="billing-close">Close</button>
          <button class="btn btn-primary btn-sm" id="billing-print-btn">Print / Save as PDF</button>
        </div>
        ${invoices.map(v => `<div class="billing-page">${billingInvoiceCardHtml(v)}</div>`).join('')}
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#billing-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#billing-print-btn').addEventListener('click', () => window.print());
  }

  return { render: renderView };
})();
