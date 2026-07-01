import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AccessApiError, getSalesSettings, refreshAccessSession } from "@/lib/accessApi";
import {
  clearUserSession,
  hasFullAccess,
  isAdminOwnerEmail,
  readUserSession,
  type UserSession,
} from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

const EMPTY_ROUTE_SESSION: UserSession = {
  email: "",
  name: "Usuario",
  role: "user",
  accessMode: "none",
  accessStatus: "none",
  plan: "free",
  expiresAt: "",
  registered: false,
  approved: false,
  clientToken: "",
};
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<UserSession>(EMPTY_ROUTE_SESSION);
  const [salesClosed, setSalesClosed] = useState(false);
  const isAdminRoute = pathname.startsWith("/app/admin");
  const isAccountRoute = pathname.startsWith("/app/conta");
  const isCheckoutRoute =
    pathname.startsWith("/app/planos") ||
    pathname.startsWith("/app/assinatura") ||
    pathname.startsWith("/app/pagamentos");
  const isOwner = isAdminOwnerEmail(session.email);
  const hasBackendSession = Boolean(session.clientToken);
  const isAdminUser = hasBackendSession && (session.role === "admin" || session.role === "owner" || isOwner);
  const fullAccess = hasBackendSession && hasFullAccess(session);
  const canOpenApp = hasBackendSession && session.registered;
  const demoExpired = session.accessMode === "demo" && isExpiredAt(session.expiresAt);
  const canOpenDashboard =
    hasBackendSession &&
    (fullAccess ||
      (session.accessMode === "demo" && !demoExpired) ||
      (session.registered && session.accessMode === "pending"));

  useIsomorphicLayoutEffect(() => {
    setSession(readUserSession());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
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
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
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
    mounted,
  ]);

  useEffect(() => {
    if (!mounted) return;
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

        if (changed) setSession(readUserSession());
      } catch (error) {
        if (shouldClearSessionAfterRefreshError(error)) {
          clearUserSession();
          if (!stopped) setSession(EMPTY_ROUTE_SESSION);
        }
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
  }, [isAdminRoute, isOwner, mounted]);

  if (!mounted) return <AppRouteLoading />;
  if (!isAdminRoute && salesClosed && !fullAccess && !isAdminUser) return null;
  if (!isAdminRoute && (!session.email || !canOpenApp)) return null;
  if (!isAdminRoute && !canOpenDashboard && !isCheckoutRoute && !isAccountRoute) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppRouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-app px-5 text-center text-foreground">
      <div className="rounded-2xl border border-neon-cyan/25 bg-background/70 px-5 py-4 shadow-[0_0_28px_rgba(0,229,255,0.12)]">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-neon-cyan">
          Carregando painel
        </div>
      </div>
    </div>
  );
}

function isExpiredAt(value: string) {
  if (!value) return false;
  const expires = Date.parse(value);
  return Number.isFinite(expires) && expires <= Date.now();
}

function shouldClearSessionAfterRefreshError(error: unknown) {
  if (error instanceof AccessApiError) {
    return error.status === 401 || error.status === 403;
  }
  return false;
}
