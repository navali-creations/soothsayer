import fs from "node:fs";
import path from "node:path";

import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const linuxIconDir = path.resolve(
  __dirname,
  "renderer/assets/logo/linux/icons",
);

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: "soothsayer",
    icon: path.resolve(__dirname, "renderer/assets/logo/windows/icon"),
    extraResource: [
      "./renderer/assets/logo",
      "./.forge-staging/poe1",
      "./CHANGELOG.md",
    ],
    ignore: (file: string) => {
      if (!file) return false;
      const keep =
        file.startsWith("/.vite") || file.startsWith("/node_modules");
      return !keep;
    },
  },
  rebuildConfig: {
    force: true,
  },
  hooks: {
    generateAssets: async () => {
      // Copies the entire data/ directory from the navali package into the
      // staging area. This includes prohibited-library-weights.csv which is
      // no longer read at runtime (weight/from_boss now come from the JSON
      // files), but it's only ~30 KB so excluding it isn't worth the
      // complexity of a filtered copy.
      const src = path.resolve(
        __dirname,
        "node_modules/@navali/poe1-divination-cards/data",
      );
      const dest = path.resolve(__dirname, ".forge-staging/poe1");
      fs.cpSync(src, dest, { recursive: true, force: true });
      console.log("[forge] Staged poe1 card data ->", dest);
    },
  },
  makers: [
    new MakerSquirrel({
      name: "soothsayer",
      setupIcon: path.resolve(
        __dirname,
        "renderer/assets/logo/windows/icon.ico",
      ),
      iconUrl:
        "https://raw.githubusercontent.com/navali-creations/soothsayer/master/renderer/assets/logo/windows/icon.ico",
    }),
    new MakerZIP({}, ["darwin"]),
    {
      name: "electron-forge-maker-appimage",
      platforms: ["linux"],
      config: {
        linux: {
          category: "Game",
          icon: linuxIconDir,
        },
      },
    },
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    // Add AutoUnpackNativesPlugin to handle native modules like better-sqlite3
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: "main/main.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "renderer/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "navali-creations",
          name: "soothsayer",
        },
        prerelease: false,
      },
    },
  ],
};

export default config;
