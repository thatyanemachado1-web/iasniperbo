import type { PatternMinerSnapshot } from "@/types/patternMiner";

export type RoundResult = "B" | "P" | "T";
export type TieMultiplierLabel = "4x" | "6x" | "10x" | "25x" | "88x";
export type TieMultiplierValue = 4 | 6 | 10 | 25 | 88;
export type TiePressureLevel = "baixa" | "moderada" | "alta";

export interface TiePullerStat {
  key: string;
  side: RoundResult;
  score: number;
  ties: number;
  samples: number;
  hitRate: number;
  window: number;
  lastDistance?: number;
  lastRoundKey?: string;
}

export interface Round {
  id: number;
  result: RoundResult;
  bankerScore: number;
  playerScore: number;
  tieMultiplier?: number | null;
  time: string;
  recordedAt?: string | null;
  day?: string | null;
}

export type SignalSide = "BANKER" | "PLAYER";
export type CurrentSignalSide = SignalSide | "TIE" | "NONE";
export type SignalStatus = "waiting" | "pending" | "g1" | "green" | "green_g1" | "red" | "tie" | "tie_watch";
export type DashboardDisplayState =
  | "analyzing"
  | "monitoring"
  | "entry_confirmed"
  | "waiting_result"
  | "result_green"
  | "result_red"
  | "result_tie"
  | "expired";

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
  startedAt?: string | null;
  lastResult?: LastSignalResult | null;
}

export interface BettingTiming {
  phase?: "OPEN" | "CLOSED" | null;
  remainingSeconds?: number | null;
  roundId?: string | number | null;
  updatedAt?: string | null;
}

export type NeuralReadingMode = "SCANNING" | "OBSERVING" | "ACTIVE";
export type NeuralOriginKind = "PAGANTE" | "OPOSTO" | "TIE";
export type NeuralStrategyType =
  | "PAGANTE_DIRETO"
  | "PAGANTE_OPOSTO";

export interface NeuralFormationCandidate {
  strategyId?: string | null;
  strategyType?: NeuralStrategyType | string | null;
  triggerNumber?: number | null;
  triggerSide?: SignalSide | "TIE" | null;
  oppositeNumber?: number | null;
  oppositeSide?: SignalSide | "TIE" | null;
  targetSide?: SignalSide | "TIE" | null;
  accuracy?: number | null;
  accuracyLabel?: string | null;
  samples?: number | null;
  sampleLabel?: string | null;
  recentReds?: number | null;
  status?: string | null;
}

export interface NeuralReading {
  mode: NeuralReadingMode;
  module?: "LEITURA_NEURAL_NUMERO_PAGANTE" | string | null;
  status?: string | null;
  source?: string | null;
  strategyId?: string | null;
  strategyType?: NeuralStrategyType | string | null;
  triggerNumber?: number | null;
  triggerSide?: SignalSide | "TIE" | null;
  oppositeNumber?: number | null;
  oppositeSide?: SignalSide | "TIE" | null;
  winnerSide?: SignalSide | "TIE" | null;
  targetSide?: SignalSide | "TIE" | null;
  samples?: number | null;
  recentGreens?: number | null;
  recentReds?: number | null;
  accuracy?: number | null;
  accuracyLabel?: string | null;
  sampleLabel?: string | null;
  strength?: number | null;
  maxAttempt?: "G1" | string | null;
  cycleStatus?: "AGUARDANDO_RESULTADO" | "AGUARDANDO_G1" | "CLOSED" | string | null;
  attempt?: "SG" | "G1" | string | null;
  triggerRoundId?: string | number | null;
  entryRoundId?: string | number | null;
  g1RoundId?: string | number | null;
  result?: string | null;
  tieMultiplier?: number | null;
  formationCandidates?: NeuralFormationCandidate[] | null;
  updatedAt?: string | null;
  blocked?: boolean | null;
  blockReason?: string | null;
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
  attempt?: "SG" | "G1" | string | null;
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
  | "SEM_SURF"
  | "PRE_SURF"
  | "CONTINUIDADE"
  | "SURF_AGRESSIVO"
  | "SURF_DOMINANTE"
  | "RECUPERACAO_SURF"
  | "SURF_ESTICADO"
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
export type SurfCycleStatus = "AGUARDANDO_RESULTADO" | "CLOSED";
export type SurfCycleResult = "GREEN" | "RED" | "EMPATE";
export type DailySurfMemoryStatus =
  | "SEM_SURF"
  | "PRE_SURF"
  | "SURF_AGRESSIVO"
  | "SURF_DOMINANTE"
  | "RECUPERACAO_SURF"
  | "SURF_ESTICADO"
  | "RISCO_QUEBRA"
  | "VIRADA_SURF";

export interface DailySurfMemory {
  dateKey: string;
  playerDrops3Plus: number;
  bankerDrops3Plus: number;
  playerMaxDepth: number;
  bankerMaxDepth: number;
  totalDrops3Plus: number;
  dominantSide: SignalSide | null;
  dominantPercent: number;
  recoverySide: SignalSide | null;
  stretchedSide: SignalSide | null;
  currentDropSide: SignalSide | null;
  currentDropDepth: number;
  surfBias: SignalSide | null;
  surfStatus: DailySurfMemoryStatus;
  confidence: number;
  reason: string;
}

export interface SurfCycle {
  module: "SURF_ANALYZER";
  cycleStatus: SurfCycleStatus;
  attempt: "SG";
  cycleId?: string | null;
  technicalSide?: SignalSide | null;
  entryRoundId?: string | number | null;
  resultRoundId?: string | number | null;
  result?: SurfCycleResult | null;
  tieMultiplier?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  statusLabel?: string | null;
}

export interface SurfHistoryEntry {
  cycleId?: string | null;
  patternId?: string | null;
  technicalSide?: SignalSide | null;
  result: SurfCycleResult;
  attempt: "SG";
  tieMultiplier?: string | null;
  entryRoundId?: string | number | null;
  closedRoundId?: string | number | null;
  closedAt?: string | null;
  statusLabel?: string | null;
  label?: string | null;
}

export interface SurfCycleStats {
  greensSG: number;
  redsSG: number;
  empates: number;
  quebras: number;
  retomadas: number;
  viradas: number;
}

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
  dailySurfMemory?: DailySurfMemory;
  surfCycle?: SurfCycle | null;
  surfHistory?: SurfHistoryEntry[];
  surfCycleStats?: SurfCycleStats;
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
  source?: "engine" | "publisher" | "merged" | "stale";
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
  multipliers?: Partial<Record<TieMultiplierLabel, number>>;
  tiePullers?: TiePullerStat[];
}

