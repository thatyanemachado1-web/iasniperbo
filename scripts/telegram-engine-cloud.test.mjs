import assert from "node:assert/strict";
import { TelegramEngine } from "../cloudflare/telegram-engine/src/index.js";

class MemoryStorage {
  constructor() {
    this.rows = new Map();
  }

  async get(key) {
    return this.rows.get(key);
  }

  async put(key, value) {
    this.rows.set(key, value);
  }

  async delete(key) {
    this.rows.delete(key);
  }

  async list(options = {}) {
    const prefix = String(options.prefix || "");
    return new Map([...this.rows.entries()].filter(([key]) => !prefix || key.startsWith(prefix)));
  }
}

const originalFetch = globalThis.fetch;
const sentMessages = [];
let dashboardPayload = null;
globalThis.fetch = async (url, init = {}) => {
  const endpoint = String(url);
  if (endpoint === "https://dashboard.test/dashboard" && dashboardPayload) {
    return new Response(JSON.stringify(dashboardPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  if (!endpoint.includes("api.telegram.org")) {
    return originalFetch(url, init);
  }

  const payload = JSON.parse(String(init.body || "{}"));
  sentMessages.push({ endpoint, payload });
  return new Response(JSON.stringify({ ok: true, result: { message_id: sentMessages.length } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

try {
  const env = {
    ENGINE_API_SECRET: "test-secret",
    TOKEN_ENCRYPTION_KEY: "test-token-key",
    TELEGRAM_ENGINE_LEGACY_MONITOR: "1",
    SNIPER_DASHBOARD_URL: "https://dashboard.test/dashboard",
    SNIPER_DASHBOARD_TOKEN: "test-dashboard-token",
  };
  const engine = new TelegramEngine({ storage: new MemoryStorage() }, env);
  const userId = "cliente.telegram@example.com";
  const botToken = "123456:test-token";
  const chatId = "-1001234567890";

  const validation = await engine.validateChannel(userId, {
    bot_token: botToken,
    telegram_chat_id: chatId,
  });
  assert.equal(validation.status, 200);
  const validationBody = await validation.json();
  assert.equal(validationBody.ok, true);
  assert.ok(validationBody.validationCode);

  const save = await engine.saveChannel(
    userId,
    {
      id: "canal-1",
      name: "Grupo validado",
      bot_token: botToken,
      group_id: chatId,
      button_url: "https://sniperbo.com/app/validador",
      signalModules: {
        ai_patterns: { enabled: true, cooldownSeconds: 0 },
        paying_numbers: {
          enabled: true,
          cooldownSeconds: 0,
          galeTemplate: "CUSTOM INTERMEDIARIO {{result}} | {{number}} | {{gale}}",
          greenTemplate: "CUSTOM RESULTADO {{result}} | {{number}} | {{gale}}",
        },
        surf_alert: { enabled: true, cooldownSeconds: 0 },
        ties_only: { enabled: true, cooldownSeconds: 0 },
        validator: { enabled: true, cooldownSeconds: 0 },
      },
    },
    validationBody.validationCode,
  );
  assert.equal(save.status, 201);
  const savedBody = await save.json();
  assert.equal(savedBody.channel.chatId, chatId);
  assert.equal(savedBody.channel.connectionStatus, "connected");
  assert.equal(savedBody.channel.signalModules.ai_patterns.enabled, true);

  const patch = await engine.patchChannel(userId, "canal-1", {
    chat_id: chatId,
    signalModules: {
      ...savedBody.channel.signalModules,
      surf_alert: { ...savedBody.channel.signalModules.surf_alert, enabled: false },
    },
  });
  assert.equal(patch.status, 200);
  const patchedBody = await patch.json();
  assert.equal(patchedBody.channel.signalModules.surf_alert.enabled, false);

  const list = await engine.publicChannelsForUser(userId);
  assert.equal(list.length, 1);
  assert.equal(list[0].signalModules.surf_alert.enabled, false);
  assert.equal(list[0].signalModules.paying_numbers.enabled, true);

  const beforeDisabledModule = sentMessages.length;
  const disabledModule = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "surf_alert",
    signalKey: "surf-disabled-entry",
    roundId: 98,
    entry: "BANKER",
    result: "Aguardando resultado",
  });
  const disabledModuleBody = await disabledModule.json();
  assert.equal(disabledModuleBody.sent.length, 0);
  assert.equal(disabledModuleBody.blocked[0].reason, "module_inactive");
  assert.equal(sentMessages.length, beforeDisabledModule);

  const blockedGlobal = await engine.fetch(new Request("https://internal/engine/signal", {
    method: "POST",
    body: JSON.stringify({
      userId,
      channelId: "canal-1",
      moduleKey: "paying_numbers",
      signalKey: "parallel-paying-entry",
      roundId: 99,
      entry: "PLAYER",
      result: "Aguardando resultado",
    }),
  }));
  assert.equal(blockedGlobal.status, 409);
  assert.equal((await blockedGlobal.json()).error, "global_modules_site_first_only");

  const validatorViaHttp = await engine.fetch(new Request("https://internal/engine/signal", {
    method: "POST",
    body: JSON.stringify({
      userId,
      channelId: "canal-1",
      moduleKey: "validator",
      signalKey: "validator-http-result",
      roundId: 100,
      entry: "PLAYER",
      result: "Green",
      variables: { pattern: "B P B" },
    }),
  }));
  assert.equal(validatorViaHttp.status, 200);
  assert.equal((await validatorViaHttp.json()).sent.length, 1);

  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...list[0].signalModules,
      surf_alert: { ...list[0].signalModules.surf_alert, enabled: true },
    },
  });

  const cases = [
    { moduleKey: "ai_patterns", signalKey: "ai:entry:1", roundId: 101, result: "Aguardando resultado", entry: "BANKER" },
    { moduleKey: "paying_numbers", signalKey: "paying:result:2", roundId: 102, result: "Green", entry: "PLAYER" },
    { moduleKey: "surf_alert", signalKey: "surf:result:3", roundId: 103, result: "Red", entry: "BANKER" },
    {
      moduleKey: "ties_only",
      signalKey: "ties:result:4",
      roundId: 104,
      result: "Empate 8x",
      entry: "TIE",
      variables: { tieMultiplier: "8x" },
    },
    { moduleKey: "validator", signalKey: "validator:result:5", roundId: 105, result: "Red", entry: "PLAYER" },
  ];

  for (const item of cases) {
    const response = await engine.dispatchSignal({
      userId,
      channelId: "canal-1",
      moduleKey: item.moduleKey,
      signalKey: item.signalKey,
      roundId: item.roundId,
      entry: item.entry,
      result: item.result,
      variables: {
        table: "Bac Bo",
        pattern: "B P B",
        number: 7,
        confidence: "90%",
        risk: "baixo",
        level: "alto",
        percentage: "91%",
        ...item.variables,
      },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.sent.length, 1, `${item.moduleKey} should send`);
    assert.equal(body.blocked.length, 0, `${item.moduleKey} should not block`);
  }

  assert.equal(sentMessages.length, 7);
  assert.match(sentMessages[1].payload.text, /PLAYER/i);
  assert.match(sentMessages[2].payload.text, /PADRAO|PADR/);
  assert.match(sentMessages[3].payload.text, /Green/i);
  assert.match(sentMessages[4].payload.text, /RED/i);
  assert.match(sentMessages[5].payload.text, /Empate 8x/i);
  assert.match(sentMessages[6].payload.text, /VALIDADOR|PLAYER/i);

  const testSavedRoom = await engine.testChannel(userId, "canal-1");
  assert.equal(testSavedRoom.status, 200);
  const testSavedRoomBody = await testSavedRoom.json();
  assert.equal(testSavedRoomBody.channel.connectionStatus, "connected");
  assert.ok(testSavedRoomBody.channel.lastSuccessAt);
  assert.equal(testSavedRoomBody.channel.lastError, "");

  await engine.patchChannel(userId, "canal-1", { isActive: false });
  const inactiveRoom = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "validator",
    signalKey: "validator-inactive-room",
    roundId: 106,
    entry: "PLAYER",
    result: "Aguardando resultado",
  });
  const inactiveRoomBody = await inactiveRoom.json();
  assert.equal(inactiveRoomBody.sent.length, 0);
  assert.equal(inactiveRoomBody.blocked[0].reason, "channel_inactive");
  await engine.patchChannel(userId, "canal-1", { isActive: true });

  const dedupeSignal = {
    userId,
    channelId: "canal-1",
    moduleKey: "validator",
    signalKey: "validator-dedupe-entry",
    roundId: 107,
    entry: "BANKER",
    result: "Aguardando resultado",
    variables: { pattern: "P B P" },
  };
  const firstDedupe = await engine.dispatchSignal(dedupeSignal);
  assert.equal((await firstDedupe.json()).sent.length, 1);
  const secondDedupe = await engine.dispatchSignal(dedupeSignal);
  const secondDedupeBody = await secondDedupe.json();
  assert.equal(secondDedupeBody.sent.length, 0);
  assert.ok(
    ["duplicate_signal", "pending_result"].includes(secondDedupeBody.blocked[0].reason),
    "the repeated pending entry must not send twice",
  );

  dashboardPayload = {
    rounds: [{ id: 300, result: "B", bankerScore: 8, playerScore: 6, time: "10:10" }],
    currentTieAlert: { id: "tie-monitor-1", status: "waiting", level: "Alto", confidence: 92 },
  };
  const tieBaseline = await engine.runDashboardMonitor({ source: "test" });
  assert.equal(tieBaseline.status, 200);

  dashboardPayload = {
    rounds: [{ id: 301, result: "P", bankerScore: 6, playerScore: 8, time: "10:11" }],
    currentTieAlert: { id: "tie-monitor-1", status: "active", level: "Alto", confidence: 92 },
  };
  const beforeTieMonitor = sentMessages.length;
  const tieMonitor = await engine.runDashboardMonitor({ source: "test" });
  assert.equal(tieMonitor.status, 200);
  const tieMonitorBody = await tieMonitor.json();
  const tieDispatch = tieMonitorBody.officialDispatches.find((item) => item.moduleKey === "ties_only");
  assert.equal(tieDispatch.confirmed, true);
  assert.equal(tieDispatch.sentCount, 1);
  assert.equal(sentMessages.length, beforeTieMonitor + 1);
  assert.match(sentMessages.at(-1).payload.text, /Empate|TIE/i);

  await engine.storeNotification({
    id: "official-paying-entry",
    type: "module:paying_numbers",
    userId,
    channelId: "canal-1",
    roundId: 200,
    status: "sent",
    error: "",
    payloadJson: {
      moduleKey: "paying_numbers",
      signalKey: "official-paying-entry",
      signalKind: "entry",
      variables: {
        number: "🔵7",
        entry: "🔵 PLAYER",
        entryLabel: "Player",
        side: "PLAYER",
        gale: "G1",
        result: "Aguardando resultado",
        roundId: 200,
      },
      entrySide: "PLAYER",
      entry: "🔵 PLAYER",
      result: "Aguardando resultado",
      galeLimit: 1,
      protection: "G1",
    },
    sentAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const beforeG1Messages = sentMessages.length;
  const g1Dispatch = await engine.dispatchPendingOfficialModuleResults(
    {
      rounds: [
        { id: 200, result: "B", bankerScore: 8, playerScore: 7, time: "10:00" },
        { id: 201, result: "B", bankerScore: 9, playerScore: 5, time: "10:01" },
      ],
    },
    "test",
  );
  assert.ok(g1Dispatch.sentCount >= 1);
  const g1Message = sentMessages.slice(beforeG1Messages).find((item) => /CUSTOM INTERMEDIARIO/.test(item.payload.text));
  assert.ok(g1Message, "paying_numbers G1 message should be sent");
  assert.match(g1Message.payload.text, /Proteção G1 ATIVA/i);
  assert.match(g1Message.payload.text, /G1/);

  const beforeFinalMessages = sentMessages.length;
  const finalDispatch = await engine.dispatchPendingOfficialModuleResults(
    {
      rounds: [
        { id: 200, result: "B", bankerScore: 8, playerScore: 7, time: "10:00" },
        { id: 201, result: "B", bankerScore: 9, playerScore: 5, time: "10:01" },
        { id: 202, result: "P", bankerScore: 4, playerScore: 7, time: "10:02" },
      ],
    },
    "test",
  );
  assert.ok(finalDispatch.sentCount >= 1);
  const finalMessage = sentMessages.slice(beforeFinalMessages).find((item) => /CUSTOM RESULTADO/.test(item.payload.text));
  assert.ok(finalMessage, "paying_numbers final message should be sent");
  assert.match(finalMessage.payload.text, /CUSTOM RESULTADO GREEN G1/);
  assert.match(finalMessage.payload.text, /G1/);

  for (const [id, roomChatId] of [["canal-2", "-1001234567891"], ["canal-3", "-1001234567892"]]) {
    const roomValidation = await engine.validateChannel(userId, {
      bot_token: botToken,
      telegram_chat_id: roomChatId,
    });
    assert.equal(roomValidation.status, 200);
    const roomValidationBody = await roomValidation.json();
    const roomSave = await engine.saveChannel(
      userId,
      { id, name: id, bot_token: botToken, group_id: roomChatId },
      roomValidationBody.validationCode,
    );
    assert.equal(roomSave.status, 201);
  }

  const fourthValidation = await engine.validateChannel(userId, {
    bot_token: botToken,
    telegram_chat_id: "-1001234567893",
  });
  const fourthValidationBody = await fourthValidation.json();
  const fourthRoom = await engine.saveChannel(
    userId,
    { id: "canal-4", name: "canal-4", bot_token: botToken, group_id: "-1001234567893" },
    fourthValidationBody.validationCode,
  );
  assert.equal(fourthRoom.status, 400);
  assert.match((await fourthRoom.json()).error, /Limite de canais/i);

  const publisherGlobal = await engine.fetch(new Request("https://internal/engine/signal", {
    method: "POST",
    body: JSON.stringify({
      userId,
      channelId: "canal-1",
      moduleKey: "paying_numbers",
      signalKey: "publisher:paying:401:BANKER:number-99",
      roundId: 401,
      entry: "BANKER",
      result: "Aguardando resultado",
      variables: { number: "99", table: "Bac Bo" },
      message: "<b>PUBLISHER OFFICIAL TESTE 401</b>",
      forceMessage: true,
    }),
  }));
  assert.equal(publisherGlobal.status, 200);
  assert.equal((await publisherGlobal.json()).sent.length, 1);

  console.log("telegram-engine-cloud tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
