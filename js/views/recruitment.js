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
