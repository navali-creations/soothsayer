import { assertEquals } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  mockFetch,
  quietTest,
  setupEnv,
  stubDenoServe,
} from "./_test-helpers.ts";

const cleanup = setupEnv();
const serve = stubDenoServe();
await import("../upload-community-data/index.ts");
const handler = serve.handler!;
serve.restore();
for (const body of [
  {},
  { action: "link-ggg", device_id: "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee" },
  { cards: [] },
]) {
  quietTest(
    "legacy upload endpoint rejects all writes without contacting services",
    async () => {
      const fetch = mockFetch();
      try {
        const response = await handler(
          createMockRequest("http://localhost/upload-community-data", {
            method: "POST",
            body,
          }),
        );
        assertEquals(response.status, 410);
        assertEquals(fetch.calls.length, 0);
      } finally {
        fetch.restore();
      }
    },
  );
}
quietTest("legacy upload endpoint retains CORS preflight", async () => {
  assertEquals((await handler(createOptionsRequest())).status, 200);
});
Deno.test("legacy endpoint environment cleanup", () => cleanup());
