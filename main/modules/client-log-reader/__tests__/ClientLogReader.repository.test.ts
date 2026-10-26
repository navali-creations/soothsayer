import { describe, expect, it } from "vitest";

import { setupRepositoryTest } from "~/main/modules/__test-utils__/repository-test-setup";

import { ClientLogReaderRepository } from "../ClientLogReader.repository";

describe("ClientLogReaderRepository", () => {
  const { getRepository } = setupRepositoryTest(ClientLogReaderRepository);

  it("returns null when a backfill marker does not exist", async () => {
    await expect(
      getRepository().getMetadata("historical_card_context_backfill_v1"),
    ).resolves.toBeNull();
  });

  it("stores and updates a backfill marker", async () => {
    const repository = getRepository();

    await repository.setMetadata(
      "historical_card_context_backfill_v1",
      "pending",
    );
    await expect(
      repository.getMetadata("historical_card_context_backfill_v1"),
    ).resolves.toBe("pending");

    await repository.setMetadata(
      "historical_card_context_backfill_v1",
      "complete",
    );
    await expect(
      repository.getMetadata("historical_card_context_backfill_v1"),
    ).resolves.toBe("complete");
  });
});
