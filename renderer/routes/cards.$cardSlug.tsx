import { createFileRoute } from "@tanstack/react-router";

import { CardDetailsPage } from "../modules/card-details";

export const Route = createFileRoute("/cards/$cardSlug")({
  component: CardDetailsPage,
});
