import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { Rarity } from "~/types/data-stores";

import RarityBadgeDropdown from "../RarityInsights.components/RarityBadgeDropdown";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: (rarity: Rarity) => ({
    badgeBg: `rgb(${rarity}, 0, 0)`,
    badgeText: `rgb(0, ${rarity}, 0)`,
    badgeBorder: `rgb(0, 0, ${rarity})`,
  }),
  RARITY_LABELS: {
    0: "Unknown",
    1: "Extremely Rare",
    2: "Rare",
    3: "Less Common",
    4: "Common",
  } as Record<Rarity, string>,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("RarityBadgeDropdown", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the current rarity label", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      expect(screen.getByText("Rare")).toBeInTheDocument();
    });

    it("renders Unknown label for rarity 0", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={0} onRarityChange={vi.fn()} />,
      );

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("renders Extremely Rare label for rarity 1", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={1} onRarityChange={vi.fn()} />,
      );

      expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
    });

    it("renders Common label for rarity 4", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={4} onRarityChange={vi.fn()} />,
      );

      expect(screen.getByText("Common")).toBeInTheDocument();
    });

    it("applies inline styles from getRarityStyles", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={3} onRarityChange={vi.fn()} />,
      );

      const badge = screen.getByText("Less Common");
      expect(badge).toHaveStyle({
        backgroundColor: "rgb(3, 0, 0)",
        color: "rgb(0, 3, 0)",
      });
    });

    it("renders the edit icon button when not disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      expect(screen.getByTitle("Edit rarity")).toBeInTheDocument();
    });

    it("does not render the edit icon button when disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      expect(screen.queryByTitle("Edit rarity")).not.toBeInTheDocument();
    });

    it("does not render the dropdown by default", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      // None of the dropdown option labels should be visible (other than the current badge itself)
      // The dropdown lists all 5 rarities. When closed, only the badge label shows.
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });
  });

  // ── Outline prop ───────────────────────────────────────────────────────

  describe("outline prop", () => {
    it("uses transparent border when outline is false", () => {
      const { container } = renderWithProviders(
        <RarityBadgeDropdown
          rarity={2}
          onRarityChange={vi.fn()}
          outline={false}
        />,
      );

      const badge = container.querySelector(".badge.badge-sm") as HTMLElement;
      expect(badge.style.borderColor).toBe("transparent");
    });

    it("uses rarity border color when outline is true", () => {
      renderWithProviders(
        <RarityBadgeDropdown
          rarity={2}
          onRarityChange={vi.fn()}
          outline={true}
        />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).toHaveStyle({ borderColor: "rgb(0, 0, 2)" });
    });
  });

  // ── Toggle dropdown ────────────────────────────────────────────────────

  describe("toggle dropdown", () => {
    it("opens dropdown when badge is clicked", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByText("Rare"));

      // All 5 rarity options should be visible in the dropdown
      expect(screen.getByText("Unknown")).toBeInTheDocument();
      expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
      // "Rare" appears twice: the badge + the dropdown option
      expect(screen.getAllByText("Rare")).toHaveLength(2);
      expect(screen.getByText("Less Common")).toBeInTheDocument();
      expect(screen.getByText("Common")).toBeInTheDocument();
    });

    it("closes dropdown when badge is clicked again", async () => {
      const { user, container } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      // Open — click the badge button (first .badge-sm)
      const badgeButton = container.querySelector(
        ".badge.badge-sm",
      ) as HTMLElement;
      await user.click(badgeButton);
      expect(screen.getByText("Unknown")).toBeInTheDocument();

      // Close — click the same badge button again
      await user.click(badgeButton);
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });

    it("opens dropdown when edit icon is clicked", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByTitle("Edit rarity"));

      expect(screen.getByText("Unknown")).toBeInTheDocument();
      expect(screen.getByText("Common")).toBeInTheDocument();
    });

    it("toggles dropdown closed when edit icon is clicked while open", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      // Open via badge
      await user.click(screen.getByText("Rare"));
      expect(screen.getByText("Unknown")).toBeInTheDocument();

      // Close via edit icon
      await user.click(screen.getByTitle("Edit rarity"));
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });
  });

  // ── Dropdown options ───────────────────────────────────────────────────

  describe("dropdown options", () => {
    it("lists all 5 rarity options (R0–R4)", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={0} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByRole("button", { name: "Unknown" }));

      const buttons = screen
        .getAllByRole("button")
        .filter((btn) => btn.closest(".absolute"));
      expect(buttons).toHaveLength(5);
    });

    it("shows a checkmark on the currently selected rarity", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByText("Rare"));

      // The checkmark ✓ should be present for the selected rarity
      expect(screen.getByText("✓")).toBeInTheDocument();
    });

    it("shows only one checkmark (for the current rarity)", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={3} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByText("Less Common"));

      const checkmarks = screen.getAllByText("✓");
      expect(checkmarks).toHaveLength(1);
    });
  });

  // ── Selecting a rarity ─────────────────────────────────────────────────

  describe("selecting a rarity", () => {
    it("calls onRarityChange when a different rarity is selected", async () => {
      const onRarityChange = vi.fn();
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={onRarityChange} />,
      );

      // Open dropdown
      await user.click(screen.getByText("Rare"));

      // Click "Common" (rarity 4) in the dropdown
      await user.click(screen.getByText("Common"));

      expect(onRarityChange).toHaveBeenCalledWith(4);
      expect(onRarityChange).toHaveBeenCalledTimes(1);
    });

    it("does not call onRarityChange when the same rarity is selected", async () => {
      const onRarityChange = vi.fn();
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={onRarityChange} />,
      );

      // Open dropdown
      await user.click(screen.getByText("Rare"));

      // Click "Rare" option in the dropdown (same as current)
      // There are 2 "Rare" texts — the badge and the dropdown item
      const rareButtons = screen.getAllByText("Rare");
      // The dropdown option is the second one
      await user.click(rareButtons[1]);

      expect(onRarityChange).not.toHaveBeenCalled();
    });

    it("closes the dropdown after selecting a different rarity", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByText("Rare"));
      expect(screen.getByText("Unknown")).toBeInTheDocument();

      await user.click(screen.getByText("Common"));

      // Dropdown should be closed — "Unknown" should no longer be in the dropdown
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });

    it("closes the dropdown after selecting the same rarity", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      await user.click(screen.getByText("Rare"));
      expect(screen.getByText("Unknown")).toBeInTheDocument();

      // Click the "Rare" option in the dropdown
      const rareButtons = screen.getAllByText("Rare");
      await user.click(rareButtons[1]);

      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });

    it("calls onRarityChange with 0 when Unknown is selected", async () => {
      const onRarityChange = vi.fn();
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={3} onRarityChange={onRarityChange} />,
      );

      await user.click(screen.getByText("Less Common"));
      await user.click(screen.getByText("Unknown"));

      expect(onRarityChange).toHaveBeenCalledWith(0);
    });

    it("calls onRarityChange with 1 when Extremely Rare is selected", async () => {
      const onRarityChange = vi.fn();
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={4} onRarityChange={onRarityChange} />,
      );

      await user.click(screen.getByText("Common"));
      await user.click(screen.getByText("Extremely Rare"));

      expect(onRarityChange).toHaveBeenCalledWith(1);
    });
  });

  // ── Disabled state ─────────────────────────────────────────────────────

  describe("disabled state", () => {
    it("does not open dropdown when badge is clicked while disabled", async () => {
      const { user } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      await user.click(screen.getByText("Rare"));

      // The dropdown should not appear
      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
      expect(screen.queryByText("Common")).not.toBeInTheDocument();
    });

    it("applies cursor-not-allowed class to the badge when disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).toHaveClass("cursor-not-allowed");
    });

    it("applies opacity-50 class to the badge when disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).toHaveClass("opacity-50");
    });

    it("does not apply cursor-not-allowed when not disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).not.toHaveClass("cursor-not-allowed");
    });

    it("shows error tooltip when disabled", () => {
      const { container } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      const tooltip = container.querySelector(".tooltip-error");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute("data-tip", "Cannot edit rarity");
    });

    it("shows primary tooltip when not disabled", () => {
      const { container } = renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />,
      );

      const tooltip = container.querySelector(".tooltip-primary");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute("data-tip", "Click to change rarity");
    });

    it("sets the badge button as disabled", () => {
      renderWithProviders(
        <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} disabled />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).toBeDisabled();
    });
  });

  // ── Close on blur ──────────────────────────────────────────────────────

  describe("close on blur", () => {
    it("closes dropdown when focus moves outside the component", async () => {
      const { user } = renderWithProviders(
        <div>
          <RarityBadgeDropdown rarity={2} onRarityChange={vi.fn()} />
          <button>Outside</button>
        </div>,
      );

      // Open dropdown
      await user.click(screen.getByText("Rare"));
      expect(screen.getByText("Unknown")).toBeInTheDocument();

      // Tab away to move focus outside
      await user.click(screen.getByText("Outside"));

      expect(screen.queryByText("Unknown")).not.toBeInTheDocument();
    });
  });
});
