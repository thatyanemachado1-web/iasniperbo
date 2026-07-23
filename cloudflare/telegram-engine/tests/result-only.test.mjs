import assert from "node:assert/strict";
import test from "node:test";

import { TelegramEngine } from "../src/index.js";

class MemoryStorage {
  constructor(seed = []) {
    this.values = new Map(seed);
    this.alarmAt = null;
  }

  async get(key) {
    return this.values.get(key);
  }

  async put(key, value) {
    this.values.set(key, value);
  }

  async delete(key) {
    return this.values.delete(key);
  }

  async list({ prefix = "" } = {}) {
    return new Map(
      [...this.values]
        .filter(([key]) => key.startsWith(prefix))
        .sort(([left], [right]) => left.localeCompare(right)),
    );
  }

  async getAlarm() {
    return this.alarmAt;
  }

  async setAlarm(value) {
    this.alarmAt = value;
  }
}

function pendingNotification({
  id = "entry-1",
  moduleKey = "paying_numbers",
  entry = "PLAYER",
  roundId = 100,
  galeLimit = 1,
  tieCoverage = galeLimit,
  coverTie = false,
  patternId = "",
  initialAttempt = "",
} = {}) {
  return {
    id,
    type: `module:${moduleKey}`,
    userId: "client@example.com",
    channelId: "room-1",
    roundId,
    status: "sent",
    error: "",
    payloadJson: {
      moduleKey,
      signalKey: `publisher:${moduleKey}:${roundId}:${entry}`,
      signalKind: "entry",
      entrySide: entry,
      entry,
      patternId,
      result: "Aguardando resultado",
      galeLimit,
      tieCoverage,
      coverTie,
      variables: {
        ...(patternId ? { patternId } : {}),
        ...(initialAttempt ? { initialAttempt } : {}),
      },
    },
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function resultOnlyEngine(options = {}, env = {}) {
  const notification = pendingNotification(options);
  const key = `notification:${notification.userId}:${notification.id}`;
  const storage = new MemoryStorage([[key, notification]]);
  const state = { storage };
  const engine = new TelegramEngine(state, env);
  const sent = [];

  engine.getChannel = async () => ({
    id: "room-1",
    userId: "client@example.com",
    isActive: true,
    signalModules: {
      [notification.payloadJson.moduleKey]: {
        enabled: true,
        galeLimit: notification.payloadJson.galeLimit,
        tieCoverage: notification.payloadJson.galeLimit,
        coverTie: notification.payloadJson.coverTie,
      },
    },
  });
  engine.dispatchSignal = async (body) => {
    sent.push(body);
    return Response.json({
      ok: true,
      sent: [{ channelId: "room-1", notificationId: `result-${sent.length}` }],
      blocked: [],
    });
  };

  return { engine, key, sent, storage };
}

async function runResultSnapshot(engine, rounds) {
  const response = await engine.runDashboardResultMonitor({
    source: "test",
    dashboard: { rounds },
  });
  assert.equal(response.status, 200);
  return response.json();
}

function liveSignalEngine() {
  const storage = new MemoryStorage();
  const engine = new TelegramEngine({ storage }, {});
  const channel = {
    id: "room-1",
    userId: "client@example.com",
    chatId: "-1001",
    chatCode: "1001",
    botTokenCipher: "test-cipher",
    isActive: true,
    connectionStatus: "connected",
    signalModules: {
      paying_numbers: {
        enabled: true,
        galeLimit: 1,
        cooldownSeconds: 0,
      },
    },
  };

  engine.channelsForUser = async () => [channel];
  engine.activeChannels = async () => [channel];
  engine.decryptToken = async () => "test-token";

  return { engine, storage, channel };
}

function storedResultEngine({
  moduleKey = "paying_numbers",
  entry = "PLAYER",
  roundId = 100,
  galeLimit = 1,
  tieCoverage = galeLimit,
  currentGaleLimit = galeLimit,
  currentTieCoverage = tieCoverage,
  coverTie = false,
  patternId = "",
  initialAttempt = "",
  templates = {},
  buttons = [],
  buttonLink = "",
} = {}) {
  const notification = pendingNotification({
    moduleKey,
    entry,
    roundId,
    galeLimit,
    tieCoverage,
    coverTie,
    patternId,
    initialAttempt,
  });
  const channel = {
    id: notification.channelId,
    userId: notification.userId,
    chatId: "-1001",
    chatCode: "-1001",
    botTokenCipher: "test-cipher",
    buttonLink,
    isActive: true,
    connectionStatus: "connected",
    signalModules: {
      [moduleKey]: {
        enabled: true,
        galeLimit: currentGaleLimit,
        tieCoverage: currentTieCoverage,
        coverTie,
        cooldownSeconds: 0,
        buttons,
        ...templates,
      },
    },
  };
  const storage = new MemoryStorage([
    [`notification:${notification.userId}:${notification.id}`, notification],
    [`channel:${channel.userId}:${channel.id}`, channel],
  ]);
  const engine = new TelegramEngine({ storage }, {});
  engine.decryptToken = async () => "test-token";
  return { engine, storage, channel, notification };
}

function captureTelegramMessages(t) {
  const originalFetch = globalThis.fetch;
  const payloads = [];
  globalThis.fetch = async (url, init = {}) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\/bot/);
    payloads.push(JSON.parse(String(init.body || "{}")));
    return Response.json({ ok: true, result: { message_id: payloads.length } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  return payloads;
}

function validatorSignalRequest({ patternId, signalKey, roundId = 100, galeLimit = 1 }) {
  return new Request("https://internal.sniperbo/engine/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleKey: "validator",
      signalKey,
      userId: "client@example.com",
      channelId: "room-1",
      roundId,
      entry: "PLAYER",
      result: "Aguardando resultado",
      galeLimit,
      patternId,
      variables: {
        patternId,
        pattern: `Pattern ${patternId}`,
        table: "Bac Bo",
        percentage: "90%",
        roundId,
      },
    }),
  });
}

