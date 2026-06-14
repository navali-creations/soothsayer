-- Supabase CLI 2.106.0 no longer auto-exposes public schema objects to
-- Data API roles when [api].auto_expose_new_tables is unset. Keep the
-- intended API surface explicit so RLS policies are reached only where needed.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public read surfaces, still filtered by RLS policies.
REVOKE ALL ON TABLE poe_leagues FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE card_prices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE cards FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE poe_leagues TO anon, authenticated;
GRANT SELECT ON TABLE snapshots TO anon, authenticated;
GRANT SELECT ON TABLE card_prices TO anon, authenticated;
GRANT SELECT ON TABLE cards TO anon, authenticated;

-- Authenticated users may read only their own request rows via RLS.
REVOKE ALL ON TABLE api_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE api_requests TO authenticated;

-- Service-role-only tables should fail at the privilege layer for client roles.
REVOKE ALL ON TABLE banned_users FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE community_uploads FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE community_card_data FROM PUBLIC, anon, authenticated;

-- Service role keeps the write surface used by edge functions and admin tools.
GRANT ALL ON TABLE poe_leagues TO service_role;
GRANT ALL ON TABLE snapshots TO service_role;
GRANT ALL ON TABLE card_prices TO service_role;
GRANT ALL ON TABLE api_requests TO service_role;
GRANT ALL ON TABLE banned_users TO service_role;
GRANT ALL ON TABLE cards TO service_role;
GRANT ALL ON TABLE community_uploads TO service_role;
GRANT ALL ON TABLE community_card_data TO service_role;

-- local_config only exists in local/dev databases. Production uses Vault for
-- these values, so keep this conditional for remotes that never created it.
DO $$
BEGIN
  IF to_regclass('public.local_config') IS NOT NULL THEN
    REVOKE ALL ON TABLE local_config FROM PUBLIC, anon, authenticated, service_role;
    GRANT SELECT ON TABLE local_config TO service_role;
  END IF;
END $$;
