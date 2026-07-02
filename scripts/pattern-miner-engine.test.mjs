import assert from "node:assert/strict";
import { PatternMinerEngine } from "../src/patternMiner/PatternMinerEngine.ts";

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
        occurrences: 4,
        expectedResult: "B",
        sg: 3,
        g1: 1,
        red: 0,
        tie: 0,
        totalValidated: 4,
        sequencePositive: 2,
        sequenceNegative: 0,
        maxSequencePositive: 2,
        maxSequenceNegative: 0,
        assertiveness: 88,
        createdAt: computed.updatedAt,
        status: "HOT",
        insufficientSample: false,
        updatedAt: computed.updatedAt,
        rank: 1,
      },
      matchedRounds: sampleRounds.slice(-2),
      progress: 1,
      missingTokens: [],
      title: "PADRAO VALIDADO",
    },
  ],
};

const merged = PatternMinerEngine.mergeWithIncoming(computed, incoming);
assert.equal(merged.source, "merged");
assert.ok(merged.entryAlerts.length >= 1);
assert.equal(merged.entryAlerts[0].strategy.expectedResult, "B");

const engineOnly = PatternMinerEngine.mergeWithIncoming(computed, undefined);
assert.equal(engineOnly.source, "engine");

console.log("pattern-miner-engine.test.mjs passed");
