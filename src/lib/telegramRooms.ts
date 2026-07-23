import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { SavedValidatorPattern, ValidatorNotificationChannel } from "@/types/neuralValidator";

const TELEGRAM_ROOM_REQUEST_TIMEOUT_MS = 15_000;

export type TelegramRoomModuleKey =
  | "paying_numbers"
  | "surf_alert"
  | "ai_patterns"
  | "ties_only"
  | "validator"
  | "lateral_paying_numbers"
  | "lateral_tie_patterns";

export const TELEGRAM_ROOM_MODULES: Array<{ key: TelegramRoomModuleKey; label: string }> = [
  { key: "paying_numbers", label: "Leitura Neural / Numero Pagante" },
  { key: "surf_alert", label: "Surf Analyzer" },
  { key: "ai_patterns", label: "Padroes IA" },
  { key: "ties_only", label: "Radar de Empate" },
  { key: "validator", label: "Validador individual" },
  { key: "lateral_paying_numbers", label: "Motor lateral — Número pagante" },
  {
    key: "lateral_tie_patterns",
    label: "Motor de empate — lateral/diagonal/espaçado/horizontal",
  },
];

export type CreateTelegramRoomInput = {
  name: string;
  chatId: string;
  botToken: string;
};

export async function createTelegramRoom(input: CreateTelegramRoomInput) {
  const name = input.name.trim() || "Sala de Sinais";
  const chatId = input.chatId.trim();
  const botToken = input.botToken.trim();

  const { response: validationResponse, data: validationData } = await requestTelegramRoom<{
    validationCode?: string;
    error?: string;
  }>(
    "/telegram/channels/validate",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({ botToken, chatId }),
    },
    "A validacao da sala demorou mais de 15 segundos. Confira o bot, o Chat ID e tente novamente.",
  );
  if (!validationResponse.ok || !validationData?.validationCode) {
    throw new Error(validationData?.error || "Nao foi possivel validar a sala no Telegram.");
  }

  const signalModules = Object.fromEntries(
    TELEGRAM_ROOM_MODULES.map((module) => [module.key, { enabled: false }]),
  );
  const { response: createResponse, data: createData } = await requestTelegramRoom<{
    channel?: ValidatorNotificationChannel;
    error?: string;
  }>(
    "/telegram/channels",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({
        channel: {
          name,
          chatId,
          botToken,
          isActive: true,
          signalModules,
        },
        validationCode: validationData.validationCode,
      }),
    },
    "O cadastro da sala demorou mais de 15 segundos. Tente novamente.",
  );
  if (!createResponse.ok || !createData?.channel) {
    throw new Error(createData?.error || "Servidor nao confirmou a nova sala Telegram.");
  }
  return createData.channel;
}

export async function listTelegramRooms() {
  const { response, data } = await requestTelegramRoom<{
    channels?: ValidatorNotificationChannel[];
    error?: string;
  }>(
    "/telegram/channels",
    {
      cache: "no-store",
      headers: telegramRoomHeaders(),
    },
    "O carregamento das salas demorou mais de 15 segundos. Atualize a pagina e tente novamente.",
  );
  if (!response.ok) throw new Error(data?.error || "Falha ao carregar salas Telegram.");
  return Array.isArray(data?.channels) ? data.channels : [];
}

export async function updateTelegramRoom(
  channelId: string,
  patch: Partial<ValidatorNotificationChannel>,
) {
  const { response, data } = await requestTelegramRoom<{
    channel?: ValidatorNotificationChannel;
    error?: string;
  }>(
    `/telegram/channels/${encodeURIComponent(channelId)}`,
    {
      method: "PATCH",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify(patch),
    },
    "A atualizacao da sala demorou mais de 15 segundos. Tente novamente.",
  );
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
  const { response, data } = await requestTelegramRoom<{
    channel?: ValidatorNotificationChannel;
    error?: string;
  }>(
    "/telegram/motors/toggle",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({ channelId, motorKey, enabled }),
    },
    "A alteracao do modulo demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok || !data?.channel) {
    throw new Error(data?.error || "Servidor nao confirmou o modulo Telegram.");
  }
  return data.channel;
}

