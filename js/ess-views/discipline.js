// Read-only reference page for the TXTAIRE OPC Code of Discipline, Series 2, 2026 Edition.
//
// This page used to lay ten cards out one under another -- what changed, the classes, the
// penalties, due process, rights, reporting, ethics, attendance, habitual delinquency,
// clearing your record -- and an employee had to scroll past all of it to reach the offense
// list, which is the part they actually came for. It now leads with the three things that
// answer a real question ("how bad is this?", "what's the penalty?", "where's the full
// text?") and folds the procedural detail into collapsible sections beneath.
//
// The offense list is sourced entirely from Store.disciplineCatalog() (js/store.js), the
// same data the admin Disciplinary case form uses for its offense picker and suggested-
// penalty lookup, so the two can never drift apart -- including once HR has imported the
// catalog and started editing it. Offenses arrive already ordered light-to-serious, the
// same order the printed Code lists them in.
//
// The English/Filipino toggle here is in addition to the app-wide one on Settings; both
// read and write the same essLang()/setEssLang() state (js/ess-i18n.js), so they can't
// fall out of sync.
window.EssViews.discipline = (function () {
  // Class colours, matching the printed Code and the admin editor exactly, so the same
  // offense carries the same colour on paper, on My Portal and on the HR screen.
  const CLASS_TINT = {
    A: { bg: '#e2f0d9', fg: '#375623', bar: '#7aa661' },
    B: { bg: '#fff2cc', fg: '#7f6000', bar: '#d4b02a' },
    C: { bg: '#fbe5d6', fg: '#974706', bar: '#d98b4a' },
    D: { bg: '#f8cbcb', fg: '#9c1c1c', bar: '#d05a5a' },
  };

  // The full Code as published. Served from the app's own origin, so the service worker
  // caches it on first open and it stays readable offline afterwards (js/../sw.js) --
  // it is deliberately NOT in PRECACHE_URLS, which would add ~800KB to every install.
  const PDF = {
    en: 'assets/docs/code-of-discipline-2026-en.pdf',
    fil: 'assets/docs/code-of-discipline-2026-fil.pdf',
  };

  const TEXT = {
    en: {
      edition: 'Series 2, 2026 Edition',
      intro: 'Penalties depend on the class of the offense, and rise each time the same class of offense is repeated within 12 months. Twelve months with a clean record clears past offenses from the count.',

      openPdf: 'Open the full Code (PDF)',
      openPdfSub: 'The complete 45-page document, including your rights, the full procedure and all the forms.',
      pdfMissing: 'The Filipino edition is not available yet — opening the English one.',

      classesTitle: 'The four offense classes',
      classNames: { A: 'LIGHT', B: 'LESS GRAVE', C: 'GRAVE', D: 'SERIOUS' },
      classSteps: {
        A: 'Verbal warning → Written warning → 3 days → 7 days',
        B: 'Written warning → 3 days → 7 days → Dismissal',
        C: '7 days → 15 days → Dismissal',
        D: 'Dismissal on the first offense',
      },
      classNote: 'Suspension is never more than 15 days for one offense. Where one act breaks more than one rule, only the highest single penalty applies — you are never penalised twice for one act.',

      offensesTitle: 'Offenses',
      offensesSub: 'Listed light to serious within each group. Tap a group to open it.',
      occurrence: 'occurrence within 12 months',

      knowTitle: 'Worth knowing',

      askedTitle: 'If you are asked to explain',
      asked: [
        '<strong>You get a written notice</strong> stating exactly what you are said to have done — the act, the date, the place, and the rule involved. A vague notice is not valid.',
        '<strong>You have at least 5 calendar days</strong> to answer in writing. You may attach documents, name witnesses, and ask for more time.',
        '<strong>A conference</strong> is held if you ask for one, if the facts are disputed, or if dismissal is being considered. You may bring a representative or a lawyer of your own choosing, at your own expense.',
        '<strong>You get a written decision</strong> saying what was found, why your explanation was or was not accepted, and the penalty.',
        '<strong>You may appeal within 5 calendar days.</strong> Someone who took no part in the original decision reviews it.',
      ],

      rightsTitle: 'Your rights',
      rights: [
        'To be told in writing what you are accused of, and to have a real chance to answer.',
        'To be assisted by a representative or lawyer of your own choosing.',
        'To see and copy the documents used against you, and your own 201 file.',
        'Not to be dismissed except for a just or authorized cause, with due process.',
        'To receive all wages and benefits due by law — never reduced as a penalty.',
        'To refuse work that poses an imminent danger to life or health.',
        'To a workplace free from harassment, discrimination and retaliation.',
        'To bring any grievance to DOLE or the NLRC without fear of reprisal.',
      ],

      reportTitle: 'Reporting a concern',
      reportBody: 'You can report a violation to <strong>your supervisor</strong>, to <strong>HR</strong> (including when it concerns your own supervisor), or to <strong>the Owner or General Manager</strong>. Harassment complaints go to the <strong>Committee on Decorum and Investigation</strong>. Reports may be written, by e-mail, or verbal, and may be anonymous.',
      reportWarn: 'You cannot be dismissed, suspended, demoted, transferred, denied a benefit, given a poorer evaluation, cut out of overtime, or disadvantaged in any way for reporting something in good faith — even if the report turns out to be mistaken. Retaliation is itself a Serious offense.',

      attendanceTitle: 'Attendance and lateness',
      attendanceBody: 'A <strong>15-minute grace period</strong> applies after your official time-in. Being late 4 or more times in one month is a Light offense; 300 minutes or more in one month is Less Grave. Time actually lost is deducted from pay in the ordinary way — that deduction is not a penalty. An absence is <strong>excused</strong> if you gave notice and had a legitimate reason, even if the leave form was filed late.',

      repeatTitle: 'Repeated offenses and clearing your record',
      repeatBody: 'Five Light offenses, or three written warnings, or three suspensions, or any four penalties of written warning or higher within 12 months counts as habitual delinquency — treated as a Grave offense with its own notice. It is <strong>not</strong> automatic dismissal. A penalty stops counting 12 months after it was served, and a cleared penalty can never be used to deny you a promotion, transfer, training or benefit.',

      disclaimer: 'This page is a plain-language summary. The full Code of Discipline, Series 2, 2026 Edition is the controlling document. Where this Code conflicts with the Labor Code of the Philippines or a DOLE issuance, the law prevails.',
    },

    fil: {
      edition: 'Series 2, 2026 Edition',
      intro: 'Ang parusa ay nakadepende sa uri ng paglabag, at tumataas kada ulit ng parehong uri sa loob ng 12 buwan. Kapag malinis ang record mo sa loob ng 12 buwan, hindi na bibilangin ang mga nakaraang paglabag.',

      openPdf: 'Buksan ang buong Code (PDF)',
      openPdfSub: 'Ang kumpletong 45-pahinang dokumento — kasama ang mga karapatan mo, ang buong proseso, at lahat ng form.',
      pdfMissing: 'Wala pang Filipino na bersyon — bubuksan ang English.',

      classesTitle: 'Ang apat na uri ng paglabag',
      classNames: { A: 'MAGAAN', B: 'KATAMTAMAN', C: 'MABIGAT', D: 'NAPAKABIGAT' },
      classSteps: {
        A: 'Bibig na babala → Sulat na babala → 3 araw → 7 araw',
        B: 'Sulat na babala → 3 araw → 7 araw → Tanggal',
        C: '7 araw → 15 araw → Tanggal',
        D: 'Tanggal agad sa unang paglabag',
      },
      classNote: 'Hindi hihigit sa 15 araw ang suspensyon para sa isang paglabag. Kapag isang gawa ang lumabag sa maraming patakaran, iisang parusa lang — ang pinakamataas — ang ipapataw. Hindi ka pinaparusahan nang dalawang beses sa iisang gawa.',

      offensesTitle: 'Mga paglabag',
      offensesSub: 'Nakasunod mula magaan hanggang napakabigat sa bawat grupo. Pindutin ang grupo para buksan.',
      occurrence: 'na paglabag sa loob ng 12 buwan',

      knowTitle: 'Mabuting malaman',

      askedTitle: 'Kung ikaw ay pinapaliwanag',
      asked: [
        '<strong>May matatanggap kang sulat</strong> na nagsasabi kung ano mismo ang ginawa mo raw — ang gawa, ang petsa, ang lugar, at ang patakarang nalabag. Hindi tanggap ang malabong sulat.',
        '<strong>May 5 araw ka man lang</strong> para sumagot nang nakasulat. Puwede kang maglakip ng dokumento, magsabi ng testigo, at humingi ng dagdag na panahon.',
        '<strong>May pagdinig</strong> kung hihingin mo, kung magkasalungat ang mga kuwento, o kung tanggalan ang pinag-uusapan. Puwede kang magsama ng kinatawan o abogado na ikaw ang pumili, sa gastos mo.',
        '<strong>May matatanggap kang nakasulat na desisyon</strong> — kung ano ang natuklasan, bakit tinanggap o hindi ang paliwanag mo, at ano ang parusa.',
        '<strong>Puwede kang mag-apela sa loob ng 5 araw.</strong> Ibang tao na walang kinalaman sa unang desisyon ang susuri nito.',
      ],

      rightsTitle: 'Ang mga karapatan mo',
      rights: [
        'Malaman nang nakasulat kung ano ang ibinibintang sa iyo, at magkaroon ng tunay na pagkakataong sumagot.',
        'Magsama ng kinatawan o abogado na ikaw ang pumili.',
        'Makita at makakuha ng kopya ng mga dokumentong ginamit laban sa iyo, at ng sarili mong 201 file.',
        'Hindi matanggal maliban kung may malubha o awtorisadong dahilan, at may tamang proseso.',
        'Matanggap ang lahat ng sahod at benepisyong nakalaan sa batas — hindi ito babawasan bilang parusa.',
        'Tumanggi sa trabahong may agarang panganib sa buhay o kalusugan.',
        'Magtrabaho sa lugar na walang harassment, diskriminasyon, at paghihiganti.',
        'Magdala ng reklamo sa DOLE o NLRC nang walang takot na gantihan ka.',
      ],

      reportTitle: 'Pag-report ng alalahanin',
      reportBody: 'Puwede mong i-report ang paglabag sa <strong>supervisor mo</strong>, sa <strong>HR</strong> (kasama na kung ang supervisor mo mismo ang may problema), o sa <strong>May-ari o General Manager</strong>. Ang reklamo sa harassment ay sa <strong>Committee on Decorum and Investigation</strong>. Puwedeng nakasulat, sa e-mail, o pasalita, at puwedeng walang pangalan.',
      reportWarn: 'Hindi ka puwedeng tanggalin, suspindihin, ibaba ang posisyon, ilipat, bawasan ng benepisyo, bigyan ng mababang evaluation, alisan ng overtime, o pahirapan sa anumang paraan dahil nag-report ka nang may magandang loob — kahit pa magkamali ang report mo. Ang paghihiganti ay Napakabigat na paglabag.',

      attendanceTitle: 'Attendance at pagiging huli',
      attendanceBody: 'May <strong>15 minutong grace period</strong> pagkatapos ng oras ng pasok mo. Kapag 4 na beses o higit kang na-late sa isang buwan, Magaan na paglabag; kapag umabot ng 300 minuto sa isang buwan, Katamtaman. Ang oras na talagang nawala ay babawasin sa sahod sa karaniwang paraan — hindi ito parusa. <strong>May dahilan</strong> ang pagliban mo kung nagpaalam ka at totoo ang dahilan, kahit na-late ang pag-file ng leave form.',

      repeatTitle: 'Paulit-ulit na paglabag at paglilinis ng record',
      repeatBody: 'Limang Magaan na paglabag, o tatlong sulat na babala, o tatlong suspensyon, o kahit anong apat na parusang sulat na babala pataas sa loob ng 12 buwan ay ituturing na paulit-ulit na paglabag — Mabigat na paglabag ito na may sariling sulat. <strong>Hindi</strong> ito automatic na tanggal. Titigil sa pagbibilang ang parusa 12 buwan matapos itong maserbisyuhan, at ang nalinis na parusa ay hindi puwedeng gamiting dahilan para tanggihan ka sa promotion, transfer, training, o benepisyo.',

      disclaimer: 'Buod lang sa simpleng salita ang pahinang ito. Ang buong Code of Discipline, Series 2, 2026 Edition ang siyang opisyal na dokumento. Kapag may salungatan ito sa Labor Code ng Pilipinas o sa kautusan ng DOLE, ang batas ang masusunod.',
    },
  };

  function ordinal(n) {
    if (n % 10 === 1 && n % 100 !== 11) return n + 'st';
    if (n % 10 === 2 && n % 100 !== 12) return n + 'nd';
    if (n % 10 === 3 && n % 100 !== 13) return n + 'rd';
    return n + 'th';
  }

  function classChip(klass, lang) {
    const tint = CLASS_TINT[klass];
    if (!tint) return '';
    return `<span class="badge" style="background:${tint.bg}; color:${tint.fg}; white-space:nowrap; font-weight:700;">${klass} · ${escapeHtml(TEXT[lang].classNames[klass])}</span>`;
  }

  // The colour legend -- four stacked bands, each tinted with its class colour and stating
  // the penalty in words. This is the page's main "answer" block, so it stays expanded.
  function classLegendHtml(lang) {
    const tx = TEXT[lang];
    return ['A', 'B', 'C', 'D'].map((k) => {
      const t = CLASS_TINT[k];
      return `
        <div style="display:flex; align-items:stretch; border-radius:10px; overflow:hidden; background:${t.bg}; margin-bottom:6px;">
          <div style="width:5px; background:${t.bar}; flex:none;"></div>
          <div style="padding:9px 11px;">
            <div style="font-size:12px; font-weight:800; color:${t.fg}; letter-spacing:0.03em;">
              ${k} &middot; ${escapeHtml(tx.classNames[k])}
            </div>
            <div style="font-size:12px; color:#3f3f3f; margin-top:3px;">${escapeHtml(tx.classSteps[k])}</div>
          </div>
        </div>`;
    }).join('');
  }

  function scheduleBadgesHtml(schedule, lang) {
    const label = lang === 'fil' ? penaltyLabelFil : penaltyLabel;
    return schedule.map((code, i) =>
      `<span class="badge badge-gray" style="margin:2px 4px 2px 0; font-size:10.5px;" title="${ordinal(i + 1)} ${TEXT[lang].occurrence}">${ordinal(i + 1)}: ${escapeHtml(label(code))}</span>`
    ).join('');
  }

  function categorySectionHtml(cat, lang) {
    return `
      <details class="ess-card" style="margin-bottom:8px;">
        <summary style="cursor:pointer; font-weight:700; font-size:13px;">${escapeHtml(lang === 'fil' ? (cat.categoryFil || cat.category) : cat.category)}
          <span class="ess-sub" style="font-weight:400;">&nbsp;(${cat.offenses.length})</span>
        </summary>
        <div style="margin-top:10px; display:flex; flex-direction:column; gap:13px;">
          ${cat.offenses.map(o => `
            <div>
              <div style="font-size:12.5px; margin-bottom:5px; line-height:1.45;">${escapeHtml(lang === 'fil' ? (o.labelFil || o.label) : o.label)}</div>
              <div>${classChip(o.klass, lang)} ${scheduleBadgesHtml(o.schedule, lang)}</div>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }

  const list = (items) =>
    `<ul style="margin:0; padding-left:17px; display:flex; flex-direction:column; gap:6px;">
      ${items.map(i => `<li class="ess-sub" style="line-height:1.5;">${i}</li>`).join('')}
    </ul>`;

  // Collapsible, so the procedural detail is one tap away instead of a wall of cards.
  const foldout = (title, body) => `
    <details class="ess-card" style="margin-bottom:8px;">
      <summary style="cursor:pointer; font-weight:700; font-size:13px;">${escapeHtml(title)}</summary>
      <div style="margin-top:10px;">${body}</div>
    </details>`;

  function render(main, emp) {
    const lang = essLang();
    const tx = TEXT[lang];

    main.innerHTML = `
      <div class="ess-section-title" style="margin-top:0;">${t('title_discipline')}</div>
      <div class="seg" id="seg-discipline-lang" style="margin-bottom:10px; display:flex;">
        <button type="button" data-lang="en" class="${lang === 'en' ? 'active' : ''}" style="flex:1;">English</button>
        <button type="button" data-lang="fil" class="${lang === 'fil' ? 'active' : ''}" style="flex:1;">Filipino</button>
      </div>
      <div class="ess-sub" style="margin-bottom:12px; line-height:1.5;">
        <strong>${escapeHtml(tx.edition)}.</strong> ${escapeHtml(tx.intro)}
      </div>

      <a id="btn-open-pdf" href="${PDF[lang] || PDF.en}" target="_blank" rel="noopener"
         style="display:flex; align-items:center; gap:11px; text-decoration:none;
                background:var(--bg-card); border:1px solid var(--border-soft);
                border-left:3px solid var(--blue,#2563eb); border-radius:12px;
                padding:12px 13px; margin-bottom:16px;">
        <span style="font-size:21px; line-height:1;">📄</span>
        <span style="flex:1;">
          <span style="display:block; font-size:13.5px; font-weight:700; color:var(--blue,#2563eb);">${escapeHtml(tx.openPdf)}</span>
          <span class="ess-sub" style="display:block; margin-top:2px; line-height:1.4;">${escapeHtml(tx.openPdfSub)}</span>
        </span>
      </a>

      <div class="ess-card" style="margin-bottom:16px;">
        <div class="ess-card-label">${escapeHtml(tx.classesTitle)}</div>
        ${classLegendHtml(lang)}
        <div class="ess-sub" style="margin-top:9px; line-height:1.5;">${escapeHtml(tx.classNote)}</div>
      </div>

      <div class="ess-section-title">${escapeHtml(tx.offensesTitle)}</div>
      <div class="ess-sub" style="margin-bottom:9px;">${escapeHtml(tx.offensesSub)}</div>
      ${Store.disciplineCatalog().map(cat => categorySectionHtml(cat, lang)).join('')}

      <div class="ess-section-title">${escapeHtml(tx.knowTitle)}</div>
      ${foldout(tx.askedTitle, list(tx.asked))}
      ${foldout(tx.rightsTitle, list(tx.rights))}
      ${foldout(tx.reportTitle, `
        <div class="ess-sub" style="line-height:1.5;">${tx.reportBody}</div>
        <div style="margin-top:10px; padding:9px 11px; border-radius:9px; background:rgba(248,113,113,0.10);">
          <div class="ess-sub" style="line-height:1.5;">${tx.reportWarn}</div>
        </div>`)}
      ${foldout(tx.attendanceTitle, `<div class="ess-sub" style="line-height:1.5;">${tx.attendanceBody}</div>`)}
      ${foldout(tx.repeatTitle, `<div class="ess-sub" style="line-height:1.5;">${tx.repeatBody}</div>`)}

      <div class="ess-sub" style="margin:15px 0 4px 0; line-height:1.5; opacity:0.85;">${escapeHtml(tx.disclaimer)}</div>
    `;

    // The Filipino edition may not be published yet. Check before navigating rather than
    // dropping the employee on a 404, and fall back to the English one.
    const pdfLink = qs('#btn-open-pdf', main);
    if (pdfLink && lang === 'fil') {
      pdfLink.addEventListener('click', async (ev) => {
        ev.preventDefault();
        let href = PDF.fil;
        try {
          const res = await fetch(PDF.fil, { method: 'HEAD' });
          if (!res.ok) throw new Error('not published');
        } catch (e) {
          toast(tx.pdfMissing);
          href = PDF.en;
        }
        window.open(href, '_blank', 'noopener');
      });
    }

    qsa('#seg-discipline-lang button', main).forEach(b => b.addEventListener('click', () => {
      setEssLang(b.dataset.lang);
      render(main, emp);
    }));
  }

  return { render };
})();
