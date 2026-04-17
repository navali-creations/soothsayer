-- =============================================================================
-- Database Function Tests: check_and_log_request, ban/unban, rate limiting,
-- log_api_request, get_user_request_count, get_latest_snapshot_for_league,
-- update_league_timestamp trigger, flag_suspicious_uploads
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
-- =============================================================================

BEGIN;

SELECT plan(75);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY FUNCTIONS EXIST
-- ═══════════════════════════════════════════════════════════════

SELECT has_function(
  'public', 'check_and_log_request',
  ARRAY['uuid', 'text', 'integer', 'integer', 'text', 'text'],
  'check_and_log_request(uuid, text, int, int, text, text) should exist'
);

SELECT has_function(
  'public', 'ban_user',
  ARRAY['uuid', 'text', 'integer', 'text'],
  'ban_user(uuid, text, integer, text) should exist'
);

SELECT has_function(
  'public', 'unban_user',
  ARRAY['uuid', 'text'],
  'unban_user(uuid, text) should exist'
);

SELECT has_function(
  'public', 'log_api_request',
  ARRAY['text', 'text'],
  'log_api_request(text, text) should exist'
);

SELECT has_function(
  'public', 'get_user_request_count',
  ARRAY['integer'],
  'get_user_request_count(integer) should exist'
);

SELECT has_function(
  'public', 'get_latest_snapshot_for_league',
  ARRAY['uuid'],
  'get_latest_snapshot_for_league(uuid) should exist'
);

SELECT has_function(
  'public', 'create_snapshots_for_active_leagues',
  'create_snapshots_for_active_leagues() should exist'
);

SELECT has_function(
  'public', 'sync_leagues_from_api',
  'sync_leagues_from_api() should exist'
);

SELECT has_function(
  'public', 'populate_cards_for_game',
  ARRAY['text'],
  'populate_cards_for_game(text) should exist'
);

SELECT has_function(
  'public', 'flag_suspicious_uploads',
  ARRAY['uuid'],
  'flag_suspicious_uploads(uuid) should exist'
);

SELECT has_function(
  'public', 'manage_card_population_cron_jobs',
  'manage_card_population_cron_jobs() should exist'
);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY TRIGGER EXISTS
-- ═══════════════════════════════════════════════════════════════

SELECT trigger_is(
  'public', 'poe_leagues', 'update_poe_leagues_timestamp',
  'public', 'update_league_timestamp',
  'poe_leagues should have update_poe_leagues_timestamp trigger calling update_league_timestamp'
);

-- ═══════════════════════════════════════════════════════════════
-- SEED TEST DATA
-- ═══════════════════════════════════════════════════════════════

-- Create test users in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  NULL,
  '',
  NULL, NOW(), NOW(), '',
  '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
);

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  NULL,
  '',
  NULL, NOW(), NOW(), '',
  '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
);

-- Create test league and snapshot for get_latest_snapshot_for_league tests
INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES ('dddd4444-dddd-dddd-dddd-dddddddddddd', 'poe1', 'fn_test_league', 'Function Test League', true);

INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost)
VALUES ('eeee5555-eeee-eeee-eeee-eeeeeeeeeeee', 'dddd4444-dddd-dddd-dddd-dddddddddddd', NOW() - INTERVAL '2 hours', 140.00, 138.00, 1.2);

INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost)
VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'dddd4444-dddd-dddd-dddd-dddddddddddd', NOW(), 150.00, 148.00, 1.5);

