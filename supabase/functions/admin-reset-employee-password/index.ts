// Admin-only: resets an employee's ESS ("My Portal") login password.
//
// Called directly from the admin dashboard (js/views/staff.js) by an already-signed-in
// admin -- unlike this project's other Edge Functions (all triggered by a database
// trigger or a cron schedule, authenticated with a shared CRON_SECRET), this one is
// invoked straight from the browser, so it authenticates differently: the caller's own
// Supabase session access token is sent as a normal "Authorization: Bearer ..." header,
// verified here via sb.auth.getUser(token), then checked against the employees table
// (mirroring the database's own is_admin() function -- a row with authUserId equal to
// the caller means they're an employee, no such row means they're an admin) before the
// password reset is allowed to proceed. Only Supabase's Admin API (service role key) can
// ever set another user's password -- that key must never reach client-side code, which
// is the whole reason this has to be a server-side function at all.
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in -- leaving the scaffold in place
// (its own withSupabase({auth:["publishable","secret"]}) wrapper) will reject every real
// request with "Invalid credentials" before this code ever runs. Also: Settings tab ->
// "Verify JWT with legacy secret" -> turn OFF -> Save changes (this function verifies the
// caller's identity itself, in code, below -- same as this project's other functions).

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  var supabaseUrl = Deno.env.get('SUPABASE_URL');
  var serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  var anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response('Missing Supabase secrets', { status: 500 });
  }

  var authHeader = req.headers.get('Authorization') || '';
  var token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var anonClient = createClient(supabaseUrl, anonKey);
  var callerResult = await anonClient.auth.getUser(token);
  if (callerResult.error || !callerResult.data || !callerResult.data.user) {
    return new Response(
      JSON.stringify({ error: 'Invalid session -- please sign in again' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }
  var callerId = callerResult.data.user.id;

  var adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Mirrors is_admin(): a row in employees with authUserId = caller means they're an
  // employee (not admin); no such row means they're an admin account.
  var callerEmployeeRow = await adminClient.from('employees').select('id').eq('authUserId', callerId).maybeSingle();
  if (callerEmployeeRow.data) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var body = {};
  try { body = await req.json(); } catch (err) { body = {}; }
  var employeeId = body.employeeId;
  var newPassword = body.newPassword || '';
  if (!employeeId || newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: 'A valid employeeId and a password of at least 8 characters are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var targetResult = await adminClient.from('employees').select('id, name, "authUserId"').eq('id', employeeId).maybeSingle();
  var target = targetResult.data;
  if (!target || !target.authUserId) {
    return new Response(
      JSON.stringify({ error: 'This employee has no portal account to reset' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var updateResult = await adminClient.auth.admin.updateUserById(target.authUserId, { password: newPassword });
  if (updateResult.error) {
    return new Response(
      JSON.stringify({ error: updateResult.error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, employeeName: target.name }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
