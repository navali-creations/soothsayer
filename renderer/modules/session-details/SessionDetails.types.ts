import type { DivinationCardMetadata } from "~/types/data-stores";

export type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
  hidePrice?: boolean;
  divinationCard?: DivinationCardMetadata;
};
