import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { LogOut, ShieldCheck, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { readAdminSession } from "@/lib/adminApi";
import { clearUserSession, isAdminOwnerEmail, readUserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  const adminSession = readAdminSession();
  const userSession = readUserSession();
  const canSeeAdmin = isAdminOwnerEmail(userSession.email);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {adminSession && canSeeAdmin && (
        <GlassCard className="md:col-span-2 border-neon-cyan/35">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="size-11 rounded-2xl btn-primary-grad flex items-center justify-center glow-blue">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-neon-cyan/80">
                  Espaço privado do administrador
                </div>
                <h2 className="mt-1 text-xl font-black">Cadastros VIP/Premium</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gerencie clientes, libere acesso e controle quem recebe os sinais.
                </p>
              </div>
            </div>
            <Link
              to="/app/admin"
              className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
            >
              <Users className="size-4" /> Abrir cadastros
            </Link>
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <SectionTitle title="Conta" />
        <Field label="Nome" value={userSession.name} />
        <Field label="Email" value={userSession.email || "Não informado"} />
        <Field label="Plano atual" value={<AppBadge tone="amber">Demonstração</AppBadge>} />
        <Field label="Status da assinatura" value={<AppBadge tone="muted">Não assinante</AppBadge>} />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Preferências da IA" />
        <Toggle label="Respostas curtas" defaultOn />
        <Toggle label="Respostas detalhadas" />
        <Toggle label="Linguagem operacional" defaultOn />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Preferências de voz" />
        <Toggle label="Narrar entradas" defaultOn />
        <Toggle label="Narrar Tie Alert" defaultOn />
        <Toggle label="Falar última decisão" />
      </GlassCard>

      <GlassCard>
        <SectionTitle title="Tema" />
        <Toggle label="Modo escuro" defaultOn />
        <Toggle label="Glow intenso" defaultOn />
        <Toggle label="Animações" defaultOn />
        <Link
          to="/"
          onClick={() => clearUserSession()}
          className="mt-4 inline-flex items-center gap-2 text-sm text-destructive hover:opacity-80"
        >
          <LogOut className="size-4" /> Sair
        </Link>
      </GlassCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <div className="text-xs text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
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
