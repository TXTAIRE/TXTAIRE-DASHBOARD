window.EssViews.leave = (function () {
  function statusBadge(status) {
    // 'Rejected' kept as a display alias for any pre-migration rows still holding the old
    // wording -- the app itself only ever writes 'Disapproved' going forward.
    const map = { Pending: 'badge-yellow', Approved: 'badge-green', Disapproved: 'badge-red', Rejected: 'badge-red' };
    const label = status === 'Rejected' ? 'Disapproved' : status;
    return `<span class="badge ${map[status] || 'badge-gray'}">${escapeHtml(label)}</span>`;
  }

  function render(main, emp) {
    const rows = Store.leaveRequestsForEmployee(emp.id).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    const year = Number(todayISO().slice(0, 4));
    // Only shows balance cards for leave types this employee could plausibly use --
    // matches sex/solo-parent restrictions so a card for e.g. Paternity Leave doesn't
    // show up for a female employee. Purely informational; eligibility is still checked
    // (softly, except SIL's hard cap) when actually submitting a request below.
    const relevantPolicies = Store.listLeaveTypePolicies().filter(p =>
      Number(p.daysPerYear) > 0 &&
      (!p.genderRestriction || p.genderRestriction === emp.sex) &&
      (!p.requiresSoloParentStatus || emp.soloParentStatus)
    );

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">${t('title_leave')}</div>
      <div class="ess-card" style="margin-bottom:10px; border-color:var(--accent);">
        <div class="ess-row" style="gap:8px;"><span>⏰</span><span class="ess-sub" style="margin:0;">Leave requests must be filed at least <strong>1 week</strong> in advance whenever possible.</span></div>
      </div>
      ${relevantPolicies.map(p => {
        const bal = Store.leaveBalance(emp, p.leaveType, year);
        const eligibility = Store.leaveEligibility(emp, p.leaveType, todayISO());
        const paidBadge = p.paid
          ? '<span class="badge badge-green" style="font-size:10px;">💰 Paid Leave</span>'
          : '<span class="badge badge-gray" style="font-size:10px;">Unpaid Leave</span>';
        return `
        <div class="ess-card" style="margin-bottom:10px;">
          <div class="ess-row"><span class="label">${escapeHtml(p.leaveType)}${p.statutory ? ' <span class="badge badge-blue" style="font-size:10px;">Statutory</span>' : ''} ${paidBadge} — ${year}</span><span class="value" style="font-weight:700;">${eligibility.eligible ? `${bal.remaining} of ${bal.entitled} days left` : 'Not yet eligible'}</span></div>
          <div class="ess-sub" style="margin-top:4px;">${eligibility.eligible
            ? (p.notes ? escapeHtml(p.notes) : 'Includes Pending requests, not just Approved.')
            : escapeHtml(eligibility.reason)}</div>
          ${p.leaveType === 'SIL' ? '<div class="ess-sub" style="margin-top:4px; font-style:italic;">📌 Earned Leave — equivalent to 1 day paid SIL every 4.8 payroll cutoffs.</div>' : ''}
        </div>`;
      }).join('')}
      <button class="btn btn-primary btn-sm" id="btn-new-leave" style="width:100%; justify-content:center; margin-bottom:14px;">+ New Leave Request</button>
      ${rows.length ? rows.map(r => `
        <div class="ess-card">
          <div class="ess-row"><span class="label">${escapeHtml(r.leaveType)}</span>${statusBadge(r.status)}</div>
          <div class="ess-row"><span class="label">Dates</span><span class="value">${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}</span></div>
          ${r.reason ? `<div class="ess-sub" style="margin-top:6px;">${escapeHtml(r.reason)}</div>` : ''}
          ${r.reviewNotes ? `<div class="ess-sub" style="margin-top:6px;">HR: ${escapeHtml(r.reviewNotes)}</div>` : ''}
          <div class="modal-actions" style="justify-content:flex-start; margin-top:10px; padding-top:0;">
            <button type="button" class="link-btn" data-edit-leave="${r.id}">✏️ Edit</button>
            <button type="button" class="link-btn" data-delete-leave="${r.id}" style="color:var(--red);">🗑 Delete</button>
          </div>
        </div>
      `).join('') : '<div class="ess-empty">No leave requests yet.</div>'}
    `;

    qs('#btn-new-leave', main).addEventListener('click', () => openLeaveForm(main, emp));
    qsa('[data-edit-leave]', main).forEach(b => b.addEventListener('click', () => {
      const r = rows.find(x => x.id === b.dataset.editLeave);
      if (r) openLeaveForm(main, emp, r);
    }));
    qsa('[data-delete-leave]', main).forEach(b => b.addEventListener('click', async () => {
      if (!confirm('Delete this leave request? This cannot be undone.')) return;
      await Store.deleteLeaveRequest(b.dataset.deleteLeave);
      toast('✔ Leave request deleted.');
      render(main, emp);
    }));
  }

  // Editing an already-Approved/Disapproved request re-opens it for HR review (the
  // trigger-enforced RLS policy resets status back to Pending server-side) -- shown here
  // so the employee isn't surprised when a decided request reverts after they change it.
  function openLeaveForm(main, emp, existing) {
    const r = existing || { leaveType: 'Vacation/Sick Leave', startDate: todayISO(), endDate: todayISO(), reason: '' };
    openEssModal(`
      <h2>${existing ? 'Edit Leave Request' : 'New Leave Request'}</h2>
      ${existing && existing.status !== 'Pending' ? `<div class="modal-sub">Editing this will send it back to HR for review.</div>` : ''}
      <form id="leave-form">
        <div class="modal-grid">
          <div class="field full"><label>Type</label>
            <select name="leaveType">${Store.listLeaveTypePolicies().map(p => p.leaveType).map(t => `<option ${t === r.leaveType ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Start date</label><input type="date" name="startDate" value="${r.startDate}" required /></div>
          <div class="field"><label>End date</label><input type="date" name="endDate" value="${r.endDate}" required /></div>
          <div class="field full"><label>Reason</label><textarea name="reason" rows="3">${escapeHtml(r.reason || '')}</textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Save changes' : 'Submit'}</button>
        </div>
      </form>
    `, (bd) => {
      qs('#leave-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        if (fd.get('endDate') < fd.get('startDate')) { toast('End date must be on or after start date.'); return; }
        const patch = {
          leaveType: fd.get('leaveType'),
          startDate: fd.get('startDate'),
          endDate: fd.get('endDate'),
          reason: fd.get('reason').trim(),
        };
        // SIL requires 1 year of service (Labor Code Art. 95) before it can be used at
        // all, checked as of the leave's own start date -- and separately, a 5 days/year
        // cap once eligible, checked against every OTHER Pending/Approved SIL request in
        // the same calendar year as this one's start date, so editing an existing request
        // compares against its own new dates correctly.
        if (patch.leaveType === 'SIL') {
          if (!silEligibleAsOf(emp, patch.startDate)) {
            toast(`Not yet eligible for SIL — requires 1 year of service. Eligible starting ${fmtDate(silEligibleFrom(emp))}.`);
            return;
          }
          const requestedDays = dateRangeDays(patch.startDate, patch.endDate);
          const year = Number(patch.startDate.slice(0, 4));
          const usedElsewhere = Store.silDaysUsed(emp.id, year, existing ? existing.id : null);
          if (usedElsewhere + requestedDays > SIL_YEARLY_DAYS) {
            const left = Math.max(0, SIL_YEARLY_DAYS - usedElsewhere);
            toast(`Only ${left} SIL day${left === 1 ? '' : 's'} left for ${year} — this request is for ${requestedDays}.`);
            return;
          }
        } else {
          // Every other statutory type is a soft warning, not a hard block -- HR makes the
          // final eligibility call on approval (VAWC in particular needs documentation this
          // system can't verify), so the employee can still submit and let HR review it.
          const eligibility = Store.leaveEligibility(emp, patch.leaveType, patch.startDate);
          if (!eligibility.eligible && !confirm(`${eligibility.reason}\n\nSubmit anyway for HR to review?`)) return;
        }
        if (existing) {
          await Store.updateLeaveRequest(existing.id, patch);
          toast('✔ Leave request updated.');
        } else {
          await Store.addLeaveRequest(Object.assign({ employeeId: emp.id }, patch));
          toast('✔ Leave request submitted.');
        }
        closeEssModal();
        render(main, emp);
      });
    });
  }

  return { render };
})();
