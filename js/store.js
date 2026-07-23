/* TxTAIRE HR & Operations — local data store (localStorage-backed, no backend) */

window.Views = window.Views || {};

const STORAGE_KEY = 'txtaire_hr_v1';

const CATEGORIES = ['Admin', 'HR', 'Technician'];

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
  '10-20': { label: 'Engineers, Managers & Admins — 10th & 20th', cutoffLabels: ['10th', '20th'] },
  '15-30': { label: 'Technicians — 15th & 30th/31st', cutoffLabels: ['15th', 'end of month'] },
};

function pad2(n) { return String(n).padStart(2, '0'); }

function daysInMonth(year, month) { return new Date(year, month, 0).getDate(); }

function payCutoffs(payCycle, year, month) {
  const y = year, m = month;
  const last = daysInMonth(y, m);
  if (payCycle === '15-30') {
    return [
      { key: 'A', label: `1 – 15 (paid the 15th)`, from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-15`, payDate: `${y}-${pad2(m)}-15` },
      { key: 'B', label: `16 – ${last} (paid the ${last}th)`, from: `${y}-${pad2(m)}-16`, to: `${y}-${pad2(m)}-${pad2(last)}`, payDate: `${y}-${pad2(m)}-${pad2(last)}` },
    ];
  }
  return [
    { key: 'A', label: `1 – 10 (paid the 10th)`, from: `${y}-${pad2(m)}-01`, to: `${y}-${pad2(m)}-10`, payDate: `${y}-${pad2(m)}-10` },
    { key: 'B', label: `11 – 20 (paid the 20th)`, from: `${y}-${pad2(m)}-11`, to: `${y}-${pad2(m)}-20`, payDate: `${y}-${pad2(m)}-20` },
  ];
}

function defaultCutoffHalf(payCycle, day) {
  if (payCycle === '15-30') return day <= 15 ? 'A' : 'B';
  return day <= 10 ? 'A' : 'B';
}

function seedProbationRecords() {
  return [
    { id: genId('pr'), employeeId: 'e7', startDate: '2026-06-17', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
    { id: genId('pr'), employeeId: 'e17', startDate: '2026-02-02', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
    { id: genId('pr'), employeeId: 'e18', startDate: '2026-05-12', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
    { id: genId('pr'), employeeId: 'e4', startDate: '2026-05-25', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
    { id: genId('pr'), employeeId: 'e19', startDate: '2026-06-26', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
    { id: genId('pr'), employeeId: 'e20', startDate: '2026-06-11', thirdMonthStatus: 'Pending', thirdMonthEvaluatedDate: null, thirdMonthNotes: '', sixthMonthStatus: 'Pending', sixthMonthEvaluatedDate: null, sixthMonthNotes: '' },
  ];
}

function seedData() {
  const employees = [
    // Admins — paid the 10th & 20th
    { id: 'e6', name: 'Rica Mae Nabora', category: 'Admin', position: 'Service Specialist / HR', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 1000, allowancePerDay: 0, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e7', name: 'Jennifer D. Cosme', category: 'Admin', position: 'Admin Assistant', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 600, allowancePerDay: 0, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e5', name: 'Odilon T. Soriano', category: 'Admin', position: 'Logistic Manager', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: 12500, allowancePerDay: 0, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e1', name: 'John Rodolfo R. Bultron', category: 'Admin', position: 'Vice President - Operations and Shared Services', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: 22170.83, allowancePerDay: 0, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e2', name: 'Joshua L. Casano', category: 'Admin', position: 'Engineering Manager', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: 16954.17, allowancePerDay: 100, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e3', name: 'Julaisa S. Sangcupan', category: 'Admin', position: 'Engineering Officer', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: 12550, allowancePerDay: 100, fixedAllowance: 0, payCycle: '10-20', notes: '' },
    { id: 'e4', name: 'Idine S. Famini', category: 'Admin', position: 'Service Engineer', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Monthly', rate: 11923.92, allowancePerDay: 0, fixedAllowance: 0, payCycle: '10-20', notes: '' },

    // Technicians — paid the 15th & 30th/31st
    { id: 'e8', name: 'Arnel V. Parala', category: 'Technician', position: 'Service Technician Supervisor', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 1000, allowancePerDay: 200, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e9', name: 'Argee V. Parala', category: 'Technician', position: 'Lead Service Technician', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 1000, allowancePerDay: 200, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e10', name: 'Michael V. Parala', category: 'Technician', position: 'Service Technician', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 800, allowancePerDay: 200, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e11', name: 'Aldrin V. Parala', category: 'Technician', position: 'Service Personnel - Welder', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 700, allowancePerDay: 70, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e12', name: 'Erasmo L. Cabañez Jr.', category: 'Technician', position: 'Service Personnel - Mason', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 700, allowancePerDay: 70, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e13', name: 'Franny R. Rotazo', category: 'Technician', position: 'Service Personnel', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 700, allowancePerDay: 100, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e14', name: 'George J. Dela Cruz', category: 'Technician', position: 'Company Driver', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 645, allowancePerDay: 100, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e15', name: 'Cruzel Albano', category: 'Technician', position: 'Electrician', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 1350, allowancePerDay: 0, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e16', name: 'Dante B. Dulfo', category: 'Technician', position: 'Lead Service Technician', status: 'Active', employmentStatus: 'Regular', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 1200, allowancePerDay: 100, fixedAllowance: 500, payCycle: '15-30', notes: 'Fixed house allowance of ₱500 added every cutoff, on top of the ₱100/day field allowance.' },
    { id: 'e17', name: 'Benedict B. Alomia', category: 'Technician', position: 'Utility and Warehouse Officer', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 600, allowancePerDay: 0, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e18', name: 'Jayson S. Francisco', category: 'Technician', position: 'Service Personnel', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 700, allowancePerDay: 0, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e19', name: 'Michael C. Dean', category: 'Technician', position: 'Service Technician', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 750, allowancePerDay: 0, fixedAllowance: 0, payCycle: '15-30', notes: '' },
    { id: 'e20', name: 'Alvin R. Vargas', category: 'Technician', position: 'Service Personnel', status: 'Active', employmentStatus: 'Probationary', dateHired: '', phone: '', email: '', payType: 'Daily', rate: 700, allowancePerDay: 0, fixedAllowance: 0, payCycle: '15-30', notes: '' },
  ];

  const candidates = [
    { id: 'c1', name: 'Patricia Gomez', category: 'HR', positionAppliedFor: 'HR Assistant', phone: '0917 555 2001', email: 'patricia.g@gmail.com', appliedDate: '2026-07-10', stage: 'Phone Interview', decision: null, tradeTestStart: null, tradeTestEnd: null, history: [
      { date: '2026-07-10', stage: 'Screening', note: 'Resume passed initial screening.' },
      { date: '2026-07-14', stage: 'Phone Interview', note: 'Phone interview scheduled for Jul 25.' },
    ] },
    { id: 'c2', name: 'Ronald Mercado', category: 'Admin', positionAppliedFor: 'HVAC Engineer', phone: '0917 555 2002', email: 'ronald.m@gmail.com', appliedDate: '2026-07-05', stage: '3-Day Trade Test', decision: null, tradeTestStart: '2026-07-21', tradeTestEnd: '2026-07-23', history: [
      { date: '2026-07-05', stage: 'Screening', note: 'Meets minimum experience requirement.' },
      { date: '2026-07-08', stage: 'Phone Interview', note: 'Good communication, available immediately.' },
      { date: '2026-07-15', stage: 'Face-to-Face Interview', note: 'Strong technical knowledge, passed to trade test.' },
      { date: '2026-07-21', stage: '3-Day Trade Test', note: 'Trade test started Jul 21, ends Jul 23.' },
    ] },
    { id: 'c3', name: 'Jonathan Perez', category: 'Technician', positionAppliedFor: 'AC Installation Tech', phone: '0917 555 2003', email: 'jonathan.p@gmail.com', appliedDate: '2026-07-01', stage: '7-Day Trade Test', decision: null, tradeTestStart: '2026-07-17', tradeTestEnd: '2026-07-24', history: [
      { date: '2026-07-01', stage: 'Screening', note: 'Basic qualifications confirmed.' },
      { date: '2026-07-03', stage: 'Phone Interview', note: 'Agreed to undergo trade test.' },
      { date: '2026-07-15', stage: 'Candidate Agreement', note: 'Confirmed availability, trade test scheduled.' },
      { date: '2026-07-17', stage: '7-Day Trade Test', note: '7-day trade test running Jul 17–24.' },
    ] },
    { id: 'c4', name: 'Erwin Salonga', category: 'Admin', positionAppliedFor: 'Office Admin', phone: '0917 555 2004', email: 'erwin.s@gmail.com', appliedDate: '2026-06-20', stage: 'Decision', decision: 'Hired', tradeTestStart: '2026-07-01', tradeTestEnd: '2026-07-03', history: [
      { date: '2026-06-20', stage: 'Screening', note: 'Qualified applicant.' },
      { date: '2026-06-23', stage: 'Phone Interview', note: 'Confirmed interest and availability.' },
      { date: '2026-06-27', stage: 'Face-to-Face Interview', note: 'Good cultural fit.' },
      { date: '2026-07-01', stage: '3-Day Trade Test', note: 'Completed trade test with good marks.' },
      { date: '2026-07-05', stage: 'Evaluation', note: 'Recommended for hiring by HR and Department Head.' },
      { date: '2026-07-08', stage: 'Decision', note: 'Approved for hiring by Management.' },
    ] },
    { id: 'c5', name: 'Kevin Ramos', category: 'Technician', positionAppliedFor: 'Refrigeration Tech', phone: '0917 555 2005', email: 'kevin.r@gmail.com', appliedDate: '2026-07-12', stage: 'Screening', decision: null, tradeTestStart: null, tradeTestEnd: null, history: [
      { date: '2026-07-12', stage: 'Screening', note: 'Resume received, pending review.' },
    ] },
  ];

  // No fabricated disciplinary cases or customer complaints are seeded against real staff —
  // these start empty and are meant to be entered as real events occur.
  const disciplinaryCases = [];
  const complaints = [];

  // Neutral "present" attendance seeded for the current pay period so payroll has
  // something to compute against; real day-to-day logging should replace this.
  const attendance = [];
  const today = todayISO();
  const todayD = new Date(today + 'T00:00:00');
  const startOfMonth = `${todayD.getFullYear()}-${pad2(todayD.getMonth() + 1)}-01`;
  let d = startOfMonth;
  while (d <= today) {
    const dow = new Date(d + 'T00:00:00').getDay();
    if (dow !== 0) {
      employees.forEach(e => {
        attendance.push({ id: genId('a'), employeeId: e.id, date: d, timeIn: '08:00', timeOut: '17:00', status: 'Present', hours: 8 });
      });
    }
    d = addDays(d, 1);
  }

  const deductions = [];

  const probationRecords = seedProbationRecords();

  // Per-employee, per-cutoff overrides for "days present" so HR can correct payroll
  // without having to edit every individual attendance record.
  const payrollOverrides = [];

  return { employees, candidates, disciplinaryCases, complaints, attendance, deductions, probationRecords, payrollOverrides };
}

const Store = (function () {
  let state = load();

  function migrate(s) {
    (s.employees || []).forEach(e => {
      if (e.category === 'Manager' || e.category === 'Engineer') e.category = 'Admin';
      if (!e.employmentStatus) e.employmentStatus = 'Regular';
    });
    (s.candidates || []).forEach(c => {
      if (c.category === 'Manager' || c.category === 'Engineer') c.category = 'Admin';
    });
    if (!s.probationRecords) s.probationRecords = seedProbationRecords();
    if (!s.payrollOverrides) s.payrollOverrides = [];
    (s.probationRecords || []).forEach(p => {
      if (p.thirdMonthStatus === 'Meets Expectations') p.thirdMonthStatus = 'On Track for Regularization';
      if (p.sixthMonthStatus === 'Not Regularized') p.sixthMonthStatus = 'End of Contract';
    });
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* fall through to seed */ }
    const seeded = seedData();
    persist(seeded);
    return seeded;
  }

  function persist(s) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  }

  function save() { persist(state); }

  function resetToSeed() {
    state = seedData();
    save();
  }

  // ---- Employees ----
  function listEmployees() { return state.employees.slice(); }
  function getEmployee(id) { return state.employees.find(e => e.id === id); }
  function addEmployee(emp) {
    emp.id = genId('e');
    state.employees.push(emp);
    save();
    return emp;
  }
  function updateEmployee(id, patch) {
    const e = getEmployee(id);
    if (e) { Object.assign(e, patch); save(); }
    return e;
  }
  function deleteEmployee(id) {
    state.employees = state.employees.filter(e => e.id !== id);
    save();
  }

  // ---- Recruitment ----
  function listCandidates() { return state.candidates.slice(); }
  function getCandidate(id) { return state.candidates.find(c => c.id === id); }
  function addCandidate(cand) {
    cand.id = genId('c');
    cand.history = [{ date: todayISO(), stage: cand.stage, note: 'Candidate added to pipeline.' }];
    state.candidates.push(cand);
    save();
    return cand;
  }
  function moveCandidateStage(id, newStage, note) {
    const c = getCandidate(id);
    if (!c) return;
    c.stage = newStage;
    if (newStage.includes('Trade Test')) {
      c.tradeTestStart = todayISO();
      c.tradeTestEnd = addDays(todayISO(), newStage.startsWith('7') ? 7 : 3);
    }
    c.history.push({ date: todayISO(), stage: newStage, note: note || ('Moved to ' + newStage + '.') });
    save();
    return c;
  }
  function decideCandidate(id, decision, note) {
    const c = getCandidate(id);
    if (!c) return;
    c.decision = decision;
    c.stage = 'Decision';
    c.history.push({ date: todayISO(), stage: 'Decision', note: note || (decision + ' by Management/HR.') });
    save();
    return c;
  }
  function deleteCandidate(id) {
    state.candidates = state.candidates.filter(c => c.id !== id);
    save();
  }

  // ---- Disciplinary ----
  function listCases() { return state.disciplinaryCases.slice(); }
  function getCase(id) { return state.disciplinaryCases.find(c => c.id === id); }
  function addCase(nte) {
    nte.id = genId('d');
    nte.status = 'Notice Issued';
    nte.history = [{ date: nte.dateIssued, action: 'Notice Issued', note: nte.violation }];
    state.disciplinaryCases.push(nte);
    save();
    return nte;
  }
  function updateCase(id, patch, historyEntry) {
    const c = getCase(id);
    if (!c) return;
    Object.assign(c, patch);
    if (historyEntry) c.history.push(Object.assign({ date: todayISO() }, historyEntry));
    save();
    return c;
  }
  function deleteCase(id) {
    state.disciplinaryCases = state.disciplinaryCases.filter(c => c.id !== id);
    save();
  }

  // ---- Complaints ----
  function listComplaints() { return state.complaints.slice(); }
  function getComplaint(id) { return state.complaints.find(c => c.id === id); }
  function addComplaint(cp) {
    cp.id = genId('cp');
    state.complaints.push(cp);
    save();
    return cp;
  }
  function updateComplaint(id, patch) {
    const c = getComplaint(id);
    if (c) { Object.assign(c, patch); save(); }
    return c;
  }
  function deleteComplaint(id) {
    state.complaints = state.complaints.filter(c => c.id !== id);
    save();
  }

  // ---- Attendance ----
  function listAttendance() { return state.attendance.slice(); }
  function attendanceForDate(date) { return state.attendance.filter(a => a.date === date); }
  function attendanceInRange(from, to) { return state.attendance.filter(a => a.date >= from && a.date <= to); }
  function addAttendance(rec) {
    rec.id = genId('a');
    state.attendance.push(rec);
    save();
    return rec;
  }
  function updateAttendance(id, patch) {
    const a = state.attendance.find(x => x.id === id);
    if (a) { Object.assign(a, patch); save(); }
    return a;
  }
  function deleteAttendance(id) {
    state.attendance = state.attendance.filter(a => a.id !== id);
    save();
  }

  // ---- Probation / Regularization ----
  function listProbations() { return state.probationRecords.slice(); }
  function getProbation(id) { return state.probationRecords.find(p => p.id === id); }
  function getProbationByEmployee(employeeId) { return state.probationRecords.find(p => p.employeeId === employeeId); }
  function addProbation(rec) {
    rec.id = genId('pr');
    state.probationRecords.push(rec);
    save();
    return rec;
  }
  function updateProbation(id, patch) {
    const p = getProbation(id);
    if (p) { Object.assign(p, patch); save(); }
    return p;
  }
  function deleteProbation(id) {
    state.probationRecords = state.probationRecords.filter(p => p.id !== id);
    save();
  }

  // ---- Payroll overrides (editable "days present" per employee per cutoff) ----
  function getPayrollOverride(employeeId, cutoffFrom) {
    return state.payrollOverrides.find(o => o.employeeId === employeeId && o.cutoffFrom === cutoffFrom);
  }
  function setPayrollOverride(employeeId, cutoffFrom, daysPresent) {
    const existing = getPayrollOverride(employeeId, cutoffFrom);
    if (existing) { existing.daysPresent = daysPresent; }
    else { state.payrollOverrides.push({ id: genId('po'), employeeId, cutoffFrom, daysPresent }); }
    save();
  }

  // ---- Deductions ----
  function listDeductions() { return state.deductions.slice(); }
  function deductionsInRange(from, to) { return state.deductions.filter(d => d.date >= from && d.date <= to); }
  function addDeduction(d) {
    d.id = genId('ded');
    state.deductions.push(d);
    save();
    return d;
  }
  function deleteDeduction(id) {
    state.deductions = state.deductions.filter(d => d.id !== id);
    save();
  }

  return {
    resetToSeed,
    listEmployees, getEmployee, addEmployee, updateEmployee, deleteEmployee,
    listCandidates, getCandidate, addCandidate, moveCandidateStage, decideCandidate, deleteCandidate,
    listCases, getCase, addCase, updateCase, deleteCase,
    listComplaints, getComplaint, addComplaint, updateComplaint, deleteComplaint,
    listAttendance, attendanceForDate, attendanceInRange, addAttendance, updateAttendance, deleteAttendance,
    listDeductions, deductionsInRange, addDeduction, deleteDeduction,
    listProbations, getProbation, getProbationByEmployee, addProbation, updateProbation, deleteProbation,
    getPayrollOverride, setPayrollOverride,
  };
})();
