import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import {
  assertEnum,
  assertTrustedSender,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import { BannersChannel } from "./Banners.channels";
import { BannersRepository } from "./Banners.repository";
import type {
  BannerDismissalsResult,
  BannerDismissResult,
} from "./Banners.types";
import { BANNER_ID_VALUES } from "./Banners.types";

const BANNERS_ERROR = "Banner preferences are temporarily unavailable.";

function toSafeFailure(
  error: unknown,
  channel: BannersChannel,
): { success: false; error: string } {
  try {
    return handleValidationError(error, channel);
  } catch (unexpectedError) {
    console.error(`[Banners] ${channel} failed:`, unexpectedError);
    return { success: false, error: BANNERS_ERROR };
  }
}

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
    ipcMain.handle(BannersChannel.Dismiss, async (event, bannerId: unknown) => {
      try {
        assertTrustedSender(event, BannersChannel.Dismiss);
        assertEnum(
          bannerId,
          "bannerId",
          BannersChannel.Dismiss,
          BANNER_ID_VALUES,
        );
        await this.repository.dismiss(bannerId);
        return { success: true } satisfies BannerDismissResult;
      } catch (error) {
        return toSafeFailure(error, BannersChannel.Dismiss);
      }
    });

    ipcMain.handle(BannersChannel.GetAllDismissed, async (event) => {
      try {
        assertTrustedSender(event, BannersChannel.GetAllDismissed);
        const bannerIds = await this.repository.getDismissed(BANNER_ID_VALUES);
        return {
          success: true,
          bannerIds,
        } satisfies BannerDismissalsResult;
      } catch (error) {
        return toSafeFailure(error, BannersChannel.GetAllDismissed);
      }
    });
  }
}
