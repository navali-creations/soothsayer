import { defineConfig } from "vite";

import { getMainAliases } from "./vite.shared.config.mts";

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: getMainAliases(),
  },
});
