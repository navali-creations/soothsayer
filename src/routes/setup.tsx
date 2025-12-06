import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SetupPage } from "../pages/setup/Setup";
import { useBoundStore } from "../store/store";

const SetupRoute = () => {
  const navigate = useNavigate();
  const isSetupComplete = useBoundStore((state) => state.isSetupComplete);

  useEffect(() => {
    // If setup is already complete, redirect to home
    if (isSetupComplete()) {
      navigate({ to: "/" });
    }
  }, [isSetupComplete, navigate]);

  return <SetupPage />;
};

export const Route = createFileRoute("/setup")({ component: SetupRoute });
