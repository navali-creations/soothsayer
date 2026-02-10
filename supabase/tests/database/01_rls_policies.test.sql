-- =============================================================================
-- RLS Policy Tests: Verify access control per role (anon, authenticated, service_role)
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
--
-- These tests verify that Row Level Security policies correctly restrict
-- access to each table based on the requesting role.
-- =============================================================================

BEGIN;

SELECT plan(37);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY RLS IS ENABLED ON ALL TABLES
-- ═══════════════════════════════════════════════════════════════

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'poe_leagues' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on poe_leagues'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'snapshots' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on snapshots'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'card_prices' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on card_prices'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'api_requests' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on api_requests'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'banned_users' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on banned_users'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'local_config' AND relnamespace = 'public'::regnamespace),
  'RLS should be enabled on local_config'
);

-- ═══════════════════════════════════════════════════════════════
-- VERIFY RLS POLICIES EXIST
-- ═══════════════════════════════════════════════════════════════

SELECT policies_are(
  'public', 'poe_leagues',
  ARRAY[
    'Public read access for poe_leagues',
    'service_role_can_write_leagues'
  ],
  'poe_leagues should have the expected RLS policies'
);

SELECT policies_are(
  'public', 'snapshots',
  ARRAY[
    'Public read access for snapshots',
    'Service role write access for snapshots'
  ],
  'snapshots should have the expected RLS policies'
);

SELECT policies_are(
  'public', 'card_prices',
  ARRAY[
    'Public read access for card_prices',
    'Service role write access for card_prices'
  ],
  'card_prices should have the expected RLS policies'
);

SELECT policies_are(
  'public', 'api_requests',
  ARRAY[
    'own rows only',
    'service_role_full_access'
  ],
  'api_requests should have the expected RLS policies'
);

SELECT policies_are(
  'public', 'banned_users',
  ARRAY[
    'service_role_full_access_bans'
  ],
  'banned_users should have the expected RLS policies'
);

SELECT policies_are(
  'public', 'local_config',
  ARRAY[
    'service_role_only'
  ],
  'local_config should have the expected RLS policies'
);

-- ═══════════════════════════════════════════════════════════════
-- SEED TEST DATA (as service_role — bypasses RLS)
-- We insert test data that the role-based queries below will
-- attempt to read/write against.
-- ═══════════════════════════════════════════════════════════════

-- Create a test user in auth.users for FK constraints
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  NULL,
  '',
  NULL,
  NOW(),
  NOW(),
  '',
  '{"provider":"anonymous","providers":["anonymous"]}',
  '{}',
  true
);

-- A second test user to verify api_requests isolation
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  NULL,
  '',
  NULL,
  NOW(),
  NOW(),
  '',
  '{"provider":"anonymous","providers":["anonymous"]}',
  '{}',
  true
);

-- Insert test league
INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES ('11111111-1111-1111-1111-111111111111', 'poe1', 'rls_test_league', 'RLS Test League', true);

-- Insert test snapshot
INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost)
VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', NOW(), 150.00, 148.00, 1.5);

-- Insert test card price
INSERT INTO card_prices (id, snapshot_id, card_name, price_source, chaos_value, divine_value)
VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'The Doctor', 'exchange', 900.00, 6.0000);

-- Insert api_requests for user 1
INSERT INTO api_requests (user_id, endpoint, created_at)
VALUES ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'get-latest-snapshot', NOW());

-- Insert api_requests for user 2
INSERT INTO api_requests (user_id, endpoint, created_at)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'get-latest-snapshot', NOW());

-- Insert banned_users entry
INSERT INTO banned_users (user_id, reason)
VALUES ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Test ban');

-- Insert local_config entry
INSERT INTO local_config (key, value)
VALUES ('rls_test_key', 'rls_test_value');

-- ═══════════════════════════════════════════════════════════════
-- ANON ROLE: READ ACCESS TESTS
-- ═══════════════════════════════════════════════════════════════

SET ROLE anon;

SELECT isnt_empty(
  $$SELECT * FROM poe_leagues WHERE league_id = 'rls_test_league'$$,
  'anon should be able to read poe_leagues'
);

SELECT isnt_empty(
  $$SELECT * FROM snapshots WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  'anon should be able to read snapshots'
);

SELECT isnt_empty(
  $$SELECT * FROM card_prices WHERE id = '33333333-3333-3333-3333-333333333333'$$,
  'anon should be able to read card_prices'
);

-- ═══════════════════════════════════════════════════════════════
-- ANON ROLE: WRITE ACCESS DENIED
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe1', 'anon_hack', 'Anon Hack')$$,
  '42501', -- insufficient_privilege
  NULL,
  'anon should NOT be able to insert into poe_leagues'
);

-- DELETE with RLS doesn't throw — it silently returns 0 rows when no policy matches
SELECT is_empty(
  $$DELETE FROM poe_leagues WHERE league_id = 'rls_test_league' RETURNING *$$,
  'anon DELETE from poe_leagues should affect 0 rows (silently filtered by RLS)'
);

