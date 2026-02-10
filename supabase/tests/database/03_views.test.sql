-- =============================================================================
-- View Tests: abuse_monitor view
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
--
-- Tests verify:
--   1. View exists and has the expected columns
--   2. View correctly aggregates api_requests per (user_id, endpoint)
--   3. View correctly computes last_hour / last_24h window counts
--   4. View correctly reflects is_banned status from banned_users
--   5. Access control: only service_role can query the view
-- =============================================================================

BEGIN;

SELECT plan(21);

-- ═══════════════════════════════════════════════════════════════
-- VIEW EXISTENCE & COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_view('public', 'abuse_monitor', 'abuse_monitor view should exist');

SELECT has_column('public', 'abuse_monitor', 'user_id', 'abuse_monitor should have user_id column');
SELECT has_column('public', 'abuse_monitor', 'endpoint', 'abuse_monitor should have endpoint column');
SELECT has_column('public', 'abuse_monitor', 'request_count', 'abuse_monitor should have request_count column');
SELECT has_column('public', 'abuse_monitor', 'first_request', 'abuse_monitor should have first_request column');
SELECT has_column('public', 'abuse_monitor', 'last_request', 'abuse_monitor should have last_request column');
SELECT has_column('public', 'abuse_monitor', 'last_hour', 'abuse_monitor should have last_hour column');
SELECT has_column('public', 'abuse_monitor', 'last_24h', 'abuse_monitor should have last_24h column');
SELECT has_column('public', 'abuse_monitor', 'is_banned', 'abuse_monitor should have is_banned column');

-- ═══════════════════════════════════════════════════════════════
-- SEED TEST DATA
-- ═══════════════════════════════════════════════════════════════

-- Create test users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES
  (
    'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    NULL,
    '',
    NULL, NOW(), NOW(), '',
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
  ),
  (
    'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    NULL,
    '',
    NULL, NOW(), NOW(), '',
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
  ),
  (
    'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    NULL,
    '',
    NULL, NOW(), NOW(), '',
    '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
  );

-- User 1: 3 recent requests to endpoint-a, 1 to endpoint-b
INSERT INTO api_requests (user_id, endpoint, created_at) VALUES
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-a', NOW() - INTERVAL '10 minutes'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-a', NOW() - INTERVAL '20 minutes'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-a', NOW() - INTERVAL '30 minutes'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-b', NOW() - INTERVAL '5 minutes');

-- User 1: 2 old requests to endpoint-a (outside 1h but within 24h)
INSERT INTO api_requests (user_id, endpoint, created_at) VALUES
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-a', NOW() - INTERVAL '3 hours'),
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'endpoint-a', NOW() - INTERVAL '5 hours');

-- User 2: 1 recent request
INSERT INTO api_requests (user_id, endpoint, created_at) VALUES
  ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'endpoint-a', NOW() - INTERVAL '15 minutes');

-- User 3 (will be banned): 2 recent requests
INSERT INTO api_requests (user_id, endpoint, created_at) VALUES
  ('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'endpoint-a', NOW() - INTERVAL '5 minutes'),
  ('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'endpoint-a', NOW() - INTERVAL '10 minutes');

-- Ban user 3
INSERT INTO banned_users (user_id, reason)
VALUES ('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'View test ban');

-- ═══════════════════════════════════════════════════════════════
-- SERVICE_ROLE: AGGREGATION TESTS
-- ═══════════════════════════════════════════════════════════════

SET ROLE service_role;

-- User 1, endpoint-a should have 5 total (3 recent + 2 old)
SELECT results_eq(
  $$SELECT request_count::int FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[5],
  'abuse_monitor should count all requests for user 1 on endpoint-a (5 total)'
);

-- User 1, endpoint-a: last_hour should be 3 (only the recent ones)
SELECT results_eq(
  $$SELECT last_hour::int FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[3],
  'abuse_monitor last_hour should count only requests within 1 hour (3)'
);

-- User 1, endpoint-a: last_24h should be 5 (all are within 24h)
SELECT results_eq(
  $$SELECT last_24h::int FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[5],
  'abuse_monitor last_24h should count all requests within 24 hours (5)'
);

-- User 1, endpoint-b should have 1 total
SELECT results_eq(
  $$SELECT request_count::int FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-b'$$,
  ARRAY[1],
  'abuse_monitor should have separate row for endpoint-b with 1 request'
);

-- User 1 should NOT be banned
SELECT results_eq(
  $$SELECT is_banned FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[false],
  'abuse_monitor is_banned should be false for non-banned user 1'
);

-- User 2 should NOT be banned
SELECT results_eq(
  $$SELECT is_banned FROM abuse_monitor
    WHERE user_id = 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[false],
  'abuse_monitor is_banned should be false for non-banned user 2'
);

-- ═══════════════════════════════════════════════════════════════
-- SERVICE_ROLE: BANNED USER REFLECTED IN VIEW
-- ═══════════════════════════════════════════════════════════════

-- User 3 IS banned
SELECT results_eq(
  $$SELECT is_banned FROM abuse_monitor
    WHERE user_id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[true],
  'abuse_monitor is_banned should be true for banned user 3'
);

-- User 3, endpoint-a should have 2 requests
SELECT results_eq(
  $$SELECT request_count::int FROM abuse_monitor
    WHERE user_id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[2],
  'abuse_monitor should show request_count for banned user 3'
);

-- ═══════════════════════════════════════════════════════════════
-- SERVICE_ROLE: first_request / last_request ordering
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT (first_request < last_request)::boolean FROM abuse_monitor
    WHERE user_id = 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[true],
  'abuse_monitor first_request should be earlier than last_request'
);

-- ═══════════════════════════════════════════════════════════════
-- ACCESS CONTROL: anon and authenticated should NOT see the view
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;
SET ROLE anon;

SELECT throws_ok(
  $$SELECT * FROM abuse_monitor$$,
  '42501', -- insufficient_privilege
  NULL,
  'anon should NOT be able to query abuse_monitor'
);

RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1", "role": "authenticated"}';

SELECT throws_ok(
  $$SELECT * FROM abuse_monitor$$,
  '42501', -- insufficient_privilege
  NULL,
  'authenticated user should NOT be able to query abuse_monitor'
);

-- ═══════════════════════════════════════════════════════════════
-- EXPIRED BAN: user should no longer show as banned
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;

-- Update user 3's ban to have already expired
UPDATE banned_users
SET expires_at = NOW() - INTERVAL '1 hour'
WHERE user_id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3';

SET ROLE service_role;

SELECT results_eq(
  $$SELECT is_banned FROM abuse_monitor
    WHERE user_id = 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3'
      AND endpoint = 'endpoint-a'$$,
  ARRAY[false],
  'abuse_monitor is_banned should be false when ban has expired'
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
