import { responseJson } from "./utils.ts";

export function readGggToken(req: Request): string | null | Response {
  const token = req.headers.get("x-ggg-token");
  if (token !== null && (token.length === 0 || token.length > 4096)) {
    return responseJson({
      status: 400,
      body: { error: "Invalid GGG token header" },
    });
  }
  return token;
}

export async function verifyGggIdentity(
  token: string,
): Promise<{ uuid: string; name: string }> {
  const response = await fetch("https://api.pathofexile.com/profile", {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "OAuth soothsayer/1.0.0 (contact: eskrzy@gmail.com)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("GGG profile verification failed");
  const profile: unknown = await response.json();
  if (!profile || typeof profile !== "object" || Array.isArray(profile))
    throw new Error("Invalid GGG profile");
  const row = profile as Record<string, unknown>;
  if (
    typeof row.uuid !== "string" ||
    row.uuid.length === 0 ||
    row.uuid.length > 200 ||
    typeof row.name !== "string" ||
    row.name.length === 0 ||
    row.name.length > 200
  )
    throw new Error("Invalid GGG profile");
  return { uuid: row.uuid, name: row.name };
}

export function communityIdentityFailure(error: {
  message?: string;
}): Response | null {
  const code =
    error.message === "community_identity_proof_required"
      ? "COMMUNITY_IDENTITY_PROOF_REQUIRED"
      : error.message === "community_identity_conflict"
        ? "COMMUNITY_IDENTITY_CONFLICT"
        : null;
  return code
    ? responseJson({
        status: 409,
        body: {
          code,
          error: "This upload identity requires its original verification",
        },
      })
    : null;
}
