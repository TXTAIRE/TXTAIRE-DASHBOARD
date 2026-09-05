const d = require('docx');
const fs = require('fs');
const path = require('path');

const A = path.join(__dirname, 'assets');
const F = 'Arial';

const C = {
  blue: '1F4E9C', navy: '16386E', gold: 'E8A317', green: '1B6B2E',
  lgreen: '7AC143', grey: '595959', lgrey: 'F2F2F2', white: 'FFFFFF',
  A: 'E2F0D9', B: 'FFF2CC', Cc: 'FBE5D6', D: 'F8CBCB',
  Atxt: '375623', Btxt: '7F6000', Ctxt: '974706', Dtxt: '9C1C1C',
  newBg: 'D6EAD6', newTxt: '1E6B2E',   // wholly new in this edition
  revBg: 'DCE6F5', revTxt: '1B4F8F',   // carried over but materially revised
  remBg: 'F6D9D9', remTxt: '9C1C1C',   // withdrawn / removed
  manBg: 'FDF0D5', manTxt: '8A5A00',   // benefit required by law
  volBg: 'D9EEEC', volTxt: '15605B',   // benefit granted by the Company
};

const W = 9746; // A4 content width at 1080 dxa margins

// Both editions are built from this one layout module, so the fixed strings it emits --
// column headings, class names, the penalty guide, the change and benefit pills -- have to
// come from a table rather than be written inline. setLang() switches it; everything else
// in the build reads whatever is current.
const STRINGS = {
  en: {
    offNo: 'NO.', offOffense: 'OFFENSE', offClass: 'CLASS',
    classLabel: { A: 'A - Light', B: 'B - Less Grave', C: 'C - Grave', D: 'D - Serious' },
    className: { A: 'LIGHT', B: 'LESS GRAVE', C: 'GRAVE', D: 'SERIOUS' },
    classSteps: {
      A: 'Verbal warning → Written warning → 3 days → 7 days',
      B: 'Written warning → 3 days → 7 days → Dismissal',
      C: '7 days → 15 days → Dismissal',
      D: 'Dismissal on the first offense',
    },
    classWord: 'CLASS',
    chg: { new: 'NEW', rev: 'REVISED', rem: 'WITHDRAWN', revShort: 'REV' },
    benefit: { mandatory: 'MANDATORY', company: 'COMPANY-GRANTED' },
  },
  fil: {
    offNo: 'BLG.', offOffense: 'PAGLABAG', offClass: 'URI',
    classLabel: { A: 'A - Magaan', B: 'B - Katamtaman', C: 'C - Mabigat', D: 'D - Napakabigat' },
    className: { A: 'MAGAAN', B: 'KATAMTAMAN', C: 'MABIGAT', D: 'NAPAKABIGAT' },
    classSteps: {
      A: 'Bibig na babala → Sulat na babala → 3 araw → 7 araw',
      B: 'Sulat na babala → 3 araw → 7 araw → Tanggal',
      C: '7 araw → 15 araw → Tanggal',
      D: 'Tanggal agad sa unang paglabag',
    },
    classWord: 'URI',
    chg: { new: 'BAGO', rev: 'BINAGO', rem: 'INALIS', revShort: 'BINAGO' },
    benefit: { mandatory: 'AYON SA BATAS', company: 'BIGAY NG KOMPANYA' },
  },
};

let LANG = 'en';
const setLang = (l) => { LANG = (l === 'fil') ? 'fil' : 'en'; };
const S = () => STRINGS[LANG];

