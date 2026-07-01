import { createFileRoute } from "@tanstack/react-router";
import { DatabaseZap } from "lucide-react";
import { useMemo } from "react";
import { PatternAlertCard } from "@/components/patternMiner/PatternAlertCard";
import { PatternStrategyCard } from "@/components/patternMiner/PatternStrategyCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useDashboardRoundHistory } from "@/hooks/useDashboardRoundHistory";
import { usePatternMiner } from "@/hooks/usePatternMiner";
import { useRoundHistory } from "@/hooks/useRoundHistory";
import { formatPercent } from "@/patternMiner/PatternMinerDisplay";
import type { Round } from "@/types/dashboard";
import type {
  PatternMinerAlert,
  PatternMinerHistoryLimit,
  PatternMinerSnapshot,
  PatternMinerStrategy,
} from "@/types/patternMiner";

export const Route = createFileRoute("/app/padroes")({
  component: PatternMinerPage,
});

const OPERATIONAL_HISTORY_LIMIT: PatternMinerHistoryLimit = 15000;

function PatternMinerPage() {
  const { data: dashboardData, mode } = useDashboardData();
  const hasRealHistory = mode === "live" && !dashboardData.mockMode;
  const sharedRoundHistory = useDashboardRoundHistory({
    enabled: hasRealHistory,
    limit: OPERATIONAL_HISTORY_LIMIT,
    tableId: "bac-bo",
  });
  const { history: localRoundHistory } = useRoundHistory(dashboardData, hasRealHistory);
  const patternRounds = useMemo(
    () => mergeRoundSources(sharedRoundHistory.rounds, localRoundHistory.todayRounds, dashboardData.rounds),
    [sharedRoundHistory.rounds, localRoundHistory.todayRounds, dashboardData.rounds],
  );
  const { snapshot, isUsingRealData } = usePatternMiner({
    rounds: patternRounds.length ? patternRounds : dashboardData.rounds,
    historyLimit: OPERATIONAL_HISTORY_LIMIT,
    enabled: hasRealHistory,
    feedStatus: (dashboardData as any).feedStatus,
    dashboardUpdatedAt: sharedRoundHistory.updatedAt ?? dashboardData.updatedAt,
  });
  const confirmedAlerts = snapshot.entryAlerts.filter(isPureConfirmedAlert).slice(0, 6);
  const collectedStrategies = useMemo(
    () => buildCollectedStrategies(snapshot).slice(0, 12),
    [snapshot],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black">Padrões IA</h1>
            <AppBadge tone="green" pulse>
              Entrada confirmada
            </AppBadge>
            <AppBadge tone="blue">Automatico</AppBadge>
          </div>
          <div className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Painel limpo: somente padroes puros com assertividade 100%, sinal atual e no maximo 2 reds.
          </div>
        </div>
      </div>

      {!isUsingRealData && (
        <GlassCard className="rounded-xl border-warning/40">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-5 text-warning" />
            <div>
              <div className="text-sm font-black text-warning">
                Aguardando historico real da plataforma
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                As entradas confirmadas aparecem apenas com dados reais da mesa.
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <PatternMinerScoreboard snapshot={snapshot} />

      <GlassCard className="rounded-xl p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-neon-cyan">
              Coleta de rodadas
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Histórico usado para montar e validar os padrões IA.
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black text-neon-cyan">{patternRounds.length}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              rodadas coletadas
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="space-y-3">
        <SectionTitle
          title="Entradas confirmadas"
          subtitle="Sem ranking antigo, sem filtros e sem cards de configuracao."
        />
        {confirmedAlerts.length ? (
          <div className="space-y-3">
            {confirmedAlerts.map((alert) => (
              <PatternAlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        ) : (
          <EmptyState text="Aguardando uma entrada confirmada pura no card Padroes IA." />
        )}
      </div>

      <div className="space-y-3">
        <SectionTitle
          title="Padrões IA coletados"
          subtitle="Padrões montados pelo histórico de rodadas coletadas da mesa."
        />
        {collectedStrategies.length ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {collectedStrategies.map((strategy) => (
              <PatternStrategyCard key={strategy.id} strategy={strategy} />
            ))}
          </div>
        ) : (
          <EmptyState text="Coletando rodadas para montar os padrões IA." />
        )}
      </div>
    </div>
  );
}

function mergeRoundSources(...sources: Array<ReadonlyArray<Round> | undefined>) {
  const byKey = new Map<string, Round>();
  for (const source of sources) {
    for (const round of source ?? []) {
      const key = `${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
      byKey.set(key, round);
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.id - b.id);
}

function buildCollectedStrategies(snapshot: PatternMinerSnapshot) {
  return uniqueStrategies([
    ...snapshot.entryAlerts.map((alert) => alert.strategy),
    ...snapshot.formingAlerts.map((alert) => alert.strategy),
    ...snapshot.hotStrategies,
    ...snapshot.ranking,
    snapshot.agent.lastDiscovery,
  ]).filter(isCollectedStrategy);
}

function uniqueStrategies(strategies: Array<PatternMinerStrategy | undefined>) {
  const seen = new Set<string>();
  return strategies.filter((strategy): strategy is PatternMinerStrategy => {
    if (!strategy || seen.has(strategy.id)) return false;
    seen.add(strategy.id);
    return true;
  });
}

function isCollectedStrategy(strategy: PatternMinerStrategy) {
  return (
    Boolean(strategy.expectedResult ?? strategy.next_side) &&
    strategy.occurrences >= 3 &&
    strategy.totalValidated >= 2
  );
}

function isPureConfirmedAlert(alert: PatternMinerAlert) {
  const strategy = alert.strategy;
  const accuracy = Number(alert.accuracy ?? strategy.accuracy ?? strategy.assertiveness ?? 0);
  const redCount = Number(alert.redCount ?? alert.red_count ?? strategy.redCount ?? strategy.red_count ?? strategy.red ?? 0);
  return (
    alert.kind === "validated" &&
    Boolean(alert.entrySide ?? alert.entry_side ?? strategy.expectedResult) &&
    accuracy >= 99.995 &&
    !strategy.insufficientSample &&
    strategy.occurrences >= 3 &&
    strategy.totalValidated >= 2 &&
    redCount <= 2
  );
}

function PatternMinerScoreboard({ snapshot }: { snapshot: PatternMinerSnapshot }) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
      <ScoreMetric label="SG" value={snapshot.scoreboard.sg} tone="text-success" />
      <ScoreMetric label="G1" value={snapshot.scoreboard.g1} tone="text-neon-cyan" />
      <ScoreMetric label="RED" value={snapshot.scoreboard.red} tone="text-destructive" />
      <ScoreMetric label="TIE" value={snapshot.scoreboard.tie} tone="text-warning" />
      <ScoreMetric label="Validadas" value={snapshot.scoreboard.totalValidated} />
      <ScoreMetric
        label="Assertividade"
        value={formatPercent(snapshot.scoreboard.assertiveness)}
        tone="text-neon-cyan"
      />
    </div>
  );
}

function ScoreMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <GlassCard className="rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-lg font-black ${tone ?? ""}`}>{value}</div>
    </GlassCard>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassCard className="rounded-xl">
      <div className="text-sm text-muted-foreground">{text}</div>
    </GlassCard>
  );
}
