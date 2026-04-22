#!/bin/bash

# Soothsayer Database Test Script
# Starts a fresh local Supabase Docker stack, verifies the expected local DB
# container is running, runs pgTAP tests, then stops the local stack.

set -e

echo ""
echo "========================================"
echo "Supabase pgTAP Database Tests"
echo "========================================"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

LOCAL_DB_CONTAINER="supabase_db_soothsayer"
STARTED_BY_US=false

cleanup() {
    if [ "$STARTED_BY_US" = true ]; then
        echo ""
        echo "[*] Stopping Supabase (test instance)..."
        pnpx supabase stop --no-backup > /dev/null 2>&1 || true
        echo -e "${GREEN}[OK]${NC} Supabase stopped"
    fi
}

trap cleanup EXIT

if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}[ERROR]${NC} Docker is not running. Please start Docker Desktop first."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Docker is running"

# Always clear the local Supabase Docker state first. This avoids pgTAP tests
# inheriting cards, users, or uploads from dev/e2e runs.
echo "[*] Resetting local Supabase Docker state..."
pnpx supabase stop --no-backup > /dev/null 2>&1 || true
sleep 2
echo -e "${GREEN}[OK]${NC} Local Supabase state cleared"

echo "[*] Starting Supabase (default network)..."
if ! pnpx supabase start; then
    echo ""
    echo -e "${YELLOW}[!]${NC} Start failed - cleaning up local project containers and retrying..."
    pnpx supabase stop --no-backup > /dev/null 2>&1 || true

    CONTAINERS=$(docker ps -aq --filter "name=supabase_" --filter "name=soothsayer" 2>/dev/null)
    if [ -n "$CONTAINERS" ]; then
        echo "$CONTAINERS" | while read -r container; do
            docker rm -f "$container" > /dev/null 2>&1 || true
        done
    fi

    sleep 2

    if ! pnpx supabase start; then
        echo ""
        echo -e "${RED}[ERROR]${NC} Failed to start local Supabase for tests"
        exit 1
    fi
fi

STARTED_BY_US=true
echo ""
echo -e "${GREEN}[OK]${NC} Supabase ready for database tests"

if ! docker ps --format '{{.Names}}' | grep -qx "$LOCAL_DB_CONTAINER"; then
    echo ""
    echo -e "${RED}[ERROR]${NC} Expected local database container '$LOCAL_DB_CONTAINER' is not running."
    echo "        Refusing to run database tests without the local Supabase Docker stack."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Verified local database container: $LOCAL_DB_CONTAINER"

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

exit $TEST_EXIT
