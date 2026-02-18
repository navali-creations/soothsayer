# Soothsayer

`soothsayer` is a real-time stacked deck opening tracker for Path of Exile. 

Additionally `soothayer` calculates live profit based on current market prices, and gives you a clear picture of whether your session is paying off (spoiler: it most likely doesn't but you never know!). 

Path of Exile 2 support is ready and waiting for when stacked decks become available.

[![Watch Demo](https://github.com/navali-creations/soothsayer/raw/master/renderer/assets/poe1/divination-card-images/A_Dab_of_Ink.png)](https://github.com/navali-creations/soothsayer/raw/master/.github/assets/demo.mp4)


[![Download Latest Release](https://img.shields.io/github/v/release/navali-creations/soothsayer?style=for-the-badge&label=Download&color=blue)](https://github.com/navali-creations/soothsayer/releases/latest)

---

## Requirements

- Node.js >= 22
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
- When Supabase is running locally, the app uses `.env.local` (local dev credentials)
- When you run `pnpm supabase:stop`, `.env.local` is removed automatically
- After stopping, `pnpm start` will use production credentials from `.env`
- This allows seamless switching between local development and production testing

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
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
VITE_UMAMI_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
SENTRY_AUTH_TOKEN=
SENTRY_DSN="https://<dsn>.ingest.de.sentry.io/<projectId>"

```

- With Supabase stopped, `pnpm start` uses these production credentials
- With Supabase running, `pnpm start` uses local dev (`.env.local` overrides `.env`)

## Deploy to Production

```bash
# Link to production (one-time)
pnpx supabase link --project-ref <project-id>

# Push database migrations
pnpx supabase db push

# Deploy Edge Functions
pnpx supabase functions deploy
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
