// Employee-portal-only: exchanges a QR login token for a real, signed-in session -- the
// one Edge Function in this project that's deliberately UNAUTHENTICATED, since it's the
// login mechanism itself, not something called by an already-signed-in caller. The QR
// token is the credential here (same trust model as a password or a physical access
// badge, see employees."qrLoginToken" in supabase/schema.sql) -- it's never logged, never
// echoed back in any response, and this function does nothing with it beyond one exact
// lookup.
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in -- leaving the scaffold in place
// (its own withSupabase({auth:["publishable","secret"]}) wrapper) will reject every real
// request with "Invalid credentials" before this code ever runs. Also: Settings tab ->
// "Verify JWT with legacy secret" -> turn OFF -> Save changes (there's no caller identity
// to verify here at all -- that's the whole point of this function).

import { createClient } from 'npm:@supabase/supabase-js@2';

var corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  var supabaseUrl = Deno.env.get('SUPABASE_URL');
  var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing Supabase secrets' }, 500);
  }

  var body = {};
  try { body = await req.json(); } catch (err) { body = {}; }
  var token = (body.token || '').toString().trim();
  if (!token || token.length < 20) {
    return jsonResponse({ error: 'Invalid QR code' }, 400);
  }

  var adminClient = createClient(supabaseUrl, serviceRoleKey);

  var empResult = await adminClient.from('employees')
    .select('id, name, status, "authUserId"')
    .eq('qrLoginToken', token)
    .maybeSingle();
  var emp = empResult.data;
  if (!emp || !emp.authUserId) {
    return jsonResponse({ error: 'QR code not recognized or this account has no My Portal login' }, 404);
  }
  if (emp.status === 'Terminated') {
    return jsonResponse({ error: 'This portal account is no longer active' }, 403);
  }

  var userResult = await adminClient.auth.admin.getUserById(emp.authUserId);
  var email = userResult.data && userResult.data.user ? userResult.data.user.email : null;
  if (!email) {
    return jsonResponse({ error: 'Could not resolve this account' }, 500);
  }

  // generateLink never actually sends anything -- it just mints a one-time verification
  // token the same way a real magic-link email would carry one. The QR scan itself is
  // what already proved identity here, so this hands the resulting token straight back
  // instead of emailing it anywhere (this app's employees sign in with a synthetic
  // internal email address, not a real inbox, so emailing it isn't even possible).
  var linkResult = await adminClient.auth.admin.generateLink({ type: 'magiclink', email: email });
  if (linkResult.error || !linkResult.data || !linkResult.data.properties) {
    return jsonResponse({ error: 'Could not create a sign-in link' }, 500);
  }

  return jsonResponse({
    success: true,
    email: email,
    hashedToken: linkResult.data.properties.hashed_token,
  });
});
