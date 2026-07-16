import assert from "node:assert/strict";
import {
  resolveLiveCardSignals,
  resolveLiveConfirmedSignal,
} from "../src/lib/liveConfirmedSignals.ts";

const latestRound = {
  id: 500,
  result: "B",
  bankerScore: 8,
  playerScore: 5,
  time: "12:00:00",
};

function dashboard(overrides = {}) {
  return {
    mockMode: false,
    rounds: [latestRound],
    currentTieAlert: {
      id: "tie-none",
      level: "Baixo",
      confidence: 20,
      validityRounds: 2,
      status: "expired",
    },
    currentSignal: {
      id: "none",
      side: "NONE",
      status: "waiting",
      protection: "G1",
      strength: 0,
    },
    ...overrides,
  };
}

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({ neuralReading: { mode: "SCANNING", numero: 7, origem: "BANKER" } }),
    "paying_numbers",
  ),
  null,
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      neuralReading: { mode: "ACTIVE", numero: 7, origem: "BANKER", direcao: "BANKER" },
    }),
    "paying_numbers",
  )?.side,
  "BANKER",
);

const neuralDetailed = resolveLiveConfirmedSignal(
  dashboard({
    neuralReading: {
      mode: "ACTIVE",
      numero: 7,
      origem: "BANKER",
      direcao: "BANKER",
      validade: "G1",
      acertos: 5,
      erros: 1,
    },
  }),
  "paying_numbers",
);
assert.equal(neuralDetailed?.headline, "Entrada BANKER");
assert.equal(neuralDetailed?.detail, "Banker - ate G1 - 83%");

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      displayState: "entry_confirmed",
      displaySide: "PLAYER",
      neuralReading: { mode: "SCANNING" },
    }),
    "paying_numbers",
  )?.side,
  "PLAYER",
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      displayState: "entry_confirmed",
      displaySide: "BANKER",
      neuralReading: { mode: "ACTIVE", numero: 7, origem: "BANKER", blocked: true },
    }),
    "paying_numbers",
  ),
  null,
);

const surfBase = {
  surf_alert: true,
  surf_phase: "SURF_FORTE",
  surf_side: "BANKER",
  surf_risk: 20,
  surf_confidence: 59,
  stretched_count: 3,
  correction_count: 0,
  reason: "",
  panels: { big_road: "", big_eye_boy: "", small_road: "", cockroach_pig: "" },
};

assert.equal(
  resolveLiveConfirmedSignal(dashboard({ currentSurfAlert: surfBase }), "surf_alert"),
  null,
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({ currentSurfAlert: { ...surfBase, surf_confidence: 60 } }),
    "surf_alert",
  )?.side,
  "BANKER",
);
assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({ currentSurfAlert: { ...surfBase, surf_confidence: 60 } }),
    "surf_alert",
  )?.detail,
  "SURF FORTE - Forca 60% - Quebra 20%",
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      currentSurfAlert: {
        ...surfBase,
        surf_confidence: 90,
        dailySurfMemory: {
          surfBias: "BANKER",
          surfStatus: "RISCO_QUEBRA",
        },
      },
    }),
    "surf_alert",
  ),
  null,
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      currentSurfAlert: {
        ...surfBase,
        surf_alert: false,
        surfCycle: {
          module: "SURF_ANALYZER",
          cycleStatus: "AGUARDANDO_RESULTADO",
          attempt: "SG",
          cycleId: "surf-cycle-1",
          technicalSide: "PLAYER",
        },
      },
    }),
    "surf_alert",
  )?.side,
  "PLAYER",
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      currentTieAlert: {
        id: "tie-low",
        level: "Baixo",
        confidence: 64,
        validityRounds: 2,
        status: "active",
      },
    }),
    "ties_only",
  ),
  null,
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      currentTieAlert: {
        id: "tie-high",
        level: "Alto",
        confidence: 40,
        validityRounds: 2,
        status: "active",
      },
    }),
    "ties_only",
  )?.side,
  "TIE",
);
assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      currentTieAlert: {
        id: "tie-high-copy",
        level: "Alto",
        confidence: 83,
        validityRounds: 2,
        status: "active",
      },
    }),
    "ties_only",
  )?.headline,
  "Possivel Tie",
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      patternIaServerCycle: {
        module: "PADROES_IA",
        cycleStatus: "AGUARDANDO_RESULTADO",
        attempt: "SG",
        signalId: "pattern-1",
        technicalSide: "PLAYER",
        sideCode: "P",
        sourceRoundId: 500,
      },
    }),
    "ai_patterns",
  )?.side,
  "PLAYER",
);
const officialPatternCopy = resolveLiveConfirmedSignal(
  dashboard({
    patternIaServerCycle: {
      module: "PADROES_IA",
      cycleStatus: "AGUARDANDO_RESULTADO",
      attempt: "SG",
      signalId: "pattern-copy",
      technicalSide: "PLAYER",
      sideCode: "P",
      sourceRoundId: 500,
    },
  }),
  "ai_patterns",
);
assert.equal(officialPatternCopy?.headline, "ENTRADA CONFIRMADA");
assert.equal(officialPatternCopy?.detail, "PLAYER - aguardando resultado");

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      patternIaServerCycle: {
        module: "PADROES_IA",
        cycleStatus: "CLOSED",
        signalId: "pattern-closed",
        technicalSide: "BANKER",
        sideCode: "B",
        sourceRoundId: 500,
      },
    }),
    "ai_patterns",
  ),
  null,
);

