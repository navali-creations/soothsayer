import { describe, expect, it } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import Flex from "./Flex";

describe("Flex", () => {
  it("renders with just 'flex' class when no className is provided", () => {
    renderWithProviders(<Flex>content</Flex>);

    const div = screen.getByText("content");
    expect(div.className).toBe("flex");
  });

  it("renders with 'flex' and custom className when className is provided", () => {
    renderWithProviders(<Flex className="gap-4 items-center">content</Flex>);

    const div = screen.getByText("content");
    expect(div.className).toBe("flex gap-4 items-center");
  });

  it("renders with just 'flex' class when className is empty string", () => {
    renderWithProviders(<Flex className="">content</Flex>);

    const div = screen.getByText("content");
    expect(div.className).toBe("flex");
  });

  it("renders children", () => {
    renderWithProviders(
      <Flex>
        <span>child</span>
      </Flex>,
    );

    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
