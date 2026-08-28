// Read-only reference page for the TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition
// -- lets employees actually see what they're bound by, not just HR on the admin side.
// Sourced entirely from DISCIPLINE_OFFENSE_CATALOG/penaltyLabel (js/store.js), the same
// data the admin Disciplinary case form uses for its offense picker and suggested-penalty
// lookup, so the two are guaranteed to never drift apart. No admin-editing capability here
// -- mirrors how Announcements are read-only on the ESS side (js/ess-views/notifications.js).
//
// Has its own English/Filipino toggle (in addition to the app-wide one on Settings) since
// this page's body text is long enough that switching languages without leaving the page
// is worth the extra control -- both toggles read/write the same essLang()/setEssLang()
// state (js/ess-i18n.js), so they never fall out of sync with each other.
window.EssViews.discipline = (function () {
  // Procedural/summary text is specific to this page (not shared with the admin side, so
  // it doesn't belong in js/store.js next to the offense catalog) -- kept here as a small
  // bilingual lookup, same first-pass-translation disclaimer as DISCIPLINE_OFFENSE_CATALOG.
  const TEXT = {
    en: {
      intro: 'TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition. Penalties below escalate by occurrence within a trailing 12-month period — a full year with a clean record erases past offenses.',
      penaltyLevels: 'Penalty Levels',
      verbalWarning: 'Verbal Warning', verbalWarningDesc: "An immediate superior's private admonishment for a questionable act or behavior.",
      writtenWarning: 'Written Warning', writtenWarningDesc: 'A formal memo — repeating the same offense warrants a stiffer penalty.',
      suspension: 'Suspension', suspensionDesc: 'Mandatory unpaid absence, up to 30 days, for the offense committed.',
      dismissal: 'Dismissal', dismissalDesc: 'Termination of employment, following due process.',
      howHandled: 'How a Violation is Handled',
      howHandledDesc: 'Your immediate superior reports a violation to HR within 48 hours. A 3-manager Administrative Hearing Committee investigates before any penalty is imposed, and you\'ll always have the chance to explain your side. If you disagree with a decision, you may file a written appeal with HR within <strong>5 calendar days</strong> of receiving it — a separate panel will review it.',
      punctuality: 'Policy of Punctuality',
      punctualityDesc: 'A 10-minute grace period applies after your official time-in — arriving later than that is recorded as Late. Being late 4+ times or a total of 260+ minutes in one month is Excessive Tardiness under the Code below.',
      habitual: 'Habitual Delinquency',
      habitualDesc: 'A 3rd written warning within 1 year adds a 5-day suspension; a 4th within 1 year is grounds for dismissal. A 2nd suspension within 1 year adds 5 more days; a 3rd within 1 year is grounds for dismissal instead. A full year with a clean record erases past offenses.',
      offensesTitle: 'Offenses & Penalty Schedule',
      occurrence: 'occurrence within 12 months',
    },
    fil: {
      intro: 'TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition. Dumadami ang parusa kada ulit na paglabag sa loob ng 12 buwan — kung malinis ang record mo sa loob ng 1 taon, mababawi ang dati mong record.',
      penaltyLevels: 'Mga Uri ng Parusa',
      verbalWarning: 'Bibig na Babala', verbalWarningDesc: 'Sasabihan ka lang nang private ng superyor mo tungkol sa ginawa mo.',
      writtenWarning: 'Sulat na Babala', writtenWarningDesc: 'May opisyal na memo — kapag inulit mo, mas mabigat na parusa ang hihintayin mo.',
      suspension: 'Suspensyon', suspensionDesc: 'Hindi ka muna makakapasok, walang sahod, hanggang 30 araw.',
      dismissal: 'Tanggal sa Trabaho', dismissalDesc: 'Matatapos ang trabaho mo, may tamang proseso muna.',
      howHandled: 'Paano Ito Aayusin',
      howHandledDesc: 'Ire-report ng superyor mo ang paglabag sa HR sa loob ng 48 oras. Iimbestigahan muna ito ng 3 manager bago ka parusahan, at bibigyan ka ng pagkakataong ipaliwanag ang panig mo. Kung hindi ka sang-ayon sa desisyon, puwede kang mag-apela sa HR sa loob ng <strong>5 araw</strong> — may ibang panel na susuri nito.',
      punctuality: 'Patakaran sa Pagiging Maagap',
      punctualityDesc: 'May 10-minutong grace period pagkatapos ng oras ng pasok mo. Kapag lumagpas ka dito, ma-late ka. Kung 4 beses ka nang na-late o umabot ng 260 minuto ang total na late mo sa isang buwan, ituturing itong Sobrang Late.',
      habitual: 'Paulit-ulit na Paglabag',
      habitualDesc: 'Kapag ika-3 mo nang natanggap ang sulat na babala sa loob ng 1 taon, dadagdagan ito ng 5-araw na suspensyon. Kapag ika-4 mo na, puwede ka nang tanggalin sa trabaho. Ganito rin sa suspensyon — ika-2 mo, dadagdagan ng 5 araw; ika-3 mo, puwede ka nang tanggalin. Kung malinis ang record mo sa loob ng 1 taon, mababawi ang dati mong record.',
      offensesTitle: 'Mga Paglabag at Parusa',
      occurrence: 'na paglabag sa loob ng 12 buwan',
    },
  };

  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function scheduleBadgesHtml(schedule, lang) {
    const label = lang === 'fil' ? penaltyLabelFil : penaltyLabel;
    return schedule.map((code, i) =>
      `<span class="badge badge-gray" style="margin:2px 4px 2px 0;" title="${ordinal(i + 1)} ${TEXT[lang].occurrence}">${ordinal(i + 1)}: ${escapeHtml(label(code))}</span>`
    ).join('');
  }

  function categorySectionHtml(cat, lang) {
    return `
      <details class="ess-card" style="margin-bottom:10px;">
        <summary style="cursor:pointer; font-weight:700;">${escapeHtml(lang === 'fil' ? cat.categoryFil : cat.category)}</summary>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:12px;">
          ${cat.offenses.map(o => `
            <div>
              <div style="font-size:13px; margin-bottom:4px;">${escapeHtml(lang === 'fil' ? o.labelFil : o.label)}</div>
              <div>${scheduleBadgesHtml(o.schedule, lang)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  function render(main, emp) {
    const lang = essLang();
    const tx = TEXT[lang];
    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0; display:flex; justify-content:space-between; align-items:center;">
        <span>${t('title_discipline')}</span>
      </div>
      <div class="seg" id="seg-discipline-lang" style="margin-bottom:12px; display:flex;">
        <button type="button" data-lang="en" class="${lang === 'en' ? 'active' : ''}" style="flex:1;">English</button>
        <button type="button" data-lang="fil" class="${lang === 'fil' ? 'active' : ''}" style="flex:1;">Filipino</button>
      </div>
      <div class="ess-sub" style="margin-bottom:12px;">${tx.intro}</div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.penaltyLevels}</div>
        <div class="ess-row"><span class="label">${tx.verbalWarning}</span><span class="value" style="text-align:right; max-width:60%;">${tx.verbalWarningDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.writtenWarning}</span><span class="value" style="text-align:right; max-width:60%;">${tx.writtenWarningDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.suspension}</span><span class="value" style="text-align:right; max-width:60%;">${tx.suspensionDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.dismissal}</span><span class="value" style="text-align:right; max-width:60%;">${tx.dismissalDesc}</span></div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.howHandled}</div>
        <div class="ess-sub">${tx.howHandledDesc}</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.punctuality}</div>
        <div class="ess-sub">${tx.punctualityDesc}</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.habitual}</div>
        <div class="ess-sub">${tx.habitualDesc}</div>
      </div>

      <div class="ess-section-title">${tx.offensesTitle}</div>
      ${Store.disciplineCatalog().map(cat => categorySectionHtml(cat, lang)).join('')}
    `;

    qsa('#seg-discipline-lang button', main).forEach(b => b.addEventListener('click', () => {
      setEssLang(b.dataset.lang);
      render(main, emp);
    }));
  }

  return { render };
})();
