// App-shell cache for the TxTAIRE admin dashboard and ESS portal, so both are installable
// and open instantly offline. Only same-origin static files are cached — Supabase/CDN/
// geolocation requests are always left to the network untouched, so data is never stale.
const CACHE_NAME = 'txtaire-shell-v173';

const PRECACHE_URLS = [
  'index.html',
  'ess.html',
  'admin-portal.html',
  'manifest.json',
  'manifest-admin.json',
  'css/styles.css',
  'css/ess.css',
  'js/supabase-config.js',
  'js/store.js',
  'js/auth.js',
  'js/app.js',
  'js/register-sw.js',
  'js/views/overview.js',
  'js/views/staff.js',
  'js/views/recruitment.js',
  'js/views/probation.js',
  'js/views/disciplinary.js',
  'js/views/codeOfDiscipline.js',
  'js/views/attendance.js',
  'js/views/payroll.js',
  'js/views/complaints.js',
  'js/views/leaveRequests.js',
  'js/views/attendanceCorrections.js',
  'js/views/scheduleRequests.js',
  'js/views/offboarding.js',
  'js/views/safetyIncidents.js',
  'js/views/employeeRelations.js',
  'js/views/auditLog.js',
  'js/views/finance.js',
  'js/views/adminFiles.js',
  'js/views/materials.js',
  'js/views/announcements.js',
  'js/offline-queue.js',
  'js/ess-i18n.js',
  'js/ess-tutorial.js',
  'js/ess-app.js',
  'js/ess-views/attendance.js',
  'js/ess-views/payroll.js',
  'js/ess-views/leave.js',
  'js/ess-views/profile.js',
  'js/ess-views/notifications.js',
  'js/ess-views/settings.js',
  'js/ess-views/discipline.js',
  'js/ess-views/expenses.js',
  'js/admin-portal.js',
  'assets/logo.svg',
  'assets/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Push notifications -- shared by every push source in this app: the scheduled payroll
// cutoff reminder, the instant "employee submitted a request" alert to HR, and the
// instant "your request was approved / payroll released / NTE issued" alert to the
// employee (supabase/functions/payroll-cutoff-reminder, employee-request-notify,
// employee-notification-push). All three just show a system notification the same way,
// so one handler covers all of them -- the 'payroll-reminder-push' message name below is
// a holdover from when only the first one existed; both js/app.js (admin) and
// js/ess-app.js (ESS) listen for that same name to play their ringtone. A service worker
// has no audio output of its own, so a custom "ringtone" can only play while a dashboard/
// portal tab is actually open; with the app fully closed, only the OS's own default
// notification sound plays -- a real platform limitation of background push, not
// something this app can work around.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (err) {
    payload = { title: 'Payroll Reminder', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'Payroll Reminder';
  const options = {
    body: payload.body || 'A payroll cutoff is coming up.',
    icon: 'assets/icon-192.png',
    badge: 'assets/icon-192.png',
    tag: payload.tag || 'payroll-cutoff-reminder',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: payload.url || './index.html' },
  };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
        clientsArr.forEach((c) => c.postMessage({ type: 'payroll-reminder-push', title, body: options.body }));
      }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const c of clientsArr) {
        if ('focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
