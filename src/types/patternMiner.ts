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
export type PatternMinerSource = "engine" | "publisher" | "merged";
export type PatternMinerOperationalStatus =
  | "AGUARDANDO PADRAO"
  | "PADRAO EM FORMACAO"
  | "PADRAO QUENTE"
  | "PADRAO 100%"
  | "ENTRADA CONFIRMADA"
  | "ALERTA DE EMPATE"
  | "BLOQUEADO POR MAIS DE 2 REDS"
  | "BLOQUEADO POR AMOSTRA BAIXA"
  | "BLOQUEADO POR FEED STALE"
  | "BLOQUEADO POR SNAPSHOT ANTIGO"
  | "FAZER GALE 1"
  | "GREEN SG"
  | "GREEN G1"
  | "RED FINAL";

export type PatternIaResultStage = "pending_sg" | "pending_g1" | "green_sg" | "green_g1" | "red_final" | "tie_hit";

export interface PatternMinerConfig {
  historyLimit: PatternMinerHistoryLimit;
  minOccurrences: number;
  minValidated: number;
  patternLengths: number[];
}

export interface PatternMinerStrategy {
  id: string;
  sequence: string[];
  module?: "PADROES_IA";
  pattern_signature?: string;
  pattern_signature_normalized?: string;
  includes_tie?: boolean;
  tie_count_in_pattern?: number;
  next_side?: RoundResult;
  next_side_probability?: number;
  signal_id?: string;
  event_id?: string;
  round_id?: number;
  generated_at?: string;
  occurrences: number;
  accuracy?: number;
  sg_count?: number;
  g1_count?: number;
  red_count?: number;
  tie_after_count?: number;
  blocked_reason?: string;
  expectedResult?: RoundResult;
  heatStatus?: PatternMinerStrategyStatus;
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
  status: PatternMinerOperationalStatus | PatternMinerStrategyStatus;
  insufficientSample: boolean;
  updatedAt: string;
  rank: number;
}

export interface PatternMinerAlert {
  id: string;
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
  runtimeStatus?: PatternMinerOperationalStatus;
  runtimeBlockedReason?: string;
  updatedAt: string;
  source?: PatternMinerSource;
}

export interface PatternIaActiveSignal {
  signal_id: string;
  event_id: string;
  pattern_signature: string;
  entry_side: RoundResult;
  entry_after_round_id: number;
  confirmed_at: string;
  strategy: PatternMinerStrategy;
  alert: PatternMinerAlert;
}

export interface PatternIaLifecycleView {
  active: PatternIaActiveSignal | null;
  queueLength: number;
  resultStage: PatternIaResultStage;
  status: PatternMinerOperationalStatus;
  resultFlash: "none" | "green" | "tie" | "red";
  current_gale: 0 | 1;
  max_gale: 1;
  finalized: boolean;
  blocked_reason?: string;
  entryHistory: PatternIaEntryHistoryItem[];
}

export type PatternIaEntryResultLabel = "GREEN SG" | "GREEN G1" | "RED G1";

export interface PatternIaEntryHistoryItem {
  id: string;
  signal_id: string;
  event_id?: string;
  entry_side: RoundResult;
  result_label: PatternIaEntryResultLabel;
  tie_multiplier?: number;
  finalized_at: string;
  minute: string;
}

export interface PatternMinerStoredBank {
  rounds: Round[];
  createdAt: string;
  updatedAt: string;
}
