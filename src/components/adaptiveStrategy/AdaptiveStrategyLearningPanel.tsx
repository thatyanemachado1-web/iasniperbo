import {
  Activity,
  AlertTriangle,
  BarChart3,
  Database,
  Flame,
  PauseCircle,
  ShieldCheck,
} from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { AdaptivePattern, AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";

type Props = {
  snapshot: AdaptiveStrategySnapshot;
  onReset: () => void;
};

export function AdaptiveStrategyLearningPanel({ snapshot, onReset }: Props) {
  const strongest = snapshot.patterns
    .filter((pattern) => pattern.occurrences >= snapshot.minOccurrences)
    .sort((a, b) => b.assertiveness - a.assertiveness)
    .slice(0, 6);
  const volume = [...snapshot.patterns].sort((a, b) => b.occurrences - a.occurrences).slice(0, 6);
  const hot = snapshot.patterns.filter((pattern) => pattern.status === "quente").slice(0, 6);
  const paused = snapshot.patterns.filter((pattern) => pattern.status === "pausado").slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-neon-cyan">Aprendizado IA</div>
          <h1 className="text-xl font-black">Adaptive Strategy Learning Engine</h1>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Motor independente para minerar padroes reais de Bac Bo, pontuar estrategias e bloquear
            entradas com amostra fraca.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone={snapshot.syncStatus.mode === "database" ? "green" : "amber"}>
            {snapshot.syncStatus.mode === "database" ? "Banco ativo" : "Historico local"}
          </AppBadge>
          <AppBadge tone={snapshot.entryScore.allowed ? "green" : "red"}>
            Score {snapshot.entryScore.finalScore}/100
          </AppBadge>
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-red-400/50 hover:text-red-300"
          >
            Reiniciar motor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Metric icon={Database} label="Rodadas salvas" value={snapshot.recordsStored} tone="cyan" />
        <Metric icon={BarChart3} label="Padroes" value={snapshot.patternsFound} tone="blue" />
        <Metric icon={Flame} label="Quentes" value={snapshot.hotPatterns} tone="green" />
        <Metric icon={PauseCircle} label="Pausados" value={snapshot.pausedPatterns} tone="red" />
        <Metric icon={ShieldCheck} label="Min. ocorr." value={snapshot.minOccurrences} tone="amber" />
        <Metric icon={Activity} label="Min. assert." value={`${snapshot.minAssertiveness}%`} tone="purple" />
      </div>

      <GlassCard>
        <SectionTitle
          title="Score final da entrada"
          subtitle={snapshot.syncStatus.message}
          right={<AppBadge tone={snapshot.entryScore.allowed ? "green" : "red"}>{snapshot.entryScore.allowed ? "Entrada liberada" : "Bloqueada"}</AppBadge>}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <div className="text-4xl font-black text-neon-cyan">{snapshot.entryScore.finalScore}</div>
            <div className="mt-1 text-xs text-muted-foreground">Entrada so aparece acima de 75.</div>
            <div className="mt-4 h-2 rounded-full bg-secondary">
              <div
                className={`h-2 rounded-full ${snapshot.entryScore.allowed ? "bg-success" : "bg-red-500"}`}
                style={{ width: `${snapshot.entryScore.finalScore}%` }}
              />
            </div>
            <div className="mt-4 space-y-1.5 text-xs">
              {snapshot.entryScore.explanation.map((line) => (
                <div key={line} className="rounded-lg bg-secondary/35 px-3 py-2">
                  {line}
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {snapshot.entryScore.parts.map((part) => (
              <div key={part.label} className="rounded-xl border border-border/50 bg-background/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{part.label}</div>
                  <span className={part.value < 0 ? "text-red-300" : part.value > 0 ? "text-success" : "text-muted-foreground"}>
                    {part.value > 0 ? "+" : ""}
                    {part.value}
                  </span>
                </div>
                <div className="mt-2 text-xs">{part.reason}</div>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <RankingCard title="Top Banker" patterns={snapshot.ranking.banker} />
        <RankingCard title="Top Player" patterns={snapshot.ranking.player} />
        <RankingCard title="Top Tie" patterns={snapshot.ranking.tie} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <PatternList title="Padroes quentes" patterns={hot} empty="Nenhum padrao quente com amostra real ainda." />
        <PatternList title="Padroes pausados" patterns={paused} empty="Nenhum padrao pausado agora." />
        <PatternList title="Maior assertividade" patterns={strongest} empty="Aguardando 30 ocorrencias por padrao." />
        <PatternList title="Maior volume" patterns={volume} empty="Aguardando historico real." />
        <PatternList title="Top por mesa" patterns={snapshot.ranking.byTable} empty="Aguardando dados por mesa." />
        <PatternList title="Top por horario" patterns={snapshot.ranking.byHour} empty="Aguardando dados por horario." />
      </div>

      <GlassCard>
        <SectionTitle
          title="Logs de decisao"
          subtitle="Cada decisao fica explicada para auditoria, sem porcentagem inventada."
          right={<AppBadge tone="blue">Tempo real</AppBadge>}
        />
        <div className="mt-3 space-y-2">
          {snapshot.decisionLogs.map((log) => (
            <div key={log.id} className="rounded-xl border border-border/50 bg-background/35 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{log.message}</span>
                {log.status && <StatusBadge status={log.status} />}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Database;
  label: string;
  value: number | string;
  tone: "cyan" | "blue" | "green" | "red" | "amber" | "purple";
}) {
  const colors = {
    cyan: "text-neon-cyan",
    blue: "text-neon-blue",
    green: "text-success",
    red: "text-red-300",
    amber: "text-gold",
    purple: "text-neon-purple",
  };
  return (
    <GlassCard className="p-3">
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${colors[tone]}`} />
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      </div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </GlassCard>
  );
}

function RankingCard({ title, patterns }: { title: string; patterns: AdaptivePattern[] }) {
  return (
    <GlassCard>
      <SectionTitle title={title} right={<AppBadge tone="green">Ranking</AppBadge>} />
      <div className="mt-3 space-y-2">
        {patterns.length ? (
          patterns.map((pattern) => <PatternRow key={pattern.id} pattern={pattern} />)
        ) : (
          <EmptyLine text="Sem padrao aprovado ainda." />
        )}
      </div>
    </GlassCard>
  );
}

function PatternList({ title, patterns, empty }: { title: string; patterns: AdaptivePattern[]; empty: string }) {
  return (
    <GlassCard>
      <SectionTitle title={title} />
      <div className="mt-3 space-y-2">
        {patterns.length ? patterns.map((pattern) => <PatternRow key={pattern.id} pattern={pattern} />) : <EmptyLine text={empty} />}
      </div>
    </GlassCard>
  );
}

function PatternRow({ pattern }: { pattern: AdaptivePattern }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold">{pattern.label}</div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            {pattern.kind} | puxa {sideLabel(pattern.direction)} | {pattern.occurrences}x
          </div>
        </div>
        <StatusBadge status={pattern.status} />
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-[11px]">
        <SmallStat label="SG" value={pattern.sg} tone="text-success" />
        <SmallStat label="G1" value={pattern.g1} tone="text-neon-cyan" />
        <SmallStat label="RED" value={pattern.red} tone="text-red-300" />
        <SmallStat label="%" value={`${pattern.assertiveness.toFixed(1)}%`} tone="text-gold" />
      </div>
      {pattern.pausedReason && (
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-[11px] text-red-200">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          {pattern.pausedReason}
        </div>
      )}
    </div>
  );
}

function SmallStat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-black ${tone}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: AdaptivePattern["status"] }) {
  const tone = status === "quente" ? "green" : status === "pausado" ? "red" : status === "observacao" ? "amber" : "blue";
  return <AppBadge tone={tone}>{status}</AppBadge>;
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">{text}</div>;
}

function sideLabel(side: AdaptivePattern["direction"]) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  return "Tie";
}
