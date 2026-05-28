import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { hasFullAccess, isAdminOwnerEmail, readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = readUserSession();
  const isAdminRoute = pathname.startsWith("/app/admin");
  const isAccountRoute = pathname.startsWith("/app/conta");
  const isCheckoutRoute = pathname.startsWith("/app/planos");
  const isOwner = isAdminOwnerEmail(session.email);
  const canOpenApp = session.registered || isOwner;
  const canOpenDashboard =
    hasFullAccess(session) ||
    session.accessMode === "demo" ||
    (session.registered && session.accessMode === "pending");

  useEffect(() => {
    if (isAdminRoute) return;
    if (!session.email || !canOpenApp) {
      navigate({ to: "/" });
      return;
    }
    if (!canOpenDashboard && !isCheckoutRoute && !isAccountRoute) {
      navigate({ to: "/app/planos" });
    }
  }, [
    canOpenApp,
    canOpenDashboard,
    isAccountRoute,
    isAdminRoute,
    isCheckoutRoute,
    navigate,
    session.email,
  ]);

  if (!isAdminRoute && (!session.email || !canOpenApp)) return null;
  if (!isAdminRoute && !canOpenDashboard && !isCheckoutRoute && !isAccountRoute) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
