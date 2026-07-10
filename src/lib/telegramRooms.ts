import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type {
  TelegramRoomEventButtonConfig,
  TelegramRoomSignalModuleConfig,
  TelegramRoomTemplateKey,
  ValidatorNotificationChannel,
} from "@/types/neuralValidator";

export type TelegramRoomModuleKey =
  | "paying_numbers"
  | "surf_alert"
  | "ai_patterns"
  | "ties_only"
  | "validator";

export const TELEGRAM_ROOM_MODULES: Array<{ key: TelegramRoomModuleKey; label: string }> = [
  { key: "paying_numbers", label: "Leitura Neural / Numero Pagante" },
  { key: "surf_alert", label: "Surf Analyzer" },
  { key: "ai_patterns", label: "Padroes IA" },
  { key: "ties_only", label: "Radar de Empate" },
  { key: "validator", label: "Validador individual" },
];

export const TELEGRAM_ROOM_TEMPLATE_OPTIONS: Array<{ key: TelegramRoomTemplateKey; label: string }> = [
  { key: "entry", label: "Entrada" },
  { key: "g1", label: "Protecao G1" },
  { key: "greenSG", label: "Green SG" },
  { key: "greenG1", label: "Green G1" },
  { key: "red", label: "Red" },
  { key: "tie", label: "Empate / protecao" },
  { key: "tie25x", label: "Empate 25x" },
  { key: "tie88x", label: "Empate 88x" },
];

export const TELEGRAM_ROOM_EVENT_OPTIONS: Array<{
  key: keyof TelegramRoomSignalModuleConfig;
  label: string;
}> = [
  { key: "sendEntry", label: "Entrada" },
  { key: "sendG1Active", label: "Protecao G1" },
  { key: "sendGreenSG", label: "Green SG" },
  { key: "sendGreenG1", label: "Green G1" },
  { key: "sendRed", label: "Red" },
  { key: "sendTieProtection", label: "Empate / protecao" },
  { key: "sendTieConfirmed", label: "Empate confirmado" },
  { key: "sendTie4x", label: "Empate 4x" },
  { key: "sendTie6x", label: "Empate 6x" },
  { key: "sendTie10x", label: "Empate 10x" },
  { key: "sendTie25x", label: "Empate 25x" },
  { key: "sendTie88x", label: "Empate 88x" },
];

