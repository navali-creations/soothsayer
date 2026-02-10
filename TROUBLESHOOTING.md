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

## `better-sqlite3` ABI Mismatch (Tests Failing Locally)

If tests fail with an error like:

```
The module 'better_sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 143. This version of Node.js requires NODE_MODULE_VERSION 127.
```

or:

```
Error: Module did not self-register: .../better_sqlite3.node
```

**Cause:** `better-sqlite3` is a native Node.js addon. The `postinstall` script runs `electron-rebuild`, which compiles it for **Electron's** Node.js ABI. When Vitest runs tests using **regular Node.js**, the ABI versions don't match and the module fails to load.

This happens whenever `pnpm install` is run (or anything that triggers `postinstall`), since it always rebuilds for Electron.

**Solution:** The `pretest` script in `package.json` handles this automatically — it runs `pnpm rebuild better-sqlite3` before every `pnpm test`, recompiling the module for Node.js (~400ms). No manual action needed.

If you need to fix it manually: `pnpm rebuild better-sqlite3`.

**Note:** After rebuilding for Node.js, `pnpm start` (Electron) will still work because the next `pnpm install` will trigger `postinstall` and rebuild for Electron again. The two runtimes just can't share the same compiled binary.