function signalRequest({
  signalKey = "publisher:paying_numbers:100:PLAYER",
  roundId = 100,
  entry = "PLAYER",
  number = 11,
} = {}) {
  return new Request("https://internal.sniperbo/engine/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleKey: "paying_numbers",
      signalKey,
      userId: "client@example.com",
      channelId: "room-1",
      roundId,
      entry,
      result: "Aguardando resultado",
      variables: { number, roundId },
    }),
  });
}

function finalResultRequest({
  resolvesSignalKey = "publisher:paying_numbers:100:PLAYER",
  signalKey = `${resolvesSignalKey}:result:101:GREEN`,
  roundId = 101,
  finalResult,
} = {}) {
  return new Request("https://internal.sniperbo/engine/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleKey: "paying_numbers",
      signalKey,
      userId: "client@example.com",
      channelId: "room-1",
      roundId,
      resultRoundId: roundId,
      entry: "PLAYER",
      result: "GREEN SG",
      resultStatus: "GREEN",
      resolvesSignalKey,
      ...(finalResult === undefined ? {} : { finalResult }),
      variables: { roundId },
    }),
  });
}

function lateralSignalRequest({ moduleKey, signalKey, roundId, entry, result, variables = {} }) {
  return new Request("https://internal.sniperbo/engine/signal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      moduleKey,
      signalKey,
      userId: "client@example.com",
      channelId: "room-1",
      roundId,
      entry,
      result,
      variables: { roundId, ...variables },
    }),
  });
}

test("result-only sends GREEN SG once and never recreates the entry", async () => {
  const { engine, sent, storage, key } = resultOnlyEngine();
  const rounds = [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
  ];

  const first = await runResultSnapshot(engine, rounds);
  const second = await runResultSnapshot(engine, rounds);

  assert.equal(first.sentCount, 1);
  assert.equal(second.reason, "no_pending_entries");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].result, "GREEN SG");
  assert.match(sent[0].signalKey, /:result:/);
  assert.equal((await storage.get(key)).payloadJson.resultSentAt.length > 0, true);
});

test("result-only emits one G1 notice, then GREEN G1, without duplicate notice", async () => {
  const { engine, sent } = resultOnlyEngine();
  const triggerAndLoss = [
    { id: 100, result: "BANKER" },
    { id: 101, result: "BANKER" },
  ];

  await runResultSnapshot(engine, triggerAndLoss);
  await runResultSnapshot(engine, triggerAndLoss);
  await runResultSnapshot(engine, [...triggerAndLoss, { id: 102, result: "PLAYER" }]);
  await runResultSnapshot(engine, [...triggerAndLoss, { id: 102, result: "PLAYER" }]);

  assert.deepEqual(
    sent.map((item) => item.result),
    ["PROTEÇÃO G1 ATIVA", "GREEN G1"],
  );
});

test("result-only waits for G1 and closes RED once after the second loss", async () => {
  const { engine, sent } = resultOnlyEngine();
  const triggerAndLoss = [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
  ];

  await runResultSnapshot(engine, triggerAndLoss);
  await runResultSnapshot(engine, [...triggerAndLoss, { id: 102, result: "BANKER" }]);
  await runResultSnapshot(engine, [...triggerAndLoss, { id: 102, result: "BANKER" }]);

  assert.deepEqual(
    sent.map((item) => item.result),
    ["PROTEÇÃO G1 ATIVA", "RED"],
  );
});

