import type { Round, RoundResult } from "@/types/dashboard";

export type PatternMinerHistoryLimit = 1000 | 5000 | 10000 | 15000 | 50000;
export type PatternMinerStrategyStatus =
  | "VERY_HOT"
  | "HOT"
  | "STABLE"
  | "OBSERVATION"
  | "WEAK"
  | "INACTIVE";
export type PatternMinerAlertKind = "forming" | "validated";

export interface PatternMinerConfig {
  historyLimit: PatternMinerHistoryLimit;
  minOccurrences: number;
  minValidated: number;
  patternLengths: number[];
}

export interface PatternMinerStrategy {
  id: string;
  sequence: string[];
  occurrences: number;
  expectedResult?: RoundResult;
  sg: number;
  g1: number;
  red: number;
  tie: number;
  totalValidated: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  assertiveness?: number;
  lastOccurrence?: string;
  lastHit?: string;
  lastRed?: string;
  createdAt: string;
  status: PatternMinerStrategyStatus;
  insufficientSample: boolean;
  updatedAt: string;
  rank: number;
}

export interface PatternMinerAlert {
  id: string;
  signal_id?: string;
  signalId?: string;
  event_id?: string;
  eventId?: string;
  round_id?: number | string;
  roundId?: number | string;
  generated_at?: string;
  generatedAt?: string;
  blocked_reason?: string;
  blockedReason?: string;
  kind: PatternMinerAlertKind;
  strategy: PatternMinerStrategy;
  matchedRounds: Round[];
  progress: number;
  missingTokens: string[];
  title: string;
}

export interface PatternMinerAgentReport {
  catalogedStrategies: number;
  hotStrategies: number;
  observedStrategies: number;
  lastDiscovery?: PatternMinerStrategy;
  updatedAt: string;
}

export interface PatternMinerScoreboard {
  sg: number;
  g1: number;
  red: number;
  tie: number;
  totalValidated: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  assertiveness?: number;
}

export interface PatternMinerSnapshot {
  strategies: PatternMinerStrategy[];
  ranking: PatternMinerStrategy[];
  hotStrategies: PatternMinerStrategy[];
  formingAlerts: PatternMinerAlert[];
  entryAlerts: PatternMinerAlert[];
  scoreboard: PatternMinerScoreboard;
  agent: PatternMinerAgentReport;
  analyzedRounds: number;
  historyLimit: PatternMinerHistoryLimit;
  updatedAt: string;
}

export interface PatternMinerStoredBank {
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
}
