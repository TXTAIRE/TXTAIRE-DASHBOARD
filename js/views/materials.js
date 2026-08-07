window.Views.materials = (function () {
  function fmtWhen(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function renderList(main) {
    const rows = Store.listMaterialRequests().slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Materials Request</h1>
          <div class="page-sub">Running list of materials/supplies to order — add items, keep quantities up to date, and print a requisition slip when ready.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-print-materials" ${rows.length ? '' : 'disabled'}>🖨 Print / Save as PDF</button>
          <button class="btn btn-primary" id="btn-add-material">+ Add material</button>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Material</th><th style="width:110px;">Quantity</th><th>Notes / Supplier</th><th class="dim">Added</th><th></th></tr></thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td class="name">${escapeHtml(m.materialName)}</td>
                <td><input type="number" class="days-input qty-input" min="0" step="1" value="${m.quantity}" data-id="${m.id}" /></td>
                <td class="dim">${escapeHtml(m.notes || '—')}</td>
                <td class="dim">${fmtWhen(m.created_at)}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="link-btn" data-edit="${m.id}">Edit</button>
                  <button class="link-btn" data-del="${m.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No materials on the list yet — click "+ Add material" to start one.</div>'}
      </div>
    `;

    qs('#btn-add-material', main).addEventListener('click', () => openMaterialForm(main));
    qsa('[data-edit]', main).forEach(btn => btn.addEventListener('click', () => {
      const m = rows.find(r => r.id === btn.dataset.edit);
      if (m) openMaterialForm(main, m);
    }));
    qsa('[data-del]', main).forEach(btn => btn.addEventListener('click', async () => {
      const m = rows.find(r => r.id === btn.dataset.del);
      if (!m) return;
      if (!confirm(`Remove "${m.materialName}" from the list?`)) return;
      await Store.deleteMaterialRequest(m.id);
      toast('Removed.');
      renderList(main);
    }));
    qsa('.qty-input', main).forEach(input => {
      input.addEventListener('change', async () => {
        const val = Number(input.value);
        if (isNaN(val) || val < 0) { input.value = rows.find(r => r.id === input.dataset.id).quantity; return; }
        await Store.updateMaterialRequest(input.dataset.id, { quantity: val });
        toast('✔ Quantity updated.');
        renderList(main);
      });
    });
    const printBtn = qs('#btn-print-materials', main);
    if (printBtn) printBtn.addEventListener('click', () => openMaterialsPrint(rows));
  }

  function openMaterialForm(main, existing) {
    openModal(`
      <h2>${existing ? 'Edit material' : 'Add material'}</h2>
      <form id="material-form">
        <div class="modal-grid">
          <div class="field full"><label>Material</label><input name="materialName" required value="${existing ? escapeHtml(existing.materialName) : ''}" /></div>
          <div class="field"><label>Quantity</label><input type="number" name="quantity" min="0" step="1" required value="${existing ? existing.quantity : 1}" /></div>
          <div class="field full"><label>Notes / Supplier</label><textarea name="notes" rows="2" placeholder="Optional — preferred supplier, job reference, etc.">${existing ? escapeHtml(existing.notes || '') : ''}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Add material'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#material-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          materialName: fd.get('materialName').trim(),
          quantity: Number(fd.get('quantity')) || 0,
          notes: fd.get('notes').trim(),
        };
        if (existing) {
          await Store.updateMaterialRequest(existing.id, patch);
          toast('✔ Material updated.');
        } else {
          patch.requestedBy = currentUserEmail();
          await Store.addMaterialRequest(patch);
          toast('✔ Material added.');
        }
        closeModal();
        renderList(main);
      });
    });
  }

  // Printable requisition slip -- same overlay/print convention as the DTR (js/app.js
  // openDTR): a fixed .dtr-overlay that @media print rules in styles.css isolate to a
  // clean printed/PDF page, hiding the rest of the app.
  function openMaterialsPrint(rows) {
    qsa('.dtr-overlay').forEach(el => el.remove());
    const totalQty = rows.reduce((s, m) => s + (Number(m.quantity) || 0), 0);

    const overlay = document.createElement('div');
    overlay.className = 'dtr-overlay';
    overlay.innerHTML = `
      <div class="dtr-print">
        <div class="dtr-actions no-print">
          <button class="btn btn-ghost btn-sm" id="materials-print-close">Close</button>
          <button class="btn btn-primary btn-sm" id="materials-print-btn">Print / Save as PDF</button>
        </div>
        <div class="dtr-header">
          <img src="assets/logo.svg" class="dtr-logo" alt="TxTAIRE" />
          <h2>Materials Request</h2>
        </div>
        <div class="dtr-meta">
          <div><strong>Date:</strong> ${fmtWhen(new Date().toISOString())}</div>
          <div><strong>Requested by:</strong> ${escapeHtml(currentUserEmail() || '—')}</div>
        </div>
        <div class="dtr-table-wrap">
        <table class="dtr-table">
          <thead><tr><th>Material</th><th class="num">Quantity</th><th>Notes / Supplier</th></tr></thead>
          <tbody>
            ${rows.map(m => `
              <tr>
                <td>${escapeHtml(m.materialName)}</td>
                <td class="num">${m.quantity}</td>
                <td class="dim">${escapeHtml(m.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td style="font-weight:600;">Total items: ${rows.length}</td>
            <td class="num" style="font-weight:600;">${totalQty}</td>
            <td></td>
          </tr></tfoot>
        </table>
        </div>

        <div class="dtr-signatures">
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Requested by</div></div>
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Approved by</div></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#materials-print-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#materials-print-btn').addEventListener('click', () => window.print());
  }

  return { render: renderList };
})();
