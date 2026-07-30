/** Known banner IDs. Add new banners here as the app grows. */
export const BANNER_IDS = {
  COMMUNITY_BACKFILL: "community-backfill",
} as const;

export type BannerId = (typeof BANNER_IDS)[keyof typeof BANNER_IDS];

export const BANNER_ID_VALUES = Object.values(
  BANNER_IDS,
) as readonly BannerId[];

export type BannerDismissResult =
  | { success: true }
  | { success: false; error: string };

export type BannerDismissalsResult =
  | { success: true; bannerIds: BannerId[] }
  | { success: false; error: string };
