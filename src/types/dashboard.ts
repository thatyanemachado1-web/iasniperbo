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
  engineDecision: EngineDecision;
  mainScoreboard: MainScoreboard;
  tieAlertScoreboard: TieAlertScoreboard;
  pressureSeries: PressurePoint[];
}