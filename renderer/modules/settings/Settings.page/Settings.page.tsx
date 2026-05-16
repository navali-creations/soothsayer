import { useCallback, useMemo, useState } from "react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import {
  AppHelpCard,
  AudioSettingsCard,
  DangerZoneCard,
  ExportSettingsCard,
  FilePathSettingCard,
  FilterSettingsCard,
  OverlaySettingsCard,
  PrivacySettingsCard,
  SettingsCategoryCard,
  StorageSettingsCard,
  TroubleshootingSettingsCard,
} from "../Settings.components";
import {
  createAppBehaviorCategory,
  createGamePathsCategory,
  handleSelectFile,
} from "../Settings.utils/Settings.utils";
import { SettingsTabItem } from "./SettingsTabItem/SettingsTabItem";

const SETTINGS_TABS = [
  { id: "game", label: "Game" },
  { id: "app", label: "App" },
  { id: "overlay", label: "Overlay" },
  { id: "audio", label: "Audio" },
  { id: "storage", label: "Data & Storage" },
  { id: "privacy", label: "Privacy" },
  { id: "help", label: "Help" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "advanced", label: "Advanced", tone: "danger" },
] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

const SettingsPage = () => {
  const settings = useBoundStore((state) => state.settings);
  const isLoading = settings.isLoading;
  const updateSetting = settings.updateSetting;
  const [activeTab, setActiveTab] = useState<SettingsTabId>("game");

  const handleSelectTab = useCallback((tabId: SettingsTabId) => {
    setActiveTab(tabId);
  }, []);

  const categories = useMemo(() => {
    const gamePaths = createGamePathsCategory(settings, (key, title) =>
      handleSelectFile(key, title, updateSetting),
    );

    const appBehavior = createAppBehaviorCategory(settings, updateSetting);

    return {
      gamePaths,
      appBehavior,
    };
  }, [settings, updateSetting]);

  if (isLoading) {
    return (
      <PageContainer>
        <PageContainer.Content>
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg" />
          </div>
        </PageContainer.Content>
      </PageContainer>
    );
  }

  const renderTabContent = (tabId: SettingsTabId) => {
    switch (tabId) {
      case "game":
        return (
          <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(18rem,28rem)]">
            <FilePathSettingCard category={categories.gamePaths} />
            <FilterSettingsCard />
          </div>
        );
      case "app":
        return (
          <div className="space-y-8">
            <SettingsCategoryCard category={categories.appBehavior} />
            <ExportSettingsCard />
          </div>
        );
      case "overlay":
        return <OverlaySettingsCard />;
      case "audio":
        return <AudioSettingsCard />;
      case "storage":
        return <StorageSettingsCard />;
      case "privacy":
        return <PrivacySettingsCard />;
      case "help":
        return <AppHelpCard />;
      case "troubleshooting":
        return <TroubleshootingSettingsCard />;
      case "advanced":
        return <DangerZoneCard />;
      default:
        return null;
    }
  };

  return (
    <PageContainer>
      <PageContainer.Header
        title="Settings"
        subtitle="Configure your application preferences and game paths"
      />
      <PageContainer.Content className="space-y-0">
        <div
          role="tablist"
          aria-label="Settings sections"
          className="tabs tabs-box max-w-5xl bg-base-200 p-1"
        >
          {SETTINGS_TABS.map((tab) => (
            <SettingsTabItem
              key={tab.id}
              tab={tab}
              activeTab={activeTab}
              onSelect={handleSelectTab}
            >
              {activeTab === tab.id ? renderTabContent(tab.id) : null}
            </SettingsTabItem>
          ))}
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SettingsPage;
