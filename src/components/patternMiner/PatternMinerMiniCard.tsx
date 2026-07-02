import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { formatPercent, formatPulledSide } from "@/patternMiner/PatternMinerDisplay";
import type {
  PatternMinerAlert,
  PatternMinerSnapshot,
  PatternMinerStrategy,
} from "@/types/patternMiner";

export function PatternMinerMiniCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  const confirmedAlert = findConfirmedPatternAlert(snapshot);
  const monitoringAlert = findLiveMonitoringAlert(snapshot);
  const monitoringStrategy = monitoringAlert?.strategy;
  const formationStrategies = buildFormationStrategies(snapshot, [
    confirmedAlert?.strategy.id,
    monitoringStrategy?.id,
  ]).slice(0, 2);

  return (
    <GlassCard className="h-full rounded-xl border-neon-cyan/35 p-3">
      <div className="flex h-full min-w-0 flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl btn-primary-grad glow-blue">
            <BrainCircuit className="size-4" />
          </div>

          <div className="min-w-0 text-base font-black leading-tight">Padrões IA</div>
        </div>

        <div className="min-w-0 w-full self-stretch">
          {!confirmedAlert && monitoringStrategy && (
            <PatternLiveStatusHeader
              strategy={monitoringStrategy}
              progress={monitoringAlert?.progress}
              isUsingRealData={isUsingRealData}
            />
          )}
          {confirmedAlert ? (
            <LivePatternStatusBlock alert={confirmedAlert} />
          ) : monitoringStrategy ? (
            <MonitoringPatternBlock
              alert={monitoringAlert}
              isUsingRealData={isUsingRealData}
            />
          ) : (
            <WaitingConfirmedEntryBlock isUsingRealData={isUsingRealData} />
          )}
        </div>

        <MiniScoreboard snapshot={snapshot} />
        <MiniFormationList strategies={formationStrategies} />

        <Link
          to="/app/padroes"
          className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver detalhes <ChevronRight className="size-3" />
        </Link>
      </div>
    </GlassCard>
  );
}

function findConfirmedPatternAlert(snapshot: PatternMinerSnapshot) {
  const realtimeAlert = [...snapshot.entryAlerts, ...snapshot.formingAlerts].find((alert) =>
    isPureConfirmedStrategy(alert.strategy),
  );
  if (realtimeAlert) {
    return {
      ...realtimeAlert,
      kind: "validated" as const,
      title: "ENTRADA CONFIRMADA",
      progress: 1,
      missingTokens: [],
    };
  }
  return undefined;
}

function findLiveMonitoringAlert(snapshot: PatternMinerSnapshot) {
  return [...snapshot.entryAlerts, ...snapshot.formingAlerts].find((alert) => !isPureConfirmedStrategy(alert.strategy));
}

function buildFormationStrategies(
  snapshot: PatternMinerSnapshot,
  hiddenIds: Array<string | undefined>,
) {
  const hidden = new Set(hiddenIds.filter(Boolean));
  return uniqueStrategies([
    ...snapshot.formingAlerts.map((alert) => alert.strategy),
    ...snapshot.hotStrategies,
    ...snapshot.ranking,
    snapshot.agent.lastDiscovery,
  ]).filter((strategy) => !hidden.has(strategy.id));
}

function uniqueStrategies(strategies: Array<PatternMinerStrategy | undefined>) {
  const seen = new Set<string>();
  return strategies.filter((strategy): strategy is PatternMinerStrategy => {
    if (!strategy || seen.has(strategy.id)) return false;
    seen.add(strategy.id);
    return true;
  });
}

function PatternLiveStatusHeader({
  strategy,
  progress,
  isUsingRealData,
}: {
  strategy: PatternMinerStrategy;
  progress?: number;
  isUsingRealData: boolean;
}) {
  const redOk = strategy.red_count <= 2;
  const liveLabel = isUsingRealData ? "monitorando ao vivo" : "aguardando feed real";

  return (
    <div className="flex w-full items-center justify-between gap-2 px-0.5">
      <span className="text-[9px] font-black uppercase leading-tight tracking-[0.12em] text-neon-cyan">
        {liveLabel}
      </span>
      <AppBadge tone={redOk ? "blue" : "red"} className="px-2 text-[8px]">
        {progressLabel(progress)}
      </AppBadge>
    </div>
  );
}

