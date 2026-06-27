import type { DashboardData, NeuralReading, Round } from "@/types/dashboard";

export type TelegramAutoV2ModuleKey = "ai_patterns" | "paying_numbers" | "surf_alert" | "ties_only" | "validator";

export type TelegramAutoV2ConfirmedCard = {
  moduleKey: Exclude<TelegramAutoV2ModuleKey, "validator">;
  confirmed: true;
  signalKey: string;
  roundId: number;
  reason: string;
  meta: Record<string, unknown>;
};

export type TelegramAutoV2CardProbe = {
  moduleKey: TelegramAutoV2ModuleKey;
  confirmed: boolean;
  reason: string;
  signalKey: string;
  roundId: number;
  meta?: Record<string, unknown>;
};

export const TELEGRAM_AUTO_V2_GLOBAL_MODULES: Array<Exclude<TelegramAutoV2ModuleKey, "validator">> = [
  "ai_patterns",
  "paying_numbers",
  "surf_alert",
  "ties_only",
];

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizeSide(value: unknown): "B" | "P" | "T" | "" {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "B" || text === "BANKER" || text === "BANKER_WIN") return "B";
  if (text === "P" || text === "PLAYER" || text === "PLAYER_WIN") return "P";
  if (text === "T" || text === "TIE" || text === "TIE_WIN") return "T";
  return "";
}

