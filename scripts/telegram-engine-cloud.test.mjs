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
      button_url: "",
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

  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...list[0].signalModules,
      surf_alert: { ...list[0].signalModules.surf_alert, enabled: true },
    },
  });

  const modulesAfterSurf = (await engine.publicChannelsForUser(userId))[0].signalModules;
  const customTiesEntryTemplate = [
    "<b>EMPATE SECO CUSTOM</b>",
    "Canal: {{channel}}",
    "Entrada: {{entry}}",
    "Cobertura: G{{tieCoverage}}",
    "Opcional: {{missing_optional}}",
  ].join("\n");
  await engine.patchChannel(userId, "canal-1", {
    signalModules: {
      ...modulesAfterSurf,
      ties_only: {
        ...modulesAfterSurf.ties_only,
        template: customTiesEntryTemplate,
        tieTemplate: "✅ <b>{{result}}</b>\n\n🟡 <b>Empate confirmado</b>\n🛡️ <b>Proteção:</b> {{gale}}",
        tieCoverage: 2,
        buttons: [
          {
            enabled: true,
            label: "Entrar no Telegram VIP",
            url: "t.me/vip-sniper",
          },
        ],
      },
    },
  });
  const modulesAfterButtonSave = (await engine.publicChannelsForUser(userId))[0].signalModules;
  assert.equal(modulesAfterButtonSave.ties_only.buttons[0].label, "Entrar no Telegram VIP");
  assert.equal(modulesAfterButtonSave.ties_only.buttons[0].url, "https://t.me/vip-sniper");

  const cases = [
    { moduleKey: "ai_patterns", signalKey: "ai:entry:1", roundId: 101, result: "Aguardando resultado", entry: "BANKER" },
    { moduleKey: "paying_numbers", signalKey: "paying:entry:2", roundId: 102, result: "Aguardando resultado", entry: "PLAYER" },
    { moduleKey: "paying_numbers", signalKey: "paying:result:3", roundId: 103, result: "Green", entry: "PLAYER" },
    { moduleKey: "surf_alert", signalKey: "surf:result:4", roundId: 104, result: "Red", entry: "BANKER" },
    { moduleKey: "ties_only", signalKey: "ties:entry:5", roundId: 105, result: "Aguardando resultado", entry: "TIE" },
    {
      moduleKey: "ties_only",
      signalKey: "ties:result:6",
      roundId: 106,
      result: "Empate",
      entry: "TIE",
      variables: { tieMultiplier: "25x" },
    },
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

  const validatorResponse = await engine.dispatchSignal({
    userId,
    channelId: "canal-1",
    moduleKey: "validator",
    signalKey: "validator:entry:7",
    roundId: 107,
    entry: "PLAYER",
    result: "Aguardando resultado",
    variables: {
      table: "Bac Bo",
      pattern: "B P B",
      percentage: "91%",
    },
  });
  assert.equal(validatorResponse.status, 200);
  const validatorBody = await validatorResponse.json();
  assert.equal(validatorBody.sent.length, 0, "validator direct engine signal must stay silent");
  assert.equal(validatorBody.blocked[0].reason, "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS");

  assert.equal(sentMessages.length, 7);
  assert.match(sentMessages[1].payload.text, /PADRAO|PADR/);
  assert.match(sentMessages[2].payload.text, /N.MERO PAGANTE CONFIRMADO|NÚMERO PAGANTE CONFIRMADO/i);
  assert.match(sentMessages[2].payload.text, /Entrada:<\/b>\s*🔵 PLAYER/u);
  assert.match(sentMessages[3].payload.text, /Green/i);
  assert.match(sentMessages[4].payload.text, /RED/i);
  assert.match(sentMessages[5].payload.text, /EMPATE SECO CUSTOM/i);
  assert.match(sentMessages[5].payload.text, /Canal:\s*Grupo validado/i);
  assert.match(sentMessages[5].payload.text, /Cobertura:\s*G2/i);
  assert.doesNotMatch(sentMessages[5].payload.text, /POSS.VEL EMPATE/i);
  assert.match(sentMessages[6].payload.text, /Empate 25x/i);
  assert.match(sentMessages[6].payload.text, /Empate 25x confirmado/i);
  for (const message of sentMessages.slice(1, 5)) {
    assert.equal(message.payload.reply_markup.inline_keyboard[0][0].text, "Abrir Sniper Bo IA");
    assert.equal(message.payload.reply_markup.inline_keyboard[0][0].url, "https://sniperbo.com/app");
  }
  for (const message of sentMessages.slice(5, 7)) {
    assert.equal(message.payload.reply_markup.inline_keyboard[0][0].text, "Entrar no Telegram VIP");
    assert.equal(message.payload.reply_markup.inline_keyboard[0][0].url, "https://t.me/vip-sniper");
  }

  console.log("telegram-engine-cloud tests passed");
} finally {
  globalThis.fetch = originalFetch;
}
