import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import type {
  DiscoveredFilterDTO,
  RaritySource,
} from "~/main/modules/filters/Filter.dto";
import type { Rarity } from "~/types/data-stores";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(
  chaosValue: number,
  chaosToDivineRatio: number,
): string {
  if (Math.abs(chaosValue) >= chaosToDivineRatio) {
    const divineValue = chaosValue / chaosToDivineRatio;
    return `${divineValue.toFixed(2)}d`;
  }
  return `${chaosValue.toFixed(2)}c`;
}

// ─── Rarity Styles ─────────────────────────────────────────────────────────

export const RARITY_LABELS: Record<Rarity, string> = {
  0: "Unknown",
  1: "Extremely Rare",
  2: "Rare",
  3: "Less Common",
  4: "Common",
};

export interface RarityStyles {
  /** Background gradient for overlay drops list */
  bgGradient: string;
  /** Text color for overlay drops list */
  text: string;
  /** Border color for overlay drops list */
  border: string;
  /** Beam color for overlay animation */
  beam: string;
  /** Whether the beam should be shown in overlay */
  showBeam: boolean;
  /** Badge/chip background (semi-transparent, for dark UI) */
  badgeBg: string;
  /** Badge/chip text color */
  badgeText: string;
  /** Badge/chip border color */
  badgeBorder: string;
}

/**
 * Unified rarity colour palette.
 *
 * Overlay-specific fields (`bgGradient`, `text`, `border`, `beam`, `showBeam`)
 * drive the drops list.  Badge fields (`badgeBg`, `badgeText`, `badgeBorder`)
 * are designed for small chips / badges on a dark background.
 */
export function getRarityStyles(rarity: Rarity): RarityStyles {
  switch (rarity) {
    case 0: // Unknown — no data or low-confidence pricing
      return {
        bgGradient: "",
        text: "",
        border: "",
        beam: "",
        showBeam: false,
        badgeBg: "rgba(245, 158, 11, 0.15)",
        badgeText: "rgba(245, 158, 11, 0.85)",
        badgeBorder: "rgba(245, 158, 11, 0.40)",
      };
    case 1: // Extremely Rare
      return {
        bgGradient:
          "linear-gradient(to right, rgb(255, 255, 255) 50%, transparent)",
        text: "rgb(0, 0, 255)",
        border: "rgb(0, 0, 255)",
        beam: "orangered",
        showBeam: true,
        badgeBg: "rgb(255, 255, 255)",
        badgeText: "rgb(0, 0, 255)",
        badgeBorder: "rgb(255, 255, 255)",
      };
    case 2: // Rare
      return {
        bgGradient:
          "linear-gradient(to right, rgb(0, 20, 180) 50%, transparent)",
        text: "rgb(255, 255, 255)",
        border: "rgb(255, 255, 255)",
        beam: "yellow",
        showBeam: true,
        badgeBg: "rgb(0, 20, 180)",
        badgeText: "rgb(255, 255, 255)",
        badgeBorder: "rgb(255, 255, 255)",
      };
    case 3: // Less Common
      return {
        bgGradient:
          "linear-gradient(to right, rgb(0, 220, 240) 50%, transparent)",
        text: "rgb(0, 0, 0)",
        border: "rgb(0, 0, 0)",
        beam: "",
        showBeam: false,
        badgeBg: "rgb(0, 220, 240)",
        badgeText: "rgb(0, 0, 0)",
        badgeBorder: "rgb(0, 220, 240)",
      };
    default:
      return {
        bgGradient: "",
        text: "",
        border: "",
        beam: "",
        showBeam: false,
        badgeBg: "rgba(160, 160, 170, 0.10)",
        badgeText: "rgba(200, 200, 210, 0.60)",
        badgeBorder: "rgba(160, 160, 170, 0.20)",
      };
  }
}

// ─── Rarity Source Dropdown Helpers ─────────────────────────────────────────

/**
 * Encodes a dropdown value that combines rarity source + optional filter ID.
 *
 * Dataset-driven sources use their name directly ("poe.ninja", "prohibited-library").
 * Filter sources are encoded as "filter:<filterId>".
 */
export function encodeRaritySourceValue(
  raritySource: RaritySource,
  filterId: string | null,
): string {
  if (raritySource === "filter" && filterId) {
    return `filter:${filterId}`;
  }
  return raritySource;
}

/**
 * Decodes a dropdown value back into a rarity source + optional filter ID.
 */
export function decodeRaritySourceValue(value: string): {
  raritySource: RaritySource;
  filterId: string | null;
} {
  if (value.startsWith("filter:")) {
    return {
      raritySource: "filter",
      filterId: value.slice("filter:".length),
    };
  }
  return { raritySource: value as RaritySource, filterId: null };
}

// ─── Analytics Helpers ─────────────────────────────────────────────────────

/** The only rarity-source values we ever send to analytics. */
export type AnalyticsRaritySource =
  | "poe-ninja"
  | "prohibited-library"
  | "online"
  | "local";

/**
 * Maps a rarity source (+ optional filter lookup) to an analytics-safe value.
 *
 * We intentionally avoid tracking individual filter names / IDs — only the
 * *category* matters:
 *
 *  - `"poe-ninja"`          – price-based dataset
 *  - `"prohibited-library"` – community dataset
 *  - `"online"`             – an online (subscribed) loot filter
 *  - `"local"`              – a locally-stored loot filter
 */
export function getAnalyticsRaritySource(
  raritySource: RaritySource,
  filterId: string | null,
  availableFilters: DiscoveredFilterDTO[],
): AnalyticsRaritySource {
  switch (raritySource) {
    case "poe.ninja":
      return "poe-ninja";
    case "prohibited-library":
      return "prohibited-library";
    case "filter": {
      if (filterId) {
        const filter = availableFilters.find((f) => f.id === filterId);
        if (filter) {
          return filter.type; // "online" | "local"
        }
      }
      // Fallback – shouldn't happen, but default to "local"
      return "local";
    }
  }
}
