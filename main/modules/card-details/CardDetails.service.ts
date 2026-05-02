import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import type { DivinationCardDTO } from "~/main/modules/divination-cards/DivinationCards.dto";
import { DivinationCardsService } from "~/main/modules/divination-cards/DivinationCards.service";
import { LoggerService } from "~/main/modules/logger";
import { MainWindowService } from "~/main/modules/main-window";
import { cardNameToSlug } from "~/types/card-slug";
import type { GameType } from "~/types/data-stores";

import { CardDetailsChannel } from "./CardDetails.channels";
import type {
  CardDetailsInitDTO,
  CardDropTimelinePointDTO,
  CardPersonalAnalyticsDTO,
  CardPriceHistoryDTO,
  LeagueDateRangeDTO,
  RelatedCardDTO,
  RelatedCardsResultDTO,
} from "./CardDetails.dto";
import {
  CardDetailsMapper,
  type PoeNinjaDetailsResponse,
} from "./CardDetails.mapper";
import { CardDetailsRepository } from "./CardDetails.repository";
import { buildPreparedDropTimeline } from "./CardDetails.utils";

/** Cache TTL: 30 minutes */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Lightweight runtime check for cached price history data.
 *
 * Guards against corrupt SQLite rows or schema drift between app versions.
 * We only verify the shape of the top-level fields that the renderer
 * relies on — a full Zod parse would be heavier than warranted here.
 */
function isValidCachedPriceHistory(data: unknown): data is CardPriceHistoryDTO {
  if (data == null || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.cardName === "string" &&
    typeof d.detailsId === "string" &&
    typeof d.game === "string" &&
    typeof d.league === "string" &&
    Array.isArray(d.priceHistory) &&
    typeof d.fetchedAt === "string"
  );
}

/** Approximate league duration fallback when end metadata is missing. */
const DEFAULT_LEAGUE_DURATION_MS = 4 * 30 * 24 * 60 * 60 * 1000;

