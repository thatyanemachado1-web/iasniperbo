import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit, DatabaseZap, Flame, LineChart, Trophy } from "lucide-react";
import { useState } from "react";
import { PatternAlertCard } from "@/components/patternMiner/PatternAlertCard";
import { PatternStrategyCard } from "@/components/patternMiner/PatternStrategyCard";
import { StrategyConclusion } from "@/components/patternMiner/PatternSequence";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboardData } from "@/hooks/useDashboardData";
import { usePatternMiner } from "@/hooks/usePatternMiner";
import {
  PATTERN_MINER_HISTORY_OPTIONS,
  PATTERN_MINER_TOP_STRATEGIES_LIMIT,
} from "@/patternMiner/PatternMinerEngine";
import { formatPercent } from "@/patternMiner/PatternMinerDisplay";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";

export const Route = createFileRoute("/app/padroes")({
  component: PatternMinerPage,
  head: () => ({
    meta: [
      { title: "Minerador de Padrões — SNIPER BO IA" },
      { name: "description", content: "Descubra padrões recorrentes da mesa BAC BO com o minerador estatístico do SNIPER BO IA: ocorrências, força e direção." },
      { property: "og:title", content: "Minerador de Padrões — SNIPER BO IA" },
      { property: "og:description", content: "Padrões recorrentes da mesa BAC BO detectados por IA." },
      { property: "og:url", content: "https://sniperbo.com/app/padroes" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://sniperbo.com/app/padroes" }],
  }),
});

function PatternMinerPage() {
  const { data: dashboardData, mode } = useDashboardData();
  const [historyLimit, setHistoryLimit] = useState<PatternMinerHistoryLimit>(15000);
  const hasRealHistory = mode === "live" && !dashboardData.mockMode;
  const { snapshot, isUsingRealData } = usePatternMiner({
    rounds: dashboardData.rounds,
    historyLimit,
    enabled: hasRealHistory,
  });
  const primaryAlerts = [...snapshot.entryAlerts, ...snapshot.formingAlerts];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black">Padrões IA</h1>
            <AppBadge tone="blue" pulse>
              PatternMiner IA
            </AppBadge>
            <AppBadge tone="purple">Banco Neural de Estratégias</AppBadge>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Motor independente para mineração, ranking e alertas próprios de padrões pagantes.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Histórico analisado</span>
          <Select
            value={String(historyLimit)}
            onValueChange={(value) => setHistoryLimit(Number(value) as PatternMinerHistoryLimit)}
          >
            <SelectTrigger className="w-40 bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATTERN_MINER_HISTORY_OPTIONS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  Últimas {option.toLocaleString("pt-BR")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!isUsingRealData && (
        <GlassCard className="rounded-xl border-warning/40">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-5 text-warning" />
            <div>
              <div className="text-sm font-black text-warning">
                Aguardando histórico real da plataforma
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                O PatternMiner não calcula ranking, assertividade ou alertas com dados de
                demonstração. Assim que o dashboard receber histórico real, o banco próprio será
                atualizado automaticamente.
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      <PatternMinerScoreboard snapshot={snapshot} />

      {primaryAlerts.length > 0 && (
        <div className="space-y-3">
          {primaryAlerts.slice(0, 2).map((alert) => (
            <PatternAlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      <Tabs defaultValue="hot" className="space-y-3">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:inline-flex md:w-auto">
          <TabsTrigger value="hot" className="gap-1.5">
            <Flame className="size-3.5" /> Estratégias Quentes
          </TabsTrigger>
          <TabsTrigger value="forming" className="gap-1.5">
            <LineChart className="size-3.5" /> Em Formação
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-1.5">
            <Trophy className="size-3.5" /> Ranking
          </TabsTrigger>
          <TabsTrigger value="agent" className="gap-1.5">
            <BrainCircuit className="size-3.5" /> PatternMinerAgent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot" className="space-y-3">
          <SectionTitle
            title="🔥 Estratégias Quentes"
            subtitle={`Top ${PATTERN_MINER_TOP_STRATEGIES_LIMIT} estratégias numeradas e pagantes com amostra real suficiente.`}
          />
          {snapshot.hotStrategies.length ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {snapshot.hotStrategies
                .slice(0, PATTERN_MINER_TOP_STRATEGIES_LIMIT)
                .map((strategy) => (
                  <PatternStrategyCard key={strategy.id} strategy={strategy} />
                ))}
            </div>
          ) : (
            <EmptyState text="Nenhuma estratégia quente com amostra suficiente no histórico atual." />
          )}
        </TabsContent>

        <TabsContent value="forming" className="space-y-3">
          <SectionTitle
            title="📈 Em Formação"
            subtitle="Padrões completos ou parciais detectados nas últimas rodadas."
          />
          {[...snapshot.entryAlerts, ...snapshot.formingAlerts].length ? (
            <div className="space-y-3">
              {[...snapshot.entryAlerts, ...snapshot.formingAlerts].map((alert) => (
                <PatternAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <EmptyState text="Nenhum padrão em formação agora." />
          )}
        </TabsContent>

        <TabsContent value="ranking" className="space-y-3">
          <SectionTitle
            title="🏆 Ranking"
            subtitle={`Estratégias catalogadas pelo banco próprio, com prioridade para padrões numerados. Mostrando ${Math.min(snapshot.ranking.length, 120)} de ${snapshot.ranking.length}.`}
          />
          {snapshot.ranking.length ? (
            <div className="space-y-3">
              {snapshot.ranking.slice(0, 120).map((strategy) => (
                <div key={strategy.id} className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">
                  <div className="flex h-10 items-center justify-center rounded-xl bg-secondary/40 text-sm font-black text-neon-cyan">
                    {strategy.rank <= 3 ? ["🥇", "🥈", "🥉"][strategy.rank - 1] : strategy.rank}
                  </div>
                  <PatternStrategyCard strategy={strategy} compact />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="Nenhuma estratégia catalogada com o histórico real disponível." />
          )}
        </TabsContent>

        <TabsContent value="agent" className="space-y-3">
          <SectionTitle
            title="🤖 PatternMinerAgent"
            subtitle="Agente exclusivo responsável por encontrar, monitorar, validar e ranquear padrões."
          />
          <GlassCard className="rounded-xl">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <AgentMetric
                label="Estratégias catalogadas"
                value={snapshot.agent.catalogedStrategies}
              />
              <AgentMetric
                label="Estratégias quentes"
                value={snapshot.agent.hotStrategies}
                tone="text-success"
              />
              <AgentMetric
                label="Estratégias observadas"
                value={snapshot.agent.observedStrategies}
                tone="text-warning"
              />
              <AgentMetric
                label="Rodadas analisadas"
                value={snapshot.analyzedRounds}
                tone="text-neon-cyan"
              />
            </div>
            <div className="mt-4 rounded-xl border border-border/60 bg-background/25 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Última descoberta
              </div>
              {snapshot.agent.lastDiscovery ? (
                <div className="mt-2">
                  <StrategyConclusion strategy={snapshot.agent.lastDiscovery} />
                </div>
              ) : (
                <div className="mt-1 text-xs text-warning">
                  Padrão detectado, mas ainda sem amostra suficiente para dizer o que puxou.
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <AppBadge tone="blue">Motor independente</AppBadge>
              <AppBadge tone="green">Ranking dinâmico</AppBadge>
              <AppBadge tone="amber">Tie separado</AppBadge>
              <span>Atualizado em {new Date(snapshot.updatedAt).toLocaleString("pt-BR")}</span>
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PatternMinerScoreboard({ snapshot }: { snapshot: PatternMinerSnapshot }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <ScoreMetric label="SG" value={snapshot.scoreboard.sg} tone="text-success" />
      <ScoreMetric label="G1" value={snapshot.scoreboard.g1} tone="text-neon-cyan" />
      <ScoreMetric label="RED" value={snapshot.scoreboard.red} tone="text-destructive" />
      <ScoreMetric label="🟡 TIE" value={snapshot.scoreboard.tie} tone="text-warning" />
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

function AgentMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <GlassCard className="rounded-xl">
      <div className="text-sm text-muted-foreground">{text}</div>
    </GlassCard>
  );
}
