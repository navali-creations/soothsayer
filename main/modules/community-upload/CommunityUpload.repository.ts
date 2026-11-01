import { type Kysely, sql } from "kysely";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import type { Database } from "~/main/modules/database/Database.types";

import type {
  CommunityBackfillLeague,
  CommunityDropContextUploadStatus,
} from "./CommunityUpload.dto";
import {
  COMMUNITY_IDENTITY_CONFLICT,
  COMMUNITY_IDENTITY_PROOF_REQUIRED,
  type CommunityIdentityFailureCode,
} from "./CommunityUpload.utils";

const MAX_BACKFILL_LEAGUES = 200;
const MAX_LEAGUE_LENGTH = 256;
// Version the disclosure so an older upload preference never grants new consent.
const DROP_CONTEXT_CONSENT_KEY = "community_drop_context_consent_v1";
const IDENTITY_WARNING_PREFIX = "community_upload_identity_warning:";
const identityFailure = sql<boolean>`instr(last_error, ${COMMUNITY_IDENTITY_PROOF_REQUIRED}) > 0 OR instr(last_error, ${COMMUNITY_IDENTITY_CONFLICT}) > 0`;

const backfillKey = ({ game, league }: CommunityBackfillLeague): string =>
  `community_backfill_done_${game}_${league}`;

export class CommunityUploadRepository {
  constructor(private kysely: Kysely<Database>) {}

  async getUploadWarning(
    accountId: string | null,
    includeDropContext: boolean,
  ): Promise<CommunityDropContextUploadStatus["uploadWarning"]> {
    const blocked = await this.kysely
      .selectFrom("community_upload_identities as identity")
      .innerJoin("app_metadata as active", (join) =>
        join.on("active.key", "=", "community_active_upload_identity"),
      )
      .leftJoin("app_metadata as warning", (join) =>
        join.on(
          "warning.key",
          "=",
          sql<string>`${IDENTITY_WARNING_PREFIX} || ${sql.ref("identity.id")}`,
        ),
      )
      .select(["identity.kind", "identity.account_id", "warning.value"])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("identity.kind", "=", "verified"),
            ...(accountId ? [eb("identity.account_id", "!=", accountId)] : []),
          ]),
          eb.and([
            eb("identity.kind", "=", "legacy"),
            eb("identity.id", "!=", eb.ref("active.value")),
          ]),
          eb("warning.value", "in", [
            COMMUNITY_IDENTITY_PROOF_REQUIRED,
            COMMUNITY_IDENTITY_CONFLICT,
          ]),
        ]),
      )
      .where((eb) =>
        eb.or([
          eb.exists(
            eb
              .selectFrom("community_upload_outbox as counts")
              .select("counts.identity_id")
              .whereRef("counts.identity_id", "=", "identity.id"),
          ),
          ...(includeDropContext
            ? [
                eb.exists(
                  eb
                    .selectFrom("community_drop_event_outbox as event")
                    .select("event.identity_id")
                    .whereRef("event.identity_id", "=", "identity.id"),
                ),
              ]
            : []),
        ]),
      )
      .limit(1)
      .executeTakeFirst();
    if (blocked) {
      if (blocked.value === COMMUNITY_IDENTITY_CONFLICT)
        return "account-mismatch";
      return blocked.kind === "verified" &&
        accountId !== null &&
        blocked.account_id !== accountId
        ? "account-mismatch"
        : "verification-required";
    }
    // Older builds saved full error messages in the small count outbox.
    // Historical events are checked through their indexed owner, never scanned.
    const previousFailure = await this.kysely
      .selectFrom("community_upload_outbox")
      .select("last_error")
      .where(identityFailure)
      .limit(1)
      .executeTakeFirst();
    if (!previousFailure) return undefined;
    return previousFailure.last_error?.includes(COMMUNITY_IDENTITY_CONFLICT)
      ? "account-mismatch"
      : "verification-required";
  }

  async setIdentityWarning(
    identityId: string,
    code: CommunityIdentityFailureCode,
  ): Promise<void> {
    await this.kysely
      .insertInto("app_metadata")
      .values({ key: `${IDENTITY_WARNING_PREFIX}${identityId}`, value: code })
      .onConflict((conflict) =>
        conflict.column("key").doUpdateSet({ value: code }),
      )
      .execute();
  }

  async clearIdentityWarning(identityId: string): Promise<void> {
    await this.kysely
      .deleteFrom("app_metadata")
      .where("key", "=", `${IDENTITY_WARNING_PREFIX}${identityId}`)
      .execute();
  }

  async releaseVerificationRetries(accountId: string): Promise<void> {
    const owners = this.kysely
      .selectFrom("community_upload_identities")
      .select("id")
      .where("kind", "=", "verified")
      .where("account_id", "=", accountId);
    await this.kysely.transaction().execute(async (transaction) => {
      await transaction
        .updateTable("community_upload_outbox")
        .set({ next_attempt_at: null })
        .where("identity_id", "in", owners)
        .where(identityFailure)
        .execute();
      await transaction
        .updateTable("community_drop_event_upload_state")
        .set({ next_attempt_at: null })
        .where(identityFailure)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("community_drop_event_outbox as event")
              .select("event.identity_id")
              .where("event.identity_id", "in", owners)
              .whereRef(
                "event.game",
                "=",
                "community_drop_event_upload_state.game",
              )
              .whereRef(
                "event.scope",
                "=",
                "community_drop_event_upload_state.scope",
              ),
          ),
        )
        .execute();
    });
  }

  async getDropContextConsent(): Promise<boolean | null> {
    const row = await this.kysely
      .selectFrom("app_metadata")
      .select("value")
      .where("key", "=", DROP_CONTEXT_CONSENT_KEY)
      .executeTakeFirst();

    if (row?.value === "true") return true;
    if (row?.value === "false") return false;
    return null;
  }

  async setDropContextConsent(enabled: boolean): Promise<void> {
    const value = enabled ? "true" : "false";
    await this.kysely
      .insertInto("app_metadata")
      .values({ key: DROP_CONTEXT_CONSENT_KEY, value })
      .onConflict((conflict) => conflict.column("key").doUpdateSet({ value }))
      .execute();
  }

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
