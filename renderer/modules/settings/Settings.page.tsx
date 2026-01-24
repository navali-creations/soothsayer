import { useMemo } from "react";

import { Grid, PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

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
        <Grid className="grid-cols-2 ">
          <Grid.Col>
            <FilePathSettingCard category={categories.gamePaths} />
          </Grid.Col>
          <Grid.Col>
            <SettingsCategoryCard category={categories.appBehavior} />
          </Grid.Col>
          <Grid.Col>
            <AppHelpCard />
          </Grid.Col>
          <Grid.Col>
            <DangerZoneCard />
          </Grid.Col>
        </Grid>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SettingsPage;
