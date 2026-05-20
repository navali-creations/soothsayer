import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorize, responseJson } from "../_shared/utils.ts";

type Body = { game?: "poe1" | "poe2"; league?: string };

const FLAT_RESPONSE_MIN_APP_VERSION = "0.17.1";

type CardPricePayload = {
  chaosValue: number;
  divineValue: number;
  confidence: number;
};

type LegacyStashPricePayload = CardPricePayload & {
  rarity: 0;
};

function parseVersion(version: string | null): [number, number, number] | null {
  if (!version) return null;

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isAtLeastVersion(version: string | null, minimum: string): boolean {
  const parsed = parseVersion(version);
  const minimumParsed = parseVersion(minimum);
  if (!parsed || !minimumParsed) return false;

  for (let i = 0; i < parsed.length; i++) {
    if (parsed[i] > minimumParsed[i]) return true;
    if (parsed[i] < minimumParsed[i]) return false;
  }

  return true;
}

Deno.serve(async (req: Request) => {
  const authResult = await authorize({
    req,
    endpoint: "get-latest-snapshot",
    windowMs: 4 * 60 * 60 * 1000, // 4h
    maxHits: 10,
  });

  if (authResult instanceof Response) return authResult;

  const token = authResult;

  const body = (await req.json().catch(() => ({}))) as Body;
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

  const { data: league, error: leagueError } = await supabase
    .from("poe_leagues")
    .select("id")
    .eq("game", game)
    .eq("league_id", leagueId)
    .single();

  if (leagueError || !league)
    return responseJson({ status: 404, body: { error: "League not found" } });

  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .select(
      "id, league_id, fetched_at, exchange_chaos_to_divine, stacked_deck_chaos_cost, stacked_deck_max_volume_rate",
    )
    .eq("league_id", league.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (snapshotError || !snapshot)
    return responseJson({
      status: 404,
      body: { error: "No snapshot found for this league" },
    });

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

  const prices: Record<string, CardPricePayload> = {};

  for (const price of cardPrices ?? []) {
    const cardName = (price as any).cards?.name;
    if (!cardName) continue; // skip orphaned prices

    const priceData = {
      chaosValue: price.chaos_value,
      divineValue: price.divine_value,
      confidence: price.confidence ?? 1,
    };
    prices[cardName] = priceData;
  }

  const responseSnapshot = {
    id: snapshot.id,
    leagueId: snapshot.league_id,
    fetchedAt: snapshot.fetched_at,
    exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
    stackedDeckChaosCost: snapshot.stacked_deck_chaos_cost ?? 0,
    stackedDeckMaxVolumeRate: snapshot.stacked_deck_max_volume_rate ?? null,
  };

  const appVersion = req.headers.get("x-app-version");
  const shouldReturnFlatResponse = isAtLeastVersion(
    appVersion,
    FLAT_RESPONSE_MIN_APP_VERSION,
  );

  if (!shouldReturnFlatResponse) {
    const legacyStashPrices: Record<string, LegacyStashPricePayload> = {};

    for (const [cardName, price] of Object.entries(prices)) {
      legacyStashPrices[cardName] = {
        ...price,
        // Older clients derive rarity 0 from confidence=3; keep an explicit
        // rarity field for compatibility with any direct response consumers.
        confidence: 3,
        rarity: 0,
      };
    }

    return responseJson({
      status: 200,
      body: {
        snapshot: {
          ...responseSnapshot,
          stashChaosToDivine: snapshot.exchange_chaos_to_divine,
        },
        cardPrices: {
          exchange: prices,
          stash: legacyStashPrices,
        },
      },
      headers: { "Cache-Control": "private, max-age=14400" }, // 4 hours cache
    });
  }

  return responseJson({
    status: 200,
    body: {
      snapshot: responseSnapshot,
      cardPrices: prices,
    },
    headers: { "Cache-Control": "private, max-age=14400" }, // 4 hours cache
  });
});
