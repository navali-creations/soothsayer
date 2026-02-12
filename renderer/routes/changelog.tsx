import { createFileRoute } from "@tanstack/react-router";

import { ChangelogPage } from "../modules/changelog";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});
