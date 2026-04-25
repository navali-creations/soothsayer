import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect, useRef, useState } from "react";

import BackfillBanner from "~/renderer/modules/app-menu/AppMenu.component/BackfillBanner/BackfillBanner";
import { BeaconHost } from "~/renderer/modules/onboarding";
import { useCommunityUpload, useRootActions, useSetup } from "~/renderer/store";
import { cardNameToSlug } from "~/renderer/utils";

import { AppMenu } from "../modules/app-menu";
import { Sidebar } from "../modules/sidebar";
import "@repere/react/styles.css";

const RootLayout = () => {
  const navigate = useNavigate();
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { hydrate, startListeners } = useRootActions();
  const { isSetupComplete, setupState } = useSetup();
  const { checkBackfill } = useCommunityUpload();

  useEffect(() => {
    slowTimerRef.current = setTimeout(() => setIsSlow(true), 5000);

    const initialize = async () => {
      try {
        await hydrate();

        const setupComplete = isSetupComplete();

        if (!setupComplete) {
          await navigate({ to: "/setup" });
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        clearTimeout(slowTimerRef.current);
        setIsHydrating(false);
      }
    };

    initialize();

    const cleanup = startListeners();
    return cleanup;
  }, [hydrate, startListeners, navigate, isSetupComplete]);

  useEffect(() => {
    if (!isHydrating && setupState?.isComplete) {
      checkBackfill();
    }
  }, [isHydrating, setupState?.isComplete, checkBackfill]);

  useEffect(() => {
    if (!window.electron?.cardDetails?.onNavigateToCard) return;

    const cleanup = window.electron.cardDetails.onNavigateToCard(
      (cardName: string) => {
        const cardSlug = cardNameToSlug(cardName);
        navigate({ to: "/cards/$cardSlug", params: { cardSlug } });
      },
    );

    return cleanup;
  }, [navigate]);

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
      {!isSetupMode && <BackfillBanner />}
      <div className="flex flex-1 overflow-hidden">
        {!isSetupMode && <Sidebar />}
        <main className="flex-1 overflow-auto relative z-0">
          <Outlet />
        </main>
      </div>
      {!isSetupMode && <BeaconHost enabled={!isHydrating} />}
      {/*<TanStackRouterDevtools />*/}
    </div>
  );
};

export const Route = createRootRoute({ component: RootLayout });
