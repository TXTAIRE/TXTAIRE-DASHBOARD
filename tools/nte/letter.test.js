// Checks js/nte-letter.js against what Section 3.6 of the Code of Discipline requires an
// NTE to state, and against the defects that would make one invalid.
//
//   node tools/nte/letter.test.js
const L = require('../../js/nte-letter.js');

let failed = 0;
const check = (name, cond, detail) => {
  console.log((cond ? '  ok    ' : '  FAIL  ') + name + (cond || !detail ? '' : '\n        ' + detail));
  if (!cond) failed++;
};

const base = {
  refNo: 'NTE-20260914-A1B2',
  dateIssued: '2026-09-14',
  dueDate: '2026-09-19',
  employee: { name: 'Juan Dela Cruz', position: 'Aircon Technician', category: 'Field' },
  superiorName: 'Maria Santos',
  issuedBy: 'Ana Reyes',
  incident: {
    narrative: 'Reported for work at the Makati jobsite smelling strongly of alcohol, was unsteady on his feet, and was sent home by the foreman.',
    date: '2026-09-12', time: 'around 8:00 AM', place: 'Client jobsite, Makati City',
  },
  offense: { code: 'drinking-alcohol', label: 'Reporting for work under the influence of alcohol; or drinking alcoholic beverages within company or client premises', category: 'Health, Safety and Security', klass: 'C' },
  penalty: { occurrence: 1, label: '7-day suspension', isDismissal: false, habitual: false },
  dismissalConsidered: false,
};

console.log('complete, valid notice');
let r = L.buildNte(base);
check('builds without problems', r.ok, r.problems.join(' | '));
check('states the specific act', r.text.includes('smelling strongly of alcohol'));
check('states date, time and place', r.text.includes('September 12, 2026') && r.text.includes('around 8:00 AM') && r.text.includes('Makati City'));
check('cites Part IV section and title', r.text.includes('Part IV, Section 4.3 (Offenses Against Health, Safety and Security)'));
check('quotes the offense', r.text.includes('"Reporting for work under the influence of alcohol'));
check('states class and penalty step', r.text.includes('Class C — Grave') && r.text.includes('first Class C offense') && r.text.includes('7-day suspension'));
check('says same-class offenses are counted together', r.text.includes('offenses of the same class'));
check('says the penalty is not a decision (Sec. 3.5)', r.text.includes('Section 3.5'));
check('gives five calendar days and the date', r.text.includes('five (5) calendar days') && r.text.includes('September 19, 2026'));
check('right to documents, witnesses, counsel, extension', ['document', 'witness', 'counsel', 'extension'].every(w => r.text.includes(w)));
check('conference notice of three working days', r.text.includes('three (3) working days'));
check('failure to reply is not an admission', r.text.includes('not by itself an admission'));
check('no dismissal wording when not considered', !r.text.includes('DISMISSAL IS BEING CONSIDERED'));
check('refusal-to-sign annotation block', r.text.includes('REFUSES TO RECEIVE OR SIGN'));
check('html renders the same act', r.html.includes('smelling strongly of alcohol') && r.html.includes('NOTICE TO EXPLAIN'));

console.log('\ndeadlines');
r = L.buildNte(Object.assign({}, base, { dueDate: '2026-09-17' }));
check('3-day deadline is refused', !r.ok && r.problems.some(p => p.includes('at least five (5) calendar days')), r.problems.join(' | '));
r = L.buildNte(Object.assign({}, base, { dueDate: '2026-09-18' }));
check('4-day deadline is refused', !r.ok);
r = L.buildNte(Object.assign({}, base, { dueDate: '2026-09-24' }));
check('10-day deadline allowed and worded', r.ok && r.text.includes('ten (10) calendar days'), r.problems.join(' | '));

console.log('\nrequired particulars (Sec. 3.6)');
const without = (path) => {
  const c = JSON.parse(JSON.stringify(base));
  const keys = path.split('.');
  let o = c; for (let k = 0; k < keys.length - 1; k++) o = o[keys[k]];
  o[keys[keys.length - 1]] = '';
  return L.buildNte(c);
};
check('refuses a vague narrative', !L.buildNte(Object.assign({}, base, { incident: Object.assign({}, base.incident, { narrative: 'Violated company rules.' }) })).ok);
check('refuses a missing incident date', !without('incident.date').ok);
check('refuses a missing time', !without('incident.time').ok);
check('refuses a missing place', !without('incident.place').ok);
check('refuses a missing offense', !L.buildNte(Object.assign({}, base, { offense: {} })).ok);
check('refuses an incident dated after issue', !L.buildNte(Object.assign({}, base, { incident: Object.assign({}, base.incident, { date: '2026-09-15' }) })).ok);

console.log('\ndismissal and habitual delinquency');
r = L.buildNte(Object.assign({}, base, { dismissalConsidered: true, penalty: { occurrence: 3, label: 'Dismissal', isDismissal: true } }));
check('states dismissal is being considered', r.ok && r.text.includes('DISMISSAL IS BEING CONSIDERED'), r.problems.join(' | '));
check('says a conference will be held', r.text.includes('administrative conference will be held before any decision'));
r = L.buildNte(Object.assign({}, base, {
  offense: Object.assign({}, base.offense, { klass: 'A', category: 'Job Performance' }),
  penalty: { occurrence: 5, label: '7-day suspension', habitual: true },
}));
check('flags fifth Class A for Sec. 3.10', r.text.includes('fifth Class A offense') && r.text.includes('Section 3.10'));

console.log('\nunlisted act (Sec. 3.13)');
r = L.buildNte(Object.assign({}, base, { analogous: true, unlistedReason: '' }));
check('refuses an unlisted act without saying why it is grossly prejudicial', !r.ok && r.problems.some(p => p.includes('Section 3.13')));
r = L.buildNte(Object.assign({}, base, { analogous: true, unlistedReason: 'It exposed a client to a fire hazard and led the client to suspend the service contract.' }));
check('cites Sec. 3.13 and the analogous offense', r.ok && r.text.includes('Section 3.13') && r.text.includes('most closely analogous'), r.problems.join(' | '));

console.log('\nescaping');
r = L.buildNte(Object.assign({}, base, { incident: Object.assign({}, base.incident, { narrative: 'Wrote <script>alert(1)</script> on the whiteboard at the office in front of the whole team.' }) }));
check('narrative is escaped in the printable page', !r.html.includes('<script>alert') && r.html.includes('&lt;script&gt;'));

console.log('\n' + (failed ? failed + ' FAILED' : 'all passed'));
process.exit(failed ? 1 : 0);
