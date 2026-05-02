import type {
  CardDropTimelinePointDTO,
  LeagueDateRangeDTO,
} from "./CardDetails.dto";

export interface DropTimelineSessionRow {
  sessionId: string;
  sessionStartedAt: string;
  count: number;
  totalDecksOpened: number;
  league: string;
}

interface BuildPreparedDropTimelineParams {
  rows: DropTimelineSessionRow[];
  leagueDateRanges: LeagueDateRangeDTO[];
  firstSessionStartedAt: string | null;
  timelineEndDate: string;
}

const MIN_GAP_FOR_BREAK_MS = 14 * 24 * 60 * 60 * 1000;

function parseDateMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function toDayKey(time: number): string {
  const date = new Date(time);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function getEarliestLeagueStartMs(leagueDateRanges: LeagueDateRangeDTO[]) {
  let earliest: number | undefined;

  for (const range of leagueDateRanges) {
    const time = parseDateMs(range.startDate);
    if (time === undefined) continue;
    earliest = earliest === undefined ? time : Math.min(earliest, time);
  }

  return earliest;
}

function createBoundaryPoint({
  time,
  cumulativeCount,
  league,
}: {
  time: number;
  cumulativeCount: number;
  league: string;
}): CardDropTimelinePointDTO {
  return {
    time,
    count: 0,
    cumulativeCount,
    totalDecksOpened: 0,
    league,
    sessionStartedAt: new Date(time).toISOString(),
    sessionId: "",
    sessionCount: 0,
    isBoundary: true,
  };
}

function createGapPoint({
  time,
  cumulativeCount,
}: {
  time: number;
  cumulativeCount: number;
}): CardDropTimelinePointDTO {
  return {
    time,
    count: 0,
    cumulativeCount,
    totalDecksOpened: 0,
    league: "",
    sessionStartedAt: new Date(time).toISOString(),
    sessionId: "",
    sessionCount: 0,
    isGap: true,
  };
}

export function buildPreparedDropTimeline({
  rows,
  leagueDateRanges,
  firstSessionStartedAt,
  timelineEndDate,
}: BuildPreparedDropTimelineParams): CardDropTimelinePointDTO[] {
  if (rows.length === 0) return [];

  const sortedRows = rows
    .map((row) => ({
      ...row,
      time: parseDateMs(row.sessionStartedAt),
    }))
    .filter((row): row is DropTimelineSessionRow & { time: number } =>
      Number.isFinite(row.time),
    )
    .sort((a, b) => a.time - b.time);

  if (sortedRows.length === 0) return [];

  const aggregated: CardDropTimelinePointDTO[] = [];
  let currentGroup: Array<DropTimelineSessionRow & { time: number }> = [];
  let cumulativeCount = 0;

  const flushGroup = () => {
    if (currentGroup.length === 0) return;

    let count = 0;
    let totalDecksOpened = 0;
    const sessionIds: string[] = [];

    for (const point of currentGroup) {
      count += point.count;
      totalDecksOpened += point.totalDecksOpened;
      sessionIds.push(point.sessionId);
    }

    cumulativeCount += count;
    const firstPoint = currentGroup[0];

    aggregated.push({
      time: firstPoint.time,
      count,
      cumulativeCount,
      totalDecksOpened,
      league: firstPoint.league,
      sessionStartedAt: firstPoint.sessionStartedAt,
      sessionId: sessionIds.join(","),
      sessionCount: currentGroup.length,
    });
  };

  for (const row of sortedRows) {
    if (
      currentGroup.length > 0 &&
      (toDayKey(row.time) !== toDayKey(currentGroup[0].time) ||
        row.league !== currentGroup[0].league)
    ) {
      flushGroup();
      currentGroup = [];
    }

    currentGroup.push(row);
  }
  flushGroup();

  const result: CardDropTimelinePointDTO[] = [];
  for (let i = 0; i < aggregated.length; i++) {
    const point = aggregated[i];

    if (i > 0) {
      const previous = aggregated[i - 1];
      const timeDiff = point.time - previous.time;

      if (timeDiff > MIN_GAP_FOR_BREAK_MS) {
        result.push(
          createGapPoint({
            time: previous.time + timeDiff / 2,
            cumulativeCount: previous.cumulativeCount,
          }),
        );
      }
    }

    result.push(point);
  }

  if (result.length === 0) return result;

  const firstReal = result[0];
  const lastReal = result[result.length - 1];
  const boundaryStart =
    parseDateMs(firstSessionStartedAt) ??
    getEarliestLeagueStartMs(leagueDateRanges);
  const boundaryEnd = parseDateMs(timelineEndDate);

  if (boundaryStart !== undefined && boundaryStart < firstReal.time) {
    result.unshift(
      createBoundaryPoint({
        time: boundaryStart,
        cumulativeCount: 0,
        league: firstReal.league,
      }),
    );
  }

  if (boundaryEnd !== undefined && boundaryEnd > lastReal.time) {
    result.push(
      createBoundaryPoint({
        time: boundaryEnd,
        cumulativeCount: lastReal.cumulativeCount,
        league: lastReal.league,
      }),
    );
  }

  return result;
}
