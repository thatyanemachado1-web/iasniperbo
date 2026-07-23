import { createFileRoute } from "@tanstack/react-router";
import DashboardPage from "@/components/dashboard/DashboardPage";

export const Route = createFileRoute("/app/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return <DashboardPage />;
}
