import { assertEquals } from "jsr:@std/assert@1";
import {
  createInternalRequest,
  createMockRequest,
  mockFetch,
  setupEnv,
  stubDenoServe,
} from "./_test-helpers.ts";

// ── Module-level setup (same as the real test files) ─────────────────────────

const _cleanupEnv = setupEnv();
const serveStub = stubDenoServe();
await import("../create-snapshot-internal/index.ts");
const handler = serveStub.handler!;
serveStub.restore();

// ── Diagnostic tests ─────────────────────────────────────────────────────────

Deno.test("DEBUG — env is set at test time", () => {
  const val = Deno.env.get("INTERNAL_CRON_SECRET");
  console.log("  INTERNAL_CRON_SECRET =", JSON.stringify(val));
  assertEquals(val, "test-cron-secret");
});

Deno.test("DEBUG — missing cron secret returns 401", async () => {
  const fm = mockFetch();

  const req = createMockRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    { method: "POST", body: { game: "poe1", leagueId: "Dawn" } },
  );

  console.log(
    "  x-cron-secret:",
    JSON.stringify(req.headers.get("x-cron-secret")),
  );
  console.log("  ENV:", JSON.stringify(Deno.env.get("INTERNAL_CRON_SECRET")));

  const resp = await handler(req);
  console.log("  status:", resp.status);

  assertEquals(resp.status, 401);

  fm.restore();
});

Deno.test("DEBUG — correct cron secret passes", async () => {
  const fm = mockFetch();

  // Catch-all mock
  fm.addRoute({
    match: () => true,
    handler: (input) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      console.log("  [fetch]", url);
      return new Response(JSON.stringify({ id: "mock-id", name: "Dawn" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    },
  });

  const req = createInternalRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    { game: "poe1", leagueId: "Dawn" },
    "test-cron-secret",
  );

  console.log(
    "  x-cron-secret:",
    JSON.stringify(req.headers.get("x-cron-secret")),
  );
  console.log("  ENV:", JSON.stringify(Deno.env.get("INTERNAL_CRON_SECRET")));

  const resp = await handler(req);
  console.log("  status:", resp.status);
  const body = await resp.json();
  console.log("  body:", JSON.stringify(body));

  // The handler should get past the cron secret check (not 401)
  if (resp.status === 401) {
    console.error("  BUG: Got 401 even though secret matches!");
  }

  fm.restore();
});

Deno.test("DEBUG — GET with correct secret returns 405", async () => {
  const fm = mockFetch();

  const req = createMockRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    { method: "GET", cronSecret: "test-cron-secret" },
  );

  console.log("  method:", req.method);
  console.log(
    "  x-cron-secret:",
    JSON.stringify(req.headers.get("x-cron-secret")),
  );
  console.log("  ENV:", JSON.stringify(Deno.env.get("INTERNAL_CRON_SECRET")));

  const resp = await handler(req);
  console.log("  status:", resp.status);

  fm.restore();
});
