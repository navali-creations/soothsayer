import { createFileRoute } from "@tanstack/react-router";

import { AttributionsPage } from "../modules/attributions";

export const Route = createFileRoute("/attributions")({
  component: AttributionsPage,
});