const validPatternStrategy = {
  id: "strategy-1",
  sequence: ["P", "B"],
  occurrences: 5,
  expectedResult: "B",
  sg: 4,
  g1: 0,
  red: 1,
  tie: 0,
  totalValidated: 5,
  sequencePositive: 4,
  sequenceNegative: 1,
  maxSequencePositive: 4,
  maxSequenceNegative: 1,
  assertiveness: 80,
  status: "HOT",
  insufficientSample: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  rank: 1,
};

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      updatedAt: new Date().toISOString(),
      patternMinerSnapshot: {
        updatedAt: new Date().toISOString(),
        entryAlerts: [
          {
            id: "validated-1",
            kind: "validated",
            strategy: validPatternStrategy,
            matchedRounds: [latestRound],
          },
        ],
      },
    }),
    "ai_patterns",
  )?.side,
  "BANKER",
);

assert.equal(
  resolveLiveConfirmedSignal(
    dashboard({
      updatedAt: new Date().toISOString(),
      patternMinerSnapshot: {
        updatedAt: new Date().toISOString(),
        entryAlerts: [
          {
            id: "forming-1",
            kind: "forming",
            strategy: validPatternStrategy,
            matchedRounds: [latestRound],
          },
        ],
      },
    }),
    "ai_patterns",
  ),
  null,
);

const resultNow = Date.now();
const recentIso = new Date(resultNow - 1_500).toISOString();

const neuralLifecycle = resolveLiveCardSignals(
  dashboard({
    neuralReading: {
      mode: "ACTIVE",
      numero: 7,
      origem: "BANKER",
      direcao: "BANKER",
      cycleStatus: "AGUARDANDO_RESULTADO",
    },
    neuralEntryState: {
      key: "7:BANKER:PAGANTE:BANKER",
      expectedSide: "BANKER",
      status: "awaiting_sg",
      triggerRoundKey: "499",
    },
    neuralEntryLastResult: {
      id: "neural-result-500",
      key: "7:BANKER:PAGANTE:BANKER",
      expectedSide: "BANKER",
      kind: "sg",
      outcome: "GREEN",
      resultRoundKey: "500",
      finishedAt: recentIso,
    },
  }),
  "paying_numbers",
  resultNow,
);
assert.equal(neuralLifecycle[0]?.kind, "result");
assert.equal(neuralLifecycle[0]?.label, "GREEN SG");
assert.equal(neuralLifecycle[1]?.kind, "entry");

