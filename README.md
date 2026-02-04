# Soothsayer

Path of Exile divination card tracker

## Requirements

- Node.js 18+
- Docker Desktop

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
VITE_SUPABASE_ANON_KEY=your_service_role_jwt_here
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
