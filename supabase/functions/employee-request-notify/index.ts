// Employee request push notifications -- triggered by a database trigger (not a
// schedule), the moment an employee submits a Leave Request, Attendance Correction, or
// NSD/OT/Holiday pay request. Sends a Web Push notification (with sound, via the same
// service worker 'push' handler as the payroll cutoff reminder) to every HR device
// enrolled via the "Enable on this device" button -- Payroll page, or wherever it's
// since been relabeled to cover both kinds of alert.
//
// Reuses the exact same secrets already set up for payroll-cutoff-reminder -- Edge
// Function secrets are shared across every function in a Supabase project, so nothing
// new needs to be configured:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// (CRON_SECRET's name is a holdover from the scheduled function -- here it just guards
// this endpoint against being called by anyone who isn't our own database trigger.)
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

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
  var employeeName = body.employeeName || 'An employee';
  var detail = body.detail || 'submitted a new request';

  var supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  var subsResult = await supabase.from('pushSubscriptions').select('*');
  var subs = subsResult.data || [];

  var payload = JSON.stringify({
    title: 'New Employee Request',
    body: employeeName + ' -- ' + detail,
    tag: 'employee-request-' + Date.now(),
    url: './index.html',
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
        await supabase.from('pushSubscriptions').delete().eq('endpoint', sub.endpoint);
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
