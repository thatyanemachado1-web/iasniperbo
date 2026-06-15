export type RoundResult = "B" | "P" | "T";

export interface Round {
  id: number;
  result: RoundResult;
  bankerScore: number;
  playerScore: number;
  tieMultiplier?: number | null;
  time: string;
}

export type SignalSide = "BANKER" | "PLAYER";
export type CurrentSignalSide = SignalSide | "TIE" | "NONE";
export type SignalStatus = "waiting" | "pending" | "g1" | "green" | "green_g1" | "red" | "tie" | "tie_watch";

export interface LastSignalResult {
  id: string;
  side: SignalSide;
  status: "green" | "green_g1" | "red" | "tie";
  protection: string;
  finishedAt?: string;
}

export interface MainSignal {
  id: string;
  side: CurrentSignalSide;
  status: SignalStatus;
  protection: string;
  strength: number; // 0-100
  lastResult?: LastSignalResult | null;
}

export type NeuralReadingMode = "SCANNING" | "OBSERVING" | "ACTIVE";
export type NeuralOriginKind = "PAGANTE" | "OPOSTO" | "TIE";

export interface NeuralReading {
  mode: NeuralReadingMode;
  numero?: number | null;
  origem?: SignalSide | "TIE" | null;
  origemTipo?: NeuralOriginKind | null;
  direcao?: SignalSide | "TIE" | null;
  validade?: string | null;
  alertas?: number | null;
  acertos?: number | null;
  greenSemGale?: number | null;
  greenG1?: number | null;
  erros?: number | null;
  reds?: number | null;
  assertividade?: number | null;
  sequencePositive?: number | null;
  sequenceNegative?: number | null;
  maxSequencePositive?: number | null;
  maxSequenceNegative?: number | null;
  paganteStatus?: string | null;
  paganteAlert?: string | null;
  paganteWindow?: number | null;
  paganteCycleProgress?: number | null;
  paganteCycleLimit?: number | null;
  isSaturated?: boolean | null;
  isRedAlert?: boolean | null;
  postTie?: boolean | null;
}

export interface NeuralScoreboard {
  totalAlerts?: number | null;
  acertos?: number | null;
  greens?: number | null;
  greenSemGale?: number | null;
  greenG1?: number | null;
  erros?: number | null;
  reds?: number | null;
  assertividade?: number | null;
  sequencePositive?: number | null;
  sequenceNegative?: number | null;
  maxSequencePositive?: number | null;
  maxSequenceNegative?: number | null;
}

export type NeuralEntryStatus = "awaiting_sg" | "awaiting_g1";
export type NeuralEntryResultKind = "sg" | "g1" | "red" | "tie_sg" | "tie_g1";

export interface NeuralEntryState {
  key: string;
  numero?: number | null;
  origem?: SignalSide | "TIE" | null;
  origemTipo?: NeuralOriginKind | null;
  expectedSide?: SignalSide | "TIE" | null;
  status: NeuralEntryStatus;
  triggerRoundKey: string;
  sgRoundKey?: string | null;
  startedAt?: string | null;
  readingSnapshot?: NeuralReading | null;
}

export interface NeuralEntryLastResult {
  id: string;
  key: string;
  numero?: number | null;
  origem?: SignalSide | "TIE" | null;
  origemTipo?: NeuralOriginKind | null;
  expectedSide?: SignalSide | "TIE" | null;
  kind: NeuralEntryResultKind;
  outcome: "GREEN" | "RED" | "TIE";
  resultRoundKey: string;
  finishedAt: string;
  tieMultiplier?: number | null;
  readingSnapshot?: NeuralReading | null;
}

export interface ModuleToggles {
  tieAlert: boolean;
  surfAnalyzer: boolean;
}

export type ActiveEntryMode = "sniper" | "hunter" | "aggressive";
export type EntryMode = "off" | ActiveEntryMode;

export interface EntryModeFilter {
  mode: ActiveEntryMode;
  blocked: boolean;
  reason: string;
  originalSide?: CurrentSignalSide;
  originalStrength?: number;
}

export interface EntryModeStats {
  sg?: number;
  greens?: number;
  greenSemGale?: number;
  greensG1?: number;
  greenG1?: number;
  totalGreens?: number;
  emp?: number;
  ties?: number;
  reds?: number;
  totalEntries?: number;
  total?: number;
  assertiveness?: number;
}

export type SurfPhase =
  | "SEM_RISCO"
  | "PRE_SURF"
  | "CONTINUIDADE"
  | "SURF_FORTE"
  | "SURF_EXTREMO"
  | "EXAUSTAO"
  | "RISCO_QUEBRA"
  | "QUEBRA_SURF"
  | "CORRECAO"
  | "RETOMADA_MESMA_COR"
  | "VIRADA_OUTRO_LADO"
  | "POS_MANIPULACAO";

