/* TxTAIRE HR & Operations — Supabase-backed data store with a synchronous in-memory cache.
 *
 * Design: Store.list*()/get*() stay synchronous (they just read the cache), so every view
 * file's render-time code is unchanged. Store.init() populates the cache on boot and opens
 * a realtime subscription per table; any change (from this client or another device) refetches
 * that table and notifies app.js via onRemoteChange() so the current view re-renders. All
 * mutators (add*, update*, delete*, move*, decide*, set*) are async: they write to Supabase, then
 * refetch the affected table so the local cache reflects the confirmed row.
 */

window.Views = window.Views || {};

// A focused number input silently changes value when the page is scrolled with the
// cursor resting over it -- an easy way to accidentally mis-edit a salary/pay amount
// without realizing it. Only intercepts while that exact input is focused (not just
// hovered), so scrolling the page past an unfocused number input still works normally.
document.addEventListener('wheel', (ev) => {
  if (ev.target && ev.target.tagName === 'INPUT' && ev.target.type === 'number' && document.activeElement === ev.target) {
    ev.preventDefault();
  }
}, { passive: false });

const CATEGORIES = ['Admin', 'Technician', 'Executive / Management'];

const STAGES_STANDARD = ['Screening', 'Phone Interview', 'Face-to-Face Interview', '3-Day Trade Test', 'Evaluation', 'Decision'];
const STAGES_TECHNICIAN = ['Screening', 'Phone Interview', 'Candidate Agreement', '7-Day Trade Test', 'Evaluation', 'Decision'];

function stagesFor(category) {
  return category === 'Technician' ? STAGES_TECHNICIAN : STAGES_STANDARD;
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

function todayISO() {
  return localISO(new Date());
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return localISO(d);
}

// Inclusive calendar-day count between two ISO dates (same-day = 1) -- used for tallying
// leave request length, same convention the leave request form itself uses (a single
// start/end date pair, no separate "number of days" field).
function dateRangeDays(startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  return Math.round((end - start) / 86400000) + 1;
}

// Service Incentive Leave -- Labor Code of the Philippines, Article 95: every employee
// who has rendered at least one year of service is entitled to 5 days of paid leave per
// year. Fixed company-wide, not configurable per employee.
const SIL_YEARLY_DAYS = 5;

// Approved SIL days that overlap one specific cutoff (clipped to it, not the leave
// request's full span if it runs longer than the cutoff) -- used on the printable DTR,
// which reports per-cutoff, unlike the yearly balance shown on My Portal.
function silDaysInRange(employeeId, from, to) {
  return Store.leaveRequestsForEmployee(employeeId)
    .filter(r => r.leaveType === 'SIL' && r.status === 'Approved' && r.startDate <= to && r.endDate >= from)
    .reduce((sum, r) => {
      const clippedStart = r.startDate > from ? r.startDate : from;
      const clippedEnd = r.endDate < to ? r.endDate : to;
      return sum + dateRangeDays(clippedStart, clippedEnd);
    }, 0);
}

// Labor Code Art. 95 grants SIL only once an employee has rendered at least one year of
// service -- an employee with no dateHired on file can't have that proven yet, so treated
// as not-yet-eligible (rather than assuming eligibility) until HR fills it in.
function silEligibleAsOf(emp, asOfDate) {
  if (!emp || !emp.dateHired) return false;
  return addMonths(emp.dateHired, 12) <= (asOfDate || todayISO());
}
// First date this employee will actually become eligible (their 1-year anniversary) --
// only meaningful when silEligibleAsOf() is currently false.
function silEligibleFrom(emp) {
  return emp && emp.dateHired ? addMonths(emp.dateHired, 12) : null;
}

function addMonths(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00');
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return localISO(d);
}

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtMoney(n) {
  const v = Number(n) || 0;
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Spells out a peso amount, e.g. amountToWords(1234.56) -> "One Thousand Two Hundred
// Thirty Four Pesos and 56/100 Only" -- for the Payment Voucher's "The Sum of" line, the
// standard way a paper voucher states the amount in words so it can't be altered later.
function numberToWords(n) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function chunk(num) {
    let str = '';
    if (num >= 100) { str += ones[Math.floor(num / 100)] + ' Hundred '; num %= 100; }
    if (num >= 20) { str += tens[Math.floor(num / 10)] + ' '; num %= 10; }
    if (num > 0) { str += ones[num] + ' '; }
    return str.trim();
  }
  if (n === 0) return 'Zero';
  const scales = ['', 'Thousand', 'Million', 'Billion'];
  let scaleIdx = 0;
  const words = [];
  let rest = Math.floor(n);
  while (rest > 0) {
    const c = rest % 1000;
    if (c) words.unshift((chunk(c) + ' ' + scales[scaleIdx]).trim());
    rest = Math.floor(rest / 1000);
    scaleIdx++;
  }
  return words.join(' ');
}
function amountToWords(amount) {
  const num = Number(amount) || 0;
  const pesos = Math.floor(num);
  const centavos = Math.round((num - pesos) * 100);
  let words = numberToWords(pesos) + ' Peso' + (pesos === 1 ? '' : 's');
  if (centavos > 0) words += ' and ' + String(centavos).padStart(2, '0') + '/100';
  return words + ' Only';
}

// Formats a "HH:MM" 24-hour string (as stored) into 12-hour "h:mm AM/PM" for display.
function to12Hour(hhmm) {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm || '—';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + period;
}

// Semi-monthly (every 15 days) withholding tax brackets. The first three rows are exactly
// as given; brackets above ₱33,332 extend the standard published BIR semi-monthly table
// as a safety net — no current employee's per-cutoff gross reaches that row.
function withholdingTax(gross) {
  const g = Number(gross) || 0;
  if (g <= 10417) return 0;
  if (g <= 16666) return 0.15 * (g - 10417);
  if (g <= 33332) return 937.5 + 0.20 * (g - 16667);
  if (g <= 83332) return 3541.8 + 0.25 * (g - 33333);
  if (g <= 333332) return 16291.8 + 0.30 * (g - 83333);
  if (g <= 666666) return 91291.8 + 0.32 * (g - 333333);
  return 200833.33 + 0.35 * (g - 666667);
}

// Annually-fixed Philippine holidays only — keyed by "MM-DD" so they match regardless of
// year. Deliberately excludes movable/proclaimed holidays (Maundy Thursday, Good Friday,
// Black Saturday, Chinese New Year, National Heroes Day) since those shift every year and
// are only certain once Malacañang issues the actual proclamation (see the Holidays table
// comment in supabase/schema.sql) — guessing those would risk a wrong date silently
// granting or denying holiday pay.
const FIXED_PH_HOLIDAYS = {
  '01-01': { name: "New Year's Day", type: 'Regular' },
  '04-09': { name: 'Araw ng Kagitingan', type: 'Regular' },
  '05-01': { name: 'Labor Day', type: 'Regular' },
  '06-12': { name: 'Independence Day', type: 'Regular' },
  '11-30': { name: 'Bonifacio Day', type: 'Regular' },
  '12-25': { name: 'Christmas Day', type: 'Regular' },
  '12-30': { name: 'Rizal Day', type: 'Regular' },
  '02-25': { name: 'EDSA People Power Anniversary', type: 'Special' },
  '08-21': { name: 'Ninoy Aquino Day', type: 'Special' },
  '11-01': { name: "All Saints' Day", type: 'Special' },
  '12-08': { name: 'Feast of the Immaculate Conception', type: 'Special' },
  '12-24': { name: 'Christmas Eve', type: 'Special' },
  '12-31': { name: "New Year's Eve", type: 'Special' },
};

function detectFixedPhHoliday(isoDate) {
  if (!isoDate) return null;
  return FIXED_PH_HOLIDAYS[isoDate.slice(5)] || null;
}

const PAY_GROUP_NAMES = { '10-20': 'Admins', '15-30': 'Technicians' };

// Falls back to these only if the "payCutoffSettings" table has no row yet for a pay
// group (e.g. right after the migration, before it's been seeded) -- once a row exists,
// Store.getPayCutoffSetting() is the actual source of truth, editable from Attendance →
// Calendar → "Edit Cutoff Days".
// Shared 201 File document category list -- same options offered on the admin Employees
// detail drawer and the employee's own My Portal -> My Profile upload form, so labels
// never drift between the two.
const DOCUMENT_CATEGORIES = [
  'Valid ID', 'SSS', 'PhilHealth', 'Pag-IBIG', 'TIN', 'NBI Clearance',
  'Birth Certificate', 'Resume/CV', 'Diploma/TOR', 'Other',
];

// Government-recognized Philippine valid IDs -- shown as a second "ID Type" field only when
// category === 'Valid ID', so the 201 File records which specific ID was submitted instead of
// just the generic category. Same list on the admin Employees drawer and My Portal -> My Profile.
const PH_VALID_ID_TYPES = [
  'Philippine Passport', 'PhilSys National ID (ePhilID)', "Driver's License (LTO)",
  'UMID', 'SSS ID', 'GSIS eCard', 'PRC ID', "Voter's ID / COMELEC Certificate",
  'Postal ID', 'TIN ID', 'PhilHealth ID', 'Pag-IBIG Loyalty Card Plus',
  'Senior Citizen ID', 'PWD ID', 'OFW ID', 'ACR I-Card (Alien Certificate of Registration)',
  'Company ID', 'Other',
];

const DEFAULT_CUTOFF_SETTINGS = {
  '10-20': { cutoffAEndDay: 3, paydayADay: 5, cutoffBEndDay: 18, paydayBDay: 20 },
  '15-30': { cutoffAEndDay: 10, paydayADay: 15, cutoffBEndDay: 25, paydayBDay: 30 },
};

function cutoffSettingFor(payCycle) {
  return Store.getPayCutoffSetting(payCycle) || DEFAULT_CUTOFF_SETTINGS[payCycle] || DEFAULT_CUTOFF_SETTINGS['10-20'];
}

// "5th & 20th" style payday label for a pay group -- computed live from the editable
// settings instead of a hardcoded string, so it never goes stale after HR edits the
// cutoff days.
function paydayLabel(payCycle) {
  const s = cutoffSettingFor(payCycle);
  return `${ordinal(s.paydayADay)} & ${ordinal(s.paydayBDay)}`;
}

// Shared by every "generate a My Portal login password" flow (reset, and now account
// creation) -- excludes visually-ambiguous characters (0/O, 1/l/I) since this is meant to
// be read off-screen and typed/relayed to the employee, not just copy-pasted.
function generateStrongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  let pw = '';
  for (let i = 0; i < arr.length; i++) pw += chars[arr[i] % chars.length];
  return pw;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  const rem10 = n % 10;
  return n + (rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th');
}

// Cutoff A always runs from the day after the PREVIOUS month's cutoff B end through this
// month's cutoffAEndDay; cutoff B always runs from the day after cutoffAEndDay through
// cutoffBEndDay -- so every day of the month falls in exactly one cutoff, with no gap or
// overlap, purely from those two end-day numbers (both editable, see
// Store.updatePayCutoffSetting). Payday for either half is capped to the last day of the
// month, for the rare month that doesn't reach that day (e.g. a 30th-of-the-month payday
// in February).
function payCutoffs(payCycle, year, month) {
  const y = year, m = month;
  const last = daysInMonth(y, m);
  let prevMonth = m - 1, prevYear = y;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }
  const prevLast = daysInMonth(prevYear, prevMonth);

  const s = cutoffSettingFor(payCycle);
  const cutoffAEndDay = Math.min(s.cutoffAEndDay, last);
  const cutoffBEndDay = Math.min(s.cutoffBEndDay, last);
  const prevCutoffBEndDay = Math.min(s.cutoffBEndDay, prevLast);
  const cutoffAStartDay = prevCutoffBEndDay + 1;
  const cutoffBStartDay = cutoffAEndDay + 1;
  const paydayA = Math.min(s.paydayADay, last);
  const paydayB = Math.min(s.paydayBDay, last);

  return [
    {
      key: 'A',
      label: `${ordinal(cutoffAStartDay)} (prev. mo.) – ${ordinal(cutoffAEndDay)} (paid the ${ordinal(paydayA)})`,
      from: `${prevYear}-${pad2(prevMonth)}-${pad2(cutoffAStartDay)}`,
      to: `${y}-${pad2(m)}-${pad2(cutoffAEndDay)}`,
      payDate: `${y}-${pad2(m)}-${pad2(paydayA)}`,
    },
    {
      key: 'B',
      label: `${ordinal(cutoffBStartDay)} – ${ordinal(cutoffBEndDay)} (paid the ${ordinal(paydayB)})`,
      from: `${y}-${pad2(m)}-${pad2(cutoffBStartDay)}`,
      to: `${y}-${pad2(m)}-${pad2(cutoffBEndDay)}`,
      payDate: `${y}-${pad2(m)}-${pad2(paydayB)}`,
    },
  ];
}

// Worst-case span (in days) of each cutoff half, used only to warn HR in the "Edit
// Cutoff Days" form if a change would push either half over the Labor Code's 16-day
// maximum. Cutoff A's span depends on the previous month's length, so this checks the
// worst case (a 31-day previous month) rather than a specific month.
function cutoffSpans(cutoffAEndDay, cutoffBEndDay) {
  const spanA = (31 - cutoffBEndDay) + cutoffAEndDay;
  const spanB = cutoffBEndDay - cutoffAEndDay;
  return { spanA, spanB };
}

// Which cutoff (and potentially which month) "today" falls into — used to pick a
// sensible default view. Days past each cycle's "B" cutoff belong to NEXT month's "A"
// cutoff (see payCutoffs above), so the month can roll forward.
function defaultCutoffPosition(payCycle, year, month, day) {
  const s = cutoffSettingFor(payCycle);
  if (day <= s.cutoffAEndDay) return { year, month, half: 'A' };
  if (day <= s.cutoffBEndDay) return { year, month, half: 'B' };
  let m = month + 1, y = year;
  if (m > 12) { m = 1; y += 1; }
  return { year: y, month: m, half: 'A' };
}

// Standard working days in a cutoff (Mon–Sat, Sunday off), used as the divisor for
// deriving a monthly-rate employee's per-day equivalent for absence deductions.
function workDaysInRange(from, to) {
  let count = 0;
  let d = from;
  while (d <= to) {
    if (new Date(d + 'T00:00:00').getDay() !== 0) count++;
    d = addDays(d, 1);
  }
  return count;
}

// Total hours worked between two "HH:MM" times, handling a shift that crosses midnight
// (e.g. 22:00-06:00) the same way nightOverlapHours below does. Shared by the admin
// Attendance modal and the ESS Attendance page so Time In/Time Out always drive the same
// auto-computed Hours figure in both places.
function hoursBetween(timeIn, timeOut) {
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let start = toMin(timeIn), end = toMin(timeOut);
  if (end <= start) end += 1440; // crosses midnight
  return Math.round(((end - start) / 60) * 100) / 100;
}

// Shared leniency window around an employee's default Time In/Time Out -- a few minutes
// either side of the schedule is normal, not something to auto-flag. Used for clocking out
// past defaultTimeOut (before it's worth auto-filing an Overtime request), and DTR "on
// schedule" display rounding. Late ARRIVAL specifically uses TARDINESS_GRACE_MINUTES
// instead (see below) -- the Code of Discipline's Policy of Punctuality documents a
// 10-minute grace period there, distinct from this general one. The early-clock-in pay
// clamp has its own separate, smaller constant -- see EARLY_CLOCKIN_PAID_MINUTES below.
const ATTENDANCE_GRACE_MINUTES = 15;

// Code of Discipline, "Policy of Punctuality": a 10-minute grace period after the official
// time-in, for lateness flagging (marking a day "Late") -- kept separate from
// ATTENDANCE_GRACE_MINUTES since the document only documents this grace period for arrival
// lateness, not the other three behaviors that constant governs. Late arrival no longer
// carries a pay deduction (removed by explicit company decision -- see computeRow).
const TARDINESS_GRACE_MINUTES = 10;

// Did an employee clock in late? No default Time In set -- never auto-marked late, since
// there's nothing to compare against (HR can still set status manually either way).
function isLateArrival(defaultTimeIn, actualTimeIn) {
  if (!defaultTimeIn || !actualTimeIn) return false;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return toMin(actualTimeIn) > toMin(defaultTimeIn) + TARDINESS_GRACE_MINUTES;
}

