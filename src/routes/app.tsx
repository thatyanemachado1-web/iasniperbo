import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { getSalesSettings, refreshAccessSession } from "@/lib/accessApi";
import { hasFullAccess, isAdminOwnerEmail, readUserSession, type UserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app")({
  component: ProtectedAppRoute,
});

function ProtectedAppRoute() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [session, setSession] = useState<UserSession | null>(null);
  const [salesClosed, setSalesClosed] = useState(false);
  const isBooting = session === null;
  const isAdminRoute = pathname.startsWith("/app/admin");
  const isAccountRoute = pathname.startsWith("/app/conta");
  const isCheckoutRoute =
    pathname.startsWith("/app/planos") ||
    pathname.startsWith("/app/assinatura") ||
    pathname.startsWith("/app/pagamentos");
  const isOwner = session ? isAdminOwnerEmail(session.email) : false;
  const hasBackendSession = Boolean(session?.clientToken);
  const isAdminUser = Boolean(
    session && hasBackendSession && (session.role === "admin" || session.role === "owner" || isOwner),
  );
  const fullAccess = Boolean(session && hasBackendSession && hasFullAccess(session));
  const canOpenApp = Boolean(session && hasBackendSession && session.registered);
  const demoExpired = Boolean(session && session.accessMode === "demo" && isExpiredAt(session.expiresAt));
  const canOpenDashboard =
    Boolean(
    hasBackendSession &&
      session &&
      (fullAccess ||
        (session.accessMode === "demo" && !demoExpired) ||
        (session.registered && session.accessMode === "pending")),
    );

  useEffect(() => {
    setSession(readUserSession());
  }, []);

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
    if (!session) return;
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
    session,
  ]);

  useEffect(() => {
    if (!session) return;
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
        // Keep the current app session stable; protected APIs still reject invalid tokens.
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

  if (isBooting) return <AppBootSplash />;
  if (!isAdminRoute && salesClosed && !fullAccess && !isAdminUser) return null;
  if (!isAdminRoute && (!session.email || !canOpenApp)) return null;
  if (!isAdminRoute && !canOpenDashboard && !isCheckoutRoute && !isAccountRoute) return null;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AppBootSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#030712] px-6 text-center">
      <img
        src="/assets/sniper-logo.png"
        alt="SNIPER BO IA"
        className="h-auto w-36 max-w-[70vw] opacity-95"
      />
      <div className="mt-5 max-w-xs text-[11px] text-muted-foreground/80">
        <p>Carregando painel...</p>
        <a
          href="/app?reload=1"
          className="mt-3 inline-flex rounded-full border border-neon-cyan/25 px-4 py-1.5 font-bold text-neon-cyan/90"
        >
          Recarregar app
        </a>
      </div>
    </div>
  );
}

function isExpiredAt(value: string) {
  if (!value) return false;
  const expires = Date.parse(value);
  return Number.isFinite(expires) && expires <= Date.now();
}

