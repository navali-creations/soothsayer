/**
 * Shared test helpers for Supabase Edge Function unit tests.
 *
 * Provides utilities for:
 * - Mocking `globalThis.fetch` with configurable route handlers
 * - Setting/restoring `Deno.env` variables
 * - Building mock HTTP `Request` objects
 * - Capturing the handler function passed to `Deno.serve`
 * - Creating mock Supabase PostgREST / Auth responses
 * - Suppressing console noise during tests (`quietTest`)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type FetchHandler = (
  input: string | URL | Request,
  init?: RequestInit,
) => Response | Promise<Response>;

export type FetchRoute = {
  /** Match predicate — receives the resolved URL string */
  match: (url: string, init?: RequestInit) => boolean;
  /** Handler that returns (or resolves to) a Response */
  handler: FetchHandler;
};

// ─── Fetch Mocking ───────────────────────────────────────────────────────────

const _originalFetch = globalThis.fetch;

/**
 * Installs a mock `globalThis.fetch` that routes requests through a list of
 * `FetchRoute` matchers. If no matcher hits, it returns a 500 with debug info.
 *
 * Returns an object with:
 * - `addRoute(route)` — register a new route
 * - `calls` — array of all captured `[url, init]` pairs
 * - `restore()` — puts the original fetch back
 */
export function mockFetch() {
  const routes: FetchRoute[] = [];
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  const mockedFetch: typeof globalThis.fetch = async (input, init?) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    calls.push({ url, init });

    for (const route of routes) {
      if (route.match(url, init)) {
        return route.handler(input, init);
      }
    }

    // No matching route — return a descriptive error instead of throwing
    console.warn(
      `[mockFetch] Unhandled request: ${init?.method ?? "GET"} ${url}`,
    );
    return new Response(
      JSON.stringify({ error: `Unhandled mock fetch: ${url}` }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  };

  globalThis.fetch = mockedFetch as typeof globalThis.fetch;

  return {
    addRoute(route: FetchRoute) {
      routes.push(route);
    },

    /** Convenience: add a route by URL substring match */
    onUrlContaining(substring: string, handler: FetchHandler, method?: string) {
      routes.push({
        match: (url, init) => {
          const urlMatch = url.includes(substring);
          if (!method) return urlMatch;
          const reqMethod = init?.method?.toUpperCase() ?? "GET";
          return urlMatch && reqMethod === method.toUpperCase();
        },
        handler,
      });
    },

    /** Convenience: add a route by exact URL match */
    onUrl(url: string, handler: FetchHandler) {
      routes.push({
        match: (u) => u === url,
        handler,
      });
    },

    get calls() {
      return calls;
    },

    restore() {
      globalThis.fetch = _originalFetch;
    },

    /** Reset routes & calls but keep the mock installed */
    reset() {
      routes.length = 0;
      calls.length = 0;
    },
  };
}

// ─── Console Suppression ─────────────────────────────────────────────────────

/**
 * Wraps `Deno.test` so that `console.log`, `console.warn`, and `console.error`
 * are silenced for the duration of the test.  This keeps `deno test` output
 * free of the "post-test output" blocks that production `console.*` calls
 * would otherwise produce.
 *
 * Signature mirrors `Deno.test(name, fn)`.
 */
export function quietTest(name: string, fn: () => void | Promise<void>): void {
  Deno.test(name, async () => {
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    // deno-lint-ignore no-explicit-any
    console.log = (..._args: any[]) => {};
    // deno-lint-ignore no-explicit-any
    console.warn = (..._args: any[]) => {};
    // deno-lint-ignore no-explicit-any
    console.error = (..._args: any[]) => {};

    try {
      await fn();
    } finally {
      console.log = origLog;
      console.warn = origWarn;
      console.error = origError;
    }
  });
}

// ─── Environment Variables ───────────────────────────────────────────────────

const DEFAULT_TEST_ENV: Record<string, string> = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  INTERNAL_CRON_SECRET: "test-cron-secret",
};

/**
 * Sets environment variables for testing. Returns a cleanup function that
 * deletes any vars that were set (or restores prior values).
 */
export function setupEnv(overrides: Record<string, string> = {}): () => void {
  const merged = { ...DEFAULT_TEST_ENV, ...overrides };
  const originals: Record<string, string | undefined> = {};

  for (const [key, value] of Object.entries(merged)) {
    originals[key] = Deno.env.get(key);
    Deno.env.set(key, value);
  }

  return () => {
    for (const [key, original] of Object.entries(originals)) {
      if (original === undefined) {
        Deno.env.delete(key);
      } else {
        Deno.env.set(key, original);
      }
    }
  };
}

