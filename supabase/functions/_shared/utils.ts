import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

type RateLimitContext = {
  adminClient?: SupabaseClient;
  userId: string;
  endpoint: string;
  windowMs: number;
  maxHits: number;
  appVersion?: string | null;
};

function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Atomic rate limit enforcement via the `check_and_log_request` Postgres function.
 *
 * This replaces the previous TOCTOU-vulnerable pattern (SELECT count → fire-and-forget INSERT)
 * with a single atomic RPC call that:
 *   1. Checks if the user is banned
 *   2. Counts existing requests in the time window
 *   3. Inserts the request log row
 *
 * All three steps happen in a single Postgres function call, eliminating the race
 * condition where concurrent requests could both pass the count check.
 *
 * No IP addresses are collected or stored (privacy-first).
 */
export async function enforceRateLimit({
  adminClient = createAdminClient(),
  userId,
  endpoint,
  windowMs,
  maxHits,
  appVersion,
}: RateLimitContext): Promise<void> {
  const windowMinutes = Math.ceil(windowMs / 60_000);

  const { data, error } = await adminClient.rpc("check_and_log_request", {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_window_minutes: windowMinutes,
    p_max_hits: maxHits,
    p_app_version: appVersion ?? null,
  });

  if (error) {
    console.error("[RateLimit] check_and_log_request RPC failed:", error);
    // Fail closed — if we can't verify the rate limit, reject the request
    throw new Error("Rate limit check failed");
  }

  if (!data || typeof data !== "object") {
    console.error("[RateLimit] Unexpected RPC response:", data);
    throw new Error("Rate limit check failed");
  }

  if (!data.allowed) {
    if (data.reason === "banned") {
      const err = new Error(data.detail ?? "Account suspended");
      (err as any).status = 403;
      throw err;
    }

    if (data.reason === "rate_limited") {
      const err = new Error("Rate limit exceeded");
      (err as any).status = 429;
      throw err;
    }

    // Unknown rejection reason — fail closed
    const err = new Error(data.detail ?? "Request rejected");
    (err as any).status = 403;
    throw err;
  }
}

type ResponseJson = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
};

function normalizeError(e: unknown) {
  if (e instanceof Error) {
    return { message: e.message, name: e.name, stack: e.stack };
  }
  return e;
}

export function responseJson({ status, body, headers = {} }: ResponseJson) {
  const corsHeaders = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  return new Response(
    JSON.stringify(body, (_k, v) => normalizeError(v)),
    {
      status,
      headers: {
        ...corsHeaders,
        ...headers,
        "Content-Type": "application/json",
      },
    },
  );
}

type Authorize = {
  req: Request;
} & Pick<RateLimitContext, "endpoint" | "windowMs" | "maxHits">;

export async function authorize({
  req,
  endpoint,
  windowMs,
  maxHits,
}: Authorize) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS")
    return responseJson({ status: 200, headers: corsHeaders });
  if (req.method !== "POST")
    return responseJson({ status: 405, body: { error: "Method not allowed" } });

  const authHeader = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";

  if (!apikey)
    return responseJson({
      status: 401,
      headers: corsHeaders,
      body: { error: "Missing apikey header" },
    });

  if (!authHeader.startsWith("Bearer ")) {
    return responseJson({
      status: 401,
      body: { error: "Missing Authorization header" },
    });
  }

  const token = authHeader.slice("Bearer ".length);

  const pub = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: claims, error: claimsErr } = await pub.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return responseJson({ status: 401, body: { error: "Invalid JWT" } });
  }

  const userId = claims.claims.sub;

  // Collect optional telemetry (no IP — privacy-first)
  const appVersion = req.headers.get("x-app-version") ?? null;

  try {
    await enforceRateLimit({
      userId,
      endpoint,
      windowMs,
      maxHits,
      appVersion,
    });
  } catch (error) {
    const status = (error as any).status;

    if (status === 403) {
      return responseJson({
        status: 403,
        body: { error: (error as Error).message || "Forbidden" },
      });
    }

    if (status === 429) {
      return responseJson({
        status: 429,
        body: { error: "Rate limit exceeded. Try again later." },
      });
    }

    console.error("[RateLimit] Unexpected error:", error);
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
    });
  }

  return token;
}
