import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  assertBoundedString,
  assertTrustedSender,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { BannersChannel } from "./Banners.channels";
import { BannersRepository } from "./Banners.repository";

export class BannersService {
  private static _instance: BannersService;
  private repository: BannersRepository;

  static getInstance(): BannersService {
    if (!BannersService._instance) {
      BannersService._instance = new BannersService();
    }
    return BannersService._instance;
  }

  constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new BannersRepository(db.getKysely());
    this.setupHandlers();
  }

  private setupHandlers(): void {
    ipcMain.handle(
      BannersChannel.IsDismissed,
      async (_event, bannerId: unknown) => {
        try {
          assertBoundedString(
            bannerId,
            "bannerId",
            BannersChannel.IsDismissed,
            100,
          );
          return await this.repository.isDismissed(bannerId);
        } catch (error) {
          return handleValidationError(error, BannersChannel.IsDismissed);
        }
      },
    );

    ipcMain.handle(BannersChannel.Dismiss, async (event, bannerId: unknown) => {
      try {
        assertTrustedSender(event, BannersChannel.Dismiss);
        assertBoundedString(bannerId, "bannerId", BannersChannel.Dismiss, 100);
        await this.repository.dismiss(bannerId);
      } catch (error) {
        return handleValidationError(error, BannersChannel.Dismiss);
      }
    });

    ipcMain.handle(BannersChannel.GetAllDismissed, async () => {
      try {
        return await this.repository.getAllDismissed();
      } catch (error) {
        return handleValidationError(error, BannersChannel.GetAllDismissed);
      }
    });
  }

  // Public methods for use by other main-process modules
  async isDismissed(bannerId: string): Promise<boolean> {
    return this.repository.isDismissed(bannerId);
  }

  async dismiss(bannerId: string): Promise<void> {
    return this.repository.dismiss(bannerId);
  }

  async getAllDismissed(): Promise<string[]> {
    return this.repository.getAllDismissed();
  }
}
