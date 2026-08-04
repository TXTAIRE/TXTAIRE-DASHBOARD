window.Views.probation = (function () {

  const THIRD_MONTH_OPTIONS = ['Pending', 'On Track for Regularization', 'Needs Improvement', 'Recommend End of Contract'];
  const SIXTH_MONTH_OPTIONS = ['Pending', 'Regularized', 'Extended', 'End of Contract'];

  function milestoneBadge(status) {
    const map = {
      'Pending': 'badge-gray',
      'On Track for Regularization': 'badge-green',
      'Needs Improvement': 'badge-yellow',
      'Recommend End of Contract': 'badge-red',
      'Regularized': 'badge-green',
      'Extended': 'badge-yellow',
      'End of Contract': 'badge-red',
    };
    return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status) + '</span>';
  }

  function truncate(text, n) {
    if (!text) return '—';
    return text.length > n ? text.slice(0, n) + '…' : text;
  }

  function dueBadge(dueDate, status) {
    if (status !== 'Pending') return '';
    const diff = daysBetween(todayISO(), dueDate);
    if (diff < 0) return '<span class="badge badge-red">Overdue ' + Math.abs(diff) + 'd</span>';
    if (diff <= 14) return '<span class="badge badge-yellow">Due in ' + diff + 'd</span>';
    return '<span class="badge badge-gray">In ' + diff + 'd</span>';
  }

  function renderList(main) {
    const records = Store.listProbations();
    const rows = records.map(r => {
      const emp = Store.getEmployee(r.employeeId);
      const thirdDue = addMonths(r.startDate, 3);
      const sixthDue = addMonths(r.startDate, 6);
      return { r, emp, thirdDue, sixthDue };
    }).filter(row => row.emp);
    rows.sort((a, b) => a.thirdDue.localeCompare(b.thirdDue));

    const dueSoon3 = rows.filter(row => row.r.thirdMonthStatus === 'Pending' && daysBetween(todayISO(), row.thirdDue) <= 14);
    const dueSoon6 = rows.filter(row => row.r.sixthMonthStatus === 'Pending' && daysBetween(todayISO(), row.sixthDue) <= 14);
    const regularizedCount = rows.filter(row => row.r.sixthMonthStatus === 'Regularized').length;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Employment Status</h1>
          <div class="page-sub">Probationary employees are evaluated at the 3rd month and again at the 6th month, when a regularization decision is due. Track start dates and both milestones here.</div>
        </div>
        <button class="btn btn-primary" id="btn-add-probation">+ Track employee</button>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">On Probation</div><div class="kpi-value">${rows.length}</div></div>
        <div class="kpi-card"><div class="kpi-label">3rd Month Due Soon</div><div class="kpi-value ${dueSoon3.length ? 'red' : ''}">${dueSoon3.length}</div><div class="kpi-sub">within 14 days or overdue</div></div>
        <div class="kpi-card"><div class="kpi-label">6th Month Due Soon</div><div class="kpi-value ${dueSoon6.length ? 'red' : ''}">${dueSoon6.length}</div><div class="kpi-sub">within 14 days or overdue</div></div>
        <div class="kpi-card"><div class="kpi-label">Regularized</div><div class="kpi-value green">${regularizedCount}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead>
            <tr>
              <th>Employee</th><th>Position</th><th>Start Date</th>
              <th>3rd Month Due</th><th>3rd Month Status</th><th>3rd Month Remarks</th>
              <th>6th Month Due (End of Probation)</th><th>6th Month Status</th><th>6th Month Remarks</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td class="name row-link" data-open="${row.r.id}">${escapeHtml(row.emp.name)}</td>
                <td class="dim">${escapeHtml(row.emp.position)}</td>
                <td class="dim">${fmtDate(row.r.startDate)}</td>
                <td class="dim">${fmtDate(row.thirdDue)} ${dueBadge(row.thirdDue, row.r.thirdMonthStatus)}</td>
                <td>${milestoneBadge(row.r.thirdMonthStatus)}</td>
                <td class="dim" style="max-width:200px;">${escapeHtml(truncate(row.r.thirdMonthNotes, 60))}</td>
                <td class="dim">${fmtDate(row.sixthDue)} ${dueBadge(row.sixthDue, row.r.sixthMonthStatus)}</td>
                <td>${milestoneBadge(row.r.sixthMonthStatus)}</td>
                <td class="dim" style="max-width:200px;">${escapeHtml(truncate(row.r.sixthMonthNotes, 60))}</td>
                <td><button class="link-btn" data-open="${row.r.id}">Edit remarks →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No probationary employees are being tracked yet.</div>'}
      </div>
    `;

    qs('#btn-add-probation', main).addEventListener('click', () => openAddForm(main));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openDetail(main, el.dataset.open)));
  }

  function openDetail(main, id) {
    const r = Store.getProbation(id);
    if (!r) return;
    const emp = Store.getEmployee(r.employeeId);
    const thirdDue = addMonths(r.startDate, 3);
    const sixthDue = addMonths(r.startDate, 6);

    openDrawer(`
      <h2>${escapeHtml(emp ? emp.name : 'Unknown employee')}</h2>
      <div class="page-sub" style="margin-bottom:14px;">${emp ? escapeHtml(emp.position) : ''}</div>
      <div class="page-sub">Probation start: ${fmtDate(r.startDate)}</div>

      <div class="section-title">3rd Month Evaluation — due ${fmtDate(thirdDue)}</div>
      <div class="page-sub" style="margin-bottom:10px;">Interim check-in: is this employee trending toward regularization or end of contract?</div>
      <div style="margin-bottom:10px;">${milestoneBadge(r.thirdMonthStatus)} ${dueBadge(thirdDue, r.thirdMonthStatus)}</div>
      ${r.thirdMonthNotes ? `<div class="page-sub" style="margin-bottom:10px;">${escapeHtml(r.thirdMonthNotes)}${r.thirdMonthEvaluatedDate ? ' (' + fmtDate(r.thirdMonthEvaluatedDate) + ')' : ''}</div>` : ''}
      <div class="modal-grid">
        <div class="field"><label>Result</label>
          <select id="third-status">
            ${THIRD_MONTH_OPTIONS.map(s => `<option ${s === r.thirdMonthStatus ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Evaluated on</label><input type="date" id="third-date" value="${r.thirdMonthEvaluatedDate || todayISO()}" /></div>
        <div class="field full"><label>Remarks</label><textarea id="third-notes" rows="2" placeholder="Editable remarks — performance notes, reasons for the recommendation, etc.">${escapeHtml(r.thirdMonthNotes || '')}</textarea></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn btn-ghost btn-sm" id="btn-save-third">Save 3rd month result</button>
      </div>

      <div class="section-title">6th Month Decision — due ${fmtDate(sixthDue)}</div>
      <div class="page-sub" style="margin-bottom:10px;">Final decision at end of the probationary period: regularization or end of contract.</div>
      <div style="margin-bottom:10px;">${milestoneBadge(r.sixthMonthStatus)} ${dueBadge(sixthDue, r.sixthMonthStatus)}</div>
      ${r.sixthMonthNotes ? `<div class="page-sub" style="margin-bottom:10px;">${escapeHtml(r.sixthMonthNotes)}${r.sixthMonthEvaluatedDate ? ' (' + fmtDate(r.sixthMonthEvaluatedDate) + ')' : ''}</div>` : ''}
      <div class="modal-grid">
        <div class="field"><label>Decision</label>
          <select id="sixth-status">
            ${SIXTH_MONTH_OPTIONS.map(s => `<option ${s === r.sixthMonthStatus ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Decided on</label><input type="date" id="sixth-date" value="${r.sixthMonthEvaluatedDate || todayISO()}" /></div>
        <div class="field full"><label>Remarks</label><textarea id="sixth-notes" rows="2" placeholder="Editable remarks — basis for regularization or end of contract.">${escapeHtml(r.sixthMonthNotes || '')}</textarea></div>
      </div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn btn-primary btn-sm" id="btn-save-sixth">Save decision &amp; remarks</button>
      </div>

      <div class="section-title">Finalize Employment Status</div>
      <div class="page-sub" style="margin-bottom:10px;">
        A deliberate, separate action — saving the decision above does <strong>not</strong> change the employee's status by itself.
        Current status: ${employmentStatusBadge(emp ? emp.employmentStatus : 'Probationary')}${emp && emp.status === 'Terminated' ? ' ' + employeeStatusDot(emp.status) : ''}
      </div>
      <div class="seg" id="seg-finalize">
        <button data-val="regular" class="${emp && emp.employmentStatus === 'Regular' ? 'active' : ''}">Regular</button>
        <button data-val="end" class="${emp && emp.status === 'Terminated' ? 'active' : ''}">End of Contract</button>
      </div>

      <div class="modal-actions" style="margin-top:16px;">
        <button class="btn btn-ghost btn-sm" id="btn-del-probation">Remove from tracking</button>
      </div>
    `, (dr) => {
      qs('#btn-save-third', dr).addEventListener('click', async () => {
        await Store.updateProbation(r.id, {
          thirdMonthStatus: qs('#third-status', dr).value,
          thirdMonthEvaluatedDate: qs('#third-date', dr).value,
          thirdMonthNotes: qs('#third-notes', dr).value.trim(),
        });
        toast('3rd month result saved.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-save-sixth', dr).addEventListener('click', async () => {
        await Store.updateProbation(r.id, {
          sixthMonthStatus: qs('#sixth-status', dr).value,
          sixthMonthEvaluatedDate: qs('#sixth-date', dr).value,
          sixthMonthNotes: qs('#sixth-notes', dr).value.trim(),
        });
        toast('6th month decision and remarks saved.');
        closeDrawer();
        renderList(main);
      });
      qsa('#seg-finalize button', dr).forEach(b => b.addEventListener('click', async () => {
        if (!emp) return;
        if (b.dataset.val === 'regular') {
          if (confirm('Confirm regularizing ' + emp.name + '? This sets their employment status to Regular.')) {
            await Store.updateEmployee(emp.id, { employmentStatus: 'Regular' });
            toast(emp.name + ' is now Regular.');
            closeDrawer();
            renderList(main);
          }
        } else {
          if (confirm('Confirm end of contract for ' + emp.name + '? This sets their status to Terminated on the Employees page.')) {
            await Store.updateEmployee(emp.id, { status: 'Terminated' });
            toast(emp.name + '\'s contract has been ended.');
            closeDrawer();
            renderList(main);
          }
        }
      }));
      qs('#btn-del-probation', dr).addEventListener('click', async () => {
        if (confirm('Remove this employee from probation tracking?')) {
          await Store.deleteProbation(r.id);
          closeDrawer();
          toast('Removed from tracking.');
          renderList(main);
        }
      });
    });
  }

  function openAddForm(main) {
    const tracked = new Set(Store.listProbations().map(p => p.employeeId));
    const candidates = Store.listEmployees().filter(e => e.employmentStatus === 'Probationary' && !tracked.has(e.id));

    if (!candidates.length) {
      openModal(`
        <h2>Track employee</h2>
        <div class="modal-sub">Every current probationary employee is already being tracked. Set an employee's status to "Probationary" on the Employees page first.</div>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close-modal>Close</button></div>
      `);
      return;
    }

    openModal(`
      <h2>Track employee</h2>
      <div class="modal-sub">Start tracking a probationary employee's 3rd and 6th month evaluation.</div>
      <form id="probation-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label>
            <select name="employeeId">${candidates.map(e => `<option value="${e.id}">${escapeHtml(e.name)} — ${escapeHtml(e.position)}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Probation start date</label><input type="date" name="startDate" value="${todayISO()}" required /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Start tracking</button>
        </div>
      </form>
    `, (bd) => {
      qs('#probation-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addProbation({
          employeeId: fd.get('employeeId'),
          startDate: fd.get('startDate'),
          thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '',
          sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '',
        });
        toast('Now tracking probation period.');
        closeModal();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
