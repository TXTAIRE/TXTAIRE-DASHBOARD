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

const CATEGORIES = ['Admin', 'Technician'];

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

function fmtMoney(n) {
  const v = Number(n) || 0;
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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
// Overtime: 125% ordinary / 169% special-day-worked / 260% regular-holiday-worked, applied
// to hours beyond 8. Night Shift Differential: +10% of the hourly rate for each hour
// actually worked 10pm-6am, regardless of holiday. Holiday pay: a worked holiday earns a
// premium on top of its already-counted 1x base (200% regular / 130% special, prorated by
// regular hours worked up to 8); an unworked REGULAR holiday still pays a full day ("no
// work, no pay" does not apply to regular holidays); an unworked special day pays nothing
// extra.
// NSD/OT/Holiday-premium pay only count once HR has approved that specific day's request
// (rec.otStatus/nsdStatus/holidayStatus === 'Approved') — a Requested-but-not-yet-approved
// day pays neither. The one exception, required by Philippine labor law: an employee who
// was ABSENT on a declared Regular Holiday is still owed their full daily rate regardless
// of any request/approval, since there's no attendance record for them to request against.
function computeDayPay(dailyRateEq, rec, holiday) {
  const hourlyRate = dailyRateEq / 8;
  const hrs = rec ? (Number(rec.hours) || 0) : 0;

  // A record can carry its own holidayType, overriding/standing in for the shared
  // Holidays list entry for that date — lets HR grant the holiday premium for a specific
  // employee's day even when that date isn't on the company-wide list. The absent-but-
  // still-paid rule below stays tied to the real shared-list holiday only, since there's
  // no per-record override possible for a day nobody clocked in for.
  const effectiveType = (rec && rec.holidayType) ? rec.holidayType : (holiday ? holiday.type : null);

  // otHours lets HR override the raw "hours - 8" figure (e.g. to exclude a break, or cap
  // it) — null/undefined falls back to the original derived calculation.
  const otHrs = (rec && rec.otStatus === 'Approved')
    ? (rec.otHours != null ? Number(rec.otHours) : Math.max(0, hrs - 8))
    : 0;
  const otMultiplier = effectiveType ? (effectiveType === 'Regular' ? 2.6 : 1.69) : 1.25;
  const otPay = otHrs * hourlyRate * otMultiplier;
  const nsdHrs = (rec && rec.nsdStatus === 'Approved') ? nightOverlapHours(rec.timeIn, rec.timeOut) : 0;
  const nsdPay = nsdHrs * hourlyRate * 0.10;

  let holidayPay = 0;
  if (effectiveType) {
    if (rec && rec.holidayStatus === 'Approved') {
      const regHrs = Math.min(hrs, 8);
      const mult = effectiveType === 'Regular' ? 2.0 : 1.3;
      holidayPay = dailyRateEq * (mult - 1) * (regHrs / 8);
    } else if (!rec && holiday && holiday.type === 'Regular') {
      holidayPay = dailyRateEq;
    }
  }

  return { otHrs, otPay, nsdHrs, nsdPay, holidayPay };
}

// Full payroll computation for one employee over one cutoff — shared by the admin
// Payroll tab and the Employee Self-Service "My Payroll" page so both always show
// exactly the same numbers. Reads attendance/holidays/deductions/overrides straight
// from the Store, so it stays live as records change. The gap between a cutoff's last
// counted day (`to`) and its actual payDate (see payCutoffs) is what gives HR processing
// time before payday — already baked into the cutoff span itself, so this just uses
// `from`/`to` directly with no additional shift.
function computeRow(emp, from, to) {
  const allRecords = Store.attendanceInRange(from, to).filter(a => a.employeeId === emp.id);
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
  const hourlyRate = dailyRateEq / 8;

  let colaPay = (emp.allowancePerDay || 0) * daysPresent + (emp.fixedAllowance || 0);
  const isColaOverridden = !!(override && override.cola != null);
  if (isColaOverridden) colaPay = Number(override.cola);

  const housingRatio = ordinaryWorkDays > 0 ? Math.min(1, daysPresent / ordinaryWorkDays) : 0;
  let housingPay = (emp.housingAllowance || 0) * housingRatio;
  const isHousingOverridden = !!(override && override.housing != null);
  if (isHousingOverridden) housingPay = Number(override.housing);

  let otPay = 0, nsdPay = 0;
  presentRecords.forEach(r => {
    const day = computeDayPay(dailyRateEq, r, holidayByDate[r.date]);
    otPay += day.otPay;
    nsdPay += day.nsdPay;
  });
  const isNsdOverridden = !!(override && override.nsd != null);
  if (isNsdOverridden) nsdPay = Number(override.nsd);
  const isOtOverridden = !!(override && override.ot != null);
  if (isOtOverridden) otPay = Number(override.ot);

  let holidayPay = 0;
  holidays.forEach(h => {
    const rec = presentRecords.find(r => r.date === h.date);
    holidayPay += computeDayPay(dailyRateEq, rec, h).holidayPay;
  });
  const isHolidayOverridden = !!(override && override.holiday != null);
  if (isHolidayOverridden) holidayPay = Number(override.holiday);

  let lateUndertimeDed = 0;
  presentRecords.forEach(r => {
    const hrs = Number(r.hours) || 0;
    lateUndertimeDed += Math.max(0, 8 - hrs) * hourlyRate;
  });

  const gross = basePay + colaPay + housingPay + nsdPay + otPay + holidayPay;

  const manualDed = Store.deductionsInRange(from, to).filter(d => d.employeeId === emp.id).reduce((s, d) => s + Number(d.amount), 0);
  const attendanceDed = emp.payType === 'Monthly' && ordinaryWorkDays > 0 ? (emp.rate / ordinaryWorkDays) * daysAbsent : 0;
  const dedTotal = manualDed + attendanceDed + lateUndertimeDed;

  // Withholding tax applies to what was actually earned, not the theoretical full-cutoff
  // gross before the absence deduction is subtracted -- a Monthly employee's basePay is
  // their full flat rate regardless of attendance, with absence clawed back separately via
  // attendanceDed. Taxing the undiminished gross meant a cutoff with zero attendance logged
  // yet (e.g. before HR has entered it) showed a confusing negative "net": real tax charged
  // on pay that was then fully deducted right back out.
  const tax = withholdingTax(Math.max(0, gross - attendanceDed));
  const net = gross - tax - dedTotal;

  return {
    emp, daysPresent, isOverridden, workDays, daysAbsent, isAbsentOverridden, basePay, isBasePayOverridden,
    colaPay, isColaOverridden, housingPay, isHousingOverridden, nsdPay, isNsdOverridden,
    otPay, isOtOverridden, holidayPay, isHolidayOverridden,
    gross, tax, manualDed, attendanceDed, lateUndertimeDed, dedTotal, net,
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
    probationRecords: 'probationRecords',
    payrollOverrides: 'payrollOverrides',
    holidays: 'holidays',
    payCutoffSettings: 'payCutoffSettings',
    leaveRequests: 'leaveRequests',
    attendanceCorrections: 'attendanceCorrections',
    auditLog: 'auditLog',
    notifications: 'notifications',
    payrollReleases: 'payrollReleases',
    appSettings: 'appSettings',
  };

  const state = {
    employees: [], candidates: [], disciplinaryCases: [], complaints: [],
    attendance: [], deductions: [], probationRecords: [], payrollOverrides: [], holidays: [],
    payCutoffSettings: [],
    leaveRequests: [], attendanceCorrections: [], auditLog: [],
    notifications: [], payrollReleases: [], appSettings: [],
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
  async function addCase(nte) {
    nte.id = genId('d');
    nte.status = 'Notice Issued';
    nte.history = [{ date: nte.dateIssued, action: 'Notice Issued', note: nte.violation }];
    return insertRow('disciplinaryCases', nte);
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
          await createNotification({
            employeeId: after.employeeId,
            type: `${kind}_${newVal.toLowerCase()}`,
            message: `Your ${ATTENDANCE_STATUS_LABELS[kind]} pay request for ${fmtDate(after.date)} was ${newVal.toLowerCase()}.`,
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
  async function addLeaveRequest(r) {
    r.id = genId('lr');
    r.status = 'Pending';
    return insertRow('leaveRequests', r);
  }
  async function reviewLeaveRequest(id, status, reviewedBy, reviewNotes) {
    const r = getLeaveRequest(id);
    await updateRow('leaveRequests', id, { status, reviewedBy, reviewedDate: todayISO(), reviewNotes: reviewNotes || '' });
    if (r && (status === 'Approved' || status === 'Rejected')) {
      await createNotification({
        employeeId: r.employeeId,
        type: status === 'Approved' ? 'leave_approved' : 'leave_rejected',
        message: `Your ${r.leaveType} leave request (${fmtDate(r.startDate)} – ${fmtDate(r.endDate)}) was ${status.toLowerCase()}.`,
        relatedTable: 'leaveRequests', relatedId: id,
      });
    }
    return getLeaveRequest(id);
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
      await createNotification({
        employeeId: c.employeeId,
        type: status === 'Approved' ? 'correction_approved' : 'correction_rejected',
        message: `Your attendance concern for ${fmtDate(c.date)} was ${status.toLowerCase()}.`,
        relatedTable: 'attendanceCorrections', relatedId: id,
      });
    }
    return getAttendanceCorrection(id);
  }

  // ---- Audit Log (read-only in the app; populated automatically by insertRow/updateRow/deleteRow) ----
  function listAuditLog() { return state.auditLog.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); }

  // Deletes any auditLog row older than the configured retention window (default 30 days
  // if HR has never set one) -- called opportunistically whenever an admin opens the
  // Audit Log view. There's no server-side cron in this app, so "after 7/30 days" is
  // enforced the next time someone actually looks, not on a strict schedule.
  async function purgeOldAuditLog() {
    const days = Number(getAppSetting('auditLogRetentionDays', 30));
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

  // ---- App Settings (small generic key/value store, admin-only) ----
  function getAppSetting(key, fallback) {
    const row = state.appSettings.find(s => s.key === key);
    return row ? row.value : fallback;
  }
  async function setAppSetting(key, value) {
    const { error } = await sb.from(TABLES.appSettings).upsert(sanitize({ key, value }), { onConflict: 'key' });
    if (error) { toast('Save failed: ' + error.message); throw error; }
    await refetch('appSettings');
    logAudit('appSettings.update', TABLES.appSettings, key, { value });
  }

  // ---- Backup: a full snapshot of every table currently loaded in memory. The free
  // Supabase tier has no automatic backups/point-in-time recovery, so this is what backs
  // the admin "Download Backup" button — a plain JSON export HR can save wherever they like.
  function exportAllData() { return JSON.parse(JSON.stringify(state)); }

  return {
    init, onRemoteChange,
    listEmployees, getEmployee, addEmployee, updateEmployee, deleteEmployee,
    listCandidates, getCandidate, addCandidate, moveCandidateStage, decideCandidate, deleteCandidate,
    listCases, getCase, addCase, updateCase, deleteCase,
    listComplaints, getComplaint, addComplaint, updateComplaint, deleteComplaint,
    listAttendance, attendanceForDate, attendanceInRange, addAttendance, updateAttendance, deleteAttendance,
    uploadAttendancePhoto, getSignedPhotoUrl, deleteAttendancePhoto,
    uploadBankQr, getSignedBankQrUrl, deleteBankQrPhoto,
    listDeductions, deductionsInRange, addDeduction, deleteDeduction,
    listProbations, getProbation, getProbationByEmployee, addProbation, updateProbation, deleteProbation,
    getPayrollOverride, setPayrollOverride,
    listHolidays, getHoliday, holidaysInRange, addHoliday, updateHoliday, deleteHoliday,
    listPayCutoffSettings, getPayCutoffSetting, updatePayCutoffSetting,
    listLeaveRequests, getLeaveRequest, leaveRequestsForEmployee, addLeaveRequest, reviewLeaveRequest,
    listAttendanceCorrections, getAttendanceCorrection, attendanceCorrectionsForEmployee, addAttendanceCorrection, reviewAttendanceCorrection,
    listAuditLog, purgeOldAuditLog,
    createNotification, listNotificationsForEmployee, unreadNotificationCount, markNotificationRead, markAllNotificationsRead,
    getPayrollRelease, releasePayroll,
    getAppSetting, setAppSetting,
    exportAllData, logAudit,
  };
})();