// ─── Request Builders ────────────────────────────────────────────────────────

type MockRequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Shorthand: sets Authorization: Bearer <token> */
  bearerToken?: string;
  /** Shorthand: sets apikey header */
  apikey?: string;
  /** Shorthand: sets x-cron-secret header */
  cronSecret?: string;
  /** Shorthand: sets x-app-version header */
  appVersion?: string;
};

/**
 * Creates a `Request` object suitable for testing edge function handlers.
 */
export function createMockRequest(
  url = "http://localhost:54321/functions/v1/test",
  options: MockRequestOptions = {},
): Request {
  const {
    method = "POST",
    body,
    headers = {},
    bearerToken,
    apikey,
    cronSecret,
    appVersion,
  } = options;

  const mergedHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (bearerToken) {
    mergedHeaders.authorization = `Bearer ${bearerToken}`;
  }
  if (apikey) {
    mergedHeaders.apikey = apikey;
  }
  if (cronSecret) {
    mergedHeaders["x-cron-secret"] = cronSecret;
  }
  if (appVersion) {
    mergedHeaders["x-app-version"] = appVersion;
  }

  const init: RequestInit = {
    method,
    headers: mergedHeaders,
  };

  if (body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(body);
  }

  return new Request(url, init);
}

/**
 * Shorthand for creating an authorized POST request (with apikey + Bearer token).
 */
export function createAuthorizedRequest(
  url: string,
  body: unknown,
  token = "test-jwt-token",
): Request {
  return createMockRequest(url, {
    method: "POST",
    body,
    bearerToken: token,
    apikey: "test-anon-key",
  });
}

/**
 * Shorthand for creating an internal (cron) request with x-cron-secret.
 */
export function createInternalRequest(
  url: string,
  body: unknown,
  cronSecret = "test-cron-secret",
): Request {
  return createMockRequest(url, {
    method: "POST",
    body,
    cronSecret,
  });
}

/**
 * Shorthand for a CORS preflight request.
 */
export function createOptionsRequest(
  url = "http://localhost:54321/functions/v1/test",
): Request {
  return createMockRequest(url, { method: "OPTIONS" });
}

// ─── Deno.serve Handler Capture ──────────────────────────────────────────────

type ServeHandler = (req: Request) => Response | Promise<Response>;

/**
 * Mocks `Deno.serve` so that when an edge function module is imported, the
 * handler function is captured instead of actually starting a server.
 *
 * Returns:
 * - `handler` — a getter that returns the captured handler
 * - `restore()` — restores the original `Deno.serve`
 *
 * Usage:
 * ```ts
 * const serve = stubDenoServe();
 * await import("../my-function/index.ts");
 * const handler = serve.handler!;
 * const resp = await handler(createMockRequest(...));
 * serve.restore();
 * ```
 *
 * Note: Due to Deno module caching, each handler module can only be imported
 * once per test file. Design one test file per edge function.
 */
export function stubDenoServe() {
  let capturedHandler: ServeHandler | null = null;
  const originalServe = Deno.serve;

  // Deno.serve can be called with (handler) or (options, handler)
  // deno-lint-ignore no-explicit-any
  (Deno as any).serve = (
    handlerOrOptions: ServeHandler | Record<string, unknown>,
    maybeHandler?: ServeHandler,
  ) => {
    if (typeof handlerOrOptions === "function") {
      capturedHandler = handlerOrOptions;
    } else if (typeof maybeHandler === "function") {
      capturedHandler = maybeHandler;
    }

    // Return a mock server object
    return {
      finished: Promise.resolve(),
      ref() {},
      unref() {},
      addr: { hostname: "localhost", port: 0, transport: "tcp" as const },
      shutdown() {
        return Promise.resolve();
      },
    };
  };

  return {
    get handler(): ServeHandler | null {
      return capturedHandler;
    },

    restore() {
      // deno-lint-ignore no-explicit-any
      (Deno as any).serve = originalServe;
    },
  };
}

// ─── Supabase PostgREST Response Builders ────────────────────────────────────

/**
 * Creates a mock PostgREST-style JSON response (like what Supabase REST API returns).
 */
