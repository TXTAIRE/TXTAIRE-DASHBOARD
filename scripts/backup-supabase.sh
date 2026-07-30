#!/usr/bin/env bash
# Exports every table straight from Postgres via the service_role key (bypasses RLS, so
# this must only ever run server-side in CI — never in client-side app code). Used by
# .github/workflows/backup.yml on a daily schedule; produces one JSON file per table.
set -euo pipefail

: "${SUPABASE_URL:?Missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Missing SUPABASE_SERVICE_ROLE_KEY}"

TABLES=(
  employees candidates "disciplinaryCases" complaints attendance deductions
  "probationRecords" "payrollOverrides" holidays "leaveRequests"
  "attendanceCorrections" "auditLog"
)

OUT_DIR="backup-$(date -u +%Y-%m-%dT%H-%M-%SZ)"
mkdir -p "$OUT_DIR"

for table in "${TABLES[@]}"; do
  echo "Backing up $table..."
  curl -sf "$SUPABASE_URL/rest/v1/$table?select=*" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -o "$OUT_DIR/$table.json"
done

echo "Backup written to $OUT_DIR"
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "backup_dir=$OUT_DIR" >> "$GITHUB_OUTPUT"
fi
