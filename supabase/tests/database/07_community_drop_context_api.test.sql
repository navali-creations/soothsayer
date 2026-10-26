-- =============================================================================
-- Community drop context public aggregation and privacy thresholds
-- =============================================================================

BEGIN;

SELECT plan(15);

SELECT has_function(
  'public',
  'get_community_drop_context',
  ARRAY['text', 'text', 'text', 'integer'],
  'get_community_drop_context(text, text, text, integer) should exist'
);
SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.get_community_drop_context(text,text,text,integer)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to aggregate drop context'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.get_community_drop_context(text,text,text,integer)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not execute the aggregate RPC directly'
);
SELECT results_eq(
  $$SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.get_community_drop_context(text,text,text,integer)'::regprocedure$$,
  ARRAY[true],
  'aggregate RPC should be SECURITY DEFINER'
);
SELECT throws_ok(
  $$SELECT get_community_drop_context('invalid', 'Allflame', 'The Scholar', 5)$$,
  '22023', NULL,
  'aggregate RPC should validate its arguments'
);
SELECT results_eq(
  $$SELECT get_community_drop_context('poe1', 'missing', 'The Scholar', 5)->>'reason'$$,
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
    'poe1', 'context_api_test', 'Missing Card', 5
  )->>'reason'$$,
  ARRAY['card_not_found'::text],
  'aggregate RPC should distinguish an unknown card'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  )->>'available')::boolean$$,
  ARRAY[false],
  'aggregate output should remain unavailable below the privacy threshold'
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

-- One contributor's extra row is counted in the safe overall/timezone totals,
-- but its unique location and time bucket must not be published.
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
    'poe1', 'Context API Test', 'The Scholar', 5
  )->>'available')::boolean$$,
  ARRAY[true],
  'aggregate output should become available at five contributors'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  )->>'observed_events')::bigint$$,
  ARRAY[6::bigint],
  'safe overall totals should include all eligible events'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  ) #>> '{local_time_buckets,40,count}')::bigint$$,
  ARRAY[5::bigint],
  'local time should use 15-minute buckets'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  ) #>> '{utc_time_buckets,36,count}')::bigint$$,
  ARRAY[5::bigint],
  'UTC time should be derived from local minute and offset'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  ) #>> '{local_time_buckets,60,count}')::bigint$$,
  ARRAY[0::bigint],
  'a time bucket from one contributor should be suppressed'
);
SELECT results_eq(
  $$SELECT (get_community_drop_context(
    'poe1', 'context_api_test', 'The Scholar', 5
  ) #>> '{locations,0,count}')::bigint$$,
  ARRAY[5::bigint],
  'a location shared by five contributors should be published'
);
SELECT results_eq(
  $$SELECT jsonb_array_length(
    get_community_drop_context(
      'poe1', 'context_api_test', 'The Scholar', 5
    )->'locations'
  )$$,
  ARRAY[1],
  'a location from one contributor should be suppressed'
);

SELECT * FROM finish();
ROLLBACK;
