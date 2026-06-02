import { createFileRoute } from "@tanstack/react-router";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export const Route = createFileRoute("/app/admin/users")({
  component: AdminUsersPage,
});
