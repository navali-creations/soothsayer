import { createFileRoute } from "@tanstack/react-router";
import SettingsPage from "../pages/settings/Settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
