import { describe, expect, it } from "vitest";

import {
  LINUX_HELPER_EXECUTABLE_NAME,
  resolvePoeProcessHelperPath,
  WINDOWS_HELPER_EXECUTABLE_NAME,
} from "../PoeProcessHelperPath";

describe("resolvePoeProcessHelperPath", () => {
  it("defaults to the current process platform", () => {
    const configuredPath = "/custom/helper";
    const isSupportedPlatform =
      process.platform === "win32" || process.platform === "linux";

    expect(
      resolvePoeProcessHelperPath({
        env: { SOOTHSAYER_POE_PROCESS_HELPER_PATH: configuredPath },
        pathExists: (candidate) => candidate === configuredPath,
        resourcesPath: null,
      }),
    ).toBe(isSupportedPlatform ? configuredPath : null);
  });

  it("prefers the development override", () => {
    const configuredPath = "C:\\custom\\helper.exe";

    expect(
      resolvePoeProcessHelperPath({
        env: { SOOTHSAYER_POE_PROCESS_HELPER_PATH: configuredPath },
        pathExists: (candidate) => candidate === configuredPath,
        platform: "win32",
        resourcesPath: "C:\\resources",
      }),
    ).toBe(configuredPath);
  });

  it("resolves the packaged resource and ignores development overrides", () => {
    const expected = `C:\\resources\\poe-process-helper\\${WINDOWS_HELPER_EXECUTABLE_NAME}`;

    expect(
      resolvePoeProcessHelperPath({
        env: {
          SOOTHSAYER_POE_PROCESS_HELPER_PATH: "C:\\custom\\helper.exe",
        },
        isPackaged: true,
        pathExists: (candidate) => candidate === expected,
        platform: "win32",
        resourcesPath: "C:\\resources",
      }),
    ).toBe(expected);
  });

  it("resolves the packaged Linux helper without a file extension", () => {
    const expected = `/opt/soothsayer/resources/poe-process-helper/${LINUX_HELPER_EXECUTABLE_NAME}`;

    expect(
      resolvePoeProcessHelperPath({
        env: {},
        isPackaged: true,
        pathExists: (candidate) => candidate === expected,
        platform: "linux",
        resourcesPath: "/opt/soothsayer/resources",
      }),
    ).toBe(expected);
  });

  it("does not resolve a helper on unsupported platforms", () => {
    expect(
      resolvePoeProcessHelperPath({
        env: { SOOTHSAYER_POE_PROCESS_HELPER_PATH: "/custom/helper" },
        pathExists: () => true,
        platform: "darwin",
      }),
    ).toBeNull();
  });

  it("returns null when no candidate exists", () => {
    expect(
      resolvePoeProcessHelperPath({
        env: {},
        pathExists: () => false,
        platform: "win32",
        resourcesPath: null,
      }),
    ).toBeNull();
  });

  it("resolves the unpackaged resource and helpers/bin candidates", () => {
    const resourcePath = `C:\\app\\resources\\poe-process-helper\\${WINDOWS_HELPER_EXECUTABLE_NAME}`;
    expect(
      resolvePoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {},
        pathExists: (candidate) => candidate === resourcePath,
        platform: "win32",
        resourcesPath: "C:\\app\\resources",
      }),
    ).toBe(resourcePath);

    const developmentPath = `C:\\repo\\helpers\\bin\\poe-process-helper\\${WINDOWS_HELPER_EXECUTABLE_NAME}`;
    expect(
      resolvePoeProcessHelperPath({
        cwd: "C:\\repo",
        env: {},
        pathExists: (candidate) => candidate === developmentPath,
        platform: "win32",
        resourcesPath: null,
      }),
    ).toBe(developmentPath);
  });

  it("uses filesystem lookup when no path checker is provided", () => {
    expect(
      resolvePoeProcessHelperPath({
        cwd: "C:\\definitely-missing-soothsayer-repo",
        env: {},
        platform: "win32",
        resourcesPath: null,
      }),
    ).toBeNull();
  });

  it("reads Electron resourcesPath when the caller omits it", () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      process,
      "resourcesPath",
    );
    const resourcesPath = "C:\\app\\resources";
    const expectedPath = `${resourcesPath}\\poe-process-helper\\${WINDOWS_HELPER_EXECUTABLE_NAME}`;

    try {
      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: resourcesPath,
      });
      expect(
        resolvePoeProcessHelperPath({
          cwd: "C:\\repo",
          env: {},
          pathExists: (candidate) => candidate === expectedPath,
          platform: "win32",
        }),
      ).toBe(expectedPath);

      Object.defineProperty(process, "resourcesPath", {
        configurable: true,
        value: "",
      });
      expect(
        resolvePoeProcessHelperPath({
          cwd: "C:\\repo",
          env: {},
          pathExists: () => false,
          platform: "win32",
        }),
      ).toBeNull();
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process, "resourcesPath", originalDescriptor);
      } else {
        Reflect.deleteProperty(process, "resourcesPath");
      }
    }
  });

  it("does not use development paths in packaged runtime", () => {
    const configuredPath = "D:\\helpers\\custom-helper.exe";
    const developmentPath = `C:\\repo\\helpers\\bin\\poe-process-helper\\${WINDOWS_HELPER_EXECUTABLE_NAME}`;
    const pathExists = vi.fn(
      (candidate: string) =>
        candidate === configuredPath || candidate === developmentPath,
    );

    expect(
      resolvePoeProcessHelperPath({
        cwd: "C:\\repo",
        env: { SOOTHSAYER_POE_PROCESS_HELPER_PATH: configuredPath },
        isPackaged: true,
        pathExists,
        platform: "win32",
        resourcesPath: null,
      }),
    ).toBeNull();
  });
});
