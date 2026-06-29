/**
 * Unit tests for supabase/functions/get-community-drop-rates/index.ts
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/get-community-drop-rates_test.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  mockFetch,
  postgrestResponse,
  quietTest,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

const _initCleanup = setupEnv({
  WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
});
const serveStub = stubDenoServe();

await import("../get-community-drop-rates/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

function createFunctionRequest(game = "poe1"): Request {
  return new Request(
    `http://localhost:54321/functions/v1/get-community-drop-rates?game=${game}`,
    {
      method: "GET",
      headers: {
        "x-api-key": "test-wraeclast-key",
      },
    },
  );
}

type DropRateUpload = {
  id: string;
  league_id: string;
  device_id: string;
  ggg_uuid: string | null;
  is_verified: boolean;
};

type DropRateCardData = {
  upload_id: string;
  card_id: string;
  count: number;
};

type DropRateCard = {
  id: string;
  name: string;
};

function setupDropRateMocks(
  fetchMock: ReturnType<typeof mockFetch>,
  {
    uploads,
    cardData,
    cards,
  }: {
    uploads: DropRateUpload[];
    cardData: DropRateCardData[];
    cards: DropRateCard[];
  },
): void {
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse([{ id: "league-1", name: "Mirage" }]),
  );

  fetchMock.onUrlContaining(supabaseUrls.table("community_uploads"), () =>
    postgrestResponse(uploads),
  );

  fetchMock.onUrlContaining(supabaseUrls.table("community_card_data"), () =>
    postgrestResponse(cardData),
  );

  fetchMock.onUrlContaining(supabaseUrls.table("cards"), () =>
    postgrestResponse(cards),
  );
}

quietTest(
  "get-community-drop-rates — includes verified_ratio per league card",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-verified",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: "ggg-a",
          is_verified: true,
        },
        {
          id: "upload-anon",
          league_id: "league-1",
          device_id: "device-b",
          ggg_uuid: null,
          is_verified: false,
        },
      ],
      cardData: [
        { upload_id: "upload-verified", card_id: "card-doctor", count: 30 },
        { upload_id: "upload-verified", card_id: "card-rain", count: 70 },
        { upload_id: "upload-anon", card_id: "card-doctor", count: 70 },
        { upload_id: "upload-anon", card_id: "card-rain", count: 30 },
      ],
      cards: [
        { id: "card-doctor", name: "The Doctor" },
        { id: "card-rain", name: "Rain of Chaos" },
      ],
    });

    try {
      const resp = await handler(createFunctionRequest());

      assertEquals(resp.status, 200);
      assertEquals(await resp.json(), {
        game: "poe1",
        leagues: [{ id: "league-1", name: "Mirage" }],
        cards: [
          {
            name: "Rain of Chaos",
            leagues: {
              "league-1": {
                count: 100,
                ratio: 0.5,
                contributors: 2,
                verified_count: 70,
                verified_ratio: 0.7,
                verified_contributors: 1,
              },
            },
          },
          {
            name: "The Doctor",
            leagues: {
              "league-1": {
                count: 100,
                ratio: 0.5,
                contributors: 2,
                verified_count: 30,
                verified_ratio: 0.3,
                verified_contributors: 1,
              },
            },
          },
        ],
      });
    } finally {
      fetchMock.restore();
      cleanupEnv();
    }
  },
);

quietTest(
  "get-community-drop-rates — returns zero verified_ratio without verified drops",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-anon",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: null,
          is_verified: false,
        },
      ],
      cardData: [
        { upload_id: "upload-anon", card_id: "card-doctor", count: 25 },
        { upload_id: "upload-anon", card_id: "card-rain", count: 75 },
      ],
      cards: [
        { id: "card-doctor", name: "The Doctor" },
        { id: "card-rain", name: "Rain of Chaos" },
      ],
    });

    try {
      const resp = await handler(createFunctionRequest());

      assertEquals(resp.status, 200);
      assertEquals(await resp.json(), {
        game: "poe1",
        leagues: [{ id: "league-1", name: "Mirage" }],
        cards: [
          {
            name: "Rain of Chaos",
            leagues: {
              "league-1": {
                count: 75,
                ratio: 0.75,
                contributors: 1,
                verified_count: 0,
                verified_ratio: 0,
                verified_contributors: 0,
              },
            },
          },
          {
            name: "The Doctor",
            leagues: {
              "league-1": {
                count: 25,
                ratio: 0.25,
                contributors: 1,
                verified_count: 0,
                verified_ratio: 0,
                verified_contributors: 0,
              },
            },
          },
        ],
      });
    } finally {
      fetchMock.restore();
      cleanupEnv();
    }
  },
);
