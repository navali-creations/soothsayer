import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import { CaptureLoadingState } from "./CaptureLoadingState";

describe("CaptureLoadingState", () => {
  it("renders the loading diagnostics capture state", () => {
    renderWithProviders(<CaptureLoadingState />);

    expect(screen.getByText("App Performance")).toBeInTheDocument();
    expect(screen.getByText("Loading diagnostics capture")).toBeInTheDocument();
    expect(document.querySelector(".loading-spinner")).toBeInTheDocument();
  });
});
