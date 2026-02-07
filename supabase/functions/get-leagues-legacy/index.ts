import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorize, responseJson } from "../_shared/utils.ts";

type Body = { game?: "poe1" | "poe2"; league?: string };

Deno.serve(async (req: Request) => {
  const authResult = await authorize({
    req,
    endpoint: "get-leagues-legacy",
    windowMs: 24 * 60 * 60 * 1000, // 24h
    maxHits: 1,
  });

  if (authResult instanceof Response) return authResult;

  const token = authResult;

  const body: Body = await req.json().catch(() => ({}));
  const game = body.game;
  const leagueId = body.league;

  if (!game || !leagueId)
    return responseJson({
      status: 400,
      body: { error: "Missing required parameters: game, league" },
    });
  if (!["poe1", "poe2"].includes(game))
    return responseJson({
      status: 400,
      body: { error: "Invalid game. Must be poe1 or poe2" },
    });
  if (leagueId.length > 80)
    return responseJson({ status: 400, body: { error: "Invalid league" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  // Query leagues from database
  const { data: leagues, error } = await supabase
    .from("poe_leagues")
    .select("*")
    .eq("game", game)
    .order("name", { ascending: true });

  if (error) {
    return responseJson({ status: 500, body: { error: error.message } });
  }

  // Format response
  const response = {
    leagues: (leagues || []).map((league) => ({
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
    headers: { "Cache-Control": "private, max-age=86400" },
  }); // 1 day
});
