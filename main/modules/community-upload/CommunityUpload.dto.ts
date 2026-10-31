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

// null means the user has not made a choice for the current disclosure.
export type CommunityDropContextConsentResult =
  | { success: true; consent: boolean | null }
  | { success: false; error: string };

export interface CommunityDropContextUploadStatus {
  pendingEvents: number;
  isUploading: boolean;
  revision: number;
}

export type CommunityDropContextUploadStatusResult =
  | { success: true; status: CommunityDropContextUploadStatus }
  | { success: false; error: string };
