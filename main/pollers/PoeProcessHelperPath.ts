import { existsSync } from "node:fs";
import { posix, win32 } from "node:path";

import helperManifest from "../../helpers/poe-process-helper/helper-manifest.json";

type PathExists = (path: string) => boolean;

const HELPER_PATH_ENV_VAR = "SOOTHSAYER_POE_PROCESS_HELPER_PATH";
const HELPER_PROCESS_TITLE = helperManifest.processTitle;
const HELPER_RESOURCE_DIR = helperManifest.resourceDirectory;
const LINUX_HELPER_EXECUTABLE_NAME = helperManifest.executableName;
const WINDOWS_HELPER_EXECUTABLE_NAME = `${helperManifest.executableName}.exe`;

interface ResolvePoeProcessHelperPathOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  isPackaged?: boolean;
  pathExists?: PathExists;
  platform?: NodeJS.Platform;
  resourcesPath?: string | null;
}

function resolvePoeProcessHelperPath(
  options: ResolvePoeProcessHelperPathOptions = {},
): string | null {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32" && platform !== "linux") {
    return null;
  }

  const pathExists = options.pathExists ?? existsSync;
  const env = options.env ?? process.env;
  const pathApi = platform === "win32" ? win32 : posix;
  const executableName =
    platform === "win32"
      ? WINDOWS_HELPER_EXECUTABLE_NAME
      : LINUX_HELPER_EXECUTABLE_NAME;
  const developmentPathsAllowed = options.isPackaged !== true;
  const candidates: string[] = [];
  const configuredPath = env[HELPER_PATH_ENV_VAR]?.trim();
  if (configuredPath && developmentPathsAllowed) {
    candidates.push(configuredPath);
  }

  const resourcesPath =
    options.resourcesPath === undefined
      ? resolveProcessResourcesPath()
      : options.resourcesPath;
  if (resourcesPath) {
    candidates.push(
      pathApi.join(resourcesPath, HELPER_RESOURCE_DIR, executableName),
    );
  }

  if (developmentPathsAllowed) {
    const cwd = options.cwd ?? process.cwd();
    candidates.push(
      pathApi.join(cwd, "helpers", "bin", HELPER_RESOURCE_DIR, executableName),
      pathApi.join(
        cwd,
        "helpers",
        "poe-process-helper",
        "target",
        "release",
        executableName,
      ),
      pathApi.join(
        cwd,
        "helpers",
        "poe-process-helper",
        "target",
        "debug",
        executableName,
      ),
    );
  }

  return candidates.find((candidate) => pathExists(candidate)) ?? null;
}

function resolveProcessResourcesPath(): string | null {
  const resourcesPath = Reflect.get(process, "resourcesPath");

  return typeof resourcesPath === "string" && resourcesPath.length > 0
    ? resourcesPath
    : null;
}

export type { PathExists, ResolvePoeProcessHelperPathOptions };
export {
  HELPER_PROCESS_TITLE,
  HELPER_RESOURCE_DIR,
  LINUX_HELPER_EXECUTABLE_NAME,
  resolvePoeProcessHelperPath,
  WINDOWS_HELPER_EXECUTABLE_NAME,
};
