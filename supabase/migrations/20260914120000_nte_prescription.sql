-- Issue NTE: prescription of offenses (Code of Discipline, Series 2, 2026 Edition, Sec. 3.11).
--
-- Mirrors the change made to supabase/schema.sql, which stays the full picture of the
-- database. This file is the applyable slice.
--
-- Both statements are idempotent and additive: existing cases keep working, and simply
-- have no discovery date to show.

-- 1. The date the offense came to the knowledge of the immediate superior or of HRD,
--    whichever is earlier. Sec. 3.11 runs the prescriptive period from this date, and the
--    Issue NTE form refuses to issue an NTE once that period has ended. Nullable: cases
--    recorded before this column existed have no such date.
alter table "disciplinaryCases" add column if not exists "dateDiscovered" date;

-- 2. Whether the one-year period applied (offenses involving fraud, dishonesty, theft,
--    falsification, sexual harassment or violence) instead of sixty days. Stored rather
--    than recomputed from offenseCode, because HR can tick it for an offense they added to
--    the catalog -- the case should show which period it was actually issued under.
alter table "disciplinaryCases" add column if not exists "longPrescription" boolean not null default false;
