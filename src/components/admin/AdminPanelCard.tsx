import { Link } from "@tanstack/react-router";
import { Bell, Cpu, Logs, Megaphone, Settings2, ShieldCheck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import type { AdminPanelOverview } from "@/types/adminPanel";

const fallbackOverview: AdminPanelOverview = {
  engineStatus: "Online",
  tableStatus: "Conectada",
  activeUsers: 0,
  activeSubscriptions: 0,
  activeTrials: 0,
  premiumUsers: 0,
  onlineNow: 0,
  lastSignal: "Aguardando",
  lastSignalAt: "sem sinal",
};

export function AdminPanelCard({
  overview = fallbackOverview,
  loading = false,
}: {
  overview?: Partial<AdminPanelOverview>;
  loading?: boolean;
}) {
  const stats = { ...fallbackOverview, ...overview };
  const metricValue = (value: number) => (loading ? "..." : value);

  return (
    <GlassCard className="md:col-span-2 border-neon-cyan/35">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/80 to-transparent" />
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="size-12 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 flex items-center justify-center glow-blue">
              <ShieldCheck className="size-6 text-neon-cyan" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-neon-cyan/80">
                Painel privado
              </div>
              <h2 className="mt-1 text-2xl font-black tracking-wide">PAINEL ADMINISTRATIVO</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Ferramentas avançadas disponíveis apenas para administradores.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <AppBadge tone="green" pulse>
              Engine: {stats.engineStatus}
            </AppBadge>
            <AppBadge tone="blue" pulse>
              Mesa: {stats.tableStatus}
            </AppBadge>
            <AppBadge tone="gold">
              Último sinal: {stats.lastSignal} - {stats.lastSignalAt}
            </AppBadge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Metric icon={<Users className="size-4" />} label="Usuários ativos" value={metricValue(stats.activeUsers)} />
          <Metric icon={<Cpu className="size-4" />} label="Assinaturas ativas" value={metricValue(stats.activeSubscriptions)} />
          <Metric icon={<Bell className="size-4" />} label="Trials ativos" value={metricValue(stats.activeTrials)} />
          <Metric icon={<ShieldCheck className="size-4" />} label="Premium ativos" value={metricValue(stats.premiumUsers)} />
          <Metric icon={<Cpu className="size-4" />} label="Online agora" value={metricValue(stats.onlineNow)} />
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <AdminLink to="/app/admin/users" icon={<Users className="size-4" />} label="Gerenciar usuários" />
          <AdminLink to="/app/admin/logs" icon={<Logs className="size-4" />} label="Ver logs" />
          <AdminLink to="/app/admin/modules" icon={<Settings2 className="size-4" />} label="Configurar módulos" />
          <AdminLink to="/app/admin/broadcast" icon={<Megaphone className="size-4" />} label="Conteudo e avisos" />
        </div>
      </div>
    </GlassCard>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-neon-cyan/15 bg-background/35 px-3 py-3">
      <div className="flex items-center gap-2 text-neon-cyan">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}

type AdminPanelLink =
  | "/app/admin/users"
  | "/app/admin/logs"
  | "/app/admin/modules"
  | "/app/admin/broadcast";

function AdminLink({ to, icon, label }: { to: AdminPanelLink; icon: ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black"
    >
      {icon}
      {label}
    </Link>
  );
}
