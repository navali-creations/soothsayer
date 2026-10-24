import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch, mockLoggerWarn } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock("~/main/modules/logger", () => ({
  LoggerService: {
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      warn: mockLoggerWarn,
    })),
  },
}));

vi.stubGlobal("fetch", mockFetch);

import { CommunityDropRatesService } from "../CommunityDropRates.service";

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function makeIndexResponse() {
  return { leagues: [{ id: "mirage", name: "Mirage" }] };
}

function makeLeagueResponse(overrides: Record<string, unknown> = {}) {
  return {
    league: { name: "Mirage", observed_total: 4_207_137 },
    cards: [
      {
        name: "A Chilling Wind",
        count: 2475,
        ratio: 0.00058829,
        reference_weight: 25,
        reference_estimated_chance: 0.00020589,
      },
      {
        name: "The Doctor",
        count: 42,
        ratio: 0.00000998,
        reference_weight: 10_000,
        reference_estimated_chance: 0.08235536,
      },
    ],
    ...overrides,
  };
}

function mockPublishedLeague(
  leagueResponse: Record<string, unknown> = makeLeagueResponse(),
): void {
  mockFetch
    .mockResolvedValueOnce(jsonResponse(makeIndexResponse()))
    .mockResolvedValueOnce(jsonResponse(leagueResponse));
}

