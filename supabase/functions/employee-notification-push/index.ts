// Employee-side push notifications -- triggered by a database trigger (not a schedule),
// the moment an employee's own request is approved, their payroll is released, or they're
// issued an NTE. Sends a Web Push notification (with sound, via the same service worker
// 'push' handler as every other push in this app) to that ONE employee's own devices --
// unlike employee-request-notify (which broadcasts to every HR device), this always
// targets a single employeeId.
//
// Reuses the exact same secrets already set up for the other two functions -- nothing
// new to configure:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in -- leaving the scaffold in place
// (its own withSupabase({auth:["publishable","secret"]}) wrapper) will reject every real
// request with "Invalid credentials" before this code ever runs.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

var TITLES = {
  leave_approved: 'Leave Request Approved',
  correction_approved: 'Attendance Correction Approved',
  nsd_approved: 'Night Shift Differential Approved',
  ot_approved: 'Overtime Approved',
  holiday_approved: 'Holiday Pay Approved',
  payroll_released: 'Payroll Released',
  nte_issued: 'Notice to Explain Issued',
};

Deno.serve(async (req) => {
  var cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  var vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  var vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  var vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return new Response('Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT secrets', { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  var body = {};
  try { body = await req.json(); } catch (err) { body = {}; }
  var employeeId = body.employeeId;
  var type = body.type || '';
  var message = body.message || 'You have a new notification.';

  if (!employeeId) {
    return new Response('Missing employeeId', { status: 400 });
  }

  var supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  var subsResult = await supabase.from('employeePushSubscriptions').select('*').eq('employeeId', employeeId);
  var subs = subsResult.data || [];

  var payload = JSON.stringify({
    title: TITLES[type] || 'TxTAIRE Notification',
    body: message,
    tag: 'employee-notification-' + Date.now(),
    url: './ess.html',
  });

  var sent = 0, removed = 0, errors = [];
  for (var i = 0; i < subs.length; i++) {
    var sub = subs[i];
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await supabase.from('employeePushSubscriptions').delete().eq('endpoint', sub.endpoint);
        removed++;
      } else {
        // Anything else (bad VAPID subject, payload rejected, Apple/Safari push service
        // quirks, etc.) was previously swallowed completely -- silently "sent: 0" with no
        // trace of why. Logged and returned so a real failure is actually diagnosable.
        var detail = { endpoint: sub.endpoint, statusCode: err && err.statusCode, body: err && err.body, message: err && err.message };
        console.error('sendNotification failed', detail);
        errors.push(detail);
      }
    }
  }

  return new Response(
    JSON.stringify({ subscriptions: subs.length, sent: sent, removed: removed, errors: errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
