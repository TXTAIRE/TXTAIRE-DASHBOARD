// Emits the text of the two blocks the employee copy is meant to omit -- the Summary of
// Changes, and Annex F -- so the rule audit can classify a dropped run by where it came
// from rather than by guessing from its wording. Annex F is isolated by rendering the
// annexes twice, once per audience, and taking the difference.
const L = require('./lib.js');

const text = (nodes) => {
  const out = [];
  const seen = new Set();
  const walk = (o) => {
    if (o === null || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string') { if (v.length > 1) out.push(v); }
      else walk(v);
    }
  };
  walk(nodes);
  return out;
};

const fresh = (mod) => { delete require.cache[require.resolve(mod)]; return require(mod); };

L.setAudience('full');
const summary = text(fresh('./changes.js').summaryOfChanges());
const annexFull = text(fresh('./annex.js').annexes());

L.setAudience('employee');
const annexEmp = new Set(text(fresh('./annex.js').annexes()));
const annexF = annexFull.filter((t) => !annexEmp.has(t));

process.stdout.write(JSON.stringify({ summary: summary, annexF: annexF }));
