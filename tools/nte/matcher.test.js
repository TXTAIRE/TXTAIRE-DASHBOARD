// Measures js/offense-matcher.js against incident reports written the way HR writes them.
//
//   node tools/nte/matcher.test.js
//
// Each case names the offense (or offenses) a careful HR officer would charge on those
// facts. `top1` passes when the first suggestion is one of them; `top3` when any of the
// first three is. Cases marked `below` assert that the matcher says there is no offense
// yet -- charging those would put an invalid NTE in front of an employee. Cases marked
// `ask` assert that the matcher asks for the fact that decides the tier instead of
// guessing it.
//
// Exits non-zero if accuracy falls under the floor, so a later edit to the lexicon or the
// catalog that quietly degrades suggestions fails loudly instead.
const path = require('path');
const fs = require('fs');
const M = require('../../js/offense-matcher.js');

function loadCatalog() {
  const src = fs.readFileSync(path.join(__dirname, '../../js/store.js'), 'utf8');
  const start = src.indexOf('[', src.indexOf('const DISCIPLINE_OFFENSE_CATALOG ='));
  let depth = 0, i = start, q = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '[') depth++;
    else if (ch === ']') { depth--; if (depth === 0) break; }
  }
  return eval('(' + src.slice(start, i + 1) + ')');
}

const CASES = [
  // ---- attendance
  { t: 'Juan arrived late for work five times this month, beyond the 15 minute grace period.', want: ['excessive-tardiness-count'] },
  { t: 'His total tardiness for August reached 340 minutes.', want: ['excessive-tardiness'] },
  { t: 'Was late twice this month.', below: 'excessive-tardiness-count' },
  { t: 'Did not report for work on September 3 and did not call or text anyone. No leave was filed.', want: ['simple-absence'] },
  { t: 'Absent without leave for three consecutive days, September 1 to 3, with no notice.', want: ['excessive-absence'] },
  { t: 'Has not reported for work for 7 consecutive days and cannot be reached; his family says he went home to the province.', want: ['abandonment'] },
  { t: 'Called in sick on time with a valid reason but did not file the leave form when he came back.', want: ['late-leave-filing'] },
  { t: 'Left the jobsite in Makati at 2pm without telling the supervisor and came back at 4pm.', want: ['wasting-time'] },
  { t: 'Went home one hour before the end of the shift without approval, twice this month.', want: ['undertime'] },
  { t: 'Agreed to the Saturday overtime but did not show up and gave no notice.', want: ['missed-overtime-callout'] },
  { t: 'Was absent from work.', ask: ['simple-absence', 'excessive-absence', 'abandonment', 'late-leave-filing'] },
  // ---- timekeeping
  { t: 'Asked a co-worker to punch in his biometrics for him while he was still on the way.', want: ['punching-others-timecard'] },
  { t: 'Altered his daily time record to show he worked until 8pm when CCTV shows he left at 5pm.', want: ['falsifying-timecards'] },
  { t: 'Forgot to log out on the biometric device 4 times this month.', want: ['repeated-failure-punch'] },
  { t: 'Forgot to punch out once.', below: 'repeated-failure-punch' },
  { t: 'Told HR he was absent because of a family emergency, but he was seen at a party that day. He lied.', want: ['false-reason-absent-late'] },
  // ---- safety
  { t: 'Was not wearing his safety harness and helmet while working on the rooftop condenser.', want: ['ppe-noncompliance', 'disobey-safety'] },
  { t: 'Smoked a cigarette inside the client building near the machine room.', want: ['smoking-vaping'] },
  { t: 'Reported for work drunk, smelled of alcohol and could not stand straight.', want: ['drinking-alcohol'] },
  { t: 'Tested positive for shabu in the drug test.', want: ['prohibited-drugs'] },
  { t: 'Brought a knife to the jobsite and kept it in his toolbox.', want: ['unauthorized-weapons'] },
  { t: 'Did not report the accident where his co-worker fell from the ladder.', want: ['failure-report-accident'] },
  // ---- performance
  { t: 'Fell asleep in the service van during working hours.', want: ['sleeping-on-duty'] },
  { t: 'Was playing mobile games for an hour instead of doing the installation.', want: ['loafing'] },
  { t: 'Not wearing the company uniform at the client site.', want: ['uniform-noncompliance'] },
  { t: 'Company phone was switched off the whole afternoon and dispatch could not reach him.', want: ['phone-unreachable'] },
  { t: 'Refused the supervisor’s instruction to clean the aircon filters and walked away.', want: ['insubordination'] },
  { t: 'Due to negligence he installed the wrong capacitor and the compressor burned; the damage is worth ₱18,000.', want: ['negligence-major-loss', 'carelessness-major-loss'] },
  { t: 'Carelessly dropped the client’s split-type unit; repair cost P3,500.', want: ['carelessness-minor-loss', 'negligence-minor-loss'] },
  { t: 'His negligence caused a refrigerant leak with a total loss of 45,000 pesos.', want: ['gross-habitual-neglect', 'carelessness-severe-loss'] },
  { t: 'Made a mistake in the installation.', ask: ['negligence-minor-loss', 'negligence-major-loss', 'gross-habitual-neglect'] },
  { t: 'Accepted ₱2,000 from the supplier in exchange for choosing their parts.', want: ['gross-misconduct-bribery'] },
  // ---- property
  { t: 'Tried to take home two copper tubes from the stockroom without a gate pass; the guard stopped him at the gate and the tubes were recovered.', want: ['attempted-removal-no-loss'] },
  { t: 'Stole cash from the petty cash box.', want: ['theft-pilferage'] },
  { t: 'Used the company van for a personal errand on Sunday. There was no damage.', want: ['unauthorized-vehicle-no-damage'] },
  { t: 'Drove the service van recklessly and hit a post, damaging the bumper.', want: ['reckless-driving-with-damage'] },
  { t: 'Spray painted graffiti on the stockroom wall.', want: ['vandalism'] },
  // ---- honesty
  { t: 'Collected payment from the client and did not remit it to the office.', want: ['withholding-funds'] },
  { t: 'Submitted a fake receipt for reimbursement of gas.', want: ['falsification-records', 'forgery'] },
  { t: 'Has a side business installing aircon for private clients using the company’s client list.', want: ['competing-business', 'undeclared-sideline', 'espionage'] },
  // ---- conduct
  { t: 'Was rude and shouted at the client’s building admin.', want: ['gross-discourtesy'] },
  { t: 'Cursed at his supervisor and called him names in front of the team.', want: ['disrespect-threats'] },
  { t: 'Threatened to hurt his co-worker after the shift.', want: ['threat-of-harm'] },
  { t: 'Got into a fist fight with a co-worker at the warehouse; no one was seriously hurt.', want: ['fighting-on-premises'] },
  { t: 'Punched a co-worker, who suffered a broken nose and needed stitches. He started the fight.', want: ['fighting-aggravated'] },
  { t: 'Got into a fight with a co-worker.', ask: ['fighting-on-premises', 'fighting-aggravated'] },
  { t: 'Touched a female co-worker inappropriately and made sexual remarks.', want: ['immoral-conduct'] },
  { t: 'Was caught playing cards for money (tong-its) during lunch at the office.', want: ['gambling'] },
  { t: 'Selling food and longganisa to co-workers inside the office during working hours.', want: ['unauthorized-business'] },
  { t: 'Spreading false rumours that his teammate is stealing.', want: ['intrigues'] },
  { t: 'Repeatedly mocking and humiliating a new technician in the group chat over several weeks.', want: ['bullying'] },
  { t: 'Supervisor fined his technician ₱500 for being late, outside the Code.', want: ['informal-penalty'] },
  // ---- Taglish / Filipino
  { t: 'Hindi pumasok ng 3 araw nang walang paalam.', want: ['excessive-absence'] },
  { t: 'Lasing na pumasok sa trabaho.', want: ['drinking-alcohol'] },
  { t: 'Nakipag-away sa katrabaho sa site, walang nasugatan.', want: ['fighting-on-premises'] },
  { t: 'Nagnakaw ng tools sa stockroom.', want: ['theft-pilferage'] },
  { t: 'Nakatulog sa oras ng trabaho.', want: ['sleeping-on-duty'] },
  { t: 'Paulit-ulit na late, 6 na beses sa isang buwan.', want: ['excessive-tardiness-count'] },
  { t: 'Minura ang supervisor sa harap ng mga katrabaho.', want: ['disrespect-threats'] },
];

