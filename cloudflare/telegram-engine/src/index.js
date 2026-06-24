const MODULE_KEYS = ["ai_patterns", "paying_numbers", "surf_alert", "ties_only", "validator"];
const DEFAULT_MODULE_CONFIG = {
  enabled: false,
  entryType: "AUTO",
  galeLimit: 1,
  coverTie: false,
  tieCoverage: 1,
  cooldownSeconds: 2,
  template: "",
  greenTemplate: "",
  redTemplate: "",
  tieTemplate: "",
};
const MAX_CHANNELS_PER_USER = 20;
const MAX_NOTIFICATIONS = 1000;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse(env);
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "sniperbo-telegram-engine" }, 200, env);
    }

    const secret = env.ENGINE_API_SECRET || "";
    if (!secret || bearerToken(request) !== secret) {
      return json({ error: "Unauthorized" }, 401, env);
    }
    if (!env.TELEGRAM_ENGINE) return json({ error: "Durable Object binding missing" }, 500, env);

    const id = env.TELEGRAM_ENGINE.idFromName("global");
    return env.TELEGRAM_ENGINE.get(id).fetch(request);
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

      if (request.method === "GET" && url.pathname === "/engine/channels/active") {
        return json({ channels: await this.activePublicChannels() }, 200, this.env);
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
    const duplicate = await this.findUserChannelByChatId(userId, chatId);
    if (duplicate) return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409, this.env);

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
    const channelId = String(incoming.id || crypto.randomUUID());
    const existing = await this.getChannel(userId, channelId);
    const botToken = normalizeSecret(incoming.botToken) || (existing ? await this.decryptToken(existing.botTokenCipher) : "");
    const chatId = String(incoming.chatId || existing?.chatId || "").trim();
    if (!botToken || !chatId) return json({ error: "Bot Token e Chat ID sao obrigatorios." }, 400, this.env);

    const duplicate = await this.findUserChannelByChatId(userId, chatId);
    if (duplicate && duplicate.id !== channelId) {
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
      templates: readRecord(incoming.templates || existing?.templates || {}),
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
        "<b>Padrao:</b> B10 > T7 > P6",
        "<b>Entrada:</b> B Banker",
        "<b>Gale:</b> Ate G1",
        "<b>Protecao Tie:</b> Ativa",
        `<b>Canal:</b> ${escapeHtml(channel.name)}`,
      ].join("\n"),
      buttonLabel: "Abrir Sniper Bo IA",
      buttonUrl: channel.buttonLink,
      parseMode: "HTML",
    });
    if (!result.ok) return json({ error: result.error }, result.status, this.env);
    return json({ ok: true, messageId: result.messageId }, 200, this.env);
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
      signalModules: normalizeModuleConfigs(patch.signalModules || patch.templates?.signalModules || current.signalModules || {}),
      updatedAt: new Date().toISOString(),
    };
    const duplicate = await this.findUserChannelByChatId(userId, merged.chatId);
    if (duplicate && duplicate.id !== channelId) {
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
    if (!moduleKey) return json({ error: "Modulo invalido." }, 400, this.env);
    const entry = normalizeEntry(body.entry);
    const targetUserId = normalizeUserId(body.userId || "");
    const signalKey = String(body.signalKey || body.id || `${moduleKey}:${Date.now()}`);
    const channels = targetUserId ? await this.channelsForUser(targetUserId) : await this.activeChannels();
    const sent = [];
    const blocked = [];

    for (const channel of channels) {
      if (!channel.isActive) {
        blocked.push({ channelId: channel.id, reason: "channel_inactive" });
        continue;
      }
      const config = normalizeModuleConfigs(channel.signalModules || {})[moduleKey];
      if (!config.enabled) {
        blocked.push({ channelId: channel.id, reason: "module_inactive" });
        continue;
      }
      if (entry && !moduleAllowsEntry(config, entry)) {
        blocked.push({ channelId: channel.id, reason: "entry_not_allowed" });
        continue;
      }
      const cooldownKey = `cooldown:${channel.userId}:${channel.id}:${moduleKey}`;
      const lastSentAt = Number(await this.state.storage.get(cooldownKey) || 0);
      const cooldownMs = Math.max(0, Number(config.cooldownSeconds) || 0) * 1000;
      if (lastSentAt && cooldownMs && Date.now() - lastSentAt < cooldownMs) {
        blocked.push({ channelId: channel.id, reason: "cooldown_active" });
        continue;
      }
      const dedupeKey = `sent:${channel.userId}:${channel.id}:${signalKey}`;
      if (await this.state.storage.get(dedupeKey)) {
        blocked.push({ channelId: channel.id, reason: "duplicate_signal" });
        continue;
      }

      const message = String(body.message || renderTemplate(config.template || "{{entry}}", {
        ...readRecord(body.variables),
        entry: formatEntry(entry),
        module: moduleName(moduleKey),
        gale: formatGale(config.galeLimit),
      })).slice(0, 4096);
      const result = await sendTelegramMessage({
        botToken: await this.decryptToken(channel.botTokenCipher),
        chatId: channel.chatId,
        message,
        buttonLabel: String(body.buttonLabel || "Abrir Sniper Bo IA"),
        buttonUrl: channel.buttonLink,
        parseMode: "HTML",
      });
      const signalHash = await hashText(signalKey);
      const notification = await this.storeNotification({
        id: `module:${moduleKey}:${channel.userId}:${channel.id}:${signalHash}`,
        type: `module:${moduleKey}`,
        userId: channel.userId,
        channelId: channel.id,
        roundId: clampInt(body.roundId, 0, Number.MAX_SAFE_INTEGER),
        status: result.ok ? "sent" : "error",
        error: result.ok ? "" : result.error,
        payloadJson: {
          moduleKey,
          signalKey,
          entry: formatEntry(entry),
          protection: formatGale(config.galeLimit),
          result: "Aguardando resultado",
          telegramMessageId: result.messageId || null,
          cloudflare: true,
        },
        sentAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await this.state.storage.put(dedupeKey, true);
      await this.state.storage.put(cooldownKey, Date.now());
      (result.ok ? sent : blocked).push({
        channelId: channel.id,
        notificationId: notification.id,
        reason: result.ok ? "sent_to_telegram" : "telegram_error",
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

  async publicChannelsForUser(userId) {
    return (await this.channelsForUser(userId))
      .map(publicChannel)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async activePublicChannels() {
    return (await this.activeChannels()).map(publicChannel);
  }

  async channelsForUser(userId) {
    const rows = await this.state.storage.list({ prefix: `channel:${userId}:` });
    const deletedCodes = await this.deletedCodesForUser(userId);
    return [...rows.values()]
      .filter((channel) => channel && channel.userId === userId)
      .filter((channel) => !deletedCodes.has(channel.chatCode));
  }

  async activeChannels() {
    const rows = await this.state.storage.list({ prefix: "channel:" });
    return [...rows.values()].filter((channel) => channel?.isActive);
  }

  async getChannel(userId, channelId) {
    return await this.state.storage.get(channelKey(userId, channelId)) || null;
  }

  async findUserChannelByChatId(userId, chatId) {
    const code = normalizeChannelCode(chatId);
    if (!code) return null;
    return (await this.channelsForUser(userId)).find((channel) => channel.chatCode === code) || null;
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

function normalizeModuleConfigs(value) {
  const record = readRecord(value);
  return MODULE_KEYS.reduce((acc, key) => {
    const raw = readRecord(record[key]);
    acc[key] = {
      ...DEFAULT_MODULE_CONFIG,
      enabled: Object.prototype.hasOwnProperty.call(raw, "enabled") ? Boolean(raw.enabled) : key === "validator",
      entryType: normalizeModuleEntry(raw.entryType),
      galeLimit: clampInt(raw.galeLimit ?? (key === "ties_only" ? 0 : 1), 0, 4),
      coverTie: Object.prototype.hasOwnProperty.call(raw, "coverTie") ? Boolean(raw.coverTie) : key === "ties_only",
      tieCoverage: clampInt(raw.tieCoverage ?? (key === "ties_only" ? 4 : 1), 0, 4),
      cooldownSeconds: clampInt(raw.cooldownSeconds ?? (key === "validator" ? 0 : 2), 0, 300),
      template: String(raw.template || ""),
      greenTemplate: String(raw.greenTemplate || ""),
      redTemplate: String(raw.redTemplate || ""),
      tieTemplate: String(raw.tieTemplate || ""),
    };
    return acc;
  }, {});
}

function publicChannel(channel) {
  return {
    id: channel.id,
    userId: channel.userId,
    name: channel.name,
    botTokenMasked: channel.botTokenMasked,
    botTokenEncoded: "",
    chatId: channel.chatId,
    buttonLink: channel.buttonLink,
    isActive: channel.isActive,
    analyzingEnabled: channel.analyzingEnabled,
    analyzingCooldownRounds: channel.analyzingCooldownRounds,
    templates: channel.templates || {},
    signalModules: normalizeModuleConfigs(channel.signalModules || {}),
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
  };
}

async function sendTelegramMessage({ botToken, chatId, message, buttonLabel = "", buttonUrl = "", parseMode = "HTML" }) {
  if (!botToken || !chatId) return { ok: false, status: 400, error: "Canal Telegram sem token ou Chat ID." };
  const payload = {
    chat_id: chatId,
    text: String(message || "").slice(0, 4096),
    disable_web_page_preview: true,
    parse_mode: parseMode,
  };
  const url = normalizeUrl(buttonUrl);
  if (url && buttonLabel) {
    payload.reply_markup = { inline_keyboard: [[{ text: buttonLabel.slice(0, 64), url }]] };
  }
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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

async function readJson(request) {
  return readRecord(await request.json().catch(() => ({})));
}

function readRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function channelKey(userId, channelId) {
  return `channel:${normalizeUserId(userId)}:${String(channelId || "").trim()}`;
}

function deletedCodeKey(userId, chatId) {
  return `deleted:${normalizeUserId(userId)}:code:${normalizeChannelCode(chatId)}`;
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
  if (entry === "BANKER") return "B Banker";
  if (entry === "PLAYER") return "P Player";
  if (entry === "TIE") return "T Tie";
  return "Automatico";
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

function renderTemplate(template, variables) {
  return String(template || "").replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_, key) => String(variables[key] ?? ""));
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