SELECT throws_ok(
  $$INSERT INTO snapshots (league_id, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost) VALUES ('11111111-1111-1111-1111-111111111111', 100, 100, 1)$$,
  '42501',
  NULL,
  'anon should NOT be able to insert into snapshots'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value) VALUES ('22222222-2222-2222-2222-222222222222', 'Hack Card', 'exchange', 1, 1)$$,
  '42501',
  NULL,
  'anon should NOT be able to insert into card_prices'
);

-- ═══════════════════════════════════════════════════════════════
-- ANON ROLE: RESTRICTED TABLES SHOULD RETURN EMPTY
-- ═══════════════════════════════════════════════════════════════

SELECT is_empty(
  $$SELECT * FROM api_requests$$,
  'anon should see no rows in api_requests'
);

SELECT is_empty(
  $$SELECT * FROM banned_users$$,
  'anon should see no rows in banned_users'
);

-- local_config has table-level privileges revoked for anon (REVOKE ALL),
-- so SELECT throws permission denied rather than returning empty
SELECT throws_ok(
  $$SELECT * FROM local_config$$,
  '42501',
  NULL,
  'anon should NOT be able to query local_config (permission denied)'
);

-- ═══════════════════════════════════════════════════════════════
-- AUTHENTICATED ROLE (User 1): READ + OWN-ROW ISOLATION
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;

-- Simulate authenticated user 1
SET ROLE authenticated;
-- Set the JWT claim so auth.uid() returns user 1's ID
SET request.jwt.claims = '{"sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "role": "authenticated"}';

SELECT isnt_empty(
  $$SELECT * FROM poe_leagues WHERE league_id = 'rls_test_league'$$,
  'authenticated user should be able to read poe_leagues'
);

SELECT isnt_empty(
  $$SELECT * FROM snapshots WHERE id = '22222222-2222-2222-2222-222222222222'$$,
  'authenticated user should be able to read snapshots'
);

SELECT isnt_empty(
  $$SELECT * FROM card_prices WHERE id = '33333333-3333-3333-3333-333333333333'$$,
  'authenticated user should be able to read card_prices'
);

-- User 1 should see only their own api_requests
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests$$,
  ARRAY[1],
  'authenticated user 1 should see only their own api_requests (1 row)'
);

SELECT results_eq(
  $$SELECT user_id::text FROM api_requests$$,
  ARRAY['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  'authenticated user 1 should only see rows with their own user_id'
);

-- ═══════════════════════════════════════════════════════════════
-- AUTHENTICATED ROLE (User 1): RESTRICTED TABLES
-- ═══════════════════════════════════════════════════════════════

SELECT is_empty(
  $$SELECT * FROM banned_users$$,
  'authenticated user should see no rows in banned_users'
);

-- local_config has table-level privileges revoked for authenticated (REVOKE ALL),
-- so SELECT throws permission denied rather than returning empty
SELECT throws_ok(
  $$SELECT * FROM local_config$$,
  '42501',
  NULL,
  'authenticated user should NOT be able to query local_config (permission denied)'
);

-- ═══════════════════════════════════════════════════════════════
-- AUTHENTICATED ROLE (User 2): OWN-ROW ISOLATION VERIFICATION
-- ═══════════════════════════════════════════════════════════════

-- Switch to user 2 context
SET request.jwt.claims = '{"sub": "b2c3d4e5-f6a7-8901-bcde-f12345678901", "role": "authenticated"}';

SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests$$,
  ARRAY[1],
  'authenticated user 2 should see only their own api_requests (1 row)'
);

SELECT results_eq(
  $$SELECT user_id::text FROM api_requests$$,
  ARRAY['b2c3d4e5-f6a7-8901-bcde-f12345678901'],
  'authenticated user 2 should only see rows with their own user_id'
);

-- ═══════════════════════════════════════════════════════════════
-- AUTHENTICATED ROLE: WRITE ACCESS DENIED ON PROTECTED TABLES
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe1', 'auth_hack', 'Auth Hack')$$,
  '42501',
  NULL,
  'authenticated user should NOT be able to insert into poe_leagues'
);

SELECT throws_ok(
  $$INSERT INTO snapshots (league_id, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost) VALUES ('11111111-1111-1111-1111-111111111111', 100, 100, 1)$$,
  '42501',
  NULL,
  'authenticated user should NOT be able to insert into snapshots'
);

SELECT throws_ok(
  $$INSERT INTO card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value) VALUES ('22222222-2222-2222-2222-222222222222', 'Hack', 'exchange', 1, 1)$$,
  '42501',
  NULL,
  'authenticated user should NOT be able to insert into card_prices'
);

-- ═══════════════════════════════════════════════════════════════
-- SERVICE_ROLE: FULL ACCESS VERIFICATION
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;
SET ROLE service_role;

SELECT isnt_empty(
  $$SELECT * FROM banned_users$$,
  'service_role should be able to read banned_users'
);

SELECT isnt_empty(
  $$SELECT * FROM local_config WHERE key = 'rls_test_key'$$,
  'service_role should be able to read local_config'
);

-- service_role should see ALL api_requests (not filtered by user)
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM api_requests$$,
  ARRAY[2],
  'service_role should see all api_requests rows (2 total)'
);

-- ═══════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
