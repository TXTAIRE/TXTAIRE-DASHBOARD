-- Code of Discipline, Series 2, 2026 Edition -- schema support.
--
-- Mirrors the two changes already made to supabase/schema.sql, which stays the full
-- picture of the database. This file is the applyable slice: schema.sql contains bare
-- `create table` statements and cannot be re-run against a live project.
--
-- Every statement here is idempotent and safe on a table that already holds the Series 1
-- catalog. Neither can lose data: the first is metadata-only on Postgres 11+ (no table
-- rewrite; existing rows take the '' default), and dropping NOT NULL only relaxes a
-- constraint, so it cannot fail on existing rows.

-- 1. The offense class. Series 2 assigns every offense one of four classes (A Light /
--    B Less Grave / C Grave / D Serious) and states the penalty per class exactly once,
--    instead of writing a schedule out per offense. js/store.js derives `schedule` from
--    `klass`, and only falls back to a row's stored schedule where it has no class -- so
--    rows already holding the Series 1 catalog keep working until HR runs the re-sync.
alter table "disciplineOffenses" add column if not exists klass text default '';

-- 2. categoryFil / labelFil / klass must be nullable. js/store.js sanitize() rewrites an
--    empty string to NULL before every insert and update, so a NOT NULL constraint here
--    makes saving an offense with a blank Filipino field -- or with no class -- fail
--    outright. That was already true of categoryFil/labelFil before this edition; the
--    "no class" option would have widened it. Every reader coerces back with `|| ''`,
--    so NULL and '' are equivalent to the app.
alter table "disciplineOffenses" alter column "categoryFil" drop not null;
alter table "disciplineOffenses" alter column "labelFil"    drop not null;
alter table "disciplineOffenses" alter column klass         drop not null;
