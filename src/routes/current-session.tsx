import { createFileRoute } from "@tanstack/react-router";
import CurrentSessionPage from "../pages/current-session/CurrentSession";

export const Route = createFileRoute("/current-session")({
  component: CurrentSessionPage,
});
