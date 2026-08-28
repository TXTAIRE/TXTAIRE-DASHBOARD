// Admin editor for the Code of Discipline offense catalog (supabase/schema.sql
// "disciplineOffenses") -- the same data js/views/disciplinary.js's Issue-NTE form and
// the ESS "Code of Discipline" reference page both read via Store.disciplineCatalog(),
// so any edit made here (English or Filipino) shows up on My Portal immediately, the
// same realtime way every other admin edit in this app does.
window.Views.codeOfDiscipline = (function () {
  function render(main) {
    const offenses = Store.listDisciplineOffenses();
    const isEmpty = offenses.length === 0;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Code of Discipline</h1>
          <div class="page-sub">The offense catalog used on the Employee Discipline (NTE) form and shown to employees on My Portal, in English and Filipino. Changes here appear on My Portal right away.</div>
        </div>
        ${!isEmpty ? '<button class="btn btn-primary" id="btn-add-offense">+ Add Offense</button>' : ''}
      </div>
      ${isEmpty ? `
      <div class="panel" style="padding:20px;">
        <div class="page-sub" style="margin-bottom:12px;">No offenses in the database yet — My Portal and the NTE form are currently showing the built-in TXTAIRE OPC Code of Discipline catalog (about 50 offenses across 9 categories) as a fallback, so nothing is broken. Import it once to start editing it here.</div>
        <button class="btn btn-primary" id="btn-import-catalog">Import the existing catalog</button>
      </div>
      ` : `
      <div class="panel">
        <table>
          <thead><tr><th>Category</th><th>Offense (English)</th><th>Offense (Filipino)</th><th>Schedule</th><th></th></tr></thead>
          <tbody>
            ${offenses.map(o => `
              <tr>
                <td class="dim">${escapeHtml(o.category)}</td>
                <td class="name" style="max-width:320px;">${escapeHtml(o.label)}</td>
                <td class="dim" style="max-width:320px;">${escapeHtml(o.labelFil || '—')}</td>
                <td class="dim">${(o.schedule || []).map(c => penaltyLabel(c)).join(' → ') || '—'}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-edit="${o.id}">Edit</button>
                  <button class="link-btn" data-del="${o.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      `}
    `;

    const importBtn = qs('#btn-import-catalog', main);
    if (importBtn) importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing…';
      try {
        await Store.importDefaultDisciplineCatalog();
        toast('✔ Catalog imported — now editable below.');
        render(main);
      } catch (err) {
        importBtn.disabled = false;
        importBtn.textContent = 'Import the existing catalog';
      }
    });

    const addBtn = qs('#btn-add-offense', main);
    if (addBtn) addBtn.addEventListener('click', () => openOffenseForm(main));
    qsa('[data-edit]', main).forEach(b => b.addEventListener('click', () => {
      const o = offenses.find(x => x.id === b.dataset.edit);
      if (o) openOffenseForm(main, o);
    }));
    qsa('[data-del]', main).forEach(b => b.addEventListener('click', async () => {
      const o = offenses.find(x => x.id === b.dataset.del);
      if (!o) return;
      if (!confirm(`Delete "${o.label}"? This cannot be undone.`)) return;
      await Store.deleteDisciplineOffense(o.id);
      toast('✔ Offense deleted.');
      render(main);
    }));
  }

  function openOffenseForm(main, existing) {
    const o = existing || { code: '', category: '', categoryFil: '', label: '', labelFil: '', schedule: [] };
    const existingCategories = [...new Set(Store.listDisciplineOffenses().map(x => x.category))];
    openModal(`
      <h2>${existing ? 'Edit Offense' : 'Add Offense'}</h2>
      <form id="offense-form">
        <div class="modal-grid">
          <div class="field full"><label>Category (English)</label>
            <input name="category" list="doff-categories" value="${escapeHtml(o.category)}" required placeholder="e.g. Against Attendance" />
            <datalist id="doff-categories">${existingCategories.map(c => `<option value="${escapeHtml(c)}">`).join('')}</datalist>
          </div>
          <div class="field full"><label>Category (Filipino)</label><input name="categoryFil" value="${escapeHtml(o.categoryFil || '')}" placeholder="e.g. Mga Paglabag sa Attendance" /></div>
          <div class="field full"><label>Offense code</label><input name="code" value="${escapeHtml(o.code)}" ${existing ? 'readonly' : ''} placeholder="e.g. simple-absence" required /></div>
          <div class="field full"><label>Offense (English)</label><textarea name="label" rows="2" required>${escapeHtml(o.label)}</textarea></div>
          <div class="field full"><label>Offense (Filipino)</label><textarea name="labelFil" rows="2">${escapeHtml(o.labelFil || '')}</textarea></div>
          <div class="field full"><label>Penalty schedule</label>
            <input name="schedule" value="${(o.schedule || []).join(', ')}" placeholder="e.g. WW, 3S, 5S, D" />
            <div class="page-sub" style="margin-top:4px; font-size:11px;">Comma-separated, one per occurrence: VW = Verbal Warning, WW = Written Warning, a number + S = days of Suspension (e.g. 5S), D = Dismissal.</div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add offense'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#offense-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const schedule = fd.get('schedule').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const patch = {
          category: fd.get('category').trim(),
          categoryFil: fd.get('categoryFil').trim(),
          label: fd.get('label').trim(),
          labelFil: fd.get('labelFil').trim(),
          schedule,
        };
        if (existing) {
          await Store.updateDisciplineOffense(existing.id, patch);
          toast('✔ Offense updated.');
        } else {
          const code = fd.get('code').trim();
          if (Store.listDisciplineOffenses().some(x => x.code === code)) {
            toast('An offense with that code already exists.');
            return;
          }
          patch.code = code;
          patch.sortOrder = Store.listDisciplineOffenses().length;
          await Store.addDisciplineOffense(patch);
          toast('✔ Offense added.');
        }
        closeModal();
        render(main);
      });
    });
  }

  return { render };
})();
