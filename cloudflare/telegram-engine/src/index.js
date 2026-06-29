const MODULE_KEYS = ["ai_patterns", "paying_numbers", "surf_alert", "ties_only", "validator"];
const MAX_TELEGRAM_BUTTONS = 4;
const DEFAULT_BUTTON_LABEL = "Abrir Sniper Bo IA";
const ENGINE_SECRET_NAMES = [
  "ENGINE_API_SECRET",
  "TELEGRAM_ENGINE_SECRET",
  "CLOUDFLARE_TELEGRAM_ENGINE_SECRET",
  "LEGACY_ENGINE_API_SECRET",
  "SNIPER_ENGINE_BRIDGE",
  "SNIPER_PUBLISHER_TOKEN",
  "SNIPER_DASHBOARD_TOKEN",
  "SNIPER_ADMIN_TOKEN",
];
const DEFAULT_MODULE_CONFIG = {
  enabled: false,
  entryType: "AUTO",
  galeLimit: 1,
  coverTie: false,
  tieCoverage: 1,
  cooldownSeconds: 2,
  template: "",
  analyzingTemplate: "",
  greenTemplate: "",
  galeTemplate: "",
  redTemplate: "",
  tieTemplate: "",
  expiredTemplate: "",
  canceledTemplate: "",
  buttons: [],
};
const DEFAULT_MODULE_TEMPLATES = {
  ai_patterns:
    "🤖 <b>PADRÃO IA CONFIRMADO</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}\n📊 <b>Assertividade:</b> {{confidence}}",
  paying_numbers:
    "💎 <b>NÚMERO PAGANTE CONFIRMADO</b>\n\n🔢 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entryLabel}}\n🛡️ <b>Proteção:</b> {{gale}}\n📌 <b>Status:</b> {{status}}",
  surf_alert:
    "🌊 <b>AVISO DE SURF CONFIRMADO</b>\n\n🎯 <b>Entrada:</b> {{entryCompact}}\n⚠️ <b>Risco:</b> {{risk}}\n📊 <b>Confiança:</b> {{confidence}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only:
    "🟡 <b>POSSÍVEL EMPATE</b>\n\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Cobertura:</b> até G{{tieCoverage}}\n📊 <b>Nível:</b> {{level}}",
  validator:
    "🤖 <b>PADRÃO VALIDADOR</b>\n\n🎲 <b>Mesa:</b> {{table}}\n🧩 <b>Padrão:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}\n📊 <b>Assertividade:</b> {{percentage}}",
};
const DEFAULT_MODULE_GREEN_TEMPLATES = {
  ai_patterns:
    "✅ <b>{{result}}</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  paying_numbers:
    "✅ <b>{{result}}</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  surf_alert:
    "✅ <b>{{result}}</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only:
    "✅ <b>{{result}}</b>\n\n🟡 <b>Empate confirmado</b>\n🛡️ <b>Proteção:</b> {{gale}}",
  validator:
    "✅ <b>{{result}}</b>\n\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
};
const DEFAULT_MODULE_ANALYZING_TEMPLATES = {
  ai_patterns: "🔎 <b>ANALISANDO PADRÃO IA</b>\n🎲 <b>Mesa:</b> {{table}}\n⏳ Aguardando confirmação real.",
  paying_numbers: "🔎 <b>ANALISANDO NÚMERO PAGANTE</b>\n🔢 <b>Números:</b> {{numbers}}\n⏳ Aguardando confirmação real.",
  surf_alert: "🔎 <b>ANALISANDO SURF</b>\n🌊 <b>Direção:</b> {{side}}\n⏳ Aguardando confirmação real.",
  ties_only: "🔎 <b>ANALISANDO EMPATE</b>\n🟡 <b>Pressão Tie:</b> {{tie_pressure}}\n⏳ Aguardando confirmação real.",
  validator: "🔎 <b>ANALISANDO VALIDADOR</b>\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n⏳ Aguardando entrada validada.",
};
const DEFAULT_MODULE_GALE_TEMPLATES = {
  ai_patterns: "🛡️ <b>FAZER {{gale}}</b>\n🎯 <b>Entrada:</b> {{entry}}\n🧩 <b>Padr\u00E3o:</b> {{pattern}}",
  paying_numbers: "🛡️ <b>FAZER {{gale}}</b>\n🔢 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}",
  surf_alert: "🛡️ <b>FAZER {{gale}}</b>\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}",
  ties_only: "🛡️ <b>COBRIR EMPATE {{gale}}</b>\n🟡 <b>Pressão:</b> {{tie_pressure}}",
  validator: "🛡️ <b>FAZER {{gale}}</b>\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}",
};
const DEFAULT_MODULE_RED_TEMPLATES = {
  ai_patterns:
    "❌ <b>RED</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  paying_numbers: "❌ <b>RED</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  surf_alert: "❌ <b>RED</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only: "❌ <b>RED</b>\n\n🟡 <b>Empate não confirmou</b>\n🛡️ <b>Proteção:</b> {{gale}}",
  validator: "❌ <b>RED</b>\n\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
};
const DEFAULT_MODULE_EXPIRED_TEMPLATES = {
  ai_patterns: "⌛ <b>SINAL EXPIRADO</b>\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padr\u00E3o:</b> {{pattern}}",
  paying_numbers: "⌛ <b>SINAL EXPIRADO</b>\n💎 <b>Módulo:</b> {{module}}\n🔢 <b>Números:</b> {{numbers}}",
  surf_alert: "⌛ <b>SINAL EXPIRADO</b>\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Direção:</b> {{side}}",
  ties_only: "⌛ <b>ALERTA DE EMPATE EXPIRADO</b>\n🟡 <b>Pressão Tie:</b> {{tie_pressure}}",
  validator: "⌛ <b>SINAL EXPIRADO</b>\n🧩 <b>Padr\u00E3o:</b> {{pattern}}",
};
const DEFAULT_MODULE_CANCELED_TEMPLATES = {
  ai_patterns: "🚫 <b>SINAL CANCELADO</b>\n🤖 <b>Módulo:</b> {{module}}\n📌 <b>Motivo:</b> {{result}}",
  paying_numbers: "🚫 <b>SINAL BLOQUEADO</b>\n💎 <b>Módulo:</b> {{module}}\n📌 <b>Motivo:</b> {{result}}",
  surf_alert: "🚫 <b>SINAL CANCELADO</b>\n🌊 <b>Módulo:</b> {{module}}\n📌 <b>Motivo:</b> {{result}}",
  ties_only: "🚫 <b>ALERTA CANCELADO</b>\n🟡 <b>Pressão Tie:</b> {{tie_pressure}}\n📌 <b>Motivo:</b> {{result}}",
  validator: "🚫 <b>SINAL CANCELADO</b>\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n📌 <b>Motivo:</b> {{result}}",
};
const DEFAULT_MODULE_TIE_TEMPLATES = {
  ai_patterns:
    "✅ <b>{{result}}</b>\n\n🤖 <b>Módulo:</b> {{module}}\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  paying_numbers:
    "✅ <b>{{result}}</b>\n\n💎 <b>Número:</b> {{number}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  surf_alert:
    "✅ <b>{{result}}</b>\n\n🌊 <b>Módulo:</b> {{module}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
  ties_only:
    "✅ <b>{{result}}</b>\n\n🟡 <b>Empate confirmado</b>\n🛡️ <b>Proteção:</b> {{gale}}",
  validator:
    "✅ <b>{{result}}</b>\n\n🧩 <b>Padr\u00E3o:</b> {{pattern}}\n🎯 <b>Entrada:</b> {{entry}}\n🛡️ <b>Proteção:</b> {{gale}}",
};
const MAX_CHANNELS_PER_USER = 20;
const MAX_NOTIFICATIONS = 1000;
const DEFAULT_ACCESS_GRACE_DAYS = 5;
const DASHBOARD_MONITOR_INTERVAL_MS = 30000;
const DASHBOARD_MONITOR_ERROR_INTERVAL_MS = 120000;

function legacyTelegramMonitorEnabled(env = {}) {
  const raw = String(env.TELEGRAM_ENGINE_LEGACY_MONITOR || "0")
    .trim()
    .toLowerCase();
  return ["1", "true", "on", "yes"].includes(raw);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(env);
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "sniperbo-telegram-engine" }, 200, env);
    }

    const token = bearerToken(request);
    const secrets = acceptedEngineSecrets(env);
    if (!token || !secrets.includes(token)) {
      return json({ error: "Unauthorized" }, 401, env);
    }

    const fallback = await handleTelegramEngineDoFallback(request, env, url);
    if (fallback) return fallback;

    if (request.method === "GET" && url.pathname === "/engine/debug/telegram-probe") {
      const probes = [];
      for (const name of [
        ...ENGINE_SECRET_NAMES,
        "TELEGRAM_EMERGENCY_BOT_TOKEN",
        "TELEGRAM_SMOKE_BOT_TOKEN",
      ]) {
        const value = normalizeSecret(env[name]);
        if (!looksLikeTelegramBotToken(value)) continue;
        const me = await fetch(`https://api.telegram.org/bot${value}/getMe`)
          .then((response) => response.json())
          .catch(() => ({ ok: false }));
        let sampleChatId = "";
        if (me?.ok) {
          const updates = await fetch(`https://api.telegram.org/bot${value}/getUpdates`)
            .then((response) => response.json())
            .catch(() => ({ ok: false, result: [] }));
          sampleChatId = String(updates?.result?.at(-1)?.message?.chat?.id || "");
        }
        probes.push({
          name,
          ok: Boolean(me?.ok),
          username: me?.result?.username || "",
          sampleChatId,
        });
      }
      return json({ probes }, 200, env);
    }

    if (!env.TELEGRAM_ENGINE) return json({ error: "Durable Object binding missing" }, 500, env);
    const id = env.TELEGRAM_ENGINE.idFromName("global");
    try {
      return await env.TELEGRAM_ENGINE.get(id).fetch(request);
    } catch (error) {
      const degraded = await handleTelegramEngineDoFallback(request, env, url, error);
      if (degraded) return degraded;
      throw error;
    }
  },

  async scheduled(_event, env, ctx) {
    if (!legacyTelegramMonitorEnabled(env)) return;
    if (!env.TELEGRAM_ENGINE) return;
    const id = env.TELEGRAM_ENGINE.idFromName("global");
    const request = new Request("https://internal.sniperbo/engine/notifications/purge", { method: "POST" });
    ctx.waitUntil(env.TELEGRAM_ENGINE.get(id).fetch(request));
    const monitorRequest = new Request("https://internal.sniperbo/engine/monitor", { method: "POST" });
    ctx.waitUntil(env.TELEGRAM_ENGINE.get(id).fetch(monitorRequest));
  },
};
export class TelegramEngine {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    if (request.method === "OPTIONS") return corsResponse(this.env);
    const url = new URL(request.url);
    const userId = normalizeUserId(request.headers.get("x-validator-user-id") || "");

    try {
      if (legacyTelegramMonitorEnabled(this.env)) {
        await this.ensureDashboardMonitorAlarm();
      }

      if (request.method === "GET" && url.pathname === "/validator/channels") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        return json({ channels: await this.publicChannelsForUser(userId) }, 200, this.env);
      }