test("result-only confirms TIE once for the tie module", async () => {
  const { engine, sent } = resultOnlyEngine({
    moduleKey: "ties_only",
    entry: "TIE",
    galeLimit: 1,
  });
  const rounds = [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "TIE", bankerScore: 4, playerScore: 4, tieMultiplier: 10 },
  ];

  await runResultSnapshot(engine, rounds);
  await runResultSnapshot(engine, rounds);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].result, "EMPATE CONFIRMADO");
  assert.equal(sent[0].variables.tieMultiplier, "10x");
});

test("result-only prioritizes the newest entry when old pending history exceeds the batch", async () => {
  const newest = pendingNotification({ id: "aaa-newest", roundId: 900, entry: "PLAYER" });
  newest.updatedAt = new Date().toISOString();
  const seed = [[`notification:${newest.userId}:${newest.id}`, newest]];
  for (let index = 0; index < 205; index += 1) {
    const stale = pendingNotification({
      id: `zzz-stale-${String(index).padStart(3, "0")}`,
      roundId: 100 + index,
    });
    stale.updatedAt = new Date("2026-07-01T00:00:00.000Z").toISOString();
    seed.push([`notification:${stale.userId}:${stale.id}`, stale]);
  }

  const storage = new MemoryStorage(seed);
  const engine = new TelegramEngine({ storage }, {});
  const sent = [];
  engine.getChannel = async (_userId, channelId) => ({
    id: channelId,
    userId: "client@example.com",
    isActive: true,
    signalModules: { paying_numbers: { enabled: true, galeLimit: 1 } },
  });
  engine.dispatchSignal = async (body) => {
    sent.push(body);
    return Response.json({ ok: true, sent: [{ channelId: body.channelId }], blocked: [] });
  };

  await runResultSnapshot(engine, [
    { id: 900, result: "BANKER" },
    { id: 901, result: "PLAYER" },
  ]);

  assert.equal(
    sent.some((item) => item.roundId === 901 && item.result === "GREEN SG"),
    true,
  );
});

test("pending result-only work rearms the fallback alarm in one second", async () => {
  const { engine, storage } = resultOnlyEngine({}, { SNIPER_DASHBOARD_TOKEN: "test-dashboard-token" });
  const startedAt = Date.now();

  const summary = await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
  ]);
  const completedAt = Date.now();

  assert.equal(summary.pendingCount, 1, "the G1 notice leaves the original entry pending");
  assert.equal(Number.isFinite(storage.alarmAt), true);
  assert.equal(storage.alarmAt > startedAt, true);
  assert.equal(storage.alarmAt <= completedAt + 1_100, true, "pending results must retry in about one second");
});

test("legacy dashboard monitor keeps its thirty-second alarm", async () => {
  const storage = new MemoryStorage();
  const engine = new TelegramEngine({ storage }, { TELEGRAM_ENGINE_LEGACY_MONITOR: "1" });
  const startedAt = Date.now();

  await engine.ensureDashboardMonitorAlarm();

  assert.equal(storage.alarmAt >= startedAt + 29_000, true);
  assert.equal(storage.alarmAt <= Date.now() + 31_000, true);
});

test("locked result pushes coalesce the newest snapshot and rearm within one second", async () => {
  const { engine, storage, sent } = resultOnlyEngine();
  await storage.put("result-monitor:lock", Date.now() + 15_000);

  const push = async (dashboard) => {
    const response = await engine.fetch(new Request("https://internal.sniperbo/engine/results", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "test_push", dashboard }),
    }));
    assert.equal(response.status, 200);
    return response.json();
  };

  const first = await push({
    updatedAt: "2026-07-13T12:00:01.000Z",
    rounds: [
      { id: 100, result: "BANKER" },
      { id: 101, result: "PLAYER" },
    ],
  });
  const older = await push({
    updatedAt: "2026-07-13T12:00:00.000Z",
    rounds: [
      { id: 99, result: "BANKER" },
      { id: 100, result: "BANKER" },
    ],
  });
  await push({
    updatedAt: "2026-07-13T12:00:02.000Z",
    rounds: [
      { id: 100, result: "BANKER" },
      { id: 101, result: "PLAYER" },
      { id: 102, result: "BANKER" },
    ],
  });

  assert.equal(first.queued, true);
  assert.equal(first.retryInMs, 1_000);
  assert.equal(older.coalesced, true, "an older arrival must not replace the queued snapshot");
  const queued = await storage.get("result-monitor:queued-snapshot");
  assert.equal(queued.dashboard.rounds.at(-1).id, 102);
  assert.equal(storage.alarmAt <= Date.now() + 1_100, true);

  await storage.delete("result-monitor:lock");
  await engine.runDashboardResultMonitor({ source: "alarm" });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].result, "GREEN SG");
  assert.equal(await storage.get("result-monitor:queued-snapshot"), undefined);
});