export async function testTelegramRoom(channelId: string) {
  const { response, data } = await requestTelegramRoom<{
    channel?: ValidatorNotificationChannel;
    messageId?: number | string | null;
    error?: string;
  }>(
    "/telegram/channels/test",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({ channelId }),
    },
    "O teste da sala demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok) throw new Error(data?.error || "Falha ao testar sala Telegram.");
  return data;
}

export async function deleteTelegramRoom(channelId: string) {
  const { response, data } = await requestTelegramRoom<{ ok?: boolean; error?: string }>(
    `/telegram/channels/${encodeURIComponent(channelId)}`,
    {
      method: "DELETE",
      cache: "no-store",
      headers: telegramRoomHeaders(),
    },
    "A exclusao da sala demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok)
    throw new Error(data?.error || "Servidor nao confirmou a exclusao da sala Telegram.");
  return true;
}

export async function previewTelegramRoom(
  channelId: string,
  message: string,
  buttons: Array<{ enabled?: boolean; label: string; url: string }>,
) {
  const { response, data } = await requestTelegramRoom<{
    messageId?: number | string | null;
    error?: string;
  }>(
    "/telegram/channels/preview",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({
        channelId,
        message,
        buttons: buttons
          .filter((button) => button.enabled !== false)
          .map((button) => ({ label: button.label, url: button.url })),
      }),
    },
    "O envio da previa demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok) throw new Error(data?.error || "Falha ao enviar previa no Telegram.");
  return data;
}

export async function listTelegramStrategyPatterns() {
  const { response, data } = await requestTelegramRoom<{
    patterns?: SavedValidatorPattern[];
    error?: string;
  }>(
    "/validator/patterns",
    {
      cache: "no-store",
      headers: telegramRoomHeaders(),
    },
    "O carregamento das estrategias demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok) throw new Error(data?.error || "Falha ao carregar estrategias salvas.");
  return Array.isArray(data?.patterns) ? data.patterns : [];
}

export async function saveTelegramStrategyDelivery(pattern: SavedValidatorPattern) {
  const { response, data } = await requestTelegramRoom<{
    pattern?: SavedValidatorPattern;
    error?: string;
  }>(
    "/validator/patterns",
    {
      method: "POST",
      cache: "no-store",
      headers: telegramRoomHeaders(true),
      body: JSON.stringify({ pattern }),
    },
    "O salvamento da estrategia demorou mais de 15 segundos. Tente novamente.",
  );
  if (!response.ok)
    throw new Error(data?.error || "Servidor nao confirmou o destino da estrategia.");
  return data?.pattern || pattern;
}

export function telegramRoomModuleEnabled(
  channel: ValidatorNotificationChannel,
  moduleKey: TelegramRoomModuleKey,
) {
  const modules =
    channel.signalModules && typeof channel.signalModules === "object"
      ? (channel.signalModules as Record<string, { enabled?: boolean }>)
      : {};
  return modules[moduleKey]?.enabled === true;
}

async function readTelegramRoomResponse<T extends { error?: string }>(
  response: Response,
  rethrowReadError = false,
): Promise<T | null> {
  let text = "";
  try {
    text = await response.text();
  } catch (error) {
    if (rethrowReadError) throw error;
    return null;
  }
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: /^\s*</.test(text)
        ? "O servidor nao conseguiu concluir o cadastro da sala. Tente novamente."
        : text.slice(0, 240),
    } as T;
  }
}

async function requestTelegramRoom<T extends { error?: string }>(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMessage: string,
) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    TELEGRAM_ROOM_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const data = await readTelegramRoomResponse<T>(response, true);
    return { response, data };
  } catch (error) {
    if (controller.signal.aborted) throw new Error(timeoutMessage);
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
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
