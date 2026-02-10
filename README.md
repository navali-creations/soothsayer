# Soothsayer

Path of Exile divination card tracker

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

## License

This project is licensed under the **Personal Use Non-Commercial Source-Available
License (PUNCSA) v1.0**.

In short:
- ✔ Free for personal Path of Exile gameplay use
- ✔ Modifications allowed for personal use
- ✔ Streaming and content creation allowed
- ❌ No commercial use
- ❌ No SaaS or hosted services
- ❌ No enterprise or internal organizational use
- ❌ No monetized forks, communities, or derivatives
- ❌ No competing or replacement products

Forks are allowed only under the same license terms and must remain non-commercial.

## Forking & Self-Hosting

Forks and self-hosted versions are allowed for personal or community use,
provided they remain non-commercial and comply with the project license.

If you modify or self-host this project:
- You are responsible for complying with all third-party service terms
- Forked versions must clearly identify themselves as forks
- Forked versions must not impersonate or present themselves as the original project

Abuse of third-party services or misrepresentation of forked versions may
result in termination of license rights.

## Third-Party Data & Disclaimer

This project uses gameplay-related and pricing data from third-party services,
including community-operated services such as **poe.ninja**.

All Path of Exile trademarks, assets, and related intellectual property belong
to **Grinding Gear Games**.

This product is not affiliated with or endorsed by Grinding Gear Games in any way.

## Contributions

Contributions are welcome and appreciated.

Please note:
- Contributions are voluntary
- Contributors are not entitled to compensation or revenue sharing
- If the project ever receives funding, the author may choose to compensate
  contributors at their discretion

By contributing, you agree to the terms of the project license.