describe("CommunityDropRatesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the published reference-weighted drop estimate", async () => {
    mockPublishedLeague();
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toEqual({
      league: "Mirage",
      referenceDropChance: 0.00020589,
      dropCount: 2475,
      referenceWeight: 25,
      sampleSize: 4_207_137,
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://wraeclast.cards/data/drop-rates/poe1/index.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://wraeclast.cards/data/drop-rates/poe1/mirage.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("deduplicates concurrent requests and reuses the positive cache", async () => {
    mockPublishedLeague();
    const service = new CommunityDropRatesService();

    const [first, second] = await Promise.all([
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
      service.getCardRate("poe1", "Mirage", "The Doctor"),
    ]);
    const third = await service.getCardRate("poe1", "Mirage", "Missing Card");

    expect(first?.dropCount).toBe(2475);
    expect(second?.dropCount).toBe(42);
    expect(first?.referenceDropChance).toBe(0.00020589);
    expect(second?.referenceDropChance).toBe(0.08235536);
    expect(third).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("negatively caches unpublished leagues", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(makeIndexResponse()));
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Standard", "A Chilling Wind"),
    ).resolves.toBeNull();
    await expect(
      service.getCardRate("poe1", "Standard", "The Doctor"),
    ).resolves.toBeNull();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes an expired cached league", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      mockPublishedLeague();
      const service = new CommunityDropRatesService();

      await service.getCardRate("poe1", "Mirage", "A Chilling Wind");

      vi.advanceTimersByTime(60 * 60 * 1000 + 1);
      mockPublishedLeague();
      await service.getCardRate("poe1", "Mirage", "A Chilling Wind");

      expect(mockFetch).toHaveBeenCalledTimes(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ["fractional sample", { name: "Mirage", observed_total: 1.5 }],
    ["negative sample", { name: "Mirage", observed_total: -1 }],
    ["wrong league", { name: "Standard", observed_total: 100 }],
  ])("rejects invalid league metadata: %s", async (_name, league) => {
    mockPublishedLeague(makeLeagueResponse({ league }));
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it.each([
    ["count above sample", 101],
    ["fractional count", 1.5],
    ["negative count", -1],
  ])("ignores cards with an invalid %s", async (_name, count) => {
    mockPublishedLeague(
      makeLeagueResponse({
        league: { name: "Mirage", observed_total: 100 },
        cards: [
          {
            name: "A Chilling Wind",
            count,
            reference_weight: 25,
            reference_estimated_chance: 0.00020589,
          },
        ],
      }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
  });

  it.each([
    ["missing weight", undefined, 0.00020589],
    ["zero weight", 0, 0.00020589],
    ["fractional weight", 1.5, 0.00020589],
    ["missing chance", 25, undefined],
    ["zero chance", 25, 0],
    ["chance above one", 25, 1.1],
  ])("preserves observations but omits an invalid %s reference estimate", async (_name, referenceWeight, referenceDropChance) => {
    mockPublishedLeague(
      makeLeagueResponse({
        cards: [
          {
            name: "A Chilling Wind",
            count: 25,
            reference_weight: referenceWeight,
            reference_estimated_chance: referenceDropChance,
          },
        ],
      }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toEqual({
      league: "Mirage",
      referenceDropChance: null,
      dropCount: 25,
      referenceWeight: null,
      sampleSize: 4_207_137,
    });
  });

  it("uses only the first case-insensitive duplicate card entry", async () => {
    mockPublishedLeague(
      makeLeagueResponse({
        cards: [
          {
            name: "A Chilling Wind",
            count: 25,
            reference_weight: 25,
            reference_estimated_chance: 0.25,
          },
          {
            name: "a chilling wind",
            count: 100,
            reference_weight: 100,
            reference_estimated_chance: 0.5,
          },
          {
            name: "The Doctor",
            count: 1,
            reference_weight: 75,
            reference_estimated_chance: 0.25,
          },
        ],
      }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toMatchObject({
      referenceDropChance: 0.25,
      referenceWeight: 25,
    });
  });

  it("rejects an oversized response before parsing", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("{}", {
        headers: { "content-length": String(256 * 1024 + 1) },
      }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.stringContaining("Community drop rates unavailable"),
      expect.any(Error),
    );
  });

  it("rejects an invalid declared response size", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("{}", { headers: { "content-length": "invalid" } }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it("accepts a valid declared response size", async () => {
    const body = JSON.stringify(makeIndexResponse());
    mockFetch
      .mockResolvedValueOnce(
        new Response(body, {
          headers: {
            "content-length": String(new TextEncoder().encode(body).length),
          },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(makeLeagueResponse()));
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toMatchObject({ dropCount: 2475 });
  });

  it("rejects a response without a readable body", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null));
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(mockLoggerWarn).toHaveBeenCalled();
  });

  it("skips empty stream chunks while reading community data", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify(makeIndexResponse()));
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: undefined })
      .mockResolvedValueOnce({ done: false, value: bytes })
      .mockResolvedValueOnce({ done: true, value: undefined });
    mockFetch.mockResolvedValueOnce({
      body: { getReader: () => ({ cancel: vi.fn(), read }) },
      headers: new Headers(),
      ok: true,
      status: 200,
    } as unknown as Response);
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Standard", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("cancels a streamed response that grows past its size limit", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const read = vi
      .fn()
      .mockResolvedValueOnce({
        done: false,
        value: new Uint8Array(256 * 1024 + 1),
      })
      .mockResolvedValueOnce({ done: true, value: undefined });
    mockFetch.mockResolvedValueOnce({
      body: { getReader: () => ({ cancel, read }) },
      headers: new Headers(),
      ok: true,
      status: 200,
    } as unknown as Response);
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects an oversized index and non-OK responses", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        leagues: Array.from({ length: 501 }, (_, index) => ({
          id: `league-${index}`,
          name: `League ${index}`,
        })),
      }),
    );
    const oversizedService = new CommunityDropRatesService();
    await expect(
      oversizedService.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const unavailableService = new CommunityDropRatesService();
    await expect(
      unavailableService.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
  });

  it("rejects non-OK and malformed league responses", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse(makeIndexResponse()))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    const unavailableService = new CommunityDropRatesService();
    await expect(
      unavailableService.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();

    mockFetch
      .mockResolvedValueOnce(jsonResponse(makeIndexResponse()))
      .mockResolvedValueOnce(jsonResponse({ league: {}, cards: "invalid" }));
    const malformedService = new CommunityDropRatesService();
    await expect(
      malformedService.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();

    expect(mockLoggerWarn).toHaveBeenCalledTimes(2);
  });

  it("returns null when the card is absent from valid data", async () => {
    mockPublishedLeague();
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "Unpublished Card"),
    ).resolves.toBeNull();
  });

  it("bounds concurrent league fetches", async () => {
    const responseResolvers: Array<(response: Response) => void> = [];
    mockFetch.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          responseResolvers.push(resolve);
        }),
    );
    const service = new CommunityDropRatesService();

    const requests = Array.from({ length: 9 }, (_, index) =>
      service.getCardRate("poe1", `Unpublished ${index}`, "A Chilling Wind"),
    );

    await expect(requests[8]).resolves.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(8);

    for (const resolve of responseResolvers) {
      resolve(jsonResponse({ leagues: [] }));
    }
    await Promise.all(requests.slice(0, 8));
  });

  it("evicts the oldest league when the cache reaches its bound", async () => {
    const leagues = Array.from({ length: 33 }, (_, index) => ({
      id: `league-${index}`,
      name: `League ${index}`,
    }));
    mockFetch.mockImplementation(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.endsWith("/index.json")) {
        return jsonResponse({ leagues });
      }

      const leagueIndex = Number(url.match(/league-(\d+)\.json$/)?.[1]);
      return jsonResponse({
        league: {
          name: `League ${leagueIndex}`,
          observed_total: 100,
        },
        cards: [
          {
            name: "A Chilling Wind",
            count: 1,
            reference_weight: 25,
            reference_estimated_chance: 0.00020589,
          },
        ],
      });
    });
    const service = new CommunityDropRatesService();

    for (let index = 0; index < 33; index++) {
      await service.getCardRate("poe1", `League ${index}`, "A Chilling Wind");
    }
    expect(mockFetch).toHaveBeenCalledTimes(66);

    await service.getCardRate("poe1", "League 0", "A Chilling Wind");
    expect(mockFetch).toHaveBeenCalledTimes(68);
  });
});
