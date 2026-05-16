import {
  buildMetricSummarySparklineSegments,
  resolveMetricSummarySparklineRange,
} from "./MetricSummaryCell.utils";

describe("MetricSummaryCell utils", () => {
  it("returns null when no finite sparkline values exist", () => {
    expect(
      resolveMetricSummarySparklineRange([
        {
          id: "cpu",
          points: [
            { x: 0, value: null },
            { x: 1, value: Number.NaN },
          ],
          color: "#ffaa00",
        },
      ]),
    ).toBeNull();
  });

  it("trims missing edge values so the visible sparkline fills the width", () => {
    const lines = [
      {
        id: "cpu",
        points: [
          { x: 0, value: null },
          { x: 10, value: 10 },
          { x: 15, value: 15 },
          { x: 20, value: 20 },
          { x: 30, value: null },
          { x: 40, value: null },
        ],
        color: "#ffaa00",
      },
    ];
    const range = resolveMetricSummarySparklineRange(lines);

    expect(range).toEqual({ min: 10, max: 20 });
    expect(
      buildMetricSummarySparklineSegments({
        points: lines[0].points,
        range: range!,
      }),
    ).toEqual([
      {
        points: "1.0,14.0 50.0,8.0 99.0,2.0",
        areaPath: "M 1.0,14.0 L 50.0,8.0 L 99.0,2.0 L 99.0,16.0 L 1.0,16.0 Z",
      },
    ]);
  });

  it("uses index spacing and centered y values when x and value ranges collapse", () => {
    expect(
      buildMetricSummarySparklineSegments({
        points: [
          { x: 10, value: 5 },
          { x: 10, value: 5 },
        ],
        range: { min: 5, max: 5 },
      }),
    ).toEqual([
      {
        points: "1.0,8.0 99.0,8.0",
        areaPath: "M 1.0,8.0 L 99.0,8.0 L 99.0,16.0 L 1.0,16.0 Z",
      },
    ]);
  });

  it("does not build a segment for a single visible point", () => {
    expect(
      buildMetricSummarySparklineSegments({
        points: [{ x: 10, value: 5 }],
        range: { min: 0, max: 10 },
      }),
    ).toEqual([]);
  });
});