test("concurrent identical /engine/signal calls send exactly one Telegram message", async (t) => {
  const { engine } = liveSignalEngine();
  const originalFetch = globalThis.fetch;
  let telegramSends = 0;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /^https:\/\/api\.telegram\.org\/bot/);
    telegramSends += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    return Response.json({ ok: true, result: { message_id: telegramSends } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const [left, right] = await Promise.all([
    engine.fetch(signalRequest()),
    engine.fetch(signalRequest()),
  ]);
  const bodies = await Promise.all([left.json(), right.json()]);

  assert.equal(telegramSends, 1);
  assert.equal(
    bodies.reduce((count, body) => count + body.sent.length, 0),
    1,
  );
  assert.equal(
    bodies.some((body) =>
      body.blocked.some((item) => ["duplicate_signal", "pending_result"].includes(item.reason)),
    ),
    true,
  );
});

test("pending entry blocks the same channel/module until its result is resolved", async (t) => {
  const { engine } = liveSignalEngine();
  const originalFetch = globalThis.fetch;
  let telegramSends = 0;
  globalThis.fetch = async () => {
    telegramSends += 1;
    return Response.json({ ok: true, result: { message_id: telegramSends } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const first = await engine.fetch(signalRequest());
  assert.equal((await first.json()).sent.length, 1);
  assert.equal(telegramSends, 1);

  const blocked = await engine.fetch(
    signalRequest({
      signalKey: "publisher:paying_numbers:101:BANKER",
      roundId: 101,
      entry: "BANKER",
      number: 8,
    }),
  );
  const blockedBody = await blocked.json();
  assert.deepEqual(
    blockedBody.blocked.map((item) => item.reason),
    ["pending_result"],
  );
  assert.equal(telegramSends, 1);

  await runResultSnapshot(engine, [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
  ]);
  assert.equal(telegramSends, 2, "the resolved GREEN SG is sent once");

  const next = await engine.fetch(
    signalRequest({
      signalKey: "publisher:paying_numbers:102:BANKER",
      roundId: 102,
      entry: "BANKER",
      number: 6,
    }),
  );
  assert.equal((await next.json()).sent.length, 1);
  assert.equal(telegramSends, 3);
});

test("direct result with resolvesSignalKey suppresses an orphan without calling Telegram", async (t) => {
  const { engine } = liveSignalEngine();
  const payloads = captureTelegramMessages(t);
  const missingSignalKey = "publisher:paying_numbers:999:PLAYER";

  const response = await engine.fetch(finalResultRequest({
    resolvesSignalKey: missingSignalKey,
    signalKey: `${missingSignalKey}:result:1000:GREEN`,
    roundId: 1000,
    finalResult: true,
  }));
  const body = await response.json();

  assert.equal(body.sent.length, 0);
  assert.deepEqual(body.blocked.map((item) => item.reason), ["missing_pending_entry"]);
  assert.equal(payloads.length, 0);
});

test("direct result with resolvesSignalKey is allowed for its exact pending entry", async (t) => {
  const { engine } = liveSignalEngine();
  const payloads = captureTelegramMessages(t);
  const pendingSignalKey = "publisher:paying_numbers:200:PLAYER";

  const entryResponse = await engine.fetch(signalRequest({
    signalKey: pendingSignalKey,
    roundId: 200,
  }));
  assert.equal((await entryResponse.json()).sent.length, 1);

  const resultResponse = await engine.fetch(finalResultRequest({
    resolvesSignalKey: pendingSignalKey,
    signalKey: `${pendingSignalKey}:result:201:GREEN`,
    roundId: 201,
    finalResult: true,
  }));
  const resultBody = await resultResponse.json();

  assert.equal(resultBody.sent.length, 1);
  assert.equal(resultBody.sent[0].resolvedPendingCount, 1);
  assert.equal(resultBody.blocked.length, 0);
  assert.equal(payloads.length, 2);
});

test("a successfully sent final result closes the matching pending entry before responding", async (t) => {
  const { engine, storage } = liveSignalEngine();
  const payloads = captureTelegramMessages(t);
  const oldSignalKey = "publisher:paying_numbers:100:PLAYER";
  const resultSignalKey = `${oldSignalKey}:result:101:GREEN`;

  assert.equal((await (await engine.fetch(signalRequest({ signalKey: oldSignalKey }))).json()).sent.length, 1);
  const resultResponse = await engine.fetch(finalResultRequest({
    resolvesSignalKey: oldSignalKey,
    signalKey: resultSignalKey,
    finalResult: true,
  }));
  const resultBody = await resultResponse.json();
  assert.equal(resultBody.sent.length, 1);
  assert.equal(resultBody.sent[0].resolvedPendingCount, 1);

  const rows = await storage.list({ prefix: "notification:client@example.com:" });
  const oldEntry = [...rows.values()].find((notification) => notification.payloadJson?.signalKey === oldSignalKey);
  assert.equal(Boolean(oldEntry.payloadJson.resultSentAt), true);
  assert.equal(oldEntry.payloadJson.resultStatus, "GREEN");
  assert.equal(oldEntry.payloadJson.resultRoundId, 101);
  assert.equal(oldEntry.payloadJson.resultSignalKey, resultSignalKey);

  const next = await engine.fetch(signalRequest({
    signalKey: "publisher:paying_numbers:102:BANKER",
    roundId: 102,
    entry: "BANKER",
  }));
  assert.equal((await next.json()).sent.length, 1);
  assert.equal(payloads.length, 3);
});

test("a duplicate final result atomically closes its old entry before the next entry", async (t) => {
  const { engine, storage } = liveSignalEngine();
  const originalFetch = globalThis.fetch;
  let telegramSends = 0;
  globalThis.fetch = async () => {
    telegramSends += 1;
    return Response.json({ ok: true, result: { message_id: telegramSends } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const oldSignalKey = "publisher:paying_numbers:100:PLAYER";
  const resultSignalKey = `${oldSignalKey}:result:101:GREEN`;
  assert.equal((await (await engine.fetch(signalRequest({ signalKey: oldSignalKey }))).json()).sent.length, 1);

  const firstResult = await engine.fetch(finalResultRequest({
    resolvesSignalKey: oldSignalKey,
    signalKey: resultSignalKey,
    finalResult: false,
  }));
  assert.equal((await firstResult.json()).sent.length, 1);

  const rowsBeforeFinal = await storage.list({ prefix: "notification:client@example.com:" });
  const oldEntryBeforeFinal = [...rowsBeforeFinal.values()].find(
    (notification) => notification.payloadJson?.signalKey === oldSignalKey,
  );
  assert.equal(Boolean(oldEntryBeforeFinal.payloadJson.resultSentAt), false, "without finalResult the entry stays pending");

  const stillBlocked = await engine.fetch(signalRequest({
    signalKey: "publisher:paying_numbers:102:BANKER",
    roundId: 102,
    entry: "BANKER",
  }));
  assert.deepEqual((await stillBlocked.json()).blocked.map((item) => item.reason), ["pending_result"]);

  const duplicateFinal = await engine.fetch(finalResultRequest({
    resolvesSignalKey: oldSignalKey,
    signalKey: resultSignalKey,
    finalResult: true,
  }));
  const duplicateBody = await duplicateFinal.json();
  assert.deepEqual(duplicateBody.blocked.map((item) => item.reason), ["duplicate_signal"]);
  assert.equal(duplicateBody.blocked[0].resolvedPendingCount, 1);

  const rowsAfterFinal = await storage.list({ prefix: "notification:client@example.com:" });
  const oldEntryAfterFinal = [...rowsAfterFinal.values()].find(
    (notification) => notification.payloadJson?.signalKey === oldSignalKey,
  );
  assert.equal(Boolean(oldEntryAfterFinal.payloadJson.resultSentAt), true);
  assert.equal(oldEntryAfterFinal.payloadJson.resultStatus, "GREEN");
  assert.equal(oldEntryAfterFinal.payloadJson.resultRoundId, 101);
  assert.equal(oldEntryAfterFinal.payloadJson.resultSignalKey, resultSignalKey);

  const next = await engine.fetch(signalRequest({
    signalKey: "publisher:paying_numbers:102:BANKER",
    roundId: 102,
    entry: "BANKER",
  }));
  assert.equal((await next.json()).sent.length, 1);
  assert.equal(telegramSends, 3, "the duplicate final result is not sent twice and the next entry is released");
});

test("result-only renders customized GREEN SG template", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    templates: {
      greenTemplate: "CUSTOM GREEN {{result}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["CUSTOM GREEN GREEN SG SG"],
  );
});

test("entry keeps saved ENTRADA CONFIRMADA template when optional variables are absent", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.name = "Sala personalizada";
  channel.signalModules.paying_numbers.template = [
    "<b>ENTRADA CONFIRMADA</b>",
    "Rodada: <b>{{round}}</b>",
    "Entrada: {{entry}}",
    "Confianca: {{confidence}}",
    "Status: {{status}}",
  ].join("\n");

  const response = await engine.dispatchSignal({
    userId: channel.userId,
    channelId: channel.id,
    moduleKey: "paying_numbers",
    signalKey: "publisher:paying_numbers:456:PLAYER",
    roundId: 456,
    entry: "PLAYER",
    result: "Aguardando resultado",
    message: "FALLBACK INDEVIDO",
    variables: { status: "<confirmado>&" },
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).sent.length, 1);
  assert.equal(payloads.length, 1);
  assert.match(payloads[0].text, /ENTRADA CONFIRMADA/);
  assert.match(payloads[0].text, /Rodada: <b>456<\/b>/);
  assert.match(payloads[0].text, /Confian(?:c|ç)a:\s*$/mi);
  assert.match(payloads[0].text, /&lt;confirmado&gt;&amp;/);
  assert.doesNotMatch(payloads[0].text, /FALLBACK INDEVIDO|{{\s*confidence\s*}}/);
});

test("preview renders the saved module template and accepts round alias", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, storage, channel } = liveSignalEngine();
  channel.name = "Sala de previa";
  channel.signalModules.paying_numbers.template = [
    "<b>PREVIA DO TEMPLATE SALVO</b>",
    "Sala: {{channel}}",
    "Rodada: {{round}}",
    "Numero: {{number}}",
    "Opcional: {{confidence}}",
  ].join("\n");
  await storage.put(`channel:${channel.userId}:${channel.id}`, channel);

  const response = await engine.previewChannel(channel.userId, {
    channelId: channel.id,
    moduleKey: "paying_numbers",
    round: "R-789",
    entry: "BANKER",
    variables: { number: "<9>" },
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).preview, true);
  assert.equal(payloads.length, 1);
  assert.match(payloads[0].text, /PREVIA DO TEMPLATE SALVO/);
  assert.match(payloads[0].text, /Sala: Sala de previa/);
  assert.match(payloads[0].text, /Rodada: R-789/);
  assert.match(payloads[0].text, /N(?:u|ú)mero: &lt;9&gt;/i);
  assert.match(payloads[0].text, /Opcional:\s*$/m);
});

test("official paying-number result also renders the customized result template", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, storage, channel } = liveSignalEngine();
  channel.signalModules.paying_numbers.greenTemplate = "DIRECT CUSTOM {{result}} {{gale}}";
  await storage.put("dashboard-monitor:paying_numbers:result-baseline-ready", {
    readyAt: new Date().toISOString(),
  });

  const result = await engine.dispatchPayingNumbersOfficialResult(
    {
      confirmed: true,
      signalId: "paying:Bac Bo:result:entry-1:r101:GREEN",
      roundIdNumber: 101,
      entry: "PLAYER",
      label: "GREEN SG",
      protection: "SG",
      status: "GREEN",
      variables: { number: 11 },
    },
    "test",
  );

  assert.equal(result.sentCount, 1);
  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["DIRECT CUSTOM GREEN SG SG"],
  );
});

