import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { SetupPage } from "~/renderer/modules/setup";
import { useBoundStore } from "~/renderer/store";

const SetupRoute = () => {
  const navigate = useNavigate();
  const {
    setup: { setupState },
  } = useBoundStore();

  const isComplete = setupState?.isComplete ?? false;

  useEffect(() => {
    // If setup is already complete, redirect to home
    if (isComplete) {
      navigate({ to: "/current-session" });
    }
  }, [isComplete, navigate]);

  return <SetupPage />;
};

export const Route = createFileRoute("/setup")({ component: SetupRoute });
