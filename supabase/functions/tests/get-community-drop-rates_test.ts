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

type DropRateLeagueEstimate = {
  league_id: string;
  aggregate_scope: "all" | "non_suspicious";
  upload_count: number;
  observed_total: number;
  card_observed_total: number;
  contributors: number;
  verified_observed_total: number;
  verified_card_observed_total: number;
  verified_contributors: number;
  excluded_suspicious_upload_count: number;
  excluded_suspicious_observed_total: number;
  unresolved_card_row_count: number;
  unresolved_card_observed_total: number;
};

type DropRateCardEstimate = {
  league_id: string;
  aggregate_scope: "all" | "non_suspicious";
  card_id: string;
  count: number;
  ratio: number;
  contributors: number;
  verified_count: number;
  verified_ratio: number;
  verified_contributors: number;
  community_estimated_weight: number | null;
  community_estimated_chance: number | null;
  seen_vs_community_estimate: number | null;
  verified_community_estimated_weight: number | null;
  verified_community_estimated_chance: number | null;
  verified_seen_vs_community_estimate: number | null;
};

type DropRateResponseCardStats = Record<string, unknown>;

type DropRateResponseCard = {
  leagues: Record<string, DropRateResponseCardStats>;
  [key: string]: unknown;
};

type DropRateResponseBody = {
  cards: DropRateResponseCard[];
  [key: string]: unknown;
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

function roundRatio(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(12));
}

function roundWeight(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  return Number(value.toFixed(3));
}

function getAggregateScope(input: string | URL | Request) {
  const url = new URL(getRequestUrl(input));
  const scope = url.searchParams.get("aggregate_scope");
  return scope === "eq.non_suspicious" ? "non_suspicious" : "all";
}

