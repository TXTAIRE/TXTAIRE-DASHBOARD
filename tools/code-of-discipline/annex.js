const L = require('./lib.js');
const { d, C, W, img, run, p, bullet, gap, pageBreak, pageBreakBefore, partHead, secHead, subHead,
        cell, tCell, table, note, thin, noBorder } = L;

const B = (t) => run(t, { bold: true });

// letterhead used at the top of each form
// No logo here: the running page header already carries it, and repeating it inside the
// form letterhead put the same mark twice on every form page. The letterhead is now just
// the identifying line, which also buys back vertical space on each form.
const formHead = (title, code) => [
  pageBreakBefore(),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 20 },
    children: [run('TXTAIRE OPC', { size: 21, bold: true, color: C.navy }),
               run('   ·   Human Resources Department', { size: 18, color: C.grey })],
  }),
  new d.Paragraph({
    alignment: d.AlignmentType.RIGHT, spacing: { after: 0 },
    children: [run('Form ' + code + '  |  Code of Discipline, Series 2, 2026 Edition', { size: 16, color: C.grey })],
  }),
  gap(130),
  new d.Paragraph({
    alignment: d.AlignmentType.CENTER,
    spacing: { after: 200 },
    shading: { type: d.ShadingType.CLEAR, fill: C.blue, color: 'auto' },
    children: [run(title.toUpperCase(), { size: 24, bold: true, color: 'FFFFFF' })],
  }),
];

