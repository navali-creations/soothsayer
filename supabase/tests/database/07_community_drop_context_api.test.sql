-- =============================================================================
-- Community drop context public aggregation
-- =============================================================================

BEGIN;

SELECT plan(20);

SELECT has_function(
  'public',
  'get_community_drop_context',
  ARRAY['text', 'text', 'text'],
  'get_community_drop_context(text, text, text) should exist'
);
SELECT has_function(
  'public',
  'get_community_drop_context',
  ARRAY['text', 'text', 'text', 'integer'],
  'the previous threshold signature should remain as a compatibility wrapper'
);
SELECT results_eq(
  $$SELECT pronargdefaults::integer
    FROM pg_proc
    WHERE oid = 'public.get_community_drop_context(text,text,text,integer)'::regprocedure$$,
  ARRAY[0],
  'the compatibility wrapper should not compete with threshold-free calls'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
      'service_role',
      'public.get_community_drop_context(text,text,text,integer)'::regprocedure,
      'EXECUTE'
    )
    UNION ALL
    SELECT NOT has_function_privilege(
      'anon',
      'public.get_community_drop_context(text,text,text,integer)'::regprocedure,
      'EXECUTE'
    )$$,
  ARRAY[true, true],
  'the compatibility wrapper should remain service-role-only'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.get_community_drop_context(text,text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to aggregate drop context'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.get_community_drop_context(text,text,text)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not execute the aggregate RPC directly'
);
SELECT results_eq(
  $$SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_community_drop_context(text,text,text)'::regprocedure$$,
  ARRAY[true],
  'aggregate RPC should be SECURITY DEFINER'
);
SELECT throws_ok(
  $$SELECT get_community_drop_context('invalid', 'Allflame', 'The Scholar')$$,
  '22023', NULL,
  'aggregate RPC should validate its arguments'
);
SELECT results_eq(
  $$SELECT get_community_drop_context('poe1', 'missing', 'The Scholar')->>'reason'$$,
  ARRAY['league_not_found'::text],
  'aggregate RPC should distinguish an unknown league'
);

INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES (
  'fd000000-0000-0000-0000-000000000001',
  'poe1',
  'context_api_test',
  'Context API Test',
  true
);
INSERT INTO cards (id, game, name)
VALUES ('fd000000-0000-0000-0000-000000000101', 'poe1', 'The Scholar');
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
  ('fd000000-0000-0000-0000-' || LPAD(number::text, 12, '0'))::uuid,
  'fd000000-0000-0000-0000-000000000001'::uuid,
  'context-device-' || number,
  false,
  false,
  1,
  1
FROM generate_series(201, 205) AS number;

SELECT results_eq(
  $$SELECT get_community_drop_context(
    'poe1', 'context_api_test', 'Missing Card'
  )->>'reason'$$,
  ARRAY['card_not_found'::text],
  'aggregate RPC should distinguish an unknown card'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  )->>'available')::boolean$$,
  ARRAY[false],
  'aggregate output should remain unavailable without matching events'
);

INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
SELECT
  ('fd000000-0000-0000-0001-' || LPAD(number::text, 12, '0'))::uuid,
  ('fd000000-0000-0000-0000-' || LPAD(number::text, 12, '0'))::uuid,
  'fd000000-0000-0000-0000-000000000101'::uuid,
  (SELECT id FROM community_locations
   WHERE game = 'poe1' AND name = 'Atlas Hideout'),
  600,
  60
FROM generate_series(201, 205) AS number;

-- One contributor's extra row must be included in every aggregate breakdown.
INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
VALUES (
  'fd000000-0000-0000-0002-000000000001',
  'fd000000-0000-0000-0000-000000000201',
  'fd000000-0000-0000-0000-000000000101',
  (SELECT id FROM community_locations
   WHERE game = 'poe1' AND name = 'Private Hideout'),
  900,
  60
);

SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'Context API Test', 'The Scholar'
  )->>'available')::boolean$$,
  ARRAY[true],
  'aggregate output should become available with matching context'
);
SELECT results_eq(
  $$SELECT NOT (get_community_drop_context(
    'poe1', 'Context API Test', 'The Scholar'
  ) ? 'min_contributors')$$,
  ARRAY[true],
  'aggregate output should not advertise a contributor threshold'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  )->>'observed_events')::bigint$$,
  ARRAY[6::bigint],
  'overall totals should include all events'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  ) #>> '{local_time_buckets,40,count}')::bigint$$,
  ARRAY[5::bigint],
  'local time should use 15-minute buckets'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  ) #>> '{utc_time_buckets,36,count}')::bigint$$,
  ARRAY[5::bigint],
  'UTC time should be derived from local minute and offset'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  ) #>> '{local_time_buckets,60,count}')::bigint$$,
  ARRAY[1::bigint],
  'a time bucket from one contributor should be published'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  ) #>> '{locations,0,count}')::bigint$$,
  ARRAY[5::bigint],
  'locations should remain ordered by event count'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(
    get_community_drop_context(
      'poe1', 'context_api_test', 'The Scholar'
    )->'locations'
  )$$,
  ARRAY[2],
  'a location from one contributor should be published'
);
SELECT results_eq(
  $$SELECT get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  ) = get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar'
  )$$,
  ARRAY[true],
  'the previous signature should return threshold-free aggregates'
);

SELECT * FROM finish();
ROLLBACK;
