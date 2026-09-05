const L = require('./lib.js');
const { d, C, W, run, p, bullet, gap, pageBreak, partHead, secHead, subHead,
        cell, tCell, table, note, benefitRun, benefitCell, BENEFIT } = L;

const B = (t) => run(t, { bold: true });

// `opts.left` lists the column indexes to left-align; every other column beyond the
// first is centred. Columns carrying a sentence rather than a value need it -- centred
// prose is hard to read down a column.
//
// A cell written as '@mandatory@' or '@company@' renders as the benefit-basis pill
// defined in lib.js rather than as text, so the label reads the same here as it does
// in the legend at the top of this Part.
const simpleTable = (header, rows, widths, opts) => {
  const left = new Set((opts && opts.left) || []);
  const alignFor = (i) => (i === 0 || left.has(i)) ? undefined : d.AlignmentType.CENTER;
  const PILL = /^@(mandatory|company)@$/;
  return table([
    new d.TableRow({ cantSplit: true,
      tableHeader: true,
      children: header.map((h, i) => tCell(h, {
        w: widths[i], bold: true, color: 'FFFFFF', fill: C.blue, size: 18,
        align: alignFor(i),
      })),
    }),
    ...rows.map((r) => new d.TableRow({ cantSplit: true,
      children: r.map((v, i) => {
        const m = PILL.exec(String(v));
        if (m) return benefitCell(m[1], widths[i]);
        return tCell(v, {
          w: widths[i], va: d.VerticalAlign.TOP,
          bold: i === 0, color: i === 0 ? C.navy : undefined,
          align: alignFor(i),
        });
      }),
    })),
  ], widths);
};

