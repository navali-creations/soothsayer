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

# Stop Supabase when done (keeps all data)
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

**Production mode:** 

To use the app with a deployed Supabase project, create a `.env` file in the root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_service_role_jwt_here
```

Then just run `pnpm start` (no local Supabase needed).

## Deploy to Production

```bash
# Link to production (one-time)
pnpx supabase link --project-ref <project-id>

# Push database migrations
pnpx supabase db push

# Deploy Edge Functions
pnpx supabase functions deploy
```
