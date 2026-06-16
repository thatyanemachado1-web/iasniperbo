import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronRight, Clock, Crown } from "lucide-react";
import { mockDashboardData } from "@/data/mockDashboardData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { ModuleMiniScoreboard } from "@/components/dashboard/ModuleMiniScoreboard";
import { EngineDecisionCard } from "@/components/dashboard/EngineDecisionCard";
import { AIReadingCard } from "@/components/dashboard/AIReadingCard";
import { RoadmapDots } from "@/components/dashboard/RoadmapDots";
import { PressureChart } from "@/components/dashboard/PressureChart";
import { DashboardMainCardsGrid } from "@/components/dashboard/DashboardMainCardsGrid";
import { RoundHistoryAuditCard } from "@/components/dashboard/RoundHistoryAuditCard";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumFeature } from "@/components/ui-app/PremiumFeature";
import {
  calculateAlternationRate,
  calculateBankerFrequency,
  calculateCurrentStreak,
  calculatePlayerFrequency,
  calculateTieFrequency,
} from "@/utils/statistics";
import { buildSurfEntrySummary } from "@/utils/surf";
import {
  calculateMainResult,
  calculateNeuralResult,
  calculateSurfResult,
  calculateTieResult,
} from "@/utils/moduleResults";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { buildSignalCopy } from "@/lib/operationalCopy";
import { usePatternMiner } from "@/hooks/usePatternMiner";
import { useRoundHistory } from "@/hooks/useRoundHistory";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: d, dashboardUrl, mode, setModuleToggles } = useDashboardData();
  const userSession = readUserSession();
  const fullAccess = hasFullAccess(userSession);
  const patternMiner = usePatternMiner({
    rounds: d.rounds,
    historyLimit: 15000,
    enabled: mode === "live" && !d.mockMode,
  });
  const { history: roundHistory, resetHistory } = useRoundHistory(
    d,
    mode === "live" && !d.mockMode,
  );
  const surfAlert = d.currentSurfAlert ?? mockDashboardData.currentSurfAlert;
  const tieAlertEnabled = d.moduleToggles?.tieAlert !== false;
  const surfAnalyzerEnabled = d.moduleToggles?.surfAnalyzer !== false;
  const surfBoard = d.surfAnalyzerScoreboard ?? mockDashboardData.surfAnalyzerScoreboard;
  const mainResult = calculateMainResult(d.mainScoreboard);
  const tieResult = calculateTieResult(d.tieAlertScoreboard);
  const neuralResult = calculateNeuralResult(d.neuralReading);
  const surfResult = calculateSurfResult(surfBoard);
  const tableTieCount = d.rounds.filter((round) => round.result === "T").length;
  const tableTieLabel = formatCompactCount(tableTieCount);
  const tieHitLabel = formatCompactCount(tieResult.greens);
  const signalHasActiveEntry =
    (d.currentSignal.status === "pending" || d.currentSignal.status === "g1") &&
    (d.currentSignal.side === "BANKER" || d.currentSignal.side === "PLAYER");
  const surfSummary =
    surfAnalyzerEnabled &&
    signalHasActiveEntry &&
    (d.currentSignal.side === "BANKER" || d.currentSignal.side === "PLAYER")
      ? buildSurfEntrySummary(surfAlert, d.currentSignal.side)
      : undefined;
  const sequence = calculateCurrentStreak(d.rounds);
  const stats = {
    banker: calculateBankerFrequency(d.rounds),
    player: calculatePlayerFrequency(d.rounds),
    tie: calculateTieFrequency(d.rounds),
    alt: calculateAlternationRate(d.rounds),
  };
  const dataModeLabel =
    mode === "live"
      ? "Dados em tempo real"
      : mode === "connecting"
        ? "Conectando API"
        : "Modo demonstração";
  const dataModeTone = mode === "live" ? "green" : mode === "connecting" ? "blue" : "amber";
  const dashboardSourceLabel = formatDashboardSource(dashboardUrl);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Olá,</div>
          <div className="text-lg font-bold">
            {userSession.name || d.user.name}{" "}
            <span className="text-muted-foreground font-normal text-sm">- painel operacional</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {userSession.accessMode === "demo" && userSession.expiresAt && (
            <TrialCountdown expiresAt={userSession.expiresAt} />
          )}
          <AppBadge tone="green" pulse>
            Mesa online
          </AppBadge>
          <AppBadge tone="blue" pulse>
            Engine operacional
          </AppBadge>
          <AppBadge tone={mode === "live" ? "green" : "amber"}>{dashboardSourceLabel}</AppBadge>
          {fullAccess ? (
            <AppBadge tone="green">
              {userSession.plan === "vip" ? "Conta VIP" : "Conta Premium"}
            </AppBadge>
          ) : (
            <Link
              to="/app/planos"
              className="hidden sm:inline-flex items-center gap-1.5 btn-gold-grad rounded-xl px-3 py-2 text-xs font-bold shine"
            >
              <Crown className="size-3.5" /> Premium
            </Link>
          )}
        </div>
      </div>

      <DashboardMainCardsGrid
        data={d}
        surfAlert={surfAlert}
        surfMaxRounds={roundHistory.todayRounds.length ? roundHistory.todayRounds : d.rounds}
        patternMinerSnapshot={patternMiner.snapshot}
        patternMinerIsUsingRealData={patternMiner.isUsingRealData}
        onModuleTogglesChange={setModuleToggles}
      />

      <div className="dashboard-command-grid grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start">
        <div className="space-y-4 xl:rounded-2xl xl:border xl:border-neon-cyan/10 xl:bg-background/10 xl:p-2">
          <PremiumFeature
            title="Entrada principal VIP"
            description="A entrada confirmada completa só aparece para clientes liberados."
          >
            <SignalCard
              signal={d.currentSignal}
              neuralReading={d.neuralReading}
              neuralScoreboard={d.neuralScoreboard}
              rounds={d.rounds}
              mainSequencePositive={mainResult.sequencePositive}
              mainSequenceNegative={mainResult.sequenceNegative}
              surfSummary={surfSummary}
              tieAlert={tieAlertEnabled ? d.currentTieAlert : undefined}
              operationalMessage={buildSignalCopy(d)}
              enableResultFlash={mode === "live"}
              priority
              showNeuralReading={false}
            />
          </PremiumFeature>

          <RoundHistoryAuditCard history={roundHistory} onReset={resetHistory} />

          <PremiumFeature
            title="Análise estatística VIP"
            description="O demo mostra a estrutura, mas bloqueia a leitura completa."
          >
            <GlassCard>
              <SectionTitle
                title="Análise estatística da mesa"
                subtitle="Pressão estatística calculada pelas últimas rodadas."
                right={
                  <AppBadge tone={dataModeTone} pulse={mode !== "mock"}>
                    {dataModeLabel}
                  </AppBadge>
                }
              />
              <PressureChart data={d.pressureSeries} />
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-banker" /> Banker Pressure
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-player" /> Player Pressure
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="size-2 rounded-full bg-tie" /> Tie Pressure
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] sm:grid-cols-6">
                <Metric
                  label="Pressão B"
                  value={`${stats.banker.toFixed(0)}%`}
                  tone="text-banker"
                />
                <Metric
                  label="Pressão P"
                  value={`${stats.player.toFixed(0)}%`}
                  tone="text-player"
                />
                <Metric label="Pressão T" value={`${stats.tie.toFixed(0)}%`} tone="text-tie" />
                <Metric label="Sequência" value={`${sequence.side ?? "-"} x${sequence.count}`} />
                <Metric label="Alternância" value={`${stats.alt.toFixed(0)}%`} />
                <Metric label="Padrão" value="Observação" />
              </div>
            </GlassCard>
          </PremiumFeature>

          <GlassCard>
            <SectionTitle
              title="Bolinhas Bac Bo"
              right={<AppBadge tone="blue">Últimas 30 rodadas</AppBadge>}
            />
            <RoadmapDots rounds={d.rounds} compact showScore />
            <Link
              to="/app"
              className="mt-3 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-blue"
            >
              Ver histórico completo <ChevronRight className="size-3" />
            </Link>
          </GlassCard>
        </div>

        <div className="space-y-4 xl:rounded-2xl xl:border xl:border-neon-purple/10 xl:bg-background/10 xl:p-2">
          <PremiumFeature
            title="Decisão da engine VIP"
            description="A decisão técnica fica completa apenas no acesso liberado."
          >
            <EngineDecisionCard decision={d.engineDecision} data={d} />
          </PremiumFeature>

          <PremiumFeature
            title="Leitura IA das entradas"
            description="Análise automática das entradas liberada no acesso Premium."
          >
            <AIReadingCard data={d} mode={mode} />
          </PremiumFeature>

          <PremiumFeature
            title="Placares VIP"
            description="Os resultados completos ficam liberados após aprovação do ADM."
            className="digital-score-rail space-y-3"
          >
            <ModuleMiniScoreboard
              moduleType="MAIN"
              title="Resultado Principal"
              assertiveness={mainResult.assertiveness}
              chips={[
                { label: "SG", value: mainResult.greenSemGale, variant: "green" },
                { label: "G1", value: mainResult.greenG1, variant: "green" },
                { label: "RED", value: mainResult.reds, variant: "red" },
                { label: "EMP", value: tableTieLabel, variant: "purple" },
                { label: "Total", value: mainResult.total, variant: "neutral" },
              ]}
              sequencePositive={mainResult.sequencePositive}
              sequenceNegative={mainResult.sequenceNegative}
              breakdown={`${mainResult.breakdown} / EMP ${tableTieLabel}`}
            />
            <ModuleMiniScoreboard
              moduleType="NEURAL"
              title="Resultado Pagante"
              assertiveness={neuralResult.assertiveness}
              chips={[
                { label: "Alertas", value: neuralResult.totalAlerts, variant: "neutral" },
                { label: "Green", value: neuralResult.greens, variant: "green" },
                { label: "SG", value: neuralResult.greenSemGale, variant: "green" },
                { label: "G1", value: neuralResult.greenG1, variant: "cyan" },
                { label: "RED", value: neuralResult.reds, variant: "red" },
                {
                  label: "SQ max green",
                  value: neuralMaxSequenceLabel(neuralResult.maxSequencePositive),
                  variant: "green",
                },
                {
                  label: "SQ max red",
                  value: neuralMaxSequenceLabel(neuralResult.maxSequenceNegative),
                  variant: "red",
                },
                { label: "EMP", value: tableTieLabel, variant: "purple" },
                { label: "Total", value: neuralResult.total, variant: "neutral" },
              ]}
              sequencePositive={neuralResult.sequencePositive}
              sequenceNegative={neuralResult.sequenceNegative}
              breakdown={`${neuralResult.breakdown} / EMP ${tableTieLabel}`}
            />
            <ModuleMiniScoreboard
              moduleType="TIE"
              title="Resultado Tie"
              assertiveness={tieResult.assertiveness}
              chips={[
                { label: "EMP", value: tieHitLabel, variant: "green" },
                { label: "Mesa", value: tableTieLabel, variant: "purple" },
                { label: "Exp.", value: tieResult.expired, variant: "purple" },
                { label: "Total", value: tieResult.total, variant: "neutral" },
              ]}
              sequencePositive={tieResult.sequencePositive}
              sequenceExpired={tieResult.sequenceExpired}
              breakdown={`EMP ${tieHitLabel} / Mesa ${tableTieLabel} / Exp. ${tieResult.expired}`}
            />
            {surfAlert && (
              <ModuleMiniScoreboard
                moduleType="SURF"
                title="Resultado Surf"
                assertiveness={surfResult.assertiveness}
                chips={[
                  { label: "Green", value: surfResult.greens, variant: "green" },
                  { label: "SG", value: surfResult.greenSemGale, variant: "green" },
                  { label: "G1", value: surfResult.greenG1, variant: "cyan" },
                  { label: "RED", value: surfResult.reds, variant: "red" },
                  { label: "EMP", value: tableTieLabel, variant: "purple" },
                  { label: "Total", value: surfResult.total, variant: "neutral" },
                  { label: "Bloq.", value: surfResult.blocked, variant: "yellow" },
                  { label: "Sem risco", value: surfResult.noRisk, variant: "neutral" },
                ]}
                sequencePositive={surfResult.sequencePositive}
                sequenceNegative={surfResult.sequenceNegative}
                breakdown={`${surfResult.breakdown} / EMP ${tableTieLabel}`}
              />
            )}
          </PremiumFeature>

          {!fullAccess && (
            <GlassCard className="border-gold/40">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl btn-gold-grad flex items-center justify-center glow-gold">
                  <Crown className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold">Plano gratuito</div>
                  <div className="text-[11px] text-muted-foreground">
                    Recursos premium bloqueados
                  </div>
                </div>
              </div>
              <Link
                to="/app/planos"
                className="mt-3 inline-flex w-full justify-center btn-primary-grad rounded-xl py-2 text-xs font-semibold"
              >
                Desbloquear Premium
              </Link>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCompactCount(value: number) {
  return value >= 0 && value < 10 ? `0${value}` : String(value);
}

function neuralMaxSequenceLabel(value: number) {
  return value > 0 ? value : "coletando";
}

function formatDashboardSource(url: string) {
  if (!url) return "API offline";
  try {
    const parsed = new URL(url);
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
    const host =
      parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost"
        ? "local"
        : parsed.hostname.replace(/^www\./, "");
    return `API ${host}:${port}`;
  } catch {
    return "API configurada";
  }
}

function TrialCountdown({ expiresAt }: { expiresAt: string }) {
  const [remainingMs, setRemainingMs] = useState(() => trialRemainingMs(expiresAt));

  useEffect(() => {
    function updateRemaining() {
      const next = trialRemainingMs(expiresAt);
      setRemainingMs(next);
      if (next <= 0) {
        window.location.href = "/app/planos?trial=expired";
      }
    }

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1_000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-gold">
      <Clock className="size-3" />
      Teste {formatTrialTime(remainingMs)}
    </span>
  );
}

function trialRemainingMs(expiresAt: string) {
  const expires = Date.parse(expiresAt);
  if (!Number.isFinite(expires)) return 0;
  return Math.max(0, expires - Date.now());
}

function formatTrialTime(value: number) {
  const totalSeconds = Math.ceil(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
