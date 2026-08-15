// Admin-only: creates a brand-new My Portal ("ESS") login account for an employee that
// doesn't have one yet, and links it (employees.authUserId).
//
// Mirrors admin-reset-employee-password exactly -- see that function's own comments for
// the full auth/deploy notes (same caller-session-token auth pattern, same "no template
// literals" rule because pasting backticks into the Supabase Dashboard's function editor
// has corrupted them before, same Settings -> "Verify JWT with legacy secret" -> OFF
// requirement). Only Supabase's Admin API (service role key) can create another user's
// Auth account at all -- that key must never reach client-side code, which is the whole
// reason this has to be a server-side function too.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in, then Settings tab -> "Verify JWT
// with legacy secret" -> turn OFF -> Save changes.

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
  var password = body.password || '';
  if (!employeeId || password.length < 8) {
    return new Response(
      JSON.stringify({ error: 'A valid employeeId and a password of at least 8 characters are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var targetResult = await adminClient.from('employees').select('id, name, "employeeCode", "authUserId"').eq('id', employeeId).maybeSingle();
  var target = targetResult.data;
  if (!target) {
    return new Response(
      JSON.stringify({ error: 'Employee not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (target.authUserId) {
    return new Response(
      JSON.stringify({ error: 'This employee already has a portal account' }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!target.employeeCode) {
    return new Response(
      JSON.stringify({ error: 'This employee has no Employee ID set -- set one first, then try again' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  var email = target.employeeCode.toLowerCase() + '@employees.txtaire.local';

  var createResult = await adminClient.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });
  if (createResult.error) {
    return new Response(
      JSON.stringify({ error: createResult.error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  var newUserId = createResult.data.user.id;

  var linkResult = await adminClient.from('employees').update({ authUserId: newUserId }).eq('id', employeeId);
  if (linkResult.error) {
    // Roll back the just-created Auth user so a failed link doesn't leave an orphaned
    // account with no employee row pointing at it.
    await adminClient.auth.admin.deleteUser(newUserId);
    return new Response(
      JSON.stringify({ error: linkResult.error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, employeeName: target.name, authUserId: newUserId }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
