export type RoundResult = "B" | "P" | "T";

export interface Round {
  id: number;
  result: RoundResult;
  bankerScore: number;
  playerScore: number;
  time: string;
}

export type SignalSide = "BANKER" | "PLAYER";
export type CurrentSignalSide = SignalSide | "TIE" | "NONE";
export type SignalStatus = "waiting" | "pending" | "g1" | "green" | "green_g1" | "red" | "tie_watch";

export interface LastSignalResult {
  id: string;
  side: SignalSide;
  status: "green" | "green_g1" | "red";
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
}

export interface TieAlertScoreboard {
  greenTieAlerts: number;
  expired: number;
  totalAlerts: number;
  assertiveness: number;
}

export interface SurfAnalyzerScoreboard {
  totalAlerts: number;
  hits: number;
  fails: number;
  expired: number;
  bankerHits: number;
  playerHits: number;
  assertiveness: number;
  maxBankerSurfHit: number;
  maxPlayerSurfHit: number;
  maxBreakDetected: number;
  maxRetakeDetected: number;
  currentHitStreak: number;
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
  currentSignal: MainSignal;
  currentTieAlert: TieAlert;
  currentSurfAlert?: SurfAlert;
  engineDecision: EngineDecision;
  mainScoreboard: MainScoreboard;
  tieAlertScoreboard: TieAlertScoreboard;
  surfAnalyzerScoreboard: SurfAnalyzerScoreboard;
  pressureSeries: PressurePoint[];
}