function buildPersistedAggregateMocks({
  uploads,
  cardData,
  cards,
}: {
  uploads: DropRateUpload[];
  cardData: DropRateCardData[];
  cards: DropRateCard[];
}): {
  leagueEstimates: DropRateLeagueEstimate[];
  cardEstimates: DropRateCardEstimate[];
} {
  const scopes = ["all", "non_suspicious"] as const;
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const leagueEstimates: DropRateLeagueEstimate[] = [];
  const cardEstimates: DropRateCardEstimate[] = [];

  for (const aggregate_scope of scopes) {
    const includedUploads =
      aggregate_scope === "non_suspicious"
        ? uploads.filter((upload) => !upload.is_suspicious)
        : uploads;
    const uploadById = new Map(
      includedUploads.map((upload) => [upload.id, upload]),
    );
    const includedCardData = cardData.filter((row) =>
      uploadById.has(row.upload_id),
    );
    const contributors = new Set(
      includedUploads.map((upload) => upload.device_id),
    );
    const verifiedContributors = new Set(
      includedUploads
        .filter((upload) => upload.is_verified && upload.ggg_uuid)
        .map((upload) => upload.ggg_uuid as string),
    );
    const suspiciousUploads = uploads.filter((upload) => upload.is_suspicious);
    const cardObservedTotal = includedCardData.reduce(
      (sum, row) => sum + row.count,
      0,
    );
    const verifiedCardObservedTotal = includedCardData.reduce((sum, row) => {
      const upload = uploadById.get(row.upload_id);
      return sum + (upload?.is_verified ? row.count : 0);
    }, 0);

    leagueEstimates.push({
      league_id: "league-1",
      aggregate_scope,
      upload_count: includedUploads.length,
      observed_total: includedUploads.reduce(
        (sum, upload) => sum + upload.total_cards_uploaded,
        0,
      ),
      card_observed_total: cardObservedTotal,
      contributors: contributors.size,
      verified_observed_total: includedUploads.reduce(
        (sum, upload) =>
          sum + (upload.is_verified ? upload.total_cards_uploaded : 0),
        0,
      ),
      verified_card_observed_total: verifiedCardObservedTotal,
      verified_contributors: verifiedContributors.size,
      excluded_suspicious_upload_count:
        aggregate_scope === "non_suspicious" ? suspiciousUploads.length : 0,
      excluded_suspicious_observed_total:
        aggregate_scope === "non_suspicious"
          ? suspiciousUploads.reduce(
              (sum, upload) => sum + upload.total_cards_uploaded,
              0,
            )
          : 0,
      unresolved_card_row_count: 0,
      unresolved_card_observed_total: 0,
    });

    const grouped = new Map<
      string,
      {
        count: number;
        contributors: Set<string>;
        verified_count: number;
        verified_contributors: Set<string>;
      }
    >();

    for (const row of includedCardData) {
      const upload = uploadById.get(row.upload_id);
      if (!upload) continue;

      if (!grouped.has(row.card_id)) {
        grouped.set(row.card_id, {
          count: 0,
          contributors: new Set(),
          verified_count: 0,
          verified_contributors: new Set(),
        });
      }

      const stats = grouped.get(row.card_id)!;
      stats.count += row.count;
      stats.contributors.add(upload.device_id);

      if (upload.is_verified) {
        stats.verified_count += row.count;
        if (upload.ggg_uuid) {
          stats.verified_contributors.add(upload.ggg_uuid);
        }
      }
    }

    const anchor = [...grouped.entries()].find(
      ([cardId]) => cardById.get(cardId)?.name === "Rain of Chaos",
    )?.[1];
    const scale =
      anchor && anchor.count > 0 ? anchor.count ** 1.5 / 121400 : null;
    const verifiedScale =
      anchor && anchor.verified_count > 0
        ? anchor.verified_count ** 1.5 / 121400
        : null;

    const weighted = [...grouped.entries()].map(([card_id, stats]) => {
      const community_estimated_weight = scale
        ? roundWeight(stats.count ** 1.5 / scale)
        : null;
      const verified_community_estimated_weight =
        verifiedScale && stats.verified_count > 0
          ? roundWeight(stats.verified_count ** 1.5 / verifiedScale)
          : null;

      return {
        card_id,
        stats,
        community_estimated_weight,
        verified_community_estimated_weight,
      };
    });

    const weightTotal = weighted.reduce(
      (sum, row) => sum + (row.community_estimated_weight ?? 0),
      0,
    );
    const verifiedWeightTotal = weighted.reduce(
      (sum, row) => sum + (row.verified_community_estimated_weight ?? 0),
      0,
    );

    for (const row of weighted) {
      const ratio =
        cardObservedTotal > 0
          ? Number((row.stats.count / cardObservedTotal).toFixed(6))
          : 0;
      const verified_ratio =
        verifiedCardObservedTotal > 0
          ? Number(
              (row.stats.verified_count / verifiedCardObservedTotal).toFixed(6),
            )
          : 0;
      const community_estimated_chance =
        row.community_estimated_weight !== null && weightTotal > 0
          ? roundRatio(row.community_estimated_weight / weightTotal)
          : null;
      const verified_community_estimated_chance =
        row.verified_community_estimated_weight !== null &&
        verifiedWeightTotal > 0
          ? roundRatio(
              row.verified_community_estimated_weight / verifiedWeightTotal,
            )
          : null;

      cardEstimates.push({
        league_id: "league-1",
        aggregate_scope,
        card_id: row.card_id,
        count: row.stats.count,
        ratio,
        contributors: row.stats.contributors.size,
        verified_count: row.stats.verified_count,
        verified_ratio,
        verified_contributors: row.stats.verified_contributors.size,
        community_estimated_weight: row.community_estimated_weight,
        community_estimated_chance,
        seen_vs_community_estimate:
          community_estimated_chance !== null && community_estimated_chance > 0
            ? roundRatio(ratio / community_estimated_chance)
            : null,
        verified_community_estimated_weight:
          row.verified_community_estimated_weight,
        verified_community_estimated_chance,
        verified_seen_vs_community_estimate:
          verified_community_estimated_chance !== null &&
          verified_community_estimated_chance > 0 &&
          row.stats.verified_count > 0
            ? roundRatio(verified_ratio / verified_community_estimated_chance)
            : null,
      });
    }
  }

  return { leagueEstimates, cardEstimates };
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

  const { leagueEstimates, cardEstimates } = buildPersistedAggregateMocks({
    uploads,
    cardData,
    cards,
  });

  fetchMock.onUrlContaining(
    supabaseUrls.table("community_league_estimates"),
    (input) => {
      const scope = getAggregateScope(input);
      return postgrestResponse(
        leagueEstimates.filter((row) => row.aggregate_scope === scope),
      );
    },
  );

  fetchMock.onUrlContaining(
    supabaseUrls.table("community_league_card_estimates"),
    (input, init) => {
      const scope = getAggregateScope(input);
      const scopedRows = cardEstimates.filter(
        (row) => row.aggregate_scope === scope,
      );
      const [start, end] = getRangeBounds(input, init, scopedRows.length - 1);
      const page = scopedRows.slice(start, end + 1);
      const pageEnd = page.length > 0 ? start + page.length - 1 : start;

      return postgrestResponse(page, 200, {
        "Content-Range": `${start}-${pageEnd}/${scopedRows.length}`,
      });
    },
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

  fetchMock.onUrlContaining(supabaseUrls.table("cards"), (input, init) => {
    const [start, end] = getRangeBounds(input, init, cards.length - 1);
    const page = cards.slice(start, end + 1);
    const pageEnd = page.length > 0 ? start + page.length - 1 : start;

    return postgrestResponse(page, 200, {
      "Content-Range": `${start}-${pageEnd}/${cards.length}`,
    });
  });
}

function stripCommunityEstimateFields(body: DropRateResponseBody): unknown {
  return {
    ...body,
    cards: body.cards.map((card) => ({
      ...card,
      leagues: Object.fromEntries(
        Object.entries(card.leagues).map(([leagueId, stats]) => {
          const {
            community_estimated_weight: _communityEstimatedWeight,
            community_estimated_chance: _communityEstimatedChance,
            seen_vs_community_estimate: _seenVsCommunityEstimate,
            verified_community_estimated_weight:
              _verifiedCommunityEstimatedWeight,
            verified_community_estimated_chance:
              _verifiedCommunityEstimatedChance,
            verified_seen_vs_community_estimate:
              _verifiedSeenVsCommunityEstimate,
            ...rest
          } = stats as Record<string, unknown>;
          return [leagueId, rest];
        }),
      ),
    })),
  };
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
      assertEquals(stripCommunityEstimateFields(await resp.json()), {
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
      assert(cardsRequest?.url.includes("game=eq.poe1"));
      assert(!cardsRequest?.url.includes("id=in."));
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
      assertEquals(stripCommunityEstimateFields(await resp.json()), {
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
  "get-community-drop-rates — includes Rain-anchored community estimates per league card",
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
          total_cards_uploaded: 125,
        },
      ],
      cardData: [
        { upload_id: "upload-verified", card_id: "card-rain", count: 100 },
        { upload_id: "upload-verified", card_id: "card-doctor", count: 25 },
      ],
      cards: [
        { id: "card-doctor", name: "The Doctor" },
        { id: "card-rain", name: "Rain of Chaos" },
      ],
    });

    try {
      const resp = await handler(createFunctionRequest());
      const body = await resp.json();

      assertEquals(resp.status, 200);
      assertEquals(body.cards, [
        {
          name: "Rain of Chaos",
          leagues: {
            "league-1": {
              count: 100,
              ratio: 0.8,
              contributors: 1,
              verified_count: 100,
              verified_ratio: 0.8,
              verified_contributors: 1,
              community_estimated_weight: 121400,
              community_estimated_chance: 0.888888888889,
              seen_vs_community_estimate: 0.9,
              verified_community_estimated_weight: 121400,
              verified_community_estimated_chance: 0.888888888889,
              verified_seen_vs_community_estimate: 0.9,
            },
          },
        },
        {
          name: "The Doctor",
          leagues: {
            "league-1": {
              count: 25,
              ratio: 0.2,
              contributors: 1,
              verified_count: 25,
              verified_ratio: 0.2,
              verified_contributors: 1,
              community_estimated_weight: 15175,
              community_estimated_chance: 0.111111111111,
              seen_vs_community_estimate: 1.800000000002,
              verified_community_estimated_weight: 15175,
              verified_community_estimated_chance: 0.111111111111,
              verified_seen_vs_community_estimate: 1.800000000002,
            },
          },
        },
      ]);
    } finally {
      fetchMock.restore();
      cleanupEnv();
    }
  },
);

