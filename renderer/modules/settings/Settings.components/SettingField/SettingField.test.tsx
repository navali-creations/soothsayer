import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import type {
  SelectSetting,
  SliderSetting,
  TextSetting,
  ToggleSetting,
} from "../../Settings.types";
import SettingField from "./SettingField";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeSelectSetting(
  overrides: Partial<SelectSetting> = {},
): SelectSetting {
  return {
    type: "select",
    key: "appExitAction",
    label: "When closing the window",
    value: "exit",
    options: [
      { value: "exit", label: "Exit Application" },
      { value: "minimize", label: "Minimize to Tray" },
    ],
    onChange: vi.fn(),
    ...overrides,
  };
}

function makeToggleSetting(
  overrides: Partial<ToggleSetting> = {},
): ToggleSetting {
  return {
    type: "toggle",
    key: "appOpenAtLogin",
    label: "Launch on startup",
    value: false,
    onChange: vi.fn(),
    ...overrides,
  };
}

function makeTextSetting(overrides: Partial<TextSetting> = {}): TextSetting {
  return {
    type: "text",
    key: "poe1SelectedLeague",
    label: "PoE1 League",
    value: "Standard",
    placeholder: "Standard",
    onChange: vi.fn(),
    ...overrides,
  };
}

function makeSliderSetting(
  overrides: Partial<SliderSetting> = {},
): SliderSetting {
  return {
    type: "slider",
    key: "audioVolume",
    label: "Volume",
    value: 0.75,
    min: 0,
    max: 1,
    step: 0.01,
    onChange: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("SettingField", () => {
  // ── Hidden ─────────────────────────────────────────────────────────────

  it("renders nothing when setting.hidden is true (select)", () => {
    const { container } = renderWithProviders(
      <SettingField setting={makeSelectSetting({ hidden: true })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when setting.hidden is true (toggle)", () => {
    const { container } = renderWithProviders(
      <SettingField setting={makeToggleSetting({ hidden: true })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when setting.hidden is true (text)", () => {
    const { container } = renderWithProviders(
      <SettingField setting={makeTextSetting({ hidden: true })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when setting.hidden is true (slider)", () => {
    const { container } = renderWithProviders(
      <SettingField setting={makeSliderSetting({ hidden: true })} />,
    );
    expect(container.innerHTML).toBe("");
  });

  // ── Select type ────────────────────────────────────────────────────────

  describe("select type", () => {
    it("renders a select element", () => {
      renderWithProviders(<SettingField setting={makeSelectSetting()} />);

      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();
    });

    it("renders the label text", () => {
      renderWithProviders(<SettingField setting={makeSelectSetting()} />);

      expect(screen.getByText("When closing the window")).toBeInTheDocument();
    });

    it("renders all options", () => {
      renderWithProviders(<SettingField setting={makeSelectSetting()} />);

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent("Exit Application");
      expect(options[1]).toHaveTextContent("Minimize to Tray");
    });

    it("has the correct selected value", () => {
      renderWithProviders(
        <SettingField setting={makeSelectSetting({ value: "minimize" })} />,
      );

      const select = screen.getByRole("combobox") as HTMLSelectElement;
      expect(select.value).toBe("minimize");
    });

    it("calls onChange when a new option is selected", async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <SettingField setting={makeSelectSetting({ onChange })} />,
      );

      const select = screen.getByRole("combobox");
      await user.selectOptions(select, "minimize");

      expect(onChange).toHaveBeenCalledWith("minimize");
    });
  });

  // ── Toggle type ────────────────────────────────────────────────────────

  describe("toggle type", () => {
    it("renders a checkbox input", () => {
      renderWithProviders(<SettingField setting={makeToggleSetting()} />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });

    it("renders the label text", () => {
      renderWithProviders(<SettingField setting={makeToggleSetting()} />);

      expect(screen.getByText("Launch on startup")).toBeInTheDocument();
    });

    it("reflects the current checked state (false)", () => {
      renderWithProviders(
        <SettingField setting={makeToggleSetting({ value: false })} />,
      );

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it("reflects the current checked state (true)", () => {
      renderWithProviders(
        <SettingField setting={makeToggleSetting({ value: true })} />,
      );

      const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it("calls onChange with true when toggled on", async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <SettingField
          setting={makeToggleSetting({ value: false, onChange })}
        />,
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange with false when toggled off", async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <SettingField setting={makeToggleSetting({ value: true, onChange })} />,
      );

      const checkbox = screen.getByRole("checkbox");
      await user.click(checkbox);

      expect(onChange).toHaveBeenCalledWith(false);
    });
  });

  // ── Text type ──────────────────────────────────────────────────────────

  describe("text type", () => {
    it("renders a text input", () => {
      renderWithProviders(<SettingField setting={makeTextSetting()} />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("renders the label text", () => {
      renderWithProviders(<SettingField setting={makeTextSetting()} />);

      expect(screen.getByText("PoE1 League")).toBeInTheDocument();
    });

    it("displays the current value", () => {
      renderWithProviders(
        <SettingField setting={makeTextSetting({ value: "Settlers" })} />,
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("Settlers");
    });

    it("renders the placeholder", () => {
      renderWithProviders(
        <SettingField
          setting={makeTextSetting({ value: "", placeholder: "Standard" })}
        />,
      );

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.placeholder).toBe("Standard");
    });

    it("calls onChange when text is typed", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SettingField setting={makeTextSetting({ value: "", onChange })} />,
      );

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "Necropolis" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith("Necropolis");
    });
  });

  // ── Slider type ────────────────────────────────────────────────────────

  describe("slider type", () => {
    it("renders a range input", () => {
      renderWithProviders(<SettingField setting={makeSliderSetting()} />);

      const slider = screen.getByRole("slider");
      expect(slider).toBeInTheDocument();
    });

    it("renders the label text", () => {
      renderWithProviders(<SettingField setting={makeSliderSetting()} />);

      expect(screen.getByText("Volume")).toBeInTheDocument();
    });

    it("sets correct min, max, and step attributes", () => {
      renderWithProviders(
        <SettingField
          setting={makeSliderSetting({ min: 0, max: 1, step: 0.05 })}
        />,
      );

      const slider = screen.getByRole("slider") as HTMLInputElement;
      expect(slider.min).toBe("0");
      expect(slider.max).toBe("1");
      expect(slider.step).toBe("0.05");
    });

    it("reflects the current value", () => {
      renderWithProviders(
        <SettingField setting={makeSliderSetting({ value: 0.5 })} />,
      );

      const slider = screen.getByRole("slider") as HTMLInputElement;
      expect(slider.value).toBe("0.5");
    });

    it("shows default formatted value as percentage", () => {
      renderWithProviders(
        <SettingField setting={makeSliderSetting({ value: 0.75 })} />,
      );

      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("shows custom formatted value when formatValue is provided", () => {
      renderWithProviders(
        <SettingField
          setting={makeSliderSetting({
            value: 14,
            min: 8,
            max: 24,
            step: 1,
            formatValue: (v: number) => `${v}px`,
          })}
        />,
      );

      expect(screen.getByText("14px")).toBeInTheDocument();
    });

    it("calls onChange with parsed float when slider is changed", () => {
      const onChange = vi.fn();
      renderWithProviders(
        <SettingField setting={makeSliderSetting({ onChange })} />,
      );

      const slider = screen.getByRole("slider");
      fireEvent.change(slider, { target: { value: "0.5" } });

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(0.5);
    });
  });

  // ── Unknown type ───────────────────────────────────────────────────────

  it("returns null for unknown setting type", () => {
    const unknownSetting = {
      type: "unknown-type",
      key: "someKey",
      label: "Some Label",
      value: "something",
    } as any;

    const { container } = renderWithProviders(
      <SettingField setting={unknownSetting} />,
    );

    expect(container.innerHTML).toBe("");
  });
});
