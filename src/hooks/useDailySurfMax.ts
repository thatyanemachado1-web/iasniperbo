import { useMemo } from "react";
import {
  DailySurfMaxEngine,
  compareDailySurfRounds,
  type DailySurfMaxSnapshot,
  type DailySurfRound,
  type DailySurfRoundSource,
} from "@/surf/DailySurfMaxEngine";

interface UseDailySurfMaxParams {
  rounds: DailySurfRoundSource[];
  tableId?: string;
  sourceUpdatedAt?: string | null;
  enabled?: boolean;
}

export function useDailySurfMax({
  rounds,
  tableId = "bac-bo",
  sourceUpdatedAt,
  enabled = true,
}: UseDailySurfMaxParams): DailySurfMaxSnapshot {
  const todayKey = DailySurfMaxEngine.todayKey();

  return useMemo(() => {
    if (!enabled) return DailySurfMaxEngine.empty(tableId, todayKey);

    const normalizedRounds = DailySurfMaxEngine.normalizeRounds(rounds, {
      tableId,
      fallbackTimestamp: sourceUpdatedAt,
    });
    const todayRounds = uniqueDailyRounds(normalizedRounds)
      .filter((round) => round.date_br === todayKey)
      .sort(compareDailySurfRounds);

    if (!todayRounds.length) return DailySurfMaxEngine.empty(tableId, todayKey);
    return DailySurfMaxEngine.recalculate(todayRounds, tableId, todayKey);
  }, [enabled, rounds, sourceUpdatedAt, tableId, todayKey]);
}

function uniqueDailyRounds(rounds: DailySurfRound[]) {
  const byKey = new Map<string, DailySurfRound>();
  for (const round of rounds) {
    byKey.set(`${round.date_br}:${round.round_id}`, round);
  }
  return [...byKey.values()];
}
