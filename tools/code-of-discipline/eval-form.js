// Annex H -- Monthly Performance Evaluation, and the five trade sheets under it.
//
// ONE builder, called by annex.js with 'en' and by fil-annex.js with 'fil'. The criteria
// live here in both languages side by side, and assertSymmetry() fails the build if a
// trade gains a criterion in one language and not the other -- the two editions of this
// Code have to grade the same things.
//
// Where this sits in the Code:
//
//   - Sec. 4.8 already makes it a Class A offense for a supervisor to fail "to conduct,
//     document or discuss the required performance evaluations of subordinates". The duty
//     existed; this is the instrument for it.
//   - Sec. 6.2 governs what an evaluation is FOR. Its formal cycle is semi-annual (months
//     3 and 5 for probationary employees), so this monthly sheet is written as the
//     supervisor's monthly assessment that feeds that formal review -- not as a
//     replacement for it, which would quietly contradict 6.2 and multiply by six a duty
//     whose breach is a disciplinary offense.
//   - Sec. 6.2 is also emphatic that poor performance is NOT misconduct: the response to a
//     low rating is coaching and, if it persists, a written Performance Improvement Plan of
//     at least sixty days -- never a penalty. The form says so on its face, because the
//     form is where a supervisor is most tempted to blur the two.
const L = require('./lib.js');
const { d, C, W, run, gap, table, cell, tCell, note, thin, noBorder } = L;

// ---------------------------------------------------------------- criteria
// Five common criteria for every trade, then five for the trade itself. Ten criteria,
// scored 1-5, so the sheet totals out of 50 and the bands below divide cleanly.
const COMMON = {
  en: [
    'Attendance and punctuality — reports on time, completes the shift, files leave properly',
    'Safety and PPE — wears the prescribed protective equipment and follows toolbox and site safety rules',
    'Care of tools, materials and company property — kept in condition, returned, not wasted',
    'Conduct and teamwork — courteous to clients and co-workers, follows lawful instructions',
    'Reporting — time records, service reports and job orders submitted complete and on time',
  ],
  fil: [
    'Attendance at pagiging maagap — pumapasok sa oras, binubuo ang shift, tama ang pag-file ng leave',
    'Kaligtasan at PPE — suot ang kinakailangang protective equipment, sinusunod ang toolbox at patakaran sa site',
    'Pag-aalaga sa kagamitan, materyales, at ari-arian ng kompanya — maayos ang kalagayan, naisasauli, walang aksaya',
    'Asal at pakikipagtulungan — magalang sa kliyente at kasamahan, sumusunod sa legal na utos',
    'Pag-uulat — kumpleto at nasa oras ang time record, service report, at job order',
  ],
};

