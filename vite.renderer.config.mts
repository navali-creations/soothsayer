import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { getRendererAliases } from "./vite.shared.config.mts";

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./renderer/routes",
      generatedRouteTree: "./renderer/routeTree.gen.ts",
    }),
    react(),
    // Tailwind and Vite normally run separate Lightning CSS optimization
    // passes. Both must bypass Lightning CSS until it can parse the anchored
    // fallback queries used by app tooltips. Keep this paired with
    // build.cssMinify below.
    tailwindcss({ optimize: false }),
  ],
  resolve: {
    alias: getRendererAliases(),
  },
  server: {
    watch: {
      ignored: ["**/node_modules/@navali/**"],
    },
  },
  build: {
    // Use esbuild for Vite's optimization pass while Tailwind's pass is
    // disabled above, preserving minification without parsing those queries.
    cssMinify: "esbuild",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        overlay: resolve(import.meta.dirname, "overlay.html"),
      },
    },
  },
});
