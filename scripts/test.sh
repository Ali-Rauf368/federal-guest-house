#!/usr/bin/env bash
# Runs the API tests against their own database, so development data is never touched.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export NODE_ENV=test
export DATABASE_URL="${TEST_DATABASE_URL:-postgresql://fgh@localhost:5437/federal_guest_house_test}"
export MONGO_URL="${TEST_MONGO_URL:-mongodb://127.0.0.1:27021/federal_guest_house_test}"
export JWT_SECRET="${JWT_SECRET:-test-secret-test-secret-test-secret}"
if [ -z "${CI:-}" ]; then
  bash "$ROOT/scripts/dev-services.sh" start >/dev/null 2>&1 </dev/null
  PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}"
  "$PGBIN/createdb" -h localhost -p 5437 -U fgh federal_guest_house_test 2>/dev/null || true
fi
cd "$ROOT/apps/api"
npx prisma migrate deploy >/dev/null
npx tsx src/scripts/seed.ts >/dev/null
node --import tsx --test --test-force-exit test/*.test.ts
