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
      { name: "A Chilling Wind", count: 2475, ratio: "not-required" },
      { name: "The Doctor", count: 42 },
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

  it("returns the count-based observation data", async () => {
    mockPublishedLeague();
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toEqual({
      league: "Mirage",
      dropCount: 2475,
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
        cards: [{ name: "A Chilling Wind", count }],
      }),
    );
    const service = new CommunityDropRatesService();

    await expect(
      service.getCardRate("poe1", "Mirage", "A Chilling Wind"),
    ).resolves.toBeNull();
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
        cards: [{ name: "A Chilling Wind", count: 1 }],
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
