import assert from "node:assert/strict";
import {
  PatternMinerEngine,
  parsePatternSequenceText,
  parsePatternToken,
  resolvePatternStatusFromMetrics,
} from "../src/patternMiner/PatternMinerEngine.ts";
import {
  resetPatternIaLifecycleForTests,
  resolvePatternIaLifecycle,
} from "../src/patternMiner/PatternMinerLifecycle.ts";
import { patternIaEntrySideLabel, resetPatternIaEntryHistoryForTests } from "../src/patternMiner/PatternMinerEntryHistory.ts";
import { formatPatternToken } from "../src/patternMiner/PatternMinerDisplay.ts";

function round(id, result, bankerScore = 7, playerScore = 5) {
  return {
    id,
    result,
    bankerScore,
    playerScore,
    time: `2026-07-02T10:${String(id).padStart(2, "0")}:00.000Z`,
  };
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

const computed = PatternMinerEngine.analyzeFromHistory(sampleRounds);
assert.equal(computed.source, "engine");
assert.ok(Array.isArray(computed.ranking));
assert.ok(computed.analyzedRounds >= 6);

const incoming = {
  ...computed,
  source: "publisher",
  entryAlerts: [
    {
      id: "validated-test",
      kind: "validated",
      strategy: {
        id: "pm-test",
        sequence: ["B", "P"],
        module: "PADROES_IA",
        pattern_signature: "B-P",
        occurrences: 40,
        expectedResult: "B",
        next_side: "B",
        accuracy: 100,
        sg_count: 3,
        g1_count: 1,
        red_count: 0,
        tie_after_count: 0,
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
        createdAt: computed.updatedAt,
        status: "ENTRADA CONFIRMADA",
        insufficientSample: false,
        updatedAt: computed.updatedAt,
        rank: 1,
        signal_id: "pattern-ai:pm-test:10:B:1",
        event_id: "validated-pm-test-10",
        round_id: 10,
        generated_at: computed.updatedAt,
      },
      matchedRounds: sampleRounds.slice(-2),
      progress: 1,
      missingTokens: [],
      title: "ENTRADA CONFIRMADA",
    },
  ],
};

const merged = PatternMinerEngine.mergeWithIncoming(computed, incoming);
assert.ok(["merged", "publisher"].includes(merged.source));
assert.ok(merged.entryAlerts.length >= 1);
assert.equal(merged.entryAlerts[0].strategy.expectedResult, "B");

const engineOnly = PatternMinerEngine.mergeWithIncoming(computed, undefined);
assert.equal(engineOnly.source, "engine");

assert.equal(parsePatternToken("T8")?.normalized, "T8");
assert.equal(formatPatternToken("T8"), "🟡 Empate 8");
assert.deepEqual(parsePatternSequenceText("P10 T8 B P B"), ["P10", "T8", "B", "P", "B"]);
assert.equal(formatPatternToken("T"), "🟡 Empate");

const allowed = resolvePatternStatusFromMetrics({ occurrences: 40, accuracy: 100, redCount: 2 });
assert.equal(allowed.status, "PADRAO 100%");

const blocked = resolvePatternStatusFromMetrics({ occurrences: 40, accuracy: 100, redCount: 3 });
assert.equal(blocked.status, "BLOQUEADO POR MAIS DE 2 REDS");

assert.equal(patternIaEntrySideLabel("T", 8), "T EMPATE 8X");

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();
const lifecycleSnapshot = {
  ...incoming,
  entryAlerts: incoming.entryAlerts,
};
const lifecycleRound1 = resolvePatternIaLifecycle(lifecycleSnapshot, sampleRounds);
assert.equal(lifecycleRound1.displayState, "entry_confirmed");
assert.ok(lifecycleRound1.activeSignal?.signal_id);

const afterSgWin = resolvePatternIaLifecycle(lifecycleSnapshot, [...sampleRounds, round(11, "B")]);
assert.equal(afterSgWin.displayState, "result_green");
assert.equal(afterSgWin.resultFlash, "green");
assert.equal(afterSgWin.activeSignal, null);
assert.ok(afterSgWin.lastSignalResult);
assert.equal(afterSgWin.entryHistory.length, 1);

assert.equal(patternIaEntrySideLabel("T", 8), "T EMPATE 8X");

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();
const lifecycleSnapshot2 = { ...incoming };
resolvePatternIaLifecycle(lifecycleSnapshot2, sampleRounds);
const afterSgLoss = resolvePatternIaLifecycle(lifecycleSnapshot2, [...sampleRounds, round(11, "P")]);
assert.equal(afterSgLoss.displayState, "waiting_result");
assert.equal(afterSgLoss.status, "FAZER GALE 1");

assert.equal(patternIaEntrySideLabel("T", 8), "T EMPATE 8X");

resetPatternIaLifecycleForTests();
resetPatternIaEntryHistoryForTests();
resolvePatternIaLifecycle(lifecycleSnapshot2, sampleRounds);
resolvePatternIaLifecycle(lifecycleSnapshot2, [...sampleRounds, round(11, "P")]);
const afterRed = resolvePatternIaLifecycle(lifecycleSnapshot2, [...sampleRounds, round(11, "P"), round(12, "P")]);
assert.equal(afterRed.displayState, "result_red");
assert.equal(afterRed.resultFlash, "red");
assert.equal(afterRed.activeSignal, null);

console.log("pattern-miner-engine.test.mjs passed");
