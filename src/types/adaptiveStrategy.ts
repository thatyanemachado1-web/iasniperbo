import type { SignalSide } from "@/types/dashboard";

export type AdaptiveSide = SignalSide | "TIE";
export type AdaptivePatternStatus = "frio" | "observacao" | "quente" | "pausado";
export type AdaptivePatternKind =
  | "sequence_2"
  | "sequence_3"
  | "sequence_4"
  | "score"
  | "post_tie"
  | "paying_number"
  | "hour"
  | "table";

export interface AdaptiveRoundRecord {
  key: string;
  tableName: string;
  roundId: number;
  day: string;
  time: string;
  result: AdaptiveSide;
  bankerScore: number;
  playerScore: number;
  tieMultiplier: number | null;
  previousSequence: string;
  nextResult: AdaptiveSide | null;
  timestamp: string;
  sourceUpdatedAt: string | null;
  capturedAt: string;
}

export interface AdaptivePattern {
  id: string;
  label: string;
  kind: AdaptivePatternKind;
  tableName: string;
  hour: string | null;
  direction: AdaptiveSide;
  occurrences: number;
  pulledPlayer: number;
  pulledBanker: number;
  pulledTie: number;
  sg: number;
  g1: number;
  red: number;
  expired: number;
  assertiveness: number;
  assertivenessSg: number;
  assertivenessG1: number;
  lastSeenAt: string | null;
  greenRedSequence: {
    type: "green" | "red" | "none";
    count: number;
  };
  status: AdaptivePatternStatus;
  score: number;
  sampleWeak: boolean;
  blocked: boolean;
  pausedReason: string | null;
}

export interface AdaptiveRanking {
  banker: AdaptivePattern[];
  player: AdaptivePattern[];
  tie: AdaptivePattern[];
  byTable: AdaptivePattern[];
  byHour: AdaptivePattern[];
}

export interface AdaptiveScorePart {
  label: string;
  value: number;
  reason: string;
}

export interface AdaptiveEntryScore {
  side: AdaptiveSide | null;
  finalScore: number;
  allowed: boolean;
  parts: AdaptiveScorePart[];
  explanation: string[];
}

export interface AdaptiveDecisionLog {
  id: string;
  timestamp: string;
  message: string;
  patternId?: string;
  score?: number;
  status?: AdaptivePatternStatus;
}

export interface AdaptiveSyncStatus {
  mode: "local" | "database" | "error";
  lastSyncedAt: string | null;
  message: string;
}

export interface AdaptiveStrategySnapshot {
  generatedAt: string;
  recordsStored: number;
  patternsFound: number;
  hotPatterns: number;
  pausedPatterns: number;
  coldPatterns: number;
  observingPatterns: number;
  minOccurrences: number;
  minAssertiveness: number;
  syncStatus: AdaptiveSyncStatus;
  patterns: AdaptivePattern[];
  ranking: AdaptiveRanking;
  entryScore: AdaptiveEntryScore;
  decisionLogs: AdaptiveDecisionLog[];
}
