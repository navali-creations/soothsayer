import {
  createClient,
  SupabaseClient as SupabaseClientType,
} from "@supabase/supabase-js";
import type { SessionPriceSnapshot } from "../../../types/data-stores";

/**
 * Response from Supabase get-latest-snapshot Edge Function
 */
interface SupabaseSnapshotResponse {
  snapshot: {
    id: string;
    leagueId: string;
    fetchedAt: string;
    exchangeChaosToDivine: number;
    stashChaosToDivine: number;
  };
  cardPrices: {
    exchange: Record<
      string,
      {
        chaosValue: number;
        divineValue: number;
        stackSize?: number;
      }
    >;
    stash: Record<
      string,
      {
        chaosValue: number;
        divineValue: number;
        stackSize?: number;
      }
    >;
  };
}

/**
 * League data from Supabase
 */
interface SupabaseLeague {
  id: string;
  game: string;
  league_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
}

/**
 * Service for interacting with Supabase (proxy for poe.ninja data)
 * This replaces direct calls to poe.ninja API
 */
class SupabaseClientService {
  private static _instance: SupabaseClientService;
  private client: SupabaseClientType | null = null;
  private supabaseUrl: string | null = null;
  private supabaseAnonKey: string | null = null;
  private cachedSnapshots: Map<
    string,
    { data: SessionPriceSnapshot; timestamp: number }
  > = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): SupabaseClientService {
    if (!SupabaseClientService._instance) {
      SupabaseClientService._instance = new SupabaseClientService();
    }
    return SupabaseClientService._instance;
  }

  private constructor() {
    // Credentials will be set via configure()
  }

  /**
   * Configure Supabase client with credentials
   * Should be called at app startup
   */
  public configure(url: string, anonKey: string): void {
    if (!url || !anonKey) {
      console.error("[SupabaseClient] Missing Supabase credentials");
      return;
    }

    this.supabaseUrl = url;
    this.supabaseAnonKey = anonKey;
    this.client = createClient(url, anonKey);
    console.log("[SupabaseClient] Configured successfully");
  }

  /**
   * Check if Supabase is configured
   */
  public isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Fetch the latest price snapshot for a league from Supabase
   * This replaces the old poeNinja.getPriceSnapshot() call
   */
  public async getLatestSnapshot(
    game: "poe1" | "poe2",
    leagueId: string,
  ): Promise<SessionPriceSnapshot> {
    if (!this.client) {
      throw new Error(
        "Supabase client not configured. Call configure() first.",
      );
    }

    const cacheKey = `${game}:${leagueId}`;
    const now = Date.now();

    // Return cached data if fresh
    const cached = this.cachedSnapshots.get(cacheKey);
    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      console.log(`[SupabaseClient] Returning cached snapshot for ${cacheKey}`);
      return cached.data;
    }

    console.log(
      `[SupabaseClient] Fetching snapshot from Supabase for ${game}/${leagueId}...`,
    );

    try {
      const functionName = `get-latest-snapshot?game=${encodeURIComponent(game)}&league=${encodeURIComponent(leagueId)}`;

      // Call the Edge Function
      const { data, error } =
        await this.client.functions.invoke<SupabaseSnapshotResponse>(
          functionName,
          {
            method: "GET",
          },
        );

      if (error) {
        // Log detailed error information
        console.error("[SupabaseClient] Edge Function error details:", {
          message: error.message,
          context: error.context,
          name: error.name,
          functionName,
          game,
          leagueId,
        });
        throw new Error(`Supabase function error: ${error.message}`);
      }

      if (!data) {
        console.error("[SupabaseClient] No data returned from Edge Function");
        throw new Error("No data returned from Supabase");
      }

      // Validate response structure
      if (!data.snapshot || !data.cardPrices) {
        console.error("[SupabaseClient] Invalid response structure:", data);
        throw new Error("Invalid response structure from Supabase");
      }

      // Convert to SessionPriceSnapshot format
      const snapshot: SessionPriceSnapshot = {
        timestamp: data.snapshot.fetchedAt,
        exchange: {
          chaosToDivineRatio: data.snapshot.exchangeChaosToDivine,
          cardPrices: data.cardPrices.exchange,
        },
        stash: {
          chaosToDivineRatio: data.snapshot.stashChaosToDivine,
          cardPrices: data.cardPrices.stash,
        },
      };

      // Cache the result
      this.cachedSnapshots.set(cacheKey, { data: snapshot, timestamp: now });

      console.log(
        `[SupabaseClient] Fetched snapshot with ${Object.keys(snapshot.exchange.cardPrices).length} exchange + ${Object.keys(snapshot.stash.cardPrices).length} stash prices`,
      );

      return snapshot;
    } catch (error) {
      console.error("[SupabaseClient] Error fetching snapshot:", error);
      throw error;
    }
  }

  /**
   * Fetch available leagues from Supabase
   */
  public async getLeagues(game: "poe1" | "poe2"): Promise<SupabaseLeague[]> {
    if (!this.client) {
      throw new Error("Supabase client not configured");
    }

    const { data, error } = await this.client
      .from("poe_leagues")
      .select("*")
      .eq("game", game)
      .eq("is_active", true)
      .order("start_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch leagues: ${error.message}`);
    }

    return data || [];
  }
}

export { SupabaseClientService };
export type { SupabaseSnapshotResponse, SupabaseLeague };
