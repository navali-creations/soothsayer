import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "../modules/sessions";

export const Route = createFileRoute("/sessions/")({
  component: SessionsPage,
});
