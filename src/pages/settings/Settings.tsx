import { useMemo, useState } from "react";
import { FiFolder, FiTrash2 } from "react-icons/fi";
import { Button, Flex } from "../../components";
import { useBoundStore } from "../../store/store";
import { OnboardingButton } from "../../modules/onboarding";

const SettingsPage = () => {
  const settings = useBoundStore((state) => state.settings);
  const isLoading = useBoundStore((state) => state.isLoading);
  const updateSetting = useBoundStore((state) => state.updateSetting);
  const [isResetting, setIsResetting] = useState(false);

  const handleSelectFile = async (
    key: "poe1-client-txt-path" | "poe2-client-txt-path" | "collection-path",
    title: string,
  ) => {
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

  const handleResetDatabase = async () => {
    // Double confirmation for safety
    const firstConfirm = confirm(
      "⚠️ WARNING: This will DELETE ALL your data!\n\n" +
        "This includes:\n" +
        "• All sessions and session history\n" +
        "• All card statistics\n" +
        "• All price snapshots\n\n" +
        "This action CANNOT be undone!\n\n" +
        "The application will restart after the reset.\n\n" +
        "Are you absolutely sure?",
    );

    if (!firstConfirm) return;

    const secondConfirm = confirm(
      "Last chance! Click OK to DELETE ALL DATA and restart the app.",
    );

    if (!secondConfirm) return;

    try {
      setIsResetting(true);
      const result = await window.electron.settings.resetDatabase();

      if (result.success) {
        alert(
          "✅ Database reset successfully!\n\n" +
            "Click OK to restart the application.",
        );

        // Request app restart/quit
        if (window.electron?.app?.quit) {
          window.electron.app.quit();
        } else {
          // Fallback: reload the renderer
          window.location.reload();
        }
      } else {
        alert(`❌ Failed to reset database:\n${result.error}`);
        setIsResetting(false);
      }
    } catch (error) {
      console.error("Error resetting database:", error);
      alert(`❌ Error resetting database:\n${(error as Error).message}`);
      setIsResetting(false);
    }
  };

  // Categorized settings for easier organization
  const categories = useMemo(() => {
    if (!settings) return null;

    return {
      gamePaths: {
        title: "Game Configuration",
        description: "Configure paths to your Path of Exile client logs",
        settings: [
          {
            key: "poe1-client-txt-path" as const,
            label: "Path of Exile 1 Client.txt",
            value: settings["poe1-client-txt-path"],
            placeholder: "No file selected",
            onSelect: () =>
              handleSelectFile(
                "poe1-client-txt-path",
                "Select Path of Exile 1 Client.txt",
              ),
          },
          {
            key: "poe2-client-txt-path" as const,
            label: "Path of Exile 2 Client.txt",
            value: settings["poe2-client-txt-path"],
            placeholder: "No file selected",
            onSelect: () =>
              handleSelectFile(
                "poe2-client-txt-path",
                "Select Path of Exile 2 Client.txt",
              ),
          },
        ],
      },
      dataPaths: {
        title: "Data Storage",
        description:
          "Configure where your collection and session data is stored",
        settings: [
          {
            key: "collection-path" as const,
            label: "Collection Path",
            value: settings["collection-path"],
            placeholder: "No file selected",
            onSelect: () => handleSelectFile("collection-path", "Collection"),
          },
        ],
      },
      appBehavior: {
        title: "Application Behavior",
        description: "Customize how the application behaves",
        settings: [
          {
            type: "select" as const,
            key: "app-exit-action" as const,
            label: "When closing the window",
            value: settings["app-exit-action"],
            options: [
              { value: "minimize-to-tray", label: "Minimize to Tray" },
              { value: "quit", label: "Quit Application" },
            ],
            onChange: (value: string) =>
              updateSetting("app-exit-action", value as any),
          },
          {
            type: "toggle" as const,
            key: "app-open-at-login" as const,
            label: "Launch on startup",
            value: settings["app-open-at-login"],
            onChange: (value: boolean) =>
              updateSetting("app-open-at-login", value),
          },
          {
            type: "toggle" as const,
            key: "app-open-at-login-minimized" as const,
            label: "Start minimized",
            value: settings["app-open-at-login-minimized"],
            onChange: (value: boolean) =>
              updateSetting("app-open-at-login-minimized", value),
          },
        ],
      },
      updates: {
        title: "Updates",
        description: "Configure how you receive application updates",
        settings: [
          {
            type: "select" as const,
            key: "release-channel" as const,
            label: "Update Channel",
            value: settings["release-channel"],
            options: [
              { value: "stable", label: "Stable" },
              { value: "beta", label: "Beta" },
            ],
            onChange: (value: string) =>
              updateSetting("release-channel", value as any),
          },
        ],
      },
      gameSelection: {
        title: "Game Selection",
        description: "Choose which version of Path of Exile you're playing",
        settings: [
          {
            type: "select" as const,
            key: "installed-games" as const,
            label: "Installed Games",
            value: settings["installed-games"],
            options: [
              { value: "poe1", label: "Path of Exile 1" },
              { value: "poe2", label: "Path of Exile 2" },
              { value: "both", label: "Both" },
            ],
            onChange: updateSetting,
          },
          {
            type: "text" as const,
            key: "selected-poe1-league" as const,
            label: "PoE1 League",
            value: settings["selected-poe1-league"],
            placeholder: "Standard",
            onChange: (value: string) =>
              updateSetting("selected-poe1-league", value),
            hidden: settings["installed-games"] === "poe2",
          },
          {
            type: "text" as const,
            key: "selected-poe2-league" as const,
            label: "PoE2 League",
            value: settings["selected-poe2-league"],
            placeholder: "Standard",
            onChange: (value: string) =>
              updateSetting("selected-poe2-league", value),
            hidden: settings["installed-games"] === "poe1",
          },
        ],
      },
    };
  }, [settings]);

  if (isLoading || !settings || !categories) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-base-content/60 mt-2">
            Configure your application preferences and game paths
          </p>
        </div>

        {/* Game Paths Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">{categories.gamePaths.title}</h2>
            <p className="text-sm text-base-content/60">
              {categories.gamePaths.description}
            </p>

            <div className="space-y-4 mt-4">
              {categories.gamePaths.settings.map((setting) => (
                <div key={setting.key} className="form-control w-full">
                  <label className="label">
                    <span className="label-text">{setting.label}</span>
                  </label>
                  <Flex className="gap-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1"
                      value={setting.value || ""}
                      readOnly
                      placeholder={setting.placeholder}
                    />
                    <Button variant="primary" onClick={setting.onSelect}>
                      <FiFolder />
                    </Button>
                  </Flex>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Paths Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">{categories.dataPaths.title}</h2>
            <p className="text-sm text-base-content/60">
              {categories.dataPaths.description}
            </p>

            <div className="space-y-4 mt-4">
              {categories.dataPaths.settings.map((setting) => (
                <div key={setting.key} className="form-control w-full">
                  <label className="label">
                    <span className="label-text">{setting.label}</span>
                  </label>
                  <Flex className="gap-2">
                    <input
                      type="text"
                      className="input input-bordered flex-1"
                      value={setting.value || ""}
                      readOnly
                      placeholder={setting.placeholder}
                    />
                    <Button variant="primary" onClick={setting.onSelect}>
                      <FiFolder />
                    </Button>
                  </Flex>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Game Selection Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">{categories.gameSelection.title}</h2>
            <p className="text-sm text-base-content/60">
              {categories.gameSelection.description}
            </p>

            <div className="space-y-4 mt-4">
              {categories.gameSelection.settings.map((setting) => {
                if (setting.hidden) return null;

                if (setting.type === "select") {
                  return (
                    <div key={setting.key} className="form-control">
                      <label className="label">
                        <span className="label-text">{setting.label}</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={setting.value}
                        onChange={(e) => setting.onChange(e.target.value)}
                      >
                        {setting.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (setting.type === "text") {
                  return (
                    <div key={setting.key} className="form-control">
                      <label className="label">
                        <span className="label-text">{setting.label}</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={setting.value}
                        placeholder={setting.placeholder}
                        onChange={(e) => setting.onChange(e.target.value)}
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>

        {/* Application Behavior Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">{categories.appBehavior.title}</h2>
            <p className="text-sm text-base-content/60">
              {categories.appBehavior.description}
            </p>

            <div className="space-y-4 mt-4">
              {categories.appBehavior.settings.map((setting) => {
                if (setting.type === "select") {
                  return (
                    <div key={setting.key} className="form-control">
                      <label className="label">
                        <span className="label-text">{setting.label}</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={setting.value}
                        onChange={(e) => setting.onChange(e.target.value)}
                      >
                        {setting.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (setting.type === "toggle") {
                  return (
                    <div key={setting.key} className="form-control">
                      <label className="label cursor-pointer justify-start gap-4">
                        <span className="label-text flex-1">
                          {setting.label}
                        </span>
                        <input
                          type="checkbox"
                          className="toggle toggle-primary"
                          checked={setting.value}
                          onChange={(e) => setting.onChange(e.target.checked)}
                        />
                      </label>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>

        {/* Updates Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">{categories.updates.title}</h2>
            <p className="text-sm text-base-content/60">
              {categories.updates.description}
            </p>

            <div className="space-y-4 mt-4">
              {categories.updates.settings.map((setting) => {
                if (setting.type === "select") {
                  return (
                    <div key={setting.key} className="form-control">
                      <label className="label">
                        <span className="label-text">{setting.label}</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={setting.value}
                        onChange={(e) => setting.onChange(e.target.value)}
                      >
                        {setting.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>

        {/* App Help Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">App Help</h2>
            <p className="text-sm text-base-content/60">
              Need help getting started or want a refresher?
            </p>

            <div className="divider"></div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold">App Tour</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  Interactive beacons guide you through Soothsayer's features.
                  Dismissed a beacon? Reset the tour to see them all again.
                </p>
              </div>
              <OnboardingButton variant="button" />
            </div>
          </div>
        </div>

        {/* Danger Zone Section */}
        <div className="card bg-base-100 shadow-xl border-2 border-error">
          <div className="card-body">
            <h2 className="card-title text-error">
              <FiTrash2 className="w-5 h-5" />
              Danger Zone
            </h2>
            <p className="text-sm text-base-content/60">
              Irreversible actions that affect your data
            </p>

            <div className="divider"></div>

            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Reset Database</h3>
                  <p className="text-sm text-base-content/60 mt-1">
                    Permanently delete all sessions, statistics, and price
                    snapshots. This action cannot be undone.
                  </p>
                </div>
                <Button
                  variant="error"
                  onClick={handleResetDatabase}
                  disabled={isResetting}
                  className="whitespace-nowrap"
                >
                  {isResetting ? (
                    <>
                      <span className="loading loading-spinner loading-sm"></span>
                      Resetting...
                    </>
                  ) : (
                    <>
                      <FiTrash2 />
                      Reset Database
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
