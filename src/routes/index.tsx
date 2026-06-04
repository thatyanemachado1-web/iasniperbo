import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AudioLines,
  Bell,
  BrainCircuit,
  CircleDollarSign,
  Copy,
  Crown,
  DatabaseZap,
  GitBranch,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Mic,
  Network,
  Phone,
  Radio,
  Radar,
  RefreshCw,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { BrainAI } from "@/components/brand/BrainAI";
import { NeuralLines } from "@/components/brand/NeuralLines";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { SalesClosedPanel } from "@/components/ui-app/SalesClosedPanel";
import { checkClientAccess, getSalesSettings, registerClient, saveAccessSession, type ClientAccess } from "@/lib/accessApi";
import { readUserSession } from "@/lib/userSession";

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

type LoginAgentTone = "cyan" | "green" | "amber" | "purple" | "red" | "blue";

type LoginAgent = {
  name: string;
  status: string;
  icon: LucideIcon;
  tone: LoginAgentTone;
  x: number;
  y: number;
  delay: number;
};

const loginAgentTones: Record<LoginAgentTone, { border: string; bg: string; text: string; dot: string; line: string }> = {
  cyan: {
    border: "border-neon-cyan/55",
    bg: "bg-neon-cyan/12",
    text: "text-neon-cyan",
    dot: "bg-neon-cyan",
    line: "rgba(0,229,255,0.72)",
  },
  green: {
    border: "border-success/55",
    bg: "bg-success/12",
    text: "text-success",
    dot: "bg-success",
    line: "rgba(0,255,153,0.72)",
  },
  amber: {
    border: "border-warning/60",
    bg: "bg-warning/12",
    text: "text-warning",
    dot: "bg-warning",
    line: "rgba(255,193,7,0.72)",
  },
  purple: {
    border: "border-neon-purple/55",
    bg: "bg-neon-purple/12",
    text: "text-neon-purple",
    dot: "bg-neon-purple",
    line: "rgba(168,85,247,0.72)",
  },
  red: {
    border: "border-red-400/60",
    bg: "bg-red-500/12",
    text: "text-red-300",
    dot: "bg-red-400",
    line: "rgba(248,113,113,0.72)",
  },
  blue: {
    border: "border-neon-blue/55",
    bg: "bg-neon-blue/12",
    text: "text-neon-blue",
    dot: "bg-neon-blue",
    line: "rgba(59,130,246,0.72)",
  },
};

