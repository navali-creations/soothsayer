import { ipcMain } from "electron";
import type { SessionPriceSnapshot } from "../../../types/data-stores";
import type {
  PoeNinjaExchangeResponse,
  PoeNinjaPriceData,
  PoeNinjaStashResponse,
} from "../../../types/poe-ninja";
import { PoeNinjaChannel } from "./PoeNinja.channels";

type PoeNinjaApiType = "exchange" | "stash";

class PoeNinjaService {
  private static _instance: PoeNinjaService;
  private cachedExchangeData: PoeNinjaPriceData | null = null;
  private cachedStashData: PoeNinjaPriceData | null = null;
  private lastExchangeFetchTime: number = 0;
  private lastStashFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance() {
    if (!PoeNinjaService._instance) {
      PoeNinjaService._instance = new PoeNinjaService();
    }

    return PoeNinjaService._instance;
  }

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle(
      PoeNinjaChannel.FetchExchangePrices,
      async (_event, league) => {
        return this.fetchExchangePrices(league);
      },
    );

    ipcMain.handle(PoeNinjaChannel.FetchStashPrices, async (_event, league) => {
      return this.fetchStashPrices(league);
    });
  }

  private async fetchExchangePrices(
    league: string,
  ): Promise<PoeNinjaPriceData> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (
      this.cachedExchangeData &&
      now - this.lastExchangeFetchTime < this.CACHE_DURATION
    ) {
      console.log("Returning cached poe.ninja exchange data");
      return this.cachedExchangeData;
    }

    console.log(`Fetching poe.ninja exchange data for league: ${league}`);

    try {
      const url = `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${league}&type=DivinationCard`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch poe.ninja exchange data: ${response.statusText}`,
        );
      }

      const data: PoeNinjaExchangeResponse = await response.json();

      // Calculate chaos to divine ratio
      const chaosToDivineRatio = data.core.rates.divine
        ? 1 / data.core.rates.divine
        : 100;

      // Build card prices map by matching items with lines
      const cardPrices: Record<string, any> = {};

      data.items.forEach((item, index) => {
        const line = data.lines[index];
        if (line && item.category === "Cards") {
          cardPrices[item.name] = {
            id: item.id,
            name: item.name,
            chaosValue: line.primaryValue,
            divineValue: line.primaryValue / chaosToDivineRatio,
          };
        }
      });

      this.cachedExchangeData = {
        chaosToDivineRatio,
        cardPrices,
        lastUpdated: new Date().toISOString(),
      };

      this.lastExchangeFetchTime = now;

      console.log(
        `Fetched exchange prices for ${Object.keys(cardPrices).length} divination cards`,
      );
      console.log(`Chaos to Divine ratio: ${chaosToDivineRatio.toFixed(2)}`);

      return this.cachedExchangeData;
    } catch (error) {
      console.error("Error fetching poe.ninja exchange data:", error);

      // Return cached data if available, even if stale
      if (this.cachedExchangeData) {
        console.log("Returning stale cached exchange data due to fetch error");
        return this.cachedExchangeData;
      }

      throw error;
    }
  }

  private async fetchStashPrices(league: string): Promise<PoeNinjaPriceData> {
    const now = Date.now();

    // Return cached data if it's still fresh
    if (
      this.cachedStashData &&
      now - this.lastStashFetchTime < this.CACHE_DURATION
    ) {
      console.log("Returning cached poe.ninja stash data");
      return this.cachedStashData;
    }

    console.log(`Fetching poe.ninja stash data for league: ${league}`);

    try {
      const url = `https://poe.ninja/api/data/itemoverview?league=${league}&type=DivinationCard`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Failed to fetch poe.ninja stash data: ${response.statusText}`,
        );
      }

      const data: PoeNinjaStashResponse = await response.json();

      // Calculate chaos to divine ratio from the data
      let chaosToDivineRatio = 100; // Default fallback

      for (const card of data.lines) {
        if (card.divineValue > 0 && card.chaosValue > 0) {
          chaosToDivineRatio = card.chaosValue / card.divineValue;
          break;
        }
      }

      // Build card prices map
      const cardPrices: Record<string, any> = {};

      data.lines.forEach((card) => {
        cardPrices[card.name] = {
          id: card.id,
          name: card.name,
          chaosValue: card.chaosValue,
          divineValue: card.divineValue,
          stackSize: card.stackSize,
        };
      });

      this.cachedStashData = {
        chaosToDivineRatio,
        cardPrices,
        lastUpdated: new Date().toISOString(),
      };

      this.lastStashFetchTime = now;

      console.log(
        `Fetched stash prices for ${Object.keys(cardPrices).length} divination cards`,
      );
      console.log(`Chaos to Divine ratio: ${chaosToDivineRatio.toFixed(2)}`);

      return this.cachedStashData;
    } catch (error) {
      console.error("Error fetching poe.ninja stash data:", error);

      // Return cached data if available, even if stale
      if (this.cachedStashData) {
        console.log("Returning stale cached stash data due to fetch error");
        return this.cachedStashData;
      }

      throw error;
    }
  }

  /**
   * Get current price snapshot for session storage
   * Captures BOTH exchange and stash pricing for complete historical data
   */
  public async getPriceSnapshot(league: string): Promise<SessionPriceSnapshot> {
    console.log(
      `Fetching complete price snapshot (exchange + stash) for league: ${league}...`,
    );

    // Fetch both APIs (will use cache if fresh)
    const [exchangeData, stashData] = await Promise.all([
      this.fetchExchangePrices(league),
      this.fetchStashPrices(league),
    ]);

    // Convert exchange data
    const exchangePrices: Record<string, CardPriceSnapshot> = {};
    for (const [cardName, data] of Object.entries(exchangeData.cardPrices)) {
      exchangePrices[cardName] = {
        chaosValue: data.chaosValue,
        divineValue: data.divineValue,
        stackSize: data.stackSize,
      };
    }

    // Convert stash data
    const stashPrices: Record<string, CardPriceSnapshot> = {};
    for (const [cardName, data] of Object.entries(stashData.cardPrices)) {
      stashPrices[cardName] = {
        chaosValue: data.chaosValue,
        divineValue: data.divineValue,
        stackSize: data.stackSize,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      exchange: {
        chaosToDivineRatio: exchangeData.chaosToDivineRatio,
        cardPrices: exchangePrices,
      },
      stash: {
        chaosToDivineRatio: stashData.chaosToDivineRatio,
        cardPrices: stashPrices,
      },
    };
  }
}

export { PoeNinjaService };