quietTest(
  "get-community-drop-rates — paginates persisted community card aggregates at Supabase row cap",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();
    const cards = Array.from({ length: 1001 }, (_, index) => ({
      id: `card-large-${index.toString().padStart(4, "0")}`,
      name: `Large Card ${index.toString().padStart(4, "0")}`,
    }));

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
      cardData: cards.map((card) => ({
        upload_id: "upload-large",
        card_id: card.id,
        count: 1,
      })),
      cards,
    });

    try {
      const resp = await handler(createFunctionRequest());
      const body = await resp.json();

      assertEquals(resp.status, 200);
      assertEquals(body.leagues[0].card_observed_total, 1001);
      assertEquals(body.cards.length, 1001);

      const cardAggregateRequests = fetchMock.calls.filter(({ url }) =>
        url.includes(supabaseUrls.table("community_league_card_estimates")),
      );
      assertEquals(cardAggregateRequests.length, 2);
      assertEquals(
        fetchMock.calls.filter(({ url }) =>
          url.includes(supabaseUrls.table("community_card_data")),
        ).length,
        0,
      );
    } finally {
      fetchMock.restore();
      cleanupEnv();
    }
  },
);

quietTest(
  "get-community-drop-rates — paginates game card lookups without id filters",
  async () => {
    const cleanupEnv = setupEnv({
      WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
    });
    const fetchMock = mockFetch();
    const cards = Array.from({ length: 1001 }, (_, index) => ({
      id: `card-${index.toString().padStart(3, "0")}`,
      name: `Card ${index.toString().padStart(3, "0")}`,
    }));

    setupDropRateMocks(fetchMock, {
      uploads: [
        {
          id: "upload-many-cards",
          league_id: "league-1",
          device_id: "device-a",
          ggg_uuid: null,
          is_verified: false,
          is_suspicious: false,
          total_cards_uploaded: cards.length,
        },
      ],
      cardData: cards.map((card) => ({
        upload_id: "upload-many-cards",
        card_id: card.id,
        count: 1,
      })),
      cards,
    });

    try {
      const resp = await handler(createFunctionRequest());
      const body = await resp.json();

      assertEquals(resp.status, 200);
      assertEquals(body.leagues[0].card_observed_total, 1001);
      assertEquals(body.cards.length, 1001);

      const cardRequests = fetchMock.calls.filter(({ url }) =>
        url.includes(supabaseUrls.table("cards")),
      );
      assertEquals(cardRequests.length, 2);
      assert(
        cardRequests.every(
          ({ url }) => url.includes("game=eq.poe1") && !url.includes("id=in."),
        ),
      );
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
      assertEquals(stripCommunityEstimateFields(await defaultResp.json()), {
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
      assertEquals(
        stripCommunityEstimateFields(await excludeSuspiciousResp.json()),
        {
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
        },
      );
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
      assertEquals(stripCommunityEstimateFields(await resp.json()), {
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
