-- =====================================================
-- Update Cron Schedules
-- 1. Change snapshot creation from 6h to 4h
-- 2. Add league sync cron job
-- =====================================================

-- =====================================================
-- Update Snapshot Cron: 6 hours → 4 hours
-- =====================================================

-- Unschedule the old 6-hour job
SELECT cron.unschedule('create-snapshots-every-6-hours');

-- Schedule new 4-hour job (matches production)
SELECT cron.schedule(
  'create-snapshots-every-4-hours',
  '0 */4 * * *', -- Every 4 hours
  $$SELECT create_snapshots_for_active_leagues();$$
);

COMMENT ON EXTENSION pg_cron IS
'Scheduled task: create-snapshots-every-4-hours runs every 4 hours';

-- =====================================================
-- Add League Sync Cron Job
-- Syncs leagues from poe.ninja API
-- =====================================================

-- First, create the database function to call the Edge Function
CREATE OR REPLACE FUNCTION sync_leagues_from_api()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_cron_secret TEXT;
BEGIN
  -- Get required settings
  SELECT supabase_url, service_role_key, cron_secret
  INTO v_supabase_url, v_service_role_key, v_cron_secret
  FROM snapshot_settings
  WHERE id = 1;

  -- Validate settings
  IF v_supabase_url IS NULL OR v_service_role_key IS NULL OR v_cron_secret IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Missing snapshot_settings configuration'
    );
  END IF;

  -- Call the Edge Function to sync leagues
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/sync-leagues-legacy-internal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', v_service_role_key,
      'Authorization', 'Bearer ' || v_service_role_key,
      'x-cron-secret', v_cron_secret
    ),
    body := jsonb_build_object('source', 'cron')
  );

  RAISE NOTICE 'League sync request sent to Edge Function';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'League sync triggered'
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_leagues_from_api() TO service_role;

COMMENT ON FUNCTION sync_leagues_from_api() IS
'Triggers league sync by calling the sync-leagues-legacy-internal Edge Function.
Runs daily to keep league data up-to-date from poe.ninja API.';

-- Schedule league sync: Daily at 1 AM UTC
-- (Runs before snapshot creation to ensure league data is fresh)
SELECT cron.schedule(
  'sync-leagues-daily',
  '0 1 * * *', -- Daily at 1 AM UTC
  $$SELECT sync_leagues_from_api();$$
);

-- =====================================================
-- Verify Cron Jobs
-- =====================================================

-- Query to view active cron jobs:
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- ORDER BY jobname;

-- =====================================================
-- Summary of Scheduled Jobs
-- =====================================================
--
-- 1. sync-leagues-daily
--    Schedule: 0 1 * * * (Daily at 1 AM UTC)
--    Function: sync_leagues_from_api()
--    Purpose: Fetch latest league data from poe.ninja
--
-- 2. create-snapshots-every-4-hours
--    Schedule: 0 */4 * * * (Every 4 hours)
--    Function: create_snapshots_for_active_leagues()
--    Purpose: Create price snapshots for all active leagues
--
-- =====================================================
