import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper function to check if a league should be filtered out
function shouldFilterLeague(league: any): boolean {
  // Filter Solo leagues (PoE1 only has rules)
  const hasSolo = league.rules?.some((rule: any) => rule.name === "Solo");
  if (hasSolo) return true;

  // Filter HC/Hardcore/Ruthless leagues
  const leagueId = league.id.toLowerCase();
  const leagueName = (league.name || league.text || league.id).toLowerCase();

  return (
    leagueId.includes("hardcore") ||
    leagueId.includes(" hc") ||
    leagueName.includes("hardcore") ||
    leagueName.includes(" hc") ||
    leagueName.includes("hc") ||
    leagueId.includes("hc") ||
    leagueId.includes("ruthless") ||
    leagueName.includes("ruthless")
  );
}

serve(async (req) => {
  try {
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
      }
    );

    // Fetch PoE1 leagues
    console.log("Fetching PoE1 leagues...");
    const poe1Response = await fetch(
      "https://www.pathofexile.com/api/leagues",
      {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Supabase Edge Function) (contact: eskrzy@gmail.com)",
        },
      }
    );

    if (!poe1Response.ok) {
      throw new Error(`PoE1 API failed: ${poe1Response.statusText}`);
    }

    const poe1Leagues = await poe1Response.json();

    // Fetch PoE2 leagues
    console.log("Fetching PoE2 leagues...");
    const poe2Response = await fetch(
      "https://www.pathofexile.com/api/trade2/data/leagues",
      {
        headers: {
          "User-Agent":
            "Soothsayer/1.0.0 (Supabase Edge Function) (contact: eskrzy@gmail.com)",
        },
      }
    );

    if (!poe2Response.ok) {
      throw new Error(`PoE2 API failed: ${poe2Response.statusText}`);
    }

    const poe2Data = await poe2Response.json();

    // Process all leagues with game metadata
    const allLeagues = [
      ...poe1Leagues.map((league: any) => ({
        game: "poe1",
        league_id: league.id,
        name: league.name || league.id,
        start_at: league.startAt || null,
        end_at: league.endAt || null,
        is_active: !league.endAt || new Date(league.endAt) > new Date(),
        raw: league,
      })),
      ...(poe2Data.result || []).map((league: any) => ({
        game: "poe2",
        league_id: league.id,
        name: league.text || league.id,
        start_at: null,
        end_at: null,
        is_active: true,
        raw: league,
      })),
    ];

    // Filter out unwanted leagues and collect valid league IDs
    const validLeagues = allLeagues.filter(
      (league) => !shouldFilterLeague(league.raw)
    );

    const poe1LeagueIds = validLeagues
      .filter((l) => l.game === "poe1")
      .map((l) => l.league_id);
    const poe2LeagueIds = validLeagues
      .filter((l) => l.game === "poe2")
      .map((l) => l.league_id);

    // Upsert all valid leagues
    let totalSynced = 0;
    let poe1Count = 0;
    let poe2Count = 0;

    for (const league of validLeagues) {
      const { error } = await supabase.from("poe_leagues").upsert(
        {
          game: league.game,
          league_id: league.league_id,
          name: league.name,
          start_at: league.start_at,
          end_at: league.end_at,
          is_active: league.is_active,
        },
        {
          onConflict: "game,league_id",
        }
      );

      if (error) {
        console.error(
          `Failed to upsert ${league.game} league ${league.league_id}:`,
          error
        );
      } else {
        totalSynced++;
        if (league.game === "poe1") poe1Count++;
        else poe2Count++;
      }
    }

    // Delete stale leagues that are no longer in the API response
    let deletedCount = 0;

    // Delete stale PoE1 leagues
    if (poe1LeagueIds.length > 0) {
      const { error: deletePoe1Error, count: poe1DeletedCount } = await supabase
        .from("poe_leagues")
        .delete({ count: "exact" })
        .eq("game", "poe1")
        .not("league_id", "in", `(${poe1LeagueIds.join(",")})`);

      if (deletePoe1Error) {
        console.error("Failed to delete stale PoE1 leagues:", deletePoe1Error);
      } else {
        deletedCount += poe1DeletedCount || 0;
      }
    }

    // Delete stale PoE2 leagues
    if (poe2LeagueIds.length > 0) {
      const { error: deletePoe2Error, count: poe2DeletedCount } = await supabase
        .from("poe_leagues")
        .delete({ count: "exact" })
        .eq("game", "poe2")
        .not("league_id", "in", `(${poe2LeagueIds.join(",")})`);

      if (deletePoe2Error) {
        console.error("Failed to delete stale PoE2 leagues:", deletePoe2Error);
      } else {
        deletedCount += poe2DeletedCount || 0;
      }
    }

    console.log(
      `Synced ${poe1Count} PoE1 leagues and ${poe2Count} PoE2 leagues. Deleted ${deletedCount} stale leagues.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        totalSynced,
        poe1Count,
        poe2Count,
        deletedCount,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in sync-leagues-legacy-internal:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
