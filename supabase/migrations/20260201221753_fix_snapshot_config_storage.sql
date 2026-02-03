-- =====================================================
-- Fix Snapshot Configuration Storage
-- =====================================================
-- This migration replaces the session-based configuration
-- with a persistent settings table.

-- =====================================================
-- Create settings table for persistent configuration
-- =====================================================
CREATE TABLE IF NOT EXISTS snapshot_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  supabase_url TEXT NOT NULL,
  service_role_key TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT singleton_settings CHECK (id = 1)
);

-- Enable RLS (only service_role can access)
ALTER TABLE snapshot_settings ENABLE ROW LEVEL SECURITY;

-- Service role can manage settings
CREATE POLICY "Service role can manage settings"
  ON snapshot_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Update set_snapshot_config function to use table
-- =====================================================
CREATE OR REPLACE FUNCTION set_snapshot_config(
  p_supabase_url TEXT,
  p_service_role_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update the singleton settings row
  INSERT INTO snapshot_settings (id, supabase_url, service_role_key, updated_at)
  VALUES (1, p_supabase_url, p_service_role_key, NOW())
  ON CONFLICT (id)
  DO UPDATE SET
    supabase_url = EXCLUDED.supabase_url,
    service_role_key = EXCLUDED.service_role_key,
    updated_at = NOW();

  RAISE NOTICE 'Snapshot configuration updated successfully';
END;
$$;

-- =====================================================
-- Update create_snapshots_for_active_leagues to read from table
-- =====================================================
CREATE OR REPLACE FUNCTION create_snapshots_for_active_leagues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  league_record RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Get settings from table
  SELECT supabase_url, service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM snapshot_settings
  WHERE id = 1;

  -- Check if settings exist
  IF v_supabase_url IS NULL THEN
    RAISE EXCEPTION 'Snapshot configuration not set. Please run: SELECT set_snapshot_config(''your-url'', ''your-key'');';
  END IF;

  -- Loop through all active leagues
  FOR league_record IN
    SELECT game, league_id
    FROM poe_leagues
    WHERE is_active = true
    ORDER BY game, league_id
  LOOP
    -- Call Edge Function for each league
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-snapshot-internal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object(
        'game', league_record.game,
        'leagueId', league_record.league_id
      )
    );

    -- Log the request (optional, for debugging)
    RAISE NOTICE 'Created snapshot request for % - %', league_record.game, league_record.league_id;

    -- 2 second delay between requests to avoid hammering poe.ninja
    PERFORM pg_sleep(2);
  END LOOP;

  RAISE NOTICE 'Completed snapshot creation for all active leagues';
END;
$$;

-- =====================================================
-- Helper function to view current settings
-- =====================================================
CREATE OR REPLACE FUNCTION get_snapshot_config()
RETURNS TABLE (
  supabase_url TEXT,
  service_role_key_preview TEXT,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.supabase_url,
    'sk_...' || RIGHT(s.service_role_key, 10) as service_role_key_preview,
    s.updated_at
  FROM snapshot_settings s
  WHERE id = 1;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_snapshot_config(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_snapshot_config() TO service_role;

-- =====================================================
-- Usage Instructions
-- =====================================================

-- Set configuration (persists in database):
-- SELECT set_snapshot_config(
--   'http://127.0.0.1:54321',
--   'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
-- );

-- View current configuration (key is partially hidden):
-- SELECT * FROM get_snapshot_config();

-- Run snapshot creation:
-- SELECT create_snapshots_for_active_leagues();
