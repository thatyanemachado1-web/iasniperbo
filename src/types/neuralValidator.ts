import type { Round, RoundResult } from "@/types/dashboard";

export type ValidatorEntryType =
  | "BANKER"
  | "PLAYER"
  | "TIE"
  | "OPPOSITE"
  | "SAME_LAST"
  | "AI";

export type ValidatorDestination = "site" | "telegram" | "site_telegram" | "monitor" | "disabled";
export type ValidatorGaleLimit = 0 | 1 | 2 | number;
export type ValidatorRisk = "baixo" | "medio" | "alto";
export type ValidatorPatternStatus = "quente" | "estavel" | "observacao" | "fraco" | "sem_amostra";

export interface ValidatorPatternToken {
  side: RoundResult;
  score?: number;
}

export interface ValidatorConfig {
  name: string;
  tableId: string;
  entryType: ValidatorEntryType;
  galeLimit: ValidatorGaleLimit;
  tieProtection: boolean;
  validityMode: "immediate" | "next" | "rounds";
  validityRounds: number;
  historySize: number;
}

export interface ValidatorDetail {
  roundId: number;
  roundLabel: string;
  entry: RoundResult;
  status: "GREEN_SG" | "GREEN_G1" | "GREEN_G2" | "RED" | "TIE" | "PENDING";
  galeUsed: number;
  result?: RoundResult;
  sequence: ValidatorPatternToken[];
}

export interface ValidatorResult {
  totalSignals: number;
  totalValidated: number;
  sgWins: number;
  g1Wins: number;
  g2Wins: number;
  losses: number;
  ties: number;
  tieWins: number;
  accuracy?: number;
  sgAccuracy?: number;
  galeAccuracy?: number;
  currentGreenStreak: number;
  bestGreenStreak: number;
  bestLossStreak: number;
  lastPatternResult: string;
  details: ValidatorDetail[];
  entry: RoundResult | null;
  pulledSide: RoundResult | null;
  risk: ValidatorRisk;
  status: ValidatorPatternStatus;
  analyzedRounds: number;
}

export interface PatternSuggestion {
  id: string;
  pattern: ValidatorPatternToken[];
  pulledSide: RoundResult | null;
  validation: ValidatorResult;
  occurrences: number;
  score: number;
  risk: ValidatorRisk;
  status: ValidatorPatternStatus;
}

export interface SavedValidatorPattern {
  id: string;
  userId: string;
  name: string;
  tableId: string;
  pattern: ValidatorPatternToken[];
  entryType: ValidatorEntryType;
  pulledSide: RoundResult | null;
  galeLimit: ValidatorGaleLimit;
  tieProtection: boolean;
  destination: ValidatorDestination;
  telegramChannelId: string;
  messageOverride?: string;
  cooldownRounds: number;
  isActive: boolean;
  validation: ValidatorResult | null;
  currentGreenStreak: number;
  wins: number;
  losses: number;
  lastDetectedAt: string;
  lastDetectedRoundId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ValidatorMessageTemplates {
  entry: string;
  gale: string;
  green: string;
  red: string;
  scoreboard: string;
  greenStreak: string;
  preAlert: string;
}

export interface ValidatorNotificationChannel {
  id: string;
  userId: string;
  name: string;
  botTokenMasked: string;
  botTokenEncoded: string;
  chatId: string;
  buttonLink: string;
  isActive: boolean;
  templates: ValidatorMessageTemplates;
  createdAt: string;
  updatedAt: string;
}

export interface LiveValidatorHit {
  id: string;
  pattern: SavedValidatorPattern;
  matchedRounds: Round[];
  entry: RoundResult | null;
  detectedRoundId: number;
  detectedAt: string;
}
