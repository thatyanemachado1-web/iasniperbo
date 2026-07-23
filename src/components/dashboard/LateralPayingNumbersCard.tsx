import { AppBadge } from "@/components/ui-app/AppBadge";
import type { Round } from "@/types/dashboard";
import type { BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import { cn } from "@/lib/utils";
import {
  buildLateralPayingHistory as buildEngineHistory,
  buildLateralPayingPatterns as buildPatterns,
  findActiveLateralPayingReading as findActiveReading,
  findBlockedLateralPayingReading as findBlockedReading,
  isQualifiedLateralPayingPattern as isQualified,
  isLateralPatternBlocked,
  type LateralPayingHistoryEntry as HistoryItem,
  type LateralPayingPattern as Pattern,
} from "@/utils/lateralMotors";

type Side = BacBoResult["side"];

const SIDE_LABEL: Record<Side, string> = { PLAYER: "PLAYER", BANKER: "BANKER", TIE: "EMPATE" };

export function LateralPayingNumbersCard({
  results,
  rounds,
}: {
  results: BacBoResult[];
  rounds: Round[];
}) {
  const cycle = results.slice(-200);
  const patterns = buildPatterns(cycle);
  const activeReading = findActiveReading(cycle, patterns);
  const blockedReading = activeReading ? null : findBlockedReading(cycle, patterns);
  const active = activeReading?.pattern ?? null;
  const blockedPattern = blockedReading?.pattern ?? null;
  const displayPattern = active ?? blockedPattern;
  const strongest = displayPattern ?? strongestQualifiedPattern(patterns);
  const strongestIsBlocked = strongest ? isLateralPatternBlocked(strongest.reds) : false;
  const blocked = patterns.filter((item) => isLateralPatternBlocked(item.reds)).length;
  const history = buildEngineHistory(cycle, rounds).slice(-20).reverse();
  const scoreboard = history.reduce(
    (score, item) => {
      if (item.isTie || item.outcome === "TIE") score.ties += 1;
      else if (item.outcome === "SG") score.sg += 1;
      else if (item.outcome === "G1") score.g1 += 1;
      else if (item.outcome === "RED") score.reds += 1;
      return score;
    },
    { sg: 0, g1: 0, ties: 0, reds: 0 },
  );
  const greens = displayPattern ? displayPattern.sg + displayPattern.g1 : 0;
  const force =
    displayPattern && greens + displayPattern.reds > 0
      ? Math.round((greens / (greens + displayPattern.reds)) * 100)
      : 0;

  return (
    <section
      className={cn(
        "relative h-full min-w-0 overflow-hidden rounded-xl border bg-background/35 p-1.5 sm:p-2.5",
        blockedPattern
          ? "border-red-500/45"
          : active
            ? sideBorder(active.target)
            : "border-white/10",
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.025]" />

      <div className="relative mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            Motor lateral
          </div>
          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Número pagante lateral
          </div>
        </div>
        <div aria-live="polite">
          <AppBadge
            tone={blockedPattern ? "red" : active ? sideBadge(active.target) : "muted"}
            pulse={Boolean(active)}
            className="px-1.5 py-0 text-[8px]"
          >
            {blockedPattern
              ? "⚠️ 2 REDS"
              : active
                ? (activeReading?.attempt ?? "Lateral")
                : "Procurando"}
          </AppBadge>
        </div>
      </div>

      <div className="relative space-y-2">
        {active ? (
          <div
            className={cn("rounded-xl border px-3 py-2.5 text-center", sidePanel(active.target))}
          >
            <div
              className={cn(
                "text-[11px] font-black uppercase leading-tight sm:text-lg sm:leading-none",
                sideText(active.target),
              )}
            >
              {activeReading?.attempt === "G1"
                ? `Aguardando G1 ${SIDE_LABEL[active.target]}`
                : `Entrada ${SIDE_LABEL[active.target]}`}
            </div>
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.06em]">
              {SIDE_LABEL[active.target]} • até G1 • {force}% na amostra atual
            </div>
          </div>
        ) : blockedPattern ? (
          <div
            className="rounded-xl border border-red-500/45 bg-red-500/10 px-3 py-2.5 text-center"
            role="status"
          >
            <div className="text-[11px] font-black uppercase leading-tight text-red-400 sm:text-lg sm:leading-none">
              Entrada bloqueada
            </div>
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.06em]">
              Padrão atingiu 2 REDs • não enviar nova entrada
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-secondary/20 px-3 py-2.5 text-center">
            <div className="text-[11px] font-black uppercase leading-tight text-muted-foreground sm:text-lg sm:leading-none">
              Aguardar
            </div>
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.06em]">
              Procurando gatilho lateral confirmado
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <StatChip
            label="Força"
            value={displayPattern ? `${force}%` : "--"}
            tone={displayPattern?.target}
          />
          <StatChip
            label="Número"
            value={displayPattern ? String(displayPattern.triggerValue) : "--"}
            tone={displayPattern?.triggerSide}
            circle={Boolean(displayPattern)}
          />
          <StatChip label="Validade" value="G1" />
        </div>

        <details className="group rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver mais — resultados e análise</span>
            <span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
        <InfoBox title="Placar do ciclo - reseta em 200">
          SG {scoreboard.sg} - G1 {scoreboard.g1} - EMP {scoreboard.ties} - RD {scoreboard.reds}
        </InfoBox>

        {active ? (
          <InfoBox title="Leitura ativa">
            <NumberToken value={active.triggerValue} side={active.triggerSide} />
            <span> - puxando </span>
            <span className={sideText(active.target)}>{SIDE_LABEL[active.target]}</span>
            <span> - {activeReading?.attempt}</span>
          </InfoBox>
        ) : blockedPattern ? (
          <InfoBox title="Bloqueio ativo">
            <NumberToken value={blockedPattern.triggerValue} side={blockedPattern.triggerSide} />
            <span> - padrão travado com </span>
            <span className="font-black text-red-400">2 REDs</span>
          </InfoBox>
        ) : null}

        {strongest ? (
          <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black uppercase tracking-[0.08em] text-muted-foreground">
                Origem técnica
              </span>
              <span className={strongestIsBlocked ? "font-black text-red-400" : "text-neon-cyan"}>
                {strongestIsBlocked ? "Bloqueado 2 REDs" : "Pagante lateral"}
              </span>
            </div>
            <div className="mt-1">
              <b>Número </b>
              <NumberToken value={strongest.triggerValue} side={strongest.triggerSide} />{" "}
              <span className={sideText(strongest.triggerSide)}>
                {SIDE_LABEL[strongest.triggerSide]}
              </span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2">
              <span>
                Puxou: <b className={sideText(strongest.target)}>{SIDE_LABEL[strongest.target]}</b>
              </span>
              <span>SG à direita</span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2 text-muted-foreground">
              <span>Amostra: {strongest.samples}</span>
              <span>G1 abaixo do SG</span>
            </div>
            <div
              className={cn(
                "mt-0.5 text-right",
                strongestIsBlocked ? "font-black text-red-400" : "text-muted-foreground",
              )}
            >
              Reds: {strongest.reds}
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
          Entrada oficial:{" "}
          <span
            className={
              blockedPattern ? "font-black text-red-400" : active ? sideText(active.target) : ""
            }
          >
            {blockedPattern ? "BLOQUEADA" : active ? SIDE_LABEL[active.target] : "aguardando"}
          </span>
        </div>

        <details className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[8px]">
          <summary className="relative cursor-pointer pr-[42px] font-black uppercase tracking-[0.08em] text-muted-foreground sm:pr-[88px]">
            Entradas
            <span className="absolute right-0 top-0 whitespace-nowrap">
              <span className="sr-only">{cycle.length}/200 no ciclo</span>
              <span aria-hidden="true" className="sm:hidden">
                {cycle.length}/200
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                {cycle.length}/200 no ciclo
              </span>
            </span>
          </summary>
          <div className="mt-1.5 w-full min-w-0 max-h-24 space-y-1 overflow-y-auto">
            {history.length ? (
              history.map((item) => <HistoryRow key={item.id} item={item} />)
            ) : (
              <div className="py-2 text-center text-muted-foreground">
                Sem resultados deste padrão
              </div>
            )}
          </div>
        </details>

        <div className="text-[8px] text-muted-foreground">
          {blocked} padrões bloqueados ao atingir 2 REDs.
        </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function strongestQualifiedPattern(patterns: Pattern[]) {
  return (
    patterns.filter(isQualified).sort((a, b) => b.samples - a.samples || b.sg - a.sg)[0] ?? null
  );
}

function HistoryRow({ item }: { item: HistoryItem }) {
  const isTie = item.isTie || item.outcome === "TIE";
  const label = isTie
    ? `EMPATE ${item.tieLabel && item.tieLabel !== "EMPATE" ? item.tieLabel : ""}`.trim()
    : item.outcome === "SG"
      ? `${SIDE_LABEL[item.target]} GREEN SG`
      : item.outcome === "G1"
        ? `${SIDE_LABEL[item.target]} GREEN G1`
        : `${SIDE_LABEL[item.target]} RED`;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded border px-2 py-1 font-black",
        isTie
          ? "border-amber-400/25 text-amber-300"
          : item.outcome === "RED"
            ? "border-red-400/25 text-red-400"
            : "border-emerald-400/25 text-emerald-400",
      )}
    >
      <span>{label}</span>
      {item.time ? <span className="font-semibold text-muted-foreground">{item.time}</span> : null}
    </div>
  );
}

function InfoBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 break-words rounded-lg border border-white/10 bg-background/20 px-1.5 py-1.5 text-[7px] sm:px-2 sm:text-[9px]">
      <div className="font-black uppercase tracking-[0.04em] text-muted-foreground sm:tracking-[0.08em]">
        {title}
      </div>
      <div className="mt-0.5 font-semibold text-foreground">{children}</div>
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
  circle,
}: {
  label: string;
  value: string;
  tone?: Side;
  circle?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-background/30 px-1 py-1.5 sm:px-2 sm:py-2",
        tone ? sideBorder(tone) : "border-white/10",
      )}
    >
      <div className="truncate text-[6px] font-black uppercase text-muted-foreground sm:text-[8px]">
        {label}
      </div>
      <div className={cn("mt-1 text-[10px] font-black sm:text-sm", tone && sideText(tone))}>
        {circle && tone ? <NumberToken value={Number(value)} side={tone} /> : value}
      </div>
    </div>
  );
}

function NumberToken({ value, side }: { value: number; side: Side }) {
  return (
    <span
      className={cn(
        "inline-flex size-5 items-center justify-center rounded-full text-[10px] font-black text-white",
        side === "PLAYER"
          ? "bg-player"
          : side === "BANKER"
            ? "bg-banker"
            : "bg-tie text-background",
      )}
    >
      {value}
    </span>
  );
}

function sideText(side: Side) {
  return side === "PLAYER" ? "text-player" : side === "BANKER" ? "text-banker" : "text-tie";
}
function sideBorder(side: Side) {
  return side === "PLAYER"
    ? "border-player/35"
    : side === "BANKER"
      ? "border-banker/35"
      : "border-tie/35";
}
function sidePanel(side: Side) {
  return side === "PLAYER"
    ? "border-player/35 bg-player/10"
    : side === "BANKER"
      ? "border-banker/35 bg-banker/10"
      : "border-tie/35 bg-tie/10";
}
function sideBadge(side: Side): "blue" | "red" | "amber" {
  return side === "PLAYER" ? "blue" : side === "BANKER" ? "red" : "amber";
}