test("result-only renders customized G1 through G4 notices and GREEN G4", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    galeLimit: 4,
    templates: {
      galeTemplate: "CUSTOM GALE {{gale}} {{result}}",
      greenTemplate: "CUSTOM GREEN {{result}} {{gale}}",
    },
  });
  const rounds = [{ id: 100, result: "PLAYER" }];

  for (let id = 101; id <= 104; id += 1) {
    rounds.push({ id, result: "BANKER" });
    await runResultSnapshot(engine, rounds);
  }
  rounds.push({ id: 105, result: "PLAYER" });
  await runResultSnapshot(engine, rounds);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    [
      "CUSTOM GALE G1 Proteção G1 ATIVA",
      "CUSTOM GALE G2 Proteção G2 ATIVA",
      "CUSTOM GALE G3 Proteção G3 ATIVA",
      "CUSTOM GALE G4 Proteção G4 ATIVA",
      "CUSTOM GREEN GREEN G4 G4",
    ],
  );
});

test("result-only renders customized RED template after configured gale", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    galeLimit: 1,
    templates: {
      galeTemplate: "CUSTOM GALE {{gale}}",
      redTemplate: "CUSTOM RED {{result}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
  ]);
  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
    { id: 102, result: "BANKER" },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["CUSTOM GALE G1", "CUSTOM RED RED G1"],
  );
});

