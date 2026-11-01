import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "../modules/settings";
import { parseSettingsSearch } from "../modules/settings/Settings.utils/Settings.utils";

export const Route = createFileRoute("/settings")({
  validateSearch: parseSettingsSearch,
  component: SettingsPage,
});
