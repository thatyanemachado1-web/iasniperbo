import { useMemo } from "react";
import type { DashboardData, Round } from "@/types/dashboard";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";

const SERVER_SNAPSHOT_MAX_LAG_MS = 120_000;

export function resolvePatternMinerFeedStatus(data: Pick<DashboardData, "currentSignal" | "neuralReading">) {
  if (data.currentSignal?.id === "feed-paused") return "paused";
  if (data.neuralReading?.paganteStatus === "FEED_PAUSADO") return "paused";
  return null;
}

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
    const liveSnapshot = agent.scan(rounds);
    if (serverSnapshot && shouldUseServerSnapshot(serverSnapshot, liveSnapshot, rounds, dashboardUpdatedAt, feedStatus)) {
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
  liveSnapshot: PatternMinerSnapshot,
  rounds: Round[],
  dashboardUpdatedAt?: string | null,
  feedStatus?: string | null,
) {
  const feed = String(feedStatus || "").toLowerCase();
  if (feed === "stale" || feed === "paused") return false;
  if (!hasSharedPatternMinerBank(serverSnapshot)) return false;
  if (hasAlerts(liveSnapshot) && !hasAlerts(serverSnapshot)) return false;

  const snapshotMs = Date.parse(serverSnapshot.updatedAt || "");
  const dashboardMs = Date.parse(String(dashboardUpdatedAt || ""));
  if (!Number.isFinite(snapshotMs)) return false;
  if (Number.isFinite(dashboardMs) && snapshotMs + SERVER_SNAPSHOT_MAX_LAG_MS < dashboardMs) {
    return false;
  }

  if (rounds.length > 0 && serverSnapshot.analyzedRounds < Math.min(rounds.length, serverSnapshot.historyLimit)) {
    return false;
  }

  return true;
}

function hasAlerts(snapshot: PatternMinerSnapshot) {
  return snapshotList(snapshot.entryAlerts).length > 0 || snapshotList(snapshot.formingAlerts).length > 0;
}

function hasSharedPatternMinerBank(serverSnapshot: PatternMinerSnapshot) {
  return (
    snapshotList(serverSnapshot.entryAlerts).length > 0 ||
    snapshotList(serverSnapshot.formingAlerts).length > 0 ||
    snapshotList(serverSnapshot.hotStrategies).length > 0 ||
    snapshotList(serverSnapshot.ranking).length > 0 ||
    snapshotList(serverSnapshot.strategies).length > 0 ||
    Number(serverSnapshot.scoreboard?.totalValidated || 0) > 0
  );
}

function snapshotList<T>(value: T[] | undefined) {
  return Array.isArray(value) ? value : [];
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
