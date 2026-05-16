import type { ReactNode } from "react";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { LiveCaptureEmptyState } from "./LiveCaptureEmptyState";

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

describe("LiveCaptureEmptyState", () => {
  it("renders the empty live capture state and starts diagnostics", async () => {
    const handleStartDiagnostics = vi.fn();
    const { user } = renderWithProviders(
      <LiveCaptureEmptyState
        error="capture failed"
        isStartingCapture={false}
        onStartDiagnostics={handleStartDiagnostics}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("capture failed");
    expect(screen.getByText("Diagnostics are not running")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /start diagnostics/i }),
    );

    expect(handleStartDiagnostics).toHaveBeenCalledTimes(1);
  });
});