// =========================================================== PART V
const part5 = () => [
  ...partHead('PART V', 'Workplace Standards and Benefits'),
  p('This Part states the standards and benefits that apply to all employees. Every benefit in this Part carries one of two labels, so that an employee can see at a glance where the entitlement comes from:'),
  gap(60),
  ...(() => {
    const LW = [2600, 7146];
    const row = (kind, meaning) => new d.TableRow({
      cantSplit: true,
      children: [
        benefitCell(kind, LW[0]),
        tCell(meaning, { w: LW[1], va: d.VerticalAlign.CENTER, size: 19 }),
      ],
    });
    return [table([
      new d.TableRow({
        cantSplit: true,
        children: [
          tCell('LABEL', { w: LW[0], bold: true, color: 'FFFFFF', fill: C.blue, size: 18, align: d.AlignmentType.CENTER }),
          tCell('WHAT IT MEANS', { w: LW[1], bold: true, color: 'FFFFFF', fill: C.blue, size: 18 }),
        ],
      }),
      row('mandatory', 'Required by law. The Company must provide it regardless of company policy, and it cannot be reduced, waived or traded away — not by this Code, not by an individual agreement, and not with the employee’s consent.'),
      row('company', 'Granted by the Company beyond what the law requires. The Company was free not to grant it. Once it has been granted regularly and deliberately, however, it may no longer be withdrawn or reduced unilaterally (Article 100, Labor Code).'),
    ], LW)];
  })(),
  gap(160),
  p('Where the law is later amended to give more than this Part states, the law applies and this Part shall be read as amended.'),

  secHead('5.1  Hours of Work, Attendance and Punctuality'),
  p('A regular working day consists of eight (8) hours of work plus a meal break of not less than sixty (60) minutes, which is not compensable. Standard office hours at the Laguna and Manila offices are 8:00 A.M. to 5:00 P.M., Monday to Friday, with Saturday work as scheduled. Employees assigned to client sites follow the schedule agreed with the client, which shall be communicated in writing.'),
  p('A grace period of fifteen (15) minutes after the official start of the shift is observed. Time lost through tardiness or undertime is deducted from pay on the basis of actual minutes lost. Deduction of time not worked is not a disciplinary penalty; disciplinary action for tardiness is separate and is governed by Section 4.1.'),
  p('Every employee is entitled to a rest period of not less than twenty-four (24) consecutive hours after every six (6) consecutive normal work days. Where the nature of a client engagement requires work on a scheduled rest day, the premium in Section 5.2 applies.'),
  p('Night shift differential of not less than ten percent (10%) of the basic hourly rate is paid for each hour worked between 10:00 P.M. and 6:00 A.M.'),

  secHead('5.2  Overtime, Undertime and Rest Days', 'rev'),
  p('Overtime must be authorized in writing by the immediate superior BEFORE it is rendered, and the authorization recorded on the timesheet. This requirement exists so that the Company can control cost and staffing; it is not a device for avoiding payment.'),
  note('Overtime actually rendered and knowingly permitted must be paid', [
    'Where an employee renders overtime without prior written authorization, but the work was necessary and the immediate superior knew of it and allowed it to proceed, the overtime shall be paid. The failure to secure prior authorization is then dealt with, if at all, as a Class A offense.',
    'A blanket rule that unauthorized overtime is never compensable cannot be applied to hours the Company knew about and benefited from.',
  ]),
  gap(160),
  p('Premium rates. The following are the statutory minimum rates. Where a client contract or company practice provides more, the higher rate applies.'),
  ...(() => {
    const OW = [5546, 4200];
    return [simpleTable(
      ['WORK RENDERED', 'RATE'],
      [
        ['Overtime on an ordinary working day', 'Hourly rate + 25%'],
        ['Work on a rest day or a special non-working day', 'Daily rate + 30%'],
        ['Overtime on a rest day or special non-working day', 'Hourly rate of that day + 30%'],
        ['Work on a regular holiday', '200% of daily rate'],
        ['Overtime on a regular holiday', 'Hourly rate of that day + 30%'],
        ['Work on a regular holiday falling on a rest day', '200% + 30% of that amount'],
        ['Night shift differential (10:00 P.M. – 6:00 A.M.)', 'Hourly rate + 10%'],
      ], OW)];
  })(),
  gap(160),
  p('Undertime. Undertime is not allowed except in an emergency or in circumstances beyond the employee’s control, and requires the approval of the immediate superior. Undertime on any day shall not be offset against overtime on another day. Undertime of more than one (1) hour shall be covered by a leave application. Repeated undertime is dealt with under Section 4.1.'),

  secHead('5.3  Leaves of Absence', 'rev'),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Service Incentive Leave (SIL)', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('mandatory')),
  }),
  p('Every employee who has rendered at least one (1) year of service is entitled to five (5) days of service incentive leave with pay per year. The year is reckoned from the date the employee started working, and includes authorized absences, paid regular holidays and rest days.'),
  p('SIL may be used for vacation or for illness. Unused SIL is convertible to its cash equivalent at the end of the year, or upon separation, based on the salary rate at the date of conversion. Applications for planned leave shall be filed at least five (5) working days in advance; for a two-week or longer absence, at least two (2) weeks in advance.'),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Sick leave', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('mandatory')),
  }),
  p('The Company does not grant a separate paid sick leave over and above SIL. An employee may use SIL credits for absence due to illness. A medical certificate from a licensed physician is required for an absence of three (3) or more consecutive working days. For shorter absences a medical certificate may be requested but shall not be unreasonably required, and its absence alone shall not convert an otherwise excused absence into an unauthorized one.'),
  p('Where SIL credits are exhausted, or where the employee has not yet completed one year of service, absence due to illness may be taken as leave without pay under the terms below, and the employee may claim SSS sickness benefit where qualified.'),
  subHead('Statutory leaves', 'rev'),
  ...(() => {
    const SW = [2500, 1150, 2150, 3946];
    return [simpleTable(
      ['LEAVE', 'DAYS', 'BASIS', 'ENTITLEMENT AND CONDITIONS'],
      [
        ['Maternity Leave\n(RA 11210)', '105 / 120 / 60', '@mandatory@', 'One hundred five (105) days with full pay for live childbirth, whether normal or caesarean, regardless of civil status or legitimacy of the child; an additional fifteen (15) days for a qualified solo parent; sixty (60) days for miscarriage or emergency termination. Up to seven (7) days may be transferred to the child’s father or, in his absence, to an alternate caregiver. An option to extend for thirty (30) days without pay is available on notice.'],
        ['Paternity Leave\n(RA 8187)', '7', '@mandatory@', 'Seven (7) days with full pay for a married male employee, for each of the first four (4) deliveries of the legitimate spouse with whom he is cohabiting.'],
        ['Solo Parent Leave\n(RA 11861)', '7', '@mandatory@', 'Seven (7) working days with pay per year for an employee who has rendered at least six (6) months of service and holds a valid Solo Parent Identification Card issued by the local social welfare office. Not convertible to cash and not carried over.'],
        ['Special Leave for Women\n(RA 9710)', 'up to 60', '@mandatory@', 'Up to two (2) months with full pay following surgery caused by a gynaecological disorder, for an employee who has rendered at least six (6) months of aggregate service in the last twelve (12) months.'],
        ['Leave for Victims of\nViolence (RA 9262)', '10', '@mandatory@', 'Ten (10) days with pay, extendible, for a woman employee who is a victim of violence against women and their children, on presentation of a protection order or a certification from the barangay, prosecutor or clerk of court. The Company shall keep the matter strictly confidential.'],
        ['Bereavement Leave', '3', '@company@', 'Three (3) days with pay on the death of a spouse, child, parent, sibling, grandparent or parent-in-law. Notice to be given as early as practicable; proof of death to be submitted on return.'],
      ], SW, { left: [3] })];
  })(),
  gap(160),
  new d.Paragraph({
    heading: d.HeadingLevel.HEADING_3, spacing: { before: 180, after: 80 }, keepNext: true,
    children: [run('Leave without pay (LWOP)', { size: 21, bold: true, color: C.green }),
               run('   ', { size: 21 })].concat(benefitRun('company')),
  }),
  p('An employee with no remaining leave credits may apply for leave without pay. It requires the approval of the immediate superior and HRD, and where a client site is affected, coordination with the client. Requests shall be filed at least two (2) weeks in advance where the need is foreseeable. LWOP is not a right; approval shall not, however, be unreasonably withheld where the reason is compelling.'),
  p('Approved LWOP does not break continuity of service, but the days are excluded in computing service-based benefits.'),

  secHead('5.4  Payroll and Timekeeping'),
  bullet([B('Payday. '), run('Employees are paid semi-monthly, on the 15th and the last day of the month. Where a payday falls on a rest day or holiday, payment is made on the preceding working day. The interval between payments shall not exceed sixteen (16) days.')]),
  bullet([B('Direct deposit. '), run('Wages are credited directly to the employee’s bank account. The Company shall not charge the employee for the maintenance of a payroll account.')]),
  bullet([B('Payslips. '), run('Every employee shall receive a payslip each pay period showing the period covered, hours worked, overtime, premiums, gross pay, each deduction separately itemised, and net pay. Payslips shall be issued whether in print or electronically.')]),
  bullet([B('Lawful deductions only. '), run('Only deductions authorized by law — SSS, PhilHealth, Pag-IBIG, withholding tax — or deductions to which the employee has given written authorization for their own benefit, shall be made. No deduction shall be made as a fine, as a penalty, or for hours actually worked. See Section 3.12.')]),
  bullet([B('Payroll queries. '), run('An employee who believes there is an error in their pay should raise it with their supervisor or with HRD. Where an error is confirmed, it shall be corrected on the next regular payroll, or sooner where the amount is substantial.')], { after: 160 }),

  secHead('5.5  Holiday Pay Rules'),
  p('All employees are covered by the holiday pay rules, except those expressly excluded by law (managerial employees, field personnel whose hours cannot be determined with reasonable certainty, and the other categories in Article 82 of the Labor Code). Whether an employee is "field personnel" depends on the actual facts of supervision and reporting, not on a job title.'),
  subHead('Regular holidays'),
  p('An employee is entitled to one hundred percent (100%) of the basic wage for an unworked regular holiday, provided they were present or on paid leave on the working day immediately preceding. An employee who works on a regular holiday is entitled to two hundred percent (200%).'),
  ...(() => {
    const HW = [4873, 4873];
    return [simpleTable(
      ['REGULAR HOLIDAY', 'DATE'],
      [
        ['New Year’s Day', 'January 1'], ['Araw ng Kagitingan', 'April 9'],
        ['Maundy Thursday', 'Movable'], ['Good Friday', 'Movable'],
        ['Labor Day', 'May 1'], ['Independence Day', 'June 12'],
        ['National Heroes Day', 'Last Monday of August'], ['Bonifacio Day', 'November 30'],
        ['Christmas Day', 'December 25'], ['Rizal Day', 'December 30'],
        ['Eid al-Fitr', 'Movable'], ['Eid al-Adha', 'Movable'],
        ['Day designated by law for a general election', 'As proclaimed'],
      ], HW)];
  })(),
  gap(160),
  subHead('Special (non-working) days'),
  p('The "no work, no pay" principle applies. An employee who works on a special non-working day is entitled to an additional thirty percent (30%) of the basic daily rate.'),
  ...(() => {
    const HW = [4873, 4873];
    return [simpleTable(
      ['SPECIAL (NON-WORKING) DAY', 'DATE'],
      [
        ['Chinese New Year', 'Movable'], ['EDSA People Power Anniversary', 'February 25'],
        ['Black Saturday', 'Movable'], ['Ninoy Aquino Day', 'August 21'],
        ['All Saints’ Day', 'November 1'], ['All Souls’ Day', 'November 2'],
        ['Christmas Eve', 'December 24'], ['Last day of the year', 'December 31'],
      ], HW)];
  })(),
  gap(140),
  p('The Company observes the holidays listed above unless their observance is suspended, moved or modified by proclamation of the President or by law, and observes any additional day so proclaimed. The official DOLE holiday pay advisory issued each year prevails over this list.'),

  secHead('5.6  Statutory Benefits'),
  p([run('Every benefit in this Section is '), ...benefitRun('mandatory', 17), run(' — each is required by law, and none of them may be reduced, waived or traded away. They are available to all employees, whether probationary or regular, unless disqualified under the law itself:')]),
  bullet('Social Security System (SSS) — including sickness, maternity, disability, retirement, death and funeral benefits, and the Employees’ Compensation Program.'),
  bullet('PhilHealth — national health insurance.'),
  bullet('Pag-IBIG Fund (HDMF) — provident savings and housing loan benefits.'),
  bullet('13th month pay — not less than one-twelfth (1/12) of the basic salary earned within the calendar year, paid not later than 24 December, to all rank-and-file employees who have worked at least one month during the year, regardless of employment status and of the manner in which wages are paid. An employee who resigns or is separated before payment is entitled to the proportionate amount.'),
  bullet('Service Incentive Leave and the statutory leaves listed in Section 5.3.'),
  bullet('Retirement pay under Republic Act No. 7641 for an employee who reaches sixty (60) years of age, or the compulsory age of sixty-five (65), having served at least five (5) years.', { after: 160 }),
  p('The Company remits all contributions and loan amortisations deducted from wages to the relevant agency within the prescribed period. Employees may verify their posted contributions directly with each agency and shall be assisted by HRD in doing so.'),
  gap(60),
  note('Benefits the Company grants beyond the legal minimum', [
    [run('The Company may grant benefits over and above those required by law. Any such benefit is marked '), ...benefitRun('company', 17), run(' wherever it appears in this Part. At the date of this edition these are: bereavement leave (Section 5.3), leave without pay (Section 5.3), and any premium rate paid above the statutory minimum under a client contract or established company practice (Section 5.2).')],
    'A company-granted benefit is voluntary only until it becomes established. Once the Company has granted it regularly and deliberately over time, Article 100 of the Labor Code prevents it from being withdrawn or reduced unilaterally — it is then as enforceable as a benefit the law requires. HRD should therefore treat the introduction of a new benefit as a lasting commitment, and record the basis on which it is granted.',
  ], { edge: C.volTxt, fill: 'EEF7F6', labelColor: C.volTxt }),

  secHead('5.7  Occupational Safety and Health', 'new'),
  p('The Company complies with Republic Act No. 11058 and Department Order No. 198-18. Under those issuances every worker has the right to know the hazards of their work, the right to be provided with personal protective equipment at no cost, the right to report an accident or unsafe condition, and the right to refuse work that poses an imminent danger to life or health.'),
  p('An employee who in good faith refuses work on the ground of imminent danger, or who reports an unsafe condition, shall not be dismissed, suspended, transferred or otherwise prejudiced for doing so. Any such act is a serious offense under Section 4.8.'),
  bullet('Personal protective equipment appropriate to the task is provided by the Company free of charge. Its cost shall never be charged to or deducted from the wages of any employee.'),
  bullet(L.pick(
    'The Company shall maintain first aid facilities and shall have trained first-aiders, safety officers and a health and safety committee as required for its headcount. Annex F sets out how these requirements change as the Company grows.',
    'The Company shall maintain first aid facilities and shall have trained first-aiders, safety officers and a health and safety committee as required for its headcount.')),
  bullet('All employees shall complete the mandatory eight (8) hour safety and health seminar, and workers exposed to specific hazards shall receive the training required for that hazard.'),
  bullet('Work-related accidents, injuries and illnesses shall be reported internally at once and to the DOLE within the prescribed period, and recorded in the Company’s logbook.'),
  bullet('The Company conducts pre-employment and annual medical examinations at its own cost. Results are confidential medical information, held by HRD separately from the 201 file, and disclosed only as the employee authorises or the law requires.', { after: 160 }),

  secHead('5.8  Drug-Free Workplace', 'rev'),
  p('The Company maintains a drug-free workplace in accordance with Republic Act No. 9165 and Department Order No. 53-03. The programme has four parts: advocacy and education; drug testing; treatment and rehabilitation; and, where warranted, discipline.'),
  bullet([B('Testing. '), run('Random drug testing shall be conducted by a laboratory accredited by the Department of Health, using its prescribed procedures. Employees selected are chosen by a method that is genuinely random and documented. The Company bears the cost.')]),
  bullet([B('Confirmatory test. '), run('A positive screening result is NOT a finding of drug use. It shall be confirmed by a confirmatory test at a DOH-accredited laboratory before any action is taken. The employee has the right to challenge a positive confirmatory result within fifteen (15) days by requesting a re-test at their own expense.')]),
  bullet([B('No on-the-spot testing. '), run(L.pick(
    'The previous edition allowed the Company to conduct on-the-spot testing and to compel the giving of urine or blood samples on suspicion alone. That is not permitted. Where the Company has reasonable ground to believe an employee is under the influence at work, it shall remove the employee from any safety-critical task, and refer the matter for testing through the accredited laboratory under the safeguards above.',
    'The Company shall not conduct on-the-spot testing, and shall not compel you to give a urine or blood sample on suspicion alone. Where the Company has reasonable ground to believe an employee is under the influence at work, it shall remove the employee from any safety-critical task, and refer the matter for testing through the accredited laboratory under the safeguards above.'))]),
  bullet([B('Confidentiality. '), run('All test results are confidential medical information. Unauthorized disclosure is itself an offense under Section 4.6 and a violation of the Data Privacy Act.')]),
  bullet([B('Treatment first for drug use. '), run('An officer or employee found positive for drug USE, on a confirmed test, shall be referred for treatment and rehabilitation at a DOH-accredited centre. Dismissal under this Code applies where the employee refuses referral, fails the programme, tests positive again after completing it, or where the conduct involves possession, sale, distribution, or being under the influence while performing a safety-critical task.')], { after: 160 }),

  secHead('5.9  Anti-Sexual Harassment and Safe Spaces', 'new'),
  p('The Company implements Republic Act No. 7877 (Anti-Sexual Harassment Act) and Republic Act No. 11313 (Safe Spaces Act). Both laws require the employer to prevent harassment, to provide a procedure for complaints, and to act on them.'),
  subHead('Committee on Decorum and Investigation (CODI)'),
  p('The Company shall constitute a Committee on Decorum and Investigation composed of at least one representative each from management, the employees, and, where they exist, the supervisory ranks — with a balanced representation of sexes. Members shall receive training on gender sensitivity and on the handling of complaints. The CODI, not the Administrative Review Panel, handles complaints of sexual harassment and gender-based sexual harassment.'),
  subHead('What is prohibited'),
  bullet('Demanding, requesting or requiring a sexual favour in exchange for hiring, continued employment, promotion, a favourable evaluation, an assignment or any benefit — whether the demand is accepted or not.'),
  bullet('Unwanted sexual advances, remarks, jokes, gestures, or the display of sexual material.'),
  bullet('Gender-based sexual harassment under RA 11313, including catcalling, wolf-whistling, persistent unwanted comments on a person’s appearance, sexist or homophobic slurs, persistent telling of sexual jokes, unwanted invitations, and stalking — including where committed online or by message.'),
  bullet('Uploading, sharing or threatening to share intimate images or private information of a co-employee.', { after: 140 }),
  p('Harassment may be committed by anyone against anyone, regardless of sex, gender or rank, and regardless of whether there is a relationship of authority between them.'),
  subHead('How to complain'),
  p('A complaint may be made to any CODI member, to HRD, or to the Owner or General Manager, in writing or verbally. Where made verbally, the receiving officer shall put it in writing and have the complainant confirm it. The complaint shall be acted upon within ten (10) days of filing, and the investigation completed within a reasonable period.'),
  p('The complainant’s identity and the details of the complaint shall be kept confidential and disclosed only to those who must know in order to investigate, or to the extent required by the respondent’s right to due process. The respondent is entitled to the same due process as in Section 3.6, including a written notice of the specific acts complained of.'),
  p('Interim measures — separating the parties, changing assignments or reporting lines, adjusting schedules — may be taken to protect the complainant while an investigation is pending. Such measures shall not disadvantage the complainant, for example by moving them to a worse assignment or a lower rate.'),
  p('Nothing in this procedure prevents the complainant from also filing a criminal or civil action, or a complaint with the DOLE, the Commission on Human Rights or the Philippine Commission on Women. The Company shall not require a complainant to choose between the internal and the external remedy.'),
  note('Retaliation against a complainant', [
    'Retaliating against a person who has made a complaint of harassment in good faith, or who has given evidence in one, is a Class D offense punishable by dismissal, whether or not the underlying complaint is upheld.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),

  secHead('5.10  Mental Health and Non-Discrimination in Health', 'new'),
  p('Under Republic Act No. 11036, the Company shall raise awareness of mental health, provide access to services, and treat a mental health condition as a health matter and not as a disciplinary matter. An employee who seeks help for a mental health condition shall not be penalised, and information about it is confidential medical information.'),
  p('Under Republic Act No. 11166 (HIV and AIDS), Department Order No. 73-05 (tuberculosis) and Department Order No. 05-10 (Hepatitis B), no employee or applicant shall be required to disclose their status, subjected to compulsory testing as a condition of employment, dismissed, denied a benefit, or discriminated against by reason of actual or perceived status. Such information is strictly confidential.'),
  p('Where a health condition genuinely affects an employee’s ability to do a specific task safely, the Company shall consider reasonable accommodation — a change of task, of schedule, or of assignment — before considering any other action. Separation on the ground of disease requires a certification from a competent public health authority that the disease is of such nature or stage that it cannot be cured within six (6) months even with proper medical treatment, and carries the separation pay provided by law.'),
];

// =========================================================== PART VI
const part6 = () => [
  ...partHead('PART VI', 'Employment Actions and Separation'),

  secHead('6.1  Promotions, Transfers and Reclassification'),
  p('The Company supports the growth of qualified employees. Vacancies shall be announced internally before, or at the same time as, they are advertised externally, so that existing employees have a fair opportunity to apply.'),
  bullet([B('Lateral transfer. '), run('Movement to another position at the same salary range. The Company may transfer an employee where the business requires it, provided the transfer does not involve a demotion in rank, a diminution of salary or benefits, and is not unreasonable, inconvenient or prejudicial to the employee, and is not used as a form of punishment.')]),
  bullet([B('Promotion. '), run('Movement to a position with a higher pay grade. Promotion is based on the employee’s performance record, demonstrated capability, and the requirements of the position. A newly promoted employee may be placed on a promotional probation of up to six (6) months, during which failure to meet the standards of the new position results in return to the former position at the former rate, and never in dismissal.')]),
  bullet([B('Reclassification. '), run('A change in the duties attached to an existing job. Where the change is material, it requires the consent of the employee, and where it warrants a change in pay grade, the pay shall be adjusted.')], { after: 160 }),

  secHead('6.2  Performance Evaluation', 'rev'),
  p('Formal performance evaluations are conducted semi-annually for regular employees, and at the third and fifth month for probationary employees. The immediate superior rates the employee against the standards of the position and discusses the rating with them. The employee is entitled to see the completed evaluation, to write comments on it, and to receive a copy.'),
  p('Where performance falls below standard, the response is a written Performance Improvement Plan (PIP), not discipline. A PIP shall state the specific gaps, the standard to be reached, the support and training the Company will provide, and a review period of not less than sixty (60) days. Only where the employee fails to meet the standard after a genuine PIP may the Company consider separation for gross and habitual neglect or for inefficiency, following Section 3.6.'),
  note('Poor performance is not misconduct', [
    'An employee who is trying and failing needs training. An employee who is capable and refusing needs discipline. Treating the first as though it were the second is the most common and most expensive mistake an employer makes.',
  ], { edge: C.blue, fill: 'EEF3FB', labelColor: C.navy }),

  secHead('6.3  Termination by the Employer'),
  p('The Company may terminate employment only for a just cause or an authorized cause, and only after observing the applicable procedure.'),
  subHead('Just causes (Article 297) — no separation pay'),
  bullet('Serious misconduct, or willful disobedience of the lawful orders of the employer in connection with the employee’s work.'),
  bullet('Gross and habitual neglect of duties.'),
  bullet('Fraud, or willful breach of the trust reposed by the employer in the employee.'),
  bullet('Commission of a crime or offense against the employer, a member of the employer’s family, or the employer’s duly authorized representative.'),
  bullet('Other causes analogous to the foregoing.', { after: 140 }),
  p('Procedure: the twin-notice rule in Section 3.6 — Notice to Explain, at least five calendar days to answer, an opportunity to be heard, and a Notice of Decision.'),
  subHead('Authorized causes (Articles 298 and 299) — with separation pay'),
  ...(() => {
    const AW = [3900, 2200, 3646];
    return [simpleTable(
      ['AUTHORIZED CAUSE', 'SEPARATION PAY', 'PROCEDURE'],
      [
        ['Installation of labor-saving devices', '1 month pay or 1 month per year of service, whichever is higher', 'Written notice to the employee AND to the DOLE at least 30 days before the effective date'],
        ['Redundancy', '1 month pay or 1 month per year of service, whichever is higher', 'Same 30-day twin notice; the Company must show fair and reasonable criteria for selection'],
        ['Retrenchment to prevent losses', '1 month pay or 1/2 month per year of service, whichever is higher', 'Same 30-day twin notice; the Company must prove substantial and imminent losses'],
        ['Closure or cessation not due to serious losses', '1 month pay or 1/2 month per year of service, whichever is higher', 'Same 30-day twin notice'],
        ['Closure due to serious business losses', 'None', 'Same 30-day twin notice; losses must be proved'],
        ['Disease (Article 299)', '1 month pay or 1/2 month per year of service, whichever is higher', 'Certification by a competent public health authority that the disease cannot be cured within 6 months; 30-day notice'],
      ], AW, { left: [2] })];
  })(),
  gap(140),
  p('A fraction of at least six (6) months of service is counted as one (1) whole year in computing separation pay.'),
  p('An employee who is dismissed for a just cause is not entitled to separation pay. The Company may nevertheless grant financial assistance as an act of compassion where the cause did not involve serious misconduct or an act reflecting on moral character.'),

  secHead('6.4  Resignation', 'rev'),
  p('An employee who intends to resign shall serve a written notice at least thirty (30) calendar days before the intended date of effectivity, so that the Company can arrange a proper turnover and, where a client site is involved, inform the client. The Company may waive all or part of the notice period.'),
  p('An employee may resign without serving the thirty-day notice, and without liability, for any of the just causes in Article 300(b) of the Labor Code: serious insult by the employer or its representative on the honour and person of the employee; inhuman and unbearable treatment; commission of a crime against the employee or their immediate family by the employer or its representative; and other analogous causes.'),
  note(L.pick('The two-month liquidated damages clause is withdrawn',
             'No liquidated damages for short notice'), [
    L.pick(
      'The previous edition provided that an employee who failed to serve thirty days’ notice "shall be liable for liquidated damages equivalent to at least two (2) months’ salary". That provision is withdrawn.',
      'The Company does not charge liquidated damages against an employee who fails to serve the thirty (30) days’ notice of resignation.'),
    'An employer who suffers actual damage from an abrupt resignation may claim that damage in the proper forum, but it must prove the damage. What the Company may NOT do is withhold final pay, withhold a Certificate of Employment, or deduct a penalty from wages because notice was short. Those acts expose the Company to a money claim and to an illegal deduction finding.',
  ], { edge: C.Dtxt, fill: 'FDF0F0', labelColor: C.Dtxt }),
  gap(160),
  p('A resignation once accepted may be withdrawn only with the consent of the Company. An employee shall not be pressured into resigning in lieu of facing a disciplinary proceeding; a resignation obtained that way is not voluntary.'),

  secHead('6.5  Final Pay, Clearance and Certificate of Employment', 'new'),
  p('Final pay shall be released within thirty (30) calendar days from the date of separation, in accordance with DOLE Labor Advisory No. 06-20, unless a more favourable company policy or agreement provides for an earlier release. Final pay includes:'),
  bullet('unpaid earned salary up to the last day actually worked;'),
  bullet('pro-rated 13th month pay;'),
  bullet('cash conversion of unused Service Incentive Leave credits;'),
  bullet('separation pay, where the separation is for an authorized cause or is otherwise required;'),
  bullet('retirement pay, where applicable;'),
  bullet('any other amount due under company policy, an individual agreement, or a collective agreement.', { after: 140 }),
  p('Clearance. The employee shall return all company property — tools, instruments, ID, uniforms, phone, laptop, keys, documents — and settle accountabilities. Clearance shall be processed promptly and shall not be used to delay final pay beyond the thirty-day period. Where a specific accountability is disputed, the Company shall release the undisputed portion of the final pay on time.'),
  p('Certificate of Employment. A Certificate of Employment stating the dates of engagement and separation and the position or positions held shall be issued within three (3) days of request, at any time, whether the employee resigned or was dismissed, and whether or not clearance has been completed. Issuance shall never be made conditional on the signing of a quitclaim.'),
  p('Quitclaims. A quitclaim is voluntary. An employee is entitled to read it, to take it away, and to seek advice before signing. A quitclaim signed for a sum clearly less than what is legally due, or signed under pressure, does not bar a later claim.'),
  p('Exit interview. Separating employees are invited to an exit interview. It is voluntary. Its purpose is to gather information for improving company policy, and what is said in it shall not affect the employee’s final pay, Certificate of Employment or re-employment eligibility.'),
];

module.exports = { part5, part6 };
