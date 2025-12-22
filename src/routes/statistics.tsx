import { createFileRoute } from "@tanstack/react-router";
import StatisticsPage from "../modules/statistics/Statistics.page";

export const Route = createFileRoute("/statistics")({
  component: StatisticsPage,
});
