// A HELD-OUT set for js/offense-matcher.js -- written after the matcher was tuned against
// matcher.test.js, and not used to tune it. matcher.test.js measures fit; this measures
// how the matcher does on reports it has never seen, which is the number that predicts
// what HR will actually get.
//
//   node tools/nte/matcher.holdout.js
//
// Do not "fix" a failure here by adjusting the lexicon to this exact wording and then
// calling the result accuracy. If a failure reveals a genuine gap, fix it, move the case
// into matcher.test.js, and write a new held-out case to replace it.
const M = require('../../js/offense-matcher.js');
const { loadCatalog } = require('./explain.js');

const CASES = [
  { t: 'Employee failed to come to work last Monday. HR tried calling, no answer, no message was sent.', want: ['simple-absence'] },
  { t: 'He was tardy on six separate occasions in October.', want: ['excessive-tardiness-count'] },
  { t: 'Did not show up for four straight days and did not inform anyone.', want: ['excessive-absence'] },
  { t: 'Technician abandoned the Pasig project and left before lunch without his team lead’s approval, and did not return.', want: ['wasting-time'] },
  { t: 'Timesheet shows 8 hours at the Ortigas site but the client logbook shows he signed out at 1pm.', want: ['falsifying-timecards', 'falsification-records'] },
  { t: 'Had a co-technician time in on the biometrics under his name.', want: ['punching-others-timecard'] },
  { t: 'Came to the site intoxicated and was sent home by the foreman.', want: ['drinking-alcohol'] },
  { t: 'Positive result for methamphetamine on the random drug test.', want: ['prohibited-drugs'] },
  { t: 'Climbed the scaffolding without any safety harness despite the posted rule.', want: ['ppe-noncompliance', 'disobey-safety'] },
  { t: 'Vaping inside the client’s server room.', want: ['smoking-vaping'] },
  { t: 'Kept a gun in his bag inside the office.', want: ['unauthorized-weapons'] },
  { t: 'Caught sleeping on the job at the Makati warehouse.', want: ['sleeping-on-duty'] },
  { t: 'Ignored the team leader’s order to finish the ducting and went to rest instead.', want: ['insubordination'] },
  { t: 'Spent most of the afternoon scrolling Facebook and TikTok instead of servicing units.', want: ['loafing'] },
  { t: 'Wrong refrigerant was charged into the unit due to his negligence; the compressor needs replacement worth ₱52,000.', want: ['gross-habitual-neglect', 'carelessness-severe-loss'] },
  { t: 'Pocketed the ₱8,500 cash payment from the client instead of turning it over.', want: ['withholding-funds', 'misappropriation', 'theft-pilferage'] },
  { t: 'Took copper pipes and a vacuum pump home from the stockroom; the items have not been returned.', want: ['attempted-removal-with-loss', 'theft-pilferage'] },
  { t: 'Borrowed the company pickup truck on the weekend for his own use without asking.', want: ['unauthorized-vehicle-no-damage', 'unauthorized-vehicle-with-damage'] },
  { t: 'Supplier gave him a cash kickback for approving their overpriced quotation.', want: ['gross-misconduct-bribery'] },
  { t: 'Doing aircon repair jobs on the side for the company’s own customers and charging them directly.', want: ['competing-business', 'undeclared-sideline', 'unauthorized-broker'] },
  { t: 'Yelled at and insulted the client’s property manager during the site visit.', want: ['gross-discourtesy'] },
  { t: 'Used foul and abusive words against his team leader.', want: ['disrespect-threats'] },
  { t: 'Told a co-worker he would kill him if he reported the missing tools.', want: ['threat-of-harm', 'threat-with-weapon'] },
  { t: 'Slapped a fellow technician during an argument in the stockroom; there were no injuries.', want: ['fighting-on-premises'] },
  { t: 'Sent lewd messages and repeatedly asked a female staff member out after she refused.', want: ['immoral-conduct'] },
  { t: 'Organised betting on basketball games among the staff at the office.', want: ['gambling'] },
  { t: 'Posted a photo mocking a colleague on Facebook with insulting captions.', want: ['obscene-materials', 'bullying'] },
  { t: 'Team leader deducted ₱300 from a helper’s pay for arriving late.', want: ['informal-penalty'] },
  { t: 'Nag-inom sa site at pumasok na lasing.', want: ['drinking-alcohol'] },
  { t: 'Hindi pumasok ng isang araw at walang paalam sa supervisor.', want: ['simple-absence'] },
];

const catalog = loadCatalog();
let top1 = 0, top3 = 0;
const misses = [];
// Calibration: when the first suggestion is labelled high confidence, how often is it
// right? That, more than raw accuracy, decides whether HR can lean on the label.
const conf = { high: [0, 0], medium: [0, 0], low: [0, 0] };
for (const c of CASES) {
  const sug = M.suggest(catalog, c.t, { limit: 5 }).suggestions;
  const codes = sug.map(s => s.code);
  if (sug[0]) { const b = conf[sug[0].confidence]; b[1]++; if (c.want.includes(codes[0])) b[0]++; }
  const h1 = c.want.includes(codes[0]);
  const h3 = codes.slice(0, 3).some(x => c.want.includes(x));
  if (h1) top1++;
  if (h3) top3++;
  if (!h1) misses.push({ kind: h3 ? 'top3-only' : 'MISS', t: c.t, want: c.want, got: codes.slice(0, 3) });
}
const pct = (a) => Math.round((100 * a) / CASES.length) + '%';
console.log('held-out cases: %d', CASES.length);
console.log('  top-1 correct  %s  (%d/%d)', pct(top1), top1, CASES.length);
console.log('  top-3 correct  %s  (%d/%d)', pct(top3), top3, CASES.length);
console.log('  first suggestion, by the confidence it was labelled:');
for (const k of ['high', 'medium', 'low']) {
  const [ok, n] = conf[k];
  console.log('    %s  %s correct  (%d/%d)', k.padEnd(6), n ? Math.round((100 * ok) / n) + '%' : ' n/a', ok, n);
}
for (const m of misses) console.log('  [%s] %s\n      want %s | got %s', m.kind, m.t, m.want.join(' / '), m.got.join(', '));
