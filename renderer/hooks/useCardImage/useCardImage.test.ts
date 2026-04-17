import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCardImage } from "./useCardImage";

vi.mock("~/renderer/lib/poe1-card-assets", () => ({
  getCardImage: vi.fn(),
  loadCardImage: vi.fn(),
}));

import { getCardImage, loadCardImage } from "~/renderer/lib/poe1-card-assets";

const mockedGetCardImage = vi.mocked(getCardImage);
const mockedLoadCardImage = vi.mocked(loadCardImage);

describe("useCardImage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns cached image immediately when getCardImage returns a value", () => {
    mockedGetCardImage.mockReturnValue("cached-url.png");
    mockedLoadCardImage.mockResolvedValue("cached-url.png");

    const { result } = renderHook(() => useCardImage("some-art"));

    expect(result.current).toBe("cached-url.png");
    expect(mockedLoadCardImage).not.toHaveBeenCalled();
  });

  it("starts loading and updates state when getCardImage returns empty string", async () => {
    mockedGetCardImage.mockReturnValue("");

    let resolveLoad!: (url: string) => void;
    mockedLoadCardImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const { result } = renderHook(() => useCardImage("some-art"));

    // Initially empty since not cached
    expect(result.current).toBe("");
    expect(mockedLoadCardImage).toHaveBeenCalledWith("some-art");

    await act(async () => {
      resolveLoad("loaded-url.png");
    });

    expect(result.current).toBe("loaded-url.png");
  });

  it("does not update state after unmount (cancelled cleanup)", async () => {
    mockedGetCardImage.mockReturnValue("");

    let resolveLoad!: (url: string) => void;
    mockedLoadCardImage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const { result, unmount } = renderHook(() => useCardImage("some-art"));

    expect(result.current).toBe("");

    unmount();

    // Resolve after unmount — should not throw or update
    await act(async () => {
      resolveLoad("loaded-url.png");
    });

    // result.current is still the last value before unmount
    expect(result.current).toBe("");
  });

  it("reloads when artSrc changes", async () => {
    mockedGetCardImage.mockReturnValue("");
    mockedLoadCardImage.mockResolvedValue("first-url.png");

    const { result, rerender } = renderHook(
      ({ artSrc }: { artSrc: string }) => useCardImage(artSrc),
      { initialProps: { artSrc: "art-1" } },
    );

    await act(async () => {
      // let first load resolve
    });

    expect(result.current).toBe("first-url.png");

    mockedLoadCardImage.mockResolvedValue("second-url.png");

    rerender({ artSrc: "art-2" });

    await act(async () => {
      // let second load resolve
    });

    expect(result.current).toBe("second-url.png");
    expect(mockedLoadCardImage).toHaveBeenCalledWith("art-2");
  });

  it("skips loading when artSrc changes but new value is already cached", async () => {
    // First render: not cached
    mockedGetCardImage.mockReturnValue("");
    mockedLoadCardImage.mockResolvedValue("url-1.png");

    const { result, rerender } = renderHook(
      ({ artSrc }: { artSrc: string }) => useCardImage(artSrc),
      { initialProps: { artSrc: "art-1" } },
    );

    await act(async () => {});

    // Second render: cached
    mockedGetCardImage.mockReturnValue("cached-2.png");
    mockedLoadCardImage.mockClear();

    rerender({ artSrc: "art-2" });

    expect(result.current).toBe("cached-2.png");
    expect(mockedLoadCardImage).not.toHaveBeenCalled();
  });
});
