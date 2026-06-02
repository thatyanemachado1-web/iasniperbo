import { createFileRoute } from "@tanstack/react-router";
import { AdminLogsPage } from "@/components/admin/AdminLogsPage";

export const Route = createFileRoute("/app/admin/logs")({
  component: AdminLogsPage,
});
