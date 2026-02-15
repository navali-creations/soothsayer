CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ═══════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE poe_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
  league_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game, league_id)
);

CREATE INDEX idx_poe_leagues_game_active ON poe_leagues(game, is_active);
CREATE INDEX idx_poe_leagues_updated ON poe_leagues(updated_at DESC);

CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE RESTRICT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exchange_chaos_to_divine NUMERIC(10, 2) NOT NULL,
  stash_chaos_to_divine NUMERIC(10, 2) NOT NULL,
  stacked_deck_chaos_cost NUMERIC(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON COLUMN snapshots.stacked_deck_chaos_cost IS 'Chaos cost of a single Stacked Deck from poe.ninja Currency API at snapshot time';

CREATE INDEX idx_snapshots_league_fetched ON snapshots(league_id, fetched_at DESC);
CREATE INDEX idx_snapshots_created ON snapshots(created_at DESC);

CREATE TABLE card_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE RESTRICT,
  card_name TEXT NOT NULL,
  price_source TEXT NOT NULL CHECK (price_source IN ('exchange', 'stash')),
  chaos_value NUMERIC(10, 2) NOT NULL,
  divine_value NUMERIC(10, 2) NOT NULL,
  confidence SMALLINT NOT NULL DEFAULT 1 CHECK (confidence IN (1, 2, 3))
);

COMMENT ON COLUMN card_prices.confidence IS 'poe.ninja price confidence: 1 = high/reliable, 2 = medium/thin sample, 3 = low/unreliable. Exchange prices are always 1.';

CREATE INDEX idx_card_prices_snapshot ON card_prices(snapshot_id);
CREATE INDEX idx_card_prices_snapshot_source ON card_prices(snapshot_id, price_source);
CREATE INDEX idx_card_prices_name ON card_prices(card_name);

-- API request log — no IP stored (privacy-first)
CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX api_requests_user_time_idx ON api_requests (user_id, created_at DESC);
CREATE INDEX api_requests_endpoint_idx ON api_requests (endpoint);
CREATE INDEX api_requests_created_idx ON api_requests (created_at DESC);

-- Banned users for abuse prevention
CREATE TABLE banned_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT,
  banned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_by TEXT DEFAULT 'system',
  expires_at TIMESTAMPTZ DEFAULT NULL,
  UNIQUE(user_id)
);

COMMENT ON TABLE banned_users IS 'Tracks banned anonymous users. expires_at NULL = permanent ban.';
COMMENT ON COLUMN banned_users.expires_at IS 'NULL means permanent ban. Set a timestamp for temporary bans.';

CREATE INDEX idx_banned_users_user_id ON banned_users (user_id);
CREATE INDEX idx_banned_users_expires ON banned_users (expires_at) WHERE expires_at IS NOT NULL;

-- Config table for cron job settings (populated by seed.sql for local dev, Vault for prod)
CREATE TABLE local_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE poe_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE poe_leagues FORCE ROW LEVEL SECURITY;
ALTER TABLE snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE card_prices FORCE ROW LEVEL SECURITY;
ALTER TABLE api_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE banned_users FORCE ROW LEVEL SECURITY;
ALTER TABLE local_config FORCE ROW LEVEL SECURITY;

-- local_config: service_role only
REVOKE ALL ON TABLE local_config FROM PUBLIC;
REVOKE ALL ON TABLE local_config FROM anon;
REVOKE ALL ON TABLE local_config FROM authenticated;
GRANT SELECT ON TABLE local_config TO service_role;
CREATE POLICY "service_role_only" ON local_config FOR ALL TO service_role USING (true) WITH CHECK (true);

-- poe_leagues: public read, service_role write
CREATE POLICY "Public read access for poe_leagues" ON poe_leagues FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_role_can_write_leagues" ON poe_leagues FOR ALL TO service_role USING (true) WITH CHECK (true);

-- snapshots: public read, service_role write
CREATE POLICY "Public read access for snapshots" ON snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role write access for snapshots" ON snapshots FOR ALL TO service_role USING (true) WITH CHECK (true);

