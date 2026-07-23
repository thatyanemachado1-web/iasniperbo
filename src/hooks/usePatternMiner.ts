import { useMemo } from "react";
import type { DashboardData, Round } from "@/types/dashboard";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";

const SERVER_SNAPSHOT_MAX_LAG_MS = 120_000;
const DASHBOARD_FEED_STALE_MS = 60_000;

export function resolvePatternMinerFeedStatus(
  data: Partial<
    Pick<
      DashboardData,
      "currentSignal" | "neuralReading" | "updatedAt" | "collectorStatus" | "websocketStatus"
    >
  >,
) {
  if (data.currentSignal?.id === "feed-paused") return "paused";
  if (data.neuralReading?.paganteStatus === "FEED_PAUSADO") return "paused";
  if (data.collectorStatus && normalizeFeedStatus(data.collectorStatus) !== "online") return "stale";
  if (data.websocketStatus && normalizeFeedStatus(data.websocketStatus) !== "connected") return "stale";
  const updatedAtMs = Date.parse(String(data.updatedAt || ""));
  if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > DASHBOARD_FEED_STALE_MS) {
    return "stale";
  }
  return null;
}

function normalizeFeedStatus(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "conectado" || text === "conectada") return "connected";
  if (text === "desconectado" || text === "desconectada") return "disconnected";
  return text;
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
    if (serverSnapshot && shouldUseServerSnapshot(serverSnapshot, rounds, dashboardUpdatedAt, feedStatus)) {
      return serverSnapshot;
    }
    const agent = new PatternMinerAgent({
      ...DEFAULT_PATTERN_MINER_CONFIG,
      historyLimit,
    });
    return agent.scan(rounds);
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
  const feed = String(feedStatus || "").toLowerCase();
  if (feed === "stale" || feed === "paused") return false;
  if (!hasSharedPatternMinerBank(serverSnapshot)) return false;

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
