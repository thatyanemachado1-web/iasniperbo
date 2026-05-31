import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Activity, ChevronRight, Crown } from "lucide-react";
import { mockDashboardData } from "@/data/mockDashboardData";
import { useDashboardData } from "@/hooks/useDashboardData";
import { LiveTableView } from "@/components/dashboard/LiveTableView";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { TieAlertCard } from "@/components/dashboard/TieAlertCard";
import { SurfAlertCard } from "@/components/dashboard/SurfAlertCard";
import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import { ModuleMiniScoreboard } from "@/components/dashboard/ModuleMiniScoreboard";
import { EngineDecisionCard } from "@/components/dashboard/EngineDecisionCard";
import { RoadmapDots } from "@/components/dashboard/RoadmapDots";
import { PressureChart } from "@/components/dashboard/PressureChart";
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
import { accessLabel } from "@/lib/accessApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import { buildSignalCopy } from "@/lib/operationalCopy";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: d, mode } = useDashboardData();
  const userSession = readUserSession();
  const fullAccess = hasFullAccess(userSession);
  const surfAlert = d.currentSurfAlert ?? mockDashboardData.currentSurfAlert;
  const surfBoard = d.surfAnalyzerScoreboard ?? mockDashboardData.surfAnalyzerScoreboard;
  const mainResult = calculateMainResult(d.mainScoreboard);
  const tieResult = calculateTieResult(d.tieAlertScoreboard);
  const neuralResult = calculateNeuralResult(d.neuralReading);
  const surfResult = calculateSurfResult(surfBoard);
  const signalHasActiveEntry =
    (d.currentSignal.status === "pending" || d.currentSignal.status === "g1") &&
    (d.currentSignal.side === "BANKER" || d.currentSignal.side === "PLAYER");
  const surfSummary =
    signalHasActiveEntry && (d.currentSignal.side === "BANKER" || d.currentSignal.side === "PLAYER")
      ? buildSurfEntrySummary(surfAlert, d.currentSignal.side)
      : undefined;
  const lastRound = d.rounds[d.rounds.length - 1];
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Olá,</div>
          <div className="text-lg font-bold">
            {userSession.name || d.user.name}{" "}
            <span className="text-muted-foreground font-normal text-sm">- painel operacional</span>
          </div>
        </div>
        <Link
          to="/app/planos"
          className="hidden sm:inline-flex items-center gap-1.5 btn-gold-grad rounded-xl px-3 py-2 text-xs font-bold shine"
        >
          <Crown className="size-3.5" /> Premium
        </Link>
      </div>

      <div className="rounded-2xl border border-neon-cyan/20 bg-secondary/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-neon-cyan">
          <Activity className="size-4" />
          Núcleo operacional
        </div>
        <div className="flex flex-wrap gap-2">
          <AppBadge tone={dataModeTone} pulse={mode !== "mock"}>
            {dataModeLabel}
          </AppBadge>
          <AppBadge tone={fullAccess ? "green" : "amber"}>{accessLabel(userSession)}</AppBadge>
          <AppBadge tone="blue">Entrada em prioridade</AppBadge>
          <ModuleToggleStrip toggles={d.moduleToggles} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] gap-4">
        <div className="space-y-4">
          <PremiumFeature
            title="Entrada principal VIP"
            description="A entrada confirmada completa so aparece para clientes liberados."
          >
            <SignalCard
              signal={d.currentSignal}
              neuralReading={d.neuralReading}
              surfSummary={surfSummary}
              tieAlert={d.currentTieAlert}
              operationalMessage={buildSignalCopy(d)}
              priority
            />
          </PremiumFeature>
          <PremiumFeature
            title="Placares VIP"
            description="Os resultados completos ficam liberados apos aprovacao do ADM."
            className="space-y-2"
          >
            <ModuleMiniScoreboard
              moduleType="MAIN"
              title="Resultado Principal"
              assertiveness={mainResult.assertiveness}
              chips={[
                { label: "SG", value: mainResult.greenSemGale, variant: "green" },
                { label: "G1", value: mainResult.greenG1, variant: "green" },
                { label: "RED", value: mainResult.reds, variant: "red" },
                { label: "Total", value: mainResult.total, variant: "neutral" },
              ]}
              sequencePositive={mainResult.sequencePositive}
              sequenceNegative={mainResult.sequenceNegative}
              breakdown={mainResult.breakdown}
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
                { label: "Total", value: neuralResult.total, variant: "neutral" },
              ]}
              sequencePositive={neuralResult.sequencePositive}
              sequenceNegative={neuralResult.sequenceNegative}
              breakdown={neuralResult.breakdown}
            />
          </PremiumFeature>
          {surfAlert && (
            <PremiumFeature
              title="Surf Analyzer VIP"
              description="Leitura completa de surf fica bloqueada no demo."
              className="space-y-2"
            >
              <SurfAlertCard alert={surfAlert} />
              <ModuleMiniScoreboard
                moduleType="SURF"
                title="Resultado Surf"
                assertiveness={surfResult.assertiveness}
                chips={[
                  { label: "Green", value: surfResult.greens, variant: "green" },
                  { label: "SG", value: surfResult.greenSemGale, variant: "green" },
                  { label: "G1", value: surfResult.greenG1, variant: "cyan" },
                  { label: "RED", value: surfResult.reds, variant: "red" },
                  { label: "Total", value: surfResult.total, variant: "neutral" },
                  { label: "Bloq.", value: surfResult.blocked, variant: "yellow" },
                  { label: "Sem risco", value: surfResult.noRisk, variant: "neutral" },
                ]}
                sequencePositive={surfResult.sequencePositive}
                sequenceNegative={surfResult.sequenceNegative}
                breakdown={surfResult.breakdown}
              />
            </PremiumFeature>
          )}
        </div>

        <div className="space-y-4">
          <PremiumFeature
            title="Decisao da engine VIP"
            description="A decisao tecnica fica completa apenas no acesso liberado."
          >
            <EngineDecisionCard decision={d.engineDecision} data={d} />
          </PremiumFeature>
          <PremiumFeature
            title="Tie Alert VIP"
            description="Leitura completa de empate fica bloqueada no demo."
            className="space-y-2"
          >
            <TieAlertCard alert={d.currentTieAlert} />
            <ModuleMiniScoreboard
              moduleType="TIE"
              title="Resultado Tie"
              assertiveness={tieResult.assertiveness}
              chips={[
                { label: "Green", value: tieResult.greens, variant: "green" },
                { label: "Exp.", value: tieResult.expired, variant: "purple" },
                { label: "Total", value: tieResult.total, variant: "neutral" },
              ]}
              sequencePositive={tieResult.sequencePositive}
              sequenceExpired={tieResult.sequenceExpired}
              breakdown={tieResult.breakdown}
            />
          </PremiumFeature>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <LiveTableView lastRound={lastRound} roundId={lastRound.id} />

          <PremiumFeature
            title="Analise estatistica VIP"
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
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
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

        <div className="space-y-4">
          <GlassCard className="border-gold/40">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl btn-gold-grad flex items-center justify-center glow-gold">
                <Crown className="size-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold">Plano gratuito</div>
                <div className="text-[11px] text-muted-foreground">Recursos premium bloqueados</div>
              </div>
            </div>
            <Link
              to="/app/planos"
              className="mt-3 inline-flex w-full justify-center btn-primary-grad rounded-xl py-2 text-xs font-semibold"
            >
              Desbloquear Premium
            </Link>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
