/**
 * Data Transfer Objects for Divination Cards module
 */

export interface DivinationCardDTO {
  id: string; // e.g., "poe1_a-chilling-wind"
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  game: "poe1" | "poe2";
  createdAt: string;
  updatedAt: string;
}

export interface DivinationCardSearchDTO {
  cards: DivinationCardDTO[];
  total: number;
}

export interface DivinationCardStatsDTO {
  game: "poe1" | "poe2";
  totalCards: number;
  lastUpdated: string;
}
