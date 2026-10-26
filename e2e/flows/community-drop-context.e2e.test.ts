import { mkdtemp, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { expect, test } from "../helpers/electron-test";
import { callElectronAPI, setSetting } from "../helpers/ipc-helpers";
import { ensurePostSetup } from "../helpers/navigation";
import {
  clearSessionHistory,
  dbExec,
  dbQuery,
  seedCompletedSession,
  seedSessionPrerequisites,
} from "../helpers/seed-db";

test.describe("Community card-drop context", () => {
  test("shows background upload progress without blocking the app", async ({
    page,
  }) => {
    await ensurePostSetup(page);

    await page.evaluate(() => {
      const store = (window as any).__zustandStore;
      if (!store) throw new Error("__zustandStore not available");
      store.setState((state: any) => {
        state.communityUpload.dropContextUploadStatus = {
          pendingEvents: 4_500,
          isUploading: true,
          revision: 10_000,
        };
      });
    });

    await expect(
      page.getByRole("status").filter({
        hasText: "Uploading card history: 4,500 remaining",
      }),
    ).toBeVisible();

    await page.evaluate(() => {
      const store = (window as any).__zustandStore;
      store.setState((state: any) => {
        state.communityUpload.dropContextUploadStatus = {
          pendingEvents: 0,
          isUploading: false,
          revision: 10_001,
        };
      });
    });

    await expect(
      page.getByText("Uploading card history: 4,500 remaining"),
    ).not.toBeVisible();
  });

  test("backfills a preserved Client.txt event without replaying card counts", async ({
    page,
  }) => {
    await ensurePostSetup(page);
    await clearSessionHistory(page);
    const { leagueId, snapshotId } = await seedSessionPrerequisites(page);
    const sessionId = "e2e-context-backfill-session";
    const localDropTime = new Date(2026, 2, 14, 10, 26, 14);

    await seedCompletedSession(page, {
      id: sessionId,
      game: "poe1",
      leagueId,
      snapshotId,
      startedAt: new Date(2026, 2, 14, 10, 0).toISOString(),
      endedAt: new Date(2026, 2, 14, 11, 0).toISOString(),
      cards: [{ cardName: "The Scholar", count: 1 }],
    });
    await dbExec(
      page,
      `INSERT INTO session_card_events (
         session_id, card_name, dropped_at, event_id
       ) VALUES (?, ?, ?, ?)`,
      [
        sessionId,
        "The Scholar",
        localDropTime.toISOString(),
        "aaaaaaaa-0000-4000-8000-000000000001",
      ],
    );
    const [{ scope }] = await dbQuery<{ scope: string }>(
      page,
      `SELECT l.name AS scope
       FROM sessions s
       JOIN leagues l ON l.id = s.league_id
       WHERE s.id = ?`,
      [sessionId],
    );
    await dbExec(
      page,
      `INSERT OR REPLACE INTO community_drop_event_upload_state (
         game, scope, attempts, last_error, next_attempt_at
       ) VALUES (?, ?, 0, NULL, ?)`,
      ["poe1", scope, "2999-01-01T00:00:00.000Z"],
    );
    const aggregateSnapshotsBefore = await dbQuery(
      page,
      `SELECT game, scope, card_name, count
       FROM community_upload_snapshot
       ORDER BY game, scope, card_name`,
    );
    const aggregateOutboxBefore = await dbQuery(
      page,
      `SELECT game, scope, cards_json
       FROM community_upload_outbox
       ORDER BY game, scope`,
    );

    const directory = await mkdtemp(path.join(tmpdir(), "soothsayer-e2e-"));
    const logPath = path.join(directory, "Client.txt");
    try {
      await writeFile(
        logPath,
        [
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
          "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
          "",
        ].join("\n"),
        "utf8",
      );
      await setSetting(page, "communityUploadsEnabled", true);
      await setSetting(page, "poe1ClientTxtPath", logPath);
      await dbExec(page, "DELETE FROM app_metadata WHERE key IN (?, ?)", [
        "historical_card_context_backfill_v1:poe1",
        "historical_card_context_backfill_v1:poe2",
      ]);

      await expect(
        callElectronAPI(
          page,
          "clientLogReader",
          "runHistoricalContextBackfill",
        ),
      ).resolves.toEqual({ status: "completed", enrichedEvents: 1 });

      await expect(
        dbQuery<{
          source_event_id: string;
          location: string;
          utc_offset_minutes: number;
        }>(
          page,
          `SELECT source_event_id, location, utc_offset_minutes
           FROM session_card_events
           WHERE session_id = ?`,
          [sessionId],
        ),
      ).resolves.toEqual([
        {
          source_event_id: "249522781",
          location: "Atlas Hideout",
          utc_offset_minutes: 0 - localDropTime.getTimezoneOffset(),
        },
      ]);

      const counts = await dbQuery<{ total_count: number }>(
        page,
        "SELECT total_count FROM sessions WHERE id = ?",
        [sessionId],
      );
      expect(counts).toEqual([{ total_count: 1 }]);
      await expect(
        dbQuery(
          page,
          `SELECT game, scope, card_name, count
           FROM community_upload_snapshot
           ORDER BY game, scope, card_name`,
        ),
      ).resolves.toEqual(aggregateSnapshotsBefore);
      await expect(
        dbQuery(
          page,
          `SELECT game, scope, cards_json
           FROM community_upload_outbox
           ORDER BY game, scope`,
        ),
      ).resolves.toEqual(aggregateOutboxBefore);
      await expect(
        dbQuery(
          page,
          `SELECT event_id, session_id, game, scope, card_name, location,
                  local_minute, utc_offset_minutes
           FROM community_drop_event_outbox
           WHERE session_id = ?`,
          [sessionId],
        ),
      ).resolves.toEqual([
        {
          event_id: "aaaaaaaa-0000-4000-8000-000000000001",
          session_id: sessionId,
          game: "poe1",
          scope,
          card_name: "The Scholar",
          location: "Atlas Hideout",
          local_minute: 10 * 60 + 26,
          utc_offset_minutes: 0 - localDropTime.getTimezoneOffset(),
        },
      ]);
    } finally {
      await unlink(logPath).catch(() => undefined);
      await rmdir(directory).catch(() => undefined);
      await setSetting(page, "communityUploadsEnabled", true);
    }
  });
});
