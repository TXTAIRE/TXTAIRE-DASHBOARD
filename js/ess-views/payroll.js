window.EssViews.payroll = (function () {
  let showDetails = false;

  function render(main, emp) {
    const today = new Date(todayISO() + 'T00:00:00');
    const pos = defaultCutoffPosition(emp.payCycle, today.getFullYear(), today.getMonth() + 1, today.getDate());
    const cutoffs = payCutoffs(emp.payCycle, pos.year, pos.month);
    const selected = cutoffs.find(c => c.key === pos.half) || cutoffs[0];
    const row = computeRow(emp, selected.from, selected.to);
    const release = Store.getPayrollRelease(emp.payCycle, selected.from);

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">My Payroll</div>
      <div class="ess-sub" style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span>${selected.label} · payday ${fmtDate(selected.payDate)}</span>
        ${release ? `<span class="badge badge-green">Released ${fmtDate(release.releasedAt.slice(0, 10))}</span>` : `<span class="badge badge-yellow">Not yet released</span>`}
      </div>

      <div class="ess-card" style="text-align:center;">
        <div class="ess-card-label">Net Pay</div>
        <div class="ess-big-value" style="color:var(--green);">${fmtMoney(row.net)}</div>
        <div class="ess-sub">Gross ${fmtMoney(row.gross)} − Tax ${fmtMoney(row.tax)} − Deductions ${fmtMoney(row.dedTotal)}</div>
      </div>

      <div class="ess-card">
        <div class="ess-row"><span class="label">Gross Pay</span><span class="value">${fmtMoney(row.gross)}</span></div>
        <div class="ess-row"><span class="label">Overtime Pay</span><span class="value">${fmtMoney(row.otPay)}</span></div>
        <div class="ess-row"><span class="label">Holiday Pay</span><span class="value">${fmtMoney(row.holidayPay)}</span></div>
        <div class="ess-row"><span class="label">COLA</span><span class="value">${fmtMoney(row.colaPay)}</span></div>
        <div class="ess-row"><span class="label">Deductions</span><span class="value">${fmtMoney(row.dedTotal)}</span></div>
      </div>

      <button class="btn btn-ghost btn-sm" id="btn-toggle-details" style="width:100%; justify-content:center;">${showDetails ? 'Hide' : 'View'} full details</button>

      ${showDetails ? `
      <div class="ess-card" style="margin-top:12px;">
        <div class="ess-row"><span class="label">Days Present</span><span class="value">${row.daysPresent}</span></div>
        <div class="ess-row"><span class="label">Absent</span><span class="value">${row.daysAbsent}</span></div>
        <div class="ess-row"><span class="label">Base Pay</span><span class="value">${fmtMoney(row.basePay)}</span></div>
        <div class="ess-row"><span class="label">COLA</span><span class="value">${fmtMoney(row.colaPay)}</span></div>
        <div class="ess-row"><span class="label">Housing Allowance</span><span class="value">${fmtMoney(row.housingPay)}</span></div>
        <div class="ess-row"><span class="label">Night Shift Differential</span><span class="value">${fmtMoney(row.nsdPay)}</span></div>
        <div class="ess-row"><span class="label">Overtime Pay</span><span class="value">${fmtMoney(row.otPay)}</span></div>
        <div class="ess-row"><span class="label">Holiday Pay</span><span class="value">${fmtMoney(row.holidayPay)}</span></div>
        <div class="ess-row"><span class="label">Withholding Tax</span><span class="value">${fmtMoney(row.tax)}</span></div>
        <div class="ess-row"><span class="label">Deductions</span><span class="value">${fmtMoney(row.dedTotal)}</span></div>
        <div class="ess-row"><span class="label" style="font-weight:700;">Net Pay</span><span class="value" style="color:var(--green);">${fmtMoney(row.net)}</span></div>
      </div>
      ` : ''}
    `;

    qs('#btn-toggle-details', main).addEventListener('click', () => { showDetails = !showDetails; render(main, emp); });
  }

  return { render };
})();
