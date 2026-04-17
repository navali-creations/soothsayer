-- L4: Restrict community_card_data to service-role-only access
-- The "Public read access" policy exposed per-upload UUIDs, enabling
-- contribution pattern deanonymization. All public access goes through
-- the get-community-drop-rates edge function which aggregates before returning.

DROP POLICY IF EXISTS "Public read access for community_card_data" ON community_card_data;