// TXTAIRE OPC Code of Discipline, Series 1, 2025 Edition -- the full offense catalog, one
// entry per row of the document's "Schedule of Penalties" tables, grouped exactly as the
// document groups them. `schedule` is the penalty for the 1st, 2nd, 3rd... occurrence
// (within a trailing 12-month period, per the document) as a code: 'VW' (Verbal Warning),
// 'WW' (Written Warning), an integer+'S' (days of Suspension without pay), or 'D'
// (Dismissal). Where the document splits one offense into loss-amount sub-tiers (e.g.
// "Minor loss" vs "Major loss"), each sub-tier is its own catalog entry, matching how the
// document itself tables them. Shared by the admin Disciplinary case form (offense
// selection + suggested-penalty lookup) and the ESS "Code of Discipline" reference page.
// labelFil/categoryFil are a first-pass Filipino translation for the ESS "Code of
// Discipline" page's language toggle (js/ess-views/discipline.js) -- written in plain,
// everyday/spoken Filipino (the way HR would actually explain it to an employee), not
// formal literary Tagalog, and mixing in common workplace English terms (time card, ID,
// supervisor, invoice, etc.) the way Filipino offices actually talk. Same disclaimer as
// the rest of this app's Filipino strings (js/ess-i18n.js): a native/fluent speaker
// should review these before treating them as polished/legally authoritative. English
// label/category stay the canonical fields the admin Disciplinary case form uses.
const DISCIPLINE_OFFENSE_CATALOG = [
  { category: 'Against Attendance', categoryFil: 'Mga Paglabag sa Attendance', offenses: [
    { code: 'simple-absence', label: 'Simple case of Absence (1–2 days unauthorized)', labelFil: 'Karaniwang Pagliban (1–2 araw na walang pahintulot)', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'excessive-absence', label: 'Excessive Absence (3–5 days unauthorized)', labelFil: 'Sobrang Pagliban (3–5 araw na walang pahintulot)', schedule: ['5S', 'D'] },
    { code: 'abandonment', label: 'Abandonment of Work (more than 5 days unauthorized, or clear intent not to return)', labelFil: 'Pag-iwan sa Trabaho (mahigit 5 araw na wala, o halatang ayaw nang bumalik)', schedule: ['D'] },
  ]},
  { category: 'On Timekeeping', categoryFil: 'Mga Paglabag sa Time Card / Oras ng Trabaho', offenses: [
    { code: 'falsifying-timecards', label: 'Falsifying time cards or any other timekeeping records', labelFil: 'Pagpeke ng time card o kahit anong record ng oras', schedule: ['D'] },
    { code: 'benefiting-falsified-timecards', label: "Knowingly receiving salary or allowances by virtue of falsified time cards, vouchers, receipts or the like", labelFil: 'Sadyang pagtanggap ng sahod dahil sa pekeng time card, voucher, o resibo', schedule: ['D'] },
    { code: 'false-reason-absent-late', label: 'Giving false reason for being absent or late', labelFil: 'Pagsisinungaling sa dahilan ng pagliban o pagiging huli', schedule: ['3S', '5S', 'D'] },
    { code: 'punching-others-timecard', label: "Punching another employee's timecard", labelFil: 'Pag-punch ng time card ng kasamahan', schedule: ['D', 'D'] },
    { code: 'beneficiary-of-punching', label: 'Being the employee for whose benefit another employee’s timecard was punched, if done with your knowledge, consent or acquiescence', labelFil: 'Pagpapa-punch ng sariling time card sa iba, alam mo o pumayag ka', schedule: ['D'] },
    { code: 'repeated-failure-punch', label: 'Repeated failure or refusal to punch time cards (for card-punching employees)', labelFil: 'Paulit-ulit na hindi mag-punch ng time card', schedule: ['3S', '5S', 'D'] },
    { code: 'excessive-tardiness', label: 'Excessive Tardiness (late for a total of 260 minutes or more in one month)', labelFil: 'Sobrang Late (260 minuto o higit pa ang total na huli sa loob ng isang buwan)', schedule: ['WW', 'WW', '3S', '5S', 'D'] },
  ]},
  { category: 'Against Health, Security and Safety', categoryFil: 'Kalusugan, Seguridad, at Kaligtasan', offenses: [
    { code: 'health-medical-noncompliance', label: 'Failure or refusal to comply with the health or medical requirement of the company', labelFil: 'Ayaw sumunod sa health o medical na requirement ng kompanya', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'concealing-communicable-disease', label: 'Deliberately concealing a suspected communicable disease or ailment', labelFil: 'Sadyang pagtatago ng nakakahawang sakit', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'disregard-cleanliness', label: 'Willful disregard of directives relative to cleanliness and orderliness (littering, leaving soiled dishes, dirty comfort room)', labelFil: 'Hindi pagsunod sa kalinisan (nangangalat, hindi naglilinis, maruming CR)', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'lending-id', label: 'Lending an ID to a co-employee or third person not connected with the Company', labelFil: 'Pagpapahiram ng ID sa kasamahan o sa taong wala sa kompanya', schedule: ['3S', '10S', '15S', 'D'] },
    { code: 'unauthorized-weapons', label: 'Unauthorized carrying or possession of firearms, explosive and/or other deadly weapons and/or paraphernalia within Company premises', labelFil: 'Pagdadala ng baril, pampasabog, o ibang mapanganib na armas sa loob ng kompanya', schedule: ['D'] },
    { code: 'conviction-crime', label: 'Conviction of a crime', labelFil: 'Nahatulan sa isang kaso ng krimen', schedule: ['D'] },
    { code: 'forcing-entry-after-hours', label: 'Forcing entry into the office after office hours', labelFil: 'Sapilitang pagpasok sa opisina pagkatapos ng oras', schedule: ['5S', '10S', 'D'] },
    { code: 'unauthorized-opening', label: "Unauthorized opening of another's office, locker or drawer", labelFil: 'Nagbukas ng opisina, locker, o drawer ng iba nang walang pahintulot', schedule: ['5S', '10S', 'D'] },
    { code: 'disobey-safety', label: "Willful disobedience to safety instructions in connection with the employee's work", labelFil: 'Hindi pagsunod sa mga patakaran sa kaligtasan', schedule: ['30S', 'D'] },
    { code: 'failure-report-accident', label: 'Failure to immediately report the occurrence of an accident or the presence of an unsafe condition', labelFil: 'Hindi agad pag-report ng aksidente o delikadong sitwasyon', schedule: ['30S', 'D'] },
  ]},
  { category: 'Related to Job Performance', categoryFil: 'Performance sa Trabaho', offenses: [
    { code: 'sabotage', label: 'Sabotage or deliberate acts intended to disrupt operations, whether or not damage was caused', labelFil: 'Sadyang pagsira sa operasyon ng kompanya', schedule: ['D'] },
    { code: 'espionage', label: 'Industrial or other forms of espionage — disclosing trade secrets, confidential materials or documents without proper authorization', labelFil: 'Pagbunyag ng trade secret o confidential na bagay ng kompanya', schedule: ['D'] },
    { code: 'gross-misconduct-controls', label: 'Gross misconduct arising from blatant disregard of or deviation from established controls, policies and procedure', labelFil: 'Lantarang hindi pagsunod sa patakaran o proseso ng kompanya', schedule: ['10S', 'D'] },
    { code: 'gross-misconduct-bribery', label: "Gross misconduct arising from accepting, directly or indirectly, money, offer, promise and/or gift in consideration of any act pertaining to one's work", labelFil: 'Pagtanggap ng pera, regalo, o pabor bilang kapalit ng anumang gawain sa trabaho', schedule: ['D'] },
    { code: 'insubordination', label: 'Disobedience, insubordination or refusal to obey legitimate instruction', labelFil: 'Pagsuway o pagtanggi sa tamang utos ng superyor', schedule: ['10S', '15S', 'D'] },
    { code: 'negligence-minor-loss', label: 'Negligence or gross inefficiency resulting in minor/unquantified loss (₱200–₱5,000)', labelFil: 'Kapabayaan na nagresulta sa maliit na pinsala (₱200–₱5,000)', schedule: ['10S', '15S', 'D'] },
    { code: 'negligence-major-loss', label: 'Negligence or gross inefficiency resulting in major loss (over ₱5,000, up to ₱30,000)', labelFil: 'Kapabayaan na nagresulta sa malaking pinsala (₱5,000–₱30,000)', schedule: ['30S', 'D'] },
    { code: 'unauthorized-broker', label: "Acting as broker or agent, or negotiating on behalf of a unit owner or another person without authority to do so", labelFil: 'Nag-broker o nakipag-usap sa ngalan ng may-ari ng unit nang walang pahintulot', schedule: ['5S', 'D'] },
    { code: 'wasting-time', label: 'Wasting time, loafing, loitering, or leaving place of work during working hours without permission from supervisor', labelFil: 'Pag-aaksaya ng oras o pag-alis sa trabaho nang walang pahintulot ng supervisor', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'sleeping-on-duty', label: 'Sleeping during working hours or deliberately evading assigned work', labelFil: 'Pagtulog habang naka-duty o pag-iwas sa trabaho', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'hindering-output', label: 'Willful holding back, slow down, hindering or limiting work output, or inducing/encouraging a fellow employee to do so', labelFil: 'Sadyang pagpapabagal ng trabaho, o paghikayat sa iba na gawin din ito', schedule: ['5S', '15S', 'D'] },
    { code: 'uniform-noncompliance', label: 'Failure to wear prescribed work uniform or attire when on duty, except when excused', labelFil: 'Hindi pagsuot ng uniform sa trabaho nang walang dahilan', schedule: ['VW', 'WW', '3S', '5S'] },
    { code: 'phone-unreachable', label: "Deliberate failure to make their company-provided phone available/reachable (plus ₱500 fine / confiscation of unit)", labelFil: 'Sadyang hindi pagsagot o pagbukas ng cellphone na ibinigay ng kompanya (may ₱500 multa o kukunin ang unit)', schedule: ['VW', 'WW'] },
  ]},
  { category: 'Against Property', categoryFil: 'Ari-arian ng Kompanya', offenses: [
    { code: 'willful-damage', label: 'Willful damage or destruction of any company property or equipment owned by the company or its clients', labelFil: 'Sadyang pagsira sa ari-arian ng kompanya o ng kliyente', schedule: ['D'] },
    { code: 'unauthorized-use-minor', label: 'Unauthorized use of company property or equipment resulting in minor loss (₱100–₱500)', labelFil: 'Hindi pinahintulutang paggamit ng gamit ng kompanya, may maliit na pinsala (₱100–₱500)', schedule: ['5S', '15S', 'D'] },
    { code: 'unauthorized-use-major', label: 'Unauthorized use of company property or equipment resulting in major loss (over ₱500, up to ₱10,000)', labelFil: 'Hindi pinahintulutang paggamit ng gamit ng kompanya, may malaking pinsala (₱500–₱10,000)', schedule: ['15S', 'D'] },
    { code: 'malversation', label: "Malversation of Company funds, theft of any Company or Client's property or money, including acquisition under fraudulent or false pretenses", labelFil: 'Pagnanakaw ng pera o ari-arian ng kompanya o kliyente', schedule: ['D'] },
    { code: 'attempted-removal-no-loss', label: "Attempt to remove or frustrated removal of Company or Client's property without proper authorization, without loss, damage or injury", labelFil: 'Pagtatangkang kunin ang gamit ng kompanya nang walang pahintulot, walang naganap na pinsala', schedule: ['15S', '30S', 'D'] },
    { code: 'attempted-removal-with-loss', label: "Attempt to remove or frustrated removal of Company or Client's property without proper authorization, with loss, damage or injury", labelFil: 'Pagtatangkang kunin ang gamit ng kompanya nang walang pahintulot, may naganap na pinsala', schedule: ['D'] },
    { code: 'carelessness-minor-loss', label: "Carelessness or improper use of company or client's property, materials and/or equipment — minor loss (₱100–₱5,000)", labelFil: 'Kapabayaan sa gamit ng kompanya, may maliit na pinsala (₱100–₱5,000)', schedule: ['5S', '15S', 'D'] },
    { code: 'carelessness-major-loss', label: "Carelessness or improper use of company or client's property, materials and/or equipment — major loss (over ₱5,000, up to ₱30,000)", labelFil: 'Kapabayaan sa gamit ng kompanya, may malaking pinsala (₱5,000–₱30,000)', schedule: ['D'] },
    { code: 'vandalism', label: "Any act of vandalism that damages, deforms or destroys Company or Client's property, or the property of others, inside Company premises", labelFil: 'Pagsira o pagpapangit ng gamit ng kompanya, kliyente, o ibang tao sa loob ng kompanya', schedule: ['5S', '10S', '15S', 'D'] },
    { code: 'unauthorized-vehicle-no-damage', label: "Unauthorized use of company or Client's vehicle, without causing damage or injury", labelFil: 'Paggamit ng sasakyan ng kompanya nang walang pahintulot, walang aksidente', schedule: ['15S', '30S', 'D'] },
    { code: 'unauthorized-vehicle-with-damage', label: "Unauthorized use of company or Client's vehicle, causing damage or injury", labelFil: 'Paggamit ng sasakyan ng kompanya nang walang pahintulot, may aksidente', schedule: ['D'] },
    { code: 'reckless-driving-no-damage', label: 'Driving company vehicle in a reckless and imprudent manner, without causing damage or injury', labelFil: 'Pabigla-bigla o pabayang pagmamaneho ng sasakyan ng kompanya, walang aksidente', schedule: ['15S', '30S', 'D'] },
    { code: 'reckless-driving-with-damage', label: 'Driving company vehicle in a reckless and imprudent manner, causing damage or injury', labelFil: 'Pabigla-bigla o pabayang pagmamaneho ng sasakyan ng kompanya, may aksidente', schedule: ['D'] },
  ]},
  { category: 'Against Honesty', categoryFil: 'Katapatan', offenses: [
    { code: 'theft-pilferage', label: "Theft/pilferage of Company or Client's property, or of personal property of a co-employee or third person, in the company or Client's premises", labelFil: 'Pagnanakaw sa kompanya, kliyente, o gamit ng kasamahan', schedule: ['D'] },
    { code: 'unauthorized-use-funds', label: "Using Company or Client's funds or property without prior approval from immediate superior or any accountable person", labelFil: 'Paggamit ng pera o gamit ng kompanya nang walang pahintulot', schedule: ['D'] },
    { code: 'falsification-records', label: "Fictitious transactions, falsification of Company or Client's records and documents", labelFil: 'Peke o kathang-isip na transaksyon, pagpeke ng record ng kompanya', schedule: ['D'] },
    { code: 'misappropriation', label: "Misappropriation or embezzlement of Company or Client's funds or property", labelFil: 'Maling paggamit o pagnanakaw ng pera o ari-arian ng kompanya', schedule: ['D'] },
    { code: 'withholding-funds', label: 'Withholding funds due to the company or the Client; kiting or collections, short remittance or non-remittance of collections', labelFil: 'Hindi pagbibigay ng perang dapat matanggap ng kompanya o kliyente', schedule: ['D'] },
    { code: 'non-issuance-invoice', label: 'Non-issuance or mis-issuance of invoices and/or receipts and commercial documents, if required', labelFil: 'Hindi pagbibigay ng invoice o resibo kung kailangan ito', schedule: ['D'] },
    { code: 'forgery', label: 'Forgery, misuse or abuse of funds', labelFil: 'Pamemeke o maling paggamit ng pera', schedule: ['D'] },
    { code: 'competing-business', label: 'Engaging privately in business that tends to compete with the company', labelFil: 'Sariling negosyo na kalaban ng kompanya', schedule: ['D'] },
    { code: 'conspiring', label: 'Conspiring or conniving with, directing or instigating others to commit any of the foregoing', labelFil: 'Pakikipagsabwatan o paghikayat sa iba na gawin ang alinman sa mga nabanggit', schedule: ['D'] },
  ]},
  { category: 'Against Proper Conduct and Behavior', categoryFil: 'Asal at Ugali', offenses: [
    { code: 'horseplay-no-loss', label: 'Horseplay or other unruly conduct causing disorder, disruption, annoyance or scandal, without loss, damage or injury', labelFil: 'Kalokohan o magulong asal sa opisina, walang pinsala', schedule: ['WW', '3S', '5S', 'D'] },
    { code: 'horseplay-with-loss', label: 'Horseplay or other unruly conduct causing disorder, disruption, annoyance or scandal, with loss, damage or injury', labelFil: 'Kalokohan o magulong asal sa opisina, may pinsala', schedule: ['30S', 'D'] },
    { code: 'drinking-alcohol', label: 'Drinking alcoholic beverage or liquor within Company premises or during working hours', labelFil: 'Pag-inom ng alak sa loob ng kompanya o sa oras ng trabaho', schedule: ['15S', 'D'] },
    { code: 'prohibited-drugs', label: 'Use or possession of prohibited drugs or other derivatives, including the sale or brokering thereof', labelFil: 'Paggamit o pagbebenta ng bawal na droga', schedule: ['D'] },
    { code: 'fighting-on-premises', label: 'Fighting, provoking or instigating a fight, while on or off duty within Company premises', labelFil: 'Pakikipag-away sa loob ng kompanya', schedule: ['D'] },
    { code: 'fighting-work-related', label: 'Fighting, provoking or instigating a fight, while off duty outside Company premises but due to work-related causes', labelFil: 'Pakikipag-away sa labas ng kompanya dahil sa trabaho', schedule: ['D'] },
    { code: 'fighting-not-work-related', label: 'Fighting, provoking or instigating a fight, while off duty outside Company premises, not due to work-related causes', labelFil: 'Pakikipag-away sa labas ng kompanya, hindi dahil sa trabaho', schedule: ['15S', 'D'] },
    { code: 'physical-injury-minor', label: 'Willful or deliberate physical injury to a superior, employee or third person due to work-related causes — minor injury', labelFil: 'Pananakit sa superyor o kasamahan dahil sa trabaho — magaan na sugat', schedule: ['5S', '15S', 'D'] },
    { code: 'physical-injury-major', label: 'Willful or deliberate physical injury to a superior, employee or third person due to work-related causes — major injury', labelFil: 'Pananakit sa superyor o kasamahan dahil sa trabaho — malubhang sugat', schedule: ['30S', 'D'] },
    { code: 'disrespect-threats', label: 'Acts of disrespect, use of foul language or signs, challenging a fight, or giving threats against a superior, co-employee or third person in the course of business', labelFil: 'Kawalang-galang, masamang salita, o pagbabanta sa superyor o kasamahan', schedule: ['15S', 'D'] },
    { code: 'intrigues', label: 'Creating intrigues against another employee which tend to cast dishonor, discredit or contempt upon the latter', labelFil: 'Paninirang-puri o paggawa ng kwento laban sa kasamahan', schedule: ['15S', 'D'] },
    { code: 'immoral-conduct', label: 'Immoral conduct or indecent acts; sexual activities within Company premises; sexual harassment (verbal or physical); acts of lasciviousness', labelFil: 'Malaswang gawa o sexual harassment sa loob ng kompanya', schedule: ['D'] },
    { code: 'obscene-materials', label: 'Posting, distributing or drawing obscene, scandalous or offensive pictures or subversive materials; acts of vandalism; unauthorized removal of bulletin board materials; uploading such materials online in a way that affects Company reputation', labelFil: 'Pagpost o pagpapakalat ng malaswang larawan; pagsira ng gamit; o online post na nakakasama sa pangalan ng kompanya', schedule: ['15S', 'D'] },
    { code: 'gambling', label: 'Gambling or engaging in a game of chance, soliciting bets, or lending money to be used for such activity, during working hours or within Company premises', labelFil: 'Pagsusugal sa loob ng kompanya o sa oras ng trabaho', schedule: ['D'] },
    { code: 'planting-evidence', label: 'Planting evidence against a superior or another employee', labelFil: 'Paglalagay ng ebidensya laban sa superyor o kasamahan', schedule: ['D'] },
    { code: 'physical-injury-any-person', label: 'Intentionally or deliberately inflicting physical injury upon any person during working hours or within company premises', labelFil: 'Sadyang pananakit sa kahit sino sa loob ng kompanya o sa oras ng trabaho', schedule: ['15S', 'D'] },
    { code: 'gross-discourtesy', label: 'Acts of gross discourtesy to any person, whether made physically or verbally', labelFil: 'Malubhang kawalang-galang sa kahit sino', schedule: ['15S', '30S', 'D'] },
    { code: 'borrowing-from-clients', label: "Borrowing money, merchandise or goods from Client's visitors or customers", labelFil: 'Panghihiram ng pera o gamit sa bisita o customer ng kliyente', schedule: ['30S', 'D'] },
    { code: 'soliciting-from-subordinates', label: 'Soliciting or borrowing money, merchandise or goods by management staff (managers/supervisors) from their subordinates for personal or unofficial use', labelFil: 'Manager o supervisor na naghihingi o nanghihiram ng pera sa sariling tauhan para sa sarili nilang gamit', schedule: ['D'] },
    { code: 'unauthorized-business', label: 'Engaging in any kind of business within the Company premises or during working hours', labelFil: 'Paggawa ng sariling negosyo sa loob ng kompanya o sa oras ng trabaho', schedule: ['3S', '10S', 'D'] },
  ]},
  { category: 'Neglect of Duty of Supervisors or Managers', categoryFil: 'Pagpapabaya ng Supervisor o Manager', offenses: [
    { code: 'failure-disseminate', label: 'Failure to disseminate to employees under his/her supervision, Company policies, work rules and procedure and other related matters', labelFil: 'Hindi pagpapaalam sa sariling tauhan ng mga patakaran o alituntunin ng kompanya', schedule: ['3S', '5S', '10S', 'D'] },
    { code: 'failure-prevent-report', label: 'Failure to prevent or report any violation of this Code, work rules and regulation', labelFil: 'Hindi pagpigil o hindi pag-report ng paglabag sa Code of Discipline', schedule: ['3S', '5S', '10S', 'D'] },
  ]},
];

