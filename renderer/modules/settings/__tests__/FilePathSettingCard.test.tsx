import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";

import FilePathSettingCard from "../Settings.components/FilePathSettingCard";
import type { FilePathCategory } from "../Settings.types";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/main/utils/mask-path", () => ({
  maskPath: vi.fn((_path: string) => "***masked***"),
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createCategory(
  overrides: Partial<FilePathCategory> = {},
): FilePathCategory {
  return {
    title: "Game Configuration",
    description: "Configure paths to your Path of Exile client logs",
    settings: [
      {
        key: "poe1ClientTxtPath",
        label: "PoE 1 Client.txt",
        value: null,
        placeholder: "Select path to Client.txt",
        onSelect: vi.fn(),
      },
      {
        key: "poe2ClientTxtPath",
        label: "PoE 2 Client.txt",
        value: null,
        placeholder: "Select path to Client.txt (PoE2)",
        onSelect: vi.fn(),
      },
    ],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("FilePathSettingCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  it("renders category title and description", () => {
    const category = createCategory();
    renderWithProviders(<FilePathSettingCard category={category} />);

    expect(
      screen.getByRole("heading", { name: /Game Configuration/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Configure paths to your Path of Exile client logs"),
    ).toBeInTheDocument();
  });

  it("renders all settings from the category", () => {
    const category = createCategory();
    renderWithProviders(<FilePathSettingCard category={category} />);

    expect(screen.getByText("PoE 1 Client.txt")).toBeInTheDocument();
    expect(screen.getByText("PoE 2 Client.txt")).toBeInTheDocument();
  });

  it("shows placeholder when no value is set", () => {
    const category = createCategory();
    renderWithProviders(<FilePathSettingCard category={category} />);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveAttribute(
      "placeholder",
      "Select path to Client.txt",
    );
    expect(inputs[0]).toHaveValue("");
  });

  it("shows masked path when value exists", () => {
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: "C:\\Users\\me\\Games\\Path of Exile\\logs\\Client.txt",
          placeholder: "Select path to Client.txt",
          onSelect: vi.fn(),
        },
      ],
    });

    renderWithProviders(<FilePathSettingCard category={category} />);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("***masked***");
  });

  // ── Reveal / Hide toggle ──────────────────────────────────────────────

  it("clicking reveal shows full path", async () => {
    const fullPath = "C:\\Users\\me\\Games\\Path of Exile\\logs\\Client.txt";
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: fullPath,
          placeholder: "Select path to Client.txt",
          onSelect: vi.fn(),
        },
      ],
    });

    const { user } = renderWithProviders(
      <FilePathSettingCard category={category} />,
    );

    // Initially masked
    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("***masked***");

    // Click reveal button
    const revealButton = screen.getByTitle("Reveal full path");
    await user.click(revealButton);

    expect(input).toHaveValue(fullPath);
  });

  it("clicking reveal again hides the path", async () => {
    const fullPath = "C:\\Users\\me\\Games\\Path of Exile\\logs\\Client.txt";
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: fullPath,
          placeholder: "Select path to Client.txt",
          onSelect: vi.fn(),
        },
      ],
    });

    const { user } = renderWithProviders(
      <FilePathSettingCard category={category} />,
    );

    // Click reveal
    const revealButton = screen.getByTitle("Reveal full path");
    await user.click(revealButton);

    expect(screen.getByRole("textbox")).toHaveValue(fullPath);

    // Click hide
    const hideButton = screen.getByTitle("Hide full path");
    await user.click(hideButton);

    expect(screen.getByRole("textbox")).toHaveValue("***masked***");
  });

  it("does not show reveal button when path is empty", () => {
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: null,
          placeholder: "Select path to Client.txt",
          onSelect: vi.fn(),
        },
      ],
    });

    renderWithProviders(<FilePathSettingCard category={category} />);

    expect(screen.queryByTitle("Reveal full path")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Hide full path")).not.toBeInTheDocument();
  });

  // ── Browse button ─────────────────────────────────────────────────────

  it("browse button calls onSelect", async () => {
    const onSelect = vi.fn();
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: null,
          placeholder: "Select path to Client.txt",
          onSelect,
        },
      ],
    });

    const { user } = renderWithProviders(
      <FilePathSettingCard category={category} />,
    );

    // The browse button is the Button with variant="primary"
    const browseButton = screen.getByRole("button");
    await user.click(browseButton);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  // ── Multiple settings with independent reveal state ───────────────────

  it("reveal state is independent per setting", async () => {
    const category = createCategory({
      settings: [
        {
          key: "poe1ClientTxtPath",
          label: "PoE 1 Client.txt",
          value: "C:\\path\\to\\poe1\\Client.txt",
          placeholder: "Select path",
          onSelect: vi.fn(),
        },
        {
          key: "poe2ClientTxtPath",
          label: "PoE 2 Client.txt",
          value: "C:\\path\\to\\poe2\\Client.txt",
          placeholder: "Select path",
          onSelect: vi.fn(),
        },
      ],
    });

    const { user } = renderWithProviders(
      <FilePathSettingCard category={category} />,
    );

    const inputs = screen.getAllByRole("textbox");
    const revealButtons = screen.getAllByTitle("Reveal full path");

    // Both initially masked
    expect(inputs[0]).toHaveValue("***masked***");
    expect(inputs[1]).toHaveValue("***masked***");

    // Reveal only the first
    await user.click(revealButtons[0]);

    expect(inputs[0]).toHaveValue("C:\\path\\to\\poe1\\Client.txt");
    expect(inputs[1]).toHaveValue("***masked***");
  });
});
