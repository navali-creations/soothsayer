import type { DivinationCardDTO } from "./DivinationCards.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class DivinationCardsMapper {
  static toDTO(row: any): DivinationCardDTO {
    return {
      id: row.id,
      name: row.name,
      stackSize: row.stack_size,
      description: row.description,
      rewardHtml: row.reward_html,
      artSrc: row.art_src,
      flavourHtml: row.flavour_html,
      game: row.game,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
