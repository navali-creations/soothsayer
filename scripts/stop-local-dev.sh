#!/bin/bash

# Soothsayer Local Development Cleanup Script
# Properly stops Supabase and cleans up Docker containers

set -e

echo ""
echo "========================================"
echo "Stopping Local Development"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop Supabase (preserves data by default)
echo "[*] Stopping Supabase..."
if pnpx supabase stop; then
    echo -e "${GREEN}[OK]${NC} Supabase stopped (data preserved)"
else
    echo -e "${YELLOW}[!]${NC} Supabase stop had issues"
fi

# Remove .env.local so production credentials are used
if [ -f ".env.local" ]; then
    echo "[*] Removing .env.local (restoring production credentials)..."
    rm -f .env.local
    echo -e "${GREEN}[OK]${NC} Local environment file removed"
fi

echo ""
echo "========================================"
echo -e "${GREEN}>> Cleanup Complete!${NC}"
echo "========================================"
echo ""
echo "Supabase stopped. Your app will now use production credentials."
echo ""
echo "Next time you run 'pnpm supabase:start':"
echo "  - All data will be preserved"
echo "  - .env.local will be recreated for local development"
echo ""
echo "To start fresh (delete all data):"
echo "  pnpm supabase:start:fresh"
echo ""
