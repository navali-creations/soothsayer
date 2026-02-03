-- =====================================================
-- Soothsayer Database Schema
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Table: poe_leagues
-- Stores league information for both PoE1 and PoE2
-- =====================================================
CREATE TABLE poe_leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
  league_id TEXT NOT NULL, -- Official league ID from PoE API
  name TEXT NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game, league_id)
);

-- Index for fast lookups
CREATE INDEX idx_poe_leagues_game_active ON poe_leagues(game, is_active);
CREATE INDEX idx_poe_leagues_updated ON poe_leagues(updated_at DESC);

-- =====================================================
-- Table: snapshots
-- Stores price snapshot metadata
-- =====================================================
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES poe_leagues(id) ON DELETE CASCADE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exchange_chaos_to_divine NUMERIC(10, 2) NOT NULL,
  stash_chaos_to_divine NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by league and time
CREATE INDEX idx_snapshots_league_fetched ON snapshots(league_id, fetched_at DESC);
CREATE INDEX idx_snapshots_created ON snapshots(created_at DESC);

-- =====================================================
-- Table: card_prices
-- Stores individual card prices per snapshot
-- =====================================================
CREATE TABLE card_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  card_name TEXT NOT NULL,
  price_source TEXT NOT NULL CHECK (price_source IN ('exchange', 'stash')),
  chaos_value NUMERIC(10, 2) NOT NULL,
  divine_value NUMERIC(10, 4) NOT NULL,
  stack_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_card_prices_snapshot ON card_prices(snapshot_id);
CREATE INDEX idx_card_prices_snapshot_source ON card_prices(snapshot_id, price_source);
CREATE INDEX idx_card_prices_name ON card_prices(card_name);

-- =====================================================
-- Row Level Security (RLS) Policies
-- All tables: Public READ, Service Role WRITE
-- =====================================================

-- Enable RLS
ALTER TABLE poe_leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_prices ENABLE ROW LEVEL SECURITY;

-- Public read access for poe_leagues
CREATE POLICY "Public read access for poe_leagues"
  ON poe_leagues FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role write access for poe_leagues
CREATE POLICY "Service role write access for poe_leagues"
  ON poe_leagues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public read access for snapshots
CREATE POLICY "Public read access for snapshots"
  ON snapshots FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role write access for snapshots
CREATE POLICY "Service role write access for snapshots"
  ON snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Public read access for card_prices
CREATE POLICY "Public read access for card_prices"
  ON card_prices FOR SELECT
  TO anon, authenticated
  USING (true);

-- Service role write access for card_prices
CREATE POLICY "Service role write access for card_prices"
  ON card_prices FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to get the latest snapshot for a league
CREATE OR REPLACE FUNCTION get_latest_snapshot_for_league(p_league_id UUID)
RETURNS TABLE (
  snapshot_id UUID,
  fetched_at TIMESTAMPTZ,
  exchange_chaos_to_divine NUMERIC,
  stash_chaos_to_divine NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    fetched_at,
    exchange_chaos_to_divine,
    stash_chaos_to_divine
  FROM snapshots
  WHERE league_id = p_league_id
  ORDER BY fetched_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update league updated_at timestamp
CREATE OR REPLACE FUNCTION update_league_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_poe_leagues_timestamp
  BEFORE UPDATE ON poe_leagues
  FOR EACH ROW
  EXECUTE FUNCTION update_league_timestamp();

-- =====================================================
-- Initial Seed Data (Optional - for testing)
-- =====================================================

-- Seed some initial leagues (you can remove this after testing)
INSERT INTO poe_leagues (game, league_id, name, is_active) VALUES
  ('poe1', 'Standard', 'Standard', true),
  ('poe1', 'Hardcore', 'Hardcore', true),
  ('poe2', 'Standard', 'Standard', true),
  ('poe2', 'Hardcore', 'Hardcore', true)
ON CONFLICT (game, league_id) DO NOTHING;

-- =====================================================
-- Views for convenience (optional)
-- =====================================================

-- View: Active leagues with latest snapshot info
CREATE OR REPLACE VIEW active_leagues_with_snapshots AS
SELECT
  l.id,
  l.game,
  l.league_id,
  l.name,
  l.is_active,
  l.updated_at,
  s.snapshot_id,
  s.fetched_at AS last_snapshot_at
FROM poe_leagues l
LEFT JOIN LATERAL (
  SELECT
    id AS snapshot_id,
    fetched_at
  FROM snapshots
  WHERE league_id = l.id
  ORDER BY fetched_at DESC
  LIMIT 1
) s ON true
WHERE l.is_active = true
ORDER BY l.game, l.name;

-- =====================================================
-- Grant permissions to anon role for views
-- =====================================================
GRANT SELECT ON active_leagues_with_snapshots TO anon, authenticated;
