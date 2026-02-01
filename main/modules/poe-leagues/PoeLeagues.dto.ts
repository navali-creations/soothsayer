import type { GameType } from "../../../types/data-stores";

/**
 * Data Transfer Objects for PoeLeagues module
 */

/**
 * DTO for a cached PoE league from the database
 */
export interface PoeLeagueCacheDTO {
  id: string;
  game: GameType;
  leagueId: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  updatedAt: string | null;
  fetchedAt: string;
}

/**
 * DTO for league cache metadata (last fetch time per game)
 */
export interface PoeLeaguesCacheMetadataDTO {
  game: GameType;
  lastFetchedAt: string;
}

/**
 * DTO for creating/updating a cached league
 */
export interface UpsertPoeLeagueCacheDTO {
  id: string;
  game: GameType;
  leagueId: string;
  name: string;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  updatedAt: string | null;
  fetchedAt: string;
}

/**
 * Response from the Supabase get-leagues-legacy edge function
 */
export interface SupabaseLeagueResponse {
  leagues: Array<{
    id: string;
    leagueId: string;
    name: string;
    startAt: string | null;
    endAt: string | null;
    isActive: boolean;
    updatedAt: string | null;
  }>;
}
