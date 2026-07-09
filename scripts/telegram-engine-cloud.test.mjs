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
globalThis.fetch = async (url, init = {}) => {
  const endpoint = String(url);
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
  const env = { ENGINE_API_SECRET: "test-secret", TOKEN_ENCRYPTION_KEY: "test-token-key" };
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

  console.log("telegram-engine-cloud tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
