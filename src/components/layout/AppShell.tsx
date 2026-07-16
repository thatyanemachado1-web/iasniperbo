import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Brain,
  BrainCircuit,
  Crown,
  User,
  Bell,
  Settings,
  ShieldCheck,
  Network,
  CalendarDays,
  WalletCards,
  Send,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";
import { LiveHouseCard } from "@/components/live/LiveHouseCard";
import { Logo } from "@/components/brand/Logo";
import { MainSignalLivePopupBridge } from "@/components/dashboard/MainSignalLivePopupBridge";
import { NeuralEntryLivePopupBridge } from "@/components/dashboard/NeuralEntryLivePopupBridge";
import { ValidatorLivePopupBridge } from "@/components/validator/ValidatorLivePopupBridge";
import { canSeeAdminUi } from "@/lib/adminSession";
import { hasFullAccess, hasSignalAccess, readUserSession } from "@/lib/userSession";
import { useEffect, useState, type ReactNode } from "react";

const navItems = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/ao-vivo", label: "Ao vivo", icon: Radio },
  { to: "/app/agentes", label: "Agentes IA", icon: Network },
  { to: "/app/ia", label: "Aprendizado IA", icon: Brain },
  { to: "/app/padroes", label: "Padrões IA", icon: BrainCircuit },
  { to: "/app/validador", label: "Validador", icon: ShieldCheck },
  { to: "/app/salas", label: "Salas", icon: Send },
  { to: "/app/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/app/banca", label: "Banca IA", icon: WalletCards },
  { to: "/app/planos", label: "Assinar", icon: Crown },
  { to: "/app/conta", label: "Conta", icon: User },
] as const;

const adminNavItem = { to: "/app/admin/users", label: "ADM", icon: ShieldCheck } as const;
const hiddenOnMobileNav = new Set(["/app/ia"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarPreferenceLoaded, setSidebarPreferenceLoaded] = useState(false);
  const [liveHouseMounted, setLiveHouseMounted] = useState(pathname === "/app/ao-vivo");
  const userSession = readUserSession();
  const canSeeAdmin = canSeeAdminUi();
  const fullAccess = hasFullAccess(userSession);
  const signalAccess = hasSignalAccess(userSession);
  const liveHousePage = pathname === "/app/ao-vivo";
  const visibleNavItems = fullAccess
    ? navItems.filter((item) => item.to !== "/app/planos")
    : navItems;
  const visibleMobileNavItems = visibleNavItems.filter((item) => !hiddenOnMobileNav.has(item.to));
  const mobileNavItems = canSeeAdmin ? [...visibleMobileNavItems, adminNavItem] : visibleMobileNavItems;

  useEffect(() => {
    const savedPreference = window.localStorage.getItem("sniper_sidebar_collapsed");
    if (savedPreference) setSidebarCollapsed(savedPreference === "true");
    setSidebarPreferenceLoaded(true);
  }, []);

  useEffect(() => {
    if (!sidebarPreferenceLoaded) return;
    window.localStorage.setItem("sniper_sidebar_collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed, sidebarPreferenceLoaded]);

  useEffect(() => {
    if (liveHousePage) setLiveHouseMounted(true);
  }, [liveHousePage]);

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
        <aside
          className={`relative hidden lg:flex flex-col shrink-0 sticky top-14 self-start h-[calc(100vh-3.5rem)] border-r border-border/60 py-5 transition-[width,padding] duration-300 ${
            sidebarCollapsed ? "w-[72px] px-2" : "w-60 px-3"
          }`}
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className="absolute -right-3 top-3 z-20 inline-flex size-6 items-center justify-center rounded-full border border-neon-cyan/35 bg-background/95 text-neon-cyan shadow-[0_0_18px_rgba(0,229,255,0.22)] transition hover:border-neon-cyan hover:bg-neon-cyan/10"
            aria-label={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronLeft className="size-3.5" />
            )}
          </button>
          <nav className="flex-1 space-y-1">
            {visibleNavItems.map((it) => {
              const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  title={sidebarCollapsed ? it.label : undefined}
                  aria-label={sidebarCollapsed ? it.label : undefined}
                  className={`flex h-10 items-center rounded-xl text-sm transition ${
                    sidebarCollapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    active
                      ? "btn-primary-grad font-semibold glow-blue"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}
                >
                  <it.icon className="size-4" />
                  {!sidebarCollapsed && <span>{it.label}</span>}
                </Link>
              );
            })}
          </nav>
          {canSeeAdmin && (
            <Link
              to="/app/admin/users"
              title={sidebarCollapsed ? "Administração" : undefined}
              aria-label={sidebarCollapsed ? "Administração" : undefined}
              className={`mb-2 flex h-10 items-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-xs font-black text-neon-cyan hover:glow-blue ${
                sidebarCollapsed ? "justify-center px-0" : "gap-2 px-3"
              }`}
            >
              <ShieldCheck className="size-4" />
              {!sidebarCollapsed && <span>Administração</span>}
            </Link>
          )}
          <Link
            to="/app/conta"
            title={sidebarCollapsed ? "Configurações" : undefined}
            aria-label={sidebarCollapsed ? "Configurações" : undefined}
            className={`flex h-10 items-center rounded-xl text-xs text-muted-foreground hover:text-foreground ${
              sidebarCollapsed ? "justify-center px-0" : "gap-2 px-3"
            }`}
          >
            <Settings className="size-4" />
            {!sidebarCollapsed && <span>Configurações</span>}
          </Link>
        </aside>

        <main className="flex-1 min-w-0 px-3 sm:px-6 py-4 pb-28 lg:pb-8">
          {liveHouseMounted && (
            <div className={liveHousePage ? "block" : "hidden"} aria-hidden={!liveHousePage}>
              <LiveHouseCard active={liveHousePage} />
            </div>
          )}
          {!liveHousePage && children}
        </main>
      </div>

      {signalAccess && !liveHousePage && <MainSignalLivePopupBridge />}
      {signalAccess && !liveHousePage && <NeuralEntryLivePopupBridge />}
      {fullAccess && !liveHousePage && <ValidatorLivePopupBridge />}

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 glass-strong lg:hidden">
        <div className="flex overflow-x-auto px-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileNavItems.map((it) => {
            const active = pathname === it.to || (it.to !== "/app" && pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={`flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[9px] sm:min-w-[78px] sm:text-[10px] ${
                  active ? "text-neon-cyan" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`flex size-8 items-center justify-center rounded-xl sm:size-9 ${
                    active ? "btn-primary-grad glow-blue" : ""
                  }`}
                >
                  <it.icon className="size-4" />
                </div>
                <span className="max-w-full truncate">{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
