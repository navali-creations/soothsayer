import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CardFrame } from "../components/CardFrame";
import { CardArt } from "../components/card-content/CardArt";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/assets/poe1/Divination_card_frame.png", () => ({
  default: "mocked-card-frame.png",
}));

// ─── CardFrame Tests ───────────────────────────────────────────────────────

describe("CardFrame", () => {
  it("renders an img element", () => {
    renderWithProviders(<CardFrame />);

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
  });

  it('has alt text "Card Frame"', () => {
    renderWithProviders(<CardFrame />);

    expect(screen.getByAltText("Card Frame")).toBeInTheDocument();
  });

  it("has the mocked src attribute", () => {
    renderWithProviders(<CardFrame />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "mocked-card-frame.png");
  });

  it("has the expected CSS classes", () => {
    renderWithProviders(<CardFrame />);

    const img = screen.getByRole("img");
    expect(img).toHaveClass("absolute");
    expect(img).toHaveClass("z-20");
    expect(img).toHaveClass("pointer-events-none");
    expect(img).toHaveClass("inset-0");
    expect(img).toHaveClass("w-[320px]");
    expect(img).toHaveClass("h-full");
  });
});

// ─── CardArt Tests ─────────────────────────────────────────────────────────

describe("CardArt", () => {
  it("renders an img element with the given cardName as alt text", () => {
    renderWithProviders(
      <CardArt artSrc="some-art.png" cardName="The Doctor" />,
    );

    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("alt", "The Doctor");
  });

  it("falls back to empty string src when artSrc does not match any loaded image", () => {
    renderWithProviders(
      <CardArt artSrc="nonexistent-image.png" cardName="Unknown Card" />,
    );

    const img = screen.getByRole("img");
    // When getCardImage returns "", React omits the src attribute entirely
    expect(img).not.toHaveAttribute("src");
  });

  it("renders the container div with correct structure and classes", () => {
    const { container } = renderWithProviders(
      <CardArt artSrc="test.png" cardName="Test Card" />,
    );

    const wrapper = container.querySelector("div.absolute.z-10");
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("absolute");
    expect(wrapper).toHaveClass("z-10");
    expect(wrapper).toHaveClass("top-[39px]");
    expect(wrapper).toHaveClass("left-[22px]");
    expect(wrapper).toHaveClass("h-[204px]");
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("items-center");
    expect(wrapper).toHaveClass("justify-center");
    expect(wrapper).toHaveClass("overflow-hidden");
  });

  it.each([
    "House of Mirrors",
    "The Fiend",
    "The Nurse",
    "Unrequited Love",
  ])("renders correct alt text for cardName: %s", (cardName) => {
    renderWithProviders(<CardArt artSrc="art.png" cardName={cardName} />);

    expect(screen.getByAltText(cardName)).toBeInTheDocument();
  });

  it("applies expected CSS classes to the img element", () => {
    renderWithProviders(<CardArt artSrc="art.png" cardName="Test" />);

    const img = screen.getByRole("img");
    expect(img).toHaveClass("max-w-full");
    expect(img).toHaveClass("max-h-full");
    expect(img).toHaveClass("object-contain");
  });
});
