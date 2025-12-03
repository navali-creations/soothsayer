import { useCallback, useEffect, useState } from "react";
import type { SettingsSchema } from "../electron";

export const useSettings = () => {
  const [settings, setSettings] = useState<SettingsSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const loadedSettings = await window.electron.settings.getSettings();
    setSettings(loadedSettings);
    setLoading(false);
  };

  const updateSetting = useCallback(
    async (key: keyof SettingsSchema, value: any) => {
      const result = await window.electron.settings.set(key, value);
      if (result) {
        setSettings((prev) => (prev ? { ...prev, [key]: value } : null));
      }
      return result;
    },
    [],
  );

  return { settings, loading, updateSetting, reload: loadSettings };
};
