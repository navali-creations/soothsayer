import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { SetupPage } from "~/renderer/modules/setup";
import { useSetup } from "~/renderer/store";

const SetupRoute = () => {
  const navigate = useNavigate();
  const { setupState } = useSetup();

  const isComplete = setupState?.isComplete ?? false;

  useEffect(() => {
    // If setup is already complete, redirect to home
    if (isComplete) {
      navigate({ to: "/" });
    }
  }, [isComplete, navigate]);

  return <SetupPage />;
};

export const Route = createFileRoute("/setup")({ component: SetupRoute });