function sideFromText(value: unknown): "B" | "P" | "T" | "" {
  const text = normalizeText(value);
  if (!text) return "";
  if (/\b(BANKER|BANQUEIRO|B)\b/.test(text)) return "B";
  if (/\b(PLAYER|JOGADOR|P)\b/.test(text)) return "P";
  if (/\b(TIE|EMPATE|T)\b/.test(text)) return "T";
  return "";
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isConfirmedStatusText(value: unknown) {
  const text = normalizeText(value);
  if (!text) return false;
  return (
    text.includes("ENTRADA CONFIRMADA") ||
    text.includes("CONFIRMADA") ||
    text.includes("CONFIRMADO") ||
    text.includes("ACTIVE") ||
    text.includes("ATIVO") ||
    text.includes("VALIDADO")
  );
}

function latestRoundFromDashboard(dashboard: DashboardData, fallback?: Round | null): Round | null {
  const rounds = Array.isArray(dashboard.rounds) ? dashboard.rounds : [];
  if (rounds.length) return rounds.at(-1) || null;
  return fallback || null;
}

function roundKey(round: Round | null | undefined, fallbackId = 0) {
  if (!round) return String(fallbackId || "");
  const id = Number(round.id);
  return Number.isFinite(id) && id > 0 ? String(id) : String(fallbackId || "");
}

function readPayingNumbersSideFromDashboard(dashboard: DashboardData) {
  const reading = (dashboard.neuralReading || null) as NeuralReading | null;
  const entryState = readRecord((dashboard as DashboardData & { neuralEntryState?: unknown }).neuralEntryState);
  const currentSignal = readRecord(dashboard.currentSignal as unknown);
  const fromReading = normalizeSide(reading?.direcao ?? reading?.origem ?? reading?.expectedSide);
  if (fromReading) return fromReading;
  const fromReadingStatus = sideFromText(reading?.paganteStatus || reading?.paganteAlert);
  if (fromReadingStatus) return fromReadingStatus;
  const fromEntryState = normalizeSide(entryState.expectedSide ?? entryState.expected_side);
  if (fromEntryState) return fromEntryState;
  const fromCurrentSignalText = sideFromText(
    readString(currentSignal, "id") || readString(currentSignal, "side") || readString(currentSignal, "entry"),
  );
  if (fromCurrentSignalText) return fromCurrentSignalText;
  const signalStatus = readString(currentSignal, "status").toLowerCase();
  if (signalStatus === "pending" || signalStatus === "g1" || signalStatus === "active" || signalStatus === "confirmed") {
    return normalizeSide(currentSignal.side ?? currentSignal.entry ?? currentSignal.direcao);
  }
  return "";
}

function readPayingNumbersActiveMode(dashboard: DashboardData) {
  const reading = (dashboard.neuralReading || null) as NeuralReading | null;
  const entryState = readRecord((dashboard as DashboardData & { neuralEntryState?: unknown }).neuralEntryState);
  const currentSignal = readRecord(dashboard.currentSignal as unknown);
  const readingMode = normalizeText(reading?.mode);
  if (readingMode === "ACTIVE") return "ACTIVE";
  if (isConfirmedStatusText(reading?.paganteStatus || reading?.paganteAlert)) return "ACTIVE";
  if (Object.keys(entryState).length && readString(entryState, "status")) return "ACTIVE";
  const signalStatus = readString(currentSignal, "status").toLowerCase();
  if (
    (signalStatus === "pending" || signalStatus === "g1" || signalStatus === "active" || signalStatus === "confirmed") &&
    normalizeSide(currentSignal.side)
  ) {
    return "ACTIVE";
  }
  return readingMode;
}

export function detectPayingNumbersConfirmedCard(
  dashboard: DashboardData,
  latestRound: Round | null,
): TelegramAutoV2CardProbe {
  const reading = (dashboard.neuralReading || null) as NeuralReading | null;
  const round = latestRoundFromDashboard(dashboard, latestRound);
  const roundId = Number(round?.id) || 0;
  const mode = readPayingNumbersActiveMode(dashboard);
  const side = readPayingNumbersSideFromDashboard(dashboard);
  const numero = typeof reading?.numero === "number" ? reading.numero : null;
  const signalKey = side && roundId ? `paying:Bac Bo:${numero ?? "na"}:${side}:round:${roundId}` : "";

  if (!reading && !side) {
    return {
      moduleKey: "paying_numbers",
      confirmed: false,
      reason: "site_reading_missing",
      signalKey,
      roundId,
      meta: {
        card_source: "dashboard.neuralReading/currentSignal",
        visual_title: readString(readRecord(dashboard.currentSignal as unknown), "id") || readString(readRecord(dashboard.neuralReading as unknown), "paganteStatus"),
        card_name: "Leitura Neural / Numero Oposto / Numeros Pagantes",
        side,
      },
    };
  }
  if (mode !== "ACTIVE") {
    return { moduleKey: "paying_numbers", confirmed: false, reason: "card_not_active", signalKey, roundId };
  }
  if (!side) {
    return { moduleKey: "paying_numbers", confirmed: false, reason: "missing_expected_side", signalKey, roundId };
  }
  if (!roundId) {
    return { moduleKey: "paying_numbers", confirmed: false, reason: "missing_round_id", signalKey, roundId };
  }
  return {
    moduleKey: "paying_numbers",
    confirmed: true,
    reason: "confirmed_entry_card",
    signalKey,
    roundId,
    meta: {
      card_source: "dashboard.neuralReading/currentSignal",
      visual_title:
        readString(readRecord(dashboard.neuralReading as unknown), "paganteStatus") ||
        readString(readRecord(dashboard.neuralReading as unknown), "mode"),
      card_name: "Leitura Neural / Numero Oposto / Numeros Pagantes",
      side,
      numero,
    },
  };
}

export function detectAiPatternsConfirmedCard(
  dashboard: DashboardData,
  latestRound: Round | null,
): TelegramAutoV2CardProbe {
  const snapshot = readRecord((dashboard as DashboardData & { patternMinerSnapshot?: unknown }).patternMinerSnapshot || dashboard.patternMiner);
  const entryAlerts = Array.isArray(snapshot.entryAlerts) ? snapshot.entryAlerts.map(readRecord) : [];
  const alert =
    entryAlerts.find((item) => {
      const kind = readString(item, "kind").toLowerCase();
      const title = readString(item, "title").toLowerCase();
      return kind === "validated" || title.includes("validado") || title.includes("confirmado");
    }) || null;
  const round = latestRoundFromDashboard(dashboard, latestRound);
  const roundId = Number(round?.id) || 0;

  if (!alert) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "no_confirmed_pattern_card", signalKey: "", roundId };
  }

  const strategy = readRecord(alert.strategy);
  const expected = normalizeSide(strategy.expectedResult);
  const sequence = Array.isArray(strategy.sequence)
    ? strategy.sequence.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const matchedRounds = Array.isArray(alert.matchedRounds) ? alert.matchedRounds.map(readRecord) : [];
  const lastMatchedRound = matchedRounds.at(-1) || {};
  const lastMatchedRoundId =
    readString(lastMatchedRound, "id") ||
    readString(lastMatchedRound, "roundId") ||
    readString(lastMatchedRound, "round_id") ||
    roundKey(round, roundId);
  const alertId = readString(alert, "id") || readString(strategy, "id") || sequence.join(">");
  const eventId = [alertId, lastMatchedRoundId, expected, sequence.join(">")].filter(Boolean).join(":");
  const signalKey = expected && eventId ? `ai-dashboard:${eventId}` : "";

  if (!expected) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "missing_expected_side", signalKey, roundId };
  }
  if (!sequence.length) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "missing_pattern_sequence", signalKey, roundId };
  }
  if (!isConfirmedStatusText(strategy.status || readString(alert, "title"))) {
    return { moduleKey: "ai_patterns", confirmed: false, reason: "entry_not_confirmed", signalKey, roundId };
  }

  return {
    moduleKey: "ai_patterns",
    confirmed: true,
    reason: "confirmed_pattern_card",
    signalKey,
    roundId: roundId || Number(lastMatchedRoundId) || 0,
    meta: {
      card_source: "dashboard.patternMinerSnapshot.entryAlerts",
      visual_title: readString(alert, "title") || readString(strategy, "status"),
      card_name: "Padroes IA",
      side: expected,
      pattern: sequence.join(" "),
    },
  };
}

