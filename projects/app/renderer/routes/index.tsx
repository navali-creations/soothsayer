import { createFileRoute } from "@tanstack/react-router";
import CurrentSessionPage from "../modules/current-session/CurrentSession.page";

export const Route = createFileRoute("/")({
  component: CurrentSessionPage,
});
