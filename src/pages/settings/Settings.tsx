import { useMemo } from "react";
import { FiFolder } from "react-icons/fi";
import { Button, Flex } from "../../components";
import { useBoundStore } from "../../store/store";

const SettingsPage = () => {
  const settings = useBoundStore((state) => state.settings);
  const isLoading = useBoundStore((state) => state.isLoading);
  const updateSetting = useBoundStore((state) => state.updateSetting);

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
          "Configure where your divination card collection is stored",
        settings: [
          {
            key: "collection-path" as const,
            label: "Collection Path",
            value: settings["collection-path"],
            placeholder: "No path selected",
            onSelect: () =>
              handleSelectFile("collection-path", "Select Collection Path"),
          },
        ],
      },
      appBehavior: {
        title: "Application Behavior",
        description: "Control how the application behaves",
        settings: [
          {
            type: "select" as const,
            key: "app-exit-action" as const,
            label: "When closing the app",
            value: settings["app-exit-action"],
            options: [
              { value: "exit", label: "Exit application" },
              { value: "minimize-to-tray", label: "Minimize to tray" },
            ],
            onChange: (value: string) =>
              updateSetting("app-exit-action", value),
          },
          {
            type: "toggle" as const,
            key: "app-open-at-login" as const,
            label: "Open at login",
            value: settings["app-open-at-login"],
            onChange: (value: boolean) =>
              updateSetting("app-open-at-login", value),
          },
          ...(settings["app-open-at-login"]
            ? [
                {
                  type: "toggle" as const,
                  key: "app-open-at-login-minimized" as const,
                  label: "Open at login minimized",
                  value: settings["app-open-at-login-minimized"],
                  onChange: (value: boolean) =>
                    updateSetting("app-open-at-login-minimized", value),
                },
              ]
            : []),
        ],
      },
      updates: {
        title: "Updates & Releases",
        description: "Choose which version channel you'd like to receive",
        settings: [
          {
            type: "select" as const,
            key: "release-channel" as const,
            label: "Release Channel",
            value: settings["release-channel"],
            options: [
              { value: "stable", label: "Stable (Recommended)" },
              { value: "beta", label: "Beta (Early Access)" },
            ],
            onChange: (value: string) =>
              updateSetting("release-channel", value),
          },
        ],
      },
      gameSelection: {
        title: "Game Selection",
        description: "Choose which game and leagues to track",
        settings: [
          {
            type: "select" as const,
            key: "selected-game" as const,
            label: "Active Game",
            value: settings["selected-game"],
            options: [
              { value: "poe1", label: "Path of Exile 1" },
              { value: "poe2", label: "Path of Exile 2" },
              { value: "both", label: "Both Games" },
            ],
            onChange: (value: string) => updateSetting("selected-game", value),
          },
          {
            type: "text" as const,
            key: "selected-poe1-league" as const,
            label: "Path of Exile 1 League",
            value: settings["selected-poe1-league"],
            placeholder: "e.g., Standard, Affliction",
            onChange: (value: string) =>
              updateSetting("selected-poe1-league", value),
            hidden: settings["selected-game"] === "poe2",
          },
          {
            type: "text" as const,
            key: "selected-poe2-league" as const,
            label: "Path of Exile 2 League",
            value: settings["selected-poe2-league"],
            placeholder: "e.g., Standard, Early Access",
            onChange: (value: string) =>
              updateSetting("selected-poe2-league", value),
            hidden: settings["selected-game"] === "poe1",
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
                if ("hidden" in setting && setting.hidden) return null;

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
                      <label className="label cursor-pointer">
                        <span className="label-text">{setting.label}</span>
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
      </div>
    </div>
  );
};

export default SettingsPage;
