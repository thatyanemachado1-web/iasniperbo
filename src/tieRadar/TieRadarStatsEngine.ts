import type { Round, RoundResult, TieMultiplierLabel, TiePullerStat } from "../types/dashboard";

export const TIE_MULTIPLIER_LABELS: TieMultiplierLabel[] = ["4x", "6x", "10x", "25x", "88x"];

export function emptyTieMultiplierCounts(): Record<TieMultiplierLabel, number> {
  return TIE_MULTIPLIER_LABELS.reduce(
    (acc, label) => {
      acc[label] = 0;
      return acc;
    },
    {} as Record<TieMultiplierLabel, number>,
  );
}

export function normalizeTieMultiplierCounts(
  value?: Partial<Record<TieMultiplierLabel, number>> | null,
): Record<TieMultiplierLabel, number> {
  const next = emptyTieMultiplierCounts();
  for (const label of TIE_MULTIPLIER_LABELS) {
    const numeric = Number(value?.[label]);
    next[label] = Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
  }
  return next;
}

export function tieMultiplierFromRound(round: Round) {
  const explicit = normalizeMultiplier((round as unknown as Record<string, unknown>).tieMultiplier);
  if (explicit) return explicit;
  if (round.result !== "T" || round.bankerScore !== round.playerScore) return null;

  const score = Math.round(Number(round.bankerScore));
  if (!Number.isFinite(score)) return null;
  if (score === 2 || score === 12) return 88;
  if (score === 3 || score === 11) return 25;
  if (score === 4 || score === 10) return 10;
  if (score === 5 || score === 9) return 6;
  if (score === 6 || score === 7 || score === 8) return 4;
  return null;
}

export function tieMultiplierLabelFromRound(round: Round): TieMultiplierLabel | null {
  const multiplier = tieMultiplierFromRound(round);
  if (!multiplier) return null;
  const label = `${multiplier}x` as TieMultiplierLabel;
  return TIE_MULTIPLIER_LABELS.includes(label) ? label : null;
}

export function incrementTieMultiplierCounts(
  current: Partial<Record<TieMultiplierLabel, number>> | undefined,
  round: Round,
) {
  const next = normalizeTieMultiplierCounts(current);
  if (round.result !== "T") return next;
  const label = tieMultiplierLabelFromRound(round);
  if (!label) return next;
  next[label] += 1;
  return next;
}

export function buildTiePullerStats(rounds: Round[] | undefined, window = 7, maxItems = 5): TiePullerStat[] {
  const sortedRounds = (rounds ?? []).slice().sort(compareRounds);
  const stats = new Map<string, TiePullerStat>();

  for (let index = 0; index < sortedRounds.length; index += 1) {
    const trigger = tiePullerTrigger(sortedRounds[index]);
    if (!trigger) continue;

    const lookaheadLimit = Math.min(window, sortedRounds.length - index - 1);
    if (lookaheadLimit <= 0) continue;

    const current = stats.get(trigger.key) ?? {
      ...trigger,
      ties: 0,
      samples: 0,
      hitRate: 0,
      window,
    };
    current.samples += 1;

    for (let distance = 1; distance <= lookaheadLimit; distance += 1) {
      const futureRound = sortedRounds[index + distance];
      if (futureRound?.result !== "T") continue;
      current.ties += 1;
      current.lastDistance = distance;
      current.lastRoundKey = roundKey(futureRound);
      break;
    }

    current.hitRate = current.samples > 0 ? (current.ties / current.samples) * 100 : 0;
    stats.set(trigger.key, current);
  }

  return [...stats.values()]
    .filter((item) => item.ties > 0)
    .sort(
      (a, b) =>
        b.ties - a.ties ||
        b.hitRate - a.hitRate ||
        b.samples - a.samples ||
        sideSort(a.side) - sideSort(b.side) ||
        b.score - a.score,
    )
    .slice(0, maxItems);
}

function tiePullerTrigger(round: Round | undefined) {
  if (!round) return null;
  const side = normalizeRoundSide(round.result);
  if (!side) return null;
  const score = side === "B" ? round.bankerScore : side === "P" ? round.playerScore : round.bankerScore;
  const normalizedScore = Math.round(Number(score));
  if (!Number.isFinite(normalizedScore) || normalizedScore <= 0) return null;
  return {
    key: `${side}${normalizedScore}`,
    side,
    score: normalizedScore,
  };
}

function normalizeRoundSide(value: unknown): RoundResult | null {
  const side = String(value || "").toUpperCase();
  if (side === "B" || side === "P" || side === "T") return side;
  return null;
}

function normalizeMultiplier(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return [4, 6, 10, 25, 88].includes(rounded) ? rounded : null;
}

function compareRounds(a: Round, b: Round) {
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  const timeCompare = String(a.time || "").localeCompare(String(b.time || ""));
  if (timeCompare) return timeCompare;
  return roundKey(a).localeCompare(roundKey(b));
}

function roundKey(round: Round) {
  return `${round.time}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function sideSort(side: RoundResult) {
  if (side === "B") return 0;
  if (side === "P") return 1;
  return 2;
}
