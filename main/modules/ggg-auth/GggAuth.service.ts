import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import * as Sentry from "@sentry/electron/main";
import { app, ipcMain, safeStorage, shell } from "electron";

import {
  assertTrustedSender,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import pkgJson from "../../../package.json" with { type: "json" };
import { GggAuthChannel } from "./GggAuth.channels";

// ─── Constants ───────────────────────────────────────────────────────────────

const GGG_CLIENT_ID = import.meta.env.VITE_GGG_CLIENT_ID || "soothsayer";
const GGG_OAUTH_BASE = "https://www.pathofexile.com/oauth";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_EXPIRY_BUFFER_S = 300; // 5 minutes before expiry
const FETCH_TIMEOUT_MS = 10_000; // 10 seconds

const GGG_OAUTH_PROXY = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poe-oauth-callback`
  : null;

// When using the proxy, the redirect_uri is the proxy URL itself (without query params).
// When not using the proxy, fall back to the custom protocol.
const GGG_REDIRECT_URI = GGG_OAUTH_PROXY || "soothsayer://oauth/callback";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GggSession {
  access_token: string;
  refresh_token: string;
  username: string;
  sub: string; // GGG account UUID
  expires_at: number; // Unix timestamp (seconds)
}

interface GggTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  username: string;
  sub: string;
  refresh_token: string;
}

// ─── Secure Session Storage ──────────────────────────────────────────────────

/**
 * Secure session storage for GGG OAuth tokens using Electron's safeStorage API.
 * Uses OS-level encryption:
 * - Windows: DPAPI
 * - macOS: Keychain
 * - Linux: Secret Service API/libsecret
 */
class GggSecureSessionStorage {
  private sessionPath: string;

  constructor() {
    const userDataPath = app.getPath("userData");
    this.sessionPath = path.join(userDataPath, "ggg-session.enc");
  }

  /**
   * Save session data with OS-level encryption
   */
  save(session: GggSession): void {
    const sessionJson = JSON.stringify(session);

    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = safeStorage.encryptString(sessionJson);
        fs.writeFileSync(this.sessionPath, encrypted);
        // L1: Restrict session file to owner-only on Unix (Windows uses DPAPI)
        if (process.platform !== "win32") {
          fs.chmodSync(this.sessionPath, 0o600);
        }
        console.log("[GggAuth] Session encrypted and saved");
        return;
      } catch (error) {
        console.error("[GggAuth] Failed to encrypt session:", error);
        return;
      }
    }

    // Fallback for development without encryption
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[GggAuth] Encryption not available - storing in plaintext (DEV ONLY)",
      );
      fs.writeFileSync(this.sessionPath, sessionJson, "utf8");
      // L1: Restrict session file to owner-only on Unix (Windows uses DPAPI)
      if (process.platform !== "win32") {
        fs.chmodSync(this.sessionPath, 0o600);
      }
      return;
    }

    console.warn(
      "[GggAuth] Encryption not available and not in dev mode - session will not be persisted",
    );
  }

  /**
   * Load and decrypt session data
   */
  load(): GggSession | null {
    if (!fs.existsSync(this.sessionPath)) {
      return null;
    }

    try {
      const data = fs.readFileSync(this.sessionPath);

      let sessionJson: string;

      if (safeStorage.isEncryptionAvailable()) {
        try {
          sessionJson = safeStorage.decryptString(data);
          console.log("[GggAuth] Session decrypted and loaded");
        } catch (decryptError) {
          if (process.env.NODE_ENV === "development") {
            sessionJson = data.toString("utf8");
            console.warn("[GggAuth] Loaded plaintext session (DEV ONLY)");
          } else {
            throw decryptError;
          }
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          sessionJson = data.toString("utf8");
          console.warn("[GggAuth] Loaded plaintext session (DEV ONLY)");
        } else {
          console.warn("[GggAuth] Cannot decrypt - encryption not available");
          return null;
        }
      }

      return JSON.parse(sessionJson) as GggSession;
    } catch (error) {
      console.error("[GggAuth] Failed to load session:", error);
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
        console.log("[GggAuth] Session deleted");
      } catch (error) {
        console.error("[GggAuth] Failed to delete session:", error);
      }
    }
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

class GggAuthService {
  private static _instance: GggAuthService;
  private sessionStorage: GggSecureSessionStorage;

  // Pending OAuth flow state
  private pendingState: string | null = null;
  private pendingVerifier: string | null = null;
  private pendingResolve:
    | ((value: {
        success: boolean;
        username?: string;
        accountId?: string;
      }) => void)
    | null = null;
  private pendingReject: ((reason: Error) => void) | null = null;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  static getInstance(): GggAuthService {
    if (!GggAuthService._instance) {
      GggAuthService._instance = new GggAuthService();
    }
    return GggAuthService._instance;
  }

  private constructor() {
    this.sessionStorage = new GggSecureSessionStorage();
    this.setupHandlers();

    // L10: Warn when running in production without the OAuth server-side proxy
    if (app.isPackaged && !GGG_OAUTH_PROXY) {
      console.error(
        "[GggAuth] WARNING: Running in production without OAuth proxy. " +
          "VITE_SUPABASE_URL is not configured. GGG OAuth will use direct PKCE flow " +
          "without server-side token exchange.",
      );
    }
  }

  // ─── IPC Handlers ────────────────────────────────────────────────────

  private setupHandlers(): void {
    ipcMain.handle(GggAuthChannel.GetAuthStatus, async () => {
      try {
        const session = this.sessionStorage.load();
        if (!session) {
          return {
            authenticated: false,
            username: null,
            accountId: null,
          };
        }
        return {
          authenticated: true,
          username: session.username,
          accountId: session.sub,
        };
      } catch (error) {
        console.error("[GggAuth] Failed to get auth status:", error);
        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          {
            tags: { module: "ggg-auth", operation: "get-auth-status" },
          },
        );
        return {
          authenticated: false,
          username: null,
          accountId: null,
        };
      }
    });

    ipcMain.handle(GggAuthChannel.Authenticate, async (event) => {
      try {
        assertTrustedSender(event, GggAuthChannel.Authenticate);
        return await this.authenticate();
      } catch (error) {
        console.error("[GggAuth] Authentication failed:", error);
        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          {
            tags: { module: "ggg-auth", operation: "authenticate" },
          },
        );
        return (
          handleValidationError(error, GggAuthChannel.Authenticate) ?? {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Authentication failed. Please try again.",
          }
        );
      }
    });

    ipcMain.handle(GggAuthChannel.Logout, async (event) => {
      try {
        assertTrustedSender(event, GggAuthChannel.Logout);
        this.logout();
        return { success: true };
      } catch (error) {
        console.error("[GggAuth] Logout failed:", error);
        Sentry.captureException(
          error instanceof Error ? error : new Error(String(error)),
          {
            tags: { module: "ggg-auth", operation: "logout" },
          },
        );
        return { success: false };
      }
    });
  }

  // ─── PKCE Helpers ────────────────────────────────────────────────────

  /**
   * Generate a PKCE code verifier: 32 random bytes → base64url (no padding)
   */
  private generateCodeVerifier(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Generate a PKCE code challenge: SHA-256(verifier) → base64url (no padding)
   */
  private generateCodeChallenge(verifier: string): string {
    return crypto.createHash("sha256").update(verifier).digest("base64url");
  }

  /**
   * Generate a random state parameter: 32 random bytes → hex
   */
  private generateState(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // ─── OAuth Flow ──────────────────────────────────────────────────────

  /**
   * Start the OAuth authentication flow.
   * Opens the user's browser to the GGG authorization page and returns a
   * promise that resolves when the callback is received.
   */
  public authenticate(): Promise<{
    success: boolean;
    username?: string;
    accountId?: string;
  }> {
    // Abort any in-progress flow
    this.cleanupPendingAuth("New authentication started");

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.generateCodeChallenge(codeVerifier);
    const state = this.generateState();

    this.pendingVerifier = codeVerifier;
    this.pendingState = state;

    let authorizeUrl: string;

    if (GGG_OAUTH_PROXY) {
      // Use the edge function proxy — it adds client_id, redirect_uri, etc.
      const params = new URLSearchParams({
        action: "authorize",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        scope: "account:profile",
      });
      authorizeUrl = `${GGG_OAUTH_PROXY}?${params.toString()}`;
    } else {
      // Direct flow (fallback when Supabase not configured)
      const params = new URLSearchParams({
        client_id: GGG_CLIENT_ID,
        response_type: "code",
        scope: "account:profile",
        state,
        redirect_uri: GGG_REDIRECT_URI,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });
      authorizeUrl = `${GGG_OAUTH_BASE}/authorize?${params.toString()}`;
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      // Set a 5-minute timeout for the callback
      this.pendingTimeout = setTimeout(() => {
        this.cleanupPendingAuth();
        reject(new Error("Authentication timed out. Please try again."));
      }, AUTH_TIMEOUT_MS);

      console.log("[GggAuth] Opening browser for authorization");
      shell.openExternal(authorizeUrl).catch((err) => {
        this.cleanupPendingAuth();
        reject(
          new Error(
            `Failed to open browser: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
      });
    });
  }

  /**
   * Handle the OAuth callback from the custom protocol.
   * Called by App.service when `soothsayer://oauth/callback?code=...&state=...` is received.
   */
  public async handleCallback(url: string): Promise<void> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      console.error("[GggAuth] Invalid callback URL:", url);
      this.rejectPending(new Error("Invalid callback URL"));
      return;
    }

    const code = parsedUrl.searchParams.get("code");
    const state = parsedUrl.searchParams.get("state");

    if (!code || !state) {
      console.error("[GggAuth] Missing code or state in callback");
      this.rejectPending(
        new Error("Invalid callback: missing code or state parameter"),
      );
      return;
    }

    // Validate that we have a pending auth flow
    if (!this.pendingState || !this.pendingVerifier || !this.pendingResolve) {
      console.error("[GggAuth] No pending auth flow for callback");
      return;
    }

    // Constant-time state comparison to prevent timing attacks
    const stateBuffer = Buffer.from(state, "utf8");
    const pendingStateBuffer = Buffer.from(this.pendingState, "utf8");

    if (
      stateBuffer.length !== pendingStateBuffer.length ||
      !crypto.timingSafeEqual(stateBuffer, pendingStateBuffer)
    ) {
      console.error("[GggAuth] State mismatch — possible CSRF attack");
      this.rejectPending(new Error("State mismatch. Please try again."));
      return;
    }

    // Exchange authorization code for tokens
    try {
      const tokenResponse = await this.exchangeCodeForTokens(
        code,
        this.pendingVerifier,
      );

      const session: GggSession = {
        access_token: tokenResponse.access_token,
        refresh_token: tokenResponse.refresh_token,
        username: tokenResponse.username,
        sub: tokenResponse.sub,
        expires_at: Math.floor(Date.now() / 1000) + tokenResponse.expires_in,
      };

      this.sessionStorage.save(session);

      console.log(
        `[GggAuth] Authentication successful for user: ${session.username}`,
      );

      // Fire-and-forget: link GGG account to existing community upload records.
      // Lazy import to avoid circular dependency (CommunityUpload → GggAuth → CommunityUpload).
      import("~/main/modules/community-upload/CommunityUpload.service")
        .then(({ CommunityUploadService }) =>
          CommunityUploadService.getInstance().linkGggAccount(),
        )
        .catch((err) => {
          console.error("[GggAuth] Failed to trigger GGG account link:", err);
        });

      const resolve = this.pendingResolve;
      this.cleanupPendingAuth();
      resolve({
        success: true,
        username: session.username,
        accountId: session.sub,
      });
    } catch (error) {
      console.error("[GggAuth] Token exchange failed:", error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { module: "ggg-auth", operation: "token-exchange" },
        },
      );
      this.rejectPending(
        new Error(
          `Token exchange failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }
  }

  /**
   * Exchange an authorization code for access + refresh tokens.
   */
  private async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
  ): Promise<GggTokenResponse> {
    if (GGG_OAUTH_PROXY) {
      // Use the edge function proxy for token exchange
      const response = await fetch(`${GGG_OAUTH_PROXY}?action=exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `OAuth soothsayer/${pkgJson.version} (contact: soothsayer.app)`,
        },
        body: JSON.stringify({ code, code_verifier: codeVerifier }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(
          `Token endpoint returned ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as GggTokenResponse;

      if (!data.access_token || !data.refresh_token) {
        throw new Error("Token response missing required fields");
      }

      return data;
    }

    // Direct flow fallback (no proxy)
    const body = new URLSearchParams({
      client_id: GGG_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: GGG_REDIRECT_URI,
      scope: "account:profile",
      code_verifier: codeVerifier,
    });

    const response = await fetch(`${GGG_OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `OAuth soothsayer/${pkgJson.version} (contact: soothsayer.app)`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(
        `Token endpoint returned ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as GggTokenResponse;

    if (!data.access_token || !data.refresh_token) {
      throw new Error("Token response missing required fields");
    }

    return data;
  }

  // ─── Token Access & Refresh ──────────────────────────────────────────

  /**
   * Get a valid access token, refreshing if necessary.
   * Returns null if no session exists or refresh fails (caller should proceed as anonymous).
   */
  public async getAccessToken(): Promise<string | null> {
    const session = this.sessionStorage.load();

    if (!session) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    // Token still valid (with buffer)
    if (session.expires_at - TOKEN_EXPIRY_BUFFER_S > nowSeconds) {
      return session.access_token;
    }

    // Token expired or about to expire — attempt refresh
    console.log("[GggAuth] Access token expired, attempting refresh");

    try {
      const refreshed = await this.refreshAccessToken(session.refresh_token);

      const updatedSession: GggSession = {
        ...session,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + refreshed.expires_in,
      };

      this.sessionStorage.save(updatedSession);
      console.log("[GggAuth] Token refresh successful");

      return updatedSession.access_token;
    } catch (error) {
      // Refresh failed (e.g., refresh token expired after 7 days)
      console.error("[GggAuth] Token refresh failed:", error);
      Sentry.captureException(
        error instanceof Error ? error : new Error(String(error)),
        {
          tags: { module: "ggg-auth", operation: "token-refresh" },
          extra: { username: session.username, sub: session.sub },
        },
      );

      // Delete the invalid session — don't throw, caller proceeds as anonymous
      this.sessionStorage.delete();
      return null;
    }
  }

  /**
   * Refresh the access token using the refresh token.
   */
  private async refreshAccessToken(
    refreshToken: string,
  ): Promise<GggTokenResponse> {
    if (GGG_OAUTH_PROXY) {
      // Use the edge function proxy for token refresh
      const response = await fetch(`${GGG_OAUTH_PROXY}?action=refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `OAuth soothsayer/${pkgJson.version} (contact: soothsayer.app)`,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown");
        throw new Error(
          `Token refresh returned ${response.status}: ${errorText}`,
        );
      }

      const data = (await response.json()) as GggTokenResponse;

      if (!data.access_token || !data.refresh_token) {
        throw new Error("Token refresh response missing required fields");
      }

      return data;
    }

    // Direct flow fallback (no proxy)
    const body = new URLSearchParams({
      client_id: GGG_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });

    const response = await fetch(`${GGG_OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `OAuth soothsayer/${pkgJson.version} (contact: soothsayer.app)`,
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "unknown");
      throw new Error(
        `Token refresh returned ${response.status}: ${errorText}`,
      );
    }

    const data = (await response.json()) as GggTokenResponse;

    if (!data.access_token || !data.refresh_token) {
      throw new Error("Token refresh response missing required fields");
    }

    return data;
  }

  // ─── Logout ──────────────────────────────────────────────────────────

  /**
   * Log out by deleting the stored session and clearing in-memory state.
   */
  public logout(): void {
    this.sessionStorage.delete();
    this.cleanupPendingAuth("User logged out");
    console.log("[GggAuth] Logged out");
  }

  // ─── Internal Helpers ────────────────────────────────────────────────

  /**
   * Clean up any pending authentication flow state.
   */
  private cleanupPendingAuth(reason?: string): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }

    if (reason && this.pendingReject) {
      // Don't reject — just log. The new flow will take over.
      console.log(`[GggAuth] Pending auth cancelled: ${reason}`);
    }

    this.pendingState = null;
    this.pendingVerifier = null;
    this.pendingResolve = null;
    this.pendingReject = null;
  }

  /**
   * Reject the pending auth promise and clean up.
   */
  private rejectPending(error: Error): void {
    const reject = this.pendingReject;
    this.cleanupPendingAuth();
    if (reject) {
      reject(error);
    }
  }
}

export type { GggSession };
export { GggAuthService };
