import type { Kysely } from "kysely";

import type { Database } from "~/main/modules/database/Database.types";

export class BannersRepository {
  constructor(private kysely: Kysely<Database>) {}

  async isDismissed(bannerId: string): Promise<boolean> {
    const row = await this.kysely
      .selectFrom("dismissed_banners")
      .select("banner_id")
      .where("banner_id", "=", bannerId)
      .executeTakeFirst();
    return !!row;
  }

  async dismiss(bannerId: string): Promise<void> {
    await this.kysely
      .insertInto("dismissed_banners")
      .values({ banner_id: bannerId })
      .onConflict((oc) => oc.column("banner_id").doNothing())
      .execute();
  }

  async getAllDismissed(): Promise<string[]> {
    const rows = await this.kysely
      .selectFrom("dismissed_banners")
      .select("banner_id")
      .execute();
    return rows.map((r) => r.banner_id);
  }
}
