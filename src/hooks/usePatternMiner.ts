import { useMemo } from "react";
import type { Round } from "@/types/dashboard";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";

interface UsePatternMinerParams {
  rounds: Round[];
  historyLimit?: PatternMinerHistoryLimit;
  enabled: boolean;
  serverSnapshot?: PatternMinerSnapshot;
  feedStatus?: string | null;
  dashboardUpdatedAt?: string | null;
}

export function usePatternMiner({
  rounds,
  historyLimit = 15000,
  enabled,
  serverSnapshot,
  feedStatus,
  dashboardUpdatedAt,
}: UsePatternMinerParams) {
  const snapshot = useMemo(() => {
    if (!enabled || typeof window === "undefined") return buildEmptySnapshot(historyLimit);
    const agent = new PatternMinerAgent({
      ...DEFAULT_PATTERN_MINER_CONFIG,
      historyLimit,
    });
    const liveSnapshot = agent.scan(rounds, {
      feedStatus,
      dashboardUpdatedAt,
      serverSnapshotUpdatedAt: serverSnapshot?.updatedAt,
    });
    if (serverSnapshot && shouldUseServerSnapshot(serverSnapshot, rounds, dashboardUpdatedAt, feedStatus)) {
      return serverSnapshot;
    }
    return liveSnapshot;
  }, [dashboardUpdatedAt, enabled, feedStatus, historyLimit, rounds, serverSnapshot]);

  return {
    snapshot,
    isUsingRealData: enabled,
  } as const;
}

function shouldUseServerSnapshot(
  serverSnapshot: PatternMinerSnapshot,
  rounds: Round[],
  dashboardUpdatedAt?: string | null,
  feedStatus?: string | null,
) {
  if (!rounds.length) return true;
  const feed = String(feedStatus || "").toLowerCase();
  if (feed === "stale" || feed === "paused") return false;
  const snapshotMs = Date.parse(serverSnapshot.updatedAt || "");
  const dashboardMs = Date.parse(String(dashboardUpdatedAt || ""));
  if (!Number.isFinite(snapshotMs)) return false;
  if (Number.isFinite(dashboardMs) && snapshotMs + 5_000 < dashboardMs) return false;
  const latestRound = rounds[rounds.length - 1];
  const latestAlert = [...serverSnapshot.entryAlerts, ...serverSnapshot.formingAlerts]
    .map((alert) => alert?.strategy)
    .find(Boolean);
  if (!latestAlert?.round_id) return false;
  return latestAlert.round_id >= latestRound.id;
}

function buildEmptySnapshot(historyLimit: PatternMinerHistoryLimit): PatternMinerSnapshot {
  const now = new Date().toISOString();
  return {
    strategies: [],
    ranking: [],
    hotStrategies: [],
    formingAlerts: [],
    entryAlerts: [],
    scoreboard: {
      sg: 0,
      g1: 0,
      red: 0,
      tie: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
      maxSequencePositive: 0,
      maxSequenceNegative: 0,
      totalValidated: 0,
    },
    agent: {
      catalogedStrategies: 0,
      hotStrategies: 0,
      observedStrategies: 0,
      updatedAt: now,
    },
    analyzedRounds: 0,
    historyLimit,
    updatedAt: now,
  };
}
