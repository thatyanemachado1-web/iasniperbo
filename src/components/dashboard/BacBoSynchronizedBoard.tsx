import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { Round } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { BacBoBeadPlate, type BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import { BacBoRoadmap4in1 } from "@/components/dashboard/BacBoRoadmap4in1";
import { LateralPayingNumbersCard } from "@/components/dashboard/LateralPayingNumbersCard";
import { NeuralPayingDashboardCard } from "@/components/dashboard/NeuralPayingDashboardCard";
import type { DashboardData } from "@/types/dashboard";
import type { ReactNode } from "react";

const BOARD_ROWS = 6;
const VISIBLE_ROUNDS = 156;

export function BacBoSynchronizedBoard({
  rounds,
  exactResults,
  roadStats,
  dashboardData,
  mode,
  thirdModule,
  mobileCompanionModule,
}: {
  rounds: Round[];
  exactResults?: BacBoResult[];
  roadStats?: { playerWins: number; bankerWins: number; ties: number };
  dashboardData: DashboardData;
  mode: "live" | "mock" | "connecting" | "fallback";
  thirdModule: ReactNode;
  mobileCompanionModule: ReactNode;
}) {
  const allOrdered = normalizeRounds(rounds);
  const ordered = allOrdered.slice(-VISIBLE_ROUNDS);
  const rawBeadPlateResults = exactResults?.length
    ? normalizeExactResults(exactResults)
    : ordered.map((round, slot) => roundToBeadPlateResult(round, slot));
  const beadPlateResults = attachRoundMetadata(rawBeadPlateResults, ordered);
  const fallbackTotals = countBeadPlateResults(beadPlateResults);
  const totals = roadStats
    ? { P: roadStats.playerWins, B: roadStats.bankerWins, T: roadStats.ties }
    : fallbackTotals;
  const total = totals.P + totals.B + totals.T || 1;

  return (
    <GlassCard className="min-w-0">
      <SectionTitle
        title="Roadmap Bac Bo ao vivo"
        subtitle="Mesmas rodadas e numeros reais recebidos pela auditoria."
        right={
          <AppBadge tone={beadPlateResults.length ? "green" : "amber"}>
            {beadPlateResults.length} rodadas
          </AppBadge>
        }
      />

      <div className="mb-3 grid grid-cols-3 overflow-hidden rounded-full border border-white/10 text-[10px] font-black">
        <ResultPercent
          label="Player"
          value={totals.P / total}
          className="bg-player/90 text-white"
        />
        <ResultPercent label="Tie" value={totals.T / total} className="bg-tie/90 text-background" />
        <ResultPercent
          label="Banker"
          value={totals.B / total}
          className="bg-banker/90 text-white"
        />
      </div>

      <div className="bacbo-desktop-board-pair grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
        <BoardViewport
          label="Historico numerico real"
          className="min-w-0 lg:col-start-1 lg:row-start-1"
        >
          <BacBoBeadPlate results={beadPlateResults} />
        </BoardViewport>

        <div className="grid min-w-0 grid-cols-2 items-stretch gap-2 sm:gap-3 lg:col-span-2 lg:col-start-1 lg:row-start-2 xl:grid-cols-3">
          <LateralPayingNumbersCard results={beadPlateResults} rounds={ordered} />
          <NeuralPayingDashboardCard data={dashboardData} mode={mode} />
          <div className="min-w-0">{thirdModule}</div>
          <div className="min-w-0 xl:hidden">{mobileCompanionModule}</div>
        </div>

        <BoardViewport
          label="Roadmap 4 em 1 sincronizado"
          className="min-w-0 lg:col-start-2 lg:row-start-1"
        >
          <BacBoRoadmap4in1 results={beadPlateResults.map(({ id, side }) => ({ id, side }))} />
        </BoardViewport>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-semibold text-muted-foreground">
        <Legend tone="bg-player" label="Player" />
        <Legend tone="bg-banker" label="Banker" />
        <Legend tone="bg-tie" label="Tie" />
        <span className="ml-auto">Ultima: {ordered.at(-1)?.time || "--"}</span>
      </div>
    </GlassCard>
  );
}

function BoardViewport({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-background/35 p-2", className)}>
      <div className="mb-2 text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </div>
      <div className="overflow-x-hidden pb-1 sm:overflow-x-auto">
        <div className="min-w-0 w-full">{children}</div>
      </div>
    </div>
  );
}

function RoadmapMark({ round }: { round: Round }) {
  return (
    <div
      title={roundTitle(round)}
      className={cn(
        "relative size-4 rounded-full border-2 bg-background",
        round.result === "P" && "border-player",
        round.result === "B" && "border-banker",
        round.result === "T" && "border-tie",
      )}
    >
      {round.result === "T" ? <span className="absolute inset-[3px] rounded-full bg-tie" /> : null}
    </div>
  );
}

function ResultPercent({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={cn("px-2 py-1 text-center", className)}>
      {label} {Math.round(value * 100)}%
    </div>
  );
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2 rounded-full", tone)} />
      {label}
    </span>
  );
}

