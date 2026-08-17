window.Views.offboarding = (function () {
  let filterStatus = 'Active';

  function statusBadge(status) {
    const map = { 'Pending Clearance': 'badge-yellow', 'Ready for Release': 'badge-blue', Released: 'badge-green' };
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(status)}</span>`;
  }

  function moneyRow(label, value, sign) {
    const amt = Number(value) || 0;
    return `<div class="page-sub" style="display:flex; justify-content:space-between; padding:3px 0;">
      <span>${escapeHtml(label)}</span><span>${sign === '-' && amt ? '−' : ''}${fmtMoney(Math.abs(amt))}</span>
    </div>`;
  }

  function render(main) {
    const all = Store.listOffboarding().slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const rows = filterStatus === 'All' ? all : filterStatus === 'Active' ? all.filter(o => o.status !== 'Released') : all.filter(o => o.status === filterStatus);
    const eligibleEmployees = Store.listEmployees().filter(e => e.status !== 'Terminated' && !Store.activeOffboardingForEmployee(e.id));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Offboarding &amp; Final Pay</h1>
          <div class="page-sub">Clearance checklist, final pay computation, and Certificate of Employment for separating employees.</div>
        </div>
        <button class="btn btn-primary" id="btn-start-offboarding">+ Start Offboarding</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Active', 'All', 'Pending Clearance', 'Ready for Release', 'Released'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th>Separation Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(o => {
              const emp = Store.getEmployee(o.employeeId);
              return `
              <tr>
                <td class="name row-link" data-open="${o.id}">${escapeHtml(emp ? emp.name : 'Unknown employee')}</td>
                <td class="dim">${escapeHtml(o.separationType)}</td>
                <td class="dim">${fmtDate(o.separationDate)}</td>
                <td>${statusBadge(o.status)}</td>
                <td><button class="link-btn" data-open="${o.id}">Open →</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>` : '<div class="empty">No offboarding cases match this filter.</div>'}
      </div>
    `;

    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; render(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
    qs('#btn-start-offboarding', main).addEventListener('click', () => openStartModal(main, eligibleEmployees));
  }

  function openStartModal(main, eligibleEmployees) {
    openModal(`
      <h2>Start Offboarding</h2>
      <div class="page-sub" style="margin-bottom:14px;">This does not change the employee's status yet -- that only happens once final pay is released, after clearance.</div>
      <form id="start-form">
        <div class="field full">
          <label>Employee</label>
          <select name="employeeId" required>
            <option value="">Select…</option>
            ${eligibleEmployees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field full">
          <label>Separation Type</label>
          <select name="separationType" required>
            <option value="Resignation">Resignation</option>
            <option value="Termination - Just Cause">Termination - Just Cause</option>
            <option value="Termination - Authorized Cause">Termination - Authorized Cause</option>
            <option value="End of Contract">End of Contract</option>
            <option value="Retirement">Retirement</option>
          </select>
        </div>
        <div class="field"><label>Notice Date</label><input type="date" name="noticeDate" /></div>
        <div class="field"><label>Separation Date</label><input type="date" name="separationDate" required value="${todayISO()}" /></div>
        <div class="modal-actions"><button type="submit" class="btn btn-primary">Start</button></div>
      </form>
    `, (bd) => {
      qs('#start-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        if (!fd.get('employeeId')) return;
        const row = await Store.startOffboarding({
          employeeId: fd.get('employeeId'), separationType: fd.get('separationType'),
          noticeDate: fd.get('noticeDate') || null, separationDate: fd.get('separationDate'),
          createdBy: currentUserEmail(),
        });
        toast('✔ Offboarding started.');
        closeModal();
        render(main);
        openDetail(main, row.id);
      });
    });
  }

  function openDetail(main, id) {
    const o = Store.getOffboarding(id);
    if (!o) return;
    const emp = Store.getEmployee(o.employeeId);
    const checklist = o.clearanceChecklist || [];
    const allDone = checklist.length > 0 && checklist.every(c => c.done);
    const fp = o.finalPaySnapshot;

    openDrawer(`
      <h2>${escapeHtml(emp ? emp.name : 'Unknown employee')}</h2>
      <div class="page-sub" style="margin-bottom:10px;">${escapeHtml(o.separationType)} — separating ${fmtDate(o.separationDate)}</div>
      <div style="margin-bottom:14px;">${statusBadge(o.status)}</div>

      <div class="section-title">Clearance Checklist</div>
      <div class="panel" style="padding:10px 14px; margin-bottom:14px;">
        ${checklist.map((c, i) => `
          <label style="display:flex; align-items:center; gap:8px; padding:6px 0;">
            <input type="checkbox" data-clearance-idx="${i}" ${c.done ? 'checked' : ''} ${o.status === 'Released' ? 'disabled' : ''} />
            <span style="${c.done ? 'text-decoration:line-through; opacity:.6;' : ''}">${escapeHtml(c.item)}</span>
          </label>
        `).join('')}
      </div>

      <div class="section-title">Final Pay</div>
      ${fp ? `
      <div class="panel" style="padding:10px 14px; margin-bottom:10px;">
        ${moneyRow('Last salary (current cutoff)', fp.lastSalary)}
        ${moneyRow('Prorated 13th month pay', fp.proratedThirteenthMonth)}
        ${moneyRow(`Unused SIL cash-out (${fp.unusedSilDays.toFixed(1)} day(s))`, fp.unusedSILCashOut)}
        ${fp.retirementPay ? moneyRow('Retirement pay (RA 7641)', fp.retirementPay) : ''}
        ${moneyRow('Less: outstanding cash advances', fp.outstandingLiabilities, '-')}
        <div style="border-top:1px solid var(--border-soft); margin-top:6px; padding-top:6px; display:flex; justify-content:space-between; font-weight:700;">
          <span>Total Final Pay</span><span>${fmtMoney(fp.totalFinalPay)}</span>
        </div>
        <div class="page-sub" style="margin-top:4px;">Computed ${fmtDate(fp.computedDate)} — review before releasing.</div>
      </div>
      ` : '<div class="page-sub" style="margin-bottom:10px;">Not computed yet.</div>'}

      <div class="modal-actions" style="justify-content:space-between; margin-top:10px; flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" id="btn-print-final-pay" ${!fp ? 'disabled' : ''}>🖨️ Print Final Pay Sheet</button>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${o.status !== 'Released' ? `<button class="btn btn-ghost" id="btn-compute-fp">${fp ? 'Recompute' : 'Compute'} Final Pay</button>` : ''}
          ${o.status === 'Ready for Release' ? `<button class="btn btn-primary" id="btn-release-fp">Release Final Pay</button>` : ''}
          ${o.status === 'Released' && !o.coeIssuedDate ? `<button class="btn btn-primary" id="btn-issue-coe">Issue Certificate of Employment</button>` : ''}
        </div>
      </div>
      ${o.coeIssuedDate ? `<div class="page-sub" style="margin-top:10px;">Certificate of Employment issued ${fmtDate(o.coeIssuedDate)}.</div>` : ''}
    `, (dr) => {
      qsa('[data-clearance-idx]', dr).forEach(cb => cb.addEventListener('change', async () => {
        await Store.updateClearanceItem(o.id, Number(cb.dataset.clearanceIdx), cb.checked, currentUserEmail());
        render(main);
        openDetail(main, o.id);
      }));
      const computeBtn = qs('#btn-compute-fp', dr);
      if (computeBtn) computeBtn.addEventListener('click', async () => {
        if (!allDone && !confirm('Not every clearance item is checked yet. Compute final pay anyway?')) return;
        await Store.saveFinalPaySnapshot(o.id);
        toast('✔ Final pay computed.');
        render(main);
        openDetail(main, o.id);
      });
      const releaseBtn = qs('#btn-release-fp', dr);
      if (releaseBtn) releaseBtn.addEventListener('click', async () => {
        if (!confirm(`Release final pay of ${fmtMoney(fp.totalFinalPay)} to ${emp.name}? This marks them Terminated in Employee Management.`)) return;
        await Store.releaseFinalPay(o.id);
        toast('✔ Final pay released.');
        render(main);
        openDetail(main, o.id);
      });
      const coeBtn = qs('#btn-issue-coe', dr);
      if (coeBtn) coeBtn.addEventListener('click', async () => {
        await Store.issueCOE(o.id);
        toast('✔ Certificate of Employment issued.');
        render(main);
        openDetail(main, o.id);
      });
      const printBtn = qs('#btn-print-final-pay', dr);
      if (printBtn) printBtn.addEventListener('click', () => openFinalPayPrintView(o, emp));
    });
  }

  // Reuses the same generic .dtr-overlay/.dtr-print/.dtr-table CSS classes already used
  // for the DTR and Expense Report printouts.
  function openFinalPayPrintView(o, emp) {
    const fp = o.finalPaySnapshot;
    if (!fp) return;
    const overlay = document.createElement('div');
    overlay.className = 'dtr-overlay';
    overlay.innerHTML = `
      <div class="dtr-print">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <h2 style="margin:0;">Final Pay Computation</h2>
          <div>
            <button class="btn btn-ghost btn-sm" id="btn-close-print">Close</button>
            <button class="btn btn-primary btn-sm" id="btn-do-print">Print</button>
          </div>
        </div>
        <div class="page-sub">${escapeHtml(emp ? emp.name : '')} — ${escapeHtml(o.separationType)} — Separated ${fmtDate(o.separationDate)}</div>
        <table class="dtr-table" style="margin-top:14px;">
          <tbody>
            <tr><td>Last salary (current cutoff)</td><td style="text-align:right;">${fmtMoney(fp.lastSalary)}</td></tr>
            <tr><td>Prorated 13th month pay</td><td style="text-align:right;">${fmtMoney(fp.proratedThirteenthMonth)}</td></tr>
            <tr><td>Unused SIL cash-out (${fp.unusedSilDays.toFixed(1)} day(s))</td><td style="text-align:right;">${fmtMoney(fp.unusedSILCashOut)}</td></tr>
            ${fp.retirementPay ? `<tr><td>Retirement pay (RA 7641)</td><td style="text-align:right;">${fmtMoney(fp.retirementPay)}</td></tr>` : ''}
            <tr><td>Less: outstanding cash advances</td><td style="text-align:right;">−${fmtMoney(fp.outstandingLiabilities)}</td></tr>
            <tr style="font-weight:700; border-top:2px solid #000;"><td>TOTAL FINAL PAY</td><td style="text-align:right;">${fmtMoney(fp.totalFinalPay)}</td></tr>
          </tbody>
        </table>
        <div class="page-sub" style="margin-top:20px;">Computed ${fmtDate(fp.computedDate)}${o.finalPayReleaseDate ? ' — Released ' + fmtDate(o.finalPayReleaseDate) : ''}</div>
      </div>
    `;
    document.body.appendChild(overlay);
    qs('#btn-close-print', overlay).addEventListener('click', () => overlay.remove());
    qs('#btn-do-print', overlay).addEventListener('click', () => window.print());
  }

  return { render };
})();
