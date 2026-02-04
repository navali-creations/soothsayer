-- Seed file for local development
-- This file is run after migrations during `supabase db reset`

-- The local_config table is populated dynamically by the setup script (scripts/setup-local-dev.sh)
-- which reads values from supabase/functions/.env
--
-- Required config keys:
--   - supabase_url: The local Supabase URL (e.g., http://host.docker.internal:54321)
--   - cron_secret: Value of INTERNAL_CRON_SECRET from supabase/functions/.env
--   - service_role_key: The local service role key
--
-- For production, use Supabase Vault for these secrets instead.

-- Seed default leagues for local development
INSERT INTO poe_leagues (game, league_id, name, is_active) VALUES
  ('poe1', 'Standard', 'Standard', true),
  ('poe2', 'Standard', 'Standard', true),
ON CONFLICT (game, league_id) DO NOTHING;