function MonitoringPatternBlock({
  alert,
  isUsingRealData,
}: {
  alert: PatternMinerAlert;
  isUsingRealData: boolean;
}) {
  const strategy = alert.strategy;
  const side = strategy.next_side ?? strategy.expectedResult;
  const nextSide = side ? formatPulledSide(side) : "Sem tendencia";
  const accuracy = normalizedPercent(
    strategy.next_side_probability ?? strategy.assertiveness ?? strategy.accuracy,
  );
  const redOk = strategy.red_count <= 2;
  const sampleOk = !strategy.insufficientSample && strategy.occurrences >= 3 && strategy.totalValidated >= 2;
  const visibleSequence = visibleMonitoringSequence(alert);
  const isCompleteMatch = isCompleteLivePattern(alert);

  return (
    <div className="mt-1 w-full rounded-xl border border-neon-cyan/18 bg-background/25 px-2.5 py-2">
      <div className="min-w-0">
        <PatternSequence sequence={visibleSequence} compact showSideLetters={false} />
      </div>

      <div className="mt-1 rounded-lg border border-neon-cyan/12 bg-background/20 px-2 py-1 text-[9px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Puxando:</span>
          <span className="font-black">{nextSide}</span>
          <span className="text-neon-cyan">{formatPercent(accuracy)}</span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[8px]">
          <MiniMeta label="OC" value={strategy.occurrences} />
          <MiniMeta label="SG" value={strategy.sg_count} />
          <MiniMeta label="G1" value={strategy.g1_count} />
          <MiniMeta label="RD" value={strategy.red_count} />
        </div>
        <div className="mt-1 text-[8px] leading-snug text-muted-foreground">
          {entryReadinessText({
            accuracy,
            redOk,
            sampleOk,
            hasSide: Boolean(side),
            isUsingRealData,
            isCompleteMatch,
          })}
        </div>
      </div>
    </div>
  );
}

function LivePatternStatusBlock({ alert }: { alert: PatternMinerAlert }) {
  const strategy = alert.strategy;
  const side = strategy.next_side ?? strategy.expectedResult;
  const nextSide = side ? formatPulledSide(side) : "Sem tendencia";
  const accuracy = normalizedPercent(
    strategy.next_side_probability ?? strategy.assertiveness ?? strategy.accuracy,
  );

  return (
    <div className="mt-1 w-full rounded-xl border border-success/25 bg-success/10 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-success">
          ENTRADA CONFIRMADA
        </span>
        <AppBadge tone="green" className="px-2 text-[8px]">
          100%
        </AppBadge>
      </div>

      <div className="min-w-0">
        <PatternSequence sequence={strategy.sequence} compact showSideLetters={false} />
      </div>

      <div className="mt-1 rounded-lg border border-neon-cyan/12 bg-background/20 px-2 py-1 text-[9px]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-muted-foreground">Puxando:</span>
          <span className="font-black">{nextSide}</span>
          <span className="text-neon-cyan">{formatPercent(accuracy)}</span>
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1 text-[8px]">
          <MiniMeta label="OC" value={strategy.occurrences} />
          <MiniMeta label="SG" value={strategy.sg_count} />
          <MiniMeta label="G1" value={strategy.g1_count} />
          <MiniMeta label="RD" value={strategy.red_count} />
          <MiniMeta label="TIE" value={strategy.tie_after_count} />
          <MiniMeta label="RID" value={strategy.round_id ?? "-"} />
          <MiniMeta label="SIG" value={strategy.signal_id || "-"} />
          <MiniMeta label="GER" value={compactIsoTime(strategy.generated_at)} />
        </div>
      </div>
    </div>
  );
}

function WaitingConfirmedEntryBlock({ isUsingRealData }: { isUsingRealData: boolean }) {
  return (
    <div className="mt-1 w-full rounded-xl border border-neon-cyan/12 bg-background/25 px-2.5 py-2">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan">
        Analisando padroes
      </div>
      <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
        {isUsingRealData
          ? "Aguardando nova Entrada Confirmada. Os padroes em formacao seguem abaixo."
          : "Aguardando historico real da mesa para liberar o monitoramento."}
      </div>
    </div>
  );
}

