-- Migration: Update league sync cron schedule and backfill end_at for stale leagues
--
-- 1. Change the sync-leagues-daily cron from 1 AM UTC to midnight UTC
--    so we reliably catch weekend league endings (leagues typically end
--    ~3 days before a new league starts on Friday).
--
-- 2. Backfill end_at for any currently active leagues that disappeared
--    from the API without ever receiving an end date (e.g. Keepers).

-- Update cron schedule: daily at midnight UTC instead of 1 AM
SELECT cron.unschedule('sync-leagues-daily');
SELECT cron.schedule('sync-leagues-daily', '0 0 * * *', $$SELECT sync_leagues_from_api();$$);

-- Backfill end_at for Keepers league (ended ~March 2, 2026 at 21:00 UTC)
-- The PoE1 API never provided an endAt for challenge leagues, so we record
-- the known end time manually. The edge function will handle future cases
-- by stamping the current time when a league disappears from the API.
UPDATE poe_leagues
SET end_at = '2026-03-02T21:00:00Z',
    is_active = false,
    updated_at = NOW()
WHERE game = 'poe1'
  AND league_id = 'Keepers'
  AND end_at IS NULL;