-- card_prices: public read, service_role write
CREATE POLICY "Public read access for card_prices" ON card_prices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Service role write access for card_prices" ON card_prices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- api_requests: users see own rows, service_role full access
CREATE POLICY "own rows only" ON api_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "service_role_full_access" ON api_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- banned_users: service_role only
CREATE POLICY "service_role_full_access_bans" ON banned_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: Snapshot helpers
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_latest_snapshot_for_league(p_league_id UUID)
RETURNS TABLE (
  snapshot_id UUID,
  fetched_at TIMESTAMPTZ,
  exchange_chaos_to_divine NUMERIC,
  stash_chaos_to_divine NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.fetched_at, s.exchange_chaos_to_divine, s.stash_chaos_to_divine
  FROM snapshots s
  WHERE s.league_id = p_league_id
  ORDER BY s.fetched_at DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION get_latest_snapshot_for_league(UUID) TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: League timestamp trigger
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_league_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_poe_leagues_timestamp BEFORE UPDATE ON poe_leagues FOR EACH ROW EXECUTE FUNCTION update_league_timestamp();

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: API request logging (no IP — privacy-first)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION log_api_request(
  p_endpoint TEXT,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Authentication required');
  END IF;
  INSERT INTO api_requests (user_id, endpoint, app_version)
  VALUES (v_user_id, p_endpoint, p_app_version)
  RETURNING id INTO v_request_id;
  RETURN json_build_object('success', true, 'request_id', v_request_id, 'message', 'API request logged successfully');
END;
$$;

GRANT EXECUTE ON FUNCTION log_api_request(TEXT, TEXT) TO authenticated, service_role;
COMMENT ON FUNCTION log_api_request(TEXT, TEXT) IS 'SECURITY DEFINER with auth.uid() validation. No IP stored. User cannot impersonate others.';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: User request count
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_user_request_count(p_minutes INTEGER DEFAULT 60)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;
  SELECT COUNT(*) INTO v_count FROM api_requests WHERE user_id = v_user_id AND created_at >= NOW() - (p_minutes || ' minutes')::INTERVAL;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_request_count(INTEGER) TO authenticated, service_role;
COMMENT ON FUNCTION get_user_request_count(INTEGER) IS 'SECURITY DEFINER with auth.uid() validation. User can only query own request count.';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: Atomic rate limit check + log (replaces TOCTOU pattern)
--
-- This function does ban check + rate limit check + request logging
-- in a single atomic call, eliminating the race condition where two
-- concurrent requests could both pass the COUNT check before either INSERT.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_and_log_request(
  p_user_id UUID,
  p_endpoint TEXT,
  p_window_minutes INTEGER,
  p_max_hits INTEGER,
  p_app_version TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_is_banned BOOLEAN;
  v_ban_reason TEXT;
  v_request_id UUID;
BEGIN
  -- 1. Check if user is banned (permanent or active temporary ban)
  SELECT true, reason INTO v_is_banned, v_ban_reason
  FROM banned_users
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_is_banned THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'banned',
      'detail', COALESCE(v_ban_reason, 'Account suspended')
    );
  END IF;

  -- 2. Count existing requests in window
  SELECT COUNT(*) INTO v_count
  FROM api_requests
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;

  -- 3. Check rate limit
  IF v_count >= p_max_hits THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'detail', format('Rate limit: %s/%s requests in %s min window', v_count, p_max_hits, p_window_minutes)
    );
  END IF;

  -- 4. Log the request (atomic — this row is now visible to concurrent transactions)
  INSERT INTO api_requests (user_id, endpoint, app_version)
  VALUES (p_user_id, p_endpoint, p_app_version)
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'allowed', true,
    'request_id', v_request_id,
    'remaining', p_max_hits - v_count - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT) TO service_role;
