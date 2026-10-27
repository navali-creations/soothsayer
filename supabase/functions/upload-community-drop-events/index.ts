import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import {
  authorizeV2,
  createAdminClient,
  responseJson,
} from "../_shared/utils.ts";

const TAG = "[upload-community-drop-events]";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENTS = 500;
const MAX_BODY_BYTES = 256 * 1024;
const MAX_DISTINCT_LOCATIONS_PER_BATCH = 100;

interface DropEvent {
  event_id: string;
  card_name: string;
  location: string | null;
  local_minute: number;
  utc_offset_minutes: number;
}

interface RequestBody {
  league_id?: string;
  league_name?: string;
  game?: "poe1" | "poe2";
  device_id: string;
  events: DropEvent[];
}

function validateBody(
  body: unknown,
): { ok: true; data: RequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body" };
  }

  const value = body as Record<string, unknown>;
  const hasLeagueId =
    typeof value.league_id === "string" && value.league_id.length > 0;
  const hasLeagueName =
    typeof value.league_name === "string" && value.league_name.length > 0;
  const hasGame = value.game === "poe1" || value.game === "poe2";

  if (!hasLeagueId && !hasLeagueName) {
    return {
      ok: false,
      error: "Either league_id (UUID) or league_name + game must be provided",
    };
  }
  if (hasLeagueId && !UUID_RE.test(value.league_id as string)) {
    return { ok: false, error: "league_id must be a valid UUID string" };
  }
  if (hasLeagueName && !hasGame) {
    return {
      ok: false,
      error: 'game must be "poe1" or "poe2" when league_name is provided',
    };
  }
  if (
    hasLeagueName &&
    ((value.league_name as string).length > 200 ||
      (value.league_name as string).trim().length === 0)
  ) {
    return { ok: false, error: "league_name is invalid" };
  }
  if (typeof value.device_id !== "string" || !UUID_RE.test(value.device_id)) {
    return { ok: false, error: "device_id must be a valid UUID string" };
  }
  if (
    !Array.isArray(value.events) ||
    value.events.length === 0 ||
    value.events.length > MAX_EVENTS
  ) {
    return {
      ok: false,
      error: `events must contain between 1 and ${MAX_EVENTS} entries`,
    };
  }
  const eventIds = new Set<string>();
  const locations = new Set<string>();
  const events: DropEvent[] = [];
  for (let index = 0; index < value.events.length; index++) {
    const event = value.events[index];
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      return { ok: false, error: `events[${index}] is invalid` };
    }

    const row = event as Record<string, unknown>;
    if (typeof row.event_id !== "string" || !UUID_RE.test(row.event_id)) {
      return {
        ok: false,
        error: `events[${index}].event_id must be a valid UUID string`,
      };
    }
    if (eventIds.has(row.event_id)) {
      return { ok: false, error: "events contains duplicate event IDs" };
    }
    eventIds.add(row.event_id);

    if (
      typeof row.card_name !== "string" ||
      row.card_name.trim().length === 0 ||
      row.card_name.trim().length > 200
    ) {
      return { ok: false, error: `events[${index}].card_name is invalid` };
    }
    if (
      row.location !== null &&
      (typeof row.location !== "string" ||
        row.location.trim().length === 0 ||
        row.location.trim().length > 200)
    ) {
      return { ok: false, error: `events[${index}].location is invalid` };
    }
    if (
      typeof row.local_minute !== "number" ||
      !Number.isInteger(row.local_minute) ||
      row.local_minute < 0 ||
      row.local_minute > 1439
    ) {
      return { ok: false, error: `events[${index}].local_minute is invalid` };
    }
    if (
      typeof row.utc_offset_minutes !== "number" ||
      !Number.isInteger(row.utc_offset_minutes) ||
      row.utc_offset_minutes < -840 ||
      row.utc_offset_minutes > 840
    ) {
      return {
        ok: false,
        error: `events[${index}].utc_offset_minutes is invalid`,
      };
    }

    const location =
      typeof row.location === "string" ? row.location.trim() : null;
    if (location !== null) {
      locations.add(location);
      if (locations.size > MAX_DISTINCT_LOCATIONS_PER_BATCH) {
        return {
          ok: false,
          error: `events may contain at most ${MAX_DISTINCT_LOCATIONS_PER_BATCH} distinct locations`,
        };
      }
    }

    events.push({
      event_id: row.event_id,
      card_name: row.card_name.trim(),
      location,
      local_minute: row.local_minute,
      utc_offset_minutes: row.utc_offset_minutes,
    });
  }

  return {
    ok: true,
    data: {
      league_id: hasLeagueId ? (value.league_id as string) : undefined,
      league_name: hasLeagueName
        ? (value.league_name as string).trim()
        : undefined,
      game: hasGame ? (value.game as "poe1" | "poe2") : undefined,
      device_id: value.device_id,
      events,
    },
  };
}

async function readJsonBody(req: Request): Promise<unknown> {
  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new RangeError("Request body is too large");
  }

  if (!req.body) return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RangeError("Request body is too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

Deno.serve(async (req: Request) => {
  const authResult = await authorizeV2({
    req,
    endpoint: "upload-community-drop-events",
    windowMs: 60 * 60 * 1000,
    // Allows a 120k-event historical queue to drain in an hour while each
    // request remains capped at 500 validated rows.
    maxHits: 240,
  });
  if (authResult instanceof Response) return authResult;

  let rawBody: unknown;
  try {
    rawBody = await readJsonBody(req);
  } catch (error) {
    if (error instanceof RangeError) {
      return responseJson({ status: 413, body: { error: error.message } });
    }
    return responseJson({ status: 400, body: { error: "Invalid JSON body" } });
  }

  const validation = validateBody(rawBody);
  if (!validation.ok) {
    return responseJson({ status: 400, body: { error: validation.error } });
  }

  const supabase = createAdminClient();
  const {
    league_id: leagueId,
    league_name: leagueName,
    game,
    device_id: deviceId,
    events,
  } = validation.data;

  let league: { id: string } | null = null;
  let leagueError: unknown = null;
  if (leagueId) {
    const result = await supabase
      .from("poe_leagues")
      .select("id")
      .eq("id", leagueId)
      .single();
    league = result.data;
    leagueError = result.error;
  } else if (leagueName && game) {
    const result = await supabase
      .from("poe_leagues")
      .select("id")
      .eq("league_id", leagueName)
      .eq("game", game)
      .single();
    league = result.data;
    leagueError = result.error;
  }

  if (leagueError) {
    console.error(`${TAG} league lookup failed:`, leagueError);
    return responseJson({
      status: 500,
      body: { error: "Failed to resolve league" },
    });
  }
  if (!league) {
    return responseJson({ status: 404, body: { error: "League not found" } });
  }

  const { data: inserted, error: ingestError } = await supabase.rpc(
    "ingest_community_drop_events",
    {
      p_league_id: league.id,
      p_device_id: deviceId,
      p_events: events,
    },
  );
  if (ingestError) {
    console.error(`${TAG} event ingestion failed:`, ingestError);
    return responseJson({
      status: 500,
      body: { error: "Failed to ingest card-drop context" },
    });
  }
  if (
    typeof inserted !== "number" ||
    !Number.isInteger(inserted) ||
    inserted < 0 ||
    inserted > events.length
  ) {
    console.error(`${TAG} invalid ingestion result:`, inserted);
    return responseJson({
      status: 500,
      body: { error: "Invalid card-drop ingestion result" },
    });
  }

  return responseJson({
    status: 200,
    body: {
      success: true,
      accepted_events: events.length,
      inserted_events: inserted,
    },
  });
});
