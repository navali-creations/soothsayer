#!/bin/bash

# Soothsayer Data Sync Script
# Manually triggers cron jobs to fetch fresh data from PoE/poe.ninja

set -e

echo ""
echo "========================================"
echo "Syncing Data from PoE/poe.ninja"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Supabase is running
if ! docker ps | grep -q "supabase_db_soothsayer"; then
    echo -e "${RED}❌ Supabase is not running.${NC}"
    echo "   Please run: pnpm supabase:start"
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Supabase is running"

# Show current data counts
echo ""
echo "[*] Current data counts:"
SNAPSHOT_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM snapshots;" 2>/dev/null | tr -d ' ' || echo "0")
CARD_PRICE_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM card_prices;" 2>/dev/null | tr -d ' ' || echo "0")
LEAGUE_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM poe_leagues;" 2>/dev/null | tr -d ' ' || echo "0")
echo "    - Leagues: $LEAGUE_COUNT"
echo "    - Snapshots: $SNAPSHOT_COUNT"
echo "    - Card prices: $CARD_PRICE_COUNT"

echo ""
echo "[*] Syncing leagues from PoE API..."
if docker exec supabase_db_soothsayer psql -U postgres -c "SELECT sync_leagues_from_api();" > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} Leagues synced"
else
    echo -e "${RED}[ERROR]${NC} Failed to sync leagues"
    exit 1
fi

echo ""
echo "[*] Creating snapshots for active leagues (this may take a minute)..."
if docker exec supabase_db_soothsayer psql -U postgres -c "SELECT create_snapshots_for_active_leagues();" > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} Snapshots created"
else
    echo -e "${RED}[ERROR]${NC} Failed to create snapshots"
    echo "    Check Edge Function logs: pnpm supabase:logs"
    exit 1
fi

# Show updated data counts
echo ""
echo "[*] Updated data counts:"
SNAPSHOT_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM snapshots;" 2>/dev/null | tr -d ' ' || echo "0")
CARD_PRICE_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM card_prices;" 2>/dev/null | tr -d ' ' || echo "0")
LEAGUE_COUNT=$(docker exec supabase_db_soothsayer psql -U postgres -t -c "SELECT COUNT(*) FROM poe_leagues;" 2>/dev/null | tr -d ' ' || echo "0")
echo "    - Leagues: $LEAGUE_COUNT"
echo "    - Snapshots: $SNAPSHOT_COUNT"
echo "    - Card prices: $CARD_PRICE_COUNT"

echo ""
echo "========================================"
echo -e "${GREEN}>> Sync Complete!${NC}"
echo "========================================"
echo ""
echo "[INFO] Data has been refreshed from PoE/poe.ninja"
echo "[TIP] Run 'pnpm sync-data' anytime to fetch fresh data"
echo ""
