import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIpcHandler } from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockIpcHandle,
  mockDismiss,
  mockGetAllDismissed,
  mockAssertTrustedSender,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockDismiss: vi.fn(),
  mockGetAllDismissed: vi.fn(),
  mockAssertTrustedSender: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: () => ({
      getKysely: () => ({}),
    }),
  },
}));

vi.mock("../Banners.repository", () => ({
  BannersRepository: class {
    dismiss = mockDismiss;
    getDismissed = mockGetAllDismissed;
  },
}));

vi.mock("~/main/utils/ipc-validation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/main/utils/ipc-validation")>();
  return {
    ...actual,
    assertTrustedSender: mockAssertTrustedSender,
  };
});

import { BannersChannel } from "../Banners.channels";
import { BannersService } from "../Banners.service";
import { BANNER_IDS } from "../Banners.types";

describe("BannersService IPC", () => {
  beforeEach(() => {
    resetSingleton(BannersService);
    vi.clearAllMocks();
    mockDismiss.mockResolvedValue(undefined);
    mockGetAllDismissed.mockResolvedValue(["community-backfill"]);
    BannersService.getInstance();
  });

  it("exposes the known community banner identifier", () => {
    expect(BANNER_IDS.COMMUNITY_BACKFILL).toBe("community-backfill");
  });

  it("validates the sender and dismisses an allowlisted banner identifier", async () => {
    const handler = getIpcHandler(mockIpcHandle, BannersChannel.Dismiss);
    const event = {};

    await expect(handler(event, "community-backfill")).resolves.toEqual({
      success: true,
    });
    expect(mockAssertTrustedSender).toHaveBeenCalledWith(
      event,
      BannersChannel.Dismiss,
    );
    expect(mockDismiss).toHaveBeenCalledWith("community-backfill");

    await expect(handler(event, "unknown-banner")).resolves.toMatchObject({
      success: false,
    });
  });

  it("returns only allowlisted dismissed banners", async () => {
    const handler = getIpcHandler(
      mockIpcHandle,
      BannersChannel.GetAllDismissed,
    );

    mockGetAllDismissed.mockResolvedValueOnce(["community-backfill"]);
    const event = {};

    await expect(handler(event)).resolves.toEqual({
      success: true,
      bannerIds: ["community-backfill"],
    });
    expect(mockAssertTrustedSender).toHaveBeenCalledWith(
      event,
      BannersChannel.GetAllDismissed,
    );
    expect(mockGetAllDismissed).toHaveBeenCalledWith(["community-backfill"]);
  });

  it("returns a safe failure when the repository is unavailable", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const handler = getIpcHandler(
      mockIpcHandle,
      BannersChannel.GetAllDismissed,
    );
    mockGetAllDismissed.mockRejectedValueOnce(
      new Error("database unavailable"),
    );

    await expect(handler({})).resolves.toEqual({
      success: false,
      error: "Banner preferences are temporarily unavailable.",
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
