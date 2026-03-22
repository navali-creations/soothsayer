import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import SettingsCategoryCard from "../Settings.components/SettingsCategoryCard";
import type { SettingsCategory } from "../Settings.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../Settings.components/SettingField", () => ({
  default: ({ setting }: any) => (
    <div data-testid={`setting-${setting.key}`} data-label={setting.label} />
  ),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeCategory(
  overrides: Partial<SettingsCategory> = {},
): SettingsCategory {
  return {
    title: "Application Behavior",
    description: "Customize how the application behaves",
    settings: [
      {
        type: "select",
        key: "appExitAction",
        label: "When closing the window",
        value: "exit",
        options: [
          { value: "exit", label: "Exit Application" },
          { value: "minimize", label: "Minimize to Tray" },
        ],
        onChange: vi.fn(),
      },
      {
        type: "toggle",
        key: "appOpenAtLogin",
        label: "Launch on startup",
        value: false,
        onChange: vi.fn(),
      },
      {
        type: "toggle",
        key: "appOpenAtLoginMinimized",
        label: "Start minimized",
        value: false,
        onChange: vi.fn(),
      },
    ],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SettingsCategoryCard", () => {
  it("renders the category title", () => {
    renderWithProviders(<SettingsCategoryCard category={makeCategory()} />);

    expect(screen.getByText("Application Behavior")).toBeInTheDocument();
  });

  it("renders the category description", () => {
    renderWithProviders(<SettingsCategoryCard category={makeCategory()} />);

    expect(
      screen.getByText("Customize how the application behaves"),
    ).toBeInTheDocument();
  });

  it("renders a SettingField for each setting in the category", () => {
    renderWithProviders(<SettingsCategoryCard category={makeCategory()} />);

    expect(screen.getByTestId("setting-appExitAction")).toBeInTheDocument();
    expect(screen.getByTestId("setting-appOpenAtLogin")).toBeInTheDocument();
    expect(
      screen.getByTestId("setting-appOpenAtLoginMinimized"),
    ).toBeInTheDocument();
  });

  it("renders the correct number of SettingField components", () => {
    const category = makeCategory();
    renderWithProviders(<SettingsCategoryCard category={category} />);

    const settingFields = category.settings.map((s) =>
      screen.getByTestId(`setting-${s.key}`),
    );
    expect(settingFields).toHaveLength(3);
  });

  it("renders with a custom title and description", () => {
    renderWithProviders(
      <SettingsCategoryCard
        category={makeCategory({
          title: "Game & League Selection",
          description: "Choose which version of Path of Exile you're playing",
        })}
      />,
    );

    expect(screen.getByText("Game & League Selection")).toBeInTheDocument();
    expect(
      screen.getByText("Choose which version of Path of Exile you're playing"),
    ).toBeInTheDocument();
  });

  it("renders with an empty settings array", () => {
    renderWithProviders(
      <SettingsCategoryCard category={makeCategory({ settings: [] })} />,
    );

    expect(screen.getByText("Application Behavior")).toBeInTheDocument();
    expect(
      screen.getByText("Customize how the application behaves"),
    ).toBeInTheDocument();
    // No SettingField components should be rendered
    expect(screen.queryByTestId(/^setting-/)).not.toBeInTheDocument();
  });

  it("renders the title inside a card-title heading", () => {
    renderWithProviders(<SettingsCategoryCard category={makeCategory()} />);

    const heading = screen.getByText("Application Behavior");
    expect(heading.tagName).toBe("H2");
    expect(heading).toHaveClass("card-title");
  });

  it("passes the correct setting prop to each SettingField", () => {
    renderWithProviders(<SettingsCategoryCard category={makeCategory()} />);

    const exitAction = screen.getByTestId("setting-appExitAction");
    expect(exitAction).toHaveAttribute("data-label", "When closing the window");

    const openAtLogin = screen.getByTestId("setting-appOpenAtLogin");
    expect(openAtLogin).toHaveAttribute("data-label", "Launch on startup");

    const openMinimized = screen.getByTestId("setting-appOpenAtLoginMinimized");
    expect(openMinimized).toHaveAttribute("data-label", "Start minimized");
  });

  it("renders a single setting correctly", () => {
    renderWithProviders(
      <SettingsCategoryCard
        category={makeCategory({
          settings: [
            {
              type: "text",
              key: "poe1SelectedLeague",
              label: "PoE1 League",
              value: "Standard",
              onChange: vi.fn(),
            },
          ],
        })}
      />,
    );

    expect(
      screen.getByTestId("setting-poe1SelectedLeague"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("setting-appExitAction"),
    ).not.toBeInTheDocument();
  });
});
