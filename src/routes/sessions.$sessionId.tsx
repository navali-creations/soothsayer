import { createFileRoute } from "@tanstack/react-router";
import SessionDetailPage from "../pages/sessions/details/SessionDetailPage";

export const Route = createFileRoute("/sessions/$sessionId")({
  component: SessionDetailPage,
});
