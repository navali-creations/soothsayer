import fs from "node:fs";
import path from "node:path";
import {
  createClient,
  type SupabaseClient as SupabaseClientType,
} from "@supabase/supabase-js";
import type { SessionPriceSnapshot } from "@types/data-stores";
import { app, safeStorage } from "electron";

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
 * Minimal session data for persistence
 * Only store what's needed to restore the session
 */
interface AuthSessionStore {
  access_token: string;
  refresh_token: string;
  user_id: string; // For debugging
}

/**
 * Secure session storage using Electron's safeStorage API
 * Uses OS-level encryption:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: Secret Service API/libsecret
 */
class SecureSessionStorage {
  private sessionPath: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.sessionPath = path.join(userDataPath, "supabase-session.enc");
  }

  /**
   * Save session data with OS-level encryption
   */
  save(session: AuthSessionStore): void {
    const sessionJson = JSON.stringify(session);

    // Use OS-level encryption if available
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(sessionJson);
        fs.writeFileSync(this.sessionPath, encrypted);
        console.log("[SecureSessionStorage] Session encrypted and saved");
        return;
      } catch (error) {
        console.error("[SecureSessionStorage] Failed to save session:", error);
        return;
      }
    }

    // Fallback for Linux without secret service
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[SecureSessionStorage] Encryption not available - storing in plaintext (DEV ONLY)",
      );
      fs.writeFileSync(this.sessionPath, sessionJson, "utf8");
      return;
    }

    console.warn(
      "[SecureSessionStorage] Encryption not available and not in dev mode - session will not be persisted",
    );
  }

  /**
   * Load and decrypt session data
   */
  load(): AuthSessionStore | null {
    if (!fs.existsSync(this.sessionPath)) {
      return null;
    }

    try {
      // Read as binary buffer - returns Buffer by default
      const data = fs.readFileSync(this.sessionPath);

      let sessionJson: string;

      // Try decryption first (normal case)
      if (safeStorage.isEncryptionAvailable()) {
        try {
          sessionJson = safeStorage.decryptString(data);
          console.log("[SecureSessionStorage] Session decrypted and loaded");
        } catch (decryptError) {
          // If decryption fails, might be plaintext from dev mode
          if (process.env.NODE_ENV === "development") {
            sessionJson = data.toString("utf8");
            console.warn(
              "[SecureSessionStorage] Loaded plaintext session (DEV ONLY)",
            );
          } else {
            throw decryptError;
          }
        }
      } else {
        // No encryption available - read as plaintext (dev mode only)
        if (process.env.NODE_ENV === "development") {
          sessionJson = data.toString("utf8");
          console.warn(
            "[SecureSessionStorage] Loaded plaintext session (DEV ONLY)",
          );
        } else {
          console.warn(
            "[SecureSessionStorage] Cannot decrypt - encryption not available",
          );
          return null;
        }
      }

      return JSON.parse(sessionJson) as AuthSessionStore;
    } catch (error) {
      console.error("[SecureSessionStorage] Failed to load session:", error);
      // Clean up corrupted session file
      this.delete();
      return null;
    }
  }

  /**
   * Delete stored session
   */
  delete(): void {
    if (fs.existsSync(this.sessionPath)) {
      try {
        fs.unlinkSync(this.sessionPath);
        console.log("[SecureSessionStorage] Session deleted");
      } catch (error) {
        console.error(
          "[SecureSessionStorage] Failed to delete session:",
          error,
        );
      }
    }
  }
}

/**
 * Service for interacting with Supabase (proxy for poe.ninja data)
 * This replaces direct calls to poe.ninja API
 */
class SupabaseClientService {
  private static _instance: SupabaseClientService;
  private client: SupabaseClientType | null = null;
  private sessionStorage: SecureSessionStorage;
  private cachedSnapshots: Map<
    string,
    { data: SessionPriceSnapshot; timestamp: number }
  > = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private authPromise: Promise<void> | null = null;
  private authStateListener: {
    data: { subscription: { unsubscribe: () => void } };
  } | null = null;
  // Store these for later use
  private supabaseUrl: string | null = null;
  private supabaseAnonKey: string | null = null;

