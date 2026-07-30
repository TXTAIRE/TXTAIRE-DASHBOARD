-- TxTAIRE — Supabase schema
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).
--
-- Column names are quoted camelCase to match the JSON shapes js/store.js already produces,
-- so the app's view files need no field-mapping layer.
--
-- Security model: RLS is enabled on every table, and every policy grants access to the
-- `authenticated` role only. The `anon` role gets nothing — an unauthenticated request
-- (no valid session) is denied at the database level, not just hidden by the login screen.

-- ---------- employees ----------
create table employees (
  id text primary key,
  name text not null,
  category text not null,                     -- 'Admin' | 'Technician'
  position text,
  status text not null default 'Active',
  "employmentStatus" text not null default 'Regular',
  "dateHired" date,
  phone text,
  email text,
  "payType" text not null,                     -- 'Daily' | 'Monthly'
  rate numeric(12,2) not null default 0,
  "allowancePerDay" numeric(12,2) not null default 0,        -- Cost of Living Allowance (COLA), per day
  "fixedAllowance" numeric(12,2) not null default 0,          -- COLA, flat amount per cutoff
  "housingAllowance" numeric(12,2) not null default 0,        -- Housing/lodging allowance, flat amount per cutoff (distinct from COLA)
  "nightShiftDifferential" boolean not null default false,    -- "Typically works night shift" — does NOT affect NSD pay
                                                                -- itself (that's always computed from actual logged
                                                                -- timeIn/timeOut vs. the 10pm-6am window, see
                                                                -- js/store.js nightOverlapHours); only used to default
                                                                -- the Attendance form's Time In/Out for this employee.
  "payCycle" text not null,                    -- '10-20' | '15-30'
  notes text default '',
  "employeeCode" text unique,                  -- Employee Self-Service login ID = real company Employee Number, e.g. 'TXT015'
  "authUserId" uuid references auth.users(id), -- set once ESS portal access is granted (js/views/staff.js
                                                -- "Grant portal access"); null = no portal login yet.
  "bankAccountNumber" text,                    -- editable by the employee themselves (My Portal) or HR;
  "bankQrPath" text,                           -- storage.objects path in the private "bank-qr" bucket.
                                                -- Only ever readable by that one employee (RLS: id = my_employee_id())
                                                -- or an admin -- never by any other employee.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- candidates (recruitment) ----------
create table candidates (
  id text primary key,
  name text not null,
  category text not null,
  "positionAppliedFor" text,
  phone text,
  email text,
  "appliedDate" date,
  stage text not null,
  decision text,                               -- null | 'Hired' | 'On Hold' | 'Rejected'
  "tradeTestStart" date,
  "tradeTestEnd" date,
  history jsonb not null default '[]'::jsonb,  -- [{date, stage, note}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- disciplinaryCases ----------
create table "disciplinaryCases" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  "dateIssued" date not null,
  "responseDueDate" date,
  "issuedBy" text,
  violation text not null,
  "noticeText" text,
  "employeeResponse" text default '',
  "employeeResponseDate" date,
  "investigationNotes" text default '',
  resolution text default '',
  "resolvedDate" date,
  status text not null default 'Notice Issued',
  history jsonb not null default '[]'::jsonb,  -- [{date, action, note}]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- complaints ----------
create table complaints (
  id text primary key,
  "customerName" text not null,
  contact text,
  "dateReceived" date not null,
  priority text not null default 'Medium',     -- 'Low' | 'Medium' | 'High'
  "assignedTo" text references employees(id) on delete set null,
  description text,
  status text not null default 'Open',
  "resolutionNotes" text default '',
  "resolvedDate" date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- attendance ----------
create table attendance (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  date date not null,
  "timeIn" text,
  "timeOut" text,
  status text not null default 'Present',
  hours numeric(4,2) default 0,
  "timeInPhotoPath" text,   -- storage.objects path in the private "attendance-photos" bucket
  "timeOutPhotoPath" text,  -- (self-clock-in/out photo proof), null for HR-entered records
  -- Employee requests NSD/OT/Holiday-premium pay for this day; null | 'Requested' |
  -- 'Approved' | 'Rejected'. Only 'Approved' counts toward pay (js/store.js computeDayPay) —
  -- a trigger below stops employees from setting anything other than null/'Requested'
  -- themselves, so only HR can actually approve.
  "nsdStatus" text,
  "otStatus" text,
  "holidayStatus" text,
  -- HR-editable OT hours for this day; null means "use hours - 8" (js/store.js
  -- computeDayPay), set means HR has explicitly overridden the number of hours that
  -- actually count as overtime (e.g. to exclude a break, or cap it below the raw
  -- clock-time difference). Only ever matters once otStatus is 'Approved'.
  "otHours" numeric(5,2),
  -- Who approved each one and when — stamped automatically by a trigger the instant a
  -- status column actually transitions to 'Approved' (and cleared if it's ever un-approved),
  -- so there's always a clear audit trail distinguishing a genuine HR approval from any
  -- other value. Never set directly by application code.
  "otApprovedBy" text,
  "otApprovedAt" timestamptz,
  "nsdApprovedBy" text,
  "nsdApprovedAt" timestamptz,
  "holidayApprovedBy" text,
  "holidayApprovedAt" timestamptz,
  -- Optional per-record override: 'Regular' | 'Special' | null. Lets HR grant the holiday
  -- premium for this specific employee's day even when the date isn't on the shared
  -- Holidays list; falls back to that list's type when this is null (js/store.js
  -- computeDayPay). Doesn't affect the absent-but-still-paid rule, which only ever looks
  -- at the real shared-list holiday.
  "holidayType" text,
  created_at timestamptz not null default now()
);

-- ---------- deductions ----------
create table deductions (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  date date not null,
  kind text not null,                          -- 'Cash Advance' | 'Tardy' | 'Damage' | 'Other'
  notes text default '',
  amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- probationRecords ----------
create table "probationRecords" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  "startDate" date not null,
  "thirdMonthStatus" text not null default 'Pending',
  "thirdMonthEvaluatedDate" date,
  "thirdMonthNotes" text default '',
  "sixthMonthStatus" text not null default 'Pending',
  "sixthMonthEvaluatedDate" date,
  "sixthMonthNotes" text default '',
  created_at timestamptz not null default now()
);

-- ---------- payrollOverrides ----------
create table "payrollOverrides" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  "cutoffFrom" date not null,
  "daysPresent" numeric(4,2),
  "daysAbsent" numeric(4,2),
  "basePay" numeric(12,2),
  cola numeric(12,2),
  housing numeric(12,2),
  nsd numeric(12,2),
  ot numeric(12,2),
  holiday numeric(12,2),
  unique("employeeId", "cutoffFrom")
);

-- ---------- holidays ----------
-- Reference calendar for Philippine holiday pay. Populate with the officially proclaimed
-- dates for each year — deliberately seeded empty rather than guessed, since exact dates
-- for movable/proclaimed holidays (Eid'l Fitr, Eid'l Adha, National Heroes Day, special
-- non-working days, etc.) are only certain once Malacañang issues the proclamation.
create table holidays (
  id text primary key,
  date date not null unique,
  name text not null,
  type text not null default 'Regular'         -- 'Regular' | 'Special Non-Working'
);

-- ---------- payCutoffSettings ----------
-- Editable cutoff-day boundaries per pay group, replacing what used to be hardcoded in
-- js/store.js's payCutoffs(). Both halves are defined purely by where each one ENDS --
-- cutoff A runs from the day after cutoff B's previous end through cutoffAEndDay, and
-- cutoff B runs from the day after cutoffAEndDay through cutoffBEndDay -- so every day of
-- the month always falls in exactly one cutoff, with no gap, by construction.
create table "payCutoffSettings" (
  "payCycle" text primary key,        -- '10-20' | '15-30'
  "cutoffAEndDay" int not null,
  "paydayADay" int not null,
  "cutoffBEndDay" int not null,
  "paydayBDay" int not null,
  updated_at timestamptz not null default now()
);

-- ---------- leaveRequests (Employee Self-Service) ----------
create table "leaveRequests" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  "leaveType" text not null,                   -- 'Vacation' | 'Sick' | 'Emergency' | 'Other'
  "startDate" date not null,
  "endDate" date not null,
  reason text default '',
  status text not null default 'Pending',      -- 'Pending' | 'Approved' | 'Rejected'
  "reviewedBy" text,
  "reviewedDate" date,
  "reviewNotes" text default '',
  created_at timestamptz not null default now()
);

-- ---------- attendanceCorrections (Employee Self-Service) ----------
-- An employee's request to fix a specific day's attendance (e.g. "forgot to time out").
-- HR reviews and, if approved, edits the real attendance record via the normal Attendance
-- page — approving here does not itself change the attendance row.
create table "attendanceCorrections" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  date date not null,
  description text not null,
  "requestedTimeIn" text,
  "requestedTimeOut" text,
  status text not null default 'Pending',      -- 'Pending' | 'Approved' | 'Rejected'
  "reviewedBy" text,
  "reviewedDate" date,
  "reviewNotes" text default '',
  created_at timestamptz not null default now()
);

-- ---------- auditLog ----------
-- Populated automatically by js/store.js's insertRow/updateRow/deleteRow — not written to
-- directly by any view. Read-only in the app (see js/views/auditLog.js).
create table "auditLog" (
  id text primary key,
  "actorEmail" text,
  action text not null,                        -- e.g. 'employees.update', 'attendance.insert'
  "targetTable" text not null,
  "targetId" text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =================================================================
-- RBAC helpers — every policy below is built from these two functions.
-- An "admin" is any authenticated user whose auth.uid() is NOT linked from any employees
-- row; an "employee" is one that is linked (via employees."authUserId"), and is restricted
-- to their own data only. security definer + a pinned search_path lets these read
-- `employees` regardless of the calling role's own RLS (avoids policy recursion).
-- =================================================================
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from employees where "authUserId" = auth.uid());
$$;

create or replace function my_employee_id() returns text
language sql stable security definer set search_path = public as $$
  select id from employees where "authUserId" = auth.uid();
$$;

-- =================================================================
-- Row Level Security — authenticated users only, anon gets nothing.
-- Admins (is_admin()) keep full access to everything, unchanged from before. Employees
-- (linked via authUserId) get read-only access to their own row on the tables relevant
-- to the ESS portal, plus the ability to submit (not edit/delete) leave requests and
-- attendance corrections.
-- =================================================================

alter table employees enable row level security;
alter table candidates enable row level security;
alter table "disciplinaryCases" enable row level security;
alter table complaints enable row level security;
alter table attendance enable row level security;
alter table deductions enable row level security;
alter table "probationRecords" enable row level security;
alter table "payrollOverrides" enable row level security;
alter table holidays enable row level security;
alter table "payCutoffSettings" enable row level security;
alter table "leaveRequests" enable row level security;
alter table "attendanceCorrections" enable row level security;
alter table "auditLog" enable row level security;

-- Admin-only tables — unchanged from before, just re-expressed via is_admin().
create policy "admin full access" on candidates
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "disciplinaryCases"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on complaints
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "probationRecords"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "auditLog"
  for all to authenticated using (is_admin()) with check (is_admin());

-- Shared tables — admins get full access; employees get read-only access to their own row.
create policy "admin full access" on employees
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own row" on employees
  for select to authenticated using (id = my_employee_id());
-- Employees may update their own row (My Portal "Edit Profile"), but the trigger below
-- restricts this to contact info and bank details only -- HR-controlled fields (pay,
-- category, status, employeeCode, authUserId, etc.) can never be changed this way.
create policy "employee updates own contact and bank info" on employees
  for update to authenticated
  using (id = my_employee_id())
  with check (id = my_employee_id());

create or replace function enforce_employee_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
    or new.name is distinct from old.name
    or new.category is distinct from old.category
    or new.position is distinct from old.position
    or new.status is distinct from old.status
    or new."employmentStatus" is distinct from old."employmentStatus"
    or new."dateHired" is distinct from old."dateHired"
    or new."payType" is distinct from old."payType"
    or new.rate is distinct from old.rate
    or new."allowancePerDay" is distinct from old."allowancePerDay"
    or new."fixedAllowance" is distinct from old."fixedAllowance"
    or new."housingAllowance" is distinct from old."housingAllowance"
    or new."nightShiftDifferential" is distinct from old."nightShiftDifferential"
    or new."payCycle" is distinct from old."payCycle"
    or new.notes is distinct from old.notes
    or new."employeeCode" is distinct from old."employeeCode"
    or new."authUserId" is distinct from old."authUserId"
  then
    raise exception 'Employees may only update their own contact info and bank details';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_profile_update on employees;
create trigger trg_employee_profile_update
  before update on employees
  for each row execute function enforce_employee_profile_update();

create policy "admin full access" on attendance
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own attendance" on attendance
  for select to authenticated using ("employeeId" = my_employee_id());
-- Self clock-in/out: an employee may create today's own attendance row (Time In).
-- Employees may also edit (Time In/Out, status) or delete their own attendance record on
-- ANY day, past included -- explicit product decision so they can correct a mistake
-- without waiting on HR. Deletes/updates are still captured in auditLog (employees have
-- no access to that table themselves), so HR retains a full record of what changed even
-- though the live data doesn't show the original values anymore.
create policy "employee clocks in for today" on attendance
  for insert to authenticated with check ("employeeId" = my_employee_id() and date = current_date);
create policy "employee deletes own attendance" on attendance
  for delete to authenticated using ("employeeId" = my_employee_id());

-- The trigger below still blocks changing which day or whose record this is (date,
-- employeeId) -- that boundary never loosens -- but timeIn/timeOut/hours/status can now
-- be edited by the employee themselves on any of their own rows, any day.
create policy "employee updates own attendance" on attendance
  for update to authenticated
  using ("employeeId" = my_employee_id())
  with check ("employeeId" = my_employee_id());

create or replace function enforce_employee_attendance_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  -- Which day this is and whose record it is never change through this path, on any day
  -- (past or present). Everything else about the record (timeIn/timeOut/hours/status,
  -- photo fields) the employee may edit themselves, any day, per product decision.
  if new.date is distinct from old.date
    or new."employeeId" is distinct from old."employeeId"
  then
    raise exception 'Employees may not change the date or owner of an attendance record';
  end if;
  -- Employees can request NSD/OT/Holiday pay (or cancel their own pending request back to
  -- null), but only HR can move a request to Approved/Rejected — enforced here rather than
  -- trusted to app code, since this is the actual pay-approval boundary.
  if (new."nsdStatus" is distinct from old."nsdStatus" and new."nsdStatus" is not null and new."nsdStatus" != 'Requested')
    or (new."otStatus" is distinct from old."otStatus" and new."otStatus" is not null and new."otStatus" != 'Requested')
    or (new."holidayStatus" is distinct from old."holidayStatus" and new."holidayStatus" is not null and new."holidayStatus" != 'Requested')
  then
    raise exception 'Employees may only request NSD/OT/Holiday pay, not approve or reject it';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_attendance_update on attendance;
create trigger trg_employee_attendance_update
  before update on attendance
  for each row execute function enforce_employee_attendance_update();

-- Stamps who approved OT/NSD/Holiday pay and when, the instant a status column actually
-- transitions to 'Approved' -- and clears the stamp if it's ever un-approved, so a stale
-- name/date never lingers next to a status that isn't Approved anymore. Runs regardless
-- of which code path made the change, so it can't be bypassed or forgotten by app code.
-- auth.jwt()->>'email' reads straight from the current request's JWT, no auth.users
-- lookup needed. Since enforce_employee_attendance_update (above) already blocks an
-- employee from ever setting these columns to 'Approved' themselves, the "newly
-- approved" branch here only ever fires for an actual HR/admin action.
create or replace function stamp_attendance_approvals() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := auth.jwt() ->> 'email';
  -- OLD isn't assigned at all for an INSERT (referencing it directly would error), so
  -- these CASE expressions -- which short-circuit -- stand in for "no previous value" on
  -- insert without ever touching OLD in that case.
  old_ot text := (case when TG_OP = 'INSERT' then null else old."otStatus" end);
  old_nsd text := (case when TG_OP = 'INSERT' then null else old."nsdStatus" end);
  old_holiday text := (case when TG_OP = 'INSERT' then null else old."holidayStatus" end);
begin
  if new."otStatus" = 'Approved' and (old_ot is distinct from 'Approved') then
    new."otApprovedBy" := actor;
    new."otApprovedAt" := now();
  elsif new."otStatus" is distinct from 'Approved' then
    new."otApprovedBy" := null;
    new."otApprovedAt" := null;
  end if;

  if new."nsdStatus" = 'Approved' and (old_nsd is distinct from 'Approved') then
    new."nsdApprovedBy" := actor;
    new."nsdApprovedAt" := now();
  elsif new."nsdStatus" is distinct from 'Approved' then
    new."nsdApprovedBy" := null;
    new."nsdApprovedAt" := null;
  end if;

  if new."holidayStatus" = 'Approved' and (old_holiday is distinct from 'Approved') then
    new."holidayApprovedBy" := actor;
    new."holidayApprovedAt" := now();
  elsif new."holidayStatus" is distinct from 'Approved' then
    new."holidayApprovedBy" := null;
    new."holidayApprovedAt" := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_attendance_approvals on attendance;
create trigger trg_stamp_attendance_approvals
  before insert or update on attendance
  for each row execute function stamp_attendance_approvals();

create policy "admin full access" on deductions
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own deductions" on deductions
  for select to authenticated using ("employeeId" = my_employee_id());

create policy "admin full access" on "payrollOverrides"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own payroll overrides" on "payrollOverrides"
  for select to authenticated using ("employeeId" = my_employee_id());

-- Holidays: not sensitive, every authenticated user (admin or employee) can read; only
-- admins can add/edit/delete.
create policy "admin full access" on holidays
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads holidays" on holidays
  for select to authenticated using (true);

-- Cutoff-day settings: same as holidays -- not sensitive, needed by every employee's My
-- Payroll page to show the right cutoff/payday, only admins can edit.
create policy "admin full access" on "payCutoffSettings"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads pay cutoff settings" on "payCutoffSettings"
  for select to authenticated using (true);

-- Leave requests / attendance corrections: admins manage everything (review, approve,
-- reject); employees can submit their own and read their own history, but never edit or
-- delete an existing request (only HR changes status/reviewNotes).
create policy "admin full access" on "leaveRequests"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own leave requests" on "leaveRequests"
  for select to authenticated using ("employeeId" = my_employee_id());
create policy "employee submits own leave requests" on "leaveRequests"
  for insert to authenticated with check ("employeeId" = my_employee_id());

create policy "admin full access" on "attendanceCorrections"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own attendance corrections" on "attendanceCorrections"
  for select to authenticated using ("employeeId" = my_employee_id());
create policy "employee submits own attendance corrections" on "attendanceCorrections"
  for insert to authenticated with check ("employeeId" = my_employee_id());

-- =================================================================
-- Storage — private bucket for self-clock-in/out photo proof. Objects are stored under
-- "<employeeId>/<filename>", so (storage.foldername(name))[1] is the owning employee's id.
-- =================================================================
insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do nothing;

create policy "employee uploads own attendance photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());
create policy "employee reads own attendance photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());
create policy "employee deletes own attendance photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());
create policy "admin full access to attendance photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'attendance-photos' and is_admin())
  with check (bucket_id = 'attendance-photos' and is_admin());

-- =================================================================
-- Storage — private bucket for each employee's bank QR code (GCash/Maya/bank app QR,
-- so HR can pay them without manually re-typing account numbers). Same
-- "<employeeId>/<filename>" convention as attendance-photos; only that one employee and
-- admins can ever read it.
-- =================================================================
insert into storage.buckets (id, name, public)
values ('bank-qr', 'bank-qr', false)
on conflict (id) do nothing;

