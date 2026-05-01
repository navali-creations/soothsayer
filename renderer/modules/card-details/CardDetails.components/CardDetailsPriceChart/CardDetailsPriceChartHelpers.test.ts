import { describe, expect, it } from "vitest";

import type { CardPriceHistoryPointDTO } from "~/main/modules/card-details/CardDetails.dto";
import {
  formatAxisDate,
  formatDate,
  formatDateFull,
  mapHistoryToChartData,
} from "~/renderer/modules/card-details/CardDetails.components/CardDetailsPriceChart/helpers";

// ─── formatDate ────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats an ISO string as short month + day", () => {
    const result = formatDate("2026-03-04T00:00:00Z");
    expect(result).toBe("Mar 4");
  });

  it("formats a mid-year date correctly", () => {
    const result = formatDate("2025-07-15T12:30:00Z");
    expect(result).toBe("Jul 15");
  });

  it("handles January 1st", () => {
    const result = formatDate("2026-01-01T00:00:00Z");
    expect(result).toBe("Jan 1");
  });

  it("handles December 25th", () => {
    const result = formatDate("2025-12-25T12:00:00Z");
    expect(result).toBe("Dec 25");
  });
});

// ─── formatDateFull ────────────────────────────────────────────────────────

describe("formatDateFull", () => {
  it("formats an ISO string as short month + day + year", () => {
    const result = formatDateFull("2026-03-04T00:00:00Z");
    expect(result).toBe("Mar 4, 2026");
  });

  it("includes the year for older dates", () => {
    const result = formatDateFull("2020-01-15T00:00:00Z");
    expect(result).toBe("Jan 15, 2020");
  });

  it("formats end-of-year date correctly", () => {
    const result = formatDateFull("2025-12-25T12:00:00Z");
    expect(result).toBe("Dec 25, 2025");
  });
});

// ─── formatAxisDate ────────────────────────────────────────────────────────

describe("formatAxisDate", () => {
  it("formats a unix timestamp as short month + day", () => {
    // 2026-03-04T00:00:00Z
    const ts = new Date("2026-03-04T00:00:00Z").getTime();
    const result = formatAxisDate(ts);
    expect(result).toBe("Mar 4");
  });

  it("formats another timestamp correctly", () => {
    const ts = new Date("2025-11-20T15:00:00Z").getTime();
    const result = formatAxisDate(ts);
    expect(result).toBe("Nov 20");
  });
});

// ─── mapHistoryToChartData ─────────────────────────────────────────────────

describe("mapHistoryToChartData", () => {
  it("returns an empty array for empty input", () => {
    expect(mapHistoryToChartData([])).toEqual([]);
  });

  it("transforms a single price history point", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: "2026-03-04T00:00:00Z", rate: 1.5, volume: 100 },
    ];

    const result = mapHistoryToChartData(history);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      time: new Date("2026-03-04T00:00:00Z").getTime(),
      dateLabel: "Mar 4",
      rate: 1.5,
      volume: 100,
    });
  });

  it("transforms multiple price history points in chronological order", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: "2026-03-01T00:00:00Z", rate: 1.0, volume: 50 },
      { timestamp: "2026-03-02T00:00:00Z", rate: 1.2, volume: 80 },
      { timestamp: "2026-03-03T00:00:00Z", rate: 0.9, volume: 30 },
    ];

    const result = mapHistoryToChartData(history);

    expect(result).toHaveLength(3);

    expect(result[0].time).toBe(new Date("2026-03-01T00:00:00Z").getTime());
    expect(result[0].dateLabel).toBe("Mar 1");
    expect(result[0].rate).toBe(1.0);
    expect(result[0].volume).toBe(50);

    expect(result[1].time).toBe(new Date("2026-03-02T00:00:00Z").getTime());
    expect(result[1].dateLabel).toBe("Mar 2");
    expect(result[1].rate).toBe(1.2);
    expect(result[1].volume).toBe(80);

    expect(result[2].time).toBe(new Date("2026-03-03T00:00:00Z").getTime());
    expect(result[2].dateLabel).toBe("Mar 3");
    expect(result[2].rate).toBe(0.9);
    expect(result[2].volume).toBe(30);
  });

  it("sorts newest-first price history into chronological order", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: "2026-03-03T00:00:00Z", rate: 0.9, volume: 30 },
      { timestamp: "2026-03-01T00:00:00Z", rate: 1.0, volume: 50 },
      { timestamp: "2026-03-02T00:00:00Z", rate: 1.2, volume: 80 },
    ];

    const result = mapHistoryToChartData(history);

    expect(result.map((point) => point.dateLabel)).toEqual([
      "Mar 1",
      "Mar 2",
      "Mar 3",
    ]);
  });

  it("correctly converts timestamps to unix milliseconds", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: "2025-06-15T12:30:00Z", rate: 2.0, volume: 200 },
    ];

    const result = mapHistoryToChartData(history);
    expect(result[0].time).toBe(Date.UTC(2025, 5, 15, 12, 30, 0));
  });

  it("handles zero rate and volume", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: "2026-01-01T00:00:00Z", rate: 0, volume: 0 },
    ];

    const result = mapHistoryToChartData(history);

    expect(result[0]).toEqual({
      time: new Date("2026-01-01T00:00:00Z").getTime(),
      dateLabel: "Jan 1",
      rate: 0,
      volume: 0,
    });
  });

  it("produces dateLabel consistent with formatDate", () => {
    const ts = "2026-07-22T00:00:00Z";
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: ts, rate: 3.5, volume: 150 },
    ];

    const result = mapHistoryToChartData(history);
    expect(result[0].dateLabel).toBe(formatDate(ts));
  });
});
