const MODULE_KEYS = ["ai_patterns", "paying_numbers", "surf_alert", "ties_only", "validator"];
const MAX_TELEGRAM_BUTTONS = 4;
const DEFAULT_BUTTON_LABEL = "Abrir Sniper Bo IA";
const ENGINE_SECRET_NAMES = [
  "ENGINE_API_SECRET",
  "TELEGRAM_ENGINE_SECRET",
  "CLOUDFLARE_TELEGRAM_ENGINE_SECRET",
  "LEGACY_ENGINE_API_SECRET",
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
    "\u{1F916} <b>PADR\u00C3O IA CONFIRMADO</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{confidence}}",
  paying_numbers:
    "\u{1F48E} <b>N\u00DAMERO PAGANTE CONFIRMADO</b>\n\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entryLabel}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CC} <b>Status:</b> {{status}}",
  surf_alert:
    "\u{1F30A} <b>AVISO DE SURF CONFIRMADO</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entryCompact}}\n\u26A0\uFE0F <b>Risco:</b> {{risk}}\n\u{1F4CA} <b>Confian\u00E7a:</b> {{confidence}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  ties_only:
    "\u{1F7E1} <b>POSS\u00CDVEL EMPATE</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Cobertura:</b> at\u00E9 G{{tieCoverage}}\n\u{1F4CA} <b>N\u00EDvel:</b> {{level}}",
  validator:
    "\u{1F916} <b>PADR\u00C3O VALIDADOR</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{percentage}}",
};
const DEFAULT_MODULE_GREEN_TEMPLATES = {
  ai_patterns:
    "\u2705 <b>{{result}}</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  paying_numbers:
    "\u2705 <b>{{result}}</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  surf_alert:
    "\u2705 <b>{{result}}</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  ties_only:
    "\u2705 <b>{{result}}</b>\n\n\u{1F7E1} <b>Empate confirmado</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  validator:
    "\u2705 <b>{{result}}</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
};
const DEFAULT_MODULE_ANALYZING_TEMPLATES = {
  ai_patterns: "\u{1F50E} <b>ANALISANDO PADR\u00C3O IA</b>\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.",
  paying_numbers: "\u{1F50E} <b>ANALISANDO N\u00DAMERO PAGANTE</b>\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.",
  surf_alert: "\u{1F50E} <b>ANALISANDO SURF</b>\n\u{1F30A} <b>Dire\u00E7\u00E3o:</b> {{side}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.",
  ties_only: "\u{1F50E} <b>ANALISANDO EMPATE</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.",
  validator: "\u{1F50E} <b>ANALISANDO VALIDADOR</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u23F3 Aguardando entrada validada.",
};
const DEFAULT_MODULE_GALE_TEMPLATES = {
  ai_patterns: "\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}",
  paying_numbers: "\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}",
  surf_alert: "\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}",
  ties_only: "\u{1F6E1}\uFE0F <b>COBRIR EMPATE {{gale}}</b>\n\u{1F7E1} <b>Press\u00E3o:</b> {{tie_pressure}}",
  validator: "\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}",
};
const DEFAULT_MODULE_RED_TEMPLATES = {
  ai_patterns:
    "\u274C <b>RED</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  paying_numbers: "\u274C <b>RED</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  surf_alert: "\u274C <b>RED</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  ties_only: "\u274C <b>RED</b>\n\n\u{1F7E1} <b>Empate n\u00E3o confirmou</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
  validator: "\u274C <b>RED</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}",
};
const DEFAULT_MODULE_EXPIRED_TEMPLATES = {
  ai_patterns: "\u231B <b>SINAL EXPIRADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}",
  paying_numbers: "\u231B <b>SINAL EXPIRADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}",
  surf_alert: "\u231B <b>SINAL EXPIRADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Dire\u00E7\u00E3o:</b> {{side}}",
  ties_only: "\u231B <b>ALERTA DE EMPATE EXPIRADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}",
  validator: "\u231B <b>SINAL EXPIRADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}",
};
const DEFAULT_MODULE_CANCELED_TEMPLATES = {
  ai_patterns: "\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}",
  paying_numbers: "\u{1F6AB} <b>SINAL BLOQUEADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}",
  surf_alert: "\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}",
  ties_only: "\u{1F6AB} <b>ALERTA CANCELADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u{1F4CC} <b>Motivo:</b> {{result}}",
  validator: "\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F4CC} <b>Motivo:</b> {{result}}",
};
const DEFAULT_MODULE_TIE_TEMPLATES = DEFAULT_MODULE_GREEN_TEMPLATES;
const MAX_CHANNELS_PER_USER = 20;
const MAX_NOTIFICATIONS = 1000;
const DEFAULT_ACCESS_GRACE_DAYS = 5;

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
    if (!env.TELEGRAM_ENGINE) return json({ error: "Durable Object binding missing" }, 500, env);
    const id = env.TELEGRAM_ENGINE.idFromName("global");
    return env.TELEGRAM_ENGINE.get(id).fetch(request);
  },

  async scheduled(_event, env, ctx) {
    if (!env.TELEGRAM_ENGINE) return;
    const id = env.TELEGRAM_ENGINE.idFromName("global");
    const request = new Request("https://internal.sniperbo/engine/notifications/purge", { method: "POST" });
    ctx.waitUntil(env.TELEGRAM_ENGINE.get(id).fetch(request));
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
        if (request.method === "DELETE") return this.deleteChannel(userId, channelId);
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

      if (request.method === "GET" && url.pathname === "/engine/notifications/active") {
        return json({ notifications: await this.activeNotifications() }, 200, this.env);
      }

      if (request.method === "POST" && url.pathname === "/engine/notifications/purge") {
        return json(await this.purgeNotifications(), 200, this.env);
      }

      return json({ error: "Not found" }, 404, this.env);
    } catch (error) {
      return json({ error: "Cloud Telegram failed", detail: errorMessage(error) }, 500, this.env);
    }
  }

  async validateChannel(userId, body) {
    const botToken = normalizeSecret(body.botToken);
    const chatId = String(body.chatId || "").trim();
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
    const botToken = normalizeSecret(incoming.botToken) || (existing ? await this.decryptToken(existing.botTokenCipher) : "");
    const chatId = String(incoming.chatId || existing?.chatId || "").trim();
    if (!botToken || !chatId) return json({ error: "Bot Token e Chat ID sao obrigatorios." }, 400, this.env);

    const duplicate = await this.findAnyChannelByChatId(chatId);
    if (duplicate && (duplicate.userId !== userId || duplicate.id !== channelId)) {
      return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);
    }
    if (!existing || normalizeSecret(incoming.botToken)) {
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
      buttonLink: normalizeUrl(String(incoming.buttonLink || existing?.buttonLink || "")),
      isActive: incoming.isActive !== false,
      analyzingEnabled: Boolean(incoming.analyzingEnabled ?? existing?.analyzingEnabled ?? false),
      analyzingCooldownRounds: clampInt(incoming.analyzingCooldownRounds ?? existing?.analyzingCooldownRounds ?? 3, 1, 20),
      templates: sanitizeTemplateRecord(incoming.templates || existing?.templates || {}),
      signalModules: normalizeModuleConfigs(incoming.signalModules || incoming.templates?.signalModules || existing?.signalModules || {}),
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
        "<b>Gale:</b> At\u00E9 G1",
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
    const merged = {
      ...current,
      ...readRecord(patch),
      id: current.id,
      userId,
      botTokenCipher: current.botTokenCipher,
      botTokenMasked: current.botTokenMasked,
      chatId: String(patch.chatId || current.chatId).trim(),
      chatCode: normalizeChannelCode(patch.chatId || current.chatId),
      templates: sanitizeTemplateRecord(patch.templates || current.templates || {}),
      signalModules: normalizeModuleConfigs(patch.signalModules || patch.templates?.signalModules || current.signalModules || {}),
      updatedAt: new Date().toISOString(),
    };
    const duplicate = await this.findAnyChannelByChatId(merged.chatId);
    if (duplicate && (duplicate.userId !== userId || duplicate.id !== channelId)) {
      return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);
    }
    await this.state.storage.put(channelKey(userId, channelId), merged);
    return json({ channel: publicChannel(merged) }, 200, this.env);
  }

  async deleteChannel(userId, channelId) {
    const channel = await this.getChannel(userId, channelId);
    await this.state.storage.delete(channelKey(userId, channelId));
    if (channel?.chatId) {
      await this.state.storage.put(deletedCodeKey(userId, channel.chatId), {
        userId,
        channelId,
        chatCode: normalizeChannelCode(channel.chatId),
        deletedAt: new Date().toISOString(),
      });
    }
    return json({ ok: true, deleted: channel ? 1 : 0 }, 200, this.env);
  }

  async dispatchSignal(body) {
    const moduleKey = normalizeModuleKey(body.moduleKey || body.type);
    if (!moduleKey) return json({ error: "M\u00F3dulo invalido." }, 400, this.env);
    const entry = normalizeEntry(body.entry);
    const targetUserId = normalizeUserId(body.userId || "");
    const targetChannelId = String(body.channelId || "").trim();
    const signalKey = String(body.signalKey || body.id || `${moduleKey}:${Date.now()}`);
    const variables = readRecord(body.variables);
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

    const sentChatCodes = new Set();
    for (const channel of channels) {
      const chatCode = normalizeChannelCode(channel.chatId);
      if (chatCode && sentChatCodes.has(chatCode)) {
        blocked.push({ channelId: channel.id, reason: "duplicate_chat_id" });
        continue;
      }
      if (!channel.isActive) {
        blocked.push({ channelId: channel.id, reason: "channel_inactive" });
        continue;
      }
      const config = normalizeModuleConfigs(channel.signalModules || {})[moduleKey];
      if (moduleKey === "ai_patterns" && entry === "TIE") {
        blocked.push({ channelId: channel.id, reason: "entry_not_allowed" });
        continue;
      }
      if (!config.enabled) {
        blocked.push({ channelId: channel.id, reason: "module_inactive" });
        continue;
      }
      if (signalKind === "entry" && entry && !moduleAllowsEntry(config, entry)) {
        blocked.push({ channelId: channel.id, reason: "entry_not_allowed" });
        continue;
      }
      let cooldownKey = "";
      if (signalKind === "entry") {
        cooldownKey = `cooldown:${channel.userId}:${channel.id}:${moduleKey}`;
        const lastSentAt = Number(await this.state.storage.get(cooldownKey) || 0);
        const cooldownMs = Math.max(0, Number(config.cooldownSeconds) || 0) * 1000;
        if (lastSentAt && cooldownMs && Date.now() - lastSentAt < cooldownMs) {
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
      const renderedMessage = shouldRenderSignalTemplate(template, templateVariables)
        ? renderTemplate(template, templateVariables)
        : String(body.message || "");
      const message = formatTelegramMessageText(String(renderedMessage || body.message || renderTemplate("{{entry}}", templateVariables))).slice(0, 4096);
      const dedupeKeys = [`sent:${channel.userId}:${channel.id}:${signalKey}`];
      const entryDedupeKey = entrySignalDedupeKey(channel, roundId, entry, signalKind);
      if (entryDedupeKey) dedupeKeys.push(entryDedupeKey);
      const resultDedupeKey = resultSignalDedupeKey(channel, roundId, entry, signalKind, notificationResult);
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
        blocked.push({ channelId: channel.id, reason: "duplicate_signal" });
        continue;
      }
      const buttons = telegramButtonsForSignal(config, channel, body);
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
          ...variables,
          moduleKey,
          signalKey,
          entry: formatEntry(entry),
          protection: finalNotificationProtection,
          result: notificationResult,
          telegramMessageId: result.messageId || null,
          buttonCount: buttons.length,
          cloudflare: true,
        },
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      for (const dedupeKey of dedupeKeys) {
        await this.state.storage.put(dedupeKey, true);
      }
      if (cooldownKey) await this.state.storage.put(cooldownKey, Date.now());
      if (result.ok && chatCode) sentChatCodes.add(chatCode);
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

  async sendAdHocTelegram(body) {
    const result = await sendTelegramMessage({
      botToken: normalizeSecret(body.botToken),
      chatId: String(body.chatId || "").trim(),
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
      if (access.active) allowed.push(channel);
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
    return await this.state.storage.get(channelKey(userId, channelId)) || null;
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
    return [...rows.values()].find((channel) => normalizeChannelCode(channel?.chatId) === code) || null;
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

  async activeNotifications() {
    const rows = await this.state.storage.list({ prefix: "notification:" });
    const notifications = [...rows.values()].filter((notification) => notification?.userId && notification?.channelId);
    return notifications
      .sort((a, b) => Date.parse(b.updatedAt || b.sentAt || "") - Date.parse(a.updatedAt || a.sentAt || ""))
      .slice(0, MAX_NOTIFICATIONS);
  }

  async purgeNotifications() {
    const rows = await this.state.storage.list({ prefix: "notification:" });
    await Promise.all([...rows.keys()].map((key) => this.state.storage.delete(key)));
    const purgedAt = new Date().toISOString();
    await this.state.storage.put(`maintenance:notifications_purged:${Date.now()}`, {
      deleted: rows.size,
      purgedAt,
      reason: "start_future_only",
    });
    return { ok: true, deleted: rows.size, purgedAt };
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

function entrySignalDedupeKey(channel, roundId, entry, signalKind) {
  if (signalKind !== "entry" || !roundId || !entry) return "";
  return `sent-entry:${channel.userId}:${channel.id}:${roundId}:${entry}`;
}

function resultSignalDedupeKey(channel, roundId, entry, signalKind, result) {
  if (signalKind !== "result" || !roundId) return "";
  const resultKey = normalizeDedupeText(result);
  if (!resultKey) return "";
  return `sent-result:${channel.userId}:${channel.id}:${roundId}:${entry || "AUTO"}:${resultKey}`;
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
  const repaired = repairTelegramEncodingArtifacts(value);
  return decoratePatternLines(decorateScoreTokens(restoreTelegramEmojiMarkers(repaired)));
}

function restoreTelegramEmojiMarkers(value) {
  const red = "\u{1F534}";
  const blue = "\u{1F535}";
  const yellow = "\u{1F7E1}";
  let text = repairTelegramEncodingArtifacts(value)
    .replace(/^\?{1,4}\s*((?:<b>)?ENTRADA CONFIRMADA(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?PADR?O IA CONFIRMADO(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?PADRAO IA CONFIRMADO(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?PADRAO VALIDADOR(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?NUMERO PAGANTE CONFIRMADO(?:<\/b>)?)/gim, "\u{1F48E} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?AVISO DE SURF CONFIRMADO(?:<\/b>)?)/gim, "\u{1F30A} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?POSSIVEL EMPATE(?:<\/b>)?)/gim, "\u{1F7E1} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Mesa:\s*(?:<\/b>)?)/gim, "\u{1F3B2} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Padr(?:\u00E3o|ao):\s*(?:<\/b>)?)/gim, "\u{1F9E9} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Entrada:\s*(?:<\/b>)?)/gim, "\u{1F3AF} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Prote(?:\u00E7\u00E3o|cao):\s*(?:<\/b>)?)/gim, "\u{1F6E1}\uFE0F $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Assertividade:\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?N(?:\u00FAmero|umero):\s*(?:<\/b>)?)/gim, "\u{1F522} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Status:\s*(?:<\/b>)?)/gim, "\u{1F4CC} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Risco:\s*(?:<\/b>)?)/gim, "\u26A0\uFE0F $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Confian(?:\u00E7a|ca):\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1");
  text = decorateKnownTelegramLines(text);
  return decoratePatternLines(text)
    .replace(/\?{1,4}\s*(BANKER|Banker)\b/g, red + " $1")
    .replace(/\?{1,4}\s*(PLAYER|Player)\b/g, blue + " $1")
    .replace(/\?{1,4}\s*(TIE|Tie)\b/g, yellow + " $1")
    .replace(/\u{1F534}\s*Banker\b/gu, "\u{1F534} BANKER")
    .replace(/\u{1F535}\s*Player\b/gu, "\u{1F535} PLAYER")
    .replace(/\u{1F7E1}\s*Tie\b/gu, "\u{1F7E1} TIE")
    .replace(/^\?{1,4}\s*(?=(?:<b>)?(?:PADR?O|Padrao|Padr\u00E3o|Mesa|Modulo|M\u00F3dulo|Entrada|Protecao|Prote\u00E7\u00E3o|Assertividade|Numero|N\u00FAmero|Status|Green|Red|RED|Empate|AVISO))/gim, "");
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
    .replace(/\[PR[\uFFFD?]+E?VIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/\[PREVIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/PADR[\uFFFD?]+O/g, "PADRAO")
    .replace(/Padr[\uFFFD?]+o/gi, "Padrao")
    .replace(/Prote[\uFFFD?]+o/gi, "Protecao")
    .replace(/M[\uFFFD?]+dulo/gi, "Modulo")
    .replace(/N[\uFFFD?]+mero/gi, "Numero")
    .replace(/Confian[\uFFFD?]+a/gi, "Confianca")
    .replace(/POSS[\uFFFD?]+VEL/gi, "POSSIVEL")
    .replace(/N[\uFFFD?]+vel/gi, "Nivel")
    .replace(/\bPADRAO\b/g, "PADR\u00C3O")
    .replace(/\bPadrao\b/g, "Padr\u00E3o")
    .replace(/\bProtecao\b/gi, "Prote\u00E7\u00E3o")
    .replace(/\bModulo\b/gi, "M\u00F3dulo")
    .replace(/\bNumero\b/gi, "N\u00FAmero")
    .replace(/\bConfianca\b/gi, "Confian\u00E7a")
    .replace(/\bPOSSIVEL\b/gi, "POSS\u00CDVEL")
    .replace(/\bNivel\b/gi, "N\u00EDvel")
    .replace(/\bate\b/gi, "at\u00E9")
    .replace(/Assertividade:\s*$/gim, "Assertividade:");
}
function decorateScoreTokens(message) {
  return String(message || "").replace(/\b([BPT])\s*([2-9]|1[0-2])\b/gi, (match, side, number, offset, fullText) => {
    const previous = String(fullText || "").slice(Math.max(0, offset - 4), offset);
    if (previous.includes("\u{1F534}") || previous.includes("\u{1F535}") || previous.includes("\u{1F7E1}")) return match;
    const normalizedSide = String(side || "").toUpperCase();
    const circle = telegramSideCircle(normalizedSide);
    return circle ? `${circle}${number}` : match;
  });
}
function formatGale(value) {
  const gale = clampInt(value, 0, 4);
  return gale <= 0 ? "SG" : `G${gale}`;
}

function moduleName(key) {
  if (key === "ai_patterns") return "Padr\u00F5es IA";
  if (key === "paying_numbers") return "N\u00FAmeros Pagantes";
  if (key === "surf_alert") return "Aviso de Surf";
  if (key === "ties_only") return "Somente Empates";
  return "Validador";
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
