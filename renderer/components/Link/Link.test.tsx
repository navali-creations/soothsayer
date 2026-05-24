import { vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

// ─── Router mock ───────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", async () => {
  const { createRouterMock } = await import(
    "~/renderer/__test-setup__/router-mock"
  );
  return createRouterMock({ includeCreateLink: true });
});

// ─── Import component after mocks ─────────────────────────────────────────

import { Link } from "./Link";

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Link", () => {
  it("renders an anchor element with children", () => {
    renderWithProviders(<Link to="/">Home</Link>);

    const anchor = screen.getByText("Home");
    expect(anchor.tagName).toBe("A");
  });

  it("without asButton, applies only className directly (no btn classes)", () => {
    renderWithProviders(
      <Link to="/" className="my-link">
        Plain
      </Link>,
    );

    const anchor = screen.getByText("Plain");
    expect(anchor).toHaveClass("my-link");
    expect(anchor).not.toHaveClass("btn");
    expect(anchor).not.toHaveClass("no-drag");
  });

  it("with asButton=true, applies 'no-drag btn' classes", () => {
    renderWithProviders(
      <Link to="/" asButton>
        Button Link
      </Link>,
    );

    const anchor = screen.getByText("Button Link");
    expect(anchor).toHaveClass("no-drag");
    expect(anchor).toHaveClass("btn");
  });

  it("with asButton and variant='primary', applies 'btn-primary'", () => {
    renderWithProviders(
      <Link to="/" asButton variant="primary">
        Primary
      </Link>,
    );

    const anchor = screen.getByText("Primary");
    expect(anchor).toHaveClass("btn-primary");
  });

  it("with asButton and size='sm', applies 'btn-sm'", () => {
    renderWithProviders(
      <Link to="/" asButton size="sm">
        Small
      </Link>,
    );

    const anchor = screen.getByText("Small");
    expect(anchor).toHaveClass("btn-sm");
  });

  it("with asButton and outline=true, applies 'btn-outline'", () => {
    renderWithProviders(
      <Link to="/" asButton outline>
        Outline
      </Link>,
    );

    const anchor = screen.getByText("Outline");
    expect(anchor).toHaveClass("btn-outline");
  });

  it("with asButton and wide=true, applies 'btn-wide'", () => {
    renderWithProviders(
      <Link to="/" asButton wide>
        Wide
      </Link>,
    );

    const anchor = screen.getByText("Wide");
    expect(anchor).toHaveClass("btn-wide");
  });

  it("with asButton and block=true, applies 'btn-block'", () => {
    renderWithProviders(
      <Link to="/" asButton block>
        Block
      </Link>,
    );

    const anchor = screen.getByText("Block");
    expect(anchor).toHaveClass("btn-block");
  });

  it("with asButton and circle=true, applies 'btn-circle'", () => {
    renderWithProviders(
      <Link to="/" asButton circle>
        Circle
      </Link>,
    );

    const anchor = screen.getByText("Circle");
    expect(anchor).toHaveClass("btn-circle");
  });

  it("with asButton and square=true, applies 'btn-square'", () => {
    renderWithProviders(
      <Link to="/" asButton square>
        Square
      </Link>,
    );

    const anchor = screen.getByText("Square");
    expect(anchor).toHaveClass("btn-square");
  });

  it("with asButton and glass=true, applies 'glass' class", () => {
    renderWithProviders(
      <Link to="/" asButton glass>
        Glass
      </Link>,
    );

    const anchor = screen.getByText("Glass");
    expect(anchor).toHaveClass("glass");
  });

  it("with asButton and active=true, applies 'btn-active'", () => {
    renderWithProviders(
      <Link to="/" asButton active>
        Active
      </Link>,
    );

    const anchor = screen.getByText("Active");
    expect(anchor).toHaveClass("btn-active");
  });

  it("merges custom className with button classes", () => {
    renderWithProviders(
      <Link to="/" asButton variant="secondary" className="extra-class">
        Merged
      </Link>,
    );

    const anchor = screen.getByText("Merged");
    expect(anchor).toHaveClass("btn");
    expect(anchor).toHaveClass("no-drag");
    expect(anchor).toHaveClass("btn-secondary");
    expect(anchor).toHaveClass("extra-class");
  });

  it("passes href and other HTML attributes through", () => {
    renderWithProviders(
      <Link to="/" aria-label="Go home" title="Homepage">
        Home
      </Link>,
    );

    const anchor = screen.getByText("Home");
    expect(anchor).toHaveAttribute("aria-label", "Go home");
    expect(anchor).toHaveAttribute("title", "Homepage");
  });
});
