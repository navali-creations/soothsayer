import { promises as fs } from "node:fs";
import { BrowserWindow, dialog, ipcMain } from "electron";
import type { SimpleDivinationCardStats } from "../data-store/DataStore.schemas";
import { DataStoreService } from "../data-store/DataStoreService";
import { SettingsKey, SettingsStoreService } from "../settings-store";
import { jsonToCsv } from "./utils";

class CsvService {
  private static _instance: CsvService;
  private dataStore: DataStoreService;
  private settingsStore: SettingsStoreService;

  static getInstance() {
    if (!CsvService._instance) {
      CsvService._instance = new CsvService();
    }

    return CsvService._instance;
  }

  constructor() {
    this.dataStore = DataStoreService.getInstance();
    this.settingsStore = SettingsStoreService.getInstance();
    this.setupHandlers();
  }

  private setupHandlers() {
    // Export divination cards to CSV
    ipcMain.handle("export-divination-cards-csv", async () => {
      try {
        const allWindows = BrowserWindow.getAllWindows();
        const mainWindow = allWindows[0];

        if (!mainWindow) {
          throw new Error("Main window not available");
        }

        // Get the selected game from settings
        const activeGame = this.settingsStore.get(SettingsKey.ActiveGame);

        // Get divination cards data from DataStore (all-time stats for selected game)
        const stats: SimpleDivinationCardStats =
          this.dataStore.getAllTimeStats(activeGame);

        // Transform the data to be compatible with jsonToCsv
        const csvData: Record<string, number> = {};
        for (const [cardName, entry] of Object.entries(stats.cards)) {
          csvData[cardName] = entry.count;
        }

        // Convert to CSV
        const csvContent = jsonToCsv(csvData);

        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
          title: `Export ${activeGame.toUpperCase()} Divination Cards`,
          defaultPath: `${activeGame}-cards-${new Date().toISOString().split("T")[0]}.csv`,
          filters: [{ name: "CSV Files", extensions: ["csv"] }],
        });

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }

        // Write the CSV file
        await fs.writeFile(result.filePath, csvContent, "utf-8");

        return { success: true, filePath: result.filePath };
      } catch (error) {
        console.error("Error exporting CSV:", error);
        return { success: false, error: (error as Error).message };
      }
    });
  }
}

export { CsvService };
