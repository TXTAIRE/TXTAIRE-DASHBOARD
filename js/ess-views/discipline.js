// Read-only reference page for the TXTAIRE OPC Code of Discipline, Series 2, 2026 Edition
// -- lets employees actually see what they're bound by, not just HR on the admin side.
// The offense list is sourced entirely from Store.disciplineCatalog() (js/store.js), the
// same data the admin Disciplinary case form uses for its offense picker and suggested-
// penalty lookup, so the two are guaranteed to never drift apart -- including once HR has
// imported the catalog and started editing it in the admin Code of Discipline page. No
// admin-editing capability here -- mirrors how Announcements are read-only on the ESS side
// (js/ess-views/notifications.js).
//
// Has its own English/Filipino toggle (in addition to the app-wide one on Settings) since
// this page's body text is long enough that switching languages without leaving the page
// is worth the extra control -- both toggles read/write the same essLang()/setEssLang()
// state (js/ess-i18n.js), so they never fall out of sync with each other.
//
// Series 2 rewrote how penalties work: instead of a schedule typed out per offense, every
// offense now carries a CLASS (A Light / B Less Grave / C Grave / D Serious) and the
// penalty for each class is stated once. That's why this page leads with the class table
// -- an employee who understands the four classes can read the whole offense list without
// having to decode a different escalation for every row.
window.EssViews.discipline = (function () {
  // Procedural/summary text is specific to this page (not shared with the admin side, so
  // it doesn't belong in js/store.js next to the offense catalog) -- kept here as a small
  // bilingual lookup, same first-pass-translation disclaimer as DISCIPLINE_OFFENSE_CATALOG.
  const TEXT = {
    en: {
      intro: 'TXTAIRE OPC Code of Discipline, <strong>Series 2, 2026 Edition</strong>. This edition replaces the Series 1, 2025 Edition. Penalties escalate by occurrence within a trailing 12-month period — twelve months with a clean record clears past offenses from the count.',

      whatsNew: 'What Changed in This Edition',
      whatsNewIntro: 'Every change below either lightens a penalty, adds a protection, or corrects something the Company was not entitled to do. Nothing in this edition makes your position worse.',
      change1: '<strong>Penalties are graduated.</strong> Offenses that used to mean dismissal on the very first instance — fighting on premises, gambling, borrowing from a subordinate — are now corrected in steps first.',
      change2: '<strong>Suspension is capped at 15 days.</strong> The previous edition allowed 30-day suspensions.',
      change3: '<strong>No more fines or lost pay.</strong> The ₱500 phone fine is withdrawn, and a missed time-in or time-out no longer costs you the day\'s pay — the hours you actually worked are always paid.',
      change4: '<strong>The grace period is now 15 minutes</strong>, up from 10.',
      change5: '<strong>Off-duty conduct away from company premises</strong> is no longer covered, unless it is connected to your work or involves the Company, a co-employee or a client.',
      change6: '<strong>Your rights during an investigation are written down</strong> — see "If You Are Asked to Explain" below.',

      classesTitle: 'The Four Offense Classes',
      classesIntro: 'Every offense in the list below belongs to one of four classes. The class tells you the penalty:',
      classCol: 'Class', occ1: '1st', occ2: '2nd', occ3: '3rd', occ4: '4th',
      classNote: 'A 5th Light offense within the same 12 months is treated under Habitual Delinquency below. Where the same act breaks more than one rule, only the highest single penalty applies — you are never penalised twice for one act.',

      penaltyLevels: 'What Each Penalty Means',
      verbalWarning: 'Verbal Warning', verbalWarningDesc: 'Your supervisor speaks to you privately, then records it in writing. No loss of pay.',
      writtenWarning: 'Written Warning', writtenWarningDesc: 'A formal memo you acknowledge, filed in your 201. No loss of pay.',
      suspension: 'Suspension', suspensionDesc: 'You do not report for the stated number of working days and are not paid for them. Never more than 15 days for one offense.',
      dismissal: 'Dismissal', dismissalDesc: 'Termination of employment, only for a just cause and only after the full procedure below.',

      howHandled: 'If You Are Asked to Explain',
      howHandledDesc: 'No penalty of any kind can be imposed until you have been told in writing what you are accused of and given a real chance to answer. The steps are always the same:',
      step1: '<strong>Notice to Explain.</strong> HR gives you a written notice stating exactly what you are said to have done — the act, the date, the place, and the rule involved. A vague notice is not valid.',
      step2: '<strong>You have at least 5 calendar days</strong> to answer in writing. You may attach documents, name witnesses, and ask for more time if you need it to gather evidence.',
      step3: '<strong>A conference</strong> is held if you ask for one, if the facts are disputed, or if dismissal is being considered. You may bring a representative or a lawyer of your own choosing, at your own expense.',
      step4: '<strong>A written decision</strong> tells you what was found, why your explanation was or was not accepted, and the penalty.',
      step5: '<strong>You may appeal in writing within 5 calendar days</strong> of receiving the decision. Someone who took no part in the original decision reviews it.',

      rightsTitle: 'Your Rights',
      rightsIntro: 'These rights cannot be signed away or waived by any provision of this Code:',
      right1: 'To be told in writing what you are accused of, and to be given a real chance to answer.',
      right2: 'To be assisted by a representative or lawyer of your own choosing at any conference.',
      right3: 'To see and copy the documents used against you, and your own 201 file.',
      right4: 'Not to be dismissed except for a just or authorized cause, with due process.',
      right5: 'To receive all wages and benefits due by law — these are never reduced as a penalty.',
      right6: 'To refuse work that poses an imminent danger to life or health, without being penalised.',
      right7: 'To a workplace free from harassment, discrimination and retaliation.',
      right8: 'To bring any grievance to DOLE or the NLRC without fear of reprisal.',

      reportTitle: 'Reporting a Concern',
      reportDesc: 'If you see a violation of this Code, a company policy, or the law, you can report it to <strong>your supervisor</strong>, to <strong>HR</strong> (including where the concern is about your own supervisor), or to <strong>the Owner or General Manager</strong>. Harassment complaints go to the <strong>Committee on Decorum and Investigation</strong>. Reports may be made in writing, by e-mail, or verbally, and may be made anonymously.',
      noRetaliation: 'No retaliation',
      noRetaliationDesc: 'You cannot be dismissed, suspended, demoted, transferred, denied a benefit, given a poorer evaluation, cut out of overtime, or disadvantaged in any way for reporting something in good faith — even if the report turns out to be mistaken. Retaliation is itself a Serious offense punishable by dismissal.',

      ethicsTitle: 'What the Company Expects',
      ethicsIntro: 'Before any question of discipline arises, these are the standards every employee is held to:',
      ethic1: '<strong>Honesty in records.</strong> Report the truth in your timesheets, service reports, liquidations and expense claims — even when the truth reflects badly on you.',
      ethic2: '<strong>No solicited gifts, ever.</strong> You may never ask a client, supplier or contractor for money, a gift, a discount or a favour. An unsolicited token worth ₱1,000 or less may be accepted; anything more is turned over to HR.',
      ethic3: '<strong>Declare conflicts of interest.</strong> A relative applying for a job, a friend who supplies the Company, a sideline — none of these are wrong. Deciding on them without saying so is. Declaring is never itself a violation.',
      ethic4: '<strong>Protect what you are trusted with.</strong> Client pricing, site layouts, technical drawings, co-employees\' personal data — use them for your work and nothing else. This continues after you leave.',
      ethic5: '<strong>On a client site, you are the Company.</strong> Follow the client\'s house rules, wear your ID, stay in your work area, and never solicit side jobs from a client or their staff.',
      ethic6: '<strong>Respect.</strong> Harassment, bullying and slurs are never acceptable. Being given an instruction, corrected, or held to a standard is not harassment.',

      punctuality: 'Attendance and Punctuality',
      punctualityDesc: 'A <strong>15-minute grace period</strong> applies after your official time-in — arriving later than that is recorded as Late. Being late 4 or more times in one month is a Light offense; a total of 300 minutes or more in one month is a Less Grave offense. Time actually lost is deducted from pay in the ordinary way — that deduction is not a penalty and does not replace the disciplinary action.',
      absenceNote: 'An absence is <strong>excused</strong> if you gave notice and had a legitimate reason, even if the leave form was filed late. Notify your supervisor as early as you can, and no later than 2 hours after your shift starts.',

      habitual: 'Habitual Delinquency',
      habitualDesc: 'You are habitually delinquent if, within a rolling 12 months, you accumulate 5 Light offenses, or 3 written warnings, or 3 suspensions, or any 4 penalties of written warning or higher — each from a separate incident. This is treated as a Grave offense in its own right and gets its own Notice to Explain. It is <strong>not</strong> an automatic dismissal: where the underlying offenses were all light and caused no loss, the normal outcome is a suspension and a written improvement plan.',

      clearingTitle: 'Clearing Your Record',
      clearingDesc: 'A penalty stops counting toward the next step 12 months after it was fully served, provided you commit no further offense of the same class in that time. A cleared penalty can never be used to deny you a promotion, a transfer, training or any benefit. HR also cannot start a case more than 60 days after your supervisor or HR learned of the incident (1 year for fraud, dishonesty, harassment or violence).',

      offensesTitle: 'Offenses & Penalty Schedule',
      occurrence: 'occurrence within 12 months',
      tapToOpen: 'Tap a category to open it.',
      disclaimer: 'This page is a plain-language summary for reference. The full Code of Discipline, Series 2, 2026 Edition is the controlling document — ask HR for a copy. Where this Code conflicts with the Labor Code of the Philippines or a DOLE issuance, the law prevails.',
    },

    fil: {
      intro: 'TXTAIRE OPC Code of Discipline, <strong>Series 2, 2026 Edition</strong>. Pinapalitan nito ang Series 1, 2025 Edition. Dumadami ang parusa kada ulit ng paglabag sa loob ng 12 buwan — kung malinis ang record mo sa loob ng 12 buwan, hindi na bibilangin ang mga nakaraang paglabag.',

      whatsNew: 'Ano ang Nagbago sa Edisyong Ito',
      whatsNewIntro: 'Lahat ng pagbabago sa ibaba ay nagpapagaan ng parusa, nagdaragdag ng proteksyon, o nagwawasto ng bagay na hindi naman dapat ginagawa ng kompanya. Walang pagbabago rito na nakakasama sa iyo.',
      change1: '<strong>Unti-unti na ang parusa.</strong> Ang mga paglabag na dating tanggal agad sa unang beses — away sa loob ng kompanya, sugal, panghihiram sa tauhan — ay may babala at suspensyon muna ngayon.',
      change2: '<strong>Hanggang 15 araw na lang ang suspensyon.</strong> Dati ay umaabot ito ng 30 araw.',
      change3: '<strong>Wala nang multa o bawas sa sahod.</strong> Tinanggal na ang ₱500 multa sa cellphone, at kapag nakalimutan mong mag-time in o time out, hindi na mawawala ang sahod mo sa araw na iyon — babayaran pa rin ang oras na talagang pinasukan mo.',
      change4: '<strong>15 minuto na ang grace period</strong>, dati ay 10 lang.',
      change5: '<strong>Ang mga bagay na ginawa mo sa labas ng trabaho</strong>, malayo sa kompanya, ay hindi na sakop — maliban kung may kinalaman ito sa trabaho mo o sa kompanya, kasamahan, o kliyente.',
      change6: '<strong>Nakasulat na ngayon ang mga karapatan mo</strong> kapag may imbestigasyon — tingnan ang "Kung Ikaw ay Pinapaliwanag" sa ibaba.',

      classesTitle: 'Ang Apat na Uri ng Paglabag',
      classesIntro: 'Bawat paglabag sa listahan sa ibaba ay nasa isa sa apat na uri. Ang uri ang nagsasabi kung ano ang parusa:',
      classCol: 'Uri', occ1: 'Una', occ2: 'Pangalawa', occ3: 'Pangatlo', occ4: 'Pang-apat',
      classNote: 'Kapag ikalima mo nang Magaan na paglabag sa loob ng 12 buwan, mapupunta ito sa Paulit-ulit na Paglabag sa ibaba. Kapag isang gawa ang lumabag sa maraming patakaran, iisang parusa lang — ang pinakamataas — ang ipapataw. Hindi ka pinaparusahan nang dalawang beses sa iisang gawa.',

      penaltyLevels: 'Ano ang Ibig Sabihin ng Bawat Parusa',
      verbalWarning: 'Bibig na Babala', verbalWarningDesc: 'Kakausapin ka nang private ng supervisor mo, tapos itatala ito. Walang bawas sa sahod.',
      writtenWarning: 'Sulat na Babala', writtenWarningDesc: 'Opisyal na memo na pipirmahan mo, isasama sa 201 file mo. Walang bawas sa sahod.',
      suspension: 'Suspensyon', suspensionDesc: 'Hindi ka papasok sa loob ng nakatakdang araw at walang sahod sa mga araw na iyon. Hindi hihigit sa 15 araw para sa isang paglabag.',
      dismissal: 'Tanggal sa Trabaho', dismissalDesc: 'Matatapos ang trabaho mo, para lang sa malubhang dahilan at pagkatapos lang ng buong proseso sa ibaba.',

      howHandled: 'Kung Ikaw ay Pinapaliwanag',
      howHandledDesc: 'Walang parusang maaaring ipataw hangga\'t hindi ka sinasabihan nang nakasulat kung ano ang ibinibintang sa iyo at hindi ka binibigyan ng tunay na pagkakataong sumagot. Ganito palagi ang proseso:',
      step1: '<strong>Notice to Explain.</strong> Bibigyan ka ng HR ng sulat na nagsasabi kung ano mismo ang ginawa mo raw — ang gawa, ang petsa, ang lugar, at ang patakarang nalabag. Hindi tanggap ang malabong sulat.',
      step2: '<strong>May 5 araw ka man lang</strong> para sumagot nang nakasulat. Puwede kang maglakip ng dokumento, magsabi ng testigo, at humingi ng dagdag na panahon kung kailangan mo.',
      step3: '<strong>May pagdinig</strong> kung hihingin mo, kung magkasalungat ang mga kuwento, o kung tanggalan ang pinag-uusapan. Puwede kang magsama ng kinatawan o abogado na ikaw ang pumili, sa gastos mo.',
      step4: '<strong>May nakasulat na desisyon</strong> na magsasabi kung ano ang natuklasan, bakit tinanggap o hindi ang paliwanag mo, at ano ang parusa.',
      step5: '<strong>Puwede kang mag-apela nang nakasulat sa loob ng 5 araw</strong> mula nang matanggap mo ang desisyon. Ibang tao na walang kinalaman sa unang desisyon ang susuri nito.',

      rightsTitle: 'Ang Mga Karapatan Mo',
      rightsIntro: 'Hindi mawawala ang mga karapatang ito, at walang bahagi ng Code na ito ang makakabawi nito:',
      right1: 'Malaman nang nakasulat kung ano ang ibinibintang sa iyo, at magkaroon ng tunay na pagkakataong sumagot.',
      right2: 'Magsama ng kinatawan o abogado na ikaw ang pumili sa anumang pagdinig.',
      right3: 'Makita at makakuha ng kopya ng mga dokumentong ginamit laban sa iyo, at ng sarili mong 201 file.',
      right4: 'Hindi matanggal maliban kung may malubha o awtorisadong dahilan, at may tamang proseso.',
      right5: 'Matanggap ang lahat ng sahod at benepisyong nakalaan sa batas — hindi ito kailanman babawasan bilang parusa.',
      right6: 'Tumanggi sa trabahong may agarang panganib sa buhay o kalusugan, nang hindi pinaparusahan.',
      right7: 'Magtrabaho sa lugar na walang harassment, diskriminasyon, at paghihiganti.',
      right8: 'Magdala ng reklamo sa DOLE o NLRC nang walang takot na gantihan ka.',

      reportTitle: 'Pag-report ng Alalahanin',
      reportDesc: 'Kung may nakita kang paglabag sa Code na ito, sa patakaran, o sa batas, puwede mong i-report ito sa <strong>supervisor mo</strong>, sa <strong>HR</strong> (kasama na kung ang supervisor mo mismo ang may problema), o sa <strong>May-ari o General Manager</strong>. Ang reklamo sa harassment ay sa <strong>Committee on Decorum and Investigation</strong>. Puwedeng nakasulat, sa e-mail, o pasalita, at puwedeng walang pangalan.',
      noRetaliation: 'Walang paghihiganti',
      noRetaliationDesc: 'Hindi ka puwedeng tanggalin, suspindihin, ibaba ang posisyon, ilipat, bawasan ng benepisyo, bigyan ng mababang evaluation, alisan ng overtime, o pahirapan sa anumang paraan dahil nag-report ka nang may magandang loob — kahit pa magkamali ang report mo. Ang paghihiganti ay Napakabigat na paglabag na may parusang tanggal sa trabaho.',

      ethicsTitle: 'Ano ang Inaasahan ng Kompanya',
      ethicsIntro: 'Bago pa man mapunta sa usapang disiplina, ito ang mga pamantayang inaasahan sa bawat empleyado:',
      ethic1: '<strong>Katapatan sa record.</strong> Totoo ang isulat mo sa timesheet, service report, liquidation, at expense claim — kahit hindi maganda ang lalabas para sa iyo.',
      ethic2: '<strong>Huwag kailanman manghingi ng regalo.</strong> Bawal kang humingi ng pera, regalo, diskwento, o pabor sa kliyente, supplier, o contractor. Ang hindi hinging token na ₱1,000 pababa ay puwedeng tanggapin; ang mas mataas ay ibibigay sa HR.',
      ethic3: '<strong>Ideklara ang conflict of interest.</strong> May kamag-anak na nag-a-apply, kaibigan na supplier, may sideline — hindi masama ang mga ito. Ang masama ay ang magdesisyon tungkol dito nang hindi sinasabi. Ang pagdeklara mismo ay hindi kailanman paglabag.',
      ethic4: '<strong>Ingatan ang ipinagkatiwala sa iyo.</strong> Presyo ng kliyente, layout ng site, technical drawing, personal na datos ng kasamahan — gamitin lang para sa trabaho. Tumutuloy ito kahit umalis ka na.',
      ethic5: '<strong>Sa site ng kliyente, ikaw ang kompanya.</strong> Sundin ang patakaran ng kliyente, isuot ang ID, manatili sa lugar ng trabaho mo, at huwag manghingi ng rakets sa kliyente o sa staff nila.',
      ethic6: '<strong>Respeto.</strong> Hindi kailanman tanggap ang harassment, pambu-bully, at panlalait. Ang pag-uutos, pagwawasto, at paghingi ng tamang trabaho ay hindi harassment.',

      punctuality: 'Attendance at Pagiging Maagap',
      punctualityDesc: 'May <strong>15 minutong grace period</strong> pagkatapos ng oras ng pasok mo — kapag lumagpas ka rito, ma-la-late ka. Kapag 4 na beses o higit ka nang na-late sa isang buwan, Magaan na paglabag ito; kapag umabot ng 300 minuto o higit ang kabuuan sa isang buwan, Katamtaman na. Ang oras na talagang nawala ay babawasin sa sahod sa karaniwang paraan — hindi ito parusa at hindi nito papalitan ang disiplinaryong aksyon.',
      absenceNote: '<strong>May dahilan</strong> ang pagliban mo kung nagpaalam ka at totoo ang dahilan, kahit na-late ang pag-file mo ng leave form. Magpaalam sa supervisor mo nang maaga hangga\'t kaya, at hindi lalagpas sa 2 oras mula sa simula ng shift mo.',

      habitual: 'Paulit-ulit na Paglabag',
      habitualDesc: 'Ituturing kang paulit-ulit na lumalabag kung sa loob ng 12 buwan ay umabot ka sa 5 Magaan na paglabag, o 3 sulat na babala, o 3 suspensyon, o kahit anong 4 na parusang sulat na babala pataas — bawat isa mula sa magkakaibang pangyayari. Mabigat na paglabag ito sa sarili nito at may sarili itong Notice to Explain. <strong>Hindi</strong> ito automatic na tanggal: kung pawang magagaan ang mga paglabag at walang pinsala, ang karaniwang kalalabasan ay suspensyon at nakasulat na plano para gumanda ang trabaho mo.',

      clearingTitle: 'Paglilinis ng Record Mo',
      clearingDesc: 'Titigil sa pagbibilang ang isang parusa 12 buwan matapos mong maserbisyuhan ito, basta walang bago kang paglabag sa parehong uri sa panahong iyon. Ang nalinis na parusa ay hindi na kailanman puwedeng gamiting dahilan para tanggihan ka sa promotion, transfer, training, o kahit anong benepisyo. Hindi rin puwedeng magsimula ng kaso ang HR kung lampas 60 araw na mula nang malaman ito ng supervisor mo o ng HR (1 taon kung pandaraya, kawalan ng katapatan, harassment, o karahasan).',

      offensesTitle: 'Mga Paglabag at Parusa',
      occurrence: 'na paglabag sa loob ng 12 buwan',
      tapToOpen: 'Pindutin ang kategorya para mabuksan.',
      disclaimer: 'Buod lang sa simpleng salita ang pahinang ito. Ang buong Code of Discipline, Series 2, 2026 Edition ang siyang opisyal na dokumento — humingi ng kopya sa HR. Kapag may salungatan ang Code na ito sa Labor Code ng Pilipinas o sa kautusan ng DOLE, ang batas ang masusunod.',
    },
  };

  // Same tints the printed Code and the admin editor use for the four classes.
  const CLASS_TINT = {
    A: { bg: '#e2f0d9', fg: '#375623' },
    B: { bg: '#fff2cc', fg: '#7f6000' },
    C: { bg: '#fbe5d6', fg: '#974706' },
    D: { bg: '#f8cbcb', fg: '#9c1c1c' },
  };

  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function classBadgeHtml(klass, lang) {
    const meta = Store.penaltyClasses()[klass];
    if (!meta) return '';
    const tint = CLASS_TINT[klass];
    const name = lang === 'fil' ? meta.labelFil : meta.label;
    return `<span class="badge" style="background:${tint.bg}; color:${tint.fg}; white-space:nowrap;">${klass} · ${escapeHtml(name)}</span>`;
  }

  function scheduleBadgesHtml(schedule, lang) {
    const label = lang === 'fil' ? penaltyLabelFil : penaltyLabel;
    return schedule.map((code, i) =>
      `<span class="badge badge-gray" style="margin:2px 4px 2px 0;" title="${ordinal(i + 1)} ${TEXT[lang].occurrence}">${ordinal(i + 1)}: ${escapeHtml(label(code))}</span>`
    ).join('');
  }

  // The Sec. 3.4 Schedule of Penalties, rendered straight from PENALTY_CLASSES so this
  // table can never disagree with the schedules actually applied to the offenses below.
  function classTableHtml(lang) {
    const tx = TEXT[lang];
    const label = lang === 'fil' ? penaltyLabelFil : penaltyLabel;
    const classes = Store.penaltyClasses();
    const head = `<tr>
        <th style="text-align:left; padding:6px 4px; font-size:11px; color:var(--text-faint); font-weight:600;">${tx.classCol}</th>
        <th style="text-align:left; padding:6px 4px; font-size:11px; color:var(--text-faint); font-weight:600;">${tx.occ1}</th>
        <th style="text-align:left; padding:6px 4px; font-size:11px; color:var(--text-faint); font-weight:600;">${tx.occ2}</th>
        <th style="text-align:left; padding:6px 4px; font-size:11px; color:var(--text-faint); font-weight:600;">${tx.occ3}</th>
        <th style="text-align:left; padding:6px 4px; font-size:11px; color:var(--text-faint); font-weight:600;">${tx.occ4}</th>
      </tr>`;
    const rows = Object.keys(classes).map((k) => {
      const sched = classes[k].schedule;
      const cells = [0, 1, 2, 3].map((i) => {
        const v = sched[i];
        const isD = v === 'D';
        return `<td style="padding:7px 4px; font-size:11.5px; border-top:1px solid var(--border-soft); ${isD ? 'font-weight:700; color:var(--red,#dc2626);' : ''}">${v ? escapeHtml(label(v)) : '—'}</td>`;
      }).join('');
      return `<tr><td style="padding:7px 4px; border-top:1px solid var(--border-soft);">${classBadgeHtml(k, lang)}</td>${cells}</tr>`;
    }).join('');
    return `<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; min-width:420px;">${head}${rows}</table></div>`;
  }

  function categorySectionHtml(cat, lang) {
    return `
      <details class="ess-card" style="margin-bottom:10px;">
        <summary style="cursor:pointer; font-weight:700;">${escapeHtml(lang === 'fil' ? (cat.categoryFil || cat.category) : cat.category)}
          <span class="ess-sub" style="font-weight:400;">&nbsp;(${cat.offenses.length})</span>
        </summary>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:14px;">
          ${cat.offenses.map(o => `
            <div>
              <div style="font-size:13px; margin-bottom:5px;">${escapeHtml(lang === 'fil' ? (o.labelFil || o.label) : o.label)}</div>
              <div>${classBadgeHtml(o.klass, lang)} ${scheduleBadgesHtml(o.schedule, lang)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  const bulletList = (items) =>
    `<ul style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:7px;">
      ${items.map(i => `<li class="ess-sub" style="line-height:1.5;">${i}</li>`).join('')}
    </ul>`;

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
      <div class="ess-sub" style="margin-bottom:14px; line-height:1.5;">${tx.intro}</div>

      <div class="ess-card" style="margin-bottom:14px; border-left:3px solid var(--green,#16a34a);">
        <div class="ess-card-label">${tx.whatsNew}</div>
        <div class="ess-sub" style="margin-bottom:9px; line-height:1.5;">${tx.whatsNewIntro}</div>
        ${bulletList([tx.change1, tx.change2, tx.change3, tx.change4, tx.change5, tx.change6])}
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.classesTitle}</div>
        <div class="ess-sub" style="margin-bottom:10px;">${tx.classesIntro}</div>
        ${classTableHtml(lang)}
        <div class="ess-sub" style="margin-top:10px; line-height:1.5;">${tx.classNote}</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.penaltyLevels}</div>
        <div class="ess-row"><span class="label">${tx.verbalWarning}</span><span class="value" style="text-align:right; max-width:62%; font-weight:400; font-size:12.5px;">${tx.verbalWarningDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.writtenWarning}</span><span class="value" style="text-align:right; max-width:62%; font-weight:400; font-size:12.5px;">${tx.writtenWarningDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.suspension}</span><span class="value" style="text-align:right; max-width:62%; font-weight:400; font-size:12.5px;">${tx.suspensionDesc}</span></div>
        <div class="ess-row"><span class="label">${tx.dismissal}</span><span class="value" style="text-align:right; max-width:62%; font-weight:400; font-size:12.5px;">${tx.dismissalDesc}</span></div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.howHandled}</div>
        <div class="ess-sub" style="margin-bottom:9px; line-height:1.5;">${tx.howHandledDesc}</div>
        ${bulletList([tx.step1, tx.step2, tx.step3, tx.step4, tx.step5])}
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.rightsTitle}</div>
        <div class="ess-sub" style="margin-bottom:9px;">${tx.rightsIntro}</div>
        ${bulletList([tx.right1, tx.right2, tx.right3, tx.right4, tx.right5, tx.right6, tx.right7, tx.right8])}
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.reportTitle}</div>
        <div class="ess-sub" style="line-height:1.5;">${tx.reportDesc}</div>
        <div style="margin-top:11px; padding:10px 12px; border-radius:10px; background:rgba(248,113,113,0.10);">
          <div style="font-size:12px; font-weight:700; color:var(--red,#dc2626); margin-bottom:4px;">${tx.noRetaliation}</div>
          <div class="ess-sub" style="line-height:1.5;">${tx.noRetaliationDesc}</div>
        </div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.ethicsTitle}</div>
        <div class="ess-sub" style="margin-bottom:9px;">${tx.ethicsIntro}</div>
        ${bulletList([tx.ethic1, tx.ethic2, tx.ethic3, tx.ethic4, tx.ethic5, tx.ethic6])}
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.punctuality}</div>
        <div class="ess-sub" style="line-height:1.5;">${tx.punctualityDesc}</div>
        <div class="ess-sub" style="line-height:1.5; margin-top:9px;">${tx.absenceNote}</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.habitual}</div>
        <div class="ess-sub" style="line-height:1.5;">${tx.habitualDesc}</div>
      </div>

      <div class="ess-card" style="margin-bottom:14px;">
        <div class="ess-card-label">${tx.clearingTitle}</div>
        <div class="ess-sub" style="line-height:1.5;">${tx.clearingDesc}</div>
      </div>

      <div class="ess-section-title">${tx.offensesTitle}</div>
      <div class="ess-sub" style="margin-bottom:10px;">${tx.tapToOpen}</div>
      ${Store.disciplineCatalog().map(cat => categorySectionHtml(cat, lang)).join('')}

      <div class="ess-sub" style="margin:16px 0 4px 0; line-height:1.5; opacity:0.85;">${tx.disclaimer}</div>
    `;

    qsa('#seg-discipline-lang button', main).forEach(b => b.addEventListener('click', () => {
      setEssLang(b.dataset.lang);
      render(main, emp);
    }));
  }

  return { render };
})();
