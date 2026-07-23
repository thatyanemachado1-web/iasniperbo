import { Activity, Save, Send, ShieldCheck, Wand2 } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

const items = [
  { label: "Dashboard", to: "/app", icon: Activity },
  { label: "Validador", to: "/app/validador", tab: "validator", icon: ShieldCheck },
  { label: "IA de Padrões", to: "/app/validador", tab: "ai", icon: Wand2 },
  { label: "Padrões Salvos", to: "/app/validador", tab: "saved", icon: Save },
  { label: "Telegram", to: "/app/validador", tab: "telegram", icon: Send },
] as const;

export function DesktopDashboardQuickNav() {
  const location = useRouterState({ select: (state) => state.location });
  const currentTab =
    location.pathname === "/app/validador"
      ? String((location.search as Record<string, unknown>)?.tab || "validator")
      : "";

  return (
    <nav
      aria-label="Acessos rápidos do dashboard"
      className="grid touch-pan-x snap-x grid-flow-col auto-cols-[minmax(118px,1fr)] gap-1 overflow-x-auto rounded-xl border border-white/5 bg-secondary/70 p-1 lg:grid-flow-row lg:grid-cols-5 lg:auto-cols-auto lg:overflow-visible"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          item.to === "/app"
            ? location.pathname === "/app"
            : location.pathname === "/app/validador" &&
              "tab" in item &&
              currentTab === item.tab;
        return (
          <Link
            key={item.label}
            to={item.to}
            search={"tab" in item ? { tab: item.tab } : undefined}
            className={`flex min-w-0 snap-start items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-neon-blue hover:bg-background/55 hover:text-foreground"
            }`}
          >
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
