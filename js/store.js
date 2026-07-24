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

const PAY_CYCLES = {
  '10-20': { label: 'Admins — 10th & 20th', cutoffLabels: ['10th', '20th'] },
  '15-30': { label: 'Technicians — 15th & 30th/31st', cutoffLabels: ['15th', 'end of month'] },
};

function pad2(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function ordinal(n) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return n + 'th';
  const rem10 = n % 10;
  return n + (rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th');
}

function payCutoffs(payCycle, year, month) {
  const y = year, m = month;
  const last = daysInMonth(y, m);
  if (payCycle === '15-30') {
    return [
      { key: 'A', label: `1 – 15 (paid the 15th)`, from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-15`, payDate: `${y}-${pad2(m)}-15` },
      { key: 'B', label: `16 – ${last} (paid the ${ordinal(last)})`, from: `${y}-${pad2(m)}-16`, to: `${y}-${pad2(m)}-${pad2(last)}`, payDate: `${y}-${pad2(m)}-${pad2(last)}` },
    ];
  }
  // '10-20': cutoffs run 26 (previous month) – 10, and 11 – 25, so every calendar day
  // is covered exactly once across the year (the tail, 26–end of THIS month, belongs to
  // next month's "A" cutoff). Labor Code compliance: paid twice a month, each period ≤16
  // days (A is at most 6 prior-month days + 10 = 16; B is a fixed 15), with paydays
  // landing exactly on the 10th and 20th as required — unlike a plain 1–10/11–20 split,
  // which would leave days 21–end of month uncovered by any payroll cutoff at all.
  let prevMonth = m - 1, prevYear = y;
  if (prevMonth < 1) { prevMonth = 12; prevYear -= 1; }
  return [
    { key: 'A', label: `26 (prev. mo.) – 10 (paid the 10th)`, from: `${prevYear}-${pad2(prevMonth)}-26`, to: `${y}-${pad2(m)}-10`, payDate: `${y}-${pad2(m)}-10` },
    { key: 'B', label: `11 – 25 (paid the 20th)`, from: `${y}-${pad2(m)}-11`, to: `${y}-${pad2(m)}-25`, payDate: `${y}-${pad2(m)}-20` },
  ];
}

// Which cutoff (and, for the 10-20 cycle, potentially which month) "today" falls into —
// used to pick a sensible default view. Days 26+ of a month belong to NEXT month's "A"
// cutoff under the 10-20 scheme (see payCutoffs above), so the month can roll forward.
function defaultCutoffPosition(payCycle, year, month, day) {
  if (payCycle === '15-30') {
    return { year, month, half: day <= 15 ? 'A' : 'B' };
  }
  if (day <= 10) return { year, month, half: 'A' };
  if (day <= 25) return { year, month, half: 'B' };
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
function computeDayPay(dailyRateEq, rec, holiday) {
  const hourlyRate = dailyRateEq / 8;
  const hrs = rec ? (Number(rec.hours) || 0) : 0;
  const otHrs = rec ? Math.max(0, hrs - 8) : 0;
  const otMultiplier = holiday ? (holiday.type === 'Regular' ? 2.6 : 1.69) : 1.25;
  const otPay = otHrs * hourlyRate * otMultiplier;
  const nsdHrs = rec ? nightOverlapHours(rec.timeIn, rec.timeOut) : 0;
  const nsdPay = nsdHrs * hourlyRate * 0.10;

  let holidayPay = 0;
  if (holiday) {
    if (rec) {
      const regHrs = Math.min(hrs, 8);
      const mult = holiday.type === 'Regular' ? 2.0 : 1.3;
      holidayPay = dailyRateEq * (mult - 1) * (regHrs / 8);
    } else if (holiday.type === 'Regular') {
      holidayPay = dailyRateEq;
    }
  }

  return { otHrs, otPay, nsdHrs, nsdPay, holidayPay };
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
  };

  const state = {
    employees: [], candidates: [], disciplinaryCases: [], complaints: [],
    attendance: [], deductions: [], probationRecords: [], payrollOverrides: [], holidays: [],
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

  async function insertRow(key, row) {
    await mutate(sb.from(TABLES[key]).insert(sanitize(row)), 'Save failed');
    await refetch(key);
    return row;
  }
  async function updateRow(key, id, patch) {
    await mutate(sb.from(TABLES[key]).update(sanitize(patch)).eq('id', id), 'Save failed');
    await refetch(key);
  }
  async function deleteRow(key, id) {
    await mutate(sb.from(TABLES[key]).delete().eq('id', id), 'Delete failed');
    await refetch(key);
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
  async function updateAttendance(id, patch) {
    await updateRow('attendance', id, patch);
    return state.attendance.find(a => a.id === id);
  }
  async function deleteAttendance(id) {
    await deleteRow('attendance', id);
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

  return {
    init, onRemoteChange,
    listEmployees, getEmployee, addEmployee, updateEmployee, deleteEmployee,
    listCandidates, getCandidate, addCandidate, moveCandidateStage, decideCandidate, deleteCandidate,
    listCases, getCase, addCase, updateCase, deleteCase,
    listComplaints, getComplaint, addComplaint, updateComplaint, deleteComplaint,
    listAttendance, attendanceForDate, attendanceInRange, addAttendance, updateAttendance, deleteAttendance,
    listDeductions, deductionsInRange, addDeduction, deleteDeduction,
    listProbations, getProbation, getProbationByEmployee, addProbation, updateProbation, deleteProbation,
    getPayrollOverride, setPayrollOverride,
    listHolidays, getHoliday, holidaysInRange, addHoliday, updateHoliday, deleteHoliday,
  };
})();
