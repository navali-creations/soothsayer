import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { GroupedStats, Stat } from "./Stat";

describe("GroupedStats", () => {
  it('renders with "stats" class', () => {
    renderWithProviders(<GroupedStats data-testid="grouped" />);
    const el = screen.getByTestId("grouped");
    expect(el).toHaveClass("stats");
  });

  it('adds "stats-vertical" when direction="vertical"', () => {
    renderWithProviders(
      <GroupedStats data-testid="grouped" direction="vertical" />,
    );
    const el = screen.getByTestId("grouped");
    expect(el).toHaveClass("stats-vertical");
  });

  it('adds "stats-horizontal" when direction="horizontal"', () => {
    renderWithProviders(
      <GroupedStats data-testid="grouped" direction="horizontal" />,
    );
    const el = screen.getByTestId("grouped");
    expect(el).toHaveClass("stats-horizontal");
  });

  it("does not add direction class when direction is not provided", () => {
    renderWithProviders(<GroupedStats data-testid="grouped" />);
    const el = screen.getByTestId("grouped");
    expect(el).not.toHaveClass("stats-vertical");
    expect(el).not.toHaveClass("stats-horizontal");
  });

  it("merges custom className", () => {
    renderWithProviders(
      <GroupedStats data-testid="grouped" className="my-custom" />,
    );
    const el = screen.getByTestId("grouped");
    expect(el).toHaveClass("stats");
    expect(el).toHaveClass("my-custom");
  });

  it("renders children", () => {
    renderWithProviders(
      <GroupedStats>
        <div data-testid="child">Hello</div>
      </GroupedStats>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("forwards spread props", () => {
    renderWithProviders(
      <GroupedStats data-testid="grouped" aria-label="stats group" />,
    );
    const el = screen.getByTestId("grouped");
    expect(el).toHaveAttribute("aria-label", "stats group");
  });
});

describe("Stat", () => {
  it('renders with "stat" class', () => {
    renderWithProviders(<Stat data-testid="stat" />);
    const el = screen.getByTestId("stat");
    expect(el).toHaveClass("stat");
  });

  it("merges custom className", () => {
    renderWithProviders(<Stat data-testid="stat" className="extra" />);
    const el = screen.getByTestId("stat");
    expect(el).toHaveClass("stat");
    expect(el).toHaveClass("extra");
  });

  it("renders children", () => {
    renderWithProviders(
      <Stat>
        <span data-testid="stat-child">Content</span>
      </Stat>,
    );
    expect(screen.getByTestId("stat-child")).toBeInTheDocument();
  });

  it("forwards spread props", () => {
    renderWithProviders(<Stat data-testid="stat" aria-label="single stat" />);
    const el = screen.getByTestId("stat");
    expect(el).toHaveAttribute("aria-label", "single stat");
  });
});

describe("Stat sub-components", () => {
  it.each([
    ["Title", Stat.Title, "stat-title"],
    ["Value", Stat.Value, "stat-value"],
    ["Desc", Stat.Desc, "stat-desc"],
    ["Figure", Stat.Figure, "stat-figure"],
    ["Actions", Stat.Actions, "stat-actions"],
  ] as const)("%s renders with %s class", (_name, Component, expectedClass) => {
    renderWithProviders(<Component data-testid="sub">Sub content</Component>);
    const el = screen.getByTestId("sub");
    expect(el).toHaveClass(expectedClass);
    expect(el).toHaveTextContent("Sub content");
  });

  it("merges custom className on sub-components", () => {
    renderWithProviders(
      <Stat.Title data-testid="title" className="custom-title">
        Title
      </Stat.Title>,
    );
    const el = screen.getByTestId("title");
    expect(el).toHaveClass("stat-title");
    expect(el).toHaveClass("custom-title");
  });

  it("forwards spread props on sub-components", () => {
    renderWithProviders(
      <Stat.Value data-testid="value" aria-label="value label">
        42
      </Stat.Value>,
    );
    const el = screen.getByTestId("value");
    expect(el).toHaveAttribute("aria-label", "value label");
  });
});

describe("Stat composition", () => {
  it("renders a complete stat composition inside GroupedStats", () => {
    renderWithProviders(
      <GroupedStats data-testid="group">
        <Stat data-testid="stat-1">
          <Stat.Figure data-testid="figure-1">📊</Stat.Figure>
          <Stat.Title data-testid="title-1">Total Cards</Stat.Title>
          <Stat.Value data-testid="value-1">1,234</Stat.Value>
          <Stat.Desc data-testid="desc-1">21% more than last month</Stat.Desc>
          <Stat.Actions data-testid="actions-1">
            <button type="button">View</button>
          </Stat.Actions>
        </Stat>
      </GroupedStats>,
    );

    // GroupedStats wrapper
    expect(screen.getByTestId("group")).toHaveClass("stats");

    // Stat container
    expect(screen.getByTestId("stat-1")).toHaveClass("stat");

    // Sub-components with correct classes and content
    expect(screen.getByTestId("figure-1")).toHaveClass("stat-figure");
    expect(screen.getByTestId("figure-1")).toHaveTextContent("📊");

    expect(screen.getByTestId("title-1")).toHaveClass("stat-title");
    expect(screen.getByTestId("title-1")).toHaveTextContent("Total Cards");

    expect(screen.getByTestId("value-1")).toHaveClass("stat-value");
    expect(screen.getByTestId("value-1")).toHaveTextContent("1,234");

    expect(screen.getByTestId("desc-1")).toHaveClass("stat-desc");
    expect(screen.getByTestId("desc-1")).toHaveTextContent(
      "21% more than last month",
    );

    expect(screen.getByTestId("actions-1")).toHaveClass("stat-actions");
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });
});
