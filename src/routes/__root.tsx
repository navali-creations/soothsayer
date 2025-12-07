import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { AppMenu, Sidebar } from "../components";
import { useBoundStore } from "../store/store";

const RootLayout = () => {
  const navigate = useNavigate();
  const [isHydrating, setIsHydrating] = useState(true);
  const hydrate = useBoundStore((state) => state.hydrate);
  const startListeners = useBoundStore((state) => state.startListeners);
  const isSetupComplete = useBoundStore((state) => state.isSetupComplete);
  const setupState = useBoundStore((state) => state.setupState);

  useEffect(() => {
    // Hydrate all data on app mount
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
        setIsHydrating(false);
      }
    };

    initialize();

    // Start listeners for real-time updates
    const cleanup = startListeners();
    return cleanup;
  }, [hydrate, startListeners, navigate, isSetupComplete]);

  // Show loading screen while hydrating
  if (isHydrating) {
    return (
      <div className="flex items-center justify-center h-screen bg-base-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        </div>
      </div>
    );
  }

  // If setup is not complete, only show the setup page (no sidebar/menu)
  if (!setupState?.isComplete) {
    return <Outlet />;
  }

  // Normal layout with sidebar and menu
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <AppMenu />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </div>
  );
};

export const Route = createRootRoute({ component: RootLayout });