export function detectSurfConfirmedCard(
  dashboard: DashboardData,
  latestRound: Round | null,
): TelegramAutoV2CardProbe {
  const alert = readRecord(dashboard.currentSurfAlert);
  const round = latestRoundFromDashboard(dashboard, latestRound);
  const roundId = Number(round?.id) || 0;
  const side = normalizeSide(alert.surf_prediction_side || alert.surf_side || alert.side || alert.entry);
  const statusText = normalizeText(alert.surf_status || alert.status || alert.phase || alert.surf_phase);
  const signalKey = side && roundId ? `surf:${readString(alert, "id") || roundId}:${side}:round:${roundId}` : "";

  if (!Object.keys(alert).length) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "no_surf_card", signalKey, roundId };
  }
  if (!side) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "missing_expected_side", signalKey, roundId };
  }
  const active = Boolean(
    alert.surf_alert === true ||
      statusText.includes("ACTIVE") ||
      statusText.includes("ATIVO") ||
      statusText.includes("CONFIRM"),
  );
  if (!active) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "card_not_active", signalKey, roundId };
  }
  if (!isConfirmedStatusText(statusText) && !statusText.includes("ALERTA")) {
    return { moduleKey: "surf_alert", confirmed: false, reason: "entry_not_confirmed", signalKey, roundId };
  }
  return {
    moduleKey: "surf_alert",
    confirmed: true,
    reason: "confirmed_surf_card",
    signalKey,
    roundId,
    meta: {
      card_source: "dashboard.currentSurfAlert",
      visual_title: readString(alert, "surf_status") || readString(alert, "status") || readString(alert, "surf_phase"),
      card_name: "Surf Analyzer",
      side,
    },
  };
}

export function detectTiesConfirmedCard(
  dashboard: DashboardData,
  latestRound: Round | null,
): TelegramAutoV2CardProbe {
  const alert = readRecord(dashboard.currentTieAlert);
  const round = latestRoundFromDashboard(dashboard, latestRound);
  const roundId = Number(round?.id) || 0;
  const status = readString(alert, "status").toLowerCase();
  const level = readString(alert, "level") || readString(alert, "nivel");
  const signalKey = roundId ? `tie:${readString(alert, "id") || roundId}:${level}:round:${roundId}` : "";

  if (!Object.keys(alert).length) {
    return { moduleKey: "ties_only", confirmed: false, reason: "no_tie_card", signalKey, roundId };
  }
  if (status !== "active") {
    return { moduleKey: "ties_only", confirmed: false, reason: "card_not_active", signalKey, roundId };
  }
  return {
    moduleKey: "ties_only",
    confirmed: true,
    reason: "confirmed_tie_card",
    signalKey,
    roundId,
    meta: {
      card_source: "dashboard.currentTieAlert",
      visual_title: readString(alert, "status") || readString(alert, "level"),
      card_name: "Possivel Empate",
      side: "T",
      level,
    },
  };
}

export function probeTelegramAutoV2ModuleCard(
  dashboard: DashboardData,
  latestRound: Round | null,
  moduleKey: TelegramAutoV2ModuleKey,
): TelegramAutoV2CardProbe {
  if (moduleKey === "ai_patterns") return detectAiPatternsConfirmedCard(dashboard, latestRound);
  if (moduleKey === "paying_numbers") return detectPayingNumbersConfirmedCard(dashboard, latestRound);
  if (moduleKey === "surf_alert") return detectSurfConfirmedCard(dashboard, latestRound);
  if (moduleKey === "ties_only") return detectTiesConfirmedCard(dashboard, latestRound);
  return { moduleKey: "validator", confirmed: false, reason: "unsupported_module", signalKey: "", roundId: 0 };
}

export function detectGlobalConfirmedCards(
  dashboard: DashboardData,
  latestRound: Round | null,
): TelegramAutoV2ConfirmedCard[] {
  const probes = TELEGRAM_AUTO_V2_GLOBAL_MODULES.map((moduleKey) =>
    probeTelegramAutoV2ModuleCard(dashboard, latestRound, moduleKey),
  );
  return probes
    .filter((probe): probe is TelegramAutoV2ConfirmedCard => probe.confirmed && Boolean(probe.signalKey))
    .map((probe) => ({
      moduleKey: probe.moduleKey as Exclude<TelegramAutoV2ModuleKey, "validator">,
      confirmed: true as const,
      signalKey: probe.signalKey,
      roundId: probe.roundId,
      reason: probe.reason,
      meta: { reason: probe.reason, ...(probe.meta || {}) },
    }));
}

export function buildTelegramAutoV2NotificationKey(
  channelId: string,
  moduleKey: TelegramAutoV2ModuleKey,
  signalKey: string,
  roundId = 0,
) {
  const dedupeInput = `${signalKey}:round:${Math.floor(Number(roundId) || 0)}`;
  const hash = signalKey
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(36);
  const roundHash = dedupeInput
    .split("")
    .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0)
    .toString(36);
  return `v2:${channelId}:${moduleKey}:r${Math.floor(Number(roundId) || 0)}:${hash}:${roundHash}`;
}

export function telegramAutoV2SentBlocksRetry(status: string) {
  return status === "sent";
}

export function telegramAutoV2AllowsRetry(status: string) {
  return status === "error" || status === "reserved" || status === "failed";
}
