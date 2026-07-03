import type { DashboardData } from "@/types/dashboard";

export type DashboardDataMode = "mock" | "connecting" | "live" | "error";

export function createConnectingDashboardShell(): DashboardData {
  return {
    mockMode: false,
    updatedAt: "",
    rounds: [],
    currentSignal: {
      id: "connecting",
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: 0,
      lastResult: null,
    },
    currentTieAlert: {
      id: "connecting-tie",
      level: "Baixo",
      confidence: 0,
      validityRounds: 0,
      status: "expired",
    },
    currentSurfAlert: {
      surf_alert: false,
      surf_phase: "SEM_RISCO",
      surf_side: "NONE",
      surf_status: "SEM_RISCO",
      surf_risk: 0,
      surf_break_risk: 0,
      surf_confidence: 0,
      stretched_count: 0,
      correction_count: 0,
      reason: "Conectando feed live...",
      panels: {
        big_road: "Conectando...",
        big_eye_boy: "Conectando...",
        small_road: "Conectando...",
        cockroach_pig: "Conectando...",
      },
      surf_prediction_side: "NONE",
      surf_prediction_status: "EXPIRED",
      surf_prediction_confidence: 0,
      surf_prediction_window: 0,
    },
    neuralReading: { mode: "SCANNING" },
    engineDecision: { state: "AGUARDAR", reason: "Conectando dashboard live..." },
    mainScoreboard: { greens: 0, reds: 0, ties: 0, accuracy: 0 },
    tieAlertScoreboard: { greens: 0, reds: 0, accuracy: 0 },
    surfAnalyzerScoreboard: { greens: 0, reds: 0, accuracy: 0 },
    pressureSeries: [],
    user: { name: "Usuário" },
    moduleToggles: { tieAlert: true, surfAnalyzer: true },
    entryMode: "off",
  };
}

export function isLiveDashboardPayload(data: DashboardData | undefined | null) {
  if (!data || data.mockMode === true) return false;
  if (data.updatedAt) return true;
  return Array.isArray(data.rounds) && data.rounds.length > 0;
}

export function isDashboardLive(data: DashboardData, mode: DashboardDataMode) {
  if (data.mockMode === true) return false;
  if (!isLiveDashboardPayload(data)) return false;
  if (mode === "live") return true;
  if (mode === "connecting") return true;
  return false;
}
