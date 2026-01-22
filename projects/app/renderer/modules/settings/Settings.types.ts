import type { UserSettingsDTO } from "../../../electron/modules/settings-store/SettingsStore.dto";

export interface FilePathSetting {
  key: keyof Pick<UserSettingsDTO, "poe1ClientTxtPath" | "poe2ClientTxtPath">;
  label: string;
  value: string | null;
  placeholder: string;
  onSelect: () => void;
}

export interface SelectSetting<T extends string = string> {
  type: "select";
  key: keyof UserSettingsDTO;
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  hidden?: boolean;
}

export interface ToggleSetting {
  type: "toggle";
  key: keyof UserSettingsDTO;
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hidden?: boolean;
}

export interface TextSetting {
  type: "text";
  key: keyof UserSettingsDTO;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  hidden?: boolean;
}

export type Setting = SelectSetting | ToggleSetting | TextSetting;

export interface SettingsCategory {
  title: string;
  description: string;
  settings: Setting[];
}

export interface FilePathCategory {
  title: string;
  description: string;
  settings: FilePathSetting[];
}
