if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // A cached sw.js (e.g. behind a CDN using normal static-asset caching) can make the
      // browser miss new deploys for a long time -- reg.update() fetches the worker script
      // bypassing that cache (per spec), so re-check explicitly on every load and whenever
      // the tab regains focus, instead of relying solely on the browser's own occasional
      // background check.
      reg.update();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update();
      });

      // sw.js already calls skipWaiting()/clients.claim() on activate, so a new version
      // takes control of this tab as soon as it's ready -- but the page itself already
      // loaded the OLD JS/CSS, so nothing actually changes until a reload happens. This is
      // what used to require manually unregistering the service worker by hand; now it just
      // reloads once automatically -- deferred (with a one-time notice, then retried every
      // few seconds) while a modal/drawer is open, so an update never wipes out something
      // half-filled-in.
      let reloaded = false;
      let pendingReload = false;
      let noticeShown = false;
      let retryTimer = null;
      function tryReload() {
        if (reloaded || !pendingReload) return;
        if (document.querySelector('.modal-backdrop') || document.querySelector('.drawer')) return;
        reloaded = true;
        if (retryTimer) clearInterval(retryTimer);
        location.reload();
      }
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded || pendingReload) return;
        pendingReload = true;
        if (document.querySelector('.modal-backdrop') || document.querySelector('.drawer')) {
          if (!noticeShown && typeof toast === 'function') {
            toast('🔄 An update is ready — it\'ll load automatically once this closes.');
            noticeShown = true;
          }
          retryTimer = setInterval(tryReload, 3000);
        } else {
          tryReload();
        }
      });
    });
  });
}
