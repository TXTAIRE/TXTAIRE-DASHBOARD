window.EssViews.payroll = (function () {
  let showDetails = false;
  let year = null, month = null, half = null; // lazily set to the current cutoff on first render
  let hideNumbers = localStorage.getItem('essHideNumbers') === '1';

  function initPosition(emp) {
    if (year !== null) return;
    const today = new Date(todayISO() + 'T00:00:00');
    const pos = defaultCutoffPosition(emp.payCycle, today.getFullYear(), today.getMonth() + 1, today.getDate());
    year = pos.year; month = pos.month; half = pos.half;
  }

  // Steps to the adjacent cutoff, crossing month/year boundaries as needed -- mirrors the
  // A/B layout in js/store.js payCutoffs (A = tail of prev month + start of this month,
  // B = rest of this month), so "one step back from A" is B of the previous month and "one
  // step forward from B" is A of the next month.
  function stepCutoff(delta) {
    if (delta > 0) {
      if (half === 'A') { half = 'B'; }
      else { half = 'A'; month += 1; if (month > 12) { month = 1; year += 1; } }
    } else {
      if (half === 'B') { half = 'A'; }
      else { half = 'B'; month -= 1; if (month < 1) { month = 12; year -= 1; } }
    }
  }

  function goToToday(emp) {
    const today = new Date(todayISO() + 'T00:00:00');
    const pos = defaultCutoffPosition(emp.payCycle, today.getFullYear(), today.getMonth() + 1, today.getDate());
    year = pos.year; month = pos.month; half = pos.half;
  }

  // Masks every peso figure on this page behind dots when the employee taps the eye icon
  // -- lets them check a released/pending status on a shared or public screen without
  // exposing the actual amounts. Preference persists across visits (localStorage), same
  // spirit as a banking app's "hide balance" toggle.
  function money(amount) {
    return hideNumbers ? '₱ ••••••' : fmtMoney(amount);
  }

  function render(main, emp) {
    initPosition(emp);
    const cutoffs = payCutoffs(emp.payCycle, year, month);
    const selected = cutoffs.find(c => c.key === half) || cutoffs[0];
    const row = computeRow(emp, selected.from, selected.to);
    const release = Store.getPayrollRelease(emp.payCycle, selected.from);
    const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isCurrent = (() => {
      const today = new Date(todayISO() + 'T00:00:00');
      const pos = defaultCutoffPosition(emp.payCycle, today.getFullYear(), today.getMonth() + 1, today.getDate());
      return pos.year === year && pos.month === month && pos.half === half;
    })();

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">My Payroll</div>

      <div class="ess-card" style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px 16px;">
        <button type="button" class="link-btn" id="btn-prev-cutoff">← Prev</button>
        <div style="text-align:center;">
          <div style="font-weight:700; font-size:13px;">${monthLabel}</div>
          ${!isCurrent ? '<button type="button" class="link-btn" id="btn-today-cutoff" style="font-size:11px;">Jump to current</button>' : ''}
        </div>
        <button type="button" class="link-btn" id="btn-next-cutoff">Next →</button>
      </div>
      <div class="seg" id="seg-cutoff" style="margin-bottom:12px; justify-content:center; display:flex;">
        ${cutoffs.map(c => `<button data-val="${c.key}" class="${half === c.key ? 'active' : ''}">${c.key === 'A' ? '1st Half' : '2nd Half'}</button>`).join('')}
      </div>

      <div class="ess-sub" style="margin-bottom:12px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span>${selected.label} · payday ${fmtDate(selected.payDate)}</span>
        ${release ? `<span class="badge badge-green">Released ${fmtDate(release.releasedAt.slice(0, 10))}</span>` : `<span class="badge badge-yellow">Not yet released</span>`}
      </div>

      <div class="ess-card" style="text-align:center; position:relative;">
        <button type="button" class="link-btn" id="btn-eye" title="${hideNumbers ? 'Show numbers' : 'Hide numbers'}" aria-label="${hideNumbers ? 'Show numbers' : 'Hide numbers'}" style="position:absolute; top:16px; right:16px; font-size:18px; line-height:1;">${hideNumbers ? '🙈' : '👁️'}</button>
        <div class="ess-card-label">Net Pay</div>
        <div class="ess-big-value" style="color:var(--green);">${money(row.net)}</div>
        <div class="ess-sub">Gross ${money(row.gross)} − Tax ${money(row.tax)} − Deductions ${money(row.dedTotal)}${row.bonusTotal ? ' + Bonus ' + money(row.bonusTotal) : ''}</div>
      </div>

      <div class="ess-card">
        <div class="ess-row"><span class="label">Gross Pay</span><span class="value">${money(row.gross)}</span></div>
        <div class="ess-row"><span class="label">Overtime Pay</span><span class="value">${money(row.otPay)}</span></div>
        <div class="ess-row"><span class="label">Holiday Pay</span><span class="value">${money(row.holidayPay)}</span></div>
        ${row.restDayPay ? `<div class="ess-row"><span class="label">Rest Day Pay</span><span class="value">${money(row.restDayPay)}</span></div>` : ''}
        <div class="ess-row"><span class="label">COLA</span><span class="value">${money(row.colaPay)}</span></div>
        <div class="ess-row"><span class="label">Deductions</span><span class="value">${money(row.dedTotal)}</span></div>
        <div class="ess-row"><span class="label" style="${row.bonusTotal ? 'font-weight:700;' : ''}">Bonus</span><span class="value" style="${row.bonusTotal ? 'color:var(--green);' : ''}">${row.bonusTotal ? money(row.bonusTotal) : '—'}</span></div>
      </div>

      <button class="btn btn-ghost btn-sm" id="btn-toggle-details" style="width:100%; justify-content:center; margin-bottom:6px;">${showDetails ? 'Hide' : 'View'} full details</button>
      <button class="btn btn-ghost btn-sm" id="btn-print-dtr" style="width:100%; justify-content:center;">🖨 View / Print DTR for this period</button>

      ${showDetails ? `
      <div class="ess-card" style="margin-top:12px;">
        <div class="ess-row"><span class="label">Days Present</span><span class="value">${row.daysPresent}</span></div>
        <div class="ess-row"><span class="label">Absent</span><span class="value">${row.daysAbsent}</span></div>
        <div class="ess-row"><span class="label">Base Pay</span><span class="value">${money(row.basePay)}</span></div>
        <div class="ess-row"><span class="label">COLA</span><span class="value">${money(row.colaPay)}</span></div>
        <div class="ess-row"><span class="label">Housing Allowance</span><span class="value">${money(row.housingPay)}</span></div>
        <div class="ess-row"><span class="label">Night Shift Differential</span><span class="value">${money(row.nsdPay)}</span></div>
        <div class="ess-row"><span class="label">Overtime Pay</span><span class="value">${money(row.otPay)}</span></div>
        <div class="ess-row"><span class="label">Holiday Pay</span><span class="value">${money(row.holidayPay)}</span></div>
        <div class="ess-row"><span class="label">Rest Day Pay</span><span class="value">${money(row.restDayPay)}</span></div>
        <div class="ess-row"><span class="label">Withholding Tax</span><span class="value">${money(row.tax)}</span></div>
        <div class="ess-row"><span class="label">Deductions</span><span class="value">${money(row.dedTotal)}</span></div>
        <div class="ess-row"><span class="label">Bonus</span><span class="value" style="${row.bonusTotal ? 'color:var(--green);' : ''}">${row.bonusTotal ? money(row.bonusTotal) : '—'}</span></div>
        <div class="ess-row"><span class="label" style="font-weight:700;">Net Pay</span><span class="value" style="color:var(--green);">${money(row.net)}</span></div>
      </div>
      ` : ''}

      ${(() => {
        const t13 = Store.thirteenthMonthPayForEmployee(emp.id, year);
        if (!t13) return '';
        return `
        <div class="ess-card" style="margin-top:12px;">
          <div class="ess-card-label">13th Month Pay — ${year}</div>
          <div class="ess-row"><span class="label">Amount</span><span class="value" style="font-weight:700;">${money(t13.amount)}</span></div>
          <div class="ess-sub">${t13.status === 'Released' ? 'Released ' + fmtDate(t13.releaseDate) : 'Computed — not yet released.'}</div>
        </div>`;
      })()}

      ${(() => {
        const offRow = Store.listOffboarding().find(o => o.employeeId === emp.id && o.status === 'Released');
        if (!offRow || !offRow.finalPaySnapshot) return '';
        return `
        <div class="ess-card" style="margin-top:12px;">
          <div class="ess-card-label">Final Pay</div>
          <div class="ess-row"><span class="label">Total</span><span class="value" style="font-weight:700; color:var(--green);">${money(offRow.finalPaySnapshot.totalFinalPay)}</span></div>
          <div class="ess-sub">Released ${fmtDate(offRow.finalPayReleaseDate)}${offRow.coeIssuedDate ? ' — Certificate of Employment issued ' + fmtDate(offRow.coeIssuedDate) : ''}</div>
        </div>`;
      })()}
    `;

    qs('#btn-eye', main).addEventListener('click', () => {
      hideNumbers = !hideNumbers;
      localStorage.setItem('essHideNumbers', hideNumbers ? '1' : '0');
      render(main, emp);
    });
    qs('#btn-prev-cutoff', main).addEventListener('click', () => { stepCutoff(-1); render(main, emp); });
    qs('#btn-next-cutoff', main).addEventListener('click', () => { stepCutoff(1); render(main, emp); });
    const btnToday = qs('#btn-today-cutoff', main);
    if (btnToday) btnToday.addEventListener('click', () => { goToToday(emp); render(main, emp); });
    qsa('#seg-cutoff button', main).forEach(b => b.addEventListener('click', () => { half = b.dataset.val; render(main, emp); }));
    qs('#btn-toggle-details', main).addEventListener('click', () => { showDetails = !showDetails; render(main, emp); });
    qs('#btn-print-dtr', main).addEventListener('click', () => openDTR(emp, selected.from, selected.to));
  }

  return { render };
})();
