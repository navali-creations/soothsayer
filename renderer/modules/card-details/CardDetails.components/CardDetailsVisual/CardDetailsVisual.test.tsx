import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

vi.mock("~/renderer/components/DivinationCard/DivinationCard", () => ({
  default: ({ card }: any) => (
    <div data-testid="divination-card">{card.name}</div>
  ),
}));

import CardDetailsVisual from "./CardDetailsVisual";

describe("CardDetailsVisual", () => {
  const mockCard = {
    name: "The Doctor",
    artFilename: "TheDoctor",
    stackSize: 8,
    flavourText: "A doctor a day keeps the mirror away.",
  } as any;

  it("renders DivinationCard with correct card prop", () => {
    renderWithProviders(<CardDetailsVisual card={mockCard} />);
    expect(screen.getByTestId("divination-card")).toHaveTextContent(
      "The Doctor",
    );
  });

  it("wraps in a centered container", () => {
    const { container } = renderWithProviders(
      <CardDetailsVisual card={mockCard} />,
    );
    expect(container.firstElementChild).toHaveClass("flex", "justify-center");
  });
});
