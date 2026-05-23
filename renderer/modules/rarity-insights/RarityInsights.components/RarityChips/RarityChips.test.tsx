import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import type { Rarity } from "~/types/data-stores";

import RarityChips from "./RarityChips";

vi.mock("~/renderer/utils", () => ({
  getRarityStyles: (
    rarity: Rarity,
    _gradientDir?: unknown,
    filterTheme?: any,
  ) => ({
    badgeBg: filterTheme?.[rarity]?.bgColor
      ? `rgb(${filterTheme[rarity].bgColor.r}, 0, 0)`
      : `rgb(${rarity}, 0, 0)`,
    badgeText: `rgb(0, ${rarity}, 0)`,
    badgeBorder: `rgb(0, 0, ${rarity})`,
  }),
}));

describe("RarityChips", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders known rarity chips only", () => {
    renderWithProviders(<RarityChips activeRarity={null} />);

    expect(screen.getByRole("button", { name: "R1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "R2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "R3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "R4" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "R0" }),
    ).not.toBeInTheDocument();
  });

  it("marks the active rarity at full opacity", () => {
    renderWithProviders(<RarityChips activeRarity={2} />);

    expect(screen.getByRole("button", { name: "R2" })).toHaveStyle({
      opacity: "1",
    });
    expect(screen.getByRole("button", { name: "R1" })).toHaveStyle({
      opacity: "0.5",
    });
  });

  it("passes clicked rarity and stops header click propagation", async () => {
    const onRarityClick = vi.fn();
    const parentClick = vi.fn();
    const { user } = renderWithProviders(
      <div onClick={parentClick}>
        <RarityChips activeRarity={null} onRarityClick={onRarityClick} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "R3" }));

    expect(onRarityClick).toHaveBeenCalledWith(expect.any(Object), 3);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("disables all chips when disabled", () => {
    renderWithProviders(<RarityChips activeRarity={null} disabled />);

    for (const chip of screen.getAllByRole("button")) {
      expect(chip).toBeDisabled();
      expect(chip).not.toHaveAttribute("title");
    }
  });

  it("uses filter theme styles when provided", () => {
    renderWithProviders(
      <RarityChips
        activeRarity={null}
        filterTheme={{
          2: {
            bgColor: { r: 42, g: 0, b: 0, a: 255 },
            textColor: null,
            borderColor: null,
          },
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "R2" })).toHaveStyle({
      backgroundColor: "rgb(42, 0, 0)",
    });
  });
});
