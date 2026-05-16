import type { ReactNode } from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CaptureMissingState } from "./CaptureMissingState";

vi.mock("~/renderer/components", async () => {
  const actual = await vi.importActual<typeof import("~/renderer/components")>(
    "~/renderer/components",
  );
  return {
    ...actual,
    Link: ({ children, to }: { children: ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe("CaptureMissingState", () => {
  it("renders the missing diagnostics capture state", () => {
    renderWithProviders(<CaptureMissingState />);

    expect(screen.getByText("App Performance")).toBeInTheDocument();
    expect(
      screen.getByText("Diagnostics capture is unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to history" }),
    ).toHaveAttribute("href", "/app-performance");
  });
});
