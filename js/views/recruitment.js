window.Views.recruitment = (function () {
  let filterCategory = 'All';

  const MACRO_COLUMNS = ['Screening', 'Phone Interview', 'Interview / Agreement', 'Trade Test', 'Evaluation', 'Decision'];

  function macroStage(stage) {
    if (stage === 'Screening') return 'Screening';
    if (stage === 'Phone Interview') return 'Phone Interview';
    if (stage === 'Face-to-Face Interview' || stage === 'Candidate Agreement') return 'Interview / Agreement';
    if (stage === '3-Day Trade Test' || stage === '7-Day Trade Test') return 'Trade Test';
    if (stage === 'Evaluation') return 'Evaluation';
    return 'Decision';
  }

  function columnsFor() {
    if (filterCategory === 'All') return MACRO_COLUMNS;
    return stagesFor(filterCategory);
  }

  function candidateColumn(c) {
    return filterCategory === 'All' ? macroStage(c.stage) : c.stage;
  }

  function renderBoard(main) {
    const all = Store.listCandidates();
    const rows = filterCategory === 'All' ? all : all.filter(c => c.category === filterCategory);
    const cols = columnsFor();
    const today = todayISO();

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Recruitment</h1>
          <div class="page-sub">Application Screening → Interview / Assessment → Trade Test → Evaluation → Final Decision. Technicians follow a 7-day trade test; Admin, HR, and Engineers follow a 3-day trade test.</div>
        </div>
        <button class="btn btn-primary" id="btn-add-candidate">+ Add candidate</button>
      </div>

      <div class="filters">
        <div class="field">
          <label>Category</label>
          <div class="seg" id="seg-category">
            ${['All'].concat(CATEGORIES).map(c => `<button data-val="${c}" class="${filterCategory === c ? 'active' : ''}">${c}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="kanban">
        ${cols.map(col => {
          const inCol = rows.filter(c => candidateColumn(c) === col && !(col === 'Decision' && c.decision));
          const decided = col === 'Decision' ? rows.filter(c => c.decision) : [];
          const cardsAll = col === 'Decision' ? inCol.concat(decided) : inCol;
          return `
          <div class="kanban-col">
            <div class="kanban-col-head"><span>${col}</span><span class="count">${cardsAll.length}</span></div>
            <div class="kanban-cards">
              ${cardsAll.map(c => `
                <div class="kcard" data-open="${c.id}">
                  <div class="kname">${escapeHtml(c.name)}</div>
                  <div class="kmeta">${c.category} · ${escapeHtml(c.positionAppliedFor)}</div>
                  ${c.tradeTestEnd && !c.decision ? `<div class="kmeta" style="margin-top:4px;color:${c.tradeTestEnd < today ? 'var(--yellow)' : 'var(--text-faint)'};">Trade test ends ${fmtDate(c.tradeTestEnd)}</div>` : ''}
                  ${c.decision ? `<div style="margin-top:6px;">${decisionBadge(c.decision)}</div>` : ''}
                </div>
              `).join('') || '<div class="page-sub" style="font-size:11.5px;padding:4px 2px;">No candidates.</div>'}
            </div>
          </div>
        `; }).join('')}
      </div>
    `;

    qs('#btn-add-candidate', main).addEventListener('click', () => openCandidateForm(main));
    qsa('#seg-category button', main).forEach(b => b.addEventListener('click', () => { filterCategory = b.dataset.val; renderBoard(main); }));
    qsa('[data-open]', main).forEach(el => el.addEventListener('click', () => openCandidateDetail(main, el.dataset.open)));
  }

  function decisionBadge(d) {
    const map = { Hired: 'badge-green', Rejected: 'badge-red', 'On Hold': 'badge-yellow' };
    return `<span class="badge ${map[d] || 'badge-gray'}">${d}</span>`;
  }

  function openCandidateDetail(main, id) {
    const c = Store.getCandidate(id);
    if (!c) return;
    const stages = stagesFor(c.category);
    const idx = stages.indexOf(c.stage);
    const next = idx >= 0 && idx < stages.length - 1 ? stages[idx + 1] : null;

    openDrawer(`
      <h2>${escapeHtml(c.name)}</h2>
      <div class="page-sub" style="margin-bottom:10px;">${c.category} · ${escapeHtml(c.positionAppliedFor)}</div>
      <div style="margin-bottom:14px;">
        <span class="badge badge-orange">${escapeHtml(c.stage)}</span>
        ${c.decision ? decisionBadge(c.decision) : ''}
      </div>
      <div class="page-sub">Applied: ${fmtDate(c.appliedDate)}<br/>Phone: ${escapeHtml(c.phone || '—')}<br/>Email: ${escapeHtml(c.email || '—')}</div>
      ${c.tradeTestStart ? `<div class="page-sub" style="margin-top:8px;">Trade test: ${fmtDate(c.tradeTestStart)} → ${fmtDate(c.tradeTestEnd)}</div>` : ''}

      <div class="section-title">Timeline</div>
      <div class="timeline">
        ${c.history.slice().reverse().map(h => `
          <div class="tl-item"><div class="tl-dot"></div><div class="tl-body">
            <div class="tl-title">${escapeHtml(h.stage)}</div>
            <div class="tl-meta">${fmtDate(h.date)}</div>
            <div class="tl-text">${escapeHtml(h.note)}</div>
          </div></div>
        `).join('')}
      </div>

      ${!c.decision ? `
      <div class="modal-actions" style="margin-top:20px; justify-content:flex-start; flex-wrap:wrap;">
        ${next ? `<button class="btn btn-primary btn-sm" id="btn-advance">Move to: ${next} →</button>` : ''}
        ${c.stage === 'Evaluation' ? `
          <button class="btn btn-ghost btn-sm" id="btn-hire" style="color:var(--green);border-color:var(--green);">Hire</button>
          <button class="btn btn-ghost btn-sm" id="btn-hold">Hold</button>
          <button class="btn btn-danger btn-sm" id="btn-reject">Reject</button>
        ` : ''}
      </div>` : ''}
      <div class="modal-actions" style="margin-top:10px;">
        <button class="btn btn-ghost btn-sm" id="btn-del-candidate">Remove candidate</button>
      </div>
    `, (dr) => {
      const adv = qs('#btn-advance', dr);
      if (adv) adv.addEventListener('click', async () => {
        await Store.moveCandidateStage(c.id, next);
        toast('Moved to ' + next + '.');
        closeDrawer();
        renderBoard(main);
      });
      const hire = qs('#btn-hire', dr);
      if (hire) hire.addEventListener('click', async () => {
        await Store.decideCandidate(c.id, 'Hired', 'Endorsed by HR and Department Head; approved by Management.');
        toast(c.name + ' marked as Hired.');
        closeDrawer();
        renderBoard(main);
        // The decision itself is recorded regardless -- this just offers to create the
        // actual employee record (and optionally a My Portal login) right away instead of
        // making HR remember to do it separately later via + Add employee.
        openCompleteHireModal(main, c);
      });
      const hold = qs('#btn-hold', dr);
      if (hold) hold.addEventListener('click', async () => {
        await Store.decideCandidate(c.id, 'On Hold', 'Placed on hold pending further review.');
        toast(c.name + ' placed on hold.');
        closeDrawer();
        renderBoard(main);
      });
      const rej = qs('#btn-reject', dr);
      if (rej) rej.addEventListener('click', async () => {
        await Store.decideCandidate(c.id, 'Rejected', 'Not recommended for hiring.');
        toast(c.name + ' marked as Rejected.');
        closeDrawer();
        renderBoard(main);
      });
      qs('#btn-del-candidate', dr).addEventListener('click', async () => {
        if (confirm('Remove ' + c.name + ' from the pipeline?')) {
          await Store.deleteCandidate(c.id);
          closeDrawer();
          toast('Candidate removed.');
          renderBoard(main);
        }
      });
    });
  }

  // Turns a Hired candidate into a real employee record -- pre-filled with everything the
  // application already captured (name/category/position/contact); HR only has to add the
  // pay details a candidate record never carries (Pay Type/Rate/Pay Cycle). Optionally also
  // creates their My Portal login in the same step, via the admin-create-employee-account
  // Edge Function (same pattern/precedent as staff.js's password-reset flow -- only
  // Supabase's Admin API, service-role-key-only, can create another user's Auth account,
  // so this can't just be a Store.* call). Skipping this modal (Cancel) is fine -- the
  // Hired decision above is already saved either way; the employee record can always be
  // added later by hand via Employee Management -> + Add employee.
  function openCompleteHireModal(main, c) {
    const suggestedPayCycle = c.category === 'Technician' ? '15-30' : '10-20';
    openModal(`
      <h2>Create Employee Record — ${escapeHtml(c.name)}</h2>
      <div class="modal-sub">Pre-filled from ${escapeHtml(c.name)}'s application. Add their pay details to finish setting them up.</div>
      <form id="complete-hire-form">
        <div class="modal-grid">
          <div class="field full"><label>Full name</label><input name="name" required value="${escapeHtml(c.name)}" /></div>
          <div class="field"><label>Category</label>
            <select name="category">${CATEGORIES.map(cat => `<option ${cat === c.category ? 'selected' : ''}>${cat}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Position</label><input name="position" required value="${escapeHtml(c.positionAppliedFor || '')}" /></div>
          <div class="field"><label>Employee ID</label><input name="employeeCode" placeholder="e.g. TXT021" /></div>
          <div class="field"><label>Date hired</label><input type="date" name="dateHired" value="${todayISO()}" required /></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(c.phone || '')}" /></div>
          <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(c.email || '')}" /></div>
          <div class="field"><label>Pay cycle</label>
            <select name="payCycle">
              <option value="10-20" ${suggestedPayCycle === '10-20' ? 'selected' : ''}>Admins (${paydayLabel('10-20')})</option>
              <option value="15-30" ${suggestedPayCycle === '15-30' ? 'selected' : ''}>Technicians (${paydayLabel('15-30')})</option>
            </select>
          </div>
          <div class="field"><label>Pay type</label>
            <select name="payType">${['Monthly', 'Daily'].map(p => `<option>${p}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Rate (PHP)</label><input type="number" name="rate" min="0" step="0.01" required /></div>
          <div class="field full" style="display:flex; align-items:center; gap:8px;">
            <label style="display:flex; align-items:center; gap:6px; margin:0; cursor:pointer;">
              <input type="checkbox" name="createPortalAccount" checked style="width:auto;" />
              Also create their My Portal login (needs an Employee ID above)
            </label>
          </div>
        </div>
        <div id="complete-hire-error"></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Skip for now</button>
          <button type="submit" class="btn btn-primary">Create Employee Record</button>
        </div>
      </form>
    `, (bd) => {
      qs('#complete-hire-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const createPortal = fd.get('createPortalAccount') === 'on';
        const employeeCode = fd.get('employeeCode').trim().toUpperCase();
        const errEl = qs('#complete-hire-error', bd);
        errEl.innerHTML = '';
        if (createPortal && !employeeCode) {
          errEl.innerHTML = `<div class="auth-error">Set an Employee ID first, or uncheck "Also create their My Portal login".</div>`;
          return;
        }
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating…';
        try {
          const patch = {
            name: fd.get('name').trim(),
            category: fd.get('category'),
            position: fd.get('position').trim(),
            employeeCode,
            status: 'Active',
            employmentStatus: 'Regular',
            dateHired: fd.get('dateHired'),
            phone: fd.get('phone').trim(),
            email: fd.get('email').trim(),
            payCycle: fd.get('payCycle'),
            payType: fd.get('payType'),
            rate: Number(fd.get('rate')) || 0,
            allowancePerDay: 0, fixedAllowance: 0, housingAllowance: 0,
            nightShiftDifferential: false, fixedHours: true,
            notes: `Hired via Recruitment (candidate record: ${c.id}).`,
          };
          const newEmp = await Store.addEmployee(patch);

          if (!createPortal) {
            toast('✔ Employee record created.');
            closeModal();
            return;
          }

          const password = generateStrongPassword();
          const { data: { session } } = await sb.auth.getSession();
          const res = await fetch('https://fmgqqrmsxleyeiadnhyd.supabase.co/functions/v1/admin-create-employee-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + session.access_token },
            body: JSON.stringify({ employeeId: newEmp.id, password }),
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(result.error || 'Employee record was created, but the portal login failed -- grant it manually from Employee Management instead.');

          closeModal();
          openModal(`
            <h2>✔ Employee &amp; Portal Login Created</h2>
            <div class="modal-sub" style="margin-bottom:14px;">${escapeHtml(c.name)}'s My Portal login — copy it now and share it with them directly. It will not be shown again.</div>
            <div class="page-sub" style="margin-bottom:6px;">Employee ID: <strong>${escapeHtml(employeeCode)}</strong></div>
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
              <input type="text" readonly value="${escapeHtml(password)}" id="new-hire-pw-display" style="flex:1; font-family:monospace; font-size:15px;" onclick="this.select()" />
              <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-new-hire-pw">📋 Copy</button>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-primary" data-close-modal>Done</button>
            </div>
          `, (bd2) => {
            qs('#btn-copy-new-hire-pw', bd2).addEventListener('click', async () => {
              try {
                await navigator.clipboard.writeText(password);
                toast('✔ Password copied.');
              } catch (err) {
                qs('#new-hire-pw-display', bd2).select();
                toast('Select and copy manually (clipboard access blocked).');
              }
            });
          });
        } catch (err) {
          errEl.innerHTML = `<div class="auth-error">${escapeHtml(err.message || 'Something went wrong.')}</div>`;
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Employee Record';
        }
      });
    });
  }

  function openCandidateForm(main) {
    openModal(`
      <h2>Add candidate</h2>
      <div class="modal-sub">New candidates start at the Screening stage.</div>
      <form id="candidate-form">
        <div class="modal-grid">
          <div class="field full"><label>Full name</label><input name="name" required /></div>
          <div class="field"><label>Category</label>
            <select name="category">${CATEGORIES.map(c => `<option>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Position applied for</label><input name="positionAppliedFor" required /></div>
          <div class="field"><label>Phone</label><input name="phone" /></div>
          <div class="field"><label>Email</label><input type="email" name="email" /></div>
          <div class="field full"><label>Applied date</label><input type="date" name="appliedDate" value="${todayISO()}" /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Add candidate</button>
        </div>
      </form>
    `, (bd) => {
      qs('#candidate-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addCandidate({
          name: fd.get('name').trim(),
          category: fd.get('category'),
          positionAppliedFor: fd.get('positionAppliedFor').trim(),
          phone: fd.get('phone').trim(),
          email: fd.get('email').trim(),
          appliedDate: fd.get('appliedDate'),
          stage: 'Screening',
          decision: null,
          tradeTestStart: null,
          tradeTestEnd: null,
        });
        toast('Candidate added.');
        closeModal();
        renderBoard(main);
      });
    });
  }

  return { render: renderBoard };
})();
