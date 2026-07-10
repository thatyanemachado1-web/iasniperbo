import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { ValidatorNotificationChannel } from "@/types/neuralValidator";

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

export function telegramRoomModuleEnabled(
  channel: ValidatorNotificationChannel,
  moduleKey: TelegramRoomModuleKey,
) {
  const modules = channel.signalModules && typeof channel.signalModules === "object"
    ? channel.signalModules as Record<string, { enabled?: boolean }>
    : {};
  return modules[moduleKey]?.enabled === true;
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
