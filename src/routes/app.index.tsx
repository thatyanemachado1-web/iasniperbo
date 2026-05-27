import { createFileRoute } from "@tanstack/react-router";
import { mockDashboardData } from "@/data/mockDashboardData";
import { LiveTableView } from "@/components/dashboard/LiveTableView";
import { BrainAssistantCard } from "@/components/dashboard/BrainAssistantCard";
import { SignalCard } from "@/components/dashboard/SignalCard";
import { TieAlertCard } from "@/components/dashboard/TieAlertCard";
import { EngineDecisionCard } from "@/components/dashboard/EngineDecisionCard";
import { ScoreboardCard } from "@/components/dashboard/ScoreboardCard";
import { RoadmapDots } from "@/components/dashboard/RoadmapDots";
import { PressureChart } from "@/components/dashboard/PressureChart";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Crown, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  calculateAlternationRate,
  calculateBankerFrequency,
  calculateCurrentStreak,
  calculatePlayerFrequency,
  calculateTieFrequency,
} from "@/utils/statistics";

export const Route = createFileRoute("/app/")({
  component: DashboardPage,
});

function DashboardPage() {
  const d = mockDashboardData;
  const lastRound = d.rounds[d.rounds.length - 1];
  const streak = calculateCurrentStreak(d.rounds);
  const stats = {
    banker: calculateBankerFrequency(d.rounds),
    player: calculatePlayerFrequency(d.rounds),
    tie: calculateTieFrequency(d.rounds),
    alt: calculateAlternationRate(d.rounds),
  };

  return (
    <div className="space-y-4">
      {/* Welcome strip */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Olá,</div>
          <div className="text-lg font-bold">
            {d.user.name} <span className="text-muted-foreground font-normal text-sm">— painel operacional</span>
          </div>
        </div>
        <Link
          to="/app/planos"
          className="hidden sm:inline-flex items-center gap-1.5 btn-gold-grad rounded-xl px-3 py-2 text-xs font-bold shine"
        >
          <Crown className="size-3.5" /> Premium
        </Link>
      </div>

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <LiveTableView lastRound={lastRound} roundId={lastRound.id} />

          {/* Análise estatística */}
          <GlassCard>
            <SectionTitle
              title="Análise estatística da mesa"
              subtitle="Pressão estatística calculada pelas últimas rodadas."
              right={<AppBadge tone={d.mockMode ? "amber" : "green"} pulse={!d.mockMode}>
                {d.mockMode ? "Modo demonstração" : "Dados em tempo real"}
              </AppBadge>}
            />
            <PressureChart data={d.pressureSeries} />
            <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-banker"/> Banker Pressure</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-player"/> Player Pressure</span>
              <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-tie"/> Tie Pressure</span>
            </div>
            <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
              <Metric label="Pressão B" value={`${stats.banker.toFixed(0)}%`} tone="text-banker" />
              <Metric label="Pressão P" value={`${stats.player.toFixed(0)}%`} tone="text-player" />
              <Metric label="Pressão T" value={`${stats.tie.toFixed(0)}%`} tone="text-tie" />
              <Metric label="Sequência" value={`${streak.side ?? "-"} x${streak.count}`} />
              <Metric label="Alternância" value={`${stats.alt.toFixed(0)}%`} />
              <Metric label="Padrão" value="Observação" />
            </div>
          </GlassCard>

          {/* Entrada + Tie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SignalCard signal={d.currentSignal} locked />
            <TieAlertCard alert={d.currentTieAlert} locked />
          </div>

          <EngineDecisionCard decision={d.engineDecision} locked />

          {/* Roadmap */}
          <GlassCard>
            <SectionTitle
              title="Histórico recente"
              right={<AppBadge tone="blue">Últimas 30 rodadas</AppBadge>}
            />
            <RoadmapDots rounds={d.rounds} compact />
            <Link to="/app" className="mt-3 inline-flex items-center gap-1 text-xs text-neon-cyan hover:text-neon-blue">
              Ver histórico completo <ChevronRight className="size-3" />
            </Link>
          </GlassCard>
        </div>

        {/* Coluna direita */}
        <div className="space-y-4">
          <BrainAssistantCard />

          <ScoreboardCard
            title="Placar principal"
            assertiveness={d.mainScoreboard.assertiveness}
            color="oklch(0.72 0.18 145)"
            items={[
              { label: "Greens", value: d.mainScoreboard.greens, tone: "var(--success)" },
              { label: "G1", value: d.mainScoreboard.greensG1, tone: "var(--warning)" },
              { label: "Reds", value: d.mainScoreboard.reds, tone: "var(--destructive)" },
            ]}
            note="Entradas Banker/Player"
          />

          <ScoreboardCard
            title="Placar Tie Alert"
            assertiveness={d.tieAlertScoreboard.assertiveness}
            color="oklch(0.65 0.25 295)"
            items={[
              { label: "Greens", value: d.tieAlertScoreboard.greenTieAlerts, tone: "var(--success)" },
              { label: "Expirados", value: d.tieAlertScoreboard.expired, tone: "var(--muted-foreground)" },
              { label: "Total", value: d.tieAlertScoreboard.totalAlerts },
            ]}
            note="Expiração não é RED"
          />

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
            <Link to="/app/planos" className="mt-3 inline-flex w-full justify-center btn-primary-grad rounded-xl py-2 text-xs font-semibold">
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