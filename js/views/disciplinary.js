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
      <div class="page-sub">Issued: ${fmtDate(c.dateIssued)} by ${escapeHtml(c.issuedBy)}<br/>Response due: ${fmtDate(c.responseDueDate)}${c.dateDiscovered ? `<br/>Offense became known: ${fmtDate(c.dateDiscovered)} (prescriptive period ${c.longPrescription ? '1 year' : Store.PRESCRIPTION_DAYS + ' calendar days'})` : ''}</div>
      <div class="section-title" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
        <span>Notice</span>
        ${c.noticeText ? '<button type="button" class="btn btn-ghost btn-sm" id="btn-print-nte">Print NTE</button>' : ''}
      </div>
      <div class="page-sub" style="white-space:pre-wrap; max-height:320px; overflow:auto; background:var(--bg-soft,#f6f7f9); border:1px solid var(--border-soft); border-radius:8px; padding:10px 12px;">${escapeHtml(c.noticeText)}</div>
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
      const printBtn = qs('#btn-print-nte', dr);
      if (printBtn) printBtn.addEventListener('click', () => printStoredNotice(c));
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

  // ---------------------------------------------------------------- printing
  // Opens the notice in its own window and prints it, so it comes out alone on A4 with its
  // own letterhead rather than as a screenshot of the dashboard.
  function printHtml(html) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups for this site to print the notice.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { /* the page is open; the user can print it */ } }, 350);
  }

  // Reprints a notice from the text stored on the case -- exactly what was filed and served,
  // not a letter rebuilt from today's catalog or today's record, either of which may have
  // changed since. Headings and the dismissal warning are picked out for readability; the
  // words are left exactly as recorded. Older notices, written before the letter was
  // generated, print the same way.
  function printStoredNotice(c) {
    const lines = String(c.noticeText || '').split('\n');
    const bodyHtml = lines.map((ln) => {
      if (!ln.trim()) return '<div class="gap"></div>';
      const e = escapeHtml(ln);
      if (/^\d\.\s{2}[A-Z][A-Z ,/()-]+$/.test(ln)) return '<h3>' + e + '</h3>';
      if (/^DISMISSAL IS BEING CONSIDERED/.test(ln)) return '<p class="strong">' + e + '</p>';
      if (/^NOTICE TO EXPLAIN/.test(ln)) return '<h1>' + e.replace(/\s{2,}Form CD-01/, '') + '</h1>';
      if (/_{6,}/.test(ln)) return '<p class="sig">' + e + '</p>';
      return '<p>' + e + '</p>';
    }).join('');
    printHtml('<!doctype html><html><head><meta charset="utf-8"><title>Notice to Explain</title><style>' +
      '@page{size:A4;margin:18mm}' +
      'body{font:10.5pt/1.5 Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0}' +
      'h1{font-size:15pt;letter-spacing:.06em;color:#fff;background:#1f4e9c;padding:7px 12px;margin:6px 0 10px;border-bottom:3px solid #e8a317}' +
      'h3{font-size:10.5pt;color:#16386e;margin:10px 0 3px;border-bottom:1px solid #bfcfe8}' +
      'p{margin:0 0 4px;text-align:justify}p.sig{margin-top:18px}' +
      'p.strong{font-weight:700;background:#fdf0f0;border-left:3px solid #9c1c1c;padding:5px 8px}' +
      '.gap{height:4px}' +
      '.foot{margin-top:14px;font-size:8pt;color:#777;border-top:1px solid #ddd;padding-top:4px}' +
      '@media screen{body{max-width:190mm;margin:14px auto;padding:0 12px}}' +
      '</style></head><body>' + bodyHtml +
      '<div class="foot">Printed from the case record. Notice issued ' + escapeHtml(fmtDate(c.dateIssued)) + '.</div>' +
      '</body></html>');
  }

  // ---------------------------------------------------------------- issue NTE
  // Class colours, identical to the printed Code, My Portal and the Code editor, so an
  // offense looks the same everywhere HR or an employee meets it.
  const CLASS_TINT = {
    A: { bg: '#e2f0d9', fg: '#375623', bar: '#7aa661', name: 'Light' },
    B: { bg: '#fff2cc', fg: '#7f6000', bar: '#d4b02a', name: 'Less Grave' },
    C: { bg: '#fbe5d6', fg: '#974706', bar: '#d98b4a', name: 'Grave' },
    D: { bg: '#f8cbcb', fg: '#9c1c1c', bar: '#d05a5a', name: 'Serious' },
  };
  function classChip(k) {
    const t = CLASS_TINT[k];
    return t ? `<span class="badge" style="background:${t.bg}; color:${t.fg}; font-weight:700; white-space:nowrap;">${k} · ${t.name}</span>` : '';
  }

  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function findOffense(code) {
    for (const cat of Store.disciplineCatalog()) {
      const o = cat.offenses.find(x => x.code === code);
      if (o) return Object.assign({ category: cat.category }, o);
    }
    return null;
  }

  function sectionOf(category) {
    const s = window.NteLetter && NteLetter.SECTIONS[category];
    return s ? 'Section ' + s[0] : 'Part IV';
  }

  function superiorNameFor(emp) {
    if (!emp || !emp.reportsTo) return '';
    const sup = Store.getEmployee(emp.reportsTo);
    return sup ? sup.name : '';
  }

  // A reference that is unique enough to find the paper copy by, and readable aloud.
  function newRefNo(dateIso) {
    return 'NTE-' + String(dateIso || todayISO()).replace(/-/g, '') + '-' +
      Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function openNteForm(main) {
    const today = todayISO();
    const minDue = (issued) => addDays(issued || today, Store.NTE_MIN_ANSWER_DAYS);
    const s = {
      offenseCode: '',
      analogous: false,
      unlistedReason: '',
      dismissal: false,
      dismissalTouched: false,
      longPrescription: false,
      longTouched: false,
      refNo: '',
    };

    openModal(`
      <h2>Issue Notice to Explain</h2>
      <div class="modal-sub">Select the employee and the offense from the Code of Discipline. The system drafts the notice in the Annex A format for you to read before anything is issued.</div>
      <form id="nte-form" novalidate>
        <div class="section-title" style="margin-top:0;">1 · Employee</div>
        <div class="modal-grid">
          <div class="field full"><label>Employee</label><select id="nte-employee">${employeeOptions()}</select></div>
          <div class="field"><label>Date issued</label><input type="date" id="nte-date-issued" value="${today}" /></div>
          <div class="field"><label>Issued by (HRD)</label><input id="nte-issued-by" placeholder="HR officer who signs the notice" /></div>
        </div>

        <div class="section-title">2 · What happened</div>
        <div class="page-sub" style="margin:-4px 0 10px;">Section 3.6 requires the specific act, with its date, time and place. Say what was done — not which rule it breaks. Where it matters, give the number: days absent, times late, the peso amount of a loss, whether notice was given.</div>
        <div class="modal-grid">
          <div class="field"><label>Date of incident</label><input type="date" id="nte-inc-date" value="${today}" max="${today}" /></div>
          <div class="field"><label>Time</label><input id="nte-inc-time" placeholder="e.g. around 2:00 PM" /></div>
          <div class="field full"><label>Place</label><input id="nte-inc-place" placeholder="e.g. Client jobsite, Ayala Avenue, Makati City" /></div>
          <div class="field full"><label>Date the offense became known to the supervisor or HR</label>
            <input type="date" id="nte-date-discovered" max="${today}" />
            <div class="page-sub" style="margin:4px 0 0;">Whichever of them learned of it first. Section 3.11 runs the prescriptive period from this date.</div>
          </div>
          <div class="field full"><label>Incident details</label>
            <textarea id="nte-narrative" rows="4" placeholder="e.g. Did not report for work on 3 September and did not call or message his supervisor. No leave was filed."></textarea>
          </div>
        </div>

        <div class="section-title">3 · Offense under the Code of Discipline</div>
        <div class="modal-grid" style="margin-bottom:6px;">
          <div class="field full"><label>Category</label>
            <select id="nte-category">
              <option value="">Select a category…</option>
              ${Store.disciplineCatalog().map(cat => `<option value="${escapeHtml(cat.category)}">${escapeHtml(cat.category)}</option>`).join('')}
            </select>
          </div>
          <div class="field full"><label>Offense</label><select id="nte-offense"><option value="">Select a category first…</option></select></div>
        </div>
        <div id="nte-charge"></div>

        <div class="section-title">4 · Deadline for the written explanation</div>
        <div class="modal-grid">
          <div class="field"><label>Explanation due</label><input type="date" id="nte-due" value="${minDue(today)}" min="${minDue(today)}" /></div>
          <div class="field" style="align-self:end;"><div class="page-sub" style="margin:0;">At least ${Store.NTE_MIN_ANSWER_DAYS} calendar days from receipt — Section 3.6 and DOLE D.O. 147-15. A shorter period invalidates the notice.</div></div>
        </div>

        <div id="nte-problems"></div>
        <div id="nte-review" style="display:none;"></div>

        <div class="modal-actions" id="nte-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="button" class="btn btn-primary" id="nte-review-btn">Review notice</button>
        </div>
      </form>
    `, (bd) => {
      const modal = qs('.modal', bd);
      if (modal) modal.classList.add('modal-wide');
      const $ = (sel) => qs(sel, bd);

      const narrativeEl = $('#nte-narrative');
      const dateIssuedEl = $('#nte-date-issued');
      const dueEl = $('#nte-due');
      const incDateEl = $('#nte-inc-date');
      const employeeEl = $('#nte-employee');

      const val = (sel) => ($(sel).value || '').trim();

      function chooseOffense(code) {
        s.offenseCode = code;
        s.dismissalTouched = false;
        s.longTouched = false;
        s.refNo = '';
        renderCharge();
        invalidateReview();
      }

      // ---- offense picker: category -> offense, both plain dropdowns. HR already knows
      // the Code; picking straight from it is faster and more reliable than writing a
      // narrative for a keyword matcher to interpret.
      $('#nte-category').addEventListener('change', () => {
        const cat = Store.disciplineCatalog().find(c => c.category === $('#nte-category').value);
        $('#nte-offense').innerHTML = '<option value="">Select an offense…</option>' +
          (cat ? cat.offenses.map(o => `<option value="${escapeHtml(o.code)}">${o.klass} · ${escapeHtml(o.label)}</option>`).join('') : '');
      });
      $('#nte-offense').addEventListener('change', () => { if ($('#nte-offense').value) chooseOffense($('#nte-offense').value); });

      // ---- the charge: class, penalty step, dismissal, unlisted act
      // Store.suggestedPenaltyFor counts same-class offenses within the Sec. 3.4 period. The
      // dismissal and habitual-delinquency flags are derived here from what it returns.
      function penaltyFor(empId, code, dateIssued) {
        if (!code || !empId) return null;
        const pen = Store.suggestedPenaltyFor(empId, code, dateIssued || today);
        if (!pen) return null;
        // Sec. 3.4: a fifth Class A offense in the same period goes to Section 3.10 (Habitual
        // Delinquency). The Class A schedule has four steps, so without this the fifth would
        // silently clamp to the fourth step's penalty instead of pointing HR at Sec. 3.10.
        return Object.assign({}, pen, {
          isDismissal: pen.code === 'D',
          habitual: pen.klass === 'A' && pen.occurrence >= 5,
        });
      }
      function penaltyNow() { return penaltyFor(employeeEl.value, s.offenseCode, dateIssuedEl.value); }

      // Sec. 3.11: the last date to issue, and whether it has passed. Null until there is both
      // a discovery date and an offense to take the period from.
      function prescriptionCheck() {
        const disc = $('#nte-date-discovered').value;
        const issued = dateIssuedEl.value;
        if (!disc || !issued || !s.offenseCode) return null;
        const deadline = Store.prescriptionDeadline(disc, s.longPrescription);
        return { deadline: deadline, lapsed: issued > deadline, period: s.longPrescription ? '1 year' : Store.PRESCRIPTION_DAYS + ' calendar days' };
      }
      function renderPrescription() {
        const el = $('#nte-prescription-status');
        if (!el) return;
        const c = prescriptionCheck();
        if (!c) { el.innerHTML = '<div class="page-sub" style="margin:6px 0 0;">Enter the date the offense became known (step 2) to see the last date this notice may issue.</div>'; return; }
        el.innerHTML = c.lapsed
          ? `<div style="margin-top:6px; font-size:12px; padding:6px 9px; border-radius:7px; background:rgba(208,90,90,.12);"><strong>This offense has prescribed.</strong> The ${escapeHtml(c.period)} period ended on ${escapeHtml(fmtDate(c.deadline))}, so no NTE may be issued for it (Section 3.11).</div>`
          : `<div class="page-sub" style="margin:6px 0 0;">Prescriptive period: ${escapeHtml(c.period)}. This notice may issue until <strong>${escapeHtml(fmtDate(c.deadline))}</strong>.</div>`;
      }

      function renderCharge() {
        const box = $('#nte-charge');
        const off = s.offenseCode ? findOffense(s.offenseCode) : null;
        if (!off) { box.innerHTML = ''; return; }
        const pen = penaltyNow();
        if (pen && !s.dismissalTouched) s.dismissal = !!pen.isDismissal;
        if (!s.longTouched) s.longPrescription = Store.prescriptionFor(off.code).long;

        box.innerHTML = `
          <div style="margin-top:10px; border:1px solid var(--border-soft); border-radius:10px; padding:11px 13px; background:var(--bg-soft,#f7f8fa);">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
              <div style="flex:1; min-width:0;">
                <div class="page-sub" style="margin:0 0 3px; text-transform:uppercase; letter-spacing:.04em; font-size:10.5px;">Charged offense</div>
                <div style="font-size:13.5px; line-height:1.4; font-weight:600;">${escapeHtml(off.label)}</div>
                <div class="page-sub" style="margin:4px 0 0;">${classChip(off.klass)} &nbsp;${escapeHtml(sectionOf(off.category))} · ${escapeHtml(off.category)}</div>
              </div>
              <button type="button" class="link-btn" id="nte-clear-offense">Change</button>
            </div>

            ${pen ? `
              <div class="page-sub" style="margin:10px 0 0;">
                ${pen.klass
                  ? `This would be the employee’s <strong>${ordinal(pen.occurrence)}</strong> Class ${escapeHtml(pen.klass)} offense in the current 12-month period`
                  : `This would be the employee’s <strong>${ordinal(pen.occurrence)}</strong> time for this offense in the current 12-month period`}
                — the normal penalty under Section 3.4 is <strong>${escapeHtml(pen.label)}</strong>.
              </div>` : `<div class="page-sub" style="margin:10px 0 0;">Choose the employee to see which step of the penalty schedule applies.</div>`}

            ${pen && pen.habitual ? `
              <div style="margin-top:8px; font-size:12px; padding:6px 9px; border-radius:7px; background:rgba(208,90,90,.12);">
                This would be a <strong>fifth Class A offense</strong> within 12 months. Section 3.4 sends that to Section 3.10 (Habitual Delinquency), which is a Grave offense with its own notice.
              </div>` : ''}

            <label style="display:flex; gap:8px; align-items:flex-start; margin:12px 0 0; cursor:pointer; font-weight:400;">
              <input type="checkbox" id="nte-dismissal" ${s.dismissal ? 'checked' : ''} style="width:auto; margin-top:3px;" />
              <span>Dismissal is being considered
                <span class="page-sub" style="display:block; margin:2px 0 0;">Section 3.6 requires the notice to say so. It also opens the hearing and second-notice steps on the case.</span>
              </span>
            </label>
            ${pen && pen.isDismissal && !s.dismissal ? `
              <div style="margin-top:6px; font-size:12px; padding:6px 9px; border-radius:7px; background:rgba(212,176,42,.18);">
                The normal penalty at this step is dismissal. If the notice does not say dismissal is being considered, dismissal will not be available as the penalty in this case.
              </div>` : ''}

            <label style="display:flex; gap:8px; align-items:flex-start; margin:12px 0 0; cursor:pointer; font-weight:400;">
              <input type="checkbox" id="nte-analogous" ${s.analogous ? 'checked' : ''} style="width:auto; margin-top:3px;" />
              <span>The act is not listed in Part IV — charge it under Section 3.13, using this offense as the most closely analogous
                <span class="page-sub" style="display:block; margin:2px 0 0;">Only for an act grossly prejudicial to the Company. The class of this offense is applied.</span>
              </span>
            </label>
            <label style="display:flex; gap:8px; align-items:flex-start; margin:12px 0 0; cursor:pointer; font-weight:400;">
              <input type="checkbox" id="nte-long" ${s.longPrescription ? 'checked' : ''} style="width:auto; margin-top:3px;" />
              <span>Involves fraud, dishonesty, theft, falsification, sexual harassment or violence — 1-year prescriptive period
                <span class="page-sub" style="display:block; margin:2px 0 0;">Set from the offense chosen. Change it only for an offense added to the catalog (Section 3.11).</span>
              </span>
            </label>
            <div id="nte-prescription-status"></div>

            ${s.analogous ? `
              <div class="field full" style="margin-top:8px;">
                <label>Why the act is grossly prejudicial to the Company</label>
                <textarea id="nte-unlisted-reason" rows="2" placeholder="State the actual harm or risk to the Company.">${escapeHtml(s.unlistedReason)}</textarea>
              </div>` : ''}
          </div>`;

        $('#nte-clear-offense').addEventListener('click', () => {
          s.offenseCode = ''; s.analogous = false; s.unlistedReason = '';
          $('#nte-category').value = '';
          $('#nte-offense').innerHTML = '<option value="">Select a category first…</option>';
          renderCharge(); invalidateReview();
        });
        $('#nte-dismissal').addEventListener('change', (e) => {
          s.dismissal = e.target.checked; s.dismissalTouched = true;
          renderCharge(); invalidateReview();
        });
        $('#nte-analogous').addEventListener('change', (e) => {
          s.analogous = e.target.checked;
          renderCharge(); invalidateReview();
        });
        const reason = $('#nte-unlisted-reason');
        if (reason) reason.addEventListener('input', (e) => { s.unlistedReason = e.target.value; invalidateReview(); });
        $('#nte-long').addEventListener('change', (e) => {
          s.longPrescription = e.target.checked; s.longTouched = true;
          renderPrescription(); invalidateReview();
        });
        renderPrescription();
      }

      // ---- the letter
      function buildLetter() {
        const empId = employeeEl.value;
        const emp = empId ? Store.getEmployee(empId) : null;
        const dateIssued = dateIssuedEl.value;
        const off = s.offenseCode ? findOffense(s.offenseCode) : null;
        if (!s.refNo) s.refNo = newRefNo(dateIssued);
        const r = NteLetter.buildNte({
          refNo: s.refNo,
          dateIssued: dateIssued,
          dueDate: dueEl.value,
          employee: emp ? { name: emp.name, position: emp.position, category: emp.category } : {},
          superiorName: superiorNameFor(emp),
          issuedBy: val('#nte-issued-by'),
          incident: { narrative: narrativeEl.value, date: incDateEl.value, time: val('#nte-inc-time'), place: val('#nte-inc-place') },
          offense: off ? { code: off.code, label: off.label, category: off.category, klass: off.klass } : {},
          analogous: s.analogous,
          unlistedReason: s.unlistedReason,
          penalty: off ? penaltyFor(empId, off.code, dateIssued) : null,
          dismissalConsidered: s.dismissal,
          minDays: Store.NTE_MIN_ANSWER_DAYS,
        });
        // Sec. 3.11, and the order of events it depends on. Listed first: a prescribed
        // offense cannot be charged however well the notice is written.
        const procedural = [];
        const disc = $('#nte-date-discovered').value;
        if (!disc) {
          procedural.push('Give the date the offense became known to the supervisor or HR. Section 3.11 runs the prescriptive period from it.');
        } else {
          if (dateIssued && disc > dateIssued) procedural.push('The offense cannot have become known after the notice is issued. Check both dates.');
          if (incDateEl.value && incDateEl.value > disc) procedural.push('The incident is dated after the date it became known. Check both dates.');
          const pc = prescriptionCheck();
          if (pc && pc.lapsed) procedural.push('This offense has prescribed. The ' + pc.period + ' period under Section 3.11 ended on ' + fmtDate(pc.deadline) + ', so no NTE may be issued for it.');
        }
        if (procedural.length) { r.ok = false; r.problems = procedural.concat(r.problems); }
        return r;
      }

      function showProblems(list) {
        $('#nte-problems').innerHTML = list.length ? `
          <div style="margin:4px 0 10px; padding:9px 12px; border-radius:9px; background:rgba(208,90,90,.10); border:1px solid rgba(208,90,90,.35);">
            <div style="font-weight:700; font-size:13px; margin-bottom:4px;">The notice can’t be issued yet</div>
            <ul style="margin:0; padding-left:18px;">${list.map(p => `<li class="page-sub" style="margin:2px 0;">${escapeHtml(p)}</li>`).join('')}</ul>
          </div>` : '';
      }

      // Any edit after reviewing hides the review, so the letter that gets issued is always
      // the letter that was read.
      function invalidateReview() {
        const rv = $('#nte-review');
        if (rv.style.display !== 'none') {
          rv.style.display = 'none';
          rv.innerHTML = '';
          $('#nte-actions').style.display = '';
        }
      }

      $('#nte-review-btn').addEventListener('click', () => {
        const r = buildLetter();
        showProblems(r.problems);
        if (!r.ok) { $('#nte-problems').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

        const rv = $('#nte-review');
        rv.innerHTML = `
          <div class="section-title">5 · Read the notice</div>
          <div class="page-sub" style="margin:-4px 0 8px;">This is the letter that will be filed on the case and served on the employee. Nothing has been issued yet.</div>
          <iframe id="nte-frame" title="Notice to Explain" style="width:100%; height:560px; border:1px solid var(--border-soft); border-radius:8px; background:#fff;"></iframe>
          <div class="modal-actions" style="margin-top:10px;">
            <button type="button" class="btn btn-ghost" id="nte-back">Back to editing</button>
            <button type="button" class="btn btn-primary" id="nte-issue">Issue this notice</button>
          </div>`;
        rv.style.display = '';
        $('#nte-actions').style.display = 'none';
        $('#nte-frame').srcdoc = r.html;
        rv.scrollIntoView({ behavior: 'smooth', block: 'start' });

        $('#nte-back').addEventListener('click', invalidateReview);
        $('#nte-issue').addEventListener('click', async () => {
          const final = buildLetter();
          if (!final.ok || final.text !== r.text) { showProblems(final.problems); invalidateReview(); return; }
          const off = findOffense(s.offenseCode);
          const btn = $('#nte-issue');
          btn.disabled = true;
          btn.textContent = 'Issuing…';
          const empId = employeeEl.value;
          try {
            await Store.addCase({
              employeeId: empId,
              dateIssued: dateIssuedEl.value,
              responseDueDate: dueEl.value,
              dateDiscovered: $('#nte-date-discovered').value,
              longPrescription: !!s.longPrescription,
              issuedBy: val('#nte-issued-by'),
              violation: s.analogous ? off.label + ' (applied by analogy, Sec. 3.13)' : off.label,
              offenseCode: off.code,
              noticeText: final.text,
              employeeResponse: '', employeeResponseDate: null,
              investigationNotes: '', resolution: '', resolvedDate: null,
              terminationTrack: !!s.dismissal,
            });
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Issue this notice';
            return;   // Store.addCase has already said what went wrong
          }
          toast('NTE issued. Opening the printable notice…');
          closeModal();
          renderList(main);
          const created = Store.listCases()
            .filter(c => c.employeeId === empId && c.noticeText === final.text)
            .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
          if (created) {
            openCaseDetail(main, created.id);
            // Print pop-ups only need to be triggered once, right after issuance -- HR
            // can still reprint later from the case's own "Print NTE" button (unchanged).
            printStoredNotice(created);
          }
        });
      });

      // ---- keeping things in step
      narrativeEl.addEventListener('input', invalidateReview);
      employeeEl.addEventListener('change', () => { s.refNo = ''; renderCharge(); invalidateReview(); });
      dateIssuedEl.addEventListener('change', () => {
        const issued = dateIssuedEl.value || today;
        const min = minDue(issued);
        dueEl.min = min;
        if (!dueEl.value || dueEl.value < min) dueEl.value = min;
        incDateEl.max = issued;
        $('#nte-date-discovered').max = issued;
        s.refNo = '';
        renderCharge();
        invalidateReview();
      });
      $('#nte-date-discovered').addEventListener('change', () => { renderPrescription(); invalidateReview(); });
      ['#nte-inc-date', '#nte-inc-time', '#nte-inc-place', '#nte-issued-by', '#nte-due'].forEach((sel) => {
        $(sel).addEventListener('input', invalidateReview);
        $(sel).addEventListener('change', invalidateReview);
      });
    });
  }

  return { render: renderList };
})();
