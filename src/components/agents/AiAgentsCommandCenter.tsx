import { useMemo, useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import {
  AudioLines,
  CircleDollarSign,
  DatabaseZap,
  Pause,
  Play,
  Radar,
  ShieldAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { AdaptivePattern, AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";
import type { DashboardData, SignalSide } from "@/types/dashboard";

type SceneMode = "observing" | "forming" | "entry" | "green" | "red" | "risk";
type AgentId = "neural" | "surf" | "tie" | "strategy" | "risk" | "voice";
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
  position: { left: string; top: string; mobileLeft: string; mobileTop: string };
};

type Props = {
  data: DashboardData;
  adaptiveSnapshot: AdaptiveStrategySnapshot;
  liveReady: boolean;
};

const toneClasses: Record<AgentTone, { text: string; border: string; bg: string; glow: string; dot: string }> = {
  cyan: {
    text: "text-neon-cyan",
    border: "border-neon-cyan/55",
    bg: "bg-neon-cyan/15",
    glow: "shadow-[0_0_34px_rgba(0,229,255,0.38)]",
    dot: "bg-neon-cyan",
  },
  green: {
    text: "text-success",
    border: "border-success/55",
    bg: "bg-success/15",
    glow: "shadow-[0_0_34px_rgba(0,255,153,0.34)]",
    dot: "bg-success",
  },
  amber: {
    text: "text-warning",
    border: "border-warning/55",
    bg: "bg-warning/15",
    glow: "shadow-[0_0_34px_rgba(255,193,7,0.34)]",
    dot: "bg-warning",
  },
  purple: {
    text: "text-neon-purple",
    border: "border-neon-purple/55",
    bg: "bg-neon-purple/15",
    glow: "shadow-[0_0_34px_rgba(168,85,247,0.34)]",
    dot: "bg-neon-purple",
  },
  red: {
    text: "text-red-300",
    border: "border-red-400/60",
    bg: "bg-red-500/15",
    glow: "shadow-[0_0_38px_rgba(239,68,68,0.38)]",
    dot: "bg-red-400",
  },
  blue: {
    text: "text-neon-blue",
    border: "border-neon-blue/55",
    bg: "bg-neon-blue/15",
    glow: "shadow-[0_0_34px_rgba(59,130,246,0.34)]",
    dot: "bg-neon-blue",
  },
};

const agentNodes: Record<AgentId, { x: number; y: number }> = {
  neural: { x: 24, y: 25 },
  surf: { x: 71, y: 24 },
  tie: { x: 18, y: 66 },
  strategy: { x: 49, y: 59 },
  risk: { x: 75, y: 67 },
  voice: { x: 50, y: 18 },
};

const moduleNodes: Record<AgentId, { x: number; y: number }> = {
  neural: { x: 21, y: 44 },
  surf: { x: 82, y: 43 },
  tie: { x: 26, y: 80 },
  strategy: { x: 50, y: 84 },
  risk: { x: 75, y: 81 },
  voice: { x: 50, y: 34 },
};

export function AiAgentsCommandCenter({ data, adaptiveSnapshot, liveReady }: Props) {
  const [selectedId, setSelectedId] = useState<AgentId>("neural");
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const scene = useMemo(() => buildScene(data, adaptiveSnapshot, liveReady), [adaptiveSnapshot, data, liveReady]);
  const agents = useMemo(() => buildAgents(data, adaptiveSnapshot, scene), [adaptiveSnapshot, data, scene]);
  const selectedAgent = agents.find((agent) => agent.id === selectedId) ?? agents[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <GlassCard className="min-h-[640px] p-0 sm:min-h-[680px]">
        <div className="relative min-h-[640px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_top,rgba(0,229,255,0.13),transparent_35%),linear-gradient(145deg,rgba(4,10,26,0.96),rgba(7,10,24,0.92))] sm:min-h-[680px]">
          <CommandGrid />
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-neon-cyan/15 px-3 py-4 sm:px-5">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neon-cyan sm:text-xs sm:tracking-[0.24em]">
                Central de comando
              </div>
              <h1 className="text-lg font-black sm:text-2xl">Central de Agentes IA</h1>
              <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                Agentes digitais representam os módulos reais trabalhando no mercado ao vivo.
              </p>
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

          <div className="relative z-10 grid gap-4 p-3 sm:p-5 lg:grid-cols-[1fr_220px]">
            <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-neon-cyan/15 bg-black/20 sm:min-h-[510px]">
              <NeonLines agents={agents} sceneMode={scene.mode} animationsEnabled={animationsEnabled} />
              <OutcomeRail side={scene.entrySide} mode={scene.mode} animationsEnabled={animationsEnabled} />
              <ModuleNode
                id="neural"
                label="Números Pagantes"
                value={moduleValue(agents[0])}
                x="12%"
                y="42%"
                mobileX="7%"
                mobileY="52%"
                active={agents[0].active}
              />
              <ModuleNode
                id="surf"
                label="Surf Analyzer"
                value={moduleValue(agents[1])}
                x="72%"
                y="42%"
                mobileX="58%"
                mobileY="52%"
                active={agents[1].active}
              />
              <ModuleNode
                id="tie"
                label="Tie Alert"
                value={moduleValue(agents[2])}
                x="12%"
                y="78%"
                mobileX="4%"
                mobileY="82%"
                active={agents[2].active}
              />
              <ModuleNode
                id="strategy"
                label="Banco de Estratégias"
                value={moduleValue(agents[3])}
                x="38%"
                y="79%"
                mobileX="36%"
                mobileY="82%"
                active={agents[3].active}
              />
              <ModuleNode
                id="risk"
                label="Risk Shield"
                value={moduleValue(agents[4])}
                x="68%"
                y="78%"
                mobileX="68%"
                mobileY="82%"
                active={agents[4].active}
              />

              {agents.map((agent, index) => (
                <AgentBot
                  key={agent.id}
                  agent={agent}
                  selected={agent.id === selectedAgent.id}
                  scene={scene}
                  index={index}
                  animationsEnabled={animationsEnabled}
                  onClick={() => setSelectedId(agent.id)}
                />
              ))}

              <motion.div
                className={`absolute left-1/2 top-[34%] z-20 w-[min(86%,320px)] -translate-x-1/2 rounded-2xl border px-3 py-3 text-center backdrop-blur-md sm:top-[36%] sm:w-[min(92%,360px)] sm:px-4 ${
                  scene.mode === "risk"
                    ? "border-red-400/50 bg-red-950/35 text-red-100"
                    : scene.mode === "green"
                      ? "border-success/50 bg-emerald-950/35 text-emerald-100"
                      : "border-neon-cyan/40 bg-background/65 text-foreground"
                }`}
                animate={
                  animationsEnabled
                    ? { scale: scene.mode === "observing" ? [1, 1.01, 1] : [1, 1.04, 1] }
                    : { scale: 1 }
                }
                transition={{ repeat: animationsEnabled ? Infinity : 0, duration: 2.4 }}
              >
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Status operacional
                </div>
                <div className="mt-1 text-base font-black sm:text-lg">{scene.message}</div>
                <div className="mt-1 text-xs text-muted-foreground">{scene.detail}</div>
              </motion.div>

              <VoiceBubble
                visible={scene.voiceActive}
                text={scene.voiceText}
                animationsEnabled={animationsEnabled}
              />
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
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
      </GlassCard>

      <AgentInspector agent={selectedAgent} scene={scene} />
    </div>
  );
}

function CommandGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 opacity-35">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,229,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.07)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-[radial-gradient(circle,rgba(122,92,255,0.16),transparent_55%)]" />
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
  return (
    <svg className="pointer-events-none absolute inset-0 z-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
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
        const to = moduleNodes[agent.id];
        const active = agent.active || sceneMode !== "observing";
        const color = lineColor(agent.tone);
        return (
          <motion.path
            key={agent.id}
            d={`M ${from.x} ${from.y} C ${(from.x + to.x) / 2} ${from.y - 8}, ${(from.x + to.x) / 2} ${to.y + 8}, ${to.x} ${to.y}`}
            stroke={color}
            strokeWidth={active ? 0.55 : 0.32}
            strokeOpacity={active ? 0.82 : 0.34}
            fill="none"
            filter="url(#agent-glow)"
            strokeDasharray="5 7"
            animate={animationsEnabled ? { strokeDashoffset: [0, -24] } : { strokeDashoffset: 0 }}
            transition={{ repeat: animationsEnabled ? Infinity : 0, duration: agent.active ? 1.5 : 3.4, ease: "linear" }}
          />
        );
      })}
    </svg>
  );
}

