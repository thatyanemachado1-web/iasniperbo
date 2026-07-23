import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import type { BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import {
  LATERAL_TIE_TEMPLATES,
  buildLateralTieTimeline,
  getTieLateralRiskState,
  scoreLateralTieTemplate,
} from "@/utils/lateralMotors";
import { normalizeTieMultiplierCounts } from "@/tieRadar/TieRadarStatsEngine";
import { cn } from "@/lib/utils";
import type { TieAlert, TieAlertScoreboard, TieRadarHistoryAnalysis } from "@/types/dashboard";

type StrategyName = "Horizontal" | "Lateral" | "Diagonal" | "Espaçada" | "Puxador";

type StrategySummary = {
  name: StrategyName;
  qualified: boolean;
  compatibility: number | null;
  occurrences: number;
  closed: number;
  source: "Radar" | "Motor";
};

export function SmartTieRadarCard({
  alert,
  scoreboard,
  history,
  lateralResults,
}: {
  alert: TieAlert;
  scoreboard?: TieAlertScoreboard;
  history?: TieRadarHistoryAnalysis;
  lateralResults: BacBoResult[];
}) {
  const timeline = buildLateralTieTimeline(lateralResults.slice(-200));
  const lateralActive = timeline.active;
  const lateralTemplate =
    lateralActive?.formation.template ?? timeline.latestFormation?.template ?? null;
  const lateralStats = lateralTemplate
    ? scoreLateralTieTemplate(timeline.history, lateralTemplate.id)
    : { ties: 0, reds: 0, resolved: 0 };
  const lateralCompatibility = lateralStats.resolved
    ? Math.round((lateralStats.ties / lateralStats.resolved) * 100)
    : null;
  const puller = scoreboard?.tiePullers?.[0] ?? null;
  const radarQualified = alert.status === "active";
  const lateralQualified = Boolean(lateralActive);
  const divergence = Boolean(lateralQualified && alert.status === "expired");
  const strategies = buildStrategySummaries({
    templateId: lateralTemplate?.id ?? null,
    lateralQualified,
    lateralCompatibility,
    lateralOccurrences: lateralStats.resolved,
    puller,
    radarQualified,
  });
  const qualified = strategies.filter((item) => item.qualified && !shouldHoldStrategy(item));
  const activeMotorOnHold = strategies.some(
    (item) => item.source === "Motor" && item.qualified && shouldHoldStrategy(item),
  );
  const alignedCount = divergence ? 0 : qualified.length;
  const state = divergence
    ? "AGUARDAR"
    : alignedCount >= 2
      ? "FORMAÇÃO FORTE"
      : alignedCount === 1
        ? "OBSERVAR"
        : "AGUARDAR";
  const activeReadingLabel =
    state === "FORMAÇÃO FORTE"
      ? state
      : activeMotorOnHold
        ? "AGUARDAR"
        : formatActiveTieReading(lateralActive?.formation.template ?? null, state);
  const best = selectBestStrategy(qualified);
  const compatibility = best?.compatibility ?? scoreboard?.assertiveness ?? null;
  const force = radarQualified ? alert.confidence : (lateralCompatibility ?? alert.confidence);
  const risk = resolveRisk(alert, lateralStats.reds);
  const statisticalWindow = resolveStatisticalWindow(state, history);
  const multipliers = normalizeTieMultiplierCounts(
    history?.monthly?.counts ?? history?.daily?.counts ?? scoreboard?.multipliers,
  );
  const strategyHits = timeline.history
    .filter((entry) => entry.result === "TIE" && entry.formation)
    .slice(-8)
    .reverse();
  const dayHistory = (history?.recent ?? [])
    .filter((entry) => entry.dateKey === history?.daily?.key)
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
  const technicalReason = divergence
    ? "Os motores apresentam leituras divergentes. Nenhuma estratégia foi escolhida artificialmente."
    : state === "FORMAÇÃO FORTE"
      ? "Duas estratégias independentes apresentam leitura compatível nos resultados atuais."
      : state === "OBSERVAR"
        ? "Existe uma estratégia qualificada, mas ainda sem concordância suficiente entre os motores."
        : "Nenhuma estratégia possui qualidade estatística suficiente no momento.";

  return (
    <GlassCard
      className={cn(
        DASHBOARD_MODULE_CARD_ROOT,
        "digital-risk-card min-w-0 border-white/10 p-2 sm:p-3",
        state === "FORMAÇÃO FORTE" && "border-tie/45",
        divergence && "border-warning/35",
      )}
      aria-label="Radar inteligente de empates"
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.025]" />
      <div className="relative flex h-full min-w-0 flex-col gap-2">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Radar Inteligente de Empates
            </h3>
            <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Consolidação dos dois motores
            </p>
          </div>
        </header>

        <div className={cn("rounded-xl border px-3 py-3 text-center", statePanelClass(state))}>
          <div
            className={cn(
              "font-black uppercase leading-none",
              activeReadingLabel.length > 22 ? "text-sm" : "text-lg",
              activeReadingLabel !== state ? "text-warning" : stateTextClass(state),
            )}
          >
            {activeReadingLabel}
          </div>
          <div className="mt-1 text-[9px] font-semibold text-muted-foreground">
            {divergence
              ? "Leituras divergentes"
              : alignedCount
                ? `${alignedCount} de 5 estratégias alinhadas`
                : activeMotorOnHold
                  ? "Estratégia em baixa assertividade"
                  : lateralActive
                    ? "Estratégia atual em observação"
                    : "Nenhuma estratégia forte"}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <SummaryMetric label="Estratégias alinhadas" value={`${alignedCount} de 5`} />
          <SummaryMetric label="Melhor estratégia" value={best?.name ?? "Nenhuma qualificada"} />
          <SummaryMetric
            label="Compatibilidade histórica"
            value={compatibility === null ? "Sem amostra" : `${Math.round(compatibility)}%`}
          />
          <SummaryMetric label="Janela estatística" value={statisticalWindow} />
          <SummaryMetric label="Força" value={`${Math.round(force)}%`} />
          <SummaryMetric label="Risco" value={risk} />
        </div>

        <details className="group mt-auto rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver análise completa</span>
            <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
            <AnalysisBlock title="Justificativa técnica">
              <p>{technicalReason}</p>
            </AnalysisBlock>

            <AnalysisBlock title="Estratégias avaliadas">
              <div className="space-y-1">
                {strategies.map((strategy) => (
                  <div
                    key={strategy.name}
                    className="grid grid-cols-[1fr_auto] gap-2 rounded-md border border-white/5 bg-secondary/10 px-2 py-1"
                  >
                    <div>
                      <span
                        className={
                          strategy.qualified
                            ? "font-black text-tie"
                            : "font-semibold text-muted-foreground"
                        }
                      >
                        {strategy.name}
                      </span>
                      <span className="ml-1 text-[7px] text-muted-foreground">
                        {strategy.source}
                      </span>
                    </div>
                    <div className="text-right font-black text-foreground">
                      {strategy.compatibility === null
                        ? "Sem qualificação"
                        : `${shouldHoldStrategy(strategy) ? "AGUARDAR · " : ""}${Math.round(strategy.compatibility)}%`}
                      {strategy.closed ? ` · ${strategy.closed} encerrados` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </AnalysisBlock>

            {dayHistory.length ? (
              <details className="group/day rounded-lg border border-tie/20 bg-tie/5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-tie marker:content-none [&::-webkit-details-marker]:hidden">
                  <span>Empates que saíram no dia</span>
                  <span className="flex items-center gap-1.5">
                    <span>{dayHistory.length} empates</span>
                    <ChevronRight className="size-3 transition-transform group-open/day:rotate-90" />
                  </span>
                </summary>
                <div className="max-h-48 space-y-1 overflow-y-auto border-t border-tie/15 p-2">
                  {dayHistory.map((entry) => (
                    <div
                      key={`day:${entry.id}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-background/25 px-2 py-1.5 text-[9px]"
                    >
                      <span className="font-black text-tie">EMPATE {entry.multiplierLabel}</span>
                      <span className="font-black tabular-nums text-foreground">{entry.hour}</span>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}

            {strategyHits.length ? (
              <AnalysisBlock title="Sinais de empate acertados pelo motor">
                <div className="max-h-24 space-y-1 overflow-y-auto">
                  {strategyHits.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/5 px-2 py-1"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-black text-tie">
                          EMPATE{entry.multiplier ? ` ${entry.multiplier}x` : ""}
                        </span>
                        <span className="ml-1 text-[7px] text-muted-foreground">
                          {entry.formation?.template.label}
                        </span>
                      </span>
                      <span className="shrink-0 font-black tabular-nums text-foreground">
                        {entry.time ?? "--"}
                      </span>
                    </div>
                  ))}
                </div>
              </AnalysisBlock>
            ) : null}

            {Object.values(multipliers).some((value) => value > 0) ? (
              <AnalysisBlock title="Multiplicadores — somente histórico">
                <div className="grid grid-cols-5 gap-1 text-center">
                  {Object.entries(multipliers).map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-md border border-warning/15 bg-warning/5 px-1 py-1"
                    >
                      <div className="font-black text-warning">{label}</div>
                      <div className="font-black text-foreground">{value}</div>
                    </div>
                  ))}
                </div>
              </AnalysisBlock>
            ) : null}

            {history?.daily ? (
              <AnalysisBlock title="Distribuição">
                <div className="grid grid-cols-3 gap-1 text-center">
                  <SummaryMetric label="Empates hoje" value={String(history.daily.totalTies)} />
                  <SummaryMetric
                    label="Horário frequente"
                    value={history.daily.mostFrequentHour ?? "--"}
                  />
                  <SummaryMetric
                    label="Resultados encerrados"
                    value={String(scoreboard?.totalAlerts ?? 0)}
                  />
                </div>
              </AnalysisBlock>
            ) : null}
          </div>
        </details>
      </div>
    </GlassCard>
  );
}

function buildStrategySummaries({
  templateId,
  lateralQualified,
  lateralCompatibility,
  lateralOccurrences,
  puller,
  radarQualified,
}: {
  templateId: string | null;
  lateralQualified: boolean;
  lateralCompatibility: number | null;
  lateralOccurrences: number;
  puller: NonNullable<TieAlertScoreboard["tiePullers"]>[number] | null;
  radarQualified: boolean;
}): StrategySummary[] {
  const template = LATERAL_TIE_TEMPLATES.find((item) => item.id === templateId);
  const activeName = template
    ? strategyNameFromTemplate(template.id, template.horizontalFifthHouse)
    : null;
  const lateralNames: StrategyName[] = ["Horizontal", "Lateral", "Diagonal", "Espaçada"];
  return [
    ...lateralNames.map((name) => ({
      name,
      qualified: lateralQualified && activeName === name,
      compatibility: activeName === name ? lateralCompatibility : null,
      occurrences: activeName === name ? lateralOccurrences : 0,
      closed: activeName === name ? lateralOccurrences : 0,
      source: "Motor" as const,
    })),
    {
      name: "Puxador",
      qualified: radarQualified && Boolean(puller),
      compatibility: puller ? puller.hitRate : null,
      occurrences: puller?.samples ?? 0,
      closed: puller?.samples ?? 0,
      source: "Radar" as const,
    },
  ];
}

function strategyNameFromTemplate(id: string, horizontal?: boolean): StrategyName {
  if (horizontal) return "Horizontal";
  if (id === "high-row") return "Diagonal";
  if (id === "spaced" || id === "spaced-below" || id === "snake") return "Espaçada";
  return "Lateral";
}

function selectBestStrategy(strategies: StrategySummary[]) {
  return (
    [...strategies].sort(
      (left, right) =>
        strategyQualityScore(right) - strategyQualityScore(left) ||
        right.closed - left.closed ||
        right.occurrences - left.occurrences,
    )[0] ?? null
  );
}

function shouldHoldStrategy(strategy: StrategySummary) {
  if (!strategy.qualified || strategy.compatibility === null) return false;
  return (
    (strategy.closed >= 5 && strategy.compatibility < 45) ||
    (strategy.closed >= 10 && strategy.compatibility < 50)
  );
}

function strategyQualityScore(strategy: StrategySummary) {
  const compatibility = strategy.compatibility ?? 0;
  const sampleConfidence = Math.min(1, Math.sqrt(strategy.closed / 10));
  return compatibility * sampleConfidence;
}

function resolveRisk(alert: TieAlert, lateralReds: number) {
  if (getTieLateralRiskState(lateralReds).dryTieRisk || alert.level === "Alto") return "Alto";
  if (alert.level === "Medio" || alert.level === "Médio") return "Médio";
  return "Baixo";
}

function resolveStatisticalWindow(state: string, history?: TieRadarHistoryAnalysis) {
  const hour = history?.daily?.mostFrequentHour;
  if (state === "AGUARDAR" || !hour || (history?.daily?.totalTies ?? 0) < 2) {
    return "Sem janela confiável";
  }
  const match = String(hour).match(/(\d{1,2})/);
  if (!match) return "Sem janela confiável";
  const normalized = String(Math.min(23, Number(match[1]))).padStart(2, "0");
  return `${normalized}:00–${normalized}:59`;
}

function statePanelClass(state: string) {
  if (state === "FORMAÇÃO FORTE") return "border-tie/40 bg-tie/10";
  if (state === "OBSERVAR") return "border-warning/35 bg-warning/8";
  return "border-white/10 bg-secondary/20";
}

function stateTextClass(state: string) {
  if (state === "FORMAÇÃO FORTE") return "text-tie";
  if (state === "OBSERVAR") return "text-warning";
  return "text-muted-foreground";
}

function formatActiveTieReading(
  template: (typeof LATERAL_TIE_TEMPLATES)[number] | null,
  fallback: string,
) {
  if (!template) return fallback;
  if (template.horizontalFifthHouse) return "LEITURA 5ª CASA HORIZONTAL";
  if (template.id === "spaced") return "LEITURA ESPAÇADA";
  return `LEITURA ${template.label.replace(/^Empate\s+/i, "").toUpperCase()}`;
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-white/8 bg-background/25 px-2 py-1.5 text-center">
      <div className="text-[7px] font-black uppercase leading-tight tracking-[0.04em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 break-words text-[10px] font-black leading-tight text-foreground">
        {value}
      </div>
    </div>
  );
}

function AnalysisBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/8 bg-background/18 p-2 text-[9px] text-muted-foreground">
      <h4 className="mb-1.5 font-black uppercase tracking-[0.08em] text-foreground/80">{title}</h4>
      {children}
    </section>
  );
}