COMMENT ON FUNCTION check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT) IS 'Atomic ban check + rate limit + request logging. Eliminates TOCTOU race. Service role only.';

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS: Ban / Unban helpers (admin use via SQL, dashboard, or edge function)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID,
  p_reason TEXT DEFAULT 'Abuse detected',
  p_duration_hours INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_duration_hours IS NOT NULL THEN
    v_expires := now() + (p_duration_hours || ' hours')::INTERVAL;
  END IF;

  INSERT INTO banned_users (user_id, reason, expires_at)
  VALUES (p_user_id, p_reason, v_expires)
  ON CONFLICT (user_id) DO UPDATE
    SET reason = EXCLUDED.reason,
        expires_at = EXCLUDED.expires_at,
        banned_at = now();

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'permanent', p_duration_hours IS NULL,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION unban_user(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM banned_users WHERE user_id = p_user_id;
  RETURN json_build_object('success', true, 'user_id', p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION ban_user(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION unban_user(UUID) TO service_role;

COMMENT ON FUNCTION ban_user(UUID, TEXT, INTEGER) IS 'Ban a user. NULL duration = permanent. Service role only.';
COMMENT ON FUNCTION unban_user(UUID) IS 'Remove a ban. Service role only.';

-- ═══════════════════════════════════════════════════════════════
-- VIEW: Abuse monitoring (admin dashboard queries)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW abuse_monitor AS
SELECT
  user_id,
  endpoint,
  COUNT(*) AS request_count,
  MIN(created_at) AS first_request,
  MAX(created_at) AS last_request,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '1 hour') AS last_hour,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS last_24h,
  EXISTS (
    SELECT 1 FROM banned_users b
    WHERE b.user_id = api_requests.user_id
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) AS is_banned
FROM api_requests
GROUP BY user_id, endpoint
ORDER BY last_24h DESC;

-- Only service_role can query the abuse monitor
REVOKE ALL ON abuse_monitor FROM PUBLIC;
REVOKE ALL ON abuse_monitor FROM anon;
REVOKE ALL ON abuse_monitor FROM authenticated;
GRANT SELECT ON abuse_monitor TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- CRON FUNCTIONS: Snapshot creation for all active leagues
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_snapshots_for_active_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  league_record RECORD;
  v_supabase_url TEXT;
  v_cron_secret TEXT;
  v_service_role_key TEXT;
  v_league_count INT := 0;
BEGIN
  -- Try Vault first (production), then local_config table (local dev)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
    SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
    SELECT decrypted_secret INTO v_service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_cron_secret := NULL;
    v_service_role_key := NULL;
  END;

  -- Fallback to local_config table (populated by seed.sql for local dev)
  IF v_supabase_url IS NULL THEN
    SELECT value INTO v_supabase_url FROM local_config WHERE key = 'supabase_url';
  END IF;
  IF v_cron_secret IS NULL THEN
    SELECT value INTO v_cron_secret FROM local_config WHERE key = 'cron_secret';
  END IF;
  IF v_service_role_key IS NULL THEN
    SELECT value INTO v_service_role_key FROM local_config WHERE key = 'service_role_key';
  END IF;

  IF v_supabase_url IS NULL OR v_cron_secret IS NULL OR v_service_role_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing config. Run seed.sql locally or configure Vault in production.');
  END IF;

  FOR league_record IN SELECT game, league_id FROM poe_leagues WHERE is_active = true ORDER BY game, league_id LOOP
    v_league_count := v_league_count + 1;
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-snapshot-internal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key,
        'x-cron-secret', v_cron_secret
      ),
      body := jsonb_build_object('game', league_record.game, 'leagueId', league_record.league_id)
    );
    PERFORM pg_sleep(2);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'leagues_processed', v_league_count);
END;
$$;

GRANT EXECUTE ON FUNCTION create_snapshots_for_active_leagues() TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- CRON FUNCTIONS: League sync from API
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_leagues_from_api()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supabase_url TEXT;
  v_cron_secret TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Try Vault first (production), then local_config table (local dev)
  BEGIN
    SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'supabase_url';
    SELECT decrypted_secret INTO v_cron_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret';
    SELECT decrypted_secret INTO v_service_role_key FROM vault.decrypted_secrets WHERE name = 'service_role_key';
  EXCEPTION WHEN OTHERS THEN
    v_supabase_url := NULL;
    v_cron_secret := NULL;
    v_service_role_key := NULL;
  END;

  -- Fallback to local_config table (populated by seed.sql for local dev)
  IF v_supabase_url IS NULL THEN
    SELECT value INTO v_supabase_url FROM local_config WHERE key = 'supabase_url';
  END IF;
  IF v_cron_secret IS NULL THEN
    SELECT value INTO v_cron_secret FROM local_config WHERE key = 'cron_secret';
  END IF;
  IF v_service_role_key IS NULL THEN
    SELECT value INTO v_service_role_key FROM local_config WHERE key = 'service_role_key';
  END IF;

  IF v_supabase_url IS NULL OR v_cron_secret IS NULL OR v_service_role_key IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing config. Run seed.sql locally or configure Vault in production.');
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/sync-leagues-legacy-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_role_key,
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object('source', 'cron')
  );

  RETURN jsonb_build_object('success', true, 'message', 'League sync triggered');
END;
$$;

GRANT EXECUTE ON FUNCTION sync_leagues_from_api() TO service_role;

-- ═══════════════════════════════════════════════════════════════
-- CRON SCHEDULE & PERMISSIONS
-- ═══════════════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN
    REVOKE ALL ON TABLE cron.job FROM PUBLIC;
    REVOKE ALL ON TABLE cron.job_run_details FROM PUBLIC;
    REVOKE ALL ON TABLE cron.job FROM anon;
    REVOKE ALL ON TABLE cron.job_run_details FROM anon;
    REVOKE ALL ON TABLE cron.job FROM authenticated;
    REVOKE ALL ON TABLE cron.job_run_details FROM authenticated;
    GRANT ALL ON TABLE cron.job TO service_role;
    GRANT ALL ON TABLE cron.job_run_details TO service_role;
  EXCEPTION
    WHEN undefined_table THEN NULL;
    WHEN insufficient_privilege THEN NULL;
  END;
END $$;

GRANT USAGE ON SCHEMA cron TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO service_role;

-- Schedule cron jobs
SELECT cron.schedule('sync-leagues-daily', '0 1 * * *', $$SELECT sync_leagues_from_api();$$);
SELECT cron.schedule('create-snapshots-every-4-hours', '0 */4 * * *', $$SELECT create_snapshots_for_active_leagues();$$);
