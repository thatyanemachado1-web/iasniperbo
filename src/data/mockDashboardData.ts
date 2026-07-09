import type { DashboardData, Round, MainSignal, TieAlert } from "@/types/dashboard";
import { buildTieRadarHistoryAnalysis } from "@/tieRadar/TieRadarHistoryEngine";
import { buildPressureSeries } from "@/utils/statistics";

export const MOCK_MODE = true;

// Roadmap definido no prompt:
// B P B B T B P B B P T B B P B
// P B B T P B P B T B B P T B P
const ROADMAP: Round["result"][] = [
  "B",
  "P",
  "B",
  "B",
  "T",
  "B",
  "P",
  "B",
  "B",
  "P",
  "T",
  "B",
  "B",
  "P",
  "B",
  "P",
  "B",
  "B",
  "T",
  "P",
  "B",
  "P",
  "B",
  "T",
  "B",
  "B",
  "P",
  "T",
  "B",
  "P",
];

const SCORE_EXAMPLES: Array<{ bankerScore: number; playerScore: number }> = [
  { bankerScore: 8, playerScore: 5 },
  { bankerScore: 4, playerScore: 9 },
  { bankerScore: 10, playerScore: 6 },
  { bankerScore: 7, playerScore: 3 },
  { bankerScore: 6, playerScore: 6 },
  { bankerScore: 11, playerScore: 8 },
  { bankerScore: 5, playerScore: 10 },
  { bankerScore: 9, playerScore: 4 },
  { bankerScore: 8, playerScore: 2 },
  { bankerScore: 3, playerScore: 7 },
  { bankerScore: 10, playerScore: 10 },
  { bankerScore: 12, playerScore: 5 },
  { bankerScore: 9, playerScore: 7 },
  { bankerScore: 6, playerScore: 11 },
  { bankerScore: 8, playerScore: 4 },
  { bankerScore: 2, playerScore: 8 },
  { bankerScore: 7, playerScore: 5 },
  { bankerScore: 11, playerScore: 6 },
  { bankerScore: 4, playerScore: 4 },
  { bankerScore: 5, playerScore: 9 },
  { bankerScore: 10, playerScore: 7 },
  { bankerScore: 6, playerScore: 8 },
  { bankerScore: 9, playerScore: 3 },
  { bankerScore: 7, playerScore: 7 },
  { bankerScore: 8, playerScore: 6 },
  { bankerScore: 12, playerScore: 9 },
  { bankerScore: 4, playerScore: 10 },
  { bankerScore: 5, playerScore: 5 },
  { bankerScore: 11, playerScore: 7 },
  { bankerScore: 6, playerScore: 12 },
];

function scoreForRound(side: Round["result"], index: number) {
  const score = SCORE_EXAMPLES[index % SCORE_EXAMPLES.length];
  if (side === "T") {
    const tieScore = Math.max(2, Math.min(12, score.bankerScore));
    return { bankerScore: tieScore, playerScore: tieScore };
  }
  if (side === "B" && score.bankerScore <= score.playerScore) {
    return { bankerScore: score.playerScore, playerScore: score.bankerScore };
  }
  if (side === "P" && score.playerScore <= score.bankerScore) {
    return { bankerScore: score.playerScore, playerScore: score.bankerScore };
  }
  return score;
}

const TIE_MULTIPLIER_EXAMPLES = [4, 6, 10, 25, 4];

const baseId = 1640;
export const rounds: Round[] = ROADMAP.map((r, i) => {
  const { bankerScore, playerScore } = scoreForRound(r, i);
  return {
    id: baseId + i,
    result: r,
    bankerScore,
    playerScore,
    tieMultiplier: r === "T" ? TIE_MULTIPLIER_EXAMPLES[i % TIE_MULTIPLIER_EXAMPLES.length] : null,
    time: `${10 + Math.floor(i / 6)}:${String((i * 7) % 60).padStart(2, "0")}`,
  };
});

// Sobrescreve a última rodada com o exemplo do prompt: #1670 Banker 7 x Player 4
rounds[rounds.length - 1] = {
  id: 1670,
  result: "B",
  bankerScore: 7,
  playerScore: 4,
  time: "15:12",
};

