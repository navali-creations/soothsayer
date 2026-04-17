import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Flex from "./Flex";

describe("Flex", () => {
  it("renders with just 'flex' class when no className is provided", () => {
    const { container } = render(<Flex>content</Flex>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe("flex");
  });

  it("renders with 'flex' and custom className when className is provided", () => {
    const { container } = render(
      <Flex className="gap-4 items-center">content</Flex>,
    );
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe("flex gap-4 items-center");
  });

  it("renders with just 'flex' class when className is empty string", () => {
    const { container } = render(<Flex className="">content</Flex>);
    const div = container.firstElementChild as HTMLElement;
    expect(div.className).toBe("flex");
  });

  it("renders children", () => {
    const { container } = render(
      <Flex>
        <span>child</span>
      </Flex>,
    );
    expect(container.querySelector("span")?.textContent).toBe("child");
  });
});