const closedSurf = resolveLiveCardSignals(
  dashboard({
    currentSurfAlert: {
      ...surfBase,
      surf_confidence: 95,
      surfCycle: {
        module: "SURF_ANALYZER",
        cycleStatus: "CLOSED",
        attempt: "SG",
        cycleId: "surf-result-500",
        technicalSide: "PLAYER",
        resultRoundId: "500",
        result: "RED",
        closedAt: recentIso,
      },
    },
  }),
  "surf_alert",
  resultNow,
);
assert.equal(closedSurf.length, 1);
assert.equal(closedSurf[0]?.kind, "result");
assert.equal(closedSurf[0]?.label, "RED");

const tieGreen = resolveLiveCardSignals(
  dashboard({
    currentTieAlert: {
      id: "tie-green-500",
      level: "Alto",
      confidence: 90,
      validityRounds: 2,
      status: "green",
    },
  }),
  "ties_only",
  resultNow,
);
assert.equal(tieGreen.length, 1);
assert.equal(tieGreen[0]?.kind, "result");
assert.equal(tieGreen[0]?.label, "EMPATE CONFIRMADO");

const closedPattern = resolveLiveCardSignals(
  dashboard({
    patternIaServerCycle: {
      module: "PADROES_IA",
      cycleStatus: "CLOSED",
      attempt: "G1",
      signalId: "pattern-result-500",
      eventId: "event-result-500",
      patternId: "p-result-500",
      technicalSide: "BANKER",
      sideCode: "B",
      sourceRoundId: 498,
      g1RoundId: "500",
      result: "EMPATE_G1",
      tieMultiplier: "10X",
      closedAt: recentIso,
    },
    updatedAt: recentIso,
    patternMinerSnapshot: {
      updatedAt: recentIso,
      entryAlerts: [
        {
          id: "validated-stale-behind-closed-cycle",
          kind: "validated",
          strategy: validPatternStrategy,
          matchedRounds: [latestRound],
        },
      ],
    },
  }),
  "ai_patterns",
  resultNow,
);
assert.equal(closedPattern.length, 1);
assert.equal(closedPattern[0]?.kind, "result");
assert.equal(closedPattern[0]?.label, "EMPATE 10X");

const lateralPayingResults = [
  { id: "lp-0", side: "PLAYER", value: 7, slot: 0 },
  { id: "lp-1", side: "PLAYER", value: 7, slot: 1 },
  { id: "lp-2", side: "PLAYER", value: 7, slot: 2 },
  { id: "lp-3", side: "PLAYER", value: 3, slot: 3 },
  { id: "lp-4", side: "PLAYER", value: 4, slot: 4 },
  { id: "lp-5", side: "BANKER", value: 5, slot: 5 },
  { id: "lp-6", side: "BANKER", value: 8, slot: 6 },
  { id: "lp-7", side: "BANKER", value: 8, slot: 7 },
  { id: "lp-8", side: "BANKER", value: 8, slot: 8 },
];
const lateralPaying = resolveLiveCardSignals(
  dashboard({ bacBoBeadPlate: lateralPayingResults }),
  "lateral_paying_numbers",
  resultNow,
);
assert.equal(lateralPaying[0]?.kind, "result");
assert.equal(lateralPaying[0]?.label, "GREEN SG");

const lateralPayingEntryResults = lateralPayingResults.map((item) =>
  item.slot === 3 ? { ...item, value: 7 } : item,
);
const lateralPayingEntry = resolveLiveCardSignals(
  dashboard({ bacBoBeadPlate: lateralPayingEntryResults }),
  "lateral_paying_numbers",
  resultNow,
).find((signal) => signal.kind === "entry");
assert.equal(lateralPayingEntry?.headline, "Entrada BANKER");
assert.equal(lateralPayingEntry?.detail, "BANKER • até G1 • 100% na amostra atual");

const lateralTie = resolveLiveCardSignals(
  dashboard({
    bacBoBeadPlate: [
      { id: "lt-origin", side: "TIE", value: 6, slot: 0, tieMultiplier: 4 },
      { id: "lt-result", side: "TIE", value: 4, slot: 24, tieMultiplier: 10 },
    ],
  }),
  "lateral_tie_patterns",
  resultNow,
);
assert.equal(lateralTie[0]?.kind, "result");
assert.equal(lateralTie[0]?.label, "EMPATE 10X");

console.log("live confirmed signals tests passed");
