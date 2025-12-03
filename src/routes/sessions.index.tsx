import { createFileRoute } from "@tanstack/react-router";
import SessionsPage from "../pages/sessions/Sessions";

export const Route = createFileRoute("/sessions/")({
  component: SessionsPage,
});
