const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, pageBreak, partHead, secHead, subHead,
        cell, tCell, table, note } = L;

const B = (t) => run(t, { bold: true });

// =========================================================== PART I
const part1 = () => [
  ...partHead('PART I', 'Introduction and General Policies'),

  secHead('1.1  Objective and Scope'),
  p('This Code of Discipline is a compilation of the personnel policies, work rules and disciplinary procedures in effect at TXTAIRE OPC. Its purpose is to tell every employee, in plain terms, what the Company expects, what happens when those expectations are not met, and what rights an employee has when a complaint is made against them.'),
  p('This Code covers all employees of TXTAIRE OPC — probationary, regular, project-based, fixed-term and part-time — whether assigned to the Laguna office, the Manila office, or to any client site. It applies during working hours, while on official business or call-out, while using company property or vehicles, and while inside company or client premises.'),
  p('Conduct outside working hours and away from company and client premises is a private matter and is not covered by this Code, except where the conduct is directly connected to the employee’s work, is committed against the Company, a co-employee or a client, or causes demonstrable damage to the Company’s business or reputation.'),

  secHead('1.2  Responsibility for Implementation'),
  p('The Human Resources Department (HRD) shall administer this Code. HRD is responsible for distributing it, explaining it during orientation, keeping the disciplinary records of all employees, ensuring that due process is observed in every case, and reviewing this Code at least once a year.'),
  p('Supervisors and Department Heads shall ensure that the employees under them have read and understood this Code, shall correct minor lapses promptly and informally where that is enough, and shall report violations to HRD within five (5) working days from the time the violation comes to their knowledge. A supervisor who sits on a known violation is himself or herself accountable under Section 4.8.'),
  p('Every employee is responsible for reading this Code, asking about anything unclear, and following it. Ignorance of a provision of this Code is not a defence, but HRD must be able to show that the Code was actually distributed and explained.'),

  secHead('1.3  Equal Employment Opportunity and Non-Discrimination', 'new'),
  p('TXTAIRE OPC provides equal opportunity in employment. The Company shall not discriminate against any employee or applicant on the basis of sex, gender identity or expression, sexual orientation, age, civil or marital status, pregnancy, religion, political belief, ethnicity, indigenous origin, disability, health status including HIV, Hepatitis B or tuberculosis status, or solo parent status.'),
  p('This policy applies to hiring, compensation, benefits, training, assignment, promotion, transfer, discipline and separation. It is supported by Republic Act No. 6725 and Article 133 of the Labor Code (women), Republic Act No. 10911 (age), Republic Act No. 7277 as amended (persons with disability), Republic Act No. 11166 (HIV and AIDS), Republic Act No. 11036 (mental health), and Republic Act No. 11861 (solo parents).'),
  p('An employee who believes they have been discriminated against may raise the matter under Section 2.10. Discrimination by a supervisor or manager is a serious offense under Section 4.8.'),

  secHead('1.4  Policy on Probationary Employment', 'rev'),
  p('The probationary period shall not exceed six (6) months from the date the employee actually started working, except where a longer period is allowed by law or is required by an apprenticeship or training agreement.'),
  p('At the time of engagement, and in writing, the Company shall inform the probationary employee of the reasonable standards they must meet in order to qualify as a regular employee. Where the Company fails to communicate those standards at the start, the employee shall be deemed a regular employee from day one.'),
  p('The immediate superior shall evaluate the probationary employee in writing at least twice during the period — at or about the third month and again before the end of the fifth month — and shall discuss each evaluation with the employee so that any shortfall can still be corrected.'),
  p('A probationary employee may be separated (a) for a just or authorized cause, following the procedure in Section 3.6, or (b) for failure to meet the communicated standards for regularization. In the second case, the Company shall serve a written notice stating which standards were not met, at least five (5) days before the intended date of separation. A probationary employee is entitled to due process; the Company does not have unqualified discretion to terminate at will.'),
  p('An employee who is allowed to work beyond the six-month probationary period becomes a regular employee by operation of law.'),

  secHead('1.5  Definition of Terms'),
  ...(() => {
    const DW = [2500, 7246];
    const rows = [
      ['Company', 'TXTAIRE OPC, and any entity owned or managed by it.'],
      ['Employee', 'Any person employed by the Company, of whatever status or classification.'],
      ['Offense', 'An act or omission that violates this Code, a lawful company policy or instruction, or the law.'],
      ['Verbal Warning (VW)', 'A documented spoken correction given in private by the immediate superior, recorded in writing and filed with HRD.'],
      ['Written Warning (WW)', 'A formal written notice of the violation, stating that a repetition will draw a heavier penalty. Filed in the employee’s 201 file.'],
      ['Suspension (S)', 'A temporary cessation of work as a penalty, without pay, for a stated number of working days. Expressed in this Code as "3d", "7d" or "15d".'],
      ['Preventive Suspension', 'A temporary removal from the workplace during an investigation. It is NOT a penalty and is governed by Section 3.8.'],
      ['Dismissal (D)', 'Termination of employment for a just cause, ending the employer-employee relationship.'],
      ['NTE', 'Notice to Explain — the first of the two written notices required by law (Annex A).'],
      ['Panel', 'The Administrative Review Panel constituted under Section 3.7.'],
      ['201 File', 'The employee’s permanent personnel record kept by HRD.'],
      ['Working day', 'A day on which the employee is scheduled to work, excluding rest days and holidays.'],
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: [
          tCell('TERM', { w: DW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('MEANING IN THIS CODE', { w: DW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({ cantSplit: true,
        children: [
          tCell(r[0], { w: DW[0], bold: true, color: C.navy }),
          tCell(r[1], { w: DW[1] }),
        ],
      })),
    ], DW)];
  })(),

  secHead('1.6  Manual Revisions and Suggestions'),
  p('The Company may revise this Code whenever it develops a more practical or efficient procedure, or whenever a change in law requires it. Revisions shall be issued in writing, posted, distributed to all employees and to every site, and shall take effect thirty (30) days after distribution. No revision shall diminish a benefit that employees are already enjoying, and no revision shall apply retroactively to an offense already committed.'),
  p('Employees are encouraged to submit suggestions to improve this Code. Suggestions may be given to HRD in writing or by e-mail, and may be submitted anonymously.'),
];

// =========================================================== PART II
const part2 = () => [
  ...partHead('PART II', 'Company Ethical Standards', 'new'),

  p('Discipline begins with a shared understanding of what is right. This Part states the ethical standards that TXTAIRE OPC expects of every employee, officer and director. It applies to everyone regardless of rank. Where an act described in this Part is also listed as an offense in Part IV, it is dealt with under Part IV; where it is not, it remains a standard the Company expects you to meet, and a supervisor may address a shortfall through coaching.'),

  secHead('2.1  Our Values in Practice', 'new'),
  p('The Company’s six values are not decorations. Each one has a practical meaning at work:'),
  ...(() => {
    const VW = [2100, 7646];
    const vals = [
      ['RESPECT', 'We treat every co-employee, client, supplier and member of the public with courtesy — including when we disagree, when we are under pressure, and when no one is watching.'],
      ['UNITY', 'We do not undermine a co-employee. We share information a colleague needs to do their job, and we correct problems rather than assign blame.'],
      ['COMMITMENT', 'We do what we said we would do, on the date we said we would do it. If we cannot, we say so early rather than late.'],
      ['INNOVATION', 'We look for a better way of doing the work, and we raise it. A suggestion that is refused is never held against the person who made it.'],
      ['LOYALTY', 'We protect the Company’s and the client’s interests, information and property as if they were our own, and we do not use our position for private gain.'],
      ['HONESTY', 'We report the truth in our timesheets, service reports, liquidations and expense claims — even when the truth reflects badly on us.'],
    ];
    return [table([
      ...vals.map((v) => new d.TableRow({ cantSplit: true,
        children: [
          tCell(v[0], { w: VW[0], bold: true, color: 'FFFFFF', fill: C.blue, align: d.AlignmentType.CENTER }),
          tCell(v[1], { w: VW[1] }),
        ],
      })),
    ], VW)];
  })(),

  secHead('2.2  Standards of Business Conduct', 'new'),
  p('Every employee shall:'),
  bullet('Comply with the laws of the Republic of the Philippines, with this Code, and with the lawful policies and instructions of the Company.'),
  bullet('Perform assigned work competently, safely and on time, and report honestly on what was done.'),
  bullet('Deal fairly with clients, suppliers, contractors, co-employees and competitors. No employee shall take unfair advantage of anyone through manipulation, concealment, abuse of confidential information or misrepresentation.'),
  bullet('Keep accurate records. No employee shall create a false or misleading entry in any company or client record, and no employee shall instruct another to do so.'),
  bullet('Refuse and report any bribe, kickback or improper payment, whether offered or solicited, and whether given in cash, in kind, or as a favour.'),
  bullet('Raise a concern about a possible violation rather than stay silent, using the channels in Section 2.10.', { after: 160 }),

  secHead('2.3  Conflict of Interest', 'new'),
  p('A conflict of interest arises whenever an employee’s private interest could improperly influence — or could reasonably appear to influence — the way they do their job for the Company.'),
  p('The following must be declared in writing to HRD within fifteen (15) days of engagement, or within fifteen (15) days from the moment the situation arises, whichever is later:'),
  bullet('Any financial or ownership interest in a supplier, contractor, competitor or client of the Company, other than shares of a publicly listed company held as an ordinary investment.'),
  bullet('Any outside employment, consultancy, sideline or business, whether or not it competes with the Company.'),
  bullet('Any close personal relationship — spouse, partner, parent, child, sibling, or a relative within the fourth civil degree — with a co-employee whom the employee supervises or evaluates, or with a person employed by a supplier, contractor or client with whom the employee deals on the Company’s behalf.'),
  bullet('Any position held in an organisation that transacts with the Company.', { after: 140 }),
  p('Declaring a conflict is not itself a violation and is never a ground for discipline. Failing to declare it is. Once declared, HRD and the Department Head shall agree on a reasonable arrangement — usually removing the employee from decisions on that matter — and record it in writing.'),
  note('Why this matters at our size', [
    'In a company of twenty people who are growing to a hundred, an employee will often know a supplier personally, and a relative may well apply for a job. None of that is wrong. What is wrong is deciding on a purchase, a hiring, or a contract while holding an undisclosed private interest in the outcome. Declare it, step aside from the decision, and there is no problem.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('2.4  Gifts, Commissions and Entertainment', 'new'),
  p('No employee shall solicit any gift, commission, discount, loan, service or favour from a client, supplier, contractor or applicant, in any amount, at any time. Soliciting is always prohibited.'),
  p('An unsolicited gift may be accepted only if all of the following are true: it is of nominal value not exceeding One Thousand Pesos (P1,000.00); it is not cash or a cash equivalent such as a gift card, load or e-wallet transfer; it is not given in connection with a pending bid, quotation, evaluation or claim; and it is customary, such as a token given during the Christmas season.'),
  p('A gift that exceeds this limit, or that is offered during a pending transaction, shall be politely declined. Where declining would cause offence or is impractical, the employee shall accept it on behalf of the Company, report it to HRD within three (3) working days, and turn it over. HRD shall keep a register of gifts received and turned over.'),
  p('Modest business meals and refreshments taken in the ordinary course of a client visit are not gifts and need not be reported.'),
  p('Accepting money or anything of value in consideration of an act relating to one’s work is bribery. It is a serious offense under Section 4.4 and may also be a crime.'),

  secHead('2.5  Confidentiality and Data Privacy', 'new'),
  p('In the course of work, employees come to know information that belongs to the Company or to its clients — pricing and costing, quotations and bids, client lists, equipment inventories and site layouts, technical drawings, service histories, security arrangements, and the personal data of co-employees and of clients’ personnel.'),
  p('Employees shall use such information only for the purpose for which it was given to them, shall not disclose it to anyone who does not need it for their work, and shall not retain, copy or take it out of the Company on separation. This obligation continues after employment ends.'),
  p('The Company processes personal data in accordance with Republic Act No. 10173, the Data Privacy Act of 2012. Employees who handle the personal data of co-employees, applicants, clients or client personnel shall collect only what is necessary, keep it secure, and not disclose it without authority. A suspected personal data breach — a lost phone or laptop, a misdirected e-mail containing personal data, an unauthorized access — shall be reported to HRD immediately and in any case within twenty-four (24) hours, so the Company can meet its own reporting deadlines to the National Privacy Commission.'),
  p('Photographs and video taken inside a client’s premises frequently capture a client’s systems, security arrangements or personnel. No employee shall take or post such images without the client’s permission.'),

  secHead('2.6  Company Property and Resources', 'new'),
  p('Tools, instruments, gauges, refrigerant, spare parts, service vehicles, mobile phones, laptops, uniforms and personal protective equipment are issued for company work and remain the property of the Company. Employees shall use them with care, keep them secure, return them on separation or on demand, and report loss or damage immediately.'),
  p('Incidental personal use of a company phone or computer is tolerated so long as it is reasonable, does not interfere with work, does not incur material cost to the Company, and does not involve anything unlawful or offensive. Company vehicles are for company use only and may not be used for personal errands without written approval.'),
  p('Employees have no expectation of privacy in company-issued equipment, e-mail accounts and systems. The Company may access and review them for a legitimate business purpose, subject to the Data Privacy Act.'),

  secHead('2.7  Conduct Towards Clients and the Public', 'new'),
  p('Most employees of TXTAIRE work inside a client’s building. To the client, the employee on site is the Company. Accordingly, every employee on a client site shall:'),
  bullet('Observe the client’s house rules, security procedures and safety requirements, in addition to the Company’s own.'),
  bullet('Be in the prescribed uniform with the company ID visibly worn.'),
  bullet('Confine themselves to the work area and the areas needed to reach it, and not enter restricted areas without the client’s consent.'),
  bullet('Not solicit work, tips, commissions, loans or side jobs from the client, the client’s staff or the client’s tenants.'),
  bullet('Not discuss the Company’s pricing, internal problems, or another client’s affairs with a client.'),
  bullet('Refer any client complaint or request outside the scope of the job order to the immediate superior rather than agreeing to it on the spot.', { after: 160 }),

  secHead('2.8  Respect in the Workplace', 'new'),
  p('Every employee has the right to work free from harassment, bullying and intimidation. The Company will not tolerate sexual harassment in any form, gender-based harassment whether committed in person or online, bullying, hazing, slurs directed at a person’s sex, gender, religion, ethnicity, age, health status or disability, or the deliberate humiliation of a subordinate.'),
  p('The right to give an instruction, to set a standard, to correct poor work and to impose discipline under this Code is not harassment. Harassment is conduct that is directed at the person rather than the work, and that a reasonable person would find intimidating, hostile, offensive or degrading.'),
  p('The specific procedure for sexual harassment and gender-based harassment complaints is in Section 5.9. It is separate from, and takes precedence over, the ordinary procedure in Part III.'),

  secHead('2.9  Social Media and Public Communication', 'new'),
  p('Employees are free to use social media in their private capacity. The Company does not monitor personal accounts and does not restrict lawful personal expression, including comment on labour matters, which is protected activity.'),
  p('What employees may not do is: post confidential company or client information; post photographs or video taken inside client premises without permission; post material that identifies a client and disparages it; impersonate the Company or appear to speak for it without authority; or post material that harasses, threatens or defames a co-employee, a client or the Company.'),
  p('Only the Owner, the General Manager, or a person they designate in writing may speak for TXTAIRE OPC to the media, to a government agency in an official proceeding, or on the Company’s official accounts.'),

  secHead('2.10  Reporting Concerns and Protection from Retaliation', 'new'),
  p('An employee who becomes aware of a violation of this Code, of a company policy, or of the law, should report it. A report may be made to any of the following, and the employee may choose whichever they are most comfortable with:'),
  bullet([B('the immediate superior'), run(' — for ordinary work-rule and safety matters;')]),
  bullet([B('the Human Resources Department'), run(' — for any matter, including one involving the employee’s own superior;')]),
  bullet([B('the Owner or General Manager'), run(' — where the report concerns HRD itself or a member of management;')]),
  bullet([B('the Committee on Decorum and Investigation'), run(' — for sexual harassment and gender-based harassment, under Section 5.9.')], { after: 140 }),
  p('Reports may be made in writing, by e-mail, or verbally. A report may be made anonymously, although an anonymous report is harder to act on because the Company cannot ask follow-up questions.'),
  p('The identity of a person who reports in good faith shall be kept confidential and disclosed only to those who need to know in order to investigate, or where disclosure is required by law or by the requirements of due process owed to the person complained of.'),
  note('No retaliation', [
    'No employee shall be dismissed, suspended, demoted, transferred, denied a benefit, given a poorer evaluation, excluded from overtime, or in any way disadvantaged because they reported a possible violation in good faith, filed a complaint, or took part in an investigation.',
    'Retaliation is itself a serious offense punishable by dismissal under Sections 4.7 and 4.8. It is a violation even if the original report turns out to be mistaken, so long as the report was made in good faith.',
    'A report that the reporting employee knows to be false is not made in good faith and is itself an offense.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
];

// =========================================================== PART III
const part3 = () => [
  ...partHead('PART III', 'The Disciplinary Process'),

  secHead('3.1  Principles of Corrective Discipline', 'new'),
  p('The purpose of discipline at TXTAIRE OPC is to correct behaviour, not to punish a person. Five principles govern every case:'),
  bullet([B('Correction first. '), run('Where a lapse is minor and the employee is willing to correct it, the Company will coach and warn before it suspends. Suspension and dismissal are for conduct that warning has failed to correct, or that is serious enough on its own.')]),
  bullet([B('Proportionality. '), run('The penalty must fit the offense — its gravity, the loss or risk it caused, whether it was deliberate, and the employee’s record. A penalty that is grossly out of proportion to the offense is not lawful discipline.')]),
  bullet([B('Consistency. '), run('Two employees who commit the same offense in the same circumstances receive the same penalty. Where the Company treats a case differently, the reason must be recorded in writing.')]),
  bullet([B('Due process. '), run('No penalty of any kind is imposed until the employee has been told in writing what they are accused of and has been given a real opportunity to answer.')]),
  bullet([B('Documentation. '), run('Every disciplinary action, including a verbal warning, is recorded in writing and filed with HRD. An action that is not documented did not happen, and cannot later be counted as a prior offense.')], { after: 160 }),

  secHead('3.2  Disciplinary Actions Defined', 'rev'),
  ...(() => {
    const AW = [2200, 7546];
    const rows = [
      ['Verbal Warning (VW)', 'The immediate superior speaks to the employee in private, explains what was wrong and what is expected, and confirms it in a short written record signed by both and sent to HRD. No loss of pay.'],
      ['Written Warning (WW)', 'HRD issues a formal memorandum stating the violation, the correction required, and that a repetition will draw a heavier penalty. The employee acknowledges receipt. Refusal to sign is annotated by a witness and does not invalidate the notice. No loss of pay.'],
      ['Suspension (3d / 7d / 15d)', 'The employee does not report for work for the stated number of working days and is not paid for those days. The penalty shall not exceed fifteen (15) working days for any single offense. Dates are set by HRD in coordination with the Department Head, within thirty (30) days from the notice of decision, and arranged so as not to leave a client site unmanned.'],
      ['Dismissal (D)', 'Termination of employment for a just cause under Article 297 of the Labor Code. Reserved for Class D offenses and for the final step of the Class B and Class C progressions.'],
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: [
          tCell('ACTION', { w: AW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('WHAT IT MEANS', { w: AW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({ cantSplit: true,
        children: [
          tCell(r[0], { w: AW[0], bold: true, color: C.navy, va: d.VerticalAlign.TOP }),
          tCell(r[1], { w: AW[1], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], AW)];
  })(),
  gap(160),
  note('A suspension is never longer than fifteen days', [
    'The previous edition of this Code allowed suspensions of thirty (30) days as an ordinary penalty. A suspension of that length, imposed as a penalty, is difficult to defend and risks being treated as a constructive dismissal. Under this edition the longest penalty short of dismissal is fifteen (15) working days.',
    'This is separate from PREVENTIVE suspension under Section 3.8, which is not a penalty and which the law separately caps at thirty (30) days.',
  ]),

  secHead('3.3  Classification of Offenses', 'new'),
  p('Every offense listed in Part IV is assigned to one of four classes. The class determines the penalty; the employee’s record determines which step of the progression applies.'),
  ...(() => {
    const KW = [1500, 8246];
    const rows = [
      ['A', 'Light', C.A, C.Atxt, 'A lapse in work rules or routine that causes no loss and no risk to any person. Corrected by warning. Examples: tardiness, incomplete uniform, untidy work area, late reports.'],
      ['B', 'Less Grave', C.B, C.Btxt, 'A violation that disrupts work, causes a small loss, or shows disregard of a rule that matters. Examples: no-call absence, failure to wear PPE, discourtesy to a client, gambling on premises.'],
      ['C', 'Grave', C.Cc, C.Ctxt, 'A violation that causes substantial loss or risk, or that strikes at the working relationship, but that does not necessarily destroy trust beyond repair. Examples: willful disobedience, fighting, negligence causing a loss above P5,000, bullying.'],
      ['D', 'Serious', C.D, C.Dtxt, 'Conduct amounting to a just cause for dismissal under Article 297 of the Labor Code — serious misconduct, willful disobedience of a grave order, gross and habitual neglect, fraud or willful breach of trust, or a crime against the Company or its people. Examples: theft, falsification, sexual harassment, bribery, drugs on premises.'],
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: [
          tCell('CLASS', { w: KW[0], bold: true, color: 'FFFFFF', fill: C.blue, align: d.AlignmentType.CENTER, size: 18 }),
          tCell('WHAT BELONGS IN THIS CLASS', { w: KW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({ cantSplit: true,
        children: [
          cell([
            new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 20 }, children: [run(r[0], { size: 32, bold: true, color: r[3] })] }),
            new d.Paragraph({ alignment: d.AlignmentType.CENTER, spacing: { after: 0 }, children: [run(r[1], { size: 17, bold: true, color: r[3] })] }),
          ], { w: KW[0], fill: r[2] }),
          tCell(r[4], { w: KW[1], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], KW)];
  })(),

  secHead('3.4  Schedule of Penalties', 'new'),
  p('The following table is the single schedule of penalties for the whole Code. Offenses are counted within a rolling twelve (12) month period reckoned from the date of the first offense, and only offenses of the same class are counted together.'),
  ...(() => {
    const PW = [1450, 2096, 1550, 1550, 1550, 1550];
    const hdr = ['CLASS', 'NATURE', '1st OFFENSE', '2nd OFFENSE', '3rd OFFENSE', '4th OFFENSE'];
    const rows = [
      ['A', 'Light', C.A, C.Atxt, ['Verbal Warning', 'Written Warning', '3-day suspension', '7-day suspension']],
      ['B', 'Less Grave', C.B, C.Btxt, ['Written Warning', '3-day suspension', '7-day suspension', 'DISMISSAL']],
      ['C', 'Grave', C.Cc, C.Ctxt, ['7-day suspension', '15-day suspension', 'DISMISSAL', '—']],
      ['D', 'Serious', C.D, C.Dtxt, ['DISMISSAL', '—', '—', '—']],
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: hdr.map((h, i) => tCell(h, {
          w: PW[i], bold: true, color: 'FFFFFF', fill: C.blue,
          align: d.AlignmentType.CENTER, size: 17,
        })),
      }),
      ...rows.map((r) => new d.TableRow({ cantSplit: true,
        children: [
          tCell(r[0], { w: PW[0], bold: true, size: 28, color: r[3], fill: r[2], align: d.AlignmentType.CENTER }),
          tCell(r[1], { w: PW[1], bold: true, color: r[3], fill: r[2], align: d.AlignmentType.CENTER, size: 18 }),
          ...r[4].map((v, i) => tCell(v, {
            w: PW[i + 2], align: d.AlignmentType.CENTER, size: 18,
            bold: v === 'DISMISSAL', color: v === 'DISMISSAL' ? C.Dtxt : undefined,
          })),
        ],
      })),
    ], PW)];
  })(),
  gap(140),
  p('Notes on the schedule:'),
  bullet('Suspension is counted in working days, not calendar days.'),
  bullet('A fifth Class A offense within the same twelve-month period is dealt with under Section 3.10 (Habitual Delinquency).'),
  bullet('Offenses of different classes are not added together in the progression, but a record of offenses across classes is relevant under Sections 3.5 and 3.10.'),
  bullet('Where the same act violates more than one provision of this Code, only the highest applicable penalty is imposed. An employee is not penalised twice for one act.'),
  bullet('Where an offense is committed in the same incident as another, related offense, the two shall be treated as one offense for the purpose of the progression.', { after: 160 }),

  secHead('3.5  Mitigating and Aggravating Circumstances', 'new'),
  p('The schedule in Section 3.4 is the normal penalty. It is not a machine. Before imposing a penalty the Panel and HRD shall consider whether the circumstances justify moving one step down, or one step up, and shall record the reason in the Case Evaluation Form.'),
  ...(() => {
    const MW = [4873, 4873];
    const mit = [
      'The offense is the employee’s first in any class.',
      'Length of clean service with the Company.',
      'The employee voluntarily reported their own violation before it was discovered.',
      'The employee made full restitution or corrected the error promptly.',
      'The act was a genuine error of judgment rather than a deliberate choice.',
      'The employee was acting under a superior’s instruction, or under a genuine misunderstanding of the rule.',
      'No loss, injury or client complaint resulted.',
      'The rule had not previously been clearly communicated or consistently enforced.',
      'Personal circumstances of a compelling nature (serious illness of the employee or an immediate family member, calamity, bereavement).',
    ];
    const agg = [
      'The act was deliberate, planned or repeated.',
      'The employee holds a position of trust, or is a supervisor or manager.',
      'The offense caused actual loss, injury, or the loss of a client account.',
      'The employee attempted to conceal the act, destroyed evidence, or gave false statements during the investigation.',
      'The offense was committed against a co-employee of lower rank, or against a client.',
      'The offense was committed while already serving a penalty or on preventive suspension.',
      'The employee involved or induced others to take part.',
      'The offense endangered the life or safety of any person.',
      'The employee had been warned about the same conduct before.',
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: [
          tCell('MITIGATING  —  may justify a lighter penalty', { w: MW[0], bold: true, color: 'FFFFFF', fill: '4C8C2B', size: 18 }),
          tCell('AGGRAVATING  —  may justify a heavier penalty', { w: MW[1], bold: true, color: 'FFFFFF', fill: 'A8342A', size: 18 }),
        ],
      }),
      new d.TableRow({ cantSplit: true,
        children: [
          cell(mit.map((t, i) => new d.Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            spacing: { after: i === mit.length - 1 ? 0 : 60, line: 250 },
            children: [run(t, { size: 18 })],
          })), { w: MW[0], va: d.VerticalAlign.TOP, fill: 'F4FAF0' }),
          cell(agg.map((t, i) => new d.Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            spacing: { after: i === agg.length - 1 ? 0 : 60, line: 250 },
            children: [run(t, { size: 18 })],
          })), { w: MW[1], va: d.VerticalAlign.TOP, fill: 'FDF4F3' }),
        ],
      }),
    ], MW)];
  })(),
  gap(140),
  p('Two limits apply. First, mitigating circumstances may reduce a penalty by one step, but they cannot convert a Class D offense involving theft, fraud, sexual harassment or violence into a mere warning; where the Panel believes a Class D offense warrants less than dismissal, it must say so in writing and the decision rests with the Owner or General Manager. Second, aggravating circumstances may raise a penalty by one step, but a first offense in Class A can never be escalated directly to dismissal.'),

  secHead('3.6  Due Process: The Twin-Notice Rule', 'new'),
  p('No employee shall be suspended or dismissed without the following procedure, which follows Article 292(b) of the Labor Code and Department Order No. 147-15. The Company bears the burden of proving both that there was a valid cause and that this procedure was followed.'),

  subHead('Step 1 — Report and initial assessment'),
  p('The immediate superior reports the incident to HRD in writing within five (5) working days of learning of it. HRD makes an initial assessment of whether the reported facts, if true, would constitute an offense under this Code. If they would not, HRD closes the matter and informs the reporting supervisor in writing. If they would, HRD proceeds to Step 2.'),

  subHead('Step 2 — First notice: Notice to Explain (Annex A)'),
  p('HRD serves the employee a written Notice to Explain. The NTE must state:'),
  bullet('the specific acts or omissions complained of, including the date, time and place of each;'),
  bullet('the specific provisions of this Code or company rules said to have been violated;'),
  bullet('that the employee is being given the opportunity to explain and to submit evidence and witnesses;'),
  bullet('that dismissal is being considered, where that is the case; and'),
  bullet('the deadline for the written explanation, which shall be not less than five (5) calendar days from receipt.', { after: 140 }),
  p('The NTE is served personally against signature. If the employee refuses to receive or to sign, the fact is annotated in the presence of a witness and a copy is sent to the employee’s last known address by registered mail or courier. A general statement such as "you violated company rules" is not a valid NTE.'),

  subHead('Step 3 — The employee’s written explanation'),
  p('The employee has at least five (5) calendar days to submit a written explanation (Annex B), and may attach documents and name witnesses. HRD shall grant a reasonable extension on request where the employee needs more time to gather evidence, is on approved leave, or is ill. An employee may seek the assistance of a representative or counsel of their own choosing, at their own expense.'),

  subHead('Step 4 — Administrative conference'),
  p('An administrative conference shall be held where the employee requests one, where the facts are disputed, or where dismissal is being considered. It is a conference, not a trial: the technical rules of evidence do not apply. Its purpose is to let the employee confront the accusation, explain, present witnesses and answer questions. HRD gives written notice of the schedule at least three (3) working days in advance (Annex C) and keeps minutes signed by those present.'),
  p('Where the employee, after due notice, does not appear and gives no valid reason, the case is decided on the records. The Company shall not treat non-appearance as an admission of guilt.'),

  subHead('Step 5 — Evaluation and decision'),
  p('The Panel or HRD, as applicable under Section 3.7, evaluates the evidence, completes the Case Evaluation Form (Annex D), and states the findings of fact, the provision violated, the mitigating and aggravating circumstances considered, and the recommended penalty. The recommendation is approved by the Owner or General Manager.'),

  subHead('Step 6 — Second notice: Notice of Decision (Annex E)'),
  p('HRD serves a written Notice of Decision stating the findings, the specific ground relied upon, the reason why the employee’s explanation was or was not accepted, the penalty imposed, and the date the penalty takes effect. Where the penalty is dismissal, the notice shall state the effective date of separation and shall be served on the employee; a copy shall also be furnished to the DOLE Regional Office having jurisdiction, where required.'),
  p('The whole process from NTE to Notice of Decision should be completed within thirty (30) calendar days, extendable for good reason recorded in writing.'),
  note('Two notices are the minimum, not the ceiling', [
    'Skipping either notice, or giving the employee less than five calendar days to explain, does not merely weaken the case — it exposes the Company to nominal damages even where the dismissal itself was for a valid cause. The cheapest hour HRD will ever spend is the hour spent writing a proper NTE.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('3.7  The Administrative Review Panel', 'rev'),
  p('The previous edition required a panel of three managers for every case. At the Company’s present size that is not workable, and it delays simple cases. The following applies instead, and scales as the Company grows:'),
  ...(() => {
    const RW = [2400, 3400, 3946];
    const rows = [
      ['Class A offenses', 'Immediate superior, with HRD noted', 'HRD reviews the record for consistency. No panel required.'],
      ['Class B offenses', 'HRD, with the Department Head', 'No panel required. The Owner or General Manager approves any suspension.'],
      ['Class C offenses', 'Administrative Review Panel', 'Panel of three (3): the HR Head as chair, one Department Head not connected with the case, and one employee of at least the same rank as the respondent.'],
      ['Class D offenses, and any case where dismissal is considered', 'Administrative Review Panel', 'Same composition. The Panel recommends; the Owner or General Manager decides.'],
      ['Sexual harassment and gender-based harassment', 'Committee on Decorum and Investigation', 'Constituted under Section 5.9. Takes precedence over the Panel.'],
    ];
    return [table([
      new d.TableRow({ cantSplit: true,
        tableHeader: true,
        children: [
          tCell('CASE', { w: RW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('DECIDED BY', { w: RW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
          tCell('COMPOSITION AND NOTES', { w: RW[2], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      ...rows.map((r) => new d.TableRow({ cantSplit: true,
        children: [
          tCell(r[0], { w: RW[0], bold: true, color: C.navy, va: d.VerticalAlign.TOP }),
          tCell(r[1], { w: RW[1], va: d.VerticalAlign.TOP }),
          tCell(r[2], { w: RW[2], va: d.VerticalAlign.TOP }),
        ],
      })),
    ], RW)];
  })(),
  gap(140),
  p('No person shall sit on a Panel who is the complainant, a witness, the immediate superior who reported the case, a relative of either party within the fourth civil degree, or who has any other interest in the outcome. Where the Company cannot constitute a Panel that meets these requirements from among its own personnel, the Owner or General Manager may appoint an external HR practitioner or counsel to sit as a member.'),
  p('All Panel deliberations are confidential. Members shall not discuss a case outside the proceeding.'),

  secHead('3.8  Preventive Suspension', 'rev'),
  p('Preventive suspension is not a penalty. It is the temporary removal of an employee from the workplace during an investigation, and it is available only where the employee’s continued presence poses a serious and imminent threat to the life or property of the Company, of the client, or of co-employees — for example, where the charge involves violence, weapons, drugs, or where the employee is in a position to destroy evidence or intimidate witnesses.'),
  bullet('It may be imposed only after the NTE has been served, and shall be stated in writing with the reason.'),
  bullet('It shall not exceed thirty (30) calendar days.'),
  bullet('If the investigation is not finished within thirty (30) days, the Company shall either reinstate the employee to work or extend the suspension — and where it extends it, the Company shall pay the employee’s wages and benefits for the period of the extension.'),
  bullet('If the employee is found not liable, or is found liable for an offense that does not carry suspension, the employee shall be paid the wages corresponding to the entire period of the preventive suspension.'),
  bullet('Where an employee is found liable and suspended as a penalty, the period of preventive suspension already served shall be credited against the penalty.'),
  bullet('Preventive suspension shall not be used as a convenience, as a way of avoiding a hearing, or as an informal penalty. Doing so is an offense under Section 4.8.', { after: 160 }),

  secHead('3.9  Appeal'),
  p('An employee may ask for reconsideration of any decision by filing a written Letter of Appeal with HRD within five (5) calendar days from receipt of the Notice of Decision. The appeal shall state the grounds relied upon and may attach new evidence.'),
  p('The appeal shall be reviewed by the Owner or General Manager, or, where they decided the case at first instance, by a reviewer they designate who took no part in the original decision. A written resolution shall be issued within fifteen (15) calendar days from receipt of the appeal. The resolution is final within the Company.'),
  p('Filing an appeal does not by itself suspend the penalty, but the reviewer may hold the penalty in abeyance pending resolution. Nothing in this Code limits an employee’s right to bring the matter before the Department of Labor and Employment, the National Labor Relations Commission, or any other body having jurisdiction, and no employee shall be penalised for doing so.'),

  secHead('3.10  Habitual Delinquency', 'rev'),
  p('An employee is habitually delinquent when, within a rolling twelve (12) month period reckoned from the date of the first offense, they have accumulated any of the following:'),
  bullet('Five (5) Class A offenses; or'),
  bullet('Three (3) Written Warnings arising from separate incidents; or'),
  bullet('Three (3) suspensions arising from separate incidents; or'),
  bullet('Any combination of four (4) penalties of Written Warning or higher arising from separate incidents.', { after: 140 }),
  p('Habitual delinquency is treated as a Class C offense in its own right and is subject to the full procedure in Section 3.6, including a separate NTE. It is not an automatic dismissal: the Panel shall consider whether the pattern shows a genuine unwillingness to correct, and shall consider whether the employee was given real support to improve.'),
  p('Where the underlying offenses are all Class A and caused no loss, the Panel should normally impose suspension and place the employee on a written performance improvement plan rather than recommend dismissal.'),

  secHead('3.11  Prescription and Clearing of Records', 'new'),
  p('Prescription of offenses. No disciplinary proceeding shall be commenced more than sixty (60) calendar days after the offense came to the knowledge of the immediate superior or of HRD, whichever is earlier, except for offenses involving fraud, dishonesty, theft, falsification, sexual harassment or violence, for which the period is one (1) year from discovery. The Company should not hold a stale allegation in reserve.'),
  p('Clearing of records. A penalty ceases to be counted in the progression under Section 3.4 after twelve (12) months from the date it was fully served, provided the employee commits no further offense of the same class during that period. Cleared penalties remain physically in the 201 file as a matter of record but shall not be used to increase the penalty for a later offense.'),
  p('Effect on benefits and promotion. A cleared penalty shall not be used as a ground to deny promotion, transfer, training or any benefit.'),

  secHead('3.12  Restitution and the Prohibition on Fines', 'new'),
  note('This section replaces provisions of the previous edition that were contrary to law', [
    ['The Company shall not impose fines. The previous edition provided for a "P500 fine / confiscation of unit". A fine deducted from wages is not among the deductions permitted by Article 113 of the Labor Code and shall no longer be imposed.'],
    ['The Company shall not withhold pay for hours actually worked. The previous edition provided that an employee who forgot to punch in or out "shall be marked absent and without pay for that day". An employee who actually rendered work must be paid for it. A missed time entry is corrected through a Time Correction Form certified by the immediate superior, and is dealt with, if at all, as a Class A offense under Section 4.2.'],
    ['The Company shall not impose liquidated damages of two months’ salary for failure to serve notice of resignation. See Section 6.4.'],
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
  gap(160),
  p('Where an employee causes loss or damage to company or client property, the Company may:'),
  bullet('require restitution or repair as a condition recorded in the Notice of Decision, where the employee agrees;'),
  bullet('deduct the amount from wages ONLY where the employee has given written authorization to the deduction, freely and without coercion, and where the deduction does not reduce the employee’s pay below the applicable minimum wage. Deductions shall be spread so that no single pay period is reduced by more than twenty percent (20%) of net pay;'),
  bullet('recover the amount from the employee’s final pay on separation, subject to the same conditions; or'),
  bullet('pursue civil remedies in the proper forum.', { after: 140 }),
  p('Where the employee does not agree to restitution, the Company’s remedy is a civil claim, not an unauthorized deduction. Refusing to authorize a deduction is not an offense and shall not be treated as insubordination.'),
  p('For deductions relating to loss or damage to tools, materials or equipment specifically, the Company shall additionally observe Article 114 of the Labor Code and its implementing rules, which require that the employee be heard on their responsibility, that the employee be shown to be clearly responsible, and that the deduction not exceed twenty percent (20%) of the employee’s wages in a week.'),

  secHead('3.13  Management Prerogative and Employee Rights', 'new'),
  p('The Company retains the right to issue, amend and enforce work rules and to discipline employees, within the limits set by the Constitution, the Labor Code, and applicable law. Where an act grossly prejudicial to the Company is not listed in Part IV, the Company may act on it, but only by applying the class of the most closely analogous listed offense, and only after the full procedure in Section 3.6.'),
  p('Every employee retains the following rights, which no provision of this Code may be read to waive:'),
  bullet('to be informed in writing of any accusation, and to be given a real opportunity to answer it;'),
  bullet('to be assisted by a representative or counsel of their own choosing at any conference;'),
  bullet('to see and copy the documents relied upon against them, and their own 201 file;'),
  bullet('to security of tenure, and not to be dismissed except for a just or authorized cause and with due process;'),
  bullet('to receive all wages and benefits due under law, and not to have them reduced by way of penalty;'),
  bullet('to self-organization and to engage in lawful concerted activity;'),
  bullet('to a workplace free from harassment, discrimination and retaliation;'),
  bullet('to bring any grievance before the DOLE, the NLRC or any competent body without fear of reprisal.', { after: 160 }),
];

module.exports = { part1, part2, part3 };
