import type { DivinationCardsRow } from "~/main/modules/database";

import type { DivinationCardDTO } from "./DivinationCards.dto";

/**
 * Row type with joined rarity data
 */
interface DivinationCardWithRarityRow extends DivinationCardsRow {
  rarity?: number;
}

/**
 * Clean wiki markup from HTML strings
 * Removes patterns like [[File:...]] and [[...]]
 */
function cleanWikiMarkup(html: string): string {
  return (
    html
      // Remove [[File: ... ]] image references (both small and large versions)
      .replace(/\[\[File:[^\]]+\]\]/g, "")
      // Remove [[ItemName|ItemName]] patterns, keeping only the display text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      // Remove any remaining [[...]] brackets
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Clean up any double spaces or extra whitespace created by removals
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Mappers convert between database rows and DTOs
 */
export class DivinationCardsMapper {
  static toDTO(row: DivinationCardWithRarityRow): DivinationCardDTO {
    return {
      id: row.id,
      name: row.name,
      stackSize: row.stack_size,
      description: row.description,
      rewardHtml: cleanWikiMarkup(row.reward_html),
      artSrc: row.art_src,
      flavourHtml: cleanWikiMarkup(row.flavour_html),
      rarity: row.rarity ?? 4, // Default to 4 (common) if not set
      game: row.game,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
