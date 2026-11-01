import { randomUUID } from "node:crypto";

import type SqliteDatabase from "better-sqlite3";
import type { Kysely, Selectable } from "kysely";

import type {
  CommunityUploadIdentityTable,
  Database,
} from "~/main/modules/database/Database.types";

type CommunityIdentity = Pick<
  Selectable<CommunityUploadIdentityTable>,
  "id" | "kind" | "account_id"
>;
const ACTIVE_IDENTITY_KEY = "community_active_upload_identity";

/** Upload IDs are independent of the installation ID used by other features. */
export class CommunityIdentityRepository {
  constructor(
    private db: Kysely<Database>,
    private raw: SqliteDatabase.Database,
  ) {}

  async getActive(): Promise<CommunityIdentity> {
    return this.db
      .selectFrom("community_upload_identities as identity")
      .innerJoin("app_metadata as metadata", "metadata.value", "identity.id")
      .select(["identity.id", "identity.account_id", "identity.kind"])
      .where("metadata.key", "=", ACTIVE_IDENTITY_KEY)
      .executeTakeFirstOrThrow();
  }

  async get(id: string): Promise<CommunityIdentity | undefined> {
    return this.db
      .selectFrom("community_upload_identities")
      .select(["id", "account_id", "kind"])
      .where("id", "=", id)
      .executeTakeFirst();
  }

  async getVerified(accountId: string): Promise<CommunityIdentity | undefined> {
    return this.db
      .selectFrom("community_upload_identities")
      .select(["id", "account_id", "kind"])
      .where("account_id", "=", accountId)
      .where("parent_id", "is", null)
      .executeTakeFirst();
  }

  activateVerified(
    id: string,
    accountId: string,
    legacyAnonymous: boolean,
  ): void {
    this.raw.transaction(() => {
      if (legacyAnonymous) {
        this.raw
          .prepare(
            "UPDATE community_upload_identities SET kind = 'anonymous' WHERE kind = 'legacy'",
          )
          .run();
      }
      const existing = this.raw
        .prepare(
          "SELECT kind, account_id FROM community_upload_identities WHERE id = ?",
        )
        .get(id) as CommunityIdentity | undefined;
      if (
        existing &&
        (existing.kind === "anonymous" ||
          (existing.account_id && existing.account_id !== accountId))
      ) {
        throw new Error("Cannot reassign a community upload identity");
      }
      this.raw
        .prepare(`INSERT INTO community_upload_identities (id, kind, account_id) VALUES (?, 'verified', ?)
        ON CONFLICT (id) DO UPDATE SET kind = 'verified', account_id = excluded.account_id`)
        .run(id, accountId);
      // A legacy root may have anonymous league epochs created by a purge.
      // Preserve their uploads and choose fresh verified epochs for future drops.
      const scopes = this.raw
        .prepare(`SELECT owner.game, owner.scope
        FROM community_upload_scope_owners owner
        JOIN community_upload_identities child ON child.id = owner.owner_id
        WHERE owner.identity_id = ? AND child.kind != 'verified'`)
        .all(id) as { game: string; scope: string }[];
      for (const { game, scope } of scopes) {
        CommunityIdentityRepository.createScopeOwner(
          this.raw,
          id,
          game,
          scope,
          "verified",
          accountId,
        );
      }
      this.raw
        .prepare("UPDATE app_metadata SET value = ? WHERE key = ?")
        .run(id, ACTIVE_IDENTITY_KEY);
    })();
  }

  /** No event can be recorded between changing the owner and clearing credentials. */
  activateAnonymous(clearSession: () => void): void {
    this.raw.transaction(() => {
      const id = randomUUID();
      this.raw
        .prepare(
          "INSERT INTO community_upload_identities (id, kind) VALUES (?, 'anonymous')",
        )
        .run(id);
      this.raw
        .prepare("UPDATE app_metadata SET value = ? WHERE key = ?")
        .run(id, ACTIVE_IDENTITY_KEY);
      clearSession();
    })();
  }

  /** Called inside Storage's deletion transaction; never reset a server counter. */
  static purgeScope(
    raw: SqliteDatabase.Database,
    game: string,
    scope: string,
  ): void {
    raw
      .prepare(`INSERT OR IGNORE INTO community_upload_retired_scopes
      SELECT id, ?, ? FROM community_upload_identities`)
      .run(game, scope);
    const roots = raw
      .prepare(
        "SELECT id, kind, account_id FROM community_upload_identities WHERE parent_id IS NULL",
      )
      .all() as CommunityIdentity[];
    for (const root of roots) {
      CommunityIdentityRepository.createScopeOwner(
        raw,
        root.id,
        game,
        scope,
        root.kind === "verified" ? "verified" : "anonymous",
        root.account_id,
      );
    }
    for (const table of [
      "community_upload_card_counts",
      "community_upload_snapshot",
      "community_upload_outbox",
      "community_drop_event_outbox",
      "community_drop_event_upload_state",
    ]) {
      raw
        .prepare(`DELETE FROM ${table} WHERE game = ? AND scope = ?`)
        .run(game, scope);
    }
  }

  private static createScopeOwner(
    raw: SqliteDatabase.Database,
    parent: string,
    game: string,
    scope: string,
    kind: "verified" | "anonymous",
    account: string | null,
  ): void {
    const id = randomUUID();
    raw
      .prepare(
        "INSERT INTO community_upload_identities (id, kind, account_id, parent_id) VALUES (?, ?, ?, ?)",
      )
      .run(id, kind, account, parent);
    raw
      .prepare(`INSERT INTO community_upload_scope_owners (identity_id, game, scope, owner_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (identity_id, game, scope) DO UPDATE SET owner_id = excluded.owner_id`)
      .run(parent, game, scope, id);
  }

  async isRetired(id: string, game: string, scope: string): Promise<boolean> {
    return !!(await this.db
      .selectFrom("community_upload_retired_scopes")
      .select("identity_id")
      .where("identity_id", "=", id)
      .where("game", "=", game)
      .where("scope", "=", scope)
      .executeTakeFirst());
  }

  async getEligibleIds(account: string | null): Promise<string[]> {
    const active = await this.getActive();
    const rows = await this.db
      .selectFrom("community_upload_identities")
      .select("id")
      .where((eb) =>
        eb.or([
          eb("kind", "=", "anonymous"),
          eb.and([eb("kind", "=", "legacy"), eb("id", "=", active.id)]),
          ...(account
            ? [
                eb.and([
                  eb("kind", "=", "verified"),
                  eb("account_id", "=", account),
                ]),
              ]
            : []),
        ]),
      )
      .execute();
    return rows.map((row) => row.id);
  }

  async getScopeOwners(
    game: "poe1" | "poe2",
    scope: string,
  ): Promise<string[]> {
    const rows = await this.db
      .selectFrom("community_upload_card_counts")
      .select("identity_id")
      .where("game", "=", game)
      .where("scope", "=", scope)
      .union(
        this.db
          .selectFrom("community_drop_event_outbox")
          .select("identity_id")
          .where("game", "=", game)
          .where("scope", "=", scope),
      )
      .union(
        this.db
          .selectFrom("community_upload_outbox")
          .select("identity_id")
          .where("game", "=", game)
          .where("scope", "=", scope),
      )
      .execute();
    return rows.map((row) => row.identity_id);
  }
}
