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

assert.equal(
  detectPayingNumbersConfirmedCard(
    {
      rounds: [latestRound],
      neuralReading: { mode: "ACTIVE", direcao: "B", origem: "B", numero: 7, validade: "G1" },
      currentSignal: { id: "signal-1", side: "BANKER", status: "pending", protection: "G1", strength: 80 },
    },
    latestRound,
  ).confirmed,
  true,
);

assert.equal(
  detectPayingNumbersConfirmedCard(
    {
      rounds: [latestRound],
      currentSignal: { id: "neural-entry:7:B:round:991", side: "BANKER", status: "pending", protection: "G1", strength: 80 },
    },
    latestRound,
  ).confirmed,
  true,
);

assert.equal(
  detectPayingNumbersConfirmedCard(
    {
      rounds: [latestRound],
      neuralReading: { mode: "SCANNING", numero: 9 },
      currentSignal: { id: "signal-991", side: "BANKER", status: "pending" },
    },
    latestRound,
  ).confirmed,
  true,
);

assert.equal(
  detectPayingNumbersConfirmedCard(
    {
      rounds: [latestRound],
      neuralReading: {
        mode: "SCANNING",
        numero: 6,
        indicator: { label: "Entrada confirmada PLAYER" },
      },
      currentSignal: { id: "signal-991", status: "g1" },
    },
    latestRound,
  ).confirmed,
  true,
);

const playerFromVisualCard = detectPayingNumbersConfirmedCard(
  {
    rounds: [latestRound],
    neuralReading: {
      mode: "SCANNING",
      paganteStatus: "ENTRADA CONFIRMADA PLAYER",
      numero: 9,
    },
  },
  latestRound,
);
assert.equal(playerFromVisualCard.confirmed, true);
assert.match(playerFromVisualCard.signalKey, /:P:round:991$/);

const bankerFromCurrentSignal = detectPayingNumbersConfirmedCard(
  {
    rounds: [latestRound],
    neuralReading: { mode: "SCANNING", numero: 4 },
    currentSignal: {
      id: "entrada-confirmada-banker",
      side: "BANKER",
      status: "active",
    },
  },
  latestRound,
);
assert.equal(bankerFromCurrentSignal.confirmed, true);
assert.match(bankerFromCurrentSignal.signalKey, /:B:round:991$/);

assert.equal(detectSurfConfirmedCard(surfDashboard, latestRound).signalKey, "surf:surf-1:B:round:991");
assert.equal(detectTiesConfirmedCard(tieDashboard, latestRound).signalKey, "tie:tie-1:alto:round:991");

const dedupeKey = buildTelegramAutoV2NotificationKey("channel-1", "paying_numbers", "paying:991", 991);
assert.match(dedupeKey, /^v2:channel-1:paying_numbers:/);
assert.equal(telegramAutoV2SentBlocksRetry("sent"), true);
assert.equal(telegramAutoV2AllowsRetry("error"), true);
assert.equal(telegramAutoV2AllowsRetry("sent"), false);

console.log("telegram-auto-v2 tests passed");
