-- =====================================================
-- API Requests Tracking Table
-- =====================================================
-- Tracks API requests made by users for analytics,
-- rate limiting, and debugging purposes.

-- =====================================================
-- Table: api_requests
-- Stores user API request logs
-- =====================================================
CREATE TABLE api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  app_version TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- Indexes
-- =====================================================
-- Index for querying user's requests ordered by time
CREATE INDEX api_requests_user_time_idx
  ON api_requests (user_id, created_at DESC);

-- Additional useful indexes
CREATE INDEX api_requests_endpoint_idx
  ON api_requests (endpoint);

CREATE INDEX api_requests_created_idx
  ON api_requests (created_at DESC);

-- =====================================================
-- Row Level Security (RLS)
-- =====================================================
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Users can only see their own API request logs
CREATE POLICY "own rows only"
  ON api_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert API request logs
CREATE POLICY "Service role can insert"
  ON api_requests FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can view all logs
CREATE POLICY "Service role can view all"
  ON api_requests FOR SELECT
  TO service_role
  USING (true);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to log an API request
CREATE OR REPLACE FUNCTION log_api_request(
  p_user_id UUID,
  p_endpoint TEXT,
  p_app_version TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO api_requests (user_id, endpoint, app_version, ip)
  VALUES (p_user_id, p_endpoint, p_app_version, p_ip)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION log_api_request(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Function to get request count for a user in the last N minutes
CREATE OR REPLACE FUNCTION get_user_request_count(
  p_user_id UUID,
  p_minutes INTEGER DEFAULT 60
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM api_requests
  WHERE user_id = p_user_id
    AND created_at >= NOW() - (p_minutes || ' minutes')::INTERVAL;

  RETURN v_count;
END;
$$;

-- Grant execute to authenticated users and service_role
GRANT EXECUTE ON FUNCTION get_user_request_count(UUID, INTEGER) TO authenticated, service_role;

-- =====================================================
-- Views for Analytics (Optional)
-- =====================================================

-- View: Request counts per endpoint (last 24 hours)
CREATE OR REPLACE VIEW api_requests_24h_summary AS
SELECT
  endpoint,
  COUNT(*) as request_count,
  COUNT(DISTINCT user_id) as unique_users,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request
FROM api_requests
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint
ORDER BY request_count DESC;

-- View: User request summary
CREATE OR REPLACE VIEW user_request_summary AS
SELECT
  user_id,
  COUNT(*) as total_requests,
  COUNT(DISTINCT endpoint) as unique_endpoints,
  MIN(created_at) as first_request,
  MAX(created_at) as last_request,
  MAX(app_version) as latest_app_version
FROM api_requests
GROUP BY user_id;

-- Grant access to views
GRANT SELECT ON api_requests_24h_summary TO service_role;
GRANT SELECT ON user_request_summary TO service_role;

-- Users can see their own summary
CREATE POLICY "Users can see own summary"
  ON api_requests FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- =====================================================
-- Optional: Auto-cleanup old logs
-- =====================================================
-- Uncomment to enable automatic cleanup of logs older than 90 days

-- CREATE OR REPLACE FUNCTION cleanup_old_api_requests()
-- RETURNS void
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--   DELETE FROM api_requests
--   WHERE created_at < NOW() - INTERVAL '90 days';
--
--   RAISE NOTICE 'Cleaned up old API request logs';
-- END;
-- $$;

-- Schedule cleanup (requires pg_cron)
-- SELECT cron.schedule(
--   'cleanup-api-requests-daily',
--   '0 3 * * *',  -- Daily at 3 AM
--   $$SELECT cleanup_old_api_requests();$$
-- );

-- =====================================================
-- Usage Examples (commented)
-- =====================================================

-- Log an API request:
-- SELECT log_api_request(
--   auth.uid(),
--   '/api/v1/leagues',
--   '1.0.0',
--   '192.168.1.1'
-- );

-- Check user's request count in last hour:
-- SELECT get_user_request_count(auth.uid(), 60);

-- View your own requests:
-- SELECT * FROM api_requests
-- WHERE user_id = auth.uid()
-- ORDER BY created_at DESC
-- LIMIT 10;

-- View endpoint statistics (service_role only):
-- SELECT * FROM api_requests_24h_summary;
