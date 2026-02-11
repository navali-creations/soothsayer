import { Beacons } from "@repere/react";
import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useRef, useState } from "react";

import { useBoundStore } from "~/renderer/store";

import { AppMenu } from "../modules/app-menu";
import { onboardingConfig } from "../modules/onboarding";
import { Sidebar } from "../modules/sidebar";
import "@repere/react/styles.css";

const RootLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const {
    hydrate,
    startListeners,
    setup: { isSetupComplete, setupState },
  } = useBoundStore();

  useEffect(() => {
    // Hydrate all data on app mount
    slowTimerRef.current = setTimeout(() => setIsSlow(true), 5000);

    const initialize = async () => {
      try {
        await hydrate();

        // Check if setup is complete after hydration
        const setupComplete = isSetupComplete();

        if (!setupComplete) {
          // Redirect to setup if not complete
          navigate({ to: "/setup" });
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        clearTimeout(slowTimerRef.current);
        setIsHydrating(false);
      }
    };

    initialize();

    // Start listeners for real-time updates
    const cleanup = startListeners();
    return cleanup;
  }, [hydrate, startListeners, navigate, isSetupComplete]);

  const isSetupMode = !setupState?.isComplete;

  if (isHydrating) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-300">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-base-content/70 text-sm">Loading Soothsayer...</p>
          {isSlow && (
            <p className="text-base-content/50 text-xs mt-2">
              This is taking longer than usual. Hang tight...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppMenu />
      <div className="flex flex-1 overflow-hidden">
        {/* Only show sidebar when setup is complete */}
        {!isSetupMode && <Sidebar />}
        <main className="flex-1 overflow-auto relative z-0">
          <Outlet />
        </main>
      </div>
      {!isSetupMode && (
        <Beacons
          config={onboardingConfig}
          currentPath={location.pathname}
          enabled={!isHydrating}
        />
      )}
      <TanStackRouterDevtools />
    </div>
  );
};

export const Route = createRootRoute({ component: RootLayout });
