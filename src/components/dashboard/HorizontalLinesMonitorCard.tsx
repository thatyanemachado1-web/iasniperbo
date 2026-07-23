import type { BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import { DASHBOARD_MODULE_CARD_ROOT } from "@/components/dashboard/dashboardModuleCardLayout";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { cn } from "@/lib/utils";

const LINE_COUNT = 6;

type LineDistribution = {
  line: number;
  total: number;
  banker: number;
  player: number;
  tie: number;
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
  leadingPair: string;
};

export function HorizontalLinesMonitorCard({ results }: { results: BacBoResult[] }) {
  const lines = buildLineDistributions(results);
  const nextLine = resolveNextLine(results);
  const activeLine = lines[nextLine - 1];
  const prevailingSide = prevailingSideLabel(activeLine);
  const highestTiePercent = Math.max(...lines.map((line) => line.tiePercent));
  const activeHasHighTiePresence =
    activeLine.tiePercent > 0 && activeLine.tiePercent === highestTiePercent;

  return (
    <GlassCard
      className={cn(
        DASHBOARD_MODULE_CARD_ROOT,
        "digital-risk-card min-w-0 p-2 transition-colors duration-300 sm:p-3",
        prevailingSide === "PLAYER"
          ? "border-player/45"
          : prevailingSide === "BANKER"
            ? "border-banker/45"
            : "border-white/15",
      )}
      aria-label="Linhas Bead Plate Horizontal"
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.025]" />
      <div className="relative flex h-full min-w-0 flex-col gap-2">
        <header className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              Linhas Bead Plate Horizontal
            </h3>
            <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/70">
              Acompanhamento proporcional em tempo real
            </p>
          </div>
        </header>

        <section
          className={cn(
            "rounded-xl border px-3 py-2.5",
            prevailingSide === "PLAYER"
              ? "border-player/45 bg-player/8"
              : prevailingSide === "BANKER"
                ? "border-banker/45 bg-banker/8"
                : "border-white/15 bg-secondary/15",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-[8px] font-black uppercase tracking-[0.1em] text-neon-cyan">
              Próxima linha · Linha {nextLine}
            </div>
            <div className="text-[7px] font-semibold text-muted-foreground">
              {activeLine.total} resultados
            </div>
          </div>
          <div
            className={cn(
              "mt-1 text-sm font-black uppercase",
              prevailingSide === "PLAYER"
                ? "text-player"
                : prevailingSide === "BANKER"
                  ? "text-banker"
                  : "text-foreground",
            )}
          >
            {prevailingSide === "EQUILÍBRIO" ? "Equilíbrio Player / Banker" : prevailingSide}
          </div>
          <ProportionRow line={activeLine} compact={false} />
          {activeHasHighTiePresence ? (
            <div className="mt-1 text-[8px] font-black uppercase tracking-[0.08em] text-tie">
              Presença de empate alta
            </div>
          ) : null}
        </section>

        <div className="space-y-1">
          {lines.map((line) => {
            const isNext = line.line === nextLine;
            const hasHighestTie = line.tiePercent > 0 && line.tiePercent === highestTiePercent;
            return (
              <div
                key={line.line}
                className={cn(
                  "grid grid-cols-[58px_minmax(0,1fr)] items-center gap-1.5 rounded-lg border border-white/7 bg-background/20 px-2 py-1.5",
                  isNext &&
                    (prevailingSide === "PLAYER"
                      ? "border-player/45 bg-player/8"
                      : prevailingSide === "BANKER"
                        ? "border-banker/45 bg-banker/8"
                        : "border-white/20 bg-secondary/15"),
                  hasHighestTie && !isNext && "border-tie/25",
                )}
              >
                <div className="flex items-center gap-1 text-[9px] font-black text-foreground">
                  LINHA {line.line}
                  {isNext ? <span className="text-neon-cyan">←</span> : null}
                </div>
                <ProportionRow line={line} compact />
              </div>
            );
          })}
        </div>

        <div className="mt-auto text-[7px] font-semibold leading-snug text-muted-foreground/70">
          Proporção estatística por linha. Não representa previsão ou entrada.
        </div>
      </div>
    </GlassCard>
  );
}

function ProportionRow({ line, compact }: { line: LineDistribution; compact: boolean }) {
  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-3 items-center gap-2 font-black tabular-nums",
        compact ? "max-w-[210px] text-[8px]" : "mt-1.5 max-w-[240px] text-[10px]",
      )}
    >
      <span className="whitespace-nowrap text-banker">🔴 {line.bankerPercent}%</span>
      <span className="whitespace-nowrap text-player">🔵 {line.playerPercent}%</span>
      <span className="whitespace-nowrap text-tie">🟡 {line.tiePercent}%</span>
    </div>
  );
}

function buildLineDistributions(results: BacBoResult[]): LineDistribution[] {
  const normalized = results
    .filter((result) => Number.isFinite(Number(result.slot)))
    .sort((left, right) => Number(left.slot) - Number(right.slot));

  return Array.from({ length: LINE_COUNT }, (_, index) => {
    const line = index + 1;
    const lineResults = normalized.filter(
      (result) => modulo(Number(result.slot), LINE_COUNT) === index,
    );
    const banker = lineResults.filter((result) => result.side === "BANKER").length;
    const player = lineResults.filter((result) => result.side === "PLAYER").length;
    const tie = lineResults.filter((result) => result.side === "TIE").length;
    const total = banker + player + tie;
    const bankerPercent = percentage(banker, total);
    const playerPercent = percentage(player, total);
    const tiePercent = Math.max(0, 100 - bankerPercent - playerPercent);

    return {
      line,
      total,
      banker,
      player,
      tie,
      bankerPercent,
      playerPercent,
      tiePercent,
      leadingPair: leadingPairLabel({ bankerPercent, playerPercent, tiePercent }),
    };
  });
}

function resolveNextLine(results: BacBoResult[]) {
  const occupiedSlots = results
    .map((result) => Number(result.slot))
    .filter((slot) => Number.isFinite(slot) && slot >= 0);
  if (!occupiedSlots.length) return 1;
  return modulo(Math.max(...occupiedSlots) + 1, LINE_COUNT) + 1;
}

function leadingPairLabel({
  bankerPercent,
  playerPercent,
  tiePercent,
}: {
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
}) {
  return [
    { label: "BANKER", value: bankerPercent, order: 0 },
    { label: "PLAYER", value: playerPercent, order: 1 },
    { label: "EMPATE", value: tiePercent, order: 2 },
  ]
    .sort((left, right) => right.value - left.value || left.order - right.order)
    .slice(0, 2)
    .map((item) => item.label)
    .join(" / ");
}

function prevailingSideLabel(line: LineDistribution): "PLAYER" | "BANKER" | "EQUILÍBRIO" {
  if (line.playerPercent === line.bankerPercent) return "EQUILÍBRIO";
  return line.playerPercent > line.bankerPercent ? "PLAYER" : "BANKER";
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function modulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}