test("result-only renders customized TIE template with multiplier", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    moduleKey: "ties_only",
    entry: "TIE",
    galeLimit: 0,
    tieCoverage: 4,
    templates: {
      tieTemplate: "CUSTOM TIE {{result}} {{tieMultiplier}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "TIE", tieMultiplier: 10 },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["CUSTOM TIE EMPATE CONFIRMADO 10x SG"],
  );
});

test("tie result keeps entry-time tieCoverage snapshot", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    moduleKey: "ties_only",
    entry: "TIE",
    tieCoverage: 1,
    currentTieCoverage: 4,
    templates: {
      galeTemplate: "SNAPSHOT GALE {{gale}}",
      redTemplate: "SNAPSHOT RED {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
  ]);
  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
    { id: 102, result: "BANKER" },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["SNAPSHOT GALE G1", "SNAPSHOT RED G1"],
  );
});

test("all module buttons OFF suppresses global buttonLink fallback", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.buttonLink = "https://sniperbo.com/app";
  channel.signalModules.paying_numbers.buttons = Array.from({ length: 4 }, () => ({
    enabled: false,
    label: "",
    url: "",
  }));

  const response = await engine.fetch(signalRequest());
  assert.equal((await response.json()).sent.length, 1);
  assert.equal(payloads.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(payloads[0], "reply_markup"), false);
});

