/** Known banner IDs. Add new banners here as the app grows. */
export const BANNER_IDS = {
  COMMUNITY_BACKFILL: "community-backfill",
} as const;

export type BannerId = (typeof BANNER_IDS)[keyof typeof BANNER_IDS];

export interface DismissedBanner {
  bannerId: string;
  dismissedAt: string;
}
