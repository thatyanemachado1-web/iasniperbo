import assert from "node:assert/strict";
import { resolveLiveConfirmedSignal } from "../src/lib/liveConfirmedSignals.ts";

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

console.log("live confirmed signals tests passed");
