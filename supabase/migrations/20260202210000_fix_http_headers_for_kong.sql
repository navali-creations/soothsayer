-- Fix create_snapshots_for_active_leagues to include apikey header for Kong
-- Kong API gateway requires the 'apikey' header for authentication
-- Without it, requests from pg_net are rejected with "Missing authorization header"

-- Drop and recreate function with correct headers
DROP FUNCTION IF EXISTS create_snapshots_for_active_leagues();

CREATE OR REPLACE FUNCTION create_snapshots_for_active_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  league_record RECORD;
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_cron_secret TEXT;
  v_league_count INT := 0;
BEGIN
  -- Get all required settings from snapshot_settings table
  SELECT supabase_url, service_role_key, cron_secret
  INTO v_supabase_url, v_service_role_key, v_cron_secret
  FROM snapshot_settings
  WHERE id = 1;

  -- Validate settings exist
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing snapshot_settings configuration. Run set_snapshot_config() first.'
    );
  END IF;

  IF v_cron_secret IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing cron_secret in snapshot_settings.'
    );
  END IF;

  -- Loop through all active leagues and trigger snapshot creation
  FOR league_record IN SELECT game, league_id FROM poe_leagues WHERE is_active = true LOOP
    v_league_count := v_league_count + 1;

    -- Call the Edge Function with all required headers:
    -- - apikey: Required by Kong API gateway for authentication
    -- - Authorization: Bearer token for Supabase auth (some functions may need this)
    -- - x-cron-secret: Custom header for internal cron job authentication
    -- - Content-Type: Standard JSON content type
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-snapshot-internal',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_service_role_key,
        'Authorization', 'Bearer ' || v_service_role_key,
        'x-cron-secret', v_cron_secret
      ),
      body := jsonb_build_object(
        'game', league_record.game,
        'leagueId', league_record.league_id
      )
    );

    RAISE NOTICE 'Snapshot request sent for: % - %', league_record.game, league_record.league_id;

    -- Small delay between requests to avoid overwhelming the Edge Function
    PERFORM pg_sleep(2);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'leagues_processed', v_league_count,
    'message', 'Snapshot requests sent for ' || v_league_count || ' active league(s)'
  );
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION create_snapshots_for_active_leagues() TO service_role;

COMMENT ON FUNCTION create_snapshots_for_active_leagues() IS
'Triggers snapshot creation for all active leagues by calling the create-snapshot-internal Edge Function.
Requires snapshot_settings to be configured with supabase_url, service_role_key, and cron_secret.
The function includes proper headers for Kong API gateway authentication (apikey) and custom cron authentication (x-cron-secret).';
