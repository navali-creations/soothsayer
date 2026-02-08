import {
  createHashHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import ReactDOM from "react-dom/client";

import { initUmami, trackPageView } from "~/renderer/modules/umami";

import { initSentry } from "./sentry";
import "./index.css";

initSentry();
initUmami();

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Use hash history for Electron (file:// protocol doesn't support browser history)
const hashHistory = createHashHistory();

// Create a new router instance
const router = createRouter({
  routeTree,
  history: hashHistory,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
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
