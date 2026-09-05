const fs = require('fs');
const path = require('path');
const L = require('./lib.js');
L.setLang('fil');
L.setAudience('employee');        // both must run before any content module is required

const { d, C, W, run } = L;

const front = require('./fil-front.js');
const p12 = require('./fil-parts13.js');
const p3 = require('./fil-part3.js');
const p4 = require('./fil-part4.js');
const p56 = require('./fil-parts56.js');
const anx = require('./fil-annex.js');

const OUT = process.argv[2] || path.join(__dirname, 'out-fil-emp.docx');
const PAGEMAP = process.argv[3] && fs.existsSync(process.argv[3])
  ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};

// ------------------------------------------------------------ TALAAN NG NILALAMAN
// Hindi dala ng kopya ng empleyado: ang Buod ng mga Pagbabago at ang Annex F.
const EMPLOYEE_OMITS = ['soc', 'socA', 'socB', 'socC', 'socD', 'anxF'];
const entriesFor = () =>
  (L.forEmployee() ? TOC_ENTRIES.filter((e) => EMPLOYEE_OMITS.indexOf(e[3]) === -1) : TOC_ENTRIES);

const TOC_ENTRIES = [
  ['part', 'BUOD', 'BUOD NG MGA PAGBABAGO MULA SA EDISYONG 2025', 'soc'],
  ['item', 'A', 'Mga parusang pinagaan', 'socA'],
  ['item', 'B', 'Mga probisyong inalis dahil labag sa batas', 'socB'],
  ['item', 'C', 'Ano ang bago sa edisyong ito', 'socC'],
  ['item', 'D', 'Mga benepisyong isinunod sa kasalukuyang batas', 'socD'],

  ['part', 'BAHAGI I', 'PANIMULA AT PANGKALAHATANG PATAKARAN', 'p1'],
  ['item', '1.1', 'Layunin at Saklaw', 's1_1'],
  ['item', '1.2', 'Pananagutan sa Pagpapatupad', 's1_2'],
  ['item', '1.3', 'Pantay na Oportunidad at Hindi Pagtatangi', 's1_3'],
  ['item', '1.4', 'Patakaran sa Probationary na Empleyado', 's1_4'],
  ['item', '1.5', 'Kahulugan ng mga Termino', 's1_5'],
  ['item', '1.6', 'Pagbabago sa Manwal at mga Mungkahi', 's1_6'],

  ['part', 'BAHAGI II', 'PAMANTAYANG ETIKAL NG KOMPANYA', 'p2'],
  ['item', '2.1', 'Ang mga Pagpapahalaga Natin sa Gawa', 's2_1'],
  ['item', '2.2', 'Pamantayan sa Pagnenegosyo', 's2_2'],
  ['item', '2.3', 'Conflict of Interest', 's2_3'],
  ['item', '2.4', 'Regalo, Komisyon, at Libre', 's2_4'],
  ['item', '2.5', 'Kompidensyalidad at Data Privacy', 's2_5'],
  ['item', '2.6', 'Ari-arian at Gamit ng Kompanya', 's2_6'],
  ['item', '2.7', 'Pakikitungo sa Kliyente at sa Publiko', 's2_7'],
  ['item', '2.8', 'Paggalang sa Lugar ng Trabaho', 's2_8'],
  ['item', '2.9', 'Social Media at Pampublikong Pahayag', 's2_9'],
  ['item', '2.10', 'Pag-report ng Alalahanin at Proteksyon', 's2_10'],

  ['part', 'BAHAGI III', 'ANG PROSESO NG DISIPLINA', 'p3'],
  ['item', '3.1', 'Mga Prinsipyo ng Nagwawastong Disiplina', 's3_1'],
  ['item', '3.2', 'Kahulugan ng mga Aksyong Disiplinaryo', 's3_2'],
  ['item', '3.3', 'Pag-uuri ng mga Paglabag', 's3_3'],
  ['item', '3.4', 'Talaan ng mga Parusa', 's3_4'],
  ['item', '3.5', 'Mga Pampagaan at Pampabigat na Pangyayari', 's3_5'],
  ['item', '3.6', 'Tamang Proseso: Ang Dalawang Sulat', 's3_6'],
  ['item', '3.7', 'Ang Administrative Review Panel', 's3_7'],
  ['item', '3.8', 'Preventive Suspension', 's3_8'],
  ['item', '3.9', 'Apela', 's3_9'],
  ['item', '3.10', 'Paulit-ulit na Paglabag', 's3_10'],
  ['item', '3.11', 'Palugit at Paglilinis ng Record', 's3_11'],
  ['item', '3.12', 'Pagbabayad ng Pinsala at ang Bawal na Multa', 's3_12'],
  ['item', '3.13', 'Karapatan ng Pamunuan at ng Empleyado', 's3_13'],

  ['part', 'BAHAGI IV', 'TALAAN NG MGA PAGLABAG', 'p4'],
  ['item', '4.1', 'Mga Paglabag sa Attendance at Pagiging Maagap', 's4_1'],
  ['item', '4.2', 'Mga Paglabag sa Time Record at Dokumento', 's4_2'],
  ['item', '4.3', 'Mga Paglabag sa Kalusugan, Kaligtasan, at Seguridad', 's4_3'],
  ['item', '4.4', 'Mga Paglabag sa Performance sa Trabaho', 's4_4'],
  ['item', '4.5', 'Mga Paglabag sa Ari-arian ng Kompanya at Kliyente', 's4_5'],
  ['item', '4.6', 'Mga Paglabag sa Katapatan', 's4_6'],
  ['item', '4.7', 'Mga Paglabag sa Asal at Ugali', 's4_7'],
  ['item', '4.8', 'Pananagutan ng mga Supervisor at Manager', 's4_8'],

  ['part', 'BAHAGI V', 'PAMANTAYAN AT BENEPISYO SA TRABAHO', 'p5'],
  ['item', '5.1', 'Oras ng Trabaho, Attendance, at Pagiging Maagap', 's5_1'],
  ['item', '5.2', 'Overtime, Undertime, at Rest Day', 's5_2'],
  ['item', '5.3', 'Mga Leave', 's5_3'],
  ['item', '5.4', 'Payroll at Timekeeping', 's5_4'],
  ['item', '5.5', 'Panuntunan sa Holiday Pay', 's5_5'],
  ['item', '5.6', 'Mga Benepisyo Ayon sa Batas', 's5_6'],
  ['item', '5.7', 'Kaligtasan at Kalusugan sa Trabaho', 's5_7'],
  ['item', '5.8', 'Lugar ng Trabahong Walang Droga', 's5_8'],
  ['item', '5.9', 'Laban sa Sexual Harassment at Ligtas na Espasyo', 's5_9'],
  ['item', '5.10', 'Mental Health at Hindi Pagtatangi sa Kalusugan', 's5_10'],

  ['part', 'BAHAGI VI', 'MGA AKSYON SA TRABAHO AT PAGHIHIWALAY', 'p6'],
  ['item', '6.1', 'Promotion, Transfer, at Muling Pag-uuri', 's6_1'],
  ['item', '6.2', 'Pagsusuri ng Performance', 's6_2'],
  ['item', '6.3', 'Pagtatapos ng Trabaho ng Employer', 's6_3'],
  ['item', '6.4', 'Pagbibitiw', 's6_4'],
  ['item', '6.5', 'Huling Sahod, Clearance, at COE', 's6_5'],

  ['part', 'MGA ANNEX', 'MGA FORM AT SANGGUNIAN', 'p7'],
  ['item', 'A', 'Notice to Explain', 'anxA'],
  ['item', 'B', 'Nakasulat na Paliwanag ng Empleyado', 'anxB'],
  ['item', 'C', 'Abiso ng Administrative Conference', 'anxC'],
  ['item', 'D', 'Case Evaluation Form', 'anxD'],
  ['item', 'E', 'Notice of Decision', 'anxE'],
  ['item', 'F', 'Checklist sa Pagsunod', 'anxF'],
  ['item', 'G', 'Pagkilala at Pagsang-ayon ng Empleyado', 'anxG'],
];

