import { createFileRoute } from "@tanstack/react-router";
import { DatabaseZap } from "lucide-react";
import { PatternAlertCard } from "@/components/patternMiner/PatternAlertCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePatternMiner } from "@/hooks/usePatternMiner";
import { formatPercent } from "@/patternMiner/PatternMinerDisplay";
import type {
  PatternMinerAlert,
  PatternMinerHistoryLimit,
  PatternMinerSnapshot,
} from "@/types/patternMiner";

export const Route = createFileRoute("/app/padroes")({
  component: PatternMinerPage,
});

const OPERATIONAL_HISTORY_LIMIT: PatternMinerHistoryLimit = 15000;

function PatternMinerPage() {
  const { data: dashboardData, mode } = useDashboardData();
  const hasRealHistory = mode === "live" && !dashboardData.mockMode;
  const { snapshot, isUsingRealData } = usePatternMiner({
    rounds: dashboardData.rounds,
    historyLimit: OPERATIONAL_HISTORY_LIMIT,
    enabled: hasRealHistory,
    feedStatus: (dashboardData as any).feedStatus,
    dashboardUpdatedAt: dashboardData.updatedAt,
  });
  const confirmedAlerts = snapshot.entryAlerts.filter(isPureConfirmedAlert).slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black">Padroes IA</h1>
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
    </div>
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
