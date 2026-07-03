import assert from "node:assert/strict";
import {
  resetPatternIaLifecycleForTests,
  resolvePatternIaLifecycle,
} from "../src/patternMiner/PatternMinerLifecycle.ts";
import { resetPatternIaEntryHistoryForTests } from "../src/patternMiner/PatternMinerEntryHistory.ts";

function round(id, result) {
  return { id, result, bankerScore: 7, playerScore: 5, time: `2026-07-02T10:${String(id).padStart(2, "0")}:00.000Z` };
}

const sampleRounds = [
  round(1, "B"),
  round(2, "B"),
  round(3, "P"),
  round(4, "B"),
  round(5, "B"),
  round(6, "P"),
  round(7, "B"),
  round(8, "B"),
  round(9, "P"),
  round(10, "B"),
];

const incoming = {
  entryAlerts: [
    {
      id: "validated-test",
      kind: "validated",
      strategy: {
        id: "pm-test",
        sequence: ["B", "P"],
        occurrences: 40,
        expectedResult: "B",
        next_side: "B",
        accuracy: 100,
        sg: 3,
        g1: 1,
        red: 0,
        tie: 0,
        totalValidated: 4,
        sequencePositive: 2,
        sequenceNegative: 0,
        maxSequencePositive: 2,
        maxSequenceNegative: 0,
        assertiveness: 100,
        createdAt: "2026-07-02T10:00:00.000Z",
        status: "ENTRADA CONFIRMADA",
        insufficientSample: false,
        updatedAt: "2026-07-02T10:00:00.000Z",
        rank: 1,
        signal_id: "pattern-ai:pm-test:10:B:1",
        event_id: "validated-pm-test-10",
        round_id: 10,
        generated_at: "2026-07-02T10:00:00.000Z",
      },
      matchedRounds: sampleRounds.slice(-2),
      progress: 1,
      missingTokens: [],
      title: "ENTRADA CONFIRMADA",
    },
  ],
  formingAlerts: [],
};

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();

const t0 = Date.now();
const confirmed = resolvePatternIaLifecycle(incoming, sampleRounds, t0);
assert.equal(confirmed.displayState, "entry_confirmed");
assert.ok(confirmed.activeSignal);
assert.equal(confirmed.lastSignalResult, null);

const afterWin = resolvePatternIaLifecycle(incoming, [...sampleRounds, round(11, "B")], t0 + 100);
assert.equal(afterWin.displayState, "result_green");
assert.equal(afterWin.activeSignal, null);
assert.ok(afterWin.lastSignalResult);
assert.equal(afterWin.lastSignalResult.result_label, "GREEN SG");

const afterFlash = resolvePatternIaLifecycle(incoming, [...sampleRounds, round(11, "B")], t0 + 1500);
assert.equal(afterFlash.displayState, "analyzing");
assert.equal(afterFlash.lastSignalResult, null);
assert.equal(afterFlash.activeSignal, null);
assert.equal(afterFlash.resultFlash, "none");

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();
resolvePatternIaLifecycle(incoming, sampleRounds, t0);
resolvePatternIaLifecycle(incoming, [...sampleRounds, round(11, "P")], t0 + 100);
const afterRed = resolvePatternIaLifecycle(incoming, [...sampleRounds, round(11, "P"), round(12, "P")], t0 + 200);
assert.equal(afterRed.displayState, "result_red");
assert.equal(afterRed.activeSignal, null);

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();

const firstEntry = {
  ...incoming,
  entryAlerts: [incoming.entryAlerts[0]],
};
const secondEntry = {
  ...incoming,
  entryAlerts: [
    {
      ...incoming.entryAlerts[0],
      id: "validated-test-2",
      strategy: {
        ...incoming.entryAlerts[0].strategy,
        id: "pm-test-2",
        signal_id: "pattern-ai:pm-test-2:10:P:2",
        event_id: "validated-pm-test-2-10",
        expectedResult: "P",
        next_side: "P",
      },
    },
  ],
};

resolvePatternIaLifecycle(firstEntry, sampleRounds, t0);
const queuedWhileActive = resolvePatternIaLifecycle(
  { entryAlerts: [...firstEntry.entryAlerts, ...secondEntry.entryAlerts], formingAlerts: [] },
  sampleRounds,
  t0 + 50,
);
assert.equal(queuedWhileActive.displayState, "entry_confirmed");
assert.equal(queuedWhileActive.queueLength, 1);

console.log("pattern-miner-lifecycle.test.mjs passed");
