// Admin editor for the Code of Discipline offense catalog (supabase/schema.sql
// "disciplineOffenses") -- the same data js/views/disciplinary.js's Issue-NTE form and
// the ESS "Code of Discipline" reference page both read via Store.disciplineCatalog(),
// so any edit made here (English or Filipino) shows up on My Portal immediately, the
// same realtime way every other admin edit in this app does.
window.Views.codeOfDiscipline = (function () {
  // Persists across re-renders on this page (add/edit/delete all call render(main) again)
  // so checking a few rows then, say, editing an unrelated one doesn't lose the selection.
  // Cleared after a successful bulk delete, and any id that no longer exists is dropped
  // when rendering so a stale checkmark can't linger past its row being removed.
  let selectedIds = new Set();

  // Series 2, 2026 offense classes (js/store.js PENALTY_CLASSES). Colour-coded here the
  // same way the printed Code colour-codes them, so the catalog reads the same on screen
  // as on paper.
  const CLASS_TINT = {
    A: { bg: '#e2f0d9', fg: '#375623' },
    B: { bg: '#fff2cc', fg: '#7f6000' },
    C: { bg: '#fbe5d6', fg: '#974706' },
    D: { bg: '#f8cbcb', fg: '#9c1c1c' },
  };

  function classBadgeHtml(klass) {
    const meta = Store.penaltyClasses()[klass];
    if (!meta) return '<span class="dim">—</span>';
    const tint = CLASS_TINT[klass];
    return `<span class="badge" style="background:${tint.bg}; color:${tint.fg}; white-space:nowrap;">${klass} — ${escapeHtml(meta.label)}</span>`;
  }

  function render(main) {
    const offenses = Store.listDisciplineOffenses();
    const isEmpty = offenses.length === 0;
    // null while the table is still empty -- the empty-state import below covers that case.
    const sync = Store.disciplineCatalogSyncStatus();
    const retiredCodes = new Set(sync ? sync.retired.map(r => r.code) : []);
    const customCodes = new Set(sync ? sync.custom.map(r => r.code) : []);
    const offenseIds = new Set(offenses.map(o => o.id));
    selectedIds.forEach(id => { if (!offenseIds.has(id)) selectedIds.delete(id); });
    const selectedCount = selectedIds.size;
    const allSelected = !isEmpty && selectedCount === offenses.length;

    main.innerHTML = `
      <div class="crumb">HR</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Code of Discipline</h1>
          <div class="page-sub">The offense catalog used on the Employee Discipline (NTE) form and shown to employees on My Portal, in English and Filipino. Changes here appear on My Portal right away.</div>
        </div>
        <div style="display:flex; gap:8px;">
          ${selectedCount > 0 ? `<button class="btn btn-danger" id="btn-delete-selected">🗑 Delete Selected (${selectedCount})</button>` : ''}
          ${!isEmpty ? '<button class="btn btn-primary" id="btn-add-offense">+ Add Offense</button>' : ''}
        </div>
      </div>
      ${sync && !sync.inSync ? `
      <div class="panel" style="padding:16px; margin-bottom:14px; border-left:3px solid var(--blue, #2563eb);">
        <div style="font-weight:700; margin-bottom:6px;">Update available — Code of Discipline, Series 2, 2026 Edition</div>
        <div class="page-sub" style="margin-bottom:12px;">
          The catalog stored here is behind the Code of Discipline built into this app. Re-syncing will:
        </div>
        <ul class="page-sub" style="margin:0 0 12px 0; padding-left:18px;">
          ${sync.toUpdate.length ? `<li><strong>Update ${sync.toUpdate.length}</strong> offense${sync.toUpdate.length === 1 ? '' : 's'} — wording, penalty schedule and class. Matching is by offense code, so one you edited is updated in place rather than duplicated, and your edit to it is overwritten.</li>` : ''}
          ${sync.toAdd.length ? `<li><strong>Add ${sync.toAdd.length}</strong> offense${sync.toAdd.length === 1 ? '' : 's'} introduced by this edition.</li>` : ''}
          ${sync.retired.length ? `<li><strong>Remove ${sync.retired.length}</strong> offense${sync.retired.length === 1 ? '' : 's'} this edition retired — each was folded into a broader offense or put out of scope. Leaving them would show employees offenses that no longer exist, under category names this edition dropped. Flagged <span class="badge badge-red">retired</span> below.</li>` : ''}
          ${sync.custom.length ? `<li><strong>Leave your own ${sync.custom.length}</strong> offense${sync.custom.length === 1 ? '' : 's'} alone — anything not from the printed Code is never touched. Flagged <span class="badge badge-gray">custom</span> below.</li>` : ''}
        </ul>
        <button class="btn btn-primary" id="btn-resync-catalog">Re-sync to Series 2, 2026</button>
      </div>
      ` : ''}
      ${isEmpty ? `
      <div class="panel" style="padding:20px;">
        <div class="page-sub" style="margin-bottom:12px;">No offenses in the database yet — My Portal and the NTE form are currently showing the built-in TXTAIRE OPC Code of Discipline catalog (Series 2, 2026 Edition: 102 offenses across 8 categories) as a fallback, so nothing is broken. Import it once to start editing it here.</div>
        <button class="btn btn-primary" id="btn-import-catalog">Import the existing catalog</button>
      </div>
      ` : `
      <div class="panel">
        <table>
          <thead><tr>
            <th style="width:32px;"><input type="checkbox" id="chk-select-all" ${allSelected ? 'checked' : ''} aria-label="Select all offenses" /></th>
            <th>Category</th><th>Offense (English)</th><th>Offense (Filipino)</th><th>Class</th><th>Schedule</th><th></th>
          </tr></thead>
          <tbody>
            ${offenses.map(o => `
              <tr>
                <td><input type="checkbox" class="chk-offense" data-id="${o.id}" ${selectedIds.has(o.id) ? 'checked' : ''} aria-label="Select ${escapeHtml(o.label)}" /></td>
                <td class="dim">${escapeHtml(o.category)}</td>
                <td class="name" style="max-width:320px;">${escapeHtml(o.label)}${retiredCodes.has(o.code) ? ' <span class="badge badge-red" style="white-space:nowrap;">retired</span>' : ''}${customCodes.has(o.code) ? ' <span class="badge badge-gray" style="white-space:nowrap;">custom</span>' : ''}</td>
                <td class="dim" style="max-width:320px;">${escapeHtml(o.labelFil || '—')}</td>
                <td>${classBadgeHtml(o.klass)}</td>
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

    const resyncBtn = qs('#btn-resync-catalog', main);
    if (resyncBtn) resyncBtn.addEventListener('click', async () => {
      const parts = [];
      if (sync.toUpdate.length) parts.push(`update ${sync.toUpdate.length}`);
      if (sync.toAdd.length) parts.push(`add ${sync.toAdd.length}`);
      if (sync.retired.length) parts.push(`remove ${sync.retired.length} retired`);
      if (!confirm(`Re-sync the catalog to the Series 2, 2026 Edition?

This will ${parts.join(', ')}.

Updating overwrites the wording, penalty schedule and class of any offense whose code matches the built-in Code — including edits you have made to those offenses.${sync.custom.length ? ` Your own ${sync.custom.length} offense${sync.custom.length === 1 ? '' : 's'} will not be touched.` : ''}

This overwrites the wording, penalty schedule and class of any offense whose code matches the built-in Code — including edits you have made to those offenses. Offenses not in the built-in Code are left alone.`)) return;
      resyncBtn.disabled = true;
      resyncBtn.textContent = 'Re-syncing…';
      try {
        const res = await Store.resyncDisciplineCatalog();
        toast(`✔ ${res.updated} updated, ${res.added} added, ${res.removed} removed.` + (res.custom ? ` ${res.custom} of your own left as-is.` : ''));
        render(main);
      } catch (err) {
        resyncBtn.disabled = false;
        resyncBtn.textContent = 'Re-sync to Series 2, 2026';
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
      selectedIds.delete(o.id);
      toast('✔ Offense deleted.');
      render(main);
    }));

    const selectAll = qs('#chk-select-all', main);
    if (selectAll) selectAll.addEventListener('change', () => {
      if (selectAll.checked) offenses.forEach(o => selectedIds.add(o.id));
      else selectedIds.clear();
      render(main);
    });
    qsa('.chk-offense', main).forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) selectedIds.add(cb.dataset.id);
      else selectedIds.delete(cb.dataset.id);
      render(main);
    }));
    const deleteSelectedBtn = qs('#btn-delete-selected', main);
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', async () => {
      const ids = [...selectedIds];
      if (!ids.length) return;
      if (!confirm(`Delete ${ids.length} selected offense${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
      deleteSelectedBtn.disabled = true;
      deleteSelectedBtn.textContent = 'Deleting…';
      try {
        await Promise.all(ids.map(id => Store.deleteDisciplineOffense(id)));
        toast(`✔ ${ids.length} offense${ids.length > 1 ? 's' : ''} deleted.`);
        selectedIds.clear();
        render(main);
      } catch (err) {
        toast('Could not delete all selected offenses — please try again.');
        deleteSelectedBtn.disabled = false;
        deleteSelectedBtn.textContent = `🗑 Delete Selected (${ids.length})`;
      }
    });
  }

  function openOffenseForm(main, existing) {
    const o = existing || { code: '', category: '', categoryFil: '', label: '', labelFil: '', klass: '', schedule: [] };
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
          <div class="field full"><label>Offense class</label>
            <select name="klass" id="offense-klass">
              <option value="">— none (type a schedule below instead) —</option>
              ${Object.entries(Store.penaltyClasses()).map(([k, v]) =>
                `<option value="${k}" ${o.klass === k ? 'selected' : ''}>${k} — ${escapeHtml(v.label)} (${v.schedule.map(c => penaltyLabel(c)).join(' → ')})</option>`
              ).join('')}
            </select>
            <div class="page-sub" style="margin-top:4px; font-size:11px;">Picking a class fills the schedule in from Sec. 3.4 of the Code, so every offense in a class carries the same penalty. Leave it as "none" only for an offense the Code's four classes genuinely don't fit.</div>
          </div>
          <div class="field full"><label>Penalty schedule</label>
            <input name="schedule" id="offense-schedule" value="${(o.schedule || []).join(', ')}" placeholder="e.g. WW, 3S, 7S, D" />
            <div class="page-sub" style="margin-top:4px; font-size:11px;">Comma-separated, one per occurrence: VW = Verbal Warning, WW = Written Warning, a number + S = days of Suspension (e.g. 7S), D = Dismissal. Suspension should not exceed 15 days as a penalty (Sec. 3.2).</div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Add offense'}</button>
        </div>
      </form>
    `, (bd) => {
      // Changing the class rewrites the schedule from PENALTY_CLASSES. Only ever
      // overwrites on an actual change, so a schedule someone deliberately hand-tuned
      // survives simply reopening the form.
      const klassSel = qs('#offense-klass', bd);
      const schedInput = qs('#offense-schedule', bd);
      if (klassSel && schedInput) klassSel.addEventListener('change', () => {
        const sched = Store.classSchedule(klassSel.value);
        if (sched.length) schedInput.value = sched.join(', ');
      });

      qs('#offense-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const schedule = fd.get('schedule').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
        const patch = {
          category: fd.get('category').trim(),
          categoryFil: fd.get('categoryFil').trim(),
          label: fd.get('label').trim(),
          labelFil: fd.get('labelFil').trim(),
          klass: fd.get('klass') || '',
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
