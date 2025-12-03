import { createFileRoute } from "@tanstack/react-router";
import SetupPage from "../pages/setup/Setup";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});
