import type { GameType } from "../../../types/data-stores";

export interface CommunityBackfillLeague {
  game: GameType;
  league: string;
}

export type CommunityBackfillLeaguesResult =
  | { success: true; leagues: CommunityBackfillLeague[] }
  | { success: false; error: string };

export type CommunityBackfillResult =
  | { success: true }
  | { success: false; error: string };
