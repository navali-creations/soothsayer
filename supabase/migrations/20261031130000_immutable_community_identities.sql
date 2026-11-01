-- Bind an upload identity once. Linking/unlinking never rewrites historical
-- verification or refreshes aggregates; normal count merges retain their work.
BEGIN;

-- Hold existing writers until the registry, RPCs, and triggers agree. Writers
-- that already committed are included in the backfill; later writes use the
-- new guards after this migration transaction commits.
LOCK TABLE public.community_uploads IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE IF NOT EXISTS public.community_contributor_identities (
  device_id TEXT PRIMARY KEY,
  ggg_uuid TEXT,
  state TEXT NOT NULL CHECK (state IN ('anonymous', 'verified', 'conflicted')),
  CHECK ((state = 'verified') = (ggg_uuid IS NOT NULL))
);
ALTER TABLE public.community_contributor_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_contributor_identities FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_contributor_identities FROM PUBLIC, anon, authenticated, service_role;

-- One migration-time metadata pass. Mixed legacy ownership is quarantined;
-- no historical row is promoted, demoted, or assigned to another account.
INSERT INTO public.community_contributor_identities (device_id, ggg_uuid, state)
SELECT device_id,
  CASE WHEN BOOL_AND(is_verified AND ggg_uuid IS NOT NULL) AND COUNT(DISTINCT ggg_uuid) = 1 THEN MIN(ggg_uuid) END,
  CASE
    WHEN BOOL_AND(NOT is_verified AND ggg_uuid IS NULL) THEN 'anonymous'
    WHEN BOOL_AND(is_verified AND ggg_uuid IS NOT NULL) AND COUNT(DISTINCT ggg_uuid) = 1 THEN 'verified'
    ELSE 'conflicted'
  END