// Human-readable text for a Code of Discipline penalty code ('D', 'WW', 'VW', or an
// integer+'S' for days of suspension) -- shared by the Disciplinary case form's suggested-
// penalty callout and the ESS Code of Discipline reference page.
function penaltyLabel(code) {
  if (code === 'D') return 'Dismissal';
  if (code === 'WW') return 'Written Warning';
  if (code === 'VW') return 'Verbal Warning';
  const m = /^(\d+)S$/.exec(code || '');
  if (m) return m[1] + '-day Suspension';
  return code || '—';
}

// Filipino version of penaltyLabel, for the ESS Code of Discipline page's language toggle.
function penaltyLabelFil(code) {
  if (code === 'D') return 'Pagtanggal sa Trabaho';
  if (code === 'WW') return 'Nakasulat na Babala';
  if (code === 'VW') return 'Bibig na Babala';
  const m = /^(\d+)S$/.exec(code || '');
  if (m) return m[1] + '-Araw na Suspensyon';
  return code || '—';
}

// Did an employee clock out later than their own scheduled end time (past the grace
// period)? Both actualTimeOut and defaultTimeOut are anchored relative to timeIn (same
// "crosses midnight" handling as hoursBetween) so an overnight shift (e.g. in 22:00,
// default out 06:00) compares correctly instead of looking like it ended hours "early."
function exceedsDefaultTimeOut(timeIn, actualTimeOut, defaultTimeOut) {
  if (!timeIn || !actualTimeOut || !defaultTimeOut) return false;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const start = toMin(timeIn);
  let actual = toMin(actualTimeOut);
  let def = toMin(defaultTimeOut) + ATTENDANCE_GRACE_MINUTES;
  if (actual <= start) actual += 1440;
  if (def <= start) def += 1440;
  return actual > def;
}

// Photo attendance itself never blocks an early Time In -- an employee can badge in
// however far ahead of their shift they like. This only governs the HOURS figure derived
// from it: pay starts counting no earlier than EARLY_CLOCKIN_PAID_MINUTES before the
// employee's Default Time In (unless there's no schedule set, in which case there's
// nothing to clamp against) -- badging in further ahead than that doesn't earn pay for the
// extra early minutes, it just clamps down to that 5-minute mark instead of their actual,
// earlier timeIn. The raw attendance.timeIn value itself is never touched by this -- only
// the hours figure derived from it -- so the actual clock-in time still displays correctly
// everywhere (DTR, attendance records, etc).
const EARLY_CLOCKIN_PAID_MINUTES = 5;
function paidHoursBetween(timeIn, timeOut, emp) {
  if (!emp || !emp.defaultTimeIn) return hoursBetween(timeIn, timeOut);
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toTime = (min) => {
    const m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };
  const earliestPaidStartMin = toMin(emp.defaultTimeIn) - EARLY_CLOCKIN_PAID_MINUTES;
  const effectiveStart = toMin(timeIn) < earliestPaidStartMin ? toTime(earliestPaidStartMin) : timeIn;
  return hoursBetween(effectiveStart, timeOut);
}

// Printable-DTR-only display helper: is this clock time within the grace period of the
// employee's default? (Plain absolute-value comparison, no midnight-crossing handling --
// good enough for "am I basically on schedule," unlike exceedsDefaultTimeOut which has to
// be exact for real OT decisions.)
function withinScheduleGrace(actualTime, defaultTime) {
  if (!defaultTime || !actualTime) return false;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  return Math.abs(toMin(actualTime) - toMin(defaultTime)) <= ATTENDANCE_GRACE_MINUTES;
}

const STANDARD_WORKDAY_HOURS = 8;

// Labor Code Art. 85's unpaid 60-minute meal period (previously subtracted from a full
// scheduled shift's hours before counting toward OT/holiday pay and the DTR printout, via
// a now-removed effectivePaidHours helper) no longer reduces computed hours -- explicit
// company decision. Hours worked/paid are the raw clocked span, full stop.

// Hours to print on the DTR for one day. A day within the grace period on BOTH Time In and
// Time Out (i.e. not actually Late, not actually filing OT) shows the clean standard 8
// instead of the precise clock-derived minutes (8.9, 9.08, etc.) -- those few minutes
// either side of the schedule aren't meant to nudge the printed total. A real deviation
// beyond the grace period on either end (genuine lateness/undertime, or genuine overtime --
// already broken out in its own OT Hrs column) still shows the real clocked hours.
// Untouched: the actual stored attendance.hours field, used everywhere else (payroll,
// Store.computeRow, etc.) -- this only affects what's printed on the DTR.
function dtrDisplayHours(r, emp) {
  if (!r) return 0;
  const rawHours = Number(r.hours) || 0;
  if (r.timeIn && r.timeOut && withinScheduleGrace(r.timeIn, emp.defaultTimeIn) && withinScheduleGrace(r.timeOut, emp.defaultTimeOut)) {
    return STANDARD_WORKDAY_HOURS;
  }
  return rawHours;
}

// Hours of a shift ("HH:MM"-"HH:MM") that fall within the legal night-shift-differential
// window, 10:00 PM to 6:00 AM. Handles shifts that cross midnight (e.g. 22:00-06:00) and
// early-morning shifts that don't (e.g. 04:00-13:00, where 04:00-06:00 counts).
function nightOverlapHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let start = toMin(timeIn);
  let end = toMin(timeOut);
  const crossesMidnight = end <= start;
  if (crossesMidnight) end += 1440;
  let overlap = Math.max(0, Math.min(end, 1800) - Math.max(start, 1320)); // 22:00–06:00(+1d)
  if (!crossesMidnight) {
    overlap += Math.max(0, Math.min(end, 360) - Math.max(start, 0)); // tail of prior night, 00:00–06:00
  }
  return overlap / 60;
}

// Single source of truth for a day's NSD/OT/holiday pay, shared by the Payroll tab's
// totals and the printable DTR so the two never drift apart. `dailyRateEq` is the
// employee's daily-rate equivalent (their own rate if Daily, or monthly rate / working
// days in the cutoff if Monthly); `rec` is that day's attendance record (or null/undefined
// if absent); `holiday` is that day's holidays-calendar entry (or null/undefined).
//
// Overtime: 125% ordinary / 169% special-day-or-rest-day-worked / 260% regular-holiday-
// worked, applied to hours beyond 8. Night Shift Differential: +10% of the hourly rate for
// each hour actually worked 10pm-6am, regardless of holiday. Holiday pay: a worked holiday
// earns a premium on top of its already-counted 1x base (200% regular / 130% special,
// prorated by regular hours worked up to 8); an unworked REGULAR holiday still pays a full
// day ("no work, no pay" does not apply to regular holidays); an unworked special day pays
// nothing extra. Rest Day pay (Art. 93): work on the employee's weekly rest day (Sunday --
// see workDaysInRange; not yet configurable per employee) earns the same 30% premium as a
// worked Special Non-Working holiday, only when no actual holiday already covers that date.
// NSD/OT/Holiday-premium pay only count once HR has approved that specific day's request
// (rec.otStatus/nsdStatus/holidayStatus === 'Approved') — a Requested-but-not-yet-approved
// day pays neither. The one exception, required by Philippine labor law: an employee who
// was ABSENT on a declared Regular Holiday is still owed their full daily rate regardless
// of any request/approval, since there's no attendance record for them to request against.
// Rest Day pay is likewise unrequested/ungated (unlike OT/NSD/Holiday) since it's a plain
// fact derived from the date and the attendance record already on file, not an elective
// request that could be disputed the way OT hours can.
function computeDayPay(dailyRateEq, rec, holiday, emp) {
  const hourlyRate = dailyRateEq / 8;
  const hrs = rec ? (Number(rec.hours) || 0) : 0;
  // No lunch-break deduction here (removed per company decision, see the note above
  // dtrDisplayHours) -- effHrs is just the raw clocked hours, counted toward OT/holiday
  // pay unreduced.
  const effHrs = hrs;

  // A record can carry its own holidayType, overriding/standing in for the shared
  // Holidays list entry for that date — lets HR grant the holiday premium for a specific
  // employee's day even when that date isn't on the company-wide list. The absent-but-
  // still-paid rule below stays tied to the real shared-list holiday only, since there's
  // no per-record override possible for a day nobody clocked in for.
  const effectiveType = (rec && rec.holidayType) ? rec.holidayType : (holiday ? holiday.type : null);
  const isRestDayWorked = !effectiveType && !!rec && rec.status !== 'Absent' && new Date(rec.date + 'T00:00:00').getDay() === 0;
  // Rest-day work uses the exact same OT/premium tier as a worked Special Non-Working
  // holiday (both are 30%-premium days under the Labor Code) -- reusing 'effectiveType's
  // multiplier logic below rather than adding a parallel branch.
  const premiumType = effectiveType || (isRestDayWorked ? 'Special' : null);

  // otHours lets HR override the derived "effective hours - 8" figure (e.g. to exclude a
  // break, or cap it) — null/undefined falls back to the original derived calculation.
  // Company policy: OT is only paid in whole completed hours -- a day with 2.53 excess
  // hours (2 hrs 32 min) pays for 2 hrs only, the trailing partial hour is dropped, not
  // rounded. Floored last, so this applies whether the figure came from the derived
  // calculation or an HR-entered override.
  const otHrs = (rec && rec.otStatus === 'Approved')
    ? Math.floor(rec.otHours != null ? Number(rec.otHours) : Math.max(0, effHrs - 8))
    : 0;
  const otMultiplier = premiumType ? (premiumType === 'Regular' ? 2.6 : 1.69) : 1.25;
  const otPay = otHrs * hourlyRate * otMultiplier;
  const nsdHrs = (rec && rec.nsdStatus === 'Approved') ? nightOverlapHours(rec.timeIn, rec.timeOut) : 0;
  const nsdPay = nsdHrs * hourlyRate * 0.10;

  let holidayPay = 0;
  if (effectiveType) {
    if (rec && rec.holidayStatus === 'Approved') {
      const regHrs = Math.min(effHrs, 8);
      const mult = effectiveType === 'Regular' ? 2.0 : 1.3;
      holidayPay = dailyRateEq * (mult - 1) * (regHrs / 8);
    } else if (!rec && holiday && holiday.type === 'Regular') {
      holidayPay = dailyRateEq;
    }
  }

  let restDayPay = 0;
  if (isRestDayWorked) {
    const regHrs = Math.min(effHrs, 8);
    restDayPay = dailyRateEq * 0.3 * (regHrs / 8);
  }

  return { otHrs, otPay, nsdHrs, nsdPay, holidayPay, restDayPay };
}

// Full payroll computation for one employee over one cutoff — shared by the admin
// Payroll tab and the Employee Self-Service "My Payroll" page so both always show
// exactly the same numbers. Reads attendance/holidays/deductions/overrides straight
// from the Store, so it stays live as records change. The gap between a cutoff's last
// counted day (`to`) and its actual payDate (see payCutoffs) is what gives HR processing
// time before payday — already baked into the cutoff span itself, so this just uses
// `from`/`to` directly with no additional shift.
// Attendance is meant to be one record per employee per date, but nothing has ever
// stopped a second one for the same day (e.g. HR manually logs a day the employee
// separately self-clocked via photo) -- when that happens, this makes the employee's
// photo-verified record the authoritative one, both for the printable DTR/Calendar
// display and for what actually counts toward pay, instead of an arbitrary "whichever
// happened to load last" pick. Returns a { date: record } map.
function dedupeAttendanceByDate(records) {
  const byDate = {};
  records.forEach(r => {
    const existing = byDate[r.date];
    if (!existing) { byDate[r.date] = r; return; }
    const hasPhoto = !!(r.timeInPhotoPath || r.timeOutPhotoPath);
    const existingHasPhoto = !!(existing.timeInPhotoPath || existing.timeOutPhotoPath);
    if (hasPhoto && !existingHasPhoto) byDate[r.date] = r;
  });
  return byDate;
}

