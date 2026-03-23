import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import RaritySourceSelect from "./RaritySourceSelect";

const sampleGroups = [
  {
    label: "League",
    options: [
      { value: "current", label: "Current League" },
      { value: "previous", label: "Previous League", outdated: true },
    ],
  },
  {
    label: "Standard",
    options: [
      { value: "standard", label: "Standard", menuLabel: "Standard (forever)" },
      { value: "hardcore", label: "Hardcore" },
    ],
  },
];

describe("RaritySourceSelect", () => {
  it("renders trigger with the selected option's label", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    // The label appears in both the trigger and the dropdown option
    const matches = screen.getAllByText("Current League");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // The trigger button contains the label
    const trigger = screen.getByRole("button", { name: /Current League/i });
    expect(trigger).toBeInTheDocument();
  });

  it("shows raw value in trigger when option is not found in groups", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="nonexistent-source"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    expect(screen.getByText("nonexistent-source")).toBeInTheDocument();
  });

  it("renders group labels", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    expect(screen.getByText("League")).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("renders all options across groups", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    // "Current League" appears in the trigger AND as an option button
    const currentLeagueEls = screen.getAllByText("Current League");
    expect(currentLeagueEls.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Previous League")).toBeInTheDocument();
    // menuLabel takes precedence for display in dropdown
    expect(screen.getByText("Standard (forever)")).toBeInTheDocument();
    expect(screen.getByText("Hardcore")).toBeInTheDocument();
  });

  it("shows ✓ checkmark for the selected option", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    // All checkmark spans exist, but only the selected one should be visible
    const checkmarks = screen.getAllByText("✓");
    const visibleCheckmark = checkmarks.find(
      (el) => !el.classList.contains("invisible"),
    );
    expect(visibleCheckmark).toBeDefined();

    // The invisible ones are for non-selected options
    const invisibleCheckmarks = checkmarks.filter((el) =>
      el.classList.contains("invisible"),
    );
    expect(invisibleCheckmarks.length).toBe(checkmarks.length - 1);
  });

  it("calls onChange when clicking a different option", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={onChange}
        groups={sampleGroups}
      />,
    );

    await user.click(screen.getByText("Hardcore"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("hardcore");
  });

  it("does NOT call onChange when clicking the already-selected option", async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={onChange}
        groups={sampleGroups}
      />,
    );

    // The option button that contains "Current League" text in the dropdown
    // There may also be the trigger button text, so find the option button specifically
    const optionButtons = screen.getAllByRole("button", {
      name: /Current League/,
    });
    // Click the option button (not the trigger) — the last match is typically the option
    const optionButton = optionButtons[optionButtons.length - 1];
    await user.click(optionButton);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("applies disabled state with disabled attribute and classes", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
        disabled
      />,
    );

    const trigger = screen.getByRole("button", { name: /Current League/i });
    expect(trigger).toBeDisabled();
    expect(trigger.className).toMatch(/select-disabled/);
    expect(trigger.className).toMatch(/opacity-50/);
  });

  it("shows warning icon for outdated options", () => {
    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
      />,
    );

    // The outdated option ("Previous League") should have a warning icon with title "Outdated"
    const warningIcon = screen.getByTitle("Outdated");
    expect(warningIcon).toBeInTheDocument();
  });

  it("applies custom className to the outer wrapper", () => {
    const { container } = renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={sampleGroups}
        className="my-custom-class"
      />,
    );

    const outerDiv = container.firstElementChild as HTMLElement;
    expect(outerDiv.className).toContain("my-custom-class");
  });
});
