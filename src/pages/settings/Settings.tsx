import { FiFolder } from "react-icons/fi";
import { Button, Flex } from "../../components";
import { useSettings } from "../../hooks";

const SettingsPage = () => {
  const { settings, loading, updateSetting } = useSettings();

  const handleSelectFile = async (key: "poe-1-path" | "collection-path") => {
    try {
      const filePath = await window.electron.selectFile({
        title:
          key === "poe-1-path"
            ? "Select Path of Exile client.txt"
            : "Select Collection Path",
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

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Settings</h1>

        {/* File Paths Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">File Paths</h2>

            {/* PoE Path */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Path of Exile client.txt</span>
              </label>
              <Flex className="gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  value={settings["poe-1-path"] || ""}
                  readOnly
                  placeholder="No file selected"
                />
                <Button
                  variant="primary"
                  onClick={() => handleSelectFile("poe-1-path")}
                >
                  <FiFolder />
                </Button>
              </Flex>
            </div>

            {/* Collection Path */}
            <div className="form-control w-full">
              <label className="label">
                <span className="label-text">Collection Path</span>
              </label>
              <Flex className="gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  value={settings["collection-path"] || ""}
                  readOnly
                  placeholder="No path selected"
                />
                <Button
                  variant="primary"
                  onClick={() => handleSelectFile("collection-path")}
                >
                  <FiFolder />
                </Button>
              </Flex>
            </div>
          </div>
        </div>

        {/* Application Behavior */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Application Behavior</h2>

            {/* Exit Action */}
            <div className="form-control">
              <label className="label">
                <span className="label-text">When closing the app</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings["app-exit-action"]}
                onChange={(e) =>
                  updateSetting("app-exit-action", e.target.value)
                }
              >
                <option value="exit">Exit application</option>
                <option value="minimize-to-tray">Minimize to tray</option>
              </select>
            </div>

            {/* Open at Login */}
            <div className="form-control">
              <label className="label cursor-pointer">
                <span className="label-text">Open at login</span>
                <input
                  type="checkbox"
                  className="toggle toggle-primary"
                  checked={settings["open-at-login"]}
                  onChange={(e) =>
                    updateSetting("open-at-login", e.target.checked)
                  }
                />
              </label>
            </div>

            {/* Open at Login Minimized */}
            {settings["open-at-login"] && (
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Open at login minimized</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={settings["open-at-login-minimized"]}
                    onChange={(e) =>
                      updateSetting("open-at-login-minimized", e.target.checked)
                    }
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Updates Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Updates</h2>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Release Channel</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings["release-channel"]}
                onChange={(e) =>
                  updateSetting("release-channel", e.target.value)
                }
              >
                <option value="stable">Stable</option>
                <option value="beta">Beta</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
