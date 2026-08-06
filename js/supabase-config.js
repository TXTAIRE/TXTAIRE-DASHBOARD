/* Supabase project connection.
 * Get these two values from: Supabase Dashboard → your project → Settings → API.
 *   - "Project URL"            → SUPABASE_URL
 *   - "anon" / "public" key    → SUPABASE_ANON_KEY
 * The anon key is meant to be public (Supabase's security boundary is the RLS policies
 * in supabase/schema.sql, not hiding this key) — but it only works at all once you've
 * run that schema, since RLS denies the `anon` role entirely and only allows the
 * `authenticated` role (i.e. a signed-in user) to read/write.
 */
const SUPABASE_URL = 'https://fmgqqrmsxleyeiadnhyd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtZ3Fxcm1zeGxleWVpYWRuaHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MzA0MTYsImV4cCI6MjEwMDQwNjQxNn0.vNUkDTBxZQ4qTzxVPo03-x1jNoTV_O19UsyqMhy4E8A';

// VAPID "application server" public key for Web Push (payroll cutoff reminders, admin
// dashboard only — see js/views/payroll.js and supabase/functions/payroll-cutoff-reminder).
// Safe to be public, same as the anon key above — it identifies this app to the push
// service, it doesn't authorize anything by itself. The matching PRIVATE key must never
// appear in any client file; it only lives as a Supabase Edge Function secret.
const VAPID_PUBLIC_KEY = 'BEl_r1Ap1nFd7_UM7D4HUyidqjhKVSskcpty7kleiNuSJ5549Oju650xKCWpYvLSGD1lVXV6razAqWvucpPNw9k';

// ess.html and index.html share this file but must not share one signed-in session
// (e.g. HR signed into the admin dashboard on the same shared office PC an employee
// later opens the portal on) — give each its own storage key. `#ess-login` only
// exists in ess.html's markup, and this script runs after that markup is parsed.
const IS_ESS_PORTAL = !!document.getElementById('ess-login');

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: IS_ESS_PORTAL ? 'txtaire-ess-auth' : 'txtaire-admin-auth',
  },
});
