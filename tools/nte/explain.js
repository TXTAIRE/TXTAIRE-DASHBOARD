// Shows why the matcher ranked what it did for one narrative.
//
//   node tools/nte/explain.js "Punched a co-worker who needed stitches."
//
// Prints the facts read from the narrative, the Code vocabulary it mapped onto, and each
// suggestion's score, the narrative words that produced it, and any tier note. Use it
// when a suggestion looks wrong, before touching the lexicon.
const fs = require('fs');
const path = require('path');
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

module.exports = { loadCatalog };

if (require.main === module) {
  const cat = loadCatalog();
  for (const t of process.argv.slice(2)) {
    const r = M.suggest(cat, t, { limit: 6 });
    console.log('\n>> ' + t);
    const f = r.facts;
    const on = Object.keys(f).filter(k => f[k] === true);
    const nums = ['days', 'minutes', 'times', 'pesos'].filter(k => f[k] !== null).map(k => k + '=' + f[k]);
    console.log('   facts: ' + nums.concat(on).join(', '));
    const exp = M._expand(t);
    console.log('   vocabulary: ' + [...exp.entries()].map(([s, v]) => s + (v && v.w !== undefined ? '(' + v.w + ')' : '')).join(' '));
    for (const s of r.suggestions) {
      console.log('   ' + String(s.score).padStart(6) + '  ' + s.klass + ' ' + s.code.padEnd(32) +
        ' [' + s.confidence + '] ' + s.matched.join('|') +
        (s.tierReason ? '\n            tier: ' + s.tierReason : '') +
        (s.needsFact ? '\n            ask:  ' + s.needsFact : '') +
        (s.belowThreshold ? '\n            BELOW: ' + s.belowThreshold : ''));
    }
    if (r.multiple) console.log('   (may involve more than one offense)');
  }
}
