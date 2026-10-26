import type { Kysely } from "kysely";

import type { Database } from "~/main/modules/database";

class ClientLogReaderRepository {
  constructor(private readonly kysely: Kysely<Database>) {}

  public async getMetadata(key: string): Promise<string | null> {
    const row = await this.kysely
      .selectFrom("app_metadata")
      .select("value")
      .where("key", "=", key)
      .executeTakeFirst();
    return row?.value ?? null;
  }

  public async setMetadata(key: string, value: string): Promise<void> {
    await this.kysely
      .insertInto("app_metadata")
      .values({ key, value })
      .onConflict((conflict) => conflict.column("key").doUpdateSet({ value }))
      .execute();
  }
}

export { ClientLogReaderRepository };
