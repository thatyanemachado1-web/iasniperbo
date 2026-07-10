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
let failNextEdit = false;
let failNextDelete = false;
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
  if (endpoint.includes("/editMessageText") && failNextEdit) {
    failNextEdit = false;
    return new Response(JSON.stringify({ ok: false, description: "Bad Request: not enough rights" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (endpoint.includes("/deleteMessage") && failNextDelete) {
    failNextDelete = false;
    return new Response(JSON.stringify({ ok: false, description: "Bad Request: not enough rights" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
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
        paying_numbers: { enabled: true, cooldownSeconds: 0 },
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
      signalKey: "validator-http-entry",
      roundId: 100,
      entry: "PLAYER",
      result: "Aguardando resultado",
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
    { moduleKey: "validator", signalKey: "validator:entry:5", roundId: 105, result: "Aguardando resultado", entry: "PLAYER" },
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
  assert.equal(secondDedupeBody.blocked[0].reason, "duplicate_signal");

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
  const g1Message = sentMessages.slice(beforeG1Messages).find((item) => /Número:<\/b> 🔵7/.test(item.payload.text));
  assert.ok(g1Message, "paying_numbers G1 message should be sent");
  assert.match(g1Message.payload.text, /Proteção G1 ATIVA/i);
  assert.match(g1Message.payload.text, /Status:<\/b> G1 ATIVO/);

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
  const finalMessage = sentMessages.slice(beforeFinalMessages).find((item) => /Número:<\/b> 🔵7/.test(item.payload.text));
  assert.ok(finalMessage, "paying_numbers final message should be sent");
  assert.match(finalMessage.payload.text, /GREEN G1/);
  assert.match(finalMessage.payload.text, /Status:<\/b> FINALIZADO/);

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

  const channelBeforeTemplateTests = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  assert.ok(channelBeforeTemplateTests);
  const allResultTypesOff = {
    ...channelBeforeTemplateTests.signalModules.validator,
    enabled: true,
    cooldownSeconds: 0,
    sendEntry: false,
    sendG1Active: false,
    sendGreenSG: false,
    sendGreenG1: false,
    sendRed: false,
    sendTieProtection: false,
    sendTieConfirmed: false,
    sendTie4x: false,
    sendTie6x: false,
    sendTie10x: false,
    sendTie25x: false,
    sendTie88x: false,
  };
  const disabledTypesPatch = await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...channelBeforeTemplateTests.signalModules,
      validator: allResultTypesOff,
    },
  });
  assert.equal(disabledTypesPatch.status, 200);

  const disabledTypeCases = [
    { id: "entry", result: "Aguardando resultado", entry: "BANKER" },
    { id: "g1", result: "PROTECAO G1 ATIVA", entry: "BANKER" },
    { id: "green-sg", result: "GREEN SG", entry: "BANKER" },
    { id: "green-g1", result: "GREEN G1", entry: "BANKER" },
    { id: "red", result: "RED", entry: "BANKER" },
    { id: "tie-protection", result: "EMPATE 4x", entry: "BANKER", tieMultiplier: "4x" },
    { id: "tie-4", result: "EMPATE 4x", entry: "TIE", tieMultiplier: "4x" },
    { id: "tie-6", result: "EMPATE 6x", entry: "TIE", tieMultiplier: "6x" },
    { id: "tie-10", result: "EMPATE 10x", entry: "TIE", tieMultiplier: "10x" },
    { id: "tie-25", result: "EMPATE 25x", entry: "TIE", tieMultiplier: "25x" },
    { id: "tie-88", result: "EMPATE 88x", entry: "TIE", tieMultiplier: "88x" },
  ];
  for (const [index, item] of disabledTypeCases.entries()) {
    const response = await engine.dispatchSignal({
      userId,
      channelId: "canal-1",
      moduleKey: "validator",
      signalKey: item.id === "entry" ? `template-filter:${item.id}:${index}` : `template-filter:${item.id}:result:${index}`,
      roundId: 500 + index,
      entry: item.entry,
      result: item.result,
      variables: { tieMultiplier: item.tieMultiplier || "" },
    });
    const body = await response.json();
    assert.equal(body.sent.length, 0, `${item.id} should be disabled`);
    assert.equal(body.blocked[0].reason, "message_type_inactive");
  }

  const customAiConfig = {
    ...channelBeforeTemplateTests.signalModules.ai_patterns,
    enabled: true,
    cooldownSeconds: 0,
    sendGreenSG: true,
    sendRed: false,
    greenSGTemplate: "<b>GREEN SG PERSONALIZADO</b> {{entry}}",
    eventButtons: {
      greenSG: {
        enabled: true,
        text: "Abrir painel",
        url: "https://sniperbo.com/app",
      },
    },
  };
  const customPatch = await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...channelBeforeTemplateTests.signalModules,
      ai_patterns: customAiConfig,
      validator: { ...allResultTypesOff, sendEntry: true },
    },
  });
  assert.equal(customPatch.status, 200);
  const reloadedCustomChannel = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  assert.equal(reloadedCustomChannel.signalModules.ai_patterns.greenSGTemplate, customAiConfig.greenSGTemplate);
  assert.equal(reloadedCustomChannel.signalModules.ai_patterns.sendRed, false);
  assert.equal(reloadedCustomChannel.signalModules.ai_patterns.eventButtons.greenSG.url, "https://sniperbo.com/app");

  const invalidButtonPatch = await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...reloadedCustomChannel.signalModules,
      ai_patterns: {
        ...reloadedCustomChannel.signalModules.ai_patterns,
        eventButtons: { entry: { enabled: true, text: "Inseguro", url: "http://sniperbo.com" } },
      },
    },
  });
  assert.equal(invalidButtonPatch.status, 400);
  assert.match((await invalidButtonPatch.json()).error, /https:\/\//i);

  const beforeCustomGreen = sentMessages.length;
  const customGreen = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "ai_patterns",
    signalKey: "custom-ai:result:green-sg:600",
    roundId: 600,
    entry: "BANKER",
    result: "GREEN SG",
  });
  assert.equal((await customGreen.json()).sent.length, 1);
  assert.equal(sentMessages.length, beforeCustomGreen + 1);
  assert.match(sentMessages.at(-1).payload.text, /GREEN SG PERSONALIZADO/);
  assert.equal(sentMessages.at(-1).payload.reply_markup.inline_keyboard[0][0].url, "https://sniperbo.com/app");

  const redDisabled = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "ai_patterns",
    signalKey: "custom-ai:result:red:601",
    roundId: 601,
    entry: "BANKER",
    result: "RED",
  });
  const redDisabledBody = await redDisabled.json();
  assert.equal(redDisabledBody.sent.length, 0);
  assert.equal(redDisabledBody.blocked[0].reason, "message_type_inactive");

  const payingBase = reloadedCustomChannel.signalModules.paying_numbers;
  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...reloadedCustomChannel.signalModules,
      paying_numbers: {
        ...payingBase,
        enabled: true,
        cooldownSeconds: 0,
        sendG1Active: true,
        sendGreenG1: true,
        g1MessageBehavior: "edit_to_final",
        galeTemplate: "<b>G1 PERSONALIZADO</b> {{entry}}",
        greenG1Template: "<b>GREEN G1 PERSONALIZADO</b> {{entry}}",
      },
    },
  });
  const g1Root = "publisher:paying:700:PLAYER:number-7";
  const g1Sent = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${g1Root}:result:G1_ACTIVE:701`,
    roundId: 701,
    triggerRoundId: 700,
    entry: "PLAYER",
    result: "PROTECAO G1 ATIVA",
    variables: { triggerRoundId: 700 },
  });
  assert.equal((await g1Sent.json()).sent[0].g1Action, "stored");
  const sendsBeforeEdit = sentMessages.filter((item) => item.endpoint.includes("/sendMessage")).length;
  const editedFinal = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${g1Root}:result:GREEN:702`,
    roundId: 702,
    triggerRoundId: 700,
    entry: "PLAYER",
    result: "GREEN G1",
    variables: { triggerRoundId: 700 },
  });
  const editedFinalBody = await editedFinal.json();
  assert.equal(editedFinalBody.sent[0].g1Action, "edited_to_final");
  assert.equal(sentMessages.filter((item) => item.endpoint.includes("/sendMessage")).length, sendsBeforeEdit);
  assert.ok(sentMessages.some((item) => item.endpoint.includes("/editMessageText") && /GREEN G1 PERSONALIZADO/.test(item.payload.text)));

  const channelBeforeDelete = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...channelBeforeDelete.signalModules,
      paying_numbers: {
        ...channelBeforeDelete.signalModules.paying_numbers,
        g1MessageBehavior: "delete_on_final",
        sendRed: true,
      },
    },
  });
  const deleteRoot = "publisher:paying:800:BANKER:number-8";
  await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${deleteRoot}:result:G1_ACTIVE:801`,
    roundId: 801,
    triggerRoundId: 800,
    entry: "BANKER",
    result: "PROTECAO G1 ATIVA",
    variables: { triggerRoundId: 800 },
  });
  const deletedFinal = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${deleteRoot}:result:RED:802`,
    roundId: 802,
    triggerRoundId: 800,
    entry: "BANKER",
    result: "RED",
    variables: { triggerRoundId: 800 },
  });
  assert.equal((await deletedFinal.json()).sent[0].g1Action, "deleted_on_final");
  assert.ok(sentMessages.some((item) => item.endpoint.includes("/deleteMessage") && item.payload.message_id));

  const channelBeforeEditFallback = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...channelBeforeEditFallback.signalModules,
      paying_numbers: {
        ...channelBeforeEditFallback.signalModules.paying_numbers,
        g1MessageBehavior: "edit_to_final",
        galeTemplate: "<b>G1 FALLBACK EDIT</b> {{entry}}",
        greenG1Template: "<b>GREEN G1 FALLBACK EDIT</b> {{entry}}",
      },
    },
  });
  const editFallbackRoot = "publisher:paying:900:PLAYER:number-9";
  await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${editFallbackRoot}:result:G1_ACTIVE:901`,
    roundId: 901,
    triggerRoundId: 900,
    entry: "PLAYER",
    result: "PROTECAO G1 ATIVA",
    variables: { triggerRoundId: 900 },
  });
  failNextEdit = true;
  const editFallback = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${editFallbackRoot}:result:GREEN:902`,
    roundId: 902,
    triggerRoundId: 900,
    entry: "PLAYER",
    result: "GREEN G1",
    variables: { triggerRoundId: 900 },
  });
  const editFallbackBody = await editFallback.json();
  assert.equal(editFallbackBody.sent[0].g1Action, "edit_failed_final_sent");
  assert.match(editFallbackBody.sent[0].error, /Falha ao editar G1/);
  const channelAfterEditFallback = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  assert.match(channelAfterEditFallback.lastError, /Falha ao editar G1/);

  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...channelAfterEditFallback.signalModules,
      paying_numbers: {
        ...channelAfterEditFallback.signalModules.paying_numbers,
        g1MessageBehavior: "delete_on_final",
        galeTemplate: "<b>G1 FALLBACK DELETE</b> {{entry}}",
        redTemplate: "<b>RED FALLBACK DELETE</b> {{entry}}",
      },
    },
  });
  const deleteFallbackRoot = "publisher:paying:1000:BANKER:number-10";
  await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${deleteFallbackRoot}:result:G1_ACTIVE:1001`,
    roundId: 1001,
    triggerRoundId: 1000,
    entry: "BANKER",
    result: "PROTECAO G1 ATIVA",
    variables: { triggerRoundId: 1000 },
  });
  failNextDelete = true;
  const deleteFallback = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "paying_numbers",
    signalKey: `${deleteFallbackRoot}:result:RED:1002`,
    roundId: 1002,
    triggerRoundId: 1000,
    entry: "BANKER",
    result: "RED",
    variables: { triggerRoundId: 1000 },
  });
  const deleteFallbackBody = await deleteFallback.json();
  assert.equal(deleteFallbackBody.sent[0].g1Action, "delete_failed_final_sent");
  assert.match(deleteFallbackBody.sent[0].error, /Falha ao apagar G1/);
  const channelAfterDeleteFallback = (await engine.publicChannelsForUser(userId)).find((channel) => channel.id === "canal-1");
  assert.match(channelAfterDeleteFallback.lastError, /Falha ao apagar G1/);

  console.log("telegram-engine-cloud tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
