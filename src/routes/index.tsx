import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Bell,
  Crown,
  Loader2,
  Mail,
  MapPin,
  Mic,
  Phone,
  Radio,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { checkClientAccess, registerClient, saveAccessSession, type ClientAccess } from "@/lib/accessApi";
import { readUserSession, saveDemoSession } from "@/lib/userSession";

export const Route = createFileRoute("/")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "SNIPER BO IA - Acesso operacional" },
      {
        name: "description",
        content:
          "Painel operacional com cadastro controlado, leitura estatistica em tempo real e acesso VIP liberado pelo administrador.",
      },
      { property: "og:title", content: "SNIPER BO IA" },
      {
        property: "og:description",
        content: "Acesso operacional com cadastro, checkout, demo limitado e liberacao VIP.",
      },
    ],
  }),
});

const benefits = [
  { icon: Activity, label: "Leitura estatistica", desc: "Padroes em tempo real" },
  { icon: Bell, label: "Alertas operacionais", desc: "Sinais instantaneos" },
  { icon: Mic, label: "Assistente de voz", desc: "Narrador IA dedicado" },
  { icon: Radio, label: "Dados em tempo real", desc: "Stream continuo" },
];

const PARTICLES = Array.from({ length: 28 }, (_, i) => {
  const size = 2 + ((i * 7) % 4);
  const left = (i * 37) % 100;
  const delay = (i * 0.7) % 10;
  const duration = 14 + ((i * 3) % 16);
  return { size, left, delay, duration, key: i };
});

