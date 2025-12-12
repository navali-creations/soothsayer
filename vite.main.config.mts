import { defineConfig } from "vite";
import { externalizeDeps } from "vite-plugin-externalize-deps";

export default defineConfig({
  build: {
    rollupOptions: {
      plugins: [externalizeDeps()],
      external: [
        // Native modules
        "better-sqlite3",
      ],
      output: {
        format: "cjs",
      },
    },
    // Ensure source maps work in development
    sourcemap: true,
  },
  resolve: {
    // Some libs that can run in both Web and Node.js envs
    // will export different bundles based on this
    mainFields: ["module", "jsnext:main", "jsnext"],
  },
});
