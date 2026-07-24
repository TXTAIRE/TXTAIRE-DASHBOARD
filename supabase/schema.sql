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
  "nightShiftDifferential" boolean not null default false,    -- superseded: NSD is now computed automatically for
                                                                -- everyone from actual logged timeIn/timeOut vs. the
                                                                -- 10pm-6am window (see js/store.js nightOverlapHours).
                                                                -- Column kept for backward compatibility; unused by the app.
  "payCycle" text not null,                    -- '10-20' | '15-30'
  notes text default '',
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

-- =================================================================
-- Row Level Security — authenticated users only, anon gets nothing
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

create policy "authenticated full access" on employees
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on candidates
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on "disciplinaryCases"
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on complaints
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on attendance
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on deductions
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on "probationRecords"
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on "payrollOverrides"
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on holidays
  for all to authenticated using (true) with check (true);

-- =================================================================
-- Realtime — publish all 8 tables so the app's subscriptions receive changes
-- =================================================================
alter publication supabase_realtime add table
  employees, candidates, "disciplinaryCases", complaints,
  attendance, deductions, "probationRecords", "payrollOverrides", holidays;

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