-- Insert test cards for card_prices tests (Phase B: card_id is NOT NULL)
INSERT INTO cards (id, game, name) VALUES
  ('cc000001-0000-0000-0000-000000000001', 'poe1', 'Test Exchange'),
  ('cc000001-0000-0000-0000-000000000002', 'poe1', 'Test Stash'),
  ('cc000001-0000-0000-0000-000000000003', 'poe1', 'Test Bad'),
  ('cc000001-0000-0000-0000-000000000004', 'poe1', 'Confidence Default'),
  ('cc000001-0000-0000-0000-000000000005', 'poe1', 'Confidence 1'),
  ('cc000001-0000-0000-0000-000000000006', 'poe1', 'Confidence 2'),
  ('cc000001-0000-0000-0000-000000000007', 'poe1', 'Confidence 3'),
  ('cc000001-0000-0000-0000-000000000008', 'poe1', 'Confidence 0'),
  ('cc000001-0000-0000-0000-000000000009', 'poe1', 'Confidence 4');

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — allows request when under limit
-- ═══════════════════════════════════════════════════════════════

-- Call as service_role (this function is SECURITY DEFINER, granted to service_role)
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'test-endpoint',
    60,
    5,
    '1.0.0'
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'check_and_log_request should allow first request under limit'
);

-- Verify request was logged
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND endpoint = 'test-endpoint'$$,
  ARRAY[1],
  'check_and_log_request should have logged the request'
);

-- Verify 'remaining' count is returned
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'test-endpoint',
    60,
    5,
    '1.0.0'
  ))::json->>'remaining'$$,
  ARRAY['3'],
  'check_and_log_request should return correct remaining count'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — rate limit enforcement
-- ═══════════════════════════════════════════════════════════════

-- Fill up the remaining requests to hit the limit (we have 2 already, limit is 5)
SELECT check_and_log_request('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-endpoint', 60, 5, NULL);
SELECT check_and_log_request('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-endpoint', 60, 5, NULL);
SELECT check_and_log_request('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-endpoint', 60, 5, NULL);

-- Now the 6th request should be rate limited
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'test-endpoint',
    60,
    5,
    NULL
  ))::json->>'allowed'$$,
  ARRAY['false'],
  'check_and_log_request should deny request when rate limit reached'
);

SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'test-endpoint',
    60,
    5,
    NULL
  ))::json->>'reason'$$,
  ARRAY['rate_limited'],
  'check_and_log_request should return reason = rate_limited'
);

-- Different endpoint should still be allowed (rate limit is per endpoint)
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'different-endpoint',
    60,
    5,
    NULL
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'check_and_log_request should allow requests to a different endpoint'
);

-- Different user on same endpoint should still be allowed
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'test-endpoint',
    60,
    5,
    NULL
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'check_and_log_request should allow requests from a different user'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: ban_user — permanent ban
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT (ban_user(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Test abuse',
    NULL
  ))::json->>'success'$$,
  ARRAY['true'],
  'ban_user should return success for permanent ban'
);

SELECT results_eq(
  $$SELECT (ban_user(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Test abuse',
    NULL
  ))::json->>'permanent'$$,
  ARRAY['true'],
  'ban_user with NULL duration should be permanent'
);

-- Verify the user is actually in banned_users
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM banned_users
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[1],
  'banned_users should contain the banned user'
);

-- Verify banned user expires_at is NULL (permanent)
SELECT results_eq(
  $$SELECT expires_at IS NULL AS is_permanent FROM banned_users
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[true],
  'permanent ban should have NULL expires_at'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — banned user is rejected
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'any-endpoint',
    60,
    100,
    NULL
  ))::json->>'allowed'$$,
  ARRAY['false'],
  'check_and_log_request should deny banned user'
);

SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'any-endpoint',
    60,
    100,
    NULL
  ))::json->>'reason'$$,
  ARRAY['banned'],
  'check_and_log_request should return reason = banned for banned user'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: unban_user
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT (unban_user('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'))::json->>'success'$$,
  ARRAY['true'],
  'unban_user should return success'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM banned_users
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[0],
  'unban_user should remove the user from banned_users'
);

-- After unbanning, the user should be able to make requests again
-- (but they're still rate limited from earlier, so use a fresh endpoint)
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'fresh-endpoint-after-unban',
    60,
    5,
    NULL
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'unbanned user should be able to make requests again'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: ban_user — temporary ban (with duration)
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT (ban_user(
    'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Temporary abuse',
    24
  ))::json->>'permanent'$$,
  ARRAY['false'],
  'ban_user with duration should NOT be permanent'
);

