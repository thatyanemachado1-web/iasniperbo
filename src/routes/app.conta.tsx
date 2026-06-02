import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AdminPanelCard } from "@/components/admin/AdminPanelCard";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { LogOut } from "lucide-react";
import { clearAdminSession } from "@/lib/adminApi";
import { accessLabel } from "@/lib/accessApi";
import { canSeeAdminUi } from "@/lib/adminSession";
import { clearUserSession, readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  const userSession = readUserSession();
  const canSeeAdmin = canSeeAdminUi();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {canSeeAdmin && <AdminPanelCard />}

      <GlassCard>
        <SectionTitle title="Conta" />
        <Field label="Nome" value={userSession.name} />
        <Field label="Email" value={userSession.email || "Nao informado"} />
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
        <Toggle label="Falar ultima decisao" />
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
