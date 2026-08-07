/* Public, unauthenticated complaint submission -- the shareable link HR hands or texts
 * directly to a customer. Deliberately its own tiny client, not js/supabase-config.js/
 * store.js, so it carries zero coupling to the admin/ESS session logic. Submits via the
 * submit_public_complaint() RPC (supabase/schema.sql) rather than a direct table insert
 * -- that function runs as security definer and does the insert itself, so the anon role
 * needs no direct grant on the complaints table at all, only EXECUTE on this one narrow
 * function, which only ever returns a plain queue-position count, never any row data.
 */
const SUPABASE_URL = 'https://fmgqqrmsxleyeiadnhyd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtZ3Fxcm1zeGxleWVpYWRuaHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MzA0MTYsImV4cCI6MjEwMDQwNjQxNn0.vNUkDTBxZQ4qTzxVPo03-x1jNoTV_O19UsyqMhy4E8A';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

document.getElementById('complaint-public-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.target;
  const fd = new FormData(form);
  const btn = form.querySelector('button[type="submit"]');
  const errEl = document.getElementById('complaint-error');
  errEl.innerHTML = '';
  btn.disabled = true;
  btn.textContent = 'Submitting…';

  const { data: queuePosition, error } = await sb.rpc('submit_public_complaint', {
    p_customer_name: fd.get('customerName').trim(),
    p_contact: fd.get('contact').trim(),
    p_description: fd.get('description').trim(),
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
    ${queuePosition ? `<div class="badge badge-blue" style="margin-top:16px; font-size:14px; padding:8px 16px;">You're number ${queuePosition} in the queue</div>` : ''}
  `;
});
