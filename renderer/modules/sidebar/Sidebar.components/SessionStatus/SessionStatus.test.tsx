import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useTickingTimer } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import { SessionStatus } from "./SessionStatus";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/hooks", () => ({
  useTickingTimer: vi.fn(() => ({
    hours: 0,
    minutes: 12,
    seconds: 34,
  })),
}));

vi.mock("~/renderer/components", () => ({
  Countdown: ({
    timer,
    alwaysShowHours,
  }: {
    timer: { minutes: number; seconds: number };
    alwaysShowHours?: boolean;
  }) => (
    <div
      data-always-show-hours={String(alwaysShowHours)}
      data-testid="countdown"
    >
      {timer.minutes}:{timer.seconds}
    </div>
  ),
  Flex: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);
const mockUseTickingTimer = vi.mocked(useTickingTimer);

function setupCurrentSession({
  isActive = true,
  startedAt = "2026-05-13T10:00:00.000Z",
}: {
  isActive?: boolean;
  startedAt?: string | null;
} = {}) {
  mockUseBoundStore.mockReturnValue({
    currentSession: {
      getIsCurrentSessionActive: vi.fn(() => isActive),
      getSessionInfo: vi.fn(() =>
        startedAt === null
          ? null
          : {
              startedAt,
              league: "Standard",
            },
      ),
    },
  } as never);
}

describe("SessionStatus", () => {
  it("renders the active session status and countdown", () => {
    setupCurrentSession();

    renderWithProviders(<SessionStatus />);

    expect(screen.getByText("Session")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByTestId("countdown")).toHaveAttribute(
      "data-always-show-hours",
      "true",
    );
    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: "2026-05-13T10:00:00.000Z",
      direction: "up",
      enabled: true,
    });
  });

  it("disables the timer when the session is inactive", () => {
    setupCurrentSession({ isActive: false, startedAt: null });

    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: null,
      direction: "up",
      enabled: false,
    });
  });

  it("disables the timer when session info is missing", () => {
    setupCurrentSession({ isActive: true, startedAt: null });

    renderWithProviders(<SessionStatus />);

    expect(mockUseTickingTimer).toHaveBeenCalledWith({
      referenceTime: null,
      direction: "up",
      enabled: false,
    });
  });
});
