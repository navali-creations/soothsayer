import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_soothsayer";
function sql(statement, database = "postgres") {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        database,
        "-At",
      ],
      { windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error("Database test timed out"));
    }, 15000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({ code, stdout, stderr });
    });
    child.stdin.end(statement);
  });
}

test("the ownership migration covers existing uploads and concurrent legacy writers", async () => {
  // A separate database keeps upgrade DDL away from the running local project.
  const suffix = randomUUID().replaceAll("-", "");
  const database = `soothsayer_identity_test_${suffix}`;
  const migrationName = `identity-migration-${suffix}`;
  const writerName = `identity-writer-${suffix}`;
  let migrating;
  let writing;
  try {
    const created = await sql(
      `CREATE DATABASE ${database} TEMPLATE template0;`,
    );
    assert.equal(created.code, 0, created.stderr);
    // Only the previous migration's required interface is needed here. The
    // legacy merge must never execute when ownership proof is missing.
    const fixture = await sql(
      `
      CREATE TABLE public.community_uploads (
        league_id UUID NOT NULL, device_id TEXT NOT NULL,
        ggg_uuid TEXT, ggg_username TEXT, is_verified BOOLEAN NOT NULL DEFAULT false,
        total_cards_uploaded INTEGER NOT NULL DEFAULT 0, upload_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE (league_id, device_id)
      );
      CREATE FUNCTION public.merge_community_upload_data_legacy(UUID,TEXT,TEXT,TEXT,BOOLEAN,JSONB)
        RETURNS JSONB LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unprotected merge reached'; END; $$;
      CREATE FUNCTION public.ingest_community_drop_events(UUID,TEXT,JSONB)
        RETURNS INTEGER LANGUAGE sql AS $$ SELECT 0; $$;
      INSERT INTO public.community_uploads (league_id,device_id,ggg_uuid,is_verified,total_cards_uploaded)
        VALUES ('ea000000-0000-4000-8000-000000000001','before-upgrade','account-a',true,4);
    `,
      database,
    );
    assert.equal(fixture.code, 0, fixture.stderr);
    const migration = readFileSync(
      new URL(
        "../../migrations/20261031130000_immutable_community_identities.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const checkpoint = "GROUP BY device_id ON CONFLICT DO NOTHING;";
    assert.ok(migration.includes(checkpoint));
    migrating = sql(
      `SET application_name = '${migrationName}';
      ${migration.replace(checkpoint, `${checkpoint}\nSELECT pg_sleep(2);`)}`,
      database,
    );
    let reachedBackfill = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const activity = await sql(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name='${migrationName}' AND wait_event='PgSleep';`,
      );
      if (activity.stdout.trim() === "1") {
        reachedBackfill = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.ok(
      reachedBackfill,
      "migration reached the concurrent-write checkpoint",
    );
    writing = sql(
      `SET application_name = '${writerName}';
      INSERT INTO public.community_uploads (league_id,device_id,ggg_uuid,is_verified,total_cards_uploaded)
        VALUES ('ea000000-0000-4000-8000-000000000001','during-upgrade','account-a',true,4);`,
      database,
    );
    let writerBlocked = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const activity = await sql(
        `SELECT count(*) FROM pg_stat_activity WHERE application_name='${writerName}' AND wait_event_type='Lock';`,
      );
      if (activity.stdout.trim() === "1") {
        writerBlocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const [migrated, written] = await Promise.all([migrating, writing]);
    assert.equal(migrated.code, 0, migrated.stderr);
    assert.equal(written.code, 0, written.stderr);
    assert.ok(
      writerBlocked,
      "legacy writers wait until ownership guards are installed",
    );
    const bindings = await sql(
      `SELECT device_id || ':' || state || ':' || ggg_uuid FROM public.community_contributor_identities ORDER BY device_id;`,
      database,
    );
    assert.equal(
      bindings.stdout.trim(),
      "before-upgrade:verified:account-a\nduring-upgrade:verified:account-a",
    );
    const resolved = await sql(
      `SELECT resolve_community_upload_identity('fresh-id','during-upgrade','account-a')->>'device_id';`,
      database,
    );
    assert.equal(resolved.stdout.trim(), "during-upgrade");
    const tokenless = await sql(
      `SELECT merge_community_upload_data('ea000000-0000-4000-8000-000000000001','during-upgrade',NULL,NULL,false,'[{"card_name":"Card","count":9}]'::jsonb);`,
      database,
    );
    assert.notEqual(tokenless.code, 0);
    assert.match(tokenless.stderr, /community_identity_proof_required/);
    const unchanged = await sql(
      `SELECT total_cards_uploaded FROM public.community_uploads WHERE device_id='during-upgrade';`,
      database,
    );
    assert.equal(unchanged.stdout.trim(), "4");
    const rerun = await sql(migration, database);
    assert.equal(rerun.code, 0, rerun.stderr);
  } finally {
    await Promise.allSettled([migrating, writing].filter(Boolean));
    assert.match(database, /^soothsayer_identity_test_[a-f0-9]+$/);
    const removed = await sql(
      `DROP DATABASE IF EXISTS ${database} WITH (FORCE);`,
    );
    assert.equal(removed.code, 0, removed.stderr);
  }
});

for (const anonymous of [false, true]) {
  test(`an upload identity has one immutable winner (${anonymous ? "anonymous versus verified" : "two accounts"})`, async () => {
    const league = randomUUID();
    const card = randomUUID();
    const device = randomUUID();
    const name = `Concurrency ${card}`;
    try {
      assert.equal(
        (
          await sql(`INSERT INTO poe_leagues (id,game,league_id,name,is_active) VALUES ('${league}','poe1','${league}','Concurrency',true);
        INSERT INTO cards (id,game,name) VALUES ('${card}','poe1','${name}');`)
        ).code,
        0,
      );
      const upload = (account, count) => `BEGIN;
        SELECT merge_community_upload_data('${league}', '${device}', ${account ? `'${account}'` : "NULL"}, ${account ? `'${account}'` : "NULL"}, ${!!account}, '[{"card_name":"${name}","count":${count}}]'::jsonb);
        SELECT pg_sleep(0.2); COMMIT;`;
      const results = await Promise.all([
        sql(upload(anonymous ? null : "account-a", 1)),
        sql(upload("account-b", 2)),
      ]);
      assert.equal(results.filter((result) => result.code === 0).length, 1);
      assert.match(
        results.find((result) => result.code !== 0).stderr,
        /community_identity_(conflict|proof_required)/,
      );
      const winner = await sql(
        `SELECT COALESCE(ggg_uuid, 'anonymous') || ':' || total_cards_uploaded FROM community_uploads WHERE device_id = '${device}';`,
      );
      assert.match(
        winner.stdout.trim(),
        anonymous
          ? /^(anonymous:1|account-b:2)$/
          : /^(account-a:1|account-b:2)$/,
      );
    } finally {
      await sql(
        `DELETE FROM poe_leagues WHERE id = '${league}'; DELETE FROM cards WHERE id = '${card}'; DELETE FROM community_contributor_identities WHERE device_id = '${device}';`,
      );
    }
  });
}