FROM public.community_uploads WHERE device_id IS NOT NULL
GROUP BY device_id ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.assert_community_identity(p_device_id TEXT, p_ggg_uuid TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_owner public.community_contributor_identities%ROWTYPE;
BEGIN
  IF p_device_id IS NULL OR LENGTH(BTRIM(p_device_id)) NOT BETWEEN 1 AND 200
    OR (p_ggg_uuid IS NOT NULL AND LENGTH(BTRIM(p_ggg_uuid)) NOT BETWEEN 1 AND 200) THEN
    RAISE EXCEPTION 'invalid_community_identity' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('community-identity:' || BTRIM(p_device_id), 0));
  INSERT INTO public.community_contributor_identities (device_id, ggg_uuid, state)
    VALUES (BTRIM(p_device_id), p_ggg_uuid, CASE WHEN p_ggg_uuid IS NULL THEN 'anonymous' ELSE 'verified' END)
    ON CONFLICT DO NOTHING;
  SELECT * INTO STRICT v_owner FROM public.community_contributor_identities WHERE device_id = BTRIM(p_device_id);
  IF v_owner.state != 'anonymous' AND p_ggg_uuid IS NULL THEN
    RAISE EXCEPTION 'community_identity_proof_required' USING ERRCODE = '42501';
  END IF;
  IF v_owner.state = 'conflicted' OR v_owner.ggg_uuid IS DISTINCT FROM p_ggg_uuid THEN
    RAISE EXCEPTION 'community_identity_conflict' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_community_identity(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_community_upload_identity(p_device_id TEXT, p_legacy_device_id TEXT, p_ggg_uuid TEXT)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_candidate public.community_contributor_identities%ROWTYPE;
        v_legacy public.community_contributor_identities%ROWTYPE;
BEGIN
  IF p_device_id IS NULL OR p_ggg_uuid IS NULL OR LENGTH(BTRIM(p_device_id)) NOT BETWEEN 1 AND 200
    OR LENGTH(BTRIM(p_ggg_uuid)) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_community_identity' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_candidate FROM public.community_contributor_identities WHERE device_id = p_device_id;
  IF FOUND AND (v_candidate.state != 'verified' OR v_candidate.ggg_uuid IS DISTINCT FROM p_ggg_uuid) THEN
    RAISE EXCEPTION 'community_identity_conflict' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_legacy FROM public.community_contributor_identities WHERE device_id = p_legacy_device_id;
  RETURN jsonb_build_object(
    'device_id', CASE WHEN v_legacy.state = 'verified' AND v_legacy.ggg_uuid = p_ggg_uuid THEN p_legacy_device_id ELSE p_device_id END,
    'legacy_anonymous', p_legacy_device_id IS NOT NULL AND (v_legacy.device_id IS NULL OR v_legacy.state = 'anonymous')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_community_upload_identity(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_community_upload_identity(TEXT, TEXT, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.merge_community_upload_data(
  p_league_id UUID, p_device_id TEXT, p_ggg_uuid TEXT, p_ggg_username TEXT, p_is_verified BOOLEAN, p_cards JSONB
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_is_verified IS DISTINCT FROM (p_ggg_uuid IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_community_identity' USING ERRCODE = '22023';
  END IF;
  PERFORM public.assert_community_identity(p_device_id, p_ggg_uuid);
  INSERT INTO public.community_uploads (league_id, device_id, ggg_uuid, ggg_username, is_verified, total_cards_uploaded, upload_count)
    VALUES (p_league_id, BTRIM(p_device_id), p_ggg_uuid, p_ggg_username, p_is_verified, 0, 0)
    ON CONFLICT (league_id, device_id) DO NOTHING;
  RETURN public.merge_community_upload_data_legacy(p_league_id, BTRIM(p_device_id), p_ggg_uuid, p_ggg_username, p_is_verified, p_cards);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_community_upload_data(UUID, TEXT, TEXT, TEXT, BOOLEAN, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_community_upload_data(UUID, TEXT, TEXT, TEXT, BOOLEAN, JSONB) TO service_role;

DO $$ BEGIN
  IF to_regprocedure('public.ingest_community_drop_events_legacy(uuid,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.ingest_community_drop_events(UUID, TEXT, JSONB) RENAME TO ingest_community_drop_events_legacy;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ingest_community_drop_events_legacy(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ingest_community_drop_events(p_league_id UUID, p_device_id TEXT, p_events JSONB, p_ggg_uuid TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.assert_community_identity(p_device_id, p_ggg_uuid);
  INSERT INTO public.community_uploads (league_id, device_id, ggg_uuid, is_verified, total_cards_uploaded, upload_count)
    VALUES (p_league_id, BTRIM(p_device_id), p_ggg_uuid, p_ggg_uuid IS NOT NULL, 0, 0)
    ON CONFLICT (league_id, device_id) DO NOTHING;
  RETURN public.ingest_community_drop_events_legacy(p_league_id, BTRIM(p_device_id), p_events);
END;
$$;
CREATE OR REPLACE FUNCTION public.ingest_community_drop_events(p_league_id UUID, p_device_id TEXT, p_events JSONB)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.ingest_community_drop_events(p_league_id, p_device_id, p_events, NULL::TEXT);
$$;
REVOKE ALL ON FUNCTION public.ingest_community_drop_events(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_community_drop_events(UUID, TEXT, JSONB, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.ingest_community_drop_events(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_community_drop_events(UUID, TEXT, JSONB) TO service_role;

-- Defense in depth for direct service-role updates, including an old deployed
-- link handler. Existing ownership and historical verification stay immutable.
CREATE OR REPLACE FUNCTION public.enforce_community_upload_identity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_verified IS DISTINCT FROM (NEW.ggg_uuid IS NOT NULL) THEN
      RAISE EXCEPTION 'invalid_community_identity' USING ERRCODE = '22023';
    END IF;
    PERFORM public.assert_community_identity(NEW.device_id, NEW.ggg_uuid);
    RETURN NEW;
  END IF;
  IF NEW.device_id IS DISTINCT FROM OLD.device_id OR NEW.ggg_uuid IS DISTINCT FROM OLD.ggg_uuid OR NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
    RAISE EXCEPTION 'community_identity_conflict' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_community_upload_identity() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS enforce_community_upload_identity ON public.community_uploads;
CREATE TRIGGER enforce_community_upload_identity BEFORE UPDATE OF device_id, ggg_uuid, is_verified
  ON public.community_uploads FOR EACH ROW EXECUTE FUNCTION public.enforce_community_upload_identity();
DROP TRIGGER IF EXISTS register_community_upload_identity ON public.community_uploads;
-- Validate rows that are actually inserted. The private context ingester also
-- performs an INSERT ... ON CONFLICT against the parent already checked above;
-- its unused INSERT defaults must not override that parent's verified identity.
CREATE TRIGGER register_community_upload_identity AFTER INSERT ON public.community_uploads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_community_upload_identity();

COMMIT;