function ModuleNode({
  label,
  value,
  x,
  y,
  mobileX,
  mobileY,
  active,
}: {
  id: AgentId;
  label: string;
  value: string;
  x: string;
  y: string;
  mobileX: string;
  mobileY: string;
  active: boolean;
}) {
  return (
    <motion.div
      className={`absolute left-[var(--node-left)] top-[var(--node-top)] z-10 w-[6.25rem] rounded-xl border bg-background/70 px-2 py-2 backdrop-blur-md sm:left-[var(--node-left-sm)] sm:top-[var(--node-top-sm)] sm:w-40 sm:px-3 ${
        active ? "border-neon-cyan/45 shadow-[0_0_22px_rgba(0,229,255,0.22)]" : "border-border/45"
      }`}
      style={
        {
          "--node-left": mobileX,
          "--node-top": mobileY,
          "--node-left-sm": x,
          "--node-top-sm": y,
        } as CSSProperties
      }
      animate={active ? { scale: [1, 1.035, 1] } : { scale: 1 }}
      transition={{ repeat: active ? Infinity : 0, duration: 1.9 }}
    >
      <div className="truncate text-[9px] uppercase tracking-wider text-muted-foreground sm:text-[10px]">{label}</div>
      <div className="mt-1 truncate text-[11px] font-bold sm:text-xs">{value}</div>
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

function AgentBot({
  agent,
  selected,
  scene,
  index,
  animationsEnabled,
  onClick,
}: {
  agent: AgentInfo;
  selected: boolean;
  scene: ReturnType<typeof buildScene>;
  index: number;
  animationsEnabled: boolean;
  onClick: () => void;
}) {
  const tone = toneClasses[agent.tone];
  const drift = agent.active ? 10 : 5;
  const entryShift =
    scene.mode === "entry" && scene.entrySide
      ? scene.entrySide === "BANKER"
        ? -22
        : scene.entrySide === "PLAYER"
          ? 22
          : 0
      : 0;
  const riskFront = scene.mode === "risk" && agent.id === "risk";
  const celebrate = scene.mode === "green";
  const recalibrate = scene.mode === "red";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`absolute left-[var(--agent-left)] top-[var(--agent-top)] z-20 flex w-20 flex-col items-center gap-1 rounded-2xl border px-1.5 py-2 text-center backdrop-blur-md transition sm:left-[var(--agent-left-sm)] sm:top-[var(--agent-top-sm)] sm:w-24 sm:px-2 ${
        selected ? `${tone.border} ${tone.bg} ${tone.glow}` : "border-border/45 bg-background/45 hover:border-neon-cyan/45"
      } ${riskFront ? "z-30" : ""}`}
      style={
        {
          "--agent-left": agent.position.mobileLeft,
          "--agent-top": agent.position.mobileTop,
          "--agent-left-sm": agent.position.left,
          "--agent-top-sm": agent.position.top,
        } as CSSProperties
      }
      animate={
        animationsEnabled
          ? {
              x: recalibrate ? [entryShift, entryShift - 6, entryShift + 6, entryShift] : [entryShift, entryShift + drift, entryShift - drift * 0.65, entryShift],
              y: celebrate ? [0, -12, 0, -8, 0] : riskFront ? [-6, -11, -6] : [0, -5 - index * 0.6, 4, 0],
              rotate: recalibrate ? [0, -3, 3, 0] : celebrate ? [0, 4, -4, 0] : 0,
              scale: agent.pulse || riskFront ? [1, 1.08, 1] : 1,
            }
          : { x: entryShift, y: 0, rotate: 0, scale: 1 }
      }
      transition={{
        repeat: animationsEnabled ? Infinity : 0,
        duration: agent.active || riskFront ? 1.35 : 3.2 + index * 0.15,
        ease: "easeInOut",
      }}
      aria-label={`Abrir detalhes do ${agent.name}`}
    >
      <div className={`relative flex size-9 items-center justify-center rounded-full border sm:size-11 ${tone.border} ${tone.bg}`}>
        <span className={`absolute -top-1.5 size-2 rounded-full ${tone.dot} ${agent.pulse ? "animate-status-blink" : ""}`} />
        <agent.icon className={`size-4 sm:size-5 ${tone.text}`} />
      </div>
      <div className="flex max-w-full items-center gap-1">
        <span className={`size-1.5 rounded-full ${agent.active ? tone.dot : "bg-muted-foreground/40"}`} />
        <span className="min-w-0 truncate text-[9px] font-black sm:text-[10px]">{agent.nodeLabel}</span>
      </div>
      <div className="h-2.5 w-9 rounded-b-full border-x border-b border-current/30 opacity-70 sm:h-3 sm:w-10" />
    </motion.button>
  );
}

