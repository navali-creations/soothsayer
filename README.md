# Soothsayer

Path of Exile divination card tracker

## Requirements

- Node.js 18+
- Docker Desktop

## Development

```bash
# Install dependencies
pnpm install

# Start local Supabase (data persists between restarts)
pnpm supabase:start

# Start app
pnpm start

# Stop Supabase when done (keeps data)
pnpm supabase:stop

# Fresh start (deletes all data)
pnpm supabase:start:fresh
```

**Production mode:** Just run `pnpm start` (no Supabase needed)

## Deploy to Production

```bash
# Link to production (one-time)
pnpx supabase link --project-ref <project-id>

# Push database migrations
pnpx supabase db push

# Deploy Edge Functions
pnpx supabase functions deploy
```
