import { afterEach, describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { CardDetailsExternalLinks } from "~/renderer/modules/card-details/CardDetails.components/CardDetailsExternalLinks/CardDetailsExternalLinks";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ cardSlug: "the-doctor" }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  createLink: () => ({}),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CardDetailsExternalLinks", () => {
  it("renders wiki and poe.ninja buttons", () => {
    renderWithProviders(
      <CardDetailsExternalLinks cardName="The Doctor" game="poe1" />,
    );

    expect(screen.getByText("poewiki.net")).toBeInTheDocument();
    expect(screen.getByText("poe.ninja")).toBeInTheDocument();
  });

  it("opens poewiki.net with encoded card name on click", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { user } = renderWithProviders(
      <CardDetailsExternalLinks cardName="The Doctor" game="poe1" />,
    );

    await user.click(screen.getByText("poewiki.net"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://www.poewiki.net/wiki/The%20Doctor",
      "_blank",
    );
  });

  it("opens poe.ninja with slugified card name and poe1 prefix", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { user } = renderWithProviders(
      <CardDetailsExternalLinks cardName="The Doctor" game="poe1" />,
    );

    await user.click(screen.getByText("poe.ninja"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://poe.ninja/poe1/economy/divination-cards/the-doctor",
      "_blank",
    );
  });

  it("uses poe2 prefix when game is poe2", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { user } = renderWithProviders(
      <CardDetailsExternalLinks cardName="The Doctor" game="poe2" />,
    );

    await user.click(screen.getByText("poe.ninja"));

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://poe.ninja/poe2/economy/divination-cards/the-doctor",
      "_blank",
    );
  });

  it("encodes special characters in wiki URL", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { user } = renderWithProviders(
      <CardDetailsExternalLinks cardName="The King's Heart" game="poe1" />,
    );

    await user.click(screen.getByText("poewiki.net"));

    expect(openSpy).toHaveBeenCalledWith(
      "https://www.poewiki.net/wiki/The%20King's%20Heart",
      "_blank",
    );
  });

  it("slugifies card name for poe.ninja URL (strips special chars)", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    const { user } = renderWithProviders(
      <CardDetailsExternalLinks cardName="The King's Heart" game="poe1" />,
    );

    await user.click(screen.getByText("poe.ninja"));

    // cardNameToSlug: lowercase, replace non-alnum with -, strip leading/trailing -
    expect(openSpy).toHaveBeenCalledWith(
      "https://poe.ninja/poe1/economy/divination-cards/the-king-s-heart",
      "_blank",
    );
  });
});
