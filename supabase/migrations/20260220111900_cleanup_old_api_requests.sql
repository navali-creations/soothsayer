-- ═══════════════════════════════════════════════════════════════
-- Migration: Scheduled cleanup of old api_requests rows
--
-- Adds a pg_cron job that runs daily at midnight (UTC) and deletes
-- all api_requests rows with created_at older than 24 hours from
-- the start of the current day (i.e. before yesterday's midnight).
--
-- This keeps at most ~24-48h of request data at any given time,
-- which is sufficient for rate-limiting and abuse monitoring while
-- preventing unbounded table growth.
-- ═══════════════════════════════════════════════════════════════

-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_api_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted BIGINT;
BEGIN
  -- Delete rows older than 24h from the start of the current day (midnight UTC).
  -- At midnight UTC, date_trunc('day', now()) IS now(), so the cutoff is
  -- exactly 24h ago = yesterday's midnight.
  DELETE FROM api_requests
  WHERE created_at < date_trunc('day', now()) - interval '24 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE LOG 'cleanup_old_api_requests: deleted % rows', v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_api_requests() TO service_role;
COMMENT ON FUNCTION cleanup_old_api_requests() IS 'Deletes api_requests rows older than 24h from the start of the current day. Called by pg_cron daily at midnight UTC.';

-- 2. Schedule the cron job to run at midnight UTC every day
SELECT cron.schedule(
  'cleanup-old-api-requests',
  '0 0 * * *',
  $$SELECT cleanup_old_api_requests();$$
);
