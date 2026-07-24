-- TxTAIRE — Employee roster seed data
-- Run once in the Supabase SQL Editor, AFTER running schema.sql, to populate the real
-- employee roster. Safe to re-run: existing rows (matched by id) are left untouched.
--
-- Pay cycle: '10-20' = Admins (paid the 10th & 20th), '15-30' = Technicians (paid the
-- 15th & end of month). "rate" for Monthly pay type is the amount paid PER CUTOFF (not
-- the full monthly salary) — e.g. Bultron's 11,085.42 is paid twice a month, so his full
-- monthly salary is 22,170.83.
--
-- Regular employees' exact hire dates weren't provided, so "dateHired" is left null for
-- them — fill in from HR 201 files when convenient. Probationary employees use their
-- evaluation start date as dateHired, which is populated below along with a matching
-- probationRecords row so the Probation / Regularization page tracks their 3rd/6th month
-- evaluations immediately.

insert into employees
  (id, name, category, position, status, "employmentStatus", "dateHired", phone, email,
   "payType", rate, "allowancePerDay", "fixedAllowance", "housingAllowance", "payCycle", notes)
values
  -- Engineers (category: Admin — pay cycle 10th & 20th)
  ('e_bultron',        'John Rodolfo R. Bultron', 'Admin', 'Vice President - Operations and Shared Services', 'Active', 'Regular',      null,         null, null, 'Monthly', 11085.42, 0,   0, 0,   '10-20', ''),
  ('e_casano',         'Joshua L. Casano',         'Admin', 'Engineering Manager',                             'Active', 'Regular',      null,         null, null, 'Monthly', 8477.09,  100, 0, 0,   '10-20', ''),
  ('e_sangcupan',      'Julaisa S. Sangcupan',     'Admin', 'Engineering Officer',                              'Active', 'Regular',      null,         null, null, 'Monthly', 6275.00,  100, 0, 0,   '10-20', ''),
  ('e_famini',         'Idine S. Famini',          'Admin', 'Service Engineer',                                 'Active', 'Probationary', '2026-05-25', null, null, 'Monthly', 5961.96,  0,   0, 0,   '10-20', ''),

  -- Logistics & Admin (category: Admin — pay cycle 10th & 20th)
  ('e_soriano',        'Odilon T. Soriano',        'Admin', 'Logistic Manager',      'Active', 'Regular',      null,         null, null, 'Monthly', 6250.00, 0, 0, 0, '10-20', ''),
  ('e_nabora',         'Rica Mae Nabora',          'Admin', 'Service Specialist / HR', 'Active', 'Regular',      null,         null, null, 'Daily',   1000.00,  0, 0, 0, '10-20', ''),
  ('e_cosme',          'Jennifer D. Cosme',        'Admin', 'Admin Assistant',        'Active', 'Probationary', '2026-06-17', null, null, 'Daily',   600.00,   0, 0, 0, '10-20', ''),

  -- Technicians (category: Technician — pay cycle 15th & end of month)
  ('e_arnel_parala',   'Arnel V. Parala',          'Technician', 'Service Technician Supervisor', 'Active', 'Regular',      null,         null, null, 'Daily', 1000.00, 200, 0, 0,   '15-30', ''),
  ('e_argee_parala',   'Argee V. Parala',          'Technician', 'Lead Service Technician',       'Active', 'Regular',      null,         null, null, 'Daily', 1000.00, 200, 0, 0,   '15-30', ''),
  ('e_michael_parala', 'Michael V. Parala',        'Technician', 'Service Technician',            'Active', 'Regular',      null,         null, null, 'Daily', 800.00,  200, 0, 0,   '15-30', ''),
  ('e_aldrin_parala',  'Aldrin V. Parala',         'Technician', 'Service Personnel - Welder',    'Active', 'Regular',      null,         null, null, 'Daily', 700.00,  70,  0, 0,   '15-30', ''),
  ('e_cabanez',        'Erasmo L. Cabañez Jr.',    'Technician', 'Service Personnel - Mason',     'Active', 'Regular',      null,         null, null, 'Daily', 700.00,  70,  0, 0,   '15-30', ''),
  ('e_rotazo',         'Franny R. Rotazo',         'Technician', 'Service Personnel',             'Active', 'Regular',      null,         null, null, 'Daily', 700.00,  100, 0, 0,   '15-30', ''),
  ('e_delacruz',       'George J. Dela Cruz',      'Technician', 'Company Driver',                'Active', 'Regular',      null,         null, null, 'Daily', 645.00,  100, 0, 0,   '15-30', ''),
  ('e_albano',         'Cruzel Albano',            'Technician', 'Electrician',                   'Active', 'Regular',      null,         null, null, 'Daily', 1350.00, 0,   0, 0,   '15-30', ''),
  ('e_dulfo',          'Dante B. Dulfo',           'Technician', 'Lead Service Technician',       'Active', 'Regular',      null,         null, null, 'Daily', 1200.00, 100, 0, 500, '15-30', ''),
  ('e_alomia',         'Benedict B. Alomia',       'Technician', 'Utility and Warehouse Officer', 'Active', 'Probationary', '2026-02-02', null, null, 'Daily', 600.00,  0,   0, 0,   '15-30', ''),
  ('e_francisco',      'Jayson S. Francisco',      'Technician', 'Service Personnel',             'Active', 'Probationary', '2026-05-12', null, null, 'Daily', 700.00,  0,   0, 0,   '15-30', ''),
  ('e_dean',           'Michael C. Dean',          'Technician', 'Service Technician',            'Active', 'Probationary', '2026-06-26', null, null, 'Daily', 750.00,  0,   0, 0,   '15-30', ''),
  ('e_vargas',         'Alvin R. Vargas',          'Technician', 'Service Personnel',             'Active', 'Probationary', '2026-06-11', null, null, 'Daily', 700.00,  0,   0, 0,   '15-30', '')