create policy "employee uploads own bank qr" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
create policy "employee reads own bank qr" on storage.objects
  for select to authenticated
  using (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
create policy "employee deletes own bank qr" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
create policy "admin full access to bank qr" on storage.objects
  for all to authenticated
  using (bucket_id = 'bank-qr' and is_admin())
  with check (bucket_id = 'bank-qr' and is_admin());

-- =================================================================
-- Realtime — publish every table so the app's subscriptions receive changes
-- =================================================================
alter publication supabase_realtime add table
  employees, candidates, "disciplinaryCases", complaints,
  attendance, deductions, "probationRecords", "payrollOverrides", holidays,
  "payCutoffSettings", "leaveRequests", "attendanceCorrections", "auditLog";

-- Seed the two pay groups' cutoff-day settings with the values that used to be hardcoded,
-- so behavior is unchanged until HR actually edits them from the Calendar tab.
insert into "payCutoffSettings" ("payCycle", "cutoffAEndDay", "paydayADay", "cutoffBEndDay", "paydayBDay") values
  ('10-20', 3, 5, 18, 20),
  ('15-30', 10, 15, 25, 30)
on conflict ("payCycle") do nothing;

-- =================================================================
-- Incremental migration — if you already ran this schema before the "holidays"
-- table existed, running the whole file again will fail on the earlier `create table`
-- statements (tables already exist). Run ONLY this block instead in that case.
-- =================================================================
-- create table holidays (
--   id text primary key,
--   date date not null unique,
--   name text not null,
--   type text not null default 'Regular'
-- );
-- alter table holidays enable row level security;
-- create policy "authenticated full access" on holidays
--   for all to authenticated using (true) with check (true);
-- alter publication supabase_realtime add table holidays;

-- If you already ran this schema before the "housingAllowance" column existed:
-- alter table employees add column if not exists "housingAllowance" numeric(12,2) not null default 0;

-- If you already ran this schema before "daysAbsent" was added to payrollOverrides
-- (and before "daysPresent" became nullable, to allow an absent-only override row):
-- alter table "payrollOverrides" add column if not exists "daysAbsent" numeric(4,2);
-- alter table "payrollOverrides" alter column "daysPresent" drop not null;

-- If you already ran this schema before cola/housing/nsd/ot/holiday were added to
-- payrollOverrides (to let HR manually enter those figures per employee per cutoff):
-- alter table "payrollOverrides" add column if not exists cola numeric(12,2);
-- alter table "payrollOverrides" add column if not exists housing numeric(12,2);
-- alter table "payrollOverrides" add column if not exists nsd numeric(12,2);
-- alter table "payrollOverrides" add column if not exists ot numeric(12,2);
-- alter table "payrollOverrides" add column if not exists holiday numeric(12,2);

-- If you already ran this schema before "basePay" was added to payrollOverrides:
-- alter table "payrollOverrides" add column if not exists "basePay" numeric(12,2);

-- =================================================================
-- Employee Self-Service (ESS) migration — run this ONCE against a database that already
-- has the schema above (i.e. everything up to and including "auditLog"). This adds the
-- ESS columns/tables/functions and — critically — REPLACES the old "authenticated full
-- access using (true)" policies with the admin/employee-scoped pair. Skipping the DROP
-- POLICY statements would leave the old blanket policy in place, which still grants a
-- linked employee full access to everyone's data regardless of the new policies.
-- =================================================================

alter table employees add column if not exists "employeeCode" text unique;
alter table employees add column if not exists "authUserId" uuid references auth.users(id);

create table if not exists "leaveRequests" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  "leaveType" text not null,
  "startDate" date not null,
  "endDate" date not null,
  reason text default '',
  status text not null default 'Pending',
  "reviewedBy" text,
  "reviewedDate" date,
  "reviewNotes" text default '',
  created_at timestamptz not null default now()
);

