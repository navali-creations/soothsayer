import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIpcHandler } from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockIpcHandle,
  mockIsDismissed,
  mockDismiss,
  mockGetAllDismissed,
  mockAssertTrustedSender,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockIsDismissed: vi.fn(),
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
    isDismissed = mockIsDismissed;
    dismiss = mockDismiss;
    getAllDismissed = mockGetAllDismissed;
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
    mockIsDismissed.mockResolvedValue(true);
    mockDismiss.mockResolvedValue(undefined);
    mockGetAllDismissed.mockResolvedValue(["community-backfill"]);
    BannersService.getInstance();
  });

  it("exposes the known community banner identifier", () => {
    expect(BANNER_IDS.COMMUNITY_BACKFILL).toBe("community-backfill");
  });

  it("queries a bounded banner identifier", async () => {
    const handler = getIpcHandler(mockIpcHandle, BannersChannel.IsDismissed);

    await expect(handler({}, "community-backfill")).resolves.toBe(true);
    expect(mockIsDismissed).toHaveBeenCalledWith("community-backfill");

    await expect(handler({}, "x".repeat(101))).resolves.toMatchObject({
      success: false,
    });
  });

  it("validates the sender and dismisses a bounded banner identifier", async () => {
    const handler = getIpcHandler(mockIpcHandle, BannersChannel.Dismiss);
    const event = {};

    await expect(handler(event, "community-backfill")).resolves.toBeUndefined();
    expect(mockAssertTrustedSender).toHaveBeenCalledWith(
      event,
      BannersChannel.Dismiss,
    );
    expect(mockDismiss).toHaveBeenCalledWith("community-backfill");

    mockAssertTrustedSender.mockImplementationOnce(() => {
      throw new Error("untrusted");
    });
    await expect(handler(event, "community-backfill")).rejects.toThrow(
      "untrusted",
    );
  });

  it("returns dismissed banners and sanitizes repository failures", async () => {
    const handler = getIpcHandler(
      mockIpcHandle,
      BannersChannel.GetAllDismissed,
    );

    await expect(handler({})).resolves.toEqual(["community-backfill"]);

    mockGetAllDismissed.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await expect(handler({})).rejects.toThrow("database unavailable");
  });
});
