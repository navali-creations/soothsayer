import { expect, test } from "../../helpers/electron-test";
import { ensurePostSetup, goToProfitForecast } from "../../helpers/navigation";
import {
  dbQuery,
  resetLeagueToFixture,
  seedLeagueCache,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

test("loads bundled forecast weights for a league selected after fresh-install startup", async ({
  page,
}) => {
  await ensurePostSetup(page);

  // The worker starts with Standard. Seed only Covens prices and league metadata;
  // the app must import its bundled weights without legacy tables or a restart.
  expect(
    await dbQuery(
      page,
      "SELECT card_name FROM divination_card_availability WHERE game = ? AND league = ?",
      ["poe1", "Covens"],
    ),
  ).toEqual([]);
  expect(
    await dbQuery(
      page,
      "SELECT name FROM sqlite_master WHERE name LIKE 'prohibited_library_%'",
    ),
  ).toEqual([]);

  await seedSessionPrerequisites(page, { leagueName: "Covens" });
  await seedLeagueCache(page, {
    game: "poe1",
    leagueId: "Covens",
    name: "Covens",
  });
  await resetLeagueToFixture(page, "Covens");
  await goToProfitForecast(page);
  await page.getByRole("button", { name: "Table", exact: true }).click();

  await expect(
    page.getByRole("link", { name: "The Doctor", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText("No card weight data available", { exact: false }),
  ).toHaveCount(0);
  await expect(page.getByText(/Prohibited Library/)).toHaveCount(0);
});

test("rejects invented forecast leagues without persisting a card pool", async ({
  page,
}) => {
  await ensurePostSetup(page);

  const error = await page.evaluate(async () => {
    try {
      await window.electron.profitForecast.getData(
        "poe1",
        "Unknown E2E League",
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });

  expect(error).toContain("Select an active league");
  expect(
    await dbQuery(
      page,
      "SELECT card_name FROM divination_card_availability WHERE game = ? AND league = ?",
      ["poe1", "Unknown E2E League"],
    ),
  ).toEqual([]);
});