const TRADES = [
  {
    key: 'engineer', code: 'CD-08a',
    en: { name: 'Engineer', items: [
      'Technical accuracy — load computation, equipment selection, and diagnosis of system faults',
      'Job planning — materials take-off, manpower and schedule that hold up on site',
      'Site supervision — briefs the crew, checks the work against the plan, coordinates with the client',
      'Documentation — service reports, job orders and as-built records complete, correct and on time',
      'Resolution quality — the fix holds; few callbacks or reworks on jobs certified as finished',
    ] },
    fil: { name: 'Inhinyero', items: [
      'Teknikal na kawastuhan — kompyutasyon ng load, pagpili ng equipment, at pagtukoy sa sira ng sistema',
      'Pagpaplano ng trabaho — take-off ng materyales, tauhan, at iskedyul na kayang tuparin sa site',
      'Pangangasiwa sa site — binibriefing ang crew, sinusuri ang gawa laban sa plano, nakikipag-ugnayan sa kliyente',
      'Dokumentasyon — kumpleto, tama, at nasa oras ang service report, job order, at as-built',
      'Kalidad ng solusyon — tumatagal ang ayos; kakaunti ang balik-tawag o rework sa trabahong pinatunayan niyang tapos',
    ] },
  },
  {
    key: 'welder', code: 'CD-08b',
    en: { name: 'Welder', items: [
      'Weld quality — penetration, bead appearance, free of porosity, undercut and cracks',
      'Leak-tightness — joints pass pressure and leak testing; rework rate on own joints',
      'Process and consumables — correct rod, filler, gas and machine settings for the material',
      'Fit-up and preparation — alignment, cleaning, purging and joint preparation before welding',
      'Hot-work safety — permit, fire watch, screens, ventilation, and correct cylinder handling',
    ] },
    fil: { name: 'Welder', items: [
      'Kalidad ng hinang — lalim ng tagos, itsura ng bead, walang porosity, undercut, o bitak',
      'Walang tagas — pasado ang joint sa pressure at leak test; gaano kadalas ang rework sa sarili niyang joint',
      'Proseso at konsumibles — tamang rod, filler, gas, at setting ng makina para sa materyal',
      'Fit-up at paghahanda — pagkakahanay, paglilinis, purging, at paghahanda ng joint bago maghinang',
      'Kaligtasan sa hot work — permit, fire watch, harang, bentilasyon, at tamang paghawak ng tangke',
    ] },
  },
  {
    key: 'driver', code: 'CD-08c',
    en: { name: 'Driver', items: [
      'Safe driving — no accident, traffic violation or complaint arising from driving this month',
      'Vehicle condition — pre-trip and post-trip checks done and logged; unit kept clean and roadworthy',
      'Schedule — crew transport, pickups and deliveries made on time and on the agreed route',
      'Care of load — tools, materials and refrigerant cylinders secured, upright and undamaged in transit',
      'Trip documents — trip tickets, fuel slips and delivery receipts complete, signed and turned in',
    ] },
    fil: { name: 'Drayber', items: [
      'Ligtas na pagmamaneho — walang aksidente, paglabag sa trapiko, o reklamong dulot ng pagmamaneho ngayong buwan',
      'Kalagayan ng sasakyan — nagagawa at naitatala ang pre-trip at post-trip check; malinis at ligtas patakbuhin',
      'Iskedyul — nasa oras at nasa napagkasunduang ruta ang sundo, hatid, at delivery',
      'Pag-iingat sa karga — nakasiguro, nakatayo, at walang sira ang kagamitan, materyales, at tangke ng refrigerant sa byahe',
      'Dokumento ng byahe — kumpleto, pirmado, at naisusumite ang trip ticket, fuel slip, at delivery receipt',
    ] },
  },
  {
    key: 'mason', code: 'CD-08d',
    en: { name: 'Mason', items: [
      'Accuracy — layout, level, plumb and dimensions of pads, plinths and foundations',
      'Mix and finish — correct proportion, proper curing, and quality of the finished surface',
      'Material efficiency — cement, sand, blocks and water used without avoidable waste',
      'Housekeeping — work area cleared daily, finished surfaces protected from damage',
      'Output — the scope completed against the target agreed for the period',
    ] },
    fil: { name: 'Mason', items: [
      'Kawastuhan — layout, level, plumb, at sukat ng pad, plinth, at pundasyon',
      'Halo at pagkakatapos — tamang proporsyon, wastong curing, at kalidad ng natapos na bahagi',
      'Tipid sa materyales — nagagamit ang semento, buhangin, hollow block, at tubig nang walang aksaya',
      'Kalinisan ng lugar — nalilinis araw-araw ang paligid, naiingatan ang mga tapos nang bahagi',
      'Produksyon — natatapos ang saklaw ayon sa target na napagkasunduan para sa panahong iyon',
    ] },
  },
  {
    key: 'electrician', code: 'CD-08e',
    en: { name: 'Electrician', items: [
      'Correct installation — wire sizing, terminations, torque and connections per the approved plan',
      'Code compliance — conforms to the Philippine Electrical Code and to the conditions of the permit',
      'Safe isolation — lockout/tagout, test-before-touch, and the correct PPE for the voltage worked on',
      'Panel work — labelling, neatness, and protective devices correctly rated and coordinated',
      'Fault finding — diagnoses accurately, repairs correctly, and the fault does not recur',
    ] },
    fil: { name: 'Elektrisyan', items: [
      'Tamang instalasyon — sukat ng wire, terminations, torque, at koneksyon ayon sa aprubadong plano',
      'Pagsunod sa code — naaayon sa Philippine Electrical Code at sa kondisyon ng permit',
      'Ligtas na pag-isolate — lockout/tagout, pag-test bago hawakan, at tamang PPE sa boltaheng ginagalawan',
      'Gawa sa panel — may label, maayos, at tama ang rating at koordinasyon ng mga protective device',
      'Paghahanap ng sira — tumpak ang diagnosis, tama ang ayos, at hindi na umuulit ang sira',
    ] },
  },
];

