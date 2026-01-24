import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useBoundStore } from "~/renderer/store";

import { SetupPage } from "../pages/setup/Setup";

const SetupRoute = () => {
  const navigate = useNavigate();
  const { isSetupComplete } = useBoundStore();

  useEffect(() => {
    // If setup is already complete, redirect to home
    if (isSetupComplete()) {
      navigate({ to: "/" });
    }
  }, [isSetupComplete, navigate]);

  return <SetupPage />;
};

export const Route = createFileRoute("/setup")({ component: SetupRoute });
