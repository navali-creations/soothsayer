import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/cards")({
  component: () => <Outlet />,
});