function MiniScoreboard({ snapshot }: { snapshot: PatternMinerSnapshot }) {
  return (
    <div className="w-full rounded-xl border border-neon-cyan/12 bg-background/20 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan">
          Placar IA
        </span>
        <span className="text-[8px] font-black text-neon-cyan">
          {formatPercent(snapshot.scoreboard.assertiveness)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1 text-[8px]">
        <MiniMeta label="SG" value={snapshot.scoreboard.sg} />
        <MiniMeta label="G1" value={snapshot.scoreboard.g1} />
        <MiniMeta label="RD" value={snapshot.scoreboard.red} />
        <MiniMeta label="TIE" value={snapshot.scoreboard.tie} />
      </div>
    </div>
  );
}

function MiniFormationList({ strategies }: { strategies: PatternMinerStrategy[] }) {
  if (!strategies.length) return null;

  return (
    <div className="w-full rounded-xl border border-neon-cyan/12 bg-background/20 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan">
          Em formacao
        </span>
        <span className="text-[8px] text-muted-foreground">{strategies.length} perto</span>
      </div>
      <div className="space-y-1.5">
        {strategies.map((strategy) => {
          const side = strategy.next_side ?? strategy.expectedResult;
          const accuracy = normalizedPercent(
            strategy.next_side_probability ?? strategy.assertiveness ?? strategy.accuracy,
          );
          return (
            <div key={strategy.id} className="rounded-lg border border-neon-cyan/10 bg-background/25 px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[8px] font-black uppercase text-foreground">
                  Padrao IA
                </span>
                <span className="text-[8px] font-black text-neon-cyan">
                  {formatPercent(accuracy)}
                </span>
              </div>
              <div className="mt-1 min-w-0">
                <PatternSequence sequence={strategy.sequence} compact showSideLetters={false} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[8px] text-muted-foreground">
                <span>Entrada {side ? formatPulledSide(side) : "-"}</span>
                <span>SG {strategy.sg_count}</span>
                <span>G1 {strategy.g1_count}</span>
                <span>RD {strategy.red_count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isPureConfirmedStrategy(strategy: PatternMinerStrategy) {
  const accuracy = normalizedPercent(
    strategy.next_side_probability ?? strategy.assertiveness ?? strategy.accuracy,
  );
  const hasClearSide = Boolean(strategy.next_side ?? strategy.expectedResult);
  const hasCurrentSignal = typeof strategy.round_id === "number" && Boolean(strategy.signal_id);
  const blockedByFreshness =
    strategy.status === "BLOQUEADO POR FEED STALE" ||
    strategy.status === "BLOQUEADO POR SNAPSHOT ANTIGO";
  const blockedBySample =
    strategy.status === "BLOQUEADO POR AMOSTRA BAIXA" || strategy.insufficientSample;

  return (
    hasClearSide &&
    hasCurrentSignal &&
    !blockedByFreshness &&
    !blockedBySample &&
    strategy.occurrences >= 3 &&
    strategy.totalValidated >= 2 &&
    typeof accuracy === "number" &&
    accuracy >= 99.995 &&
    strategy.red_count <= 2
  );
}

function normalizedPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return undefined;
  return value <= 1 && value >= 0 ? value * 100 : value;
}

function progressLabel(progress: number | undefined) {
  if (typeof progress !== "number" || !Number.isFinite(progress)) return "analise";
  if (progress >= 1) return "formado";
  return `${Math.round(progress * 100)}%`;
}

function entryReadinessText({
  accuracy,
  redOk,
  sampleOk,
  hasSide,
  isUsingRealData,
  isCompleteMatch = true,
}: {
  accuracy: number | undefined;
  redOk: boolean;
  sampleOk: boolean;
  hasSide: boolean;
  isUsingRealData: boolean;
  isCompleteMatch?: boolean;
}) {
  if (!isUsingRealData) return "Aguardando feed real para confirmar entrada.";
  if (!hasSide) return "Aguardando puxar PLAYER, BANKER ou TIE.";
  if (!sampleOk) return "Aguardando amostra valida para confirmar.";
  if (!redOk) return "Bloqueia acima de 2 reds.";
  if (!isCompleteMatch) return "Analisando padroes do momento.";
  if (accuracy === undefined || accuracy < 99.995) return "Aguardando assertividade 100%.";
  return "Pronto para virar Entrada Confirmada no sinal atual.";
}

function visibleMonitoringSequence(alert: PatternMinerAlert) {
  const sequence = alert.strategy.sequence;
  if (!sequence.length) return sequence;
  if (isCompleteLivePattern(alert)) return sequence;

  const matchedByRounds = Array.isArray(alert.matchedRounds) ? alert.matchedRounds.length : 0;
  const matchedByMissing = sequence.length - alert.missingTokens.length;
  const matchedByProgress =
    typeof alert.progress === "number" && Number.isFinite(alert.progress)
      ? Math.round(alert.progress * sequence.length)
      : 0;
  const visibleCount = Math.max(1, Math.min(sequence.length, matchedByRounds || matchedByMissing || matchedByProgress));

  return sequence.slice(0, visibleCount);
}

function isCompleteLivePattern(alert: PatternMinerAlert) {
  return alert.progress >= 1 && alert.missingTokens.length === 0;
}

function MiniMeta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neon-cyan/10 bg-background/30 px-1 py-0.5">
      <span className="text-[7px] font-bold uppercase text-muted-foreground">{label} </span>
      <span className="text-[8px] font-black text-foreground">{value}</span>
    </div>
  );
}

function compactIsoTime(value: string | undefined) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) return "--";
  return new Date(parsed).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