create table if not exists "attendanceCorrections" (
  id text primary key,
  "employeeId" text not null references employees(id) on delete cascade,
  date date not null,
  description text not null,
  "requestedTimeIn" text,
  "requestedTimeOut" text,
  status text not null default 'Pending',
  "reviewedBy" text,
  "reviewedDate" date,
  "reviewNotes" text default '',
  created_at timestamptz not null default now()
);

create table if not exists "auditLog" (
  id text primary key,
  "actorEmail" text,
  action text not null,
  "targetTable" text not null,
  "targetId" text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table "leaveRequests" enable row level security;
alter table "attendanceCorrections" enable row level security;
alter table "auditLog" enable row level security;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from employees where "authUserId" = auth.uid());
$$;

create or replace function my_employee_id() returns text
language sql stable security definer set search_path = public as $$
  select id from employees where "authUserId" = auth.uid();
$$;

-- Drop every old blanket policy, then recreate the admin/employee-scoped pairs.
drop policy if exists "authenticated full access" on employees;
drop policy if exists "authenticated full access" on candidates;
drop policy if exists "authenticated full access" on "disciplinaryCases";
drop policy if exists "authenticated full access" on complaints;
drop policy if exists "authenticated full access" on attendance;
drop policy if exists "authenticated full access" on deductions;
drop policy if exists "authenticated full access" on "probationRecords";
drop policy if exists "authenticated full access" on "payrollOverrides";
drop policy if exists "authenticated full access" on holidays;

