-- =============================================================================
-- Schema Tests: Tables, Columns, Constraints, Indexes
-- =============================================================================
-- Run with: supabase test db
-- Requires: supabase start (local Postgres instance running)
-- =============================================================================

BEGIN;

SELECT plan(112);

-- ═══════════════════════════════════════════════════════════════
-- TABLE EXISTENCE
-- ═══════════════════════════════════════════════════════════════

SELECT has_table('public', 'poe_leagues', 'poe_leagues table should exist');
SELECT has_table('public', 'snapshots', 'snapshots table should exist');
SELECT has_table('public', 'card_prices', 'card_prices table should exist');
SELECT has_table('public', 'api_requests', 'api_requests table should exist');
SELECT has_table('public', 'banned_users', 'banned_users table should exist');
SELECT has_table('public', 'local_config', 'local_config table should exist');
SELECT has_table('public', 'cards', 'cards table should exist');
SELECT has_table('public', 'community_uploads', 'community_uploads table should exist');
SELECT has_table('public', 'community_card_data', 'community_card_data table should exist');

-- ═══════════════════════════════════════════════════════════════
-- poe_leagues COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'poe_leagues', 'id', 'poe_leagues should have id column');
SELECT has_column('public', 'poe_leagues', 'game', 'poe_leagues should have game column');
SELECT has_column('public', 'poe_leagues', 'league_id', 'poe_leagues should have league_id column');
SELECT has_column('public', 'poe_leagues', 'name', 'poe_leagues should have name column');
SELECT has_column('public', 'poe_leagues', 'start_at', 'poe_leagues should have start_at column');
SELECT has_column('public', 'poe_leagues', 'end_at', 'poe_leagues should have end_at column');
SELECT has_column('public', 'poe_leagues', 'is_active', 'poe_leagues should have is_active column');
SELECT has_column('public', 'poe_leagues', 'created_at', 'poe_leagues should have created_at column');
SELECT has_column('public', 'poe_leagues', 'updated_at', 'poe_leagues should have updated_at column');

SELECT col_is_pk('public', 'poe_leagues', 'id', 'poe_leagues.id should be primary key');
SELECT col_not_null('public', 'poe_leagues', 'game', 'poe_leagues.game should be NOT NULL');
SELECT col_not_null('public', 'poe_leagues', 'league_id', 'poe_leagues.league_id should be NOT NULL');
SELECT col_not_null('public', 'poe_leagues', 'name', 'poe_leagues.name should be NOT NULL');

-- ═══════════════════════════════════════════════════════════════
-- snapshots COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'snapshots', 'id', 'snapshots should have id column');
SELECT has_column('public', 'snapshots', 'league_id', 'snapshots should have league_id column');
SELECT has_column('public', 'snapshots', 'fetched_at', 'snapshots should have fetched_at column');
SELECT has_column('public', 'snapshots', 'exchange_chaos_to_divine', 'snapshots should have exchange_chaos_to_divine column');
SELECT has_column('public', 'snapshots', 'stash_chaos_to_divine', 'snapshots should have stash_chaos_to_divine column');
SELECT has_column('public', 'snapshots', 'stacked_deck_chaos_cost', 'snapshots should have stacked_deck_chaos_cost column');

SELECT col_is_pk('public', 'snapshots', 'id', 'snapshots.id should be primary key');
SELECT col_not_null('public', 'snapshots', 'league_id', 'snapshots.league_id should be NOT NULL');
SELECT col_not_null('public', 'snapshots', 'exchange_chaos_to_divine', 'snapshots.exchange_chaos_to_divine should be NOT NULL');
SELECT col_not_null('public', 'snapshots', 'stash_chaos_to_divine', 'snapshots.stash_chaos_to_divine should be NOT NULL');

SELECT col_is_fk('public', 'snapshots', 'league_id', 'snapshots.league_id should be a foreign key');

-- ═══════════════════════════════════════════════════════════════
-- card_prices COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'card_prices', 'id', 'card_prices should have id column');
SELECT has_column('public', 'card_prices', 'snapshot_id', 'card_prices should have snapshot_id column');
SELECT has_column('public', 'card_prices', 'card_id', 'card_prices should have card_id column');
SELECT has_column('public', 'card_prices', 'price_source', 'card_prices should have price_source column');
SELECT has_column('public', 'card_prices', 'chaos_value', 'card_prices should have chaos_value column');
SELECT has_column('public', 'card_prices', 'divine_value', 'card_prices should have divine_value column');
SELECT has_column('public', 'card_prices', 'confidence', 'card_prices should have confidence column');

SELECT col_is_pk('public', 'card_prices', 'id', 'card_prices.id should be primary key');
SELECT col_not_null('public', 'card_prices', 'snapshot_id', 'card_prices.snapshot_id should be NOT NULL');
SELECT col_not_null('public', 'card_prices', 'card_id', 'card_prices.card_id should be NOT NULL');
SELECT col_not_null('public', 'card_prices', 'price_source', 'card_prices.price_source should be NOT NULL');

