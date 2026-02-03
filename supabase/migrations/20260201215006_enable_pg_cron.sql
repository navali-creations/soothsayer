-- =====================================================
-- Enable pg_cron for scheduled tasks (OPTIONAL)
-- =====================================================
-- NOTE: pg_cron is available on Supabase hosted platforms.
-- For local development, this may not be available by default.
-- If you encounter errors, you can safely skip this migration.

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- Example: Schedule snapshot creation (commented out)
-- =====================================================
-- Uncomment and modify the schedule below to enable automatic snapshot creation

-- -- Run every 6 hours
-- SELECT cron.schedule(
--   'create-snapshots-every-6-hours',
--   '0 */6 * * *',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );

-- -- Run daily at 2 AM UTC
-- SELECT cron.schedule(
--   'create-snapshots-daily',
--   '0 2 * * *',
--   $$SELECT create_snapshots_for_active_leagues();$$
-- );

-- =====================================================
-- Helpful queries for managing cron jobs
-- =====================================================

-- View all scheduled jobs:
-- SELECT * FROM cron.job;

-- View job execution history:
-- SELECT
--   jobid,
--   runid,
--   job_name,
--   status,
--   return_message,
--   start_time,
--   end_time
-- FROM cron.job_run_details
-- ORDER BY start_time DESC
-- LIMIT 20;

-- Unschedule a job:
-- SELECT cron.unschedule('create-snapshots-every-6-hours');

-- =====================================================
-- Grant permissions
-- =====================================================
-- Allow service_role to manage cron jobs
GRANT USAGE ON SCHEMA cron TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO service_role;
