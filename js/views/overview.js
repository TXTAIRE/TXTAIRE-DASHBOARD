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
        <button class="btn btn-ghost" id="btn-download-backup" title="Download every table as one JSON file">⬇ Download Backup</button>
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
  }
};