      if (request.method === "POST" && url.pathname === "/validator/channels/validate") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const body = await readJson(request);
        return this.validateChannel(userId, body);
      }

      if (request.method === "POST" && url.pathname === "/validator/channels") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const body = await readJson(request);
        return this.saveChannel(userId, readRecord(body.channel || body), body.validationCode || "");
      }

      if (request.method === "POST" && url.pathname === "/validator/channels/test") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const body = await readJson(request);
        return this.testChannel(userId, String(body.channelId || ""));
      }

      if (request.method === "POST" && url.pathname === "/validator/channels/preview") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const body = await readJson(request);
        return this.previewChannel(userId, body);
      }

      if (request.method === "POST" && url.pathname === "/validator/channels/info") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const body = await readJson(request);
        return this.channelInfo(userId, String(body.channelId || ""));
      }

      const channelMatch = url.pathname.match(/^\/validator\/channels\/([^/]+)$/);
      if (channelMatch) {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        const channelId = decodeURIComponent(channelMatch[1] || "");
        if (request.method === "DELETE") return this.deleteChannel(userId, channelId, await readJson(request));
        if (request.method === "PATCH") return this.patchChannel(userId, channelId, await readJson(request));
      }

      if (request.method === "GET" && url.pathname === "/validator/notifications") {
        if (!userId) return json({ error: "Missing user" }, 400, this.env);
        return json({ notifications: await this.notificationsForUser(userId) }, 200, this.env);
      }

      if (request.method === "POST" && url.pathname === "/validator/telegram/send") {
        const body = await readJson(request);
        return this.sendAdHocTelegram(body);
      }

      if (request.method === "POST" && url.pathname === "/engine/signal") {
        return this.dispatchSignal(await readJson(request));
      }

      if ((request.method === "POST" || request.method === "GET") && url.pathname === "/engine/monitor") {
        if (!legacyTelegramMonitorEnabled(this.env)) {
          return json({ ok: true, skipped: "legacy_disabled" }, 200, this.env);
        }
        return this.runDashboardMonitor({ source: "manual" });
      }

      if (request.method === "GET" && url.pathname === "/engine/monitor/status") {
        return json(
          {
            ok: true,
            alarmAt: await this.state.storage.getAlarm?.(),
            last: (await this.state.storage.get("dashboard-monitor:last")) || null,
            lastAiPatterns: (await this.state.storage.get("dashboard-monitor:last:ai_patterns")) || null,
            lastSurf: (await this.state.storage.get("dashboard-monitor:last:surf_alert")) || null,
            lastOfficialResults: (await this.state.storage.get("dashboard-monitor:last-official-results")) || null,
            lastResult: (await this.state.storage.get("dashboard-monitor:last-result")) || null,
            lastError: (await this.state.storage.get("dashboard-monitor:last-error")) || null,
          },
          200,
          this.env,
        );
      }

      if (request.method === "POST" && url.pathname === "/engine/users/provision") {
        return this.provisionUserWorkspace(await readJson(request));
      }

      if (request.method === "POST" && url.pathname === "/engine/users/expire") {
        return this.expireUserWorkspace(await readJson(request));
      }

      if (request.method === "POST" && url.pathname === "/engine/channels/move") {
        return this.moveChannel(await readJson(request));
      }

      if (request.method === "GET" && url.pathname === "/engine/channels/active") {
        return json({ channels: await this.activePublicChannels() }, 200, this.env);
      }

      return json({ error: "Not found" }, 404, this.env);
    } catch (error) {
      return json({ error: "Cloud Telegram failed", detail: errorMessage(error) }, 500, this.env);
    }
  }

  async alarm() {
    if (!legacyTelegramMonitorEnabled(this.env)) return;
    try {
      await this.runDashboardMonitor({ source: "alarm" });
    } catch (error) {
      await this.state.storage.put("dashboard-monitor:last-error", {
        event: "[TELEGRAM_AUTO] erro",
        source: "alarm",
        error: errorMessage(error),
        checkedAt: new Date().toISOString(),
      });
    } finally {
      await this.ensureDashboardMonitorAlarm(DASHBOARD_MONITOR_INTERVAL_MS, true);
    }
  }

  async validateChannel(userId, body) {
    const botToken = normalizeSecret(readFirstString(body, ["botToken", "bot_token", "telegram_bot_token"]));
    const chatId = readFirstString(body, ["chatId", "chat_id", "telegram_chat_id", "channel_id", "group_id"]);
    if (!botToken) return json({ error: "Bot Token obrigatorio." }, 400, this.env);
    if (!chatId) return json({ error: "Chat ID obrigatorio." }, 400, this.env);
    const channelId = String(body.channelId || body.id || "").trim();
    const duplicate = await this.findAnyChannelByChatId(chatId);
    if (duplicate && (duplicate.userId !== userId || duplicate.id !== channelId)) {
      return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);
    }

    const result = await sendTelegramMessage({
      botToken,
      chatId,
      message: "oi",
      parseMode: "HTML",
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({
      ok: true,
      validated: true,
      messageId: result.messageId,
      validationCode: await this.validationCode(userId, botToken, chatId),
    }, 200, this.env);
  }

  async saveChannel(userId, incoming, validationCode) {
    const access = await this.userAccessState(userId);
    if (!access.active) {
      return json({ error: "Acesso premium expirado. Canal Telegram bloqueado." }, 403, this.env);
    }

    const channelId = String(incoming.id || crypto.randomUUID());
    const existing = await this.getChannel(userId, channelId);
    const incomingToken = normalizeSecret(readFirstString(incoming, ["botToken", "bot_token", "telegram_bot_token"]));
    const botToken = incomingToken || (existing ? await this.decryptToken(existing.botTokenCipher) : "");
    const chatId =
      readFirstString(incoming, ["chatId", "chat_id", "telegram_chat_id", "channel_id", "group_id"]) ||
      existing?.chatId ||
      "";
    if (!botToken || !chatId) return json({ error: "Bot Token e Chat ID sao obrigatorios." }, 400, this.env);

    const duplicate = await this.findAnyChannelByChatId(chatId);
    if (duplicate && (duplicate.userId !== userId || duplicate.id !== channelId)) {
      return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);
    }
    if (!existing || incomingToken) {
      const ok = await this.verifyValidationCode(userId, botToken, chatId, String(validationCode || incoming.validationCode || ""));
      if (!ok) return json({ error: "Valide o grupo primeiro para salvar na nuvem." }, 400, this.env);
    }

    const channels = await this.channelsForUser(userId);
    if (!existing && channels.length >= MAX_CHANNELS_PER_USER) {
      return json({ error: "Limite de canais por cliente atingido." }, 400, this.env);
    }

    const now = new Date().toISOString();
    const channel = {
      id: channelId,
      userId,
      name: String(incoming.name || existing?.name || "Canal Telegram").trim().slice(0, 80),
      botTokenMasked: maskToken(botToken),
      botTokenCipher: await this.encryptToken(botToken),
      chatId,
      chatCode: normalizeChannelCode(chatId),
      buttonLink: normalizeUrl(readFirstString(incoming, ["buttonLink", "button_link", "buttonUrl", "button_url"]) || existing?.buttonLink || ""),
      isActive: incoming.isActive !== false,
      analyzingEnabled: Boolean(incoming.analyzingEnabled ?? existing?.analyzingEnabled ?? false),
      analyzingCooldownRounds: clampInt(incoming.analyzingCooldownRounds ?? existing?.analyzingCooldownRounds ?? 3, 1, 20),
      templates: sanitizeTemplateRecord(incoming.templates || existing?.templates || {}),
      signalModules: normalizeModuleConfigs(incoming.signalModules || incoming.templates?.signalModules || existing?.signalModules || {}),
      connectionStatus: "connected",
      lastTestedAt: existing?.lastTestedAt || now,
      lastTestMessageId: existing?.lastTestMessageId || null,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await this.state.storage.put(channelKey(userId, channelId), channel);
    await this.state.storage.delete(deletedCodeKey(userId, chatId));
    return json({ channel: publicChannel(channel), persisted: true, storage: { cloudflare: true } }, 201, this.env);
  }

  async testChannel(userId, channelId) {
    const channel = await this.getChannel(userId, channelId);
    if (!channel) return json({ error: "Canal nao encontrado." }, 404, this.env);
    const botToken = await this.decryptToken(channel.botTokenCipher);
    const result = await sendTelegramMessage({
      botToken,
      chatId: channel.chatId,
      message: [
        "<b>ENTRADA CONFIRMADA</b>",
        "",
        "<b>Mesa:</b> Bac Bo",
        "<b>Padr\u00E3o:</b> \u{1F534}10\u{1F535}7\u{1F7E1}6",
        "<b>Entrada:</b> \u{1F534} BANKER",
        "<b>Gale:</b> Até G1",
        "<b>Prote\u00E7\u00E3o Tie:</b> Ativa",
        `<b>Canal:</b> ${escapeHtml(channel.name)}`,
      ].join("\n"),
      buttonLabel: "Abrir Sniper Bo IA",
      buttonUrl: channel.buttonLink,
      parseMode: "HTML",
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({ ok: true, messageId: result.messageId }, 200, this.env);
  }

  async previewChannel(userId, body) {
    const channel = await this.getChannel(userId, String(body.channelId || ""));
    if (!channel) return json({ error: "Canal nao encontrado." }, 404, this.env);
    const message = String(body.message || "").trim().slice(0, 4096);
    if (!message) return json({ error: "Mensagem de previa obrigatoria." }, 400, this.env);
    const buttons = normalizeModuleButtons(body.buttons, {}, [])
      .filter((button) => button.enabled)
      .map((button) => ({
        label: String(button.label || DEFAULT_BUTTON_LABEL).trim().slice(0, 64),
        url: normalizeUrl(String(button.url || channel.buttonLink || "")),
      }))
      .filter((button) => button.label && button.url)
      .slice(0, MAX_TELEGRAM_BUTTONS);
    const result = await sendTelegramMessage({
      botToken: await this.decryptToken(channel.botTokenCipher),
      chatId: channel.chatId,
      message,
      buttons,
      parseMode: "HTML",
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({ ok: true, messageId: result.messageId, preview: true, buttonCount: buttons.length }, 200, this.env);
  }

  async channelInfo(userId, channelId) {
    const channel = await this.getChannel(userId, channelId);
    if (!channel) return json({ error: "Canal nao encontrado." }, 404, this.env);
    const result = await getTelegramChat({
      botToken: await this.decryptToken(channel.botTokenCipher),
      chatId: channel.chatId,
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({
      ok: true,
      channelId: channel.id,
      chatId: channel.chatId,
      telegram: result.chat,
    }, 200, this.env);
  }

  async patchChannel(userId, channelId, patch) {
    const current = await this.getChannel(userId, channelId);
    if (!current) return json({ error: "Canal nao encontrado." }, 404, this.env);
    const incomingChatId = readFirstString(patch, ["chatId", "chat_id", "telegram_chat_id", "channel_id", "group_id"]);
    const nextChatId = incomingChatId || current.chatId;
    const merged = {
      ...current,
      ...readRecord(patch),
      id: current.id,
      userId,
      botTokenCipher: current.botTokenCipher,
      botTokenMasked: current.botTokenMasked,
      chatId: nextChatId,
      chatCode: normalizeChannelCode(nextChatId),
      templates: sanitizeTemplateRecord(patch.templates || current.templates || {}),
      signalModules: normalizeModuleConfigs(patch.signalModules || patch.templates?.signalModules || current.signalModules || {}),
      updatedAt: new Date().toISOString(),
    };
    if (normalizeChannelCode(nextChatId) !== normalizeChannelCode(current.chatId)) {
      const duplicate = await this.findAnyChannelByChatId(merged.chatId);
      if (duplicate && (duplicate.userId !== userId || duplicate.id !== channelId)) {
        return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);
      }
    }
    await this.state.storage.put(channelKey(userId, channelId), merged);
    return json({ channel: publicChannel(merged) }, 200, this.env);
  }

  async deleteChannel(userId, channelId, body = {}) {
    const channel = await this.getChannel(userId, channelId);
    const chatId = String(
      channel?.chatId || readFirstString(body, ["chatId", "chat_id", "telegram_chat_id", "channel_id", "group_id"]),
    ).trim();
    const chatCode = normalizeChannelCode(chatId);
    const rows = await this.state.storage.list({ prefix: `channel:${userId}:` });
    let deleted = 0;
    for (const stored of rows.values()) {
      if (!stored || stored.userId !== userId) continue;
      if (stored.id === channelId || (chatCode && stored.chatCode === chatCode)) {
        await this.state.storage.delete(channelKey(userId, stored.id));
        deleted += 1;
      }
    }
    await this.state.storage.delete(channelKey(userId, channelId));
    if (deleted === 0 && channel) deleted = 1;
    if (chatId) {
      await this.state.storage.put(deletedCodeKey(userId, chatId), {
        userId,
        channelId,
        chatCode,
        deletedAt: new Date().toISOString(),
      });
    }
    return json({ ok: true, deleted }, 200, this.env);
  }

  async dispatchSignal(body) {
    const moduleKey = normalizeModuleKey(body.moduleKey || body.type);
    if (!moduleKey) return json({ error: "Módulo invalido." }, 400, this.env);
    const entry = normalizeEntry(body.entry);
    const targetUserId = normalizeUserId(body.userId || "");
    const targetChannelId = String(body.channelId || "").trim();
    const signalKey = String(body.signalKey || body.id || `${moduleKey}:${Date.now()}`);
    const variables = readRecord(body.variables);
    const forceMessage = body.forceMessage === true;
    const roundId = clampInt(
      body.roundId ?? variables.roundId ?? variables.roundID ?? variables.round ?? variables.roundNumber,
      0,
      Number.MAX_SAFE_INTEGER,
    );
    const signalKind = classifySignalKind(body, signalKey);
    const notificationResult = String(body.result || variables.result || "Aguardando resultado").trim() || "Aguardando resultado";
    const notificationProtection = String(body.protection || variables.gale || "").trim();
    const channels = (targetUserId ? await this.channelsForUser(targetUserId) : await this.activeChannels())
      .filter((channel) => !targetChannelId || channel.id === targetChannelId);
    const sent = [];
    const blocked = [];

    if (moduleKey === "validator") {
      console.warn(JSON.stringify({
        event: "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS",
        reason: "validator_requires_backend_saved_pattern",
        user: maskUserId(targetUserId),
        channelId: targetChannelId,
        signalKey,
        roundId,
        activeChannels: channels.length,
      }));
      for (const channel of channels) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, false, "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS", "")));
        blocked.push({ channelId: channel.id, reason: "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS" });
      }
      return json({ ok: true, sent, blocked }, 200, this.env);
    }

    const sentChatCodes = new Set();
    for (const channel of channels) {
      const chatCode = normalizeChannelCode(channel.chatId);
      if (chatCode && sentChatCodes.has(chatCode)) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, false, "duplicate_chat_id", "")));
        blocked.push({ channelId: channel.id, reason: "duplicate_chat_id" });
        continue;
      }
      if (!channel.isActive) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, false, "channel_inactive", "")));
        blocked.push({ channelId: channel.id, reason: "channel_inactive" });
        continue;
      }
      const config = normalizeModuleConfigs(channel.signalModules || {})[moduleKey];
      if (moduleKey === "ai_patterns" && entry === "TIE") {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, config.enabled, "entry_not_allowed", "")));
        blocked.push({ channelId: channel.id, reason: "entry_not_allowed" });
        continue;
      }
      if (!config.enabled) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, false, "module_inactive", "")));
        blocked.push({ channelId: channel.id, reason: "module_inactive" });
        continue;
      }
      if (signalKind === "entry" && entry && !moduleAllowsEntry(config, entry)) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, config.enabled, "entry_not_allowed", "")));
        blocked.push({ channelId: channel.id, reason: "entry_not_allowed" });
        continue;
      }
      let cooldownKey = "";
      if (signalKind === "entry") {
        cooldownKey = `cooldown:${channel.userId}:${channel.id}:${moduleKey}`;
        const lastSentAt = Number(await this.state.storage.get(cooldownKey) || 0);
        const cooldownMs = Math.max(0, Number(config.cooldownSeconds) || 0) * 1000;
        if (lastSentAt && cooldownMs && Date.now() - lastSentAt < cooldownMs) {
          console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, config.enabled, "cooldown_active", "")));
          blocked.push({ channelId: channel.id, reason: "cooldown_active" });
          continue;
        }
      }

      const finalNotificationProtection = notificationProtection || formatGale(config.galeLimit);
      const template = selectSignalTemplate(config, signalKind, notificationResult);
      const templateVariables = {
        ...variables,
        entry: formatEntry(entry),
        entryLabel: formatEntryLabel(entry),
        entryCompact: formatEntryCompact(entry),
        module: moduleName(moduleKey),
        gale: finalNotificationProtection,
        protection: finalNotificationProtection,
        result: notificationResult,
      };
      const renderedMessage = !forceMessage && shouldRenderSignalTemplate(template, templateVariables)
        ? renderTemplate(template, templateVariables)
        : String(body.message || "");
      const message = formatTelegramMessageText(String(renderedMessage || body.message || renderTemplate("{{entry}}", templateVariables))).slice(0, 4096);
      const dedupeKeys = [`sent:${channel.userId}:${channel.id}:${moduleKey}:${signalKey}`];
      const entryDedupeKey = entrySignalDedupeKey(channel, moduleKey, roundId, entry, signalKind);
      if (entryDedupeKey) dedupeKeys.push(entryDedupeKey);
      const resultDedupeKey = resultSignalDedupeKey(channel, moduleKey, roundId, entry, signalKind, notificationResult);
      if (resultDedupeKey) dedupeKeys.push(resultDedupeKey);
      const recentDedupeKey = await recentMessageDedupeKey(channel, signalKind, message);
      if (recentDedupeKey) dedupeKeys.push(recentDedupeKey);
      let duplicateKey = "";
      for (const dedupeKey of dedupeKeys) {
        if (await this.state.storage.get(dedupeKey)) {
          duplicateKey = dedupeKey;
          break;
        }
      }
      if (duplicateKey) {
        console.warn(JSON.stringify(telegramWorkerLog("bloqueado", channel, moduleKey, config.enabled, "duplicate_signal", "")));
        blocked.push({ channelId: channel.id, reason: "duplicate_signal" });
        continue;
      }
      const buttons = telegramButtonsForSignal(config, channel, body);
      console.info(JSON.stringify(telegramWorkerLog("enviando", channel, moduleKey, config.enabled, "", message)));
      const result = await sendTelegramMessage({
        botToken: await this.decryptToken(channel.botTokenCipher),
        chatId: channel.chatId,
        message,
        buttonLabel: String(body.buttonLabel || DEFAULT_BUTTON_LABEL),
        buttonUrl: channel.buttonLink,
        buttons,
        parseMode: "HTML",
      });
      const signalHash = await hashText(signalKey);
      const notification = await this.storeNotification({
        id: `module:${moduleKey}:${channel.userId}:${channel.id}:${signalHash}`,
        type: `module:${moduleKey}`,
        userId: channel.userId,
        channelId: channel.id,
        roundId,
        status: result.ok ? "sent" : "error",
        error: result.ok ? "" : result.error,
        payloadJson: {
          moduleKey,
          signalKey,
          signalKind,
          variables: templateVariables,
          entrySide: entry,
          entry: formatEntry(entry),
          protection: finalNotificationProtection,
          galeLimit: config.galeLimit,
          coverTie: config.coverTie,
          tieCoverage: config.tieCoverage,
          result: notificationResult,
          telegramMessageId: result.messageId || null,
          buttonCount: buttons.length,
          cloudflare: true,
          forceMessage,
        },
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (result.ok) {
        for (const dedupeKey of dedupeKeys) {
          await this.state.storage.put(dedupeKey, true);
        }
      }
      if (result.ok && cooldownKey) await this.state.storage.put(cooldownKey, Date.now());
      if (result.ok && chatCode) sentChatCodes.add(chatCode);
      console[result.ok ? "info" : "warn"](
        JSON.stringify(telegramWorkerLog(result.ok ? "enviado" : "erro", channel, moduleKey, config.enabled, result.error || "", message, result)),
      );
      (result.ok ? sent : blocked).push({
        channelId: channel.id,
        notificationId: notification.id,
        reason: result.ok ? "sent_to_telegram" : "telegram_error",
        buttonCount: buttons.length,
        error: result.error || "",
      });
    }

    return json({ ok: true, sent, blocked }, 200, this.env);
  }

  async ensureDashboardMonitorAlarm(delayMs = DASHBOARD_MONITOR_INTERVAL_MS, force = false) {
    if (!legacyTelegramMonitorEnabled(this.env)) return;
    if (!this.state?.storage?.setAlarm) return;
    const currentAlarm = await this.state.storage.getAlarm?.();
    if (!force && currentAlarm && Number(currentAlarm) > Date.now()) return;
    await this.state.storage.setAlarm(Date.now() + Math.max(1000, Number(delayMs) || DASHBOARD_MONITOR_INTERVAL_MS));
  }

  async runDashboardMonitor({ source = "manual" } = {}) {
    if (!legacyTelegramMonitorEnabled(this.env)) {
      return json({ ok: true, source, skipped: "legacy_disabled" }, 200, this.env);
    }
    const now = Date.now();
    const lockUntil = Number(await this.state.storage.get("dashboard-monitor:lock") || 0);
    if (lockUntil > now) {
      return json({ ok: true, source, skipped: "locked" }, 200, this.env);
    }
    await this.state.storage.put("dashboard-monitor:lock", now + 15000);

    try {
      const dashboardResult = await this.fetchDashboardSnapshot();
      if (!dashboardResult.ok) {
        const log = {
          event: "[TELEGRAM_AUTO] erro",
          source,
          stage: "dashboard_fetch",
          status: dashboardResult.status || 0,
          reason: dashboardResult.error || "dashboard_unavailable",
          checkedAt: new Date().toISOString(),
        };
        await this.state.storage.put("dashboard-monitor:last", log);
        await this.ensureDashboardMonitorAlarm(DASHBOARD_MONITOR_ERROR_INTERVAL_MS, true);
        return json({ ok: false, ...log }, 502, this.env);
      }

      const officialDispatches = [];
      for (const officialCard of [
        readAiPatternsOfficialCard(dashboardResult.dashboard),
        readSurfOfficialCard(dashboardResult.dashboard),
      ]) {
        officialDispatches.push(await this.dispatchOfficialDashboardSignal(officialCard, source));
      }
      const officialResultDispatch = await this.dispatchPendingOfficialModuleResults(dashboardResult.dashboard, source);

      const resultCard = readPayingNumbersOfficialResult(dashboardResult.dashboard);
      const resultDispatch = await this.dispatchPayingNumbersOfficialResult(resultCard, source);
      const card = readPayingNumbersOfficialCard(dashboardResult.dashboard);
      const baseLog = {
        event: "[TELEGRAM_AUTO] card detectado",
        source,
        moduleKey: "paying_numbers",
        monitor_called: true,
        handler_called: true,
        resultStatus: resultCard.status || "",
        resultSignalId: resultCard.signalId || "",
        resultDispatch,
        readingMode: card.mode,
        cardStatus: card.status,
        expectedSide: card.entry || "",
        signalId: card.signalId || "",
        roundId: card.roundId || "",
        number: card.number || "",
        officialDispatches,
        officialResultDispatch,
        checkedAt: new Date().toISOString(),
      };

      if (!card.confirmed) {
        const log = {
          ...baseLog,
          confirmed: false,
          dedupe_action: "not_checked",
          telegram_send_called: false,
          telegram_result: "not_called",
        reason: card.reason,
        resultDispatch,
        officialResultDispatch,
      };
        await this.markPayingNumbersBaselineReady(card);
        await this.state.storage.put("dashboard-monitor:last", log);
        return json({ ok: true, ...log }, 200, this.env);
      }

      const baseline = await this.shouldSuppressPayingNumbersBaseline(card);
      if (baseline.suppressed) {
        const log = {
          ...baseLog,
          confirmed: true,
          dedupe_action: "baseline_suppressed",
          telegram_send_called: false,
          telegram_result: "not_called",
          reason: baseline.reason,
          resultDispatch,
          officialResultDispatch,
        };
        await this.state.storage.put("dashboard-monitor:last", log);
        return json({ ok: true, ...log }, 200, this.env);
      }

      const response = await this.dispatchSignal({
        moduleKey: "paying_numbers",
        signalKey: card.signalId,
        roundId: card.roundIdNumber,
        entry: card.entry,
        result: "Aguardando resultado",
        variables: card.variables,
      });
      const dispatch = await response.json().catch(() => ({}));
      const sentCount = Array.isArray(dispatch.sent) ? dispatch.sent.length : 0;
      const blockedCount = Array.isArray(dispatch.blocked) ? dispatch.blocked.length : 0;
      const log = {
        ...baseLog,
        confirmed: true,
        activeChannels: sentCount + blockedCount,
        sentCount,
        blockedCount,
        dedupe_action: sentCount ? "reserved" : "blocked",
        telegram_send_called: sentCount > 0,
        telegram_result: sentCount ? "sent" : "not_sent",
        resultDispatch,
        officialResultDispatch,
        dispatch,
      };
      await this.state.storage.put("dashboard-monitor:last", log);
      return json({ ok: true, ...log }, 200, this.env);
    } finally {
      await this.state.storage.delete("dashboard-monitor:lock");
      await this.ensureDashboardMonitorAlarm(DASHBOARD_MONITOR_INTERVAL_MS, true);
    }
  }

  async fetchDashboardSnapshot() {
    const url = dashboardMonitorUrl(this.env);
    const secrets = dashboardMonitorSecrets(this.env);
    if (!secrets.length) return { ok: false, status: 0, error: "dashboard_token_missing" };

    let lastError = { ok: false, status: 0, error: "dashboard_not_requested" };
    for (const token of secrets) {
      const response = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          "user-agent": "sniperbo-telegram-engine-monitor",
        },
      }).catch((error) => ({ ok: false, status: 0, text: async () => errorMessage(error) }));
      const text = await response.text().catch(() => "");
      if (!response.ok) {
        lastError = { ok: false, status: response.status || 0, error: text.slice(0, 240) };
        continue;
      }
      try {
        const payload = JSON.parse(text);
        return { ok: true, status: response.status || 200, dashboard: readRecord(payload.dashboard || payload) };
      } catch (error) {
        lastError = { ok: false, status: response.status || 200, error: `dashboard_json_invalid:${errorMessage(error)}` };
      }
    }
    return lastError;
  }

  async dispatchPayingNumbersOfficialResult(resultCard, source) {
    if (!resultCard.confirmed) {
      return {
        ok: true,
        sentCount: 0,
        blockedCount: 0,
        reason: resultCard.reason,
        dedupe_action: "not_checked",
        telegram_send_called: false,
      };
    }

    const baseline = await this.shouldSuppressPayingNumbersResultBaseline(resultCard);
    if (baseline.suppressed) {
      return {
        ok: true,
        sentCount: 0,
        blockedCount: 0,
        reason: baseline.reason,
        signalId: resultCard.signalId,
        dedupe_action: "baseline_suppressed",
        telegram_send_called: false,
      };
    }

    const response = await this.dispatchSignal({
      moduleKey: "paying_numbers",
      signalKey: resultCard.signalId,
      roundId: resultCard.roundIdNumber,
      entry: resultCard.entry,
      result: resultCard.label,
      protection: resultCard.protection,
      variables: resultCard.variables,
    });
    const dispatch = await response.json().catch(() => ({}));
    const sentCount = Array.isArray(dispatch.sent) ? dispatch.sent.length : 0;
    const blockedCount = Array.isArray(dispatch.blocked) ? dispatch.blocked.length : 0;
    const payload = {
      ok: true,
      source,
      signalId: resultCard.signalId,
      label: resultCard.label,
      status: resultCard.status,
      sentCount,
      blockedCount,
      dedupe_action: sentCount ? "reserved" : "blocked",
      telegram_send_called: sentCount > 0,
      telegram_result: sentCount ? "sent" : "not_sent",
      dispatch,
    };
    await this.state.storage.put("dashboard-monitor:last-result", {
      event: "[TELEGRAM_AUTO] resultado",
      checkedAt: new Date().toISOString(),
      ...payload,
    });
    return payload;
  }

  async dispatchPendingOfficialModuleResults(dashboard, source) {
    const rounds = dashboardRounds(dashboard);
    if (rounds.length < 2) {
      return { ok: true, source, checked: 0, sentCount: 0, blockedCount: 0, reason: "not_enough_rounds" };
    }

    const rows = await this.state.storage.list({ prefix: "notification:" });
    const candidates = [...rows.entries()]
      .map(([key, notification]) => ({ key, notification: readRecord(notification) }))
      .filter(({ notification }) => isPendingOfficialEntryNotification(notification))
      .slice(-200);

    let sentCount = 0;
    let blockedCount = 0;
    let pendingCount = 0;
    const details = [];

    for (const item of candidates) {
      const notification = item.notification;
      const payload = readRecord(notification.payloadJson);
      const moduleKey = normalizeModuleKey(payload.moduleKey || String(notification.type || "").replace("module:", ""));
      const channel = await this.getChannel(notification.userId, notification.channelId);
      if (!channel || !channel.isActive) {
        blockedCount += 1;
        details.push({ id: notification.id, moduleKey, reason: "channel_inactive_or_missing" });
        continue;
      }
      const config = normalizeModuleConfigs(channel.signalModules || {})[moduleKey];
      if (!config?.enabled) {
        blockedCount += 1;
        details.push({ id: notification.id, moduleKey, reason: "module_inactive" });
        continue;
      }

      const resolution = resolveOfficialNotificationResult(notification, rounds, config);
      if (!resolution.ready) {
        pendingCount += 1;
        details.push({ id: notification.id, moduleKey, reason: resolution.reason, roundId: notification.roundId });
        continue;
      }

      const response = await this.dispatchSignal({
        moduleKey,
        userId: notification.userId,
        channelId: notification.channelId,
        signalKey: `${payload.signalKey || notification.id}:result:${resolution.resultRoundKey}:${resolution.label}`,
        roundId: resolution.resultRoundId,
        entry: resolution.entry,
        result: resolution.label,
        protection: resolution.protection,
        variables: {
          ...readRecord(payload.variables),
          entry: formatEntry(resolution.entry),
          entryLabel: formatEntryLabel(resolution.entry),
          entryCompact: formatEntryCompact(resolution.entry),
          side: resolution.entry,
          result: resolution.label,
          gale: resolution.protection,
          protection: resolution.protection,
          tieMultiplier: resolution.tieMultiplier ? `${resolution.tieMultiplier}x` : "",
          round: resolution.resultRoundKey,
          roundId: resolution.resultRoundId,
          time: dashboardText(resolution.resultRound.time || resolution.resultRound.recordedAt || resolution.resultRound.createdAt || ""),
        },
      });
      const dispatch = await response.json().catch(() => ({}));
      const currentSent = Array.isArray(dispatch.sent) ? dispatch.sent.length : 0;
      const currentBlocked = Array.isArray(dispatch.blocked) ? dispatch.blocked.length : 0;
      sentCount += currentSent;
      blockedCount += currentBlocked;
      if (currentSent || hasDuplicateSignalBlock(dispatch)) {
        await this.storeNotification({
          ...notification,
          status: resolution.status,
          error: "",
          payloadJson: {
            ...payload,
            result: resolution.label,
            resultStatus: resolution.status,
            resultRoundId: resolution.resultRoundId,
            resultRoundKey: resolution.resultRoundKey,
            resultSentAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        });
      }
      details.push({
        id: notification.id,
        moduleKey,
        result: resolution.label,
        sentCount: currentSent,
        blockedCount: currentBlocked,
      });
    }

    const summary = {
      ok: true,
      source,
      checked: candidates.length,
      sentCount,
      blockedCount,
      pendingCount,
      details: details.slice(-20),
      checkedAt: new Date().toISOString(),
    };
    await this.state.storage.put("dashboard-monitor:last-official-results", summary);
    return summary;
  }

  async dispatchOfficialDashboardSignal(card, source) {
    const baseLog = {
      event: "[TELEGRAM_AUTO] card detectado",
      source,
      moduleKey: card.moduleKey || "",
      monitor_called: true,
      handler_called: true,
      readingMode: card.mode || "",
      cardStatus: card.status || "",
      expectedSide: card.entry || "",
      signalId: card.signalId || "",
      roundId: card.roundId || "",
      checkedAt: new Date().toISOString(),
    };

    if (!card.confirmed) {
      await this.markOfficialDashboardSignalBaselineReady(card);
      const payload = {
        ...baseLog,
        confirmed: false,
        reason: card.reason || "not_confirmed",
        dedupe_action: "not_checked",
        telegram_send_called: false,
        telegram_result: "not_called",
      };
      await this.state.storage.put(`dashboard-monitor:last:${card.moduleKey}`, payload);
      return payload;
    }

    const baseline = await this.shouldSuppressOfficialDashboardSignalBaseline(card);
    if (baseline.suppressed) {
      const payload = {
        ...baseLog,
        confirmed: true,
        reason: baseline.reason,
        dedupe_action: "baseline_suppressed",
        telegram_send_called: false,
        telegram_result: "not_called",
      };
      await this.state.storage.put(`dashboard-monitor:last:${card.moduleKey}`, payload);
      return payload;
    }

    const response = await this.dispatchSignal({
      moduleKey: card.moduleKey,
      signalKey: card.signalId,
      roundId: card.roundIdNumber,
      entry: card.entry,
      result: "Aguardando resultado",
      variables: card.variables,
    });
    const dispatch = await response.json().catch(() => ({}));
    const sentCount = Array.isArray(dispatch.sent) ? dispatch.sent.length : 0;
    const blockedCount = Array.isArray(dispatch.blocked) ? dispatch.blocked.length : 0;
    const payload = {
      ...baseLog,
      confirmed: true,
      activeChannels: sentCount + blockedCount,
      sentCount,
      blockedCount,
      dedupe_action: sentCount ? "reserved" : "blocked",
      telegram_send_called: sentCount > 0,
      telegram_result: sentCount ? "sent" : "not_sent",
      dispatch,
    };
    await this.state.storage.put(`dashboard-monitor:last:${card.moduleKey}`, payload);
    return payload;
  }

  async markOfficialDashboardSignalBaselineReady(card) {
    if (!card?.moduleKey) return;
    const key = `dashboard-monitor:${card.moduleKey}:baseline-ready`;
    if (await this.state.storage.get(key)) return;
    await this.state.storage.put(key, {
      readyAt: new Date().toISOString(),
      firstSignalId: card.signalId || "",
      firstMode: card.mode || "",
      firstReason: card.reason || "",
    });
  }

  async shouldSuppressOfficialDashboardSignalBaseline(card) {
    const key = `dashboard-monitor:${card.moduleKey}:baseline-ready`;
    const existing = await this.state.storage.get(key);
    if (existing) return { suppressed: false, reason: "" };
    await this.state.storage.put(key, {
      readyAt: new Date().toISOString(),
      firstSignalId: card.signalId || "",
      firstMode: card.mode || "",
      firstReason: "active_on_monitor_start",
    });
    return { suppressed: true, reason: "active_on_monitor_start" };
  }

  async markPayingNumbersBaselineReady(card) {
    const key = "dashboard-monitor:paying_numbers:baseline-ready";
    if (await this.state.storage.get(key)) return;
    await this.state.storage.put(key, {
      readyAt: new Date().toISOString(),
      firstSignalId: card.signalId || "",
      firstMode: card.mode || "",
      firstReason: card.reason || "",
    });
  }

  async shouldSuppressPayingNumbersBaseline(card) {
    const key = "dashboard-monitor:paying_numbers:baseline-ready";
    const existing = await this.state.storage.get(key);
    if (existing) return { suppressed: false, reason: "" };
    await this.state.storage.put(key, {
      readyAt: new Date().toISOString(),
      firstSignalId: card.signalId || "",
      firstMode: card.mode || "",
      firstReason: "active_on_monitor_start",
    });
    return { suppressed: true, reason: "active_on_monitor_start" };
  }

  async shouldSuppressPayingNumbersResultBaseline(resultCard) {
    const key = "dashboard-monitor:paying_numbers:result-baseline-ready";
    const existing = await this.state.storage.get(key);
    if (existing) return { suppressed: false, reason: "" };

    const finishedAtMs = Date.parse(resultCard.finishedAt || "");
    const ageMs = Number.isFinite(finishedAtMs) ? Date.now() - finishedAtMs : 0;
    await this.state.storage.put(key, {
      readyAt: new Date().toISOString(),
      firstSignalId: resultCard.signalId || "",
      firstFinishedAt: resultCard.finishedAt || "",
      firstAgeMs: ageMs,
    });
    if (ageMs > 120000) return { suppressed: true, reason: "old_result_on_monitor_start" };
    return { suppressed: false, reason: "" };
  }

  async sendAdHocTelegram(body) {
    const result = await sendTelegramMessage({
      botToken: normalizeSecret(readFirstString(body, ["botToken", "bot_token", "telegram_bot_token"])),
      chatId: readFirstString(body, ["chatId", "chat_id", "telegram_chat_id", "channel_id", "group_id"]),
      message: String(body.message || "").slice(0, 4096),
      buttonLabel: String(body.buttonLabel || ""),
      buttonUrl: normalizeUrl(String(body.buttonLink || body.buttonUrl || "")),
      parseMode: "HTML",
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({ ok: true, messageId: result.messageId }, 200, this.env);
  }

  async moveChannel(body) {
    const sourceUserId = normalizeUserId(body.sourceUserId || "");
    const targetUserId = normalizeUserId(body.targetUserId || "");
    const channelId = String(body.channelId || "").trim();
    if (!sourceUserId || !targetUserId) return json({ error: "Usuarios obrigatorios." }, 400, this.env);
    if (sourceUserId === targetUserId) return json({ ok: true, moved: false, reason: "same_user" }, 200, this.env);

    const sourceChannels = await this.channelsForUser(sourceUserId);
    const channel = channelId
      ? sourceChannels.find((item) => item.id === channelId)
      : sourceChannels[0];
    if (!channel) return json({ error: "Canal origem nao encontrado." }, 404, this.env);

    const duplicate = await this.findUserChannelByChatId(targetUserId, channel.chatId);
    if (duplicate && duplicate.id !== channel.id) {
      return json({ error: "Usuario destino ja tem canal com este Chat ID/codigo." }, 409, this.env);
    }

    const now = new Date().toISOString();
    const moved = {
      ...channel,
      userId: targetUserId,
      updatedAt: now,
    };
    await this.state.storage.put(channelKey(targetUserId, moved.id), moved);
    await this.state.storage.delete(channelKey(sourceUserId, channel.id));
    if (moved.chatId) await this.state.storage.delete(deletedCodeKey(targetUserId, moved.chatId));
    return json({ ok: true, moved: true, channel: publicChannel(moved) }, 200, this.env);
  }

  async publicChannelsForUser(userId) {
    await this.ensureUserWorkspace(userId, { source: "panel" });
    return (await this.channelsForUser(userId))
      .map(publicChannel)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async activePublicChannels() {
    return (await this.activeChannels()).map(publicChannel);
  }

  async channelsForUser(userId) {
    const access = await this.userAccessState(userId);
    if (!access.active) return [];
    const rows = await this.state.storage.list({ prefix: `channel:${userId}:` });
    const deletedCodes = await this.deletedCodesForUser(userId);
    return [...rows.values()]
      .filter((channel) => channel && channel.userId === userId)
      .filter((channel) => !deletedCodes.has(channel.chatCode));
  }

  async activeChannels() {
    const rows = await this.state.storage.list({ prefix: "channel:" });
    const channels = [...rows.values()].filter((channel) => channel?.isActive);
    const allowed = [];
    for (const channel of channels) {
      const access = await this.userAccessState(channel.userId);
      const deletedCodes = await this.deletedCodesForUser(channel.userId);
      if (access.active && !deletedCodes.has(channel.chatCode)) allowed.push(channel);
    }
    return allowed;
  }

  async provisionUserWorkspace(body) {
    const userId = normalizeUserId(body.userId || body.email || "");
    if (!userId) return json({ error: "Usuario obrigatorio." }, 400, this.env);
    const workspace = await this.ensureUserWorkspace(userId, {
      active: body.active !== false,
      plan: String(body.plan || "premium"),
      expiresAt: String(body.expiresAt || body.expires_at || ""),
      graceDays: clampInt(body.graceDays ?? body.grace_days ?? DEFAULT_ACCESS_GRACE_DAYS, 0, 30),
      source: String(body.source || "premium"),
    });
    const access = await this.userAccessState(userId);
    return json({ ok: true, workspace: publicWorkspace(workspace), access }, 200, this.env);
  }

  async expireUserWorkspace(body) {
    const userId = normalizeUserId(body.userId || body.email || "");
    if (!userId) return json({ error: "Usuario obrigatorio." }, 400, this.env);
    const now = new Date().toISOString();
    const existing = await this.getUserWorkspace(userId);
    const expiresAt = String(body.expiresAt || body.expires_at || existing?.expiresAt || now);
    const graceDays = clampInt(body.graceDays ?? body.grace_days ?? existing?.graceDays ?? DEFAULT_ACCESS_GRACE_DAYS, 0, 30);
    const cleanupAfter = addDaysIso(expiresAt || now, graceDays);
    const workspace = {
      ...(existing || {}),
      userId,
      active: false,
      plan: String(body.plan || existing?.plan || "expired"),
      expiresAt,
      graceDays,
      cleanupAfter,
      source: String(body.source || "expired"),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await this.state.storage.put(userKey(userId), workspace);
    let cleaned = false;
    if (body.force === true || isoTimeMs(cleanupAfter) <= Date.now()) {
      cleaned = await this.cleanupUserData(userId, "expired");
      await this.state.storage.put(userKey(userId), { ...workspace, cleanedAt: new Date().toISOString() });
    }
    return json({ ok: true, workspace: publicWorkspace(workspace), cleaned }, 200, this.env);
  }

  async ensureUserWorkspace(userId, patch = {}) {
    const normalizedUserId = normalizeUserId(userId);
    const now = new Date().toISOString();
    const existing = await this.getUserWorkspace(normalizedUserId);
    const expiresAt = String(patch.expiresAt || patch.expires_at || existing?.expiresAt || "");
    const graceDays = clampInt(patch.graceDays ?? patch.grace_days ?? existing?.graceDays ?? DEFAULT_ACCESS_GRACE_DAYS, 0, 30);
    const workspace = {
      ...(existing || {}),
      userId: normalizedUserId,
      active: patch.active !== undefined ? Boolean(patch.active) : existing?.active !== false,
      plan: String(patch.plan || existing?.plan || "premium"),
      expiresAt,
      graceDays,
      cleanupAfter: expiresAt ? addDaysIso(expiresAt, graceDays) : String(existing?.cleanupAfter || ""),
      source: String(patch.source || existing?.source || "auto"),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await this.state.storage.put(userKey(normalizedUserId), workspace);
    return workspace;
  }

  async getUserWorkspace(userId) {
    return await this.state.storage.get(userKey(userId)) || null;
  }

  async userAccessState(userId) {
    const normalizedUserId = normalizeUserId(userId);
    if (!normalizedUserId) return { active: false, reason: "missing_user" };
    const workspace = await this.getUserWorkspace(normalizedUserId);
    if (!workspace) return { active: true, reason: "legacy_unprovisioned" };
    const expiresAt = String(workspace.expiresAt || "");
    const expired = expiresAt ? isoTimeMs(expiresAt) <= Date.now() : false;
    if (expired || workspace.active === false) {
      const cleanupAfter = String(workspace.cleanupAfter || (expiresAt ? addDaysIso(expiresAt, workspace.graceDays || DEFAULT_ACCESS_GRACE_DAYS) : ""));
      if (cleanupAfter && isoTimeMs(cleanupAfter) <= Date.now() && !workspace.cleanedAt) {
        await this.cleanupUserData(normalizedUserId, "expired_grace");
        await this.state.storage.put(userKey(normalizedUserId), {
          ...workspace,
          active: false,
          cleanupAfter,
          cleanedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return { active: false, reason: expired ? "expired" : "inactive", expiresAt, cleanupAfter };
    }
    return { active: true, reason: "active", expiresAt };
  }

  async cleanupUserData(userId, reason) {
    const normalizedUserId = normalizeUserId(userId);
    const prefixes = [
      `channel:${normalizedUserId}:`,
      `notification:${normalizedUserId}:`,
      `deleted:${normalizedUserId}:`,
      `cooldown:${normalizedUserId}:`,
      `sent:${normalizedUserId}:`,
      `sent-entry:${normalizedUserId}:`,
      `sent-result:${normalizedUserId}:`,
      `sent-recent:${normalizedUserId}:`,
    ];
    let deleted = 0;
    for (const prefix of prefixes) {
      const rows = await this.state.storage.list({ prefix });
      if (!rows.size) continue;
      await Promise.all([...rows.keys()].map((key) => this.state.storage.delete(key)));
      deleted += rows.size;
    }
    await this.state.storage.put(`cleanup:${normalizedUserId}:${Date.now()}`, {
      userId: normalizedUserId,
      reason,
      deleted,
      cleanedAt: new Date().toISOString(),
    });
    return deleted > 0;
  }

  async getChannel(userId, channelId) {
    const channel = (await this.state.storage.get(channelKey(userId, channelId))) || null;
    if (!channel) return null;
    const deletedCodes = await this.deletedCodesForUser(userId);
    return deletedCodes.has(channel.chatCode) ? null : channel;
  }

  async findUserChannelByChatId(userId, chatId) {
    const code = normalizeChannelCode(chatId);
    if (!code) return null;
    return (await this.channelsForUser(userId)).find((channel) => channel.chatCode === code) || null;
  }

  async findAnyChannelByChatId(chatId) {
    const code = normalizeChannelCode(chatId);
    if (!code) return null;
    const rows = await this.state.storage.list({ prefix: "channel:" });
    for (const channel of rows.values()) {
      if (normalizeChannelCode(channel?.chatId) !== code) continue;
      const deletedCodes = await this.deletedCodesForUser(channel.userId);
      if (!deletedCodes.has(code)) return channel;
    }
    return null;
  }

  async deletedCodesForUser(userId) {
    const rows = await this.state.storage.list({ prefix: `deleted:${userId}:code:` });
    return new Set([...rows.values()].map((row) => row.chatCode).filter(Boolean));
  }

  async notificationsForUser(userId) {
    const rows = await this.state.storage.list({ prefix: `notification:${userId}:` });
    return [...rows.values()]
      .sort((a, b) => Date.parse(b.updatedAt || b.sentAt || "") - Date.parse(a.updatedAt || a.sentAt || ""))
      .slice(0, 50);
  }

  async storeNotification(notification) {
    await this.state.storage.put(`notification:${notification.userId}:${notification.id}`, notification);
    const rows = await this.state.storage.list({ prefix: `notification:${notification.userId}:` });
    if (rows.size > MAX_NOTIFICATIONS) {
      const extra = [...rows.entries()]
        .sort((a, b) => Date.parse(a[1].updatedAt || a[1].sentAt || "") - Date.parse(b[1].updatedAt || b[1].sentAt || ""))
        .slice(0, rows.size - MAX_NOTIFICATIONS);
      await Promise.all(extra.map(([key]) => this.state.storage.delete(key)));
    }
    return notification;
  }

  async validationCode(userId, botToken, chatId) {
    const bucket = Math.floor(Date.now() / 600000);
    const signature = await hmacSha256(this.env.ENGINE_API_SECRET || "", [
      userId,
      normalizeSecret(botToken),
      normalizeChannelCode(chatId),
      String(bucket),
    ].join("|"));
    return `${bucket}.${signature}`;
  }

  async verifyValidationCode(userId, botToken, chatId, validationCode) {
    const [bucketText, signature] = String(validationCode || "").split(".");
    const bucket = Number(bucketText);
    if (!Number.isFinite(bucket) || !signature) return false;
    const nowBucket = Math.floor(Date.now() / 600000);
    if (bucket < nowBucket - 1 || bucket > nowBucket) return false;
    const expected = await hmacSha256(this.env.ENGINE_API_SECRET || "", [
      userId,
      normalizeSecret(botToken),
      normalizeChannelCode(chatId),
      String(bucket),
    ].join("|"));
    return timingSafeEqual(signature, expected);
  }

  async encryptToken(token) {
    const key = await this.aesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(token);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    return `aesgcm:${base64Url(iv)}:${base64Url(new Uint8Array(cipher))}`;
  }

  async decryptToken(cipherText) {
    const parts = String(cipherText || "").split(":");
    if (parts.length !== 3 || parts[0] !== "aesgcm") return "";
    const key = await this.aesKey();
    const iv = base64UrlDecode(parts[1]);
    const cipher = base64UrlDecode(parts[2]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plain);
  }

  async aesKey() {
    const secret = this.env.TOKEN_ENCRYPTION_KEY || this.env.ENGINE_API_SECRET || "";
    if (!secret) throw new Error("TOKEN_ENCRYPTION_KEY missing");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
}

function dashboardMonitorUrl(env = {}) {
  return normalizeUrl(env.SNIPER_DASHBOARD_URL || "") || "https://sniperbo.com/dashboard";
}

function dashboardMonitorSecrets(env = {}) {
  return [
    env.SNIPER_DASHBOARD_TOKEN,
    env.SNIPER_PUBLISHER_TOKEN,
    env.SNIPER_ADMIN_TOKEN,
  ].map(normalizeSecret).filter(Boolean);
}

function readAiPatternsOfficialCard(dashboard) {
  const data = readRecord(dashboard);
  const snapshot = readRecord(data.patternMinerSnapshot || data.patternMiner);
  const entryAlerts = Array.isArray(snapshot.entryAlerts) ? snapshot.entryAlerts.map(readRecord) : [];
  const alert = entryAlerts[0] || {};
  const strategy = readRecord(alert.strategy);
  const entry = normalizeEntry(strategy.expectedResult);
  const sequence = Array.isArray(strategy.sequence)
    ? strategy.sequence.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const matchedRounds = Array.isArray(alert.matchedRounds) ? alert.matchedRounds.map(readRecord) : [];
  const matchedRound = matchedRounds.at(-1) || latestDashboardRound(data);
  const roundId = dashboardRoundKey(matchedRound, data) || dashboardRoundKey(latestDashboardRound(data), data);
  const roundIdNumber = clampInt(matchedRound.id ?? matchedRound.roundId ?? matchedRound.round ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const kind = dashboardText(alert.kind || "").toLowerCase();
  const title = dashboardText(alert.title || "");
  const status = dashboardText(strategy.status || title || "CONFIRMADO");

  if (!Object.keys(alert).length) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "no_confirmed_pattern_card", mode: "EMPTY", status: "" };
  }
  if (kind && kind !== "validated" && !normalizeSearchText(title).includes("VALIDAD") && !normalizeSearchText(title).includes("CONFIRM")) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "pattern_not_validated", mode: kind, status };
  }
  if (!entry) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "missing_expected_side", mode: kind || "validated", status };
  }
  if (!sequence.length) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "missing_pattern_sequence", mode: kind || "validated", status, entry };
  }
  if (!roundId) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "missing_round_id", mode: kind || "validated", status, entry };
  }

  const pattern = formatDashboardPatternSequenceText(sequence);
  const alertId = dashboardText(alert.id || strategy.id || sequence.join(">"));
  const signalId = ["ai-patterns", alertId || "sem-alerta", roundId, entry, pattern].join(":");
  const confidence = formatDashboardPercent(strategy.assertiveness);
  return {
    moduleKey: "ai_patterns",
    confirmed: true,
    reason: "confirmed_pattern_card",
    mode: kind || "validated",
    status,
    entry,
    roundId,
    roundIdNumber,
    signalId,
    variables: {
      table: "Bac Bo",
      pattern,
      number: "",
      numbers: pattern,
      entry: formatEntry(entry),
      entryLabel: formatEntryLabel(entry),
      entryCompact: formatEntryCompact(entry),
      side: entry,
      status: status || "CONFIRMADO",
      confidence,
      percentage: confidence,
      gale: "G1",
      protection: "G1",
      tieCoverage: "1",
      tieProtection: "Ativa",
      risk: status || "CONFIRMADO",
      level: status || "CONFIRMADO",
      score: dashboardText(strategy.totalValidated || ""),
      round: roundId,
      roundId: roundIdNumber,
      time: dashboardText(matchedRound.time || matchedRound.recordedAt || matchedRound.createdAt || ""),
      module: "Padroes IA",
      result: "Aguardando resultado",
    },
  };
}