test("all module buttons OFF also suppresses buttons on result messages", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    buttonLink: "https://sniperbo.com/app",
    buttons: Array.from({ length: 4 }, () => ({ enabled: false, label: "", url: "" })),
    templates: { greenTemplate: "RESULT WITHOUT BUTTON {{result}}" },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
  ]);

  assert.equal(payloads.length, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(payloads[0], "reply_markup"), false);
});

test("module OFF blocks entry and does not call Telegram", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.signalModules.paying_numbers.enabled = false;

  const response = await engine.fetch(signalRequest());
  const body = await response.json();
  assert.deepEqual(
    body.blocked.map((item) => item.reason),
    ["module_inactive"],
  );
  assert.equal(payloads.length, 0);
});

test("module OFF blocks pending results and does not call Telegram", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = storedResultEngine();
  channel.signalModules.paying_numbers.enabled = false;

  const summary = await engine.dispatchPendingOfficialModuleResults(
    {
      rounds: [
        { id: 100, result: "BANKER" },
        { id: 101, result: "PLAYER" },
      ],
    },
    "test",
  );

  assert.equal(summary.sentCount, 0);
  assert.equal(summary.blockedCount, 1);
  assert.equal(summary.details[0]?.reason, "module_inactive");
  assert.equal(payloads.length, 0);
});

test("validator pending entries are isolated by patternId", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.signalModules = {
    validator: {
      enabled: true,
      galeLimit: 1,
      cooldownSeconds: 0,
    },
  };

  const first = await engine.fetch(
    validatorSignalRequest({
      patternId: "pattern-a",
      signalKey: "publisher:validator:pattern-a:100",
    }),
  );
  const second = await engine.fetch(
    validatorSignalRequest({
      patternId: "pattern-b",
      signalKey: "publisher:validator:pattern-b:100",
    }),
  );
  const duplicatePattern = await engine.fetch(
    validatorSignalRequest({
      patternId: "pattern-a",
      signalKey: "publisher:validator:pattern-a:101",
      roundId: 101,
    }),
  );

  assert.equal((await first.json()).sent.length, 1);
  assert.equal((await second.json()).sent.length, 1);
  assert.deepEqual(
    (await duplicatePattern.json()).blocked.map((item) => item.reason),
    ["pending_result"],
  );
  assert.equal(payloads.length, 2);
});

test("validator entry persists body galeLimit snapshot", async (t) => {
  captureTelegramMessages(t);
  const { engine, storage, channel } = liveSignalEngine();
  channel.signalModules = {
    validator: {
      enabled: true,
      galeLimit: 4,
      cooldownSeconds: 0,
    },
  };

  const response = await engine.fetch(
    validatorSignalRequest({
      patternId: "pattern-snapshot",
      signalKey: "publisher:validator:pattern-snapshot:100",
      galeLimit: 1,
    }),
  );
  assert.equal((await response.json()).sent.length, 1);
  const notifications = await storage.list({ prefix: "notification:client@example.com:" });
  const entry = [...notifications.values()].find(
    (item) => item.payloadJson?.signalKind === "entry",
  );
  assert.equal(entry?.payloadJson?.patternId, "pattern-snapshot");
  assert.equal(entry?.payloadJson?.galeLimit, 1);
});

test("dedupe cleanup removes expired timestamped keys and legacy recent buckets safely", async () => {
  const now = Date.now();
  const oldRecentBucket = Math.floor((now - 60 * 60 * 1000) / 30000);
  const storage = new MemoryStorage([
    ["sent:user:room:module:ENTRY:old", now - 8 * 24 * 60 * 60 * 1000],
    ["sent:user:room:module:ENTRY:new", now - 1000],
    ["sent-entry:user:room:module:ENTRY:100:PLAYER", true],
    [`sent-recent:user:room:${oldRecentBucket}:hash`, true],
  ]);
  const engine = new TelegramEngine({ storage }, {});

  const summary = await engine.purgeExpiredDedupeState(now);

  assert.equal(summary.deleted, 2);
  assert.equal(await storage.get("sent:user:room:module:ENTRY:old"), undefined);
  assert.equal(await storage.get(`sent-recent:user:room:${oldRecentBucket}:hash`), undefined);
  assert.equal((await storage.get("sent:user:room:module:ENTRY:new")) > 0, true);
  assert.equal(await storage.get("sent-entry:user:room:module:ENTRY:100:PLAYER"), true);
});