// dateHired doubles as this app's "start date" -- already the single anchor used
// everywhere else (SIL eligibility, tenure, retirement pay), so a future-dated hire
// (added to the system ahead of their actual first day) shouldn't show any pay yet.
// Compared against min(to, today) rather than just `to` -- a cutoff's own end date
// alone isn't enough for the CURRENT cutoff, which spans both before and after a
// mid-cutoff start date: checking only `to` would already show the employee's full
// pay for that whole cutoff the moment it's viewed, even on a day before they've
// actually started (today < dateHired), since Monthly-rate basePay is a flat amount
// not gated by attendance. Capping at today keeps a genuinely past cutoff (viewed
// after the employee already started, today >= dateHired) computing normally, while
// keeping "hasn't started as of today" hidden regardless of which cutoff -- past,
// current, or future -- happens to be open.
function computeRow(emp, from, to) {
  const notStartedCutoff = todayISO() < to ? todayISO() : to;
  if (emp.dateHired && emp.dateHired > notStartedCutoff) {
    return {
      emp, daysPresent: 0, isOverridden: false, workDays: workDaysInRange(from, to), daysAbsent: 0, isAbsentOverridden: false,
      basePay: 0, isBasePayOverridden: false, colaPay: 0, isColaOverridden: false, housingPay: 0, isHousingOverridden: false,
      nsdPay: 0, isNsdOverridden: false, otPay: 0, isOtOverridden: false, holidayPay: 0, isHolidayOverridden: false,
      restDayPay: 0, retroPay: 0,
      gross: 0, isGrossOverridden: false, taxableGross: 0, tax: 0, isTaxOverridden: false,
      manualDed: 0, attendanceDed: 0, lateUndertimeDed: 0, dedTotal: 0, isDedTotalOverridden: false, bonusTotal: 0,
      net: 0, isNetOverridden: false, hasNotStartedYet: true,
    };
  }
  const allRecords = Object.values(dedupeAttendanceByDate(Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id)));
  const presentRecords = allRecords.filter(a => a.status === 'Present' || a.status === 'Late');
  const attendanceDays = presentRecords.length;
  const override = Store.getPayrollOverride(emp.id, from);
  const daysPresent = override && override.daysPresent != null ? Number(override.daysPresent) : attendanceDays;
  const isOverridden = !!(override && override.daysPresent != null);

  const holidays = Store.holidaysInRange(from, to);
  const holidayByDate = {};
  holidays.forEach(h => { holidayByDate[h.date] = h; });

  const workDays = workDaysInRange(from, to);
  const holidayWorkDayCount = holidays.filter(h => new Date(h.date + 'T00:00:00').getDay() !== 0).length;
  const ordinaryWorkDays = Math.max(0, workDays - holidayWorkDayCount);
  // Absence only ever counts a day HR (or the employee's own edit) explicitly marked
  // status === 'Absent' on an actual attendance record -- never inferred just because a
  // day in the cutoff has no record at all (e.g. not yet logged, or genuinely not
  // applicable). A day with nothing entered contributes nothing here.
  const explicitAbsentDays = allRecords.filter(r => r.status === 'Absent').length;
  const isAbsentOverridden = !!(override && override.daysAbsent != null);
  const daysAbsent = isAbsentOverridden ? Number(override.daysAbsent) : explicitAbsentDays;

  let basePay = emp.payType === 'Daily' ? emp.rate * daysPresent : emp.rate;
  const isBasePayOverridden = !!(override && override.basePay != null);
  if (isBasePayOverridden) basePay = Number(override.basePay);

  const dailyRateEq = emp.payType === 'Daily' ? emp.rate : (workDays > 0 ? emp.rate / workDays : 0);

  // COLA and Housing Allowance are fixed per cutoff for every employee -- paid in full
  // regardless of attendance, not prorated by days present/absent. (allowancePerDay is
  // still "per day" only in the sense of how the rate is entered/priced; the amount owed
  // each cutoff is the same every time, based on the cutoff's standard work days, not
  // actual attendance.)
  let colaPay = (emp.allowancePerDay || 0) * ordinaryWorkDays + (emp.fixedAllowance || 0);
  const isColaOverridden = !!(override && override.cola != null);
  if (isColaOverridden) colaPay = Number(override.cola);

  let housingPay = emp.housingAllowance || 0;
  const isHousingOverridden = !!(override && override.housing != null);
  if (isHousingOverridden) housingPay = Number(override.housing);

  let otPay = 0, nsdPay = 0, restDayPay = 0;
  presentRecords.forEach(r => {
    const day = computeDayPay(dailyRateEq, r, holidayByDate[r.date], emp);
    otPay += day.otPay;
    nsdPay += day.nsdPay;
    restDayPay += day.restDayPay;
  });
  const isNsdOverridden = !!(override && override.nsd != null);
  if (isNsdOverridden) nsdPay = Number(override.nsd);
  const isOtOverridden = !!(override && override.ot != null);
  if (isOtOverridden) otPay = Number(override.ot);

  let holidayPay = 0;
  holidays.forEach(h => {
    const rec = presentRecords.find(r => r.date === h.date);
    holidayPay += computeDayPay(dailyRateEq, rec, h, emp).holidayPay;
  });
  const isHolidayOverridden = !!(override && override.holiday != null);
  if (isHolidayOverridden) holidayPay = Number(override.holiday);

  // Retroactive/previous pay -- back pay owed from a prior period (a delayed raise, a
  // correction, etc.). Purely manual, no computed baseline to override -- defaults to 0
  // until HR enters it directly on the Payroll tab. Real wages, so it's taxed like base
  // pay (folded into gross below), unlike a bonus which is added after tax.
  const retroPay = override && override.retroPay != null ? Number(override.retroPay) : 0;

  // Attendance-based deductions (late arrival, undertime/early leave, and absence
  // claw-back for non-Daily pay types) have been removed by explicit company decision --
  // employees are no longer docked pay for these. Both fields are kept at 0 (rather than
  // removed outright) since js/views/payroll.js still reads them for its summary totals.
  const lateUndertimeDed = 0;

  let gross = basePay + colaPay + housingPay + nsdPay + otPay + holidayPay + restDayPay + retroPay;
  const isGrossOverridden = !!(override && override.gross != null);
  if (isGrossOverridden) gross = Number(override.gross);

  const manualDed = Store.deductionsInRange(from, to).filter(d => d.employeeId === emp.id).reduce((s, d) => s + Number(d.amount), 0);
  const attendanceDed = 0;
  let dedTotal = manualDed + attendanceDed + lateUndertimeDed;
  const isDedTotalOverridden = !!(override && override.dedTotal != null);
  if (isDedTotalOverridden) dedTotal = Number(override.dedTotal);

  // Bonuses (13th month, performance, incentives, etc.) -- logged per employee per date,
  // matched against the cutoff the same way deductions are. Added after tax, same as
  // deductions are subtracted after tax, rather than folded into the taxable gross.
  const bonusTotal = Store.bonusesInRange(from, to).filter(b => b.employeeId === emp.id).reduce((s, b) => s + Number(b.amount), 0);

  // Withholding tax is computed only on Daily Wage/Base Pay, OT, NSD, and Holiday Pay --
  // COLA, housing allowance, and retro pay are still part of gross/net pay but are
  // deliberately excluded from the taxable base (company policy, not a BIR requirement).
  const taxableGross = basePay + otPay + nsdPay + holidayPay + restDayPay;
  let tax = withholdingTax(Math.max(0, taxableGross - attendanceDed));
  const isTaxOverridden = !!(override && override.tax != null);
  if (isTaxOverridden) tax = Number(override.tax);

  let net = gross - tax - dedTotal + bonusTotal;
  const isNetOverridden = !!(override && override.net != null);
  if (isNetOverridden) net = Number(override.net);

  return {
    emp, daysPresent, isOverridden, workDays, daysAbsent, isAbsentOverridden, basePay, isBasePayOverridden,
    colaPay, isColaOverridden, housingPay, isHousingOverridden, nsdPay, isNsdOverridden,
    otPay, isOtOverridden, holidayPay, isHolidayOverridden, restDayPay, retroPay,
    gross, isGrossOverridden, taxableGross, tax, isTaxOverridden, manualDed, attendanceDed, lateUndertimeDed,
    dedTotal, isDedTotalOverridden, bonusTotal, net, isNetOverridden,
  };
}

