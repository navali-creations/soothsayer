-- ═══════════════════════════════════════════════════════════════
-- Migration: Extend rate limiting for API-key identifiers (Option A)
--
-- Modifies api_requests, banned_users, check_and_log_request, ban_user,
-- unban_user, and abuse_monitor to support both:
--   - JWT-authenticated callers (user_id UUID → auth.users FK)
--   - API-key / anonymous callers (identifier TEXT, no FK)
--
-- Exactly one of (user_id, identifier) must be non-null per row.
--
-- Security mitigations implemented:
--   1. CHECK constraint: exactly one identity present
--   2. Partial index on (identifier, endpoint, created_at) for fast lookups
--   3. Updated check_and_log_request with fail-closed identity validation
--   4. Identifier-aware ban support in banned_users
--   5. Updated abuse_monitor view with COALESCE grouping
--   6. Backwards-compatible: existing callers pass user_id as before
-- ═══════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════
-- 1. ALTER api_requests: add identifier, relax user_id, add CHECK
-- ═══════════════════════════════════════════════════════════════

-- Make user_id nullable (was NOT NULL)
ALTER TABLE api_requests ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing FK so we can re-add it with ON DELETE SET NULL
-- (rows for deleted users become identifier-like orphans until cleanup)
ALTER TABLE api_requests DROP CONSTRAINT IF EXISTS api_requests_user_id_fkey;
ALTER TABLE api_requests
  ADD CONSTRAINT api_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add identifier column
ALTER TABLE api_requests ADD COLUMN identifier TEXT DEFAULT NULL;

-- Exactly one of (user_id, identifier) must be non-null
ALTER TABLE api_requests ADD CONSTRAINT api_requests_identity_check
  CHECK (
    (user_id IS NOT NULL AND identifier IS NULL)
    OR (user_id IS NULL AND identifier IS NOT NULL)
  );

-- Backfill: all existing rows have user_id set, so they already satisfy the CHECK.

-- Index for identifier-based rate limit lookups
CREATE INDEX api_requests_identifier_time_idx
  ON api_requests (identifier, endpoint, created_at DESC)
  WHERE identifier IS NOT NULL;

-- Keep the existing user_id index as-is (it still works for non-null user_id rows).


-- ═══════════════════════════════════════════════════════════════
-- 2. ALTER banned_users: add identifier support
-- ═══════════════════════════════════════════════════════════════

-- Make user_id nullable
ALTER TABLE banned_users ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing FK so we can re-add it (keeping CASCADE)
ALTER TABLE banned_users DROP CONSTRAINT IF EXISTS banned_users_user_id_fkey;
ALTER TABLE banned_users
  ADD CONSTRAINT banned_users_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add identifier column
ALTER TABLE banned_users ADD COLUMN identifier TEXT DEFAULT NULL;

-- Exactly one of (user_id, identifier) must be non-null
ALTER TABLE banned_users ADD CONSTRAINT banned_users_identity_check
  CHECK (
    (user_id IS NOT NULL AND identifier IS NULL)
    OR (user_id IS NULL AND identifier IS NOT NULL)
  );

-- Drop the old unique constraint on user_id (it no longer covers all cases)
ALTER TABLE banned_users DROP CONSTRAINT IF EXISTS banned_users_user_id_key;

-- Add partial unique constraints for each identity type
CREATE UNIQUE INDEX banned_users_user_id_unique
  ON banned_users (user_id) WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX banned_users_identifier_unique
  ON banned_users (identifier) WHERE identifier IS NOT NULL;

-- Index for identifier-based ban lookups
CREATE INDEX idx_banned_users_identifier
  ON banned_users (identifier) WHERE identifier IS NOT NULL;


-- ═══════════════════════════════════════════════════════════════
-- 3. UPDATE RLS: api_requests "own rows only" policy
--
--    The existing policy uses `auth.uid() = user_id`. Rows with
--    user_id IS NULL are correctly invisible to authenticated
--    users (NULL = UUID is always false). No change needed.
-- ═══════════════════════════════════════════════════════════════

-- (No RLS changes needed — NULL user_id rows are invisible to authenticated users.)


-- ═══════════════════════════════════════════════════════════════
-- 4. REPLACE check_and_log_request: dual-identity support
--
--    New signature adds p_identifier TEXT DEFAULT NULL.
--    Exactly one of p_user_id / p_identifier must be non-null.
--    Ban check uses whichever identity is provided.
-- ═══════════════════════════════════════════════════════════════

