// Petty Cash Request -- a running list of small cash disbursements requested (fare, minor
// supplies, meals, etc.), replacing the old Materials Request page entirely. Same simple
// shape as that page had (an editable running list, no multi-step approval workflow, print
// a slip when ready) since HR/office staff already worked that way for materials -- just a
// peso amount + purpose instead of an item + quantity.
window.Views.materials = (function () {
  function fmtWhen(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  }

  function renderList(main) {
    const rows = Store.listPettyCashRequests().slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Petty Cash Request</h1>
          <div class="page-sub">Running list of petty cash disbursements — add requests, keep amounts up to date, and print a petty cash voucher when ready.</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-ghost" id="btn-print-materials" ${rows.length ? '' : 'disabled'}>🖨 Print / Save as PDF</button>
          <button class="btn btn-primary" id="btn-add-material">+ Add request</button>
        </div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Purpose</th><th style="width:130px;">Amount (PHP)</th><th>Notes</th><th class="dim">Requested by</th><th class="dim">Added</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="name">${escapeHtml(r.purpose)}</td>
                <td><input type="number" class="days-input amount-input" min="0" step="0.01" value="${r.amount}" data-id="${r.id}" /></td>
                <td class="dim">${escapeHtml(r.notes || '—')}</td>
                <td class="dim">${escapeHtml(r.requestedBy || '—')}</td>
                <td class="dim">${fmtWhen(r.created_at)}</td>
                <td style="text-align:right; white-space:nowrap;">
                  <button class="link-btn" data-edit="${r.id}">Edit</button>
                  <button class="link-btn" data-del="${r.id}">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td style="font-weight:600;">Total</td>
            <td style="font-weight:600;">${fmtMoney(total)}</td>
            <td colspan="4"></td>
          </tr></tfoot>
        </table>` : '<div class="empty">No petty cash requests yet — click "+ Add request" to start one.</div>'}
      </div>
    `;

    qs('#btn-add-material', main).addEventListener('click', () => openMaterialForm(main));
    qsa('[data-edit]', main).forEach(btn => btn.addEventListener('click', () => {
      const r = rows.find(x => x.id === btn.dataset.edit);
      if (r) openMaterialForm(main, r);
    }));
    qsa('[data-del]', main).forEach(btn => btn.addEventListener('click', async () => {
      const r = rows.find(x => x.id === btn.dataset.del);
      if (!r) return;
      if (!confirm(`Remove "${r.purpose}" from the list?`)) return;
      await Store.deletePettyCashRequest(r.id);
      toast('Removed.');
      renderList(main);
    }));
    qsa('.amount-input', main).forEach(input => {
      input.addEventListener('change', async () => {
        const val = Number(input.value);
        if (isNaN(val) || val < 0) { input.value = rows.find(r => r.id === input.dataset.id).amount; return; }
        await Store.updatePettyCashRequest(input.dataset.id, { amount: val });
        toast('✔ Amount updated.');
        renderList(main);
      });
    });
    const printBtn = qs('#btn-print-materials', main);
    if (printBtn) printBtn.addEventListener('click', () => openMaterialsPrint(rows));
  }

  function openMaterialForm(main, existing) {
    openModal(`
      <h2>${existing ? 'Edit request' : 'Add request'}</h2>
      <form id="material-form">
        <div class="modal-grid">
          <div class="field full"><label>Purpose</label><input name="purpose" required placeholder="e.g. Fare for site visit" value="${existing ? escapeHtml(existing.purpose) : ''}" /></div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" required value="${existing ? existing.amount : ''}" /></div>
          <div class="field full"><label>Notes</label><textarea name="notes" rows="2" placeholder="Optional — job reference, who it's for, etc.">${existing ? escapeHtml(existing.notes || '') : ''}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save' : 'Add request'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#material-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          purpose: fd.get('purpose').trim(),
          amount: Number(fd.get('amount')) || 0,
          notes: fd.get('notes').trim(),
        };
        if (existing) {
          await Store.updatePettyCashRequest(existing.id, patch);
          toast('✔ Request updated.');
        } else {
          patch.requestedBy = currentUserEmail();
          await Store.addPettyCashRequest(patch);
          toast('✔ Request added.');
        }
        closeModal();
        renderList(main);
      });
    });
  }

  // Printable petty cash voucher -- same overlay/print convention as the DTR (js/app.js
  // openDTR): a fixed .dtr-overlay that @media print rules in styles.css isolate to a
  // clean printed/PDF page, hiding the rest of the app.
  function openMaterialsPrint(rows) {
    qsa('.dtr-overlay').forEach(el => el.remove());
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);

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
          <h2>Petty Cash Voucher</h2>
        </div>
        <div class="dtr-meta">
          <div><strong>Date:</strong> ${fmtWhen(new Date().toISOString())}</div>
          <div><strong>Requested by:</strong> ${escapeHtml(currentUserEmail() || '—')}</div>
        </div>
        <div class="dtr-table-wrap">
        <table class="dtr-table">
          <thead><tr><th>Purpose</th><th class="num">Amount</th><th>Notes</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.purpose)}</td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim">${escapeHtml(r.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot><tr>
            <td style="font-weight:600;">Total</td>
            <td class="num" style="font-weight:600;">${fmtMoney(total)}</td>
            <td></td>
          </tr></tfoot>
        </table>
        </div>

        <div class="dtr-signatures">
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Requested by</div></div>
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Approved by</div></div>
          <div class="dtr-sig"><div class="dtr-sig-line"></div><div>Released by</div></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#materials-print-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#materials-print-btn').addEventListener('click', () => window.print());
  }

  return { render: renderList };
})();