// Audience. The full edition is the HR reference: it carries the NEW / REVISED /
// WITHDRAWN markers, the Summary of Changes, and the passages explaining how each rule
// differs from the 2025 edition. The employee copy is the same Code with that apparatus
// removed -- an employee needs to know what the rule IS, not what it used to be.
//
// This is a flag rather than a second set of content modules on purpose. Two copies of
// the same 100-odd rules would drift the first time one was amended, and the whole point
// of this Code is that the employee copy and the HR reference say the same thing.
//
// Nothing here may delete a RULE. Several of the passages that compare the two editions
// also state something operative -- that self-defence carries no penalty, that Section
// 4.8 applies where authority was abused -- so those pass through `pick`, which supplies
// a rewritten sentence for the employee copy instead of dropping the passage.
let AUDIENCE = 'full';
const setAudience = (a) => { AUDIENCE = (a === 'employee') ? 'employee' : 'full'; };
const forEmployee = () => AUDIENCE === 'employee';
const pick = (full, employee) => (forEmployee() ? employee : full);
const hrOnly = (...items) => (forEmployee() ? [] : items);
// Change markers resolve through here so suppressing them is one decision, not one per
// call site: both the heading pills and the per-offense pills go through chgStyle.
const chgStyle = (kind) => (forEmployee() ? undefined : CHG[kind]);

const cls = { A: C.A, B: C.B, C: C.Cc, D: C.D };
const clsTxt = { A: C.Atxt, B: C.Btxt, C: C.Ctxt, D: C.Dtxt };

const img = (file, w, h, align) => new d.Paragraph({
  alignment: align || d.AlignmentType.CENTER,
  spacing: { after: 0 },
  children: [new d.ImageRun({
    type: file.endsWith('.png') ? 'png' : 'jpg',
    data: fs.readFileSync(path.join(A, file)),
    transformation: { width: w, height: h },
  })],
});

const run = (t, o) => {
  o = o || {};
  return new d.TextRun({
    text: t, font: F, size: o.size || 21, bold: o.bold, italics: o.italics,
    color: o.color || '1A1A1A', allCaps: o.caps,
    underline: o.u ? {} : undefined,
  });
};

const p = (t, o) => {
  o = o || {};
  return new d.Paragraph({
    alignment: o.align || d.AlignmentType.JUSTIFIED,
    spacing: {
      after: o.after === undefined ? 140 : o.after,
      before: o.before || 0, line: o.line || 264,
    },
    indent: o.indent ? { left: o.indent } : undefined,
    keepNext: o.keepNext,
    children: Array.isArray(t) ? t : [run(t, o)],
  });
};

const bullet = (t, o) => {
  o = o || {};
  return new d.Paragraph({
    numbering: { reference: 'bullets', level: o.level || 0 },
    spacing: { after: o.after === undefined ? 80 : o.after, line: 264 },
    alignment: d.AlignmentType.JUSTIFIED,
    children: Array.isArray(t) ? t : [run(t, o)],
  });
};

const gap = (h) => new d.Paragraph({ spacing: { after: h || 120 }, children: [] });
const pageBreak = () => new d.Paragraph({
  spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACTLY },
  children: [new d.PageBreak()],
});

// A trailing pageBreak() paragraph produces a BLANK page whenever the content before it
// happens to fill the page exactly -- the break paragraph is pushed to the next page and
// then breaks again. This attaches the break to the top of the block that follows
// instead, which cannot strand a blank page however the preceding content falls.
const pageBreakBefore = () => new d.Paragraph({
  spacing: { before: 0, after: 0, line: 20, lineRule: d.LineRuleType.EXACTLY },
  pageBreakBefore: true,
  children: [],
});

const partHead = (num, title, chg) => [
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_1,
    alignment: d.AlignmentType.LEFT,
    // The space below the banner is spacing on the banner itself, NOT a following empty
    // paragraph. keepNext only binds a paragraph to the one immediately after it, so with a
    // spacer paragraph in between, Word satisfied the rule by keeping the banner with the
    // SPACER -- both then sat at the foot of the page while the real content flowed over.
    // That is exactly how Part III came to be stranded alone at the bottom of page 12.
    // `before` gives the banner room from whatever Part ended above it; Word collapses
    // leading space at the top of a page, so it costs nothing when a Part does start one.
    spacing: { before: 300, after: 230 },
    keepNext: true,
    keepLines: true,
    shading: { type: d.ShadingType.CLEAR, fill: C.blue, color: 'auto' },
    border: { bottom: { style: d.BorderStyle.SINGLE, size: 18, color: C.gold, space: 2 } },
    children: [
      new d.TextRun({ text: '  ' + num + '   ', font: F, size: 26, bold: true, color: C.white }),
      new d.TextRun({ text: title.toUpperCase() + '  ', font: F, size: 26, bold: true, color: C.white }),
    ].concat(chgRun(chg, 16)),
  }),
];

