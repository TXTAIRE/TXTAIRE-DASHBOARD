// Bootstrap for the standalone Admin Portal (admin-portal.html) -- a satellite page for
// ESS employees granted extra admin capabilities (currently just AI receipt-scanning
// expense encoding, js/ess-views/expenses.js), kept out of the personal My Portal nav bar
// so "My Attendance / My Payroll / My Leave" etc. don't get mixed with admin-only tools.
// Shares the same login session as ess.html -- js/supabase-config.js keys its auth storage
// off the presence of #ess-login, which this page also has (unused, purely as that marker).
window.EssViews = window.EssViews || {};

function qs(sel, root) { return (root || document).querySelector(sel); }
function qsa(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function toast(msg) {
  const old = qs('.toast');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

async function bootAdminPortal() {
  const main = qs('#admin-main');
  qs('#admin-logout').addEventListener('click', () => {
    sb.auth.signOut().then(() => { window.location.href = 'ess.html'; });
  });

  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = 'ess.html';
    return;
  }

  await Store.init();
  const me = Store.listEmployees()[0];
  if (!me || !me.canEncodeExpenses) {
    main.innerHTML = '<div class="ess-card">You don’t have access to the Admin Portal. <a href="ess.html">Return to My Portal</a></div>';
    return;
  }

  window.EssViews.expenses.render(main, me);
}

document.addEventListener('DOMContentLoaded', () => {
  bootAdminPortal().catch((err) => {
    qs('#admin-main').innerHTML = '<div class="ess-card">Something went wrong loading the Admin Portal. <a href="ess.html">Return to My Portal</a></div>';
  });
});
