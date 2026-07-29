window.Views.payroll = (function () {
  // Reference list for the Holidays tab's "Add holiday" form — the officially recurring
  // PH holidays by type (Labor Code / Republic Act proclamations). "Other" always remains
  // available for newly/locally declared holidays not on this list.
  const REGULAR_HOLIDAYS = [
    "New Year's Day", 'Araw ng Kagitingan', 'Maundy Thursday', 'Good Friday',
    'Labor Day', 'Independence Day', 'National Heroes Day', 'Bonifacio Day',
    'Christmas Day', 'Rizal Day',
  ];
  const SPECIAL_HOLIDAYS = [
    'Ninoy Aquino Day', "All Saints' Day", 'Feast of the Immaculate Conception',
    'Chinese New Year', 'Black Saturday', 'Christmas Eve', "New Year's Eve",
    'EDSA People Power Anniversary',
  ];

  let activeTab = 'payroll';
  const today = new Date(todayISO() + 'T00:00:00');
  let group = '10-20';
  let pos = defaultCutoffPosition(group, today.getFullYear(), today.getMonth() + 1, today.getDate());
  let year = pos.year;
  let month = pos.month;
  let half = pos.half;

  function setGroup(g) {
    group = g;
    const t = new Date(todayISO() + 'T00:00:00');
    const p = defaultCutoffPosition(group, t.getFullYear(), t.getMonth() + 1, t.getDate());
    year = p.year; month = p.month; half = p.half;
  }

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    month = m; year = y;
  }

  // computeRow(emp, from, to) now lives in js/store.js — shared with the Employee
  // Self-Service "My Payroll" page so both always show identical figures.

  function renderView(main) {
    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Payroll</h1>
          <div class="page-sub">Admins (Admin &amp; Office Staff) are paid every 10th &amp; 20th; Technicians (Field Personnel) every 15th &amp; the last day of the month. Both schedules pay twice a month with no cutoff exceeding 16 days, per the Labor Code of the Philippines. Gross pay = base pay + COLA + housing allowance + night shift differential + overtime + holiday pay; net pay = gross pay − withholding tax − deductions.</div>
        </div>
        ${activeTab === 'deductions' ? '<button class="btn btn-primary" id="btn-new-deduction">+ New deduction</button>' : ''}
        ${activeTab === 'holidays' ? '<button class="btn btn-primary" id="btn-new-holiday">+ Add holiday</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'payroll' ? 'active' : ''}" data-tab="payroll">Payroll</div>
        <div class="tab ${activeTab === 'deductions' ? 'active' : ''}" data-tab="deductions">Deductions</div>
        <div class="tab ${activeTab === 'holidays' ? 'active' : ''}" data-tab="holidays">Holidays</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnNewDed = qs('#btn-new-deduction', main);
    if (btnNewDed) btnNewDed.addEventListener('click', () => openDeductionForm(main));
    const btnNewHol = qs('#btn-new-holiday', main);
    if (btnNewHol) btnNewHol.addEventListener('click', () => openHolidayForm(main));

    if (activeTab === 'payroll') renderPayrollTab(qs('#tab-body', main), main);
    else if (activeTab === 'deductions') renderDeductionsTab(qs('#tab-body', main), main);
    else renderHolidaysTab(qs('#tab-body', main), main);
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
    const totalCola = rows.reduce((s, r) => s + r.colaPay, 0);
    const totalHousing = rows.reduce((s, r) => s + r.housingPay, 0);
    const totalNsd = rows.reduce((s, r) => s + r.nsdPay, 0);
    const totalOt = rows.reduce((s, r) => s + r.otPay, 0);
    const totalHoliday = rows.reduce((s, r) => s + r.holidayPay, 0);
    const totalTax = rows.reduce((s, r) => s + r.tax, 0);
    const totalDed = rows.reduce((s, r) => s + r.dedTotal, 0);
    const totalAttendanceDed = rows.reduce((s, r) => s + r.attendanceDed, 0);
    const totalLateUndertimeDed = rows.reduce((s, r) => s + r.lateUndertimeDed, 0);
    const totalAbsentDays = rows.reduce((s, r) => s + r.daysAbsent, 0);
    const totalNet = rows.reduce((s, r) => s + r.net, 0);

    body.innerHTML = `
      <div class="filters">
        <div class="field">
          <label>Pay group</label>
          <div class="seg" id="seg-group">
            <button data-val="10-20" class="${group === '10-20' ? 'active' : ''}">Admins</button>
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
        <button class="btn btn-ghost btn-sm" id="btn-reset-absences" style="align-self:flex-end;" title="Sets Absent to 0 for every staff member shown below, for this cutoff only">Reset absences to 0</button>
      </div>

      <div class="page-sub" style="margin-bottom:10px;">${monthLabel} · ${selected.label} · payday ${fmtDate(selected.payDate)} · ${rows.length} staff on this schedule</div>
      <div class="page-sub" style="margin-bottom:10px;">📌 Recommended: finalize these numbers by <strong>${fmtDate(addDays(selected.to, -2))}</strong> — 2 days before this cutoff closes on ${fmtDate(selected.to)} — so payroll is ready in time for payday.</div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Gross</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(totalGross)}</div><div class="kpi-sub">incl. ${fmtMoney(totalCola)} COLA, ${fmtMoney(totalHousing)} housing allowance,${fmtMoney(totalNsd)} NSD, ${fmtMoney(totalOt)} OT, ${fmtMoney(totalHoliday)} holiday</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Withholding Tax</div><div class="kpi-value ${totalTax ? 'red' : ''}" style="font-size:20px;">${fmtMoney(totalTax)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Deductions</div><div class="kpi-value ${totalDed ? 'red' : ''}" style="font-size:20px;">${fmtMoney(totalDed)}</div>${totalAttendanceDed || totalLateUndertimeDed ? `<div class="kpi-sub">incl. ${fmtMoney(totalAttendanceDed)} absences, ${fmtMoney(totalLateUndertimeDed)} late/undertime</div>` : ''}</div>
        <div class="kpi-card"><div class="kpi-label">Total Absent Days</div><div class="kpi-value ${totalAbsentDays ? 'red' : ''}" style="font-size:20px;">${totalAbsentDays}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Net Pay</div><div class="kpi-value green" style="font-size:20px;">${fmtMoney(totalNet)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Staff on Schedule</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="hint">Days Present, Absent, Base Pay, COLA, Housing, NSD, OT, and Holiday are all editable — type over any of them and press Enter or click away to save and recompute Gross/Net Pay for that cutoff. Each is saved independently per employee per cutoff and takes priority over the computed value (highlighted with a blue border) until cleared back to the computed figure. Left alone, COLA/Housing come from the employee's profile, and NSD/OT/Holiday are computed automatically from logged time in/out and the Holidays tab's calendar (10% NSD differential; 125%/169%/260% OT tiers; 200%/130% holiday premiums, full pay for an unworked regular holiday). Absences are unpaid automatically for daily-rate staff (base pay only counts days present); for monthly-rate staff they're converted into an automatic deduction. Late/undertime (a logged day under 8 hours) is also unpaid for the shortfall. Both fold into the Deductions total.</div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Staff</th><th>Position</th><th class="num">Days Present</th><th class="num">Absent</th><th class="num">Base Pay</th><th class="num">COLA</th><th class="num">Housing Allowance</th><th class="num">NSD</th><th class="num">OT</th><th class="num">Holiday</th><th class="num">Gross Pay</th><th class="num">Withholding Tax</th><th class="num">Deductions</th><th class="num">Net Pay</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.emp.name)}</td>
                <td class="dim">${escapeHtml(r.emp.position)}</td>
                <td class="num">
                  <input type="number" class="days-input" min="0" step="0.5" value="${r.daysPresent}" data-emp="${r.emp.id}" title="${r.isOverridden ? 'Manually edited — overrides attendance count' : 'From attendance records'} · ${r.workDays} working days in this cutoff" style="${r.isOverridden ? 'border-color:var(--accent);' : ''}" />
                </td>
                <td class="num">
                  <input type="number" class="absent-input ${r.daysAbsent ? 'red' : ''}" min="0" step="0.5" value="${r.daysAbsent}" data-emp="${r.emp.id}" title="${r.isAbsentOverridden ? 'Manually edited — overrides the attendance-derived count' : 'Ordinary working days in cutoff (excl. holidays) − days present'}" style="${r.isAbsentOverridden ? 'border-color:var(--accent);' : ''}" />
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="basepay-input" min="0" step="0.01" value="${r.basePay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isBasePayOverridden ? 'Manually edited — overrides rate × days present (or flat monthly rate)' : 'Computed from the employee’s rate'}" style="${r.isBasePayOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="cola-input" min="0" step="0.01" value="${r.colaPay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isColaOverridden ? 'Manually edited — overrides (allowance/day × days present) + fixed COLA' : "Computed from the employee's COLA rate"}" style="${r.isColaOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="housing-input" min="0" step="0.01" value="${r.housingPay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isHousingOverridden ? "Manually edited — overrides the employee's housing allowance" : "From the employee's housing allowance"}" style="${r.isHousingOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="nsd-input" min="0" step="0.01" value="${r.nsdPay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isNsdOverridden ? 'Manually edited — overrides the computed night shift differential' : 'Computed from logged time in/out, 10pm-6am'}" style="${r.isNsdOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="ot-input" min="0" step="0.01" value="${r.otPay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isOtOverridden ? 'Manually edited — overrides the computed overtime pay' : 'Computed from logged hours beyond 8/day'}" style="${r.isOtOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num">
                  <div class="money-input-wrap"><span class="currency-prefix">₱</span><input type="number" class="holiday-input" min="0" step="0.01" value="${r.holidayPay.toFixed(2)}" data-emp="${r.emp.id}" title="${r.isHolidayOverridden ? 'Manually edited — overrides the computed holiday pay' : 'Computed from the Holidays tab calendar'}" style="${r.isHolidayOverridden ? 'border-color:var(--accent);' : ''}" /></div>
                </td>
                <td class="num" style="font-weight:600;">${fmtMoney(r.gross)}</td>
                <td class="num ${r.tax ? '' : 'dim'}">${r.tax ? fmtMoney(r.tax) : '—'}</td>
                <td class="num ${r.dedTotal ? '' : 'dim'}" title="${[r.attendanceDed ? 'Incl. ' + fmtMoney(r.attendanceDed) + ' for ' + r.daysAbsent + ' absent day(s)' : '', r.lateUndertimeDed ? fmtMoney(r.lateUndertimeDed) + ' for late/undertime' : ''].filter(Boolean).join('; ')}">${r.dedTotal ? fmtMoney(r.dedTotal) : '—'}</td>
                <td class="num" style="font-weight:700;">${fmtMoney(r.net)}</td>
                <td><button class="link-btn" data-dtr="${r.emp.id}">DTR →</button></td>
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
          await Store.setPayrollOverride(input.dataset.emp, selected.from, { daysPresent: val });
          renderPayrollTab(body, main);
        }
      });
    });
    qsa('.absent-input', body).forEach(input => {
      input.addEventListener('change', async () => {
        const val = Number(input.value);
        if (!isNaN(val) && val >= 0) {
          await Store.setPayrollOverride(input.dataset.emp, selected.from, { daysAbsent: val });
          renderPayrollTab(body, main);
        }
      });
    });
    [['basepay-input', 'basePay'], ['cola-input', 'cola'], ['housing-input', 'housing'], ['nsd-input', 'nsd'], ['ot-input', 'ot'], ['holiday-input', 'holiday']].forEach(([cls, field]) => {
      qsa('.' + cls, body).forEach(input => {
        input.addEventListener('change', async () => {
          const val = Number(input.value);
          if (!isNaN(val) && val >= 0) {
            await Store.setPayrollOverride(input.dataset.emp, selected.from, { [field]: val });
            renderPayrollTab(body, main);
          }
        });
      });
    });
    qsa('[data-dtr]', body).forEach(btn => btn.addEventListener('click', () => {
      const row = rows.find(r => r.emp.id === btn.dataset.dtr);
      if (row) openDTR(row.emp, selected.from, selected.to);
    }));
    qs('#btn-reset-absences', body).addEventListener('click', async () => {
      if (!rows.length) return;
      if (!confirm(`Set Absent to 0 for all ${rows.length} staff shown, for ${selected.label}?`)) return;
      await Promise.all(rows.map(r => Store.setPayrollOverride(r.emp.id, selected.from, { daysAbsent: 0 })));
      toast('Absences reset to 0 for this cutoff.');
      renderPayrollTab(body, main);
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

  function renderHolidaysTab(body, main) {
    const rows = Store.listHolidays().slice().sort((a, b) => a.date.localeCompare(b.date));

    body.innerHTML = `
      <div class="hint">Holiday pay is computed automatically on the Payroll tab from this calendar. Add the officially proclaimed dates for each year as they're announced — regular-holiday dates that are fixed by law (Jan 1, Apr 9, May 1, Jun 12, Nov 30, Dec 25, Dec 30, plus Maundy Thursday/Good Friday) can be added as soon as the year is known; movable/proclaimed dates (special non-working days, Eid'l Fitr, Eid'l Adha, National Heroes Day, etc.) should wait for the Malacañang proclamation.</div>
      <div class="panel">
        <div class="panel-head"><h3>${rows.length} holiday${rows.length === 1 ? '' : 's'}</h3></div>
        ${rows.length ? `
        <table>
          <thead><tr><th>Date</th><th>Name</th><th>Type</th><th></th></tr></thead>
          <tbody>
            ${rows.map(h => `
              <tr>
                <td class="dim">${fmtDate(h.date)}</td>
                <td class="name">${escapeHtml(h.name)}</td>
                <td><span class="badge ${h.type === 'Regular' ? 'badge-blue' : 'badge-yellow'}">${escapeHtml(h.type)}</span></td>
                <td><button class="link-btn" data-del="${h.id}">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No holidays on the calendar yet. Add one with the button above.</div>'}
      </div>
    `;

    qsa('[data-del]', body).forEach(b => b.addEventListener('click', async () => {
      if (confirm('Delete this holiday?')) {
        await Store.deleteHoliday(b.dataset.del);
        toast('Holiday deleted.');
        renderHolidaysTab(body, main);
      }
    }));
  }

  function openHolidayForm(main) {
    const populatePreset = (bd) => {
      const type = qs('#holiday-type', bd).value;
      const list = type === 'Regular' ? REGULAR_HOLIDAYS : SPECIAL_HOLIDAYS;
      qs('#holiday-preset', bd).innerHTML =
        list.map(n => `<option>${escapeHtml(n)}</option>`).join('') +
        '<option value="__other__">Other (specify below)…</option>';
      toggleCustom(bd);
    };
    const toggleCustom = (bd) => {
      const isOther = qs('#holiday-preset', bd).value === '__other__';
      qs('#holiday-custom-wrap', bd).classList.toggle('hidden', !isOther);
      qs('#holiday-custom', bd).required = isOther;
    };

    openModal(`
      <h2>Add holiday</h2>
      <div class="modal-sub">Pick the holiday type to see the matching official Philippine holidays, or choose "Other" for a newly/locally declared one.</div>
      <form id="holiday-form">
        <div class="modal-grid">
          <div class="field"><label>Date</label><input type="date" name="date" required /></div>
          <div class="field"><label>Type</label>
            <select name="type" id="holiday-type">
              <option value="Regular">Regular Holiday</option>
              <option value="Special Non-Working">Special Non-Working</option>
            </select>
          </div>
          <div class="field full"><label>Holiday</label><select id="holiday-preset"></select></div>
          <div class="field full" id="holiday-custom-wrap"><label>Holiday name</label><input id="holiday-custom" placeholder="e.g. Local Fiesta" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Add holiday</button>
        </div>
      </form>
    `, (bd) => {
      populatePreset(bd);
      qs('#holiday-type', bd).addEventListener('change', () => populatePreset(bd));
      qs('#holiday-preset', bd).addEventListener('change', () => toggleCustom(bd));
      qs('#holiday-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const presetVal = qs('#holiday-preset', bd).value;
        const name = presetVal === '__other__' ? qs('#holiday-custom', bd).value.trim() : presetVal;
        if (!name) return;
        await Store.addHoliday({
          date: fd.get('date'),
          type: fd.get('type'),
          name,
        });
        toast('Holiday added.');
        closeModal();
        renderView(main);
      });
    });
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
