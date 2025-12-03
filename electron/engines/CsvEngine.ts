import { ipcMain, dialog, BrowserWindow } from "electron";
import { promises as fs } from "fs";
import { LocalStorageEngine } from "./LocalStorageEngine";
import type { DivinationCardStats } from "./LocalStorageEngine";
import { MainWindowEngine } from "./MainWindowEngine";
import { jsonToCsv } from "../utils/jsonToCsv";
import { LocalStorageKey } from "../../enums";

class CsvEngine {
  private static _instance: CsvEngine;
  private localStorage: LocalStorageEngine;

  static getInstance() {
    if (!CsvEngine._instance) {
      CsvEngine._instance = new CsvEngine();
    }

    return CsvEngine._instance;
  }

  constructor() {
    this.localStorage = LocalStorageEngine.getInstance();
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

        // Get divination cards data
        const stats: DivinationCardStats = this.localStorage.get(
          LocalStorageKey.DivinationCards,
        );

        // Transform the data to be compatible with jsonToCsv
        const csvData: Record<string, number> = {};
        for (const [cardName, entry] of Object.entries(stats.cards)) {
          csvData[cardName] = entry.count;
        }

        // Convert to CSV
        const csvContent = jsonToCsv(csvData);

        // Show save dialog
        const result = await dialog.showSaveDialog(mainWindow, {
          title: "Export Divination Cards",
          defaultPath: `keepers-${new Date().toISOString().split("T")[0]}.csv`,
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

export { CsvEngine };
