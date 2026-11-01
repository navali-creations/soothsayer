BEGIN;
SELECT plan(22);

SELECT has_table('public', 'community_contributor_identities', 'identity bindings exist');
SELECT ok((SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'public.community_contributor_identities'::regclass), 'identity bindings enforce RLS');
SELECT ok(NOT has_table_privilege('authenticated', 'public.community_contributor_identities', 'SELECT'), 'clients cannot read bindings');
SELECT ok(NOT has_function_privilege('service_role', 'public.assert_community_identity(text,text)', 'EXECUTE'), 'internal binding helper is not exposed');
SELECT ok(NOT has_function_privilege('service_role', 'public.ingest_community_drop_events_legacy(uuid,text,jsonb)', 'EXECUTE'), 'legacy ingestion cannot bypass ownership');
SELECT ok(NOT has_function_privilege('authenticated', 'public.resolve_community_upload_identity(text,text,text)', 'EXECUTE'), 'only server code resolves identities');

INSERT INTO public.poe_leagues (id, game, league_id, name, is_active)
VALUES ('fd000000-0000-4000-8000-000000000001', 'poe1', 'identity-ownership', 'Identity Ownership', true);
INSERT INTO public.cards (id, game, name)
VALUES ('fd000000-0000-4000-8000-000000000101', 'poe1', 'Identity Ownership Card');

SELECT lives_ok($$SELECT merge_community_upload_data(
  'fd000000-0000-4000-8000-000000000001', 'identity-anonymous', NULL, NULL, false,
  '[{"card_name":"Identity Ownership Card","count":2}]'::jsonb)$$, 'anonymous upload binds an anonymous identity');
SELECT is(resolve_community_upload_identity('fresh-identity', 'identity-anonymous', 'account-a')->>'device_id', 'fresh-identity', 'linking never claims anonymous history');
SELECT throws_ok($$SELECT merge_community_upload_data(
  'fd000000-0000-4000-8000-000000000001', 'identity-anonymous', 'account-a', 'Account A', true,
  '[{"card_name":"Identity Ownership Card","count":3}]'::jsonb)$$,
  '42501', 'community_identity_conflict', 'anonymous history cannot become verified');
SELECT lives_ok($$SELECT merge_community_upload_data(
  'fd000000-0000-4000-8000-000000000001', 'identity-verified', 'account-a', 'Account A', true,
  '[{"card_name":"Identity Ownership Card","count":4}]'::jsonb)$$, 'verified upload binds its proven account');
SELECT throws_ok($$SELECT merge_community_upload_data(
  'fd000000-0000-4000-8000-000000000001', 'identity-verified', NULL, NULL, false,
  '[{"card_name":"Identity Ownership Card","count":9}]'::jsonb)$$,
  '42501', 'community_identity_proof_required', 'tokenless uploads cannot add verified counts');
SELECT throws_ok($$SELECT merge_community_upload_data(
  'fd000000-0000-4000-8000-000000000001', 'identity-verified', 'account-b', 'Account B', true,
  '[{"card_name":"Identity Ownership Card","count":9}]'::jsonb)$$,
  '42501', 'community_identity_conflict', 'another account cannot reassign an identity');
SELECT throws_ok($$UPDATE public.community_uploads SET ggg_uuid = 'account-b' WHERE device_id = 'identity-verified'$$,
  '42501', 'community_identity_conflict', 'old direct-link code cannot relabel history');
SELECT results_eq($$SELECT ggg_uuid, is_verified, total_cards_uploaded FROM public.community_uploads WHERE device_id = 'identity-verified'$$,
  $$VALUES ('account-a'::text, true, 4)$$, 'failed ownership changes preserve counts and verification');
SELECT throws_ok($$SELECT ingest_community_drop_events(
  'fd000000-0000-4000-8000-000000000001', 'identity-verified',
  '[{"event_id":"fd000000-0000-4000-8000-000000000301","card_name":"Identity Ownership Card","location":null,"local_minute":1,"utc_offset_minutes":0}]'::jsonb)$$,
  '42501', 'community_identity_proof_required', 'context requires the same verified proof');
SELECT lives_ok($$SELECT ingest_community_drop_events(
  'fd000000-0000-4000-8000-000000000001', 'identity-verified',
  '[{"event_id":"fd000000-0000-4000-8000-000000000301","card_name":"Identity Ownership Card","location":null,"local_minute":1,"utc_offset_minutes":0}]'::jsonb,
  'account-a')$$, 'matching proof permits verified context');
SELECT results_eq($$SELECT ggg_uuid, is_verified, total_cards_uploaded FROM public.community_uploads WHERE device_id = 'identity-verified'$$,
  $$VALUES ('account-a'::text, true, 4)$$, 'verified context preserves existing metadata and aggregate counts');

INSERT INTO public.poe_leagues (id, game, league_id, name, is_active)
VALUES ('fd000000-0000-4000-8000-000000000002', 'poe1', 'identity-ownership-second', 'Identity Ownership Second', false);
SELECT throws_ok($$INSERT INTO public.community_uploads (league_id, device_id, ggg_uuid, is_verified, total_cards_uploaded, upload_count)
  VALUES ('fd000000-0000-4000-8000-000000000002', 'identity-verified', 'account-b', true, 0, 0)$$,
  '42501', 'community_identity_conflict', 'direct inserts cannot bind another league to a different account');

-- Resolution uses the identity PK, independent of the Data API's 1000-row cap.
INSERT INTO public.poe_leagues (id, game, league_id, name, is_active)
SELECT gen_random_uuid(), 'poe1', 'ownership-scale-' || i, 'Ownership Scale ' || i, false FROM generate_series(1, 1001) i;
INSERT INTO public.community_uploads (league_id, device_id, ggg_uuid, is_verified, total_cards_uploaded, upload_count)
SELECT id, 'identity-verified', 'account-a', true, 0, 0 FROM public.poe_leagues WHERE league_id LIKE 'ownership-scale-%';
SELECT is(resolve_community_upload_identity('fresh-verified', 'identity-verified', 'account-a')->>'device_id', 'identity-verified', 'more than 1000 league rows do not truncate ownership resolution');

SELECT is(resolve_community_upload_identity('fresh-other-account', 'identity-verified', 'account-b')->>'device_id', 'fresh-other-account', 'another account receives a fresh identity without claiming verified history');
SELECT is(resolve_community_upload_identity('fresh-no-history', 'missing-history', 'account-a')->>'legacy_anonymous', 'true', 'missing legacy history remains unverified');
SELECT throws_ok($$SELECT resolve_community_upload_identity('identity-anonymous', NULL, 'account-a')$$,
  '42501', 'community_identity_conflict', 'a verified candidate cannot reuse an anonymous identity');

SELECT * FROM finish();
ROLLBACK;
