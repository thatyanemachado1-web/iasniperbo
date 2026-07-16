import assert from "node:assert/strict";
import {
  LATERAL_RED_LIMIT,
  HORIZONTAL_TIE_ROUND_GAP,
  canProjectHorizontalTieCampaign,
  canOpenLateralEntry,
  getTieLateralRiskState,
  horizontalTieEntryIndexes,
  horizontalTieCampaignResolved,
  isHorizontalTieFifthHouseProjection,
  isHorizontalTieRepeatProjection,
  isLateralPatternBlocked,
  registerLateralResolution,
} from "../src/utils/lateralMotors.ts";

assert.equal(LATERAL_RED_LIMIT, 2);
assert.equal(isLateralPatternBlocked(0), false);
assert.equal(isLateralPatternBlocked(1), false);
assert.equal(isLateralPatternBlocked(2), true);
assert.equal(isLateralPatternBlocked(3), true);

assert.equal(canOpenLateralEntry(2, 0), true);
assert.equal(canOpenLateralEntry(2, 1), true);
assert.equal(canOpenLateralEntry(2, 2), false);
assert.equal(canOpenLateralEntry(20, 3), false);

assert.deepEqual(getTieLateralRiskState(0), { dryTieRisk: false, blocked: false });
assert.deepEqual(getTieLateralRiskState(1), { dryTieRisk: false, blocked: false });
assert.deepEqual(getTieLateralRiskState(2), { dryTieRisk: true, blocked: false });
assert.deepEqual(getTieLateralRiskState(8), { dryTieRisk: true, blocked: false });

assert.equal(HORIZONTAL_TIE_ROUND_GAP, 24);
assert.deepEqual(horizontalTieEntryIndexes(3), { sg: 27, g1: 28 });
assert.deepEqual(horizontalTieEntryIndexes(4), { sg: 28, g1: 29 });
assert.deepEqual(horizontalTieEntryIndexes(15), { sg: 39, g1: 40 });
assert.deepEqual(horizontalTieEntryIndexes(16), { sg: 40, g1: 41 });
assert.deepEqual(horizontalTieEntryIndexes(0), { sg: 24, g1: 25 });
assert.deepEqual(horizontalTieEntryIndexes(1), { sg: 25, g1: 26 });
assert.deepEqual(horizontalTieEntryIndexes(2), { sg: 26, g1: 27 });
assert.deepEqual(horizontalTieEntryIndexes(5), { sg: 29, g1: 30 });
assert.equal(horizontalTieEntryIndexes(-1), null);
assert.equal(horizontalTieEntryIndexes(1.5), null);

assert.equal(isHorizontalTieFifthHouseProjection(3, 9), false);
assert.equal(isHorizontalTieFifthHouseProjection(3, 15), false);
assert.equal(isHorizontalTieFifthHouseProjection(3, 21), false);
assert.equal(isHorizontalTieFifthHouseProjection(3, 27), true);
assert.equal(isHorizontalTieFifthHouseProjection(4, 28), true);
assert.equal(isHorizontalTieFifthHouseProjection(4, 29), false);

assert.equal(isHorizontalTieRepeatProjection(3, 21), false);
assert.equal(isHorizontalTieRepeatProjection(3, 27), true);
assert.equal(isHorizontalTieRepeatProjection(3, 33), true);
assert.equal(isHorizontalTieRepeatProjection(3, 39), true);
assert.equal(isHorizontalTieRepeatProjection(3, 34), false);
assert.equal(isHorizontalTieRepeatProjection(5, 29), true);
assert.equal(isHorizontalTieRepeatProjection(5, 35), true);

const repeatedRedSides = new Map([
  [24, "BANKER"],
  [25, "PLAYER"],
]);
assert.equal(
  horizontalTieCampaignResolved(0, 24, (slot) => repeatedRedSides.get(slot)),
  false,
);
assert.equal(
  horizontalTieCampaignResolved(0, 30, (slot) => repeatedRedSides.get(slot)),
  false,
);
assert.equal(
  canProjectHorizontalTieCampaign(0, 24, (slot) => repeatedRedSides.get(slot)),
  true,
);
assert.equal(
  canProjectHorizontalTieCampaign(0, 30, (slot) => repeatedRedSides.get(slot)),
  true,
);

const stoppedAtSgSides = new Map(repeatedRedSides).set(30, "TIE");
assert.equal(
  horizontalTieCampaignResolved(0, 36, (slot) => stoppedAtSgSides.get(slot)),
  true,
);
assert.equal(
  canProjectHorizontalTieCampaign(0, 36, (slot) => stoppedAtSgSides.get(slot)),
  false,
);

const stoppedAtG1Sides = new Map(repeatedRedSides).set(30, "BANKER").set(31, "TIE");
assert.equal(
  horizontalTieCampaignResolved(0, 36, (slot) => stoppedAtG1Sides.get(slot)),
  true,
);
assert.equal(
  canProjectHorizontalTieCampaign(0, 36, (slot) => stoppedAtG1Sides.get(slot)),
  false,
);

const repeatedTwiceSides = new Map(repeatedRedSides).set(30, "BANKER").set(31, "PLAYER");
assert.equal(
  horizontalTieCampaignResolved(0, 36, (slot) => repeatedTwiceSides.get(slot)),
  false,
);
assert.equal(
  canProjectHorizontalTieCampaign(0, 36, (slot) => repeatedTwiceSides.get(slot)),
  true,
);

const missingG1Sides = new Map([[24, "BANKER"]]);
assert.equal(
  canProjectHorizontalTieCampaign(0, 30, (slot) => missingG1Sides.get(slot)),
  false,
);

const missingSecondAttemptSides = new Map(repeatedRedSides).set(30, "PLAYER");
assert.equal(
  canProjectHorizontalTieCampaign(0, 36, (slot) => missingSecondAttemptSides.get(slot)),
  false,
);

let lockedPattern = { sg: 0, g1: 0, ties: 0, reds: 0, samples: 0 };
lockedPattern = registerLateralResolution(lockedPattern, "RED");
assert.deepEqual(lockedPattern, { sg: 0, g1: 0, ties: 0, reds: 1, samples: 1 });
lockedPattern = registerLateralResolution(lockedPattern, "RED");
assert.deepEqual(lockedPattern, { sg: 0, g1: 0, ties: 0, reds: 2, samples: 2 });

const afterBlockedSg = registerLateralResolution(lockedPattern, "SG");
const afterBlockedG1 = registerLateralResolution(lockedPattern, "G1");
const afterThirdRed = registerLateralResolution(lockedPattern, "RED");
assert.deepEqual(afterBlockedSg, lockedPattern);
assert.deepEqual(afterBlockedG1, lockedPattern);
assert.deepEqual(afterThirdRed, lockedPattern);

let independentPattern = { sg: 0, g1: 0, ties: 0, reds: 0, samples: 0 };
independentPattern = registerLateralResolution(independentPattern, "TIE");
independentPattern = registerLateralResolution(independentPattern, "SG");
independentPattern = registerLateralResolution(independentPattern, "G1");
assert.deepEqual(independentPattern, { sg: 1, g1: 1, ties: 1, reds: 0, samples: 3 });
assert.equal(
  canOpenLateralEntry(independentPattern.sg + independentPattern.g1, independentPattern.reds),
  true,
);

console.log("lateral motors: RED lock and dry tie risk tests passed");
