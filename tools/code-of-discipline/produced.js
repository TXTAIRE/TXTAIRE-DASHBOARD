// Prints every prose run the content modules produce, tagged with its origin, so
// dropcheck.py can compare that against what actually reached the built DOCX.
//
// note() renders an item written as [ 'a string' ] as an EMPTY paragraph: it treats an
// array item as a list of TextRuns, and docx drops a bare string in that position without
// warning. Three prohibitions in Section 3.12 were lost this way, in every edition
// shipped so far. This finds any other place it happens.
const L = require('./lib.js');
L.setLang(process.env.CODE_LANG === 'fil' ? 'fil' : 'en');
L.setAudience(process.env.CODE_AUDIENCE === 'employee' ? 'employee' : 'full');

const strings = (o) => {
  const acc = [];
  const seen = new Set();
  (function w(x) {
    if (x === null || typeof x !== 'object' || seen.has(x)) return;
    seen.add(x);
    for (const k of Object.keys(x)) {
      const v = x[k];
      if (typeof v === 'string') { if (v.length > 40) acc.push(v); } else w(v);
    }
  })(o);
  return acc;
};

const produced = [];
const FIL = process.env.CODE_LANG === 'fil';
const mods = FIL ? {
  'fil-front.js': ['cover', 'missionVision', 'controlSheet'],
  'fil-changes.js': ['summaryOfChanges'],
  'fil-parts13.js': ['part1', 'part2'],
  'fil-part3.js': ['part3'],
  'fil-part4.js': ['part4'],
  'fil-parts56.js': ['part5', 'part6'],
  'fil-annex.js': ['annexes'],
} : {
  'front.js': ['cover', 'missionVision', 'controlSheet'],
  'changes.js': ['summaryOfChanges'],
  'parts13.js': ['part1', 'part2', 'part3'],
  'part4.js': ['part4'],
  'parts56.js': ['part5', 'part6'],
  'annex.js': ['annexes'],
};
const EMPLOYEE = process.env.CODE_AUDIENCE === 'employee';
for (const f of Object.keys(mods)) {
  if (EMPLOYEE && f.indexOf('changes.js') !== -1) continue;   // omitted by design
  const mod = require('./' + f);
  for (const fn of mods[f]) {
    if (typeof mod[fn] !== 'function') continue;
    for (const s of strings(mod[fn]())) produced.push([f + ':' + fn, s]);
  }
}

process.stdout.write(JSON.stringify(produced));
