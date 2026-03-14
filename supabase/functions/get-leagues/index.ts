import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorize, responseJson } from "../_shared/utils.ts";

/**
 * get-leagues — Returns cached PoE leagues from the database.
 *
 * This is a thin read-only endpoint. League data is populated and kept
 * up-to-date by the `sync-leagues-internal` cron function which fetches
 * from GGG's official OAuth API.
 *
 * Rate limit: 4 requests per 24h per user.
 */

type Body = { game?: "poe1" | "poe2" };

Deno.serve(async (req: Request) => {
  const authResult = await authorize({
    req,
    endpoint: "get-leagues",
    windowMs: 24 * 60 * 60 * 1000, // 24h
    maxHits: 4,
  });

  if (authResult instanceof Response) return authResult;

  const token = authResult;

  const body: Body = await req.json().catch(() => ({}));
  const game = body.game;

  if (!game)
    return responseJson({
      status: 400,
      body: { error: "Missing required parameter: game" },
    });
  if (!["poe1", "poe2"].includes(game))
    return responseJson({
      status: 400,
      body: { error: "Invalid game. Must be poe1 or poe2" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  // Query leagues from database (populated by sync-leagues-internal cron)
  const { data: leagues, error } = await supabase
    .from("poe_leagues")
    .select("*")
    .eq("game", game)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return responseJson({ status: 500, body: { error: error.message } });
  }

  // Format response
  const response = {
    leagues: (leagues || []).map((league: any) => ({
      id: league.id,
      leagueId: league.league_id,
      name: league.name,
      startAt: league.start_at,
      endAt: league.end_at,
      isActive: league.is_active,
      updatedAt: league.updated_at,
    })),
  };

  return responseJson({
    status: 200,
    body: response,
    headers: { "Cache-Control": "private, max-age=86400" }, // 1 day
  });
});
