import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { BrainAI } from "@/components/brand/BrainAI";
import { Logo } from "@/components/brand/Logo";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Activity, Bell, Mic, Radio, Mail, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "SNIPER BO IA — Painel operacional com leitura estatística" },
      {
        name: "description",
        content:
          "Painel operacional com leitura estatística e assistente IA. Acompanhe a mesa em tempo real com alertas, Tie Alert paralelo e narrador IA.",
      },
      { property: "og:title", content: "SNIPER BO IA" },
      {
        property: "og:description",
        content: "Leitura estatística em tempo real, Tie Alert paralelo e assistente IA.",
      },
    ],
  }),
});

const benefits = [
  { icon: Activity, label: "Leitura estatística" },
  { icon: Bell, label: "Alertas operacionais" },
  { icon: Mic, label: "Assistente de voz" },
  { icon: Radio, label: "Dados em tempo real" },
];

function LoginPage() {
  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 scan-grid opacity-30 pointer-events-none" />
      <div className="absolute -top-32 -left-32 size-96 rounded-full bg-neon-blue/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 size-96 rounded-full bg-neon-purple/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <BrainAI size={120} speaking />
          <div className="mt-2">
            <Logo size={0} />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gradient-brand text-center">
            SNIPER BO IA
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground text-center max-w-xs">
            Painel operacional com leitura estatística e assistente IA.
          </p>
        </div>

        <GlassCard className="p-6 sm:p-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/app";
            }}
            className="space-y-3"
          >
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Email</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-secondary/60 border border-border px-3 py-2.5 focus-within:border-neon-blue/60">
                <Mail className="size-4 text-neon-cyan/70" />
                <input
                  type="email"
                  required
                  defaultValue="gabriel@sniperbo.ia"
                  className="bg-transparent flex-1 outline-none text-sm"
                  placeholder="seu@email.com"
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Senha</span>
              <div className="mt-1 flex items-center gap-2 rounded-xl bg-secondary/60 border border-border px-3 py-2.5 focus-within:border-neon-blue/60">
                <Lock className="size-4 text-neon-cyan/70" />
                <input
                  type="password"
                  required
                  defaultValue="••••••••"
                  className="bg-transparent flex-1 outline-none text-sm"
                />
              </div>
            </label>
            <button type="submit" className="btn-primary-grad w-full rounded-xl py-3 text-sm font-semibold glow-blue">
              Entrar no painel
            </button>
            <div className="flex items-center justify-between text-xs">
              <a className="text-muted-foreground hover:text-foreground" href="#">Esqueceu sua senha?</a>
              <Link to="/app" className="text-neon-cyan hover:text-neon-blue">Criar nova conta</Link>
            </div>
          </form>
          <div className="mt-4 text-[11px] text-center text-muted-foreground">
            A partir de <span className="text-gold font-semibold">R$ 59,90/mês</span>. Teste disponível.
          </div>
        </GlassCard>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {benefits.map((b) => (
            <div key={b.label} className="glass rounded-xl p-2 text-center">
              <b.icon className="size-4 mx-auto text-neon-cyan" />
              <div className="mt-1 text-[9px] leading-tight text-muted-foreground">{b.label}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-center">
          <AppBadge tone="amber">Modo demonstração disponível</AppBadge>
        </div>
      </div>
    </div>
  );
}