function parseDateMs(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function resolveRangeEndDate(
  range: LeagueDateRangeDTO,
  allRanges: LeagueDateRangeDTO[],
): string {
  const explicitEndMs = parseDateMs(range.endDate);
  if (explicitEndMs !== undefined) {
    return range.endDate as string;
  }

  const startMs = parseDateMs(range.startDate);
  if (startMs === undefined) {
    return new Date().toISOString();
  }

  let nextStartMs: number | undefined;
  for (const candidate of allRanges) {
    const candidateStartMs = parseDateMs(candidate.startDate);
    if (candidateStartMs === undefined || candidateStartMs <= startMs) continue;
    nextStartMs =
      nextStartMs === undefined
        ? candidateStartMs
        : Math.min(nextStartMs, candidateStartMs);
  }

  if (nextStartMs !== undefined) {
    return new Date(nextStartMs).toISOString();
  }

  const approxEndMs = startMs + DEFAULT_LEAGUE_DURATION_MS;
  return new Date(Math.min(Date.now(), approxEndMs)).toISOString();
}

function resolveTimelineEndDate(
  leagueDateRanges: LeagueDateRangeDTO[],
  leagueFilter?: string,
): string {
  if (leagueDateRanges.length === 0) {
    return new Date().toISOString();
  }

  if (leagueFilter) {
    // Standard is permanent; align its chart end with the current challenge league window.
    if (leagueFilter.toLowerCase() === "standard") {
      const nonStandardRanges = leagueDateRanges.filter(
        (range) => range.name.toLowerCase() !== "standard",
      );
      if (nonStandardRanges.length > 0) {
        const sorted = [...nonStandardRanges].sort(
          (a, b) =>
            (parseDateMs(a.startDate) ?? Number.MAX_SAFE_INTEGER) -
            (parseDateMs(b.startDate) ?? Number.MAX_SAFE_INTEGER),
        );
        return resolveRangeEndDate(sorted[sorted.length - 1], leagueDateRanges);
      }
    }

    const selectedRange = leagueDateRanges.find(
      (range) => range.name === leagueFilter,
    );
    if (selectedRange) {
      return resolveRangeEndDate(selectedRange, leagueDateRanges);
    }

    return new Date().toISOString();
  }

  // All-leagues view: bound to the most recent league in history.
  const sorted = [...leagueDateRanges].sort(
    (a, b) =>
      (parseDateMs(a.startDate) ?? Number.MAX_SAFE_INTEGER) -
      (parseDateMs(b.startDate) ?? Number.MAX_SAFE_INTEGER),
  );
  return resolveRangeEndDate(sorted[sorted.length - 1], leagueDateRanges);
}

/**
 * Derive the poe.ninja `detailsId` slug from a card name.
 *
 * This is intentionally an alias for the shared `cardNameToSlug` so that
 * call-sites in this module retain a domain-meaningful name while the
 * slug logic itself is defined in exactly one place.
 *
 * @see ~/types/card-slug — single source of truth
 */
export const cardNameToDetailsId = cardNameToSlug;

/**
 * Singleton service for the card-details module.
 *
 * Responsibilities:
 * 1. Handle IPC requests for price history data.
 * 2. Fetch card exchange details from poe.ninja.
 * 3. Cache responses in SQLite for offline support (30-min TTL).
 * 4. Serve cached data when poe.ninja is unreachable.
 */
class CardDetailsService {
  private static _instance: CardDetailsService;
  private readonly logger = LoggerService.createLogger("CardDetails");
  private readonly repository: CardDetailsRepository;
  private readonly cardSlugCache = new Map<
    GameType,
    Map<string, DivinationCardDTO>
  >();

  static getInstance(): CardDetailsService {
    if (!CardDetailsService._instance) {
      CardDetailsService._instance = new CardDetailsService();
    }
    return CardDetailsService._instance;
  }

  private constructor() {
    const database = DatabaseService.getInstance();
    this.repository = new CardDetailsRepository(database.getKysely());

    this.setupIpcHandlers();

    this.logger.log("Service initialized");
  }

  // ─── IPC Handlers ────────────────────────────────────────────────────────

  private setupIpcHandlers(): void {
    ipcMain.handle(
      CardDetailsChannel.GetPriceHistory,
      async (
        _event: Electron.IpcMainInvokeEvent,
        game: GameType,
        league: string,
        cardName: string,
      ): Promise<CardPriceHistoryDTO | null> => {
        // Validate inputs
        if (!game || !league || !cardName) {
          this.logger.warn("GetPriceHistory called with missing parameters:", {
            game,
            league,
            cardName,
          });
          return null;
        }

        if (game !== "poe1" && game !== "poe2") {
          this.logger.warn("GetPriceHistory called with invalid game:", game);
          return null;
        }

        return this.getPriceHistory(game, league, cardName);
      },
    );

    ipcMain.handle(
      CardDetailsChannel.GetPersonalAnalytics,
      async (
        _event: Electron.IpcMainInvokeEvent,
        game: GameType,
        league: string,
        cardName: string,
        selectedLeague?: string,
      ): Promise<CardPersonalAnalyticsDTO | null> => {
        if (!game || !league || !cardName) {
          this.logger.warn(
            "GetPersonalAnalytics called with missing parameters:",
            { game, league, cardName },
          );
          return null;
        }

        if (game !== "poe1" && game !== "poe2") {
          this.logger.warn(
            "GetPersonalAnalytics called with invalid game:",
            game,
          );
          return null;
        }

        try {
          const card = await this.repository.findCardByName(game, cardName);
          if (!card) {
            this.logger.warn("GetPersonalAnalytics called with unknown card:", {
              game,
              cardName,
            });
            return null;
          }

          return this.getPersonalAnalytics(
            game,
            league,
            card.name,
            selectedLeague,
          );
        } catch (err) {
          this.logger.error(
            "Failed to validate card for personal analytics:",
            err,
          );
          return null;
        }
      },
    );

    ipcMain.handle(
      CardDetailsChannel.GetRelatedCards,
      async (
        _event: Electron.IpcMainInvokeEvent,
        game: GameType,
        cardName: string,
      ): Promise<RelatedCardsResultDTO> => {
        const empty: RelatedCardsResultDTO = {
          similarCards: [],
          chainCards: [],
        };

        if (!game || !cardName) {
          this.logger.warn("GetRelatedCards called with missing parameters:", {
            game,
            cardName,
          });
          return empty;
        }

        if (game !== "poe1" && game !== "poe2") {
          this.logger.warn("GetRelatedCards called with invalid game:", game);
          return empty;
        }

        return this.getRelatedCards(game, cardName);
      },
    );

    ipcMain.handle(
      CardDetailsChannel.ResolveCardBySlug,
      async (
        _event: Electron.IpcMainInvokeEvent,
        game: GameType,
        cardSlug: string,
        selectedLeague?: string,
      ): Promise<CardDetailsInitDTO | null> => {
        if (!game || !cardSlug) {
          this.logger.warn(
            "ResolveCardBySlug called with missing parameters:",
            { game, cardSlug },
          );
          return null;
        }

        if (game !== "poe1" && game !== "poe2") {
          this.logger.warn("ResolveCardBySlug called with invalid game:", game);
          return null;
        }

        return this.resolveCardBySlug(game, cardSlug, selectedLeague);
      },
    );

    ipcMain.handle(
      CardDetailsChannel.OpenInMainWindow,
      async (
        _event: Electron.IpcMainInvokeEvent,
        cardName: string,
      ): Promise<void> => {
        if (!cardName || typeof cardName !== "string") {
          this.logger.warn(
            "OpenInMainWindow called with invalid cardName:",
            cardName,
          );
          return;
        }

        this.openCardInMainWindow(cardName);
      },
    );

    this.logger.log("IPC handlers registered");
  }

  // ─── Resolve Card by Slug (Unified Init) ─────────────────────────────────

  /**
   * Resolve a divination card by its URL slug and return a unified DTO
   * containing the card, personal analytics, and related cards.
   *
   * This replaces three separate IPC calls from the renderer with a single
   * round-trip. The slug is matched against all cards for the game using
   * the same slugification logic as the router.
   *
   * Personal analytics and related cards are fetched in parallel once the
   * card is resolved.
   */
  public async resolveCardBySlug(
    game: GameType,
    cardSlug: string,
    selectedLeague?: string,
  ): Promise<CardDetailsInitDTO | null> {
    this.logger.log(
      `Resolving card by slug "${cardSlug}" for ${game}` +
        (selectedLeague ? ` (selectedLeague: ${selectedLeague})` : ""),
    );

    try {
      // Step 1: Resolve slug → card name using the divination cards service
      const matched = await this.resolveCardFromSlugCache(game, cardSlug);

      if (!matched) {
        this.logger.warn(`No card found for slug "${cardSlug}" in ${game}`);
        return null;
      }

      const cardName = matched.name;
      this.logger.log(`Slug "${cardSlug}" resolved to "${cardName}"`);

      // Step 2: Fetch personal analytics and related cards in parallel
      const [personalAnalytics, relatedCards] = await Promise.all([
        this.getPersonalAnalytics(
          game,
          selectedLeague ?? "all",
          cardName,
          selectedLeague,
        ),
        this.getRelatedCards(game, cardName).catch((err) => {
          this.logger.error(
            `Failed to fetch related cards for "${cardName}":`,
            err,
          );
          return null;
        }),
      ]);

      return {
        card: matched,
        personalAnalytics,
        relatedCards,
      };
    } catch (error) {
      this.logger.error(`Failed to resolve card by slug "${cardSlug}":`, error);
      return null;
    }
  }

  // ─── Deep Link from Overlay ──────────────────────────────────────────────

  /**
   * Focus the main window and send a navigation event so the main renderer
   * navigates to the card details page for the given card.
   */
  private async resolveCardFromSlugCache(
    game: GameType,
    cardSlug: string,
  ): Promise<DivinationCardDTO | null> {
    let gameCache = this.cardSlugCache.get(game);

    if (!gameCache) {
      const divCardsService = DivinationCardsService.getInstance();
      const allCards = await divCardsService.getRepository().getAllByGame(game);

      gameCache = new Map<string, DivinationCardDTO>();
      for (const card of allCards) {
        const slug = cardNameToSlug(card.name);
        if (!gameCache.has(slug)) {
          gameCache.set(slug, card);
        }
      }

      this.cardSlugCache.set(game, gameCache);
    }

    return gameCache.get(cardSlug) ?? null;
  }

  private openCardInMainWindow(cardName: string): void {
    const mainWindowService = MainWindowService.getInstance();
    mainWindowService.show();

    const webContents = mainWindowService.getWebContents();
    if (webContents && !webContents.isDestroyed()) {
      webContents.send(CardDetailsChannel.NavigateToCard, cardName);
      this.logger.log(
        `Sent NavigateToCard event for "${cardName}" to main window`,
      );
    } else {
      this.logger.warn(
        `Cannot navigate to "${cardName}" — main window webContents unavailable`,
      );
    }
  }

  // ─── Core Logic ──────────────────────────────────────────────────────────

  /**
   * Get price history for a divination card.
   *
   * Flow:
   * 1. Derive detailsId slug from cardName
   * 2. Check SQLite cache:
   *    a. If hit AND not stale (< 30 min) → return cached (isFromCache: true)
   *    b. If stale or miss → continue to step 3
   * 3. Fetch from poe.ninja directly
   * 4. Map response via CardDetailsMapper
   * 5. Upsert into SQLite cache
   * 6. Return fresh data (isFromCache: false)
   * 7. On fetch error:
   *    a. If stale cache exists → return stale cache (isFromCache: true)
   *    b. If no cache → return null
   */
  public async getPriceHistory(
    game: GameType,
    league: string,
    cardName: string,
  ): Promise<CardPriceHistoryDTO | null> {
    const detailsId = cardNameToDetailsId(cardName);

    this.logger.log(
      `Getting price history for "${cardName}" (${detailsId}) in ${game}/${league}`,
    );

    // Step 2: Check SQLite cache
    const cached = await this.repository.getCachedPriceHistory(
      game,
      league,
      detailsId,
    );

    if (
      cached &&
      !this.repository.isCacheStale(cached.fetched_at, CACHE_TTL_MS)
    ) {
      this.logger.log(`Cache hit (fresh) for "${cardName}"`);
      try {
        const dto: unknown = JSON.parse(cached.response_data);
        if (isValidCachedPriceHistory(dto)) {
          return { ...dto, isFromCache: true };
        }
        this.logger.warn(
          `Cached data for "${cardName}" failed shape validation, will re-fetch`,
        );
      } catch {
        this.logger.warn(
          `Failed to parse cached data for "${cardName}", will re-fetch`,
        );
      }
    }

    // Step 3–6: Fetch from poe.ninja
    try {
      const fetchedAt = new Date().toISOString();
      const raw = await this.fetchFromPoeNinja(game, league, detailsId);

      // Step 4: Map response
      const dto = CardDetailsMapper.toDTO(
        raw,
        cardName,
        detailsId,
        game,
        league,
        fetchedAt,
        false, // isFromCache
      );

      // Step 5: Upsert into cache
      await this.repository.upsertPriceHistory(
        game,
        league,
        detailsId,
        cardName,
        JSON.stringify(dto),
        fetchedAt,
      );

      this.logger.log(`Fetched and cached price history for "${cardName}"`);

      // Step 6: Return fresh data
      return dto;
    } catch (error) {
      this.logger.error(
        `Failed to fetch price history for "${cardName}":`,
        error,
      );

      // Step 7a: If stale cache exists, return it
      if (cached) {
        this.logger.log(`Returning stale cache for "${cardName}"`);
        try {
          const dto: unknown = JSON.parse(cached.response_data);
          if (isValidCachedPriceHistory(dto)) {
            return { ...dto, isFromCache: true };
          }
          this.logger.warn(
            `Stale cached data for "${cardName}" failed shape validation`,
          );
        } catch {
          this.logger.warn(
            `Failed to parse stale cached data for "${cardName}"`,
          );
        }
      }

      // Step 7b: No cache available
      this.logger.warn(`No data available for "${cardName}"`);
      return null;
    }
  }

  // ─── Personal Analytics ─────────────────────────────────────────────────

  /**
   * Get personal analytics for a divination card.
   *
   * Aggregates the user's drop history across all sessions, boss-exclusive
   * status, Prohibited Library weight data, total decks opened, and a
   * per-session drop timeline for charting.
   */
  public async getPersonalAnalytics(
    game: GameType,
    league: string,
    cardName: string,
    selectedLeague?: string,
  ): Promise<CardPersonalAnalyticsDTO | null> {
    // Resolve the league filter for repository queries.
    // "all" or undefined → no filter (aggregate across all sessions).
    // Any specific league name → filter to that league.
    const leagueFilter =
      selectedLeague && selectedLeague !== "all" ? selectedLeague : undefined;

    this.logger.log(
      `Getting personal analytics for "${cardName}" in ${game}/${league}` +
        (leagueFilter
          ? ` (filtered to league: ${leagueFilter})`
          : " (all leagues)"),
    );

    try {
      // Run independent queries in parallel
      const [
        personalStats,
        availability,
        dropTimelineRaw,
        totalDecks,
        leagueDateRangesRaw,
        firstSessionStartDate,
      ] = await Promise.all([
        this.repository.getCardPersonalStats(game, cardName, leagueFilter),
        this.repository.getCardAvailability(game, league, cardName),
        this.repository.getDropTimeline(game, cardName, leagueFilter),
        this.repository.getTotalDecksOpenedAllSessions(game, leagueFilter),
        this.repository.getLeagueDateRanges(game),
        this.repository.getFirstSessionStartDate(game, leagueFilter),
      ]);

      const averageDropsPerSession =
        personalStats.sessionCount > 0
          ? Math.round(
              (personalStats.totalDrops / personalStats.sessionCount) * 100,
            ) / 100
          : 0;

      // Map league date ranges
      const leagueDateRanges: LeagueDateRangeDTO[] = leagueDateRangesRaw.map(
        (lr) => ({
          name: lr.name,
          startDate: lr.startDate,
          endDate: lr.endDate,
        }),
      );

      // Compute timelineEndDate relative to the selected league (if filtered).
      const timelineEndDate = resolveTimelineEndDate(
        leagueDateRanges,
        leagueFilter,
      );
      const dropTimeline: CardDropTimelinePointDTO[] =
        buildPreparedDropTimeline({
          rows: dropTimelineRaw,
          leagueDateRanges,
          firstSessionStartedAt: firstSessionStartDate,
          timelineEndDate,
        });

      const dto: CardPersonalAnalyticsDTO = {
        cardName,
        totalLifetimeDrops: personalStats.totalDrops,
        firstDiscoveredAt: personalStats.firstDiscoveredAt,
        lastSeenAt: personalStats.lastSeenAt,
        sessionCount: personalStats.sessionCount,
        averageDropsPerSession,
        fromBoss: availability.fromBoss,
        weight: availability.weight,
        totalDecksOpenedAllSessions: totalDecks,
        dropTimeline,
        leagueDateRanges,
        firstSessionStartedAt: firstSessionStartDate,
        timelineEndDate,
      };

      this.logger.log(
        `Personal analytics for "${cardName}": ${personalStats.totalDrops} drops across ${personalStats.sessionCount} sessions`,
      );

      return dto;
    } catch (error) {
      this.logger.error(
        `Failed to get personal analytics for "${cardName}":`,
        error,
      );
      return null;
    }
  }

  // ─── Related Cards ──────────────────────────────────────────────────────

  /**
   * Extract the core reward item name from a card's reward_html.
   *
   * Supports two formats:
   * 1. Wiki-link format: `[[Link|Display]]` or `[[Link]]` (raw package data)
   * 2. Plain HTML format: `<span class="tc -xxx">Name</span>` (after
   *    `cleanWikiMarkup()` strips wiki links at write time in `syncCards()`)
   *
   * Skips modifier tags like `Corrupted`, `Two-Implicit`, `Item Level: XX`,
   * `Mirrored`, etc. which are not the actual reward item.
   *
   * Examples:
   * - `[[Headhunter|Headhunter]]` → "Headhunter"
   * - `[[The Doctor|The Doctor]]` → "The Doctor"
   * - `[[Mageblood|Mageblood]]<br>..Corrupted..` → "Mageblood"
   * - `<span class="tc -divination">The Doctor</span>` → "The Doctor"
   * - `<span class="tc -currency">Mirror of Kalandra</span>` → "Mirror of Kalandra"
   * - `<span class="tc -currency">3x Exalted Orb</span>` → "Exalted Orb"
   * - `<span class="tc -currency">1,500x Chromatic Orb</span>` → "Chromatic Orb"
   * - `<span class="tc -unique">Item</span>` → null (generic placeholder, skipped)
   */
  private extractRewardItemName(rewardHtml: string): string | null {
    if (!rewardHtml) return null;

    // Tags/keywords to skip — these are modifiers, not the reward itself
    const SKIP_PATTERNS = [
      /^corrupted$/i,
      /^two-implicit$/i,
      /^three-implicit$/i,
      /^item level/i,
      /^mirrored$/i,
      /^unidentified$/i,
      /^item$/i, // Generic "Item" placeholder (e.g. Jack in the Box, A Dusty Memory)
      /^elder item$/i,
      /^influenced item$/i,
      /^elevated item$/i,
      /^double-influenced item$/i,
      /^synthesised$/i,
      /^fractured$/i,
    ];

    // Strip quantity prefixes like "3x ", "10x ", "1,500x " from reward text.
    // Cards like "Abandoned Wealth" reward "3x Exalted Orb" — we want just "Exalted Orb"
    // so that LIKE '%Exalted Orb%' matches other cards with the same reward item.
    const stripQuantityPrefix = (text: string): string =>
      text.replace(/^[\d,]+x\s+/, "");

    // Strategy 1: Extract from wiki links [[target|display]] or [[target]]
    const wikiLinkRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

    for (const match of rewardHtml.matchAll(wikiLinkRegex)) {
      const display = (match[2] ?? match[1]).trim();

      // Skip File: references (image links like [[File: Headhunter inventory icon.png|...]])
      if (match[1].trim().startsWith("File:")) continue;

      // Skip modifier tags
      if (SKIP_PATTERNS.some((p) => p.test(display))) continue;

      // This is the actual reward item name
      return display;
    }

    // Strategy 2: Extract from plain HTML <span class="tc -xxx">Name</span>
    // syncCards() runs cleanWikiMarkup() at write time, stripping [[wiki|links]]
    // and leaving plain text inside <span> tags. The database therefore stores
    // cleaned HTML, so we need to parse it here as a fallback.
    const spanRegex = /<span[^>]*class="tc\s[^"]*"[^>]*>([^<]+)<\/span>/g;

    for (const match of rewardHtml.matchAll(spanRegex)) {
      let text = match[1].trim();
      if (!text) continue;

      // Strip quantity prefix (e.g. "3x Exalted Orb" → "Exalted Orb")
      text = stripQuantityPrefix(text);

      // Skip modifier tags and generic placeholders
      if (SKIP_PATTERNS.some((p) => p.test(text))) continue;

      // Skip pure numbers (e.g. "100" from Item Level spans)
      if (/^\d+$/.test(text)) continue;

      return text;
    }

    return null;
  }

  /**
   * Check if a card's reward is another divination card by inspecting the
   * CSS class `tc -divination` in the reward HTML.
   */
  private isRewardADivinationCard(rewardHtml: string): boolean {
    return rewardHtml.includes("tc -divination");
  }

  /**
   * Follow the divination card reward chain to find the terminal (non-card) reward.
   *
   * For example:
   * - The Patient rewards "The Nurse" (a div card)
   * - The Nurse rewards "The Doctor" (a div card)
   * - The Doctor rewards "Headhunter" (a unique item — terminal)
   *
   * Returns the terminal item name and all card names in the chain.
   *
   * @param game - The game type
   * @param rewardHtml - The starting card's reward HTML
   * @param startCardName - The starting card's name (excluded from chain list)
   * @param visited - Set of card names already visited (cycle protection)
   * @returns Terminal reward item name and the chain of div card names traversed
   */
  private async resolveRewardChain(
    game: GameType,
    rewardHtml: string,
    startCardName: string,
    visited = new Set<string>(),
  ): Promise<{ terminalReward: string | null; chainCards: string[] }> {
    visited.add(startCardName);
    const chainCards: string[] = [];

    let currentHtml = rewardHtml;

    // Walk the chain while the reward is another divination card
    while (this.isRewardADivinationCard(currentHtml)) {
      const rewardCardName = this.extractRewardItemName(currentHtml);
      if (!rewardCardName || visited.has(rewardCardName)) break;

      visited.add(rewardCardName);
      chainCards.push(rewardCardName);

      // Look up the reward card in the database to continue the chain
      const rewardCard = await this.repository.getCardRewardHtml(
        game,
        rewardCardName,
      );
      if (!rewardCard) break;

      currentHtml = rewardCard;
    }

    // Extract the terminal (non-div-card) reward item name
    const terminalReward = this.extractRewardItemName(currentHtml);
    return { terminalReward, chainCards };
  }

  /**
   * Find related cards by following reward chains.
   *
   * Algorithm:
   * 1. Parse the card's rewardHtml to extract the reward item name.
   * 2. If the reward is another divination card, follow the chain to find
   *    the terminal (non-card) reward item (e.g. Headhunter, Mageblood).
   * 3. Find all other cards in the database whose reward chain resolves
   *    to the same terminal item.
   * 4. Also include any cards in the direct chain (e.g. The Nurse, The Doctor).
   *
   * This correctly links:
   * - The Patient → The Nurse → The Doctor → Headhunter
   * - The Fiend → Headhunter (+ Corrupted)
   * - The Demon → Headhunter (+ Two-Implicit + Corrupted)
   * - The Apothecary → Mageblood
   * - The Insane Cat → Mageblood (+ Item Level: 84 + Corrupted)
   */
  public async getRelatedCards(
    game: GameType,
    cardName: string,
  ): Promise<RelatedCardsResultDTO> {
    const empty: RelatedCardsResultDTO = { similarCards: [], chainCards: [] };
    this.logger.log(`Getting related cards for "${cardName}" in ${game}`);

    try {
      // Step 0: Look up the raw reward_html from the database (not the cleaned
      // version from the renderer, which has had [[wiki|links]] stripped out)
      const rawRewardHtml = await this.repository.getCardRewardHtml(
        game,
        cardName,
      );

      if (!rawRewardHtml) {
        this.logger.log(
          `No reward_html found in DB for "${cardName}", skipping related cards`,
        );
        return empty;
      }

      // Step 1–2: Resolve the reward chain to find the terminal item
      const { terminalReward, chainCards } = await this.resolveRewardChain(
        game,
        rawRewardHtml,
        cardName,
      );

      if (!terminalReward || terminalReward.length < 2) {
        this.logger.log(
          `Could not resolve terminal reward for "${cardName}", skipping related cards`,
        );
        return empty;
      }

      this.logger.log(
        `Resolved reward chain for "${cardName}": terminal="${terminalReward}", chain=[${chainCards.join(
          ", ",
        )}]`,
      );

      // Step 3: Find all cards whose reward_html contains the terminal item name.
      // These are "similar" cards — they share the same end-reward item
      // (e.g. The Doctor, The Fiend, The Demon all reward Headhunter).
      const terminalMatches = await this.repository.findCardsByRewardMatch(
        game,
        terminalReward,
        cardName,
        20,
      );
      const similarCards: RelatedCardDTO[] = terminalMatches.map((c) => ({
        ...c,
        relationship: "similar" as const,
      }));

      // Step 4: Build the "chain" set — cards that are part of the reward chain.
      // This includes:
      //   a) Cards discovered during chain traversal (e.g. The Doctor when
      //      viewing The Nurse, since The Nurse → The Doctor → Headhunter)
      //   b) Cards that reward any card in the chain (upstream cards)
      //   c) Cards that reward the current card itself
      const chainSet = new Set<string>();
      const chainResults: RelatedCardDTO[] = [];

      // 4a: Add chain cards discovered during traversal as chain entries.
      // These are cards in the reward path (e.g. viewing The Patient:
      //   chain = ["The Nurse", "The Doctor"], terminal = "Headhunter")
      for (const chainCardName of chainCards) {
        if (chainCardName === cardName || chainSet.has(chainCardName)) continue;

        // Fetch the chain card itself by exact name so it appears in results
        const chainCard = await this.repository.findCardByName(
          game,
          chainCardName,
        );
        if (chainCard) {
          chainSet.add(chainCard.name);
          chainResults.push({ ...chainCard, relationship: "chain" as const });
        }
      }

      // 4b: Find cards that reward any card in the chain (upstream cards).
      // e.g. if chain = ["The Doctor"], find "The Nurse" which rewards "The Doctor"
      for (const chainCardName of chainCards) {
        if (chainCardName === cardName) continue;
        const matches = await this.repository.findCardsByRewardMatch(
          game,
          chainCardName,
          cardName,
          10,
        );
        for (const m of matches) {
          if (!chainSet.has(m.name) && m.name !== cardName) {
            chainSet.add(m.name);
            chainResults.push({ ...m, relationship: "chain" as const });
          }
        }
      }

      // 4c: Also find cards that reward the current card itself
      // (e.g. if we're on The Doctor, find The Nurse which rewards "The Doctor")
      const upstreamMatches = await this.repository.findCardsByRewardMatch(
        game,
        cardName,
        cardName,
        10,
      );
      for (const m of upstreamMatches) {
        if (!chainSet.has(m.name) && m.name !== cardName) {
          chainSet.add(m.name);
          chainResults.push({ ...m, relationship: "chain" as const });
        }
      }

      // Deduplicate: a card can appear in both categories, but
      // if it's in the chain it gets "chain" priority (skip from similar).
      const chainNames = new Set<string>();
      const deduplicatedChain: RelatedCardDTO[] = [];

      for (const card of chainResults) {
        if (!chainNames.has(card.name) && card.name !== cardName) {
          chainNames.add(card.name);
          deduplicatedChain.push(card);
        }
      }

      const deduplicatedSimilar: RelatedCardDTO[] = [];
      const seen = new Set<string>(chainNames);

      for (const card of similarCards) {
        if (!seen.has(card.name) && card.name !== cardName) {
          seen.add(card.name);
          deduplicatedSimilar.push(card);
        }
      }

      // Sort each category by rarity (rarest first), then alphabetically.
      // Display rarity prefers PL rarity over poe.ninja rarity.
      const sortByRarity = (a: RelatedCardDTO, b: RelatedCardDTO): number => {
        const rarityA = a.prohibitedLibraryRarity ?? a.rarity;
        const rarityB = b.prohibitedLibraryRarity ?? b.rarity;
        if (rarityA !== rarityB) return rarityA - rarityB;
        return a.name.localeCompare(b.name);
      };

      deduplicatedChain.sort(sortByRarity);
      deduplicatedSimilar.sort(sortByRarity);

      const totalCount = deduplicatedChain.length + deduplicatedSimilar.length;
      this.logger.log(
        `Found ${totalCount} related card(s) for "${cardName}" ` +
          `(${deduplicatedChain.length} chain, ${deduplicatedSimilar.length} similar)`,
      );

      for (const card of [...deduplicatedChain, ...deduplicatedSimilar]) {
        this.logger.log(
          `  Related card "${card.name}": ` +
            `poe.ninja rarity=${card.rarity}, ` +
            `PL rarity=${card.prohibitedLibraryRarity ?? "null"}, ` +
            `displayed=${card.prohibitedLibraryRarity ?? card.rarity}`,
        );
      }

      return {
        similarCards: deduplicatedSimilar,
        chainCards: deduplicatedChain,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get related cards for "${cardName}":`,
        error,
      );
      return empty;
    }
  }

  // ─── poe.ninja API ──────────────────────────────────────────────────────

  /**
   * Fetch exchange details from poe.ninja for a specific divination card.
   *
   * URL pattern:
   * https://poe.ninja/{game}/api/economy/exchange/current/details
   *   ?league={league}&type=DivinationCard&id={detailsId}
   */
  private async fetchFromPoeNinja(
    game: GameType,
    league: string,
    detailsId: string,
  ): Promise<PoeNinjaDetailsResponse> {
    const gamePrefix = game === "poe1" ? "poe1" : "poe2";
    const url =
      `https://poe.ninja/${gamePrefix}/api/economy/exchange/current/details` +
      `?league=${encodeURIComponent(league)}` +
      `&type=DivinationCard` +
      `&id=${encodeURIComponent(detailsId)}`;

    this.logger.log(`Fetching from poe.ninja: ${url}`);

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Soothsayer/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `poe.ninja API returned ${response.status}: ${response.statusText}`,
      );
    }

    const data: PoeNinjaDetailsResponse = await response.json();
    return data;
  }

  // ─── Public Accessors ────────────────────────────────────────────────────

  public getRepository(): CardDetailsRepository {
    return this.repository;
  }
}

export { CardDetailsService };
