import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSalesSettings, refreshAccessSession } from "@/lib/accessApi";
import { hasFullAccess, isAdminOwnerEmail, readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = readUserSession();
  const [salesClosed, setSalesClosed] = useState(false);
  const isAdminRoute = pathname.startsWith("/app/admin");
  const isAccountRoute = pathname.startsWith("/app/conta");
  const isCheckoutRoute =
    pathname.startsWith("/app/planos") ||
    pathname.startsWith("/app/assinatura") ||
    pathname.startsWith("/app/pagamentos");
  const isOwner = isAdminOwnerEmail(session.email);
  const isAdminUser = session.role === "admin" || session.role === "owner" || isOwner;
  const fullAccess = hasFullAccess(session);
  const canOpenApp = session.registered || isOwner;
  const demoExpired = session.accessMode === "demo" && isExpiredAt(session.expiresAt);
  const canOpenDashboard =
    fullAccess ||
    (session.accessMode === "demo" && !demoExpired) ||
    (session.registered && session.accessMode === "pending");

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isAdminRoute) return;
    if (salesClosed && !fullAccess && !isAdminUser) {
      navigate({ to: "/" });
      return;
    }
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
    demoExpired,
    fullAccess,
    isAccountRoute,
    isAdminUser,
    isAdminRoute,
    isCheckoutRoute,
    navigate,
    salesClosed,
    session.email,
  ]);

  useEffect(() => {
    if (isAdminRoute || isOwner) return;

    let stopped = false;
    let refreshing = false;

    async function refreshSession() {
      const current = readUserSession();
      if (!current.clientToken || refreshing) return;

      refreshing = true;
      try {
        const before = {
          accessMode: current.accessMode,
          accessStatus: current.accessStatus,
          approved: current.approved,
          plan: current.plan,
          expiresAt: current.expiresAt,
        };
        const access = await refreshAccessSession();
        if (!access || stopped) return;

        const changed =
          before.accessMode !== access.access_mode ||
          before.accessStatus !== access.access_status ||
          before.approved !== access.approved ||
          before.plan !== access.plan ||
          before.expiresAt !== access.expires_at;

        if (changed) {
          window.location.reload();
        }
      } catch {
        // Keep the current local session if the lightweight refresh fails.
      } finally {
        refreshing = false;
      }
    }

    refreshSession();
    const interval = window.setInterval(refreshSession, 30_000);
    window.addEventListener("focus", refreshSession);

    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshSession);
    };
  }, [isAdminRoute, isOwner]);

  if (!isAdminRoute && salesClosed && !fullAccess && !isAdminUser) return null;
  if (!isAdminRoute && (!session.email || !canOpenApp)) return null;
  if (!isAdminRoute && !canOpenDashboard && !isCheckoutRoute && !isAccountRoute) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function isExpiredAt(value: string) {
  if (!value) return false;
  const expires = Date.parse(value);
  return Number.isFinite(expires) && expires <= Date.now();
}
