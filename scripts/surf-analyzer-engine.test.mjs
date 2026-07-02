import assert from "node:assert/strict";
import { SurfAnalyzerEngine } from "../src/surf/SurfAnalyzerEngine.ts";

function round(id, result) {
  return { id, result, bankerScore: 7, playerScore: 5, time: `2026-07-02T10:${String(id).padStart(2, "0")}:00.000Z` };
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

const merged = SurfAnalyzerEngine.mergeWithIncoming(analysis, {
  surf_alert: false,
  surf_phase: "SEM_RISCO",
  surf_side: "NONE",
  surf_confidence: 0,
  surf_risk: 0,
  stretched_count: 0,
  correction_count: 0,
  reason: "stale publisher",
  panels: {
    big_road: "Aguardando.",
    big_eye_boy: "Aguardando.",
    small_road: "Aguardando.",
    cockroach_pig: "Aguardando.",
  },
});

assert.equal(merged.source, "engine");
assert.equal(merged.surf_alert, true);

console.log("surf-analyzer-engine.test.mjs passed");
