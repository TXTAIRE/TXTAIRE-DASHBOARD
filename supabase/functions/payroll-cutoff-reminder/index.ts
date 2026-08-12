// Payroll cutoff reminder push notifications -- scheduled Edge Function.
//
// Run once a day (see the pg_cron SQL in the "Payroll cutoff reminder" deployment notes
// handed to HR alongside this file). For each pay cycle (10-20, 15-30), computes whether
// TODAY is exactly N days before that cycle's next cutoff-end date (N = the
// "payrollReminderDaysBefore" appSettings value, default 2), and if so sends a Web Push
// notification to every row in pushSubscriptions -- one row per HR device that's enabled
// reminders via js/views/payroll.js's "Payroll Cutoff Reminders" card.
//
// Required secrets (Supabase Dashboard -> Edge Functions -> payroll-cutoff-reminder ->
// Secrets, or `supabase secrets set --env-file ...`):
//   VAPID_PUBLIC_KEY   -- same value as js/supabase-config.js's VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY  -- NEVER put this in any client file -- Edge Function secret only
//   VAPID_SUBJECT      -- "mailto:someone@yourcompany.com" (required by the Web Push spec;
//                          the push service uses it to contact you if this function ever
//                          misbehaves/spams it)
//   CRON_SECRET        -- any random string; the cron job must send it back as the
//                          x-cron-secret header, so this function can't be triggered by
//                          anyone who finds its URL
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are already injected automatically into every
// Edge Function by Supabase -- nothing to set for those two.
//
// Deliberately written without any template-literal (backtick) strings -- pasting those
// into the Supabase Dashboard's browser-based function editor has been seen to silently
// corrupt them (a dropped/duplicated backtick breaks the whole file with a confusing
// "Unexpected eof" parse error). Plain string concatenation sidesteps that entirely.

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

function pad2(n) { return (n < 10 ? '0' : '') + String(n); }
function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

var DEFAULT_CUTOFF_SETTINGS = {
  '10-20': { cutoffAEndDay: 3, paydayADay: 5, cutoffBEndDay: 18, paydayBDay: 20 },
  '15-30': { cutoffAEndDay: 10, paydayADay: 15, cutoffBEndDay: 25, paydayBDay: 30 },
};

// Mirrors js/store.js payCutoffs() (just the cutoff-end dates this function actually
// needs) -- kept in sync by hand since this runs in a separate Deno runtime and can't
// import that file directly.
function cutoffEndDates(setting, year, month) {
  var last = daysInMonth(year, month);
  var cutoffAEndDay = Math.min(setting.cutoffAEndDay, last);
  var cutoffBEndDay = Math.min(setting.cutoffBEndDay, last);
  return [
    { key: 'A', to: year + '-' + pad2(month) + '-' + pad2(cutoffAEndDay) },
    { key: 'B', to: year + '-' + pad2(month) + '-' + pad2(cutoffBEndDay) },
  ];
}

function daysBetween(a, b) {
  var da = new Date(a + 'T00:00:00Z').getTime();
  var db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400000);
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

  var settingsResult = await supabase.from('payCutoffSettings').select('*');
  var reminderResult = await supabase.from('appSettings').select('*').eq('key', 'payrollReminderDaysBefore').maybeSingle();
  var settingsRows = settingsResult.data;
  var reminderRow = reminderResult.data;
  var reminderDays = Number(reminderRow && reminderRow.value != null ? reminderRow.value : 2);

  var today = new Date();
  var todayIso = today.getUTCFullYear() + '-' + pad2(today.getUTCMonth() + 1) + '-' + pad2(today.getUTCDate());

  var matches = [];
  var payCycles = ['10-20', '15-30'];
  for (var c = 0; c < payCycles.length; c++) {
    var payCycle = payCycles[c];
    var setting = DEFAULT_CUTOFF_SETTINGS[payCycle];
    if (settingsRows) {
      for (var s = 0; s < settingsRows.length; s++) {
        if (settingsRows[s].payCycle === payCycle) { setting = settingsRows[s]; break; }
      }
    }
    // Check this month AND next month -- a reminder window can straddle the month
    // boundary (e.g. reminding on the 29th for a cutoff on the 3rd of next month).
    for (var offset = 0; offset <= 1; offset++) {
      var y = today.getUTCFullYear();
      var m = today.getUTCMonth() + 1 + offset;
      if (m > 12) { m -= 12; y += 1; }
      var cutoffs = cutoffEndDates(setting, y, m);
      for (var k = 0; k < cutoffs.length; k++) {
        if (daysBetween(todayIso, cutoffs[k].to) === reminderDays) {
          matches.push({ payCycle: payCycle, cutoffKey: cutoffs[k].key, cutoffTo: cutoffs[k].to });
        }
      }
    }
  }

  if (!matches.length) {
    return new Response(JSON.stringify({ matches: 0 }), { headers: { 'Content-Type': 'application/json' } });
  }

  var subsResult = await supabase.from('pushSubscriptions').select('*');
  var subs = subsResult.data || [];

  var bodyParts = [];
  for (var i = 0; i < matches.length; i++) {
    var match = matches[i];
    var groupName = match.payCycle === '10-20' ? 'Admins' : 'Technicians';
    var dayWord = reminderDays === 1 ? ' day' : ' days';
    bodyParts.push(groupName + ' cutoff ends ' + match.cutoffTo + ' (' + reminderDays + dayWord + ' from now).');
  }

  var payload = JSON.stringify({
    title: 'Payroll Cutoff Coming Up',
    body: bodyParts.join(' '),
    tag: 'payroll-cutoff-reminder-' + todayIso,
    url: './index.html#payroll',
  });

  var sent = 0, removed = 0, errors = [];
  for (var j = 0; j < subs.length; j++) {
    var sub = subs[j];
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
      sent++;
    } catch (err) {
      // 404/410 = the browser/OS revoked this subscription (uninstalled, permission
      // revoked, etc.) -- prune it so future runs don't keep retrying a dead endpoint.
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
    JSON.stringify({ matches: matches.length, subscriptions: subs.length, sent: sent, removed: removed, errors: errors }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
