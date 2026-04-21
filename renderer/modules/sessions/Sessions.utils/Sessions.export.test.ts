import { describe, expect, it } from "vitest";

import type { SessionSummary } from "~/main/modules/sessions";

import { generateRichCsv, generateSimpleCsv } from "./Sessions.export";

const RICH_HEADER =
  "Session Date,League,Duration (min),Decks Opened,Exchange Value (chaos),Stash Value (chaos),Net Profit (chaos),Chaos/Divine Ratio,Stacked Deck Cost (chaos)\n";

describe("generateRichCsv", () => {
  it("produces correct header row", () => {
    const result = generateRichCsv([]);
    expect(result).toBe(RICH_HEADER);
  });

  it("empty session list produces header only", () => {
    const result = generateRichCsv([]);
    expect(result).toBe(RICH_HEADER);
    expect(result.split("\n")).toHaveLength(2); // header + trailing empty
  });

  it("produces correct data rows for a session with all values", () => {
    const session: SessionSummary = {
      startedAt: "2024-01-15T10:00:00Z",
      league: "Affliction",
      durationMinutes: 45,
      totalDecksOpened: 100,
      totalExchangeValue: 1234.567,
      totalStashValue: 500.123,
      totalExchangeNetProfit: 734.444,
      exchangeChaosToDivine: 180.5,
      stackedDeckChaosCost: 3.25,
    } as SessionSummary;

    const result = generateRichCsv([session]);
    const lines = result.split("\n");

    expect(lines[0]).toBe(RICH_HEADER.trimEnd());
    expect(lines[1]).toBe(
      "2024-01-15T10:00:00Z,Affliction,45,100,1234.57,500.12,734.44,180.5,3.25",
    );
  });

  it("handles null values (N/A output)", () => {
    const session: SessionSummary = {
      startedAt: null,
      league: null,
      durationMinutes: null,
      totalDecksOpened: null,
      totalExchangeValue: null,
      totalStashValue: null,
      totalExchangeNetProfit: null,
      exchangeChaosToDivine: null,
      stackedDeckChaosCost: null,
    } as unknown as SessionSummary;

    const result = generateRichCsv([session]);
    const lines = result.split("\n");

    expect(lines[1]).toBe(",,N/A,0,N/A,N/A,N/A,N/A,N/A");
  });

  it("multiple sessions produce multiple rows", () => {
    const sessions: SessionSummary[] = [
      {
        startedAt: "2024-01-01",
        league: "League1",
        durationMinutes: 10,
        totalDecksOpened: 5,
        totalExchangeValue: 100,
        totalStashValue: 50,
        totalExchangeNetProfit: 50,
        exchangeChaosToDivine: 180,
        stackedDeckChaosCost: 2,
      } as SessionSummary,
      {
        startedAt: "2024-01-02",
        league: "League2",
        durationMinutes: 20,
        totalDecksOpened: 10,
        totalExchangeValue: 200,
        totalStashValue: 100,
        totalExchangeNetProfit: 100,
        exchangeChaosToDivine: 190,
        stackedDeckChaosCost: 3,
      } as SessionSummary,
    ];

    const result = generateRichCsv(sessions);
    const lines = result.split("\n").filter((l) => l.length > 0);

    expect(lines).toHaveLength(3); // header + 2 data rows
    expect(lines[1]).toContain("2024-01-01");
    expect(lines[2]).toContain("2024-01-02");
  });
});

describe("generateSimpleCsv", () => {
  it("produces correct header", () => {
    const result = generateSimpleCsv({});
    expect(result.startsWith("name,amount\n")).toBe(true);
  });

  it("empty input produces header only", () => {
    const result = generateSimpleCsv({});
    expect(result).toBe("name,amount\n");
  });

  it("produces sorted rows by card name", () => {
    const drops: Record<string, number> = {
      "The Doctor": 2,
      "Abandoned Wealth": 5,
      "House of Mirrors": 1,
    };

    const result = generateSimpleCsv(drops);
    const lines = result.split("\n").filter((l) => l.length > 0);

    expect(lines).toHaveLength(4); // header + 3 rows
    expect(lines[1]).toBe("Abandoned Wealth,5");
    expect(lines[2]).toBe("House of Mirrors,1");
    expect(lines[3]).toBe("The Doctor,2");
  });

  it("handles card names with commas (CSV escaping)", () => {
    const drops: Record<string, number> = {
      "Rain of Chaos, Exile": 3,
    };

    const result = generateSimpleCsv(drops);
    const lines = result.split("\n").filter((l) => l.length > 0);

    expect(lines[1]).toBe('"Rain of Chaos, Exile",3');
  });

  it.each([
    "=cmd",
    "+SUM(1,1)",
    "-10",
    "@HYPERLINK(A1)",
    "\tTabbed",
  ])("neutralizes spreadsheet formula prefix %s", (name) => {
    const result = generateSimpleCsv({ [name]: 1 });
    const lines = result.split("\n").filter((l) => l.length > 0);
    const sanitized = `'${name}`;
    const expected = name.includes(",")
      ? `"${sanitized.replace(/"/g, '""')}",1`
      : `${sanitized},1`;

    expect(lines[1]).toBe(expected);
  });
});

describe("CSV formula neutralization", () => {
  it("neutralizes rich CSV string cells", () => {
    const session: SessionSummary = {
      startedAt: "=2024-01-01",
      league: "@League",
      durationMinutes: 10,
      totalDecksOpened: 5,
      totalExchangeValue: 100,
      totalStashValue: 50,
      totalExchangeNetProfit: 50,
      exchangeChaosToDivine: 180,
      stackedDeckChaosCost: 2,
    } as SessionSummary;

    const result = generateRichCsv([session]);
    const lines = result.split("\n");

    expect(lines[1]).toContain("'=2024-01-01,'@League");
  });
});
