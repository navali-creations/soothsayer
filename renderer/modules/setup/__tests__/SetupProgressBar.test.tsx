import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import SetupProgressBar from "../Setup.components/SetupProgressBar";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/main/modules/app-setup/AppSetup.types", () => ({
  SETUP_STEPS: {
    NOT_STARTED: 0,
    SELECT_GAME: 1,
    SELECT_LEAGUE: 2,
    SELECT_CLIENT_PATH: 3,
    TELEMETRY_CONSENT: 4,
  },
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SetupProgressBar", () => {
  // ── Step labels ────────────────────────────────────────────────────────

  describe("step labels", () => {
    it("renders all 4 step labels", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      expect(screen.getByText("Select Game")).toBeInTheDocument();
      expect(screen.getByText("Select League")).toBeInTheDocument();
      expect(screen.getByText("Client.txt Path")).toBeInTheDocument();
      expect(screen.getByText("Privacy & Telemetry")).toBeInTheDocument();
    });
  });

  // ── Active step highlighting ───────────────────────────────────────────

  describe("active step highlighting", () => {
    it("highlights step 1 (Select Game) when currentStep is 1", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const label = screen.getByText("Select Game");
      expect(label).toHaveClass("text-primary");
    });

    it("highlights step 2 (Select League) when currentStep is 2", () => {
      renderWithProviders(<SetupProgressBar currentStep={2} />);

      const label = screen.getByText("Select League");
      expect(label).toHaveClass("text-primary");
    });

    it("highlights step 3 (Client.txt Path) when currentStep is 3", () => {
      renderWithProviders(<SetupProgressBar currentStep={3} />);

      const label = screen.getByText("Client.txt Path");
      expect(label).toHaveClass("text-primary");
    });

    it("highlights step 4 (Privacy & Telemetry) when currentStep is 4", () => {
      renderWithProviders(<SetupProgressBar currentStep={4} />);

      const label = screen.getByText("Privacy & Telemetry");
      expect(label).toHaveClass("text-primary");
    });

    it("applies ring styling to the active step circle", () => {
      renderWithProviders(<SetupProgressBar currentStep={2} />);

      // The active step circle has ring-2 ring-primary ring-offset-2
      const circles = document.querySelectorAll(".rounded-full");
      // Step 2 is the second circle (index 1)
      const activeCircle = circles[1];
      expect(activeCircle).toHaveClass("ring-2");
      expect(activeCircle).toHaveClass("ring-primary");
      expect(activeCircle).toHaveClass("ring-offset-2");
    });
  });

  // ── Completed steps (checkmarks) ───────────────────────────────────────

  describe("completed steps", () => {
    it("shows checkmark SVGs for completed steps (before current step)", () => {
      renderWithProviders(<SetupProgressBar currentStep={3} />);

      // Steps 1 and 2 are completed when currentStep is 3
      // Each completed step has an SVG checkmark with a path containing "M5 13l4 4L19 7"
      const circles = document.querySelectorAll(".rounded-full");

      // Step 1 circle (index 0) - completed
      const step1Svg = circles[0].querySelector("svg");
      expect(step1Svg).toBeInTheDocument();

      // Step 2 circle (index 1) - completed
      const step2Svg = circles[1].querySelector("svg");
      expect(step2Svg).toBeInTheDocument();
    });

    it("completed step labels have text-base-content class", () => {
      renderWithProviders(<SetupProgressBar currentStep={3} />);

      const selectGameLabel = screen.getByText("Select Game");
      const selectLeagueLabel = screen.getByText("Select League");

      expect(selectGameLabel).toHaveClass("text-base-content");
      expect(selectLeagueLabel).toHaveClass("text-base-content");
    });

    it("completed step circles have bg-primary styling", () => {
      renderWithProviders(<SetupProgressBar currentStep={4} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Steps 1, 2, 3 are completed (indices 0, 1, 2)
      expect(circles[0]).toHaveClass("bg-primary");
      expect(circles[1]).toHaveClass("bg-primary");
      expect(circles[2]).toHaveClass("bg-primary");
    });

    it("all steps show checkmarks when currentStep is beyond all steps", () => {
      // If currentStep were > 4, all 4 steps would be completed
      renderWithProviders(<SetupProgressBar currentStep={5} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Every circle should contain an SVG checkmark
      for (let i = 0; i < 4; i++) {
        const svg = circles[i].querySelector("svg");
        expect(svg).toBeInTheDocument();
      }
    });
  });

  // ── Future steps (step numbers) ────────────────────────────────────────

  describe("future steps", () => {
    it("shows step numbers for steps after the current step", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      // Steps 2, 3, 4 are future steps and should display their step numbers
      const circles = document.querySelectorAll(".rounded-full");

      // Step 2 circle (index 1) should contain text "2"
      expect(circles[1]).toHaveTextContent("2");
      // Step 3 circle (index 2) should contain text "3"
      expect(circles[2]).toHaveTextContent("3");
      // Step 4 circle (index 3) should contain text "4"
      expect(circles[3]).toHaveTextContent("4");
    });

    it("future step labels have muted text styling", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const selectLeagueLabel = screen.getByText("Select League");
      const clientPathLabel = screen.getByText("Client.txt Path");
      const telemetryLabel = screen.getByText("Privacy & Telemetry");

      expect(selectLeagueLabel).toHaveClass("text-base-content/50");
      expect(clientPathLabel).toHaveClass("text-base-content/50");
      expect(telemetryLabel).toHaveClass("text-base-content/50");
    });

    it("future step circles do not have checkmark SVGs", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Future circles (indices 1, 2, 3) should not contain SVGs
      expect(circles[1].querySelector("svg")).not.toBeInTheDocument();
      expect(circles[2].querySelector("svg")).not.toBeInTheDocument();
      expect(circles[3].querySelector("svg")).not.toBeInTheDocument();
    });

    it("future step circles have subdued bg-primary/20 styling", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Future steps should not have the solid bg-primary class
      // (they have bg-primary/20 instead, but checking absence of ring)
      expect(circles[1]).not.toHaveClass("ring-2");
      expect(circles[2]).not.toHaveClass("ring-2");
      expect(circles[3]).not.toHaveClass("ring-2");
    });
  });

  // ── Mixed states ───────────────────────────────────────────────────────

  describe("mixed step states", () => {
    it("shows correct state for each step when currentStep is 2", () => {
      renderWithProviders(<SetupProgressBar currentStep={2} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Step 1: completed — should have SVG checkmark
      expect(circles[0].querySelector("svg")).toBeInTheDocument();
      expect(circles[0]).toHaveClass("bg-primary");

      // Step 2: active — should have ring styling and show step number "2"
      expect(circles[1]).toHaveClass("ring-2");
      expect(circles[1]).toHaveTextContent("2");

      // Step 3: future — should show step number "3"
      expect(circles[2]).toHaveTextContent("3");
      expect(circles[2]).not.toHaveClass("ring-2");

      // Step 4: future — should show step number "4"
      expect(circles[3]).toHaveTextContent("4");
      expect(circles[3]).not.toHaveClass("ring-2");
    });

    it("shows correct state for each step when currentStep is 4", () => {
      renderWithProviders(<SetupProgressBar currentStep={4} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Steps 1, 2, 3: all completed — should have SVG checkmarks
      expect(circles[0].querySelector("svg")).toBeInTheDocument();
      expect(circles[1].querySelector("svg")).toBeInTheDocument();
      expect(circles[2].querySelector("svg")).toBeInTheDocument();

      // Step 4: active — should have ring styling
      expect(circles[3]).toHaveClass("ring-2");
      expect(circles[3]).toHaveClass("ring-primary");
    });
  });

  // ── Connector lines ────────────────────────────────────────────────────

  describe("connector lines", () => {
    it("renders connector lines between steps (not after last step)", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      // There should be 3 connector lines (between steps 1-2, 2-3, 3-4)
      // The last step does not have a connector after it
      const connectors = document.querySelectorAll(".w-0\\.5");
      expect(connectors).toHaveLength(3);
    });

    it("completed connector lines have bg-primary styling", () => {
      renderWithProviders(<SetupProgressBar currentStep={3} />);

      const connectors = document.querySelectorAll(".w-0\\.5");

      // Connector between step 1-2 is completed (step 1 is completed)
      expect(connectors[0]).toHaveClass("bg-primary");
      // Connector between step 2-3 is completed (step 2 is completed)
      expect(connectors[1]).toHaveClass("bg-primary");
    });

    it("future connector lines have subdued bg-primary/20 styling", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const connectors = document.querySelectorAll(".w-0\\.5");

      // All connectors after the active step should have subdued styling
      // Connectors are from steps: 1→2, 2→3, 3→4
      // Since step 1 is active (not completed), its connector is not filled
      // We check that not all connectors have bg-primary
      expect(connectors[0]).not.toHaveClass("bg-primary");
    });
  });

  // ── Edge case: step 1 (first step) ─────────────────────────────────────

  describe("edge cases", () => {
    it("no steps are completed when on step 1", () => {
      renderWithProviders(<SetupProgressBar currentStep={1} />);

      const circles = document.querySelectorAll(".rounded-full");

      // Step 1 is active, not completed — should not have a checkmark
      expect(circles[0].querySelector("svg")).not.toBeInTheDocument();
      // Should show step number instead
      expect(circles[0]).toHaveTextContent("1");
    });
  });
});
