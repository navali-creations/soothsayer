-- Add cron_secret to snapshot_settings
ALTER TABLE snapshot_settings ADD COLUMN IF NOT EXISTS cron_secret TEXT;

-- Update cron secret
UPDATE snapshot_settings SET cron_secret = '0be247236214534bb3f46fc9681fb345f4c423dcf6772f3017b28a18ce080226' WHERE id = 1;

-- Drop function to change return type from void to jsonb
DROP FUNCTION IF EXISTS create_snapshots_for_active_leagues();

-- Update function to use cron_secret header
CREATE OR REPLACE FUNCTION create_snapshots_for_active_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  league_record RECORD;
  v_supabase_url TEXT;
  v_cron_secret TEXT;
  v_league_count INT := 0;
BEGIN
  SELECT supabase_url, cron_secret INTO v_supabase_url, v_cron_secret FROM snapshot_settings WHERE id = 1;
  FOR league_record IN SELECT game, league_id FROM poe_leagues WHERE is_active = true LOOP
    v_league_count := v_league_count + 1;
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/create-snapshot-internal',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_cron_secret),
      body := jsonb_build_object('game', league_record.game, 'leagueId', league_record.league_id)
    );
    RAISE NOTICE 'Snapshot request: % - %', league_record.game, league_record.league_id;
    PERFORM pg_sleep(2);
  END LOOP;
  RETURN jsonb_build_object('success', true, 'leagues_processed', v_league_count);
END;
$$;
