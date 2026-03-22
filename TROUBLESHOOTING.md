# Troubleshooting

## Malwarebytes Blocking Edge Functions

If Supabase fails to start with errors about `deno.land` being unreachable:

```
Import 'https://deno.land/std/http/status.ts' failed: Network is unreachable
```

**Cause:** Malwarebytes Web Protection blocks `deno.land` as a false positive and redirects it to `127.236.0.2`, breaking Docker containers.

**Solution:** Disable Malwarebytes Web Protection while developing locally:
1. Open Malwarebytes → **Settings** → **Web Protection** → Toggle **Off**
2. Restart Supabase: `pnpm supabase:stop && pnpm supabase:start`

**Note:** `deno.land` is the official Deno runtime package registry used by Supabase Edge Functions. The threat detection is a false positive.

## `better-sqlite3` ABI Mismatch

`better-sqlite3` is a native Node.js addon. Electron 40.8.0 ships a custom build of
Node 24.14.0 with `NODE_MODULE_VERSION 143`, while the system Node 24.14.0 uses
`NODE_MODULE_VERSION 137`. The two ABIs are **incompatible** — a native module compiled
for one cannot be loaded by the other.

The `postinstall` script runs `electron-rebuild`, which compiles `better-sqlite3` for
Electron's ABI. This is the **only** compiled version we keep — there is no longer any
flip-flopping between `pnpm rebuild` (for Node) and `electron-rebuild` (for Electron).

### How main-process tests work

Main-process Vitest tests (which use `better-sqlite3` via in-memory SQLite databases)
run under Electron's own Node.js runtime via the `vitest` script. This uses
the `ELECTRON_RUN_AS_NODE=1` environment variable to make the Electron binary behave as
a plain Node.js process — so the Electron-rebuilt native module loads correctly.

```
pnpm test:main        # runs vitest inside Electron's Node runtime
pnpm test:renderer    # runs vitest with system Node (no native modules needed)
pnpm test             # runs both sequentially (main first, then renderer)
```

### If you see an ABI error

```
The module 'better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 143.
```

This means `better-sqlite3` was rebuilt for the system Node instead of Electron.
Fix it by re-running the Electron rebuild:

```bash
pnpm prepare-deps:electron
```

This is also what `postinstall` does, so `pnpm install` will fix it automatically.

> **Note:** The helper script at `scripts/vitest-electron.mjs` contains detailed
> comments explaining the ABI mismatch and the `ELECTRON_RUN_AS_NODE` approach.