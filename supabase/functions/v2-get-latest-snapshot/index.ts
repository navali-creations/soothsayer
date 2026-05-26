import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  authorizeV2,
  createAdminClient,
  responseJson,
} from "../_shared/utils.ts";

type Body = { game?: "poe1" | "poe2"; league?: string };

type SnapshotRow = {
  id: string;
  league_id: string;
  fetched_at: string;
  exchange_chaos_to_divine: number;
  stacked_deck_chaos_cost: number | null;
  stacked_deck_max_volume_rate: number | null;
};

type CardPriceRow = {
  cards?: { name?: string } | null;
  chaos_value: number;
  divine_value: number;
  confidence: number | null;
};

Deno.serve(async (req: Request) => {
  const authResult = await authorizeV2({
    req,
    endpoint: "v2-get-latest-snapshot",
    windowMs: 4 * 60 * 60 * 1000,
    maxHits: 10,
  });

  if (authResult instanceof Response) return authResult;

  const body = (await req.json().catch(() => ({}))) as Body;
  const game = body.game;
  const leagueId = body.league;

  if (!game || !leagueId) {
    return responseJson({
      status: 400,
      body: { error: "Missing required parameters: game, league" },
    });
  }

  if (!["poe1", "poe2"].includes(game)) {
    return responseJson({
      status: 400,
      body: { error: "Invalid game. Must be poe1 or poe2" },
    });
  }

  if (leagueId.length > 80) {
    return responseJson({ status: 400, body: { error: "Invalid league" } });
  }

  const supabase = createAdminClient();

  const { data: league, error: leagueError } = await supabase
    .from("poe_leagues")
    .select("id")
    .eq("game", game)
    .eq("league_id", leagueId)
    .single();

  if (leagueError || !league) {
    return responseJson({ status: 404, body: { error: "League not found" } });
  }

  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .select(
      "id, league_id, fetched_at, exchange_chaos_to_divine, stacked_deck_chaos_cost, stacked_deck_max_volume_rate",
    )
    .eq("league_id", league.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (snapshotError || !snapshot) {
    return responseJson({
      status: 404,
      body: { error: "No snapshot found for this league" },
    });
  }

  const { data: cardPrices, error: pricesError } = await supabase
    .from("card_prices")
    .select("card_id, cards(name), chaos_value, divine_value, confidence")
    .eq("snapshot_id", snapshot.id);

  if (pricesError) {
    console.error("Failed to fetch snapshot card prices", pricesError);
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch snapshot card prices" },
    });
  }

  const prices: Record<
    string,
    { chaosValue: number; divineValue: number; confidence: number }
  > = {};

  for (const price of (cardPrices ?? []) as CardPriceRow[]) {
    const cardName = price.cards?.name;
    if (!cardName) continue;

    prices[cardName] = {
      chaosValue: price.chaos_value,
      divineValue: price.divine_value,
      confidence: price.confidence ?? 1,
    };
  }

  const latestSnapshot = snapshot as SnapshotRow;

  return responseJson({
    status: 200,
    body: {
      snapshot: {
        id: latestSnapshot.id,
        leagueId: latestSnapshot.league_id,
        fetchedAt: latestSnapshot.fetched_at,
        exchangeChaosToDivine: latestSnapshot.exchange_chaos_to_divine,
        stackedDeckChaosCost: latestSnapshot.stacked_deck_chaos_cost ?? 0,
        stackedDeckMaxVolumeRate:
          latestSnapshot.stacked_deck_max_volume_rate ?? null,
      },
      cardPrices: prices,
    },
    headers: { "Cache-Control": "private, max-age=14400" },
  });
});
