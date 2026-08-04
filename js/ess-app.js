/* Employee Self-Service (ESS) portal shell — deliberately separate and small from the
 * admin app.js/index.html. Employees sign in with an Employee ID (mapped to a hidden
 * synthetic email behind the scenes) and get a 4-button, view-only, mobile-first portal.
 * Reuses js/store.js as-is: RLS already restricts a linked employee's session to their
 * own rows, so Store.init() and computeRow() work unmodified here.
 */

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

function closeEssModal() {
  const bd = qs('.modal-backdrop');
  if (bd) bd.remove();
}

function openEssModal(innerHtml, onMount) {
  closeEssModal();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeEssModal(); });
  bd.innerHTML = '<div class="modal-wrap"><div class="modal">' +
    '<button class="modal-close" data-close-modal>&times;</button>' + innerHtml + '</div></div>';
  document.body.appendChild(bd);
  qsa('[data-close-modal]', bd).forEach(el => el.addEventListener('click', closeEssModal));
  if (onMount) onMount(bd);
  return bd;
}

const ESS_ROUTES = ['attendance', 'payroll', 'leave', 'profile', 'notifications', 'settings'];
let essRoute = 'attendance';
let myEmployee = null;

function essEmailFor(employeeCode) {
  return employeeCode.trim().toLowerCase() + '@employees.txtaire.local';
}

function showEssLogin(errorMessage) {
  qs('#ess-app').classList.add('hidden');
  const screen = qs('#ess-login');
  screen.classList.remove('hidden');
  screen.innerHTML = `
    <div class="ess-login-card">
      <img src="assets/logo.svg" alt="TxTAIRE" class="ess-login-logo" />
      <h1>My Portal</h1>
      <div class="page-sub" style="margin-bottom:18px;">Sign in with your Employee ID</div>
      ${errorMessage ? `<div class="auth-error">${escapeHtml(errorMessage)}</div>` : ''}
      <form id="ess-login-form">
        <div class="field full" style="margin-bottom:12px;">
          <label>Employee ID</label>
          <input name="employeeCode" required autocomplete="username" placeholder="e.g. TXT001" />
        </div>
        <div class="field full" style="margin-bottom:18px;">
          <label>Password</label>
          <input type="password" name="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;">Sign in</button>
      </form>
      <div class="page-sub" style="margin-top:18px; font-size:12px;">Don't have a login? Ask HR to set one up for you.</div>
    </div>
  `;
  qs('#ess-login-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const btn = ev.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    const { error } = await sb.auth.signInWithPassword({
      email: essEmailFor(fd.get('employeeCode')),
      password: fd.get('password'),
    });
    if (error) showEssLogin('Incorrect Employee ID or password.');
  });
}

function setActiveEssNav(route) {
  qsa('.ess-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.route === route));
}

function renderEssRoute() {
  const main = qs('#ess-main');
  main.innerHTML = '';
  setActiveEssNav(essRoute);
  const view = window.EssViews[essRoute];
  if (view && view.render) view.render(main, myEmployee);
  updateEssBellBadge();
}

function updateEssBellBadge() {
  if (!myEmployee) return;
  const badge = qs('#ess-nav-notif-badge');
  if (!badge) return;
  const count = Store.unreadNotificationCount(myEmployee.id);
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

// Every view re-renders by wholesale replacing main.innerHTML -- after saving a form,
// requesting OT, editing a day, etc. -- which was silently resetting scroll position back
// to the top every single time. Fixed once, system-wide, via a MutationObserver on the
// shared container instead of patching every individual view's render function.
function preserveScrollAcrossRerenders(container) {
  // #ess-main has no height or overflow-y of its own -- the page scrolls at the document
  // level, not on this element -- so the position has to be tracked/restored there.
  const scroller = document.scrollingElement || document.documentElement;
  let scrollTop = 0;

  // Captured synchronously at the moment of interaction (click/submit/change), not via the
  // "scroll" event -- confirmed the hard way (fixing the admin dashboard's Attendance
  // Calendar tab) that "scroll" doesn't fire promptly/reliably enough for this to work.
  function capture() { scrollTop = scroller.scrollTop; }
  ['click', 'submit', 'change'].forEach(evt => container.addEventListener(evt, capture, true));
  window.addEventListener('scroll', capture, { passive: true });

  function restore() { scroller.scrollTop = scrollTop; }
  const observer = new MutationObserver(() => {
    restore();
    // Also deferred a tick -- setting scrollTop immediately after new content is inserted,
    // before the browser has laid it out, can get silently clamped to 0.
    setTimeout(restore, 0);
  });
  observer.observe(container, { childList: true });
}

let essStarted = false;
async function startEss(session) {
  if (essStarted) return;

  await Store.init();
  const employees = Store.listEmployees();
  // RLS already restricts a linked employee's session to their own row; if it comes back
  // empty, this account isn't linked to an employee (e.g. an admin login, or access was
  // revoked) — the ESS portal isn't for them.
  if (!employees.length) {
    await sb.auth.signOut();
    showEssLogin('This login isn\'t linked to an employee portal account. Contact HR.');
    return;
  }
  myEmployee = employees[0];
  essStarted = true;

  qs('#ess-login').classList.add('hidden');
  qs('#ess-app').classList.remove('hidden');
  qs('#ess-logout').addEventListener('click', () => sb.auth.signOut());
  qsa('.ess-nav-btn').forEach(b => b.addEventListener('click', () => { essRoute = b.dataset.route; renderEssRoute(); }));
  qs('#ess-fab-clock').addEventListener('click', () => {
    if (essRoute !== 'attendance') { essRoute = 'attendance'; renderEssRoute(); }
    const view = window.EssViews.attendance;
    if (view && view.quickClock) view.quickClock(qs('#ess-main'), myEmployee);
  });
  preserveScrollAcrossRerenders(qs('#ess-main'));

  Store.onRemoteChange(() => {
    if (qs('.modal-backdrop')) { updateEssBellBadge(); return; }
    renderEssRoute();
  });

  renderEssRoute();
}

async function bootEss() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await startEss(session);
  } else {
    showEssLogin();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await startEss(session);
    } else if (event === 'SIGNED_OUT') {
      location.reload();
    }
  });
}

document.addEventListener('DOMContentLoaded', bootEss);
