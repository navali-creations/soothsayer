#!/bin/bash

# Soothsayer Database Test Script
# Starts Supabase (default network), runs pgTAP tests, then stops.
# All in one script to avoid cross-platform shell issues with pnpm.

set -e

echo ""
echo "========================================"
echo "Supabase pgTAP Database Tests"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Track whether we started Supabase so we know to stop it
STARTED_BY_US=false

cleanup() {
    if [ "$STARTED_BY_US" = true ]; then
        echo ""
        echo "[*] Stopping Supabase (test instance)..."
        pnpx supabase stop --no-backup > /dev/null 2>&1 || true
        echo -e "${GREEN}[OK]${NC} Supabase stopped"
    fi
}

# Always clean up on exit
trap cleanup EXIT

# ──────────────────────────────────────────────
# 1. Check Docker
# ──────────────────────────────────────────────

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Docker is running"

# ──────────────────────────────────────────────
# 2. Stop any existing Supabase instance
#    (e.g. dev instance on custom network)
# ──────────────────────────────────────────────

if docker ps --format '{{.Names}}' | grep -q "supabase_db_soothsayer"; then
    echo -e "${YELLOW}[!]${NC} Supabase is already running — stopping it first..."
    pnpx supabase stop --no-backup > /dev/null 2>&1 || true
    sleep 2
    echo -e "${GREEN}[OK]${NC} Previous instance stopped"
fi

# ──────────────────────────────────────────────
# 3. Start Supabase with DEFAULT networking
#    (no --network-id so pg_prove resolves "db")
# ──────────────────────────────────────────────

echo "[*] Starting Supabase (default network)..."
if ! pnpx supabase start; then
    echo ""
    echo -e "${YELLOW}[!]${NC} Start failed — cleaning up and retrying..."
    pnpx supabase stop --no-backup > /dev/null 2>&1 || true

    CONTAINERS=$(docker ps -aq --filter "name=supabase_" 2>/dev/null)
    if [ -n "$CONTAINERS" ]; then
        echo "$CONTAINERS" | while read container; do
            docker rm -f "$container" > /dev/null 2>&1 || true
        done
    fi

    sleep 2

    if ! pnpx supabase start; then
        echo ""
        echo -e "${RED}[ERROR]${NC} Failed to start Supabase for tests"
        exit 1
    fi
fi

STARTED_BY_US=true
echo ""
echo -e "${GREEN}[OK]${NC} Supabase ready for database tests"

# ──────────────────────────────────────────────
# 4. Run pgTAP tests
# ──────────────────────────────────────────────

echo ""
echo "========================================"
echo "Running pgTAP tests..."
echo "========================================"
echo ""

TEST_EXIT=0
pnpx supabase test db || TEST_EXIT=$?

echo ""
if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}>> All database tests passed${NC}"
else
    echo -e "${RED}>> Database tests failed (exit code: $TEST_EXIT)${NC}"
fi

# ──────────────────────────────────────────────
# 5. Cleanup runs via trap, then exit with test result
# ──────────────────────────────────────────────

exit $TEST_EXIT
