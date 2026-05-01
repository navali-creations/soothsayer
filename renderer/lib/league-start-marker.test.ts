import { describe, expect, it } from "vitest";

import { resolveActiveLeagueStartMarker } from "./league-start-marker";

describe("resolveActiveLeagueStartMarker", () => {
  it("returns null when disabled", () => {
    const marker = resolveActiveLeagueStartMarker({
      leagues: [
        { id: "Mirage", name: "Mirage", startAt: "2024-04-17T00:00:00Z" },
      ],
      activeLeague: "Mirage",
      enabled: false,
    });

    expect(marker).toBeNull();
  });

  it("resolves marker by id", () => {
    const marker = resolveActiveLeagueStartMarker({
      leagues: [
        { id: "Mirage", name: "Mirage", startAt: "2024-04-17T00:00:00Z" },
      ],
      activeLeague: "Mirage",
      enabled: true,
    });

    expect(marker).toEqual({
      time: new Date("2024-04-17T00:00:00Z").getTime(),
      label: "Mirage",
    });
  });

  it("resolves marker by case-insensitive name", () => {
    const marker = resolveActiveLeagueStartMarker({
      leagues: [{ name: "MIRAGE", startAt: "2024-04-17T00:00:00Z" }],
      activeLeague: "mirage",
      enabled: true,
    });

    expect(marker).toEqual({
      time: new Date("2024-04-17T00:00:00Z").getTime(),
      label: "MIRAGE",
    });
  });
});
