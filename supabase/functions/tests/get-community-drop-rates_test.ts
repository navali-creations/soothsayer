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

function createFunctionRequest(game = "poe1", extraSearch = ""): Request {
  const suffix = extraSearch ? `&${extraSearch}` : "";
  return new Request(
    `http://localhost:54321/functions/v1/get-community-drop-rates?game=${game}${suffix}`,
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
  is_suspicious: boolean;
  total_cards_uploaded: number;
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

function getRequestHeader(init: RequestInit | undefined, name: string) {
  const headers = init?.headers;
  if (!headers) return null;

  const lowerName = name.toLowerCase();
  if (headers instanceof Headers) {
    return headers.get(name);
  }

  if (Array.isArray(headers)) {
    return (
      headers.find(([key]) => key.toLowerCase() === lowerName)?.[1] ?? null
    );
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return String(value);
    }
  }

  return null;
}

function getRequestUrl(input: string | URL | Request) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function getRangeBounds(
  input: string | URL | Request,
  init: RequestInit | undefined,
  fallbackEnd: number,
) {
  const url = new URL(getRequestUrl(input));
  const offset = url.searchParams.get("offset");
  const limit = url.searchParams.get("limit");

  if (offset !== null && limit !== null) {
    const start = Number(offset);
    return [start, start + Number(limit) - 1] as const;
  }

  const rangeHeader = getRequestHeader(init, "range");
  const rangeMatch = rangeHeader?.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    return [Number(rangeMatch[1]), Number(rangeMatch[2])] as const;
  }

  return [0, fallbackEnd] as const;
}

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

  fetchMock.onUrlContaining(
    supabaseUrls.table("community_card_data"),
    (input, init) => {
      const [start, end] = getRangeBounds(input, init, cardData.length - 1);
      const page = cardData.slice(start, end + 1);
      const pageEnd = page.length > 0 ? start + page.length - 1 : start;

      return postgrestResponse(page, 200, {
        "Content-Range": `${start}-${pageEnd}/${cardData.length}`,
      });
    },
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
          is_suspicious: false,
          total_cards_uploaded: 100,
        },
        {
          id: "upload-anon",
          league_id: "league-1",
          device_id: "device-b",
          ggg_uuid: null,
          is_verified: false,
          is_suspicious: false,
          total_cards_uploaded: 100,
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
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 2,
            observed_total: 200,
            card_observed_total: 200,
            contributors: 2,
            verified_observed_total: 100,
            verified_card_observed_total: 100,
            verified_contributors: 1,
            excluded_suspicious_upload_count: 0,
            excluded_suspicious_observed_total: 0,
            unresolved_card_row_count: 0,
            unresolved_card_observed_total: 0,
          },
        ],
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

      const cardsRequest = fetchMock.calls.find(({ url }) =>
        url.includes(supabaseUrls.table("cards")),
      );
      assert(cardsRequest?.url.includes("id=in."));
      assert(!cardsRequest?.url.includes("game=eq."));
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
          is_suspicious: false,
          total_cards_uploaded: 100,
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
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 1,
            observed_total: 100,
            card_observed_total: 100,
            contributors: 1,
            verified_observed_total: 0,
            verified_card_observed_total: 0,
            verified_contributors: 0,
            excluded_suspicious_upload_count: 0,
            excluded_suspicious_observed_total: 0,
            unresolved_card_row_count: 0,
            unresolved_card_observed_total: 0,
          },
        ],
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

quietTest(
  "get-community-drop-rates — paginates community card data at Supabase row cap",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-large",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: null,
          is_verified: false,
          is_suspicious: false,
          total_cards_uploaded: 1001,
        },
      ],
      cardData: Array.from({ length: 1001 }, () => ({
        upload_id: "upload-large",
        card_id: "card-doctor",
        count: 1,
      })),
      cards: [{ id: "card-doctor", name: "The Doctor" }],
    });

    try {
      const resp = await handler(createFunctionRequest());

      assertEquals(resp.status, 200);
      assertEquals(await resp.json(), {
        game: "poe1",
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 1,
            observed_total: 1001,
            card_observed_total: 1001,
            contributors: 1,
            verified_observed_total: 0,
            verified_card_observed_total: 0,
            verified_contributors: 0,
            excluded_suspicious_upload_count: 0,
            excluded_suspicious_observed_total: 0,
            unresolved_card_row_count: 0,
            unresolved_card_observed_total: 0,
          },
        ],
        cards: [
          {
            name: "The Doctor",
            leagues: {
              "league-1": {
                count: 1001,
                ratio: 1,
                contributors: 1,
                verified_count: 0,
                verified_ratio: 0,
                verified_contributors: 0,
              },
            },
          },
        ],
      });

      const cardDataRequests = fetchMock.calls.filter(({ url }) =>
        url.includes(supabaseUrls.table("community_card_data")),
      );
      assertEquals(cardDataRequests.length, 2);
    } finally {
      fetchMock.restore();
      cleanupEnv();
    }
  },
);

