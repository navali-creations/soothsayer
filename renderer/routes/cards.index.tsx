import { createFileRoute } from "@tanstack/react-router";

import { CardsPage } from "../modules/cards";

export const Route = createFileRoute("/cards/")({
  component: CardsPage,
});
