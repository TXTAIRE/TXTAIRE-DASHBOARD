const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, pageBreak, secHead, subHead,
        cell, tCell, table, note, chgRun, CHG } = L;

// Legend explaining the NEW / REVISED pills used throughout the document.
const markerLegend = () => {
  const LW = [1700, 8046];
  const row = (kind, meaning) => new d.TableRow({
    cantSplit: true,
    children: [
      cell(new d.Paragraph({
        alignment: d.AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new d.TextRun({
          text: ' ' + CHG[kind].text + ' ', font: L.F, size: 15, bold: true,
          color: CHG[kind].fg,
          shading: { type: d.ShadingType.CLEAR, fill: CHG[kind].bg, color: 'auto' },
        })],
      }), { w: LW[0] }),
      tCell(meaning, { w: LW[1], va: d.VerticalAlign.CENTER }),
    ],
  });
  return table([
    new d.TableRow({
      cantSplit: true,
      children: [
        tCell('MARKER', { w: LW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18, align: d.AlignmentType.CENTER }),
        tCell('WHAT IT MEANS WHERE YOU SEE IT', { w: LW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
      ],
    }),
    row('new', 'This provision did not exist in the Series 1, 2025 Edition. It is new in this edition.'),
    row('rev', 'This provision existed in the previous edition but has materially changed — usually a lighter penalty, a corrected legal position, or a procedure the previous edition did not spell out. In the offense tables this appears as REV.'),
    row('rem', 'This provision existed in the previous edition and has been withdrawn. Where a withdrawal has legal consequences, the reason is stated in full at Section 3.12.'),
  ], LW);
};

// ------------------------------------------------------- SUMMARY OF CHANGES
const CMP_W = [2050, 3748, 3948];

const cmpHeader = (label) => new d.TableRow({
  cantSplit: true,
  tableHeader: true,
  children: [
    tCell(label, { w: CMP_W[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
    tCell('SERIES 1, 2025 EDITION', { w: CMP_W[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
    tCell('SERIES 2, 2026 EDITION', { w: CMP_W[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 17 }),
  ],
});

const cmpRow = (area, before, after, kind) => new d.TableRow({
  cantSplit: true,
  children: [
    cell([
      new d.Paragraph({
        spacing: { after: kind ? 40 : 0, line: 240 },
        children: [run(area, { size: 18, bold: true, color: C.navy })],
      }),
      ...(CHG[kind] ? [new d.Paragraph({
        spacing: { after: 0, line: 200 },
        children: [new d.TextRun({
          text: ' ' + CHG[kind].text + ' ', font: L.F, size: 12, bold: true,
          color: CHG[kind].fg,
          shading: { type: d.ShadingType.CLEAR, fill: CHG[kind].bg, color: 'auto' },
        })],
      })] : []),
    ], { w: CMP_W[0], va: d.VerticalAlign.TOP }),
    tCell(before, { w: CMP_W[1], va: d.VerticalAlign.TOP, size: 17 }),
    tCell(after, { w: CMP_W[2], va: d.VerticalAlign.TOP, size: 17 }),
  ],
});

const cmpTable = (label, rows) => table(
  [cmpHeader(label)].concat(rows.map(r => cmpRow(r[0], r[1], r[2], r[3]))),
  CMP_W);

const summaryOfChanges = () => [
  secHead('Summary of Changes', 'new'),
  p('This section is a map of what moved between the Series 1, 2025 Edition and this one. It is provided so that HR, management and any reviewer can see the changes without reading both editions side by side, and so that employees can see plainly that no change in this edition makes their position worse.'),
  p('Throughout this document, the following markers appear beside a Part, a section heading, or an offense:'),
  gap(60),
  markerLegend(),

  subHead('A.  Penalties that were reduced'),
  p('Every change in this group makes the Code lighter on the employee. None of them removes the Company’s ability to act; each replaces an automatic dismissal or a very long suspension with a graduated response.'),
  cmpTable('OFFENSE', [
    ['Fighting on company premises', 'Dismissal on the 1st offense.', 'Class C — 7-day suspension, then 15 days, then dismissal. Dismissal on the 1st offense is kept only where serious injury results, a weapon is used, or the employee was the instigator (Sec. 4.7).', 'rev'],
    ['Gambling on premises', 'Dismissal on the 1st offense.', 'Class B — written warning, then 3 days, 7 days, dismissal (Sec. 4.7).', 'rev'],
    ['Intrigues and malicious rumours', '15-day suspension, then dismissal.', 'Class B (Sec. 4.7).', 'rev'],
    ['Borrowing from, or soliciting from, a subordinate', 'Dismissal on the 1st offense.', 'Class C, unless coercion or abuse of authority is shown, in which case Sec. 4.8 applies (Sec. 4.7).', 'rev'],
    ['Failure to report an accident or unsafe condition', '30-day suspension, then dismissal.', 'Class B. A severe penalty here suppresses the reporting the rule exists to produce (Sec. 4.3).', 'rev'],
    ['Willful disobedience of a safety instruction', '30-day suspension, then dismissal.', 'Class D where the act exposes a person to death or serious injury; Class B where it was inadvertent and caused no injury (Sec. 4.3).', 'rev'],
    ['Drinking alcohol on premises', '15-day suspension, then dismissal.', 'Class C; Class D only for safety-critical roles — driving, work at height, energised equipment (Sec. 4.3).', 'rev'],
    ['Gross discourtesy to any person', '15 days, 30 days, then dismissal.', 'Class B for discourtesy to a client; Class D only where a client account or the Company’s reputation is seriously damaged (Sec. 4.7).', 'rev'],
    ['Negligence causing loss', 'Tiers began at ₱200.', 'Tiers begin at ₱5,000 and step at ₱30,000. ₱200 is no longer a meaningful amount (Sec. 4.4).', 'rev'],
    ['Insubordination', '10 days, 15 days, then dismissal.', 'Class C, and the Code now states the three things that must be shown before an order counts as one that was disobeyed (Sec. 4.4).', 'rev'],
    ['Uniform and grooming, phone availability, housekeeping, tardiness', 'Mixed schedules, some rising to dismissal.', 'All Class A — corrected by warning first (Sec. 4.1, 4.3, 4.4).', 'rev'],
    ['Longest suspension available', 'Up to 30 days, imposed as a penalty.', 'Capped at 15 working days. A 30-day penalty suspension invites a constructive-dismissal finding (Sec. 3.2).', 'rev'],
    ['Off-duty conduct away from company premises', 'A fight outside the premises unconnected to work drew 15 days, then dismissal.', 'Outside the scope of this Code altogether, unless connected to work, committed against the Company, a co-employee or a client, or demonstrably damaging to the business (Sec. 1.1).', 'rev'],
  ]),

  subHead('B.  Provisions withdrawn as contrary to law'),
  p('Each of the following appeared in the Series 1 Edition and is withdrawn. They are set out in full at Section 3.12 so that the reason is on the record.'),
  cmpTable('PROVISION', [
    ['Pay withheld for a missed time entry', 'An employee who forgot to punch in or out "shall be marked absent and without pay for that day."', 'Withdrawn. An employee who actually rendered work must be paid for it. The entry is corrected on a Time Correction Form certified by the immediate superior, and the lapse is a Class A offense at most (Sec. 3.12, Sec. 4.2).', 'rem'],
    ['The ₱500 fine and confiscation of the phone', 'A ₱500 fine and confiscation of the unit for failing to keep a company phone reachable.', 'Withdrawn. A fine is not among the deductions Article 113 of the Labor Code permits. The offense remains, as Class A, with no fine (Sec. 3.12, Sec. 4.4).', 'rem'],
    ['Two months’ salary for short resignation notice', 'An employee who failed to serve 30 days’ notice was "liable for liquidated damages equivalent to at least two (2) months’ salary."', 'Withdrawn. Actual damage must be proved in the proper forum. Final pay and the Certificate of Employment may never be withheld over short notice (Sec. 6.4).', 'rem'],
    ['On-the-spot drug testing', 'The Company could test on suspicion and compel a sample on the spot.', 'Withdrawn. Testing goes through a DOH-accredited laboratory with a confirmatory test and a right to challenge, per RA 9165 and DO 53-03 (Sec. 5.8).', 'rem'],
    ['Termination of probationary employees at will', 'The Company had "absolute discretion to terminate at any time."', 'Withdrawn. Separation requires either a just or authorized cause with due process, or failure to meet standards communicated in writing at engagement, with 5 days’ notice (Sec. 1.4).', 'rem'],
    ['Restitution by deduction', 'Deduction from wages was assumed.', 'Permitted only on the employee’s written authorization, capped at 20% of net pay per period, never below minimum wage. Refusing to authorize a deduction is not an offense (Sec. 3.12).', 'rev'],
  ]),

  subHead('C.  What is new in this edition'),
  cmpTable('ADDED', [
    ['Part II — Company Ethical Standards', 'The previous edition had no statement of ethical standards.', 'A full Part: values in practice, standards of business conduct, conflict of interest with a duty to declare, a ₱1,000 gift ceiling with solicitation banned outright, confidentiality and Data Privacy Act duties, client-site conduct, respect in the workplace, social media, and a reporting channel protected against retaliation.', 'new'],
    ['Sec. 3.4 — one Schedule of Penalties', 'Penalties were written per offense, with no stated scheme, so like offenses drew unlike penalties.', 'Four classes (A Light, B Less Grave, C Grave, D Serious) and a single penalty table for the whole Code. Each offense simply carries a class.', 'new'],
    ['Sec. 3.5 — mitigating and aggravating circumstances', 'None. The schedule was applied mechanically.', 'Nine mitigating and nine aggravating circumstances, with the power to move one step in either direction, recorded in writing on the Case Evaluation Form.', 'new'],
    ['Sec. 3.6 — due process in full', 'Referred to a hearing, without stating the notices, their contents, or the periods.', 'The twin-notice rule set out step by step per Article 292(b) and DO 147-15: what the Notice to Explain must contain, a minimum of five calendar days to answer, the conference, the decision notice.', 'new'],
    ['Sec. 3.7 — panel scaled to headcount', 'A 3-manager Administrative Hearing Committee for every case — unworkable at twenty employees.', 'Supervisor and HR handle Class A and B; a three-member panel convenes only for Class C, Class D and any case where dismissal is considered, with disqualification rules.', 'rev'],
    ['Sec. 3.11 — prescription and clearing of records', 'Not addressed.', 'A 60-day period to commence a proceeding (one year for fraud, dishonesty, harassment and violence), and penalties cleared from the progression after 12 clean months.', 'new'],
    ['Sec. 3.13 — employee rights', 'Not stated.', 'Eight rights that no provision of the Code may be read to waive, including the right to bring a grievance to the DOLE or the NLRC without reprisal.', 'new'],
    ['Sec. 4.8 — supervisor and manager accountability', 'Two offenses (failure to disseminate, failure to report).', 'Eleven, including informal punishment imposed outside the Code, misuse of preventive suspension, concealing a harassment report, and retaliation.', 'rev'],
    ['Sec. 5.7 to 5.10', 'Not addressed.', 'Occupational safety and health (RA 11058), the drug-free workplace programme, anti-sexual harassment and the CODI (RA 7877 and RA 11313), mental health and non-discrimination in health (RA 11036, RA 11166).', 'new'],
    ['Annexes A to G', 'No forms.', 'Notice to Explain, employee written explanation, notice of conference, case evaluation form, notice of decision, a compliance checklist keyed to headcount, and the employee acknowledgment.', 'new'],
  ]),

  subHead('D.  Benefits and standards brought up to current law'),
  cmpTable('AREA', [
    ['Maternity leave', 'Referred generally to "existing laws."', '105 days with full pay, 120 for a qualified solo parent, 60 for miscarriage, with 7 transferable days (RA 11210).', 'rev'],
    ['Solo parent leave', '7 days, citing the superseded law.', '7 working days under RA 11861, with the ID requirement stated.', 'rev'],
    ['Leave for victims of violence', 'Not provided.', '10 days with pay under RA 9262, with a confidentiality duty.', 'new'],
    ['Special leave for women', 'Not provided.', 'Up to two months following gynaecological surgery (RA 9710).', 'new'],
    ['Bereavement leave', 'Not provided.', 'Three days with pay, as a company benefit.', 'new'],
    ['Grace period', '10 minutes; excessive tardiness at 260 minutes a month.', '15 minutes, in recognition of travel to Laguna, Manila and client sites; excessive tardiness at 300 minutes a month.', 'rev'],
    ['Sick leave', 'A medical certificate was required for every sick leave.', 'Required for absences of three or more consecutive days. A missing certificate for a shorter absence no longer converts an excused absence into an unauthorized one.', 'rev'],
    ['Overtime', 'Unauthorized overtime was simply not payable.', 'Overtime the immediate superior knew of and allowed must be paid; the missing authorization is a Class A matter at most (Sec. 5.2).', 'rev'],
    ['Final pay and Certificate of Employment', 'Not addressed.', 'Final pay within 30 days (Labor Advisory 06-20); a Certificate of Employment within 3 days of request, never conditioned on signing a quitclaim (Sec. 6.5).', 'new'],
    ['Poor performance', 'Treated together with misconduct.', 'Separated: a written Performance Improvement Plan with at least 60 days, not discipline (Sec. 6.2).', 'new'],
  ]),
  gap(160),
  note('Nothing in this edition reduces an existing benefit', [
    'Article 100 of the Labor Code prohibits the elimination or diminution of benefits employees already enjoy. Every change listed above either lightens a penalty, adds a protection, adds a benefit, or corrects a provision that was unlawful. No entitlement that existed under the Series 1 Edition has been reduced or withdrawn by this edition.',
    'Where a provision of the previous edition was withdrawn, it was withdrawn because it took something from the employee that the law does not allow the Company to take.',
  ], { edge: C.newTxt, fill: 'F1F8F1', labelColor: C.newTxt }),
];

module.exports = { summaryOfChanges, markerLegend };