// The two editions must grade the same things. A criterion added to one language only is
// a silent divergence between the English and Filipino Codes, so fail the build instead.
function assertSymmetry() {
  if (COMMON.en.length !== COMMON.fil.length) {
    throw new Error('eval-form: the common criteria differ in count between en (' + COMMON.en.length + ') and fil (' + COMMON.fil.length + ')');
  }
  for (const t of TRADES) {
    if (t.en.items.length !== t.fil.items.length) {
      throw new Error('eval-form: trade "' + t.key + '" has ' + t.en.items.length + ' criteria in en and ' + t.fil.items.length + ' in fil');
    }
  }
}
assertSymmetry();

const MAX_SCORE = (COMMON.en.length + TRADES[0].en.items.length) * 5;

const T = {
  en: {
    annexTitle: 'Annex H  —  Monthly Performance Evaluation',
    sheetTitle: (n) => 'Annex H  —  Monthly Performance Evaluation: ' + n,
    intro: 'This sheet is completed by the immediate superior for each employee, once a month, and discussed with the employee. It is the monthly assessment that feeds the formal evaluation under Section 6.2 — it does not replace that evaluation, whose cycle stays semi-annual for regular employees and at the third and fifth month for probationary employees.',
    duty: 'Failure to conduct, document or discuss it is an offense of the supervisor under Section 4.8, not of the employee being rated.',
    scaleTitle: 'The rating scale',
    scale: [
      ['5', 'Outstanding', 'Consistently beyond what the job requires.'],
      ['4', 'Exceeds standard', 'Better than the standard most of the time.'],
      ['3', 'Meets standard', 'Does the job as the position requires.'],
      ['2', 'Needs improvement', 'Falls short; specific coaching is required.'],
      ['1', 'Below standard', 'Does not meet the requirement; action is required this month.'],
    ],
    bandsTitle: 'Total score and what follows from it',
    bands: [
      ['45 – 50', 'Outstanding', 'Record the strengths. Consider for advancement under Section 6.1.'],
      ['38 – 44', 'Exceeds standard', 'Discuss and record what is working.'],
      ['30 – 37', 'Meets standard', 'Discuss. No further action is required.'],
      ['20 – 29', 'Needs improvement', 'Write the specific coaching actions below and review them next month.'],
      ['10 – 19', 'Below standard', 'Start a written Performance Improvement Plan under Section 6.2.'],
    ],
    rulesTitle: 'Rules that govern this form',
    rules: [
      'A rating is not a penalty. Section 6.2: where performance falls below standard the response is a written Performance Improvement Plan of not less than sixty (60) days, with the support and training the Company will provide — never a disciplinary sanction.',
      'Misconduct is not graded here. Where the employee has committed an offense under Part IV, it goes through the Notice to Explain procedure in Section 3.6. Rating the same act down here as well does not make it a second offense, and no penalty may be imposed through this form.',
      'Two consecutive months at Needs improvement or lower start a Performance Improvement Plan under Section 6.2, whatever the totals were.',
      'Any single criterion scored 1 must be discussed and a specific action written on the sheet, whatever the total comes to.',
      'Safety scored 1 is re-briefed before the employee’s next shift. Where the act was a willful breach of a safety rule, that is Section 4.3 and is dealt with as discipline, separately from this sheet.',
      'The employee is entitled to see the completed sheet, to write comments on it, and to receive a copy (Section 6.2). Signing it means it was received and discussed — not that the employee agrees with it.',
    ],
    hdr: ['CRITERION', 'SCORE', 'REMARKS'],
    partA: 'PART A  —  COMMON TO ALL TRADES',
    partB: (n) => 'PART B  —  ' + n.toUpperCase(),
    total: 'TOTAL  (out of ' + MAX_SCORE + ')',
    overall: 'Overall rating (from the band table in Annex H):',
    fields: ['Employee name', 'Position / Trade', 'Site / Department', 'Month evaluated', 'Immediate superior'],
    supComments: 'Supervisor’s comments, and the specific coaching actions agreed for next month',
    empComments: 'Employee’s comments (optional — the employee may write here, or attach a separate sheet)',
    signLeft: 'Immediate superior — signature over printed name, date',
    signRight: 'Employee — signature over printed name, date (receipt and discussion, not agreement)',
    footer: 'File the signed original in the employee’s 201 file and give the employee a copy on the day it is discussed.',
  },
  fil: {
    annexTitle: 'Annex H  —  Buwanang Pagsusuri ng Performance',
    sheetTitle: (n) => 'Annex H  —  Buwanang Pagsusuri ng Performance: ' + n,
    intro: 'Ang papel na ito ay pinupunan ng immediate superior para sa bawat empleyado, minsan sa isang buwan, at pinag-uusapan kasama ang empleyado. Ito ang buwanang pagtataya na pinagbabatayan ng pormal na pagsusuri sa ilalim ng Seksyon 6.2 — hindi nito pinapalitan ang pagsusuring iyon, na nananatiling dalawang beses sa isang taon para sa regular na empleyado at sa ikatlo at ikalimang buwan para sa probationary.',
    duty: 'Ang hindi paggawa, hindi pagtatala, o hindi pagtalakay nito ay paglabag ng supervisor sa ilalim ng Seksyon 4.8 — hindi ng empleyadong sinusuri.',
    scaleTitle: 'Ang iskala ng pagmamarka',
    scale: [
      ['5', 'Natatangi', 'Palagiang lampas sa hinihingi ng trabaho.'],
      ['4', 'Lampas sa pamantayan', 'Mas mataas sa pamantayan sa halos lahat ng pagkakataon.'],
      ['3', 'Umaabot sa pamantayan', 'Nagagawa ang trabaho ayon sa hinihingi ng posisyon.'],
      ['2', 'Kailangang pagbutihin', 'May kulang; kailangan ng tiyak na coaching.'],
      ['1', 'Kulang sa pamantayan', 'Hindi naaabot ang hinihingi; may dapat gawin ngayong buwan.'],
    ],
    bandsTitle: 'Kabuuang puntos at ang susunod na hakbang',
    bands: [
      ['45 – 50', 'Natatangi', 'Itala ang mga kalakasan. Puwedeng isaalang-alang sa promotion sa ilalim ng Seksyon 6.1.'],
      ['38 – 44', 'Lampas sa pamantayan', 'Talakayin at itala kung ano ang gumagana.'],
      ['30 – 37', 'Umaabot sa pamantayan', 'Talakayin. Wala nang kailangang gawin.'],
      ['20 – 29', 'Kailangang pagbutihin', 'Isulat sa ibaba ang tiyak na coaching at balikan sa susunod na buwan.'],
      ['10 – 19', 'Kulang sa pamantayan', 'Simulan ang nakasulat na Performance Improvement Plan sa ilalim ng Seksyon 6.2.'],
    ],
    rulesTitle: 'Mga panuntunang sinusunod ng papel na ito',
    rules: [
      'Ang marka ay hindi parusa. Seksyon 6.2: kapag kulang ang performance, ang tugon ay nakasulat na Performance Improvement Plan na hindi bababa sa animnapung (60) araw, kasama ang tulong at training na ibibigay ng kompanya — hindi parusang disiplinaryo.',
      'Hindi rito minamarkahan ang paglabag. Kung may nagawang paglabag sa ilalim ng Bahagi IV, dumadaan iyon sa proseso ng Notice to Explain sa Seksyon 3.6. Ang pagbaba ng marka rito sa parehong gawa ay hindi nagiging pangalawang paglabag, at walang parusang puwedeng ipataw sa pamamagitan ng papel na ito.',
      'Dalawang magkasunod na buwan sa Kailangang pagbutihin pababa ay nagsisimula ng Performance Improvement Plan sa ilalim ng Seksyon 6.2, anuman ang kabuuang puntos.',
      'Ang anumang criterion na nabigyan ng 1 ay dapat talakayin at lagyan ng tiyak na hakbang sa papel, anuman ang kabuuan.',
      'Ang Kaligtasan na nabigyan ng 1 ay muling bibigyan ng briefing bago ang susunod na shift. Kung sinadyang paglabag sa panuntunan sa kaligtasan, Seksyon 4.3 iyon at hiwalay na hinaharap bilang disiplina.',
      'Karapatan ng empleyadong makita ang napunang papel, magsulat ng komento rito, at makatanggap ng kopya (Seksyon 6.2). Ang paglagda ay nangangahulugang natanggap at natalakay ito — hindi pagsang-ayon dito.',
    ],
    hdr: ['CRITERION', 'PUNTOS', 'PUNA'],
    partA: 'BAHAGI A  —  PARA SA LAHAT NG TRABAHO',
    partB: (n) => 'BAHAGI B  —  ' + n.toUpperCase(),
    total: 'KABUUAN  (mula sa ' + MAX_SCORE + ')',
    overall: 'Pangkalahatang marka (mula sa talaan ng banda sa Annex H):',
    fields: ['Pangalan ng empleyado', 'Posisyon / Trabaho', 'Site / Departamento', 'Buwang sinusuri', 'Immediate superior'],
    supComments: 'Komento ng supervisor, at ang tiyak na coaching na napagkasunduan para sa susunod na buwan',
    empComments: 'Komento ng empleyado (opsyonal — puwedeng dito sumulat, o maglakip ng hiwalay na papel)',
    signLeft: 'Immediate superior — pirma sa ibabaw ng nakalimbag na pangalan, petsa',
    signRight: 'Empleyado — pirma sa ibabaw ng nakalimbag na pangalan, petsa (pagtanggap at pagtalakay, hindi pagsang-ayon)',
    footer: 'Isampa ang pirmadong orihinal sa 201 file ng empleyado at bigyan siya ng kopya sa mismong araw ng pagtalakay.',
  },
};

