import type { DashboardData, Round, MainSignal, TieAlert } from "@/types/dashboard";
import {
  buildPressureSeries,
  calculateMainAssertiveness,
  calculateTieAlertAssertiveness,
} from "@/utils/statistics";

export const MOCK_MODE = true;

// Roadmap definido no prompt:
// B P B B T B P B B P T B B P B
// P B B T P B P B T B B P T B P
const ROADMAP: Round["result"][] = [
  "B","P","B","B","T","B","P","B","B","P","T","B","B","P","B",
  "P","B","B","T","P","B","P","B","T","B","B","P","T","B","P",
];

function randScore(side: Round["result"]) {
  const a = Math.floor(Math.random() * 10);
  const b = Math.floor(Math.random() * 10);
  if (side === "T") {
    const v = Math.floor(Math.random() * 10);
    return { bankerScore: v, playerScore: v };
  }
  if (side === "B") return { bankerScore: Math.max(a, b), playerScore: Math.min(a, b) };
  return { bankerScore: Math.min(a, b), playerScore: Math.max(a, b) };
}

const baseId = 1640;
export const rounds: Round[] = ROADMAP.map((r, i) => {
  const { bankerScore, playerScore } = randScore(r);
  return {
    id: baseId + i,
    result: r,
    bankerScore,
    playerScore,
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
    id: `g-${i}`, side: i % 2 ? "BANKER" : "PLAYER" as MainSignal["side"],
    status: "green" as const, protection: "G0" as const, strength: 80,
  })),
  ...Array.from({ length: 15 }, (_, i) => ({
    id: `g1-${i}`, side: i % 2 ? "BANKER" : "PLAYER" as MainSignal["side"],
    status: "green_g1" as const, protection: "G1" as const, strength: 75,
  })),
  ...Array.from({ length: 23 }, (_, i) => ({
    id: `r-${i}`, side: i % 2 ? "BANKER" : "PLAYER" as MainSignal["side"],
    status: "red" as const, protection: "G1" as const, strength: 60,
  })),
];

// Tie Alerts: 18 green + 7 expired = 25
const tieAlerts: TieAlert[] = [
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `tg-${i}`, level: "Alto" as const, confidence: 78, validityRounds: 4, status: "green" as const,
  })),
  ...Array.from({ length: 7 }, (_, i) => ({
    id: `te-${i}`, level: "Médio" as const, confidence: 65, validityRounds: 4, status: "expired" as const,
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
  engineDecision: {
    state: "ATENCAO",
    reason: "Tie Alert ativo em paralelo. Nenhuma entrada principal confirmada.",
    confidence: 74,
    debug: "alternancia=53% | streak=B x2 | tiePressure=20%",
  },
  mainScoreboard: calculateMainAssertiveness(signals),
  tieAlertScoreboard: calculateTieAlertAssertiveness(tieAlerts),
  pressureSeries: buildPressureSeries(rounds),
};