-- Verify expires_at is set (not NULL)
SELECT results_eq(
  $$SELECT expires_at IS NOT NULL AS has_expiry FROM banned_users
    WHERE user_id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  ARRAY[true],
  'temporary ban should have a non-NULL expires_at'
);

-- Verify the banned user is rejected
SELECT results_eq(
  $$SELECT (check_and_log_request(
    'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'any-endpoint',
    60,
    100,
    NULL
  ))::json->>'reason'$$,
  ARRAY['banned'],
  'temporarily banned user should be rejected'
);

-- Clean up temporary ban for further tests
SELECT unban_user('bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ═══════════════════════════════════════════════════════════════
-- TEST: ban_user — upsert behavior (re-banning updates reason)
-- ═══════════════════════════════════════════════════════════════

SELECT ban_user('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'First reason', NULL);
SELECT ban_user('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Updated reason', 12);

SELECT results_eq(
  $$SELECT reason FROM banned_users
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY['Updated reason'::text],
  'ban_user should upsert — re-banning should update the reason'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM banned_users
    WHERE user_id = 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  ARRAY[1],
  'ban_user upsert should not create duplicate rows'
);

SELECT unban_user('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- ═══════════════════════════════════════════════════════════════
-- TEST: get_latest_snapshot_for_league — returns most recent snapshot
-- ═══════════════════════════════════════════════════════════════

SELECT results_eq(
  $$SELECT snapshot_id::text FROM get_latest_snapshot_for_league('dddd4444-dddd-dddd-dddd-dddddddddddd')$$,
  ARRAY['ffff6666-ffff-ffff-ffff-ffffffffffff'],
  'get_latest_snapshot_for_league should return the most recent snapshot'
);

SELECT results_eq(
  $$SELECT exchange_chaos_to_divine::numeric FROM get_latest_snapshot_for_league('dddd4444-dddd-dddd-dddd-dddddddddddd')$$,
  ARRAY[150.00::numeric],
  'get_latest_snapshot_for_league should return correct exchange ratio for latest snapshot'
);

-- Non-existent league should return empty
SELECT is_empty(
  $$SELECT * FROM get_latest_snapshot_for_league('00000000-0000-0000-0000-000000000000')$$,
  'get_latest_snapshot_for_league should return empty for non-existent league'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: update_league_timestamp trigger
-- ═══════════════════════════════════════════════════════════════

-- Record the current updated_at
SELECT results_eq(
  $$WITH before AS (
      SELECT updated_at FROM poe_leagues WHERE id = 'dddd4444-dddd-dddd-dddd-dddddddddddd'
    ),
    do_update AS (
      UPDATE poe_leagues SET name = 'Updated League Name'
      WHERE id = 'dddd4444-dddd-dddd-dddd-dddddddddddd'
      RETURNING updated_at
    )
    SELECT (do_update.updated_at >= before.updated_at)::boolean
    FROM before, do_update$$,
  ARRAY[true],
  'update_league_timestamp trigger should update updated_at on row update'
);

-- Verify the name was actually updated (trigger didn't break the UPDATE)
SELECT results_eq(
  $$SELECT name FROM poe_leagues WHERE id = 'dddd4444-dddd-dddd-dddd-dddddddddddd'$$,
  ARRAY['Updated League Name'::text],
  'UPDATE should still apply correctly with the trigger active'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — app_version is stored
-- ═══════════════════════════════════════════════════════════════

SELECT check_and_log_request(
  'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'version-test-endpoint',
  60, 10,
  '2.5.0'
);

SELECT results_eq(
  $$SELECT app_version FROM api_requests
    WHERE user_id = 'bbbb2222-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      AND endpoint = 'version-test-endpoint'
    ORDER BY created_at DESC
    LIMIT 1$$,
  ARRAY['2.5.0'::text],
  'check_and_log_request should store app_version in api_requests'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: card_prices price_source CHECK constraint
-- ═══════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000001', 'exchange', 10.00, 0.0667)$$,
  'card_prices should accept price_source = exchange'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000002', 'stash', 10.00, 0.0667)$$,
  'card_prices should accept price_source = stash'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000003', 'invalid_source', 10.00, 0.0667)$$,
  '23514', -- check_violation
  NULL,
  'card_prices should reject invalid price_source (CHECK constraint)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: card_prices confidence CHECK constraint and DEFAULT
-- ═══════════════════════════════════════════════════════════════

-- Default value: inserting without confidence should default to 1
SELECT results_eq(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000004', 'exchange', 5.00, 0.03)
    RETURNING confidence::int$$,
  ARRAY[1],
  'card_prices.confidence should default to 1 when not specified'
);

-- Accepts valid confidence values: 1, 2, 3
SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000005', 'stash', 5.00, 0.03, 1)$$,
  'card_prices should accept confidence = 1'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000006', 'stash', 5.00, 0.03, 2)$$,
  'card_prices should accept confidence = 2'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000007', 'stash', 5.00, 0.03, 3)$$,
  'card_prices should accept confidence = 3'
);

-- Rejects invalid confidence values
SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000008', 'stash', 5.00, 0.03, 0)$$,
  '23514', -- check_violation
  NULL,
  'card_prices should reject confidence = 0 (CHECK constraint)'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_id, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'cc000001-0000-0000-0000-000000000009', 'stash', 5.00, 0.03, 4)$$,
  '23514', -- check_violation
  NULL,
  'card_prices should reject confidence = 4 (CHECK constraint)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: snapshots FK constraint (ON DELETE RESTRICT)
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  $$DELETE FROM poe_leagues WHERE id = 'dddd4444-dddd-dddd-dddd-dddddddddddd'$$,
  '23503', -- foreign_key_violation (RESTRICT)
  NULL,
  'Deleting a league with snapshots should fail (ON DELETE RESTRICT)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — identifier-based rate limiting
-- ═══════════════════════════════════════════════════════════════

-- Identifier-based request should be allowed
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'api-key-endpoint',
    p_window_minutes := 60,
    p_max_hits := 3,
    p_app_version := NULL,
    p_identifier := 'test-api-key-001'
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'check_and_log_request should allow identifier-based request under limit'
);

-- Verify it was logged with identifier (not user_id)
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests
    WHERE identifier = 'test-api-key-001'
      AND endpoint = 'api-key-endpoint'
      AND user_id IS NULL$$,
  ARRAY[1],
  'identifier-based request should be logged with NULL user_id'
);

-- Fill up to rate limit (2 more, limit is 3)
SELECT check_and_log_request(
  p_user_id := NULL, p_endpoint := 'api-key-endpoint',
  p_window_minutes := 60, p_max_hits := 3,
  p_app_version := NULL, p_identifier := 'test-api-key-001'
);
SELECT check_and_log_request(
  p_user_id := NULL, p_endpoint := 'api-key-endpoint',
  p_window_minutes := 60, p_max_hits := 3,
  p_app_version := NULL, p_identifier := 'test-api-key-001'
);

-- 4th request should be rate limited
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'api-key-endpoint',
    p_window_minutes := 60,
    p_max_hits := 3,
    p_app_version := NULL,
    p_identifier := 'test-api-key-001'
  ))::json->>'reason'$$,
  ARRAY['rate_limited'],
  'identifier-based request should be rate limited after exceeding max hits'
);

