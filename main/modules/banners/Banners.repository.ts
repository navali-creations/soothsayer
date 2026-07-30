import type { Kysely } from "kysely";

import type { Database } from "~/main/modules/database/Database.types";

import type { BannerId } from "./Banners.types";

export class BannersRepository {
  constructor(private kysely: Kysely<Database>) {}

  async dismiss(bannerId: BannerId): Promise<void> {
    await this.kysely
      .insertInto("dismissed_banners")
      .values({ banner_id: bannerId })
      .onConflict((oc) => oc.column("banner_id").doNothing())
      .execute();
  }

  async getDismissed(bannerIds: readonly BannerId[]): Promise<BannerId[]> {
    if (bannerIds.length === 0) return [];

    const rows = await this.kysely
      .selectFrom("dismissed_banners")
      .select("banner_id")
      .where("banner_id", "in", [...bannerIds])
      .execute();
    return rows.map(({ banner_id }) => banner_id as BannerId);
  }
}
