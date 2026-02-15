import type { Rarity } from "~/types/data-stores";

export interface DivinationCardRow {
  id: string;
  name: string;
  stackSize: number;
  description: string;
  rewardHtml: string;
  artSrc: string;
  flavourHtml: string;
  rarity: Rarity;
}