// Change marker used throughout this edition: 'new' (did not exist in Series 1),
// 'rev' (existed but materially changed), 'rem' (withdrawn). Rendered as a small pill
// so a reader can scan the document for what moved without reading it end to end.
const CHG = {
  new: { get text() { return S().chg.new; }, bg: C.newBg, fg: C.newTxt },
  rev: { get text() { return S().chg.rev; }, bg: C.revBg, fg: C.revTxt },
  rem: { get text() { return S().chg.rem; }, bg: C.remBg, fg: C.remTxt },
};

const chgRun = (kind, size) => {
  const c = chgStyle(kind);
  if (!c) return [];
  return [
    new d.TextRun({ text: '  ', font: F, size: size || 15 }),
    new d.TextRun({
      text: ' ' + c.text + ' ', font: F, size: size || 15, bold: true,
      color: c.fg, shading: { type: d.ShadingType.CLEAR, fill: c.bg, color: 'auto' },
    }),
  ];
};

const secHead = (t, chg) => new d.Paragraph({
  heading: d.HeadingLevel.HEADING_2,
  spacing: { before: 260, after: 110 },
  keepNext: true,
  border: { bottom: { style: d.BorderStyle.SINGLE, size: 8, color: 'BFCFE8', space: 3 } },
  children: [new d.TextRun({ text: t, font: F, size: 23, bold: true, color: C.navy })].concat(chgRun(chg, 16)),
});

const subHead = (t, chg) => new d.Paragraph({
  heading: d.HeadingLevel.HEADING_3,
  spacing: { before: 180, after: 80 },
  keepNext: true,
  children: [new d.TextRun({ text: t, font: F, size: 21, bold: true, color: C.green })].concat(chgRun(chg, 15)),
});

const noBorder = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const thin = (c) => ({ style: d.BorderStyle.SINGLE, size: 4, color: c || 'AAB6CC' });

const cell = (children, o) => {
  o = o || {};
  return new d.TableCell({
    width: { size: o.w, type: d.WidthType.DXA },
    columnSpan: o.span,
    shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
    verticalAlign: o.va || d.VerticalAlign.CENTER,
    margins: o.pad || { top: 70, bottom: 70, left: 100, right: 100 },
    children: Array.isArray(children) ? children : [children],
  });
};

const tCell = (text, o) => {
  o = o || {};
  return cell(new d.Paragraph({
    alignment: o.align || d.AlignmentType.LEFT,
    spacing: { after: 0, line: o.line || 250 },
    children: [run(text, { size: o.size || 19, bold: o.bold, color: o.color, italics: o.italics })],
  }), o);
};

const table = (rows, widths, o) => {
  o = o || {};
  return new d.Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: d.WidthType.DXA },
    layout: d.TableLayoutType.FIXED,
    borders: o.borderless
      ? { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }
      : { top: thin(), bottom: thin(), left: thin(), right: thin(), insideHorizontal: thin('CCD5E4'), insideVertical: thin('CCD5E4') },
    rows,
  });
};

