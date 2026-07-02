import assert from "node:assert/strict";
import { TieRadarEngine } from "../src/tieRadar/TieRadarEngine.ts";

function round(id, result, time = `2026-07-02T10:${String(id).padStart(2, "0")}:00.000Z`) {
  return { id, result, bankerScore: 7, playerScore: 5, time };
}

const tiePressureRounds = [
  round(1, "B"),
  round(2, "P"),
  round(3, "T"),
  round(4, "B"),
  round(5, "T"),
  round(6, "P"),
  round(7, "B"),
  round(8, "T"),
  round(9, "P"),
  round(10, "B"),
];

const analysis = TieRadarEngine.analyze(tiePressureRounds, "2026-07-02");
assert.equal(analysis.alert.status, "active");
assert.ok(analysis.alert.confidence >= 50);
assert.ok(analysis.tiePullers.length >= 0);
assert.equal(analysis.source, "engine");

const greenRound = [...tiePressureRounds, round(11, "T")];
const green = TieRadarEngine.analyze(greenRound, "2026-07-02");
assert.equal(green.alert.status, "green");

const yesterdayOnly = [
  round(1, "T", "2026-07-01T23:58:00.000Z"),
  round(2, "T", "2026-07-01T23:59:00.000Z"),
];
const todayEmpty = TieRadarEngine.analyze(yesterdayOnly, "2026-07-02");
assert.equal(todayEmpty.alert.status, "expired");

console.log("tie-radar-engine.test.mjs passed");
