import { createFileRoute } from "@tanstack/react-router";
import { SessionDetailsPage } from "../modules/session-details";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetailsPage,
});
