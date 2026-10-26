export const WRAECLAST_TRUSTED_CALLER_APP_VERSION = "gha:wraeclast-cards";

export function getConfiguredWraeclastApiKey(): string | null {
  return (
    Deno.env.get("WRAECLAST_CARDS_API_KEY") ??
    Deno.env.get("wraeclast_cards_api_key") ??
    null
  );
}

export function getConfiguredWraeclastCallerToken(): string | null {
  return Deno.env.get("WRAECLAST_CARDS_CALLER_TOKEN") ?? null;
}

export function getHttpErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }
  const status = (error as { status: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

export async function timingSafeEqualStrings(
  left: string,
  right: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index++) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function hashWraeclastApiKey(apiKey: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `apikey:${hash}`;
}

export async function isTrustedWraeclastCaller(
  callerToken: string | null,
): Promise<boolean> {
  const configuredToken = getConfiguredWraeclastCallerToken();
  return !!(
    configuredToken &&
    callerToken &&
    (await timingSafeEqualStrings(callerToken, configuredToken))
  );
}
