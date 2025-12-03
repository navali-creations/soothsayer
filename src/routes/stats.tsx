import { createFileRoute } from "@tanstack/react-router";
import StatsPage from "../pages/Stats/Stats";

export const Route = createFileRoute("/stats")({
  component: StatsPage,
});
