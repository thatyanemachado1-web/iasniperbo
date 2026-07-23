import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { NeuralValidatorEngine } from "../src/neuralValidator/NeuralValidatorEngine.ts";

const engine = new NeuralValidatorEngine();
const pattern = [
  { side: "B", score: 2 },
  { side: "P", score: 3 },
];

function round(id, result, bankerScore, playerScore) {
  return { id, result, bankerScore, playerScore, time: `10:${String(id).padStart(2, "0")}` };
}

function validateWinAt(gale) {
  const rounds = [
    round(1, "B", 2, 1),
    round(2, "P", 1, 3),
    ...Array.from({ length: gale }, (_, index) => round(3 + index, "P", 1, 5 + index)),
    round(3 + gale, "B", 8, 2),
  ];
  return engine.validatePattern(rounds, pattern, {
    entryType: "BANKER",
    galeLimit: gale,
    tieProtection: false,
    historySize: 100,
  });
}

for (const [gale, status, counter] of [
  [0, "GREEN_SG", "sgWins"],
  [1, "GREEN_G1", "g1Wins"],
  [2, "GREEN_G2", "g2Wins"],
  [3, "GREEN_G3", "g3Wins"],
  [4, "GREEN_G4", "g4Wins"],
]) {
  const result = validateWinAt(gale);
  assert.equal(result.totalValidated, 1, `G${gale} must count one validated signal`);
  assert.equal(result[counter], 1, `${status} must increment ${counter}`);
  assert.equal(result.details[0]?.status, status);
  assert.equal(result.details[0]?.galeUsed, gale);
  assert.equal(result.accuracy, 100);
  assert.equal(result.galeAccuracy, 100);
}

const redAtG4 = engine.validatePattern(
  [
    round(1, "B", 2, 1),
    round(2, "P", 1, 3),
    ...Array.from({ length: 5 }, (_, index) => round(3 + index, "P", 1, 5 + index)),
  ],
  pattern,
  { entryType: "BANKER", galeLimit: 4, tieProtection: false, historySize: 100 },
);
assert.equal(redAtG4.totalValidated, 1);
assert.equal(redAtG4.losses, 1);
assert.equal(redAtG4.details[0]?.status, "RED");
assert.equal(redAtG4.details[0]?.galeUsed, 4);
assert.equal(redAtG4.accuracy, 0);

const runtimeClampedAtG4 = engine.validatePattern(
  [
    round(1, "B", 2, 1),
    round(2, "P", 1, 3),
    ...Array.from({ length: 4 }, (_, index) => round(3 + index, "P", 1, 5 + index)),
    round(7, "B", 9, 1),
  ],
  pattern,
  { entryType: "BANKER", galeLimit: 99, tieProtection: false, historySize: 100 },
);
assert.equal(runtimeClampedAtG4.g4Wins, 1);
assert.equal(runtimeClampedAtG4.details[0]?.status, "GREEN_G4");

const serverSource = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
const analyzingStart = serverSource.indexOf("function buildServerValidatorAnalyzingMessage");
const analyzingEnd = serverSource.indexOf("function validatorEntrySide", analyzingStart);
const analyzingSource = serverSource.slice(analyzingStart, analyzingEnd);
assert.ok(analyzingStart >= 0 && analyzingEnd > analyzingStart, "analyzing builder must exist");
assert.ok(
  analyzingSource.indexOf("moduleConfig.analyzingTemplate") >= 0 &&
    analyzingSource.indexOf("moduleConfig.analyzingTemplate") < analyzingSource.indexOf("channel.templates.analyzing"),
  "validator module analyzingTemplate must take precedence over the channel fallback",
);
assert.match(analyzingSource, /DEFAULT_VALIDATOR_MESSAGE_TEMPLATES\.analyzing/);

console.log("neural-validator SG..G4 tests passed");