export interface TieHistoryEntry {
  id: string;
  roundId: number;
  roundKey: string;
  timestamp: string;
  dateKey: string;
  monthKey: string;
  hour: string;
  type: TieMultiplierValue;
  multiplierLabel: TieMultiplierLabel;
}

export interface TieAggregateTable {
  key: string;
  totalTies: number;
  total25x: number;
  total88x: number;
  counts: Record<TieMultiplierLabel, number>;
  average25IntervalMinutes: number | null;
  average88IntervalMinutes: number | null;
  interval25Samples?: number;
  interval88Samples?: number;
  last25Timestamp?: string | null;
  last88Timestamp?: string | null;
  mostFrequentHour: string | null;
  hourCounts?: Record<string, number>;
}

export interface TieHighMultiplierAnalysis {
  last88At: string | null;
  last25At: string | null;
  average88IntervalMinutes: number | null;
  average25IntervalMinutes: number | null;
  sinceLast88Minutes: number | null;
  sinceLast25Minutes: number | null;
  estimatedNext88At: string | null;
  estimatedNext25At: string | null;
  pressure: TiePressureLevel;
  pressureScore: number;
}

export interface TieRadarHistoryAnalysis {
  updatedAt: string;
  recent: TieHistoryEntry[];
  daily: TieAggregateTable;
  monthly: TieAggregateTable;
  high: TieHighMultiplierAnalysis;
  countedRoundKeys?: string[];
}

export type DashboardPersistentModuleKey =
  | "LEITURA_NEURAL_NUMERO_PAGANTE"
  | "SURF_ANALYZER"
  | "PADROES_IA";

export type DashboardPersistentResultType =
  | "GREEN"
  | "GREEN_G1"
  | "RED"
  | "EMPATE"
  | "EMPATE_G1"
  | "CANCELADO"
  | "EXPIRADO";

export interface DashboardPersistentResult {
  moduleKey: DashboardPersistentModuleKey | string;
  dayKey?: string;
  monthKey?: string;
  signalId?: string | null;
  resultId: string;
  roundId?: string | number | null;
  resultType: DashboardPersistentResultType | string;
  side?: CurrentSignalSide | null;
  attempt?: "SG" | "G1" | string | null;
  tieMultiplier?: string | number | null;
  createdAt: string;
  displayTimeBR: string;
  label: string;
  payload?: Record<string, unknown>;
}

export type DashboardDailyResultsByModule = Record<string, DashboardPersistentResult[]>;

export interface SurfAnalyzerScoreboard {
  totalAlerts: number;
  hits: number;
  fails: number;
  ties?: number;
  expired: number;
  greenSemGale?: number;
  greenG1?: number;
  greenSG?: number;
  redSG?: number;
  tieSG?: number;
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
  maxSequencePositive: number;
  maxSequenceNegative: number;
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
  revision?: number;
  sequenceId?: number;
  rounds: Round[];
  bacBoBeadPlate?: Array<{
    id: string;
    side: "BANKER" | "PLAYER" | "TIE";
    value: number;
    slot: number;
    row?: number;
    column?: number;
  }>;
  bacBoRoadStats?: {
    playerWins: number;
    bankerWins: number;
    ties: number;
  };
  updatedAt?: string;
  collectorStatus?: string;
  websocketStatus?: string;
  lastRoundId?: string | number | null;
  lastRoundAt?: string;
  publisherStatus?: string;
  health?: Record<string, unknown>;
  payingNumbers?: unknown;
  pressureReading?: Record<string, unknown>;
  performanceStats?: Record<string, unknown>;
  validatorStats?: Record<string, unknown>;
  patternHotSignal?: unknown;
  aiPatternSignal?: unknown;
  patternIaServerCycle?: unknown;
  displayState?: DashboardDisplayState;
  displaySide?: CurrentSignalSide;
  displayRoundId?: string | number | null;
  bettingTiming?: BettingTiming | null;
  currentSignal: MainSignal;
  lastSignalResult?: LastSignalResult | null;
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
  tieRadarHistory?: TieRadarHistoryAnalysis;
  monthlyTieStats?: TieRadarHistoryAnalysis;
  dailyResultsByModule?: DashboardDailyResultsByModule;
  surfAnalyzerScoreboard: SurfAnalyzerScoreboard;
  patternMinerSnapshot?: PatternMinerSnapshot;
  pressureSeries: PressurePoint[];
}