const note = (label, lines, o) => {
  o = o || {};
  return new d.Table({
    columnWidths: [W],
    width: { size: W, type: d.WidthType.DXA },
    layout: d.TableLayoutType.FIXED,
    borders: {
      top: thin(o.edge || C.gold), bottom: thin(o.edge || C.gold),
      left: { style: d.BorderStyle.SINGLE, size: 18, color: o.edge || C.gold },
      right: thin(o.edge || C.gold),
      insideHorizontal: noBorder, insideVertical: noBorder,
    },
    rows: [new d.TableRow({ cantSplit: true,
      children: [cell([
        new d.Paragraph({
          spacing: { after: 60 },
          children: [run(label, { bold: true, size: 19, color: o.labelColor || '7F5200', caps: true })],
        }),
        // An item may be a plain string, or an array of runs where part of the line needs
        // its own formatting. A bare STRING inside that array has to be wrapped here:
        // docx drops a raw string in a children array without raising anything, and the
        // paragraph renders empty. Three prohibitions in Section 3.12 -- no fines, no
        // withholding of earned pay, no liquidated damages for short notice -- were
        // written that way and were silently absent from every edition built before this
        // was found. _dropcheck.js compares what the modules produce against what reaches
        // the DOCX, so a paragraph lost this way cannot go unnoticed again.
        ...lines.map((l, i) => new d.Paragraph({
          alignment: d.AlignmentType.JUSTIFIED,
          spacing: { after: i === lines.length - 1 ? 0 : 80, line: 250 },
          children: Array.isArray(l)
            ? l.map((x) => (typeof x === 'string' ? run(x, { size: 19 }) : x))
            : [run(l, { size: 19 })],
        })),
      ], { w: W, fill: o.fill || 'FFF9EC', va: d.VerticalAlign.TOP })],
    })],
  });
};

// Whether a benefit is owed because the law requires it, or because the Company chose to
// grant it. The distinction has a consequence worth making visible: a MANDATORY benefit
// is owed regardless of company policy, while a COMPANY-GRANTED one, once given regularly
// and deliberately, becomes protected by Article 100 of the Labor Code and can no longer
// be withdrawn unilaterally either.
const BENEFIT = {
  mandatory: { get text() { return S().benefit.mandatory; }, bg: C.manBg, fg: C.manTxt },
  company: { get text() { return S().benefit.company; }, bg: C.volBg, fg: C.volTxt },
};

// Inline pill, for use in running text and bullet lists.
const benefitRun = (kind, size) => {
  const t = BENEFIT[kind];
  if (!t) return [];
  return [new d.TextRun({
    text: ' ' + t.text + ' ', font: F, size: size || 15, bold: true,
    color: t.fg, shading: { type: d.ShadingType.CLEAR, fill: t.bg, color: 'auto' },
  })];
};

// Centred pill for a table cell.
const benefitCell = (kind, w) => {
  const t = BENEFIT[kind];
  return cell(new d.Paragraph({
    alignment: d.AlignmentType.CENTER,
    spacing: { after: 0, line: 220 },
    children: t ? [new d.TextRun({
      text: ' ' + t.text + ' ', font: F, size: 14, bold: true,
      color: t.fg, shading: { type: d.ShadingType.CLEAR, fill: t.bg, color: 'auto' },
    })] : [run('—', { size: 17 })],
  }), { w: w, va: d.VerticalAlign.TOP });
};

const OFF_W = [760, 6986, 2000];

const offHeader = () => new d.TableRow({ cantSplit: true,
  tableHeader: true,
  children: [
    tCell(S().offNo, { w: OFF_W[0], bold: true, color: C.white, fill: C.blue, align: d.AlignmentType.CENTER, size: 18 }),
    tCell(S().offOffense, { w: OFF_W[1], bold: true, color: C.white, fill: C.blue, size: 18 }),
    tCell(S().offClass, { w: OFF_W[2], bold: true, color: C.white, fill: C.blue, align: d.AlignmentType.CENTER, size: 18 }),
  ],
});


