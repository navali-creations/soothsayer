-- =============================================================================
-- Bulk community drop-context aggregation for static league datasets
-- =============================================================================

BEGIN;

SELECT plan(41);

SELECT has_index(
  'public', 'community_drop_events',
  'idx_community_drop_events_upload_context',
  'league context scans should have a covering upload-first event index'
);
SELECT has_index(
  'public', 'community_uploads',
  'idx_community_uploads_league_context',
  'league context scans should have a covering league/upload index'
);

SELECT has_function(
  'public',
  'get_community_league_drop_context',
  ARRAY['text', 'text'],
  'get_community_league_drop_context(text, text) should exist'
);
SELECT has_function(
  'public',
  'get_community_league_drop_context_static',
  ARRAY['text', 'text'],
  'get_community_league_drop_context_static(text, text) should exist'
);
SELECT has_function(
  'public',
  'get_community_league_drop_context',
  ARRAY['text', 'text', 'integer'],
  'the previous threshold signature should remain as a compatibility wrapper'
);
SELECT results_eq(
  $$SELECT pronargdefaults::integer
    FROM pg_proc
    WHERE oid = 'public.get_community_league_drop_context(text,text,integer)'::regprocedure$$,
  ARRAY[0],
  'the compatibility wrapper should not compete with threshold-free calls'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
      'service_role',
      'public.get_community_league_drop_context(text,text,integer)'::regprocedure,
      'EXECUTE'
    )
    UNION ALL
    SELECT NOT has_function_privilege(
      'anon',
      'public.get_community_league_drop_context(text,text,integer)'::regprocedure,
      'EXECUTE'
    )$$,
  ARRAY[true, true],
  'the compatibility wrapper should remain service-role-only'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.get_community_league_drop_context(text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to aggregate a league catalog'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.get_community_league_drop_context(text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not execute the bulk aggregate RPC directly'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.get_community_league_drop_context_static(text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to build the static context projection'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.get_community_league_drop_context_static(text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not execute the static context projection directly'
);
SELECT results_eq(
  $$SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_community_league_drop_context(text,text)'::regprocedure$$,
  ARRAY[true],
  'bulk aggregate RPC should be SECURITY DEFINER'
);
SELECT throws_ok(
  $$SELECT get_community_league_drop_context('invalid', 'Allflame')$$,
  '22023', NULL,
  'bulk aggregate RPC should validate its arguments'
);
SELECT throws_ok(
  $$SELECT get_community_league_drop_context_static('invalid', 'Allflame')$$,
  '22023', NULL,
  'static context projection should validate its arguments'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context('poe1', 'missing')->>'reason'$$,
  ARRAY['league_not_found'::text],
  'bulk aggregate RPC should distinguish an unknown league'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context_static(
    'poe1', 'missing'
  )->>'reason'$$,
  ARRAY['league_not_found'::text],
  'static context projection should distinguish an unknown league'
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
FROM generate_series(201, 206) AS number;

UPDATE community_uploads
SET is_suspicious = true
WHERE id = 'fc000000-0000-0000-0000-000000000206';

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
FROM generate_series(201, 206) AS number;

-- One contributor's extra row must remain visible in every breakdown.
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

-- A card seen from fewer than five contributors must still appear.
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
    'poe1', 'Context Catalog Test'
  )->>'found')::boolean$$,
  ARRAY[true],
  'bulk aggregate should resolve a league by display name'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  )->>'available')::boolean$$,
  ARRAY[true],
  'bulk aggregate should report context as available'
);
SELECT results_eq(
  $$SELECT NOT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) ? 'min_contributors')$$,
  ARRAY[true],
  'bulk output should not advertise a contributor threshold'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  )->'cards')$$,
  ARRAY[2],
  'all cards with context should be included'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,0,name}'$$,
  ARRAY['Below Threshold'::text],
  'bulk cards should be ordered and identified by name'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,observed_events}')::bigint$$,
  ARRAY[7::bigint],
  'card totals should include all events, including suspicious uploads'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,local_time_buckets,40,count}')::bigint$$,
  ARRAY[6::bigint],
  'bulk local time should include suspicious uploads in 15-minute buckets'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,local_time_buckets,40,locations,0,count}')::bigint$$,
  ARRAY[6::bigint],
  'a local bucket should include locations from every upload'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,local_time_buckets,60,count}')::bigint$$,
  ARRAY[1::bigint],
  'a local bucket from one contributor should be published'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #> '{cards,1,local_time_buckets,60,locations}')$$,
  ARRAY[1],
  'a single-contributor local bucket should include its location'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,utc_time_buckets,36,count}')::bigint$$,
  ARRAY[6::bigint],
  'bulk UTC time should be derived from every event'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  ) #> '{cards,1,locations}')$$,
  ARRAY[2],
  'all global locations should be published'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context(
    'poe1', 'context_catalog_test', 5
  ) = get_community_league_drop_context(
    'poe1', 'context_catalog_test'
  )$$,
  ARRAY[true],
  'the previous signature should return threshold-free aggregates'
);

SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'Context Catalog Test'
  )->>'found')::boolean$$,
  ARRAY[true],
  'static context projection should resolve a league by display name'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  )->'cards')$$,
  ARRAY[2],
  'static context projection should include every observed card'
);
SELECT results_eq(
  $$SELECT get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,name}'$$,
  ARRAY['The Scholar'::text],
  'static context projection should order cards by name'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,local_time_buckets,40,count}')::bigint$$,
  ARRAY[6::bigint],
  'static context projection should include suspicious uploads'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,utc_time_buckets,36,count}')::bigint$$,
  ARRAY[6::bigint],
  'static context projection should normalize every event to UTC'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #> '{cards,1,locations}')$$,
  ARRAY[2],
  'static context projection should publish global locations'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{totals,observed_events}')::bigint$$,
  ARRAY[11::bigint],
  'static context should publish the exact context-observation denominator'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{totals,located_events}')::bigint$$,
  ARRAY[11::bigint],
  'static context should publish the exact located-event denominator'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{cards,1,located_events}')::bigint$$,
  ARRAY[7::bigint],
  'static context should publish each card location denominator before truncation'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{totals,local_time_buckets,40,count}')::bigint$$,
  ARRAY[10::bigint],
  'static context should publish player-time bucket denominators'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{totals,utc_time_buckets,36,count}')::bigint$$,
  ARRAY[10::bigint],
  'static context should publish UTC bucket denominators'
);
SELECT results_eq(
  $$SELECT (get_community_league_drop_context_static(
    'poe1', 'context_catalog_test'
  ) #>> '{totals,locations,0,count}')::bigint$$,
  ARRAY[10::bigint],
  'static context should publish exact location denominators before card truncation'
);

SELECT * FROM finish();
ROLLBACK;
