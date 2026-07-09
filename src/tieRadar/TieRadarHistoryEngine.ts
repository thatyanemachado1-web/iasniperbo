import type {
  Round,
  TieAggregateTable,
  TieHighMultiplierAnalysis,
  TieHistoryEntry,
  TieMultiplierLabel,
  TieMultiplierValue,
  TieRadarHistoryAnalysis,
} from "../types/dashboard";
import { TIE_MULTIPLIER_LABELS, tieMultiplierFromRound } from "./TieRadarStatsEngine";

const TIME_ZONE = "America/Sao_Paulo";
const MAX_RECENT_TIES = 50;
const MAX_TRACKED_TIE_KEYS = 5000;

export function buildTieRadarHistoryAnalysis(
  rounds: Round[] | undefined,
  options: {
    cycleDate?: string;
    now?: Date | string;
    previous?: TieRadarHistoryAnalysis | null;
  } = {},
): TieRadarHistoryAnalysis {
  const now = toSafeDate(options.now) ?? new Date();
  const nowIso = now.toISOString();
  const cycleDate = normalizeDateKey(options.cycleDate) || saoPauloDateKey(now);
  const monthKey = cycleDate.slice(0, 7);
  const previous = options.previous ?? null;
  const canReusePrevious = Boolean(previous?.countedRoundKeys?.length);
  const countedRoundKeys = new Set(canReusePrevious ? previous?.countedRoundKeys ?? [] : []);
  const recent = new Map<string, TieHistoryEntry>();

  if (canReusePrevious) {
    for (const entry of previous?.recent ?? []) {
      if (entry?.id) recent.set(entry.id, entry);
    }
  }

  const daily =
    canReusePrevious && previous?.daily?.key === cycleDate
      ? cloneAggregateTable(previous.daily, cycleDate)
      : emptyAggregateTable(cycleDate);
  const monthly =
    canReusePrevious && previous?.monthly?.key === monthKey
      ? cloneAggregateTable(previous.monthly, monthKey)
      : emptyAggregateTable(monthKey);

  const entries = collectTieEntries(rounds ?? [], cycleDate);
  for (const entry of entries) {
    recent.set(entry.id, entry);
    if (countedRoundKeys.has(entry.roundKey)) continue;

    countedRoundKeys.add(entry.roundKey);
    if (entry.dateKey === cycleDate) updateAggregateTable(daily, entry);
    if (entry.monthKey === monthKey) updateAggregateTable(monthly, entry);
  }

  const recentEntries = [...recent.values()]
    .filter((entry) => entry.monthKey === monthKey || entry.dateKey === cycleDate)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_RECENT_TIES);

  return {
    updatedAt: nowIso,
    recent: recentEntries,
    daily: finalizeAggregateTable(daily),
    monthly: finalizeAggregateTable(monthly),
    high: buildHighMultiplierAnalysis(daily, monthly, now),
    countedRoundKeys: [...countedRoundKeys].slice(-MAX_TRACKED_TIE_KEYS),
  };
}

export function emptyTieRadarHistoryAnalysis(cycleDate = saoPauloDateKey()): TieRadarHistoryAnalysis {
  const now = new Date();
  const monthKey = cycleDate.slice(0, 7);
  const daily = emptyAggregateTable(cycleDate);
  const monthly = emptyAggregateTable(monthKey);

  return {
    updatedAt: now.toISOString(),
    recent: [],
    daily,
    monthly,
    high: buildHighMultiplierAnalysis(daily, monthly, now),
    countedRoundKeys: [],
  };
}

