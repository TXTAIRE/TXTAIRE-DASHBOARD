window.Views.finance = (function () {
  let activeTab = 'expenses';
  const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Supplies', 'Fuel', 'Repairs', 'Other'];
  const BILL_CATEGORIES = ['Rent', 'Utilities', 'Other'];

  let expenseMonth = todayISO().slice(0, 7); // 'YYYY-MM'

  function renderView(main) {
    main.innerHTML = `
      <div class="crumb">Admin</div>
      <div class="page-head">
        <div>
          <h1 class="page-title">Office &amp; Finance</h1>
          <div class="page-sub">Expense/receipt log and bill reminders. Admin-only -- not part of the employee portal. Office file storage moved to Admin Files, on the sidebar below.</div>
        </div>
        ${activeTab === 'expenses' ? '<button class="btn btn-primary" id="btn-new-expense">+ Add expense</button>' : ''}
        ${activeTab === 'bills' ? '<button class="btn btn-primary" id="btn-new-bill">+ Add bill</button>' : ''}
      </div>

      <div class="tabs">
        <div class="tab ${activeTab === 'expenses' ? 'active' : ''}" data-tab="expenses">Expenses &amp; Receipts</div>
        <div class="tab ${activeTab === 'bills' ? 'active' : ''}" data-tab="bills">Bill Reminders</div>
      </div>

      <div id="tab-body"></div>
    `;

    qsa('.tab', main).forEach(t => t.addEventListener('click', () => { activeTab = t.dataset.tab; renderView(main); }));
    const btnNewExp = qs('#btn-new-expense', main);
    if (btnNewExp) btnNewExp.addEventListener('click', () => openExpenseForm(main));
    const btnNewBill = qs('#btn-new-bill', main);
    if (btnNewBill) btnNewBill.addEventListener('click', () => openBillForm(main));

    if (activeTab === 'expenses') renderExpensesTab(qs('#tab-body', main), main);
    else renderBillsTab(qs('#tab-body', main), main);
  }

  // ---------------- Expenses & Receipts ----------------

  function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(cell => {
      const s = String(cell == null ? '' : cell);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  function renderExpensesTab(body, main) {
    const from = expenseMonth + '-01';
    const to = expenseMonth + '-31';
    const rows = Store.expensesInRange(from, to).slice().sort((a, b) => b.date.localeCompare(a.date));
    const total = rows.reduce((s, r) => s + Number(r.amount), 0);
    const monthLabel = new Date(expenseMonth + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    body.innerHTML = `
      <div class="filters">
        <div class="field"><label>Month</label><input type="month" id="expense-month-input" value="${expenseMonth}" /></div>
        <button class="btn btn-ghost btn-sm" id="btn-export-expenses" style="align-self:flex-end;">Export CSV</button>
      </div>

      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Total Expenses — ${monthLabel}</div><div class="kpi-value" style="font-size:20px;">${fmtMoney(total)}</div></div>
        <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${rows.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Date</th><th>Vendor</th><th>Category</th><th class="num">Amount</th><th>Description</th><th>Receipt</th><th>Entered By</th><th></th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td class="dim">${fmtDate(r.date)}</td>
                <td class="name">${escapeHtml(r.vendor)}</td>
                <td><span class="badge badge-gray">${escapeHtml(r.category)}</span></td>
                <td class="num">${fmtMoney(r.amount)}</td>
                <td class="dim" style="max-width:220px;">${escapeHtml(r.description || '—')}</td>
                <td>${r.receiptPath ? `<button class="link-btn" data-view-receipt="${r.receiptPath}">View</button>` : '<span class="dim">—</span>'}</td>
                <td class="dim">${escapeHtml(r.enteredBy || '—')}</td>
                <td style="white-space:nowrap;">
                  <button class="link-btn" data-edit-expense="${r.id}">Edit</button>
                  <button class="link-btn" data-delete-expense="${r.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No expenses logged for this month.</div>'}
      </div>
    `;

    qs('#expense-month-input', body).addEventListener('change', (ev) => { expenseMonth = ev.target.value; renderExpensesTab(body, main); });
    qs('#btn-export-expenses', body).addEventListener('click', () => {
      downloadCsv(`expenses-${expenseMonth}.csv`, [
        ['Date', 'Vendor', 'Category', 'Amount', 'Description', 'Entered By'],
        ...rows.map(r => [r.date, r.vendor, r.category, r.amount, r.description || '', r.enteredBy || '']),
      ]);
    });
    qsa('[data-view-receipt]', body).forEach(b => b.addEventListener('click', async () => {
      const win = window.open('', '_blank');
      const url = await Store.getSignedReceiptUrl(b.dataset.viewReceipt);
      if (url && win) win.location.href = url; else if (win) win.close();
    }));
    qsa('[data-edit-expense]', body).forEach(b => b.addEventListener('click', () => {
      const r = Store.getExpense(b.dataset.editExpense);
      if (r) openExpenseForm(main, r);
    }));
    qsa('[data-delete-expense]', body).forEach(b => b.addEventListener('click', async () => {
      const r = Store.getExpense(b.dataset.deleteExpense);
      if (!r) return;
      if (!confirm(`Delete this expense (${r.vendor}, ${fmtMoney(r.amount)})? This cannot be undone.`)) return;
      if (r.receiptPath) await Store.deleteReceiptPhoto(r.receiptPath);
      await Store.deleteExpense(r.id);
      toast('✔ Expense deleted.');
      renderExpensesTab(body, main);
    }));
  }

  function openExpenseForm(main, editing) {
    const e = editing || { date: todayISO(), vendor: '', category: 'Supplies', amount: '', description: '' };
    openModal(`
      <h2>${editing ? 'Edit Expense' : 'Add Expense'}</h2>
      <form id="expense-form">
        <div class="modal-grid">
          <div class="field"><label>Date</label><input type="date" name="date" value="${e.date}" required /></div>
          <div class="field"><label>Category</label>
            <select name="category">${EXPENSE_CATEGORIES.map(c => `<option ${c === e.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Vendor</label><input name="vendor" value="${escapeHtml(e.vendor)}" required /></div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${e.amount}" required /></div>
          <div class="field full"><label>Description</label><textarea name="description" rows="2">${escapeHtml(e.description || '')}</textarea></div>
          <div class="field full"><label>Receipt photo/scan (optional)</label><input type="file" name="receipt" accept="image/*,.pdf" /></div>
        </div>
        <div class="modal-actions">
          ${editing ? '<button type="button" class="btn btn-danger" id="btn-del-expense">Delete</button>' : ''}
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add expense'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#expense-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const submitBtn = qs('button[type="submit"]', bd);
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving…';
        try {
          const patch = {
            date: fd.get('date'),
            vendor: fd.get('vendor').trim(),
            category: fd.get('category'),
            amount: Number(fd.get('amount')) || 0,
            description: fd.get('description').trim(),
          };
          const file = fd.get('receipt');
          if (file && file.size > 0) {
            const oldPath = editing ? editing.receiptPath : null;
            patch.receiptPath = await Store.uploadReceiptPhoto(file, file.name);
            if (oldPath) await Store.deleteReceiptPhoto(oldPath);
          }
          if (editing) {
            await Store.updateExpense(editing.id, patch);
            toast('✔ Expense updated.');
          } else {
            patch.enteredBy = currentUserEmail();
            await Store.addExpense(patch);
            toast('✔ Expense added.');
          }
          closeModal();
          renderView(main);
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = editing ? 'Save changes' : 'Add expense';
        }
      });
      const delBtn = qs('#btn-del-expense', bd);
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (!confirm('Delete this expense? This cannot be undone.')) return;
        if (editing.receiptPath) await Store.deleteReceiptPhoto(editing.receiptPath);
        await Store.deleteExpense(editing.id);
        closeModal();
        toast('✔ Expense deleted.');
        renderView(main);
      });
    });
  }

  // ---------------- Bill Reminders ----------------

  function billUrgencyClass(bill) {
    if (bill.status === 'Paid') return '';
    const days = Math.floor((new Date(bill.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
    if (days < 0) return 'red';
    if (days <= 7) return 'yellow';
    return '';
  }

  function renderBillsTab(body, main) {
    const rows = Store.listBills().slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const unpaid = rows.filter(b => b.status !== 'Paid');
    const overdueCount = unpaid.filter(b => b.dueDate < todayISO()).length;
    const dueSoonCount = unpaid.filter(b => {
      const days = Math.floor((new Date(b.dueDate + 'T00:00:00') - new Date(todayISO() + 'T00:00:00')) / 86400000);
      return days >= 0 && days <= 7;
    }).length;

    body.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-card"><div class="kpi-label">Overdue</div><div class="kpi-value ${overdueCount ? 'red' : ''}" style="font-size:20px;">${overdueCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Due within 7 days</div><div class="kpi-value ${dueSoonCount ? 'yellow' : ''}" style="font-size:20px;">${dueSoonCount}</div></div>
        <div class="kpi-card"><div class="kpi-label">Total Unpaid</div><div class="kpi-value" style="font-size:20px;">${unpaid.length}</div></div>
      </div>

      <div class="panel">
        ${rows.length ? `
        <table>
          <thead><tr><th>Bill</th><th>Category</th><th class="num">Amount</th><th>Due Date</th><th>Recurrence</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${rows.map(b => `
              <tr>
                <td class="name">${escapeHtml(b.name)}${b.notes ? `<div class="dim" style="font-size:11px;">${escapeHtml(b.notes)}</div>` : ''}</td>
                <td><span class="badge badge-gray">${escapeHtml(b.category)}</span></td>
                <td class="num">${fmtMoney(b.amount)}</td>
                <td class="${billUrgencyClass(b)}" style="font-weight:${billUrgencyClass(b) ? '700' : '400'};">${fmtDate(b.dueDate)}</td>
                <td class="dim">${escapeHtml(b.recurrence)}</td>
                <td>${b.status === 'Paid' ? `<span class="badge badge-green">Paid ${fmtDate(b.paidDate)}</span>` : billUrgencyClass(b) === 'red' ? '<span class="badge badge-red">Overdue</span>' : billUrgencyClass(b) === 'yellow' ? '<span class="badge badge-yellow">Due soon</span>' : '<span class="badge badge-gray">Unpaid</span>'}</td>
                <td style="white-space:nowrap;">
                  ${b.status !== 'Paid' ? `<button class="link-btn" data-pay-bill="${b.id}">Mark Paid</button>` : ''}
                  <button class="link-btn" data-edit-bill="${b.id}">Edit</button>
                  <button class="link-btn" data-delete-bill="${b.id}" style="color:var(--red);">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>` : '<div class="empty">No bills added yet.</div>'}
      </div>
    `;

    qsa('[data-pay-bill]', body).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Mark this bill as Paid? If it recurs, the next occurrence will be created automatically.')) return;
      await Store.payBill(b.dataset.payBill);
      toast('✔ Bill marked Paid.');
      renderBillsTab(body, main);
    }));
    qsa('[data-edit-bill]', body).forEach(b => b.addEventListener('click', () => {
      const bill = Store.getBill(b.dataset.editBill);
      if (bill) openBillForm(main, bill);
    }));
    qsa('[data-delete-bill]', body).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this bill reminder? This cannot be undone.')) return;
      await Store.deleteBill(b.dataset.deleteBill);
      toast('✔ Bill deleted.');
      renderBillsTab(body, main);
    }));
  }

  function openBillForm(main, editing) {
    const b = editing || { name: '', category: 'Utilities', amount: '', dueDate: todayISO(), recurrence: 'Monthly', notes: '' };
    openModal(`
      <h2>${editing ? 'Edit Bill' : 'Add Bill'}</h2>
      <form id="bill-form">
        <div class="modal-grid">
          <div class="field full"><label>Bill name</label><input name="name" value="${escapeHtml(b.name)}" required placeholder="e.g. Office Rent" /></div>
          <div class="field"><label>Category</label>
            <select name="category">${BILL_CATEGORIES.map(c => `<option ${c === b.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Amount (PHP)</label><input type="number" name="amount" min="0" step="0.01" value="${b.amount}" required /></div>
          <div class="field"><label>Due date</label><input type="date" name="dueDate" value="${b.dueDate}" required /></div>
          <div class="field"><label>Recurrence</label>
            <select name="recurrence">${['One-time', 'Monthly', 'Yearly'].map(r => `<option ${r === b.recurrence ? 'selected' : ''}>${r}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Notes (optional)</label><textarea name="notes" rows="2">${escapeHtml(b.notes || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${editing ? 'Save changes' : 'Add bill'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#bill-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const patch = {
          name: fd.get('name').trim(),
          category: fd.get('category'),
          amount: Number(fd.get('amount')) || 0,
          dueDate: fd.get('dueDate'),
          recurrence: fd.get('recurrence'),
          notes: fd.get('notes').trim(),
        };
        if (editing) {
          await Store.updateBill(editing.id, patch);
          toast('✔ Bill updated.');
        } else {
          await Store.addBill(patch);
          toast('✔ Bill added.');
        }
        closeModal();
        renderView(main);
      });
    });
  }

  return { render: renderView };
})();