quietTest(
  "get-community-drop-rates — includes suspicious uploads by default and can exclude them explicitly",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-normal",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: null,
          is_verified: false,
          is_suspicious: false,
          total_cards_uploaded: 100,
        },
        {
          id: "upload-suspicious",
          league_id: "league-1",
          device_id: "device-b",
          ggg_uuid: "ggg-b",
          is_verified: true,
          is_suspicious: true,
          total_cards_uploaded: 900,
        },
      ],
      cardData: [
        { upload_id: "upload-normal", card_id: "card-doctor", count: 40 },
        { upload_id: "upload-normal", card_id: "card-rain", count: 60 },
        { upload_id: "upload-suspicious", card_id: "card-doctor", count: 360 },
        { upload_id: "upload-suspicious", card_id: "card-rain", count: 540 },
      ],
      cards: [
        { id: "card-doctor", name: "The Doctor" },
        { id: "card-rain", name: "Rain of Chaos" },
      ],
    });

    try {
      const defaultResp = await handler(createFunctionRequest());

      assertEquals(defaultResp.status, 200);
      assertEquals(await defaultResp.json(), {
        game: "poe1",
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 2,
            observed_total: 1000,
            card_observed_total: 1000,
            contributors: 2,
            verified_observed_total: 900,
            verified_card_observed_total: 900,
            verified_contributors: 1,
            excluded_suspicious_upload_count: 0,
            excluded_suspicious_observed_total: 0,
            unresolved_card_row_count: 0,
            unresolved_card_observed_total: 0,
          },
        ],
        cards: [
          {
            name: "Rain of Chaos",
            leagues: {
              "league-1": {
                count: 600,
                ratio: 0.6,
                contributors: 2,
                verified_count: 540,
                verified_ratio: 0.6,
                verified_contributors: 1,
              },
            },
          },
          {
            name: "The Doctor",
            leagues: {
              "league-1": {
                count: 400,
                ratio: 0.4,
                contributors: 2,
                verified_count: 360,
                verified_ratio: 0.4,
                verified_contributors: 1,
              },
            },
          },
        ],
      });

      const excludeSuspiciousResp = await handler(
        createFunctionRequest("poe1", "exclude_suspicious=true"),
      );

      assertEquals(excludeSuspiciousResp.status, 200);
      assertEquals(await excludeSuspiciousResp.json(), {
        game: "poe1",
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 1,
            observed_total: 100,
            card_observed_total: 100,
            contributors: 1,
            verified_observed_total: 0,
            verified_card_observed_total: 0,
            verified_contributors: 0,
            excluded_suspicious_upload_count: 1,
            excluded_suspicious_observed_total: 900,
            unresolved_card_row_count: 0,
            unresolved_card_observed_total: 0,
          },
        ],
        cards: [
          {
            name: "Rain of Chaos",
            leagues: {
              "league-1": {
                count: 60,
                ratio: 0.6,
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
                count: 40,
                ratio: 0.4,
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

quietTest(
  "get-community-drop-rates — exposes upload and card-observed totals separately",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-stale-summary",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: "ggg-a",
          is_verified: true,
          is_suspicious: false,
          total_cards_uploaded: 4_000_000,
        },
      ],
      cardData: [
        {
          upload_id: "upload-stale-summary",
          card_id: "card-doctor",
          count: 40,
        },
        { upload_id: "upload-stale-summary", card_id: "card-rain", count: 60 },
        {
          upload_id: "upload-stale-summary",
          card_id: "card-missing",
          count: 50,
        },
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
        leagues: [
          {
            id: "league-1",
            name: "Mirage",
            upload_count: 1,
            observed_total: 4_000_000,
            card_observed_total: 150,
            contributors: 1,
            verified_observed_total: 4_000_000,
            verified_card_observed_total: 150,
            verified_contributors: 1,
            excluded_suspicious_upload_count: 0,
            excluded_suspicious_observed_total: 0,
            unresolved_card_row_count: 1,
            unresolved_card_observed_total: 50,
          },
        ],
        cards: [
          {
            name: "Rain of Chaos",
            leagues: {
              "league-1": {
                count: 60,
                ratio: 0.4,
                contributors: 1,
                verified_count: 60,
                verified_ratio: 0.4,
                verified_contributors: 1,
              },
            },
          },
          {
            name: "The Doctor",
            leagues: {
              "league-1": {
                count: 40,
                ratio: 0.266667,
                contributors: 1,
                verified_count: 40,
                verified_ratio: 0.266667,
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