function collectTieEntries(rounds: Round[], cycleDate: string) {
  return rounds
    .map((round) => tieHistoryEntryFromRound(round, cycleDate))
    .filter((entry): entry is TieHistoryEntry => Boolean(entry))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

function tieHistoryEntryFromRound(round: Round, cycleDate: string): TieHistoryEntry | null {
  if (!round || round.result !== "T") return null;

  const multiplier = tieMultiplierFromRound(round) as TieMultiplierValue | null;
  if (!multiplier) return null;

  const multiplierLabel = `${multiplier}x` as TieMultiplierLabel;
  if (!TIE_MULTIPLIER_LABELS.includes(multiplierLabel)) return null;

  const timestamp = roundTimestamp(round, cycleDate);
  const parts = saoPauloParts(timestamp);
  const roundKey = tieRoundKey(round);

  return {
    id: `${roundKey}:${multiplierLabel}`,
    roundId: round.id,
    roundKey,
    timestamp: timestamp.toISOString(),
    dateKey: parts.dateKey,
    monthKey: parts.monthKey,
    hour: `${parts.hour}:${parts.minute}`,
    type: multiplier,
    multiplierLabel,
  };
}

function emptyAggregateTable(key: string): TieAggregateTable {
  return {
    key,
    totalTies: 0,
    total25x: 0,
    total88x: 0,
    counts: emptyCounts(),
    average25IntervalMinutes: null,
    average88IntervalMinutes: null,
    interval25Samples: 0,
    interval88Samples: 0,
    last25Timestamp: null,
    last88Timestamp: null,
    mostFrequentHour: null,
    hourCounts: {},
  };
}

function cloneAggregateTable(value: TieAggregateTable, key: string): TieAggregateTable {
  return {
    ...emptyAggregateTable(key),
    ...value,
    key,
    counts: normalizeCounts(value.counts),
    hourCounts: { ...(value.hourCounts ?? {}) },
    average25IntervalMinutes: normalizeNullableNumber(value.average25IntervalMinutes),
    average88IntervalMinutes: normalizeNullableNumber(value.average88IntervalMinutes),
    interval25Samples: safeCount(value.interval25Samples),
    interval88Samples: safeCount(value.interval88Samples),
    last25Timestamp: normalizeIso(value.last25Timestamp),
    last88Timestamp: normalizeIso(value.last88Timestamp),
  };
}

function updateAggregateTable(table: TieAggregateTable, entry: TieHistoryEntry) {
  table.totalTies += 1;
  table.counts[entry.multiplierLabel] = safeCount(table.counts[entry.multiplierLabel]) + 1;
  table.total25x = table.counts["25x"];
  table.total88x = table.counts["88x"];

  const hour = entry.hour.slice(0, 2);
  table.hourCounts = table.hourCounts ?? {};
  table.hourCounts[hour] = safeCount(table.hourCounts[hour]) + 1;

  if (entry.type === 25) update25Interval(table, entry.timestamp);
  if (entry.type === 88) update88Interval(table, entry.timestamp);
}

function update25Interval(table: TieAggregateTable, timestamp: string) {
  const last = normalizeIso(table.last25Timestamp);
  if (last) {
    const diff = minutesBetween(last, timestamp);
    if (diff !== null && diff > 0) {
      const samples = safeCount(table.interval25Samples);
      table.average25IntervalMinutes = rollingAverage(table.average25IntervalMinutes, samples, diff);
      table.interval25Samples = samples + 1;
    }
  }
  if (!last || Date.parse(timestamp) > Date.parse(last)) table.last25Timestamp = timestamp;
}

function update88Interval(table: TieAggregateTable, timestamp: string) {
  const last = normalizeIso(table.last88Timestamp);
  if (last) {
    const diff = minutesBetween(last, timestamp);
    if (diff !== null && diff > 0) {
      const samples = safeCount(table.interval88Samples);
      table.average88IntervalMinutes = rollingAverage(table.average88IntervalMinutes, samples, diff);
      table.interval88Samples = samples + 1;
    }
  }
  if (!last || Date.parse(timestamp) > Date.parse(last)) table.last88Timestamp = timestamp;
}

function finalizeAggregateTable(table: TieAggregateTable): TieAggregateTable {
  return {
    ...table,
    total25x: table.counts["25x"],
    total88x: table.counts["88x"],
    mostFrequentHour: mostFrequentHour(table.hourCounts),
  };
}

function buildHighMultiplierAnalysis(
  daily: TieAggregateTable,
  monthly: TieAggregateTable,
  now: Date,
): TieHighMultiplierAnalysis {
  const last88At = normalizeIso(daily.last88Timestamp) || normalizeIso(monthly.last88Timestamp);
  const last25At = normalizeIso(daily.last25Timestamp) || normalizeIso(monthly.last25Timestamp);
  const average88IntervalMinutes = firstUsableAverage(
    daily.average88IntervalMinutes,
    monthly.average88IntervalMinutes,
  );
  const average25IntervalMinutes = firstUsableAverage(
    daily.average25IntervalMinutes,
    monthly.average25IntervalMinutes,
  );
  const sinceLast88Minutes = last88At ? minutesBetween(last88At, now.toISOString()) : null;
  const sinceLast25Minutes = last25At ? minutesBetween(last25At, now.toISOString()) : null;
  const pressureScore = calculatePressureScore({
    sinceLast88Minutes,
    sinceLast25Minutes,
    average88IntervalMinutes,
    average25IntervalMinutes,
  });

  return {
    last88At,
    last25At,
    average88IntervalMinutes,
    average25IntervalMinutes,
    sinceLast88Minutes,
    sinceLast25Minutes,
    estimatedNext88At: estimateNext(last88At, average88IntervalMinutes),
    estimatedNext25At: estimateNext(last25At, average25IntervalMinutes),
    pressure: pressureScore >= 80 ? "alta" : pressureScore >= 45 ? "moderada" : "baixa",
    pressureScore,
  };
}

function calculatePressureScore({
  sinceLast88Minutes,
  sinceLast25Minutes,
  average88IntervalMinutes,
  average25IntervalMinutes,
}: {
  sinceLast88Minutes: number | null;
  sinceLast25Minutes: number | null;
  average88IntervalMinutes: number | null;
  average25IntervalMinutes: number | null;
}) {
  const scores: number[] = [];

  if (sinceLast88Minutes !== null && average88IntervalMinutes) {
    scores.push(intervalPressureScore(sinceLast88Minutes / average88IntervalMinutes));
  } else if (sinceLast88Minutes !== null) {
    scores.push(Math.min(60, sinceLast88Minutes / 4));
  }

  if (sinceLast25Minutes !== null && average25IntervalMinutes) {
    scores.push(intervalPressureScore(sinceLast25Minutes / average25IntervalMinutes) * 0.85);
  } else if (sinceLast25Minutes !== null) {
    scores.push(Math.min(50, sinceLast25Minutes / 6));
  }

  if (!scores.length) return 0;
  return Math.max(0, Math.min(100, Math.round(Math.max(...scores))));
}

function intervalPressureScore(ratio: number) {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  if (ratio < 0.35) return ratio * 55;
  if (ratio < 0.75) return 20 + ((ratio - 0.35) / 0.4) * 45;
  if (ratio < 1.2) return 65 + ((ratio - 0.75) / 0.45) * 35;
  return 100;
}

function roundTimestamp(round: Round, cycleDate: string) {
  const record = round as unknown as Record<string, unknown>;
  const rawTime = String(round.time || "").trim();
  const parsedRawTime = parseDateLike(rawTime);
  if (parsedRawTime) return parsedRawTime;

  const explicitDay = normalizeDateKey(record.day) || recordedAtDateKey(record) || cycleDate;
  const timeParts = rawTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeParts) {
    const hour = String(Math.max(0, Math.min(23, Number(timeParts[1]) || 0))).padStart(2, "0");
    const minute = String(Math.max(0, Math.min(59, Number(timeParts[2]) || 0))).padStart(2, "0");
    const second = String(Math.max(0, Math.min(59, Number(timeParts[3] ?? "0") || 0))).padStart(2, "0");
    return new Date(`${explicitDay}T${hour}:${minute}:${second}-03:00`);
  }

  const recordedAt = parseDateLike(
    readString(record, "recordedAt") ||
      readString(record, "recorded_at") ||
      readString(record, "createdAt") ||
      readString(record, "created_at"),
  );
  if (recordedAt) return recordedAt;

  return new Date(`${cycleDate}T00:00:00-03:00`);
}