create policy "admin full access" on candidates
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "disciplinaryCases"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on complaints
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "probationRecords"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin full access" on "auditLog"
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "admin full access" on employees
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own row" on employees
  for select to authenticated using (id = my_employee_id());

create policy "admin full access" on attendance
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own attendance" on attendance
  for select to authenticated using ("employeeId" = my_employee_id());
create policy "employee clocks in for today" on attendance
  for insert to authenticated with check ("employeeId" = my_employee_id() and date = current_date);
create policy "employee clocks out for today" on attendance
  for update to authenticated
  using ("employeeId" = my_employee_id() and date = current_date)
  with check ("employeeId" = my_employee_id() and date = current_date);

create policy "admin full access" on deductions
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own deductions" on deductions
  for select to authenticated using ("employeeId" = my_employee_id());

create policy "admin full access" on "payrollOverrides"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own payroll overrides" on "payrollOverrides"
  for select to authenticated using ("employeeId" = my_employee_id());

create policy "admin full access" on holidays
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads holidays" on holidays
  for select to authenticated using (true);

create policy "admin full access" on "leaveRequests"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own leave requests" on "leaveRequests"
  for select to authenticated using ("employeeId" = my_employee_id());
create policy "employee submits own leave requests" on "leaveRequests"
  for insert to authenticated with check ("employeeId" = my_employee_id());

