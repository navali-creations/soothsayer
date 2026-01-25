import type { UserSettingsDTO } from "~/main/modules/settings-store/SettingsStore.dto";

import type { FilePathCategory, SettingsCategory } from "./Settings.types";

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
      label: "Path of Exile 1 Client.txt",
      value: settings.poe1ClientTxtPath,
      placeholder: "No file selected",
      onSelect: () =>
        onSelectFile("poe1ClientTxtPath", "Select Path of Exile 1 Client.txt"),
    },
    {
      key: "poe2ClientTxtPath",
      label: "Path of Exile 2 Client.txt",
      value: settings.poe2ClientTxtPath,
      placeholder: "No file selected",
      onSelect: () =>
        onSelectFile("poe2ClientTxtPath", "Select Path of Exile 2 Client.txt"),
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
      onChange: (value) =>
        updateSetting("appExitAction", value as "exit" | "minimize"),
    },
    {
      type: "toggle",
      key: "appOpenAtLogin",
      label: "Launch on startup",
      value: settings.appOpenAtLogin,
      onChange: (value) => updateSetting("appOpenAtLogin", value),
    },
    {
      type: "toggle",
      key: "appOpenAtLoginMinimized",
      label: "Start minimized",
      value: settings.appOpenAtLoginMinimized,
      onChange: (value) => updateSetting("appOpenAtLoginMinimized", value),
    },
  ],
});

export const createGameSelectionCategory = (
  settings: UserSettingsDTO,
  updateSetting: <K extends keyof UserSettingsDTO>(
    key: K,
    value: UserSettingsDTO[K],
  ) => Promise<void>,
): SettingsCategory => ({
  title: "Game & League Selection",
  description: "Choose which version of Path of Exile you're playing",
  settings: [
    {
      type: "select",
      key: "selectedGame",
      label: "Active Game",
      value: settings.selectedGame,
      options: [
        { value: "poe1", label: "Path of Exile 1" },
        { value: "poe2", label: "Path of Exile 2" },
      ],
      onChange: (value) =>
        updateSetting("selectedGame", value as "poe1" | "poe2"),
    },
    {
      type: "text",
      key: "poe1SelectedLeague",
      label: "PoE1 League",
      value: settings.poe1SelectedLeague,
      placeholder: "Standard",
      onChange: (value) => updateSetting("poe1SelectedLeague", value),
      hidden: settings.selectedGame === "poe2",
    },
    {
      type: "text",
      key: "poe2SelectedLeague",
      label: "PoE2 League",
      value: settings.poe2SelectedLeague,
      placeholder: "Standard",
      onChange: (value) => updateSetting("poe2SelectedLeague", value),
      hidden: settings.selectedGame === "poe1",
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
