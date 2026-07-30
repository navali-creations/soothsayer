import { type Kysely, sql } from "kysely";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import type { Database } from "~/main/modules/database/Database.types";

import type { CommunityBackfillLeague } from "./CommunityUpload.dto";

const MAX_BACKFILL_LEAGUES = 200;
const MAX_LEAGUE_LENGTH = 256;

const backfillKey = ({ game, league }: CommunityBackfillLeague): string =>
  `community_backfill_done_${game}_${league}`;

export class CommunityUploadRepository {
  constructor(private kysely: Kysely<Database>) {}

  async getBackfillLeagues(): Promise<CommunityBackfillLeague[]> {
    const rows = await this.kysely
      .selectFrom("cards")
      .select(["game", "scope"])
      .where("game", "in", ["poe1", "poe2"])
      .where("scope", "!=", "all-time")
      .where("scope", "!=", "")
      .where("count", ">", 0)
      .where(sql<boolean>`length(scope) <= ${MAX_LEAGUE_LENGTH}`)
      .groupBy(["game", "scope"])
      .orderBy("game")
      .orderBy("scope")
      .limit(MAX_BACKFILL_LEAGUES + 1)
      .execute();

    if (rows.length > MAX_BACKFILL_LEAGUES) {
      throw new Error("Backfill league limit exceeded");
    }
    if (rows.length === 0) return [];

    const leagues = rows.map(
      ({ game, scope }): CommunityBackfillLeague => ({
        game: game as CommunityBackfillLeague["game"],
        league: scope,
      }),
    );
    const keys = leagues.map(backfillKey);
    const completedRows = await this.kysely
      .selectFrom("app_metadata")
      .select("key")
      .where("key", "in", keys)
      .execute();
    const completedKeys = new Set(completedRows.map(({ key }) => key));

    return leagues.filter((league) => !completedKeys.has(backfillKey(league)));
  }

  async commitBackfill(
    completedLeagues: readonly CommunityBackfillLeague[],
    dismissBanner: boolean,
  ): Promise<void> {
    await this.kysely.transaction().execute(async (transaction) => {
      if (completedLeagues.length > 0) {
        await transaction
          .insertInto("app_metadata")
          .values(
            completedLeagues.map((league) => ({
              key: backfillKey(league),
              value: "true",
            })),
          )
          .onConflict((conflict) =>
            conflict.column("key").doUpdateSet({ value: "true" }),
          )
          .execute();
      }

      if (dismissBanner) {
        await transaction
          .insertInto("dismissed_banners")
          .values({ banner_id: BANNER_IDS.COMMUNITY_BACKFILL })
          .onConflict((conflict) => conflict.column("banner_id").doNothing())
          .execute();
      }
    });
  }
}
