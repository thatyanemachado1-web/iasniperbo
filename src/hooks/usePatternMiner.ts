import { useMemo } from "react";
import type { Round } from "@/types/dashboard";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";

const SERVER_SNAPSHOT_MAX_LAG_MS = 120_000;

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
  if (Number.isFinite(dashboardMs) && snapshotMs + SERVER_SNAPSHOT_MAX_LAG_MS < dashboardMs) return false;
  const latestRound = rounds[rounds.length - 1];
  const latestAlertRoundId = [...serverSnapshot.entryAlerts, ...serverSnapshot.formingAlerts]
    .map((alert) => alert?.strategy)
    .map((strategy) => strategy?.round_id)
    .filter((roundId): roundId is number => typeof roundId === "number" && Number.isFinite(roundId))
    .sort((a, b) => b - a)[0];
  if (typeof latestAlertRoundId === "number") return latestAlertRoundId >= latestRound.id;
  return hasSharedPatternMinerBank(serverSnapshot);
}

function hasSharedPatternMinerBank(serverSnapshot: PatternMinerSnapshot) {
  return (
    serverSnapshot.entryAlerts.length > 0 ||
    serverSnapshot.formingAlerts.length > 0 ||
    serverSnapshot.hotStrategies.length > 0 ||
    serverSnapshot.ranking.length > 0 ||
    serverSnapshot.strategies.length > 0 ||
    serverSnapshot.scoreboard.totalValidated > 0
  );
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
