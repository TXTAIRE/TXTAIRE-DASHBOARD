const fs = require('fs');
const path = require('path');
const L = require('./lib.js');
const { d, C, W, img, run } = L;

const front = require('./front.js');
const p13 = require('./parts13.js');
const p4 = require('./part4.js');
const p56 = require('./parts56.js');
const anx = require('./annex.js');
const chg = require('./changes.js');

const OUT = process.argv[2] || path.join(__dirname, 'out.docx');
const PAGEMAP = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : {};

const numbering = {
  config: [
    {
      reference: 'bullets',
      levels: [
        { level: 0, format: d.LevelFormat.BULLET, text: '•', alignment: d.AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 400, hanging: 220 } }, run: { font: 'Arial' } } },
        { level: 1, format: d.LevelFormat.BULLET, text: '◦', alignment: d.AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 780, hanging: 220 } }, run: { font: 'Arial' } } },
      ],
    },
  ],
};

const footer = new d.Footer({
  children: [
    new d.Paragraph({
      spacing: { before: 60, after: 0 },
      border: { top: { style: d.BorderStyle.SINGLE, size: 6, color: 'C7D2E4', space: 6 } },
      // An explicit right tab stop at the content width, not a PositionalTab. Word's PDF
      // export honours the ptab inconsistently -- it worked in the 45-page build and
      // collapsed on 44 of 46 pages in the next one, printing the page number jammed
      // against the strap, with no change to this markup. A real tab stop lands the same
      // every time. make-fil.js carries the identical fix.
      tabStops: [{ type: d.TabStopType.RIGHT, position: W }],
      children: [
        new d.TextRun({ text: 'TXTAIRE OPC  |  Code of Discipline  |  Series 2, 2026 Edition', font: 'Arial', size: 15, color: '7A7A7A' }),
        new d.TextRun({ children: [new d.Tab()] }),
        new d.TextRun({ children: [d.PageNumber.CURRENT], font: 'Arial', size: 17, bold: true, color: C.navy }),
        new d.TextRun({ text: ' | Page', font: 'Arial', size: 15, color: '7A7A7A' }),
      ],
    }),
  ],
});

// The company mark repeats on every body page. Word repeats a header image on each page
// automatically, so this is the one place it needs to be declared. The cover section
// carries its own (blank) header -- the cover already shows the logo at full size.
const header = new d.Header({
  children: [
    new d.Paragraph({
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
        new d.TextRun({ text: 'CODE OF DISCIPLINE', font: 'Arial', size: 16, bold: true, color: C.navy, characterSpacing: 30 }),
      ],
    }),
  ],
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
  title: 'TXTAIRE OPC Code of Discipline — Series 2, 2026 Edition',
  description: 'Code of Discipline, ethical standards and disciplinary procedure of TXTAIRE OPC.',
  numbering,
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 21, color: '1A1A1A' } },
    },
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
      ...front.controlSheet(PAGEMAP),
      ...front.toc(PAGEMAP),
      ...chg.summaryOfChanges(),
      ...p13.part1(),
      ...p13.part2(),
      ...p13.part3(),
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
