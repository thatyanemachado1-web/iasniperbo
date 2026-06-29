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

assert.equal(
  detectAiPatternsConfirmedCard(
    {
      rounds: [latestRound],
      patternMinerSnapshot: {
        entryAlerts: [
          {
            id: "alert-hot-confirmed",
            kind: "hot",
            title: "Padrão confirmado",
            strategy: {
              id: "strategy-hot",
              status: "quente",
              expectedResult: "P",
              sequence: ["B", "P", "B"],
              assertiveness: 84,
            },
            matchedRounds: [{ id: "991" }],
          },
        ],
      },
    },
    latestRound,
  ).confirmed,
  true,
);

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

const playerVisualBeatsStaleMainSignal = detectPayingNumbersConfirmedCard(
  {
    rounds: [latestRound],
    neuralReading: {
      mode: "ACTIVE",
      direcao: "PLAYER",
      origem: "PLAYER",
      numero: 9,
      paganteStatus: "ENTRADA CONFIRMADA PLAYER",
    },
    neuralEntryState: {
      key: "stale-banker",
      expectedSide: "BANKER",
      status: "awaiting_sg",
      triggerRoundKey: "990",
    },
    currentSignal: {
      id: "stale-banker",
      side: "BANKER",
      status: "pending",
    },
  },
  latestRound,
);
assert.equal(playerVisualBeatsStaleMainSignal.confirmed, true);
assert.match(playerVisualBeatsStaleMainSignal.signalKey, /:P:round:991$/);

const bankerVisualBeatsStaleEntryState = detectPayingNumbersConfirmedCard(
  {
    rounds: [latestRound],
    neuralReading: {
      mode: "ACTIVE",
      direcao: "BANKER",
      origem: "BANKER",
      numero: 4,
      paganteStatus: "ENTRADA CONFIRMADA BANKER",
    },
    neuralEntryState: {
      key: "stale-player",
      expectedSide: "PLAYER",
      status: "awaiting_sg",
      triggerRoundKey: "990",
    },
  },
  latestRound,
);
assert.equal(bankerVisualBeatsStaleEntryState.confirmed, true);
assert.match(bankerVisualBeatsStaleEntryState.signalKey, /:B:round:991$/);

assert.equal(
  detectPayingNumbersConfirmedCard(
    {
      rounds: [latestRound],
      neuralReading: {
        mode: "ACTIVE",
        direcao: "TIE",
        origem: "TIE",
        numero: 6,
        paganteStatus: "ENTRADA CONFIRMADA TIE",
      },
    },
    latestRound,
  ).confirmed,
  false,
);

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

assert.equal(
  detectSurfConfirmedCard(
    {
      rounds: [latestRound],
      currentSurfAlert: {
        surf_alert: false,
        surf_status: "MONITORANDO",
        surf_prediction_side: "P",
        surf_break_risk: 78,
        id: "surf-risk",
      },
    },
    latestRound,
  ).confirmed,
  true,
);

const dedupeKey = buildTelegramAutoV2NotificationKey("channel-1", "paying_numbers", "paying:991", 991);
assert.match(dedupeKey, /^v2:channel-1:paying_numbers:/);
assert.equal(telegramAutoV2SentBlocksRetry("sent"), true);
assert.equal(telegramAutoV2AllowsRetry("error"), true);
assert.equal(telegramAutoV2AllowsRetry("sent"), false);

console.log("telegram-auto-v2 tests passed");