const Store = (function () {
  const TABLES = {
    employees: 'employees',
    candidates: 'candidates',
    disciplinaryCases: 'disciplinaryCases',
    complaints: 'complaints',
    attendance: 'attendance',
    deductions: 'deductions',
    bonuses: 'bonuses',
    probationRecords: 'probationRecords',
    payrollOverrides: 'payrollOverrides',
    holidays: 'holidays',
    payCutoffSettings: 'payCutoffSettings',
    leaveRequests: 'leaveRequests',
    attendanceCorrections: 'attendanceCorrections',
    scheduleChangeRequests: 'scheduleChangeRequests',
    paymentVouchers: 'paymentVouchers',
    auditLog: 'auditLog',
    notifications: 'notifications',
    payrollReleases: 'payrollReleases',
    appSettings: 'appSettings',
    expenses: 'expenses',
    bills: 'bills',
    officeFiles: 'officeFiles',
    employmentHistory: 'employmentHistory',
    employeeDocuments: 'employeeDocuments',
    pushSubscriptions: 'pushSubscriptions',
    employeePushSubscriptions: 'employeePushSubscriptions',
    materialRequests: 'materialRequests',
    thirteenthMonthPay: 'thirteenthMonthPay',
    leaveTypePolicies: 'leaveTypePolicies',
    offboarding: 'offboarding',
    sssContributionBrackets: 'sssContributionBrackets',
    contributionRates: 'contributionRates',
    regionalMinimumWage: 'regionalMinimumWage',
    safetyIncidents: 'safetyIncidents',
    employeeRelationsCases: 'employeeRelationsCases',
    adminCodiMembers: 'adminCodiMembers',
    announcements: 'announcements',
    disciplineOffenses: 'disciplineOffenses',
  };

  const state = {
    employees: [], candidates: [], disciplinaryCases: [], complaints: [],
    attendance: [], deductions: [], bonuses: [], probationRecords: [], payrollOverrides: [], holidays: [],
    payCutoffSettings: [],
    leaveRequests: [], attendanceCorrections: [], scheduleChangeRequests: [], paymentVouchers: [], auditLog: [],
    notifications: [], payrollReleases: [], appSettings: [],
    expenses: [], bills: [], officeFiles: [],
    employmentHistory: [], employeeDocuments: [],
    pushSubscriptions: [], employeePushSubscriptions: [],
    materialRequests: [],
    thirteenthMonthPay: [], leaveTypePolicies: [], offboarding: [],
    sssContributionBrackets: [], contributionRates: [], regionalMinimumWage: [],
    safetyIncidents: [], employeeRelationsCases: [], adminCodiMembers: [],
    announcements: [], disciplineOffenses: [],
  };

  let remoteChangeCallback = null;
  function onRemoteChange(cb) { remoteChangeCallback = cb; }
  function notifyRemoteChange() { if (remoteChangeCallback) remoteChangeCallback(); }

  function sanitize(obj) {
    const out = {};
    Object.keys(obj).forEach(k => { out[k] = obj[k] === '' ? null : obj[k]; });
    return out;
  }

  async function refetch(key) {
    const { data, error } = await sb.from(TABLES[key]).select('*');
    if (error) {
      console.error('Failed to load ' + key, error);
      toast('Failed to load ' + key + ': ' + error.message);
      return;
    }
    state[key] = data || [];
  }

  async function init() {
    await Promise.all(Object.keys(TABLES).map(refetch));
    Object.keys(TABLES).forEach(key => {
      sb.channel('public:' + TABLES[key])
        .on('postgres_changes', { event: '*', schema: 'public', table: TABLES[key] }, async () => {
          await refetch(key);
          notifyRemoteChange();
        })
        .subscribe();
    });
  }

  async function mutate(promise, errMsgPrefix) {
    const { error } = await promise;
    if (error) {
      toast((errMsgPrefix || 'Save failed') + ': ' + error.message);
      throw error;
    }
  }

  // Best-effort audit trail: one row per mutation (employees, payroll overrides,
  // disciplinary actions, etc.), independent of the main operation — a logging failure
  // never blocks or fails the actual save. Not used for auditLog itself (would recurse).
  async function logAudit(action, table, id, details) {
    if (table === TABLES.auditLog) return;
    try {
      const { data } = await sb.auth.getUser();
      await sb.from(TABLES.auditLog).insert({
        id: genId('log'),
        actorEmail: data && data.user ? data.user.email : null,
        action, targetTable: table, targetId: id || null,
        details: details || {},
      });
    } catch (e) { /* audit logging is best-effort */ }
  }

  async function insertRow(key, row) {
    await mutate(sb.from(TABLES[key]).insert(sanitize(row)), 'Save failed');
    await refetch(key);
    logAudit(key + '.insert', TABLES[key], row.id, row);
    return row;
  }
  async function updateRow(key, id, patch) {
    await mutate(sb.from(TABLES[key]).update(sanitize(patch)).eq('id', id), 'Save failed');
    await refetch(key);
    logAudit(key + '.update', TABLES[key], id, patch);
  }
  async function deleteRow(key, id) {
    await mutate(sb.from(TABLES[key]).delete().eq('id', id), 'Delete failed');
    await refetch(key);
    logAudit(key + '.delete', TABLES[key], id, null);
  }

  // ---- Employees ----
  function listEmployees() { return state.employees.slice(); }
  function getEmployee(id) { return state.employees.find(e => e.id === id); }
  async function addEmployee(emp) {
    emp.id = genId('e');
    return insertRow('employees', emp);
  }
  async function updateEmployee(id, patch) {
    await updateRow('employees', id, patch);
    return getEmployee(id);
  }
  async function deleteEmployee(id) {
    await deleteRow('employees', id);
  }

  // ---- Recruitment ----
  function listCandidates() { return state.candidates.slice(); }
  function getCandidate(id) { return state.candidates.find(c => c.id === id); }
  async function addCandidate(cand) {
    cand.id = genId('c');
    cand.history = [{ date: todayISO(), stage: cand.stage, note: 'Candidate added to pipeline.' }];
    return insertRow('candidates', cand);
  }
  async function moveCandidateStage(id, newStage, note) {
    const c = getCandidate(id);
    if (!c) return;
    const patch = { stage: newStage };
    if (newStage.includes('Trade Test')) {
      patch.tradeTestStart = todayISO();
      patch.tradeTestEnd = addDays(todayISO(), newStage.startsWith('7') ? 7 : 3);
    }
    patch.history = (c.history || []).concat([{ date: todayISO(), stage: newStage, note: note || ('Moved to ' + newStage + '.') }]);
    await updateRow('candidates', id, patch);
    return getCandidate(id);
  }
  async function decideCandidate(id, decision, note) {
    const c = getCandidate(id);
    if (!c) return;
    const patch = {
      decision, stage: 'Decision',
      history: (c.history || []).concat([{ date: todayISO(), stage: 'Decision', note: note || (decision + ' by Management/HR.') }]),
    };
    await updateRow('candidates', id, patch);
    return getCandidate(id);
  }
  async function deleteCandidate(id) {
    await deleteRow('candidates', id);
  }

  // ---- Disciplinary ----
  function listCases() { return state.disciplinaryCases.slice(); }
  function getCase(id) { return state.disciplinaryCases.find(c => c.id === id); }

  // How many times has this employee already been cited for this exact offense within the
  // trailing 12 months of asOfDate? Implements the Code of Discipline's "violations within
  // a 12-month period" schedules, and its Habitual Delinquency note that a clean record for
  // a full year erases past offenses -- anything issued more than 12 months before asOfDate
  // simply isn't counted, so it naturally rolls off.
  function offenseOccurrenceCount(employeeId, offenseCode, asOfDate) {
    const cutoff = addDays(asOfDate || todayISO(), -365);
    return state.disciplinaryCases.filter(c =>
      c.employeeId === employeeId && c.offenseCode === offenseCode && c.dateIssued >= cutoff && c.dateIssued < (asOfDate || todayISO())
    ).length;
  }

  // ---- Code of Discipline (HR-editable, supabase/schema.sql "disciplineOffenses") ----
  // Flat DB rows regrouped back into the same { category, categoryFil, offenses: [...] }
  // shape DISCIPLINE_OFFENSE_CATALOG always had, so the 3 places that read the catalog
  // (js/views/disciplinary.js, js/ess-views/discipline.js, suggestedPenaltyFor below)
  // never had to change their own grouping/lookup logic -- only where the data comes
  // from. Falls back to the original hardcoded catalog whenever the table is still empty
  // (before the one-time import below has ever been run), so nothing breaks or shows a
  // blank Code of Discipline page in the meantime.
  function disciplineCatalog() {
    if (!state.disciplineOffenses.length) return DISCIPLINE_OFFENSE_CATALOG;
    const rows = state.disciplineOffenses.slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder));
    const byCategory = [];
    const index = {};
    rows.forEach((r) => {
      if (!(r.category in index)) {
        index[r.category] = { category: r.category, categoryFil: r.categoryFil || '', offenses: [] };
        byCategory.push(index[r.category]);
      }
      index[r.category].offenses.push({ code: r.code, label: r.label, labelFil: r.labelFil || '', schedule: r.schedule || [] });
    });
    return byCategory;
  }
  function listDisciplineOffenses() { return state.disciplineOffenses.slice().sort((a, b) => Number(a.sortOrder) - Number(b.sortOrder)); }
  function getDisciplineOffense(id) { return state.disciplineOffenses.find(o => o.id === id); }
  async function addDisciplineOffense(o) {
    o.id = genId('doff');
    return insertRow('disciplineOffenses', o);
  }
  async function updateDisciplineOffense(id, patch) {
    await updateRow('disciplineOffenses', id, patch);
  }
  async function deleteDisciplineOffense(id) {
    await deleteRow('disciplineOffenses', id);
  }
  // One-time: flattens the original hardcoded DISCIPLINE_OFFENSE_CATALOG into rows and
  // bulk-inserts them, preserving category/offense order via sortOrder. Run once from the
  // new admin Code of Discipline editor (only offered there while the table is still
  // empty) -- safe to call again later since it always inserts fresh ids, but doing so
  // would duplicate every offense, so the UI only exposes this while listDisciplineOffenses()
  // is empty.
  async function importDefaultDisciplineCatalog() {
    const rows = [];
    DISCIPLINE_OFFENSE_CATALOG.forEach((cat, catIdx) => {
      cat.offenses.forEach((o, offIdx) => {
        rows.push({
          id: genId('doff'), code: o.code, category: cat.category, categoryFil: cat.categoryFil || '',
          label: o.label, labelFil: o.labelFil || '', schedule: o.schedule || [],
          sortOrder: catIdx * 100 + offIdx,
        });
      });
    });
    const { error } = await sb.from(TABLES.disciplineOffenses).insert(rows.map(sanitize));
    if (error) { toast('Import failed: ' + error.message); throw error; }
    await refetch('disciplineOffenses');
    logAudit('disciplineOffenses.import', TABLES.disciplineOffenses, null, { count: rows.length });
  }

  // Looks up the Code of Discipline's suggested penalty for an employee's NEXT occurrence
  // of a given offense (their past-12-month count + 1), clamped to the offense's last
  // defined tier if they've exceeded the schedule's length. Informational only -- HR still
  // records the actual resolution/penalty manually; this never auto-applies anything.
  function suggestedPenaltyFor(employeeId, offenseCode, asOfDate) {
    let entry = null;
    for (const cat of disciplineCatalog()) {
      const found = cat.offenses.find(o => o.code === offenseCode);
      if (found) { entry = found; break; }
    }
    if (!entry) return null;
    const priorCount = offenseOccurrenceCount(employeeId, offenseCode, asOfDate);
    const occurrence = priorCount + 1;
    const code = entry.schedule[Math.min(occurrence, entry.schedule.length) - 1];
    return { occurrence, code, label: penaltyLabel(code) };
  }
  async function addCase(nte) {
    nte.id = genId('d');
    nte.status = 'Notice Issued';
    nte.history = [{ date: nte.dateIssued, action: 'Notice Issued', note: nte.violation }];
    const row = await insertRow('disciplinaryCases', nte);
    await createNotification({
      employeeId: nte.employeeId,
      type: 'nte_issued',
      message: `You have been issued a Notice to Explain (NTE) regarding: ${nte.violation || 'a workplace matter'}. Please coordinate with HR.`,
      relatedTable: 'disciplinaryCases', relatedId: nte.id,
    });
    return row;
  }
  async function updateCase(id, patch, historyEntry) {
    const c = getCase(id);
    if (!c) return;
    const fullPatch = Object.assign({}, patch);
    if (historyEntry) {
      fullPatch.history = (c.history || []).concat([Object.assign({ date: todayISO() }, historyEntry)]);
    }
    await updateRow('disciplinaryCases', id, fullPatch);
    return getCase(id);
  }
  async function deleteCase(id) {
    await deleteRow('disciplinaryCases', id);
  }

  // ---- Complaints ----
  function listComplaints() { return state.complaints.slice(); }
  function getComplaint(id) { return state.complaints.find(c => c.id === id); }
  async function addComplaint(cp) {
    cp.id = genId('cp');
    return insertRow('complaints', cp);
  }
  async function updateComplaint(id, patch) {
    await updateRow('complaints', id, patch);
    return getComplaint(id);
  }
  async function deleteComplaint(id) {
    await deleteRow('complaints', id);
  }

  // ---- Safety Incidents (OSH, RA 11058) ----
  // Field technicians can self-report from My Portal (RLS lets an employee insert/select
  // their own); HR works the full queue here. Simple Open/Resolved log, same shape as
  // Complaints above -- no separate approval workflow.
  function listSafetyIncidents() { return state.safetyIncidents.slice(); }
  function getSafetyIncident(id) { return state.safetyIncidents.find(s => s.id === id); }
  function safetyIncidentsForEmployee(employeeId) { return state.safetyIncidents.filter(s => s.employeeId === employeeId); }
  async function addSafetyIncident(s) {
    s.id = genId('si');
    s.status = s.status || 'Open';
    return insertRow('safetyIncidents', s);
  }
  async function updateSafetyIncident(id, patch) {
    await updateRow('safetyIncidents', id, patch);
    return getSafetyIncident(id);
  }
  // Marking Resolved notifies the reporting employee (if the incident has one on file --
  // an incident reported about a location/general hazard may have no specific employeeId).
  async function resolveSafetyIncident(id, correctiveAction) {
    const s = getSafetyIncident(id);
    await updateRow('safetyIncidents', id, { status: 'Resolved', correctiveAction: correctiveAction || (s && s.correctiveAction) || '' });
    if (s && s.employeeId) {
      await createNotification({
        employeeId: s.employeeId,
        type: 'safety_incident_resolved',
        message: `Your safety incident report (${fmtDate(s.incidentDate)}) has been marked resolved.`,
        relatedTable: 'safetyIncidents', relatedId: id,
      });
    }
    return getSafetyIncident(id);
  }
  async function deleteSafetyIncident(id) {
    await deleteRow('safetyIncidents', id);
  }

  // ---- Employee Relations Cases (Safe Spaces Act, RA 11313) ----
  // Confidential by design -- RLS restricts admin read/write to accounts flagged
  // "codiMember" (see js/views/staff.js), NOT every admin like every other table in this
  // app. Employees can file their own case and see only their own submission's status,
  // never the respondent's identity or committee notes (enforced server-side).
  function listEmployeeRelationsCases() { return state.employeeRelationsCases.slice(); }
  function getEmployeeRelationsCase(id) { return state.employeeRelationsCases.find(c => c.id === id); }
  function employeeRelationsCasesFiledBy(employeeId) { return state.employeeRelationsCases.filter(c => c.complainantEmployeeId === employeeId); }
  // True only for an admin account HR has explicitly flagged as a Committee on Decorum
  // and Investigation (CODI) member -- gates whether the Employee Relations nav link and
  // page render at all, mirroring the RLS policy so a non-member never even sees an empty
  // page (their query would return zero rows anyway, but this avoids that confusing state).
  // Admin accounts aren't rows in "employees" (see is_admin() in supabase/schema.sql --
  // an admin is precisely an authenticated user who is NOT in employees), so membership
  // lives in its own tiny "adminCodiMembers" table keyed by email instead.
  function currentAdminIsCodiMember(currentUserEmail) {
    if (!currentUserEmail) return false;
    return state.adminCodiMembers.some(m => (m.email || '').toLowerCase() === currentUserEmail.toLowerCase());
  }
  function listAdminCodiMembers() { return state.adminCodiMembers.slice(); }
  async function addAdminCodiMember(email, addedBy) {
    return insertRow('adminCodiMembers', { id: genId('codi'), email: (email || '').toLowerCase(), addedBy: addedBy || null });
  }
  async function removeAdminCodiMember(id) {
    await deleteRow('adminCodiMembers', id);
  }
  async function fileEmployeeRelationsCase(c) {
    c.id = genId('erc');
    c.status = 'Filed';
    return insertRow('employeeRelationsCases', c);
  }
  async function updateEmployeeRelationsCase(id, patch) {
    const c = getEmployeeRelationsCase(id);
    await updateRow('employeeRelationsCases', id, patch);
    if (c && patch.status && patch.status !== c.status) {
      await createNotification({
        employeeId: c.complainantEmployeeId,
        type: 'relations_case_updated',
        message: `Your filed concern (${fmtDate(c.dateFiled)}) status changed to ${patch.status}.`,
        relatedTable: 'employeeRelationsCases', relatedId: id,
      });
    }
    return getEmployeeRelationsCase(id);
  }
  async function deleteEmployeeRelationsCase(id) {
    await deleteRow('employeeRelationsCases', id);
  }

  // ---- Announcements (company-wide bulletin, admin-authored, every employee reads) ----
  function listAnnouncements() {
    return state.announcements.slice().sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || (b.created_at || '').localeCompare(a.created_at || ''));
  }
  function getAnnouncement(id) { return state.announcements.find(a => a.id === id); }
  async function addAnnouncement(a) {
    a.id = genId('ann');
    const row = await insertRow('announcements', a);
    // Company-wide bulletin -- fans out one notification per employee with portal access
    // so it reaches everyone's bell AND push (with sound) the same way an individual
    // approval already does, reusing the exact same pipeline (notify_employee_push,
    // supabase/schema.sql) rather than building a separate broadcast mechanism. Best-
    // effort per employee -- one failure never blocks the rest, or the announcement
    // itself, which has already posted by this point regardless.
    const targets = state.employees.filter(e => e.authUserId);
    await Promise.all(targets.map(e => createNotification({
      employeeId: e.id, type: 'announcement',
      message: a.title + (a.body ? ' — ' + a.body.slice(0, 120) : ''),
      relatedTable: 'announcements', relatedId: a.id,
    }).catch(() => {})));
    return row;
  }
  async function updateAnnouncement(id, patch) {
    await updateRow('announcements', id, patch);
    return getAnnouncement(id);
  }
  async function deleteAnnouncement(id) {
    // Also removes every employee's fanned-out "new announcement" notification for this
    // one (see addAnnouncement's Promise.all fan-out above) -- otherwise a deleted
    // announcement would keep sitting in employees' Notifications list, and its pinned
    // home/login banner would keep showing content HR just deleted. Best-effort: a
    // failure here never blocks the announcement itself from being deleted below.
    try {
      await sb.from(TABLES.notifications).delete().eq('relatedTable', 'announcements').eq('relatedId', id);
      await refetch('notifications');
    } catch (err) { /* best-effort cleanup */ }
    await deleteRow('announcements', id);
  }

  // ---- Attendance ----
  function listAttendance() { return state.attendance.slice(); }
  function attendanceForDate(date) { return state.attendance.filter(a => a.date === date); }
  function attendanceInRange(from, to) { return state.attendance.filter(a => a.date >= from && a.date <= to); }
  async function addAttendance(rec) {
    rec.id = genId('a');
    return insertRow('attendance', rec);
  }
  // NSD/OT/Holiday requests all flow through this one generic update -- there's no
  // separate "review" function for them like leave requests/corrections have -- so the
  // employee notification is created here, centrally, by diffing the actual before/after
  // status rather than needing every call site (the Requests tab, the Edit Attendance
  // modal) to remember to notify.
  const ATTENDANCE_STATUS_LABELS = { nsd: 'Night Shift Differential', ot: 'Overtime', holiday: 'Holiday' };
  async function updateAttendance(id, patch) {
    const before = state.attendance.find(a => a.id === id);
    await updateRow('attendance', id, patch);
    const after = state.attendance.find(a => a.id === id);
    if (before && after) {
      for (const kind of ['nsd', 'ot', 'holiday']) {
        const field = kind + 'Status';
        const newVal = patch[field];
        if ((newVal === 'Approved' || newVal === 'Rejected') && before[field] !== newVal) {
          const remarks = (patch.approvalNotes || after.approvalNotes || '').trim();
          await createNotification({
            employeeId: after.employeeId,
            type: `${kind}_${newVal.toLowerCase()}`,
            message: `Your ${ATTENDANCE_STATUS_LABELS[kind]} pay request for ${fmtDate(after.date)} was ${newVal.toLowerCase()}.${remarks ? ' Remarks: ' + remarks : ''}`,
            relatedTable: 'attendance', relatedId: id,
          });
        }
      }
    }
    return after;
  }
  async function deleteAttendance(id) {
    await deleteRow('attendance', id);
  }

  // Uploads a clock-in/out proof photo to the private "attendance-photos" Storage bucket,
  // under "<employeeId>/<filename>" (matches the RLS policy's foldername check). Returns
  // the storage path (not a URL — the bucket is private, so viewing requires a signed URL
  // fetched on demand via getSignedPhotoUrl).
  async function uploadAttendancePhoto(employeeId, blob, kind) {
    const path = `${employeeId}/${genId(kind)}.jpg`;
    const { error } = await sb.storage.from('attendance-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) {
      toast('Photo upload failed: ' + error.message);
      throw error;
    }
    return path;
  }

  async function getSignedPhotoUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('attendance-photos').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign photo URL', error); return null; }
    return data.signedUrl;
  }

  // Best-effort: used when deleting/redoing a self-clock-in record. Never blocks the
  // attendance row's own delete on failure — an orphaned photo file isn't worth failing over.
  async function deleteAttendancePhoto(path) {
    if (!path) return;
    const { error } = await sb.storage.from('attendance-photos').remove([path]);
    if (error) console.error('Failed to delete attendance photo', error);
  }

  // Same pattern as the attendance photo helpers above, but for the private "bank-qr"
  // bucket (My Portal profile — bank account QR code for payroll disbursement).
  async function uploadBankQr(employeeId, blob) {
    const ext = (blob.type && blob.type.includes('png')) ? 'png' : 'jpg';
    const path = `${employeeId}/${genId('qr')}.${ext}`;
    const { error } = await sb.storage.from('bank-qr').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
    if (error) {
      toast('QR upload failed: ' + error.message);
      throw error;
    }
    return path;
  }

  async function getSignedBankQrUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('bank-qr').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign bank QR URL', error); return null; }
    return data.signedUrl;
  }

  async function deleteBankQrPhoto(path) {
    if (!path) return;
    const { error } = await sb.storage.from('bank-qr').remove([path]);
    if (error) console.error('Failed to delete bank QR photo', error);
  }

  // Same pattern again, for the private "employee-photos" bucket (My Portal profile
  // picture -- also viewable by HR on the Employee Management page).
  async function uploadEmployeePhoto(employeeId, blob) {
    const ext = (blob.type && blob.type.includes('png')) ? 'png' : 'jpg';
    const path = `${employeeId}/${genId('photo')}.${ext}`;
    const { error } = await sb.storage.from('employee-photos').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
    if (error) {
      toast('Photo upload failed: ' + error.message);
      throw error;
    }
    return path;
  }

  async function getSignedEmployeePhotoUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('employee-photos').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign employee photo URL', error); return null; }
    return data.signedUrl;
  }

  async function deleteEmployeePhoto(path) {
    if (!path) return;
    const { error } = await sb.storage.from('employee-photos').remove([path]);
    if (error) console.error('Failed to delete employee photo', error);
  }

  // ---- Probation / Regularization ----
  function listProbations() { return state.probationRecords.slice(); }
  function getProbation(id) { return state.probationRecords.find(p => p.id === id); }
  function getProbationByEmployee(employeeId) { return state.probationRecords.find(p => p.employeeId === employeeId); }
  async function addProbation(rec) {
    rec.id = genId('pr');
    return insertRow('probationRecords', rec);
  }
  async function updateProbation(id, patch) {
    await updateRow('probationRecords', id, patch);
    return getProbation(id);
  }
  async function deleteProbation(id) {
    await deleteRow('probationRecords', id);
  }

  // ---- Employment History (position/salary track record) ----
  function employmentHistoryForEmployee(employeeId) {
    return state.employmentHistory.filter(h => h.employeeId === employeeId).slice().sort((a, b) => (b.effectiveDate || '').localeCompare(a.effectiveDate || ''));
  }
  async function addEmploymentHistory(rec) {
    rec.id = genId('eh');
    return insertRow('employmentHistory', rec);
  }
  async function updateEmploymentHistory(id, patch) {
    await updateRow('employmentHistory', id, patch);
  }
  async function deleteEmploymentHistory(id) {
    await deleteRow('employmentHistory', id);
  }

  // ---- Payroll overrides (editable "days present" per employee per cutoff) ----
  function getPayrollOverride(employeeId, cutoffFrom) {
    return state.payrollOverrides.find(o => o.employeeId === employeeId && o.cutoffFrom === cutoffFrom);
  }
  async function setPayrollOverride(employeeId, cutoffFrom, patch) {
    const existing = getPayrollOverride(employeeId, cutoffFrom);
    if (existing) {
      await updateRow('payrollOverrides', existing.id, patch);
    } else {
      await insertRow('payrollOverrides', Object.assign({ id: genId('po'), employeeId, cutoffFrom }, patch));
    }
  }

  // ---- Deductions ----
  function listDeductions() { return state.deductions.slice(); }
  function deductionsInRange(from, to) { return state.deductions.filter(d => d.date >= from && d.date <= to); }
  async function addDeduction(d) {
    d.id = genId('ded');
    return insertRow('deductions', d);
  }
  async function deleteDeduction(id) {
    await deleteRow('deductions', id);
  }

  // ---- Contribution tables (SSS / PhilHealth / Pag-IBIG) ----
  // HR-editable reference data (supabase/schema.sql seeds placeholder starting figures --
  // verify against the current circulars). Used only to PRE-FILL the amount field when
  // HR adds a matching deduction below -- never silently applied, always overridable.
  function listSssContributionBrackets() { return state.sssContributionBrackets.slice().sort((a, b) => a.minSalary - b.minSalary); }
  // Unlike every other table in this store, "id" here is a Postgres serial (auto-assigned
  // on insert), not a client-generated genId() -- deliberately omitted from the row so the
  // database assigns it, rather than every other table's client-side id convention.
  async function addSssContributionBracket(b) {
    const { error } = await sb.from(TABLES.sssContributionBrackets).insert(sanitize(b));
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('sssContributionBrackets');
    logAudit('sssContributionBrackets.insert', TABLES.sssContributionBrackets, null, b);
  }
  async function updateSssContributionBracket(id, patch) {
    await updateRow('sssContributionBrackets', id, patch);
  }
  async function deleteSssContributionBracket(id) {
    await deleteRow('sssContributionBrackets', id);
  }
  // Monthly-salary-equivalent bracket lookup -- the employee's own share only (not the
  // employer's), since that's the number that actually lands on a payslip deduction line.
  function suggestedSssDeduction(monthlySalary) {
    const s = Number(monthlySalary) || 0;
    const bracket = listSssContributionBrackets().find(b => s >= b.minSalary && (b.maxSalary == null || s <= b.maxSalary));
    return bracket ? Number(bracket.employeeShare) : 0;
  }

  function listContributionRates() { return state.contributionRates.slice(); }
  function getContributionRate(key) { return state.contributionRates.find(r => r.key === key); }
  async function upsertContributionRate(row) {
    const { error } = await sb.from(TABLES.contributionRates).upsert(sanitize(row), { onConflict: 'key' });
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('contributionRates');
    logAudit('contributionRates.update', TABLES.contributionRates, row.key, row);
  }
  function suggestedRateDeduction(key, monthlySalary) {
    const r = getContributionRate(key);
    if (!r) return 0;
    const capped = Math.min(Math.max(Number(monthlySalary) || 0, Number(r.floorSalary) || 0), r.ceilingSalary != null ? Number(r.ceilingSalary) : Infinity);
    const total = capped * (Number(r.ratePercent) || 0) / 100;
    return total * (Number(r.employeeSharePercent) || 0) / 100;
  }
  function suggestedPhilhealthDeduction(monthlySalary) { return suggestedRateDeduction('philhealth', monthlySalary); }
  function suggestedPagibigDeduction(monthlySalary) { return suggestedRateDeduction('pagibig', monthlySalary); }

  // ---- Minimum wage flag (regional Wage Orders) ----
  // HR-editable reference data, same "keep it current" caveat as the contribution tables
  // above -- wage orders vary by region and change periodically.
  function listRegionalMinimumWage() { return state.regionalMinimumWage.slice(); }
  async function upsertRegionalMinimumWage(row) {
    const { error } = await sb.from(TABLES.regionalMinimumWage).upsert(sanitize(row), { onConflict: 'region' });
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('regionalMinimumWage');
    logAudit('regionalMinimumWage.update', TABLES.regionalMinimumWage, row.region, row);
  }
  async function deleteRegionalMinimumWage(region) {
    const { error } = await sb.from(TABLES.regionalMinimumWage).delete().eq('region', region);
    if (error) { toast('Delete failed: ' + error.message); throw error; }
    await refetch('regionalMinimumWage');
  }
  // Compares the employee's daily-rate equivalent against their region's floor -- null
  // (not a warning) when the employee has no region on file, since there's nothing to
  // compare against yet.
  function isBelowMinimumWage(emp) {
    if (!emp || !emp.region) return null;
    const row = state.regionalMinimumWage.find(r => r.region === emp.region);
    if (!row) return null;
    const dailyRateEq = emp.payType === 'Daily' ? Number(emp.rate) : (Number(emp.rate) / 22); // rough monthly->daily fallback, same 22-working-day assumption used elsewhere for monthly-paid staff
    return dailyRateEq < Number(row.dailyRate);
  }

  // ---- Bonuses ----
  function listBonuses() { return state.bonuses.slice(); }
  function bonusesInRange(from, to) { return state.bonuses.filter(b => b.date >= from && b.date <= to); }
  async function addBonus(b) {
    b.id = genId('bon');
    return insertRow('bonuses', b);
  }
  async function deleteBonus(id) {
    await deleteRow('bonuses', id);
  }

  // ---- Holidays (reference calendar for holiday pay) ----
  function listHolidays() { return state.holidays.slice(); }
  function getHoliday(id) { return state.holidays.find(h => h.id === id); }
  function holidaysInRange(from, to) { return state.holidays.filter(h => h.date >= from && h.date <= to); }
  async function addHoliday(h) {
    h.id = genId('hol');
    return insertRow('holidays', h);
  }
  async function updateHoliday(id, patch) {
    await updateRow('holidays', id, patch);
    return getHoliday(id);
  }
  async function deleteHoliday(id) {
    await deleteRow('holidays', id);
  }

  // ---- Pay cutoff settings (editable cutoff-day boundaries per pay group) ----
  // Keyed by payCycle rather than a generated id, so this uses its own upsert instead of
  // the generic insertRow/updateRow helpers (which assume an "id" primary key column).
  function listPayCutoffSettings() { return state.payCutoffSettings.slice(); }
  function getPayCutoffSetting(payCycle) { return state.payCutoffSettings.find(s => s.payCycle === payCycle); }
  async function updatePayCutoffSetting(payCycle, patch) {
    const row = Object.assign({ payCycle }, patch);
    const { error } = await sb.from(TABLES.payCutoffSettings).upsert(sanitize(row), { onConflict: 'payCycle' });
    if (error) {
      toast('Save failed: ' + error.message);
      throw error;
    }
    await refetch('payCutoffSettings');
    logAudit('payCutoffSettings.update', TABLES.payCutoffSettings, payCycle, patch);
  }

  // ---- Leave Requests (Employee Self-Service) ----
  function listLeaveRequests() { return state.leaveRequests.slice(); }
  function getLeaveRequest(id) { return state.leaveRequests.find(r => r.id === id); }
  function leaveRequestsForEmployee(employeeId) { return state.leaveRequests.filter(r => r.employeeId === employeeId); }
  // Counts Pending + Approved SIL days for one employee within one calendar year (matched
  // by the request's start date), toward the 5-day yearly cap -- Pending counts too, not
  // just Approved, so someone can't stack multiple pending requests past the cap before
  // any of them are decided. excludeId skips a request being edited so re-saving it
  // doesn't double-count against itself.
  function silDaysUsed(employeeId, year, excludeId) {
    return state.leaveRequests
      .filter(r => r.employeeId === employeeId && r.leaveType === 'SIL' && r.id !== excludeId
        && (r.status === 'Approved' || r.status === 'Pending') && (r.startDate || '').slice(0, 4) === String(year))
      .reduce((sum, r) => sum + dateRangeDays(r.startDate, r.endDate), 0);
  }

  // ---- Statutory leave policies + generalized balances ----
  // Generalizes the SIL-only pattern above (silEligibleAsOf/silDaysUsed) to every leave
  // type via the HR-editable "leaveTypePolicies" table -- leaveRequests.leaveType stays a
  // free-text column, now driven by this list instead of a hardcoded dropdown array.
  // silDaysUsed/silEligibleAsOf/silEligibleFrom/silDaysInRange above are left untouched
  // (still used by the printable DTR and elsewhere) rather than refactored in place.
  function listLeaveTypePolicies() { return state.leaveTypePolicies.slice(); }
  function getLeaveTypePolicy(leaveType) { return state.leaveTypePolicies.find(p => p.leaveType === leaveType); }
  async function updateLeaveTypePolicy(leaveType, patch) {
    const { error } = await sb.from(TABLES.leaveTypePolicies).upsert(sanitize(Object.assign({ leaveType }, patch)), { onConflict: 'leaveType' });
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('leaveTypePolicies');
    logAudit('leaveTypePolicies.update', TABLES.leaveTypePolicies, leaveType, patch);
  }
  // Same yearly-cap counting rule as silDaysUsed, generalized to any leave type; for a
  // perOccurrence type (Maternity/Paternity/VAWC) "year" is ignored and it instead counts
  // days used against the SAME pregnancy/incident window isn't tracked automatically --
  // HR reviews those case by case, this still returns a same-calendar-year total as a
  // reference number on the request form, not a hard cap.
  function leaveDaysUsed(employeeId, leaveType, year, excludeId) {
    return state.leaveRequests
      .filter(r => r.employeeId === employeeId && r.leaveType === leaveType && r.id !== excludeId
        && (r.status === 'Approved' || r.status === 'Pending') && (r.startDate || '').slice(0, 4) === String(year))
      .reduce((sum, r) => sum + dateRangeDays(r.startDate, r.endDate), 0);
  }
  // Soft eligibility check -- returns { eligible, reason } where reason explains a "no"
  // (not yet 1 year of service, wrong gender restriction, missing Solo Parent status).
  // Deliberately advisory: the request form shows this as a warning, not a hard block --
  // HR makes the final call on approval (VAWC in particular needs documentation this
  // system can't verify).
  function leaveEligibility(emp, leaveType, asOfDate) {
    const policy = getLeaveTypePolicy(leaveType);
    if (!policy) return { eligible: true, reason: '' };
    if (policy.minServiceMonths > 0) {
      if (!emp || !emp.dateHired) return { eligible: false, reason: 'Date hired is not on file yet.' };
      if (addMonths(emp.dateHired, policy.minServiceMonths) > (asOfDate || todayISO())) {
        return { eligible: false, reason: `Not yet eligible -- requires ${policy.minServiceMonths} month(s) of service.` };
      }
    }
    if (policy.genderRestriction && emp && emp.sex && emp.sex !== policy.genderRestriction) {
      return { eligible: false, reason: `${leaveType} Leave is restricted to ${policy.genderRestriction} employees.` };
    }
    if (policy.requiresSoloParentStatus && (!emp || !emp.soloParentStatus)) {
      return { eligible: false, reason: 'Requires Solo Parent status on file -- HR verifies against a Solo Parent ID.' };
    }
    return { eligible: true, reason: '' };
  }
  function leaveBalance(emp, leaveType, year, excludeId) {
    const policy = getLeaveTypePolicy(leaveType);
    const entitled = policy ? Number(policy.daysPerYear) : 0;
    const used = emp ? leaveDaysUsed(emp.id, leaveType, year || new Date().getFullYear(), excludeId) : 0;
    return { entitled, used, remaining: Math.max(0, entitled - used) };
  }
  async function addLeaveRequest(r) {
    r.id = genId('lr');
    r.status = 'Pending';
    return insertRow('leaveRequests', r);
  }
  async function reviewLeaveRequest(id, status, reviewedBy, reviewNotes) {
    const r = getLeaveRequest(id);
    await updateRow('leaveRequests', id, { status, reviewedBy, reviewedDate: todayISO(), reviewNotes: reviewNotes || '' });
    if (r && (status === 'Approved' || status === 'Disapproved')) {
      const notes = (reviewNotes || '').trim();
      await createNotification({
        employeeId: r.employeeId,
        // Internal notification type key stays 'leave_rejected' (icon lookup only, never
        // shown to the user) even though the status/message wording is now "Disapproved".
        type: status === 'Approved' ? 'leave_approved' : 'leave_rejected',
        message: `Your ${r.leaveType} leave request (${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}) was ${status.toLowerCase()}.${notes ? ' Remarks: ' + notes : ''}`,
        relatedTable: 'leaveRequests', relatedId: id,
      });
    }
    return getLeaveRequest(id);
  }
  // Lets HR add or update notes on a request independent of an Approve/Disapprove decision
  // -- e.g. jotting context on a still-Pending request, or amending a note afterward --
  // without touching status/reviewedBy/reviewedDate.
  async function updateLeaveRequestNotes(id, notes) {
    await updateRow('leaveRequests', id, { reviewNotes: notes || '' });
    return getLeaveRequest(id);
  }
  // Employee edits their own request (type/dates/reason) -- any status, anytime. The
  // trigger-enforced RLS policy resets status back to Pending and clears the prior review
  // server-side, since HR's decision was for the old content; this just sends the new
  // content and lets that happen.
  async function updateLeaveRequest(id, patch) {
    await updateRow('leaveRequests', id, patch);
    return getLeaveRequest(id);
  }
  async function deleteLeaveRequest(id) {
    await deleteRow('leaveRequests', id);
  }

  // ---- Attendance Corrections (Employee Self-Service) ----
  function listAttendanceCorrections() { return state.attendanceCorrections.slice(); }
  function getAttendanceCorrection(id) { return state.attendanceCorrections.find(c => c.id === id); }
  function attendanceCorrectionsForEmployee(employeeId) { return state.attendanceCorrections.filter(c => c.employeeId === employeeId); }
  async function addAttendanceCorrection(c) {
    c.id = genId('ac');
    c.status = 'Pending';
    return insertRow('attendanceCorrections', c);
  }
  async function reviewAttendanceCorrection(id, status, reviewedBy, reviewNotes) {
    const c = getAttendanceCorrection(id);
    await updateRow('attendanceCorrections', id, { status, reviewedBy, reviewedDate: todayISO(), reviewNotes: reviewNotes || '' });
    if (c && (status === 'Approved' || status === 'Rejected')) {
      const notes = (reviewNotes || '').trim();
      await createNotification({
        employeeId: c.employeeId,
        type: status === 'Approved' ? 'correction_approved' : 'correction_rejected',
        message: `Your attendance concern for ${fmtDate(c.date)} was ${status.toLowerCase()}.${notes ? ' Remarks: ' + notes : ''}`,
        relatedTable: 'attendanceCorrections', relatedId: id,
      });
    }
    return getAttendanceCorrection(id);
  }
  // Lets HR add or update notes on a correction independent of an Approve/Reject decision,
  // same pattern as Store.updateLeaveRequestNotes.
  async function updateAttendanceCorrectionNotes(id, notes) {
    await updateRow('attendanceCorrections', id, { reviewNotes: notes || '' });
    return getAttendanceCorrection(id);
  }
  async function deleteAttendanceCorrection(id) {
    await deleteRow('attendanceCorrections', id);
  }

  // ---- Schedule Change Requests (Employee Self-Service) ----
  // An employee requests a new Default Time In/Out from My Portal; HR reviews it here.
  function listScheduleChangeRequests() { return state.scheduleChangeRequests.slice(); }
  function getScheduleChangeRequest(id) { return state.scheduleChangeRequests.find(r => r.id === id); }
  function scheduleChangeRequestsForEmployee(employeeId) { return state.scheduleChangeRequests.filter(r => r.employeeId === employeeId); }
  async function addScheduleChangeRequest(r) {
    r.id = genId('scr');
    r.status = 'Pending';
    return insertRow('scheduleChangeRequests', r);
  }
  // Unlike reviewAttendanceCorrection, Approved here DOES apply the change directly --
  // the request already carries the exact new Default Time In/Out, so there's nothing left
  // for HR to separately go enter (see the Set Hours quick action on Employee Management).
  async function reviewScheduleChangeRequest(id, status, reviewedBy, reviewNotes) {
    const r = getScheduleChangeRequest(id);
    await updateRow('scheduleChangeRequests', id, { status, reviewedBy, reviewedDate: todayISO(), reviewNotes: reviewNotes || '' });
    if (r && status === 'Approved') {
      await updateEmployee(r.employeeId, { defaultTimeIn: r.requestedTimeIn || null, defaultTimeOut: r.requestedTimeOut || null });
    }
    if (r && (status === 'Approved' || status === 'Rejected')) {
      const notes = (reviewNotes || '').trim();
      const timeRange = `${to12Hour(r.requestedTimeIn)} – ${to12Hour(r.requestedTimeOut)}`;
      await createNotification({
        employeeId: r.employeeId,
        type: status === 'Approved' ? 'schedule_change_approved' : 'schedule_change_rejected',
        message: `Your schedule change request (${timeRange}) was ${status.toLowerCase()}.${notes ? ' Remarks: ' + notes : ''}`,
        relatedTable: 'scheduleChangeRequests', relatedId: id,
      });
    }
    return getScheduleChangeRequest(id);
  }
  async function updateScheduleChangeRequestNotes(id, notes) {
    await updateRow('scheduleChangeRequests', id, { reviewNotes: notes || '' });
    return getScheduleChangeRequest(id);
  }
  async function deleteScheduleChangeRequest(id) {
    await deleteRow('scheduleChangeRequests', id);
  }

  // ---- Audit Log (read-only in the app; populated automatically by insertRow/updateRow/deleteRow) ----
  function listAuditLog() { return state.auditLog.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); }

  // Deletes any auditLog row older than the configured retention window (default 7 days
  // if HR has never set one) -- called opportunistically whenever an admin opens the
  // Audit Log view. There's no server-side cron in this app, so "after 7/30 days" is
  // enforced the next time someone actually looks, not on a strict schedule.
  async function purgeOldAuditLog() {
    const days = Number(getAppSetting('auditLogRetentionDays', 7));
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const stale = state.auditLog.filter(a => (a.created_at || '') < cutoff);
    if (!stale.length) return 0;
    const { error } = await sb.from(TABLES.auditLog).delete().lt('created_at', cutoff);
    if (error) { console.error('Failed to purge old audit log entries', error); return 0; }
    await refetch('auditLog');
    return stale.length;
  }

  // ---- Notifications (Employee Self-Service) ----
  // Created automatically by the review functions above and releasePayroll below -- never
  // called directly by any view. Employees can only read their own and mark their own read
  // (enforced by enforce_notification_update).
  async function createNotification({ employeeId, type, message, relatedTable, relatedId }) {
    const row = { id: genId('note'), employeeId, type, message, relatedTable: relatedTable || null, relatedId: relatedId || null };
    return insertRow('notifications', row);
  }
  function listNotificationsForEmployee(employeeId) {
    return state.notifications.filter(n => n.employeeId === employeeId).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
  function unreadNotificationCount(employeeId) {
    return state.notifications.filter(n => n.employeeId === employeeId && !n.readAt).length;
  }
  async function markNotificationRead(id) {
    await updateRow('notifications', id, { readAt: new Date().toISOString() });
  }
  async function markAllNotificationsRead(employeeId) {
    const unread = state.notifications.filter(n => n.employeeId === employeeId && !n.readAt);
    await Promise.all(unread.map(n => markNotificationRead(n.id)));
  }
  async function deleteNotification(id) {
    await deleteRow('notifications', id);
  }

  // ---- Payroll Releases (marks a pay-group cutoff as actually paid) ----
  function getPayrollRelease(payCycle, cutoffFrom) {
    return state.payrollReleases.find(r => r.payCycle === payCycle && r.cutoffFrom === cutoffFrom);
  }
  // Marks the cutoff released and notifies every employee currently on that pay group --
  // not scoped to who was present that cutoff, since payroll release is a per-schedule
  // event, not per-employee.
  async function releasePayroll(payCycle, cutoffFrom, cutoffTo, payDate, releasedBy) {
    const row = { id: genId('prel'), payCycle, cutoffFrom, cutoffTo, payDate, releasedBy: releasedBy || null };
    await insertRow('payrollReleases', row);
    const employees = state.employees.filter(e => e.payCycle === payCycle && e.status !== 'Terminated');
    await Promise.all(employees.map(e => createNotification({
      employeeId: e.id,
      type: 'payroll_released',
      message: `Your payroll for ${fmtDate(cutoffFrom)} – ${fmtDate(cutoffTo)} has been released, paid ${fmtDate(payDate)}.`,
      relatedTable: 'payrollReleases', relatedId: row.id,
    })));
    return row;
  }
  // Reverts a release back to "not released" (e.g. released by mistake, or a correction
  // needs to go out before payday) -- doesn't retract the notification already sent, since
  // that already reached staff; just clears the record so the cutoff can be re-released
  // (sending a fresh notification) once it's actually ready.
  async function unreleasePayroll(id) {
    await deleteRow('payrollReleases', id);
  }
  // Corrects the displayed release date/by-line without touching the release record's
  // identity (id, cutoff) -- for backfilling a release logged after the fact, or fixing a
  // typo, without unreleasing and losing the notification-already-sent history.
  async function updatePayrollRelease(id, patch) {
    await updateRow('payrollReleases', id, patch);
  }

  // ---- App Settings (small generic key/value store, admin-only) ----
  function getAppSetting(key, fallback) {
    const row = state.appSettings.find(s => s.key === key);
    return row ? row.value : fallback;
  }
  async function setAppSetting(key, value) {
    // Deliberately skips sanitize() -- that helper treats an empty string as "clear to
    // null" for regular data-table rows, but an app setting's value column is NOT NULL
    // and an empty string is itself a meaningful, storable value here (e.g. "Disconnect"
    // on the Google Sheets Backup card saves '' to represent "no webhook configured").
    // Routing this through sanitize() turned every empty-value save into a null, which
    // Postgres rejected outright -- silently breaking Disconnect and any setting saved
    // blank, with no visible error beyond a console exception.
    const { error } = await sb.from(TABLES.appSettings).upsert({ key, value }, { onConflict: 'key' });
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('appSettings');
    logAudit('appSettings.update', TABLES.appSettings, key, { value });
  }

  // ---- Real-time Google Sheets backup for Expenses (best-effort, admin-configured) ----
  // Every expense add/update/delete also POSTs to a Google Apps Script Web App the admin
  // deploys and pastes the URL for (see the "Google Sheets Backup" card on the Expenses
  // tab) -- a live mirror of the office's expense register spreadsheet. Exactly like
  // logAudit() below, this never blocks or fails the real save: if the webhook is unset,
  // unreachable, or errors, the expense itself is still saved to Supabase either way --
  // Supabase remains the actual source of truth, the sheet is just a live copy.
  async function syncExpenseToSheetsBackup(action, expense) {
    const url = getAppSetting('expenseSheetWebhookUrl', '');
    if (!url) return;
    try {
      // text/plain (not application/json) keeps this a CORS "simple request" -- Apps
      // Script Web Apps don't handle a preflight OPTIONS request, so a real JSON
      // content-type would fail outright. e.postData.contents on the Apps Script side
      // still parses fine as JSON regardless of the header.
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          secret: getAppSetting('expenseSheetWebhookSecret', ''),
          action, id: expense.id, entity: expense.entity,
          date: expense.date, invoiceNumber: expense.invoiceNumber, vendor: expense.vendor,
          tinNumber: expense.tinNumber, location: expense.location, category: expense.category,
          amount: expense.amount,
        }),
      });
      // fetch() only rejects on a network/CORS failure -- a reachable Apps Script that
      // rejects the request (bad secret, script error) still resolves here with a 200 and
      // a non-'OK' body. Surface that in the console instead of pretending it worked, since
      // this sync has no other feedback path (by design -- it must never block the real
      // Supabase save, which stays the source of truth either way).
      const text = await res.text();
      if (text.trim() !== 'OK') {
        console.warn('Google Sheets backup did not confirm the write (check the webhook URL/secret in Office & Finance -> Expenses -> Google Sheets Backup):', text);
      }
    } catch (e) {
      console.warn('Google Sheets backup request failed (Supabase save is unaffected):', e);
    }
  }

  // ---- Expenses & Receipts (Admin/Finance, admin-only; expense-encoder employees are
  // narrower -- see supabase/schema.sql "expense encoders manage own expenses") ----
  function listExpenses() { return state.expenses.slice(); }
  function getExpense(id) { return state.expenses.find(e => e.id === id); }
  function expensesInRange(from, to) { return state.expenses.filter(e => e.date >= from && e.date <= to); }
  // Forces a fresh SELECT of just this table, reusing the same private refetch() the
  // realtime subscription already calls on its own -- for the Admin Portal's visible
  // "Refresh" control (js/ess-views/expenses.js), which unlike the main dashboard/My
  // Portal doesn't otherwise re-render on remote changes at all.
  async function refetchExpenses() { await refetch('expenses'); }
  async function addExpense(e) {
    e.id = genId('exp');
    const row = await insertRow('expenses', e);
    syncExpenseToSheetsBackup('insert', e);
    return row;
  }
  async function updateExpense(id, patch) {
    await updateRow('expenses', id, patch);
    const row = getExpense(id);
    if (row) syncExpenseToSheetsBackup('update', row);
    return row;
  }
  async function deleteExpense(id) {
    const row = getExpense(id);
    await deleteRow('expenses', id);
    if (row) syncExpenseToSheetsBackup('delete', row);
  }
  // Uploads a receipt photo/scan to the private "receipts" bucket -- manual upload only,
  // since a browser can't drive a physical scanner directly.
  async function uploadReceiptPhoto(blob, filename) {
    const ext = (filename && filename.split('.').pop()) || 'jpg';
    const path = `${genId('receipt')}.${ext}`;
    const { error } = await sb.storage.from('receipts').upload(path, blob, { contentType: blob.type || 'application/octet-stream' });
    if (error) { toast('Receipt upload failed: ' + error.message); throw error; }
    return path;
  }
  async function getSignedReceiptUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('receipts').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign receipt URL', error); return null; }
    return data.signedUrl;
  }
  async function deleteReceiptPhoto(path) {
    if (!path) return;
    const { error } = await sb.storage.from('receipts').remove([path]);
    if (error) console.error('Failed to delete receipt photo', error);
  }

  // ---- Bill Reminders (Admin/Finance, admin-only) ----
  function listBills() { return state.bills.slice(); }
  function getBill(id) { return state.bills.find(b => b.id === id); }
  async function addBill(b) {
    b.id = genId('bill');
    return insertRow('bills', b);
  }
  async function updateBill(id, patch) {
    await updateRow('bills', id, patch);
    return getBill(id);
  }
  async function deleteBill(id) {
    await deleteRow('bills', id);
  }
  // Marks a bill Paid and, if it recurs, immediately creates the next occurrence (due date
  // shifted a month/year forward) so the reminder list always shows the next upcoming
  // instance without HR re-entering it every cycle.
  async function payBill(id) {
    const b = getBill(id);
    if (!b) return;
    await updateRow('bills', id, { status: 'Paid', paidDate: todayISO() });
    if (b.recurrence === 'Monthly' || b.recurrence === 'Yearly') {
      const d = new Date(b.dueDate + 'T00:00:00');
      if (b.recurrence === 'Monthly') d.setMonth(d.getMonth() + 1);
      else d.setFullYear(d.getFullYear() + 1);
      const nextDueDate = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
      await addBill({
        name: b.name, category: b.category, amount: b.amount,
        dueDate: nextDueDate, recurrence: b.recurrence, notes: b.notes || '',
      });
    }
  }

  // ---- Payment Vouchers (Office & Finance, admin-only) ----
  function listPaymentVouchers() { return state.paymentVouchers.slice(); }
  function getPaymentVoucher(id) { return state.paymentVouchers.find(v => v.id === id); }
  function paymentVouchersInRange(from, to) { return state.paymentVouchers.filter(v => v.date >= from && v.date <= to); }
  // Ref No matches the company's paper form: <year>-B<3-digit sequence within that year>,
  // e.g. "2026-B075" -- sequential per year based on how many vouchers already carry that
  // year's prefix, not meant to survive deletions leaving gaps (same tradeoff any simple
  // sequential paper form numbering has). Year comes from the voucher's own date, not
  // "today", so a voucher dated for a different year numbers correctly either way.
  function nextVoucherRefNo(dateStr) {
    const year = (dateStr || todayISO()).slice(0, 4);
    const countThisYear = state.paymentVouchers.filter(v => (v.refNo || '').startsWith(year + '-B')).length;
    return year + '-B' + String(countThisYear + 1).padStart(3, '0');
  }
  async function addPaymentVoucher(v) {
    v.id = genId('pv');
    v.refNo = nextVoucherRefNo(v.date);
    return insertRow('paymentVouchers', v);
  }
  async function updatePaymentVoucher(id, patch) {
    await updateRow('paymentVouchers', id, patch);
    return getPaymentVoucher(id);
  }
  async function deletePaymentVoucher(id) {
    await deleteRow('paymentVouchers', id);
  }

  // ---- 13th Month Pay (PD 851) ----
  // Statutory: total basic salary actually earned within the calendar year, divided by
  // 12. Pure computation over the same computeRow(emp, from, to).basePay used everywhere
  // else, summed across every payroll cutoff of the year via the existing payCutoffs()
  // generator (js/store.js, used by the Payroll tab's period picker) -- not a new cutoff
  // system. A cutoff is only counted toward a year if its own "to" date falls in that
  // year, so this is inherently prorated for a partial year (e.g. a new hire, or someone
  // separating mid-year) without any extra scaling logic.
  function compute13thMonthPay(emp, year) {
    let basicSalaryEarned = 0;
    for (let m = 1; m <= 12; m++) {
      payCutoffs(emp.payCycle, year, m).forEach(c => {
        if (c.to.slice(0, 4) === String(year)) {
          basicSalaryEarned += computeRow(emp, c.from, c.to).basePay;
        }
      });
    }
    return { basicSalaryEarned, amount: basicSalaryEarned / 12 };
  }
  function listThirteenthMonthPay(year) { return state.thirteenthMonthPay.filter(t => !year || t.year === year); }
  function getThirteenthMonthPay(id) { return state.thirteenthMonthPay.find(t => t.id === id); }
  function thirteenthMonthPayForEmployee(employeeId, year) {
    return state.thirteenthMonthPay.find(t => t.employeeId === employeeId && t.year === year);
  }
  // Computes and upserts one row per active employee for the given year -- re-running for
  // a year that's already Released leaves that employee's row untouched (a released
  // amount shouldn't silently change), only 'Computed' rows get refreshed.
  async function compute13thMonthForAllEmployees(year, computedBy) {
    const active = state.employees.filter(e => e.status !== 'Terminated');
    for (const emp of active) {
      const { basicSalaryEarned, amount } = compute13thMonthPay(emp, year);
      const existing = thirteenthMonthPayForEmployee(emp.id, year);
      if (existing) {
        if (existing.status !== 'Released') {
          await updateRow('thirteenthMonthPay', existing.id, { basicSalaryEarned, amount, computedBy: computedBy || null });
        }
      } else {
        await insertRow('thirteenthMonthPay', { id: genId('t13'), employeeId: emp.id, year, basicSalaryEarned, amount, status: 'Computed', computedBy: computedBy || null });
      }
    }
  }
  async function release13thMonthPay(id, releaseDate) {
    const row = getThirteenthMonthPay(id);
    await updateRow('thirteenthMonthPay', id, { status: 'Released', releaseDate: releaseDate || todayISO() });
    if (row) {
      await createNotification({
        employeeId: row.employeeId,
        type: 'thirteenth_month_released',
        message: `Your ${row.year} 13th Month Pay of ${fmtMoney(row.amount)} has been released.`,
        relatedTable: 'thirteenthMonthPay', relatedId: id,
      });
    }
    return getThirteenthMonthPay(id);
  }

  // ---- Retirement Pay (RA 7641) ----
  // Statutory MINIMUM for an employee with no separate company retirement plan: at least
  // 22.5 days' pay per year of service (conventional shorthand for 15 days basic + 5 days
  // SIL cash-in-lieu + 1/12 of 13th month). Pure function, consumed by computeFinalPay
  // below when separationType is 'Retirement'.
  function yearsOfServiceAsOf(dateHired, asOfDate) {
    if (!dateHired) return 0;
    const start = new Date(dateHired + 'T00:00:00');
    const end = new Date((asOfDate || todayISO()) + 'T00:00:00');
    return Math.max(0, (end - start) / (365.25 * 86400000));
  }
  function computeRetirementPay(emp, retirementDate) {
    const dailyRateEq = emp.payType === 'Daily' ? Number(emp.rate) : Number(emp.rate) / 22;
    return dailyRateEq * 22.5 * yearsOfServiceAsOf(emp.dateHired, retirementDate);
  }

  // ---- Offboarding / Final Pay & Clearance ----
  const DEFAULT_CLEARANCE_CHECKLIST = [
    'Company equipment returned (tools, uniform, ID, keys)',
    'No pending cash advances or unliquidated liabilities',
    'Turnover of pending work/documents completed',
    'Exit interview conducted',
  ];
  function listOffboarding() { return state.offboarding.slice(); }
  function getOffboarding(id) { return state.offboarding.find(o => o.id === id); }
  // The one active (not yet Released) offboarding case for an employee, if any -- an
  // employee can only be mid-offboarding once at a time.
  function activeOffboardingForEmployee(employeeId) {
    return state.offboarding.find(o => o.employeeId === employeeId && o.status !== 'Released');
  }
  async function startOffboarding({ employeeId, separationType, noticeDate, separationDate, createdBy }) {
    const row = {
      id: genId('off'), employeeId, separationType, noticeDate: noticeDate || null, separationDate,
      clearanceChecklist: DEFAULT_CLEARANCE_CHECKLIST.map(item => ({ item, done: false, doneBy: null, doneDate: null })),
      status: 'Pending Clearance', createdBy: createdBy || null,
    };
    // Deliberately does NOT touch employees.status yet -- that only happens at
    // releaseFinalPay, matching real-world practice of not cutting off an employee's
    // access/records until clearance is actually done.
    return insertRow('offboarding', row);
  }
  async function updateClearanceItem(offboardingId, index, done, doneBy) {
    const o = getOffboarding(offboardingId);
    if (!o) return;
    const checklist = (o.clearanceChecklist || []).slice();
    if (!checklist[index]) return;
    checklist[index] = Object.assign({}, checklist[index], { done, doneBy: done ? (doneBy || null) : null, doneDate: done ? todayISO() : null });
    await updateRow('offboarding', offboardingId, { clearanceChecklist: checklist });
    return getOffboarding(offboardingId);
  }
  // Pure computation -- doesn't save anything, so HR can preview/recompute freely before
  // committing via saveFinalPaySnapshot. "Last salary" is the cutoff containing (or the
  // last cutoff before) the separation date; prorated 13th month reuses compute13thMonthPay
  // as-is (already only sums cutoffs actually earned so far in the year); unused-leave
  // cash-out uses the SIL balance specifically (the only leave type with a hard cap this
  // app enforces) at the daily rate; outstanding liabilities sum any logged Cash Advance
  // deductions up to the separation date. Every figure here is a snapshot for HR to review
  // before release, not a final legal determination.
  function computeFinalPay(offboardingId) {
    const o = getOffboarding(offboardingId);
    if (!o) return null;
    const emp = getEmployee(o.employeeId);
    if (!emp) return null;
    const year = Number((o.separationDate || todayISO()).slice(0, 4));
    const month = Number((o.separationDate || todayISO()).slice(5, 7));

    const cutoffs = payCutoffs(emp.payCycle, year, month);
    const relevantCutoff = cutoffs.find(c => o.separationDate >= c.from && o.separationDate <= c.to) || cutoffs[0];
    const lastSalary = computeRow(emp, relevantCutoff.from, relevantCutoff.to).net;

    const { amount: proratedThirteenthMonth } = compute13thMonthPay(emp, year);

    const dailyRateEq = emp.payType === 'Daily' ? Number(emp.rate) : Number(emp.rate) / 22;
    const unusedSilDays = leaveBalance(emp, 'SIL', year).remaining;
    const unusedSILCashOut = unusedSilDays * dailyRateEq;

    const outstandingLiabilities = state.deductions
      .filter(d => d.employeeId === emp.id && d.kind === 'Cash Advance' && d.date <= o.separationDate)
      .reduce((s, d) => s + Number(d.amount), 0);

    const retirementPay = o.separationType === 'Retirement' ? computeRetirementPay(emp, o.separationDate) : 0;

    const totalFinalPay = lastSalary + proratedThirteenthMonth + unusedSILCashOut + retirementPay - outstandingLiabilities;

    return {
      lastSalary, proratedThirteenthMonth, unusedSilDays, unusedSILCashOut,
      retirementPay, outstandingLiabilities, totalFinalPay, computedDate: todayISO(),
    };
  }
  async function saveFinalPaySnapshot(offboardingId) {
    const snapshot = computeFinalPay(offboardingId);
    if (!snapshot) throw new Error('Could not compute final pay -- employee record not found.');
    await updateRow('offboarding', offboardingId, { finalPaySnapshot: snapshot, status: 'Ready for Release' });
    return getOffboarding(offboardingId);
  }
  // Only now sets employees.status -- always 'Terminated' regardless of separationType,
  // matching the one terminal status value the rest of the app already filters active
  // employees by everywhere (attendance, payroll, releasePayroll, etc.); the real
  // distinction (Resignation vs. Termination vs. Retirement vs. End of Contract) stays on
  // this offboarding record's own separationType field for reporting/COE purposes.
  async function releaseFinalPay(offboardingId, releaseDate) {
    const o = getOffboarding(offboardingId);
    if (!o) return;
    await updateRow('offboarding', offboardingId, { status: 'Released', finalPayReleaseDate: releaseDate || todayISO() });
    await updateEmployee(o.employeeId, { status: 'Terminated' });
    await createNotification({
      employeeId: o.employeeId,
      type: 'final_pay_released',
      message: `Your final pay (${fmtMoney((o.finalPaySnapshot && o.finalPaySnapshot.totalFinalPay) || 0)}) has been released.`,
      relatedTable: 'offboarding', relatedId: offboardingId,
    });
    return getOffboarding(offboardingId);
  }
  async function issueCOE(offboardingId, coeIssuedDate) {
    const o = getOffboarding(offboardingId);
    await updateRow('offboarding', offboardingId, { coeIssuedDate: coeIssuedDate || todayISO() });
    if (o) {
      await createNotification({
        employeeId: o.employeeId,
        type: 'coe_issued',
        message: 'Your Certificate of Employment has been issued -- coordinate with HR to receive it.',
        relatedTable: 'offboarding', relatedId: offboardingId,
      });
    }
    return getOffboarding(offboardingId);
  }

  // ---- Office Files (Admin/Finance, admin-only) ----
  // Manually-uploaded documents (scanned receipts, contracts, etc.) -- staff scan using the
  // printer's own software, then upload the resulting file here.
  function listOfficeFiles() { return state.officeFiles.slice(); }
  async function uploadOfficeFile(file, category, uploadedBy) {
    const ext = (file.name && file.name.split('.').pop()) || 'dat';
    const path = `${genId('file')}.${ext}`;
    const { error: upErr } = await sb.storage.from('office-files').upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (upErr) { toast('File upload failed: ' + upErr.message); throw upErr; }
    return insertRow('officeFiles', {
      id: genId('of'), fileName: file.name, filePath: path,
      mimeType: file.type || null, fileSize: file.size || null,
      category: category || 'Other', uploadedBy: uploadedBy || null,
    });
  }
  async function getSignedOfficeFileUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('office-files').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign office file URL', error); return null; }
    return data.signedUrl;
  }
  async function deleteOfficeFile(id, path) {
    if (path) {
      const { error } = await sb.storage.from('office-files').remove([path]);
      if (error) console.error('Failed to delete office file from storage', error);
    }
    await deleteRow('officeFiles', id);
  }
  // Rename (fileName) and Move-to-folder (category) both just patch the row -- storage
  // paths are flat/random (see uploadOfficeFile above), never derived from fileName or
  // category, so neither operation ever needs to touch the underlying storage object.
  async function updateOfficeFile(id, patch) {
    await updateRow('officeFiles', id, patch);
  }
  // Copy-to-folder: actually duplicates the underlying storage object (download the
  // signed URL, re-upload as a new blob) and inserts a new row, so the original is left
  // untouched -- unlike a Move, both copies exist independently afterward.
  async function duplicateOfficeFile(file, newCategory, uploadedBy) {
    const url = await getSignedOfficeFileUrl(file.filePath);
    if (!url) throw new Error('Could not read the original file to copy it.');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Could not read the original file to copy it.');
    const blob = await res.blob();
    const ext = (file.fileName && file.fileName.split('.').pop()) || 'dat';
    const path = `${genId('file')}.${ext}`;
    const { error: upErr } = await sb.storage.from('office-files').upload(path, blob, { contentType: file.mimeType || 'application/octet-stream' });
    if (upErr) { toast('Copy failed: ' + upErr.message); throw upErr; }
    return insertRow('officeFiles', {
      id: genId('of'), fileName: file.fileName, filePath: path,
      mimeType: file.mimeType || null, fileSize: file.fileSize || null,
      category: newCategory || file.category || 'Other', uploadedBy: uploadedBy || null,
    });
  }

  // ---- Materials Request (Admin, admin-only) ----
  // One editable running list -- no approval workflow, just an always-current list of
  // what needs to be ordered/picked up, replacing an ad-hoc paper or messaging-app
  // request. Quantity is expected to be edited often (as stock comes in / needs change),
  // so it's a plain patch rather than anything more structured.
  function listMaterialRequests() { return state.materialRequests.slice(); }
  async function addMaterialRequest(m) {
    m.id = genId('mat');
    return insertRow('materialRequests', m);
  }
  async function updateMaterialRequest(id, patch) {
    await updateRow('materialRequests', id, patch);
  }
  async function deleteMaterialRequest(id) {
    await deleteRow('materialRequests', id);
  }

  // ---- 201 File (employee documents/requirements) ----
  // Both the employee (My Portal -> My Profile) and admins can upload; every upload
  // starts 'Pending' -- the trigger-enforced RLS policy (enforce_employee_document_insert
  // in supabase/schema.sql) forces that server-side for anyone but an admin, so only HR can
  // actually move a document to 'Verified'/'Rejected'.
  function employeeDocumentsForEmployee(employeeId) {
    return state.employeeDocuments.filter(d => d.employeeId === employeeId).slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  }
  async function uploadEmployeeDocument(employeeId, file, category, uploadedBy, idType) {
    const ext = (file.name && file.name.split('.').pop()) || 'dat';
    const path = `${employeeId}/${genId('doc')}.${ext}`;
    const { error: upErr } = await sb.storage.from('employee-201').upload(path, file, { contentType: file.type || 'application/octet-stream' });
    if (upErr) { toast('File upload failed: ' + upErr.message); throw upErr; }
    return insertRow('employeeDocuments', {
      id: genId('ed'), employeeId, category: category || 'Other',
      idType: category === 'Valid ID' ? (idType || null) : null,
      fileName: file.name, filePath: path,
      mimeType: file.type || null, fileSize: file.size || null,
      uploadedBy: uploadedBy || null, status: 'Pending',
    });
  }
  async function getSignedEmployeeDocumentUrl(path) {
    if (!path) return null;
    const { data, error } = await sb.storage.from('employee-201').createSignedUrl(path, 3600);
    if (error) { console.error('Failed to sign employee document URL', error); return null; }
    return data.signedUrl;
  }
  // Admin-only in practice (category/status/verify notes) -- RLS gives employees no update
  // policy on this table at all, so this always runs as an admin edit.
  async function updateEmployeeDocument(id, patch) {
    await updateRow('employeeDocuments', id, patch);
  }
  async function deleteEmployeeDocument(id, path) {
    if (path) {
      const { error } = await sb.storage.from('employee-201').remove([path]);
      if (error) console.error('Failed to delete employee document from storage', error);
    }
    await deleteRow('employeeDocuments', id);
  }

  // ---- Payroll cutoff reminder push subscriptions (HR/admin devices only) ----
  function listPushSubscriptions() { return state.pushSubscriptions.slice(); }
  // sub is a PushSubscription (from pushManager.subscribe()) -- stores its endpoint/keys so
  // the scheduled Edge Function (supabase/functions/payroll-cutoff-reminder) can send to it
  // later. Keyed by endpoint (unique) so re-enabling on the same browser/device just
  // upserts instead of creating duplicate rows.
  async function savePushSubscription(sub, adminEmail) {
    const json = sub.toJSON ? sub.toJSON() : sub;
    const { error } = await sb.from(TABLES.pushSubscriptions).upsert(sanitize({
      id: genId('push'), endpoint: json.endpoint,
      p256dh: json.keys && json.keys.p256dh, auth: json.keys && json.keys.auth,
      adminEmail: adminEmail || null, userAgent: navigator.userAgent || null,
    }), { onConflict: 'endpoint' });
    if (error) { toast('Could not save this device: ' + error.message); throw error; }
    await refetch('pushSubscriptions');
  }
  async function deletePushSubscriptionByEndpoint(endpoint) {
    const { error } = await sb.from(TABLES.pushSubscriptions).delete().eq('endpoint', endpoint);
    if (error) { toast('Could not remove this device: ' + error.message); throw error; }
    await refetch('pushSubscriptions');
  }

  // ---- Employee-side push subscriptions (My Portal -> Settings -> Notifications) ----
  // Same shape/pattern as the admin pushSubscriptions above, just employee-scoped -- kept
  // as a separate table (rather than reusing the admin one) so the two RLS models never
  // have to overlap: admins can read every admin subscription, employees can only ever
  // touch their own.
  async function saveEmployeePushSubscription(sub, employeeId) {
    const json = sub.toJSON ? sub.toJSON() : sub;
    const { error } = await sb.from(TABLES.employeePushSubscriptions).upsert(sanitize({
      id: genId('epush'), endpoint: json.endpoint,
      p256dh: json.keys && json.keys.p256dh, auth: json.keys && json.keys.auth,
      employeeId, userAgent: navigator.userAgent || null,
    }), { onConflict: 'endpoint' });
    if (error) { toast('Could not save this device: ' + error.message); throw error; }
    await refetch('employeePushSubscriptions');
  }
  async function deleteEmployeePushSubscriptionByEndpoint(endpoint) {
    const { error } = await sb.from(TABLES.employeePushSubscriptions).delete().eq('endpoint', endpoint);
    if (error) { toast('Could not remove this device: ' + error.message); throw error; }
    await refetch('employeePushSubscriptions');
  }

  // ---- Backup: a full snapshot of every table currently loaded in memory. The free
  // Supabase tier has no automatic backups/point-in-time recovery, so this is what backs
  // the admin "Download Backup" button — a plain JSON export HR can save wherever they like.
  function exportAllData() { return JSON.parse(JSON.stringify(state)); }

  return {
    init, onRemoteChange,
    listEmployees, getEmployee, addEmployee, updateEmployee, deleteEmployee,
    listCandidates, getCandidate, addCandidate, moveCandidateStage, decideCandidate, deleteCandidate,
    listCases, getCase, addCase, updateCase, deleteCase, offenseOccurrenceCount, suggestedPenaltyFor,
    listComplaints, getComplaint, addComplaint, updateComplaint, deleteComplaint,
    listAttendance, attendanceForDate, attendanceInRange, addAttendance, updateAttendance, deleteAttendance,
    uploadAttendancePhoto, getSignedPhotoUrl, deleteAttendancePhoto,
    uploadBankQr, getSignedBankQrUrl, deleteBankQrPhoto,
    uploadEmployeePhoto, getSignedEmployeePhotoUrl, deleteEmployeePhoto,
    listDeductions, deductionsInRange, addDeduction, deleteDeduction,
    listBonuses, bonusesInRange, addBonus, deleteBonus,
    listProbations, getProbation, getProbationByEmployee, addProbation, updateProbation, deleteProbation,
    employmentHistoryForEmployee, addEmploymentHistory, updateEmploymentHistory, deleteEmploymentHistory,
    getPayrollOverride, setPayrollOverride,
    listHolidays, getHoliday, holidaysInRange, addHoliday, updateHoliday, deleteHoliday,
    listPayCutoffSettings, getPayCutoffSetting, updatePayCutoffSetting,
    listLeaveRequests, getLeaveRequest, leaveRequestsForEmployee, silDaysUsed, addLeaveRequest, reviewLeaveRequest, updateLeaveRequestNotes, updateLeaveRequest, deleteLeaveRequest,
    listAttendanceCorrections, getAttendanceCorrection, attendanceCorrectionsForEmployee, addAttendanceCorrection, reviewAttendanceCorrection, updateAttendanceCorrectionNotes, deleteAttendanceCorrection,
    listScheduleChangeRequests, getScheduleChangeRequest, scheduleChangeRequestsForEmployee, addScheduleChangeRequest, reviewScheduleChangeRequest, updateScheduleChangeRequestNotes, deleteScheduleChangeRequest,
    listAuditLog, purgeOldAuditLog,
    createNotification, listNotificationsForEmployee, unreadNotificationCount, markNotificationRead, markAllNotificationsRead, deleteNotification,
    getPayrollRelease, releasePayroll, unreleasePayroll, updatePayrollRelease,
    getAppSetting, setAppSetting,
    listExpenses, getExpense, expensesInRange, addExpense, updateExpense, deleteExpense, refetchExpenses,
    uploadReceiptPhoto, getSignedReceiptUrl, deleteReceiptPhoto,
    listBills, getBill, addBill, updateBill, deleteBill, payBill,
    listPaymentVouchers, getPaymentVoucher, paymentVouchersInRange, addPaymentVoucher, updatePaymentVoucher, deletePaymentVoucher,
    listOfficeFiles, uploadOfficeFile, getSignedOfficeFileUrl, deleteOfficeFile, updateOfficeFile, duplicateOfficeFile,
    listMaterialRequests, addMaterialRequest, updateMaterialRequest, deleteMaterialRequest,
    employeeDocumentsForEmployee, uploadEmployeeDocument, getSignedEmployeeDocumentUrl, updateEmployeeDocument, deleteEmployeeDocument,
    listPushSubscriptions, savePushSubscription, deletePushSubscriptionByEndpoint,
    saveEmployeePushSubscription, deleteEmployeePushSubscriptionByEndpoint,
    exportAllData, logAudit,
    listSafetyIncidents, getSafetyIncident, safetyIncidentsForEmployee, addSafetyIncident, updateSafetyIncident, resolveSafetyIncident, deleteSafetyIncident,
    listEmployeeRelationsCases, getEmployeeRelationsCase, employeeRelationsCasesFiledBy, currentAdminIsCodiMember,
    listAdminCodiMembers, addAdminCodiMember, removeAdminCodiMember,
    fileEmployeeRelationsCase, updateEmployeeRelationsCase, deleteEmployeeRelationsCase,
    listSssContributionBrackets, addSssContributionBracket, updateSssContributionBracket, deleteSssContributionBracket, suggestedSssDeduction,
    listContributionRates, getContributionRate, upsertContributionRate, suggestedPhilhealthDeduction, suggestedPagibigDeduction,
    listRegionalMinimumWage, upsertRegionalMinimumWage, deleteRegionalMinimumWage, isBelowMinimumWage,
    listLeaveTypePolicies, getLeaveTypePolicy, updateLeaveTypePolicy, leaveDaysUsed, leaveEligibility, leaveBalance,
    compute13thMonthPay, listThirteenthMonthPay, getThirteenthMonthPay, thirteenthMonthPayForEmployee, compute13thMonthForAllEmployees, release13thMonthPay,
    computeRetirementPay, yearsOfServiceAsOf,
    listOffboarding, getOffboarding, activeOffboardingForEmployee, startOffboarding, updateClearanceItem, computeFinalPay, saveFinalPaySnapshot, releaseFinalPay, issueCOE,
    listAnnouncements, getAnnouncement, addAnnouncement, updateAnnouncement, deleteAnnouncement,
    disciplineCatalog, listDisciplineOffenses, getDisciplineOffense, addDisciplineOffense,
    updateDisciplineOffense, deleteDisciplineOffense, importDefaultDisciplineCatalog,
  };
})();
