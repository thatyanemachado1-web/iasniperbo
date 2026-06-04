import { Component, useMemo, useState, type CSSProperties, type ErrorInfo, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  AudioLines,
  BrainCircuit,
  CircleDollarSign,
  Copy,
  DatabaseZap,
  GitBranch,
  Mic2,
  Network,
  Pause,
  Play,
  Radar,
  RefreshCw,
  Repeat,
  ShieldAlert,
  TrendingUp,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { AdaptivePattern, AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";
import type { DashboardData, RoundResult, SignalSide } from "@/types/dashboard";

type SceneMode = "observing" | "forming" | "entry" | "green" | "red" | "risk";
type AgentId =
  | "neural"
  | "surf"
  | "tie"
  | "trend"
  | "alternation"
  | "doubles"
  | "marketTurn"
  | "multiWindow"
  | "exhaustion"
  | "strategy"
  | "learning"
  | "neuralMap"
  | "voice";
type AgentTone = "cyan" | "green" | "amber" | "purple" | "red" | "blue";

type AgentInfo = {
  id: AgentId;
  name: string;
  module: string;
  icon: LucideIcon;
  tone: AgentTone;
  status: string;
  lastReading: string;
  confidence: number | null;
  risk: number | null;
  logs: string[];
  greens: number | null;
  reds: number | null;
  active: boolean;
  pulse: boolean;
  nodeLabel: string;
};

type Props = {
  data: DashboardData;
  adaptiveSnapshot: AdaptiveStrategySnapshot;
  liveReady: boolean;
};

const toneClasses: Record<AgentTone, { text: string; border: string; bg: string; glow: string; dot: string }> = {
  cyan: {
    text: "text-neon-cyan",
    border: "border-neon-cyan/42",
    bg: "bg-neon-cyan/10",
    glow: "shadow-[0_0_28px_-12px_rgba(0,229,255,0.32)]",
    dot: "bg-neon-cyan",
  },
  green: {
    text: "text-success",
    border: "border-success/42",
    bg: "bg-success/10",
    glow: "shadow-[0_0_28px_-12px_rgba(0,255,153,0.3)]",
    dot: "bg-success",
  },
  amber: {
    text: "text-warning",
    border: "border-warning/42",
    bg: "bg-warning/10",
    glow: "shadow-[0_0_28px_-12px_rgba(255,193,7,0.3)]",
    dot: "bg-warning",
  },
  purple: {
    text: "text-neon-purple",
    border: "border-neon-purple/42",
    bg: "bg-neon-purple/10",
    glow: "shadow-[0_0_28px_-12px_rgba(168,85,247,0.3)]",
    dot: "bg-neon-purple",
  },
  red: {
    text: "text-red-300",
    border: "border-red-400/48",
    bg: "bg-red-500/10",
    glow: "shadow-[0_0_30px_-12px_rgba(239,68,68,0.34)]",
    dot: "bg-red-400",
  },
  blue: {
    text: "text-neon-blue",
    border: "border-neon-blue/42",
    bg: "bg-neon-blue/10",
    glow: "shadow-[0_0_28px_-12px_rgba(59,130,246,0.3)]",
    dot: "bg-neon-blue",
  },
};

const centerNode = { x: 50, y: 52 };

const agentNodes: Record<AgentId, { x: number; y: number; left: string; top: string }> = {
  neural: { x: 10, y: 18, left: "3%", top: "7%" },
  surf: { x: 30, y: 15, left: "22%", top: "5%" },
  voice: { x: 50, y: 15, left: "41%", top: "5%" },
  tie: { x: 70, y: 15, left: "60%", top: "5%" },
  trend: { x: 90, y: 18, left: "79%", top: "7%" },
  alternation: { x: 11, y: 42, left: "3%", top: "35%" },
  doubles: { x: 89, y: 42, left: "79%", top: "35%" },
  marketTurn: { x: 11, y: 64, left: "3%", top: "55%" },
  multiWindow: { x: 89, y: 64, left: "79%", top: "55%" },
  exhaustion: { x: 10, y: 87, left: "3%", top: "75%" },
  strategy: { x: 35, y: 90, left: "27%", top: "78%" },
  learning: { x: 62, y: 90, left: "52%", top: "78%" },
  neuralMap: { x: 90, y: 87, left: "75%", top: "75%" },
};

export function AiAgentsCommandCenter({ data, adaptiveSnapshot, liveReady }: Props) {
  return (
    <AgentsRuntimeBoundary>
      <AiAgentsCommandCenterContent data={data} adaptiveSnapshot={adaptiveSnapshot} liveReady={liveReady} />
    </AgentsRuntimeBoundary>
  );
}

function AiAgentsCommandCenterContent({ data, adaptiveSnapshot, liveReady }: Props) {
  const [selectedId, setSelectedId] = useState<AgentId>("neural");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const scene = useMemo(() => buildScene(data, adaptiveSnapshot, liveReady), [adaptiveSnapshot, data, liveReady]);
  const agents = useMemo(() => buildAgents(data, adaptiveSnapshot, scene), [adaptiveSnapshot, data, scene]);
  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? agents[0];

  return (
    <div className="space-y-4">
      <GlassCard className="border-neon-cyan/15 p-0">
        <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.08),transparent_36%),linear-gradient(145deg,rgba(4,10,26,0.97),rgba(7,10,24,0.94))]">
          <CommandGrid />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neon-cyan/15 px-3 py-4 sm:px-5">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neon-cyan sm:text-xs sm:tracking-[0.24em]">
                Central neural
              </div>
              <h1 className="text-lg font-black sm:text-2xl">Central Neural de Agentes</h1>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Módulos reais conectados ao cérebro central, sem alterar a lógica de entrada.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-black uppercase tracking-[0.1em]">
                <span className="rounded-full border border-neon-cyan/20 bg-neon-cyan/10 px-2 py-1 text-neon-cyan">Fonte: módulos reais</span>
                <span className="rounded-full border border-border/45 bg-background/28 px-2 py-1 text-muted-foreground">Visual sem decisão própria</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge tone={liveReady ? "green" : "amber"} pulse={liveReady}>
                {liveReady ? "Dados ao vivo" : "Aguardando API"}
              </AppBadge>
              <AppBadge tone={scene.badgeTone} pulse={scene.mode !== "observing"}>
                {scene.label}
              </AppBadge>
              <button
                type="button"
                onClick={() => setAnimationsEnabled((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-neon-cyan/25 bg-background/35 px-3 text-xs font-bold text-neon-cyan transition hover:bg-neon-cyan/10"
              >
                {animationsEnabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                <span className="sm:hidden">{animationsEnabled ? "Pausar" : "Animar"}</span>
                <span className="hidden sm:inline">{animationsEnabled ? "Pausar animações" : "Ativar animações"}</span>
              </button>
            </div>
          </div>

          <div className="relative z-10 space-y-4 p-3 sm:p-5">
            <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-neon-cyan/15 bg-black/15 p-0 shadow-[inset_0_0_36px_rgba(0,229,255,0.05)] sm:min-h-[720px] lg:min-h-[760px]">
              <NeonLines agents={agents} sceneMode={scene.mode} animationsEnabled={animationsEnabled} />
              <OutcomeRail side={scene.entrySide} mode={scene.mode} animationsEnabled={animationsEnabled} />

              <CoreStatus scene={scene} animationsEnabled={animationsEnabled} />

              <div className="absolute inset-0 z-20">
                {agents.map((agent) => (
                  <AgentModuleCard
                    key={agent.id}
                    agent={agent}
                    selected={agent.id === selectedAgent.id}
                    animationsEnabled={animationsEnabled}
                    onClick={() => setSelectedId(agent.id)}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-neon-cyan/15 bg-background/28 p-3 backdrop-blur-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neon-cyan">
                    Agentes trabalhando
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Clique em um módulo para ver a leitura completa abaixo.
                  </div>
                </div>
                <AppBadge tone={scene.badgeTone} pulse={scene.mode !== "observing"}>
                  {scene.label}
                </AppBadge>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => setSelectedId(agent.id)}
                  className={`min-w-0 rounded-xl border px-3 py-2 text-left transition ${
                    agent.id === selectedAgent.id
                      ? `${toneClasses[agent.tone].border} ${toneClasses[agent.tone].bg}`
                      : "border-border/50 bg-background/25 hover:border-neon-cyan/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <agent.icon className={`size-4 ${toneClasses[agent.tone].text}`} />
                    <span className="min-w-0 truncate text-xs font-black">{agent.name}</span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-muted-foreground">{agent.status}</div>
                </button>
              ))}
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      <AgentInspector agent={selectedAgent} scene={scene} />
    </div>
  );
}

class AgentsRuntimeBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Central Neural de Agentes falhou em modo visual.", error, info);
  }

  render() {
    if (this.state.hasError) return <AgentsSafeFallback />;
    return this.props.children;
  }
}

function AgentsSafeFallback() {
  return (
    <GlassCard className="border-neon-cyan/25">
      <SectionTitle
        title="Central Neural de Agentes"
        subtitle="Modo seguro ativado. A leitura principal continua funcionando."
        right={<AppBadge tone="amber">Visual em recuperação</AppBadge>}
      />
      <div className="mt-4 rounded-2xl border border-neon-cyan/20 bg-background/35 p-4 text-sm text-muted-foreground">
        A central visual recebeu dados incompletos e foi protegida para não derrubar a página. Os sinais e módulos internos não foram alterados.
      </div>
    </GlassCard>
  );
}

function CommandGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-25">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.055)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(circle,rgba(122,92,255,0.11),transparent_55%)]" />
    </div>
  );
}

function NeonLines({
  agents,
  sceneMode,
  animationsEnabled,
}: {
  agents: AgentInfo[];
  sceneMode: SceneMode;
  animationsEnabled: boolean;
}) {
  const packetPath = buildDataPacketPath(agents);
  const packetColor = sceneColor(sceneMode);
  const packetDuration = sceneMode === "entry" ? "8s" : sceneMode === "risk" || sceneMode === "red" ? "11s" : "15s";

  return (
    <svg className="pointer-events-none absolute inset-0 z-0 block size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="agent-glow">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {agents.map((agent) => {
        const from = agentNodes[agent.id];
        const active = agent.active || sceneMode !== "observing";
        const color = lineColor(agent.tone);
        return (
          <motion.path
            key={agent.id}
            d={`M ${from.x} ${from.y} C ${from.x} ${(from.y + centerNode.y) / 2}, ${centerNode.x} ${(from.y + centerNode.y) / 2}, ${centerNode.x} ${centerNode.y}`}
            stroke={color}
            strokeWidth={active ? 0.34 : 0.2}
            strokeOpacity={active ? 0.62 : 0.2}
            fill="none"
            filter="url(#agent-glow)"
            strokeDasharray="4 7"
            animate={animationsEnabled ? { strokeDashoffset: [0, -18] } : { strokeDashoffset: 0 }}
            transition={{ repeat: animationsEnabled ? Infinity : 0, duration: agent.active ? 1.5 : 3.4, ease: "linear" }}
          />
        );
      })}
      <path
        d={packetPath}
        stroke={packetColor}
        strokeWidth="0.18"
        strokeOpacity="0.14"
        fill="none"
        filter="url(#agent-glow)"
      />
      {animationsEnabled && (
        <>
          <circle r="1.15" fill={packetColor} filter="url(#agent-glow)">
            <animateMotion dur={packetDuration} repeatCount="indefinite" path={packetPath} />
          </circle>
          <circle r="0.72" fill="white" opacity="0.92">
            <animateMotion dur={packetDuration} repeatCount="indefinite" path={packetPath} begin="2.6s" />
          </circle>
        </>
      )}
    </svg>
  );
}

function CoreStatus({
  scene,
  animationsEnabled,
}: {
  scene: ReturnType<typeof buildScene>;
  animationsEnabled: boolean;
}) {
  const coreTone =
    scene.mode === "risk" || scene.mode === "red"
      ? "border-red-400/45 bg-red-500/12 text-red-200"
      : scene.mode === "green" || scene.mode === "entry"
        ? "border-success/45 bg-success/12 text-success"
        : scene.mode === "forming"
          ? "border-neon-purple/45 bg-neon-purple/12 text-neon-purple"
          : "border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan";

  return (
    <motion.div
      className={`absolute left-1/2 top-1/2 z-20 mt-0 w-[172px] max-w-[172px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-2.5 py-3 text-center backdrop-blur-md sm:w-[330px] sm:max-w-[360px] sm:px-4 sm:py-4 ${
        scene.mode === "risk"
          ? "border-red-400/50 bg-red-950/35 text-red-100"
          : scene.mode === "green"
            ? "border-success/50 bg-emerald-950/35 text-emerald-100"
            : "border-neon-cyan/40 bg-background/72 text-foreground"
      }`}
      animate={
        animationsEnabled
          ? { scale: scene.mode === "observing" ? [1, 1.01, 1] : [1, 1.025, 1] }
          : { scale: 1 }
      }
      transition={{ repeat: animationsEnabled ? Infinity : 0, duration: 2.4 }}
    >
      <div className="relative mx-auto mb-2 flex size-12 items-center justify-center sm:mb-3 sm:size-16">
        {scene.voiceActive && (
          <>
            <motion.span
              className="absolute inset-0 rounded-2xl border border-neon-blue/35"
              animate={animationsEnabled ? { scale: [1, 1.35, 1.58], opacity: [0.45, 0.2, 0] } : { scale: 1, opacity: 0.3 }}
              transition={{ repeat: animationsEnabled ? Infinity : 0, duration: 1.9 }}
            />
            <motion.span
              className="absolute inset-0 rounded-2xl border border-neon-cyan/25"
              animate={animationsEnabled ? { scale: [1, 1.2, 1.42], opacity: [0.35, 0.18, 0] } : { scale: 1, opacity: 0.25 }}
              transition={{ repeat: animationsEnabled ? Infinity : 0, duration: 1.9, delay: 0.45 }}
            />
          </>
        )}
        <div className={`relative flex size-10 items-center justify-center rounded-2xl border shadow-[0_0_28px_rgba(0,229,255,0.2)] sm:size-14 ${coreTone}`}>
          <BrainCircuit className="size-5 sm:size-7" />
        </div>
      </div>
      <div className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px] sm:tracking-[0.22em]">
        Cérebro central
      </div>
      <div className="mt-1 text-sm font-black leading-tight sm:text-lg">{scene.message}</div>
      <div className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:mt-2 sm:text-xs sm:leading-relaxed">{scene.detail}</div>
      {scene.entrySide && (
        <div className="mt-2 inline-flex rounded-full border border-neon-cyan/35 bg-neon-cyan/10 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-neon-cyan sm:mt-3 sm:px-3 sm:text-[10px]">
          Alvo {sideLabel(scene.entrySide)}
        </div>
      )}
    </motion.div>
  );
}

function OutcomeRail({
  side,
  mode,
  animationsEnabled,
}: {
  side: string | null;
  mode: SceneMode;
  animationsEnabled: boolean;
}) {
  const options = [
    { label: "Banker", key: "BANKER", x: "9%" },
    { label: "Player", key: "PLAYER", x: "42%" },
    { label: "Tie", key: "TIE", x: "74%" },
  ];
  return (
    <div className="absolute inset-x-3 top-3 z-10 grid grid-cols-3 gap-1.5 sm:inset-x-4 sm:top-4 sm:gap-2">
      {options.map((item) => {
        const active = mode === "entry" && side === item.key;
        return (
          <motion.div
            key={item.key}
            className={`rounded-xl border px-1.5 py-2 text-center text-[10px] font-black uppercase tracking-wider sm:px-3 sm:text-xs ${
              active ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan" : "border-border/45 bg-background/45 text-muted-foreground"
            }`}
            animate={active && animationsEnabled ? { y: [0, -3, 0], scale: [1, 1.04, 1] } : { y: 0, scale: 1 }}
            transition={{ repeat: active && animationsEnabled ? Infinity : 0, duration: 1.3 }}
            style={{ left: item.x }}
          >
            {item.label}
          </motion.div>
        );
      })}
    </div>
  );
}

function AgentModuleCard({
  agent,
  selected,
  animationsEnabled,
  onClick,
}: {
  agent: AgentInfo;
  selected: boolean;
  animationsEnabled: boolean;
  onClick: () => void;
}) {
  const tone = toneClasses[agent.tone];
  const layout = agentNodes[agent.id];
  const inactive = !agent.active && !selected;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`absolute left-[var(--agent-left-sm)] top-[var(--agent-top-sm)] min-w-0 w-[78px] rounded-xl border px-1.5 py-2 text-center backdrop-blur-md transition sm:w-[126px] sm:rounded-2xl sm:px-2.5 sm:py-2.5 ${
        selected ? `${tone.border} ${tone.bg} ${tone.glow}` : "border-border/45 bg-background/48 hover:border-neon-cyan/45"
      } ${inactive ? "opacity-80 saturate-75" : ""} ${selected ? "z-30" : "z-20"}`}
      style={
        {
          "--agent-left-sm": layout.left,
          "--agent-top-sm": layout.top,
        } as CSSProperties
      }
      animate={
        animationsEnabled
          ? {
              y: agent.active ? [0, -6, 0] : [0, -2, 0],
              scale: agent.pulse ? [1, 1.04, 1] : 1,
            }
          : { y: 0, scale: 1 }
      }
      transition={{
        repeat: animationsEnabled ? Infinity : 0,
        duration: agent.active ? 1.25 : 3.2,
        ease: "easeInOut",
      }}
      aria-label={`Abrir detalhes do ${agent.name}`}
    >
      <div className={`mb-1 flex min-h-6 items-end justify-center text-[7px] font-black uppercase leading-tight tracking-normal sm:mb-2 sm:min-h-8 sm:text-[9px] sm:tracking-[0.08em] ${tone.text}`}>
        {agent.module}
      </div>
      <div className={`relative mx-auto flex size-9 items-center justify-center rounded-xl border sm:size-12 sm:rounded-2xl ${tone.border} ${tone.bg}`}>
        <span className={`absolute -right-1 -top-1 size-2 rounded-full ${agent.active ? tone.dot : "bg-muted-foreground/45"} ${agent.pulse ? "animate-status-blink" : ""}`} />
        <agent.icon className={`size-4 sm:size-6 ${tone.text}`} />
      </div>
      <div className={`mt-1 truncate rounded-full border border-white/10 bg-background/45 px-1 py-0.5 text-[8px] font-black sm:mt-2 sm:px-2 sm:py-1 sm:text-[10px] ${tone.text}`}>
        {moduleValue(agent)}
      </div>
    </motion.button>
  );
}

function AgentInspector({
  agent,
  scene,
}: {
  agent: AgentInfo;
  scene: ReturnType<typeof buildScene>;
}) {
  const tone = toneClasses[agent.tone];
  return (
    <GlassCard className="border-neon-cyan/15">
      <SectionTitle
        title={agent.name}
        subtitle={agent.module}
        right={<AppBadge tone={agent.active ? "green" : "muted"}>{agent.active ? "Ativo" : "Observando"}</AppBadge>}
      />
      <div className="mt-4 flex items-center gap-3">
        <div className={`flex size-14 items-center justify-center rounded-2xl border ${tone.border} ${tone.bg} ${tone.glow}`}>
          <agent.icon className={`size-7 ${tone.text}`} />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-black">{agent.status}</div>
          <div className="mt-1 text-xs text-muted-foreground">{agent.lastReading}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <InspectorStat label="Confiança" value={formatPercent(agent.confidence)} />
        <InspectorStat label="Risco" value={formatRisk(agent.risk)} />
        <InspectorStat label="Greens" value={agent.greens ?? "Sem dado"} tone="text-success" />
        <InspectorStat label="Reds" value={agent.reds ?? "Sem dado"} tone="text-red-300" />
      </div>

      <div className="mt-4 rounded-2xl border border-border/50 bg-background/35 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-xs font-black">Cena atual</div>
          <AppBadge tone={scene.badgeTone}>{scene.label}</AppBadge>
        </div>
        <div className="text-xs leading-relaxed text-muted-foreground">{scene.detail}</div>
      </div>

      <div className="mt-4">
        <div className="mb-2 text-xs font-black">Logs recentes</div>
        <div className="space-y-2">
          {agent.logs.length ? (
            agent.logs.slice(0, 6).map((log, index) => (
              <div key={`${agent.id}-${index}-${log}`} className="rounded-xl border border-border/45 bg-secondary/25 px-3 py-2 text-xs">
                {log}
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-border/55 px-3 py-4 text-center text-xs text-muted-foreground">
              Aguardando leitura real desse módulo.
            </div>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function InspectorStat({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string | number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/35 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );
}

function buildScene(data: DashboardData, adaptiveSnapshot: AdaptiveStrategySnapshot, liveReady: boolean) {
  const signal = data.currentSignal ?? {
    id: "safe-waiting",
    side: "NONE",
    status: "waiting",
    protection: "",
    strength: 0,
    lastResult: null,
  };
  const patterns = safePatterns(adaptiveSnapshot);
  const entryScore = safeEntryScore(adaptiveSnapshot);
  const signalSide = signal.side === "BANKER" || signal.side === "PLAYER" || signal.side === "TIE" ? signal.side : null;
  const lastResult = signal.lastResult?.status ?? "";
  const highRisk = isHighRisk(data, adaptiveSnapshot);
  const patternForming =
    patterns.some((pattern) => pattern.status === "quente" || pattern.status === "observacao") ||
    entryScore.finalScore >= 50;
  const entryActive = Boolean(signalSide && (signal.status === "pending" || signal.status === "g1" || signal.status === "tie_watch"));

  if (!liveReady) {
    return {
      mode: "observing" as SceneMode,
      label: "Standby",
      badgeTone: "amber" as const,
      message: "Agentes IA aguardando dados reais",
      detail: "A central anima a leitura quando o backend envia dados ao vivo.",
      entrySide: null,
      voiceActive: false,
      voiceText: "Aguardando conexão com a mesa.",
    };
  }

  if (signal.status === "red" || lastResult === "red") {
    return {
      mode: "red" as SceneMode,
      label: "Recalibração",
      badgeTone: "red" as const,
      message: "Recalibrando leitura",
      detail: "O resultado real veio contra a leitura. Os agentes voltam para observação técnica.",
      entrySide: signalSide,
      voiceActive: true,
      voiceText: "Red confirmado. A IA recalibra a próxima leitura com gestão.",
    };
  }

  if (signal.status === "green" || signal.status === "green_g1" || lastResult === "green" || lastResult === "green_g1") {
    return {
      mode: "green" as SceneMode,
      label: "Green",
      badgeTone: "green" as const,
      message: "Leitura confirmada",
      detail: "A leitura real respeitou o lado acompanhado pelos módulos.",
      entrySide: signalSide,
      voiceActive: true,
      voiceText: "Bateu. Green confirmado. A leitura respeitou o padrão.",
    };
  }

  if (highRisk) {
    return {
      mode: "risk" as SceneMode,
      label: "Risco alto",
      badgeTone: "red" as const,
      message: "Entrada bloqueada por risco",
      detail: data.engineDecision?.reason || "Risk Shield detectou pressão elevada no mercado.",
      entrySide: null,
      voiceActive: true,
      voiceText: "Cuidado. Mercado pesado. Melhor não forçar entrada agora.",
    };
  }

  if (entryActive && signalSide) {
    return {
      mode: "entry" as SceneMode,
      label: "Entrada",
      badgeTone: "green" as const,
      message: "Entrada confirmada",
      detail: `Agentes agrupados em ${sideLabel(signalSide)} com proteção ${signal.protection || "em observação"}.`,
      entrySide: signalSide,
      voiceActive: true,
      voiceText: `Entrada confirmada em ${sideLabel(signalSide)}. Leitura dos módulos internos ativa.`,
    };
  }

  if (patternForming) {
    return {
      mode: "forming" as SceneMode,
      label: "Padrão",
      badgeTone: "purple" as const,
      message: "Padrão em formação",
      detail: "Banco de Estratégias e módulos de leitura estão validando a amostra real.",
      entrySide: entryScore.side,
      voiceActive: true,
      voiceText: "Padrão começando a formar. A IA espera confirmação limpa antes de liberar entrada.",
    };
  }

  return {
    mode: "observing" as SceneMode,
    label: "Observando",
    badgeTone: "blue" as const,
    message: "Agentes IA observando o mercado",
    detail: "Nenhum agente encontrou gatilho limpo para entrada agora.",
    entrySide: null,
    voiceActive: false,
    voiceText: "Mesa em observação.",
  };
}

function buildAgents(data: DashboardData, snapshot: AdaptiveStrategySnapshot, scene: ReturnType<typeof buildScene>): AgentInfo[] {
  const rounds = safeRounds(data.rounds);
  const patterns = safePatterns(snapshot);
  const entryScore = safeEntryScore(snapshot);
  const decisionLogs = safeDecisionLogs(snapshot);
  const tieAlert = data.currentTieAlert ?? {
    id: "safe-tie",
    level: "Baixo",
    confidence: 0,
    validityRounds: 0,
    status: "expired",
  };
  const engineDecision = data.engineDecision ?? { state: "AGUARDAR", reason: "", confidence: 0 };
  const tieScore = data.tieAlertScoreboard ?? { greenTieAlerts: 0, expired: 0, totalAlerts: 0, assertiveness: 0 };
  const surfScore = data.surfAnalyzerScoreboard ?? {
    totalAlerts: 0,
    hits: 0,
    fails: 0,
    expired: 0,
    bankerHits: 0,
    playerHits: 0,
    assertiveness: 0,
    maxBankerSurfHit: 0,
    maxPlayerSurfHit: 0,
    maxBreakDetected: 0,
    maxRetakeDetected: 0,
    currentHitStreak: 0,
  };
  const neural = data.neuralReading;
  const neuralActive = Boolean(neural && neural.mode === "ACTIVE" && typeof neural.numero === "number");
  const surf = data.currentSurfAlert;
  const surfRisk = surf?.surf_break_risk ?? surf?.surf_risk ?? null;
  const surfActive = Boolean(surf?.surf_alert || surf?.surf_phase === "SURF_FORTE" || surf?.surf_phase === "SURF_EXTREMO");
  const tieActive = tieAlert.status === "active";
  const trend = buildTrendSnapshot(rounds);
  const alternation = buildAlternationSnapshot(rounds);
  const doubles = buildDoublesSnapshot(rounds);
  const multiWindow = buildMultiWindowSnapshot(rounds);
  const streak = calculateRoundStreak(rounds);
  const topPattern =
    patterns.find((pattern) => pattern.status === "quente") ??
    patterns.find((pattern) => pattern.status === "observacao") ??
    patterns[0];
  const strategyActive = Boolean(topPattern && (topPattern.status === "quente" || topPattern.status === "observacao"));
  const riskLevel = computeRiskValue(data, snapshot);
  const marketTurnActive =
    engineDecision.state === "ATENCAO" ||
    engineDecision.state === "BLOQUEADO" ||
    ["QUEBRA_SURF", "CORRECAO", "VIRADA_OUTRO_LADO", "RISCO_QUEBRA"].includes(surf?.surf_phase ?? "");
  const exhaustionActive =
    scene.mode === "risk" ||
    riskLevel >= 70 ||
    Boolean(neural?.isSaturated) ||
    surf?.surf_phase === "EXAUSTAO" ||
    streak.count >= 6;
  const learningActive = safeNumber(snapshot.patternsFound) > 0 || safeNumber(snapshot.recordsStored) > 0;
  const neuralMapActive = neuralActive || surfActive || tieActive || strategyActive || marketTurnActive;
  const voiceActive = scene.voiceActive;
  const activeCount = [
    neuralActive,
    surfActive,
    tieActive,
    trend.active,
    alternation.active,
    doubles.active,
    marketTurnActive,
    multiWindow.active,
    exhaustionActive,
    strategyActive,
    learningActive,
    neuralMapActive,
    voiceActive,
  ].filter(Boolean).length;

  return [
    {
      id: "neural",
      name: "Neural Pagante",
      module: "Neural Pagante",
      icon: Radar,
      tone: neuralActive ? "cyan" : "blue",
      status: neuralActive ? `Número ${neural?.numero} ativo` : "Escaneando números",
      lastReading: neuralActive
        ? `${sideLabel(neural?.direcao ?? neural?.origem ?? "BANKER")} em observação`
        : neural?.paganteAlert || "Sem número pagante ativo agora.",
      confidence: numberOrNull(neural?.assertividade),
      risk: neural?.isRedAlert || neural?.isSaturated ? 80 : null,
      logs: compactLogs([
        neural?.paganteAlert,
        neural?.paganteStatus ? `Status: ${neural.paganteStatus}` : "",
        neural?.validade ? `Validade: ${neural.validade}` : "",
      ]),
      greens: numberOrNull(data.neuralScoreboard?.greens ?? neural?.acertos),
      reds: numberOrNull(data.neuralScoreboard?.reds ?? neural?.reds ?? neural?.erros),
      active: neuralActive,
      pulse: neuralActive,
      nodeLabel: "Neural",
    },
    {
      id: "surf",
      name: "Surf Analyzer",
      module: "Surf Analyzer",
      icon: Waves,
      tone: surfActive ? "green" : "cyan",
      status: surfActive ? "Surf detectado" : "Monitorando tendência",
      lastReading: surf?.reason || "Sem surf ativo no momento.",
      confidence: numberOrNull(surf?.surf_confidence),
      risk: numberOrNull(surfRisk),
      logs: compactLogs([
        surf?.surf_phase ? `Fase: ${phaseLabel(surf.surf_phase)}` : "",
        surf?.surf_prediction_side ? `Predição: ${sideLabel(surf.surf_prediction_side)}` : "",
        surf?.reason,
      ]),
      greens: numberOrNull(surfScore.hits),
      reds: numberOrNull(surfScore.reds ?? surfScore.fails),
      active: surfActive,
      pulse: surfActive,
      nodeLabel: "Surf",
    },
    {
      id: "tie",
      name: "Tie Alert",
      module: "Tie Alert",
      icon: CircleDollarSign,
      tone: "amber",
      status: tieActive ? "Alerta de Tie pulsando" : "Empate em observação",
      lastReading: `Nível ${tieAlert.level}. Validade ${tieAlert.validityRounds} rodada(s).`,
      confidence: numberOrNull(tieAlert.confidence),
      risk: tieAlert.level === "Alto" ? 75 : tieAlert.level === "Medio" || tieAlert.level === "Médio" ? 45 : 20,
      logs: compactLogs([
        `Status: ${tieAlert.status}`,
        `Nível: ${tieAlert.level}`,
        `Janela: ${tieAlert.validityRounds} rodada(s)`,
      ]),
      greens: numberOrNull(tieScore.greenTieAlerts),
      reds: numberOrNull(tieScore.expired),
      active: tieActive,
      pulse: tieActive,
      nodeLabel: "Tie",
    },
    {
      id: "trend",
      name: "Tendência",
      module: "Tendência",
      icon: TrendingUp,
      tone: trend.active ? "green" : "blue",
      status: trend.status,
      lastReading: trend.detail,
      confidence: trend.confidence,
      risk: null,
      logs: compactLogs([trend.detail, trend.sample ? `Amostra: ${trend.sample} rodada(s)` : ""]),
      greens: null,
      reds: null,
      active: trend.active,
      pulse: trend.active && scene.mode !== "observing",
      nodeLabel: "Tendência",
    },
    {
      id: "alternation",
      name: "Alternância",
      module: "Alternância",
      icon: Repeat,
      tone: alternation.active ? "purple" : "blue",
      status: alternation.status,
      lastReading: alternation.detail,
      confidence: alternation.confidence,
      risk: null,
      logs: compactLogs([alternation.detail, alternation.sample ? `Amostra: ${alternation.sample} transição(ões)` : ""]),
      greens: null,
      reds: null,
      active: alternation.active,
      pulse: alternation.active && scene.mode === "forming",
      nodeLabel: "Alternância",
    },
    {
      id: "doubles",
      name: "Duplas",
      module: "Duplas",
      icon: Copy,
      tone: doubles.active ? "cyan" : "blue",
      status: doubles.status,
      lastReading: doubles.detail,
      confidence: null,
      risk: null,
      logs: compactLogs([doubles.detail, doubles.total ? `${doubles.total} dupla(s) nas últimas rodadas.` : ""]),
      greens: null,
      reds: null,
      active: doubles.active,
      pulse: doubles.active,
      nodeLabel: "Duplas",
    },
    {
      id: "marketTurn",
      name: "Market Turn",
      module: "Market Turn",
      icon: RefreshCw,
      tone: marketTurnActive ? "amber" : "blue",
      status: marketTurnActive ? "Virada/atenção no mercado" : "Sem virada forte",
      lastReading: engineDecision.reason || surf?.reason || "Mercado sem virada confirmada agora.",
      confidence: numberOrNull(engineDecision.confidence),
      risk: marketTurnActive ? riskLevel : null,
      logs: compactLogs([
        `Engine: ${engineDecision.state}`,
        surf?.surf_phase ? `Surf phase: ${phaseLabel(surf.surf_phase)}` : "",
        engineDecision.reason,
      ]),
      greens: null,
      reds: null,
      active: marketTurnActive,
      pulse: marketTurnActive,
      nodeLabel: "Turn",
    },
    {
      id: "multiWindow",
      name: "Multi Window",
      module: "Multi Window",
      icon: GitBranch,
      tone: multiWindow.active ? "green" : "blue",
      status: multiWindow.status,
      lastReading: multiWindow.detail,
      confidence: multiWindow.confidence,
      risk: null,
      logs: compactLogs([multiWindow.detail, multiWindow.shortWindow, multiWindow.longWindow]),
      greens: null,
      reds: null,
      active: multiWindow.active,
      pulse: multiWindow.active && scene.mode !== "observing",
      nodeLabel: "Janelas",
    },
    {
      id: "exhaustion",
      name: "Exhaustion Module",
      module: "Exhaustion",
      icon: ShieldAlert,
      tone: exhaustionActive ? "red" : "amber",
      status: exhaustionActive ? "Exaustão/risco monitorado" : "Sem exaustão crítica",
      lastReading:
        neural?.isSaturated
          ? "Neural Pagante indicou saturação."
          : surf?.surf_phase === "EXAUSTAO"
            ? "Surf Analyzer indicou exaustão."
            : streak.count >= 6
              ? `Sequência esticada: ${resultLabel(streak.side)} x${streak.count}.`
              : "Sem bloqueio de exaustão ativo.",
      confidence: null,
      risk: riskLevel,
      logs: compactLogs([
        neural?.isSaturated ? "Neural saturado." : "",
        surf?.surf_phase ? `Surf: ${phaseLabel(surf.surf_phase)}` : "",
        streak.count ? `Sequência atual: ${resultLabel(streak.side)} x${streak.count}` : "",
      ]),
      greens: null,
      reds: null,
      active: exhaustionActive,
      pulse: exhaustionActive,
      nodeLabel: "Exaustão",
    },
    {
      id: "strategy",
      name: "Banco de Estratégias",
      module: "Banco de Estratégias",
      icon: DatabaseZap,
      tone: strategyActive ? "purple" : "blue",
      status: topPattern ? statusLabel(topPattern.status) : "Minerando histórico",
      lastReading: topPattern
        ? `${topPattern.label} puxa ${sideLabel(topPattern.direction)}`
        : "Aguardando amostra real mínima.",
      confidence: topPattern && topPattern.occurrences >= safeNumber(snapshot.minOccurrences) ? topPattern.assertiveness : null,
      risk: topPattern?.blocked ? 70 : null,
      logs: compactLogs(decisionLogs.map((log) => log.message).slice(0, 5)),
      greens: topPattern ? topPattern.sg + topPattern.g1 : null,
      reds: numberOrNull(topPattern?.red),
      active: strategyActive,
      pulse: scene.mode === "forming" || strategyActive,
      nodeLabel: "Estratégias",
    },
    {
      id: "learning",
      name: "Aprendizado IA",
      module: "Aprendizado IA",
      icon: BrainCircuit,
      tone: learningActive ? "purple" : "blue",
      status: learningActive ? "Minerando histórico real" : "Aguardando base real",
      lastReading: `${safeNumber(snapshot.recordsStored)} rodada(s) salvas, ${safeNumber(snapshot.patternsFound)} padrão(ões) encontrados.`,
      confidence: entryScore.finalScore > 0 ? entryScore.finalScore : null,
      risk: safeNumber(snapshot.pausedPatterns) > 0 ? 55 : null,
      logs: compactLogs([
        `${safeNumber(snapshot.recordsStored)} registro(s) no aprendizado.`,
        `${safeNumber(snapshot.hotPatterns)} quente(s), ${safeNumber(snapshot.pausedPatterns)} pausado(s).`,
        entryScore.explanation[0],
      ]),
      greens: null,
      reds: null,
      active: learningActive,
      pulse: strategyActive || scene.mode === "forming",
      nodeLabel: "Learning",
    },
    {
      id: "neuralMap",
      name: "Mapa Neural IA",
      module: "Mapa Neural IA",
      icon: Network,
      tone: neuralMapActive ? "cyan" : "blue",
      status: neuralMapActive ? `${activeCount} agente(s) conectado(s)` : "Rede em observação",
      lastReading: "Mapa visual cruza módulos ativos sem criar sinal próprio.",
      confidence: null,
      risk: null,
      logs: compactLogs([
        `Agentes ativos: ${activeCount}`,
        `Cena: ${scene.label}`,
        "Representação visual; não decide entrada sozinha.",
      ]),
      greens: null,
      reds: null,
      active: neuralMapActive,
      pulse: neuralMapActive && scene.mode !== "observing",
      nodeLabel: "Mapa",
    },
    {
      id: "voice",
      name: "Assistente de Voz IA",
      module: "Voz IA",
      icon: voiceActive ? AudioLines : Mic2,
      tone: voiceActive ? "blue" : "cyan",
      status: voiceActive ? "Narrando evento" : "Aguardando evento",
      lastReading: scene.voiceText,
      confidence: null,
      risk: null,
      logs: compactLogs([scene.voiceText, "Provider padrão: Edge TTS com fallback Web Speech."]),
      greens: null,
      reds: null,
      active: voiceActive,
      pulse: voiceActive,
      nodeLabel: "Voz",
    },
  ];
}

function buildTrendSnapshot(rounds: DashboardData["rounds"]) {
  const recent = safeRounds(rounds).slice(-30);
  if (!recent.length) {
    return {
      active: false,
      status: "Aguardando rodadas",
      detail: "Sem base suficiente para ler tendência.",
      confidence: null,
      sample: 0,
    };
  }

  const counts = countResults(recent);
  const leader = maxResult(counts);
  const confidence = roundPercent(counts[leader] / recent.length);
  return {
    active: confidence >= 55 && leader !== "T",
    status: leader === "T" ? "Tie pressionando a janela" : `${resultLabel(leader)} dominante`,
    detail: `${resultLabel(leader)} apareceu ${counts[leader]} vez(es) nas últimas ${recent.length} rodada(s).`,
    confidence,
    sample: recent.length,
  };
}

function buildAlternationSnapshot(rounds: DashboardData["rounds"]) {
  const recent = safeRounds(rounds).slice(-24).filter((round) => round.result !== "T");
  if (recent.length < 2) {
    return {
      active: false,
      status: "Aguardando alternância",
      detail: "Sem transições suficientes para medir alternância.",
      confidence: null,
      sample: 0,
    };
  }

  let switches = 0;
  for (let index = 1; index < recent.length; index += 1) {
    if (recent[index].result !== recent[index - 1].result) switches += 1;
  }
  const transitions = recent.length - 1;
  const confidence = roundPercent(switches / transitions);
  return {
    active: confidence >= 58,
    status: confidence >= 58 ? "Alternância ativa" : "Alternância fraca",
    detail: `${switches} alternância(s) em ${transitions} transição(ões) recentes.`,
    confidence,
    sample: transitions,
  };
}

function buildDoublesSnapshot(rounds: DashboardData["rounds"]) {
  const recent = safeRounds(rounds).slice(-24).filter((round) => round.result !== "T");
  if (recent.length < 2) {
    return {
      active: false,
      status: "Aguardando duplas",
      detail: "Sem base suficiente para ler duplas.",
      total: 0,
    };
  }

  let total = 0;
  for (let index = 1; index < recent.length; index += 1) {
    if (recent[index].result === recent[index - 1].result) total += 1;
  }
  const last = recent.at(-1);
  const beforeLast = recent.at(-2);
  const active = Boolean(last && beforeLast && last.result === beforeLast.result);
  return {
    active,
    status: active ? `Dupla ${resultLabel(last?.result ?? null)} formada` : "Sem dupla na última rodada",
    detail: active
      ? `As duas últimas rodadas repetiram ${resultLabel(last?.result ?? null)}.`
      : `${total} dupla(s) detectada(s) na janela recente.`,
    total,
  };
}

function buildMultiWindowSnapshot(rounds: DashboardData["rounds"]) {
  const safe = safeRounds(rounds);
  const shortWindow = buildWindowLeader(safe.slice(-12), "Janela 12");
  const longWindow = buildWindowLeader(safe.slice(-30), "Janela 30");
  const active = Boolean(shortWindow.side && longWindow.side && shortWindow.side === longWindow.side && shortWindow.side !== "T");
  const confidence =
    shortWindow.confidence !== null && longWindow.confidence !== null
      ? roundPercent((shortWindow.confidence + longWindow.confidence) / 200)
      : null;

  return {
    active,
    status: active ? `${resultLabel(shortWindow.side)} alinhado nas janelas` : "Janelas sem alinhamento limpo",
    detail: active
      ? `${resultLabel(shortWindow.side)} lidera a janela curta e longa.`
      : "As janelas recentes ainda não apontam o mesmo lado.",
    confidence,
    shortWindow: shortWindow.label,
    longWindow: longWindow.label,
  };
}

function buildWindowLeader(rounds: DashboardData["rounds"], label: string) {
  if (!rounds.length) {
    return { side: null as RoundResult | null, confidence: null as number | null, label: `${label}: sem dados` };
  }
  const counts = countResults(rounds);
  const side = maxResult(counts);
  const confidence = roundPercent(counts[side] / rounds.length);
  return { side, confidence, label: `${label}: ${resultLabel(side)} ${confidence.toFixed(1)}%` };
}

function calculateRoundStreak(rounds: DashboardData["rounds"]) {
  const safe = safeRounds(rounds);
  const last = safe[safe.length - 1];
  if (!last) return { side: null as RoundResult | null, count: 0 };
  let count = 0;
  for (let index = safe.length - 1; index >= 0; index -= 1) {
    if (safe[index].result !== last.result) break;
    count += 1;
  }
  return { side: last.result, count };
}

function countResults(rounds: DashboardData["rounds"]) {
  return safeRounds(rounds).reduce(
    (acc, round) => {
      if (round.result === "B" || round.result === "P" || round.result === "T") acc[round.result] += 1;
      return acc;
    },
    { B: 0, P: 0, T: 0 } as Record<RoundResult, number>,
  );
}

function safeRounds(rounds: DashboardData["rounds"] | null | undefined) {
  return Array.isArray(rounds)
    ? rounds.filter((round) => round && (round.result === "B" || round.result === "P" || round.result === "T"))
    : [];
}

function safePatterns(snapshot: Partial<AdaptiveStrategySnapshot> | null | undefined): AdaptivePattern[] {
  return Array.isArray(snapshot?.patterns) ? snapshot.patterns : [];
}

function safeDecisionLogs(snapshot: Partial<AdaptiveStrategySnapshot> | null | undefined) {
  return Array.isArray(snapshot?.decisionLogs) ? snapshot.decisionLogs : [];
}

function safeEntryScore(snapshot: Partial<AdaptiveStrategySnapshot> | null | undefined) {
  const entryScore = snapshot?.entryScore;
  return {
    side: entryScore?.side ?? null,
    finalScore: safeNumber(entryScore?.finalScore),
    allowed: Boolean(entryScore?.allowed),
    parts: Array.isArray(entryScore?.parts) ? entryScore.parts : [],
    explanation: Array.isArray(entryScore?.explanation) ? entryScore.explanation : [],
  };
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function maxResult(counts: Record<RoundResult, number>) {
  return (Object.keys(counts) as RoundResult[]).reduce((best, side) => (counts[side] > counts[best] ? side : best), "B");
}

function roundPercent(value: number) {
  return Math.round(value * 1000) / 10;
}

function isHighRisk(data: DashboardData, snapshot: AdaptiveStrategySnapshot) {
  return data.engineDecision?.state === "BLOQUEADO" || computeRiskValue(data, snapshot) >= 70;
}

function computeRiskValue(data: DashboardData, snapshot: AdaptiveStrategySnapshot) {
  const surfRisk = data.currentSurfAlert?.surf_break_risk ?? data.currentSurfAlert?.surf_risk ?? 0;
  const tieRisk = data.currentTieAlert?.status === "active" && data.currentTieAlert.level === "Alto" ? 75 : 0;
  const neuralRisk = data.neuralReading?.isRedAlert || data.neuralReading?.isSaturated ? 80 : 0;
  const engineRisk = data.engineDecision?.state === "BLOQUEADO" ? Math.max(70, safeNumber(data.engineDecision.confidence)) : 0;
  const strategyRisk = safeNumber(snapshot.pausedPatterns) > 0 ? 55 : 0;
  return Math.max(surfRisk, tieRisk, neuralRisk, engineRisk, strategyRisk);
}

function compactLogs(values: Array<string | null | undefined | false>) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function numberOrNull(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatPercent(value: number | null) {
  return value === null ? "Sem dado" : `${value.toFixed(1)}%`;
}

function formatRisk(value: number | null) {
  if (value === null) return "Sem dado";
  if (value >= 70) return `${Math.round(value)} alto`;
  if (value >= 40) return `${Math.round(value)} médio`;
  return `${Math.round(value)} controlado`;
}

function moduleValue(agent: AgentInfo) {
  if (agent.confidence !== null) return `${agent.confidence.toFixed(1)}%`;
  if (agent.risk !== null) return `Risco ${Math.round(agent.risk)}`;
  return agent.active ? "Ativo" : "Observando";
}

function statusLabel(status: AdaptivePattern["status"]) {
  if (status === "observacao") return "Observação";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function buildDataPacketPath(agents: AgentInfo[]) {
  const ordered = agents.map((agent) => agentNodes[agent.id]);
  if (!ordered.length) return `M ${centerNode.x} ${centerNode.y}`;

  const [first, ...rest] = ordered;
  const segments = rest.map((node) => `Q ${centerNode.x} ${centerNode.y}, ${node.x} ${node.y}`).join(" ");
  return `M ${first.x} ${first.y} ${segments} Q ${centerNode.x} ${centerNode.y}, ${first.x} ${first.y}`;
}

function sceneColor(mode: SceneMode) {
  if (mode === "green" || mode === "entry") return "rgba(0,255,153,0.95)";
  if (mode === "risk") return "rgba(255,193,7,0.95)";
  if (mode === "red") return "rgba(248,113,113,0.95)";
  if (mode === "forming") return "rgba(168,85,247,0.95)";
  return "rgba(0,229,255,0.95)";
}

function sideLabel(side: SignalSide | "TIE" | "NONE" | null | undefined) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "Sem lado";
}

function resultLabel(result: RoundResult | null | undefined) {
  if (result === "B") return "Banker";
  if (result === "P") return "Player";
  if (result === "T") return "Tie";
  return "Sem lado";
}

function phaseLabel(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function lineColor(tone: AgentTone) {
  if (tone === "green") return "rgba(0,255,153,0.88)";
  if (tone === "amber") return "rgba(255,193,7,0.88)";
  if (tone === "purple") return "rgba(168,85,247,0.88)";
  if (tone === "red") return "rgba(248,113,113,0.9)";
  if (tone === "blue") return "rgba(59,130,246,0.88)";
  return "rgba(0,229,255,0.9)";
}
