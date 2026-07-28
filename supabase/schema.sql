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
  "employeeCode" text unique,                  -- Employee Self-Service login ID, e.g. 'TXAT-015'
  "authUserId" uuid references auth.users(id), -- set once ESS portal access is granted (js/views/staff.js
                                                -- "Grant portal access"); null = no portal login yet.
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

create policy "admin full access" on attendance
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads own attendance" on attendance
  for select to authenticated using ("employeeId" = my_employee_id());
-- Self clock-in/out: an employee may create today's own attendance row (Time In) and
-- later update that same row (Time Out) — never a past/future date, never anyone else's
-- row. The only write access a linked employee has anywhere in the schema.
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

-- Holidays: not sensitive, every authenticated user (admin or employee) can read; only
-- admins can add/edit/delete.
create policy "admin full access" on holidays
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "employee reads holidays" on holidays
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
create policy "admin full access to attendance photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'attendance-photos' and is_admin())
  with check (bucket_id = 'attendance-photos' and is_admin());

-- =================================================================
-- Realtime — publish every table so the app's subscriptions receive changes
-- =================================================================
alter publication supabase_realtime add table
  employees, candidates, "disciplinaryCases", complaints,
  attendance, deductions, "probationRecords", "payrollOverrides", holidays,
  "leaveRequests", "attendanceCorrections", "auditLog";

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

-- One-time: assign Employee IDs (TXAT-001..TXAT-020) to the 20 seeded employees, in the
-- same name order as supabase/seed.sql, so each can later be granted ESS portal access.
update employees set "employeeCode" = 'TXAT-001' where id = 'e_bultron';
update employees set "employeeCode" = 'TXAT-002' where id = 'e_casano';
update employees set "employeeCode" = 'TXAT-003' where id = 'e_sangcupan';
update employees set "employeeCode" = 'TXAT-004' where id = 'e_famini';
update employees set "employeeCode" = 'TXAT-005' where id = 'e_soriano';
update employees set "employeeCode" = 'TXAT-006' where id = 'e_nabora';
update employees set "employeeCode" = 'TXAT-007' where id = 'e_cosme';
update employees set "employeeCode" = 'TXAT-008' where id = 'e_arnel_parala';
update employees set "employeeCode" = 'TXAT-009' where id = 'e_argee_parala';
update employees set "employeeCode" = 'TXAT-010' where id = 'e_michael_parala';
update employees set "employeeCode" = 'TXAT-011' where id = 'e_aldrin_parala';
update employees set "employeeCode" = 'TXAT-012' where id = 'e_cabanez';
update employees set "employeeCode" = 'TXAT-013' where id = 'e_rotazo';
update employees set "employeeCode" = 'TXAT-014' where id = 'e_delacruz';
update employees set "employeeCode" = 'TXAT-015' where id = 'e_albano';
update employees set "employeeCode" = 'TXAT-016' where id = 'e_dulfo';
update employees set "employeeCode" = 'TXAT-017' where id = 'e_alomia';
update employees set "employeeCode" = 'TXAT-018' where id = 'e_francisco';
update employees set "employeeCode" = 'TXAT-019' where id = 'e_dean';
update employees set "employeeCode" = 'TXAT-020' where id = 'e_vargas';

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