function VoiceBubble({
  visible,
  text,
  animationsEnabled,
}: {
  visible: boolean;
  text: string;
  animationsEnabled: boolean;
}) {
  if (!visible) return null;
  return (
    <motion.div
      className="absolute left-3 right-3 top-16 z-30 rounded-2xl border border-neon-blue/45 bg-background/80 px-3 py-3 text-xs shadow-[0_0_30px_rgba(59,130,246,0.24)] backdrop-blur-md sm:left-auto sm:right-5 sm:top-24 sm:max-w-[280px] sm:px-4"
      initial={{ opacity: 0, y: 12 }}
      animate={animationsEnabled ? { opacity: 1, y: [0, -4, 0] } : { opacity: 1, y: 0 }}
      transition={{ repeat: animationsEnabled ? Infinity : 0, duration: 2 }}
    >
      <div className="mb-1 flex items-center gap-2 text-neon-blue">
        <AudioLines className="size-4" />
        <span className="text-[10px] font-black uppercase tracking-wider">Agente Voz</span>
      </div>
      {text}
    </motion.div>
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
    <GlassCard className="xl:sticky xl:top-20">
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
  const signal = data.currentSignal;
  const signalSide = signal.side === "BANKER" || signal.side === "PLAYER" || signal.side === "TIE" ? signal.side : null;
  const lastResult = signal.lastResult?.status ?? "";
  const highRisk = isHighRisk(data, adaptiveSnapshot);
  const patternForming =
    adaptiveSnapshot.patterns.some((pattern) => pattern.status === "quente" || pattern.status === "observacao") ||
    adaptiveSnapshot.entryScore.finalScore >= 50;
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
      detail: data.engineDecision.reason || "Risk Shield detectou pressão elevada no mercado.",
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
      entrySide: adaptiveSnapshot.entryScore.side,
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
  const neural = data.neuralReading;
  const neuralActive = Boolean(neural && neural.mode === "ACTIVE" && typeof neural.numero === "number");
  const surf = data.currentSurfAlert;
  const surfRisk = surf?.surf_break_risk ?? surf?.surf_risk ?? null;
  const surfActive = Boolean(surf?.surf_alert || surf?.surf_phase === "SURF_FORTE" || surf?.surf_phase === "SURF_EXTREMO");
  const tieActive = data.currentTieAlert.status === "active";
  const topPattern =
    snapshot.patterns.find((pattern) => pattern.status === "quente") ??
    snapshot.patterns.find((pattern) => pattern.status === "observacao") ??
    snapshot.patterns[0];
  const strategyActive = Boolean(topPattern && (topPattern.status === "quente" || topPattern.status === "observacao"));
  const riskLevel = computeRiskValue(data, snapshot);
  const riskActive = scene.mode === "risk" || riskLevel >= 70;
  const voiceActive = scene.voiceActive;

  return [
    {
      id: "neural",
      name: "Agente Neural Pagante",
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
      position: { left: "18%", top: "18%", mobileLeft: "7%", mobileTop: "18%" },
    },
    {
      id: "surf",
      name: "Agente Surf",
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
      greens: numberOrNull(data.surfAnalyzerScoreboard?.hits),
      reds: numberOrNull(data.surfAnalyzerScoreboard?.reds ?? data.surfAnalyzerScoreboard?.fails),
      active: surfActive,
      pulse: surfActive,
      nodeLabel: "Surf",
      position: { left: "70%", top: "18%", mobileLeft: "67%", mobileTop: "18%" },
    },
    {
      id: "tie",
      name: "Agente Tie",
      module: "Tie Alert",
      icon: CircleDollarSign,
      tone: "amber",
      status: tieActive ? "Alerta de Tie pulsando" : "Empate em observação",
      lastReading: `Nível ${data.currentTieAlert.level}. Validade ${data.currentTieAlert.validityRounds} rodada(s).`,
      confidence: numberOrNull(data.currentTieAlert.confidence),
      risk: data.currentTieAlert.level === "Alto" ? 75 : data.currentTieAlert.level === "Medio" || data.currentTieAlert.level === "Médio" ? 45 : 20,
      logs: compactLogs([
        `Status: ${data.currentTieAlert.status}`,
        `Nível: ${data.currentTieAlert.level}`,
        `Janela: ${data.currentTieAlert.validityRounds} rodada(s)`,
      ]),
      greens: numberOrNull(data.tieAlertScoreboard.greenTieAlerts),
      reds: numberOrNull(data.tieAlertScoreboard.expired),
      active: tieActive,
      pulse: tieActive,
      nodeLabel: "Tie",
      position: { left: "12%", top: "58%", mobileLeft: "7%", mobileTop: "66%" },
    },
    {
      id: "strategy",
      name: "Agente Estratégias",
      module: "Banco de Estratégias",
      icon: DatabaseZap,
      tone: strategyActive ? "purple" : "blue",
      status: topPattern ? statusLabel(topPattern.status) : "Minerando histórico",
      lastReading: topPattern
        ? `${topPattern.label} puxa ${sideLabel(topPattern.direction)}`
        : "Aguardando amostra real mínima.",
      confidence: topPattern && topPattern.occurrences >= snapshot.minOccurrences ? topPattern.assertiveness : null,
      risk: topPattern?.blocked ? 70 : null,
      logs: compactLogs(snapshot.decisionLogs.map((log) => log.message).slice(0, 5)),
      greens: topPattern ? topPattern.sg + topPattern.g1 : null,
      reds: numberOrNull(topPattern?.red),
      active: strategyActive,
      pulse: scene.mode === "forming" || strategyActive,
      nodeLabel: "Estratégias",
      position: { left: "44%", top: "57%", mobileLeft: "39%", mobileTop: "66%" },
    },
    {
      id: "risk",
      name: "Agente Risk",
      module: "Risk Shield",
      icon: ShieldAlert,
      tone: riskActive ? "red" : "amber",
      status: riskActive ? "Risco alto detectado" : "Risco monitorado",
      lastReading: data.engineDecision.reason || "Sem bloqueio ativo.",
      confidence: numberOrNull(data.engineDecision.confidence),
      risk: riskLevel,
      logs: compactLogs([
        `Engine: ${data.engineDecision.state}`,
        data.engineDecision.reason,
        snapshot.pausedPatterns ? `${snapshot.pausedPatterns} padrão(ões) pausado(s)` : "",
      ]),
      greens: null,
      reds: null,
      active: riskActive,
      pulse: riskActive,
      nodeLabel: "Risk",
      position: { left: "72%", top: "59%", mobileLeft: "68%", mobileTop: "66%" },
    },
    {
      id: "voice",
      name: "Agente Voz",
      module: "Voz IA Local",
      icon: AudioLines,
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
      position: { left: "45%", top: "18%", mobileLeft: "39%", mobileTop: "26%" },
    },
  ];
}

function isHighRisk(data: DashboardData, snapshot: AdaptiveStrategySnapshot) {
  return data.engineDecision.state === "BLOQUEADO" || computeRiskValue(data, snapshot) >= 70;
}

function computeRiskValue(data: DashboardData, snapshot: AdaptiveStrategySnapshot) {
  const surfRisk = data.currentSurfAlert?.surf_break_risk ?? data.currentSurfAlert?.surf_risk ?? 0;
  const tieRisk = data.currentTieAlert.status === "active" && data.currentTieAlert.level === "Alto" ? 75 : 0;
  const neuralRisk = data.neuralReading?.isRedAlert || data.neuralReading?.isSaturated ? 80 : 0;
  const engineRisk = data.engineDecision.state === "BLOQUEADO" ? Math.max(70, data.engineDecision.confidence) : 0;
  const strategyRisk = snapshot.pausedPatterns > 0 ? 55 : 0;
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

function sideLabel(side: SignalSide | "TIE" | "NONE" | null | undefined) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
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
