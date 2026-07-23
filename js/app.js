/* App shell: router + shared UI helpers. Views register themselves on window.Views. */

window.Views = window.Views || {};

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

function closeModal() {
  const bd = qs('.modal-backdrop');
  if (bd) bd.remove();
}

function openModal(innerHtml, onMount) {
  closeModal();
  closeDrawer();
  const bd = document.createElement('div');
  bd.className = 'modal-backdrop';
  bd.addEventListener('mousedown', function (e) { if (e.target === bd) closeModal(); });
  bd.innerHTML = '<div class="modal-wrap"><div class="modal">' +
    '<button class="modal-close" data-close-modal>&times;</button>' + innerHtml + '</div></div>';
  document.body.appendChild(bd);
  qs('[data-close-modal]', bd).addEventListener('click', closeModal);
  if (onMount) onMount(bd);
  return bd;
}

function closeDrawer() {
  const dr = qs('.drawer');
  const bg = qs('.drawer-backdrop');
  if (dr) dr.remove();
  if (bg) bg.remove();
}

function openDrawer(innerHtml, onMount) {
  closeDrawer();
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'drawer-backdrop';
  bg.addEventListener('click', closeDrawer);
  document.body.appendChild(bg);
  const dr = document.createElement('div');
  dr.className = 'drawer';
  dr.innerHTML = innerHtml;
  document.body.appendChild(dr);
  if (onMount) onMount(dr);
  return dr;
}

function employeeOptions(selectedId, categoryFilter) {
  let emps = Store.listEmployees();
  if (categoryFilter) emps = emps.filter(e => e.category === categoryFilter);
  return emps.map(e => '<option value="' + e.id + '"' + (e.id === selectedId ? ' selected' : '') + '>' +
    escapeHtml(e.name) + ' (' + e.category + ')</option>').join('');
}

function employeeName(id) {
  const e = Store.getEmployee(id);
  return e ? e.name : '—';
}

function caseStatusBadge(status) {
  const map = {
    'Notice Issued': 'badge-orange',
    'Awaiting Response': 'badge-yellow',
    'Under Investigation': 'badge-blue',
    'Resolved': 'badge-green',
    'Escalated': 'badge-red',
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status) + '</span>';
}

function complaintStatusBadge(status) {
  const map = {
    'Open': 'badge-red',
    'In Progress': 'badge-yellow',
    'Resolved': 'badge-green',
    'Closed': 'badge-gray',
  };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status) + '</span>';
}

function priorityBadge(priority) {
  const map = { High: 'badge-red', Medium: 'badge-yellow', Low: 'badge-gray' };
  return '<span class="badge ' + (map[priority] || 'badge-gray') + '">' + escapeHtml(priority) + '</span>';
}

function employmentStatusBadge(status) {
  const map = { Regular: 'badge-blue', Probationary: 'badge-yellow' };
  return '<span class="badge ' + (map[status] || 'badge-gray') + '">' + escapeHtml(status || '—') + '</span>';
}

function daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO + 'T00:00:00') - new Date(fromISO + 'T00:00:00')) / 86400000);
}

function employeeStatusDot(status) {
  const map = { Active: 'on', 'On Leave': 'late', Off: 'off', Terminated: 'absent' };
  return '<span class="status-dot ' + (map[status] || '') + '">' + escapeHtml(status) + '</span>';
}

const ROUTES = ['overview', 'staff', 'recruitment', 'probation', 'disciplinary', 'attendance', 'payroll', 'complaints'];

function currentRoute() {
  const h = (location.hash || '').replace('#', '').split('/')[0];
  return ROUTES.includes(h) ? h : 'overview';
}

function setActiveNav(route) {
  qsa('.nav-item').forEach(a => {
    a.classList.toggle('active', a.dataset.route === route);
  });
}

function render() {
  closeModal();
  closeDrawer();
  const route = currentRoute();
  setActiveNav(route);
  const main = qs('#main-content');
  main.innerHTML = '';
  const view = window.Views[route];
  if (view && view.render) {
    view.render(main);
  } else {
    main.innerHTML = '<div class="empty">Not found.</div>';
  }
}

let appStarted = false;

async function startApp(session) {
  if (appStarted) return;
  appStarted = true;

  hideAuthScreen();
  qs('#user-email').textContent = session.user.email;
  qs('#btn-logout').addEventListener('click', () => sb.auth.signOut());

  qsa('.nav-item').forEach(a => {
    a.addEventListener('click', function () {
      location.hash = '#' + a.dataset.route;
    });
  });
  window.addEventListener('hashchange', render);

  qs('#main-content').innerHTML = '<div class="empty">Loading…</div>';
  await Store.init();

  // Live updates from other devices: any remote change refetches that table and
  // re-renders the current view. Debounced, and skipped while a modal/drawer is open
  // so we don't yank a form out from under someone mid-edit.
  let renderTimer = null;
  Store.onRemoteChange(() => {
    if (qs('.modal-backdrop') || qs('.drawer')) {
      toast('Updated elsewhere — close this to see the latest.');
      return;
    }
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 150);
  });

  render();
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    await startApp(session);
  } else {
    showAuthScreen();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await startApp(session);
    } else if (event === 'SIGNED_OUT') {
      location.reload();
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);
