import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "../modules/settings";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