// ---------------------------------------------------------------- layout
// Local copies of the small form helpers rather than importing annex.js, which would be
// circular. Kept deliberately compact: a trade sheet has to print on ONE page, because a
// supervisor fills one per employee per month.
const CW = [6300, 900, 2546];

const formHead = (title, code) => [
  L.pageBreakBefore(),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 20 },
    children: [run('TXTAIRE OPC', { size: 21, bold: true, color: C.navy }),
               run('   ·   Human Resources Department', { size: 18, color: C.grey })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 0 },
    children: [run('Form ' + code + '  |  Code of Discipline, Series 2, 2026 Edition', { size: 16, color: C.grey })],
  }),
  gap(110),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 160 },
    shading: { type: d.ShadingType.CLEAR, fill: C.blue, color: 'auto' },
    children: [run(title.toUpperCase(), { size: 24, bold: true, color: 'FFFFFF' })],
  }),
];

const fieldRow = (label) => new d.TableRow({ cantSplit: true,
  children: [
    cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(label, { size: 18, bold: true, color: C.navy })] }),
      { w: 2600, va: d.VerticalAlign.CENTER, pad: { top: 36, bottom: 36, left: 60, right: 60 } }),
    new d.TableCell({
      width: { size: 7146, type: d.WidthType.DXA },
      borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin('888888') },
      margins: { top: 36, bottom: 36, left: 60, right: 60 },
      verticalAlign: d.VerticalAlign.BOTTOM,
      children: [new d.Paragraph({ spacing: { after: 0 }, children: [run(' ', { size: 18 })] })],
    }),
  ],
});

