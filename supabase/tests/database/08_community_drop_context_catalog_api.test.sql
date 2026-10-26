-- =============================================================================
-- Bulk community drop-context aggregation for static league datasets
-- =============================================================================

BEGIN;

SELECT plan(17);

SELECT has_function(
  'public',
  'get_community_league_drop_context',
  ARRAY['text', 'text', 'integer'],
  'get_community_league_drop_context(text, text, integer) should exist'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.get_community_league_drop_context(text,text,integer)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to aggregate a league catalog'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.get_community_league_drop_context(text,text,integer)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not execute the bulk aggregate RPC directly'
);
SELECT results_eq(
  $$SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_community_league_drop_context(text,text,integer)'::regprocedure$$,
  ARRAY[true],
  'bulk aggregate RPC should be SECURITY DEFINER'
);
SELECT throws_ok(
  $$SELECT get_community_league_drop_context('invalid', 'Allflame', 5)$$,
  '22023', NULL,
  'bulk aggregate RPC should validate its arguments'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context('poe1', 'missing', 5)->>'reason'$$,
  ARRAY['league_not_found'::text],
  'bulk aggregate RPC should distinguish an unknown league'
);

INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES (
  'fc000000-0000-0000-0000-000000000001',
  'poe1',
  'context_catalog_test',
  'Context Catalog Test',
  true
);
INSERT INTO cards (id, game, name)
VALUES
  ('fc000000-0000-0000-0000-000000000101', 'poe1', 'The Scholar'),
  ('fc000000-0000-0000-0000-000000000102', 'poe1', 'Below Threshold');
INSERT INTO community_locations (game, name)
VALUES ('poe1', 'Atlas Hideout'), ('poe1', 'Private Hideout');
INSERT INTO community_uploads (
  id,
  league_id,
  device_id,
  is_verified,
  is_suspicious,
  total_cards_uploaded,
  upload_count
)
SELECT
  ('fc000000-0000-0000-0000-' || LPAD(number::text, 12, '0'))::uuid,
  'fc000000-0000-0000-0000-000000000001'::uuid,
  'catalog-device-' || number,
  false,
  false,
  1,
  1
FROM generate_series(201, 205) AS number;

INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
SELECT
  ('fc000000-0000-0000-0001-' || LPAD(number::text, 12, '0'))::uuid,
  ('fc000000-0000-0000-0000-' || LPAD(number::text, 12, '0'))::uuid,
  'fc000000-0000-0000-0000-000000000101'::uuid,
  (SELECT id FROM community_locations
   WHERE game = 'poe1' AND name = 'Atlas Hideout'),
  600,
  60
FROM generate_series(201, 205) AS number;

-- One contributor's extra row remains in safe card totals, while its time and
-- location groups are suppressed.
INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
VALUES (
  'fc000000-0000-0000-0002-000000000001',
  'fc000000-0000-0000-0000-000000000201',
  'fc000000-0000-0000-0000-000000000101',
  (SELECT id FROM community_locations
   WHERE game = 'poe1' AND name = 'Private Hideout'),
  900,
  60
);

-- A card seen from only four contributors must not appear in the catalog.
INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
SELECT
  ('fc000000-0000-0000-0003-' || LPAD(number::text, 12, '0'))::uuid,
  ('fc000000-0000-0000-0000-' || LPAD(number::text, 12, '0'))::uuid,
  'fc000000-0000-0000-0000-000000000102'::uuid,
  (SELECT id FROM community_locations
   WHERE game = 'poe1' AND name = 'Atlas Hideout'),
  600,
  60
FROM generate_series(201, 204) AS number;

SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'Context Catalog Test', 5
  )->>'found')::boolean$$,
  ARRAY[true],
  'bulk aggregate should resolve a league by display name'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  )->>'available')::boolean$$,
  ARRAY[true],
  'bulk aggregate should report qualifying context as available'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  )->'cards')$$,
  ARRAY[1],
  'cards below the contributor threshold should be omitted'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,name}'$$,
  ARRAY['The Scholar'::text],
  'bulk cards should be ordered and identified by name'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,observed_events}')::bigint$$,
  ARRAY[6::bigint],
  'safe card totals should include all events from eligible cards'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,local_time_buckets,40,count}')::bigint$$,
  ARRAY[5::bigint],
  'bulk local time should use 15-minute buckets'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,local_time_buckets,40,locations,0,count}')::bigint$$,
  ARRAY[5::bigint],
  'a local bucket should include locations shared by five contributors'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,local_time_buckets,60,count}')::bigint$$,
  ARRAY[0::bigint],
  'a local bucket from one contributor should be suppressed'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #> '{cards,0,local_time_buckets,60,locations}')$$,
  ARRAY[0],
  'suppressed local buckets should not expose locations'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #>> '{cards,0,utc_time_buckets,36,count}')::bigint$$,
  ARRAY[5::bigint],
  'bulk UTC time should be derived from local minute and offset'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) #> '{cards,0,locations}')$$,
  ARRAY[1],
  'global locations below the contributor threshold should be suppressed'
);

SELECT * FROM finish();
ROLLBACK;