-- Different identifier on same endpoint should be allowed
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'api-key-endpoint',
    p_window_minutes := 60,
    p_max_hits := 3,
    p_app_version := NULL,
    p_identifier := 'test-api-key-002'
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'different identifier on same endpoint should be allowed (isolated rate limits)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: check_and_log_request — identity validation (fail-closed)
-- ═══════════════════════════════════════════════════════════════

-- Both identities provided: should fail
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    p_endpoint := 'test',
    p_window_minutes := 60,
    p_max_hits := 10,
    p_app_version := NULL,
    p_identifier := 'some-key'
  ))::json->>'reason'$$,
  ARRAY['invalid_request'],
  'check_and_log_request should reject when both user_id and identifier are provided'
);

-- Neither identity provided: should fail
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'test',
    p_window_minutes := 60,
    p_max_hits := 10,
    p_app_version := NULL,
    p_identifier := NULL
  ))::json->>'reason'$$,
  ARRAY['invalid_request'],
  'check_and_log_request should reject when neither user_id nor identifier is provided'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: ban_user / unban_user — identifier-based banning
-- ═══════════════════════════════════════════════════════════════

-- Ban an identifier
SELECT results_eq(
  $$SELECT (ban_user(
    p_user_id := NULL,
    p_reason := 'API key abuse',
    p_duration_hours := NULL,
    p_identifier := 'banned-api-key'
  ))::json->>'success'$$,
  ARRAY['true'],
  'ban_user should succeed for identifier-based ban'
);

