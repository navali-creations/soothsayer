import type { Page } from "@playwright/test";

export async function resetSessionsBulkState(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    if (!store) {
      throw new Error(
        "resetSessionsBulkState: window.__zustandStore is not available",
      );
    }

    store.setState((state: any) => {
      state.sessions.bulkMode = null;
      state.sessions.selectedSessionIds = [];
      state.sessions.isDeleteConfirmOpen = false;
      state.sessions.deleteError = null;
      state.sessions.isDeleting = false;
      state.sessions.searchQuery = "";
      state.sessions.selectedLeague = "all";
      state.sessions.currentPage = 1;
    });
  });
}
