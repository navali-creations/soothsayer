import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CARD_EFFECTS } from "../constants";
import type { CardEffectProps } from "../types";

// ─── Mocks for RarityEffects routing tests ─────────────────────────────────
// vi.mock is hoisted, so we must use vi.importActual for direct-render tests.

vi.mock("../effects/CommonEffect", () => ({
  CommonEffect: (props: any) => (
    <div
      data-testid="common-effect"
      data-hovered={String(props.isHovered)}
      data-mouse-x={String(props.mousePos?.x)}
      data-mouse-y={String(props.mousePos?.y)}
    />
  ),
}));

vi.mock("../effects/RareEffect", () => ({
  RareEffect: (props: any) => (
    <div
      data-testid="rare-effect"
      data-hovered={String(props.isHovered)}
      data-pos-x={String(props.posX)}
      data-pos-y={String(props.posY)}
    />
  ),
}));

vi.mock("../effects/ExtremelyRareEffect", () => ({
  ExtremelyRareEffect: (props: any) => (
    <div
      data-testid="extremely-rare-effect"
      data-hovered={String(props.isHovered)}
      data-pos-x={String(props.posX)}
      data-pos-y={String(props.posY)}
    />
  ),
}));

// Import the real (unmocked) effect components for direct-render tests.
const { CommonEffect: RealCommonEffect } = await vi.importActual<
  typeof import("../effects/CommonEffect")
>("../effects/CommonEffect");

const { RareEffect: RealRareEffect } = await vi.importActual<
  typeof import("../effects/RareEffect")
>("../effects/RareEffect");

const { ExtremelyRareEffect: RealExtremelyRareEffect } = await vi.importActual<
  typeof import("../effects/ExtremelyRareEffect")
>("../effects/ExtremelyRareEffect");

// RarityEffects will see the mocked children thanks to vi.mock hoisting.
import { RarityEffects } from "../effects/RarityEffects";

// ─── Default props ─────────────────────────────────────────────────────────

const defaultProps: CardEffectProps = {
  mousePos: { x: 50, y: 50 },
  isHovered: false,
  posX: 50,
  posY: 50,
};

// ═══════════════════════════════════════════════════════════════════════════
// CommonEffect (direct render, real component)
// ═══════════════════════════════════════════════════════════════════════════

