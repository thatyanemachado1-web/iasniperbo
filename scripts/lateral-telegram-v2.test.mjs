import assert from "node:assert/strict";
import {
  TELEGRAM_AUTO_V2_GLOBAL_MODULES,
  buildTelegramAutoV2NotificationKey,
  detectLateralPayingNumbersConfirmedCard,
  detectLateralTiePatternsConfirmedCard,
  probeTelegramAutoV2ModuleCard,
  readDashboardLateralResults,
} from "../src/lib/telegramAutoV2.ts";
import {
  analyzeLateralPayingNumbersEntry,
  analyzeLateralTiePatternEntry,
} from "../src/utils/lateralMotors.ts";

function bead(id, slot, side, value = side === "TIE" ? 6 : 8) {
  return { id: String(id), slot, side, value };
}

function round(id, result = "B", bankerScore = 8, playerScore = 6) {
  return {
    id,
    result,
    bankerScore,
    playerScore,
    time: `12:00:${String(id % 60).padStart(2, "0")}`,
  };
}

const payingSgPlate = Array.from({ length: 18 }, (_, slot) =>
  bead(1000 + slot, slot, slot % 6 === 0 ? "PLAYER" : "BANKER", slot % 6 === 0 ? 7 : 8),
);
payingSgPlate[7] = bead(1007, 7, "PLAYER", 9);
payingSgPlate[13] = bead(1013, 13, "PLAYER", 9);
const payingLatestRound = round(1017, "B");
const payingSgDashboard = {
  rounds: [payingLatestRound],
  bacBoBeadPlate: [...payingSgPlate].reverse(),
};

const exactResults = readDashboardLateralResults(payingSgDashboard);
assert.deepEqual(
  exactResults.map((item) => item.slot),
  Array.from({ length: 18 }, (_, index) => index),
);

const payingSg = detectLateralPayingNumbersConfirmedCard(payingSgDashboard, payingLatestRound);
assert.equal(payingSg.confirmed, true);
assert.equal(payingSg.moduleKey, "lateral_paying_numbers");
assert.equal(payingSg.meta.side, "PLAYER");
assert.equal(payingSg.meta.attempt, "SG");
assert.equal(payingSg.meta.card_source, "dashboard.bacBoBeadPlate");
assert.match(payingSg.signalKey, /^lateral-paying:/);

const payingG1Plate = [...payingSgPlate, bead(1018, 18, "BANKER", 9)];
const payingG1Round = round(1018, "B", 9, 6);
const payingG1 = detectLateralPayingNumbersConfirmedCard(
  { rounds: [payingG1Round], bacBoBeadPlate: payingG1Plate },
  payingG1Round,
);
assert.equal(payingG1.confirmed, true);
assert.equal(payingG1.meta.attempt, "G1");
assert.notEqual(payingG1.signalKey, payingSg.signalKey);

const blockedPlate = Array.from({ length: 26 }, (_, slot) =>
  bead(2000 + slot, slot, "BANKER", 3 + (slot % 9)),
);
blockedPlate[0] = bead(2000, 0, "PLAYER", 11);
blockedPlate[6] = bead(2006, 6, "PLAYER", 8);
blockedPlate[7] = bead(2007, 7, "PLAYER", 9);
blockedPlate[10] = bead(2010, 10, "PLAYER", 11);
blockedPlate[16] = bead(2016, 16, "BANKER", 8);
blockedPlate[17] = bead(2017, 17, "BANKER", 9);
blockedPlate[20] = bead(2020, 20, "PLAYER", 11);
const blockedAnalysis = analyzeLateralPayingNumbersEntry(blockedPlate);
assert.equal(blockedAnalysis.confirmed, false);
assert.equal(blockedAnalysis.reason, "blocked_2_reds");
assert.equal(blockedAnalysis.blocked?.pattern.reds, 2);

