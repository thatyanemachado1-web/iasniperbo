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
  const confirmedAlert = snapshot.entryAlerts.find(isPureConfirmedDashboardAlert);

  return (
    <GlassCard className="h-full rounded-xl border-neon-cyan/35 p-3">
      <div className="flex h-full min-w-0 flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl btn-primary-grad glow-blue">
            <BrainCircuit className="size-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-black">Padroes IA</div>
            {confirmedAlert ? (
              <LivePatternStatusBlock alert={confirmedAlert} />
            ) : (
              <WaitingConfirmedEntryBlock />
            )}
          </div>
        </div>

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

function LivePatternStatusBlock({ alert }: { alert: PatternMinerAlert }) {
  const strategy = alert.strategy;
  const side = strategy.next_side ?? strategy.expectedResult;
  const nextSide = side ? formatPulledSide(side) : "Sem tendencia";
  const accuracy = normalizedPercent(
    strategy.next_side_probability ?? strategy.assertiveness ?? strategy.accuracy,
  );

  return (
    <div className="mt-1 rounded-xl border border-success/25 bg-success/10 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-success">
          ENTRADA CONFIRMADA
        </span>
        <AppBadge tone="green" className="px-2 text-[8px]">
          100%
        </AppBadge>
      </div>

      <div className="min-w-0">
        <PatternSequence sequence={strategy.sequence} compact />
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

function WaitingConfirmedEntryBlock() {
  return (
    <div className="mt-1 rounded-xl border border-neon-cyan/12 bg-background/25 px-2.5 py-2">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan">
        Aguardando entrada confirmada
      </div>
      <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
        Somente sinal puro: 100%, amostra valida, sinal atual e red ate 2.
      </div>
    </div>
  );
}

function isPureConfirmedDashboardAlert(alert: PatternMinerAlert) {
  return alert.kind === "validated" && isPureConfirmedStrategy(alert.strategy);
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