create policy "admin full access" on "attendanceCorrections"
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own attendance corrections" on "attendanceCorrections"
  for select to authenticated using ("employeeId" = my_employee_id());
create policy "employee submits own attendance corrections" on "attendanceCorrections"
  for insert to authenticated with check ("employeeId" = my_employee_id());

alter publication supabase_realtime add table "leaveRequests", "attendanceCorrections", "auditLog";

-- One-time: assign each employee their real company Employee Number (per HR's official
-- roster spreadsheet, TXT000..TXT022) so each can later be granted ESS portal access.
-- Superseded the earlier placeholder TXAT-001..TXAT-020 scheme below.
update employees set "employeeCode" = 'TXT001' where id = 'e_bultron';
update employees set "employeeCode" = 'TXT002' where id = 'e_casano';
update employees set "employeeCode" = 'TXT006' where id = 'e_sangcupan';
update employees set "employeeCode" = 'TXT020' where id = 'e_famini';
update employees set "employeeCode" = 'TXT003' where id = 'e_soriano';
update employees set "employeeCode" = 'TXT004' where id = 'e_nabora';
update employees set "employeeCode" = 'TXT019' where id = 'e_cosme';
update employees set "employeeCode" = 'TXT007' where id = 'e_arnel_parala';
update employees set "employeeCode" = 'TXT008' where id = 'e_argee_parala';
update employees set "employeeCode" = 'TXT009' where id = 'e_michael_parala';
update employees set "employeeCode" = 'TXT010' where id = 'e_aldrin_parala';
update employees set "employeeCode" = 'TXT011' where id = 'e_cabanez';
update employees set "employeeCode" = 'TXT012' where id = 'e_rotazo';
update employees set "employeeCode" = 'TXT013' where id = 'e_delacruz';
update employees set "employeeCode" = 'TXT014' where id = 'e_albano';
update employees set "employeeCode" = 'TXT015' where id = 'e_dulfo';
update employees set "employeeCode" = 'TXT016' where id = 'e_alomia';
update employees set "employeeCode" = 'TXT018' where id = 'e_francisco';
update employees set "employeeCode" = 'TXT021' where id = 'e_dean';
update employees set "employeeCode" = 'TXT022' where id = 'e_vargas';
-- Not yet in this system — TXT000 Joel M. Aviso (President), TXT005 Anie Lou A. Bangay
-- (Accounting & Finance Manager), and TXT017 Dino Dulfo (Service Technician) appear on
-- the roster sheet but have no employee record here yet. Ask HR for their rate/pay type/
-- category before adding them, so payroll numbers aren't guessed.