  static getInstance(): SupabaseClientService {
    if (!SupabaseClientService._instance) {
      SupabaseClientService._instance = new SupabaseClientService();
    }
    return SupabaseClientService._instance;
  }

  private constructor() {
    // Use secure storage for session persistence
    this.sessionStorage = new SecureSessionStorage();
  }

  /**
   * Configure Supabase client with credentials and authenticate
   * Should be called at app startup
   */
  public async configure(url: string, anonKey: string): Promise<void> {
    if (!url || !anonKey) {
      console.error("[SupabaseClient] Missing Supabase credentials");
      return;
    }

    // Store for later use
    this.supabaseUrl = url;
    this.supabaseAnonKey = anonKey;

    this.client = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false, // We handle persistence manually
        detectSessionInUrl: false,
      },
    });

    console.log(
      "[SupabaseClient] Client created, attempting authentication...",
    );

    // Try to restore session or create new anonymous session
    await this.ensureAuthenticated();
  }

  /**
   * Ensure we have a valid authenticated session
   */
  private async ensureAuthenticated(): Promise<void> {
    if (!this.client) throw new Error("Supabase client not configured");

    // Return existing promise if already authenticating
    if (this.authPromise) return this.authPromise;

    this.authPromise = (async () => {
      const storedSession = this.sessionStorage.load();

      // If we have a stored session, try to restore it
      if (storedSession) {
        console.log("[SupabaseClient] Attempting to restore session...");
        const { data, error } = await this.client!.auth.setSession({
          access_token: storedSession.access_token,
          refresh_token: storedSession.refresh_token,
        });

        if (!error && data.session) {
          console.log("[SupabaseClient] Session restored successfully");
          this.storeSession(data.session);
          this.setupSessionListener();
          return;
        }

        console.log(
          "[SupabaseClient] Failed to restore session, creating new one...",
        );
      }

      // Otherwise sign in anonymously
      await this.signInAnonymously();
    })();

    try {
      await this.authPromise;
      const { data } = await this.client!.auth.getUser();
      console.log(`[SupabaseClient] Authenticated as user: ${data.user?.id}`);
    } finally {
      this.authPromise = null;
    }
  }

  /**
   * Sign in anonymously
   */
  private async signInAnonymously(): Promise<void> {
    if (!this.client) {
      throw new Error("Supabase client not configured");
    }

    console.log("[SupabaseClient] Signing in anonymously...");

    const { data, error } = await this.client.auth.signInAnonymously();

    if (error) {
      console.error("[SupabaseClient] Anonymous sign-in failed:", error);
      throw new Error(`Failed to authenticate: ${error.message}`);
    }

    if (!data.session) {
      throw new Error("No session returned from anonymous sign-in");
    }

    console.log("[SupabaseClient] Anonymous sign-in successful");

    // Store session for persistence
    this.storeSession(data.session);
    this.setupSessionListener();
  }

  /**
   * Store session data securely using OS-level encryption
   * Only stores what's needed to restore the session
   */
  private storeSession(session: any): void {
    const authSession: AuthSessionStore = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      user_id: session.user.id,
    };

    this.sessionStorage.save(authSession);
  }

  /**
   * Listen for session changes and persist them
   * Only registers the listener once
   */
  private setupSessionListener(): void {
    if (!this.client) return;
    if (this.authStateListener) return; // Already listening

    this.authStateListener = this.client.auth.onAuthStateChange(
      (event, session) => {
        console.log(`[SupabaseClient] Auth state changed: ${event}`);

        if (event === "SIGNED_OUT") {
          this.sessionStorage.delete();
        } else if (session) {
          this.storeSession(session);
        }
      },
    );
  }

  /**
   * Check if Supabase is configured and authenticated
   */
  public isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Get current auth status
   */
  public async getAuthStatus(): Promise<{
    isAuthenticated: boolean;
    userId?: string;
  }> {
    if (!this.client) {
      return { isAuthenticated: false };
    }

    const { data } = await this.client.auth.getSession();

    return {
      isAuthenticated: !!data.session,
      userId: data.session?.user.id,
    };
  }

  /**
   * Fetch the latest price snapshot for a league from Supabase
   * Requires authentication
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

    // Ensure we're authenticated before making the request
    await this.ensureAuthenticated();

    // Debug: Check current session
    const { data: sessionData, error: sessionError } =
      await this.client.auth.getSession();
    console.log("[SupabaseClient] Current session check:", {
      hasSession: !!sessionData.session,
      userId: sessionData.session?.user?.id,
      expiresAt: sessionData.session?.expires_at,
      tokenLength: sessionData.session?.access_token?.length,
      error: sessionError,
    });

    if (!sessionData.session) {
      console.error("[SupabaseClient] No active session found!");
      throw new Error("No active session. Authentication may have failed.");
    }

    // Verify the token is valid by testing getUser
    const { data: userData, error: userError } =
      await this.client.auth.getUser();
    console.log("[SupabaseClient] User verification:", {
      hasUser: !!userData.user,
      userId: userData.user?.id,
      userRole: userData.user?.role,
      error: userError,
    });

    if (userError || !userData.user) {
      console.error("[SupabaseClient] Token validation failed:", userError);
      // Try to re-authenticate
      console.log("[SupabaseClient] Attempting to re-authenticate...");
      this.sessionStorage.delete();
      this.authPromise = null;
      await this.ensureAuthenticated();

      // Try one more time
      const { data: retryUserData, error: retryUserError } =
        await this.client.auth.getUser();
      if (retryUserError || !retryUserData.user) {
        throw new Error("Authentication failed after retry");
      }
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
      // Get the current session token
      const { data: sessionData } = await this.client.auth.getSession();
      if (!sessionData.session) {
        throw new Error("No session available");
      }

      const accessToken = sessionData.session.access_token;

      if (!this.supabaseUrl || !this.supabaseAnonKey) {
        throw new Error("Supabase credentials not available");
      }

      console.log(
        "[SupabaseClient] Making Edge Function request with headers:",
        {
          hasApiKey: !!this.supabaseAnonKey,
          hasAuthToken: !!accessToken,
          tokenLength: accessToken.length,
        },
      );

      // Use raw fetch to ensure all headers are sent correctly
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/get-latest-snapshot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: this.supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ game, league: leagueId }),
        },
      );

      const responseText = await response.text();

      console.log("[SupabaseClient] Edge Function response:", {
        status: response.status,
        statusText: response.statusText,
        responseLength: responseText.length,
      });

      if (!response.ok) {
        console.error(
          "[SupabaseClient] Edge Function error response:",
          responseText,
        );
        throw new Error(
          `Edge Function failed (${response.status}): ${responseText}`,
        );
      }

      const data = JSON.parse(responseText) as SupabaseSnapshotResponse;

      if (!data) {
        console.error("[SupabaseClient] No data returned from Edge Function");
        throw new Error("No data returned from Supabase");
      }

      const responseData = data as SupabaseSnapshotResponse;

      // Validate response structure
      if (!responseData.snapshot || !responseData.cardPrices) {
        console.error(
          "[SupabaseClient] Invalid response structure:",
          responseData,
        );
        throw new Error("Invalid response structure from Supabase");
      }

      // Convert to SessionPriceSnapshot format
      const snapshot: SessionPriceSnapshot = {
        timestamp: responseData.snapshot.fetchedAt,
        exchange: {
          chaosToDivineRatio: responseData.snapshot.exchangeChaosToDivine,
          cardPrices: responseData.cardPrices.exchange,
        },
        stash: {
          chaosToDivineRatio: responseData.snapshot.stashChaosToDivine,
          cardPrices: responseData.cardPrices.stash,
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

    // Ensure we're authenticated
    await this.ensureAuthenticated();

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

  /**
   * Clear authentication and sign out
   */
  public async signOut(): Promise<void> {
    if (!this.client) return;

    // Unsubscribe from auth state changes
    if (this.authStateListener) {
      this.authStateListener.data.subscription.unsubscribe();
      this.authStateListener = null;
    }

    await this.client.auth.signOut();
    this.sessionStorage.delete();
    console.log("[SupabaseClient] Signed out");
  }
}

export { SupabaseClientService };
export type { SupabaseSnapshotResponse, SupabaseLeague };
