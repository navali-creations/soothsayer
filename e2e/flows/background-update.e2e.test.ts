import { expect, test } from "../helpers/electron-test";
import { ensurePostSetup } from "../helpers/navigation";

test("installer notifications keep the main window hidden until explicitly opened", async ({
  app,
  page,
}) => {
  test.skip(
    process.platform !== "win32",
    "Squirrel installer events are Windows-only",
  );
  await ensurePostSetup(page);
  const mainWindow = await app.browserWindow(page);

  try {
    await mainWindow.evaluate((window) => window.hide());

    for (const argument of [
      "--squirrel-install",
      "--squirrel-updated",
      "--squirrel-uninstall",
      "--squirrel-obsolete",
    ]) {
      await app.evaluate(({ app }, argument) => {
        app.emit(
          "second-instance",
          {},
          ["Soothsayer.exe", argument, "1.2.1"],
          "",
        );
      }, argument);
      expect(await mainWindow.evaluate((window) => window.isVisible())).toBe(
        false,
      );
      expect(await mainWindow.evaluate((window) => window.isFocused())).toBe(
        false,
      );
    }

    await app.evaluate(({ app }) => {
      app.emit("second-instance", {}, ["Soothsayer.exe"], "");
    });
    await expect
      .poll(() => mainWindow.evaluate((window) => window.isVisible()))
      .toBe(true);
  } finally {
    await mainWindow.evaluate((window) => window.show());
  }
});
