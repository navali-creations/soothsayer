-- =====================================================
-- Fix Functions to Return JSON for Studio UI Compatibility
-- =====================================================
-- This migration updates functions to return JSON instead of void
-- to fix display issues in Supabase Studio UI.

-- =====================================================
-- Drop existing functions to change return types
-- =====================================================
DROP FUNCTION IF EXISTS set_snapshot_config(TEXT, TEXT);
DROP FUNCTION IF EXISTS create_snapshots_for_active_leagues();
DROP FUNCTION IF EXISTS log_api_request(UUID, TEXT, TEXT, TEXT);

-- =====================================================
-- Update set_snapshot_config to return JSON
-- =====================================================
CREATE OR REPLACE FUNCTION set_snapshot_config(
  p_supabase_url TEXT,
  p_service_role_key TEXT
)
RETURNS JSON
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

  RETURN json_build_object(
    'success', true,
    'message', 'Snapshot configuration updated successfully',
    'url', p_supabase_url,
    'key_preview', 'sk_...' || RIGHT(p_service_role_key, 10),
    'updated_at', NOW()
  );
END;
$$;

-- =====================================================
-- Update create_snapshots_for_active_leagues to return JSON
-- =====================================================
CREATE OR REPLACE FUNCTION create_snapshots_for_active_leagues()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  league_record RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_league_count INTEGER := 0;
  v_start_time TIMESTAMPTZ;
BEGIN
  v_start_time := NOW();

  -- Get settings from table
  SELECT supabase_url, service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM snapshot_settings
  WHERE id = 1;

  -- Check if settings exist
  IF v_supabase_url IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Snapshot configuration not set',
      'message', 'Please run: SELECT set_snapshot_config(''your-url'', ''your-key'');'
    );
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

    -- Increment counter
    v_league_count := v_league_count + 1;

    -- Log the request
    RAISE NOTICE 'Created snapshot request for % - %', league_record.game, league_record.league_id;

    -- 2 second delay between requests to avoid hammering poe.ninja
    PERFORM pg_sleep(2);
  END LOOP;

  -- Return success with details
  RETURN json_build_object(
    'success', true,
    'message', 'Completed snapshot creation for all active leagues',
    'leagues_processed', v_league_count,
    'started_at', v_start_time,
    'completed_at', NOW(),
    'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))
  );
END;
$$;

-- =====================================================
-- Update log_api_request to return JSON
-- =====================================================
CREATE OR REPLACE FUNCTION log_api_request(
  p_user_id UUID,
  p_endpoint TEXT,
  p_app_version TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO api_requests (user_id, endpoint, app_version, ip)
  VALUES (p_user_id, p_endpoint, p_app_version, p_ip)
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_request_id,
    'message', 'API request logged successfully'
  );
END;
$$;

-- Update grants for new signatures
GRANT EXECUTE ON FUNCTION set_snapshot_config(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_snapshots_for_active_leagues() TO service_role;
GRANT EXECUTE ON FUNCTION log_api_request(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- =====================================================
-- Usage Examples
-- =====================================================

-- Set configuration - now returns JSON with confirmation
-- SELECT set_snapshot_config(
--   'http://127.0.0.1:54321',
--   'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
-- );

-- View configuration
-- SELECT * FROM get_snapshot_config();

-- Run snapshot creation - now returns JSON with summary
-- SELECT create_snapshots_for_active_leagues();

-- Log API request - now returns JSON with request ID
-- SELECT log_api_request(
--   auth.uid(),
--   '/api/v1/leagues',
--   '1.0.0',
--   '192.168.1.1'
-- );
