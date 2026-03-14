-- Update sync_leagues_from_api() to call the new sync-leagues-internal
-- edge function instead of the deleted sync-leagues-legacy-internal.
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
    url := v_supabase_url || '/functions/v1/sync-leagues-internal',
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
