import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    console.log(req);

    const incomingSecret = req.headers.get("x-cron-secret");

    if (incomingSecret !== Deno.env.get("INTERNAL_CRON_SECRET")) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    console.log("Syncing leagues from legacy PoE APIs...");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    let totalSynced = 0;

    // 1. Fetch PoE1 leagues
    console.log("Fetching PoE1 leagues...");
    const poe1Response = await fetch(
      "https://www.pathofexile.com/api/leagues",
      {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Supabase Edge Function) (contact: eskrzy@gmail.com)",
        },
      },
    );

    if (!poe1Response.ok) {
      throw new Error(`PoE1 API failed: ${poe1Response.statusText}`);
    }

    const poe1Leagues = await poe1Response.json();

    // Filter out Solo leagues and upsert
    for (const league of poe1Leagues) {
      const hasSolo = league.rules?.some((rule: any) => rule.name === "Solo");
      if (hasSolo) continue;

      const { error } = await supabase.from("poe_leagues").upsert(
        {
          game: "poe1",
          league_id: league.id,
          name: league.name || league.id,
          start_at: league.startAt || null,
          end_at: league.endAt || null,
          is_active: !league.endAt || new Date(league.endAt) > new Date(),
        },
        {
          onConflict: "game,league_id",
        },
      );

      if (error) {
        console.error(`Failed to upsert PoE1 league ${league.id}:`, error);
      } else {
        totalSynced++;
      }
    }

    console.log(`Synced ${totalSynced} PoE1 leagues`);

    // 2. Fetch PoE2 leagues
    console.log("Fetching PoE2 leagues...");
    const poe2Response = await fetch(
      "https://www.pathofexile.com/api/trade2/data/leagues",
      {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Supabase Edge Function) (contact: eskrzy@gmail.com)",
        },
      },
    );

    if (!poe2Response.ok) {
      throw new Error(`PoE2 API failed: ${poe2Response.statusText}`);
    }

    const poe2Data = await poe2Response.json();
    const poe2Count = totalSynced;

    for (const league of poe2Data.result || []) {
      const { error } = await supabase.from("poe_leagues").upsert(
        {
          game: "poe2",
          league_id: league.id,
          name: league.text || league.id,
          start_at: null,
          end_at: null,
          is_active: true,
        },
        {
          onConflict: "game,league_id",
        },
      );

      if (error) {
        console.error(`Failed to upsert PoE2 league ${league.id}:`, error);
      } else {
        totalSynced++;
      }
    }

    console.log(`Synced ${totalSynced - poe2Count} PoE2 leagues`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSynced,
        poe1Count: poe2Count,
        poe2Count: totalSynced - poe2Count,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in sync-leagues-legacy-internal:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