export function postgrestResponse(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  // PostgREST returns arrays for select queries, objects for single
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Range": "0-0/*",
      ...headers,
    },
  });
}

/**
 * Creates a PostgREST error response.
 */
export function postgrestError(
  message: string,
  code = "PGRST000",
  status = 400,
): Response {
  return new Response(
    JSON.stringify({
      message,
      code,
      details: null,
      hint: null,
    }),
    {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    },
  );
}

/**
 * Creates a mock Supabase Auth response for getClaims-style calls.
 * Note: getClaims in supabase-js v2 decodes the JWT locally, so this
 * helper is primarily for mocking the /auth/v1/ endpoints if needed.
 */
export function authResponse(userId: string, role = "authenticated"): Response {
  return new Response(
    JSON.stringify({
      sub: userId,
      role,
      iss: "supabase",
      exp: 9999999999,
      iat: 1700000000,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Creates a mock RPC response (for functions like check_and_log_request).
 */
export function rpcResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

/**
 * Creates a minimal unsigned JWT token with the given payload claims.
 * This is NOT cryptographically signed — it's a test-only JWT whose
 * signature part is a placeholder.
 *
 * Useful for testing authorize() paths that call getClaims() which
 * performs local JWT decoding.
 */
export function createTestJwt(claims: Record<string, unknown> = {}): string {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: "test-user-id-00000000-0000-0000-0000-000000000001",
    iss: "supabase",
    role: "authenticated",
    exp: 9999999999,
    iat: 1700000000,
    ...claims,
  };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  // Use a dummy signature — getClaims may or may not verify it
  return `${encode(header)}.${encode(payload)}.test-signature`;
}

// ─── Response Assertion Helpers ──────────────────────────────────────────────

/**
 * Parses a Response body as JSON. Useful in test assertions.
 */
export async function responseBody<T = unknown>(
  response: Response,
): Promise<T> {
  return (await response.json()) as T;
}

/**
 * Asserts that the response has the expected status and optionally
 * checks for a JSON body field. Returns the parsed body for further assertions.
 */
export async function assertResponse<T = unknown>(
  response: Response,
  expectedStatus: number,
): Promise<T> {
  if (response.status !== expectedStatus) {
    const body = await response.text();
    throw new Error(
      `Expected status ${expectedStatus}, got ${response.status}. Body: ${body}`,
    );
  }
  const text = await response.clone().text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ─── Supabase PostgREST URL Matchers ─────────────────────────────────────────

/**
 * Helper that builds common Supabase REST URL patterns for use in fetch mock routes.
 */
export const supabaseUrls = {
  /** Matches requests to a specific table via PostgREST */
  table: (tableName: string) => `/rest/v1/${tableName}`,

  /** Matches RPC calls */
  rpc: (functionName: string) => `/rest/v1/rpc/${functionName}`,

  /** Matches auth endpoints */
  auth: (path: string) => `/auth/v1/${path}`,
};

// ─── Test Data Factories ─────────────────────────────────────────────────────

/**
 * Creates a mock league row matching the poe_leagues table schema.
 */
export function mockLeague(overrides: Record<string, unknown> = {}) {
  return {
    id: "league-uuid-001",
    game: "poe2",
    league_id: "Dawn",
    name: "Dawn",
    start_at: "2024-12-01T00:00:00Z",
    end_at: null,
    is_active: true,
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2024-12-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Creates a mock snapshot row matching the snapshots table schema.
 */
export function mockSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: "snapshot-uuid-001",
    league_id: "league-uuid-001",
    fetched_at: "2024-12-15T12:00:00Z",
    exchange_chaos_to_divine: 150,
    stash_chaos_to_divine: 148,
    stacked_deck_chaos_cost: 1.5,
    created_at: "2024-12-15T12:00:00Z",
    ...overrides,
  };
}

/**
 * Creates mock card_prices rows.
 */
export function mockCardPrices(
  snapshotId = "snapshot-uuid-001",
): Array<Record<string, unknown>> {
  return [
    {
      card_name: "The Doctor",
      price_source: "exchange",
      chaos_value: 1200,
      divine_value: 8.0,
      confidence: 1,
      snapshot_id: snapshotId,
    },
    {
      card_name: "House of Mirrors",
      price_source: "exchange",
      chaos_value: 3000,
      divine_value: 20.0,
      confidence: 1,
      snapshot_id: snapshotId,
    },
    {
      card_name: "The Doctor",
      price_source: "stash",
      chaos_value: 1180,
      divine_value: 7.9,
      confidence: 2,
      snapshot_id: snapshotId,
    },
    {
      card_name: "Rain of Chaos",
      price_source: "stash",
      chaos_value: 0.5,
      divine_value: 0.0,
      confidence: 3,
      snapshot_id: snapshotId,
    },
  ];
}

// ─── PostgREST Query String Helpers ──────────────────────────────────────────

/**
 * Parses PostgREST query parameters from a URL to help assert
 * that the correct filters were applied.
 */
export function parsePostgrestParams(url: string): Record<string, string> {
  const parsed = new URL(url);
  const params: Record<string, string> = {};
  for (const [key, value] of parsed.searchParams.entries()) {
    params[key] = value;
  }
  return params;
}
