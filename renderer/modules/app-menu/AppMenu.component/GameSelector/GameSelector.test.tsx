import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import GameSelector from "./GameSelector";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("./GameSelectorTab/GameSelectorTab", () => ({
  default: ({ game }: any) => <div data-testid={`tab-${game}`} />,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("GameSelector", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders with data-onboarding="game-selector" attribute', () => {
    renderWithProviders(<GameSelector />);

    const el = document.querySelector('[data-onboarding="game-selector"]');
    expect(el).toBeInTheDocument();
  });

  it("renders GameSelectorTab for poe1", () => {
    renderWithProviders(<GameSelector />);

    expect(screen.getByTestId("tab-poe1")).toBeInTheDocument();
  });

  it('has role="tablist" attribute', () => {
    renderWithProviders(<GameSelector />);

    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });
});
