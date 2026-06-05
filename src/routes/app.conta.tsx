import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AdminPanelCard } from "@/components/admin/AdminPanelCard";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { LogOut } from "lucide-react";
import { clearAdminSession, getAdminPanelOverview, listAdminUsers } from "@/lib/adminApi";
import { accessLabel } from "@/lib/accessApi";
import { canSeeAdminUi, readEffectiveAdminSession } from "@/lib/adminSession";
import { clearUserSession, readUserSession } from "@/lib/userSession";
import type { AdminManagedUser, AdminPanelOverview } from "@/types/adminPanel";

export const Route = createFileRoute("/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  const userSession = readUserSession();
  const canSeeAdmin = canSeeAdminUi();
  const adminSession = readEffectiveAdminSession();
  const [adminOverview, setAdminOverview] = useState<AdminPanelOverview>();
  const [adminOverviewLoading, setAdminOverviewLoading] = useState(
    canSeeAdmin && Boolean(adminSession),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAdminOverview() {
      if (!canSeeAdmin || !adminSession) {
        setAdminOverview(undefined);
        setAdminOverviewLoading(false);
        return;
      }

      setAdminOverviewLoading(true);
      try {
        const nextOverview = await getAdminPanelOverview(adminSession);
        if (hasAdminOverviewData(nextOverview)) {
          if (!cancelled) setAdminOverview(nextOverview);
          return;
        }

        const data = await listAdminUsers(adminSession);
        if (!cancelled) {
          setAdminOverview(buildOverviewFromUsers(data.users ?? [], data.overview ?? nextOverview));
        }
      } catch {
        try {
          const data = await listAdminUsers(adminSession);
          if (!cancelled) setAdminOverview(buildOverviewFromUsers(data.users ?? [], data.overview));
        } catch {
          if (!cancelled) setAdminOverview(undefined);
        }
      } finally {
        if (!cancelled) setAdminOverviewLoading(false);
      }
    }

    void loadAdminOverview();
    return () => {
      cancelled = true;
    };
  }, [canSeeAdmin, adminSession?.apiUrl, adminSession?.token]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {canSeeAdmin && (
        <AdminPanelCard overview={adminOverview} loading={adminOverviewLoading && !adminOverview} />
      )}

      <GlassCard>
        <SectionTitle title="Conta" />
        <Field label="Nome" value={userSession.name} />
        <Field label="E-mail" value={userSession.email || "Não informado"} />
        <Field
          label="Plano atual"
          value={<AppBadge tone={userSession.approved ? "green" : "amber"}>{accessLabel(userSession)}</AppBadge>}
        />
        <Field
          label="Status da assinatura"
          value={<AppBadge tone={userSession.approved ? "green" : "muted"}>{userSession.accessStatus}</AppBadge>}
        />
        {userSession.expiresAt && <Field label="Validade" value={formatDateBR(userSession.expiresAt)} />}
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Preferencias da IA" />
        <Toggle label="Respostas curtas" defaultOn />
        <Toggle label="Respostas detalhadas" />
        <Toggle label="Linguagem operacional" defaultOn />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Preferencias de voz" />
        <Toggle label="Narrar entradas" defaultOn />
        <Toggle label="Narrar Tie Alert" defaultOn />
        <Toggle label="Falar última decisão" />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Tema" />
        <Toggle label="Modo escuro" defaultOn />
        <Toggle label="Glow intenso" defaultOn />
        <Toggle label="Animacoes" defaultOn />
        <Link
          to="/"
          onClick={() => {
            clearUserSession();
            clearAdminSession();
          }}
          className="mt-4 inline-flex items-center gap-2 text-sm text-destructive hover:opacity-80"
        >
          <LogOut className="size-4" /> Sair
        </Link>
      </GlassCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-sm font-semibold text-right">{value}</div>
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex items-center justify-between text-sm py-2 cursor-pointer">
      <span>{label}</span>
      <span className={`w-10 h-6 rounded-full p-0.5 transition ${defaultOn ? "bg-neon-blue/70" : "bg-secondary"}`}>
        <span className={`block size-5 rounded-full bg-foreground transition ${defaultOn ? "translate-x-4" : ""}`} />
      </span>
    </label>
  );
}

function formatDateBR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function hasAdminOverviewData(overview?: AdminPanelOverview) {
  if (!overview) return false;
  return [
    overview.activeUsers,
    overview.activeSubscriptions,
    overview.activeTrials,
    overview.premiumUsers,
    overview.onlineNow,
  ].some((value) => Number(value) > 0);
}

function buildOverviewFromUsers(
  users: AdminManagedUser[],
  overview?: Partial<AdminPanelOverview>,
): AdminPanelOverview {
  const now = Date.now();
  const clientUsers = users.filter((user) => user.role === "user");
  const activeUsers = clientUsers.filter((user) => isActiveUser(user, now));
  const paidUsers = activeUsers.filter(
    (user) => user.subscriptionStatus === "active" || user.subscriptionStatus === "manual_vip",
  );
  const trialUsers = activeUsers.filter(
    (user) => user.plan === "trial" || user.subscriptionStatus === "trial",
  );
  const premiumUsers = activeUsers.filter(
    (user) => user.plan === "premium" || user.plan === "vip_manual",
  );

  return {
    engineStatus: overview?.engineStatus || "Online",
    tableStatus: overview?.tableStatus || "Conectada",
    activeUsers: activeUsers.length,
    activeSubscriptions: paidUsers.length,
    activeTrials: trialUsers.length,
    premiumUsers: premiumUsers.length,
    onlineNow: overview?.onlineNow || 0,
    lastSignal: overview?.lastSignal || "Aguardando",
    lastSignalAt: overview?.lastSignalAt || "sem sinal",
  };
}

function isActiveUser(user: AdminManagedUser, now = Date.now()) {
  if (user.isBlocked) return false;
  if (!["active", "manual_vip", "trial"].includes(user.subscriptionStatus)) return false;
  return parseAccessDate(user.currentPeriodEnd) > now;
}

function parseAccessDate(value: string) {
  if (!value) return 0;
  const normalized = value.includes("T") ? value : `${value}T23:59:59`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