-- =================================================================
-- Self clock-in/out with photo proof — incremental migration. Run this once against a
-- database that already has the ESS migration above applied. Safe to re-run.
-- =================================================================

alter table attendance add column if not exists "timeInPhotoPath" text;
alter table attendance add column if not exists "timeOutPhotoPath" text;

drop policy if exists "employee clocks in for today" on attendance;
create policy "employee clocks in for today" on attendance
  for insert to authenticated with check ("employeeId" = my_employee_id() and date = current_date);

drop policy if exists "employee clocks out for today" on attendance;
create policy "employee clocks out for today" on attendance
  for update to authenticated
  using ("employeeId" = my_employee_id() and date = current_date)
  with check ("employeeId" = my_employee_id() and date = current_date);

insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do nothing;

drop policy if exists "employee uploads own attendance photos" on storage.objects;
create policy "employee uploads own attendance photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());

drop policy if exists "employee reads own attendance photos" on storage.objects;
create policy "employee reads own attendance photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());

drop policy if exists "admin full access to attendance photos" on storage.objects;
create policy "admin full access to attendance photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'attendance-photos' and is_admin())
  with check (bucket_id = 'attendance-photos' and is_admin());

-- =================================================================
-- Employee delete-and-redo for today's own attendance — incremental migration. Run once
-- against a database that already has the migrations above applied. Safe to re-run.
-- Lets an employee delete their own Time In/Out record (and its photo) for today only,
-- to log it again from scratch. The delete itself is still captured in auditLog.
-- =================================================================

drop policy if exists "employee deletes own attendance for today" on attendance;
create policy "employee deletes own attendance for today" on attendance
  for delete to authenticated using ("employeeId" = my_employee_id() and date = current_date);

drop policy if exists "employee deletes own attendance photos" on storage.objects;
create policy "employee deletes own attendance photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attendance-photos' and (storage.foldername(name))[1] = my_employee_id());

-- =================================================================
-- Photo Gallery — incremental migration. Run once against a database that already has the
-- migrations above applied. Safe to re-run. Lets an employee delete an attendance photo
-- from ANY day, past or present (the old "today only" UPDATE policy is replaced with a
-- wider one) — but a trigger still blocks changing the actual timeIn/timeOut/hours/status
-- on any row that isn't today's, so this only ever lets a past row's photo be cleared, not
-- its recorded time rewritten.
-- =================================================================

drop policy if exists "employee clocks out for today" on attendance;
drop policy if exists "employee updates own attendance" on attendance;
create policy "employee updates own attendance" on attendance
  for update to authenticated
  using ("employeeId" = my_employee_id())
  with check ("employeeId" = my_employee_id());