function readSurfOfficialCard(dashboard) {
  const data = readRecord(dashboard);
  const alert = readRecord(data.currentSurfAlert);
  const latestRound = latestDashboardRound(data);
  const roundId = dashboardRoundKey(latestRound, data);
  const roundIdNumber = clampInt(latestRound.id ?? latestRound.roundId ?? latestRound.round ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const confidence = clampPercentValue(alert.surf_confidence ?? alert.confidence ?? alert.confianca);
  const risk = clampPercentValue(alert.surf_break_risk ?? alert.surf_risk ?? alert.risk);
  const rawSide = alert.surf_prediction_side && normalizeSearchText(alert.surf_prediction_side) !== "NONE"
    ? alert.surf_prediction_side
    : alert.surf_side;
  const entry = normalizeEntry(rawSide);
  const status = dashboardText(alert.surf_status || alert.status || alert.surf_phase || alert.phase || "");
  const mode = confidence >= 89 && entry && entry !== "TIE" ? "FOLLOW" : "WAIT";

  if (!Object.keys(alert).length) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "surf_card_missing", mode: "EMPTY", status };
  }
  if (!entry || entry === "TIE") {
    return { moduleKey: "surf_alert", confirmed: false, reason: "surf_without_valid_side", mode, status, entry };
  }
  if (confidence < 89) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "surf_not_confirmed", mode, status, entry };
  }
  if (!roundId) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "missing_round_id", mode, status, entry };
  }

  const signalId = ["surf", "Bac Bo", entry, roundId, Math.round(confidence), Math.round(risk)].join(":");
  return {
    moduleKey: "surf_alert",
    confirmed: true,
    reason: "confirmed_surf_card",
    mode,
    status: status || "CONFIRMADO",
    entry,
    roundId,
    roundIdNumber,
    signalId,
    variables: {
      table: "Bac Bo",
      pattern: "",
      number: "",
      numbers: "",
      entry: formatEntry(entry),
      entryLabel: formatEntryLabel(entry),
      entryCompact: formatEntryCompact(entry),
      side: entry,
      status: status || "CONFIRMADO",
      confidence: formatDashboardPercent(confidence),
      percentage: formatDashboardPercent(confidence),
      gale: "G1",
      protection: "G1",
      tieCoverage: "1",
      tieProtection: "Ativa",
      risk: formatDashboardPercent(risk),
      level: status || "",
      score: "",
      round: roundId,
      roundId: roundIdNumber,
      time: dashboardText(latestRound.time || latestRound.recordedAt || latestRound.createdAt || ""),
      module: "Aviso de Surf",
      result: "Aguardando resultado",
    },
  };
}

