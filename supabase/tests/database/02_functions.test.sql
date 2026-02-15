-- =============================================================================
-- Database Function Tests: check_and_log_request, ban/unban, rate limiting,
-- log_api_request, get_user_request_count, get_latest_snapshot_for_league,
-- update_league_timestamp trigger
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
-- =============================================================================

BEGIN;

SELECT plan(46);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY FUNCTIONS EXIST
-- ═══════════════════════════════════════════════════════════════

SELECT has_function(
  'public', 'check_and_log_request',
  ARRAY['uuid', 'text', 'integer', 'integer', 'text'],
  'check_and_log_request(uuid, text, int, int, text) should exist'
);

SELECT has_function(
  'public', 'ban_user',
  ARRAY['uuid', 'text', 'integer'],
  'ban_user(uuid, text, integer) should exist'
);

SELECT has_function(
  'public', 'unban_user',
  ARRAY['uuid'],
  'unban_user(uuid) should exist'
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
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Test Exchange', 'exchange', 10.00, 0.0667)$$,
  'card_prices should accept price_source = exchange'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Test Stash', 'stash', 10.00, 0.0667)$$,
  'card_prices should accept price_source = stash'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Test Bad', 'invalid_source', 10.00, 0.0667)$$,
  '23514', -- check_violation
  NULL,
  'card_prices should reject invalid price_source (CHECK constraint)'
);

-- ═══════════════════════════════════════════════════════════════
-- TEST: card_prices confidence CHECK constraint and DEFAULT
-- ═══════════════════════════════════════════════════════════════

-- Default value: inserting without confidence should default to 1
SELECT results_eq(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence Default', 'exchange', 5.00, 0.03)
    RETURNING confidence::int$$,
  ARRAY[1],
  'card_prices.confidence should default to 1 when not specified'
);

-- Accepts valid confidence values: 1, 2, 3
SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence 1', 'stash', 5.00, 0.03, 1)$$,
  'card_prices should accept confidence = 1'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence 2', 'stash', 5.00, 0.03, 2)$$,
  'card_prices should accept confidence = 2'
);

SELECT lives_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence 3', 'stash', 5.00, 0.03, 3)$$,
  'card_prices should accept confidence = 3'
);

-- Rejects invalid confidence values
SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence 0', 'stash', 5.00, 0.03, 0)$$,
  '23514', -- check_violation
  NULL,
  'card_prices should reject confidence = 0 (CHECK constraint)'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence)
    VALUES ('ffff6666-ffff-ffff-ffff-ffffffffffff', 'Confidence 4', 'stash', 5.00, 0.03, 4)$$,
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
-- DONE
-- ═══════════════════════════════════════════════════════════════

SELECT * FROM finish();
ROLLBACK;