test("legacy rooms keep both lateral modules OFF until explicitly enabled", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.signalModules = {
    paying_numbers: { enabled: true, galeLimit: 1, cooldownSeconds: 0 },
  };

  for (const [index, moduleKey] of ["lateral_paying_numbers", "lateral_tie_patterns"].entries()) {
    const response = await engine.fetch(
      lateralSignalRequest({
        moduleKey,
        signalKey: `publisher:${moduleKey}:result:${700 + index}`,
        roundId: 700 + index,
        entry: moduleKey === "lateral_tie_patterns" ? "TIE" : "PLAYER",
        result: moduleKey === "lateral_tie_patterns" ? "TIE" : "PLAYER",
      }),
    );
    const body = await response.json();
    assert.deepEqual(
      body.blocked.map((item) => item.reason),
      ["module_inactive"],
    );
  }

  assert.equal(payloads.length, 0);
});

test("lateral paying-number module renders custom PLAYER, BANKER and TIE results", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.signalModules = {
    lateral_paying_numbers: {
      enabled: true,
      entryType: "AUTO",
      galeLimit: 1,
      cooldownSeconds: 0,
      greenTemplate: "LATERAL PAY {{result}} {{entryLabel}} {{number}}",
      tieTemplate: "LATERAL TIE {{result}} {{entryLabel}} {{tieMultiplier}}",
    },
  };

  const cases = [
    { entry: "PLAYER", result: "PLAYER", number: 7 },
    { entry: "BANKER", result: "BANKER", number: 8 },
    { entry: "TIE", result: "TIE", number: 6, tieMultiplier: "10x" },
  ];
  for (const [index, item] of cases.entries()) {
    const response = await engine.fetch(
      lateralSignalRequest({
        moduleKey: "lateral_paying_numbers",
        signalKey: `publisher:lateral_paying_numbers:result:${710 + index}:${item.result}`,
        roundId: 710 + index,
        entry: item.entry,
        result: item.result,
        variables: { number: item.number, tieMultiplier: item.tieMultiplier || "" },
      }),
    );
    assert.equal((await response.json()).sent.length, 1);
  }

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["LATERAL PAY PLAYER Player 7", "LATERAL PAY BANKER Banker 8", "LATERAL TIE TIE Tie 10x"],
  );
});

test("lateral tie-pattern module accepts TIE and renders its custom template", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine, channel } = liveSignalEngine();
  channel.signalModules = {
    lateral_tie_patterns: {
      enabled: true,
      cooldownSeconds: 0,
      tieTemplate: "EMPATE LATERAL {{result}} {{entryLabel}} {{pattern}} {{tieMultiplier}}",
    },
  };

  const response = await engine.fetch(
    lateralSignalRequest({
      moduleKey: "lateral_tie_patterns",
      signalKey: "publisher:lateral_tie_patterns:result:720:TIE",
      roundId: 720,
      entry: "TIE",
      result: "TIE",
      variables: { pattern: "cobrinha", tieMultiplier: "25x" },
    }),
  );

  assert.equal((await response.json()).sent.length, 1);
  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["EMPATE LATERAL TIE Tie cobrinha 25x"],
  );
});

test("pending lateral tie entry resolves as a customized confirmed TIE", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    moduleKey: "lateral_tie_patterns",
    entry: "TIE",
    galeLimit: 1,
    tieCoverage: 1,
    templates: {
      tieTemplate: "PENDING EMPATE {{result}} {{tieMultiplier}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "TIE", tieMultiplier: 88 },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["PENDING EMPATE EMPATE CONFIRMADO 88x SG"],
  );
});

test("lateral paying entry started at G1 uses only the next round and closes GREEN G1", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    moduleKey: "lateral_paying_numbers",
    entry: "PLAYER",
    galeLimit: 1,
    initialAttempt: "G1",
    templates: {
      galeTemplate: "UNEXPECTED GALE NOTICE {{gale}}",
      greenTemplate: "STARTED G1 {{result}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
  ]);
  await runResultSnapshot(engine, [
    { id: 100, result: "BANKER" },
    { id: 101, result: "PLAYER" },
    { id: 102, result: "BANKER" },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["STARTED G1 GREEN G1 G1"],
  );
});

test("lateral tie entry started at G1 closes RED on the next round without another gale", async (t) => {
  const payloads = captureTelegramMessages(t);
  const { engine } = storedResultEngine({
    moduleKey: "lateral_tie_patterns",
    entry: "TIE",
    galeLimit: 1,
    tieCoverage: 1,
    initialAttempt: "G1",
    templates: {
      galeTemplate: "UNEXPECTED GALE NOTICE {{gale}}",
      redTemplate: "STARTED G1 {{result}} {{gale}}",
    },
  });

  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
  ]);
  await runResultSnapshot(engine, [
    { id: 100, result: "PLAYER" },
    { id: 101, result: "BANKER" },
    { id: 102, result: "TIE", tieMultiplier: 10 },
  ]);

  assert.deepEqual(
    payloads.map((payload) => payload.text),
    ["STARTED G1 RED G1"],
  );
});
