window.EssViews.attendance = (function () {
  let period = 'week'; // 'day' | 'week' | 'month'

  function periodRange() {
    const today = todayISO();
    if (period === 'day') return { from: today, to: today };
    if (period === 'month') {
      const d = new Date(today + 'T00:00:00');
      const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      return { from, to: today };
    }
    return { from: addDays(today, -6), to: today }; // week
  }

  function dayCard(emp, date, rec, holiday) {
    const dow = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (emp.rate / (workDaysInRange(date, date) || 1));
    const pay = computeDayPay(dailyRateEq, rec, holiday);
    return `
      <div class="ess-card">
        <div class="ess-card-label">${dow}</div>
        ${rec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(rec.timeIn)} ✅</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${rec.timeOut ? to12Hour(rec.timeOut) : '—'}</span></div>
        <div class="ess-row"><span class="label">Hours</span><span class="value">${rec.hours}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(rec.status)}</span></div>
        ${pay.nsdHrs ? `<div class="ess-row"><span class="label">Night Shift Diff.</span><span class="value">${pay.nsdHrs.toFixed(2)} hr</span></div>` : ''}
        ${pay.otHrs ? `<div class="ess-row"><span class="label">Overtime</span><span class="value">${pay.otHrs.toFixed(2)} hr</span></div>` : ''}
        ${Number(rec.hours) < 8 ? `<div class="ess-row"><span class="label">Undertime</span><span class="value">${(8 - Number(rec.hours)).toFixed(2)} hr</span></div>` : ''}
        ` : `<div class="ess-sub">Not logged${holiday ? ' · ' + escapeHtml(holiday.name) : ''}</div>`}
      </div>
    `;
  }

  function render(main, emp) {
    const today = todayISO();
    const todayRec = Store.attendanceForDate(today).find(r => r.employeeId === emp.id);
    const { from, to } = periodRange();
    const holidays = Store.holidaysInRange(from, to);
    const holidayByDate = {};
    holidays.forEach(h => { holidayByDate[h.date] = h; });
    const records = Store.attendanceInRange(from, to).filter(r => r.employeeId === emp.id);
    const recByDate = {};
    records.forEach(r => { recByDate[r.date] = r; });

    const days = [];
    let d = to;
    while (d >= from) { days.push(d); d = addDays(d, -1); }

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">Today's Attendance</div>
      <div class="ess-card">
        ${todayRec ? `
        <div class="ess-row"><span class="label">Time In</span><span class="value">${to12Hour(todayRec.timeIn)} ✅</span></div>
        <div class="ess-row"><span class="label">Time Out</span><span class="value">${todayRec.timeOut ? to12Hour(todayRec.timeOut) + ' ✅' : '—'}</span></div>
        <div class="ess-row"><span class="label">Status</span><span class="value">${escapeHtml(todayRec.status)}</span></div>
        ` : `<div class="ess-sub">No attendance logged yet for today.</div>`}
      </div>

      <button class="btn btn-ghost btn-sm" id="btn-report-concern" style="width:100%; justify-content:center; margin-bottom:6px;">Report Attendance Concern</button>

      <div class="ess-section-title">History</div>
      <div class="seg" id="seg-period" style="margin-bottom:12px;">
        ${['day', 'week', 'month'].map(p => `<button data-val="${p}" class="${period === p ? 'active' : ''}">${p[0].toUpperCase() + p.slice(1)}</button>`).join('')}
      </div>
      ${days.map(date => dayCard(emp, date, recByDate[date], holidayByDate[date])).join('')}
    `;

    qsa('#seg-period button', main).forEach(b => b.addEventListener('click', () => { period = b.dataset.val; render(main, emp); }));
    qs('#btn-report-concern', main).addEventListener('click', () => openConcernForm(main, emp));
  }

  function openConcernForm(main, emp) {
    openEssModal(`
      <h2>Report Attendance Concern</h2>
      <div class="modal-sub">Describe the issue — HR will review and correct the record if approved.</div>
      <form id="concern-form">
        <div class="modal-grid">
          <div class="field full"><label>Date</label><input type="date" name="date" value="${todayISO()}" required max="${todayISO()}" /></div>
          <div class="field full"><label>What happened?</label><textarea name="description" rows="3" required placeholder="e.g. I forgot to time out on July 15."></textarea></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn btn-primary">Submit</button>
        </div>
      </form>
    `, (bd) => {
      qs('#concern-form', bd).addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        await Store.addAttendanceCorrection({
          employeeId: emp.id,
          date: fd.get('date'),
          description: fd.get('description').trim(),
        });
        toast('✔ Concern submitted — HR will review it.');
        closeEssModal();
        render(main, emp);
      });
    });
  }

  return { render };
})();
