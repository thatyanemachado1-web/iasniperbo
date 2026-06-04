import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight } from "lucide-react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { formatPercent, formatPulledSide } from "@/patternMiner/PatternMinerDisplay";
import type {
  PatternMinerScoreboard,
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
  const hotPattern =
    snapshot.entryAlerts[0]?.strategy ?? snapshot.hotStrategies[0] ?? snapshot.ranking[0];
  const hasGeneralData = isUsingRealData && snapshot.scoreboard.totalValidated > 0;
  const hasPatternData = isUsingRealData && Boolean(hotPattern) && (hotPattern?.totalValidated ?? 0) > 0;

  return (
    <GlassCard className="rounded-xl border-neon-cyan/35 p-3">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl btn-primary-grad glow-blue">
          <BrainCircuit className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">Padrão Quente Detectado</div>
          {!isUsingRealData ? (
            <div className="mt-1 text-[11px] text-warning">
              Aguardando histórico real da plataforma.
            </div>
          ) : hotPattern ? (
            <div className="mt-2 space-y-2">
              <PatternSequence sequence={hotPattern.sequence} compact />
              <div className="text-[11px]">
                <span className="text-muted-foreground">Leitura: </span>
                {hotPattern.expectedResult ? (
                  <span className="font-black">{formatPulledSide(hotPattern.expectedResult)}</span>
                ) : (
                  <span className="text-warning">Amostra insuficiente</span>
                )}
              </div>
              <div className="text-[11px] text-neon-cyan">
                {formatPercent(hotPattern.assertiveness)}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Padrão detectado, mas ainda sem amostra suficiente para dizer o que puxou.
            </div>
          )}

          <div className="mt-3 grid gap-2">
            <PatternScorePanel
              title="Placar geral"
              data={hasGeneralData ? snapshot.scoreboard : null}
            />
            <PatternScorePanel
              title="Padrão atual"
              data={hasPatternData && hotPattern ? hotPattern : null}
            />
          </div>

          <Link
            to="/app/padroes"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neon-cyan hover:text-neon-blue"
          >
            Ver detalhes <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}

function PatternScorePanel({
  title,
  data,
}: {
  title: string;
  data: PatternMinerScoreboard | PatternMinerStrategy | null;
}) {
  const sg = data?.sg ?? null;
  const g1 = data?.g1 ?? null;
  const red = data?.red ?? null;
  const tie = data?.tie ?? null;
  const green = sg === null || g1 === null ? null : sg + g1;

  return (
    <div className="rounded-xl border border-neon-cyan/15 bg-background/28 px-2 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.14em] text-neon-cyan">
          {title}
        </span>
        <span className="truncate rounded-full border border-border/45 bg-secondary/35 px-1.5 py-0.5 text-[8px] font-black uppercase text-muted-foreground">
          SQ {currentSequenceLabel(data)}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1">
        <ScoreChip label="Green" value={formatScoreValue(green)} tone="green" />
        <ScoreChip label="SG" value={formatScoreValue(sg)} tone="green" />
        <ScoreChip label="G1" value={formatScoreValue(g1)} tone="cyan" />
        <ScoreChip label="RED" value={formatScoreValue(red)} tone="red" />
        <ScoreChip label="EMP" value={formatScoreValue(tie)} tone="amber" />
        <ScoreChip label="SQ max G" value={formatScoreValue(data?.maxSequencePositive ?? null)} tone="green" />
        <ScoreChip label="SQ max R" value={formatScoreValue(data?.maxSequenceNegative ?? null)} tone="red" />
        <ScoreChip label="Total" value={formatScoreValue(data?.totalValidated ?? null)} tone="neutral" />
      </div>
    </div>
  );
}

function ScoreChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "cyan" | "red" | "amber" | "neutral";
}) {
  return (
    <div className={`rounded-lg border px-1.5 py-1 ${scoreToneClass(tone)}`}>
      <div className="truncate text-[7px] font-bold uppercase tracking-[0.08em] opacity-75">
        {label}
      </div>
      <div className="truncate text-[11px] font-black leading-tight">{value}</div>
    </div>
  );
}

function currentSequenceLabel(data: PatternMinerScoreboard | PatternMinerStrategy | null) {
  if (!data) return "coletando";
  if (data.sequencePositive > 0) return `${data.sequencePositive} GREEN`;
  if (data.sequenceNegative > 0) return `${data.sequenceNegative} RED`;
  return "coletando";
}

function formatScoreValue(value: number | null) {
  return typeof value === "number" && value > 0 ? String(value) : "coletando";
}

function scoreToneClass(tone: "green" | "cyan" | "red" | "amber" | "neutral") {
  if (tone === "green") return "border-success/25 bg-success/10 text-success";
  if (tone === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  if (tone === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "amber") return "border-warning/25 bg-warning/10 text-warning";
  return "border-border/45 bg-secondary/30 text-muted-foreground";
}
