import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Brain, Mic, Crown, User, Bell, Settings, ShieldCheck, ReceiptText } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { canSeeAdminUi } from "@/lib/adminSession";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import type { ReactNode } from "react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/voz", label: "Voz", icon: Mic },
  { to: "/app/ia", label: "Assistente IA", icon: Brain },
  { to: "/app/planos", label: "Assinar", icon: Crown },
  { to: "/app/assinatura", label: "Assinatura", icon: ReceiptText },
  { to: "/app/conta", label: "Conta", icon: User },
] as const;

const adminNavItem = { to: "/app/admin/users", label: "ADM", icon: ShieldCheck } as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const userSession = readUserSession();
  const canSeeAdmin = canSeeAdminUi();
  const fullAccess = hasFullAccess(userSession);
  const visibleNavItems = fullAccess ? navItems.filter((item) => item.to !== "/app/planos") : navItems;
  const mobileNavItems = canSeeAdmin ? [...visibleNavItems, adminNavItem] : visibleNavItems;
  const mobileGridClass =
    mobileNavItems.length >= 7 ? "grid-cols-7" : mobileNavItems.length === 6 ? "grid-cols-6" : "grid-cols-5";

  return (
    <div className="min-h-screen bg-app text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size={32} />
          </div>
          <div className="flex items-center gap-2">
            <button className="size-9 rounded-xl glass flex items-center justify-center hover:glow-blue">
              <Bell className="size-4 text-neon-cyan" />
            </button>
            <div className="group relative">
              <button
                type="button"
                className="size-9 rounded-xl btn-primary-grad flex items-center justify-center"
                aria-label="Abrir opções da conta"
              >
                <User className="size-4" />
              </button>
              <div className="invisible absolute right-0 top-11 z-40 w-44 translate-y-1 rounded-xl border border-border/70 bg-background/95 p-1.5 opacity-0 shadow-2xl backdrop-blur-xl transition group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                <Link
                  to="/app/conta"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                >
                  <User className="size-4" /> Conta
                </Link>
                {canSeeAdmin && (
                  <Link
                    to="/app/admin/users"
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-neon-cyan hover:bg-neon-cyan/10"
                  >
                    <Settings className="size-4" /> ADM
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] border-r border-border/60 px-3 py-5">
          <nav className="flex-1 space-y-1">
            {visibleNavItems.map((it) => {
              const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    active
                      ? "btn-primary-grad font-semibold glow-blue"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <it.icon className="size-4" />
                  {it.label}
                </Link>
              );
            })}
          </nav>
          {canSeeAdmin && (
            <Link
              to="/app/admin/users"
              className="mb-2 flex items-center gap-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-xs font-black text-neon-cyan hover:glow-blue"
            >
              <ShieldCheck className="size-4" /> Administração
            </Link>
          )}
          <Link to="/app/conta" className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <Settings className="size-4" /> Configurações
          </Link>
        </aside>

        <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 glass-strong border-t border-border/60">
        <div className={`grid ${mobileGridClass}`}>
          {mobileNavItems.map((it) => {
            const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex flex-col items-center justify-center py-2.5 text-[10px] gap-1 ${
                  active ? "text-neon-cyan" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`size-9 rounded-xl flex items-center justify-center ${
                    active ? "btn-primary-grad glow-blue" : ""
                  }`}
                >
                  <it.icon className="size-4" />
                </div>
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
