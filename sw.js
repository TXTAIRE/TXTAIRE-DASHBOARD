// App-shell cache for the TxTAIRE admin dashboard and ESS portal, so both are installable
// and open instantly offline. Only same-origin static files are cached — Supabase/CDN/
// geolocation requests are always left to the network untouched, so data is never stale.
const CACHE_NAME = 'txtaire-shell-v16';

const PRECACHE_URLS = [
  'index.html',
  'ess.html',
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
  'js/views/attendance.js',
  'js/views/payroll.js',
  'js/views/complaints.js',
  'js/views/leaveRequests.js',
  'js/views/attendanceCorrections.js',
  'js/views/auditLog.js',
  'js/offline-queue.js',
  'js/ess-app.js',
  'js/ess-views/attendance.js',
  'js/ess-views/payroll.js',
  'js/ess-views/leave.js',
  'js/ess-views/profile.js',
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
