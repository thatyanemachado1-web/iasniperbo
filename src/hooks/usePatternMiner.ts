import { useEffect, useMemo, useRef, useState } from "react";
import type { DashboardData, Round } from "@/types/dashboard";
import type {
  PatternIaLifecycleView,
  PatternMinerHistoryLimit,
  PatternMinerSnapshot,
} from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG, PatternMinerEngine } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";
import {
  logPatternIaRenderState,
  resolvePatternIaLifecycle,
} from "@/patternMiner/PatternMinerLifecycle";

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
  const lifecycleRef = useRef<PatternIaLifecycleView | null>(null);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setClock((value) => value + 1), 150);
    return () => window.clearInterval(timer);
  }, [enabled]);

  const snapshot = useMemo(() => {
    if (!enabled || typeof window === "undefined") return buildEmptySnapshot(historyLimit);
    const runtimeContext = {
      feedStatus,
      dashboardUpdatedAt,
      serverSnapshotUpdatedAt: serverSnapshot?.updatedAt,
    };
    const agent = new PatternMinerAgent({
      ...DEFAULT_PATTERN_MINER_CONFIG,
      historyLimit,
    });
    const liveSnapshot = agent.scan(rounds, runtimeContext);
    const mergedLive = serverSnapshot
      ? PatternMinerEngine.mergeWithIncoming(liveSnapshot, serverSnapshot)
      : liveSnapshot;

    if (serverSnapshot && shouldPreferServerSnapshot(serverSnapshot, mergedLive, rounds, dashboardUpdatedAt, feedStatus)) {
      return PatternMinerEngine.mergeWithIncoming(liveSnapshot, serverSnapshot);
    }
    return mergedLive;
  }, [dashboardUpdatedAt, enabled, feedStatus, historyLimit, rounds, serverSnapshot]);

  const lifecycle = useMemo(() => {
    if (!enabled || typeof window === "undefined") {
      return emptyLifecycle();
    }
    return resolvePatternIaLifecycle(snapshot, rounds, Date.now());
  }, [clock, enabled, rounds, snapshot]);

  useEffect(() => {
    lifecycleRef.current = lifecycle;
    if (!enabled) return;
    logPatternIaRenderState(lifecycle, snapshot);
  }, [enabled, lifecycle, snapshot]);

  return {
    snapshot,
    lifecycle,
    isUsingRealData: enabled,
  } as const;
}

function shouldPreferServerSnapshot(
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

  const latestRound = rounds[rounds.length - 1];
  const latestAlert = [...serverSnapshot.entryAlerts, ...serverSnapshot.formingAlerts]
    .map((alert) => alert?.strategy)
    .find(Boolean);
  if (latestAlert?.round_id && latestRound && latestAlert.round_id < latestRound.id - 2) {
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

function emptyLifecycle(): PatternIaLifecycleView {
  return {
    activeSignal: null,
    active: null,
    lastSignalResult: null,
    displayState: "analyzing",
    queueLength: 0,
    resultStage: "pending_sg",
    status: "AGUARDANDO PADRAO",
    resultFlash: "none",
    current_gale: 0,
    max_gale: 1,
    finalized: false,
    entryHistory: [],
  };
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
    runtimeStatus: "AGUARDANDO PADRAO",
    updatedAt: now,
  };
}