const ruledLines = (n, label) => [
  new d.Paragraph({ spacing: { before: 120, after: 60 }, children: [run(label, { size: 18, bold: true, color: C.navy })] }),
  table(Array.from({ length: n }, () => new d.TableRow({ cantSplit: true,
    children: [new d.TableCell({
      width: { size: W, type: d.WidthType.DXA },
      borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin('AAAAAA') },
      margins: { top: 78, bottom: 78, left: 60, right: 60 },
      children: [new d.Paragraph({ spacing: { after: 0 }, children: [run(' ', { size: 18 })] })],
    })],
  })), [W], { borderless: true }),
];

const signRow = (left, right) => [
  gap(140),
  table([new d.TableRow({ cantSplit: true,
    children: [
      cell([
        new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 18 })] }),
        new d.Paragraph({ spacing: { after: 0 }, children: [run(left, { size: 15, color: C.grey })] }),
      ], { w: 4400, va: d.VerticalAlign.BOTTOM }),
      cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(' ')] }), { w: 946 }),
      cell([
        new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 18 })] }),
        new d.Paragraph({ spacing: { after: 0 }, children: [run(right, { size: 15, color: C.grey })] }),
      ], { w: 4400, va: d.VerticalAlign.BOTTOM }),
    ],
  })], [4400, 946, 4400], { borderless: true }),
];

const PAD = { top: 40, bottom: 40, left: 90, right: 90 };

const headerRow = (t) => new d.TableRow({ tableHeader: true, cantSplit: true,
  children: [
    tCell(t.hdr[0], { w: CW[0], bold: true, fill: C.blue, color: 'FFFFFF', size: 17, pad: PAD }),
    tCell(t.hdr[1], { w: CW[1], bold: true, fill: C.blue, color: 'FFFFFF', size: 17, align: d.AlignmentType.CENTER, pad: PAD }),
    tCell(t.hdr[2], { w: CW[2], bold: true, fill: C.blue, color: 'FFFFFF', size: 17, pad: PAD }),
  ],
});

