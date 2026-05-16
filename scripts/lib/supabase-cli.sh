#!/bin/bash

# Resolve the project-local Supabase CLI without going through pnpx. pnpm 11's
# pnpx shim can require a separate `node` binary in bash/WSL, while the
# `supabase` npm package already installs a native CLI binary.

SUPABASE_HELPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUPABASE_REPO_ROOT="$(cd "$SUPABASE_HELPER_DIR/../.." && pwd)"

resolve_supabase_cli() {
    if [ -x "$SUPABASE_REPO_ROOT/node_modules/supabase/bin/supabase" ]; then
        echo "$SUPABASE_REPO_ROOT/node_modules/supabase/bin/supabase"
        return 0
    fi

    if [ -f "$SUPABASE_REPO_ROOT/node_modules/supabase/bin/supabase.exe" ]; then
        echo "$SUPABASE_REPO_ROOT/node_modules/supabase/bin/supabase.exe"
        return 0
    fi

    if [ -x "$SUPABASE_REPO_ROOT/node_modules/.bin/supabase" ]; then
        echo "$SUPABASE_REPO_ROOT/node_modules/.bin/supabase"
        return 0
    fi

    if command -v supabase > /dev/null 2>&1; then
        command -v supabase
        return 0
    fi

    return 1
}

SUPABASE_CLI="$(resolve_supabase_cli || true)"

supabase_cli() {
    if [ -z "$SUPABASE_CLI" ]; then
        echo "[ERROR] Supabase CLI not found. Run 'pnpm install' first." >&2
        return 127
    fi

    "$SUPABASE_CLI" "$@"
}
