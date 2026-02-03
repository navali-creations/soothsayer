-- =====================================================
-- Schedule Cron Jobs for Snapshot Creation
-- =====================================================
-- This migration creates scheduled jobs to automatically
-- create snapshots for all active leagues.

-- =====================================================
-- Schedule: Run every 6 hours
-- =====================================================
SELECT cron.schedule(
  'create-snapshots-every-6-hours',
  '0 */6 * * *',
  $$SELECT create_snapshots_for_active_leagues();$$
);

-- =====================================================
-- Alternative schedules (commented out)
-- =====================================================
-- Uncomment ONE of these if you prefer a different schedule

-- Run every hour
-- SELECT cron.schedule(
--   'create-snapshots-hourly',
--   '0 * * * *',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );

-- Run every 3 hours
-- SELECT cron.schedule(
--   'create-snapshots-every-3-hours',
--   '0 */3 * * *',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );

-- Run daily at 2 AM UTC
-- SELECT cron.schedule(
--   'create-snapshots-daily',
--   '0 2 * * *',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );

-- =====================================================
-- Verification Queries
-- =====================================================
-- After applying this migration, you can verify the job was created:
-- SELECT jobid, schedule, command, nodename, active FROM cron.job;

-- View job execution history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- =====================================================
-- To modify the schedule later
-- =====================================================
-- Unschedule the current job:
-- SELECT cron.unschedule('create-snapshots-every-6-hours');

-- Then create a new schedule:
-- SELECT cron.schedule(
--   'create-snapshots-custom',
--   'YOUR_CRON_EXPRESSION',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );
