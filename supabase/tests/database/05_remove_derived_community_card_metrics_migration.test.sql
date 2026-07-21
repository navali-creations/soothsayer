-- Upgrade and rerun coverage for removing derived community-card metrics.

BEGIN;

SELECT plan(7);

INSERT INTO poe_leagues (id, game, league_id, name, is_active)
VALUES (
  'fc000000-0000-0000-0000-000000000001',
  'poe1',
  'migration-fixture',
  'Migration Fixture',
  false
);

INSERT INTO cards (id, game, name)
VALUES (
  'fc000000-0000-0000-0000-000000000101',
  'poe1',
  'Migration Fixture Card'
);

ALTER TABLE community_league_card_estimates
  ADD COLUMN ratio DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (ratio >= 0),
  ADD COLUMN verified_ratio DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (verified_ratio >= 0),
  ADD COLUMN seen_vs_community_estimate DOUBLE PRECISION,
  ADD COLUMN verified_seen_vs_community_estimate DOUBLE PRECISION;

INSERT INTO community_league_card_estimates (
  league_id,
  aggregate_scope,
  card_id,
  count,
  ratio,
  contributors,
  verified_count,
  verified_ratio,
  verified_contributors,
  seen_vs_community_estimate,
  verified_seen_vs_community_estimate
)
VALUES (
  'fc000000-0000-0000-0000-000000000001',
  'all',
  'fc000000-0000-0000-0000-000000000101',
  7,
  0.07,
  2,
  3,
  0.03,
  1,
  1.4,
  1.2
);

\ir .remove_derived_community_card_metrics.sql.inc

SELECT hasnt_column(
  'public',
  'community_league_card_estimates',
  'ratio',
  'upgrade should remove ratio'
);
SELECT hasnt_column(
  'public',
  'community_league_card_estimates',
  'verified_ratio',
  'upgrade should remove verified_ratio'
);
SELECT hasnt_column(
  'public',
  'community_league_card_estimates',
  'seen_vs_community_estimate',
  'upgrade should remove seen_vs_community_estimate'
);
SELECT hasnt_column(
  'public',
  'community_league_card_estimates',
  'verified_seen_vs_community_estimate',
  'upgrade should remove verified_seen_vs_community_estimate'
);

SELECT results_eq(
  $$SELECT count, contributors
    FROM community_league_card_estimates
    WHERE league_id = 'fc000000-0000-0000-0000-000000000001'
      AND aggregate_scope = 'all'
      AND card_id = 'fc000000-0000-0000-0000-000000000101'$$,
  $$VALUES (7::bigint, 2)$$,
  'upgrade should preserve stored count aggregates'
);

SELECT has_function(
  'public',
  'refresh_community_league_card_estimates',
  ARRAY['uuid'],
  'upgrade should preserve the aggregate refresh function'
);

\ir .remove_derived_community_card_metrics.sql.inc

SELECT pass('migration should be safe to apply more than once');

SELECT * FROM finish();

ROLLBACK;
