// Time In / Time Out reminder push notifications -- scheduled Edge Function, run every 5
// minutes via pg_cron (see the "attendance-reminder" pg_cron job in the deployment notes
// handed to HR alongside this file).
//
// For every Active employee with a fixed schedule (fixedHours !== false) and both
// defaultTimeIn/defaultTimeOut set, sends a Web Push reminder to that employee's own
// device(s) 5 minutes before Time In and 5 minutes before Time Out, telling them to clock
// in/out and take the required photo. Matching is done with a 5-minute WINDOW (not exact
// equality) so it still fires correctly even if a default time isn't a multiple of 5
// minutes (e.g. 08:03) and the cron itself only ticks on :00/:05/:10/etc.
//
// Skipped automatically so nobody gets a pointless nag:
//   - Sundays (this app's existing rest-day assumption, js/store.js computeDayPay)
//   - Time In reminder, once today's attendance record already has a timeIn
//   - Time Out reminder, if there's no timeIn yet today (nothing to clock out of), or
//     today's record already has a timeOut
//   - Either reminder, on a day the employee has an Approved leave request covering today
//
// Required secrets: reuses the exact same VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
// VAPID_SUBJECT / CRON_SECRET already set up for payroll-cutoff-reminder and the other
// scheduled/triggered functions -- nothing new to configure.
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them. Plain string concatenation sidesteps that entirely.
//
// IMPORTANT after creating this function in the Dashboard: select all the placeholder
// scaffold code and delete it before pasting this in -- leaving the scaffold in place
// will reject every real request with "Invalid credentials" before this code ever runs.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

var REMINDER_LEAD_MINUTES = 5;
var WINDOW_MINUTES = 5; // must match the pg_cron interval this function is scheduled at

function pad2(n) { return (n < 10 ? '0' : '') + String(n); }
function toMinutes(t) {
  var parts = t.split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
}
// True if `nowMinutes` falls in [target, target + WINDOW_MINUTES), with target wrapped
// into 0-1439 first (a default time within REMINDER_LEAD_MINUTES of midnight would
// otherwise compute a negative/overflowing target).
function inWindow(nowMinutes, targetMinutes) {
  var t = ((targetMinutes % 1440) + 1440) % 1440;
  return nowMinutes >= t && nowMinutes < t + WINDOW_MINUTES;
}

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

  var supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  // Philippine local time (Asia/Manila, UTC+8, no DST) -- computed directly off UTC rather
  // than relying on the Edge runtime's timezone database being configured a certain way.
  var nowUtc = new Date();
  var ph = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000);
  var todayIso = ph.getUTCFullYear() + '-' + pad2(ph.getUTCMonth() + 1) + '-' + pad2(ph.getUTCDate());
  var nowMinutes = ph.getUTCHours() * 60 + ph.getUTCMinutes();
  var dayOfWeek = ph.getUTCDay(); // 0 = Sunday

  if (dayOfWeek === 0) {
    return new Response(JSON.stringify({ skipped: 'Sunday' }), { headers: { 'Content-Type': 'application/json' } });
  }

  var empResult = await supabase.from('employees')
    .select('id, name, "defaultTimeIn", "defaultTimeOut", "fixedHours", status');
  var employees = (empResult.data || []).filter(function (e) {
    return e.status === 'Active' && e.fixedHours !== false && e.defaultTimeIn && e.defaultTimeOut;
  });

  var dueIn = [], dueOut = [];
  for (var i = 0; i < employees.length; i++) {
    var e = employees[i];
    if (inWindow(nowMinutes, toMinutes(e.defaultTimeIn) - REMINDER_LEAD_MINUTES)) dueIn.push(e);
    if (inWindow(nowMinutes, toMinutes(e.defaultTimeOut) - REMINDER_LEAD_MINUTES)) dueOut.push(e);
  }

  if (!dueIn.length && !dueOut.length) {
    return new Response(JSON.stringify({ employees: employees.length, dueIn: 0, dueOut: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  var dueIdSet = {};
  dueIn.concat(dueOut).forEach(function (e) { dueIdSet[e.id] = true; });
  var dueIds = Object.keys(dueIdSet);

  var attResult = await supabase.from('attendance').select('*').eq('date', todayIso).in('employeeId', dueIds);
  var attByEmp = {};
  (attResult.data || []).forEach(function (r) { attByEmp[r.employeeId] = r; });

  var leaveResult = await supabase.from('leaveRequests').select('"employeeId"')
    .eq('status', 'Approved').lte('startDate', todayIso).gte('endDate', todayIso).in('employeeId', dueIds);
  var onLeave = {};
  (leaveResult.data || []).forEach(function (r) { onLeave[r.employeeId] = true; });

  var subsResult = await supabase.from('employeePushSubscriptions').select('*').in('employeeId', dueIds);
  var subsByEmp = {};
  (subsResult.data || []).forEach(function (s) {
    if (!subsByEmp[s.employeeId]) subsByEmp[s.employeeId] = [];
    subsByEmp[s.employeeId].push(s);
  });

  var sent = 0, removed = 0, errors = [];

  async function notify(emp, title, body, tagSuffix) {
    var subs = subsByEmp[emp.id] || [];
    var payload = JSON.stringify({
      title: title, body: body,
      tag: 'attendance-reminder-' + tagSuffix + '-' + todayIso,
      url: './ess.html',
    });
    for (var k = 0; k < subs.length; k++) {
      var sub = subs[k];
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        sent++;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from('employeePushSubscriptions').delete().eq('endpoint', sub.endpoint);
          removed++;
        } else {
          var detail = { endpoint: sub.endpoint, statusCode: err && err.statusCode, message: err && err.message };
          console.error('sendNotification failed', detail);
          errors.push(detail);
        }
      }
    }
  }

  for (var a = 0; a < dueIn.length; a++) {
    var eIn = dueIn[a];
    if (onLeave[eIn.id]) continue;
    var recIn = attByEmp[eIn.id];
    if (recIn && recIn.timeIn) continue; // already clocked in
    await notify(eIn, 'Time In Reminder',
      'Your shift starts in ' + REMINDER_LEAD_MINUTES + ' minutes — don’t forget to clock in with your photo.',
      'in');
  }
  for (var b = 0; b < dueOut.length; b++) {
    var eOut = dueOut[b];
    if (onLeave[eOut.id]) continue;
    var recOut = attByEmp[eOut.id];
    if (!recOut || !recOut.timeIn) continue; // hasn't clocked in -- nothing to time out of
    if (recOut.timeOut) continue; // already clocked out
    await notify(eOut, 'Time Out Reminder',
      'Your shift ends in ' + REMINDER_LEAD_MINUTES + ' minutes — don’t forget to clock out with your photo.',
      'out');
  }

  return new Response(
    JSON.stringify({ employees: employees.length, dueIn: dueIn.length, dueOut: dueOut.length, sent: sent, removed: removed, errors: errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
