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

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