-- Verify banned identifier is rejected by check_and_log_request
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'any-endpoint',
    p_window_minutes := 60,
    p_max_hits := 100,
    p_app_version := NULL,
    p_identifier := 'banned-api-key'
  ))::json->>'reason'$$,
  ARRAY['banned'],
  'check_and_log_request should reject banned identifier'
);

-- Unban the identifier
SELECT results_eq(
  $$SELECT (unban_user(
    p_user_id := NULL,
    p_identifier := 'banned-api-key'
  ))::json->>'success'$$,
  ARRAY['true'],
  'unban_user should succeed for identifier-based unban'
);

-- After unbanning, identifier should be allowed again
SELECT results_eq(
  $$SELECT (check_and_log_request(
    p_user_id := NULL,
    p_endpoint := 'any-endpoint',
    p_window_minutes := 60,
    p_max_hits := 100,
    p_app_version := NULL,
    p_identifier := 'banned-api-key'
  ))::json->>'allowed'$$,
  ARRAY['true'],
  'unbanned identifier should be allowed to make requests again'
);

-- ban_user validation: both identities should fail
SELECT results_eq(
  $$SELECT (ban_user(
    p_user_id := 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    p_reason := 'test',
    p_duration_hours := NULL,
    p_identifier := 'some-key'
  ))::json->>'success'$$,
  ARRAY['false'],
  'ban_user should fail when both user_id and identifier are provided'
);

