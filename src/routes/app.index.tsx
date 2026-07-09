// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, Crown, WifiOff } from "lucide-react";
import { mockDashboardData } from "@/data/mockDashboardData";
import { useDashboardData } from "@/hooks/useDashboardData";
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
import {
  calculateMainResult,
  calculateNeuralResult,
  calculateSurfResult,
  calculateTieResult,
} from "@/utils/moduleResults";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { usePatternMiner, resolvePatternMinerFeedStatus } from "@/hooks/usePatternMiner";
import { useRoundHistory } from "@/hooks/useRoundHistory";
import { useDailySurfMax } from "@/hooks/useDailySurfMax";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: d, dashboardUrl, mode, setModuleToggles } = useDashboardData();
  const userSession = readUserSession();
  const fullAccess = hasFullAccess(userSession);
  const { history: roundHistory, resetHistory } = useRoundHistory(
    d,
    mode === "live" && !d.mockMode,
  );
  // Signal cards must be driven only by the official dashboard payload.
  // Browser-local history is kept for the audit panel below, but it cannot
  // influence live signals because desktop and mobile have different storage.
  const patternMinerSourceRounds = d.rounds;
  const patternMinerFeedStatus = resolvePatternMinerFeedStatus(d);
  const patternMiner = usePatternMiner({
    rounds: patternMinerSourceRounds,
    historyLimit: 15000,
    enabled: mode === "live" && !d.mockMode,
    serverSnapshot: d.patternMinerSnapshot,
    feedStatus: patternMinerFeedStatus,
    dashboardUpdatedAt: d.updatedAt,
  });
  const localDailySurfMax = useDailySurfMax({
    rounds: d.rounds,
    tableId: "bac-bo",
    sourceUpdatedAt: d.updatedAt,
    enabled: mode === "live" && !d.mockMode,
  });
  const dailySurfMax = officialDailySurfMax(d.currentSurfAlert, localDailySurfMax, d.updatedAt);
  const surfAlert = d.currentSurfAlert ?? mockDashboardData.currentSurfAlert;
  const surfBoard = d.surfAnalyzerScoreboard ?? mockDashboardData.surfAnalyzerScoreboard;
  const mainResult = calculateMainResult(d.mainScoreboard);
  const tieResult = calculateTieResult(d.tieAlertScoreboard);
  const neuralResult = calculateNeuralResult(d.neuralReading);
  const surfResult = calculateSurfResult(surfBoard);
  const tableTieCount = d.rounds.filter((round) => round.result === "T").length;
  const tableTieLabel = formatCompactCount(tableTieCount);
  const tieHitLabel = formatCompactCount(tieResult.greens);
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
          {!fullAccess && (
            <Link
              to="/app/planos"
              className="hidden sm:inline-flex items-center gap-1.5 btn-gold-grad rounded-xl px-3 py-2 text-xs font-bold shine"
            >
              <Crown className="size-3.5" /> Premium
            </Link>
          )}
        </div>
      </div>

      <OperationalStatusCard data={d} mode={mode} dashboardUrl={dashboardUrl} />

      <DashboardMainCardsGrid
        data={d}
        mode={mode}
        surfAlert={surfAlert}
        dailySurfMax={dailySurfMax}
        patternMinerSnapshot={patternMiner.snapshot}
        patternMinerRounds={patternMinerSourceRounds}
        patternMinerIsUsingRealData={patternMiner.isUsingRealData}
        patternMinerFeedStatus={patternMinerFeedStatus}
        onModuleTogglesChange={setModuleToggles}
      />

      <div className="dashboard-command-grid grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)] xl:items-start">
        <div className="space-y-4 xl:rounded-2xl xl:border xl:border-neon-cyan/10 xl:bg-background/10 xl:p-2">
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
                  tone="text-muted-foreground"
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

