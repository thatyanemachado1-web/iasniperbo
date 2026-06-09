import { readUserSession } from "@/lib/userSession";
import type { Round } from "@/types/dashboard";
import type {
  SavedValidatorPattern,
  ValidatorMessageTemplates,
  ValidatorNotificationChannel,
  ValidatorPatternToken,
} from "@/types/neuralValidator";

const SAVED_PATTERNS_KEY = "sniper_neural_validator_patterns_v1";
const CHANNELS_KEY = "sniper_neural_validator_channels_v1";
const DRAFT_KEY = "sniper_neural_validator_draft_v1";
const ROUND_HISTORY_KEY = "sniper_round_history_v1";

export const DEFAULT_MESSAGE_TEMPLATES: ValidatorMessageTemplates = {
  entry:
    "ENTRADA CONFIRMADA\nMesa: {{table}}\nPadrao: {{pattern}}\nEntrada: {{entry}}\nGale: {{gale}}\nProtecao Tie: {{tieProtection}}\nAssertividade: {{percentage}}",
  gale: "FAZ O {{gale}}\nEntrada: {{entry}}",
  green: "GREEN\nPadrao: {{pattern}}\nResultado: {{result}}",
  red: "RED\nPadrao: {{pattern}}",
  scoreboard: "{{wins}} GREEN / {{loss}} RED / {{percentage}}",
  greenStreak: "{{wins}} GREENS SEGUIDOS",
  preAlert: "Padrao quase formado\nMesa: {{table}}\nCondicao: {{pattern}}\nPossivel entrada: {{entry}}",
};

interface StoredHistory {
  rounds?: Round[];
}

export function readValidatorHistory(fallbackRounds: Round[]) {
  if (typeof window === "undefined") return fallbackRounds;
  const sessionKey = userStorageKey(ROUND_HISTORY_KEY);
  const globalKey = ROUND_HISTORY_KEY;
  const stored = [sessionKey, globalKey]
    .map((key) => readJson<StoredHistory>(key))
    .find((history) => Array.isArray(history?.rounds) && history.rounds.length);

  const rounds = stored?.rounds?.filter(isRound) ?? [];
  if (rounds.length) return rounds.sort(compareRounds);
  return fallbackRounds.filter(isRound);
}

export function readSavedPatterns() {
  return readUserList<SavedValidatorPattern>(SAVED_PATTERNS_KEY).map((pattern) => ({
    ...pattern,
    pattern: Array.isArray(pattern.pattern) ? pattern.pattern.filter(isPatternToken) : [],
  }));
}

export function writeSavedPatterns(patterns: SavedValidatorPattern[]) {
  writeUserList(SAVED_PATTERNS_KEY, patterns);
}

export function upsertSavedPattern(pattern: SavedValidatorPattern) {
  const current = readSavedPatterns();
  const index = current.findIndex((item) => item.id === pattern.id);
  const next = index >= 0
    ? current.map((item) => (item.id === pattern.id ? pattern : item))
    : [pattern, ...current];
  writeSavedPatterns(next);
  return next;
}

export function removeSavedPattern(patternId: string) {
  const next = readSavedPatterns().filter((pattern) => pattern.id !== patternId);
  writeSavedPatterns(next);
  return next;
}

export function readNotificationChannels() {
  const channels = readUserList<ValidatorNotificationChannel>(CHANNELS_KEY);
  const sanitized = channels.map(sanitizeNotificationChannel);
  if (channels.some((channel, index) => channel.botTokenEncoded !== sanitized[index]?.botTokenEncoded)) {
    writeNotificationChannels(sanitized);
  }
  return sanitized;
}

export function writeNotificationChannels(channels: ValidatorNotificationChannel[]) {
  writeUserList(CHANNELS_KEY, channels.map(sanitizeNotificationChannel));
}

export function upsertNotificationChannel(channel: ValidatorNotificationChannel) {
  const current = readNotificationChannels();
  const index = current.findIndex((item) => item.id === channel.id);
  const next = index >= 0
    ? current.map((item) => (item.id === channel.id ? channel : item))
    : [channel, ...current];
  writeNotificationChannels(next);
  return next;
}

export function removeNotificationChannel(channelId: string) {
  const next = readNotificationChannels().filter((channel) => channel.id !== channelId);
  writeNotificationChannels(next);
  return next;
}

export function readPatternDraft() {
  return readJson<ValidatorPatternToken[]>(userStorageKey(DRAFT_KEY))?.filter(isPatternToken) ?? [];
}

export function writePatternDraft(pattern: ValidatorPatternToken[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(userStorageKey(DRAFT_KEY), JSON.stringify(pattern));
}

export function currentUserId() {
  return readUserSession().email.trim().toLowerCase() || "local-user";
}

export function createStorageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function maskBotToken(token: string) {
  const clean = token.trim();
  if (!clean) return "";
  if (clean.length <= 10) return `${clean.slice(0, 3)}...`;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

export function encodeToken(token: string) {
  if (typeof window === "undefined") return "";
  return window.btoa(unescape(encodeURIComponent(token.trim())));
}

export function decodeToken(encoded: string) {
  if (typeof window === "undefined" || !encoded) return "";
  try {
    return decodeURIComponent(escape(window.atob(encoded)));
  } catch {
    return "";
  }
}

function sanitizeNotificationChannel(channel: ValidatorNotificationChannel): ValidatorNotificationChannel {
  return {
    ...channel,
    botTokenEncoded: "",
    templates: { ...DEFAULT_MESSAGE_TEMPLATES, ...channel.templates },
  };
}

function readUserList<T>(key: string): T[] {
  const payload = readJson<{ userId?: string; items?: T[] }>(userStorageKey(key));
  return Array.isArray(payload?.items) ? payload.items : [];
}

function writeUserList<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    userStorageKey(key),
    JSON.stringify({ userId: currentUserId(), items }),
  );
}

function userStorageKey(key: string) {
  const userId = currentUserId();
  return `${key}:${userId}`;
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}

function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>;
  return (
    typeof round.id === "number" &&
    (round.result === "B" || round.result === "P" || round.result === "T") &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}

function isPatternToken(value: unknown): value is ValidatorPatternToken {
  const token = value as Partial<ValidatorPatternToken>;
  return (
    (token.side === "B" || token.side === "P" || token.side === "T") &&
    (token.score === undefined || typeof token.score === "number")
  );
}

function compareRounds(a: Round, b: Round) {
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  return a.time.localeCompare(b.time);
}