create or replace function enforce_employee_attendance_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if old.date < current_date then
    if new.date is distinct from old.date
      or new."employeeId" is distinct from old."employeeId"
      or new."timeIn" is distinct from old."timeIn"
      or new."timeOut" is distinct from old."timeOut"
      or new.hours is distinct from old.hours
      or new.status is distinct from old.status
    then
      raise exception 'Employees may only clear/replace photo fields on past attendance records';
    end if;
  end if;
  -- Employees can request NSD/OT/Holiday pay (or cancel their own pending request back to
  -- null), but only HR can move a request to Approved/Rejected — enforced here rather than
  -- trusted to app code, since this is the actual pay-approval boundary.
  if (new."nsdStatus" is distinct from old."nsdStatus" and new."nsdStatus" is not null and new."nsdStatus" != 'Requested')
    or (new."otStatus" is distinct from old."otStatus" and new."otStatus" is not null and new."otStatus" != 'Requested')
    or (new."holidayStatus" is distinct from old."holidayStatus" and new."holidayStatus" is not null and new."holidayStatus" != 'Requested')
  then
    raise exception 'Employees may only request NSD/OT/Holiday pay, not approve or reject it';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_attendance_update on attendance;
create trigger trg_employee_attendance_update
  before update on attendance
  for each row execute function enforce_employee_attendance_update();

