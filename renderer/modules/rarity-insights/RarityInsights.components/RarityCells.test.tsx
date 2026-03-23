import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import PoeNinjaColumnHeader from "./PoeNinjaColumnHeader";
import PoeNinjaRarityCell from "./PoeNinjaRarityCell";
import ProhibitedLibraryColumnHeader from "./ProhibitedLibraryColumnHeader";
import ProhibitedLibraryRarityCell from "./ProhibitedLibraryRarityCell";

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

describe("PoeNinjaColumnHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe("rendering", () => {
    it("renders the poe.ninja label", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      expect(screen.getByText("poe.ninja")).toBeInTheDocument();
    });

    it("renders R1, R2, R3, R4 badges", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      expect(screen.getByText("R1")).toBeInTheDocument();
      expect(screen.getByText("R2")).toBeInTheDocument();
      expect(screen.getByText("R3")).toBeInTheDocument();
      expect(screen.getByText("R4")).toBeInTheDocument();
    });

    it("does not render an R0 badge", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      // There should be no "?" badge (the R0 short label)
      expect(screen.queryByText("?")).not.toBeInTheDocument();
    });

    it("renders exactly 4 badge buttons", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);
    });
  });

  // ── Active rarity styling ─────────────────────────────────────────────

  describe("active rarity styling", () => {
    it("sets full opacity on the active rarity badge", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={2} onRarityClick={vi.fn()} />,
      );

      const r2Button = screen.getByText("R2");
      expect(r2Button).toHaveStyle({ opacity: 1 });
    });

    it("sets 0.5 opacity on non-active rarity badges", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={2} onRarityClick={vi.fn()} />,
      );

      expect(screen.getByText("R1")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R3")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R4")).toHaveStyle({ opacity: 0.5 });
    });

    it("sets 0.5 opacity on all badges when activeRarity is null", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      expect(screen.getByText("R1")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R2")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R3")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R4")).toHaveStyle({ opacity: 0.5 });
    });
  });

  // ── Click behavior ────────────────────────────────────────────────────

  describe("click behavior", () => {
    it("calls onRarityClick with the clicked rarity", async () => {
      const onRarityClick = vi.fn();
      const { user } = renderWithProviders(
        <PoeNinjaColumnHeader
          activeRarity={null}
          onRarityClick={onRarityClick}
        />,
      );

      await user.click(screen.getByText("R3"));

      expect(onRarityClick).toHaveBeenCalledWith(3);
    });

    it("calls onRarityClick with rarity 1 when R1 is clicked", async () => {
      const onRarityClick = vi.fn();
      const { user } = renderWithProviders(
        <PoeNinjaColumnHeader
          activeRarity={null}
          onRarityClick={onRarityClick}
        />,
      );

      await user.click(screen.getByText("R1"));

      expect(onRarityClick).toHaveBeenCalledWith(1);
    });

    it("calls onRarityClick once per click", async () => {
      const onRarityClick = vi.fn();
      const { user } = renderWithProviders(
        <PoeNinjaColumnHeader
          activeRarity={null}
          onRarityClick={onRarityClick}
        />,
      );

      await user.click(screen.getByText("R4"));

      expect(onRarityClick).toHaveBeenCalledTimes(1);
    });
  });

  // ── Title attributes ──────────────────────────────────────────────────

  describe("title attributes", () => {
    it("has correct sort title on each badge", () => {
      renderWithProviders(
        <PoeNinjaColumnHeader activeRarity={null} onRarityClick={vi.fn()} />,
      );

      expect(screen.getByTitle("Sort by R1")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R2")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R3")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R4")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PoeNinjaRarityCell
// ═══════════════════════════════════════════════════════════════════════════

describe("PoeNinjaRarityCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders the correct label for rarity 1", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={1} cardName="The Doctor" />,
      );

      expect(screen.getByText("Extremely Rare")).toBeInTheDocument();
    });

    it("renders the correct label for rarity 2", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={2} cardName="The Nurse" />,
      );

      expect(screen.getByText("Rare")).toBeInTheDocument();
    });

    it("renders the correct label for rarity 3", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={3} cardName="The Patient" />,
      );

      expect(screen.getByText("Less Common")).toBeInTheDocument();
    });

    it("renders the correct label for rarity 4", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={4} cardName="Rain of Chaos" />,
      );

      expect(screen.getByText("Common")).toBeInTheDocument();
    });

    it("renders the correct label for rarity 0 (Unknown)", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={0} cardName="Some Card" />,
      );

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("warning icon for rarity 0", () => {
    it("shows warning icon when rarity is 0", () => {
      const { container } = renderWithProviders(
        <PoeNinjaRarityCell rarity={0} cardName="Some Card" />,
      );

      // The warning icon's tooltip wrapper has the data-tip attribute
      const tooltip = container.querySelector("[data-tip]");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute(
        "data-tip",
        "Low confidence or no pricing data from poe.ninja",
      );
    });

    it("does not show warning icon when rarity is 1", () => {
      const { container } = renderWithProviders(
        <PoeNinjaRarityCell rarity={1} cardName="The Doctor" />,
      );

      const tooltip = container.querySelector(".tooltip-warning");
      expect(tooltip).not.toBeInTheDocument();
    });

    it("does not show warning icon when rarity is 2", () => {
      const { container } = renderWithProviders(
        <PoeNinjaRarityCell rarity={2} cardName="The Nurse" />,
      );

      const tooltip = container.querySelector(".tooltip-warning");
      expect(tooltip).not.toBeInTheDocument();
    });

    it("does not show warning icon when rarity is 3", () => {
      const { container } = renderWithProviders(
        <PoeNinjaRarityCell rarity={3} cardName="Some Card" />,
      );

      const tooltip = container.querySelector(".tooltip-warning");
      expect(tooltip).not.toBeInTheDocument();
    });

    it("does not show warning icon when rarity is 4", () => {
      const { container } = renderWithProviders(
        <PoeNinjaRarityCell rarity={4} cardName="Some Card" />,
      );

      const tooltip = container.querySelector(".tooltip-warning");
      expect(tooltip).not.toBeInTheDocument();
    });
  });

  describe("badge styling", () => {
    it("applies the correct inline styles from getRarityStyles", () => {
      renderWithProviders(
        <PoeNinjaRarityCell rarity={2} cardName="The Nurse" />,
      );

      const badge = screen.getByText("Rare");
      expect(badge).toHaveStyle({
        backgroundColor: "rgb(2, 0, 0)",
        color: "rgb(0, 2, 0)",
        borderColor: "rgb(0, 0, 2)",
        borderWidth: "1px",
        borderStyle: "solid",
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ProhibitedLibraryColumnHeader
// ═══════════════════════════════════════════════════════════════════════════

describe("ProhibitedLibraryColumnHeader", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rendering", () => {
    it("renders the Prohibited Library label", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByText("Prohibited Library")).toBeInTheDocument();
    });

    it("renders R1, R2, R3, R4 badges", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByText("R1")).toBeInTheDocument();
      expect(screen.getByText("R2")).toBeInTheDocument();
      expect(screen.getByText("R3")).toBeInTheDocument();
      expect(screen.getByText("R4")).toBeInTheDocument();
    });

    it("does not render an R0 badge", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.queryByText("?")).not.toBeInTheDocument();
      expect(screen.queryByText("R0")).not.toBeInTheDocument();
    });

    it("renders exactly 4 badge buttons", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(4);
    });
  });

  describe("active rarity styling", () => {
    it("sets full opacity on the active rarity badge", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={1}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByText("R1")).toHaveStyle({ opacity: 1 });
    });

    it("sets 0.5 opacity on non-active rarity badges", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={1}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByText("R2")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R3")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R4")).toHaveStyle({ opacity: 0.5 });
    });

    it("sets 0.5 opacity on all badges when activeRarity is null", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByText("R1")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R2")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R3")).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByText("R4")).toHaveStyle({ opacity: 0.5 });
    });
  });

  describe("click behavior", () => {
    it("calls onRarityClick with the clicked rarity", async () => {
      const onRarityClick = vi.fn();
      const { user } = renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={onRarityClick}
        />,
      );

      await user.click(screen.getByText("R2"));

      expect(onRarityClick).toHaveBeenCalledWith(2);
    });

    it("calls onRarityClick once per click", async () => {
      const onRarityClick = vi.fn();
      const { user } = renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={onRarityClick}
        />,
      );

      await user.click(screen.getByText("R4"));

      expect(onRarityClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("title attributes", () => {
    it("has correct sort title on each badge", () => {
      renderWithProviders(
        <ProhibitedLibraryColumnHeader
          activeRarity={null}
          onRarityClick={vi.fn()}
        />,
      );

      expect(screen.getByTitle("Sort by R1")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R2")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R3")).toBeInTheDocument();
      expect(screen.getByTitle("Sort by R4")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ProhibitedLibraryRarityCell
// ═══════════════════════════════════════════════════════════════════════════

describe("ProhibitedLibraryRarityCell", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("null rarity (card absent from PL dataset)", () => {
    it("renders a dash", () => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={null} />);

      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("shows a tooltip explaining the card is not found", () => {
      const { container } = renderWithProviders(
        <ProhibitedLibraryRarityCell rarity={null} />,
      );

      const tooltip = container.querySelector("[data-tip]");
      expect(tooltip).toBeInTheDocument();
      expect(tooltip).toHaveAttribute(
        "data-tip",
        "Card not found in Prohibited Library dataset",
      );
    });

    it("does not render a badge", () => {
      const { container } = renderWithProviders(
        <ProhibitedLibraryRarityCell rarity={null} />,
      );

      expect(container.querySelector(".badge")).not.toBeInTheDocument();
    });
  });

  describe("rarity 0 (Unknown — no drop data)", () => {
    it("renders Unknown badge", () => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={0} />);

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("renders a styled badge element", () => {
      const { container } = renderWithProviders(
        <ProhibitedLibraryRarityCell rarity={0} />,
      );

      const badge = container.querySelector(".badge");
      expect(badge).toBeInTheDocument();
    });

    it("does not render a dash", () => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={0} />);

      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });
  });

  describe("known rarities (1-4)", () => {
    it.each([
      [1, "Extremely Rare"],
      [2, "Rare"],
      [3, "Less Common"],
      [4, "Common"],
    ] as [
      KnownRarity,
      string,
    ][])("renders correct label for rarity %i", (rarity, expectedLabel) => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={rarity} />);

      expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    });

    it("applies the correct inline styles from getRarityStyles", () => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={3} />);

      const badge = screen.getByText("Less Common");
      expect(badge).toHaveStyle({
        backgroundColor: "rgb(3, 0, 0)",
        color: "rgb(0, 3, 0)",
        borderColor: "rgb(0, 0, 3)",
        borderWidth: "1px",
        borderStyle: "solid",
      });
    });

    it("does not render a dash for known rarities", () => {
      renderWithProviders(<ProhibitedLibraryRarityCell rarity={1} />);

      expect(screen.queryByText("—")).not.toBeInTheDocument();
    });

    it("does not show a tooltip for known rarities", () => {
      const { container } = renderWithProviders(
        <ProhibitedLibraryRarityCell rarity={2} />,
      );

      const tooltip = container.querySelector("[data-tip]");
      expect(tooltip).not.toBeInTheDocument();
    });
  });
});