const sectionRow = (label) => new d.TableRow({ cantSplit: true,
  children: [cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(label, { size: 16, bold: true, color: C.navy })] }),
    { w: W, span: 3, fill: 'EDF1F8', pad: PAD })],
});

const criterionRow = (n, text) => new d.TableRow({ cantSplit: true,
  children: [
    cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(n + '.  ', { size: 17, bold: true, color: C.grey }), run(text, { size: 17 })] }),
      { w: CW[0], va: d.VerticalAlign.TOP, pad: PAD }),
    cell(new d.Paragraph({ spacing: { after: 0 } }), { w: CW[1], pad: PAD }),
    cell(new d.Paragraph({ spacing: { after: 0 } }), { w: CW[2], pad: PAD }),
  ],
});

const totalRow = (t) => new d.TableRow({ cantSplit: true,
  children: [
    tCell(t.total, { w: CW[0], bold: true, fill: 'EDF1F8', size: 17, align: d.AlignmentType.RIGHT, pad: PAD }),
    cell(new d.Paragraph({ spacing: { after: 0 } }), { w: CW[1], fill: 'EDF1F8', pad: PAD }),
    cell(new d.Paragraph({ spacing: { after: 0 } }), { w: CW[2], fill: 'EDF1F8', pad: PAD }),
  ],
});

// ---------------------------------------------------------------- the annex
function tradeSheet(trade, lang) {
  const t = T[lang];
  const tr = trade[lang];
  const rows = [headerRow(t), sectionRow(t.partA)];
  COMMON[lang].forEach((c, i) => rows.push(criterionRow(i + 1, c)));
  rows.push(sectionRow(t.partB(tr.name)));
  tr.items.forEach((c, i) => rows.push(criterionRow(COMMON[lang].length + i + 1, c)));
  rows.push(totalRow(t));

  return [
    ...formHead(t.sheetTitle(tr.name), trade.code),
    table(t.fields.map(fieldRow), [2600, 7146], { borderless: true }),
    gap(120),
    table(rows, CW),
    new d.Paragraph({ spacing: { before: 130, after: 0 },
      children: [run(t.overall + '  ', { size: 18, bold: true, color: C.navy }),
                 run('______________________________', { size: 18 })] }),
    ...ruledLines(2, t.supComments),
    ...ruledLines(2, t.empComments),
    ...signRow(t.signLeft, t.signRight),
    new d.Paragraph({ spacing: { before: 120, after: 0 }, children: [run(t.footer, { size: 15, color: C.grey })] }),
  ];
}

function evalAnnex(lang) {
  const t = T[lang];
  const SW = [900, 2600, 6246];
  const scaleRow = (r, fill) => new d.TableRow({ cantSplit: true,
    children: [
      tCell(r[0], { w: SW[0], bold: true, align: d.AlignmentType.CENTER, size: 18, fill: fill, pad: PAD }),
      tCell(r[1], { w: SW[1], bold: true, size: 18, fill: fill, pad: PAD }),
      tCell(r[2], { w: SW[2], size: 18, fill: fill, pad: PAD }),
    ],
  });

  return [
    ...formHead(t.annexTitle, 'CD-08'),
    L.p(t.intro),
    L.p(t.duty, { after: 160 }),

    new d.Paragraph({ spacing: { before: 40, after: 80 }, children: [run(t.scaleTitle, { size: 20, bold: true, color: C.navy })] }),
    table(t.scale.map((r) => scaleRow(r)), SW),

    new d.Paragraph({ spacing: { before: 200, after: 80 }, children: [run(t.bandsTitle, { size: 20, bold: true, color: C.navy })] }),
    table(t.bands.map((r) => scaleRow(r)), SW),

    new d.Paragraph({ spacing: { before: 200, after: 80 }, children: [run(t.rulesTitle, { size: 20, bold: true, color: C.navy })] }),
    ...t.rules.map((r) => L.bullet(r)),

    ...TRADES.reduce((acc, trade) => acc.concat(tradeSheet(trade, lang)), []),
  ];
}

module.exports = { evalAnnex, TRADES, COMMON, MAX_SCORE };
