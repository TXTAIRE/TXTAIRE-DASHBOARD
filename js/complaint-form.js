/* Public, unauthenticated complaint submission -- the shareable link HR hands or texts
 * directly to a customer. Deliberately its own tiny client, not js/supabase-config.js/
 * store.js, so it carries zero coupling to the admin/ESS session logic and never touches
 * any table but "complaints" -- the RLS policy in supabase/schema.sql grants the anon
 * role INSERT on that one table only, nothing else in the schema.
 */
const SUPABASE_URL = 'https://fmgqqrmsxleyeiadnhyd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtZ3Fxcm1zeGxleWVpYWRuaHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MzA0MTYsImV4cCI6MjEwMDQwNjQxNn0.vNUkDTBxZQ4qTzxVPo03-x1jNoTV_O19UsyqMhy4E8A';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

document.getElementById('complaint-public-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const errEl = document.getElementById('complaint-error');
  errEl.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { error } = await sb.from('complaints').insert({
    id: genId('cp'),
    customerName: fd.get('customerName').trim(),
    contact: fd.get('contact').trim(),
    description: fd.get('description').trim(),
    dateReceived: todayISO(),
    priority: 'Medium',
    status: 'Open',
    assignedTo: null,
    resolutionNotes: '',
    resolvedDate: null,
  });

  if (error) {
    errEl.innerHTML = '<div class="auth-error">Something went wrong sending this — please try again, or contact us directly.</div>';
    btn.disabled = false;
    btn.textContent = 'Submit Complaint';
    return;
  }

  document.getElementById('complaint-card').innerHTML = `
    <img src="assets/logo.svg" alt="TxTAIRE" class="auth-logo" />
    <h1>Thank you</h1>
    <div class="page-sub" style="margin-top:10px;">We've received your complaint and will follow up with you shortly.</div>
  `;
});
