import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import AppTitle from "./AppTitle";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/components", () => ({
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("AppTitle", () => {
  it('renders "soothsayer" text', () => {
    renderWithProviders(<AppTitle />);

    expect(screen.getByText("soothsayer")).toBeInTheDocument();
  });

  it('renders version badge with "v" prefix', () => {
    renderWithProviders(<AppTitle />);

    const badge = document.querySelector(".badge");
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent).toMatch(/^v\d+\.\d+\.\d+/);
  });
});
