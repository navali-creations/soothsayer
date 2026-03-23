import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import AppHelpCard from "./AppHelpCard";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/modules/onboarding", () => ({
  OnboardingButton: (props: any) => (
    <button data-testid="onboarding-button" {...props} />
  ),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AppHelpCard", () => {
  it('renders "App Help" title', () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByRole("heading", { name: /App Help/i }),
    ).toBeInTheDocument();
  });

  it("renders description text about needing help", () => {
    renderWithProviders(<AppHelpCard />);

    expect(
      screen.getByText(/Need help getting started or want a refresher\?/),
    ).toBeInTheDocument();
  });

  it('renders "App Tour" section heading', () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByText("App Tour")).toBeInTheDocument();
  });

  it("renders OnboardingButton", () => {
    renderWithProviders(<AppHelpCard />);

    expect(screen.getByTestId("onboarding-button")).toBeInTheDocument();
  });
});
