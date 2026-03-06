import { resolve } from "node:path";

import { defineConfig } from "vite";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "~/main": resolve(__dirname, "./main"),
      "~/types": resolve(__dirname, "./types"),
      "~/enums": resolve(__dirname, "./enums"),
    },
  },
});