const loginAgents: LoginAgent[] = [
  { name: "Neural Pagante", status: "Escaneio protegido", icon: Radar, tone: "cyan", x: 13, y: 17, delay: 0 },
  { name: "Surf Analyzer", status: "Tendência monitorada", icon: Waves, tone: "green", x: 32, y: 8, delay: 0.35 },
  { name: "Assistente Voz", status: "Narração pronta", icon: AudioLines, tone: "blue", x: 50, y: 12, delay: 0.7 },
  { name: "Tie Alert", status: "Empate observado", icon: CircleDollarSign, tone: "amber", x: 68, y: 8, delay: 1.05 },
  { name: "Tendência", status: "Janela lendo", icon: TrendingUp, tone: "green", x: 87, y: 17, delay: 1.4 },
  { name: "Alternância", status: "Trocas mapeadas", icon: Repeat, tone: "purple", x: 8, y: 42, delay: 1.75 },
  { name: "Duplas", status: "Repetições lendo", icon: Copy, tone: "cyan", x: 92, y: 42, delay: 2.1 },
  { name: "Market Turn", status: "Virada rastreada", icon: RefreshCw, tone: "amber", x: 10, y: 66, delay: 2.45 },
  { name: "Multi Window", status: "Janelas cruzadas", icon: GitBranch, tone: "blue", x: 90, y: 66, delay: 2.8 },
  { name: "Exhaustion", status: "Risco filtrado", icon: ShieldAlert, tone: "red", x: 16, y: 88, delay: 3.15 },
  { name: "Banco Estratégias", status: "Padrões auditados", icon: DatabaseZap, tone: "purple", x: 36, y: 94, delay: 3.5 },
  { name: "Aprendizado IA", status: "Histórico minerado", icon: BrainCircuit, tone: "purple", x: 60, y: 94, delay: 3.85 },
  { name: "Mapa Neural IA", status: "Rede conectada", icon: Network, tone: "cyan", x: 82, y: 88, delay: 4.2 },
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
  const [salesClosed, setSalesClosed] = useState<boolean | null>(null);
  const [showClosedLogin, setShowClosedLogin] = useState(false);

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    try {
      const access = await checkClientAccess(email, password);
      if (!access.registered) {
        if (!salesClosed) setMode("register");
        setNotice(
          salesClosed
            ? "Vagas encerradas no momento. Entre na fila de espera para a próxima abertura."
            : "Email ainda não cadastrado. Faça seu cadastro para continuar.",
        );
        return;
      }
      if (salesClosed && !canEnterWhenSalesClosed(access)) {
        setNotice("Vagas encerradas. Somente clientes Premium com acesso ativo conseguem entrar na plataforma.");
        return;
      }
      saveAccessSession(access, email);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Nao foi possivel validar seu acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salesClosed) {
      setNotice("Vagas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    setLoading(true);
    setNotice("");
    setPendingAccess(null);
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("full_name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const passwordConfirm = String(data.get("password_confirm") || "");
    if (password.length < 4) {
      setNotice("A senha precisa ter pelo menos 4 caracteres.");
      setLoading(false);
      return;
    }
    if (password !== passwordConfirm) {
      setNotice("As senhas nao conferem.");
      setLoading(false);
      return;
    }
    try {
      const access = await registerClient({
        full_name: fullName,
        email,
        password,
        phone: String(data.get("phone") || "").trim(),
        city: String(data.get("city") || "").trim(),
        country: String(data.get("country") || "").trim(),
      });
      saveAccessSession(access, email);
      window.location.href = "/app";
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Nao foi possivel concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo() {
    if (!pendingAccess) return;
    saveAccessSession(pendingAccess);
    window.location.href = "/app";
  }

  function goCheckout() {
    if (salesClosed) {
      setNotice("Vagas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    if (pendingAccess) saveAccessSession(pendingAccess);
    window.location.href = "/app/planos";
  }

  if (salesClosed === null) {
    return <SalesAccessLoading />;
  }

  if (salesClosed && !showClosedLogin) {
    return (
      <SalesClosedPanel
        onClientLogin={() => {
          setMode("login");
          setShowClosedLogin(true);
        }}
      />
    );
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
          <LoginNeuralAgentsShowcase />
        </div>

        <div className="relative w-full max-w-md mx-auto">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <LoginNeuralAgentsShowcase compact />
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

            <div className={`mb-4 grid rounded-2xl border border-border/70 bg-secondary/35 p-1 ${salesClosed ? "grid-cols-1" : "grid-cols-2"}`}>
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-xl py-2 text-xs font-bold transition ${mode === "login" ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
              >
                Entrar
              </button>
              {!salesClosed && (
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-xl py-2 text-xs font-bold transition ${mode === "register" ? "btn-primary-grad" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Cadastro
                </button>
              )}
            </div>

            {mode === "login" || salesClosed ? (
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
                  <span className="text-muted-foreground">
                    {salesClosed ? "Somente clientes ativos." : "Completo só com liberação ADM."}
                  </span>
                  {!salesClosed && (
                    <button type="button" onClick={() => setMode("register")} className="text-neon-cyan hover:text-neon-blue">
                      Criar cadastro
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3">
                <LoginField icon={<UserPlus className="size-4" />} label="Nome completo" name="full_name" placeholder="Nome completo" />
                <LoginField icon={<Mail className="size-4" />} label="Email" name="email" type="email" defaultValue={savedUser.email} placeholder="seu@email.com" />
                <LoginField icon={<KeyRound className="size-4" />} label="Criar senha" name="password" type="password" placeholder="minimo 4 caracteres" />
                <LoginField icon={<ShieldCheck className="size-4" />} label="Confirmar senha" name="password_confirm" type="password" placeholder="repita sua senha" />
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

            {pendingAccess && !salesClosed && (
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

            {!salesClosed && (
              <div className="mt-5 pt-4 border-t border-border/60 text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <ShieldCheck className="size-3 text-neon-cyan" />
                A partir de <span className="text-gold font-semibold">R$ 297/mês</span>. Demo limitado.
              </div>
            )}
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
            <AppBadge tone={salesClosed ? "red" : "amber"}>
              {salesClosed ? "Vagas encerradas" : "Cadastro obrigatório"}
            </AppBadge>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginNeuralAgentsShowcase({ compact = false }: { compact?: boolean }) {
  const brainSize = compact ? 165 : 360;
  const containerClass = compact
    ? "relative mx-auto aspect-square w-[92vw] max-w-[360px]"
    : "relative mx-auto aspect-square w-full max-w-[720px]";

  return (
    <div className={compact ? "w-full" : "w-full"}>
      <div className={containerClass}>
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.13),transparent_56%)] blur-2xl" />
        <div className="absolute inset-[7%] animate-orbit-slow rounded-full border border-neon-cyan/20" />
        <div className="absolute inset-[13%] animate-orbit-reverse rounded-full border border-neon-purple/20 border-dashed" />
        <div className="absolute inset-[23%] rounded-full border border-neon-blue/15" />

        <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id={compact ? "login-agent-glow-mobile" : "login-agent-glow-desktop"}>
              <feGaussianBlur stdDeviation="0.9" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {loginAgents.map((agent) => (
            <path
              key={`line-${agent.name}`}
              d={loginAgentPath(agent)}
              stroke={loginAgentTones[agent.tone].line}
              strokeWidth={compact ? 0.22 : 0.34}
              strokeOpacity={compact ? 0.38 : 0.62}
              strokeDasharray="4 8"
              fill="none"
              filter={`url(#${compact ? "login-agent-glow-mobile" : "login-agent-glow-desktop"})`}
            >
              <animate attributeName="stroke-dashoffset" values="0;-24" dur={`${3.6 + agent.delay / 2}s`} repeatCount="indefinite" />
            </path>
          ))}
          {loginAgents.map((agent) => (
            <circle
              key={`packet-${agent.name}`}
              r={compact ? 0.75 : 1.05}
              fill={loginAgentTones[agent.tone].line}
              filter={`url(#${compact ? "login-agent-glow-mobile" : "login-agent-glow-desktop"})`}
            >
              <animateMotion dur={compact ? "8.5s" : "10.5s"} repeatCount="indefinite" path={loginAgentPath(agent)} begin={`${agent.delay}s`} />
            </circle>
          ))}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <BrainAI size={brainSize} speaking />
        </div>

        <div className="absolute left-1/2 top-[64%] z-20 -translate-x-1/2 rounded-full border border-neon-cyan/35 bg-background/65 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-neon-cyan shadow-[0_0_22px_rgba(0,229,255,0.16)] backdrop-blur-md sm:text-[10px]">
          Tempo real protegido
        </div>

        {loginAgents.map((agent) =>
          compact ? (
            <LoginMiniAgentNode key={agent.name} agent={agent} />
          ) : (
            <LoginAgentNode key={agent.name} agent={agent} />
          ),
        )}
      </div>

      {compact ? (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {loginAgents.map((agent) => {
            const tone = loginAgentTones[agent.tone];
            return (
              <div
                key={`mobile-${agent.name}`}
                className={`min-w-[138px] rounded-2xl border px-3 py-2 ${tone.border} ${tone.bg} backdrop-blur-md`}
              >
                <div className="flex items-center gap-2">
                  <agent.icon className={`size-4 ${tone.text}`} />
                  <span className="truncate text-[10px] font-black text-white">{agent.name}</span>
                </div>
                <div className="mt-1 truncate text-[9px] text-muted-foreground">{agent.status}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="-mt-3 text-center">
          <h2 className="text-3xl font-bold text-gradient-brand">Central neural em tempo real</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Agentes visuais ativos no login com dados sensíveis protegidos.
          </p>
        </div>
      )}
    </div>
  );
}

function LoginAgentNode({ agent }: { agent: LoginAgent }) {
  const tone = loginAgentTones[agent.tone];
  return (
    <div
      className="absolute z-20 w-[118px] -translate-x-1/2 -translate-y-1/2 text-center"
      style={
        {
          left: `${agent.x}%`,
          top: `${agent.y}%`,
          animationDelay: `${agent.delay}s`,
        } as CSSProperties
      }
    >
      <div className={`mb-1 line-clamp-2 min-h-[24px] text-[9px] font-black uppercase leading-tight tracking-[0.08em] ${tone.text}`}>
        {agent.name}
      </div>
      <div className={`mx-auto flex size-12 items-center justify-center rounded-2xl border ${tone.border} ${tone.bg} shadow-[0_0_18px_rgba(0,229,255,0.12)] backdrop-blur-md animate-brain-pulse`}>
        <span className={`absolute -right-0.5 -top-0.5 size-2 rounded-full ${tone.dot} shadow-[0_0_12px_currentColor]`} />
        <agent.icon className={`size-6 ${tone.text}`} />
      </div>
      <div className="mt-1 truncate rounded-full border border-white/10 bg-background/55 px-2 py-1 text-[8px] font-bold text-muted-foreground backdrop-blur-md">
        {agent.status}
      </div>
    </div>
  );
}

function LoginMiniAgentNode({ agent }: { agent: LoginAgent }) {
  const tone = loginAgentTones[agent.tone];
  return (
    <div
      className={`absolute z-20 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl border ${tone.border} ${tone.bg} backdrop-blur-md animate-brain-pulse`}
      style={
        {
          left: `${agent.x}%`,
          top: `${agent.y}%`,
          animationDelay: `${agent.delay}s`,
        } as CSSProperties
      }
      aria-label={agent.name}
    >
      <span className={`absolute -right-0.5 -top-0.5 size-1.5 rounded-full ${tone.dot}`} />
      <agent.icon className={`size-4 ${tone.text}`} />
    </div>
  );
}

function loginAgentPath(agent: LoginAgent) {
  const midX = (50 + agent.x) / 2;
  const midY = (50 + agent.y) / 2;
  return `M 50 50 Q ${midX} ${midY}, ${agent.x} ${agent.y}`;
}

function SalesAccessLoading() {
  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 scan-grid opacity-[0.18] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 20% 30%, color-mix(in oklab, var(--neon-blue) 18%, transparent), transparent 60%), radial-gradient(ellipse 50% 50% at 80% 70%, color-mix(in oklab, var(--neon-purple) 18%, transparent), transparent 60%)",
        }}
      />
      <div className="relative w-full max-w-sm rounded-3xl border border-neon-cyan/30 bg-background/75 p-6 text-center shadow-[0_0_40px_rgba(0,229,255,0.12)] backdrop-blur-xl">
        <div className="mx-auto mb-4 flex justify-center">
          <BrainAI size={92} speaking />
        </div>
        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-neon-cyan">SNIPER BO IA</div>
        <div className="mt-2 text-xl font-black text-white">Verificando acesso</div>
        <div className="mt-2 text-xs text-muted-foreground">Sincronizando status de vagas...</div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary/70">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-neon-cyan via-neon-blue to-neon-purple animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function canEnterWhenSalesClosed(access: ClientAccess) {
  return (
    access.approved ||
    access.access_mode === "full" ||
    access.role === "owner" ||
    access.role === "admin"
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
