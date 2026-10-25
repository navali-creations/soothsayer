import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Child component stubs for YourDataTabContent ──────────────────────────

vi.mock("./CardDetailsPersonal", () => ({
  default: () => <div data-testid="personal" />,
}));

vi.mock("./CardDetailsDropTimeline", () => ({
  default: () => <div data-testid="drop-timeline" />,
}));

vi.mock("./CardDetailsSessionList", () => ({
  default: ({ cardName, game }: any) => (
    <div
      data-testid="session-list"
      data-card-name={cardName}
      data-game={game}
    />
  ),
}));

vi.mock("./LoadingOverlay/LoadingOverlay", () => ({
  default: ({ isLoading, children }: any) => (
    <div data-testid="loading-overlay" data-is-loading={String(isLoading)}>
      {children}
    </div>
  ),
}));

// ─── Component imports (after all mocks) ───────────────────────────────────

import YourDataTabContent from "./YourDataTabContent/YourDataTabContent";

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// YourDataTabContent
// ═══════════════════════════════════════════════════════════════════════════

describe("YourDataTabContent", () => {
  it("renders CardDetailsPersonal", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("personal")).toBeInTheDocument();
  });

  it("renders CardDetailsDropTimeline", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
  });

  it("renders CardDetailsSessionList with cardName and game props", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe2"
        isLoading={false}
      />,
    );
    const sessionList = screen.getByTestId("session-list");
    expect(sessionList).toBeInTheDocument();
    expect(sessionList).toHaveAttribute("data-card-name", "The Doctor");
    expect(sessionList).toHaveAttribute("data-game", "poe2");
  });

  it("passes isLoading=false to LoadingOverlay wrappers", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(2);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "false");
    }
  });

  it("passes isLoading=true to LoadingOverlay wrappers", () => {
    renderWithProviders(
      <YourDataTabContent cardName="The Doctor" game="poe1" isLoading={true} />,
    );
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(2);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "true");
    }
  });

  it("renders all sections when isLoading is false", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );
    expect(screen.getByTestId("personal")).toBeInTheDocument();
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("session-list")).toBeInTheDocument();
  });

  it("renders all sections with loading overlay when isLoading is true", () => {
    renderWithProviders(
      <YourDataTabContent cardName="The Doctor" game="poe1" isLoading={true} />,
    );

    // All content is still rendered (overlay doesn't remove children)
    expect(screen.getByTestId("personal")).toBeInTheDocument();
    expect(screen.getByTestId("drop-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("session-list")).toBeInTheDocument();

    // The stats and timeline overlays are in the loading state. The session
    // list owns its own request-specific loading state.
    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(2);
    for (const overlay of overlays) {
      expect(overlay).toHaveAttribute("data-is-loading", "true");
    }
  });

  it("leaves the session list to own its loading state", () => {
    renderWithProviders(
      <YourDataTabContent
        cardName="The Doctor"
        game="poe1"
        isLoading={false}
      />,
    );

    const overlays = screen.getAllByTestId("loading-overlay");
    expect(overlays).toHaveLength(2);

    // Each overlay wraps exactly one child component
    expect(overlays[0]).toContainElement(screen.getByTestId("personal"));
    expect(overlays[1]).toContainElement(screen.getByTestId("drop-timeline"));
    expect(overlays[0]).not.toContainElement(
      screen.getByTestId("session-list"),
    );
    expect(overlays[1]).not.toContainElement(
      screen.getByTestId("session-list"),
    );
  });
});