-- Drop the old function signature first to avoid overload ambiguity
DROP FUNCTION IF EXISTS check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION check_and_log_request(
  p_user_id UUID DEFAULT NULL,
  p_endpoint TEXT DEFAULT NULL,
  p_window_minutes INTEGER DEFAULT NULL,
  p_max_hits INTEGER DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
  v_is_banned BOOLEAN;
  v_ban_reason TEXT;
  v_request_id UUID;
BEGIN
  -- 0. Validate: exactly one identity must be provided
  IF p_user_id IS NOT NULL AND p_identifier IS NOT NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'invalid_request',
      'detail', 'Provide exactly one of p_user_id or p_identifier, not both'
    );
  END IF;

  IF p_user_id IS NULL AND p_identifier IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'invalid_request',
      'detail', 'Provide exactly one of p_user_id or p_identifier'
    );
  END IF;

  -- Validate required params
  IF p_endpoint IS NULL OR p_window_minutes IS NULL OR p_max_hits IS NULL THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'invalid_request',
      'detail', 'p_endpoint, p_window_minutes, and p_max_hits are required'
    );
  END IF;

  -- 1. Check if caller is banned
  IF p_user_id IS NOT NULL THEN
    SELECT true, reason INTO v_is_banned, v_ban_reason
    FROM banned_users
    WHERE user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
  ELSE
    SELECT true, reason INTO v_is_banned, v_ban_reason
    FROM banned_users
    WHERE identifier = p_identifier
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1;
  END IF;

  IF v_is_banned THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'banned',
      'detail', COALESCE(v_ban_reason, 'Access suspended')
    );
  END IF;

  -- 2. Count existing requests in window
  IF p_user_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count
    FROM api_requests
    WHERE user_id = p_user_id
      AND endpoint = p_endpoint
      AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM api_requests
    WHERE identifier = p_identifier
      AND endpoint = p_endpoint
      AND created_at >= now() - (p_window_minutes || ' minutes')::INTERVAL;
  END IF;

  -- 3. Check rate limit
  IF v_count >= p_max_hits THEN
    RETURN json_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'detail', format('Rate limit: %s/%s requests in %s min window', v_count, p_max_hits, p_window_minutes)
    );
  END IF;

  -- 4. Log the request
  INSERT INTO api_requests (user_id, identifier, endpoint, app_version)
  VALUES (p_user_id, p_identifier, p_endpoint, p_app_version)
  RETURNING id INTO v_request_id;

  RETURN json_build_object(
    'allowed', true,
    'request_id', v_request_id,
    'remaining', p_max_hits - v_count - 1
  );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM PUBLIC;
COMMENT ON FUNCTION check_and_log_request(UUID, TEXT, INTEGER, INTEGER, TEXT, TEXT) IS
  'Atomic ban check + rate limit + request logging. Supports both user_id (JWT) and identifier (API key) callers. Eliminates TOCTOU race. Service role only.';


-- ═══════════════════════════════════════════════════════════════
-- 5. UPDATE ban_user / unban_user: dual-identity support
-- ═══════════════════════════════════════════════════════════════

-- Drop old signatures to avoid overload issues
DROP FUNCTION IF EXISTS ban_user(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS unban_user(UUID);

CREATE OR REPLACE FUNCTION ban_user(
  p_user_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'Abuse detected',
  p_duration_hours INTEGER DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expires TIMESTAMPTZ;
BEGIN
  -- Validate: exactly one identity
  IF (p_user_id IS NOT NULL AND p_identifier IS NOT NULL)
    OR (p_user_id IS NULL AND p_identifier IS NULL) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Provide exactly one of p_user_id or p_identifier'
    );
  END IF;

  IF p_duration_hours IS NOT NULL THEN
    v_expires := now() + (p_duration_hours || ' hours')::INTERVAL;
  END IF;

  IF p_user_id IS NOT NULL THEN
    INSERT INTO banned_users (user_id, reason, expires_at)
    VALUES (p_user_id, p_reason, v_expires)
    ON CONFLICT (user_id) WHERE user_id IS NOT NULL
    DO UPDATE SET reason = EXCLUDED.reason,
                  expires_at = EXCLUDED.expires_at,
                  banned_at = now();
  ELSE
    INSERT INTO banned_users (identifier, reason, expires_at)
    VALUES (p_identifier, p_reason, v_expires)
    ON CONFLICT (identifier) WHERE identifier IS NOT NULL
    DO UPDATE SET reason = EXCLUDED.reason,
                  expires_at = EXCLUDED.expires_at,
                  banned_at = now();
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'identifier', p_identifier,
    'permanent', p_duration_hours IS NULL,
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION unban_user(
  p_user_id UUID DEFAULT NULL,
  p_identifier TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Validate: exactly one identity
  IF (p_user_id IS NOT NULL AND p_identifier IS NOT NULL)
    OR (p_user_id IS NULL AND p_identifier IS NULL) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Provide exactly one of p_user_id or p_identifier'
    );
  END IF;

  IF p_user_id IS NOT NULL THEN
    DELETE FROM banned_users WHERE user_id = p_user_id;
  ELSE
    DELETE FROM banned_users WHERE identifier = p_identifier;
  END IF;

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'identifier', p_identifier
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ban_user(UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION unban_user(UUID, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION ban_user(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION unban_user(UUID, TEXT) FROM PUBLIC;

COMMENT ON FUNCTION ban_user(UUID, TEXT, INTEGER, TEXT) IS 'Ban a user or identifier. NULL duration = permanent. Provide exactly one of p_user_id / p_identifier. Service role only.';
COMMENT ON FUNCTION unban_user(UUID, TEXT) IS 'Remove a ban by user_id or identifier. Service role only.';


-- ═══════════════════════════════════════════════════════════════
-- 6. REPLACE abuse_monitor view: dual-identity grouping
--
--    CREATE OR REPLACE VIEW cannot add/reorder columns, so we
--    DROP and recreate. The view has no dependents (only
--    service_role queries it ad-hoc).
-- ═══════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS abuse_monitor;

CREATE VIEW abuse_monitor AS
SELECT
  user_id,
  identifier,
  COALESCE(user_id::text, identifier) AS identity,
  endpoint,
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

-- Reapply access control on the replaced view
REVOKE ALL ON abuse_monitor FROM PUBLIC;
REVOKE ALL ON abuse_monitor FROM anon;
REVOKE ALL ON abuse_monitor FROM authenticated;
GRANT SELECT ON abuse_monitor TO service_role;
