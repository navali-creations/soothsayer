import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

type RateLimitContext = {
  adminClient?: SupabaseClient;
  userId: string;
  endpoint: string;
  windowMs: number;
  maxHits: number;
  appVersion?: string | null;
  ip?: string | null;
};

function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export async function enforceRateLimit({
  adminClient = createAdminClient(),
  userId,
  endpoint,
  windowMs,
  maxHits,
  appVersion,
  ip,
}: RateLimitContext): Promise<void> {
  const cutoff = new Date(Date.now() - windowMs).toISOString();

  const { count, error } = await adminClient
    .from("api_requests")
    .select("*", { head: true, count: "exact" })
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .gte("created_at", cutoff);

  if (error) {
    console.error("[RateLimit] count failed:", error);
    throw new Error("Rate limit check failed");
  }

  if ((count ?? 0) >= maxHits) {
    const err = new Error("Rate limit exceeded");
    (err as any).status = 429;
    throw err;
  }

  // fire-and-forget logging (no .catch chaining)
  (async () => {
    try {
      const { error: logErr } = await adminClient.from("api_requests").insert({
        user_id: userId,
        endpoint,
        app_version: appVersion,
        ip,
      });
      if (logErr) console.error("[RateLimit] log failed:", logErr);
    } catch (err) {
      console.error("[RateLimit] log failed:", err);
    }
  })();
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
    "Access-Control-Allow-Origin": "*",
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

  // Collect telemetry headers
  const appVersion = req.headers.get("x-app-version") ?? null;
  const ip = req.headers.get("x-forwarded-for") ?? null;

  try {
    await enforceRateLimit({
      userId,
      endpoint,
      windowMs,
      maxHits,
      appVersion,
      ip,
    });
  } catch (error) {
    if ((error as any).status === 429) {
      return responseJson({
        status: 429,
        body: { error: "Rate limit exceeded. Try again later." },
      });
    }
    console.error("[RateLimit] Unexpected error:", error);
    return responseJson({
      status: 500,
      body: { error },
    });
  }

  return token;
}