const offRow = (n, text, k, extra, chg) => new d.TableRow({ cantSplit: true,
  children: [
    cell([
      new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: chgStyle(chg) ? 30 : 0, line: 250 },
        children: [run(String(n), { size: 19, bold: true, color: C.grey })],
      }),
      ...(chgStyle(chg) ? [new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 0, line: 200 },
        children: [new d.TextRun({
          text: ' ' + (chg === 'rev' ? S().chg.revShort : chgStyle(chg).text) + ' ',
          font: F, size: 12, bold: true, color: chgStyle(chg).fg,
          shading: { type: d.ShadingType.CLEAR, fill: chgStyle(chg).bg, color: 'auto' },
        })],
      })] : []),
    ], { w: OFF_W[0], va: d.VerticalAlign.TOP }),
    cell([
      new d.Paragraph({
        alignment: d.AlignmentType.JUSTIFIED,
        spacing: { after: extra ? 60 : 0, line: 250 },
        children: [run(text, { size: 19 })],
      }),
      ...(extra ? [new d.Paragraph({
        alignment: d.AlignmentType.JUSTIFIED,
        spacing: { after: 0, line: 240 },
        children: [run(extra, { size: 17, italics: true, color: '6A6A6A' })],
      })] : []),
    ], { w: OFF_W[1], va: d.VerticalAlign.TOP }),
    tCell(S().classLabel[k], { w: OFF_W[2], align: d.AlignmentType.CENTER, bold: true, fill: cls[k], color: clsTxt[k], size: 18 }),
  ],
});

// Offenses are listed in order of severity -- Class A first, Class D last -- so each
// table escalates down the page and an employee can see where a rule sits without
// cross-referencing the schedule in Sec. 3.4. The sort is stable, so offenses sharing a
// class keep the order they are written in below, which is grouped by subject.
//
// Because rows move, nothing in this document may refer to an offense by its item
// number: every cross-reference names the offense instead. Sorting here rather than
// hand-ordering the source keeps that guarantee even after an offense is added or
// reclassified.
const CLASS_ORDER = { A: 0, B: 1, C: 2, D: 3 };

const offenseTable = (rows) => {
  const sorted = rows
    .map((r, i) => ({ r: r, i: i }))
    .sort((a, b) => (CLASS_ORDER[a.r[1]] - CLASS_ORDER[b.r[1]]) || (a.i - b.i))
    .map((x) => x.r);
  return table(
    [offHeader()].concat(sorted.map((r, i) => offRow(i + 1, r[0], r[1], r[2], r[3]))),
    OFF_W);
};

// The compact reminder that sits above every offense table. The first edition of this
// spelled the schedule out as "A VW > WW > 3d > 7d", which is only readable if you already
// know the abbreviations -- so it says the penalties in words instead, and tints each cell
// with that class's colour, the same colour the CLASS column uses on the row itself. The
// full schedule, with the rules on counting occurrences, stays in Sec. 3.4.
const CLASS_STEPS = {
  A: 'Verbal warning → Written warning → 3 days → 7 days',
  B: 'Written warning → 3 days → 7 days → Dismissal',
  C: '7 days → 15 days → Dismissal',
  D: 'Dismissal on the first offense',
};

const legend = () => {
  const w = Math.floor(W / 4);
  const widths = [w, w, w, W - 3 * w];
  const cellFor = (k, i) => cell([
    new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 20, line: 200 },
      children: [run(S().classWord + ' ' + k + '  ·  ' + S().className[k], { size: 16, bold: true, color: clsTxt[k] })],
    }),
    new d.Paragraph({
      alignment: d.AlignmentType.CENTER,
      spacing: { after: 0, line: 190 },
      children: [run(S().classSteps[k], { size: 14, color: '3F3F3F' })],
    }),
  ], { w: widths[i], fill: cls[k], va: d.VerticalAlign.CENTER, pad: { top: 44, bottom: 44, left: 50, right: 50 } });
  return table([
    new d.TableRow({ cantSplit: true, children: ['A', 'B', 'C', 'D'].map(cellFor) }),
  ], widths);
};

module.exports = {
  d, C, W, F, setLang, S, setAudience, forEmployee, pick, hrOnly, img, run, p, bullet, gap, pageBreak,
  pageBreakBefore,
  partHead, secHead, subHead, cell, tCell, table, note, chgRun, CHG,
  benefitRun, benefitCell, BENEFIT,
  offenseTable, legend, OFF_W, noBorder, thin, A,
};
