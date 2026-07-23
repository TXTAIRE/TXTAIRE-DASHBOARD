/* Supabase project connection.
 * Get these two values from: Supabase Dashboard → your project → Settings → API.
 *   - "Project URL"            → SUPABASE_URL
 *   - "anon" / "public" key    → SUPABASE_ANON_KEY
 * The anon key is meant to be public (Supabase's security boundary is the RLS policies
 * in supabase/schema.sql, not hiding this key) — but it only works at all once you've
 * run that schema, since RLS denies the `anon` role entirely and only allows the
 * `authenticated` role (i.e. a signed-in user) to read/write.
 */
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
