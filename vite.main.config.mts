import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";

const supabaseTarget =
  process.env.SOOTHSAYER_SUPABASE_TARGET === "local"
    ? "local"
    : "production";
const supabaseEnvFile =
  supabaseTarget === "local" ? ".env.supabase.local" : ".env";
const supabaseEnvPath = resolve(__dirname, supabaseEnvFile);
const fileEnv = existsSync(supabaseEnvPath)
  ? parseEnv(readFileSync(supabaseEnvPath, "utf8"))
  : {};

function getSupabaseEnv(name: string): string {
  const value =
    supabaseTarget === "local"
      ? (fileEnv[name] ?? process.env[name])
      : (process.env[name] ?? fileEnv[name]);
  return value?.trim() ?? "";
}

const supabaseEnv = {
  VITE_SUPABASE_URL: getSupabaseEnv("VITE_SUPABASE_URL"),
  VITE_SUPABASE_PUBLISHABLE_KEY: getSupabaseEnv(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
  ),
  VITE_SUPABASE_ANON_KEY: getSupabaseEnv("VITE_SUPABASE_ANON_KEY"),
};

const { version } = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
);

export default defineConfig({
  define: Object.fromEntries(
    Object.entries(supabaseEnv).map(([name, value]) => [
      `import.meta.env.${name}`,
      JSON.stringify(value),
    ]),
  ),
  resolve: {
    alias: {
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/main": resolve(__dirname, "./main"),
      "~/types": resolve(__dirname, "./types"),
      "~/enums": resolve(__dirname, "./enums"),
      "@types": resolve(__dirname, "./types"),
      "@enums": resolve(__dirname, "./enums"),
    },
    // Some libs that can run in both Web and Node.js envs
    // will export different bundles based on this
    mainFields: ["module", "jsnext:main", "jsnext"],
  },

  build: {
    rollupOptions: {
      external: [
        // Native modules
        "better-sqlite3",
        // tslib uses a global exporter pattern that Rolldown's __commonJSMin
        // wrapper can't handle — keep it external so it's require()'d at runtime
        "tslib",
      ],
      output: {
        format: "cjs",
      },
    },
    // Ensure source maps work in development
    sourcemap: true,
  },

  plugins: [
    sentryVitePlugin({
      org: "navali-creations",
      project: "electron",
      release: {
        name: `soothsayer@${version}`,
      },
    }),
  ],
});
