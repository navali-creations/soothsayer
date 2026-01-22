import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

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
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "~/renderer/assets": resolve(__dirname, "./renderer/assets"),
      "~/renderer/components": resolve(__dirname, "./renderer/components"),
      "~/renderer/hooks": resolve(__dirname, "./renderer/hooks"),
      "~/renderer/modules": resolve(__dirname, "./renderer/modules"),
      "~/renderer/routes": resolve(__dirname, "./renderer/routes"),
      "~/renderer/store": resolve(__dirname, "./renderer/store"),
      "~/renderer": resolve(__dirname, "./renderer"),
      "~/electron": resolve(__dirname, "./electron"),
      "~types": resolve(__dirname, "./types"),
      "~enums": resolve(__dirname, "./enums"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        overlay: resolve(__dirname, "overlay.html"),
      },
    },
  },
});
