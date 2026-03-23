import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Grid from "../Grid";
import GridCol from "../GridCol";

describe("Grid", () => {
  it("renders as a ul element with default grid gap-4 classes", () => {
    render(<Grid data-testid="grid" />);
    const el = screen.getByRole("list");
    expect(el.tagName).toBe("UL");
    expect(el).toHaveClass("grid", "gap-4");
  });

  it("merges a custom className with the defaults", () => {
    render(<Grid className="grid-cols-3 my-custom" />);
    const el = screen.getByRole("list");
    expect(el).toHaveClass("grid", "gap-4", "grid-cols-3", "my-custom");
  });

  it("renders children inside the list", () => {
    render(
      <Grid>
        <li>Child A</li>
        <li>Child B</li>
      </Grid>,
    );
    expect(screen.getByText("Child A")).toBeInTheDocument();
    expect(screen.getByText("Child B")).toBeInTheDocument();
  });

  it("exposes GridCol as Grid.Col", () => {
    expect(Grid.Col).toBe(GridCol);
  });
});

describe("GridCol", () => {
  it("renders as a li element", () => {
    render(<GridCol>item</GridCol>);
    const el = screen.getByRole("listitem");
    expect(el.tagName).toBe("LI");
  });

  it("renders children and merges a custom className", () => {
    render(<GridCol className="col-span-2 extra">Content</GridCol>);
    const el = screen.getByText("Content");
    expect(el.tagName).toBe("LI");
    expect(el).toHaveClass("col-span-2", "extra");
  });
});
