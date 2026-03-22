import { fireEvent } from "@testing-library/react";

import {
  act,
  renderWithProviders,
  screen,
} from "~/renderer/__test-setup__/render";

import Search from "../Search";

describe("Search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── 1. Renders with defaults ──────────────────────────────────────────────

  it("renders with default placeholder, search icon, input type, and size class", () => {
    renderWithProviders(<Search />);

    const input = screen.getByPlaceholderText("Search...");
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("type", "search");

    // The label should have the default size class
    const label = input.closest("label")!;
    expect(label).toHaveClass("input-md");

    // FiSearch icon should be visible (no spinning refresh icon)
    const svg = label.querySelector("svg")!;
    expect(svg).toBeInTheDocument();
    expect(svg).not.toHaveClass("animate-spin");
  });

  // ─── 2. Custom placeholder ─────────────────────────────────────────────────

  it("renders with a custom placeholder", () => {
    renderWithProviders(<Search placeholder="Find items..." />);

    expect(screen.getByPlaceholderText("Find items...")).toBeInTheDocument();
  });

  // ─── 3. Size variants ─────────────────────────────────────────────────────

  it.each([
    ["xs", "input-xs"],
    ["sm", "input-sm"],
    ["md", "input-md"],
    ["lg", "input-lg"],
  ] as const)('applies DaisyUI class "%s" → "%s"', (size, expectedClass) => {
    renderWithProviders(<Search size={size} />);

    const input = screen.getByPlaceholderText("Search...");
    const label = input.closest("label")!;
    expect(label).toHaveClass(expectedClass);
  });

  // ─── 4. Custom className ──────────────────────────────────────────────────

  it("merges custom className with base classes", () => {
    renderWithProviders(<Search className="my-custom-class" />);

    const input = screen.getByPlaceholderText("Search...");
    const label = input.closest("label")!;
    expect(label).toHaveClass("my-custom-class");
    // Base classes should still be present
    expect(label).toHaveClass("input");
    expect(label).toHaveClass("input-bordered");
  });

  // ─── 5. Controlled mode ───────────────────────────────────────────────────

  it("controlled mode: value prop drives input value and onChange fires synchronously", () => {
    const handleChange = vi.fn();

    const { rerender } = renderWithProviders(
      <Search value="hello" onChange={handleChange} />,
    );

    const input = screen.getByPlaceholderText("Search...");
    expect(input).toHaveValue("hello");

    // Simulate a change event — onChange should fire synchronously
    fireEvent.change(input, { target: { value: "hellox" } });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("hellox");

    // In controlled mode, the value is driven by the prop
    rerender(<Search value="updated" onChange={handleChange} />);
    expect(input).toHaveValue("updated");
  });

  // ─── 6. Controlled mode without onChange ──────────────────────────────────

  it("controlled mode: typing without onChange does not crash", () => {
    renderWithProviders(<Search value="test" />);

    const input = screen.getByPlaceholderText("Search...");

    // Should not throw
    fireEvent.change(input, { target: { value: "testabc" } });
    expect(input).toBeInTheDocument();
  });

  // ─── 7. Debounced mode: instant display ───────────────────────────────────

  it("debounced mode: typing updates input value immediately", () => {
    const handleChange = vi.fn();

    renderWithProviders(<Search debounceMs={300} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search...");
    expect(input).toHaveValue("");

    // Simulate typing multiple characters
    fireEvent.change(input, { target: { value: "a" } });
    expect(input).toHaveValue("a");

    fireEvent.change(input, { target: { value: "ab" } });
    expect(input).toHaveValue("ab");

    fireEvent.change(input, { target: { value: "abc" } });
    // Internal value should update immediately for display
    expect(input).toHaveValue("abc");
  });

  // ─── 8. Debounced mode: delayed onChange ──────────────────────────────────

  it("debounced mode: onChange fires only after debounceMs delay", () => {
    const handleChange = vi.fn();

    renderWithProviders(<Search debounceMs={300} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "a" } });

    // onChange should NOT have been called yet
    expect(handleChange).not.toHaveBeenCalled();

    // Advance time just short of the debounce delay
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(handleChange).not.toHaveBeenCalled();

    // Advance past the debounce delay
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("a");
  });

  // ─── 9. Debounced mode: rapid typing resets timer ────────────────────────

  it("debounced mode: rapid typing resets timer and only fires once with final value", () => {
    const handleChange = vi.fn();

    renderWithProviders(<Search debounceMs={300} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search...");

    // Type multiple characters rapidly (each keystroke resets the debounce timer)
    fireEvent.change(input, { target: { value: "a" } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: "ab" } });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    fireEvent.change(input, { target: { value: "abc" } });

    // No onChange calls yet
    expect(handleChange).not.toHaveBeenCalled();

    // Advance time past the debounce delay from the last keystroke
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should only have been called once with the final value
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("abc");
  });

  // ─── 10. Debounced mode: timer cleanup on unmount ────────────────────────

  it("debounced mode: unmounting before timer fires does not call onChange", () => {
    const handleChange = vi.fn();

    const { unmount } = renderWithProviders(
      <Search debounceMs={500} onChange={handleChange} />,
    );

    const input = screen.getByPlaceholderText("Search...");
    fireEvent.change(input, { target: { value: "hello" } });

    // Unmount before the debounce fires
    unmount();

    // Advance well past the debounce delay
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // onChange should never have been called
    expect(handleChange).not.toHaveBeenCalled();
  });

  // ─── 11. Debounced mode: debounceMs=0 ────────────────────────────────────

  it("debounced mode: debounceMs=0 still uses debounced path (setTimeout with 0)", () => {
    const handleChange = vi.fn();

    renderWithProviders(<Search debounceMs={0} onChange={handleChange} />);

    const input = screen.getByPlaceholderText("Search...");

    fireEvent.change(input, { target: { value: "x" } });

    // Even with 0ms, it goes through setTimeout so onChange shouldn't fire synchronously
    expect(handleChange).not.toHaveBeenCalled();

    // Advance timers to flush the setTimeout(fn, 0)
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith("x");

    // Internal value should have been updated immediately
    expect(input).toHaveValue("x");
  });

  // ─── 12. Spread props ────────────────────────────────────────────────────

  it("forwards additional HTML input attributes to the input element", () => {
    renderWithProviders(
      <Search
        aria-label="Search items"
        data-testid="my-search"
        name="search-field"
        autoComplete="off"
      />,
    );

    const input = screen.getByTestId("my-search");
    expect(input).toHaveAttribute("aria-label", "Search items");
    expect(input).toHaveAttribute("name", "search-field");
    expect(input).toHaveAttribute("autoComplete", "off");
    expect(input).toHaveAttribute("type", "search");
  });
});
