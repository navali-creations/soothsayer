import { useMemo } from "react";
import { PageContainer } from "../../components";
import { useBoundStore } from "../../store/store";
import {
  AppHelpCard,
  DangerZoneCard,
  FilePathSettingCard,
  SettingsCategoryCard,
} from "./Settings.components";
import {
  createAppBehaviorCategory,
  createGamePathsCategory,
  createGameSelectionCategory,
  handleSelectFile,
} from "./Settings.utils";

const SettingsPage = () => {
  const settings = useBoundStore((state) => state.settings);
  const isLoading = settings.isLoading;
  const updateSetting = settings.updateSetting;

  const categories = useMemo(() => {
    const gamePaths = createGamePathsCategory(settings, (key, title) =>
      handleSelectFile(key, title, updateSetting),
    );

    const appBehavior = createAppBehaviorCategory(settings, updateSetting);

    const gameSelection = createGameSelectionCategory(settings, updateSetting);

    return {
      gamePaths,
      appBehavior,
      gameSelection,
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

  return (
    <PageContainer>
      <PageContainer.Header
        title="Settings"
        subtitle="Configure your application preferences and game paths"
      />
      <PageContainer.Content>
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Game Paths Section */}
          <FilePathSettingCard category={categories.gamePaths} />

          {/* Game Selection Section */}
          <SettingsCategoryCard category={categories.gameSelection} />

          {/* Application Behavior Section */}
          <SettingsCategoryCard category={categories.appBehavior} />

          {/* App Help Section */}
          <AppHelpCard />

          {/* Danger Zone Section */}
          <DangerZoneCard />
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SettingsPage;
