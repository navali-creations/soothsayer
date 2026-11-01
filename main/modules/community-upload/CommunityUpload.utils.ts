export const COMMUNITY_IDENTITY_PROOF_REQUIRED =
  "COMMUNITY_IDENTITY_PROOF_REQUIRED";
export const COMMUNITY_IDENTITY_CONFLICT = "COMMUNITY_IDENTITY_CONFLICT";
export type CommunityIdentityFailureCode =
  | typeof COMMUNITY_IDENTITY_PROOF_REQUIRED
  | typeof COMMUNITY_IDENTITY_CONFLICT;

export interface CommunityCountUploadAcknowledgement {
  success: true;
  upload_id: string;
  total_cards: number;
  unique_cards: number;
  upload_count: number;
  is_verified: boolean;
}

export function parseCountUploadAcknowledgement(
  value: unknown,
  verified: boolean,
): CommunityCountUploadAcknowledgement {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Community upload returned an invalid acknowledgement");
  }
  const row = value as Record<string, unknown>;
  if (
    row.success !== true ||
    typeof row.upload_id !== "string" ||
    row.upload_id.length === 0 ||
    row.upload_id.length > 200 ||
    !Number.isSafeInteger(row.total_cards) ||
    (row.total_cards as number) < 0 ||
    (row.total_cards as number) > 2147483647 ||
    !Number.isInteger(row.unique_cards) ||
    (row.unique_cards as number) < 1 ||
    (row.unique_cards as number) > 1000 ||
    !Number.isSafeInteger(row.upload_count) ||
    (row.upload_count as number) < 1 ||
    (row.upload_count as number) > 2147483647 ||
    row.is_verified !== verified
  ) {
    throw new Error(
      "Community upload was not acknowledged with the expected ownership",
    );
  }
  return row as unknown as CommunityCountUploadAcknowledgement;
}