function normalizeRounds(rounds: Round[]) {
  const unique = new Map<number, Round>();
  for (const round of Array.isArray(rounds) ? rounds : []) unique.set(round.id, round);
  return [...unique.values()].sort((a, b) => a.id - b.id);
}

function normalizeExactResults(results: BacBoResult[]) {
  return results
    .map((result, index) => ({
      ...result,
      slot: Number.isInteger(result.slot) ? Number(result.slot) : index,
    }))
    .filter((result) => result.slot >= 0 && result.slot < VISIBLE_ROUNDS)
    .sort((left, right) => left.slot - right.slot);
}

function countBeadPlateResults(results: BacBoResult[]) {
  return results.reduce(
    (counts, result) => {
      if (result.side === "PLAYER") counts.P += 1;
      else if (result.side === "BANKER") counts.B += 1;
      else counts.T += 1;
      return counts;
    },
    { B: 0, P: 0, T: 0 },
  );
}

function roundTitle(round: Round) {
  return `#${round.id} - Banker ${round.bankerScore} x ${round.playerScore} Player - ${round.time}`;
}

function roundToBeadPlateResult(round: Round, slot: number): BacBoResult {
  return {
    id: String(round.id),
    side: round.result === "B" ? "BANKER" : round.result === "P" ? "PLAYER" : "TIE",
    value: round.result === "P" ? round.playerScore : round.bankerScore,
    slot,
    time: round.time,
    tieMultiplier: round.tieMultiplier ?? null,
  };
}

export function attachRoundMetadata(results: BacBoResult[], rounds: Round[]) {
  if (!results.length || !rounds.length) return results;
  const normalizedRounds = rounds.map((round) => ({
    side:
      round.result === "P"
        ? ("PLAYER" as const)
        : round.result === "B"
          ? ("BANKER" as const)
          : ("TIE" as const),
    value: round.result === "P" ? round.playerScore : round.bankerScore,
    time: round.time,
    tieMultiplier: round.tieMultiplier ?? null,
  }));
  let best: { plateEnd: number; roundEnd: number; length: number } | null = null;
  const maxShift = Math.min(8, Math.max(results.length, normalizedRounds.length));
  for (let plateShift = 0; plateShift <= maxShift; plateShift += 1) {
    for (let roundShift = 0; roundShift <= maxShift; roundShift += 1) {
      let plateIndex = results.length - 1 - plateShift;
      let roundIndex = normalizedRounds.length - 1 - roundShift;
      let length = 0;
      while (plateIndex >= 0 && roundIndex >= 0) {
        const plate = results[plateIndex];
        const round = normalizedRounds[roundIndex];
        if (plate.side !== round.side || plate.value !== round.value) break;
        length += 1;
        plateIndex -= 1;
        roundIndex -= 1;
      }
      if (!best || length > best.length)
        best = {
          plateEnd: results.length - 1 - plateShift,
          roundEnd: normalizedRounds.length - 1 - roundShift,
          length,
        };
    }
  }
  if (!best || best.length < 2) return results;
  const enriched = results.map((result) => ({ ...result }));
  for (let offset = 0; offset < best.length; offset += 1) {
    const plateIndex = best.plateEnd - offset;
    const roundIndex = best.roundEnd - offset;
    const round = normalizedRounds[roundIndex];
    enriched[plateIndex].time = round.time;
    enriched[plateIndex].tieMultiplier = round.tieMultiplier;
  }
  return enriched;
}