SELECT col_is_fk('public', 'card_prices', 'snapshot_id', 'card_prices.snapshot_id should be a foreign key');
SELECT col_is_fk('public', 'card_prices', 'card_id', 'card_prices.card_id should be a foreign key');

-- ═══════════════════════════════════════════════════════════════
-- api_requests COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'api_requests', 'id', 'api_requests should have id column');
SELECT has_column('public', 'api_requests', 'user_id', 'api_requests should have user_id column');
SELECT has_column('public', 'api_requests', 'endpoint', 'api_requests should have endpoint column');
SELECT has_column('public', 'api_requests', 'app_version', 'api_requests should have app_version column');
SELECT has_column('public', 'api_requests', 'created_at', 'api_requests should have created_at column');

SELECT col_not_null('public', 'api_requests', 'endpoint', 'api_requests.endpoint should be NOT NULL');
SELECT has_column('public', 'api_requests', 'identifier', 'api_requests should have identifier column');
SELECT has_index('public', 'api_requests', 'api_requests_identifier_time_idx', 'api_requests should have identifier+time partial index');

-- ═══════════════════════════════════════════════════════════════
-- banned_users COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'banned_users', 'id', 'banned_users should have id column');
SELECT has_column('public', 'banned_users', 'user_id', 'banned_users should have user_id column');
SELECT has_column('public', 'banned_users', 'reason', 'banned_users should have reason column');
SELECT has_column('public', 'banned_users', 'banned_at', 'banned_users should have banned_at column');
SELECT has_column('public', 'banned_users', 'banned_by', 'banned_users should have banned_by column');
SELECT has_column('public', 'banned_users', 'expires_at', 'banned_users should have expires_at column');
SELECT has_column('public', 'banned_users', 'identifier', 'banned_users should have identifier column');
SELECT has_index('public', 'banned_users', 'banned_users_identifier_unique', 'banned_users should have identifier unique partial index');
SELECT has_index('public', 'banned_users', 'idx_banned_users_identifier', 'banned_users should have identifier lookup index');

-- ═══════════════════════════════════════════════════════════════
-- cards COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'cards', 'id', 'cards should have id column');
SELECT has_column('public', 'cards', 'game', 'cards should have game column');
SELECT has_column('public', 'cards', 'name', 'cards should have name column');

SELECT col_is_pk('public', 'cards', 'id', 'cards.id should be primary key');
SELECT col_not_null('public', 'cards', 'game', 'cards.game should be NOT NULL');
SELECT col_not_null('public', 'cards', 'name', 'cards.name should be NOT NULL');

-- ═══════════════════════════════════════════════════════════════
-- community_uploads COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'community_uploads', 'id', 'community_uploads should have id column');
SELECT has_column('public', 'community_uploads', 'league_id', 'community_uploads should have league_id column');
SELECT has_column('public', 'community_uploads', 'device_id', 'community_uploads should have device_id column');
SELECT has_column('public', 'community_uploads', 'is_verified', 'community_uploads should have is_verified column');
SELECT has_column('public', 'community_uploads', 'total_cards_uploaded', 'community_uploads should have total_cards_uploaded column');
SELECT has_column('public', 'community_uploads', 'is_suspicious', 'community_uploads should have is_suspicious column');
SELECT has_column('public', 'community_uploads', 'upload_count', 'community_uploads should have upload_count column');

SELECT col_is_pk('public', 'community_uploads', 'id', 'community_uploads.id should be primary key');
SELECT col_not_null('public', 'community_uploads', 'league_id', 'community_uploads.league_id should be NOT NULL');
SELECT col_not_null('public', 'community_uploads', 'device_id', 'community_uploads.device_id should be NOT NULL');
SELECT col_is_fk('public', 'community_uploads', 'league_id', 'community_uploads.league_id should be a foreign key');

-- ═══════════════════════════════════════════════════════════════
-- community_card_data COLUMNS
-- ═══════════════════════════════════════════════════════════════

SELECT has_column('public', 'community_card_data', 'id', 'community_card_data should have id column');
SELECT has_column('public', 'community_card_data', 'upload_id', 'community_card_data should have upload_id column');
SELECT has_column('public', 'community_card_data', 'card_id', 'community_card_data should have card_id column');
SELECT has_column('public', 'community_card_data', 'count', 'community_card_data should have count column');

SELECT col_is_pk('public', 'community_card_data', 'id', 'community_card_data.id should be primary key');
SELECT col_not_null('public', 'community_card_data', 'upload_id', 'community_card_data.upload_id should be NOT NULL');
SELECT col_not_null('public', 'community_card_data', 'card_id', 'community_card_data.card_id should be NOT NULL');
SELECT col_not_null('public', 'community_card_data', 'count', 'community_card_data.count should be NOT NULL');
SELECT col_is_fk('public', 'community_card_data', 'upload_id', 'community_card_data.upload_id should be a foreign key');
SELECT col_is_fk('public', 'community_card_data', 'card_id', 'community_card_data.card_id should be a foreign key');

