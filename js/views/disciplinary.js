window.Views.disciplinary = (function () {
  let filterStatus = 'Open';

  function renderList(main) {
    const all = Store.listCases();
    let rows = all.slice();
    if (filterStatus === 'Open') rows = rows.filter(c => c.status !== 'Resolved');
    else if (filterStatus !== 'All') rows = rows.filter(c => c.status === filterStatus);
    rows.sort((a, b) => b.dateIssued.localeCompare(a.dateIssued));

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Disciplinary / NTE</h1>
          <div class="page-sub">Notice to Explain issuance, employee response, investigation, and resolution — with a full audit trail per case.</div>
        </div>
        <button class="btn btn-primary" id="btn-issue-nte">+ Issue NTE</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Status</label>
          <div class="seg" id="seg-status">
            ${['Open', 'All', 'Notice Issued', 'Under Investigation', 'Resolved', 'Escalated'].map(s => `<button data-val="${s}" class="${filterStatus === s ? 'active' : ''}">${s}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Employee</th><th>Violation</th><th>Status</th><th>Issued</th><th>Response Due</th><th></th></tr></thead>
          <tbody>
            ${rows.map(c => `
              <tr>
                <td class="name row-link" data-open="${c.id}">${escapeHtml(employeeName(c.employeeId))}</td>
                <td class="dim">${escapeHtml(c.violation)}</td>
                <td>${caseStatusBadge(c.status)}</td>
                <td class="dim">${fmtDate(c.dateIssued)}</td>
                <td class="dim">${fmtDate(c.responseDueDate)}</td>
                <td><button class="link-btn" data-open="${c.id}">View →</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No cases match this filter.</div>'}
      </div>
    `;

    qs('#btn-issue-nte', main).addEventListener('click', () => openNteForm(main));
    qsa('#seg-status button', main).forEach(b => b.addEventListener('click', () => { filterStatus = b.dataset.val; renderList(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openCaseDetail(main, el.dataset.open)));
  }

  function openCaseDetail(main, id) {
    const c = Store.getCase(id);
    if (!c) return;

    let actionHtml = '';
    if (c.status === 'Notice Issued') {
      actionHtml = `
        <div class="section-title">Record Employee Response</div>
        <div class="field full"><textarea id="resp-text" rows="3" placeholder="Employee's written explanation..."></textarea></div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="btn btn-primary btn-sm" id="btn-log-response">Save response</button>
          <button class="btn btn-danger btn-sm" id="btn-escalate">Escalate</button>
        </div>
      `;
    } else if (c.status === 'Under Investigation') {
      actionHtml = `
        <div class="section-title">Investigation Note</div>
        <div class="field full"><textarea id="inv-text" rows="2" placeholder="Add investigation finding..."></textarea></div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="btn btn-ghost btn-sm" id="btn-log-investigation">Add note</button>
        </div>
        ${c.terminationTrack ? `
        <div class="section-title">Twin-Notice Process (Art. 297)</div>
        <div class="page-sub" style="margin-bottom:8px;">Just-cause termination requires a hearing between the first and second notice, and a written second notice stating the decision.</div>
        <div class="modal-grid">
          <div class="field"><label>Hearing date</label><input type="date" id="hearing-date" value="${c.hearingDate || ''}" /></div>
          <div class="field full"><label>Hearing notes</label><textarea id="hearing-notes" rows="2">${escapeHtml(c.hearingNotes || '')}</textarea></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="btn-save-hearing">Save hearing</button>
        <div class="modal-grid" style="margin-top:12px;">
          <div class="field"><label>Second notice date</label><input type="date" id="second-notice-date" value="${c.secondNoticeDate || ''}" /></div>
          <div class="field"><label>Decision</label>
            <select id="second-notice-decision">
              <option value="">Select…</option>
              ${['Reinstated', 'Suspended', 'Terminated'].map(d => `<option ${d === c.secondNoticeDecision ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><label>Resolution / sanction details</label><textarea id="res-text" rows="2" placeholder="Resolution / sanction..."></textarea></div>
        </div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="btn btn-primary btn-sm" id="btn-resolve-twin-notice">Record second notice &amp; resolve</button>
          <button class="btn btn-danger btn-sm" id="btn-escalate">Escalate</button>
        </div>
        ` : `
        <div class="section-title">Resolve Case</div>
        <div class="field full"><textarea id="res-text" rows="2" placeholder="Resolution / sanction..."></textarea></div>
        <div class="modal-actions" style="justify-content:flex-start;">
          <button class="btn btn-primary btn-sm" id="btn-resolve">Resolve case</button>
          <button class="btn btn-danger btn-sm" id="btn-escalate">Escalate</button>
        </div>
        `}
      `;
    }

    openDrawer(`
      <h2>${escapeHtml(employeeName(c.employeeId))}</h2>
      <div class="page-sub" style="margin-bottom:10px;">${escapeHtml(c.violation)}</div>
      <div style="margin-bottom:14px;">${caseStatusBadge(c.status)}</div>
      <div class="page-sub">Issued: ${fmtDate(c.dateIssued)} by ${escapeHtml(c.issuedBy)}<br/>Response due: ${fmtDate(c.responseDueDate)}</div>
      <div class="section-title">Notice</div>
      <div class="page-sub">${escapeHtml(c.noticeText)}</div>
      ${c.employeeResponse ? `<div class="section-title">Employee Response</div><div class="page-sub">${escapeHtml(c.employeeResponse)} <span style="color:var(--text-faint);">(${fmtDate(c.employeeResponseDate)})</span></div>` : ''}
      ${c.investigationNotes ? `<div class="section-title">Investigation Notes</div><div class="page-sub">${escapeHtml(c.investigationNotes)}</div>` : ''}
      ${c.terminationTrack && c.hearingDate ? `<div class="section-title">Hearing</div><div class="page-sub">${fmtDate(c.hearingDate)}${c.hearingNotes ? ' — ' + escapeHtml(c.hearingNotes) : ''}</div>` : ''}
      ${c.terminationTrack && c.secondNoticeDecision ? `<div class="section-title">Second Notice</div><div class="page-sub">${fmtDate(c.secondNoticeDate)} — Decision: <strong>${escapeHtml(c.secondNoticeDecision)}</strong>${c.secondNoticeDecision === 'Terminated' ? ` <button type="button" class="link-btn" id="btn-goto-offboarding-from-case">Start Offboarding →</button>` : ''}</div>` : ''}
      ${c.resolution ? `<div class="section-title">Resolution</div><div class="page-sub">${escapeHtml(c.resolution)} <span style="color:var(--text-faint);">(${fmtDate(c.resolvedDate)})</span></div>` : ''}

      ${actionHtml}

      <div class="section-title">Audit Trail</div>
      <div class="timeline">
        ${c.history.slice().reverse().map(h => `
          <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
            <div class="tl-title">${escapeHtml(h.action)}</div>
            <div class="tl-meta">${fmtDate(h.date)}</div>
            <div class="tl-text">${escapeHtml(h.note)}</div>
          </div></div>
        `).join('')}
      </div>
      <div class="modal-actions" style="margin-top:16px;">
        <button class="btn btn-ghost btn-sm" id="btn-del-case">Delete case</button>
      </div>
    `, (dr) => {
      const respBtn = qs('#btn-log-response', dr);
      if (respBtn) respBtn.addEventListener('click', async () => {
        const text = qs('#resp-text', dr).value.trim();
        if (!text) { toast('Enter the employee response first.'); return; }
        await Store.updateCase(c.id, { employeeResponse: text, employeeResponseDate: todayISO(), status: 'Under Investigation' }, { action: 'Employee Response', note: text });
        await Store.updateCase(c.id, {}, { action: 'Investigation', note: 'Case moved to investigation.' });
        toast('Response recorded.');
        openCaseDetail(main, c.id);
        renderList(main);
      });
      const invBtn = qs('#btn-log-investigation', dr);
      if (invBtn) invBtn.addEventListener('click', async () => {
        const text = qs('#inv-text', dr).value.trim();
        if (!text) { toast('Enter an investigation note first.'); return; }
        const combined = (c.investigationNotes ? c.investigationNotes + ' ' : '') + text;
        await Store.updateCase(c.id, { investigationNotes: combined }, { action: 'Investigation', note: text });
        toast('Investigation note added.');
        openCaseDetail(main, c.id);
        renderList(main);
      });
      const resolveBtn = qs('#btn-resolve', dr);
      if (resolveBtn) resolveBtn.addEventListener('click', async () => {
        const text = qs('#res-text', dr).value.trim();
        if (!text) { toast('Enter the resolution first.'); return; }
        await Store.updateCase(c.id, { resolution: text, resolvedDate: todayISO(), status: 'Resolved' }, { action: 'Resolved', note: text });
        toast('Case resolved.');
        closeDrawer();
        renderList(main);
      });
      const hearingBtn = qs('#btn-save-hearing', dr);
      if (hearingBtn) hearingBtn.addEventListener('click', async () => {
        const hearingDate = qs('#hearing-date', dr).value;
        const hearingNotes = qs('#hearing-notes', dr).value.trim();
        await Store.updateCase(c.id, { hearingDate: hearingDate || null, hearingNotes }, { action: 'Hearing', note: hearingNotes || ('Hearing held ' + fmtDate(hearingDate)) });
        toast('✔ Hearing recorded.');
        openCaseDetail(main, c.id);
        renderList(main);
      });
      const twinResolveBtn = qs('#btn-resolve-twin-notice', dr);
      if (twinResolveBtn) twinResolveBtn.addEventListener('click', async () => {
        const decision = qs('#second-notice-decision', dr).value;
        const secondNoticeDate = qs('#second-notice-date', dr).value;
        const text = qs('#res-text', dr).value.trim();
        if (!decision || !secondNoticeDate) { toast('Enter the second notice date and decision first.'); return; }
        await Store.updateCase(c.id, {
          secondNoticeDate, secondNoticeDecision: decision,
          resolution: text || `Second notice issued — ${decision}.`, resolvedDate: todayISO(), status: 'Resolved',
        }, { action: 'Second Notice — ' + decision, note: text || ('Decision: ' + decision) });
        toast('✔ Case resolved.');
        closeDrawer();
        renderList(main);
      });
      const gotoOffboardingFromCase = qs('#btn-goto-offboarding-from-case', dr);
      if (gotoOffboardingFromCase) gotoOffboardingFromCase.addEventListener('click', () => { closeDrawer(); location.hash = '#offboarding'; });
      const escBtn = qs('#btn-escalate', dr);
      if (escBtn) escBtn.addEventListener('click', async () => {
        await Store.updateCase(c.id, { status: 'Escalated' }, { action: 'Escalated', note: 'Case escalated to Management for further action.' });
        toast('Case escalated.');
        closeDrawer();
        renderList(main);
      });
      qs('#btn-del-case', dr).addEventListener('click', async () => {
        if (confirm('Delete this disciplinary case?')) {
          await Store.deleteCase(c.id);
          closeDrawer();
          toast('Case deleted.');
          renderList(main);
        }
      });
    });
  }

  // Ordinal suffix for a suggested-penalty occurrence count (1st, 2nd, 3rd, 4th...).
  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function openNteForm(main) {
    openModal(`
      <h2>Issue Notice to Explain</h2>
      <div class="modal-sub">Creates a new disciplinary case with status "Notice Issued".</div>
      <form id="nte-form">
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select name="employeeId" id="nte-employee">${employeeOptions()}</select></div>
          <div class="field"><label>Date issued</label><input type="date" name="dateIssued" id="nte-date-issued" value="${todayISO()}" /></div>
          <div class="field"><label>Response due date</label><input type="date" name="responseDueDate" value="${addDays(todayISO(), 3)}" /></div>
          <div class="field full"><label>Issued by</label><input name="issuedBy" placeholder="e.g. HR Officer name" /></div>
          <div class="field full"><label>Category</label>
            <select id="nte-category">
              <option value="">Select a category…</option>
              ${Store.disciplineCatalog().map(cat => `<option value="${escapeHtml(cat.category)}">${escapeHtml(cat.category)}</option>`).join('')}
              <option value="__other">Other / not listed in the Code of Discipline</option>
            </select>
          </div>
          <div class="field full" id="nte-offense-wrap">
            <label>Offense (Code of Discipline)</label>
            <select name="offenseCode" id="nte-offense"><option value="">Select a category first…</option></select>
          </div>
          <div class="field full" id="nte-custom-wrap" style="display:none;">
            <label>Describe the violation</label>
            <input name="violationCustom" id="nte-violation-custom" placeholder="e.g. Habitual Tardiness" />
          </div>
          <div class="field full" id="nte-suggestion" style="display:none;"></div>
          <div class="field full"><label>Notice details</label><textarea name="noticeText" rows="3" required placeholder="Describe the incident/violation..."></textarea></div>
          <div class="field full" style="padding-top:4px;">
            <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer;">
              <input type="checkbox" name="terminationTrack" style="width:auto;" />
              May result in termination (enables the Art. 297 twin-notice hearing/second-notice steps)
            </label>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Issue NTE</button>
        </div>
      </form>
    `, (bd) => {
      const categorySelect = qs('#nte-category', bd);
      const offenseSelect = qs('#nte-offense', bd);
      const offenseWrap = qs('#nte-offense-wrap', bd);
      const customWrap = qs('#nte-custom-wrap', bd);
      const suggestionEl = qs('#nte-suggestion', bd);

      // Suggested penalty is purely informational (Store.suggestedPenaltyFor never writes
      // anything) -- HR still fills in the actual resolution/second-notice decision by hand
      // once the case reaches that stage, exactly as before.
      function updateSuggestion() {
        const offenseCode = offenseSelect.value;
        const employeeId = qs('#nte-employee', bd).value;
        const dateIssued = qs('#nte-date-issued', bd).value;
        if (!offenseCode || !employeeId) { suggestionEl.style.display = 'none'; return; }
        const suggestion = Store.suggestedPenaltyFor(employeeId, offenseCode, dateIssued);
        if (!suggestion) { suggestionEl.style.display = 'none'; return; }
        suggestionEl.style.display = '';
        suggestionEl.innerHTML = `<div class="page-sub" style="background:var(--bg-soft,#f4f4f5); padding:8px 10px; border-radius:6px;">This will be their <strong>${ordinal(suggestion.occurrence)}</strong> time for this offense in the past 12 months → Code of Discipline suggested penalty: <strong>${escapeHtml(suggestion.label)}</strong>.</div>`;
      }

      function updateOffenseOptions() {
        const cat = categorySelect.value;
        if (cat === '__other') {
          offenseWrap.style.display = 'none';
          customWrap.style.display = '';
          offenseSelect.innerHTML = '';
          updateSuggestion();
          return;
        }
        offenseWrap.style.display = '';
        customWrap.style.display = 'none';
        const catEntry = Store.disciplineCatalog().find(c => c.category === cat);
        offenseSelect.innerHTML = '<option value="">Select an offense…</option>' +
          (catEntry ? catEntry.offenses.map(o => `<option value="${o.code}">${escapeHtml(o.label)}</option>`).join('') : '');
        updateSuggestion();
      }

      categorySelect.addEventListener('change', updateOffenseOptions);
      offenseSelect.addEventListener('change', updateSuggestion);
      qs('#nte-employee', bd).addEventListener('change', updateSuggestion);
      qs('#nte-date-issued', bd).addEventListener('change', updateSuggestion);

      qs('#nte-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        let violation = '', offenseCode = null;
        if (categorySelect.value === '__other') {
          violation = (fd.get('violationCustom') || '').trim();
        } else {
          offenseCode = offenseSelect.value || null;
          const catEntry = Store.disciplineCatalog().find(c => c.category === categorySelect.value);
          const offense = catEntry && catEntry.offenses.find(o => o.code === offenseCode);
          violation = offense ? offense.label : '';
        }
        if (!violation) { toast('Select an offense, or choose "Other" and describe the violation.'); return; }
        await Store.addCase({
          employeeId: fd.get('employeeId'),
          dateIssued: fd.get('dateIssued'),
          responseDueDate: fd.get('responseDueDate'),
          issuedBy: fd.get('issuedBy').trim() || 'HR',
          violation, offenseCode,
          noticeText: fd.get('noticeText').trim(),
          employeeResponse: '', employeeResponseDate: null,
          investigationNotes: '', resolution: '', resolvedDate: null,
          terminationTrack: fd.get('terminationTrack') === 'on',
        });
        toast('NTE issued.');
        closeModal();
        renderList(main);
      });
    });
  }

  return { render: renderList };
})();
