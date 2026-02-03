#!/bin/bash

# Soothsayer Local Development Fresh Setup Script
# This script completely resets Supabase and SQLite data

set -e

echo "🔥 Soothsayer Fresh Start"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Warn user
echo -e "${YELLOW}WARNING: This will delete ALL local development data:${NC}"
echo "  - Supabase database (leagues, snapshots, prices)"
echo "  - SQLite database (sessions, cards)"
echo ""
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop first.${NC}"
    exit 1
fi

# Stop and remove Supabase with --no-backup flag
echo "[*] Stopping Supabase and removing all data..."
pnpx supabase stop --no-backup > /dev/null 2>&1 || true

# Force remove any remaining containers
CONTAINERS=$(docker ps -aq --filter "name=supabase_")
if [ -n "$CONTAINERS" ]; then
    echo "[*] Removing remaining containers..."
    echo "$CONTAINERS" | while read container; do
        docker rm -f "$container" > /dev/null 2>&1 || true
    done
fi

# Remove Docker volumes to delete all data
echo "[*] Removing Docker volumes..."
VOLUMES=$(docker volume ls -q --filter "name=supabase_")
if [ -n "$VOLUMES" ]; then
    echo "$VOLUMES" | while read volume; do
        docker volume rm "$volume" > /dev/null 2>&1 || true
    done
fi

echo -e "${GREEN}[OK]${NC} Supabase data deleted"

# Delete SQLite database
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    SQLITE_PATH="$APPDATA/soothsayer/soothsayer.local.db"
else
    # macOS/Linux
    SQLITE_PATH="$HOME/.config/soothsayer/soothsayer.local.db"
fi

if [ -f "$SQLITE_PATH" ]; then
    echo "[*] Deleting SQLite database..."
    rm -f "$SQLITE_PATH" "${SQLITE_PATH}-wal" "${SQLITE_PATH}-shm"
    echo -e "${GREEN}[OK]${NC} SQLite data deleted"
else
    echo -e "${YELLOW}[!]${NC} No SQLite database found"
fi

echo ""
echo "======================================"
echo -e "${GREEN}>> Fresh start ready!${NC}"
echo "======================================"
echo ""
echo "Now starting fresh Supabase..."
echo ""

# Start fresh Supabase
bash "$(dirname "$0")/setup-local-dev.sh"
