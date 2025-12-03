import { createFileRoute, Outlet } from "@tanstack/react-router";

const SessionsLayout = () => {
  return <Outlet />;
};

export const Route = createFileRoute("/sessions")({
  component: SessionsLayout,
});