function readPayingNumbersOfficialCard(dashboard) {
  const data = readRecord(dashboard);
  const reading = readRecord(data.neuralReading);
  const mode = String(reading.mode || "").trim().toUpperCase();
  const entry = normalizeEntry(reading.direcao || reading.origem || reading.expectedSide || "");
  const latestRound = latestDashboardRound(data);
  const roundId = dashboardRoundKey(latestRound, data);
  const roundIdNumber = clampInt(latestRound.id ?? latestRound.roundId ?? latestRound.round ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const number = dashboardNumber(reading.numero ?? reading.number);
  const status = String(reading.paganteStatus || reading.status || "ENTRADA_CONFIRMADA").trim();

  if (mode !== "ACTIVE") {
    return { confirmed: false, reason: "card_not_active", mode, status, entry, roundId, roundIdNumber, number };
  }
  if (!entry) {
    return { confirmed: false, reason: "missing_expected_side", mode, status, entry, roundId, roundIdNumber, number };
  }
  if (!roundId) {
    return { confirmed: false, reason: "missing_round_id", mode, status, entry, roundId, roundIdNumber, number };
  }

  const signalId = ["paying", "Bac Bo", number || "sem-numero", entry, roundId].join(":");
  const confidence = formatDashboardPercent(reading.assertividade ?? reading.confidence ?? reading.percentage);
  const numberText = `${telegramSideCircle(entry)}${number || ""}`;
  return {
    confirmed: true,
    reason: "confirmed_entry_card",
    mode,
    status,
    entry,
    roundId,
    roundIdNumber,
    number,
    signalId,
    variables: {
      table: "Bac Bo",
      pattern: "",
      number: numberText,
      numbers: numberText,
      entry: formatEntry(entry),
      entryLabel: formatEntryLabel(entry),
      entryCompact: formatEntryCompact(entry),
      side: entry,
      status: status || "ENTRADA_CONFIRMADA",
      confidence,
      percentage: confidence,
      gale: normalizeGaleText(reading.validade || "G1"),
      protection: normalizeGaleText(reading.validade || "G1"),
      tieCoverage: "0",
      tieProtection: "Inativa",
      risk: dashboardText(reading.paganteKind || reading.origemTipo || ""),
      level: dashboardText(reading.level || ""),
      score: dashboardText(reading.score || ""),
      round: roundId,
      roundId: roundIdNumber,
      time: dashboardText(latestRound.time || ""),
      module: "Numeros Pagantes",
      result: "Aguardando resultado",
    },
  };
}

function readPayingNumbersOfficialResult(dashboard) {
  const data = readRecord(dashboard);
  const result = readRecord(data.neuralEntryLastResult);
  if (!Object.keys(result).length || !result.id) {
    return { confirmed: false, reason: "result_missing", status: "", signalId: "" };
  }

  const snapshot = readRecord(result.readingSnapshot);
  const entry = normalizeEntry(result.expectedSide || result.origem || snapshot.direcao || snapshot.origem || "");
  const outcome = String(result.outcome || "").trim().toUpperCase();
  const kind = String(result.kind || "").trim().toLowerCase();
  const resultRoundKey = dashboardText(result.resultRoundKey || "");
  const resultRoundId = parseRoundIdFromKey(resultRoundKey) || clampInt(result.roundId ?? result.resultRoundId ?? 0, 0, Number.MAX_SAFE_INTEGER);
  const number = dashboardNumber(result.numero ?? snapshot.numero);
  const tieMultiplier = dashboardNumber(result.tieMultiplier);
  if (!entry) return { confirmed: false, reason: "result_missing_entry", status: outcome || kind, signalId: "" };
  if (!outcome && !kind) return { confirmed: false, reason: "result_missing_status", status: "", signalId: "" };

  const resultLabel = payingNumbersResultLabel(outcome, kind, tieMultiplier);
  const protection = payingNumbersResultProtection(kind);
  const status = outcome || kind.toUpperCase();
  const signalId = ["paying", "Bac Bo", "result", result.id, resultRoundKey || resultRoundId || "sem-rodada", status].join(":");
  const confidence = formatDashboardPercent(snapshot.assertividade ?? result.assertividade ?? result.confidence);
  const numberText = `${telegramSideCircle(entry)}${number || ""}`;

  return {
    confirmed: true,
    reason: "official_result",
    entry,
    outcome,
    kind,
    status,
    label: resultLabel,
    protection,
    signalId,
    roundId: resultRoundKey,
    roundIdNumber: resultRoundId,
    number,
    finishedAt: dashboardText(result.finishedAt || ""),
    variables: {
      table: "Bac Bo",
      pattern: "",
      number: numberText,
      numbers: numberText,
      entry: formatEntry(entry),
      entryLabel: formatEntryLabel(entry),
      entryCompact: formatEntryCompact(entry),
      side: entry,
      status,
      confidence,
      percentage: confidence,
      gale: protection,
      protection,
      tieCoverage: "0",
      tieProtection: "Inativa",
      tieMultiplier: tieMultiplier ? `${tieMultiplier}x` : "",
      result: resultLabel,
      round: resultRoundKey || String(resultRoundId || ""),
      roundId: resultRoundId,
      time: dashboardText(result.finishedAt || ""),
      module: "Numeros Pagantes",
    },
  };
}

function payingNumbersResultLabel(outcome, kind, tieMultiplier) {
  if (outcome === "TIE" || kind === "tie_sg" || kind === "tie_g1") {
    return tieMultiplier ? `Green no empate ${tieMultiplier}x` : "Green no empate";
  }
  if (outcome === "RED" || kind === "red") return "Red";
  if (kind === "g1") return "Green G1";
  return "Green";
}

function payingNumbersResultProtection(kind) {
  if (kind === "g1" || kind === "tie_g1" || kind === "red") return "G1";
  return "SG";
}

function isPendingOfficialEntryNotification(notification) {
  const payload = readRecord(notification.payloadJson);
  const moduleKey = normalizeModuleKey(payload.moduleKey || String(notification.type || "").replace("module:", ""));
  if (!["ai_patterns", "paying_numbers", "surf_alert", "ties_only", "validator"].includes(moduleKey)) return false;
  if (payload.resultSentAt || payload.resultStatus) return false;
  if (payload.signalKind && payload.signalKind !== "entry") return false;
  if (String(notification.status || "") !== "sent") return false;
  const result = normalizeDedupeText(payload.result || "");
  return !result || result === "aguardando_resultado" || result === "aguardando";
}

function resolveOfficialNotificationResult(notification, rounds, config) {
  const payload = readRecord(notification.payloadJson);
  const moduleKey = normalizeModuleKey(payload.moduleKey || String(notification.type || "").replace("module:", ""));
  const entry = normalizeEntryLoose(payload.entrySide || payload.entry || readRecord(payload.variables).entry);
  const entryRoundId = clampInt(notification.roundId ?? readRecord(payload.variables).roundId ?? 0, 0, Number.MAX_SAFE_INTEGER);
  if (!entry) return { ready: false, reason: "missing_entry" };
  if (!entryRoundId) return { ready: false, reason: "missing_entry_round" };

  const sortedRounds = dashboardRounds({ rounds });
  const futureRounds = sortedRounds
    .filter((round) => Number(round.id ?? round.roundId ?? round.round ?? 0) > entryRoundId)
    .slice(0, 8);
  if (!futureRounds.length) return { ready: false, reason: "awaiting_next_round" };

  const maxGale = moduleKey === "ties_only"
    ? clampInt(config.tieCoverage ?? payload.tieCoverage ?? parseGaleLimit(payload.protection), 0, 4)
    : clampInt(payload.galeLimit ?? parseGaleLimit(payload.protection) ?? config.galeLimit ?? 1, 0, 4);
  const attempts = Math.max(1, maxGale + 1);
  const coverTie = moduleKey === "ties_only" || payload.coverTie === true || config.coverTie === true || normalizeSearchText(readRecord(payload.variables).tieProtection).includes("ATIVA");

  for (let index = 0; index < Math.min(futureRounds.length, attempts); index += 1) {
    const round = futureRounds[index];
    const resultSide = normalizeRoundSide(round.result ?? round.winner);
    if (!resultSide) continue;
    if (resultSide === "TIE") {
      const tieMultiplier = dashboardNumber(round.tieMultiplier ?? round.tie_multiplier ?? round.multiplier);
      if (entry === "TIE" || coverTie) {
        return officialResolution({
          status: "green",
          label: tieMultiplier ? `Green no empate ${tieMultiplier}x` : "Green no empate",
          protection: index === 0 ? "SG" : `G${index}`,
          entry,
          round,
          tieMultiplier,
        });
      }
      continue;
    }
    if (entry !== "TIE" && resultSide === entry) {
      return officialResolution({
        status: index === 0 ? "green" : `green_g${index}`,
        label: index === 0 ? "Green" : `Green G${index}`,
        protection: index === 0 ? "SG" : `G${index}`,
        entry,
        round,
      });
    }
  }

  if (futureRounds.length >= attempts) {
    const round = futureRounds[attempts - 1] || futureRounds.at(-1);
    return officialResolution({
      status: "red",
      label: "Red",
      protection: maxGale <= 0 ? "SG" : `G${maxGale}`,
      entry,
      round,
    });
  }

  return { ready: false, reason: "awaiting_gale_round" };
}

function officialResolution({ status, label, protection, entry, round, tieMultiplier = "" }) {
  return {
    ready: true,
    status,
    label,
    protection,
    entry,
    tieMultiplier,
    resultRound: readRecord(round),
    resultRoundId: clampInt(round.id ?? round.roundId ?? round.round ?? 0, 0, Number.MAX_SAFE_INTEGER),
    resultRoundKey: dashboardRoundKey(round, {}),
  };
}

function dashboardRounds(dashboard) {
  const data = readRecord(dashboard);
  const rounds = Array.isArray(data.rounds) ? data.rounds.map(readRecord).filter((round) => Object.keys(round).length) : [];
  return [...rounds].sort(compareDashboardRounds);
}

function normalizeEntryLoose(value) {
  const direct = normalizeEntry(value);
  if (direct) return direct;
  const text = normalizeSearchText(value);
  if (text.includes("BANKER") || text.includes("BANCA") || text.includes("🔴")) return "BANKER";
  if (text.includes("PLAYER") || text.includes("JOGADOR") || text.includes("🔵")) return "PLAYER";
  if (text.includes("TIE") || text.includes("EMPATE") || text.includes("🟡")) return "TIE";
  return "";
}

function normalizeRoundSide(value) {
  const text = normalizeSearchText(value);
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return "";
}

function parseGaleLimit(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "SG" || text.includes("SEM")) return 0;
  const match = text.match(/G\s*([0-4])/);
  return match ? Number(match[1]) : 1;
}