-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

SELECT has_index('public', 'poe_leagues', 'idx_poe_leagues_game_active', 'poe_leagues should have game+active index');
SELECT has_index('public', 'poe_leagues', 'idx_poe_leagues_updated', 'poe_leagues should have updated_at index');
SELECT has_index('public', 'snapshots', 'idx_snapshots_league_fetched', 'snapshots should have league+fetched index');
SELECT has_index('public', 'snapshots', 'idx_snapshots_created', 'snapshots should have created_at index');
SELECT has_index('public', 'card_prices', 'idx_card_prices_snapshot', 'card_prices should have snapshot_id index');
SELECT has_index('public', 'card_prices', 'idx_card_prices_snapshot_source', 'card_prices should have snapshot+source index');
SELECT has_index('public', 'card_prices', 'idx_card_prices_card_id', 'card_prices should have card_id index');
SELECT has_index('public', 'cards', 'idx_cards_game', 'cards should have game index');
SELECT has_index('public', 'community_uploads', 'idx_community_uploads_league', 'community_uploads should have league index');
SELECT has_index('public', 'community_uploads', 'idx_community_uploads_device', 'community_uploads should have device index');
SELECT has_index('public', 'community_card_data', 'idx_community_card_data_upload', 'community_card_data should have upload index');
SELECT has_index('public', 'community_card_data', 'idx_community_card_data_card', 'community_card_data should have card index');

-- ═══════════════════════════════════════════════════════════════
-- CHECK & UNIQUE CONSTRAINTS: cards table
-- ═══════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$INSERT INTO cards (game, name) VALUES ('poe1', 'schema_test_card_1')$$,
  'cards should accept game = poe1'
);

SELECT lives_ok(
  $$INSERT INTO cards (game, name) VALUES ('poe2', 'schema_test_card_1')$$,
  'cards should accept game = poe2 (same name, different game)'
);

SELECT throws_ok(
  $$INSERT INTO cards (game, name) VALUES ('poe3', 'schema_test_card_bad')$$,
  '23514',
  NULL,
  'cards should reject game = poe3 (CHECK constraint)'
);

SELECT throws_ok(
  $$INSERT INTO cards (game, name) VALUES ('poe1', 'schema_test_card_1')$$,
  '23505',
  NULL,
  'cards should reject duplicate (game, name) (UNIQUE constraint)'
);

DELETE FROM cards WHERE name LIKE 'schema_test_card%';

-- ═══════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS: api_requests identity (exactly one of user_id, identifier)
-- ═══════════════════════════════════════════════════════════════

-- Temporary user for api_requests CHECK tests
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data, is_anonymous)
VALUES (
  'ff000000-ff00-ff00-ff00-ff0000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', NULL, '', NULL, NOW(), NOW(), '',
  '{"provider":"anonymous","providers":["anonymous"]}', '{}', true
);

-- Both identities: should fail CHECK
SELECT throws_ok(
  $$INSERT INTO api_requests (user_id, identifier, endpoint)
    VALUES ('ff000000-ff00-ff00-ff00-ff0000000000', 'some-key', 'test')$$,
  '23514',
  NULL,
  'api_requests should reject rows with both user_id and identifier (CHECK constraint)'
);

-- Neither identity: should fail CHECK
SELECT throws_ok(
  $$INSERT INTO api_requests (user_id, identifier, endpoint)
    VALUES (NULL, NULL, 'test')$$,
  '23514',
  NULL,
  'api_requests should reject rows with neither user_id nor identifier (CHECK constraint)'
);

-- ═══════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS: game column only allows 'poe1' or 'poe2'
-- ═══════════════════════════════════════════════════════════════

SELECT lives_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe1', 'check_test_1', 'Check Test 1')$$,
  'poe_leagues should accept game = poe1'
);

SELECT lives_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe2', 'check_test_2', 'Check Test 2')$$,
  'poe_leagues should accept game = poe2'
);

SELECT throws_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe3', 'check_test_3', 'Check Test 3')$$,
  '23514', -- check_violation
  NULL,
  'poe_leagues should reject game = poe3 (CHECK constraint)'
);

-- ═══════════════════════════════════════════════════════════════
-- UNIQUE CONSTRAINT: (game, league_id)
-- ═══════════════════════════════════════════════════════════════

SELECT throws_ok(
  $$INSERT INTO poe_leagues (game, league_id, name) VALUES ('poe1', 'check_test_1', 'Duplicate')$$,
  '23505', -- unique_violation
  NULL,
  'poe_leagues should reject duplicate (game, league_id)'
);

-- ═══════════════════════════════════════════════════════════════
-- CLEANUP test rows inserted by constraint tests
-- ═══════════════════════════════════════════════════════════════

DELETE FROM poe_leagues WHERE league_id IN ('check_test_1', 'check_test_2');

SELECT * FROM finish();
ROLLBACK;
