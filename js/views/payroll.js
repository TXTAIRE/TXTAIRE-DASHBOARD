window.Views.payroll = (function () {
  let activeTab = 'payroll';
  const today = new Date(todayISO() + 'T00:00:00');
  let group = '10-20';
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  let half = defaultCutoffHalf(group, today.getDate());

  function setGroup(g) {
    group = g;
    half = defaultCutoffHalf(group, new Date(todayISO() + 'T00:00:00').getDate());
  }

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    month = m; year = y;
  }

  function computeRow(emp, from, to) {
    const presentRecords = Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id && (a.status === 'Present' || a.status === 'Late'));
    const attendanceDays = presentRecords.length;
    const override = Store.getPayrollOverride(emp.id, from);
    const daysPresent = override ? Number(override.daysPresent) : attendanceDays;
    const isOverridden = !!override;
    const basePay = emp.payType === 'Daily' ? emp.rate * daysPresent : emp.rate;
    const allowance = (emp.allowancePerDay || 0) * daysPresent + (emp.fixedAllowance || 0);
    // Night shift differential = (hours ÷ 8) × (daily rate × 10%), summed per logged attendance day.
    // Always computed from actual attendance records (needs real hours logged that day) even if
    // "days present" above was manually overridden for base pay/allowance purposes.
    const nightDiff = emp.nightShiftDifferential
      ? presentRecords.reduce((s, r) => s + (Number(r.hours) || 0) / 8 * (emp.rate * 0.10), 0)
      : 0;
    const gross = basePay + allowance + nightDiff;
    const tax = withholdingTax(gross);
    const dedTotal = Store.deductionsInRange(from, to).filter(d => d.employeeId === emp.id).reduce((s, d) => s + Number(d.amount), 0);
    const net = gross - tax - dedTotal;
    return { emp, daysPresent, isOverridden, basePay, allowance, nightDiff, gross, tax, dedTotal, net };
  }

  function renderView(main) {
    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Payroll</h1>
          <div class="page-sub">Engineers, Managers, and Admins are paid every 10th &amp; 20th of the month. Technicians are paid every 15th &amp; 30th/31st. Gross pay = base pay + allowance + night shift differential; net pay = gross pay − withholding tax − deductions.</div>
        </div>
        ${activeTab === 'deductions' ? '<button class="btn btn-primary" id="btn-new-deduction">+ New deduction</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'payroll' ? 'active' : ''}" data-tab="payroll">Payroll</div>
        <div class="tab ${activeTab === 'deductions' ? 'active' : ''}" data-tab="deductions">Deductions</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnNew = qs('#btn-new-deduction', main);
    if (btnNew) btnNew.addEventListener('click', () => openDeductionForm(main));

    if (activeTab === 'payroll') renderPayrollTab(qs('#tab-body', main), main);
    else renderDeductionsTab(qs('#tab-body', main), main);
  }

  function renderPayrollTab(body, main) {
    const cutoffs = payCutoffs(group, year, month);
    const selected = cutoffs.find(c => c.key === half) || cutoffs[0];
    const monthValue = `${year}-${pad2(month)}`;
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const employees = Store.listEmployees().filter(e => e.payCycle === group && e.status !== 'Terminated');
    const rows = employees.map(e => computeRow(e, selected.from, selected.to));
    rows.sort((a, b) => a.emp.name.localeCompare(b.emp.name));

    const totalGross = rows.reduce((s, r) => s + r.gross, 0);
    const totalAllowance = rows.reduce((s, r) => s + r.allowance, 0);
    const totalNightDiff = rows.reduce((s, r) => s + r.nightDiff, 0);
    const totalTax = rows.reduce((s, r) => s + r.tax, 0);
    const totalDed = rows.reduce((s, r) => s + r.dedTotal, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Pay group</label>
          <div class="seg" id="seg-group">
            <button data-val="10-20" class="${group === '10-20' ? 'active' : ''}">Engineers / Managers / Admins</button>
            <button data-val="15-30" class="${group === '15-30' ? 'active' : ''}">Technicians</button>
          </div>
        </div>
      </div>

      <div class="filters">
        <button class="btn btn-ghost btn-sm" id="btn-prev-month">← Prev month</button>
        <div class="field"><label>Month</label><input type="month" id="month-input" value="${monthValue}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-next-month">Next month →</button>
        <div class="field">
          <label>Cutoff</label>
          <div class="seg" id="seg-cutoff">
            ${cutoffs.map(c => `<button data-val="${c.key}" class="${half === c.key ? 'active' : ''}">${c.label}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="page-sub" style="margin-bottom:10px;">${monthLabel} · ${selected.label} · payday ${fmtDate(selected.payDate)} · ${rows.length} staff on this schedule</div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Gross</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(totalGross)}</div><div class="kpi-sub">incl. ${fmtMoney(totalAllowance)} allowance, ${fmtMoney(totalNightDiff)} night diff.</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Withholding Tax</div><div class="kpi-value ${totalTax ? 'red' : ''}" style="font-size:20px;">${fmtMoney(totalTax)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Deductions</div><div class="kpi-value ${totalDed ? 'red' : ''}" style="font-size:20px;">${fmtMoney(totalDed)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Net Pay</div><div class="kpi-value green" style="font-size:20px;">${fmtMoney(totalNet)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Staff on Schedule</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="hint">Days present is editable — type over it and press Enter or click away to recompute base pay, allowance, gross, tax, and net pay for that cutoff. Edited values are saved and override the attendance-derived count. Night shift differential is the exception: it's always computed from actual logged attendance hours for that cutoff, regardless of any days-present override.</div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Staff</th><th>Position</th><th class="num">Days Present</th><th class="num">Base Pay</th><th class="num">Allowance</th><th class="num">Night Diff.</th><th class="num">Gross Pay</th><th class="num">Withholding Tax</th><th class="num">Deductions</th><th class="num">Net Pay</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.emp.name)}</td>
                <td class="dim">${escapeHtml(r.emp.position)}</td>
                <td class="num">
                  <input type="number" class="days-input" min="0" step="0.5" value="${r.daysPresent}" data-emp="${r.emp.id}" title="${r.isOverridden ? 'Manually edited — overrides attendance count' : 'From attendance records'}" style="${r.isOverridden ? 'border-color:var(--accent);' : ''}" />
                </td>
                <td class="num">${fmtMoney(r.basePay)}</td>
                <td class="num ${r.allowance ? '' : 'dim'}">${r.allowance ? fmtMoney(r.allowance) : '—'}</td>
                <td class="num ${r.nightDiff ? '' : 'dim'}">${r.nightDiff ? fmtMoney(r.nightDiff) : '—'}</td>
                <td class="num" style="font-weight:600;">${fmtMoney(r.gross)}</td>
                <td class="num ${r.tax ? '' : 'dim'}">${r.tax ? fmtMoney(r.tax) : '—'}</td>
                <td class="num ${r.dedTotal ? '' : 'dim'}">${r.dedTotal ? fmtMoney(r.dedTotal) : '—'}</td>
                <td class="num" style="font-weight:700;">${fmtMoney(r.net)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No staff assigned to this pay schedule.</div>'}
      </div>
    `;

    qsa('.days-input', body).forEach(input => {
      input.addEventListener('change', async () => {
        const val = Number(input.value);
        if (!isNaN(val) && val >= 0) {
          await Store.setPayrollOverride(input.dataset.emp, selected.from, val);
          renderPayrollTab(body, main);
        }
      });
    });
    qsa('#seg-group button', body).forEach(b => b.addEventListener('click', () => { setGroup(b.dataset.val); renderPayrollTab(body, main); }));
    qsa('#seg-cutoff button', body).forEach(b => b.addEventListener('click', () => { half = b.dataset.val; renderPayrollTab(body, main); }));
    qs('#month-input', body).addEventListener('change', (ev) => {
      const [y, m] = ev.target.value.split('-').map(Number);
      year = y; month = m;
      renderPayrollTab(body, main);
    });
    qs('#btn-prev-month', body).addEventListener('click', () => { shiftMonth(-1); renderPayrollTab(body, main); });
    qs('#btn-next-month', body).addEventListener('click', () => { shiftMonth(1); renderPayrollTab(body, main); });
  }

  function renderDeductionsTab(body, main) {
    const rows = Store.listDeductions().slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, d) => s + Number(d.amount), 0);

    body.innerHTML = `
      <div class="hint">Deductions roll up to each staff member's net pay on the Payroll tab, matched by date against the selected cutoff. Use this list to log cash advances, tardiness, damage, and anything else under "Other."</div>
      <div class="panel">
        <div class="panel-head"><h3>${rows.length} entries</h3><div class="dim">Total ${fmtMoney(total)}</div></div>
        ${rows.length ? `
        <table>
          <thead><tr><th>Date</th><th>Staff</th><th>Kind</th><th>Notes</th><th class="num">Amount</th><th></th></tr></thead>
          <tbody>
            ${rows.map(d => `
              <tr>
                <td class="dim">${fmtDate(d.date)}</td>
                <td class="name">${escapeHtml(employeeName(d.employeeId))}</td>
                <td><span class="badge badge-gray">${d.kind}</span></td>
                <td class="dim">${escapeHtml(d.notes || '—')}</td>
                <td class="num">${fmtMoney(d.amount)}</td>
                <td><button class="link-btn" data-del="${d.id}">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No deductions yet. Add one with the button above.</div>'}
      </div>
    `;

    qsa('[data-del]', body).forEach(b => b.addEventListener('click', async () => {
      if (confirm('Delete this deduction?')) {
        await Store.deleteDeduction(b.dataset.del);
        toast('Deduction deleted.');
        renderDeductionsTab(body, main);
      }
    }));
  }

  function openDeductionForm(main) {
    openModal(`
      <h2>New deduction</h2>
      <form id="ded-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select name="employeeId">${employeeOptions()}</select></div>
          <div class="field"><label>Date</label><input type="date" name="date" value="${todayISO()}" /></div>
          <div class="field"><label>Kind</label>
            <select name="kind">${['Cash Advance', 'Tardy', 'Damage', 'Other'].map(k => `<option>${k}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" required /></div>
          <div class="field full"><label>Notes</label><textarea name="notes" rows="2"></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Add deduction</button>
        </div>
      </form>
    `, (bd) => {
      qs('#ded-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addDeduction({
          employeeId: fd.get('employeeId'),
          date: fd.get('date'),
          kind: fd.get('kind'),
          notes: fd.get('notes').trim(),
          amount: Number(fd.get('amount')) || 0,
        });
        toast('Deduction added.');
        closeModal();
        renderView(main);
      });
    });
  }

  return { render: renderView };
})();
