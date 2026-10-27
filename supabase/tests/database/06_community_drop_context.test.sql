-- =============================================================================
-- Community drop context: schema, access control, and idempotent ingestion
-- =============================================================================

BEGIN;

SELECT plan(35);

SELECT has_table(
  'public', 'community_locations',
  'community_locations table should exist'
);
SELECT has_table(
  'public', 'community_drop_events',
  'community_drop_events table should exist'
);
SELECT has_index(
  'public', 'community_drop_events', 'idx_community_drop_events_card_upload',
  'community drop aggregation should use the covering card/upload index'
);
SELECT has_index(
  'public', 'community_drop_events', 'idx_community_drop_events_upload_time',
  'community drop events should retain an upload/time index for cascade analysis'
);
SELECT has_function(
  'public', 'ingest_community_drop_events', ARRAY['uuid', 'text', 'jsonb'],
  'ingest_community_drop_events(uuid, text, jsonb) should exist'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.community_locations'::regclass),
  'community_locations should have RLS enabled'
);
SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.community_drop_events'::regclass),
  'community_drop_events should have RLS enabled'
);
SELECT policies_are(
  'public', 'community_locations',
  ARRAY['Service role full access for community_locations'],
  'community_locations should be service-role-only'
);
SELECT policies_are(
  'public', 'community_drop_events',
  ARRAY['Service role full access for community_drop_events'],
  'community_drop_events should be service-role-only'
);

SELECT results_eq(
  $$SELECT has_function_privilege(
    'service_role',
    'public.ingest_community_drop_events(uuid,text,jsonb)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'service_role should be able to ingest drop context'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'anon',
    'public.ingest_community_drop_events(uuid,text,jsonb)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'anon should not be able to ingest drop context'
);
SELECT results_eq(
  $$SELECT NOT has_function_privilege(
    'authenticated',
    'public.ingest_community_drop_events(uuid,text,jsonb)'::regprocedure,
    'EXECUTE'
  )$$,
  ARRAY[true],
  'authenticated should not be able to ingest drop context'
);
SELECT results_eq(
  $$SELECT prosecdef
    FROM pg_proc
    WHERE oid = 'public.ingest_community_drop_events(uuid,text,jsonb)'::regprocedure$$,
  ARRAY[true],
  'ingest_community_drop_events should be SECURITY DEFINER'
);
SELECT results_eq(
  $$SELECT NOT attnotnull
    FROM pg_attribute
    WHERE attrelid = 'public.community_drop_events'::regclass
      AND attname = 'location_id'$$,
  ARRAY[true],
  'drop context should allow time observations without a location'
);
SELECT results_eq(
  $$SELECT COALESCE(proconfig, ARRAY[]::text[]) @> ARRAY['search_path=public, pg_temp']
    FROM pg_proc
    WHERE oid = 'public.ingest_community_drop_events(uuid,text,jsonb)'::regprocedure$$,
  ARRAY[true],
  'ingest_community_drop_events should pin its search_path'
);

INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES (
  'fc000000-0000-0000-0000-000000000001',
  'poe1',
  'drop_context_test',
  'Drop Context Test',
  true
);
INSERT INTO cards (id, game, name) VALUES
  ('fc000000-0000-0000-0000-000000000101', 'poe1', 'The Scholar'),
  ('fc000000-0000-0000-0000-000000000102', 'poe2', 'Other Game Card');
SELECT results_eq(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000301",
      "card_name":" The Scholar ",
      "location":" Atlas Hideout ",
      "local_minute":626,
      "utc_offset_minutes":60
    }]'::jsonb
  )$$,
  ARRAY[1],
  'ingestion should insert one valid context event'
);
SELECT results_eq(
  $$SELECT total_cards_uploaded, upload_count
    FROM community_uploads
    WHERE league_id = 'fc000000-0000-0000-0000-000000000001'
      AND device_id = 'drop-context-device'$$,
  $$VALUES (0, 0)$$,
  'ingestion should create a context-only parent for the canonical device identity'
);
SELECT refresh_community_league_card_estimates(
  'fc000000-0000-0000-0000-000000000001'
);
SELECT results_eq(
  $$SELECT aggregate_scope, upload_count, contributors
    FROM community_league_estimates
    WHERE league_id = 'fc000000-0000-0000-0000-000000000001'
    ORDER BY aggregate_scope$$,
  $$VALUES
    ('all'::text, 0, 0),
    ('non_suspicious'::text, 0, 0)$$,
  'context-only parents should not count as aggregate uploads or contributors'
);
SELECT results_eq(
  $$SELECT c.name, location.name, event.local_minute::int, event.utc_offset_minutes::int
    FROM community_drop_events event
    JOIN cards c ON c.id = event.card_id
    JOIN community_locations location ON location.id = event.location_id
    WHERE event.event_id = 'fc000000-0000-0000-0000-000000000301'$$,
  $$VALUES ('The Scholar'::text, 'Atlas Hideout'::text, 626, 60)$$,
  'ingestion should normalize names and preserve coarse local time'
);
SELECT results_eq(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000301",
      "card_name":"The Scholar",
      "location":"Atlas Hideout",
      "local_minute":626,
      "utc_offset_minutes":60
    }]'::jsonb
  )$$,
  ARRAY[0],
  'retrying an identical event should be idempotent'
);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM community_locations
    WHERE game = 'poe1' AND name = 'Atlas Hideout'$$,
  ARRAY[1],
  'location normalization should keep one row per game and name'
);
SELECT results_eq(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000309",
      "card_name":"The Scholar",
      "location":null,
      "local_minute":630,
      "utc_offset_minutes":60
    }]'::jsonb
  )$$,
  ARRAY[1],
  'ingestion should accept time context without a location'
);
SELECT results_eq(
  $$SELECT location_id IS NULL, local_minute::int, utc_offset_minutes::int
    FROM community_drop_events
    WHERE event_id = 'fc000000-0000-0000-0000-000000000309'$$,
  $$VALUES (true, 630, 60)$$,
  'time-only context should preserve its minute and UTC offset'
);

SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000301",
      "card_name":"The Scholar",
      "location":"The Rogue Harbour",
      "local_minute":627,
      "utc_offset_minutes":60
    }]'::jsonb
  )$$,
  '23505', NULL,
  'an event ID should not be reusable for different context'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[
      {"event_id":"fc000000-0000-0000-0000-000000000302","card_name":"The Scholar","location":"Atlas Hideout","local_minute":1,"utc_offset_minutes":0},
      {"event_id":"fc000000-0000-0000-0000-000000000302","card_name":"The Scholar","location":"Atlas Hideout","local_minute":1,"utc_offset_minutes":0}
    ]'::jsonb
  )$$,
  '22023', NULL,
  'one payload should reject duplicate event IDs'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000303","card_name":"The Scholar","location":"Atlas Hideout","utc_offset_minutes":0}]'::jsonb
  )$$,
  '22023', NULL,
  'event rows should require local_minute'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000304","card_name":"The Scholar","location":"Atlas Hideout","local_minute":1440,"utc_offset_minutes":0}]'::jsonb
  )$$,
  '22023', NULL,
  'event rows should reject out-of-range local minutes'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000305","card_name":"The Scholar","location":"Atlas Hideout","local_minute":1}]'::jsonb
  )$$,
  '22023', NULL,
  'event rows should require utc_offset_minutes'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000306","card_name":"Missing Card","location":"Atlas Hideout","local_minute":1,"utc_offset_minutes":0}]'::jsonb
  )$$,
  '23503', NULL,
  'ingestion should reject unknown card names'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000307","card_name":"Other Game Card","location":"Atlas Hideout","local_minute":1,"utc_offset_minutes":0}]'::jsonb
  )$$,
  '23503', NULL,
  'ingestion should reject cards from another game'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[]'::jsonb
  )$$,
  '22023', NULL,
  'ingestion should reject empty event payloads'
);
SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000299',
    'drop-context-device',
    '[{"event_id":"fc000000-0000-0000-0000-000000000308","card_name":"The Scholar","location":"Atlas Hideout","local_minute":1,"utc_offset_minutes":0}]'::jsonb
  )$$,
  '23503', NULL,
  'ingestion should reject an unknown league ID'
);

SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    (
      SELECT jsonb_agg(jsonb_build_object(
        'event_id', gen_random_uuid(),
        'card_name', 'The Scholar',
        'location', 'Batch Location ' || location_number,
        'local_minute', 1,
        'utc_offset_minutes', 0
      ))
      FROM generate_series(1, 101) AS location_number
    )
  )$$,
  '22023', NULL,
  'ingestion should reject excessive location cardinality in one batch'
);

INSERT INTO community_locations (game, name)
SELECT 'poe1', 'Stored Location ' || location_number
FROM generate_series(1, 999) AS location_number;

INSERT INTO community_drop_events (
  event_id,
  upload_id,
  card_id,
  location_id,
  local_minute,
  utc_offset_minutes
)
SELECT
  gen_random_uuid(),
  (
    SELECT id FROM community_uploads
    WHERE league_id = 'fc000000-0000-0000-0000-000000000001'
      AND device_id = 'drop-context-device'
  ),
  'fc000000-0000-0000-0000-000000000101',
  location.id,
  1,
  0
FROM community_locations location
WHERE location.game = 'poe1'
  AND location.name LIKE 'Stored Location %';

SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000399",
      "card_name":"The Scholar",
      "location":"One Location Too Far",
      "local_minute":1,
      "utc_offset_minutes":0
    }]'::jsonb
  )$$,
  '22023', NULL,
  'ingestion should cap stored location cardinality per contributor'
);

INSERT INTO community_locations (game, name)
SELECT 'poe1', 'Global Location ' || location_number
FROM generate_series(1, 1000) AS location_number;

SELECT throws_ok(
  $$SELECT ingest_community_drop_events(
    'fc000000-0000-0000-0000-000000000001',
    'another-drop-context-device',
    '[{
      "event_id":"fc000000-0000-0000-0000-000000000400",
      "card_name":"The Scholar",
      "location":"One Global Location Too Far",
      "local_minute":1,
      "utc_offset_minutes":0
    }]'::jsonb
  )$$,
  '22023', NULL,
  'ingestion should cap stored location cardinality per game'
);

SELECT * FROM finish();
ROLLBACK;