function officialDailySurfMax(alert: any, fallback: any, updatedAt?: string | null) {
  const memory = alert?.dailySurfMemory;
  if (!memory) return fallback;
  return {
    currentStreak: {
      side: memory.currentDropSide ?? null,
      count: Number(memory.currentDropDepth) || 0,
    },
    dailyMaxSurf: {
      banker: Number(memory.bankerMaxDepth) || 0,
      player: Number(memory.playerMaxDepth) || 0,
      tie: fallback?.dailyMaxSurf?.tie ?? 0,
      date: memory.dateKey || fallback?.dailyMaxSurf?.date || "",
      table_id: fallback?.dailyMaxSurf?.table_id || "bac-bo",
      last_round_id: fallback?.dailyMaxSurf?.last_round_id ?? null,
      updated_at: updatedAt || fallback?.dailyMaxSurf?.updated_at || new Date().toISOString(),
    },
  };
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

function OperationalStatusCard({
  data,
  mode,
  dashboardUrl,
}: {
  data: any;
  mode: "live" | "mock" | "connecting" | "fallback";
  dashboardUrl: string;
}) {
  const latestRound = Array.isArray(data.rounds) ? data.rounds.at(-1) : null;
  const lastRoundId = data.lastRoundId ?? latestRound?.id ?? "-";
  const sourceUpdatedAtMs = latestDashboardSourceTimeMs(data, latestRound);
  const sourceAgeMs = Number.isFinite(sourceUpdatedAtMs) ? Date.now() - sourceUpdatedAtMs : Number.POSITIVE_INFINITY;
  const sourceAgeSeconds = Math.max(0, Math.round(sourceAgeMs / 1000));
  const sourceIsStale = sourceAgeMs > 15_000;
  const hasFreshSource = Number.isFinite(sourceUpdatedAtMs) && !sourceIsStale;
  const hasLiveRounds = Array.isArray(data.rounds) && data.rounds.length > 0;
  const inferredLiveFeed = !data.mockMode && hasFreshSource && hasLiveRounds;
  const collectorStatus = normalizeStatusText(data.collectorStatus);
  const websocketStatus = normalizeStatusText(data.websocketStatus);
  const collectorOnline = collectorStatus === "online" || (!collectorStatus && inferredLiveFeed);
  const websocketConnected = websocketStatus === "connected" || (!websocketStatus && inferredLiveFeed);
  const liveMode =
    !data.mockMode &&
    (mode === "live" || (collectorOnline && websocketConnected && hasFreshSource));
  const apiLabel = formatDashboardSource(dashboardUrl);
  const issue =
    !liveMode
      ? mode === "connecting"
        ? "Conectando na API de sinais."
        : "Sincronizando dados reais."
      : !collectorOnline
        ? "Coletor nao esta online."
        : !websocketConnected
          ? "Conexao da mesa desconectada."
          : !hasFreshSource
            ? "Fonte atrasada. Conferir publicador/VPS."
            : "";
  const ok = !issue;
  const statusLabel = ok ? "Tudo ok" : mode === "connecting" || !liveMode ? "Sincronizando" : "Verificar";
  const Icon = ok ? CheckCircle2 : mode === "fallback" || sourceIsStale ? WifiOff : AlertTriangle;

  return (
    <GlassCard className="border-neon-cyan/10 bg-background/30 px-2.5 py-1.5 shadow-none sm:px-3 sm:py-2">
      <div className="flex min-w-0 items-center gap-2 lg:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`grid size-5 shrink-0 place-items-center rounded-md border sm:size-6 ${
              ok
                ? "border-emerald-400/30 bg-emerald-400/5 text-emerald-300/90"
                : "border-amber-400/30 bg-amber-400/5 text-amber-300/90"
            }`}
          >
            <Icon className="size-3 sm:size-3.5" />
          </div>
          <div className="min-w-0 truncate text-[9px] leading-none text-muted-foreground sm:text-[10px]">
            <span className="font-black uppercase tracking-[0.12em] text-foreground/80">Status</span>
            <span className={`ml-1 font-bold ${ok ? "text-emerald-300/90" : "text-amber-300/90"}`}>
              {statusLabel}
            </span>
            <span className="mx-1 text-muted-foreground/50">-</span>
            <span className="truncate">
              {ok ? `VPS online, round ${lastRoundId}, ${formatAge(sourceAgeSeconds)}.` : issue}
            </span>
          </div>
        </div>

        <div className="hidden grid-cols-4 gap-1.5 text-[9px] sm:grid lg:min-w-[430px]">
          <StatusMetric label="API" value={apiLabel} tone={liveMode ? "green" : "amber"} />
          <StatusMetric
            label="Coletor"
            value={collectorOnline ? "online" : data.collectorStatus || "sem status"}
            tone={collectorOnline ? "green" : "amber"}
          />
          <StatusMetric
            label="Mesa"
            value={websocketConnected ? "conectada" : data.websocketStatus || "sem status"}
            tone={websocketConnected ? "green" : "amber"}
          />
          <StatusMetric
            label="Fonte"
            value={Number.isFinite(sourceUpdatedAtMs) ? `${formatAge(sourceAgeSeconds)} atras` : "sem horario"}
            tone={hasFreshSource ? "green" : "amber"}
          />
        </div>
      </div>
    </GlassCard>
  );
}

function latestDashboardSourceTimeMs(data: any, latestRound: any) {
  const candidates = [
    data?.updatedAt,
    data?.updated_at,
    data?.lastRoundAt,
    data?.last_round_at,
    data?.bettingTiming?.updatedAt,
    data?.bettingTiming?.updated_at,
    latestRound?.recordedAt,
    latestRound?.recorded_at,
    latestRound?.capturedAt,
    latestRound?.captured_at,
    latestRound?.sourceUpdatedAt,
    latestRound?.source_updated_at,
  ];
  return candidates.reduce((best, value) => {
    const parsed = parseDashboardSourceTimeMs(value);
    return Number.isFinite(parsed) && parsed > best ? parsed : best;
  }, Number.NEGATIVE_INFINITY);
}

function parseDashboardSourceTimeMs(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return Number.NaN;
  const normalized = /(?:z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber";
}) {
  return (
    <div className="min-w-0 rounded-md border border-border/40 bg-background/35 px-2.5 py-1.5">
      <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">{label}</div>
      <div className={`mt-0.5 truncate text-[10px] font-bold ${tone === "green" ? "text-emerald-300/90" : "text-amber-300/90"}`}>
        {value}
      </div>
    </div>
  );
}

function normalizeStatusText(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "conectado" || text === "conectada") return "connected";
  if (text === "desconectado" || text === "desconectada") return "disconnected";
  return text;
}

function formatAge(seconds: number) {
  if (seconds < 5) return "agora";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
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
