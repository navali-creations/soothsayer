-- Surface the latest known application version for each abuse-monitor group.

DROP VIEW IF EXISTS abuse_monitor;

CREATE VIEW abuse_monitor AS
SELECT
  user_id,
  identifier,
  COALESCE(user_id::text, identifier) AS identity,
  endpoint,
  (
    ARRAY_AGG(app_version ORDER BY created_at DESC)
      FILTER (WHERE app_version IS NOT NULL)
  )[1] AS app_version,
  COUNT(*) AS request_count,
  MIN(created_at) AS first_request,
  MAX(created_at) AS last_request,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '1 hour') AS last_hour,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours') AS last_24h,
  CASE
    WHEN user_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM banned_users b
      WHERE b.user_id = api_requests.user_id
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
    WHEN identifier IS NOT NULL THEN EXISTS (
      SELECT 1 FROM banned_users b
      WHERE b.identifier = api_requests.identifier
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
    ELSE false
  END AS is_banned
FROM api_requests
GROUP BY user_id, identifier, endpoint
ORDER BY last_24h DESC;

REVOKE ALL ON abuse_monitor FROM PUBLIC, anon, authenticated;
GRANT SELECT ON abuse_monitor TO service_role;

COMMENT ON VIEW abuse_monitor IS
  'Aggregates API request activity by identity and endpoint, including the latest known app version.';