export async function listTelegramRooms() {
  const response = await fetch("/telegram/channels", {
    cache: "no-store",
    headers: telegramRoomHeaders(),
  });
  const data = (await response.json().catch(() => null)) as {
    channels?: ValidatorNotificationChannel[];
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao carregar salas Telegram.");
  return Array.isArray(data?.channels) ? data.channels : [];
}

export async function updateTelegramRoom(
  channelId: string,
  patch: Partial<ValidatorNotificationChannel>,
) {
  const response = await fetch(`/telegram/channels/${encodeURIComponent(channelId)}`, {
    method: "PATCH",
    cache: "no-store",
    headers: telegramRoomHeaders(true),
    body: JSON.stringify(patch),
  });
  const data = (await response.json().catch(() => null)) as {
    channel?: ValidatorNotificationChannel;
    error?: string;
  } | null;
  if (!response.ok || !data?.channel) {
    throw new Error(data?.error || "Servidor nao confirmou a sala Telegram.");
  }
  return data.channel;
}

export async function toggleTelegramRoomModule(
  channelId: string,
  motorKey: TelegramRoomModuleKey,
  enabled: boolean,
) {
  const response = await fetch("/telegram/motors/toggle", {
    method: "POST",
    cache: "no-store",
    headers: telegramRoomHeaders(true),
    body: JSON.stringify({ channelId, motorKey, enabled }),
  });
  const data = (await response.json().catch(() => null)) as {
    channel?: ValidatorNotificationChannel;
    error?: string;
  } | null;
  if (!response.ok || !data?.channel) {
    throw new Error(data?.error || "Servidor nao confirmou o modulo Telegram.");
  }
  return data.channel;
}

export async function testTelegramRoom(channelId: string) {
  const response = await fetch("/telegram/channels/test", {
    method: "POST",
    cache: "no-store",
    headers: telegramRoomHeaders(true),
    body: JSON.stringify({ channelId }),
  });
  const data = (await response.json().catch(() => null)) as {
    channel?: ValidatorNotificationChannel;
    messageId?: number | string | null;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao testar sala Telegram.");
  return data;
}

export async function previewTelegramRoom(
  channelId: string,
  message: string,
  button?: TelegramRoomEventButtonConfig,
) {
  const response = await fetch("/telegram/channels/preview", {
    method: "POST",
    cache: "no-store",
    headers: telegramRoomHeaders(true),
    body: JSON.stringify({
      channelId,
      message,
      buttons: button?.enabled ? [{ label: button.text, url: button.url }] : [],
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    messageId?: number | string | null;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao enviar previa Telegram.");
  return data;
}

export function telegramRoomModuleEnabled(
  channel: ValidatorNotificationChannel,
  moduleKey: TelegramRoomModuleKey,
) {
  return telegramRoomModuleConfig(channel, moduleKey).enabled;
}

export function telegramRoomModuleConfig(
  channel: ValidatorNotificationChannel,
  moduleKey: TelegramRoomModuleKey,
): TelegramRoomSignalModuleConfig {
  const modules = channel.signalModules && typeof channel.signalModules === "object"
    ? channel.signalModules as Record<string, unknown>
    : {};
  const raw = roomRecord(modules[moduleKey]);
  const greenTemplate = roomString(raw.greenTemplate) || defaultRoomTemplate("greenSG");
  const tieTemplate = roomString(raw.tieTemplate) || defaultRoomTemplate("tie");
  return {
    ...raw,
    enabled: roomBoolean(raw, "enabled", false),
    sendEntry: roomBoolean(raw, "sendEntry", true),
    sendG1Active: roomBoolean(raw, "sendG1Active", true),
    sendGreenSG: roomBoolean(raw, "sendGreenSG", true),
    sendGreenG1: roomBoolean(raw, "sendGreenG1", true),
    sendRed: roomBoolean(raw, "sendRed", true),
    sendTieProtection: roomBoolean(raw, "sendTieProtection", true),
    sendTieConfirmed: roomBoolean(raw, "sendTieConfirmed", true),
    sendTie4x: roomBoolean(raw, "sendTie4x", true),
    sendTie6x: roomBoolean(raw, "sendTie6x", true),
    sendTie10x: roomBoolean(raw, "sendTie10x", true),
    sendTie25x: roomBoolean(raw, "sendTie25x", true),
    sendTie88x: roomBoolean(raw, "sendTie88x", true),
    g1MessageBehavior: normalizeRoomG1Behavior(raw.g1MessageBehavior),
    template: roomString(raw.template) || defaultRoomTemplate("entry"),
    galeTemplate: roomString(raw.galeTemplate) || defaultRoomTemplate("g1"),
    greenTemplate,
    greenSGTemplate: roomString(raw.greenSGTemplate) || greenTemplate,
    greenG1Template: roomString(raw.greenG1Template) || greenTemplate,
    redTemplate: roomString(raw.redTemplate) || defaultRoomTemplate("red"),
    tieTemplate,
    tie25xTemplate: roomString(raw.tie25xTemplate) || tieTemplate,
    tie88xTemplate: roomString(raw.tie88xTemplate) || tieTemplate,
    eventButtons: normalizeRoomEventButtons(raw.eventButtons),
  };
}

export function telegramRoomSignalModulesPatch(
  channel: ValidatorNotificationChannel,
  moduleKey: TelegramRoomModuleKey,
  moduleConfig: TelegramRoomSignalModuleConfig,
) {
  const modules = channel.signalModules && typeof channel.signalModules === "object"
    ? channel.signalModules as Record<string, unknown>
    : {};
  return {
    ...modules,
    [moduleKey]: moduleConfig,
  };
}

export function telegramRoomTemplateText(
  config: TelegramRoomSignalModuleConfig,
  key: TelegramRoomTemplateKey,
) {
  if (key === "entry") return config.template;
  if (key === "g1") return config.galeTemplate;
  if (key === "greenSG") return config.greenSGTemplate;
  if (key === "greenG1") return config.greenG1Template;
  if (key === "red") return config.redTemplate;
  if (key === "tie25x") return config.tie25xTemplate;
  if (key === "tie88x") return config.tie88xTemplate;
  return config.tieTemplate;
}

export function patchTelegramRoomTemplateText(
  config: TelegramRoomSignalModuleConfig,
  key: TelegramRoomTemplateKey,
  value: string,
): TelegramRoomSignalModuleConfig {
  if (key === "entry") return { ...config, template: value };
  if (key === "g1") return { ...config, galeTemplate: value };
  if (key === "greenSG") return { ...config, greenSGTemplate: value };
  if (key === "greenG1") return { ...config, greenG1Template: value };
  if (key === "red") return { ...config, redTemplate: value };
  if (key === "tie25x") return { ...config, tie25xTemplate: value };
  if (key === "tie88x") return { ...config, tie88xTemplate: value };
  return { ...config, tieTemplate: value };
}

export function telegramRoomEventButton(
  config: TelegramRoomSignalModuleConfig,
  key: TelegramRoomTemplateKey,
): TelegramRoomEventButtonConfig {
  return config.eventButtons[key] || { enabled: false, text: "Abrir Sniper Bo IA", url: "" };
}

export function patchTelegramRoomEventButton(
  config: TelegramRoomSignalModuleConfig,
  key: TelegramRoomTemplateKey,
  patch: Partial<TelegramRoomEventButtonConfig>,
): TelegramRoomSignalModuleConfig {
  const current = telegramRoomEventButton(config, key);
  return {
    ...config,
    eventButtons: {
      ...config.eventButtons,
      [key]: { ...current, ...patch },
    },
  };
}

export function renderTelegramRoomPreview(template: string) {
  const variables: Record<string, string> = {
    table: "Bac Bo",
    pattern: "B8 P7 B6",
    entry: "BANKER",
    entryLabel: "Banker",
    entryCompact: "Banker",
    module: "SniperBO IA",
    gale: "G1",
    protection: "G1",
    result: "GREEN SG",
    number: "8",
    confidence: "96%",
    percentage: "96%",
    tieMultiplier: "25x",
    time: "12:34",
    status: "CONFIRMADO",
    level: "ALTO",
    risk: "BAIXO",
  };
  return template.replace(/{{\s*([a-zA-Z_]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

export function validateTelegramRoomButton(button: TelegramRoomEventButtonConfig) {
  if (!button.enabled) return "";
  if (!button.text.trim()) return "Informe o texto do botao.";
  try {
    const url = new URL(button.url.trim());
    return url.protocol === "https:" ? "" : "A URL do botao precisa comecar com https://.";
  } catch {
    return "Informe uma URL https:// valida para o botao.";
  }
}

function normalizeRoomEventButtons(value: unknown) {
  const record = roomRecord(value);
  return TELEGRAM_ROOM_TEMPLATE_OPTIONS.reduce<Partial<Record<TelegramRoomTemplateKey, TelegramRoomEventButtonConfig>>>((acc, option) => {
    const raw = roomRecord(record[option.key]);
    if (!Object.keys(raw).length) return acc;
    acc[option.key] = {
      enabled: roomBoolean(raw, "enabled", false),
      text: roomString(raw.text || raw.label) || "Abrir Sniper Bo IA",
      url: roomString(raw.url),
    };
    return acc;
  }, {});
}

function normalizeRoomG1Behavior(value: unknown): TelegramRoomSignalModuleConfig["g1MessageBehavior"] {
  return value === "delete_on_final" || value === "edit_to_final" ? value : "keep";
}

function defaultRoomTemplate(key: TelegramRoomTemplateKey) {
  if (key === "entry") return "<b>ENTRADA CONFIRMADA</b>\n\nEntrada: {{entry}}\nProtecao: {{gale}}";
  if (key === "g1") return "<b>PROTECAO G1 ATIVA</b>\n\nEntrada: {{entry}}";
  if (key === "greenSG") return "<b>GREEN SG</b>\n\nEntrada: {{entry}}";
  if (key === "greenG1") return "<b>GREEN G1</b>\n\nEntrada: {{entry}}";
  if (key === "red") return "<b>RED</b>\n\nEntrada: {{entry}}";
  if (key === "tie25x") return "<b>EMPATE 25x</b>\n\nEntrada: {{entry}}";
  if (key === "tie88x") return "<b>EMPATE 88x</b>\n\nEntrada: {{entry}}";
  return "<b>{{result}}</b>\n\nEntrada: {{entry}}";
}

function roomRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function roomString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function roomBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] === true : fallback;
}

function telegramRoomHeaders(withJson = false) {
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = userSession.clientToken || adminSession?.token || "";
  return {
    Accept: "application/json",
    "X-Validator-User-Id": userSession.email || adminSession?.email || "",
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
