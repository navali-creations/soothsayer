import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CardPlaceholder } from "./CardPlaceholder";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardPlaceholder", () => {
  it("renders the card name in the name region", () => {
    renderWithProviders(<CardPlaceholder cardName="The Doctor" />);

    const nameRegion = screen.getByTestId("card-placeholder-name");
    expect(nameRegion).toHaveTextContent("The Doctor");
  });

  it("renders the placeholder art area", () => {
    renderWithProviders(<CardPlaceholder cardName="The Doctor" />);

    expect(screen.getByTestId("card-placeholder")).toBeInTheDocument();
  });

  it("renders a hint in the bottom area", () => {
    renderWithProviders(<CardPlaceholder cardName="The Doctor" />);

    expect(screen.getByTestId("card-placeholder-hint")).toBeInTheDocument();
    // The hint should have some text content — we don't pin the exact wording
    expect(
      screen.getByTestId("card-placeholder-hint").textContent!.length,
    ).toBeGreaterThan(0);
  });

  it("renders all three regions at once", () => {
    renderWithProviders(<CardPlaceholder cardName="The Fiend" />);

    expect(screen.getByTestId("card-placeholder-name")).toBeInTheDocument();
    expect(screen.getByTestId("card-placeholder")).toBeInTheDocument();
    expect(screen.getByTestId("card-placeholder-hint")).toBeInTheDocument();
  });

  it.each([
    "The Doctor",
    "House of Mirrors",
    "The Fiend",
    "Unrequited Love",
    "Rain of Chaos",
  ])("displays the correct card name for: %s", (cardName) => {
    renderWithProviders(<CardPlaceholder cardName={cardName} />);

    expect(screen.getByTestId("card-placeholder-name")).toHaveTextContent(
      cardName,
    );
  });
});
