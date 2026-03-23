import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import Accordion from "./Accordion";

describe("Accordion", () => {
  it("renders title text", () => {
    renderWithProviders(
      <Accordion title="My Title">
        <p>Content</p>
      </Accordion>,
    );

    expect(screen.getByText("My Title")).toBeInTheDocument();
  });

  it("renders children content", () => {
    renderWithProviders(
      <Accordion title="Title">
        <p>Child content here</p>
      </Accordion>,
    );

    expect(screen.getByText("Child content here")).toBeInTheDocument();
  });

  it("has collapse classes on outer div", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title">
        <p>Content</p>
      </Accordion>,
    );

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.classList.contains("collapse")).toBe(true);
    expect(outerDiv.classList.contains("collapse-arrow")).toBe(true);
    expect(outerDiv.classList.contains("rounded-lg")).toBe(true);
  });

  it("checkbox defaultChecked is false when defaultOpen is not set", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title">
        <p>Content</p>
      </Accordion>,
    );

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.defaultChecked).toBe(false);
  });

  it("checkbox defaultChecked is true when defaultOpen is true", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title" defaultOpen>
        <p>Content</p>
      </Accordion>,
    );

    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox.defaultChecked).toBe(true);
  });

  it("renders icon when provided", () => {
    renderWithProviders(
      <Accordion title="Title" icon={<span data-testid="icon">★</span>}>
        <p>Content</p>
      </Accordion>,
    );

    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("does not render icon span when icon is not provided", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title">
        <p>Content</p>
      </Accordion>,
    );

    // The icon is wrapped in a span with class "text-base-content/60"
    const iconSpan = container.querySelector(".text-base-content\\/60");
    expect(iconSpan).not.toBeInTheDocument();
  });

  it("renders headerRight when provided", () => {
    renderWithProviders(
      <Accordion
        title="Title"
        headerRight={<span data-testid="header-right">Extra</span>}
      >
        <p>Content</p>
      </Accordion>,
    );

    expect(screen.getByTestId("header-right")).toBeInTheDocument();
    expect(screen.getByText("Extra")).toBeInTheDocument();
  });

  it("does not render headerRight when not provided", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title">
        <p>Content</p>
      </Accordion>,
    );

    // headerRight is wrapped in a span with class "text-base-content/50"
    // inside the collapse-title. The collapse-content also has text-sm but
    // we specifically look for the shrink-0 wrapper span used for headerRight.
    const headerRightWrapper = container.querySelector(
      ".collapse-title .shrink-0.text-xs",
    );
    expect(headerRightWrapper).not.toBeInTheDocument();
  });

  it("applies custom className to outer div", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title" className="my-custom-class">
        <p>Content</p>
      </Accordion>,
    );

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.classList.contains("my-custom-class")).toBe(true);
    // Should still have the base collapse class
    expect(outerDiv.classList.contains("collapse")).toBe(true);
  });

  it("applies custom contentClassName to content area", () => {
    const { container } = renderWithProviders(
      <Accordion title="Title" contentClassName="my-content-class">
        <p>Content</p>
      </Accordion>,
    );

    const contentDiv = container.querySelector(".collapse-content");
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv!.classList.contains("my-content-class")).toBe(true);
  });
});
