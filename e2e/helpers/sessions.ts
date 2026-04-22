import type { Page } from "@playwright/test";

export async function resetSessionsBulkState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    if (!store) {
      throw new Error(
        "resetSessionsBulkState: window.__zustandStore is not available",
      );
    }

    store.getState().sessions.setBulkMode(null);
  });
}
