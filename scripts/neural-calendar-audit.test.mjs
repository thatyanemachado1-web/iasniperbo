import assert from "node:assert/strict";
import {
  calendarMetricFromCounts,
  calendarAccuracyMessage,
  calendarResultEventFromPersistentResult,
  calendarResultEventsFromLegacyEngineEvent,
  calendarSampleStatus,
  classifyCalendarAccuracy,
  persistCalendarResultEvents,
  selectDailyVisionBestModule,
} from "../src/lib/neuralCalendarAudit.ts";
import { classifyMinuteHeat } from "../src/utils/minuteHeatEngine.ts";

assert.equal(classifyCalendarAccuracy(89, 10), "muito_pagante");
assert.equal(classifyCalendarAccuracy(88.99, 10), "operavel");
assert.equal(classifyCalendarAccuracy(87.99, 10), "perigoso");
assert.equal(classifyCalendarAccuracy(100, 2), "sem_amostra");
assert.equal(calendarAccuracyMessage("muito_pagante"), "Muito bom para operar");
assert.equal(calendarAccuracyMessage("operavel"), "Operável");
assert.equal(calendarAccuracyMessage("perigoso"), "Perigoso");
assert.equal(calendarSampleStatus(2), "amostra_baixa");
assert.equal(calendarSampleStatus(7), "em_formacao");
assert.equal(classifyMinuteHeat(89, 10, 3), "quente");
assert.equal(classifyMinuteHeat(88.99, 10, 3), "operavel");
assert.equal(classifyMinuteHeat(87.99, 10, 3), "frio");
assert.equal(classifyMinuteHeat(100, 2, 3), "sem_amostra");

const weighted = calendarMetricFromCounts(16, 4);
assert.equal(weighted.completedEntries, 20);
assert.equal(weighted.accuracy, 80);

const baseResult = {
  resultId: "result-1",
  resultType: "EMPATE",
  createdAt: "2026-07-14T20:00:00.000Z",
  payload: JSON.stringify({ entryAt: "2026-07-14T19:59:00.000Z" }),
};
const neutralTie = calendarResultEventFromPersistentResult({
  ...baseResult,
  moduleKey: "LEITURA_NEURAL_NUMERO_PAGANTE",
});
const positiveTie = calendarResultEventFromPersistentResult({
  ...baseResult,
  resultId: "result-2",
  moduleKey: "RADAR_DE_EMPATE",
});
assert.equal(neutralTie?.outcomeClass, "NEUTRAL");
assert.equal(positiveTie?.outcomeClass, "GREEN");

const canonicalSg = calendarResultEventFromPersistentResult({
  moduleKey: "LEITURA_NEURAL_NUMERO_PAGANTE",
  resultId: "LEITURA_NEURAL_NUMERO_PAGANTE:signal-10:100:sg:100:GREEN:no-tie",
  signalId: "signal-10:100:sg",
  roundId: "100",
  resultType: "GREEN",
  attempt: "SG",
  createdAt: "2026-07-14T20:00:00.000Z",
});
const contradictoryG1 = calendarResultEventFromPersistentResult({
  moduleKey: "LEITURA_NEURAL_NUMERO_PAGANTE",
  resultId: "LEITURA_NEURAL_NUMERO_PAGANTE:signal-10:100:sg:100:GREEN_G1:no-tie",
  signalId: "signal-10:100:sg",
  roundId: "100",
  resultType: "GREEN_G1",
  attempt: "G1",
  createdAt: "2026-07-14T20:00:00.000Z",
});
assert.equal(canonicalSg?.eventKey, "neural_pagante:signal-10:100:sg:100");
assert.equal(contradictoryG1, null);

const legacyExpanded = calendarResultEventsFromLegacyEngineEvent({
  event_key: "legacy-batch-1",
  engine_key: "surf_analyzer",
  outcome: "green",
  greens: 3,
  reds: 2,
  ties: 1,
  occurred_at: "2026-07-10T20:00:00.000Z",
});
assert.equal(legacyExpanded.length, 6);
assert.equal(legacyExpanded.filter((event) => event.outcomeClass === "GREEN").length, 3);
assert.equal(legacyExpanded.filter((event) => event.outcomeClass === "RED").length, 2);
assert.equal(legacyExpanded.filter((event) => event.outcomeClass === "NEUTRAL").length, 1);

const weakPerfect = {
  id: "weak-perfect",
  consistencyScore: 100,
  windows: { today: { completedEntries: 2 } },
};
const strongConsistent = {
  id: "strong-consistent",
  consistencyScore: 92,
  windows: { today: { completedEntries: 25 } },
};
assert.equal(selectDailyVisionBestModule([weakPerfect, strongConsistent])?.id, "strong-consistent");

let persistedStatements = 0;
const fakeDb = {
  prepare() {
    const statement = {
      bind() {
        return statement;
      },
      async run() {
        persistedStatements += 1;
      },
    };
    return statement;
  },
};
const duplicate = positiveTie;
assert.ok(duplicate);
const stored = await persistCalendarResultEvents(fakeDb, [duplicate, duplicate]);
assert.equal(stored, 1);
assert.equal(persistedStatements, 1);

console.log("Neural Calendar audit rules: OK");