function LoginPage() {
  const savedUser = readUserSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [pendingAccess, setPendingAccess] = useState<ClientAccess | null>(null);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    try {
      const access = await checkClientAccess(email);
      if (!access.registered) {
        setMode("register");
        setNotice("Email ainda nao cadastrado. Faca seu cadastro para continuar.");
        return;
      }
      if (access.approved || access.access_mode === "full") {
        saveAccessSession(access, email);
        window.location.href = "/app";
        return;
      }
      saveDemoSession(access.email || email, access.full_name);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Nao foi possivel validar seu acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("full_name") || "").trim();
    const email = String(data.get("email") || "").trim();
    try {
      const access = await registerClient({
        full_name: fullName,
        email,
        phone: String(data.get("phone") || "").trim(),
        city: String(data.get("city") || "").trim(),
        country: String(data.get("country") || "").trim(),
      });
      saveDemoSession(access.email || email, access.full_name || fullName);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Nao foi possivel concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    if (!pendingAccess) return;
    saveDemoSession(pendingAccess.email, pendingAccess.full_name);
    window.location.href = "/app";
  }

  function goCheckout() {
    if (pendingAccess) saveAccessSession(pendingAccess);
    window.location.href = "/app/planos";
  }

  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center px-4 py-10 lg:py-0">
      <div className="absolute inset-0 scan-grid opacity-[0.18] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 30%, color-mix(in oklab, var(--neon-blue) 22%, transparent), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 70%, color-mix(in oklab, var(--neon-purple) 22%, transparent), transparent 60%)",
        }}
      />
      <div className="absolute -top-40 -left-40 size-[28rem] rounded-full bg-neon-blue/25 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 size-[28rem] rounded-full bg-neon-purple/25 blur-3xl" />

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

      <div className="absolute inset-y-0 left-0 w-full pointer-events-none overflow-hidden">
        <div
          className="scan-sweep absolute inset-x-0 h-40"
          style={{
            background:
              "linear-gradient(to bottom, transparent, color-mix(in oklab, var(--neon-cyan) 10%, transparent), transparent)",
          }}
        />
      </div>

      <div className="absolute inset-0 hidden lg:block pointer-events-none">
        <NeuralLines cx={32} cy={50} count={16} opacity={0.5} reach={1.15} />
      </div>
      <div className="absolute inset-x-0 top-0 h-[55vh] lg:hidden pointer-events-none">
        <NeuralLines cx={50} cy={42} count={10} opacity={0.4} reach={1.2} />
      </div>

      <div className="relative w-full max-w-6xl grid lg:grid-cols-[1.1fr_minmax(0,420px)] gap-10 lg:gap-16 items-center">
        <div className="relative hidden lg:flex flex-col items-center justify-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-orbit-slow size-[520px] rounded-full border border-neon-blue/20" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="animate-orbit-reverse size-[620px] rounded-full border border-neon-purple/15 border-dashed" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-[420px] rounded-full bg-gradient-to-br from-neon-blue/20 via-transparent to-neon-purple/20 blur-2xl" />
            </div>
            <BrainAI size={460} speaking />
          </div>
          <div className="mt-8 text-center max-w-md">
            <h2 className="text-3xl font-bold text-gradient-brand">Inteligencia operacional ao vivo</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Cadastro controlado pelo administrador, acesso demo limitado e ferramentas completas apenas para VIP/Premium liberado.
            </p>
          </div>
        </div>

        <div className="relative w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="animate-orbit-slow size-[180px] rounded-full border border-neon-blue/20" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="animate-orbit-reverse size-[220px] rounded-full border border-neon-purple/15 border-dashed" />
              </div>
              <BrainAI size={200} speaking />
            </div>
          </div>

          <div className="text-center mb-5">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="text-white">SNIPER BO</span>{" "}
              <span className="text-gradient-brand">IA</span>
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground max-w-xs mx-auto">
              Entre somente com cadastro. Acesso completo depende de liberacao do ADM.
            </p>
          </div>

          <GlassCard className="p-6 sm:p-8 rounded-3xl border-neon-blue/25 glow-blue">
            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent" />

            <div className="mb-4 grid grid-cols-2 rounded-2xl border border-border/70 bg-secondary/35 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-xl py-2 text-xs font-bold transition ${mode === "login" ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-xl py-2 text-xs font-bold transition ${mode === "register" ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
              >
                Cadastro
              </button>
            </div>

            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <LoginField icon={<Mail className="size-4" />} label="Email" name="email" type="email" defaultValue={savedUser.email} placeholder="seu@email.com" />
                <LoginField icon={<ShieldCheck className="size-4" />} label="Senha" name="password" type="password" placeholder="sua senha" />
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary-grad group relative w-full rounded-2xl py-3.5 text-sm font-semibold glow-blue flex items-center justify-center gap-2 overflow-hidden disabled:opacity-60"
                >
                  <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                  {loading ? <Loader2 className="relative size-4 animate-spin" /> : <ShieldCheck className="relative size-4" />}
                  <span className="relative">Validar acesso</span>
                </button>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Completo so com liberacao ADM.</span>
                  <button type="button" onClick={() => setMode("register")} className="text-neon-cyan hover:text-neon-blue">
                    Criar cadastro
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <LoginField icon={<UserPlus className="size-4" />} label="Nome completo" name="full_name" placeholder="Nome completo" />
                <LoginField icon={<Mail className="size-4" />} label="Email" name="email" type="email" defaultValue={savedUser.email} placeholder="seu@email.com" />
                <LoginField icon={<Phone className="size-4" />} label="Telefone" name="phone" placeholder="+55 11 99999-9999" />
                <div className="grid grid-cols-2 gap-2">
                  <LoginField icon={<MapPin className="size-4" />} label="Cidade" name="city" placeholder="Cidade" />
                  <LoginField icon={<Radio className="size-4" />} label="Pais" name="country" placeholder="Pais" />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary-grad group relative w-full rounded-2xl py-3.5 text-sm font-semibold glow-blue flex items-center justify-center gap-2 overflow-hidden disabled:opacity-60"
                >
                  <span className="absolute inset-0 shine opacity-60 pointer-events-none" />
                  {loading ? <Loader2 className="relative size-4 animate-spin" /> : <UserPlus className="relative size-4" />}
                  <span className="relative">Cadastrar e continuar</span>
                </button>
              </form>
            )}

            {notice && (
              <div className="mt-4 rounded-2xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs text-warning flex gap-2">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{notice}</span>
              </div>
            )}

            {pendingAccess && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={goCheckout}
                  className="btn-gold-grad inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-black glow-gold"
                >
                  <Crown className="size-4" /> Ir para checkout
                </button>
                <button
                  type="button"
                  onClick={enterDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neon-cyan/35 bg-neon-cyan/10 px-3 py-3 text-xs font-black text-neon-cyan"
                >
                  <Sparkles className="size-4" /> Entrar no demo
                </button>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-border/60 text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
              <ShieldCheck className="size-3 text-neon-cyan" />
              A partir de <span className="text-gold font-semibold">R$ 59,90/mes</span>. Demo limitado.
            </div>
          </GlassCard>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {benefits.map((b) => (
              <div key={b.label} className="glass rounded-2xl p-3 text-center hover:border-neon-blue/40 transition-colors">
                <div className="mx-auto mb-1.5 size-8 rounded-xl flex items-center justify-center bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-neon-blue/30">
                  <b.icon className="size-4 text-neon-cyan" />
                </div>
                <div className="text-[10px] font-semibold leading-tight text-foreground">{b.label}</div>
                <div className="mt-0.5 text-[9px] leading-tight text-muted-foreground">{b.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <AppBadge tone="amber">Cadastro obrigatorio</AppBadge>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginField({
  icon,
  label,
  name,
  placeholder,
  type = "text",
  defaultValue,
}: {
  icon: ReactNode;
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="mt-1.5 flex items-center gap-2 rounded-2xl bg-secondary/50 border border-border/80 px-3.5 py-3 focus-within:border-neon-blue/70 focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--neon-blue)_18%,transparent)] transition-all">
        <span className="text-neon-cyan/70">{icon}</span>
        <input
          name={name}
          type={type}
          required
          defaultValue={defaultValue}
          className="bg-transparent flex-1 outline-none text-sm min-w-0"
          placeholder={placeholder}
        />
      </div>
    </label>
  );
}
