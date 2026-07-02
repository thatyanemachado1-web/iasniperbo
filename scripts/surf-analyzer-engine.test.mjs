import assert from "node:assert/strict";
import {
  SurfAnalyzerEngine,
  filterRoundsForCycleDate,
} from "../src/surf/SurfAnalyzerEngine.ts";

function round(id, result, time = `2026-07-02T10:${String(id).padStart(2, "0")}:00.000Z`) {
  return { id, result, bankerScore: 7, playerScore: 5, time };
}

const strongBankerSurf = [
  round(1, "P"),
  round(2, "B"),
  round(3, "B"),
  round(4, "B"),
  round(5, "P"),
  round(6, "B"),
  round(7, "B"),
  round(8, "B"),
  round(9, "B"),
];

const analysis = SurfAnalyzerEngine.analyze(strongBankerSurf);

assert.equal(analysis.surf_alert, true, "strong banker surf should alert");
assert.equal(analysis.surf_side, "BANKER");
assert.equal(analysis.surf_status, "SURF_AGRESSIVO");
assert.equal(analysis.source, "engine");
assert.ok(analysis.surf_confidence >= 60, `confidence should be >= 60, got ${analysis.surf_confidence}`);
assert.equal(analysis.stretched_count, 4);

const dominantSurf = SurfAnalyzerEngine.analyze([
  round(1, "P"),
  round(2, "B"),
  round(3, "B"),
  round(4, "B"),
  round(5, "B"),
  round(6, "B"),
  round(7, "B"),
]);

assert.equal(dominantSurf.surf_status, "SURF_DOMINANTE");
assert.equal(dominantSurf.surf_alert, true);
assert.ok(dominantSurf.surf_confidence >= 80);

const preSurf = SurfAnalyzerEngine.analyze([round(1, "P"), round(2, "B"), round(3, "B")]);
assert.equal(preSurf.surf_status, "PRE_SURF");
assert.equal(preSurf.surf_alert, false);

const formingSurf = SurfAnalyzerEngine.analyze([round(1, "P"), round(2, "B"), round(3, "B"), round(4, "B")]);
assert.equal(formingSurf.surf_status, "SURF_AGRESSIVO");
assert.equal(formingSurf.surf_alert, true);

const yesterdayStreak = [
  round(1, "B", "2026-07-01T23:50:00.000Z"),
  round(2, "B", "2026-07-01T23:55:00.000Z"),
  round(3, "B", "2026-07-01T23:58:00.000Z"),
  round(4, "B", "2026-07-01T23:59:00.000Z"),
  round(5, "P", "2026-07-02T00:05:00.000Z"),
];
const todayOnly = SurfAnalyzerEngine.analyze(yesterdayStreak, "2026-07-02");
assert.equal(todayOnly.surf_alert, false, "yesterday streak must not carry into new cycle");
assert.equal(filterRoundsForCycleDate(yesterdayStreak, "2026-07-02").length, 1);

console.log("surf-analyzer-engine.test.mjs passed");
