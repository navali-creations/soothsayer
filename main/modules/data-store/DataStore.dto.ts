import type {
  DivinationCardMetadata,
  GameType,
} from "../../../types/data-stores";

/**
 * Data Transfer Objects for DataStore module
 */

export interface CardDTO {
  cardName: string;
  count: number;
  lastUpdated: string | null;
  divinationCard?: DivinationCardMetadata;
}

export interface GlobalStatDTO {
  key: string;
  value: number;
}

export interface UpsertCardDTO {
  game: GameType;
  scope: string;
  cardName: string;
  timestamp: string;
}
