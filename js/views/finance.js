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
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Expenses &amp; Receipts</div>
        <div class="tab ${activeTab === 'bills' ? 'active' : ''}" data-tab="bills">Bill Reminders</div>
        <div class="tab ${activeTab === 'vouchers' ? 'active' : ''}" data-tab="vouchers">Payment Vouchers</div>
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

    if (activeTab === 'expenses') renderExpensesTab(qs('#tab-body', main), main);
    else if (activeTab === 'bills') renderBillsTab(qs('#tab-body', main), main);
    else if (activeTab === 'vouchers') renderVouchersTab(qs('#tab-body', main), main);
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
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Prepared by</span><br/><span class="voucher-sig-title">Accounting Officer</span></div>
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Certified Correct by</span><br/><span class="voucher-value">${escapeHtml(v.certifiedCorrectBy || '')}</span><br/><span class="voucher-sig-title">${escapeHtml(v.certifiedCorrectByTitle || '')}</span></div>
          <div><div class="voucher-sig-blank"></div><span class="voucher-label">Approved by</span><br/><span class="voucher-value">${escapeHtml(v.approvedBy || '')}</span><br/><span class="voucher-sig-title">${escapeHtml(v.approvedByTitle || '')}</span></div>
        </div>
      </div>
    `;
  }

  function openVoucherPrintView(vouchersIn) {
    // Printed vouchers always read oldest-to-newest (a ledger/chronological convention,
    // same as the Expense Report), independent of whatever order the on-screen table is
    // currently sorted in. Each voucher gets its own landscape page, printed TWICE side by
    // side (office copy + payee copy) -- matches the company's real paper form, which
    // duplicates one voucher per sheet rather than fitting several different ones on it.
    const vouchers = vouchersIn.slice().sort((a, b) => a.date.localeCompare(b.date));
    const pages = vouchers.length ? vouchers.map(v => [v, v]) : [[null, null]];

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

  return { render: renderView };
})();
