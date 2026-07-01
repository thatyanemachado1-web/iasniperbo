import { useEffect, useMemo, useState } from "react";
import { readUserSession } from "@/lib/userSession";
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
  const storageScope = useMemo(() => {
    const email = readUserSession().email.trim().toLowerCase();
    return email || "local";
  }, []);

  const [snapshot, setSnapshot] = useState<DailySurfMaxSnapshot>(() =>
    DailySurfMaxEngine.load(tableId, storageScope),
  );

  const todayKey = DailySurfMaxEngine.todayKey();
  const signature = useMemo(
    () => roundsSignature(rounds, sourceUpdatedAt, tableId),
    [rounds, sourceUpdatedAt, tableId],
  );

  useEffect(() => {
    if (!enabled) return;

    const normalizedRounds = DailySurfMaxEngine.normalizeRounds(rounds, {
      tableId,
      fallbackTimestamp: sourceUpdatedAt,
    });
    const todayRounds = uniqueDailyRounds(normalizedRounds)
      .filter((round) => round.date_br === todayKey)
      .sort(compareDailySurfRounds);

    setSnapshot((current) => {
      const base =
        current.dailyMaxSurf.date === todayKey && current.dailyMaxSurf.table_id === tableId
          ? current
          : DailySurfMaxEngine.empty(tableId, todayKey);

      if (!todayRounds.length) {
        if (base === current) return current;
        DailySurfMaxEngine.save(base, storageScope);
        return base;
      }

      const next = applyTodayRounds(base, todayRounds, tableId, todayKey);
      if (isSameSnapshot(current, next)) return current;
      DailySurfMaxEngine.save(next, storageScope);
      return next;
    });
  }, [enabled, signature, storageScope, tableId, todayKey]);

  return snapshot;
}

function applyTodayRounds(
  current: DailySurfMaxSnapshot,
  todayRounds: DailySurfRound[],
  tableId: string,
  todayKey: string,
) {
  const lastRoundId = current.dailyMaxSurf.last_round_id;
  if (!lastRoundId) {
    return preserveDailyMax(current, DailySurfMaxEngine.recalculate(todayRounds, tableId, todayKey));
  }

  const lastIndex = todayRounds.findIndex((round) => round.round_id === lastRoundId);
  if (lastIndex < 0) {
    return preserveDailyMax(current, DailySurfMaxEngine.recalculate(todayRounds, tableId, todayKey));
  }

  let next = current;
  for (const round of todayRounds.slice(lastIndex + 1)) {
    next = DailySurfMaxEngine.processRound(next, round);
  }
  return next;
}

function uniqueDailyRounds(rounds: DailySurfRound[]) {
  const byKey = new Map<string, DailySurfRound>();
  for (const round of rounds) {
    byKey.set(`${round.date_br}:${round.round_id}`, round);
  }
  return [...byKey.values()];
}

function preserveDailyMax(current: DailySurfMaxSnapshot, next: DailySurfMaxSnapshot) {
  if (
    current.dailyMaxSurf.date !== next.dailyMaxSurf.date ||
    current.dailyMaxSurf.table_id !== next.dailyMaxSurf.table_id
  ) {
    return next;
  }

  return {
    currentStreak: next.currentStreak,
    dailyMaxSurf: {
      ...next.dailyMaxSurf,
      banker: Math.max(current.dailyMaxSurf.banker, next.dailyMaxSurf.banker),
      player: Math.max(current.dailyMaxSurf.player, next.dailyMaxSurf.player),
      tie: Math.max(current.dailyMaxSurf.tie, next.dailyMaxSurf.tie),
    },
    dailySurfMemory: next.dailySurfMemory,
  };
}

function roundsSignature(
  rounds: DailySurfRoundSource[],
  sourceUpdatedAt: string | null | undefined,
  tableId: string,
) {
  const first = rounds[0];
  const last = rounds.at(-1);
  return [
    tableId,
    sourceUpdatedAt ?? "",
    rounds.length,
    roundSourceKey(first),
    roundSourceKey(last),
  ].join(":");
}

function roundSourceKey(round: DailySurfRoundSource | undefined) {
  if (!round) return "";
  return `${round.key ?? ""}:${round.id}:${round.time}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function isSameSnapshot(left: DailySurfMaxSnapshot, right: DailySurfMaxSnapshot) {
  return (
    left.currentStreak.side === right.currentStreak.side &&
    left.currentStreak.count === right.currentStreak.count &&
    left.dailyMaxSurf.banker === right.dailyMaxSurf.banker &&
    left.dailyMaxSurf.player === right.dailyMaxSurf.player &&
    left.dailyMaxSurf.tie === right.dailyMaxSurf.tie &&
    left.dailyMaxSurf.date === right.dailyMaxSurf.date &&
    left.dailyMaxSurf.table_id === right.dailyMaxSurf.table_id &&
    left.dailyMaxSurf.last_round_id === right.dailyMaxSurf.last_round_id &&
    isSameDailySurfMemory(left.dailySurfMemory, right.dailySurfMemory)
  );
}

function isSameDailySurfMemory(
  left: DailySurfMaxSnapshot["dailySurfMemory"],
  right: DailySurfMaxSnapshot["dailySurfMemory"],
) {
  return (
    left.dateKey === right.dateKey &&
    left.playerDrops3Plus === right.playerDrops3Plus &&
    left.bankerDrops3Plus === right.bankerDrops3Plus &&
    left.playerMaxDepth === right.playerMaxDepth &&
    left.bankerMaxDepth === right.bankerMaxDepth &&
    left.totalDrops3Plus === right.totalDrops3Plus &&
    left.dominantSide === right.dominantSide &&
    left.dominantPercent === right.dominantPercent &&
    left.recoverySide === right.recoverySide &&
    left.stretchedSide === right.stretchedSide &&
    left.currentDropSide === right.currentDropSide &&
    left.currentDropDepth === right.currentDropDepth &&
    left.surfBias === right.surfBias &&
    left.surfStatus === right.surfStatus &&
    left.confidence === right.confidence &&
    left.reason === right.reason &&
    left.playerMaxDeficit === right.playerMaxDeficit &&
    left.bankerMaxDeficit === right.bankerMaxDeficit
  );
}
