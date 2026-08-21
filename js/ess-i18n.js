// Light-pass English/Filipino toggle for My Portal -- covers the bottom nav labels and
// each page's main heading only (not full deep translation of every screen, help text,
// or error message). Preference persists per device via localStorage. This is a first
// pass; a native/fluent Filipino speaker should review these before treating them as
// polished, especially the HR-specific terms.
const ESS_I18N = {
  en: {
    nav_attendance: 'My Attendance', nav_payroll: 'My Payroll', nav_leave: 'My Leave',
    nav_profile: 'My Profile', nav_notifications: 'Notifications', nav_settings: 'Settings',
    nav_discipline: 'Code of Discipline',
    title_attendance: "Today's Attendance", title_payroll: 'My Payroll', title_leave: 'My Leave Requests',
    title_profile: 'My Profile', title_notifications: 'Notifications', title_settings: 'Settings',
    title_discipline: 'Code of Discipline',
  },
  fil: {
    nav_attendance: 'Aking Pagdalo', nav_payroll: 'Aking Sahod', nav_leave: 'Aking Leave',
    nav_profile: 'Aking Profile', nav_notifications: 'Mga Abiso', nav_settings: 'Mga Setting',
    nav_discipline: 'Kodigo ng Disiplina',
    title_attendance: 'Pagdalo Ngayong Araw', title_payroll: 'Aking Sahod', title_leave: 'Aking mga Kahilingan sa Leave',
    title_profile: 'Aking Profile', title_notifications: 'Mga Abiso', title_settings: 'Mga Setting',
    title_discipline: 'Kodigo ng Disiplina',
  },
};

function essLang() {
  return localStorage.getItem('essLang') === 'fil' ? 'fil' : 'en';
}

function t(key) {
  return (ESS_I18N[essLang()] && ESS_I18N[essLang()][key]) || ESS_I18N.en[key] || key;
}

// Swaps every [data-i18n] element's text to the current language -- called once on load
// and again whenever the toggle changes. Nav labels live in static ess.html markup (not
// re-rendered per view), so they need this instead of just calling t() at render time
// the way a view's own page title can.
function applyEssNavLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
}

function setEssLang(lang) {
  localStorage.setItem('essLang', lang === 'fil' ? 'fil' : 'en');
  applyEssNavLang();
}
