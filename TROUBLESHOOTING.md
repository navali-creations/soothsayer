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

## `better-sqlite3` installation

`better-sqlite3` v13 uses N-API and includes prebuilt binaries for Soothsayer's supported
platforms. The same binary works with system Node and Electron, so it must not be rebuilt
for a specific Electron ABI.

The package still contains `binding.gyp`, which can cause package managers to invoke
`node-gyp` unnecessarily during installation. `pnpm-workspace.yaml` disables that build
step so pnpm uses the bundled binary directly.

### How main-process tests work

Main-process Vitest tests (which use `better-sqlite3` via in-memory SQLite databases)
run under Electron's own Node.js runtime via the `vitest` script. This uses
the `ELECTRON_RUN_AS_NODE=1` environment variable to make the Electron binary behave as
a plain Node.js process and keeps tests aligned with the packaged app runtime.

```
pnpm test:main        # runs vitest inside Electron's Node runtime
pnpm test:renderer    # runs vitest with system Node (no native modules needed)
pnpm test             # runs both sequentially (main first, then renderer)
```

### If the native binary cannot be loaded

```
Could not locate the bindings file
```

Restore the bundled prebuild with a clean pnpm install. Do not run
`electron-rebuild` for `better-sqlite3`:

```bash
pnpm install --frozen-lockfile
```

If the platform or architecture has no bundled prebuild, it needs a supported source-build
environment instead.
