import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { initUmami, trackPageView } from "~/renderer/modules/umami";

import { initSentry } from "./sentry";
import "./index.css";

// Read telemetry settings before initializing Sentry and Umami.
// Settings are fetched via IPC from the main process (which reads from SQLite).
// We gate both behind user preference — existing users default to disabled,
// new users choose during setup wizard step 4.
async function initTelemetry() {
  try {
    const settings = await window.electron.settings.getAll();
    initSentry(settings.telemetryCrashReporting);
    initUmami(settings.telemetryUsageAnalytics);
  } catch (error) {
    // If settings can't be loaded (e.g. DB not ready), skip telemetry.
    // PII scrubbing in beforeSend/beforeBreadcrumb protects against leaks
    // even if Sentry were to initialize.
    console.warn(
      "[Renderer] Could not load telemetry settings, skipping telemetry init:",
      error,
    );
  }
}

initTelemetry();

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Use hash history for Electron (file:// protocol doesn't support browser history)
const hashHistory = createHashHistory();

// Create a new router instance
const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 5_000,
});

// Track page views with Umami (only when path actually changes)
router.subscribe("onResolved", ({ toLocation, pathChanged, fromLocation }) => {
  // Track if path changed, or if it's the initial load (no fromLocation)
  if (pathChanged || !fromLocation) {
    trackPageView(toLocation.pathname);
  }
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    // <StrictMode>
    <RouterProvider router={router} />,
    // </StrictMode>,
  );
}
