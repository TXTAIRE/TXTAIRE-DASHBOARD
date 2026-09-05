const L = require('./lib.js');
const { d, C, W, run, p, gap, pageBreakBefore, partHead, cell, tCell, table, note, thin, noBorder } = L;

const B = (t) => run(t, { bold: true });

const formHead = (title, code) => [
  pageBreakBefore(),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 20 },
    children: [run('TXTAIRE OPC', { size: 21, bold: true, color: C.navy }),
               run('   ·   Human Resources Department', { size: 18, color: C.grey })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 0 },
    children: [run('Form ' + code + '  |  Kodigo ng Disiplina, Series 2, 2026 Edition', { size: 16, color: C.grey })],
  }),
  gap(130),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 200 },
    shading: { type: d.ShadingType.CLEAR, fill: C.blue, color: 'auto' },
    children: [run(title.toUpperCase(), { size: 24, bold: true, color: 'FFFFFF' })],
  }),
];

const fld = (label, w2) => new d.TableRow({
  cantSplit: true,
  children: [
    cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(label, { size: 19, bold: true, color: C.navy })] }),
      { w: 2800, va: d.VerticalAlign.CENTER }),
    new d.TableCell({
      width: { size: w2 || 6946, type: d.WidthType.DXA },
      borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin('888888') },
      margins: { top: 62, bottom: 62, left: 60, right: 60 },
      verticalAlign: d.VerticalAlign.BOTTOM,
      children: [new d.Paragraph({ spacing: { after: 0 }, children: [run(' ', { size: 19 })] })],
    }),
  ],
});

const fieldBlock = (labels) => table(labels.map((l) => fld(l)), [2800, 6946], { borderless: true });

const ruled = (lines, label) => [
  ...(label ? [new d.Paragraph({ spacing: { before: 140, after: 80 }, children: [run(label, { size: 19, bold: true, color: C.navy })] })] : []),
  table(Array.from({ length: lines }, () => new d.TableRow({
    cantSplit: true,
    children: [new d.TableCell({
      width: { size: W, type: d.WidthType.DXA },
      borders: { top: noBorder, left: noBorder, right: noBorder, bottom: thin('AAAAAA') },
      margins: { top: 96, bottom: 96, left: 60, right: 60 },
      children: [new d.Paragraph({ spacing: { after: 0 }, children: [run(' ', { size: 19 })] })],
    })],
  })), [W], { borderless: true }),
];

const signBlock = (left, right) => [
  gap(170),
  table([new d.TableRow({
    cantSplit: true,
    children: [
      cell([
        new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
        new d.Paragraph({ spacing: { after: 0 }, children: [run(left, { size: 17, color: C.grey })] }),
      ], { w: 4400, va: d.VerticalAlign.BOTTOM }),
      cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(' ')] }), { w: 946 }),
      cell([
        new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
        new d.Paragraph({ spacing: { after: 0 }, children: [run(right, { size: 17, color: C.grey })] }),
      ], { w: 4400, va: d.VerticalAlign.BOTTOM }),
    ],
  })], [4400, 946, 4400], { borderless: true }),
];