export type SurfSide = SignalSide | "NONE";
export type SurfPredictionStatus = "ACTIVE" | "HIT" | "FAILED" | "EXPIRED";

export interface SurfAlert {
  surf_alert: boolean;
  surf_phase: SurfPhase;
  surf_side: SurfSide;
  surf_status?: string;
  surf_risk: number; // 0-100
  surf_break_risk?: number; // 0-100
  surf_confidence: number; // 0-100
  stretched_count: number;
  correction_count: number;
  reason: string;
  panels: {
    big_road: string;
    big_eye_boy: string;
    small_road: string;
    cockroach_pig: string;
  };
  surf_prediction_side?: SurfSide;
  surf_prediction_status?: SurfPredictionStatus;
  surf_prediction_confidence?: number;
  surf_prediction_window?: number;
}

export interface SurfEntrySummary {
  oppositeRisk: number;
  oppositeRiskLevel: "BAIXO" | "MEDIO" | "ALTO";
  status: string;
}

export type TieAlertStatus = "active" | "green" | "expired";

export interface TieAlert {
  id: string;
  level: "Baixo" | "Medio" | "Médio" | "Alto";
  confidence: number; // 0-100
  validityRounds: number;
  status: TieAlertStatus;
}

export type EngineState = "AGUARDAR" | "ATENCAO" | "ENTRADA" | "BLOQUEADO";

export interface EngineDecision {
  state: EngineState;
  reason: string;
  confidence: number;
  debug?: string;
}

export interface MainScoreboard {
  greens: number;
  greensG1: number;
  reds: number;
  totalGreens: number;
  totalEntries: number;
  assertiveness: number;
  sequencePositive?: number;
  sequenceNegative?: number;
}

export interface TieAlertScoreboard {
  greenTieAlerts: number;
  expired: number;
  totalAlerts: number;
  assertiveness: number;
  sequencePositive?: number;
  sequenceExpired?: number;
}

export interface SurfAnalyzerScoreboard {
  totalAlerts: number;
  hits: number;
  fails: number;
  expired: number;
  greenSemGale?: number;
  greenG1?: number;
  reds?: number;
  blocked?: number;
  noRisk?: number;
  bankerHits: number;
  playerHits: number;
  assertiveness: number;
  sequencePositive?: number;
  sequenceNegative?: number;
  maxBankerSurfHit: number;
  maxPlayerSurfHit: number;
  maxBreakDetected: number;
  maxRetakeDetected: number;
  currentHitStreak: number;
}

export interface MainResult {
  greenSemGale: number;
  greenG1: number;
  reds: number;
  total: number;
  assertiveness: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  breakdown: string;
}

export interface TieResult {
  greens: number;
  expired: number;
  total: number;
  assertiveness: number;
  sequencePositive: number;
  sequenceExpired: number;
  breakdown: string;
}

export interface NeuralResult {
  totalAlerts: number;
  greens: number;
  greenSemGale: number;
  greenG1: number;
  reds: number;
  total: number;
  assertiveness: number;
  sequencePositive: number;
  sequenceNegative: number;
  breakdown: string;
}

export interface SurfResult {
  totalAlerts: number;
  greens: number;
  greenSemGale: number;
  greenG1: number;
  reds: number;
  total: number;
  blocked: number;
  noRisk: number;
  assertiveness: number;
  sequencePositive: number;
  sequenceNegative: number;
  breakdown: string;
}

export interface PressurePoint {
  index: number;
  banker: number;
  player: number;
  tie: number;
}

export interface DashboardData {
  user: { name: string };
  mockMode: boolean;
  rounds: Round[];
  updatedAt?: string;
  currentSignal: MainSignal;
  currentTieAlert: TieAlert;
  currentSurfAlert?: SurfAlert;
  neuralReading?: NeuralReading;
  neuralScoreboard?: NeuralScoreboard;
  neuralEntryState?: NeuralEntryState | null;
  neuralEntryLastResult?: NeuralEntryLastResult | null;
  moduleToggles?: ModuleToggles;
  entryMode?: EntryMode;
  entryModeFilter?: EntryModeFilter;
  entryModeStats?: Partial<Record<ActiveEntryMode, EntryModeStats>>;
  engineDecision: EngineDecision;
  mainScoreboard: MainScoreboard;
  tieAlertScoreboard: TieAlertScoreboard;
  surfAnalyzerScoreboard: SurfAnalyzerScoreboard;
  pressureSeries: PressurePoint[];
}
