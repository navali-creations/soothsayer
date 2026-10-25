import type { UserSettingsDTO } from "~/main/modules/settings-store/SettingsStore.dto";

import type { FilePathCategory, SettingsCategory } from "../Settings.types";

export const createGamePathsCategory = (
  settings: UserSettingsDTO,
  onSelectFile: (
    key: "poe1ClientTxtPath" | "poe2ClientTxtPath",
    title: string,
  ) => void,
): FilePathCategory => ({
  title: "Game Configuration",
  description: "Configure paths to your Path of Exile client logs",
  settings: [
    {
      key: "poe1ClientTxtPath",
      label: "Path of Exile 1 client log",
      value: settings.poe1ClientTxtPath,
      placeholder: "No file selected",
      onSelect: () =>
        onSelectFile("poe1ClientTxtPath", "Select Path of Exile 1 client log"),
    },
    {
      key: "poe2ClientTxtPath",
      label: "Path of Exile 2 client log",
      value: settings.poe2ClientTxtPath,
      placeholder: "No file selected",
      onSelect: () =>
        onSelectFile("poe2ClientTxtPath", "Select Path of Exile 2 client log"),
    },
  ],
});

export const createAppBehaviorCategory = (
  settings: UserSettingsDTO,
  updateSetting: <K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ) => Promise<void>,
): SettingsCategory => ({
  title: "Application Behavior",
  description: "Customize how the application behaves",
  settings: [
    {
      type: "select",
      key: "appExitAction",
      label: "When closing the window",
      value: settings.appExitAction,
      options: [
        { value: "exit", label: "Exit Application" },
        { value: "minimize", label: "Minimize to Tray" },
      ],
      onChange: (value) => {
        updateSetting("appExitAction", value as "exit" | "minimize");
      },
    },
    {
      type: "toggle",
      key: "appOpenAtLogin",
      label: "Launch on startup",
      value: settings.appOpenAtLogin,
      onChange: (value) => {
        updateSetting("appOpenAtLogin", value);
      },
    },
    {
      type: "toggle",
      key: "appOpenAtLoginMinimized",
      label: "Start minimized",
      value: settings.appOpenAtLoginMinimized,
      onChange: (value) => {
        updateSetting("appOpenAtLoginMinimized", value);
      },
    },
  ],
});

export const handleSelectFile = async (
  key: "poe1ClientTxtPath" | "poe2ClientTxtPath",
  title: string,
  updateSetting: <K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ) => Promise<void>,
): Promise<void> => {
  try {
    const filePath = await window.electron.selectFile({
      title,
      filters: [{ name: "Text Files", extensions: ["txt"] }],
      properties: ["openFile"],
    });

    if (filePath) {
      await updateSetting(key, filePath);
    }
  } catch (error) {
    console.error("Error selecting file:", error);
  }
};
