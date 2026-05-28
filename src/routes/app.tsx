import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = readUserSession();
  const isAdminRoute = pathname.startsWith("/app/admin");

  useEffect(() => {
    if (!session.email && !isAdminRoute) {
      navigate({ to: "/" });
    }
  }, [isAdminRoute, navigate, session.email]);

  if (!session.email && !isAdminRoute) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
