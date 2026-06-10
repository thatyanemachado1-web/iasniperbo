import { useMemo } from "react";
import type { Round } from "@/types/dashboard";
import type { PatternMinerHistoryLimit, PatternMinerSnapshot } from "@/types/patternMiner";
import { DEFAULT_PATTERN_MINER_CONFIG } from "@/patternMiner/PatternMinerEngine";
import { PatternMinerAgent } from "@/patternMiner/PatternMinerAgent";

interface UsePatternMinerParams {
  rounds: Round[];
  historyLimit?: PatternMinerHistoryLimit;
  enabled: boolean;
}

export function usePatternMiner({ rounds, historyLimit = 15000, enabled }: UsePatternMinerParams) {
  const snapshot = useMemo(() => {
    if (!enabled || typeof window === "undefined") return buildEmptySnapshot(historyLimit);
    const agent = new PatternMinerAgent({
      ...DEFAULT_PATTERN_MINER_CONFIG,
      historyLimit,
    });
    return agent.scan(rounds);
  }, [enabled, historyLimit, rounds]);

  return {
    snapshot,
    isUsingRealData: enabled,
  } as const;
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