const annexes = () => [
  ...partHead('MGA ANNEX', 'Mga Form at Sanggunian', 'new'),
  p('Ang mga form sa mga Annex na ito ang pamantayang form ng Human Resources Department. Puwede itong kopyahin at sagutan nang sulat-kamay o elektroniko. Hindi opsyonal ang paggamit nito: ang aksyong disiplinaryong itinala sa iba ay mas mahirap ipagtanggol, at ang Notice to Explain na kulang sa alinman sa nasa Annex A ay may depekto sa mata ng batas.', { keepNext: true }),
  p('Magkakasunod ang paggamit nila. Ang Annex A ang unang lumalabas; ang Annex B ang sagot ng empleyado; ang Annex C ay ibinibigay lamang kung magkakaroon ng pagdinig; ang Annex D ay papel na ginagamit ng Panel at hindi kailanman ibinibigay sa empleyado; ang Annex E ang nagsasara ng kaso at ibinibigay sa empleyado. Ang Annex F ay checklist sa pagpaplano para sa HRD at hindi form ng kaso, at ang Annex G ay pipirmahan nang minsan lamang, sa pagtanggap ng Code na ito, at isasampa sa 201 file.'),

  // ------------------------------------------------------------ ANNEX A
  ...formHead('Annex A  —  Notice to Explain', 'CD-01'),
  fieldBlock(['Reference No.', 'Petsa ng paglabas', 'Pangalan ng empleyado', 'Posisyon / Departamento', 'Superyor']),
  gap(120),
  p('Ikaw ay inaatasang magpaliwanag nang nakasulat kung bakit hindi ka dapat parusahan sa gawa o pagkukulang na nakasaad sa ibaba.'),
  ...ruled(2, '1.  Ang mismong gawa o pagkukulang (isulat ang ANO ang nagawa, at ang PETSA, ORAS, at LUGAR):'),
  ...ruled(2, '2.  Probisyon ng Kodigo ng Disiplina o patakarang nalabag (isulat ang bilang ng seksyon at ang paglabag):'),
  ...ruled(1, '3.  Uri ng paglabag at parusang isinasaalang-alang:'),
  gap(120),
  p([B('4.  Ang karapatan mong magpaliwanag. '), run('Kailangan mong magsumite ng nakasulat na paliwanag sa Human Resources Department sa loob ng limang (5) araw ng kalendaryo mula sa pagtanggap mo ng sulat na ito, ibig sabihin, hanggang ______________________. Puwede kang maglakip ng dokumento at magsabi ng testigo. Puwede kang tulungan ng kinatawan o abogadong ikaw mismo ang pumili, sa sarili mong gastos, at puwede kang humingi ng palugit nang nakasulat.')]),
  p([B('5.  Administrative conference. '), run('Magkakaroon ng pagdinig kung hihilingin mo ito, kung pinagtatalunan ang mga pangyayari, o kung isinasaalang-alang ang pagtanggal. Bibigyan ka ng nakasulat na abiso kahit tatlong (3) araw ng trabaho bago ito.')]),
  p([B('6.  Kung hindi ka sasagot. '), run('Kung hindi ka sasagot sa loob ng panahong ibinigay at hindi ka hihingi ng palugit, ipapasya ang kaso batay sa mga record na mayroon. Ang hindi pagsagot ay hindi mismo pag-amin ng kasalanan.')]),
  p([run('7.  Kung tatanggi ang empleyadong tumanggap o pumirma. ', { bold: true, size: 19 }), run('Itala ang pagtanggi sa ibaba sa harap ng saksi, at magpadala ng kopya sa huling kilalang address ng empleyado sa pamamagitan ng registered mail o courier.', { size: 19 })], { after: 40 }),
  ...ruled(1),
  ...signBlock('Inilabas ng (HRD) — Pirma sa ibabaw ng nakalimbag na pangalan', 'Tinanggap ng (Empleyado) — Pirma at petsa'),

  // ------------------------------------------------------------ ANNEX B
  ...formHead('Annex B  —  Nakasulat na Paliwanag ng Empleyado', 'CD-02'),
  fieldBlock(['NTE Reference No.', 'Petsa ng sagot na ito', 'Pangalan ng empleyado', 'Posisyon / Departamento']),
  gap(200),
  ...ruled(10, 'Ang paliwanag ko (isulat ang panig mo sa mga pangyayari; maglakip ng dagdag na papel at dokumento kung kailangan):'),
  gap(160),
  ...ruled(1, 'Mga dokumentong nakalakip:'),
  ...ruled(1, 'Mga testigong nais kong iharap (pangalan at kung ano ang sasabihin ng bawat isa):'),
  gap(160),
  table([new d.TableRow({
    cantSplit: true,
    children: [cell([
      new d.Paragraph({ spacing: { after: 60 }, children: [run('Pakisaad:', { size: 19, bold: true, color: C.navy })] }),
      new d.Paragraph({ spacing: { after: 40 }, children: [run('[   ]   Humihiling ako ng administrative conference.', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 40 }, children: [run('[   ]   Hindi ako humihiling ng pagdinig at isinusumite ko ang usapin sa nakasulat na paliwanag na ito.', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 0 }, children: [run('[   ]   Tutulungan ako ng kinatawan o abogado:  ______________________________', { size: 19 })] }),
    ], { w: W, fill: 'F4F7FC', va: d.VerticalAlign.TOP })],
  })], [W]),
  ...signBlock('Empleyado — Pirma sa ibabaw ng nakalimbag na pangalan', 'Petsa at oras ng pagtanggap ng HRD'),

  // ------------------------------------------------------------ ANNEX C
  ...formHead('Annex C  —  Abiso ng Administrative Conference', 'CD-03'),
  fieldBlock(['NTE Reference No.', 'Petsa ng paglabas', 'Pangalan ng empleyado', 'Posisyon / Departamento', 'Petsa ng pagdinig', 'Oras', 'Lugar']),
  gap(200),
  p('Magkakaroon ng administrative conference sa petsa, oras, at lugar na nakasaad sa itaas kaugnay ng Notice to Explain na nabanggit. Sa pagdinig, bibigyan ka ng pagkakataong ipaliwanag ang panig mo, magharap ng dokumento at testigo, at sumagot sa mga tanong tungkol sa usapin.'),
  p('Puwede kang tulungan ng kinatawan o abogadong ikaw mismo ang pumili, sa sarili mong gastos. Dalhin ang anumang dokumentong nais mong isaalang-alang ng panel.'),
  p('Hindi ipinapatupad dito ang teknikal na alituntunin sa ebidensya. Kung hindi ka makakadalo sa nakatakdang petsa sa makatuwirang dahilan, ipaalam sa HRD nang nakasulat bago ang iskedyul para maisaayos ito. Kung hindi ka dadalo at walang ibinigay na dahilan, ipapasya ang kaso batay sa mga record.'),
  gap(160),
  ...(() => {
    const PW = [3400, 6346];
    return [table([
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('PANEL / MGA OPISYAL NA DUMALO', { w: PW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('PANGALAN AT POSISYON', { w: PW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...['Chair (HR Head)', 'Miyembro (Department Head)', 'Miyembro (kapantay ng inirereklamo)', 'Tagatala'].map((r) => new d.TableRow({
        cantSplit: true,
        children: [tCell(r, { w: PW[0], bold: true, color: C.navy }), tCell('', { w: PW[1] })],
      })),
    ], PW)];
  })(),
  ...signBlock('Inilabas ng (HRD)', 'Tinanggap ng (Empleyado) — Pirma at petsa'),

  // ------------------------------------------------------------ ANNEX D
  ...formHead('Annex D  —  Case Evaluation Form', 'CD-04'),
  fieldBlock(['Case / NTE Reference No.', 'Pangalan ng empleyado', 'Posisyon / Departamento', 'Petsa ng pangyayari', 'Petsa ng NTE', 'Petsa ng pagtanggap ng paliwanag', 'Petsa ng pagdinig']),
  gap(200),
  ...ruled(2, '1.  Natuklasang pangyayari (kung ano ang natuklasan ng panel na talagang nangyari, at sa anong ebidensya):'),
  ...ruled(1, '2.  Probisyon ng Kodigo na nalabag, at uri ng paglabag:'),
  ...ruled(1, '3.  Ang paliwanag ng empleyado, at kung tinanggap ba ito — kasama ang dahilan kung bakit oo o hindi:'),
  ...ruled(1, '4.  Naunang record sa loob ng nakaraang labindalawang (12) buwan (ilista ang bawat parusa at petsa; isulat ang "wala" kung wala):'),
  gap(160),
  ...(() => {
    const MW = [4873, 4873];
    return [table([
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('5.  Mga pampagaan na isinaalang-alang (Sek. 3.5)', { w: MW[0], bold: true, color: 'FFFFFF', fill: '4C8C2B', size: 18 }),
          tCell('6.  Mga pampabigat na isinaalang-alang (Sek. 3.5)', { w: MW[1], bold: true, color: 'FFFFFF', fill: 'A8342A', size: 18 }),
        ],
      }),
      new d.TableRow({
        cantSplit: true,
        children: [
          cell(Array.from({ length: 2 }, () => new d.Paragraph({ spacing: { after: 120 }, border: { bottom: thin('AAAAAA') }, children: [run(' ', { size: 19 })] })), { w: MW[0], va: d.VerticalAlign.TOP }),
          cell(Array.from({ length: 2 }, () => new d.Paragraph({ spacing: { after: 120 }, border: { bottom: thin('AAAAAA') }, children: [run(' ', { size: 19 })] })), { w: MW[1], va: d.VerticalAlign.TOP }),
        ],
      }),
    ], MW)];
  })(),
  gap(160),
  ...ruled(1, '7.  Parusa sa ilalim ng talaan (Sek. 3.4), at inirerekomendang parusa kung iba — kasama ang dahilan ng pagkakaiba:'),
  ...ruled(1, '8.  Pagbabayad ng pinsala, kung mayroon, at kung nagbigay ba ang empleyado ng nakasulat na pahintulot sa bawas (Sek. 3.12):'),
  gap(110),
  ...(() => {
    const SW = [3050, 300, 3046, 300, 3050];
    const sig = (label) => cell([
      new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 0 }, children: [run(label, { size: 16, color: C.grey })] }),
    ], { w: 3050, va: d.VerticalAlign.BOTTOM });
    const sp = () => cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(' ')] }), { w: 300 });
    return [table([new d.TableRow({
      cantSplit: true,
      children: [sig('Panel Chair'), sp(), sig('Miyembro'), sp(), sig('Miyembro')],
    })], SW, { borderless: true })];
  })(),
  new d.Paragraph({
    spacing: { before: 150, after: 0, line: 400 },
    border: { bottom: thin('AAAAAA') },
    children: [run('Aksyon ng May-ari / General Manager:', { size: 19, bold: true, color: C.navy })],
  }),

  // ------------------------------------------------------------ ANNEX E
  ...formHead('Annex E  —  Notice of Decision', 'CD-05'),
  fieldBlock(['Case / NTE Reference No.', 'Petsa ng paglabas', 'Pangalan ng empleyado', 'Posisyon / Departamento']),
  gap(120),
  p('Matapos isaalang-alang ang Notice to Explain na may petsang ______________, ang nakasulat mong paliwanag na may petsang ______________, ang administrative conference noong ______________, at ang ebidensyang nasa record, narito ang naging pasya ng kompanya.'),
  ...ruled(2, '1.  Natuklasan:'),
  ...ruled(1, '2.  Probisyon ng Kodigo ng Disiplina na nalabag:'),
  ...ruled(2, '3.  Bakit tinanggap / hindi tinanggap ang paliwanag mo:'),
  gap(160),
  ...(() => {
    const DW = [3200, 6546];
    return [table([
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('PARUSANG IPINATAW', { w: DW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('DETALYE', { w: DW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...[
        ['[   ]  Walang parusa — ibinasura ang kaso', ''],
        ['[   ]  Bibig na Babala', ''],
        ['[   ]  Sulat na Babala', ''],
        ['[   ]  Suspensyon', 'Bilang ng araw ng trabaho: ________   Mula: ____________  Hanggang: ____________'],
        ['[   ]  Pagtanggal', 'Petsa ng bisa ng paghihiwalay: ________________________'],
      ].map((r) => new d.TableRow({
        cantSplit: true,
        children: [tCell(r[0], { w: DW[0], bold: true }), tCell(r[1], { w: DW[1] })],
      })),
    ], DW)];
  })(),
  gap(200),
  p([B('Ang karapatan mong mag-apela. '), run('Puwede kang humingi ng muling pagsusuri sa pasyang ito sa pamamagitan ng nakasulat na Letter of Appeal sa Human Resources Department sa loob ng limang (5) araw ng kalendaryo mula sa pagtanggap mo nito, na nagsasaad ng mga dahilan at may kalakip na bagong ebidensya. Reresolbahin ito nang nakasulat sa loob ng labinlimang (15) araw ng kalendaryo. Walang anuman sa sulat na ito ang naglilimita sa karapatan mong dalhin ang usapin sa Department of Labor and Employment o sa kahit anong tanggapang may hurisdiksyon.')]),
  ...signBlock('Inaprubahan ng (May-ari / General Manager)', 'Tinanggap ng (Empleyado) — Pirma at petsa'),

  // ------------------------------------------------------------ ANNEX F
  ...formHead('Annex F  —  Checklist sa Pagsunod Habang Lumalaki ang Bilang ng Tauhan', 'CD-06'),
  p('May mga obligasyong legal na nabubuksan ayon sa bilang ng tauhan, at inaasahang lalago ang kompanya mula sa mga dalawampu (20) tungo sa mga isandaan (100) sa loob ng susunod na taon. Checklist ito para sa pagpaplano ng HRD. Buod ito at hindi kapalit ng mismong mga kautusan; kumpirmahin ang kasalukuyang hangganan sa DOLE Regional Office bago ang bawat milestone.', { after: 100 }),
  ...(() => {
    const CW = [1500, 4400, 3846];
    const PAD = { top: 26, bottom: 26, left: 80, right: 80 };
    const rows = [
      ['Kahit ilan', 'Irehistro ang establisimyento sa DOLE (Rule 1020); magkaroon ng OSH program; magbigay ng libreng PPE; magtago ng logbook ng aksidente; i-report ang aksidente at sakit.', 'RA 11058 / DO 198-18'],
      ['Kahit ilan', 'Bumuo ng Committee on Decorum and Investigation; ipaskil nang hayag ang patakaran laban sa sexual harassment; magsagawa ng gender sensitivity orientation.', 'RA 7877 / RA 11313'],
      ['Kahit ilan', 'Gumawa at ipaskil ang patakaran at programa sa HIV at AIDS, tuberculosis, Hepatitis B, lugar na walang droga, at mental health.', 'RA 11166, DO 73-05, DO 05-10, DO 53-03, RA 11036'],
      ['Kahit ilan', 'Magbigay ng lactation station at lactation break; magpanatili ng kinakailangang first aid kit.', 'RA 10028'],
      ['Kahit ilan', 'Magparehistro sa SSS, PhilHealth, at Pag-IBIG; ipasa ang kontribusyon sa oras; magbigay ng payslip na may detalye.', 'Batas ng SSS, PhilHealth, HDMF'],
      ['10 pataas', 'Magtalaga ng kahit isang sertipikadong first-aider at sanay na Safety Officer 1; kumpletuhin ng lahat ng manggagawa ang sapilitang 8-oras na OSH seminar.', 'DO 198-18'],
      ['10 pataas', 'Ipaskil ang Kodigo ng Disiplina at iba pang alituntunin kung saan mababasa ng mga empleyado; itago ang record ng trabaho sa lugar ng trabaho.', 'Labor Code, Rule X'],
      ['11 hanggang 50', 'Bumuo ng Health and Safety Committee; magtalaga ng Safety Officer 2 kung mataas ang panganib sa lugar ng trabaho (kuryente, mataas na lugar, confined space — saklaw nito ang karamihan ng trabaho natin sa field).', 'DO 198-18'],
      ['21 pataas', 'Kumuha ng part-time na occupational health physician at nurse, o ayusin ang kinakailangang retainer at referral kung mababa ang panganib.', 'OSHS Rule 1960'],
      ['50 pataas', 'Kumuha ng full-time na Safety Officer 2 (o mas mataas, ayon sa panganib); palakihin ang Health and Safety Committee; magpanatili ng treatment room o klinika ayon sa uri ng panganib.', 'DO 198-18 / OSHS Rule 1960'],
      ['51 pataas', 'Isaalang-alang ang pormal na grievance machinery at nakasulat na istruktura ng sahod; suriin kung may unyon ng rank-and-file na maaaring humingi ng pagkilala at ihanda ang HR dito.', 'Labor Code, Book V'],
      ['100 pataas', 'Kumuha ng full-time na safety officer at, ayon sa uri ng panganib, full-time na occupational health nurse; magpanatili ng emergency clinic; palawakin ang Family Welfare Program.', 'DO 198-18 / OSHS'],
      ['200 pataas', 'Magtatag ng Family Welfare Program na may itinalagang coordinator; suriin ang pangangailangan ng full-time na doktor at dentista.', 'DOLE Family Welfare Program'],
    ];
    return [table([
      new d.TableRow({
        cantSplit: true, tableHeader: true,
        children: [
          tCell('BILANG', { w: CW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 17, align: d.AlignmentType.CENTER }),
          tCell('ANO ANG DAPAT MERON', { w: CW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
          tCell('BATAYAN', { w: CW[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({
        cantSplit: true,
        children: [
          tCell(r[0], { w: CW[0], bold: true, color: C.navy, align: d.AlignmentType.CENTER, va: d.VerticalAlign.TOP, size: 17, pad: PAD, line: 215 }),
          tCell(r[1], { w: CW[1], va: d.VerticalAlign.TOP, size: 17, pad: PAD, line: 215 }),
          tCell(r[2], { w: CW[2], va: d.VerticalAlign.TOP, size: 16, italics: true, pad: PAD, line: 215 }),
        ],
      })),
    ], CW)];
  })(),
  gap(120),
  note('Dalawang bagay bago umabot sa limampu ang bilang', [
    'Una, magtalaga at magsanay ng Safety Officer ngayon pa lang at huwag hintayin ang hangganan. Matagal ang sertipikasyon, at mataas ang panganib ng trabaho natin sa field — kuryente, refrigerant na may presyon, at trabaho sa bubong at mataas na lugar — anuman ang bilang ng tauhan.',
    'Pangalawa, ayusin nang maayos ang Administrative Review Panel. Sa dalawampung empleyado, madalas na iisang tatlong tao ang Panel. Sa isandaan, kailangang posibleng bumuo ng Panel na walang sinumang may interes sa kaso. Tukuyin at sanayin ang pool ng kahit anim na posibleng miyembro.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  // ------------------------------------------------------------ ANNEX G
  ...formHead('Annex G  —  Pagkilala at Pagsang-ayon ng Empleyado', 'CD-07'),
  gap(200),
  p('Kinikilala ko na nakatanggap ako ng kopya ng TXTAIRE OPC Kodigo ng Disiplina, Series 2, 2026 Edition.'),
  p('Kinukumpirma ko na ipinaliwanag sa akin ang nilalaman nito, na nagkaroon ako ng pagkakataong magtanong tungkol sa anumang probisyong hindi ko naintindihan, at nasagot ang mga tanong ko.'),
  p('Naiintindihan ko na nakasaad sa Kodigong ito ang pamantayang etikal ng kompanya, ang asal na inaasahan sa akin, ang mga paglabag na kinikilala ng kompanya at ang kaukulang parusa, at ang prosesong susundin ng kompanya bago ipataw sa akin ang anumang parusa.'),
  p('Naiintindihan ko na may karapatan akong makatanggap ng nakasulat na paunawa ng anumang bintang laban sa akin, ng kahit limang (5) araw ng kalendaryo para sumagot nang nakasulat, na marinig, na tulungan ng kinatawan o abogadong ako mismo ang pumili, at na mag-apela sa anumang pasya.'),
  p('Naiintindihan ko na magkakabisa ang Kodigong ito tatlumpung (30) araw mula sa pamamahagi nito, na pinapalitan nito ang buong Series 1, 2025 Edition, at na puwede itong baguhin ng kompanya nang nakasulat, basta walang pagbabagong magbabawas ng benepisyong tinatamasa ko na o ilalapat nang paurong sa nagawa ko na.'),
  p('Naiintindihan ko na kung may probisyon ng Kodigong ito na salungat sa Labor Code ng Pilipinas, sa Implementing Rules nito, o sa kautusan ng DOLE, ang batas ang masusunod.'),
  gap(300),
  ...(() => {
    const AW = [4873, 4873];
    return [table([new d.TableRow({
      cantSplit: true,
      children: [
        cell([
          new d.Paragraph({ spacing: { after: 300 }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 20 }, children: [run('Empleyado — Pirma sa ibabaw ng nakalimbag na pangalan', { size: 17, color: C.grey })] }),
          new d.Paragraph({ spacing: { after: 0 }, children: [run('Posisyon / Departamento: ______________________', { size: 17, color: C.grey })] }),
        ], { w: AW[0], va: d.VerticalAlign.TOP }),
        cell([
          new d.Paragraph({ spacing: { after: 300 }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 20 }, children: [run('Tinanggap at sinaksihan ng (HRD)', { size: 17, color: C.grey })] }),
          new d.Paragraph({ spacing: { after: 0 }, children: [run('Petsa: ______________________', { size: 17, color: C.grey })] }),
        ], { w: AW[1], va: d.VerticalAlign.TOP }),
      ],
    })], AW, { borderless: true })];
  })(),
  gap(400),
  note('Para sa HRD', [
    'Isampa ang pirmadong orihinal sa 201 file ng empleyado. Bigyan ang empleyado ng kopya ng pahinang ito kasama ng kopya niya ng Kodigo. Itala ang petsa ng pamamahagi sa talaan ng HRD — doon nagsisimula ang tatlumpung araw na bisa, at doon din nakasalalay ang kakayahan ng kompanyang patunayang talagang naipaalam ang Kodigo.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),
];

module.exports = { annexes };