const catalog = loadCatalog();
let top1 = 0, top3 = 0, wantN = 0, belowOk = 0, belowN = 0, askOk = 0, askN = 0;
const failures = [];

for (const c of CASES) {
  const r = M.suggest(catalog, c.t, { limit: 5 });
  const codes = r.suggestions.map(s => s.code);
  if (c.want) {
    wantN++;
    const hit1 = c.want.includes(codes[0]);
    const hit3 = codes.slice(0, 3).some(x => c.want.includes(x));
    if (hit1) top1++;
    if (hit3) top3++;
    if (!hit1) failures.push({ kind: hit3 ? 'top3-only' : 'MISS', t: c.t, want: c.want, got: codes.slice(0, 3) });
  } else if (c.below) {
    belowN++;
    const flagged = r.suggestions.some(s => s.code === c.below && s.belowThreshold);
    if (flagged) belowOk++; else failures.push({ kind: 'BELOW NOT FLAGGED', t: c.t, want: [c.below], got: codes.slice(0, 3) });
  } else if (c.ask) {
    askN++;
    const first = r.suggestions[0];
    const asked = first && c.ask.includes(first.code) && first.needsFact && !first.tierReason;
    if (asked) askOk++; else failures.push({ kind: 'DID NOT ASK', t: c.t, want: c.ask, got: codes.slice(0, 3), note: first && (first.tierReason || '(no tier note)') });
  }
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 100) + '%';
console.log('cases: %d charge, %d below-threshold, %d missing-fact', wantN, belowN, askN);
console.log('  top-1 correct    %s  (%d/%d)', pct(top1, wantN), top1, wantN);
console.log('  top-3 correct    %s  (%d/%d)', pct(top3, wantN), top3, wantN);
console.log('  below flagged    %s  (%d/%d)', pct(belowOk, belowN), belowOk, belowN);
console.log('  asks for fact    %s  (%d/%d)', pct(askOk, askN), askOk, askN);
if (failures.length) {
  console.log('\nnot first-choice correct:');
  for (const f of failures) console.log('  [%s] %s\n      want %s | got %s%s', f.kind, f.t, f.want.join(' / '), f.got.join(', '), f.note ? ' | ' + f.note : '');
}

const FLOOR = { top1: 0.85, top3: 0.97, below: 1, ask: 1 };
const ok = top1 / wantN >= FLOOR.top1 && top3 / wantN >= FLOOR.top3 && belowOk === belowN && askOk === askN;
console.log('\n' + (ok ? 'PASS' : 'FAIL') + ' (floors: top-1 85%, top-3 97%, all below-threshold and missing-fact cases)');
process.exit(ok ? 0 : 1);
