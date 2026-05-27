import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Brain, Mic, Crown, User, Bell, Settings, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { AppBadge } from "@/components/ui-app/AppBadge";
import type { ReactNode } from "react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/ia", label: "Assistente IA", icon: Brain },
  { to: "/app/voz", label: "Voz", icon: Mic },
  { to: "/app/admin", label: "Admin", icon: ShieldCheck },
  { to: "/app/planos", label: "Planos", icon: Crown },
  { to: "/app/conta", label: "Conta", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-app text-foreground">
      {/* Topbar */}
      <header className="sticky top-0 z-30 glass-strong border-b border-border/60">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Logo size={32} />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <AppBadge tone="green" pulse>Mesa online</AppBadge>
            <AppBadge tone="blue" pulse>Engine operacional</AppBadge>
            <AppBadge tone="green">App operacional</AppBadge>
          </div>
          <div className="flex items-center gap-2">
            <button className="size-9 rounded-xl glass flex items-center justify-center hover:glow-blue">
              <Bell className="size-4 text-neon-cyan" />
            </button>
            <Link to="/app/conta" className="size-9 rounded-xl btn-primary-grad flex items-center justify-center">
              <User className="size-4" />
            </Link>
          </div>
        </div>
        {/* mobile status row */}
        <div className="md:hidden flex items-center gap-2 px-3 pb-2 overflow-x-auto">
          <AppBadge tone="green" pulse>Mesa online</AppBadge>
          <AppBadge tone="blue" pulse>Engine operacional</AppBadge>
          <AppBadge tone="green">App operacional</AppBadge>
        </div>
      </header>

      <div className="mx-auto max-w-7xl flex">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] border-r border-border/60 px-3 py-5">
          <nav className="flex-1 space-y-1">
            {navItems.map((it) => {
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
        <div className="grid grid-cols-6">
          {navItems.map((it) => {
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
