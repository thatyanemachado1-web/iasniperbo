import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { BrainAI } from "@/components/brand/BrainAI";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Activity, Bell, Mic, Radio, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";

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
  { icon: Activity, label: "Leitura estatística", desc: "Padrões em tempo real" },
  { icon: Bell, label: "Alertas operacionais", desc: "Sinais instantâneos" },
  { icon: Mic, label: "Assistente de voz", desc: "Narrador IA dedicado" },
  { icon: Radio, label: "Dados em tempo real", desc: "Stream contínuo" },
];

const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const size = 2 + ((i * 7) % 4);
  const left = (i * 37) % 100;
  const delay = (i * 0.7) % 10;
  const duration = 14 + ((i * 3) % 16);
  return { size, left, delay, duration, key: i };
});

function LoginPage() {
  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center px-4 py-10 lg:py-0">
      {/* Backdrop layers */}
      <div className="absolute inset-0 scan-grid opacity-[0.18] pointer-events-none" />
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 30%, color-mix(in oklab, var(--neon-blue) 22%, transparent), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 70%, color-mix(in oklab, var(--neon-purple) 22%, transparent), transparent 60%)",
        }}
      />
      <div className="absolute -top-40 -left-40 size-[28rem] rounded-full bg-neon-blue/25 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 size-[28rem] rounded-full bg-neon-purple/25 blur-3xl" />

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {PARTICLES.map((p) => (
          <span
            key={p.key}
            className="particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              bottom: -8,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      {/* Vertical scan sweep */}
      <div className="absolute inset-y-0 left-0 w-full pointer-events-none overflow-hidden">
        <div
          className="scan-sweep absolute inset-x-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--neon-cyan) 10%, transparent), transparent)",
          }}
        />
      </div>

      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.1fr_minmax(0,420px)] gap-10 lg:gap-16 items-center">
        {/* Left: cinematic hero */}
        <div className="relative hidden lg:flex flex-col items-center justify-center">
          <div className="relative">
            {/* Orbit rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-orbit-slow size-[420px] rounded-full border border-neon-blue/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-orbit-reverse size-[520px] rounded-full border border-neon-purple/15 border-dashed" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-[340px] rounded-full bg-gradient-to-br from-neon-blue/20 via-transparent to-neon-purple/20 blur-2xl" />
            </div>
            <BrainAI size={360} speaking />
          </div>
          <div className="mt-8 text-center max-w-md">
            <h2 className="text-3xl font-bold text-gradient-brand">Inteligência operacional ao vivo</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Leitura estatística contínua, sinais operacionais e um assistente IA que acompanha cada movimento da mesa em tempo real.
            </p>
          </div>
        </div>

        {/* Right: login column */}
        <div className="relative w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="animate-orbit-slow size-[180px] rounded-full border border-neon-blue/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="animate-orbit-reverse size-[220px] rounded-full border border-neon-purple/15 border-dashed" />
              </div>
              <BrainAI size={150} speaking />
            </div>
          </div>

          <div className="text-center mb-5">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="text-white">SNIPER BO</span>{" "}
              <span className="text-gradient-brand">IA</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
              Painel operacional com leitura estatística e assistente IA.
            </p>
          </div>

          <GlassCard className="p-6 sm:p-8 rounded-3xl border-neon-blue/25 glow-blue">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              window.location.href = "/app";
            }}
              className="space-y-4"
          >
            <label className="block">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Email</span>
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
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
                <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
                <Lock className="size-4 text-neon-cyan/70" />
                <input
                  type="password"
                  required
                  defaultValue="••••••••"
                  className="bg-transparent flex-1 outline-none text-sm"
                />
              </div>
            </label>
              <button
                type="submit"
                className="btn-primary-grad group relative w-full rounded-2xl py-3.5 text-sm font-semibold glow-blue flex items-center justify-center gap-2 overflow-hidden"
              >
                <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                <span className="relative">Entrar no painel</span>
                <ArrowRight className="relative size-4 transition-transform group-hover:translate-x-1" />
              </button>
            <div className="flex items-center justify-between text-xs">
              <a className="text-muted-foreground hover:text-foreground" href="#">Esqueceu sua senha?</a>
              <Link to="/app" className="text-neon-cyan hover:text-neon-blue">Criar nova conta</Link>
            </div>
          </form>
            <div className="mt-5 pt-4 border-t border-border/60 text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3 text-neon-cyan" />
            A partir de <span className="text-gold font-semibold">R$ 59,90/mês</span>. Teste disponível.
          </div>
        </GlassCard>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {benefits.map((b) => (
              <div
                key={b.label}
                className="glass rounded-2xl p-3 text-center hover:border-neon-blue/40 transition-colors"
              >
                <div className="mx-auto mb-1.5 size-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-neon-blue/30">
                  <b.icon className="size-4 text-neon-cyan" />
                </div>
                <div className="text-[10px] font-semibold leading-tight text-foreground">{b.label}</div>
                <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{b.desc}</div>
            </div>
          ))}
        </div>

          <div className="mt-5 flex justify-center">
          <AppBadge tone="amber">Modo demonstração disponível</AppBadge>
        </div>
      </div>
    </div>
    </div>
  );
}