// Histórico mockado de sinais (32 greens, 15 g1, 23 reds) — 70 entradas
const signals: MainSignal[] = [
  ...Array.from({ length: 32 }, (_, i) => ({
    id: `g-${i}`,
    side: i % 2 ? "BANKER" : ("PLAYER" as MainSignal["side"]),
    status: "green" as const,
    protection: "G0" as const,
    strength: 80,
  })),
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `g1-${i}`,
    side: i % 2 ? "BANKER" : ("PLAYER" as MainSignal["side"]),
    status: "green_g1" as const,
    protection: "G1" as const,
    strength: 75,
  })),
  ...Array.from({ length: 23 }, (_, i) => ({
    id: `r-${i}`,
    side: i % 2 ? "BANKER" : ("PLAYER" as MainSignal["side"]),
    status: "red" as const,
    protection: "G1" as const,
    strength: 60,
  })),
];

// Tie Alerts: 18 green + 7 expired = 25
const tieAlerts: TieAlert[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `tg-${i}`,
    level: "Alto" as const,
    confidence: 78,
    validityRounds: 4,
    status: "green" as const,
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `te-${i}`,
    level: "Médio" as const,
    confidence: 65,
    validityRounds: 4,
    status: "expired" as const,
  })),
];

export const mockDashboardData: DashboardData = {
  user: { name: "Gabriel" },
  mockMode: MOCK_MODE,
  rounds,
  currentSignal: {
    id: "current",
    side: "BANKER",
    status: "pending",
    protection: "G1",
    strength: 82,
  },
  currentTieAlert: {
    id: "current-tie",
    level: "Alto",
    confidence: 78,
    validityRounds: 4,
    status: "active",
  },
  neuralReading: {
    mode: "ACTIVE",
    numero: 7,
    origem: "BANKER",
    origemTipo: "OPOSTO",
    direcao: "PLAYER",
    validade: "G1",
    alertas: 177,
    acertos: 77,
    greenSemGale: 52,
    greenG1: 25,
    erros: 100,
    reds: 100,
    assertividade: 43.5,
    sequencePositive: 0,
    sequenceNegative: 1,
    maxSequencePositive: 4,
    maxSequenceNegative: 3,
  },
  moduleToggles: {
    tieAlert: true,
    surfAnalyzer: true,
  },
  entryMode: "off",
  currentSurfAlert: {
    surf_alert: true,
    surf_phase: "CONTINUIDADE",
    surf_side: "BANKER",
    surf_status: "CONTINUIDADE BANKER",
    surf_risk: 18,
    surf_break_risk: 18,
    surf_confidence: 78,
    stretched_count: 4,
    correction_count: 1,
    reason: "Surf Banker saudável após correção curta. Risco contrário baixo.",
    panels: {
      big_road: "Continuidade Banker com coluna curta sustentada.",
      big_eye_boy: "Tendencia saudavel, sem divergencia forte.",
      small_road: "Organizacao favoravel e alternancia controlada.",
      cockroach_pig: "Sem reversao tardia relevante no momento.",
    },
    surf_prediction_side: "BANKER",
    surf_prediction_status: "ACTIVE",
    surf_prediction_confidence: 78,
    surf_prediction_window: 5,
  },
  engineDecision: {
    state: "ATENCAO",
    reason: "Tie Alert ativo em paralelo. Nenhuma entrada principal confirmada.",
    confidence: 74,
    debug: "alternancia=53% | seq=B x2 | tiePressure=20%",
  },
  mainScoreboard: {
    greens: 18,
    greensG1: 5,
    reds: 3,
    totalGreens: 23,
    totalEntries: 26,
    assertiveness: 88.5,
    sequencePositive: 6,
    sequenceNegative: 0,
  },
  tieAlertScoreboard: {
    greenTieAlerts: 16,
    expired: 41,
    totalAlerts: 57,
    assertiveness: 28.1,
    sequencePositive: 1,
    sequenceExpired: 3,
  },
  tieRadarHistory: buildTieRadarHistoryAnalysis(rounds, {
    cycleDate: "2026-07-02",
    now: "2026-07-02T15:30:00-03:00",
  }),
  surfAnalyzerScoreboard: {
    totalAlerts: 30,
    hits: 22,
    fails: 8,
    expired: 0,
    greenSemGale: 15,
    greenG1: 7,
    reds: 8,
    blocked: 4,
    noRisk: 12,
    bankerHits: 5,
    playerHits: 4,
    assertiveness: 73.3,
    sequencePositive: 4,
    sequenceNegative: 0,
    maxBankerSurfHit: 7,
    maxPlayerSurfHit: 6,
    maxBreakDetected: 82,
    maxRetakeDetected: 5,
    currentHitStreak: 2,
  },
  pressureSeries: buildPressureSeries(rounds),
};
