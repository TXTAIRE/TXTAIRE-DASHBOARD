// Read-only reference page for the TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition
// -- lets employees actually see what they're bound by, not just HR on the admin side.
// Sourced entirely from DISCIPLINE_OFFENSE_CATALOG/penaltyLabel (js/store.js), the same
// data the admin Disciplinary case form uses for its offense picker and suggested-penalty
// lookup, so the two are guaranteed to never drift apart. No admin-editing capability here
// -- mirrors how Announcements are read-only on the ESS side (js/ess-views/notifications.js).
window.EssViews.discipline = (function () {
  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function scheduleBadgesHtml(schedule) {
    return schedule.map((code, i) =>
      `<span class="badge badge-gray" style="margin:2px 4px 2px 0;" title="${ordinal(i + 1)} occurrence within 12 months">${ordinal(i + 1)}: ${escapeHtml(penaltyLabel(code))}</span>`
    ).join('');
  }

  function categorySectionHtml(cat) {
    return `
      <details class="ess-card" style="margin-bottom:10px;">
        <summary style="cursor:pointer; font-weight:700;">${escapeHtml(cat.category)}</summary>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:12px;">
          ${cat.offenses.map(o => `
            <div>
              <div style="font-size:13px; margin-bottom:4px;">${escapeHtml(o.label)}</div>
              <div>${scheduleBadgesHtml(o.schedule)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  function render(main, emp) {
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">${t('title_discipline')}</div>
      <div class="ess-sub" style="margin-bottom:12px;">TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition. Penalties below escalate by occurrence within a trailing 12-month period — a full year with a clean record erases past offenses.</div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">Penalty Levels</div>
        <div class="ess-row"><span class="label">Verbal Warning</span><span class="value" style="text-align:right; max-width:60%;">An immediate superior's private admonishment for a questionable act or behavior.</span></div>
        <div class="ess-row"><span class="label">Written Warning</span><span class="value" style="text-align:right; max-width:60%;">A formal memo — repeating the same offense warrants a stiffer penalty.</span></div>
        <div class="ess-row"><span class="label">Suspension</span><span class="value" style="text-align:right; max-width:60%;">Mandatory unpaid absence, up to 30 days, for the offense committed.</span></div>
        <div class="ess-row"><span class="label">Dismissal</span><span class="value" style="text-align:right; max-width:60%;">Termination of employment, following due process.</span></div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">How a Violation is Handled</div>
        <div class="ess-sub">Your immediate superior reports a violation to HR within 48 hours. A 3-manager Administrative Hearing Committee investigates before any penalty is imposed, and you'll always have the chance to explain your side. If you disagree with a decision, you may file a written appeal with HR within <strong>5 calendar days</strong> of receiving it — a separate panel will review it.</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">Policy of Punctuality</div>
        <div class="ess-sub">A 10-minute grace period applies after your official time-in — arriving later than that is recorded as Late. Being late 4+ times or a total of 260+ minutes in one month is Excessive Tardiness under the Code below.</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">Habitual Delinquency</div>
        <div class="ess-sub">A 3rd written warning within 1 year adds a 5-day suspension; a 4th within 1 year is grounds for dismissal. A 2nd suspension within 1 year adds 5 more days; a 3rd within 1 year is grounds for dismissal instead. A full year with a clean record erases past offenses.</div>
      </div>

      <div class="ess-section-title">Offenses &amp; Penalty Schedule</div>
      ${DISCIPLINE_OFFENSE_CATALOG.map(categorySectionHtml).join('')}
    `;
  }

  return { render };
})();
