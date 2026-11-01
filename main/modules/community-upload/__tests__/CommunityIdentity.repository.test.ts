import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedCards,
  seedLeague,
  seedSession,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import { CurrentSessionRepository } from "~/main/modules/current-session/CurrentSession.repository";
import { migration_20261031_130000_reconcile_community_contributions as reconcile } from "~/main/modules/database/migrations/20261031_130000_reconcile_community_contributions";

import { CommunityIdentityRepository } from "../CommunityIdentity.repository";

const ROOT = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
const VERIFIED = "bbbbbbbb-bbbb-4ccc-9ddd-eeeeeeeeeeee";
describe("community identity ownership", () => {
  let db: TestDatabase;
  let identities: CommunityIdentityRepository;
  let sessionId: string;
  let current: CurrentSessionRepository;
  beforeEach(async () => {
    db = createTestDatabase();
    await db.kysely
      .insertInto("app_metadata")
      .values({ key: "device_id", value: ROOT })
      .execute();
    identities = new CommunityIdentityRepository(db.kysely, db.db);
    const league = await seedLeague(db.kysely, { name: "Settlers" });
    sessionId = await seedSession(db.kysely, { leagueId: league });
    current = new CurrentSessionRepository(db.kysely);
  });
  afterEach(async () => {
    await db.close();
  });

  async function add(count = 1) {
    for (let i = 0; i < count; i++)
      current.addCardSync(db.db, {
        sessionId,
        game: "poe1",
        league: "Settlers",
        cardName: "The Doctor",
        timestamp: new Date().toISOString(),
        eventId: crypto.randomUUID(),
        processedId: crypto.randomUUID(),
        localMinute: 1,
        utcOffsetMinutes: 0,
        location: null,
        chaosValue: null,
        divineValue: null,
      });
  }
  function counts() {
    return db.db
      .prepare(
        "SELECT identity_id, count FROM community_upload_card_counts ORDER BY identity_id",
      )
      .all();
  }

  it("starts a fresh anonymous counter and restores only the same account's counter", async () => {
    await add(10);
    identities.activateVerified(VERIFIED, "account-a", true);
    await add(2);
    identities.activateAnonymous(() => {});
    const anonymous = await identities.getActive();
    await add(3);
    identities.activateVerified(VERIFIED, "account-a", false);
    await add(1);
    expect(await identities.getVerified("account-a")).toMatchObject({
      id: VERIFIED,
    });
    expect(await identities.getVerified("account-b")).toBeUndefined();
    expect(counts()).toEqual(
      expect.arrayContaining([
        { identity_id: ROOT, count: 10 },
        { identity_id: VERIFIED, count: 3 },
        { identity_id: anonymous.id, count: 3 },
      ]),
    );
    expect(counts()).toHaveLength(3);
    expect(
      (
        await db.kysely
          .selectFrom("app_metadata")
          .select("value")
          .where("key", "=", "device_id")
          .executeTakeFirst()
      )?.value,
    ).toBe(ROOT);
  });

  it("never moves cumulative counts to a fresh identity when the migration reruns", async () => {
    await add(10);
    identities.activateAnonymous(() => {});
    await add(2);
    reconcile.up(db.db);
    reconcile.up(db.db);
    expect(
      counts()
        .map((row) => (row as { count: number }).count)
        .sort(),
    ).toEqual([10, 2]);
  });

  it("keeps contributions monotonic when local history is deleted", async () => {
    await add(10);
    db.db.prepare("DELETE FROM cards").run();
    await add(1);
    expect(counts()).toEqual([{ identity_id: ROOT, count: 11 }]);
  });

  it("rolls back an anonymous switch if credentials cannot be cleared", async () => {
    identities.activateVerified(VERIFIED, "account-a", true);
    expect(() =>
      identities.activateAnonymous(() => {
        throw new Error("disk failure");
      }),
    ).toThrow("disk failure");
    expect((await identities.getActive()).id).toBe(VERIFIED);
    expect(
      await db.kysely
        .selectFrom("community_upload_identities")
        .select("id")
        .where("kind", "=", "anonymous")
        .execute(),
    ).toEqual([{ id: ROOT }]);
  });

  it("never associates an anonymous identity or another account's identity", async () => {
    identities.activateVerified(VERIFIED, "account-a", true);
    expect(() =>
      identities.activateVerified(ROOT, "account-a", false),
    ).toThrow();
    expect(() =>
      identities.activateVerified(VERIFIED, "account-b", false),
    ).toThrow();
    expect((await identities.getActive()).id).toBe(VERIFIED);
  });

  it("counts only league increases, and ignores all-time duplicates and decreases", async () => {
    await seedCards(db.kysely, [
      { game: "poe1", scope: "Settlers", cardName: "The Doctor", count: 4 },
      { game: "poe1", scope: "all-time", cardName: "The Doctor", count: 4 },
    ]);
    db.db.prepare("UPDATE cards SET count = 2").run();
    await add(1);
    expect(counts()).toEqual([{ identity_id: ROOT, count: 1 }]);
  });
});
