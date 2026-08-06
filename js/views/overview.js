window.Views.overview = {
  render(main) {
    const employees = Store.listEmployees();
    const candidates = Store.listCandidates();
    const cases = Store.listCases();
    const complaints = Store.listComplaints();
    const today = todayISO();
    const todayAttendance = Store.attendanceForDate(today);

    const probations = Store.listProbations().map(r => ({
      r, emp: Store.getEmployee(r.employeeId),
      thirdDue: addMonths(r.startDate, 3), sixthDue: addMonths(r.startDate, 6),
    })).filter(row => row.emp);
    const probationAlerts = probations.filter(row =>
      (row.r.thirdMonthStatus === 'Pending' && daysBetween(today, row.thirdDue) <= 14) ||
      (row.r.sixthMonthStatus === 'Pending' && daysBetween(today, row.sixthDue) <= 14)
    ).sort((a, b) => {
      const aDue = a.r.thirdMonthStatus === 'Pending' ? a.thirdDue : a.sixthDue;
      const bDue = b.r.thirdMonthStatus === 'Pending' ? b.thirdDue : b.sixthDue;
      return aDue.localeCompare(bDue);
    });

    const activeEmployees = employees.filter(e => e.status === 'Active').length;
    const byCategory = CATEGORIES.map(cat => ({
      cat, count: employees.filter(e => e.category === cat).length
    }));

    const openCandidates = candidates.filter(c => c.stage !== 'Decision').length;
    const openCases = cases.filter(c => c.status !== 'Resolved').length;
    const openComplaints = complaints.filter(c => c.status === 'Open' || c.status === 'In Progress').length;

    const present = todayAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;

    const upcomingTradeTests = candidates
      .filter(c => c.tradeTestEnd && c.tradeTestEnd >= today)
      .sort((a, b) => a.tradeTestEnd.localeCompare(b.tradeTestEnd))
      .slice(0, 5);

    const recentCases = cases.slice().sort((a, b) => b.dateIssued.localeCompare(a.dateIssued)).slice(0, 4);
    const recentComplaints = complaints.slice().sort((a, b) => b.dateReceived.localeCompare(a.dateReceived)).slice(0, 4);

    main.innerHTML = `
      <div class="crumb">TxTAIRE</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Overview</h1>
          <div class="page-sub">Company-wide snapshot across HR, recruitment, disciplinary cases, and customer complaints.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-export-records" title="Attendance + payroll summary per employee, for a month/quarter/year">📊 Download Employee Records</button>
          <button class="btn btn-ghost" id="btn-download-backup" title="Download every table as one JSON file">⬇ Download Backup</button>
        </div>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-label">Total Employees</div>
          <div class="kpi-value">${employees.length}</div>
          <div class="kpi-sub">${activeEmployees} active</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">On Shift Today</div>
          <div class="kpi-value green">${present}</div>
          <div class="kpi-sub">of ${todayAttendance.length} logged today</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Recruitment Pipeline</div>
          <div class="kpi-value">${openCandidates}</div>
          <div class="kpi-sub">candidates in progress</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Active NTE Cases</div>
          <div class="kpi-value ${openCases ? 'red' : ''}">${openCases}</div>
          <div class="kpi-sub">of ${cases.length} total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Open Complaints</div>
          <div class="kpi-value ${openComplaints ? 'red' : ''}">${openComplaints}</div>
          <div class="kpi-sub">of ${complaints.length} total</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Probation Evaluations Due</div>
          <div class="kpi-value ${probationAlerts.length ? 'red' : ''}">${probationAlerts.length}</div>
          <div class="kpi-sub">3rd/6th month, within 14 days or overdue</div>
        </div>
      </div>

      ${probationAlerts.length ? `
      <div class="section-title">Probation Evaluations Due Soon</div>
      <div class="panel">
        <table>
          <thead><tr><th>Employee</th><th>Position</th><th>Milestone</th><th>Due</th></tr></thead>
          <tbody>
            ${probationAlerts.map(row => {
              const isThird = row.r.thirdMonthStatus === 'Pending' && daysBetween(today, row.thirdDue) <= 14;
              const due = isThird ? row.thirdDue : row.sixthDue;
              const diff = daysBetween(today, due);
              const badge = diff < 0 ? `<span class="badge badge-red">Overdue ${Math.abs(diff)}d</span>` : `<span class="badge badge-yellow">Due in ${diff}d</span>`;
              return `
              <tr>
                <td class="name">${escapeHtml(row.emp.name)}</td>
                <td class="dim">${escapeHtml(row.emp.position)}</td>
                <td>${isThird ? '3rd Month' : '6th Month'}</td>
                <td class="dim">${fmtDate(due)} ${badge}</td>
              </tr>
            `; }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="two-col">
        <div>
          <div class="panel">
            <div class="panel-head">
              <h3>Headcount by Category</h3>
            </div>
            <table>
              <thead><tr><th>Category</th><th class="num">Employees</th><th>Roles</th></tr></thead>
              <tbody>
                ${byCategory.map(b => `
                  <tr>
                    <td class="name">${b.cat}</td>
                    <td class="num">${b.count}</td>
                    <td class="dim">${escapeHtml(employees.filter(e => e.category === b.cat).map(e => e.position).join(', ') || '—')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section-title">Recent Disciplinary Cases</div>
          <div class="panel">
            ${recentCases.length ? `
            <table>
              <thead><tr><th>Employee</th><th>Violation</th><th>Status</th><th>Date Issued</th></tr></thead>
              <tbody>
                ${recentCases.map(c => `
                  <tr>
                    <td class="name">${escapeHtml(employeeName(c.employeeId))}</td>
                    <td class="dim">${escapeHtml(c.violation)}</td>
                    <td>${caseStatusBadge(c.status)}</td>
                    <td class="dim">${fmtDate(c.dateIssued)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty">No disciplinary cases on file.</div>'}
          </div>
        </div>

        <div>
          <div class="panel">
            <div class="panel-head"><h3>Upcoming / Active Trade Tests</h3></div>
            ${upcomingTradeTests.length ? `
            <table>
              <thead><tr><th>Candidate</th><th>Ends</th></tr></thead>
              <tbody>
                ${upcomingTradeTests.map(c => `
                  <tr>
                    <td class="name">${escapeHtml(c.name)}<div class="dim" style="font-size:11px;">${escapeHtml(c.positionAppliedFor)}</div></td>
                    <td class="dim">${fmtDate(c.tradeTestEnd)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty">No active trade tests.</div>'}
          </div>

          <div class="section-title">Recent Complaints</div>
          <div class="panel">
            ${recentComplaints.length ? `
            <table>
              <thead><tr><th>Customer</th><th>Status</th></tr></thead>
              <tbody>
                ${recentComplaints.map(c => `
                  <tr>
                    <td class="name">${escapeHtml(c.customerName)}<div class="dim" style="font-size:11px;">${fmtDate(c.dateReceived)}</div></td>
                    <td>${complaintStatusBadge(c.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<div class="empty">No complaints on file.</div>'}
          </div>
        </div>
      </div>
    `;

    qs('#btn-download-backup', main).addEventListener('click', () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: currentUserEmail(),
        data: Store.exportAllData(),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `txtaire-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      Store.logAudit('backup.export', 'all_tables', null, { tables: Object.keys(payload.data) });
      toast('✔ Backup downloaded');
    });

    qs('#btn-export-records', main).addEventListener('click', () => openEmployeeRecordsExportModal());
  }
};

// One row per employee, summing the exact same computeRow() figures the Payroll page
// shows -- but per actual payroll cutoff, then totaled across every cutoff whose END date
// falls in the chosen month/quarter/year, never by calling computeRow() across a whole
// month/quarter/year directly. Withholding tax uses semi-monthly (per-cutoff) BIR
// brackets, so taxing a full quarter/year's gross in one shot would apply those brackets
// to a much bigger number and come out badly wrong -- computing and summing cutoff by
// cutoff keeps every figure correct, it's just added up afterward.
function openEmployeeRecordsExportModal() {
  const now = new Date(todayISO() + 'T00:00:00');
  openModal(`
    <h2>Download Employee Records</h2>
    <div class="modal-sub">One row per employee (including terminated/past staff, for historical record-keeping), summarizing attendance and payroll for the period you choose.</div>
    <form id="records-export-form">
      <div class="modal-grid">
        <div class="field full"><label>Period type</label>
          <div class="seg" id="seg-period-type">
            <button type="button" data-val="monthly" class="active">Monthly</button>
            <button type="button" data-val="quarterly">Quarterly</button>
            <button type="button" data-val="yearly">Yearly</button>
          </div>
        </div>
        <div id="period-picker-wrap" class="field full"></div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Download Excel</button>
      </div>
    </form>
  `, (bd) => {
    let periodType = 'monthly';
    const pickerWrap = qs('#period-picker-wrap', bd);
    const quarterLabels = ['Jan–Mar', 'Apr–Jun', 'Jul–Sep', 'Oct–Dec'];

    function renderPicker() {
      if (periodType === 'monthly') {
        pickerWrap.innerHTML = `<label>Month</label><input type="month" name="month" value="${now.getFullYear()}-${pad2(now.getMonth() + 1)}" required />`;
      } else if (periodType === 'quarterly') {
        const q = Math.floor(now.getMonth() / 3) + 1;
        pickerWrap.innerHTML = `
          <label>Quarter</label>
          <div style="display:flex; gap:8px;">
            <select name="quarter">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === q ? 'selected' : ''}>Q${n} (${quarterLabels[n - 1]})</option>`).join('')}</select>
            <input type="number" name="year" value="${now.getFullYear()}" min="2000" max="2100" style="width:90px;" />
          </div>
        `;
      } else {
        pickerWrap.innerHTML = `<label>Year</label><input type="number" name="year" value="${now.getFullYear()}" min="2000" max="2100" style="width:120px;" />`;
      }
    }
    renderPicker();

    qsa('#seg-period-type button', bd).forEach(b => b.addEventListener('click', () => {
      qsa('#seg-period-type button', bd).forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      periodType = b.dataset.val;
      renderPicker();
    }));

    qs('#records-export-form', bd).addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      let months, label;
      if (periodType === 'monthly') {
        const [y, m] = fd.get('month').split('-').map(Number);
        months = [{ year: y, month: m }];
        label = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (periodType === 'quarterly') {
        const y = Number(fd.get('year'));
        const q = Number(fd.get('quarter'));
        const startMonth = (q - 1) * 3 + 1;
        months = [0, 1, 2].map(i => ({ year: y, month: startMonth + i }));
        label = `Q${q} ${y}`;
      } else {
        const y = Number(fd.get('year'));
        months = Array.from({ length: 12 }, (_, i) => ({ year: y, month: i + 1 }));
        label = String(y);
      }
      const submitBtn = qs('button[type="submit"]', bd);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Generating…';
      await downloadEmployeeRecordsWorkbook(months, label);
      closeModal();
    });
  });
}

const RECORDS_EXPORT_COLUMNS = [
  'Employee Code', 'Name', 'Category', 'Position', 'Pay Type',
  'Days Present', 'Days Absent', 'Base Pay', 'COLA', 'Housing Allowance', 'NSD', 'OT',
  'Holiday Pay', 'Gross Pay', 'Withholding Tax', 'Deductions', 'Bonuses', 'Net Pay',
];
const RECORDS_EXPORT_MONEY_COLUMNS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]; // 1-based
const RECORDS_EXPORT_NET_PAY_COLUMN = 18;
const RECORDS_EXPORT_BLUE = 'FF2F6FED'; // matches css/styles.css --accent
const RECORDS_EXPORT_GREEN = 'FF15803D'; // matches css/styles.css --green

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// One row per employee per sheet, summing the exact same computeRow() figures the
// Payroll page shows -- but per actual payroll cutoff, then totaled across every cutoff
// whose END date falls in that sheet's month, never by calling computeRow() across the
// whole month in one shot. Withholding tax uses semi-monthly (per-cutoff) BIR brackets,
// so taxing a full month's combined gross at once would apply those brackets to a bigger
// number and come out wrong -- computing and summing cutoff by cutoff keeps every figure
// correct, it's just added up afterward.
function addRecordsMonthSheet(workbook, employees, year, month) {
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const sheet = workbook.addWorksheet(monthLabel);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const headerRow = sheet.addRow(RECORDS_EXPORT_COLUMNS);
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: RECORDS_EXPORT_BLUE } };
    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  employees.forEach((emp) => {
    const t = {
      daysPresent: 0, daysAbsent: 0, basePay: 0, colaPay: 0, housingPay: 0, nsdPay: 0,
      otPay: 0, holidayPay: 0, gross: 0, tax: 0, dedTotal: 0, bonusTotal: 0, net: 0,
    };
    payCutoffs(emp.payCycle, year, month).forEach((c) => {
      const row = computeRow(emp, c.from, c.to);
      Object.keys(t).forEach((k) => { t[k] += row[k]; });
    });
    const dataRow = sheet.addRow([
      emp.employeeCode || '', emp.name, emp.category, emp.position || '', emp.payType,
      t.daysPresent, t.daysAbsent,
      round2(t.basePay), round2(t.colaPay), round2(t.housingPay),
      round2(t.nsdPay), round2(t.otPay), round2(t.holidayPay),
      round2(t.gross), round2(t.tax), round2(t.dedTotal), round2(t.bonusTotal), round2(t.net),
    ]);
    // Net Pay stands out in green, same as every other Net Pay figure across this
    // dashboard (Payroll page, DTR, ESS My Payroll) -- consistent color language.
    const netCell = dataRow.getCell(RECORDS_EXPORT_NET_PAY_COLUMN);
    netCell.font = { color: { argb: RECORDS_EXPORT_GREEN }, bold: true };
  });

  RECORDS_EXPORT_MONEY_COLUMNS.forEach((colNum) => {
    sheet.getColumn(colNum).numFmt = '#,##0.00';
  });
  sheet.columns.forEach((col, i) => {
    col.width = Math.max(RECORDS_EXPORT_COLUMNS[i].length + 2, 12);
  });
}

async function downloadEmployeeRecordsWorkbook(months, label) {
  const employees = Store.listEmployees();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TxTAIRE Dashboard';
  workbook.created = new Date();
  // Always one sheet per calendar month -- a Monthly export is naturally just one sheet;
  // Quarterly/Yearly split into their 3 or 12 months instead of one giant combined sheet,
  // so each month's figures stay easy to read on their own tab.
  months.forEach(({ year, month }) => addRecordsMonthSheet(workbook, employees, year, month));

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `employee-records-${label.replace(/[\s,()–]+/g, '-').replace(/-+$/, '')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  Store.logAudit('records.export', 'employees', null, { period: label, employees: employees.length, sheets: months.length });
  toast('✔ Employee records downloaded.');
}
