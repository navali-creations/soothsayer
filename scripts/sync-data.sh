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

# Check if GGG OAuth secrets are available for league sync
HAS_GGG_SECRETS=false
if [ -f "supabase/functions/.env" ]; then
    GGG_CLIENT_ID=$(grep "^GGG_OAUTH_CLIENT_ID=" supabase/functions/.env | cut -d'=' -f2-)
    GGG_CLIENT_SECRET=$(grep "^GGG_OAUTH_CLIENT_SECRET=" supabase/functions/.env | cut -d'=' -f2-)
    if [ -n "$GGG_CLIENT_ID" ] && [ -n "$GGG_CLIENT_SECRET" ]; then
        HAS_GGG_SECRETS=true
    fi
fi

echo ""
echo "[*] Syncing leagues from PoE API..."
if [ "$HAS_GGG_SECRETS" = true ]; then
    if docker exec supabase_db_soothsayer psql -U postgres -c "SELECT sync_leagues_from_api();" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Leagues synced"
    else
        echo -e "${YELLOW}[!]${NC} League sync failed — using existing league data"
    fi
else
    echo -e "${YELLOW}[!]${NC} Skipping league sync (no GGG OAuth secrets)"
    echo "    Using existing league data (Standard leagues from seed)."
    echo "    To enable full league sync, add to your root .env:"
    echo "      GGG_OAUTH_CLIENT_ID=your_client_id"
    echo "      GGG_OAUTH_CLIENT_SECRET=your_client_secret"
    echo "    Then run: pnpm supabase:start"
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