on conflict (id) do nothing;

-- Probation tracking — one row per probationary employee above, so the Probation /
-- Regularization page immediately shows their 3rd- and 6th-month due dates.
insert into "probationRecords"
  (id, "employeeId", "startDate", "thirdMonthStatus", "thirdMonthEvaluatedDate", "thirdMonthNotes",
   "sixthMonthStatus", "sixthMonthEvaluatedDate", "sixthMonthNotes")
values
  ('pr_famini',     'e_famini',     '2026-05-25', 'Pending', null, '', 'Pending', null, ''),
  ('pr_cosme',      'e_cosme',      '2026-06-17', 'Pending', null, '', 'Pending', null, ''),
  ('pr_alomia',     'e_alomia',     '2026-02-02', 'Pending', null, '', 'Pending', null, ''),
  ('pr_francisco',  'e_francisco',  '2026-05-12', 'Pending', null, '', 'Pending', null, ''),
  ('pr_dean',       'e_dean',       '2026-06-26', 'Pending', null, '', 'Pending', null, ''),
  ('pr_vargas',     'e_vargas',     '2026-06-11', 'Pending', null, '', 'Pending', null, '')
on conflict (id) do nothing;

-- =================================================================
-- One-time fix — if you already ran the insert above with the OLD (doubled) rates for
-- these 5 employees, run this block once to correct the live rows. "rate" is per cutoff;
-- these 5 were originally entered as the full monthly salary, which double-paid them
-- since the app pays every employee twice a month.
-- =================================================================
update employees set rate = 11085.42 where id = 'e_bultron';
update employees set rate = 8477.09  where id = 'e_casano';
update employees set rate = 6275.00  where id = 'e_sangcupan';
update employees set rate = 5961.96  where id = 'e_famini';
update employees set rate = 6250.00  where id = 'e_soriano';

-- Night-shift default: these 3 typically work nights, so the Attendance page defaults
-- their Time In/Out to 10pm-6am instead of the standard 9am-6pm. Does not by itself grant
-- NSD pay — that's still computed from whatever time in/out actually gets logged.
update employees set "nightShiftDifferential" = true where id in ('e_dulfo', 'e_francisco', 'e_vargas');
