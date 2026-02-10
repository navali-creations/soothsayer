#!/bin/bash

# Soothsayer Edge Function Test Script
# Checks for Deno installation before running edge function tests.

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    echo ""
    echo -e "${RED}❌ Deno is not installed.${NC}"
    echo ""
    echo "Edge function tests require Deno v2+."
    echo ""
    echo "Install Deno:"
    echo "  Windows (PowerShell):  irm https://deno.land/install.ps1 | iex"
    echo "  Windows (Git Bash):    curl -fsSL https://deno.land/install.sh | sh"
    echo "  macOS/Linux:           curl -fsSL https://deno.land/install.sh | sh"
    echo ""
    echo "More info: https://docs.deno.com/runtime/getting_started/installation/"
    echo ""
    exit 1
fi

DENO_VERSION=$(deno --version | head -n 1 | grep -oP '\d+\.\d+\.\d+' 2>/dev/null || deno --version | head -n 1 | sed 's/[^0-9.]//g')
DENO_MAJOR=$(echo "$DENO_VERSION" | cut -d. -f1)

if [ -n "$DENO_MAJOR" ] && [ "$DENO_MAJOR" -lt 2 ] 2>/dev/null; then
    echo ""
    echo -e "${YELLOW}[!]${NC} Deno $DENO_VERSION detected — Deno v2+ is recommended."
    echo "    Run 'deno upgrade' to update."
    echo ""
fi

echo ""
echo "========================================"
echo "Running Edge Function Tests (Deno)"
echo "========================================"
echo ""

deno test --allow-all --config supabase/functions/deno.json supabase/functions/tests/

echo ""
echo -e "${GREEN}>> Edge function tests passed${NC}"
echo ""
