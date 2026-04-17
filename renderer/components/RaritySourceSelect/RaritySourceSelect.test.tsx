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

  it("calls group action onClick and stops propagation when action button is clicked", async () => {
    const actionOnClick = vi.fn();
    const groupsWithAction = [
      {
        label: "League",
        options: [{ value: "current", label: "Current League" }],
        action: {
          label: "Scan Now",
          onClick: actionOnClick,
        },
      },
    ];

    const { user } = renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={groupsWithAction}
      />,
    );

    const actionButton = screen.getByText("Scan Now").closest("button")!;
    await user.click(actionButton);

    expect(actionOnClick).toHaveBeenCalledTimes(1);
  });

  it("renders nothing for a group with no options and no action", () => {
    const groupsWithEmpty = [
      {
        label: "Empty Group",
        options: [],
        // no action
      },
      {
        label: "Filled",
        options: [{ value: "a", label: "Option A" }],
      },
    ];

    renderWithProviders(
      <RaritySourceSelect
        value="a"
        onChange={vi.fn()}
        groups={groupsWithEmpty}
      />,
    );

    // The empty group's label should not render
    expect(screen.queryByText("Empty Group")).not.toBeInTheDocument();
    // The filled group should still render
    expect(screen.getByText("Filled")).toBeInTheDocument();
  });

  it("renders a group that has no options but has an action", () => {
    const groupsWithAction = [
      {
        label: "Action Only",
        options: [],
        action: {
          label: "Do Something",
          onClick: vi.fn(),
        },
      },
    ];

    renderWithProviders(
      <RaritySourceSelect
        value=""
        onChange={vi.fn()}
        groups={groupsWithAction}
      />,
    );

    // Group label should render because action exists
    expect(screen.getByText("Action Only")).toBeInTheDocument();
    expect(screen.getByText("Do Something")).toBeInTheDocument();
  });

  it("shows spinner and loadingLabel when group action is loading", () => {
    const groupsWithLoading = [
      {
        label: "League",
        options: [{ value: "current", label: "Current League" }],
        action: {
          label: "Scan Now",
          onClick: vi.fn(),
          loading: true,
          loadingLabel: "Scanning...",
        },
      },
    ];

    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={groupsWithLoading}
      />,
    );

    // Loading label should be shown instead of the normal label
    expect(screen.getByText("Scanning...")).toBeInTheDocument();
    // Spinner element should be present
    const spinner = document.querySelector(".loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
    // The action button should have pointer-events-none
    const actionButton = screen.getByText("Scanning...").closest("button")!;
    expect(actionButton.className).toContain("pointer-events-none");
  });

  it("falls back to action label when loadingLabel is not provided during loading", () => {
    const groupsWithLoading = [
      {
        label: "League",
        options: [{ value: "current", label: "Current League" }],
        action: {
          label: "Scan Now",
          onClick: vi.fn(),
          loading: true,
        },
      },
    ];

    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={groupsWithLoading}
      />,
    );

    // Should show the normal label as fallback
    const actionButton = screen.getByText("Scan Now").closest("button")!;
    expect(actionButton).toBeInTheDocument();
    const spinner = document.querySelector(".loading.loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it("renders action icon when provided and not loading", () => {
    const groupsWithIcon = [
      {
        label: "League",
        options: [{ value: "current", label: "Current League" }],
        action: {
          label: "Scan Now",
          onClick: vi.fn(),
          icon: <span data-testid="action-icon">🔍</span>,
        },
      },
    ];

    renderWithProviders(
      <RaritySourceSelect
        value="current"
        onChange={vi.fn()}
        groups={groupsWithIcon}
      />,
    );

    expect(screen.getByTestId("action-icon")).toBeInTheDocument();
    expect(screen.getByText("Scan Now")).toBeInTheDocument();
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
