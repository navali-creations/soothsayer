import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  authorizeV2,
  createAdminClient,
  responseJson,
} from "../_shared/utils.ts";

type Body = { game?: "poe1" | "poe2" };

type LeagueRow = {
  id: string;
  game: "poe1" | "poe2";
  league_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
  updated_at: string | null;
};

Deno.serve(async (req: Request) => {
  const authResult = await authorizeV2({
    req,
    endpoint: "v2-get-leagues",
    windowMs: 24 * 60 * 60 * 1000,
    maxHits: 4,
  });

  if (authResult instanceof Response) return authResult;

  const body: Body = await req.json().catch(() => ({}));
  const game = body.game;

  if (!game) {
    return responseJson({
      status: 400,
      body: { error: "Missing required parameter: game" },
    });
  }

  if (!["poe1", "poe2"].includes(game)) {
    return responseJson({
      status: 400,
      body: { error: "Invalid game. Must be poe1 or poe2" },
    });
  }

  const supabase = createAdminClient();

  const { data: leagues, error } = await supabase
    .from("poe_leagues")
    .select(
      "id, game, league_id, name, start_at, end_at, is_active, updated_at",
    )
    .eq("game", game)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch leagues", error);
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch leagues" },
    });
  }

  return responseJson({
    status: 200,
    body: {
      leagues: ((leagues ?? []) as LeagueRow[]).map((league) => ({
        id: league.id,
        game: league.game,
        leagueId: league.league_id,
        name: league.name,
        startAt: league.start_at,
        endAt: league.end_at,
        isActive: league.is_active,
        updatedAt: league.updated_at,
      })),
    },
    headers: { "Cache-Control": "private, max-age=86400" },
  });
});
