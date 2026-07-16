# Soothsayer

`soothsayer` is a real-time stacked deck opening desktop application tracker for Path of Exile. 

Additionally `soothayer` calculates live profit based on current market prices, and gives you a clear picture of whether your session is paying off (spoiler: it most likely doesn't but you never know!). 

Path of Exile 2 support is ready and waiting for when stacked decks become available.

---

[![Download Latest Release](https://img.shields.io/github/v/release/navali-creations/soothsayer?style=for-the-badge&label=Download+Latest+Release&color=purple)](https://github.com/navali-creations/soothsayer/releases/latest)

| system | extension |
| -- | -- |
| Windows | `Soothsayer-x.y.z.Setup.exe` |
| Linux | `Soothsayer-x.y.z-x64.AppImage` |
| Linux | `soothsayer_x.y.z_amd64.deb` |
| Linux | `soothsayer-*.rpm` |

> [!NOTE]
> For Linux users: the AppImage build is the easiest portable option. On Ubuntu 22.04 install libfuse2; on Ubuntu 24.04+ install libfuse2t64 before launching it.

---


https://github.com/user-attachments/assets/16f87f46-d861-40b8-aa04-df641ea95fb2 

https://github.com/user-attachments/assets/526310a9-f9db-46a6-b244-97e6b3472e89

https://github.com/user-attachments/assets/511e9467-5d9e-4296-ad89-9ed7ade7aa06

https://github.com/user-attachments/assets/5b6c501a-7c90-435c-957d-77df0e7e3ecd

https://github.com/user-attachments/assets/63e95f2b-f4e1-43e2-8e26-68d357928a51

## Requirements

- Node.js >= 24
- pnpm >= 10
- docker

## Development

### Quick start

```bash
# Install dependencies
pnpm install

# Start local development (Supabase + app)
pnpm dev
```

That's it! 

**Note:** First run may take a few minutes as it:
- Downloads Supabase Docker images (one-time setup)
- Starts Supabase with Docker volumes for data persistence
- Fetches and populates initial data from PoE/poe.ninja (leagues, snapshots, prices)
- Launches the app

On subsequent runs, it will:
- Start Supabase (your data persists)
- Launch the app with existing data

### Additional commands

```bash
# Sync fresh data from PoE/poe.ninja (leagues, snapshots, prices)
pnpm supabase:sync

# Stop Supabase when done (keeps all data, switches to production mode)
pnpm supabase:stop

# Start only Supabase (without the app)
pnpm supabase:start

# Complete reset - deletes ALL local data (requires confirmation)
pnpm supabase:start:fresh

# Quick reset - deletes all data without confirmation
pnpx supabase stop --no-backup
```

**How data works:**
- Data is stored in Docker volumes and persists between restarts
- `pnpm supabase:start` preserves existing data, or auto-populates if empty
- `pnpm supabase:sync` fetches fresh data from PoE API without restarting
- `pnpm supabase:start:fresh` wipes everything for a clean slate

**Local vs Production mode:**
- `pnpm dev` starts local Supabase and injects `.env.supabase.local`
- `pnpm start` always injects production credentials from `.env`
- `pnpm supabase:stop` stops local services but preserves local credentials
- Local and production Supabase sessions are stored independently

**SQLite databases:**

The app uses separate SQLite databases to keep data isolated between environments:

| Database | When used | Scenario |
|---|---|---|
| `soothsayer.local.db` | Supabase URL is `localhost` / `127.0.0.1` | `pnpm dev` with local Supabase |
| `soothsayer.db` | Remote Supabase URL + app not packaged | `pnpm start` with production `.env` |
| `soothsayer.prod.db` | Remote Supabase URL + packaged app | Installed release build |

All databases are stored in `%AppData%\Soothsayer\` (Windows) or `~/Library/Application Support/Soothsayer/` (macOS).

**Production credentials:** 

Your `.env` file contains production Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# Legacy fallback while older local/prod config is being migrated.
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_UMAMI_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
SENTRY_AUTH_TOKEN=
VITE_SENTRY_DSN="https://<dsn>.ingest.de.sentry.io/<projectId>"

```

- `pnpm start` uses these production credentials regardless of local Supabase state
- `pnpm dev` uses `.env.supabase.local` for local development

## Deploy to Production

```bash
# Link to production (one-time)
pnpx supabase link --project-ref <project-id>

# Push database migrations
pnpx supabase db push

# Deploy Edge Functions
pnpx supabase functions deploy
```

For the v2 Supabase hardening release, deploy the named v2 data functions plus
the hardened OAuth callback, then delete unsupported legacy app-facing data
functions after the release cutoff:

```bash
pnpx supabase functions deploy v2-get-leagues
pnpx supabase functions deploy v2-get-latest-snapshot
pnpx supabase functions deploy v2-upload-community-data
pnpx supabase functions deploy poe-oauth-callback

pnpx supabase functions delete get-leagues
pnpx supabase functions delete get-leagues-legacy
pnpx supabase functions delete get-latest-snapshot
pnpx supabase functions delete upload-community-data
```

The production GGG OAuth app must keep allowing the registered callback URL:

```text
https://<project-ref>.supabase.co/functions/v1/poe-oauth-callback
```

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Third-Party Data & Disclaimer

This project uses gameplay-related and pricing data from third-party services,
including community-operated services such as **poe.ninja**.

All Path of Exile trademarks, assets, and related intellectual property belong
to **Grinding Gear Games**.

This product is not affiliated with or endorsed by Grinding Gear Games in any way.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html). See the [LICENSE](LICENSE) file for details.

## Contributions

Contributions are welcome and appreciated.

Please note:
- Contributions are voluntary
- Contributors are not entitled to compensation or revenue sharing
- If the project ever receives funding, the author may choose to compensate
  contributors at their discretion

By contributing, you agree to the terms of the project license.
