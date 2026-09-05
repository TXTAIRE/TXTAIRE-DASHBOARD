const L = require('./lib.js');
const { d, C, W, img, run, p, bullet, gap, pageBreak, partHead, secHead, subHead,
        cell, tCell, table, note } = L;

// ---------------------------------------------------------------- COVER PAGE
const cover = () => [
  gap(120),
  // The logo used to sit in a borderless two-cell table with the year opposite it. Word's
  // PDF export silently dropped that image -- the DOCX held it, the PDF did not -- so the
  // printed cover shipped without a logo. Same single-paragraph pattern as the running
  // header instead (image, positional tab, text), which exports reliably.
  new d.Paragraph({
    spacing: { after: 0 },
    children: [
      // JPEG, not the PNG the header uses: Word's PDF export drops that PNG when it sits
      // in the document BODY (it renders fine in the header, and the two JPEGs on this
      // page export fine), so the cover shipped logo-less until this was caught.
      new d.ImageRun({
        type: 'jpg',
        data: require('fs').readFileSync(require('path').join(L.A, 'logo_cover.jpg')),
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
    children: [run('CODE', { size: 84, bold: true, color: '2C6FD6' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
    children: [run('OF', { size: 40, bold: true, color: 'C89211' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 60 },
    children: [run('DISCIPLINE', { size: 84, bold: true, color: '2E7D32' })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER, spacing: { after: 320 },
    children: [run('Series 2, 2026 Edition', { size: 26, bold: true, color: '1A1A1A' })],
  }),

  img('cover.jpg', 470, 314),
  pageBreak(),
];

// ------------------------------------------------------- MISSION / VISION
const missionVision = () => [
  img('band.jpg', 470, 116),
  gap(240),
  new d.Paragraph({
    spacing: { after: 220 },
    children: [run('Mission & Vision.', { size: 48, bold: true, color: '1A1A1A' })],
  }),

  table([
    new d.TableRow({ cantSplit: true,
      children: [cell([
        new d.Paragraph({ spacing: { after: 100 }, children: [run('MISSION', { size: 24, bold: true, color: 'F5C242' })] }),
        new d.Paragraph({
          alignment: d.AlignmentType.JUSTIFIED, spacing: { after: 0, line: 264 },
          children: [
            run('TXTAIRE Refrigeration and Air-Conditioning Services is committed to attain and maintain a high standard of service through ', { size: 20, color: 'FFFFFF' }),
            run('hard work and efficiency', { size: 20, bold: true, color: 'FFFFFF' }),
            run('. Also, to attain and maintain a long lasting harmonious relationship with clients and workplace.', { size: 20, color: 'FFFFFF' }),
          ],
        }),
      ], { w: W, fill: C.blue, va: d.VerticalAlign.TOP })],
    }),
  ], [W], { borderless: true }),

  gap(260),
  new d.Paragraph({ spacing: { after: 100 }, children: [run('VISION', { size: 24, bold: true, color: 'C89211' })] }),
  p([
    run('Our entire search for service to our fellow is based on the integrity of all those who are part of the company. We believe likewise that the call for today’s society is for every person to have justice and to have equal opportunity to participate in Nation Building, hence our company is appreciated and mandated for our ', { size: 20 }),
    run('diligence, determination and dedication to duty', { size: 20, bold: true, color: C.green }),
    run('.', { size: 20 }),
  ], { after: 260 }),

  table([
    new d.TableRow({ cantSplit: true,
      children: [cell([
        new d.Paragraph({ spacing: { after: 100 }, children: [run('VALUES', { size: 24, bold: true, color: 'F5C242' })] }),
        new d.Paragraph({
          alignment: d.AlignmentType.JUSTIFIED, spacing: { after: 160, line: 264 },
          children: [run('To achieve its mission and vision, our company must put into reality its vision and mission through the values it exercises, while giving quality service.', { size: 20, color: 'FFFFFF' })],
        }),
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER, spacing: { after: 0 },
          children: [run('RESPECT     •     UNITY     •     COMMITMENT     •     INNOVATION     •     LOYALTY     •     HONESTY', { size: 20, bold: true, color: 'FFFFFF' })],
        }),
      ], { w: W, fill: C.blue, va: d.VerticalAlign.TOP })],
    }),
  ], [W], { borderless: true }),

  pageBreak(),
];

// ------------------------------------------------------------ CONTROL SHEET
const controlSheet = (pageMap) => {
  const CW = [1900, 3100, 1900, 2846];
  const r = (a, b, c, e) => new d.TableRow({ cantSplit: true,
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
      r('Chapter', 'PERSONNEL', 'Entry No.', 'A-01'),
      r('Section', 'DISCIPLINE', 'Annex', 'A'),
      r('Entry Title', 'CODE OF DISCIPLINE', 'Edition', 'Series 2, 2026'),
      r('Original Issue', 'February 5, 2025', 'Revised On', 'August 28, 2026'),
      new d.TableRow({ cantSplit: true,
        children: [
          tCell('Supersedes', { w: CW[0], bold: true, fill: 'EDF1F8' }),
          tCell('Series 1, 2025 Edition', { w: CW[1], bold: true }),
          tCell('Effectivity', { w: CW[2], bold: true, fill: 'EDF1F8' }),
          tCell('Thirty (30) days from posting and distribution', { w: CW[3], bold: true }),
        ],
      }),
      new d.TableRow({ cantSplit: true,
        children: [
          tCell('Prepared by', { w: CW[0], bold: true, fill: 'EDF1F8' }),
          tCell('Human Resources Department', { w: CW[1], bold: true }),
          tCell('Approved by', { w: CW[2], bold: true, fill: 'EDF1F8' }),
          tCell('THE MANAGEMENT', { w: CW[3], bold: true }),
        ],
      }),
    ], CW),

    gap(280),
    secHead('Why this edition was issued'),
    p('This Series 2, 2026 Edition replaces the Series 1, 2025 Edition of the TXTAIRE OPC Code of Discipline in its entirety. It was issued for four reasons:'),
    bullet([
      run('To match the size of the Company. ', { bold: true }),
      run('TXTAIRE OPC currently employs about twenty (20) people and expects to grow to about one hundred (100) within the next year. The previous edition assumed a large organisation with several layers of managers. This edition sets out procedures that a twenty-person company can actually carry out today, and that will still work at one hundred.'),
    ]),
    bullet([
      run('To make the penalties fair and proportionate. ', { bold: true }),
      run('A number of offenses in the previous edition carried dismissal on the very first commission, or suspensions of thirty (30) days, even for lapses that caused no loss to the Company. Penalties in this edition are graduated: light offenses are corrected, and dismissal is reserved for the serious causes recognised by law.'),
    ]),
    bullet([
      run('To comply with the Labor Code and current DOLE regulations. ', { bold: true }),
      run('Provisions that exposed the Company to legal risk have been removed, including the imposition of fines and the withholding of pay for hours actually worked. Procedural due process has been written out in full, following the twin-notice rule.'),
    ]),
    bullet([
      run('To state the Company’s ethical standards in writing. ', { bold: true }),
      run('Part II of this Code is new. It states plainly what TXTAIRE expects of every employee before any question of discipline arises.'),
    ], { after: 200 }),

    note('Reading this Code', [
      'This Code is written to be read by everyone, not only by lawyers and managers. If any provision of this Code is unclear to you, or appears to conflict with your employment contract or with law, ask the Human Resources Department. Where any provision of this Code conflicts with the Labor Code of the Philippines, its Implementing Rules, or an issuance of the Department of Labor and Employment, the law prevails and this Code shall be read as amended accordingly.',
    ]),
    pageBreak(),
  ];
};

// ------------------------------------------------------- TABLE OF CONTENTS
const TOC_ENTRIES = [
  ['part', 'SUMMARY', 'SUMMARY OF CHANGES FROM THE 2025 EDITION', 'soc'],
  ['item', 'A', 'Penalties that were reduced', 'socA'],
  ['item', 'B', 'Provisions withdrawn as contrary to law', 'socB'],
  ['item', 'C', 'What is new in this edition', 'socC'],
  ['item', 'D', 'Benefits and standards brought up to current law', 'socD'],

  ['part', 'PART I', 'INTRODUCTION AND GENERAL POLICIES', 'p1'],
  ['item', '1.1', 'Objective and Scope', 's1_1'],
  ['item', '1.2', 'Responsibility for Implementation', 's1_2'],
  ['item', '1.3', 'Equal Employment Opportunity and Non-Discrimination', 's1_3'],
  ['item', '1.4', 'Policy on Probationary Employment', 's1_4'],
  ['item', '1.5', 'Definition of Terms', 's1_5'],
  ['item', '1.6', 'Manual Revisions and Suggestions', 's1_6'],

  ['part', 'PART II', 'COMPANY ETHICAL STANDARDS', 'p2'],
  ['item', '2.1', 'Our Values in Practice', 's2_1'],
  ['item', '2.2', 'Standards of Business Conduct', 's2_2'],
  ['item', '2.3', 'Conflict of Interest', 's2_3'],
  ['item', '2.4', 'Gifts, Commissions and Entertainment', 's2_4'],
  ['item', '2.5', 'Confidentiality and Data Privacy', 's2_5'],
  ['item', '2.6', 'Company Property and Resources', 's2_6'],
  ['item', '2.7', 'Conduct Towards Clients and the Public', 's2_7'],
  ['item', '2.8', 'Respect in the Workplace', 's2_8'],
  ['item', '2.9', 'Social Media and Public Communication', 's2_9'],
  ['item', '2.10', 'Reporting Concerns and Protection from Retaliation', 's2_10'],

  ['part', 'PART III', 'THE DISCIPLINARY PROCESS', 'p3'],
  ['item', '3.1', 'Principles of Corrective Discipline', 's3_1'],
  ['item', '3.2', 'Disciplinary Actions Defined', 's3_2'],
  ['item', '3.3', 'Classification of Offenses', 's3_3'],
  ['item', '3.4', 'Schedule of Penalties', 's3_4'],
  ['item', '3.5', 'Mitigating and Aggravating Circumstances', 's3_5'],
  ['item', '3.6', 'Due Process: The Twin-Notice Rule', 's3_6'],
  ['item', '3.7', 'The Administrative Review Panel', 's3_7'],
  ['item', '3.8', 'Preventive Suspension', 's3_8'],
  ['item', '3.9', 'Appeal', 's3_9'],
  ['item', '3.10', 'Habitual Delinquency', 's3_10'],
  ['item', '3.11', 'Prescription and Clearing of Records', 's3_11'],
  ['item', '3.12', 'Restitution and the Prohibition on Fines', 's3_12'],
  ['item', '3.13', 'Management Prerogative and Employee Rights', 's3_13'],

  ['part', 'PART IV', 'SCHEDULE OF OFFENSES', 'p4'],
  ['item', '4.1', 'Offenses Against Attendance and Punctuality', 's4_1'],
  ['item', '4.2', 'Offenses on Timekeeping and Records', 's4_2'],
  ['item', '4.3', 'Offenses Against Health, Safety and Security', 's4_3'],
  ['item', '4.4', 'Offenses Related to Job Performance', 's4_4'],
  ['item', '4.5', 'Offenses Against Company and Client Property', 's4_5'],
  ['item', '4.6', 'Offenses Against Honesty and Integrity', 's4_6'],
  ['item', '4.7', 'Offenses Against Proper Conduct and Behavior', 's4_7'],
  ['item', '4.8', 'Accountability of Supervisors and Managers', 's4_8'],

  ['part', 'PART V', 'WORKPLACE STANDARDS AND BENEFITS', 'p5'],
  ['item', '5.1', 'Hours of Work, Attendance and Punctuality', 's5_1'],
  ['item', '5.2', 'Overtime, Undertime and Rest Days', 's5_2'],
  ['item', '5.3', 'Leaves of Absence', 's5_3'],
  ['item', '5.4', 'Payroll and Timekeeping', 's5_4'],
  ['item', '5.5', 'Holiday Pay Rules', 's5_5'],
  ['item', '5.6', 'Statutory Benefits', 's5_6'],
  ['item', '5.7', 'Occupational Safety and Health', 's5_7'],
  ['item', '5.8', 'Drug-Free Workplace', 's5_8'],
  ['item', '5.9', 'Anti-Sexual Harassment and Safe Spaces', 's5_9'],
  ['item', '5.10', 'Mental Health and Non-Discrimination in Health', 's5_10'],

  ['part', 'PART VI', 'EMPLOYMENT ACTIONS AND SEPARATION', 'p6'],
  ['item', '6.1', 'Promotions, Transfers and Reclassification', 's6_1'],
  ['item', '6.2', 'Performance Evaluation', 's6_2'],
  ['item', '6.3', 'Termination by the Employer', 's6_3'],
  ['item', '6.4', 'Resignation', 's6_4'],
  ['item', '6.5', 'Final Pay, Clearance and Certificate of Employment', 's6_5'],

  ['part', 'ANNEXES', 'FORMS AND REFERENCE', 'p7'],
  ['item', 'A', 'Notice to Explain (NTE)', 'anxA'],
  ['item', 'B', 'Employee Written Explanation', 'anxB'],
  ['item', 'C', 'Notice of Administrative Conference', 'anxC'],
  ['item', 'D', 'Case Evaluation Form', 'anxD'],
  ['item', 'E', 'Notice of Decision', 'anxE'],
  ['item', 'F', 'Compliance Checklist as Headcount Grows', 'anxF'],
  ['item', 'G', 'Employee Acknowledgment and Conforme', 'anxG'],
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

const toc = (pageMap) => {
  pageMap = pageMap || {};
  return [
    table([new d.TableRow({ cantSplit: true,
      children: [cell(new d.Paragraph({
        spacing: { after: 0 },
        children: [run('  TABLE OF CONTENTS  ', { size: 30, bold: true, color: 'FFFFFF' })],
      }), { w: W, fill: C.blue })],
    })], [W], { borderless: true }),
    gap(300),
    ...TOC_ENTRIES.map((e) => tocLine(e[0], e[1], e[2], pageMap[e[3]])),
    pageBreak(),
  ];
};

module.exports = { cover, missionVision, controlSheet, toc, TOC_ENTRIES };