function recordedAtDateKey(record: Record<string, unknown>) {
  const recordedAt = parseDateLike(
    readString(record, "recordedAt") ||
      readString(record, "recorded_at") ||
      readString(record, "createdAt") ||
      readString(record, "created_at"),
  );
  return recordedAt ? saoPauloDateKey(recordedAt) : "";
}

function tieRoundKey(round: Round) {
  return `${round.time}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function emptyCounts(): Record<TieMultiplierLabel, number> {
  return TIE_MULTIPLIER_LABELS.reduce(
    (acc, label) => {
      acc[label] = 0;
      return acc;
    },
    {} as Record<TieMultiplierLabel, number>,
  );
}

function normalizeCounts(value: Partial<Record<TieMultiplierLabel, number>> | undefined) {
  const counts = emptyCounts();
  for (const label of TIE_MULTIPLIER_LABELS) counts[label] = safeCount(value?.[label]);
  return counts;
}

function saoPauloDateKey(value: Date | string = new Date()) {
  return saoPauloParts(value).dateKey;
}

function saoPauloParts(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const dateKey = `${part("year")}-${part("month")}-${part("day")}`;
  return {
    dateKey,
    monthKey: dateKey.slice(0, 7),
    hour: part("hour") || "00",
    minute: part("minute") || "00",
  };
}

function normalizeDateKey(value: unknown) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseDateLike(value: unknown) {
  const text = String(value || "").trim();
  if (!text || /^\d{1,2}:\d{2}(?::\d{2})?$/.test(text)) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

function readString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function toSafeDate(value: Date | string | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function normalizeIso(value: unknown) {
  const date = parseDateLike(value);
  return date ? date.toISOString() : null;
}

function normalizeNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 10) / 10 : null;
}

function safeCount(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 0;
}

function rollingAverage(current: number | null | undefined, samples: number, nextValue: number) {
  const base = Number(current);
  const safeBase = Number.isFinite(base) && base > 0 ? base : 0;
  return Math.round(((safeBase * samples + nextValue) / (samples + 1)) * 10) / 10;
}

function minutesBetween(startIso: string, endIso: string) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round(((end - start) / 60_000) * 10) / 10;
}

function firstUsableAverage(...values: Array<number | null | undefined>) {
  for (const value of values) {
    const numeric = normalizeNullableNumber(value);
    if (numeric) return numeric;
  }
  return null;
}

function estimateNext(lastTimestamp: string | null, averageMinutes: number | null) {
  if (!lastTimestamp || !averageMinutes) return null;
  const timestamp = Date.parse(lastTimestamp);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + averageMinutes * 60_000).toISOString();
}

function mostFrequentHour(hourCounts: Record<string, number> | undefined) {
  const entries = Object.entries(hourCounts ?? {}).filter(([, value]) => safeCount(value) > 0);
  if (!entries.length) return null;
  const [hour] = entries.sort((a, b) => safeCount(b[1]) - safeCount(a[1]) || a[0].localeCompare(b[0]))[0];
  return `${hour.padStart(2, "0")}:00`;
}
