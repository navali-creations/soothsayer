import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

import AppMenu from "./AppMenu";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock("../AppControls/AppControls", () => ({
  default: () => <div data-testid="app-controls" />,
}));

vi.mock("../AppTitle/AppTitle", () => ({
  default: () => <div data-testid="app-title" />,
}));

vi.mock("../GameSelector/GameSelector", () => ({
  default: () => <div data-testid="game-selector" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    setup: {
      setupState: { isComplete: true },
      ...overrides.setup,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AppMenu", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders AppTitle", () => {
    setupStore();
    renderWithProviders(<AppMenu />);

    expect(screen.getByTestId("app-title")).toBeInTheDocument();
  });

  it("renders AppControls", () => {
    setupStore();
    renderWithProviders(<AppMenu />);

    expect(screen.getByTestId("app-controls")).toBeInTheDocument();
  });

  it("renders GameSelector when NOT in setup mode", () => {
    setupStore({ setup: { setupState: { isComplete: true } } });
    renderWithProviders(<AppMenu />);

    expect(screen.getByTestId("game-selector")).toBeInTheDocument();
  });

  it("hides GameSelector when in setup mode", () => {
    setupStore({ setup: { setupState: { isComplete: false } } });
    renderWithProviders(<AppMenu />);

    expect(screen.queryByTestId("game-selector")).not.toBeInTheDocument();
  });

  it("has correct shadow class for setup mode", () => {
    setupStore({ setup: { setupState: { isComplete: false } } });
    const { container } = renderWithProviders(<AppMenu />);

    const menuRoot = container.firstElementChild as HTMLElement;
    expect(menuRoot.className).toContain("shadow-[0_0_10px_black]");
  });

  it("has correct shadow class for normal mode", () => {
    setupStore({ setup: { setupState: { isComplete: true } } });
    const { container } = renderWithProviders(<AppMenu />);

    const menuRoot = container.firstElementChild as HTMLElement;
    expect(menuRoot.className).toContain("shadow-[160px_0_10px_black]");
  });

  it("hides GameSelector when setupState is null", () => {
    setupStore({ setup: { setupState: null } });
    renderWithProviders(<AppMenu />);

    expect(screen.queryByTestId("game-selector")).not.toBeInTheDocument();
  });
});