describe("CommonEffect", () => {
  it("renders a single overlay div", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect {...defaultProps} />,
    );
    // container is a wrapper div; CommonEffect renders exactly one child div
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild!.tagName).toBe("DIV");
  });

  it("has opacity 0 when not hovered", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect {...defaultProps} isHovered={false} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe("0");
  });

  it("has opacity 1 when hovered", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect {...defaultProps} isHovered={true} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.opacity).toBe("1");
  });

  it("includes mousePos coordinates in the radial-gradient background", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect
        {...defaultProps}
        mousePos={{ x: 30, y: 70 }}
        isHovered={true}
      />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).toContain("30%");
    expect(el.style.background).toContain("70%");
  });

  it("updates gradient when mousePos changes", () => {
    const { container, rerender } = renderWithProviders(
      <RealCommonEffect {...defaultProps} mousePos={{ x: 10, y: 20 }} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.background).toContain("10%");
    expect(el.style.background).toContain("20%");

    rerender(
      <RealCommonEffect {...defaultProps} mousePos={{ x: 80, y: 90 }} />,
    );
    expect(el.style.background).toContain("80%");
    expect(el.style.background).toContain("90%");
  });

  it("has overlay mixBlendMode", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect {...defaultProps} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.mixBlendMode).toBe("overlay");
  });

  it("has pointer-events-none class", () => {
    const { container } = renderWithProviders(
      <RealCommonEffect {...defaultProps} />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("pointer-events-none");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ExtremelyRareEffect (direct render, real component)
// ═══════════════════════════════════════════════════════════════════════════

describe("ExtremelyRareEffect", () => {
  function getOverlayDivs(container: HTMLElement): HTMLElement[] {
    // ExtremelyRareEffect renders a fragment with 7 direct children
    return Array.from(container.children) as HTMLElement[];
  }

  it("renders all 7 overlay layers", () => {
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect {...defaultProps} />,
    );
    expect(getOverlayDivs(container)).toHaveLength(7);
  });

  it("all layers have opacity 0 when not hovered", () => {
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect {...defaultProps} isHovered={false} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(layer.style.opacity).toBe("0");
    }
  });

  it("all layers have non-zero opacities when hovered", () => {
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect {...defaultProps} isHovered={true} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(Number(layer.style.opacity)).toBeGreaterThan(0);
    }
  });

  it("has correct per-layer opacity values when hovered", () => {
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect {...defaultProps} isHovered={true} />,
    );
    const layers = getOverlayDivs(container);
    const expectedOpacities = [0.1, 0.1, 0.3, 1, 0.3, 1, 1];
    for (let i = 0; i < layers.length; i++) {
      expect(Number(layers[i].style.opacity)).toBe(expectedOpacities[i]);
    }
  });

  it("background positions reflect posX/posY values", () => {
    const posX = 30;
    const posY = 70;
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect
        {...defaultProps}
        posX={posX}
        posY={posY}
        isHovered={true}
      />,
    );
    const layers = getOverlayDivs(container);

    // Layer 0 (smooth color gradient): (posX - 50) * -0.8 + 50
    const bgPosX0 = `${(posX - 50) * -0.8 + 50}%`;
    const bgPosY0 = `${(posY - 50) * -0.8 + 50}%`;
    expect(layers[0].style.backgroundPosition).toContain(bgPosX0);
    expect(layers[0].style.backgroundPosition).toContain(bgPosY0);

    // Layer 1 (diagonal shimmer): (posX - 50) * 0.6 + 50
    const bgPosX1 = `${(posX - 50) * 0.6 + 50}%`;
    const bgPosY1 = `${(posY - 50) * 0.6 + 50}%`;
    expect(layers[1].style.backgroundPosition).toContain(bgPosX1);
    expect(layers[1].style.backgroundPosition).toContain(bgPosY1);

    // Layer 2 (mirrored shimmer): (50 - posX) * 0.6 + 50
    const bgPosX2 = `${(50 - posX) * 0.6 + 50}%`;
    const bgPosY2 = `${(50 - posY) * 0.6 + 50}%`;
    expect(layers[2].style.backgroundPosition).toContain(bgPosX2);
    expect(layers[2].style.backgroundPosition).toContain(bgPosY2);

    // Layer 3 (dark vignette): posX% posY%
    expect(layers[3].style.backgroundPosition).toContain(`${posX}%`);
    expect(layers[3].style.backgroundPosition).toContain(`${posY}%`);
  });

  it("uses posY for gradient angle in the first layer", () => {
    const posY = 60;
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect
        {...defaultProps}
        posY={posY}
        isHovered={true}
      />,
    );
    const layers = getOverlayDivs(container);
    expect(layers[0].style.backgroundImage).toContain(`${posY * 0.8}deg`);
  });

  it("last layer (radial glow) uses mousePos for gradient center", () => {
    const mousePos = { x: 25, y: 75 };
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect
        {...defaultProps}
        mousePos={mousePos}
        isHovered={true}
      />,
    );
    const layers = getOverlayDivs(container);
    const lastLayer = layers[layers.length - 1];
    expect(lastLayer.style.background).toContain(`${mousePos.x}%`);
    expect(lastLayer.style.background).toContain(`${mousePos.y}%`);
  });

  it("all layers have pointer-events-none class", () => {
    const { container } = renderWithProviders(
      <RealExtremelyRareEffect {...defaultProps} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(layer.className).toContain("pointer-events-none");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RareEffect (direct render, real component)
// ═══════════════════════════════════════════════════════════════════════════

describe("RareEffect", () => {
  function getOverlayDivs(container: HTMLElement): HTMLElement[] {
    return Array.from(container.children) as HTMLElement[];
  }

  it("renders 4 overlay layers", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} />,
    );
    expect(getOverlayDivs(container)).toHaveLength(4);
  });

  it("all layers have opacity 0 when not hovered", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} isHovered={false} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(layer.style.opacity).toBe("0");
    }
  });

  it("all layers have non-zero opacities when hovered", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} isHovered={true} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(Number(layer.style.opacity)).toBeGreaterThan(0);
    }
  });

  it("has correct per-layer opacity values when hovered", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} isHovered={true} />,
    );
    const layers = getOverlayDivs(container);
    const expectedOpacities = [0.15, 0.05, 0.05, 1.0];
    for (let i = 0; i < layers.length; i++) {
      expect(Number(layers[i].style.opacity)).toBe(expectedOpacities[i]);
    }
  });

  it("uses CARD_EFFECTS.SPACE constant in rainbow gradient stop positions", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} isHovered={true} />,
    );
    const rainbowLayer = getOverlayDivs(container)[0];
    const space = CARD_EFFECTS.SPACE;
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 1}px`);
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 2}px`);
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 3}px`);
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 5}px`);
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 6}px`);
    expect(rainbowLayer.style.backgroundImage).toContain(`${space * 7}px`);
  });

  it("uses CARD_EFFECTS.BAR_WIDTH constant in criss-cross gradient layers", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} isHovered={true} />,
    );
    const layers = getOverlayDivs(container);
    const bw = CARD_EFFECTS.BAR_WIDTH;

    // Layer 1 (45deg criss-cross)
    expect(layers[1].style.backgroundImage).toContain(`${bw * 4}%`);
    expect(layers[1].style.backgroundImage).toContain(`${bw * 5}%`);
    expect(layers[1].style.backgroundImage).toContain(`${bw * 6}%`);
    expect(layers[1].style.backgroundImage).toContain(`${bw * 10}%`);

    // Layer 2 (-45deg criss-cross)
    expect(layers[2].style.backgroundImage).toContain(`${bw * 4}%`);
    expect(layers[2].style.backgroundImage).toContain(`${bw * 5}%`);
    expect(layers[2].style.backgroundImage).toContain(`${bw * 6}%`);
    expect(layers[2].style.backgroundImage).toContain(`${bw * 10}%`);
  });

  it("background positions reflect posX/posY values", () => {
    const posX = 20;
    const posY = 80;
    const { container } = renderWithProviders(
      <RealRareEffect
        {...defaultProps}
        posX={posX}
        posY={posY}
        isHovered={true}
      />,
    );
    const layers = getOverlayDivs(container);

    // Layer 0 (rainbow): (posX - 50) * -0.5 + 50
    const bgPosX0 = `${(posX - 50) * -0.5 + 50}%`;
    const bgPosY0 = `${(posY - 50) * -0.5 + 50}%`;
    expect(layers[0].style.backgroundPosition).toContain(bgPosX0);
    expect(layers[0].style.backgroundPosition).toContain(bgPosY0);

    // Layers 1 & 2 (criss-cross): (posX - 50) * 0.3 + 50
    const bgPosX1 = `${(posX - 50) * 0.3 + 50}%`;
    const bgPosY1 = `${(posY - 50) * 0.3 + 50}%`;
    expect(layers[1].style.backgroundPosition).toContain(bgPosX1);
    expect(layers[1].style.backgroundPosition).toContain(bgPosY1);
    expect(layers[2].style.backgroundPosition).toContain(bgPosX1);
    expect(layers[2].style.backgroundPosition).toContain(bgPosY1);
  });

  it("last layer (radial glow) uses mousePos for gradient center", () => {
    const mousePos = { x: 10, y: 90 };
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} mousePos={mousePos} isHovered={true} />,
    );
    const layers = getOverlayDivs(container);
    const lastLayer = layers[layers.length - 1];
    expect(lastLayer.style.background).toContain(`${mousePos.x}%`);
    expect(lastLayer.style.background).toContain(`${mousePos.y}%`);
  });

  it("all layers have pointer-events-none class", () => {
    const { container } = renderWithProviders(
      <RealRareEffect {...defaultProps} />,
    );
    for (const layer of getOverlayDivs(container)) {
      expect(layer.className).toContain("pointer-events-none");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// RarityEffects (routing — uses mocked child components)
// ═══════════════════════════════════════════════════════════════════════════

describe("RarityEffects", () => {
  it("renders ExtremelyRareEffect for rarity 1", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={1} />);
    expect(screen.getByTestId("extremely-rare-effect")).toBeInTheDocument();
    expect(screen.queryByTestId("rare-effect")).not.toBeInTheDocument();
    expect(screen.queryByTestId("common-effect")).not.toBeInTheDocument();
  });

  it("renders RareEffect for rarity 2", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={2} />);
    expect(screen.getByTestId("rare-effect")).toBeInTheDocument();
    expect(
      screen.queryByTestId("extremely-rare-effect"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("common-effect")).not.toBeInTheDocument();
  });

  it("renders CommonEffect for rarity 3 (less common)", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={3} />);
    expect(screen.getByTestId("common-effect")).toBeInTheDocument();
    expect(
      screen.queryByTestId("extremely-rare-effect"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rare-effect")).not.toBeInTheDocument();
  });

  it("renders CommonEffect for rarity 4 (common)", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={4} />);
    expect(screen.getByTestId("common-effect")).toBeInTheDocument();
    expect(
      screen.queryByTestId("extremely-rare-effect"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rare-effect")).not.toBeInTheDocument();
  });

  it("renders CommonEffect for rarity 0 (unknown)", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={0} />);
    expect(screen.getByTestId("common-effect")).toBeInTheDocument();
    expect(
      screen.queryByTestId("extremely-rare-effect"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("rare-effect")).not.toBeInTheDocument();
  });

  it("forwards effectProps to ExtremelyRareEffect", () => {
    const props: CardEffectProps = {
      mousePos: { x: 33, y: 66 },
      isHovered: true,
      posX: 40,
      posY: 60,
    };
    renderWithProviders(<RarityEffects {...props} rarity={1} />);

    const el = screen.getByTestId("extremely-rare-effect");
    expect(el).toHaveAttribute("data-hovered", "true");
    expect(el).toHaveAttribute("data-pos-x", "40");
    expect(el).toHaveAttribute("data-pos-y", "60");
  });

  it("forwards effectProps to RareEffect", () => {
    const props: CardEffectProps = {
      mousePos: { x: 10, y: 90 },
      isHovered: true,
      posX: 15,
      posY: 85,
    };
    renderWithProviders(<RarityEffects {...props} rarity={2} />);

    const el = screen.getByTestId("rare-effect");
    expect(el).toHaveAttribute("data-hovered", "true");
    expect(el).toHaveAttribute("data-pos-x", "15");
    expect(el).toHaveAttribute("data-pos-y", "85");
  });

  it("forwards effectProps to CommonEffect", () => {
    const props: CardEffectProps = {
      mousePos: { x: 55, y: 45 },
      isHovered: false,
      posX: 50,
      posY: 50,
    };
    renderWithProviders(<RarityEffects {...props} rarity={4} />);

    const el = screen.getByTestId("common-effect");
    expect(el).toHaveAttribute("data-hovered", "false");
    expect(el).toHaveAttribute("data-mouse-x", "55");
    expect(el).toHaveAttribute("data-mouse-y", "45");
  });

  it("does not pass rarity prop through to child effects", () => {
    renderWithProviders(<RarityEffects {...defaultProps} rarity={1} />);

    const el = screen.getByTestId("extremely-rare-effect");
    // rarity is destructured out by RarityEffects; child should not receive it
    expect(el).not.toHaveAttribute("data-rarity");
  });
});
