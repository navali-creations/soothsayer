-- =====================================================
-- Add pg_net extension and snapshot creator function
-- =====================================================

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =====================================================
-- Function: create_snapshots_for_active_leagues
-- Loops through active leagues and calls the Edge Function
-- to create snapshots for each league
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
  -- Get Supabase URL and service role key from vault or use environment
  -- For local development, these will be your local values
  -- For production, use Supabase secrets/vault
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Fallback to hardcoded values if settings not available
  -- NOTE: Replace these with your actual values or use Supabase Vault
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://kiyyaoaukqpfuzfdbxnn.supabase.co';
  END IF;

  -- Loop through all active leagues
  FOR league_record IN
    SELECT game, league_id
    FROM poe_leagues
    WHERE is_active = true
    ORDER BY game, league_id
  LOOP
    -- Call Edge Function for each league
    -- NOTE: In production, you should use Supabase Vault for the service role key
    -- This is a placeholder that will need to be configured
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-snapshot-internal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(v_service_role_key, 'SERVICE_ROLE_KEY_PLACEHOLDER')
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
-- Grant execute permission to service_role
-- =====================================================
GRANT EXECUTE ON FUNCTION create_snapshots_for_active_leagues() TO service_role;

-- =====================================================
-- Optional: Create a helper function to set configuration
-- This allows you to set the URL and key at runtime
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
  PERFORM set_config('app.settings.supabase_url', p_supabase_url, false);
  PERFORM set_config('app.settings.service_role_key', p_service_role_key, false);
END;
$$;

GRANT EXECUTE ON FUNCTION set_snapshot_config(TEXT, TEXT) TO service_role;

-- =====================================================
-- Usage Instructions (commented)
-- =====================================================

-- To use this function in production, first set your configuration:
-- SELECT set_snapshot_config(
--   'https://kiyyaoaukqpfuzfdbxnn.supabase.co',
--   'your-service-role-key-here'
-- );

-- Then call the snapshot creator:
-- SELECT create_snapshots_for_active_leagues();

-- For scheduled execution, you can use pg_cron:
-- SELECT cron.schedule(
--   'create-snapshots-hourly',
--   '0 * * * *', -- Every hour
--   'SELECT create_snapshots_for_active_leagues();'
-- );
