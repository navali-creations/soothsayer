import { useNavigate, useRouter } from "@tanstack/react-router";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import BackButton from "./BackButton";

// ─── Router mock ───────────────────────────────────────────────────────────

vi.mock("@tanstack/react-router", () => ({
  useNavigate: vi.fn(),
  useRouter: vi.fn(),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("BackButton", () => {
  const mockNavigate = vi.fn();
  const mockBack = vi.fn();

  beforeEach(() => {
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.mocked(useRouter).mockReturnValue({
      history: { back: mockBack },
    } as any);
    mockNavigate.mockClear();
    mockBack.mockClear();
  });

  it("renders with default props", () => {
    renderWithProviders(<BackButton fallback="/sessions" />);

    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    // Arrow icon should be present (rendered as an <svg>)
    expect(button.querySelector("svg")).toBeInTheDocument();
    // No label text should be rendered
    expect(button.querySelector("span")).not.toBeInTheDocument();
  });

  it("renders with label", () => {
    renderWithProviders(<BackButton fallback="/sessions" label="Go back" />);

    const button = screen.getByRole("button");
    expect(button.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText("Go back")).toBeInTheDocument();
  });

  it("navigates back when history exists", async () => {
    Object.defineProperty(window, "history", {
      value: { length: 5 },
      writable: true,
      configurable: true,
    });

    const { user } = renderWithProviders(<BackButton fallback="/sessions" />);

    await user.click(screen.getByRole("button"));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to fallback when no history", async () => {
    Object.defineProperty(window, "history", {
      value: { length: 1 },
      writable: true,
      configurable: true,
    });

    const { user } = renderWithProviders(<BackButton fallback="/sessions" />);

    await user.click(screen.getByRole("button"));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/sessions" });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("applies custom variant", () => {
    renderWithProviders(<BackButton fallback="/sessions" variant="primary" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-primary");
  });

  it("applies custom size", () => {
    renderWithProviders(<BackButton fallback="/sessions" size="lg" />);

    const button = screen.getByRole("button");
    expect(button).toHaveClass("btn-lg");
  });

  it("applies custom className", () => {
    renderWithProviders(
      <BackButton fallback="/sessions" className="my-custom-class" />,
    );

    const button = screen.getByRole("button");
    expect(button).toHaveClass("my-custom-class");
  });
});
