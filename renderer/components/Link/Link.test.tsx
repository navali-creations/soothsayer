import { render, screen } from "@testing-library/react";
import React from "react";
import { vi } from "vitest";

// ─── Router mock ───────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => ({
  createLink: (Component: any) =>
    React.forwardRef((props: any, ref: any) => (
      <Component ref={ref} {...props} />
    )),
}));

// ─── Import component after mocks ─────────────────────────────────────────

import { Link } from "./Link";

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Link", () => {
  it("renders an anchor element with children", () => {
    render(<Link to="/">Home</Link>);

    const anchor = screen.getByText("Home");
    expect(anchor.closest("a")).toBeInTheDocument();
  });

  it("without asButton, applies only className directly (no btn classes)", () => {
    render(
      <Link to="/" className="my-link">
        Plain
      </Link>,
    );

    const anchor = screen.getByText("Plain").closest("a")!;
    expect(anchor).toHaveClass("my-link");
    expect(anchor).not.toHaveClass("btn");
    expect(anchor).not.toHaveClass("no-drag");
  });

  it("with asButton=true, applies 'no-drag btn' classes", () => {
    render(
      <Link to="/" asButton>
        Button Link
      </Link>,
    );

    const anchor = screen.getByText("Button Link").closest("a")!;
    expect(anchor).toHaveClass("no-drag");
    expect(anchor).toHaveClass("btn");
  });

  it("with asButton and variant='primary', applies 'btn-primary'", () => {
    render(
      <Link to="/" asButton variant="primary">
        Primary
      </Link>,
    );

    const anchor = screen.getByText("Primary").closest("a")!;
    expect(anchor).toHaveClass("btn-primary");
  });

  it("with asButton and size='sm', applies 'btn-sm'", () => {
    render(
      <Link to="/" asButton size="sm">
        Small
      </Link>,
    );

    const anchor = screen.getByText("Small").closest("a")!;
    expect(anchor).toHaveClass("btn-sm");
  });

  it("with asButton and outline=true, applies 'btn-outline'", () => {
    render(
      <Link to="/" asButton outline>
        Outline
      </Link>,
    );

    const anchor = screen.getByText("Outline").closest("a")!;
    expect(anchor).toHaveClass("btn-outline");
  });

  it("with asButton and wide=true, applies 'btn-wide'", () => {
    render(
      <Link to="/" asButton wide>
        Wide
      </Link>,
    );

    const anchor = screen.getByText("Wide").closest("a")!;
    expect(anchor).toHaveClass("btn-wide");
  });

  it("with asButton and block=true, applies 'btn-block'", () => {
    render(
      <Link to="/" asButton block>
        Block
      </Link>,
    );

    const anchor = screen.getByText("Block").closest("a")!;
    expect(anchor).toHaveClass("btn-block");
  });

  it("with asButton and circle=true, applies 'btn-circle'", () => {
    render(
      <Link to="/" asButton circle>
        Circle
      </Link>,
    );

    const anchor = screen.getByText("Circle").closest("a")!;
    expect(anchor).toHaveClass("btn-circle");
  });

  it("with asButton and square=true, applies 'btn-square'", () => {
    render(
      <Link to="/" asButton square>
        Square
      </Link>,
    );

    const anchor = screen.getByText("Square").closest("a")!;
    expect(anchor).toHaveClass("btn-square");
  });

  it("with asButton and glass=true, applies 'glass' class", () => {
    render(
      <Link to="/" asButton glass>
        Glass
      </Link>,
    );

    const anchor = screen.getByText("Glass").closest("a")!;
    expect(anchor).toHaveClass("glass");
  });

  it("with asButton and active=true, applies 'btn-active'", () => {
    render(
      <Link to="/" asButton active>
        Active
      </Link>,
    );

    const anchor = screen.getByText("Active").closest("a")!;
    expect(anchor).toHaveClass("btn-active");
  });

  it("merges custom className with button classes", () => {
    render(
      <Link to="/" asButton variant="secondary" className="extra-class">
        Merged
      </Link>,
    );

    const anchor = screen.getByText("Merged").closest("a")!;
    expect(anchor).toHaveClass("btn");
    expect(anchor).toHaveClass("no-drag");
    expect(anchor).toHaveClass("btn-secondary");
    expect(anchor).toHaveClass("extra-class");
  });

  it("passes href and other HTML attributes through", () => {
    render(
      <Link to="/" aria-label="Go home" title="Homepage">
        Home
      </Link>,
    );

    const anchor = screen.getByText("Home").closest("a")!;
    expect(anchor).toHaveAttribute("aria-label", "Go home");
    expect(anchor).toHaveAttribute("title", "Homepage");
  });
});
