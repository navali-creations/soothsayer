import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import SetupHeader from "./SetupHeader";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupHeader", () => {
  // ── Default props ──────────────────────────────────────────────────────

  describe("default props", () => {
    it("renders the default title", () => {
      renderWithProviders(<SetupHeader />);

      expect(screen.getByText("Welcome to Soothsayer")).toBeInTheDocument();
    });

    it("renders the default description", () => {
      renderWithProviders(<SetupHeader />);

      expect(
        screen.getByText("Let's get you set up in just a few steps"),
      ).toBeInTheDocument();
    });
  });

  // ── Custom props ───────────────────────────────────────────────────────

  describe("custom props", () => {
    it("renders a custom title when provided", () => {
      renderWithProviders(<SetupHeader title="Custom Title" />);

      expect(screen.getByText("Custom Title")).toBeInTheDocument();
      expect(
        screen.queryByText("Welcome to Soothsayer"),
      ).not.toBeInTheDocument();
    });

    it("renders a custom description when provided", () => {
      renderWithProviders(
        <SetupHeader description="This is a custom description" />,
      );

      expect(
        screen.getByText("This is a custom description"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Let's get you set up in just a few steps"),
      ).not.toBeInTheDocument();
    });
  });
});
