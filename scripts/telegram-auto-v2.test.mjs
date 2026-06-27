import assert from "node:assert/strict";
import {
  buildTelegramAutoV2NotificationKey,
  detectAiPatternsConfirmedCard,
  detectGlobalConfirmedCards,
  detectPayingNumbersConfirmedCard,
  detectSurfConfirmedCard,
  detectTiesConfirmedCard,
  telegramAutoV2AllowsRetry,
  telegramAutoV2SentBlocksRetry,
} from "../src/lib/telegramAutoV2.ts";

const latestRound = { id: 991, result: "B", bankerScore: 8, playerScore: 5, time: "18:00:00" };

const activePayingDashboard = {
  rounds: [latestRound],
  neuralReading: {
    mode: "ACTIVE",
    paganteStatus: "ENTRADA CONFIRMADA",
    direcao: "B",
    origem: "B",
    numero: 7,
    validade: "G1",
  },
};

const aiDashboard = {
  rounds: [latestRound],
  patternMinerSnapshot: {
    entryAlerts: [
      {
        id: "alert-1",
        kind: "validated",
        title: "Padrao confirmado",
        strategy: {
          id: "strategy-1",
          status: "CONFIRMADO",
          expectedResult: "B",
          sequence: ["P", "B", "P"],
          assertiveness: 88,
        },
        matchedRounds: [{ id: "991" }],
      },
    ],
  },
};

const surfDashboard = {
  rounds: [latestRound],
  currentSurfAlert: {
    surf_alert: true,
    surf_status: "ATIVO CONFIRMADO",
    surf_prediction_side: "B",
    id: "surf-1",
  },
};

const tieDashboard = {
  rounds: [latestRound],
  currentTieAlert: {
    id: "tie-1",
    status: "active",
    level: "alto",
    confidence: 82,
  },
};

assert.equal(detectPayingNumbersConfirmedCard(activePayingDashboard, latestRound).confirmed, true);
assert.equal(detectAiPatternsConfirmedCard(aiDashboard, latestRound).confirmed, true);
assert.equal(detectSurfConfirmedCard(surfDashboard, latestRound).confirmed, true);
assert.equal(detectTiesConfirmedCard(tieDashboard, latestRound).confirmed, true);

const globals = detectGlobalConfirmedCards(
  {
    ...activePayingDashboard,
    ...aiDashboard,
    currentSurfAlert: surfDashboard.currentSurfAlert,
    currentTieAlert: tieDashboard.currentTieAlert,
  },
  latestRound,
);
assert.equal(globals.length, 4);

assert.equal(
  detectPayingNumbersConfirmedCard({ rounds: [latestRound], neuralReading: { mode: "SCANNING" } }, latestRound).confirmed,
  false,
);

const dedupeKey = buildTelegramAutoV2NotificationKey("channel-1", "paying_numbers", "paying:991");
assert.match(dedupeKey, /^v2:channel-1:paying_numbers:/);
assert.equal(telegramAutoV2SentBlocksRetry("sent"), true);
assert.equal(telegramAutoV2AllowsRetry("error"), true);
assert.equal(telegramAutoV2AllowsRetry("sent"), false);

console.log("telegram-auto-v2 tests passed");
