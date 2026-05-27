export type RoundResult = "B" | "P" | "T";

export interface Round {
  id: number;
  result: RoundResult;
  bankerScore: number;
  playerScore: number;
  time: string;
}

export type SignalSide = "BANKER" | "PLAYER";
export type SignalStatus = "pending" | "green" | "green_g1" | "red";

export interface MainSignal {
  id: string;
  side: SignalSide;
  status: SignalStatus;
  protection: "G0" | "G1";
  strength: number; // 0-100
}

export type SurfPhase =
  | "SEM_RISCO"
  | "PRE_SURF"
  | "SURF_ATIVO"
  | "SURF_ESTICADO"
  | "RISCO_QUEBRA"
  | "QUEBRA_SURF"
  | "RETOMADA_MESMA_COR"
  | "VIRADA_OUTRO_LADO"
  | "POS_MANIPULACAO"
  | "CORRECAO"
  | "EXAUSTAO";

export type SurfSide = SignalSide | "NONE";

export interface SurfAlert {
  surf_alert: boolean;
  surf_phase: SurfPhase;
  surf_side: SurfSide;
  surf_risk: number; // 0-100
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
}

export interface SurfEntrySummary {
  oppositeRisk: number;
  oppositeRiskLevel: "BAIXO" | "MEDIO" | "ALTO";
  status: string;
}

export type TieAlertStatus = "active" | "green" | "expired";

export interface TieAlert {
  id: string;
  level: "Baixo" | "Médio" | "Alto";
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
  pressureSeries: PressurePoint[];
}
