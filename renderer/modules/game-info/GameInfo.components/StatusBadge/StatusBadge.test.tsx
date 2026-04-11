import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import StatusBadge from "./StatusBadge";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    gameInfo: {
      isGameOnline: vi.fn(() => false),
      ...overrides.gameInfo,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("StatusBadge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Running" text and success badge when game is online', () => {
    setupStore({
      gameInfo: { isGameOnline: vi.fn(() => true) },
    });

    renderWithProviders(<StatusBadge game="poe1" />);

    expect(screen.getByText("Running")).toBeInTheDocument();

    const badge = screen.getByText("Running").closest(".badge");
    expect(badge).toHaveClass("badge-success");
  });

  it('shows "Offline" text when game is offline', () => {
    setupStore({
      gameInfo: { isGameOnline: vi.fn(() => false) },
    });

    renderWithProviders(<StatusBadge game="poe1" />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("uses correct game prop when calling isGameOnline", () => {
    const isGameOnlineMock = vi.fn(() => false);
    setupStore({
      gameInfo: { isGameOnline: isGameOnlineMock },
    });

    renderWithProviders(<StatusBadge game="poe2" />);

    expect(isGameOnlineMock).toHaveBeenCalledWith("poe2");
  });
});