const tieSgPlate = Array.from({ length: 12 }, (_, slot) => bead(3000 + slot, slot, "BANKER", 8));
tieSgPlate[0] = bead(3000, 0, "TIE", 6);
const tieLatestRound = round(3011, "B");
const tieSg = detectLateralTiePatternsConfirmedCard(
  { rounds: [tieLatestRound], bacBoBeadPlate: tieSgPlate },
  tieLatestRound,
);
assert.equal(tieSg.confirmed, true);
assert.equal(tieSg.moduleKey, "lateral_tie_patterns");
assert.equal(tieSg.meta.side, "TIE");
assert.equal(tieSg.meta.attempt, "SG");
assert.equal(tieSg.meta.pattern_id, "spaced");
assert.equal(tieSg.meta.first_value, 6);
assert.equal(tieSg.meta.second_value, null);

const tieG1Plate = [...tieSgPlate, bead(3012, 12, "BANKER", 10)];
const tieG1Round = round(3012, "B", 10, 7);
const tieG1 = detectLateralTiePatternsConfirmedCard(
  { rounds: [tieG1Round], bacBoBeadPlate: tieG1Plate },
  tieG1Round,
);
assert.equal(tieG1.confirmed, true);
assert.equal(tieG1.meta.attempt, "G1");
assert.notEqual(tieG1.signalKey, tieSg.signalKey);

const riskPlate = Array.from({ length: 36 }, (_, slot) => bead(4000 + slot, slot, "BANKER", 8));
riskPlate[0] = bead(4000, 0, "TIE", 6);
riskPlate[2] = bead(4002, 2, "TIE", 7);
riskPlate[24] = bead(4024, 24, "TIE", 8);
const tieRisk = analyzeLateralTiePatternEntry(riskPlate);
assert.equal(tieRisk.confirmed, true);
assert.equal(tieRisk.active?.formation.template.id, "spaced");
assert.equal(tieRisk.templateReds >= 2, true);
assert.equal(tieRisk.dryTieRisk, true);

const fallbackRounds = payingSgPlate.map((item, index) =>
  round(
    5000 + index,
    item.side === "PLAYER" ? "P" : item.side === "TIE" ? "T" : "B",
    item.value,
    item.value,
  ),
);
const fallbackProbe = detectLateralPayingNumbersConfirmedCard(
  { rounds: fallbackRounds },
  fallbackRounds.at(-1),
);
assert.equal(fallbackProbe.confirmed, true);
assert.equal(fallbackProbe.meta.card_source, "dashboard.rounds");

assert.equal(TELEGRAM_AUTO_V2_GLOBAL_MODULES.includes("lateral_paying_numbers"), true);
assert.equal(TELEGRAM_AUTO_V2_GLOBAL_MODULES.includes("lateral_tie_patterns"), true);
assert.equal(
  probeTelegramAutoV2ModuleCard(payingSgDashboard, payingLatestRound, "lateral_paying_numbers")
    .moduleKey,
  "lateral_paying_numbers",
);
assert.equal(
  probeTelegramAutoV2ModuleCard(
    { rounds: [tieLatestRound], bacBoBeadPlate: tieSgPlate },
    tieLatestRound,
    "lateral_tie_patterns",
  ).moduleKey,
  "lateral_tie_patterns",
);

const payingDedupe = buildTelegramAutoV2NotificationKey(
  "room-1",
  "lateral_paying_numbers",
  payingSg.signalKey,
  payingSg.roundId,
);
assert.equal(
  payingDedupe,
  buildTelegramAutoV2NotificationKey(
    "room-1",
    "lateral_paying_numbers",
    payingSg.signalKey,
    payingSg.roundId,
  ),
);
assert.notEqual(
  payingDedupe,
  buildTelegramAutoV2NotificationKey(
    "room-1",
    "lateral_tie_patterns",
    tieSg.signalKey,
    tieSg.roundId,
  ),
);

const capped = analyzeLateralPayingNumbersEntry(
  Array.from({ length: 205 }, (_, slot) => bead(6000 + slot, slot, "BANKER", 8)),
);
assert.equal(capped.cycleSize, 200);

console.log("lateral telegram v2 tests passed");