-- ban_user validation: neither identity should fail
SELECT results_eq(
  $$SELECT (ban_user(
    p_user_id := NULL,
    p_reason := 'test',
    p_duration_hours := NULL,
    p_identifier := NULL
  ))::json->>'success'$$,
  ARRAY['false'],
  'ban_user should fail when neither user_id nor identifier is provided'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: populate_cards_for_game — populates cards from card_prices
-- ═══════════════════════════════════════════════════════════════

-- The test cards already exist from the seed data above.
-- populate_cards_for_game should find them via card_id JOIN but insert 0 new cards.
SELECT results_eq(
  $$SELECT populate_cards_for_game('poe1')$$,
  ARRAY[0],
  'populate_cards_for_game should insert 0 new cards (all already exist from seed data)'
);

-- Running again should still insert 0 (idempotent)
SELECT results_eq(
  $$SELECT populate_cards_for_game('poe1')$$,
  ARRAY[0],
  'populate_cards_for_game should be idempotent (0 new cards on re-run)'
);

-- Invalid game should return 0
SELECT results_eq(
  $$SELECT populate_cards_for_game('poe3')$$,
  ARRAY[0],
  'populate_cards_for_game should return 0 for invalid game'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: flag_suspicious_uploads — statistical outlier detection
-- ═══════════════════════════════════════════════════════════════

-- --- Seed data for flag_suspicious_uploads tests ---

-- Dedicated league for outlier / normal / idempotency tests
INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES ('fa000000-0000-0000-0000-000000000001', 'poe1', 'flag_test_league_1', 'Flag Test League 1', true);

-- Test cards (needed as FK targets for community_card_data)
INSERT INTO cards (id, game, name) VALUES
  ('fc000000-0000-0000-0000-000000000001', 'poe1', 'Flag Test Card A'),
  ('fc000000-0000-0000-0000-000000000002', 'poe1', 'Flag Test Card B'),
  ('fc000000-0000-0000-0000-000000000003', 'poe1', 'Flag Test Card C'),
  ('fc000000-0000-0000-0000-000000000004', 'poe1', 'Flag Test Card D');

-- Normal uploads: 20 tightly clustered totals around 100.
-- We need many normals so the single outlier doesn't inflate the stddev
-- enough to hide itself (the function includes ALL non-suspicious rows
-- in the baseline, including the outlier being evaluated).
INSERT INTO community_uploads (id, league_id, device_id, total_cards_uploaded)
VALUES
  ('f0000000-0000-0000-0000-000000000001', 'fa000000-0000-0000-0000-000000000001', 'device-normal-01', 95),
  ('f0000000-0000-0000-0000-000000000002', 'fa000000-0000-0000-0000-000000000001', 'device-normal-02', 100),
  ('f0000000-0000-0000-0000-000000000003', 'fa000000-0000-0000-0000-000000000001', 'device-normal-03', 105),
  ('f0000000-0000-0000-0000-000000000004', 'fa000000-0000-0000-0000-000000000001', 'device-normal-04', 110),
  ('f0000000-0000-0000-0000-000000000031', 'fa000000-0000-0000-0000-000000000001', 'device-normal-05', 97),
  ('f0000000-0000-0000-0000-000000000032', 'fa000000-0000-0000-0000-000000000001', 'device-normal-06', 102),
  ('f0000000-0000-0000-0000-000000000033', 'fa000000-0000-0000-0000-000000000001', 'device-normal-07', 98),
  ('f0000000-0000-0000-0000-000000000034', 'fa000000-0000-0000-0000-000000000001', 'device-normal-08', 103),
  ('f0000000-0000-0000-0000-000000000035', 'fa000000-0000-0000-0000-000000000001', 'device-normal-09', 99),
  ('f0000000-0000-0000-0000-000000000036', 'fa000000-0000-0000-0000-000000000001', 'device-normal-10', 101),
  ('f0000000-0000-0000-0000-000000000037', 'fa000000-0000-0000-0000-000000000001', 'device-normal-11', 96),
  ('f0000000-0000-0000-0000-000000000038', 'fa000000-0000-0000-0000-000000000001', 'device-normal-12', 104),
  ('f0000000-0000-0000-0000-000000000039', 'fa000000-0000-0000-0000-000000000001', 'device-normal-13', 107),
  ('f0000000-0000-0000-0000-00000000003a', 'fa000000-0000-0000-0000-000000000001', 'device-normal-14', 93),
  ('f0000000-0000-0000-0000-00000000003b', 'fa000000-0000-0000-0000-000000000001', 'device-normal-15', 108),
  ('f0000000-0000-0000-0000-00000000003c', 'fa000000-0000-0000-0000-000000000001', 'device-normal-16', 92),
  ('f0000000-0000-0000-0000-00000000003d', 'fa000000-0000-0000-0000-000000000001', 'device-normal-17', 106),
  ('f0000000-0000-0000-0000-00000000003e', 'fa000000-0000-0000-0000-000000000001', 'device-normal-18', 94),
  ('f0000000-0000-0000-0000-00000000003f', 'fa000000-0000-0000-0000-000000000001', 'device-normal-19', 109),
  ('f0000000-0000-0000-0000-000000000040', 'fa000000-0000-0000-0000-000000000001', 'device-normal-20', 91);

-- Extreme outlier upload (total = 10000, well beyond mean + 3*stddev even
-- when included in the baseline alongside 20 normals ~100).
INSERT INTO community_uploads (id, league_id, device_id, total_cards_uploaded)
VALUES ('f0000000-0000-0000-0000-000000000005', 'fa000000-0000-0000-0000-000000000001', 'device-outlier', 10000);

-- Give normal uploads non-round card data (so they don't trigger round-number check).
-- Only need entries for the first 4 (function only checks card_data rows, and the
-- remaining 16 normals simply have no card_data rows, which means 0 total_entries
-- and the round-number check short-circuits on v_total_entries > 0).
INSERT INTO community_card_data (upload_id, card_id, count) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000001', 47),
  ('f0000000-0000-0000-0000-000000000001', 'fc000000-0000-0000-0000-000000000002', 48),
  ('f0000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000001', 51),
  ('f0000000-0000-0000-0000-000000000002', 'fc000000-0000-0000-0000-000000000002', 49),
  ('f0000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000001', 53),
  ('f0000000-0000-0000-0000-000000000003', 'fc000000-0000-0000-0000-000000000002', 52),
  ('f0000000-0000-0000-0000-000000000004', 'fc000000-0000-0000-0000-000000000001', 55),
  ('f0000000-0000-0000-0000-000000000004', 'fc000000-0000-0000-0000-000000000002', 55);

-- Give outlier upload non-round card data too (isolate to card_ratio_outlier only)
INSERT INTO community_card_data (upload_id, card_id, count) VALUES
  ('f0000000-0000-0000-0000-000000000005', 'fc000000-0000-0000-0000-000000000001', 4999),
  ('f0000000-0000-0000-0000-000000000005', 'fc000000-0000-0000-0000-000000000002', 5001);

-- --- Test 1: Clear outlier is flagged ---

SELECT results_eq(
  $$SELECT flag_suspicious_uploads('fa000000-0000-0000-0000-000000000001')$$,
  ARRAY[1],
  'flag_suspicious_uploads should return 1 (one outlier flagged)'
);

SELECT results_eq(
  $$SELECT is_suspicious FROM community_uploads WHERE id = 'f0000000-0000-0000-0000-000000000005'$$,
  ARRAY[true],
  'Outlier upload (total=10000) should have is_suspicious = true'
);

SELECT results_eq(
  $$SELECT 'card_ratio_outlier' = ANY(suspicion_reasons) FROM community_uploads WHERE id = 'f0000000-0000-0000-0000-000000000005'$$,
  ARRAY[true],
  'Outlier upload should have card_ratio_outlier in suspicion_reasons'
);

-- --- Test 2: Normal uploads are NOT flagged ---

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM community_uploads
    WHERE league_id = 'fa000000-0000-0000-0000-000000000001'
      AND is_suspicious = true
      AND id != 'f0000000-0000-0000-0000-000000000005'$$,
  ARRAY[0],
  'Normal uploads should NOT be flagged as suspicious'
);

-- --- Test 3: Idempotency — running again returns 0, no double-flagging ---

SELECT results_eq(
  $$SELECT flag_suspicious_uploads('fa000000-0000-0000-0000-000000000001')$$,
  ARRAY[0],
  'flag_suspicious_uploads should return 0 on second run (idempotent)'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM community_uploads
    WHERE league_id = 'fa000000-0000-0000-0000-000000000001'
      AND is_suspicious = true$$,
  ARRAY[1],
  'After second run, still only 1 upload should be flagged (no double-flagging)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: flag_suspicious_uploads — too_many_round_numbers
-- ═══════════════════════════════════════════════════════════════

-- Dedicated league for the round-number test
INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES ('fa000000-0000-0000-0000-000000000002', 'poe1', 'flag_test_league_2', 'Flag Test League 2', true);

-- Two uploads with identical totals (so stddev=0, no outlier check fires)
INSERT INTO community_uploads (id, league_id, device_id, total_cards_uploaded)
VALUES
  ('f0000000-0000-0000-0000-000000000010', 'fa000000-0000-0000-0000-000000000002', 'device-round-1', 200),
  ('f0000000-0000-0000-0000-000000000011', 'fa000000-0000-0000-0000-000000000002', 'device-round-2', 200);

-- Upload 10: >50% round counts (3 out of 4 are multiples of 10 = 75%)
INSERT INTO community_card_data (upload_id, card_id, count) VALUES
  ('f0000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000001', 50),
  ('f0000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000002', 30),
  ('f0000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000003', 20),
  ('f0000000-0000-0000-0000-000000000010', 'fc000000-0000-0000-0000-000000000004', 7);

-- Upload 11: no round counts (clean upload)
INSERT INTO community_card_data (upload_id, card_id, count) VALUES
  ('f0000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000001', 51),
  ('f0000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000002', 33),
  ('f0000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000003', 27),
  ('f0000000-0000-0000-0000-000000000011', 'fc000000-0000-0000-0000-000000000004', 89);

SELECT results_eq(
  $$SELECT flag_suspicious_uploads('fa000000-0000-0000-0000-000000000002')$$,
  ARRAY[1],
  'flag_suspicious_uploads should flag 1 upload with too many round numbers'
);

SELECT results_eq(
  $$SELECT is_suspicious FROM community_uploads WHERE id = 'f0000000-0000-0000-0000-000000000010'$$,
  ARRAY[true],
  'Upload with >50% round card counts should be flagged as suspicious'
);

SELECT results_eq(
  $$SELECT 'too_many_round_numbers' = ANY(suspicion_reasons) FROM community_uploads WHERE id = 'f0000000-0000-0000-0000-000000000010'$$,
  ARRAY[true],
  'Round-number upload should have too_many_round_numbers in suspicion_reasons'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: flag_suspicious_uploads — stddev=0 guard (all identical totals)
-- ═══════════════════════════════════════════════════════════════

-- Dedicated league for stddev=0 test
INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES ('fa000000-0000-0000-0000-000000000003', 'poe1', 'flag_test_league_3', 'Flag Test League 3', true);

-- Three uploads with identical totals (stddev = 0)
INSERT INTO community_uploads (id, league_id, device_id, total_cards_uploaded)
VALUES
  ('f0000000-0000-0000-0000-000000000020', 'fa000000-0000-0000-0000-000000000003', 'device-std0-1', 100),
  ('f0000000-0000-0000-0000-000000000021', 'fa000000-0000-0000-0000-000000000003', 'device-std0-2', 100),
  ('f0000000-0000-0000-0000-000000000022', 'fa000000-0000-0000-0000-000000000003', 'device-std0-3', 100);

-- Give them all non-round card data so round-number check doesn't fire
INSERT INTO community_card_data (upload_id, card_id, count) VALUES
  ('f0000000-0000-0000-0000-000000000020', 'fc000000-0000-0000-0000-000000000001', 51),
  ('f0000000-0000-0000-0000-000000000020', 'fc000000-0000-0000-0000-000000000002', 49),
  ('f0000000-0000-0000-0000-000000000021', 'fc000000-0000-0000-0000-000000000001', 48),
  ('f0000000-0000-0000-0000-000000000021', 'fc000000-0000-0000-0000-000000000002', 52),
  ('f0000000-0000-0000-0000-000000000022', 'fc000000-0000-0000-0000-000000000001', 53),
  ('f0000000-0000-0000-0000-000000000022', 'fc000000-0000-0000-0000-000000000002', 47);

SELECT results_eq(
  $$SELECT flag_suspicious_uploads('fa000000-0000-0000-0000-000000000003')$$,
  ARRAY[0],
  'flag_suspicious_uploads should return 0 when stddev=0 (all identical totals)'
);

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM community_uploads
    WHERE league_id = 'fa000000-0000-0000-0000-000000000003'
      AND is_suspicious = true$$,
  ARRAY[0],
  'No uploads should be flagged when stddev=0 and no round-number issues'
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════

SELECT * FROM finish();
ROLLBACK;
