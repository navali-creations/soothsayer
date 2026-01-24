import type { CardEntry as BaseCardEntry } from "~/types/data-stores";

export type CardEntry = BaseCardEntry & {
  ratio: number;
};