function hasDuplicateSignalBlock(dispatch) {
  return Array.isArray(dispatch?.blocked) && dispatch.blocked.some((item) => item?.reason === "duplicate_signal");
}

function parseRoundIdFromKey(value) {
  const text = String(value || "");
  const parts = text.split(":");
  for (const part of parts) {
    const number = Number(part);
    if (Number.isInteger(number) && number > 0) return number;
  }
  return 0;
}

function latestDashboardRound(dashboard) {
  const rounds = Array.isArray(dashboard.rounds) ? dashboard.rounds.map(readRecord).filter((round) => Object.keys(round).length) : [];
  if (!rounds.length) return {};
  return [...rounds].sort(compareDashboardRounds).at(-1) || {};
}

function compareDashboardRounds(a, b) {
  const aId = Number(a.id ?? a.roundId ?? a.round ?? 0);
  const bId = Number(b.id ?? b.roundId ?? b.round ?? 0);
  if (Number.isFinite(aId) && Number.isFinite(bId) && aId !== bId) return aId - bId;
  const aTime = String(a.time || a.recordedAt || a.createdAt || "");
  const bTime = String(b.time || b.recordedAt || b.createdAt || "");
  return aTime.localeCompare(bTime);
}

function dashboardRoundKey(round, dashboard) {
  const record = readRecord(round);
  const id = dashboardText(record.id ?? record.roundId ?? record.round ?? dashboard.roundId ?? "");
  const result = dashboardText(record.result ?? record.winner ?? "");
  const bankerScore = dashboardText(record.bankerScore ?? record.banker_score ?? record.banker ?? "");
  const playerScore = dashboardText(record.playerScore ?? record.player_score ?? record.player ?? "");
  const time = dashboardText(record.time ?? record.recordedAt ?? record.createdAt ?? "");
  return [time, id, result, bankerScore, playerScore].filter(Boolean).join(":");
}

function dashboardNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return String(Math.trunc(number));
}

function dashboardText(value) {
  return String(value ?? "").trim();
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function clampPercentValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, number));
}

function formatDashboardPatternSequenceText(sequence) {
  return (Array.isArray(sequence) ? sequence : [])
    .map(formatDashboardPatternToken)
    .filter(Boolean)
    .join("");
}

function formatDashboardPatternToken(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  const side = normalized.startsWith("BANKER") || normalized.startsWith("B")
    ? "B"
    : normalized.startsWith("PLAYER") || normalized.startsWith("P")
      ? "P"
      : normalized.startsWith("TIE") || normalized.startsWith("T")
        ? "T"
        : "";
  if (!side) return raw;
  const score = normalized.match(/\d{1,2}/)?.[0] || "";
  return `${telegramSideCircle(side)}${score}`;
}

function normalizeGaleText(value) {
  const text = String(value || "").trim().toUpperCase();
  const match = text.match(/G\s*([0-4])/);
  if (match) return `G${match[1]}`;
  if (text === "SG" || text === "SEM GALE") return "SG";
  return text || "G1";
}

function formatDashboardPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${number.toFixed(2)}%`;
}

function normalizeModuleConfigs(value) {
  const record = readRecord(value);
  return MODULE_KEYS.reduce((acc, key) => {
    const raw = readRecord(record[key]);
    const defaultTemplate = DEFAULT_MODULE_TEMPLATES[key] || "";
    const defaultAnalyzingTemplate = DEFAULT_MODULE_ANALYZING_TEMPLATES[key] || "";
    const defaultGreenTemplate = DEFAULT_MODULE_GREEN_TEMPLATES[key] || "";
    const defaultGaleTemplate = DEFAULT_MODULE_GALE_TEMPLATES[key] || "";
    const defaultRedTemplate = DEFAULT_MODULE_RED_TEMPLATES[key] || "";
    const defaultTieTemplate = DEFAULT_MODULE_TIE_TEMPLATES[key] || defaultGreenTemplate;
    const defaultExpiredTemplate = DEFAULT_MODULE_EXPIRED_TEMPLATES[key] || "";
    const defaultCanceledTemplate = DEFAULT_MODULE_CANCELED_TEMPLATES[key] || "";
    acc[key] = {
      ...DEFAULT_MODULE_CONFIG,
      enabled: Object.prototype.hasOwnProperty.call(raw, "enabled") ? Boolean(raw.enabled) : key === "validator",
      entryType: normalizeModuleEntry(raw.entryType),
      galeLimit: clampInt(raw.galeLimit ?? (key === "ties_only" ? 0 : 1), 0, 4),
      coverTie: Object.prototype.hasOwnProperty.call(raw, "coverTie") ? Boolean(raw.coverTie) : key === "ties_only",
      tieCoverage: clampInt(raw.tieCoverage ?? (key === "ties_only" ? 4 : 1), 0, 4),
      cooldownSeconds: clampInt(raw.cooldownSeconds ?? (key === "validator" ? 0 : 2), 0, 300),
      template: resolveModuleTemplate(key, raw.template, defaultTemplate),
      analyzingTemplate: repairTelegramEncodingArtifacts(raw.analyzingTemplate || defaultAnalyzingTemplate),
      greenTemplate: repairTelegramEncodingArtifacts(raw.greenTemplate || defaultGreenTemplate),
      galeTemplate: repairTelegramEncodingArtifacts(raw.galeTemplate || defaultGaleTemplate),
      redTemplate: repairTelegramEncodingArtifacts(raw.redTemplate || defaultRedTemplate),
      tieTemplate: repairTelegramEncodingArtifacts(raw.tieTemplate || defaultTieTemplate),
      expiredTemplate: repairTelegramEncodingArtifacts(raw.expiredTemplate || defaultExpiredTemplate),
      canceledTemplate: repairTelegramEncodingArtifacts(raw.canceledTemplate || defaultCanceledTemplate),
      buttons: normalizeModuleButtons(raw.buttons, raw),
    };
    return acc;
  }, {});
}

function resolveModuleTemplate(key, value, defaultTemplate) {
  const template = repairTelegramEncodingArtifacts(value || "");
  return shouldUseDefaultModuleTemplate(key, template) ? defaultTemplate : template;
}

function shouldUseDefaultModuleTemplate(_key, template) {
  const text = normalizeModuleTemplateFingerprint(template);
  if (!text) return true;
  return text.includes("ENTRADA CONFIRMADA");
}

function normalizeModuleTemplateFingerprint(value) {
  return repairTelegramEncodingArtifacts(value || "")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function defaultModuleButtons() {
  return Array.from({ length: MAX_TELEGRAM_BUTTONS }, (_, index) => ({
    enabled: index === 0,
    label: index === 0 ? DEFAULT_BUTTON_LABEL : "",
    url: "",
  }));
}

function normalizeModuleButtons(value, legacyRecord = {}, fallback = defaultModuleButtons()) {
  const source = Array.isArray(value) ? value.slice(0, MAX_TELEGRAM_BUTTONS) : [];
  const normalized = source.map((item) => {
    const record = readRecord(item);
    return {
      enabled: Object.prototype.hasOwnProperty.call(record, "enabled") ? Boolean(record.enabled) : true,
      label: String(record.label || DEFAULT_BUTTON_LABEL).trim().slice(0, 64),
      url: normalizeUrl(String(record.url || "")),
    };
  });

  if (!normalized.length) {
    const hasLegacyButton =
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonEnabled") ||
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonLabel") ||
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonUrl");
    if (hasLegacyButton) {
      normalized.push({
        enabled: Object.prototype.hasOwnProperty.call(legacyRecord, "buttonEnabled")
          ? Boolean(legacyRecord.buttonEnabled)
          : true,
        label: String(legacyRecord.buttonLabel || DEFAULT_BUTTON_LABEL).trim().slice(0, 64),
        url: normalizeUrl(String(legacyRecord.buttonUrl || "")),
      });
    } else {
      normalized.push(...fallback.map((button) => ({ ...button })));
    }
  }

  while (normalized.length < MAX_TELEGRAM_BUTTONS) {
    normalized.push({ enabled: false, label: "", url: "" });
  }
  return normalized.slice(0, MAX_TELEGRAM_BUTTONS);
}

function telegramButtonsForSignal(config, channel, body) {
  const bodyButtons = normalizeModuleButtons(body.buttons, body, []);
  const source = bodyButtons.some((button) => button.enabled)
    ? bodyButtons
    : normalizeModuleButtons(config.buttons, config);
  return source
    .filter((button) => button.enabled)
    .map((button) => ({
      label: String(button.label || DEFAULT_BUTTON_LABEL).trim().slice(0, 64),
      url: normalizeUrl(String(button.url || channel.buttonLink || "")),
    }))
    .filter((button) => button.label && button.url)
    .slice(0, MAX_TELEGRAM_BUTTONS);
}

function sanitizeTemplateRecord(value) {
  const record = readRecord(value);
  const next = {};
  for (const [key, item] of Object.entries(record)) {
    next[key] = typeof item === "string" ? repairTelegramEncodingArtifacts(item) : item;
  }
  if (record.signalModules) next.signalModules = normalizeModuleConfigs(record.signalModules);
  return next;
}

function publicChannel(channel) {
  return {
    id: channel.id,
    userId: channel.userId,
    name: channel.name,
    botTokenMasked: channel.botTokenMasked,
    botTokenEncoded: "__cloudflare__",
    chatId: channel.chatId,
    buttonLink: channel.buttonLink,
    isActive: channel.isActive,
    analyzingEnabled: channel.analyzingEnabled,
    analyzingCooldownRounds: channel.analyzingCooldownRounds,
    templates: sanitizeTemplateRecord(channel.templates || {}),
    signalModules: normalizeModuleConfigs(channel.signalModules || {}),
    connectionStatus: "connected",
    lastTestMessageId: channel.lastTestMessageId || null,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

async function sendTelegramMessage({ botToken, chatId, message, buttonLabel = "", buttonUrl = "", buttons = [], parseMode = "HTML" }) {
  if (!botToken || !chatId) return { ok: false, status: 400, error: "Canal Telegram sem token ou Chat ID." };
  const payload = {
    chat_id: chatId,
    text: sanitizeTelegramOutgoingMessage(message).slice(0, 4096),
    disable_web_page_preview: true,
    parse_mode: parseMode,
  };
  const inlineButtons = Array.isArray(buttons)
    ? buttons
        .map((button) => ({
          text: String(button.label || DEFAULT_BUTTON_LABEL).trim().slice(0, 64),
          url: normalizeUrl(String(button.url || "")),
        }))
        .filter((button) => button.text && button.url)
        .slice(0, MAX_TELEGRAM_BUTTONS)
    : [];
  const url = normalizeUrl(buttonUrl);
  if (!inlineButtons.length && url && buttonLabel) {
    inlineButtons.push({ text: String(buttonLabel).slice(0, 64), url });
  }
  if (inlineButtons.length) {
    payload.reply_markup = { inline_keyboard: [inlineButtons] };
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      status: telegramStatus(response.status),
      error: friendlyTelegramError(response.status, String(data.description || "")),
    };
  }
  return { ok: true, status: 200, messageId: data.result?.message_id || null };
}

async function getTelegramChat({ botToken, chatId }) {
  if (!botToken || !chatId) return { ok: false, status: 400, error: "Canal Telegram sem token ou Chat ID." };
  const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      status: telegramStatus(response.status),
      error: friendlyTelegramError(response.status, String(data.description || "")),
    };
  }
  const chat = data.result || {};
  return {
    ok: true,
    status: 200,
    chat: {
      id: chat.id,
      type: chat.type || "",
      title: chat.title || "",
      username: chat.username || "",
    },
  };
}

function friendlyTelegramError(status, description) {
  const text = String(description || "").toLowerCase();
  if (status === 401) return "Bot Token invalido.";
  if (status === 403) return "O bot nao tem permissao para enviar nesse canal ou grupo.";
  if (status === 429) return "Telegram limitou os envios. Aguarde e tente novamente.";
  if (text.includes("chat not found")) return "Chat ID nao encontrado. Adicione o bot no canal/grupo e confira o Chat ID.";
  if (text.includes("not enough rights")) return "O bot precisa ser administrador ou ter permissao de publicar mensagens.";
  return description || "Falha ao enviar mensagem no Telegram.";
}

function telegramStatus(status) {
  return [400, 401, 403, 429].includes(status) ? status : 502;
}

function json(body, status = 200, env = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders(env),
    },
  });
}

function corsResponse(env) {
  return new Response(null, { status: 204, headers: corsHeaders(env) });
}

function corsHeaders(env = {}) {
  return {
    "access-control-allow-origin": env.ALLOWED_ORIGIN || "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-validator-user-id",
    "access-control-max-age": "86400",
  };
}

function isDoQuotaError(error) {
  const message = errorMessage(error);
  return /Durable Objects free tier|Exceeded allowed (volume|rows|duration)/i.test(message);
}

function looksLikeTelegramBotToken(value) {
  return /^\d+:[A-Za-z0-9_-]{20,}$/.test(String(value || "").trim());
}

function readEmergencyTelegramChannel(env = {}) {
  const botToken =
    normalizeSecret(env.TELEGRAM_EMERGENCY_BOT_TOKEN) ||
    normalizeSecret(env.TELEGRAM_SMOKE_BOT_TOKEN) ||
    acceptedEngineSecrets(env).find((secret) => looksLikeTelegramBotToken(secret)) ||
    "";
  const chatId = String(env.TELEGRAM_EMERGENCY_CHAT_ID || env.TELEGRAM_SMOKE_CHAT_ID || "").trim();
  const userId = normalizeUserId(env.TELEGRAM_EMERGENCY_USER_ID || env.TELEGRAM_SMOKE_USER_ID || "smoke@sniperbo.local");
  if (!botToken || !chatId) return null;
  const now = new Date().toISOString();
  return {
    id: "telegram-emergency-channel",
    userId,
    name: "Telegram Emergency",
    botTokenMasked: `${botToken.slice(0, 6)}...`,
    chatId,
    buttonLink: "https://sniperbo.com",
    isActive: true,
    analyzingEnabled: false,
    analyzingCooldownRounds: 3,
    signalModules: normalizeModuleConfigs({
      paying_numbers: { enabled: true, entryType: "AUTO", galeLimit: 1, coverTie: false, tieCoverage: 1 },
      ai_patterns: { enabled: false },
      surf_alert: { enabled: false },
      ties_only: { enabled: false },
      validator: { enabled: false },
    }),
    connectionStatus: "connected",
    lastTestedAt: now,
    updatedAt: now,
    createdAt: now,
  };
}

async function handleTelegramEngineDoFallback(request, env, url, error = null) {
  const degraded = Boolean(error && isDoQuotaError(error));
  const emergencyChannel = readEmergencyTelegramChannel(env);
  if (!emergencyChannel) return null;

  if (request.method === "GET" && url.pathname === "/engine/channels/active") {
    return json({ channels: [publicChannel(emergencyChannel)], degraded }, 200, env);
  }

  const userId = normalizeUserId(request.headers.get("x-validator-user-id") || emergencyChannel.userId);
  if (request.method === "GET" && url.pathname === "/validator/channels") {
    if (userId && userId !== emergencyChannel.userId) return json({ channels: [] }, 200, env);
    return json({ channels: [publicChannel(emergencyChannel)], degraded }, 200, env);
  }

  if (request.method === "POST" && url.pathname === "/validator/channels/preview") {
    const body = await readJson(request);
    const channelId = String(body.channelId || body.id || "").trim();
    if (channelId && channelId !== emergencyChannel.id) {
      return json({ error: "Canal nao encontrado." }, 404, env);
    }
    const botToken =
      normalizeSecret(env.TELEGRAM_EMERGENCY_BOT_TOKEN) ||
      normalizeSecret(env.TELEGRAM_SMOKE_BOT_TOKEN) ||
      acceptedEngineSecrets(env).find((secret) => looksLikeTelegramBotToken(secret)) ||
      "";
    const result = await sendTelegramMessage({
      botToken,
      chatId: emergencyChannel.chatId,
      message: String(body.message || "Teste Telegram V2"),
      buttonLabel: "Abrir Sniper Bo IA",
      buttonUrl: normalizeUrl(emergencyChannel.buttonLink),
      buttons: Array.isArray(body.buttons) ? body.buttons : [],
    });
    if (!result.ok) return json({ error: result.error }, result.status || 502, env);
    return json({ ok: true, messageId: result.messageId, degraded }, 200, env);
  }

  if (request.method === "POST" && url.pathname === "/validator/channels/test") {
    const body = await readJson(request);
    const channelId = String(body.channelId || body.id || "").trim();
    if (channelId && channelId !== emergencyChannel.id) {
      return json({ error: "Canal nao encontrado." }, 404, env);
    }
    const botToken =
      normalizeSecret(env.TELEGRAM_EMERGENCY_BOT_TOKEN) ||
      normalizeSecret(env.TELEGRAM_SMOKE_BOT_TOKEN) ||
      acceptedEngineSecrets(env).find((secret) => looksLikeTelegramBotToken(secret)) ||
      "";
    const result = await sendTelegramMessage({
      botToken,
      chatId: emergencyChannel.chatId,
      message: "[TESTE TELEGRAM]\nCanal conectado com sucesso.",
    });
    if (!result.ok) return json({ error: result.error }, result.status || 502, env);
    return json({ ok: true, messageId: result.messageId, channelId: emergencyChannel.id, degraded }, 200, env);
  }

  if (degraded && request.method === "POST" && url.pathname === "/engine/signal") {
    const body = await readJson(request);
    if (normalizeModuleKey(body.moduleKey || body.type) === "validator") {
      console.warn(JSON.stringify({
        event: "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS",
        reason: "validator_requires_backend_saved_pattern",
        degraded: true,
      }));
      return json({ ok: true, sent: [], blocked: [{ channelId: emergencyChannel.id, reason: "VALIDATOR_SKIPPED_NO_SAVED_PATTERNS" }], degraded }, 200, env);
    }
    const botToken =
      normalizeSecret(env.TELEGRAM_EMERGENCY_BOT_TOKEN) ||
      normalizeSecret(env.TELEGRAM_SMOKE_BOT_TOKEN) ||
      acceptedEngineSecrets(env).find((secret) => looksLikeTelegramBotToken(secret)) ||
      "";
    const result = await sendTelegramMessage({
      botToken,
      chatId: emergencyChannel.chatId,
      message: String(body.message || "Sinal Telegram V2"),
      buttonLabel: "Abrir Sniper Bo IA",
      buttonUrl: normalizeUrl(emergencyChannel.buttonLink),
      buttons: Array.isArray(body.buttons) ? body.buttons : [],
    });
    if (!result.ok) return json({ error: result.error }, result.status || 502, env);
    return json({ ok: true, sent: [{ messageId: result.messageId, channelId: emergencyChannel.id }], degraded }, 200, env);
  }

  return null;
}

function bearerToken(request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function acceptedEngineSecrets(env = {}) {
  const values = ENGINE_SECRET_NAMES
    .map((name) => normalizeSecret(env[name]))
    .filter(Boolean);
  return [...new Set(values)];
}

async function readJson(request) {
  return readRecord(await request.json().catch(() => ({})));
}

function readRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readFirstString(record, keys) {
  const source = readRecord(record);
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function channelKey(userId, channelId) {
  return `channel:${normalizeUserId(userId)}:${String(channelId || "").trim()}`;
}

function userKey(userId) {
  return `user:${normalizeUserId(userId)}`;
}

function deletedCodeKey(userId, chatId) {
  return `deleted:${normalizeUserId(userId)}:code:${normalizeChannelCode(chatId)}`;
}

function publicWorkspace(workspace) {
  return {
    userId: workspace.userId,
    active: workspace.active !== false,
    plan: workspace.plan || "",
    expiresAt: workspace.expiresAt || "",
    cleanupAfter: workspace.cleanupAfter || "",
    cleanedAt: workspace.cleanedAt || "",
    updatedAt: workspace.updatedAt || "",
  };
}

function addDaysIso(value, days) {
  const baseMs = isoTimeMs(value) || Date.now();
  return new Date(baseMs + Math.max(0, Number(days) || 0) * 86400000).toISOString();
}

function isoTimeMs(value) {
  const text = String(value || "").trim();
  if (!text) return 0;
  const time = Date.parse(text.includes("T") ? text : `${text}T23:59:59Z`);
  return Number.isFinite(time) ? time : 0;
}

function normalizeUserId(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSecret(value) {
  return String(value || "").trim();
}

function normalizeChannelCode(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function normalizeModuleKey(value) {
  const text = String(value || "").trim();
  return MODULE_KEYS.includes(text) ? text : "";
}

function normalizeEntry(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "B" || text === "BANKER") return "BANKER";
  if (text === "P" || text === "PLAYER") return "PLAYER";
  if (text === "T" || text === "TIE") return "TIE";
  return "";
}

function normalizeModuleEntry(value) {
  const text = String(value || "").trim().toUpperCase();
  return ["AUTO", "BANKER", "PLAYER", "TIE"].includes(text) ? text : "AUTO";
}

function moduleAllowsEntry(config, entry) {
  return !entry || config.entryType === "AUTO" || config.entryType === entry;
}

function formatEntry(entry) {
  if (entry === "BANKER") return "\u{1F534} BANKER";
  if (entry === "PLAYER") return "\u{1F535} PLAYER";
  if (entry === "TIE") return "\u{1F7E1} TIE";
  return "Automatico";
}

function formatEntryLabel(entry) {
  if (entry === "BANKER") return "Banker";
  if (entry === "PLAYER") return "Player";
  if (entry === "TIE") return "Tie";
  return "Automatico";
}

function formatEntryCompact(entry) {
  if (entry === "BANKER") return "\u{1F534}Banker";
  if (entry === "PLAYER") return "\u{1F535}Player";
  if (entry === "TIE") return "\u{1F7E1}Tie";
  return "Automatico";
}

function classifySignalKind(body, signalKey) {
  const variables = readRecord(body.variables);
  const result = String(body.result || variables.result || "").trim().toLowerCase();
  const key = String(signalKey || "").toLowerCase();
  if (key.includes(":result:")) return "result";
  if (result && result !== "aguardando resultado" && result !== "aguardando") return "result";
  return "entry";
}

function selectSignalTemplate(config, signalKind, result) {
  if (signalKind !== "result") return String(config.template || "");
  const normalized = normalizeDedupeText(result);
  if (normalized.includes("red")) return String(config.redTemplate || config.template || "");
  if (normalized.includes("empate") || normalized.includes("tie")) {
    return String(config.tieTemplate || config.greenTemplate || config.template || "");
  }
  if (normalized.includes("green")) return String(config.greenTemplate || config.template || "");
  return String(config.greenTemplate || config.template || "");
}

function entrySignalDedupeKey(channel, moduleKey, roundId, entry, signalKind) {
  if (signalKind !== "entry" || !roundId || !entry) return "";
  return `sent-entry:${channel.userId}:${channel.id}:${moduleKey}:${roundId}:${entry}`;
}

function resultSignalDedupeKey(channel, moduleKey, roundId, entry, signalKind, result) {
  if (signalKind !== "result" || !roundId) return "";
  const resultKey = normalizeDedupeText(result);
  if (!resultKey) return "";
  return `sent-result:${channel.userId}:${channel.id}:${moduleKey}:${roundId}:${entry || "AUTO"}:${resultKey}`;
}

async function recentMessageDedupeKey(channel, signalKind, message) {
  const text = String(message || "").trim();
  if (!text) return "";
  const bucket = Math.floor(Date.now() / 30000);
  const messageHash = await hashText(`${signalKind}:${text}`);
  return `sent-recent:${channel.userId}:${channel.id}:${bucket}:${messageHash}`;
}

function normalizeDedupeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatTelegramMessageText(value) {
  return sanitizeTelegramOutgoingMessage(
    String(value || "")
      .replace(/\bB\s+Banker\b/gi, formatEntry("BANKER"))
      .replace(/\bP\s+Player\b/gi, formatEntry("PLAYER"))
      .replace(/\bT\s+Tie\b/gi, formatEntry("TIE")),
  );
}

function sanitizeTelegramOutgoingMessage(value) {
  const repaired = restoreMojibakeEmojiText(repairTelegramEncodingArtifacts(value));
  return decoratePatternLines(decorateScoreTokens(restoreTelegramEmojiMarkers(repaired)));
}

const WINDOWS_1252_REVERSE_BYTES = {
  "\u20AC": 0x80,
  "\u201A": 0x82,
  "\u0192": 0x83,
  "\u201E": 0x84,
  "\u2026": 0x85,
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02C6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8A,
  "\u2039": 0x8B,
  "\u0152": 0x8C,
  "\u017D": 0x8E,
  "\u2018": 0x91,
  "\u2019": 0x92,
  "\u201C": 0x93,
  "\u201D": 0x94,
  "\u2022": 0x95,
  "\u2013": 0x96,
  "\u2014": 0x97,
  "\u02DC": 0x98,
  "\u2122": 0x99,
  "\u0161": 0x9A,
  "\u203A": 0x9B,
  "\u0153": 0x9C,
  "\u017E": 0x9E,
  "\u0178": 0x9F,
};

function restoreMojibakeEmojiText(value) {
  return String(value || "").replace(/(?:\u00F0|\u00E2|\u00EF)[\u0080-\uFFFF]{1,8}/g, restoreMojibakeEmojiChunk);
}

function restoreMojibakeEmojiChunk(chunk) {
  const bytes = [];
  for (const char of Array.from(String(chunk || ""))) {
    const code = char.codePointAt(0) || 0;
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const mapped = WINDOWS_1252_REVERSE_BYTES[char];
    if (mapped === undefined) return chunk;
    bytes.push(mapped);
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    return /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(decoded) ? decoded : chunk;
  } catch {
    return chunk;
  }
}

function restoreTelegramEmojiMarkers(value) {
  const red = "\u{1F534}";
  const blue = "\u{1F535}";
  const yellow = "\u{1F7E1}";
  const markers = [
    [/^\?{1,4}\s*((?:<b>)?ENTRADA CONFIRMADA(?:<\/b>)?)/gim, "\u{1F916} $1"],
    [/^\?{1,4}\s*((?:<b>)?PADRAO IA CONFIRMADO(?:<\/b>)?)/gim, "\u{1F916} $1"],
    [/^\?{1,4}\s*((?:<b>)?PADR?O IA CONFIRMADO(?:<\/b>)?)/gim, "\u{1F916} $1"],
    [/^\?{1,4}\s*((?:<b>)?PADRAO VALIDADOR(?:<\/b>)?)/gim, "\u{1F916} $1"],
    [/^\?{1,4}\s*((?:<b>)?PADR?O VALIDADOR(?:<\/b>)?)/gim, "\u{1F916} $1"],
    [/^\?{1,4}\s*((?:<b>)?NUMERO PAGANTE CONFIRMADO(?:<\/b>)?)/gim, "\u{1F48E} $1"],
    [/^\?{1,4}\s*((?:<b>)?N?MERO PAGANTE CONFIRMADO(?:<\/b>)?)/gim, "\u{1F48E} $1"],
    [/^\?{1,4}\s*((?:<b>)?AVISO DE SURF CONFIRMADO(?:<\/b>)?)/gim, "\u{1F30A} $1"],
    [/^\?{1,4}\s*((?:<b>)?POSSIVEL EMPATE(?:<\/b>)?)/gim, "\u{1F7E1} $1"],
    [/^\?{1,4}\s*((?:<b>)?POSS?VEL EMPATE(?:<\/b>)?)/gim, "\u{1F7E1} $1"],
    [/^\?{1,4}\s*((?:<b>)?Mesa:\s*(?:<\/b>)?)/gim, "\u{1F3B2} $1"],
    [/^\?{1,4}\s*((?:<b>)?Padrão:\s*(?:<\/b>)?)/gim, "\u{1F9E9} $1"],
    [/^\?{1,4}\s*((?:<b>)?Padrão:\s*(?:<\/b>)?)/gim, "\u{1F9E9} $1"],
    [/^\?{1,4}\s*((?:<b>)?Entrada:\s*(?:<\/b>)?)/gim, "\u{1F3AF} $1"],
    [/^\?{1,4}\s*((?:<b>)?Proteção:\s*(?:<\/b>)?)/gim, "\u{1F6E1}\uFE0F $1"],
    [/^\?{1,4}\s*((?:<b>)?Prote??o:\s*(?:<\/b>)?)/gim, "\u{1F6E1}\uFE0F $1"],
    [/^\?{1,4}\s*((?:<b>)?Assertividade:\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1"],
    [/^\?{1,4}\s*((?:<b>)?Número:\s*(?:<\/b>)?)/gim, "\u{1F522} $1"],
    [/^\?{1,4}\s*((?:<b>)?N?mero:\s*(?:<\/b>)?)/gim, "\u{1F522} $1"],
    [/^\?{1,4}\s*((?:<b>)?Status:\s*(?:<\/b>)?)/gim, "\u{1F4CC} $1"],
    [/^\?{1,4}\s*((?:<b>)?Risco:\s*(?:<\/b>)?)/gim, "\u26A0\uFE0F $1"],
    [/^\?{1,4}\s*((?:<b>)?Confianca:\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1"],
    [/^\?{1,4}\s*((?:<b>)?Confian?a:\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1"],
  ];
  let text = String(value || "")
    .replace(/\[PR[\uFFFD?]+E?VIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/\[PREVIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/PADR[\uFFFD?]+O/g, "PADRAO")
    .replace(/Padr[\uFFFD?]+o/gi, "Padrao")
    .replace(/Prote[\uFFFD?]+o/gi, "Proteção")
    .replace(/M[\uFFFD?]+dulo/gi, "Módulo")
    .replace(/N[\uFFFD?]+mero/gi, "Numero")
    .replace(/Confian[\uFFFD?]+a/gi, "Confianca")
    .replace(/POSS[\uFFFD?]+VEL/gi, "POSSIVEL")
    .replace(/N[\uFFFD?]+vel/gi, "Nivel")
    .replace(/\bPADRAO\b/g, "PADR\u00C3O")
    .replace(/\bPadrao\b/g, "Padr\u00E3o")
    .replace(/\bProteção\b/gi, "Prote\u00E7\u00E3o")
    .replace(/\bMódulo\b/gi, "M\u00F3dulo")
    .replace(/\bNumero\b/gi, "N\u00FAmero")
    .replace(/\bConfianca\b/gi, "Confian\u00E7a")
    .replace(/\bPOSSIVEL\b/gi, "POSS\u00CDVEL")
    .replace(/\bNivel\b/gi, "N\u00EDvel")
    .replace(/\bate\b/gi, "at\u00E9");
  for (const [pattern, replacement] of markers) text = text.replace(pattern, replacement);
  text = decorateKnownTelegramLines(text);
  return text
    .replace(/\?{1,4}\s*(BANKER|Banker)\b/g, red + " $1")
    .replace(/\?{1,4}\s*(PLAYER|Player)\b/g, blue + " $1")
    .replace(/\?{1,4}\s*(TIE|Tie)\b/g, yellow + " $1")
    .replace(/\u{1F534}\s*Banker\b/gu, "\u{1F534} BANKER")
    .replace(/\u{1F535}\s*Player\b/gu, "\u{1F535} PLAYER")
    .replace(/\u{1F7E1}\s*Tie\b/gu, "\u{1F7E1} TIE")
    .replace(/^\?{1,4}\s*(?=(?:<b>)?(?:PADR?O|Padrão|Mesa|M?dulo|Entrada|Prote??o|Assertividade|N?mero|Status|Green|Red|RED|Empate|N?MERO|AVISO))/gim, "");
}

function decorateKnownTelegramLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(decorateKnownTelegramLine)
    .join("\n");
}

function decorateKnownTelegramLine(line) {
  const source = String(line || "");
  const match = source.match(/^(\s*)(.*)$/);
  const indent = match?.[1] || "";
  const body = match?.[2] || "";
  const cleanBody = body.replace(/^\?{1,4}\s*/, "");
  if (!cleanBody || startsWithTelegramEmoji(cleanBody)) return indent + cleanBody;
  const plain = cleanBody
    .replace(/<[^>]+>/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  const emoji = telegramEmojiForLine(plain);
  return indent + (emoji ? emoji + " " : "") + cleanBody;
}

function startsWithTelegramEmoji(value) {
  return /^(?:[\u{1F300}-\u{1FAFF}]|\u2600|\u26A0|\u2705|\u274C)/u.test(String(value || "").trim());
}

function telegramEmojiForLine(plain) {
  if (!plain || plain.startsWith("[PREVIA DE TESTE]")) return "";
  if (plain.startsWith("ENTRADA CONFIRMADA")) return "\u{1F916}";
  if (plain.startsWith("PADRAO IA CONFIRMADO")) return "\u{1F916}";
  if (plain.startsWith("PADRAO VALIDADOR")) return "\u{1F916}";
  if (plain.startsWith("NUMERO PAGANTE CONFIRMADO")) return "\u{1F48E}";
  if (plain.startsWith("AVISO DE SURF CONFIRMADO")) return "\u{1F30A}";
  if (plain.startsWith("POSSIVEL EMPATE")) return "\u{1F7E1}";
  if (plain.startsWith("MESA:")) return "\u{1F3B2}";
  if (plain.startsWith("PADRAO:")) return "\u{1F9E9}";
  if (plain.startsWith("ENTRADA:")) return "\u{1F3AF}";
  if (plain.startsWith("PROTECAO:")) return "\u{1F6E1}\uFE0F";
  if (plain.startsWith("PROTECAO TIE:")) return "\u{1F91D}";
  if (plain.startsWith("COBERTURA:")) return "\u{1F6E1}\uFE0F";
  if (plain.startsWith("ASSERTIVIDADE:")) return "\u{1F4CA}";
  if (plain.startsWith("NUMERO:")) return "\u{1F522}";
  if (plain.startsWith("NUMEROS:")) return "\u{1F522}";
  if (plain.startsWith("STATUS:")) return "\u{1F4CC}";
  if (plain.startsWith("RISCO:")) return "\u26A0\uFE0F";
  if (plain.startsWith("CONFIANCA:")) return "\u{1F4CA}";
  if (plain.startsWith("NIVEL:")) return "\u{1F4CA}";
  if (plain.startsWith("MODULO:")) return "\u{1F916}";
  return "";
}

function decoratePatternLines(message) {
  const puzzle = "\u{1F9E9}";
  return String(message || "")
    .split(/\r?\n/)
    .map((line) => {
      const match = String(line || "").match(/^(\s*)(?:\u{1F9E9}\s*)?(?:<b>)?Padr(?:\u00E3o|ao):?(?:<\/b>)?:?\s*(.*)$/iu);
      if (!match) return line;
      const expression = String(match[2] || "").trim();
      return `${match[1] || ""}${puzzle} <b>Padr\u00E3o:</b> ${decorateTelegramPatternExpression(expression)}`;
    })
    .join("\n");
}

function decorateTelegramPatternExpression(value) {
  const raw = String(value || "");
  const compactEmojiPattern = raw.match(/[\u{1F534}\u{1F535}\u{1F7E1}]\s*\d*/gu);
  if (compactEmojiPattern && compactEmojiPattern.length > 1) {
    return compactEmojiPattern.map((item) => item.replace(/\s+/g, "")).join("");
  }
  const parts = raw
    .split(/\s*(?:\u2192|->|>)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return formatTelegramPatternToken(value);
  return parts.map(formatTelegramPatternToken).join("");
}

function formatTelegramPatternToken(token) {
  const source = String(token || "");
  const hadRed = source.includes("\u{1F534}");
  const hadBlue = source.includes("\u{1F535}");
  const hadYellow = source.includes("\u{1F7E1}");
  const clean = source
    .replace(/<[^>]+>/g, "")
    .replace(/[\uFFFD?]/g, "")
    .replace(/[\u{1F534}\u{1F535}\u{1F7E1}]/gu, "")
    .trim();
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, "");
  const side = hadRed || normalized.startsWith("BANKER") || normalized.startsWith("B")
    ? "B"
    : hadBlue || normalized.startsWith("PLAYER") || normalized.startsWith("P")
      ? "P"
      : hadYellow || normalized.startsWith("TIE") || normalized.startsWith("T")
        ? "T"
        : "";
  if (!side) return clean || source.trim();
  const number = normalized.match(/\d{1,2}/)?.[0] || "";
  return telegramSideCircle(side) + number;
}

function telegramSideCircle(side) {
  if (side === "B" || side === "BANKER") return "\u{1F534}";
  if (side === "P" || side === "PLAYER") return "\u{1F535}";
  if (side === "T" || side === "TIE") return "\u{1F7E1}";
  return "";
}

function repairTelegramEncodingArtifacts(value) {
  return String(value || "")
    .replace(/ðŸ¤–|Ã°Å¸Â¤â€“/g, "🤖")
    .replace(/ðŸŽ²|Ã°Å¸Å½Â²/g, "🎲")
    .replace(/ðŸ§©|Ã°Å¸Â§Â©/g, "🧩")
    .replace(/ðŸŽ¯|Ã°Å¸Å½Â¯/g, "🎯")
    .replace(/ðŸ›¡ï¸|Ã°Å¸â€ºÂ¡Ã¯Â¸Â/g, "🛡️")
    .replace(/ðŸ“Š|Ã°Å¸â€œÅ /g, "📊")
    .replace(/ðŸ’Ž|Ã°Å¸â€™Å½/g, "💎")
    .replace(/ðŸ”¢|Ã°Å¸â€Â¢/g, "🔢")
    .replace(/ðŸ“Œ|Ã°Å¸â€œÅ’/g, "📌")
    .replace(/ðŸŒŠ|Ã°Å¸Å’Å /g, "🌊")
    .replace(/ðŸŸ¡|Ã°Å¸Å¸Â¡/g, "🟡")
    .replace(/ðŸ”´|Ã°Å¸â€Â´/g, "🔴")
    .replace(/ðŸ”µ|Ã°Å¸â€Âµ/g, "🔵")
    .replace(/âœ…|Ã¢Å“â€¦/g, "✅")
    .replace(/âŒ|Ã¢ÂÅ’/g, "❌")
    .replace(/âš |Ã¢Å¡ /g, "⚠")
    .replace(/Padr[\uFFFD?]+o/gi, "Padrao")
    .replace(/PADR[\uFFFD?]+O/g, "PADRAO")
    .replace(/Prote[\uFFFD?]+o/gi, "Proteção")
    .replace(/M[\uFFFD?]+dulo/gi, "Módulo")
    .replace(/N[\uFFFD?]+mero/gi, "Numero")
    .replace(/Confian[\uFFFD?]+a/gi, "Confianca")
    .replace(/Padr(?:ÃƒÂ£|Ã£|ï¿½)o/gi, "Padrao")
    .replace(/PADR(?:ÃƒÆ’|Ãƒ|ï¿½)O/g, "PADRAO")
    .replace(/Prote(?:ÃƒÂ§ÃƒÂ£|Ã§Ã£|ï¿½ï¿½)o/gi, "Proteção")
    .replace(/M(?:ÃƒÂ³|Ã³|ï¿½)dulo/gi, "Módulo")
    .replace(/N(?:ÃƒÂº|Ãº|ï¿½)mero/gi, "Numero")
    .replace(/Confian(?:ÃƒÂ§|Ã§|ï¿½)a/gi, "Confianca")
    .replace(/n(?:ÃƒÂ£|Ã£|ï¿½)o/gi, "nao")
    .replace(/Assertividade:\s*$/gim, "Assertividade:");
}

function decorateScoreTokens(message) {
  return String(message || "").replace(/\b([BPT])\s*([2-9]|1[0-2])\b/gi, (match, side, number, offset, fullText) => {
    const previous = String(fullText || "").slice(Math.max(0, offset - 4), offset);
    if (previous.includes("🔴") || previous.includes("🔵") || previous.includes("🟡")) return match;
    const normalizedSide = String(side || "").toUpperCase();
    if (normalizedSide === "B") return `🔴 B${number}`;
    if (normalizedSide === "P") return `🔵 P${number}`;
    if (normalizedSide === "T") return `🟡 T${number}`;
    return match;
  });
}

function formatGale(value) {
  const gale = clampInt(value, 0, 4);
  return gale <= 0 ? "SG" : `G${gale}`;
}

function moduleName(key) {
  if (key === "ai_patterns") return "Padroes IA";
  if (key === "paying_numbers") return "Numeros Pagantes";
  if (key === "surf_alert") return "Aviso de Surf";
  if (key === "ties_only") return "Somente Empates";
  return "Validador";
}

function telegramWorkerLog(event, channel, moduleKey, active, reason = "", message = "", result = {}) {
  return {
    event: `[TELEGRAM_ENGINE] ${event}`,
    client_id: maskUserId(channel?.userId || ""),
    module: moduleKey,
    active: Boolean(active),
    group_found: Boolean(channel?.chatId),
    chat_id: channel?.chatId || "",
    channelId: channel?.id || "",
    reason,
    telegram_result: result.ok ? "success" : result.ok === false ? "error" : "not_called",
    telegramMessageId: result.messageId || null,
    status: result.status || "",
    message_sent: String(message || "").slice(0, 240),
    error: result.error || "",
  };
}

function maskUserId(userId) {
  const clean = String(userId || "").trim().toLowerCase();
  const [name, domain] = clean.split("@");
  if (!name || !domain) return clean ? "***" : "";
  return `${name.slice(0, 1)}***@${domain}`;
}

function renderTemplate(template, variables) {
  return String(template || "").replace(/{{\s*([a-zA-Z_]+)\s*}}/g, (_, key) => String(variables[key] ?? ""));
}

function shouldRenderSignalTemplate(template, variables) {
  const text = String(template || "");
  if (!text) return false;
  const names = [...text.matchAll(/{{\s*([a-zA-Z_]+)\s*}}/g)].map((match) => match[1]).filter(Boolean);
  if (!names.length) return true;
  const record = readRecord(variables);
  return names.every((name) => Object.prototype.hasOwnProperty.call(record, name));
}

function maskToken(token) {
  const clean = String(token || "").trim();
  if (clean.length <= 10) return clean ? `${clean.slice(0, 3)}...` : "";
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

function clampInt(value, min, max) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "unknown");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function hmacSha256(secret, payload) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

function timingSafeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ""));
  const b = new TextEncoder().encode(String(right || ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hashText(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value || "")));
  return base64Url(new Uint8Array(digest)).slice(0, 20);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const padded = String(value || "").replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
