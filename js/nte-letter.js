// Builds a Notice to Explain letter that follows the Code of Discipline, Series 2, 2026
// Edition: Annex A (Form CD-01), and Section 3.6, Step 2.
//
// Section 3.6 says what an NTE MUST state, and every item below exists to satisfy one of
// those requirements -- none is decoration:
//
//   - the specific acts or omissions complained of, including the date, time and place
//                                                                      -> item 1
//   - the specific provisions of the Code or company rules violated     -> item 2
//   - that the employee may explain and submit evidence and witnesses   -> item 4
//   - that dismissal is being considered, where that is the case         -> item 3
//   - the deadline, not less than five (5) calendar days from receipt   -> item 4
//
// and it says "a general statement such as 'you violated company rules' is not a valid
// NTE." Getting any of these wrong does not merely weaken a case -- the Code's own note is
// that it exposes the Company to nominal damages even where the penalty was deserved. So
// buildNte() refuses to produce a letter that is missing one, rather than producing a
// defective one quietly: see `problems`.
//
// One model is built, and both the stored text and the printable page are rendered from
// it, so what is filed on the case and what the employee signs cannot differ.
(function (root) {
  'use strict';

  const CODE_TITLE = 'Code of Discipline, Series 2, 2026 Edition';

  // Part IV section for each catalog category, with the title exactly as printed. An
  // offense HR has added under a category of its own has no printed section, and is cited
  // by its category name instead.
  const SECTIONS = {
    'Attendance and Punctuality': ['4.1', 'Offenses Against Attendance and Punctuality'],
    'Timekeeping and Records': ['4.2', 'Offenses on Timekeeping and Records'],
    'Health, Safety and Security': ['4.3', 'Offenses Against Health, Safety and Security'],
    'Job Performance': ['4.4', 'Offenses Related to Job Performance'],
    'Company and Client Property': ['4.5', 'Offenses Against Company and Client Property'],
    'Honesty and Integrity': ['4.6', 'Offenses Against Honesty and Integrity'],
    'Proper Conduct and Behavior': ['4.7', 'Offenses Against Proper Conduct and Behavior'],
    'Accountability of Supervisors and Managers': ['4.8', 'Accountability of Supervisors and Managers'],
  };

  const CLASS_NAMES = { A: 'Light', B: 'Less Grave', C: 'Grave', D: 'Serious' };

  const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const ordinalWord = (n) => ORDINALS[n - 1] || (n + 'th');

  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven',
    'twenty-eight', 'twenty-nine', 'thirty'];
  const numberWords = (n) => (NUMBER_WORDS[n] ? NUMBER_WORDS[n] + ' (' + n + ')' : String(n));

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];
  function longDate(iso) {
    if (!iso) return '';
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return MONTHS[m - 1] + ' ' + d + ', ' + y;
  }

  function daysBetween(fromIso, toIso) {
    const a = Date.UTC(...fromIso.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
    const b = Date.UTC(...toIso.split('-').map((x, i) => (i === 1 ? Number(x) - 1 : Number(x))));
    return Math.round((b - a) / 86400000);
  }

  // Sec. 3.6 and DOLE D.O. 147-15. The app's own constant is Store.NTE_MIN_ANSWER_DAYS;
  // the form passes it in as `minDays` so the rule lives in one place. This default only
  // matters when the builder runs without the app, as it does in the tests.
  const MIN_DAYS = 5;

  // ---------------------------------------------------------------- model
  function buildNte(input) {
    const i = input || {};
    const problems = [];
    const need = (cond, msg) => { if (!cond) problems.push(msg); };

    const narrative = String((i.incident && i.incident.narrative) || '').trim();
    const place = String((i.incident && i.incident.place) || '').trim();
    const time = String((i.incident && i.incident.time) || '').trim();
    const incidentDate = (i.incident && i.incident.date) || '';

    need(i.employee && i.employee.name, 'Choose the employee.');
    need(narrative.length >= 30, 'Describe what happened in specific terms. Section 3.6: a general statement such as "you violated company rules" is not a valid NTE.');
    need(incidentDate, 'Give the date of the incident. Section 3.6 requires the date, time and place of each act.');
    need(time, 'Give the time of the incident — an approximate time is acceptable ("around 2:00 PM", "during the morning shift"). Section 3.6 requires it.');
    need(place, 'Give the place of the incident. Section 3.6 requires it.');
    need(i.offense && i.offense.code && i.offense.label, 'Choose the offense from the Code of Discipline. Section 3.6 requires the specific provision violated.');
    if (i.analogous) {
      need(String(i.unlistedReason || '').trim().length >= 20, 'Explain why this act is grossly prejudicial to the Company. Section 3.13 only allows an unlisted act to be charged where it is.');
    }
    need(String(i.issuedBy || '').trim(), 'Give the name of the HR officer issuing the notice. Annex A has it signed over printed name.');
    need(i.dateIssued, 'Give the date the notice is issued.');
    need(i.dueDate, 'Give the deadline for the written explanation.');

    const minDays = Number(i.minDays) > 0 ? Number(i.minDays) : MIN_DAYS;
    let days = null;
    if (i.dateIssued && i.dueDate) {
      days = daysBetween(i.dateIssued, i.dueDate);
      need(days >= minDays, 'The deadline must be at least ' + numberWords(minDays) + ' calendar days after the notice is issued (Section 3.6; DOLE Department Order No. 147-15). It is ' + days + ' day' + (days === 1 ? '' : 's') + '. A shorter period does not merely weaken the case — it exposes the Company to nominal damages even where the penalty was deserved.');
    }
    if (incidentDate && i.dateIssued) need(incidentDate <= i.dateIssued, 'The incident date is after the date of issue.');

    const offense = i.offense || {};
    const klass = offense.klass || '';
    const section = SECTIONS[offense.category];
    const citation = section
      ? CODE_TITLE + ', Part IV, Section ' + section[0] + ' (' + section[1] + ')'
      : CODE_TITLE + ', Part IV (' + (offense.category || 'offense') + ')';

    const penalty = i.penalty || null;
    const dismissal = !!i.dismissalConsidered;

    const model = {
      refNo: i.refNo || '',
      dateIssued: i.dateIssued || '',
      dueDate: i.dueDate || '',
      days: days,
      employee: i.employee || {},
      superiorName: i.superiorName || '',
      issuedBy: i.issuedBy || '',
      narrative: narrative,
      incidentDate: incidentDate,
      time: time,
      place: place,
      offense: offense,
      klass: klass,
      className: CLASS_NAMES[klass] || '',
      citation: citation,
      analogous: !!i.analogous,
      unlistedReason: String(i.unlistedReason || '').trim(),
      penalty: penalty,
      dismissal: dismissal,
    };
    return { ok: problems.length === 0, problems: problems, model: model, text: toText(model), html: toHtml(model) };
  }

  // ---------------------------------------------------------------- sections
  // Returned as [heading, [paragraphs]] so text and HTML share every sentence.
  function body(m) {
    const out = [];

    out.push([null, [
      'You are hereby directed to explain in writing why no disciplinary action should be taken against you for the act or omission described below.',
    ]]);

    out.push(['1.  Specific act or omission complained of', [
      m.narrative,
      'Date: ' + longDate(m.incidentDate) + '    Time: ' + m.time + '    Place: ' + m.place,
    ]]);

    const provision = [];
    if (m.analogous) {
      provision.push('The act described above is not specifically listed in Part IV of the Code of Discipline. It is charged under Section 3.13, which permits the Company to act on an act grossly prejudicial to the Company, but only by applying the class of the most closely analogous listed offense, and only after the full procedure in Section 3.6.');
      provision.push('Why the act is grossly prejudicial to the Company: ' + m.unlistedReason);
      provision.push('The most closely analogous listed offense, whose class is applied: ' + m.citation + ' — "' + m.offense.label + '".');
    } else {
      provision.push(m.citation + ':');
      provision.push('"' + m.offense.label + '"');
    }
    out.push(['2.  Provision of the Code of Discipline violated', provision]);

    const pen = [];
    if (m.klass) {
      pen.push('Class ' + m.klass + ' — ' + m.className + '.');
      if (m.penalty && m.penalty.label) {
        pen.push('Under the Schedule of Penalties in Section 3.4, offenses of the same class within a twelve (12) month period are counted together. Company records show that this would be your ' +
          ordinalWord(m.penalty.occurrence) + ' Class ' + m.klass + ' offense in that period, for which the penalty is: ' + m.penalty.label + '.');
      }
      if (m.penalty && m.penalty.habitual) {
        pen.push('This would be your fifth Class A offense within twelve (12) months. Under Section 3.4, a fifth Class A offense within the same period is dealt with under Section 3.10 (Habitual Delinquency).');
      }
      pen.push('That is the normal penalty under the Code, not a decision. Before any penalty is imposed, your explanation will be considered, together with any mitigating and aggravating circumstances under Section 3.5.');
    }
    if (m.dismissal) {
      pen.push('DISMISSAL IS BEING CONSIDERED in this case. Because it is, an administrative conference will be held before any decision is made.');
    }
    out.push(['3.  Class of offense and penalty being considered', pen]);

    const window = numberWords(m.days) + ' calendar days';
    out.push(['4.  Your right to explain', [
      'You are required to submit a written explanation to the Human Resources Department within ' + window +
        ' from your receipt of this notice, that is, on or before ' + longDate(m.dueDate) + '. You may use the Employee Written Explanation form (Annex B). You may attach any document and name any witness. You may be assisted by a representative or counsel of your own choosing, at your own expense, and you may request an extension in writing.',
    ]]);

    out.push(['5.  Administrative conference', [
      'A conference will be scheduled if you request one, if the facts are disputed, or if dismissal is being considered. You will be given written notice at least three (3) working days in advance.',
    ]]);

    out.push(['6.  Failure to respond', [
      'If you do not reply within the period given and do not ask for an extension, the case will be decided on the records available. Failure to reply is not by itself an admission.',
    ]]);

    out.push([null, [
      'This notice is not a decision. No finding has been made against you and no penalty has been imposed.',
    ]]);

    return out;
  }

  // ---------------------------------------------------------------- text
  function toText(m) {
    const lines = [];
    lines.push('TXTAIRE OPC — Human Resources Department');
    lines.push('NOTICE TO EXPLAIN                                   Form CD-01');
    lines.push(CODE_TITLE);
    lines.push('');
    lines.push('Reference No.: ' + (m.refNo || '—'));
    lines.push('Date issued: ' + longDate(m.dateIssued));
    lines.push('To: ' + (m.employee.name || ''));
    lines.push('Position / Department: ' + [m.employee.position, m.employee.category].filter(Boolean).join(' — '));
    lines.push('Immediate superior: ' + (m.superiorName || '—'));
    lines.push('');
    for (const [head, paras] of body(m)) {
      if (head) lines.push(head.toUpperCase());
      for (const p of paras) lines.push(p);
      lines.push('');
    }
    lines.push('Issued by: ______________________________   ' + (m.issuedBy || '') + ', Human Resources Department');
    lines.push('');
    lines.push('Received by: ____________________________   Signature over printed name, date and time of receipt');
    lines.push('');
    lines.push('IF THE EMPLOYEE REFUSES TO RECEIVE OR SIGN: annotate the refusal below before a witness, and send a copy to the employee’s last known address by registered mail or courier.');
    lines.push('Annotation: ____________________________________________');
    lines.push('Witness: ______________________________   Date: ____________');
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- html
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function toHtml(m) {
    const rows = [
      ['Reference No.', m.refNo || '—'],
      ['Date issued', longDate(m.dateIssued)],
      ['Employee', m.employee.name || ''],
      ['Position / Department', [m.employee.position, m.employee.category].filter(Boolean).join(' — ')],
      ['Immediate superior', m.superiorName || '—'],
    ];
    const sections = body(m).map(([head, paras]) => {
      const ps = paras.map((p) => {
        const strong = /^DISMISSAL IS BEING CONSIDERED/.test(p) || /^This notice is not a decision/.test(p);
        const quote = /^".*"$/.test(p);
        return '<p' + (strong ? ' class="strong"' : quote ? ' class="quote"' : '') + '>' + esc(p) + '</p>';
      }).join('');
      return (head ? '<h3>' + esc(head) + '</h3>' : '') + ps;
    }).join('');

    return '<!doctype html><html><head><meta charset="utf-8"><title>Notice to Explain ' + esc(m.refNo) + '</title>' +
      '<style>' +
      '@page{size:A4;margin:18mm 18mm 20mm}' +
      'body{font:10.5pt/1.5 Arial,Helvetica,sans-serif;color:#1a1a1a;margin:0}' +
      '.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1f4e9c;padding-bottom:8px;margin-bottom:14px}' +
      '.org{font-weight:700;font-size:12pt;color:#16386e}.org small{display:block;font-weight:400;font-size:9pt;color:#555}' +
      '.form{text-align:right;font-size:9pt;color:#555}' +
      'h1{font-size:15pt;letter-spacing:.06em;color:#fff;background:#1f4e9c;padding:7px 12px;margin:0 0 12px;border-bottom:3px solid #e8a317}' +
      'table.meta{border-collapse:collapse;width:100%;margin-bottom:12px}table.meta td{border:1px solid #c7d2e4;padding:4px 8px;font-size:9.5pt}' +
      'table.meta td:first-child{background:#edf1f8;font-weight:700;width:34%}' +
      'h3{font-size:10.5pt;color:#16386e;margin:12px 0 4px;border-bottom:1px solid #bfcfe8}' +
      'p{margin:0 0 6px;text-align:justify}p.quote{margin-left:14px;font-style:italic}' +
      'p.strong{font-weight:700;background:#fdf0f0;border-left:3px solid #9c1c1c;padding:5px 8px}' +
      '.sign{display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:26px}' +
      '.line{border-top:1px solid #333;padding-top:3px;font-size:9pt;margin-top:34px}' +
      '.refuse{margin-top:20px;border:1px dashed #999;padding:8px 10px;font-size:9pt}' +
      '.refuse .line{margin-top:22px}' +
      '.foot{margin-top:18px;font-size:8pt;color:#777;border-top:1px solid #ddd;padding-top:4px}' +
      '@media screen{body{max-width:190mm;margin:14px auto;padding:0 12px}}' +
      '</style></head><body>' +
      '<div class="head"><div class="org">TXTAIRE OPC<small>Human Resources Department</small></div>' +
      '<div class="form">Form CD-01<br>' + esc(CODE_TITLE) + '</div></div>' +
      '<h1>NOTICE TO EXPLAIN</h1>' +
      '<table class="meta">' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</table>' +
      sections +
      '<div class="sign">' +
      '<div><div class="line">Issued by (HRD) — signature over printed name<br>' + esc(m.issuedBy) + '</div></div>' +
      '<div><div class="line">Received by (Employee) — signature over printed name, date and time of receipt</div></div>' +
      '</div>' +
      '<div class="refuse"><strong>If the employee refuses to receive or to sign.</strong> Annotate the refusal below before a witness, and send a copy to the employee’s last known address by registered mail or courier (Section 3.6).' +
      '<div class="line">Annotation</div>' +
      '<div class="sign" style="margin-top:0"><div class="line">Witness — signature over printed name</div><div class="line">Date</div></div></div>' +
      '<div class="foot">' + esc(m.refNo) + ' · Issued under Section 3.6 of the ' + esc(CODE_TITLE) + '. Keep the signed original in the employee’s 201 file.</div>' +
      '</body></html>';
  }

  const api = { buildNte, SECTIONS, MIN_DAYS, longDate, daysBetween };
  root.NteLetter = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