// a labelled fill-in line
const fld = (label, w2) => new d.TableRow({ cantSplit: true,
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

// blank writing area with ruled lines
const ruled = (lines, label) => [
  ...(label ? [new d.Paragraph({ spacing: { before: 140, after: 80 }, children: [run(label, { size: 19, bold: true, color: C.navy })] })] : []),
  table(Array.from({ length: lines }, () => new d.TableRow({ cantSplit: true,
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
  table([new d.TableRow({ cantSplit: true,
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
  ...partHead('ANNEXES', 'Forms and Reference', 'new'),
  p('The forms in these Annexes are the standard forms of the Human Resources Department. They may be reproduced and completed by hand or electronically. Using them is not optional: a disciplinary action recorded on anything else is harder to defend, and a Notice to Explain that omits any of the elements in Annex A is legally defective.'),
  p(L.pick(
    'They fit together in order. Annex A goes out first; Annex B comes back from the employee; Annex C is issued only if a conference is to be held; Annex D is the panel’s working paper and is never given to the employee; Annex E closes the case and is served on the employee. Annex F is a planning checklist for HRD rather than a case form, and Annex G is signed once, on receipt of this Code, and filed in the 201 file.',
    'They fit together in order. Annex A goes out first; Annex B is your written explanation and comes back from you; Annex C is issued only if a conference is to be held; Annex D is the panel’s working paper and is never given to the employee; Annex E closes the case and is served on you. Annex G is signed once, on receipt of this Code, and filed in your 201 file.')),

  // ---------------------------------------------------------------- ANNEX A
  ...formHead('Annex A  —  Notice to Explain', 'CD-01'),
  fieldBlock(['Reference No.', 'Date issued', 'Employee name', 'Position / Department', 'Immediate superior']),
  gap(120),
  p('You are hereby directed to explain in writing why no disciplinary action should be taken against you for the act or omission described below.'),
  ...ruled(2, '1.  Specific act or omission complained of (state WHAT was done, and the DATE, TIME and PLACE):'),
  ...ruled(2, '2.  Provision of the Code of Discipline or company rule violated (state the section number and the offense):'),
  ...ruled(1, '3.  Class of offense and penalty being considered:'),
  gap(120),
  p([B('4.  Your right to explain. '), run('You are required to submit a written explanation to the Human Resources Department within five (5) calendar days from your receipt of this notice, that is, on or before ______________________. You may attach any document and name any witness. You may be assisted by a representative or counsel of your own choosing, at your own expense, and may request an extension in writing.')]),
  p([B('5.  Administrative conference. '), run('A conference will be scheduled if you request one, if the facts are disputed, or if dismissal is being considered. You will be given written notice at least three (3) working days in advance.')]),
  p([B('6.  Failure to respond. '), run('If you do not reply within the period given and do not ask for an extension, the case will be decided on the records available. Failure to reply is not by itself an admission.')]),
  p([run('7.  If the employee refuses to receive or sign. ', { bold: true, size: 19 }), run('Annotate the refusal below before a witness, and send a copy to the employee’s last known address by registered mail or courier.', { size: 19 })], { after: 40 }),
  ...ruled(1),
  ...signBlock('Issued by (HRD) — Signature over printed name', 'Received by (Employee) — Signature and date'),

  // ---------------------------------------------------------------- ANNEX B
  ...formHead('Annex B  —  Employee Written Explanation', 'CD-02'),
  fieldBlock(['NTE Reference No.', 'Date of this reply', 'Employee name', 'Position / Department']),
  gap(200),
  ...ruled(10, 'My explanation (state your side of the facts; attach additional sheets and documents if needed):'),
  gap(160),
  ...ruled(1, 'Documents attached:'),
  ...ruled(1, 'Witnesses I wish to present (name and what each will say):'),
  gap(160),
  table([new d.TableRow({ cantSplit: true,
    children: [cell([
      new d.Paragraph({ spacing: { after: 60 }, children: [run('Please indicate:', { size: 19, bold: true, color: C.navy })] }),
      new d.Paragraph({ spacing: { after: 40 }, children: [run('[   ]   I request an administrative conference.', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 40 }, children: [run('[   ]   I do not request a conference and submit the matter on this written explanation.', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 0 }, children: [run('[   ]   I will be assisted by a representative or counsel:  ______________________________', { size: 19 })] }),
    ], { w: W, fill: 'F4F7FC', va: d.VerticalAlign.TOP })],
  })], [W]),
  ...signBlock('Employee — Signature over printed name', 'Date and time received by HRD'),

  // ---------------------------------------------------------------- ANNEX C
  ...formHead('Annex C  —  Notice of Administrative Conference', 'CD-03'),
  fieldBlock(['NTE Reference No.', 'Date issued', 'Employee name', 'Position / Department', 'Date of conference', 'Time', 'Venue']),
  gap(200),
  p('An administrative conference will be held on the date, time and place stated above in connection with the Notice to Explain referred to above. At the conference you will be given the opportunity to explain your side, to present documents and witnesses, and to answer questions about the matter.'),
  p('You may be assisted by a representative or counsel of your own choosing, at your own expense. Please bring any document you wish the panel to consider.'),
  p('The technical rules of evidence do not apply. If you cannot attend on the scheduled date for a valid reason, notify HRD in writing before the schedule so that it may be reset. If you do not appear and give no valid reason, the case will be decided on the records.'),
  gap(160),
  ...(() => {
    const PW = [3400, 6346];
    return [table([
      new d.TableRow({ cantSplit: true, children: [
        tCell('PANEL / OFFICERS PRESENT', { w: PW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        tCell('NAME AND POSITION', { w: PW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
      ] }),
      ...['Chair (HR Head)', 'Member (Department Head)', 'Member (peer of respondent)', 'Recorder'].map((r) => new d.TableRow({ cantSplit: true,
        children: [tCell(r, { w: PW[0], bold: true, color: C.navy }), tCell('', { w: PW[1] })],
      })),
    ], PW)];
  })(),
  ...signBlock('Issued by (HRD)', 'Received by (Employee) — Signature and date'),

  // ---------------------------------------------------------------- ANNEX D
  ...formHead('Annex D  —  Case Evaluation Form', 'CD-04'),
  fieldBlock(['Case / NTE Reference No.', 'Employee name', 'Position / Department', 'Date of incident', 'Date of NTE', 'Date explanation received', 'Date of conference']),
  gap(200),
  ...ruled(2, '1.  Findings of fact (what the panel finds actually happened, and on what evidence):'),
  ...ruled(1, '2.  Provision of the Code violated, and class of offense:'),
  ...ruled(1, '3.  The employee’s explanation, and whether it is accepted — with the reason why or why not:'),
  ...ruled(1, '4.  Prior record within the last twelve (12) months (list each prior penalty and its date; state "none" if none):'),
  gap(160),
  ...(() => {
    const MW = [4873, 4873];
    return [table([
      new d.TableRow({ cantSplit: true, children: [
        tCell('5.  Mitigating circumstances considered (Sec. 3.5)', { w: MW[0], bold: true, color: 'FFFFFF', fill: '4C8C2B', size: 18 }),
        tCell('6.  Aggravating circumstances considered (Sec. 3.5)', { w: MW[1], bold: true, color: 'FFFFFF', fill: 'A8342A', size: 18 }),
      ] }),
      new d.TableRow({ cantSplit: true, children: [
        cell(Array.from({ length: 2 }, () => new d.Paragraph({ spacing: { after: 120 }, border: { bottom: thin('AAAAAA') }, children: [run(' ', { size: 19 })] })), { w: MW[0], va: d.VerticalAlign.TOP }),
        cell(Array.from({ length: 2 }, () => new d.Paragraph({ spacing: { after: 120 }, border: { bottom: thin('AAAAAA') }, children: [run(' ', { size: 19 })] })), { w: MW[1], va: d.VerticalAlign.TOP }),
      ] }),
    ], MW)];
  })(),
  gap(160),
  ...ruled(1, '7.  Penalty under the schedule (Sec. 3.4), and recommended penalty if different — with the reason for the difference:'),
  ...ruled(1, '8.  Restitution, if any, and whether the employee has given written authorization for any deduction (Sec. 3.12):'),
  gap(110),
  ...(() => {
    const SW = [3050, 300, 3046, 300, 3050];
    const sig = (label) => cell([
      new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
      new d.Paragraph({ spacing: { after: 0 }, children: [run(label, { size: 16, color: C.grey })] }),
    ], { w: 3050, va: d.VerticalAlign.BOTTOM });
    const sp = () => cell(new d.Paragraph({ spacing: { after: 0 }, children: [run(' ')] }), { w: 300 });
    return [table([new d.TableRow({ cantSplit: true,
      children: [sig('Panel Chair'), sp(), sig('Member'), sp(), sig('Member')],
    })], SW, { borderless: true })];
  })(),
  new d.Paragraph({
    spacing: { before: 150, after: 0, line: 400 },
    border: { bottom: thin('AAAAAA') },
    children: [run('Action of the Owner / General Manager:', { size: 19, bold: true, color: C.navy })],
  }),

  // ---------------------------------------------------------------- ANNEX E
  ...formHead('Annex E  —  Notice of Decision', 'CD-05'),
  fieldBlock(['Case / NTE Reference No.', 'Date issued', 'Employee name', 'Position / Department']),
  gap(120),
  p('After considering the Notice to Explain dated ______________, your written explanation dated ______________, the administrative conference held on ______________, and the evidence on record, the Company has reached the following decision.'),
  ...ruled(2, '1.  Findings:'),
  ...ruled(1, '2.  Provision of the Code of Discipline violated:'),
  ...ruled(2, '3.  Why your explanation was accepted / not accepted:'),
  gap(160),
  ...(() => {
    const DW = [3200, 6546];
    return [table([
      new d.TableRow({ cantSplit: true, children: [
        tCell('PENALTY IMPOSED', { w: DW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        tCell('DETAILS', { w: DW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
      ] }),
      ...[
        ['[   ]  No penalty — case dismissed', ''],
        ['[   ]  Verbal Warning', ''],
        ['[   ]  Written Warning', ''],
        ['[   ]  Suspension', 'Number of working days: ________   From: ____________  To: ____________'],
        ['[   ]  Dismissal', 'Effective date of separation: ________________________'],
      ].map((r) => new d.TableRow({ cantSplit: true,
        children: [tCell(r[0], { w: DW[0], bold: true }), tCell(r[1], { w: DW[1] })],
      })),
    ], DW)];
  })(),
  gap(200),
  p([B('Your right of appeal. '), run('You may ask for reconsideration by filing a written Letter of Appeal with HRD within five (5) calendar days from receipt of this notice, stating the grounds and attaching any new evidence. It will be resolved in writing within fifteen (15) calendar days. Nothing here limits your right to bring the matter before the DOLE or any other body having jurisdiction.')]),
  ...signBlock('Approved by (Owner / General Manager)', 'Received by (Employee) — Signature and date'),

  // ---------------------------------------------------------------- ANNEX F
  // HR planning material -- headcount thresholds and what to do before each one.
  // It is not a case form and an employee has no use for it, so the employee copy
  // omits it. Section 5.7's cross-reference to it is dropped there too.
  ...L.hrOnly(
    ...formHead('Annex F  —  Compliance Checklist as Headcount Grows', 'CD-06'),
    p('Several legal obligations are triggered by headcount, and the Company expects to grow from about twenty (20) to about one hundred (100) within the next year. This checklist is for HRD’s planning. It is a summary, not a substitute for the issuances themselves; confirm current thresholds with the DOLE Regional Office before each milestone.', { after: 100 }),
    ...(() => {
      const CW = [1500, 4400, 3846];
      const PAD = { top: 26, bottom: 26, left: 80, right: 80 };
      const rows = [
        ['Any size', 'Register the establishment with DOLE (Rule 1020); keep an OSH programme; provide free PPE; keep an accident logbook; report accidents and illnesses.', 'RA 11058 / DO 198-18'],
        ['Any size', 'Constitute a Committee on Decorum and Investigation; post the anti-sexual harassment policy conspicuously; conduct gender sensitivity orientation.', 'RA 7877 / RA 11313'],
        ['Any size', 'Adopt and post a workplace policy and programme on HIV and AIDS, tuberculosis, Hepatitis B, drug-free workplace and mental health.', 'RA 11166, DO 73-05, DO 05-10, DO 53-03, RA 11036'],
        ['Any size', 'Provide a lactation station and lactation breaks; maintain the required first aid kit.', 'RA 10028'],
        ['Any size', 'Register with SSS, PhilHealth and Pag-IBIG; remit contributions on time; issue itemised payslips.', 'SSS, PhilHealth, HDMF laws'],
        ['10 or more', 'Appoint at least one certified first-aider and a trained Safety Officer 1; all workers to complete the mandatory 8-hour OSH seminar.', 'DO 198-18'],
        ['10 or more', 'Post the Code of Discipline and other work rules where employees can read them; keep employment records at the workplace.', 'Labor Code, Rule X'],
        ['11 to 50', 'Constitute the Health and Safety Committee; appoint a Safety Officer 2 where the workplace is classified as high risk (electrical, work at height, confined space — which covers much of the Company’s field work).', 'DO 198-18'],
        ['21 or more', 'Employ a part-time occupational health physician and nurse, or arrange the required retainer and referral where the workplace is low risk.', 'OSHS Rule 1960'],
        ['50 or more', 'Employ a full-time Safety Officer 2 (or higher, per risk classification); expand the Health and Safety Committee; maintain a treatment room or clinic as required by risk classification.', 'DO 198-18 / OSHS Rule 1960'],
        ['51 or more', 'Consider formalising a grievance machinery and a written salary structure; review whether a rank-and-file union may seek recognition and prepare HR accordingly.', 'Labor Code, Book V'],
        ['100 or more', 'Employ a full-time safety officer and, depending on risk classification, a full-time occupational health nurse; maintain an emergency clinic; expand the Family Welfare Programme.', 'DO 198-18 / OSHS'],
        ['200 or more', 'Establish a Family Welfare Programme with a designated coordinator; review the requirement for a full-time physician and dentist.', 'DOLE Family Welfare Program'],
      ];
      return [table([
        new d.TableRow({ cantSplit: true,
          tableHeader: true,
          children: [
            tCell('HEADCOUNT', { w: CW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 17, align: d.AlignmentType.CENTER }),
            tCell('WHAT MUST BE IN PLACE', { w: CW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
            tCell('SOURCE', { w: CW[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
          ],
        }),
        ...rows.map((r) => new d.TableRow({ cantSplit: true,
          children: [
            tCell(r[0], { w: CW[0], bold: true, color: C.navy, align: d.AlignmentType.CENTER, va: d.VerticalAlign.TOP, size: 16, pad: PAD, line: 215 }),
            tCell(r[1], { w: CW[1], va: d.VerticalAlign.TOP, size: 16, pad: PAD, line: 215 }),
            tCell(r[2], { w: CW[2], va: d.VerticalAlign.TOP, size: 15, italics: true, pad: PAD, line: 215 }),
          ],
        })),
      ], CW)];
    })(),
    gap(120),
    note('Two things to do before headcount reaches fifty', [
      'First, appoint and train the Safety Officer now rather than at the threshold. Certification takes time, and the Company’s field work — electrical, refrigerant under pressure, rooftop and elevated work — is high risk regardless of headcount.',
      'Second, put the Administrative Review Panel on a proper footing. At twenty employees the Panel will often be the same three people. At one hundred it must be possible to constitute a Panel with no one who has an interest in the case. Identify and train a pool of at least six potential members.',
    ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),
  ),

  // ---------------------------------------------------------------- ANNEX G
  ...formHead('Annex G  —  Employee Acknowledgment and Conforme', 'CD-07'),
  gap(200),
  p('I acknowledge that I have received a copy of the TXTAIRE OPC Code of Discipline, Series 2, 2026 Edition.'),
  p('I confirm that its contents were explained to me, that I had the opportunity to ask questions about any provision I did not understand, and that my questions were answered.'),
  p('I understand that this Code sets out the Company’s ethical standards, the conduct expected of me, the offenses recognised by the Company and the corresponding penalties, and the procedure that the Company will follow before any penalty is imposed on me.'),
  p('I understand that I am entitled to written notice of any accusation against me, to at least five (5) calendar days to answer it in writing, to be heard, to be assisted by a representative or counsel of my own choosing, and to appeal any decision.'),
  p('I understand that this Code takes effect thirty (30) days from its distribution, that it replaces the Series 1, 2025 Edition in its entirety, and that it may be amended by the Company in writing, provided no amendment reduces a benefit I am already enjoying or applies retroactively to an act already done.'),
  p('I understand that where any provision of this Code conflicts with the Labor Code of the Philippines, its Implementing Rules, or a DOLE issuance, the law prevails.'),
  gap(300),
  ...(() => {
    const AW = [4873, 4873];
    return [table([new d.TableRow({ cantSplit: true,
      children: [
        cell([
          new d.Paragraph({ spacing: { after: 300 }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 20 }, children: [run('Employee — Signature over printed name', { size: 17, color: C.grey })] }),
          new d.Paragraph({ spacing: { after: 0 }, children: [run('Position / Department: ______________________', { size: 17, color: C.grey })] }),
        ], { w: AW[0], va: d.VerticalAlign.TOP }),
        cell([
          new d.Paragraph({ spacing: { after: 300 }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 40 }, border: { bottom: thin('555555') }, children: [run(' ', { size: 19 })] }),
          new d.Paragraph({ spacing: { after: 20 }, children: [run('Received and witnessed by (HRD)', { size: 17, color: C.grey })] }),
          new d.Paragraph({ spacing: { after: 0 }, children: [run('Date: ______________________', { size: 17, color: C.grey })] }),
        ], { w: AW[1], va: d.VerticalAlign.TOP }),
      ],
    })], AW, { borderless: true })];
  })(),
  gap(400),
  note('For HRD', [
    'File the signed original in the employee’s 201 file. Give the employee a copy of this page together with their copy of the Code. Record the date of distribution in the HRD register — the thirty-day effectivity period, and the Company’s ability to prove that the Code was actually communicated, both run from that date.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),
];

module.exports = { annexes };
