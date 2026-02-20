-- =============================================================================
-- Database Function Tests: cleanup_old_api_requests
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
-- =============================================================================

BEGIN;

SELECT plan(11);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY FUNCTION EXISTS
-- ═══════════════════════════════════════════════════════════════

SELECT has_function(
  'public', 'cleanup_old_api_requests',
  'cleanup_old_api_requests() should exist'
);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY CRON JOB IS SCHEDULED
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM cron.job WHERE jobname = 'cleanup-old-api-requests'$$,
  ARRAY[1],
  'cleanup-old-api-requests cron job should be scheduled'
);

SELECT results_eq(
  $$SELECT schedule FROM cron.job WHERE jobname = 'cleanup-old-api-requests'$$,
  ARRAY['0 0 * * *'::text],
  'cleanup-old-api-requests cron job should run at midnight UTC daily'
);

-- ═══════════════════════════════════════════════════════════════
-- SEED TEST DATA
-- ═══════════════════════════════════════════════════════════════

-- Create test user in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'cc001111-cc00-cc00-cc00-cc0011110000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  NULL,
  '',
  NULL, NOW(), NOW(), '',
  '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: No-op when no old rows exist
-- ═══════════════════════════════════════════════════════════════

-- Insert a recent row (should not be deleted)
INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES ('a0000001-0000-0000-0000-000000000001', 'cc001111-cc00-cc00-cc00-cc0011110000', 'cleanup-test', NOW());

SELECT lives_ok(
  $$SELECT cleanup_old_api_requests()$$,
  'cleanup_old_api_requests should execute without error when no old rows exist'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE user_id = 'cc001111-cc00-cc00-cc00-cc0011110000'
      AND endpoint = 'cleanup-test'$$,
  ARRAY[1],
  'Recent row should be preserved after cleanup'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: Deletes rows older than 24h from start of current day
-- ═══════════════════════════════════════════════════════════════

-- Insert a row from 3 days ago (well past cutoff — must be deleted)
INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES ('a0000001-0000-0000-0000-000000000002', 'cc001111-cc00-cc00-cc00-cc0011110000', 'cleanup-old', NOW() - INTERVAL '3 days');

-- Insert a row from 2 days ago (also past cutoff — must be deleted)
INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES ('a0000001-0000-0000-0000-000000000003', 'cc001111-cc00-cc00-cc00-cc0011110000', 'cleanup-old', NOW() - INTERVAL '2 days');

SELECT cleanup_old_api_requests();

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE user_id = 'cc001111-cc00-cc00-cc00-cc0011110000'
      AND endpoint = 'cleanup-old'$$,
  ARRAY[0],
  'Rows older than 24h from start of day should be deleted'
);

-- The recent row from the first test should still be there
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE user_id = 'cc001111-cc00-cc00-cc00-cc0011110000'
      AND endpoint = 'cleanup-test'$$,
  ARRAY[1],
  'Recent row should still be preserved after deleting old rows'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: Boundary — row exactly at cutoff is preserved
--
-- Cutoff = date_trunc('day', now()) - interval '24 hours'
-- The WHERE clause uses strict "<", so a row at exactly the
-- cutoff timestamp should NOT be deleted.
-- ═══════════════════════════════════════════════════════════════

INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES (
  'a0000001-0000-0000-0000-000000000004',
  'cc001111-cc00-cc00-cc00-cc0011110000',
  'cleanup-boundary-exact',
  date_trunc('day', now()) - INTERVAL '24 hours'
);

SELECT cleanup_old_api_requests();

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE id = 'a0000001-0000-0000-0000-000000000004'$$,
  ARRAY[1],
  'Row at exactly the cutoff boundary should be preserved (strict < comparison)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: Boundary — row 1 second before cutoff is deleted
-- ═══════════════════════════════════════════════════════════════

INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES (
  'a0000001-0000-0000-0000-000000000005',
  'cc001111-cc00-cc00-cc00-cc0011110000',
  'cleanup-boundary-before',
  date_trunc('day', now()) - INTERVAL '24 hours' - INTERVAL '1 second'
);

SELECT cleanup_old_api_requests();

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE id = 'a0000001-0000-0000-0000-000000000005'$$,
  ARRAY[0],
  'Row 1 second before the cutoff should be deleted'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: Boundary — row 1 second after cutoff is preserved
-- ═══════════════════════════════════════════════════════════════

INSERT INTO api_requests (id, user_id, endpoint, created_at)
VALUES (
  'a0000001-0000-0000-0000-000000000006',
  'cc001111-cc00-cc00-cc00-cc0011110000',
  'cleanup-boundary-after',
  date_trunc('day', now()) - INTERVAL '24 hours' + INTERVAL '1 second'
);

SELECT cleanup_old_api_requests();

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE id = 'a0000001-0000-0000-0000-000000000006'$$,
  ARRAY[1],
  'Row 1 second after the cutoff should be preserved'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: Multiple runs are idempotent
--
-- At this point, 3 rows remain for this user:
--   - cleanup-test (NOW)
--   - cleanup-boundary-exact (at cutoff)
--   - cleanup-boundary-after (cutoff + 1s)
-- Running cleanup again should leave all 3 intact.
-- ═══════════════════════════════════════════════════════════════

SELECT cleanup_old_api_requests();

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE user_id = 'cc001111-cc00-cc00-cc00-cc0011110000'$$,
  ARRAY[3],
  'Running cleanup a second time should not delete any additional rows (idempotent)'
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════

SELECT * FROM finish();
ROLLBACK;
