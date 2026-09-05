const L = require('./lib.js');
const { d, C, W, img, run, p, bullet, gap, pageBreak, secHead, cell, tCell, table, note } = L;
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- PABALAT
const cover = () => [
  gap(120),
  new d.Paragraph({
    spacing: { after: 0 },
    children: [
      new d.ImageRun({
        type: 'jpg',
        data: fs.readFileSync(path.join(L.A, 'logo_cover.jpg')),
        transformation: { width: 168, height: 85 },
      }),
      new d.TextRun({
        children: [new d.PositionalTab({
          alignment: d.PositionalTabAlignment.RIGHT,
          relativeTo: d.PositionalTabRelativeTo.MARGIN,
          leader: d.PositionalTabLeader.NONE,
        })],
      }),
      run('————————  ', { size: 26, bold: true, color: C.gold }),
      run('2026', { size: 26, bold: true, color: '333333' }),
    ],
  }),

  gap(700),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 120 },
    children: [run('TXTAIRE OPC', { size: 72, bold: true, color: '1A1A1A' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
    children: [run('KODIGO', { size: 84, bold: true, color: '2C6FD6' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
    children: [run('NG', { size: 40, bold: true, color: 'C89211' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 60 },
    children: [run('DISIPLINA', { size: 84, bold: true, color: '2E7D32' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 80 },
    children: [run('Series 2, 2026 Edition', { size: 26, bold: true, color: '1A1A1A' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 300 },
    // Dapat matukoy agad ang pagkakaiba ng dalawang dokumento, kahit nakalimbag lang.
    children: [run(L.pick('Salin sa Filipino', 'Salin sa Filipino  ·  Kopya ng Empleyado'), { size: 22, color: '5A5A5A' })],
  }),

  img('cover.jpg', 470, 314),
  pageBreak(),
];

// ------------------------------------------------------- MISYON / BISYON
const missionVision = () => [
  img('band.jpg', 470, 116),
  gap(240),
  new d.Paragraph({
    spacing: { after: 220 },
    children: [run('Misyon at Bisyon.', { size: 48, bold: true, color: '1A1A1A' })],
  }),

  table([
    new d.TableRow({
      cantSplit: true,
      children: [cell([
        new d.Paragraph({ spacing: { after: 100 }, children: [run('MISYON', { size: 24, bold: true, color: 'F5C242' })] }),
        new d.Paragraph({
          alignment: d.AlignmentType.JUSTIFIED, spacing: { after: 0, line: 264 },
          children: [
            run('Nakatuon ang TXTAIRE Refrigeration and Air-Conditioning Services na makamit at mapanatili ang mataas na antas ng serbisyo sa pamamagitan ng ', { size: 20, color: 'FFFFFF' }),
            run('sipag at husay', { size: 20, bold: true, color: 'FFFFFF' }),
            run('. Gayundin, na makamit at mapanatili ang matagalan at maayos na relasyon sa mga kliyente at sa lugar ng trabaho.', { size: 20, color: 'FFFFFF' }),
          ],
        }),
      ], { w: W, fill: C.blue, va: d.VerticalAlign.TOP })],
    }),
  ], [W], { borderless: true }),

  gap(260),
  new d.Paragraph({ spacing: { after: 100 }, children: [run('BISYON', { size: 24, bold: true, color: 'C89211' })] }),
  p([
    run('Ang buong paghahangad naming maglingkod sa kapwa ay nakasalalay sa integridad ng lahat ng bahagi ng kompanya. Naniniwala rin kami na ang panawagan ng lipunan ngayon ay magkaroon ang bawat tao ng katarungan at pantay na pagkakataong makilahok sa pagbuo ng Bansa. Dahil dito, kinikilala at inaatasan ang aming kompanya para sa aming ', { size: 20 }),
    run('sipag, determinasyon, at dedikasyon sa tungkulin', { size: 20, bold: true, color: C.green }),
    run('.', { size: 20 }),
  ], { after: 260 }),

  table([
    new d.TableRow({
      cantSplit: true,
      children: [cell([
        new d.Paragraph({ spacing: { after: 100 }, children: [run('MGA PAGPAPAHALAGA', { size: 24, bold: true, color: 'F5C242' })] }),
        new d.Paragraph({
          alignment: d.AlignmentType.JUSTIFIED, spacing: { after: 160, line: 264 },
          children: [run('Para makamit ang misyon at bisyon nito, kailangang isabuhay ng kompanya ang mga ito sa pamamagitan ng mga pagpapahalagang isinasagawa nito, habang nagbibigay ng dekalidad na serbisyo.', { size: 20, color: 'FFFFFF' })],
        }),
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
          children: [run('RESPETO   •   PAGKAKAISA   •   DEDIKASYON   •   INOBASYON   •   KATAPATAN SA KOMPANYA   •   KATAPATAN', { size: 19, bold: true, color: 'FFFFFF' })],
        }),
      ], { w: W, fill: C.blue, va: d.VerticalAlign.TOP })],
    }),
  ], [W], { borderless: true }),

  pageBreak(),
];

// ------------------------------------------------------------ CONTROL SHEET
const controlSheet = () => {
  const CW = [1900, 3100, 1900, 2846];
  const r = (a, b, c, e) => new d.TableRow({
    cantSplit: true,
    children: [
      tCell(a, { w: CW[0], bold: true, fill: 'EDF1F8' }),
      tCell(b, { w: CW[1], bold: true }),
      tCell(c, { w: CW[2], bold: true, fill: 'EDF1F8' }),
      tCell(e, { w: CW[3], bold: true }),
    ],
  });
  return [
    new d.Paragraph({
      alignment: d.AlignmentType.CENTER, spacing: { after: 60 },
      children: [run('TXTAIRE OPC', { size: 30, bold: true })],
    }),
    new d.Paragraph({
      alignment: d.AlignmentType.CENTER, spacing: { after: 220 },
      children: [run('OPERATIONS MANUAL', { size: 24, bold: true })],
    }),
    table([
      r('Kabanata', 'PERSONNEL', 'Entry No.', 'A-01'),
      r('Seksyon', 'DISIPLINA', 'Annex', 'A'),
      r('Pamagat', 'KODIGO NG DISIPLINA', 'Edisyon', 'Series 2, 2026'),
      r('Unang Labas', 'Pebrero 5, 2025', 'Binago Noong', 'Agosto 28, 2026'),
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('Pinapalitan', { w: CW[0], bold: true, fill: 'EDF1F8' }),
          tCell('Series 1, 2025 Edition', { w: CW[1], bold: true }),
          tCell('Bisa', { w: CW[2], bold: true, fill: 'EDF1F8' }),
          tCell('Tatlumpung (30) araw mula sa pagpaskil at pamamahagi', { w: CW[3], bold: true }),
        ],
      }),
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('Inihanda ng', { w: CW[0], bold: true, fill: 'EDF1F8' }),
          tCell('Human Resources Department', { w: CW[1], bold: true }),
          tCell('Inaprubahan ng', { w: CW[2], bold: true, fill: 'EDF1F8' }),
          tCell('ANG PAMUNUAN', { w: CW[3], bold: true }),
        ],
      }),
    ], CW),

    gap(280),
    note('Tungkol sa saling ito', [
      'Ito ang salin sa Filipino ng TXTAIRE OPC Code of Discipline, Series 2, 2026 Edition. Pareho ang nilalaman, ang mga uri ng paglabag, at ang mga parusa sa Ingles na edisyon — iisang dokumento ito, dalawang wika lamang.',
      'Kung may pagkakaiba sa pagitan ng dalawang bersyon sa kahit anong punto, ang Ingles na edisyon ang masusunod, dahil iyon ang pormal na inaprubahan ng pamunuan. Kung may bahagi ritong hindi malinaw sa iyo, itanong sa Human Resources Department — walang tanong na masyadong maliit.',
      'Kung may probisyon ng Code na ito na salungat sa Labor Code ng Pilipinas, sa Implementing Rules nito, o sa kautusan ng Department of Labor and Employment, ang batas ang masusunod at ituturing na nabago nang naaayon ang Code na ito.',
    ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

    gap(240),
    // Ang buong edisyon ay nagpapaliwanag kung ano ang nagbago at bakit -- iyon ang
    // kailangan ng HR. Ang kopya ng empleyado ay nagpapaliwanag kung paano hanapin ang
    // mga bagay -- iyon ang kailangan ng empleyado. Walang panuntunang nawawala rito.
    ...(L.forEmployee() ? [
      secHead('Paano gamitin ang Kodigong ito'),
      p('Nasasaklaw ng Kodigong ito ang bawat empleyado ng TXTAIRE OPC. Nakasaad dito ang inaasahan sa iyo, ang mga gawaing itinuturing na paglabag, ang parusang nakalaan sa bawat paglabag, at ang prosesong dapat sundin ng kompanya bago ipataw sa iyo ang anumang parusa.'),
      bullet([
        run('Ang inaasahan sa iyo. ', { bold: true }),
        run('Nasa Bahagi II ang pamantayang etikal ng kompanya — kung paano ka dapat makitungo sa kliyente, sa mga kasamahan mo, at sa ari-arian ng kompanya, bago pa mapunta sa usapin ng disiplina.'),
      ]),
      bullet([
        run('Paano gumagana ang disiplina. ', { bold: true }),
        run('Ipinapaliwanag ng Bahagi III ang apat na uri ng paglabag, ang parusa sa bawat uri, at ang prosesong dalawang sulat na sinusunod ng kompanya sa bawat kaso. Basahin muna ang Seksyon 3.6 kung nakatanggap ka ng Notice to Explain.'),
      ]),
      bullet([
        run('Ang talaan ng mga paglabag. ', { bold: true }),
        run('Nakalista sa Bahagi IV ang bawat paglabag at ang uri nito. Sa bawat grupo, nagsisimula sa pinakamagaan hanggang sa pinakamabigat, para makita mo agad kung gaano kabigat ang isang patakaran nang hindi na kailangang tingnan ang talaan ng parusa.'),
      ]),
      bullet([
        run('Ang oras, leave, at benepisyo mo. ', { bold: true }),
        run('Nasa Bahagi V ang oras ng trabaho, overtime, leave, sahod, at benepisyo. Nasa Bahagi VI ang promotion, pagbibitiw, at kung ano ang nararapat sa iyo kapag humiwalay ka na.'),
      ], { after: 200 }),
    ] : [
    secHead('Bakit inilabas ang edisyong ito'),
    p('Pinapalitan ng Series 2, 2026 Edition na ito ang buong Series 1, 2025 Edition ng TXTAIRE OPC Code of Discipline. Inilabas ito sa apat na dahilan:'),
    bullet([
      run('Para tumugma sa laki ng kompanya. ', { bold: true }),
      run('Mga dalawampung (20) tao ang kasalukuyang empleyado ng TXTAIRE OPC, at inaasahang aabot sa mga isandaan (100) sa loob ng susunod na taon. Ipinapalagay ng dating edisyon na malaking organisasyon ito na maraming antas ng manager. Ang edisyong ito ay naglalatag ng prosesong talagang kayang gawin ngayon ng kompanyang dalawampu ang tao, at gagana pa rin kapag isandaan na.'),
    ]),
    bullet([
      run('Para maging patas at katimbang ang mga parusa. ', { bold: true }),
      run('Maraming paglabag sa dating edisyon ang may parusang pagtanggal agad sa kauna-unahang pagkakataon, o tatlumpung (30) araw na suspensyon, kahit sa pagkakamaling walang idinulot na pinsala sa kompanya. Ang mga parusa sa edisyong ito ay unti-unti: ang magagaan na paglabag ay itinatama, at nakalaan ang pagtanggal sa malulubhang dahilang kinikilala ng batas.'),
    ]),
    bullet([
      run('Para sumunod sa Labor Code at sa kasalukuyang alituntunin ng DOLE. ', { bold: true }),
      run('Inalis ang mga probisyong naglalagay sa kompanya sa legal na panganib, kasama ang pagpataw ng multa at ang hindi pagbibigay ng bayad sa oras na talagang pinasukan. Nakasulat na nang buo ang tamang proseso, sunod sa panuntunan ng dalawang sulat.'),
    ]),
    bullet([
      run('Para maisulat ang pamantayang etikal ng kompanya. ', { bold: true }),
      run('Bago ang Bahagi II ng Code na ito. Malinaw nitong sinasabi kung ano ang inaasahan ng TXTAIRE sa bawat empleyado bago pa mapunta sa usapin ng disiplina.'),
    ], { after: 200 }),
    ]),
  ];
};

module.exports = { cover, missionVision, controlSheet };