const tocLine = (kind, num, title, page) => {
  const isPart = kind === 'part';
  return new d.Paragraph({
    spacing: { before: isPart ? 200 : 0, after: isPart ? 70 : 40 },
    indent: { left: isPart ? 0 : 340 },
    children: [
      new d.TextRun({
        font: L.F, size: isPart ? 21 : 20, bold: isPart,
        color: isPart ? C.navy : '333333',
        text: isPart ? num + '   ' + title.toUpperCase() : num + '   ' + title,
      }),
      new d.TextRun({
        font: L.F, size: isPart ? 21 : 20, bold: isPart,
        color: isPart ? C.navy : '333333',
        children: [
          new d.PositionalTab({
            alignment: d.PositionalTabAlignment.RIGHT,
            relativeTo: d.PositionalTabRelativeTo.MARGIN,
            leader: isPart ? d.PositionalTabLeader.NONE : d.PositionalTabLeader.DOT,
          }),
          page === undefined ? ' ' : String(page),
        ],
      }),
    ],
  });
};

const toc = (pageMap) => [
  L.table([new d.TableRow({
    cantSplit: true,
    children: [L.cell(new d.Paragraph({
      spacing: { after: 0 },
      children: [run('  TALAAN NG NILALAMAN  ', { size: 30, bold: true, color: 'FFFFFF' })],
    }), { w: W, fill: C.blue })],
  })], [W], { borderless: true }),
  L.gap(300),
  ...entriesFor().map((e) => tocLine(e[0], e[1], e[2], pageMap[e[3]])),
  L.pageBreak(),
];

