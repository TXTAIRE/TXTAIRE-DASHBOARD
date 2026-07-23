window.Views.overview = {
  render(main) {
    const employees = Store.listEmployees();
    const candidates = Store.listCandidates();
    const cases = Store.listCases();
    const complaints = Store.listComplaints();
    const today = todayISO();
    const todayAttendance = Store.attendanceForDate(today);

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
      </div>

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
  }
};