-- =================================================================
-- NSD/OT/Holiday pay request-and-approve workflow — incremental migration. Run once
-- against a database that already has the migrations above applied.
-- Employees request from My Portal; only HR approving in the dashboard makes it count
-- toward pay (js/store.js computeDayPay checks for 'Approved' specifically).
--
-- IMPORTANT — the column adds below are safe to re-run, but the one-time backfill that
-- used to live here is NOT, and has been removed. It back-approved every existing record
-- with hours > 8 the day this feature was introduced (a one-time, already-applied data
-- migration, not an ongoing rule) — re-running it would silently auto-approve OT/NSD/
-- Holiday pay for ANY current record with a null status, including a Late employee's
-- day whose Time Out just happens to push hours past 8 and that HR has never actually
-- reviewed. OT/NSD/Holiday pay must always go through an explicit HR approval
-- (js/views/attendance.js's Requests tab or the Edit Attendance modal) — never automatic.
-- =================================================================

alter table attendance add column if not exists "nsdStatus" text;
alter table attendance add column if not exists "otStatus" text;
alter table attendance add column if not exists "holidayStatus" text;

alter table attendance add column if not exists "holidayType" text;

-- =================================================================
-- Editable My Portal profile + bank details for payroll — incremental migration. Run
-- once against a database that already has the migrations above applied. Safe to re-run.
-- Employees can now update their own phone/email and bank account number/QR code from
-- My Portal; HR-controlled fields (pay, category, status, employeeCode, authUserId, etc.)
-- stay locked to admins via the trigger below. Bank details are visible only to that one
-- employee and to admins -- nobody else can ever read another employee's row at all.
-- =================================================================

alter table employees add column if not exists "bankAccountNumber" text;
alter table employees add column if not exists "bankQrPath" text;

drop policy if exists "employee updates own contact and bank info" on employees;
create policy "employee updates own contact and bank info" on employees
  for update to authenticated
  using (id = my_employee_id())
  with check (id = my_employee_id());

create or replace function enforce_employee_profile_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.id is distinct from old.id
    or new.name is distinct from old.name
    or new.category is distinct from old.category
    or new.position is distinct from old.position
    or new.status is distinct from old.status
    or new."employmentStatus" is distinct from old."employmentStatus"
    or new."dateHired" is distinct from old."dateHired"
    or new."payType" is distinct from old."payType"
    or new.rate is distinct from old.rate
    or new."allowancePerDay" is distinct from old."allowancePerDay"
    or new."fixedAllowance" is distinct from old."fixedAllowance"
    or new."housingAllowance" is distinct from old."housingAllowance"
    or new."nightShiftDifferential" is distinct from old."nightShiftDifferential"
    or new."payCycle" is distinct from old."payCycle"
    or new.notes is distinct from old.notes
    or new."employeeCode" is distinct from old."employeeCode"
    or new."authUserId" is distinct from old."authUserId"
  then
    raise exception 'Employees may only update their own contact info and bank details';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_profile_update on employees;
create trigger trg_employee_profile_update
  before update on employees
  for each row execute function enforce_employee_profile_update();

insert into storage.buckets (id, name, public)
values ('bank-qr', 'bank-qr', false)
on conflict (id) do nothing;

drop policy if exists "employee uploads own bank qr" on storage.objects;
create policy "employee uploads own bank qr" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
drop policy if exists "employee reads own bank qr" on storage.objects;
create policy "employee reads own bank qr" on storage.objects
  for select to authenticated
  using (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
drop policy if exists "employee deletes own bank qr" on storage.objects;
create policy "employee deletes own bank qr" on storage.objects
  for delete to authenticated
  using (bucket_id = 'bank-qr' and (storage.foldername(name))[1] = my_employee_id());
drop policy if exists "admin full access to bank qr" on storage.objects;
create policy "admin full access to bank qr" on storage.objects
  for all to authenticated
  using (bucket_id = 'bank-qr' and is_admin())
  with check (bucket_id = 'bank-qr' and is_admin());

-- =================================================================
-- Let employees edit and delete their own attendance record (Time In/Out, status) on ANY
-- day, past included -- incremental migration. Run once against a database that already
-- has the migrations above applied. Safe to re-run. Product decision: no HR approval step
-- for this -- it's meant to work like the existing "Delete & Redo Today's Attendance"
-- already did, just extended to every day and to editing in place instead of only
-- delete-then-reclock. Every change still lands in auditLog (via js/store.js's
-- updateRow/deleteRow), so HR can review after the fact even though the live row no
-- longer shows the original values. Which day it is and whose record it is still can
-- never change -- only the recorded time/status/photos on an employee's own row can.
-- =================================================================

drop policy if exists "employee deletes own attendance for today" on attendance;
drop policy if exists "employee deletes own attendance" on attendance;
create policy "employee deletes own attendance" on attendance
  for delete to authenticated using ("employeeId" = my_employee_id());

create or replace function enforce_employee_attendance_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if is_admin() then
    return new;
  end if;
  if new.date is distinct from old.date
    or new."employeeId" is distinct from old."employeeId"
  then
    raise exception 'Employees may not change the date or owner of an attendance record';
  end if;
  if (new."nsdStatus" is distinct from old."nsdStatus" and new."nsdStatus" is not null and new."nsdStatus" != 'Requested')
    or (new."otStatus" is distinct from old."otStatus" and new."otStatus" is not null and new."otStatus" != 'Requested')
    or (new."holidayStatus" is distinct from old."holidayStatus" and new."holidayStatus" is not null and new."holidayStatus" != 'Requested')
  then
    raise exception 'Employees may only request NSD/OT/Holiday pay, not approve or reject it';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_attendance_update on attendance;
create trigger trg_employee_attendance_update
  before update on attendance
  for each row execute function enforce_employee_attendance_update();

-- =================================================================
-- Editable payroll cutoff-day settings -- incremental migration. Run once against a
-- database that already has the migrations above applied. Safe to re-run. Replaces the
-- hardcoded cutoff days in js/store.js's payCutoffs() with a per-pay-group settings row
-- HR can edit from Attendance -> Calendar -> "Edit Cutoff Days". Seeded with the values
-- that were previously hardcoded, so nothing changes until HR actually edits them.
-- =================================================================

create table if not exists "payCutoffSettings" (
  "payCycle" text primary key,
  "cutoffAEndDay" int not null,
  "paydayADay" int not null,
  "cutoffBEndDay" int not null,
  "paydayBDay" int not null,
  updated_at timestamptz not null default now()
);

alter table "payCutoffSettings" enable row level security;

drop policy if exists "admin full access" on "payCutoffSettings";
create policy "admin full access" on "payCutoffSettings"
  for all to authenticated using (is_admin()) with check (is_admin());
drop policy if exists "employee reads pay cutoff settings" on "payCutoffSettings";
create policy "employee reads pay cutoff settings" on "payCutoffSettings"
  for select to authenticated using (true);

alter publication supabase_realtime add table "payCutoffSettings";

insert into "payCutoffSettings" ("payCycle", "cutoffAEndDay", "paydayADay", "cutoffBEndDay", "paydayBDay") values
  ('10-20', 3, 5, 18, 20),
  ('15-30', 10, 15, 25, 30)
on conflict ("payCycle") do nothing;

-- =================================================================
-- Audit trail for OT/NSD/Holiday approvals -- incremental migration. Run once against a
-- database that already has the migrations above applied. Safe to re-run. Adds who
-- approved each one and when, stamped automatically by a trigger the instant a status
-- column transitions to 'Approved' (and cleared if ever un-approved) -- this is what lets
-- HR tell a genuine approval apart from anything else, addressing the gap the old
-- unguarded backfill line left (see the NSD/OT/Holiday migration block above).
-- =================================================================

alter table attendance add column if not exists "otApprovedBy" text;
alter table attendance add column if not exists "otApprovedAt" timestamptz;
alter table attendance add column if not exists "nsdApprovedBy" text;
alter table attendance add column if not exists "nsdApprovedAt" timestamptz;
alter table attendance add column if not exists "holidayApprovedBy" text;
alter table attendance add column if not exists "holidayApprovedAt" timestamptz;

create or replace function stamp_attendance_approvals() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor text := auth.jwt() ->> 'email';
  old_ot text := (case when TG_OP = 'INSERT' then null else old."otStatus" end);
  old_nsd text := (case when TG_OP = 'INSERT' then null else old."nsdStatus" end);
  old_holiday text := (case when TG_OP = 'INSERT' then null else old."holidayStatus" end);
begin
  if new."otStatus" = 'Approved' and (old_ot is distinct from 'Approved') then
    new."otApprovedBy" := actor;
    new."otApprovedAt" := now();
  elsif new."otStatus" is distinct from 'Approved' then
    new."otApprovedBy" := null;
    new."otApprovedAt" := null;
  end if;

  if new."nsdStatus" = 'Approved' and (old_nsd is distinct from 'Approved') then
    new."nsdApprovedBy" := actor;
    new."nsdApprovedAt" := now();
  elsif new."nsdStatus" is distinct from 'Approved' then
    new."nsdApprovedBy" := null;
    new."nsdApprovedAt" := null;
  end if;

  if new."holidayStatus" = 'Approved' and (old_holiday is distinct from 'Approved') then
    new."holidayApprovedBy" := actor;
    new."holidayApprovedAt" := now();
  elsif new."holidayStatus" is distinct from 'Approved' then
    new."holidayApprovedBy" := null;
    new."holidayApprovedAt" := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_stamp_attendance_approvals on attendance;
create trigger trg_stamp_attendance_approvals
  before insert or update on attendance
  for each row execute function stamp_attendance_approvals();

-- =================================================================
-- Editable OT hours -- incremental migration. Run once against a database that already
-- has the migrations above applied. Safe to re-run. Lets HR override the number of hours
-- that count as overtime for a day, instead of it always being a fixed "hours - 8".
-- =================================================================

alter table attendance add column if not exists "otHours" numeric(5,2);