// ------------------------------------------------------------ DOKUMENTO
const numbering = {
  config: [{
    reference: 'bullets',
    levels: [
      { level: 0, format: d.LevelFormat.BULLET, text: '•', alignment: d.AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 400, hanging: 220 } }, run: { font: 'Arial' } } },
      { level: 1, format: d.LevelFormat.BULLET, text: '◦', alignment: d.AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 780, hanging: 220 } }, run: { font: 'Arial' } } },
    ],
  }],
};

const footer = new d.Footer({
  children: [new d.Paragraph({
    spacing: { before: 60, after: 0 },
    border: { top: { style: d.BorderStyle.SINGLE, size: 6, color: 'C7D2E4', space: 6 } },
    // An explicit right tab stop at the content width, not a PositionalTab: Word's PDF
    // export honoured the ptab in the English footer but collapsed it here, printing the
    // page number jammed against the strap. A real tab stop lands the same every time.
    tabStops: [{ type: d.TabStopType.RIGHT, position: W }],
    children: [
      new d.TextRun({ text: 'TXTAIRE OPC  |  Kodigo ng Disiplina  |  Series 2, 2026  |  Kopya ng Empleyado', font: 'Arial', size: 14, color: '7A7A7A' }),
      new d.TextRun({ children: [new d.Tab()] }),
      new d.TextRun({ children: [d.PageNumber.CURRENT], font: 'Arial', size: 17, bold: true, color: C.navy }),
      new d.TextRun({ text: ' | Pahina', font: 'Arial', size: 15, color: '7A7A7A' }),
    ],
  })],
});

const header = new d.Header({
  children: [new d.Paragraph({
    spacing: { after: 0 },
    border: { bottom: { style: d.BorderStyle.SINGLE, size: 12, color: C.blue, space: 4 } },
    children: [
      new d.ImageRun({
        type: 'png',
        data: fs.readFileSync(path.join(L.A, 'logo.png')),
        transformation: { width: 82, height: 42 },
      }),
      new d.TextRun({
        children: [new d.PositionalTab({
          alignment: d.PositionalTabAlignment.RIGHT,
          relativeTo: d.PositionalTabRelativeTo.MARGIN,
          leader: d.PositionalTabLeader.NONE,
        })],
      }),
      new d.TextRun({ text: 'KODIGO NG DISIPLINA', font: 'Arial', size: 16, bold: true, color: C.navy, characterSpacing: 30 }),
    ],
  })],
});

const blank = new d.Paragraph({ children: [] });

const section = (children, opts) => ({
  properties: {
    page: {
      size: { width: 11906, height: 16838 },
      margin: { top: 1200, right: 1080, bottom: 1000, left: 1080, header: 460, footer: 440 },
      pageNumbers: (opts && opts.bare) ? undefined : { start: 1 },
    },
    titlePage: false,
  },
  headers: (opts && opts.bare) ? { default: new d.Header({ children: [blank] }) } : { default: header },
  footers: (opts && opts.bare) ? { default: new d.Footer({ children: [blank] }) } : { default: footer },
  children,
});

const doc = new d.Document({
  creator: 'TXTAIRE OPC — Human Resources Department',
  title: 'TXTAIRE OPC Kodigo ng Disiplina — Series 2, 2026 Edition',
  description: 'Salin sa Filipino ng Code of Discipline ng TXTAIRE OPC.',
  numbering,
  styles: {
    default: { document: { run: { font: 'Arial', size: 21, color: '1A1A1A' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 26, bold: true, color: 'FFFFFF' } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 23, bold: true, color: C.navy } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: 'Arial', size: 21, bold: true, color: C.green } },
    ],
  },
  sections: [
    section([...front.cover(), ...front.missionVision()], { bare: true }),
    section([
      ...front.controlSheet(),
      ...toc(PAGEMAP),
      ...p12.part1(),
      ...p12.part2(),
      ...p3.part3(),
      ...p4.part4(),
      ...p56.part5(),
      ...p56.part6(),
      ...anx.annexes(),
    ]),
  ],
});

d.Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf);
  console.log('wrote', OUT, (buf.length / 1024).toFixed(0) + ' KB');
});
