import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { LogOut } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/app/conta")({
  component: ContaPage,
});

function ContaPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <GlassCard>
        <SectionTitle title="Conta" />
        <Field label="Nome" value="Gabriel" />
        <Field label="Email" value="gabriel@sniperbo.ia" />
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
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm text-destructive hover:opacity-80">
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