import type { Round } from "@/types/dashboard";

export type MinuteHeatSide = "BANKER" | "PLAYER" | "TIE" | "NONE";
export type MinuteHeatTemperature = "quente" | "operavel" | "frio" | "sem_amostra";

export interface MinuteHeatRound extends Round {
  day?: string;
  capturedAt?: string;
  sourceUpdatedAt?: string;
}

export interface MinuteHeatBucket {
  minute: number;
  total: number;
  banker: number;
  player: number;
  tie: number;
  dominantSide: MinuteHeatSide;
  score: number;
  temperature: MinuteHeatTemperature;
}

export interface MinuteHeatSnapshot {
  date: string;
  hour: number;
  minute: number;
  updatedAt: string;
  totalRounds: number;
  dominantSide: MinuteHeatSide;
  score: number;
  temperature: MinuteHeatTemperature;
  trend: "aquecendo" | "estavel" | "esfriando" | "sem_amostra";
  windowMinutes: number;
  windowTotalRounds: number;
  buckets: MinuteHeatBucket[];
}

const TIMEZONE = "America/Sao_Paulo";
const WINDOW_MINUTES = 10;
const MIN_WINDOW_ROUNDS = 3;

export function buildMinuteHeatSnapshot(
  rounds: MinuteHeatRound[],
  now: Date = new Date(),
): MinuteHeatSnapshot {
  const nowParts = saoPauloParts(now);
  const buckets = Array.from({ length: 60 }, (_, minute): MinuteHeatBucket => emptyBucket(minute));

  const currentHourRounds = rounds.filter((round) => {
    const parts = partsForRound(round, nowParts.date);
    return parts.date === nowParts.date && parts.hour === nowParts.hour;
  });

  for (const round of currentHourRounds) {
    const parts = partsForRound(round, nowParts.date);
    const bucket = buckets[parts.minute];
    if (!bucket) continue;
    bucket.total += 1;
    if (round.result === "B") bucket.banker += 1;
    if (round.result === "P") bucket.player += 1;
    if (round.result === "T") bucket.tie += 1;
  }

  for (const bucket of buckets) recomputeBucket(bucket, 1);

  const windowStart = Math.max(0, nowParts.minute - WINDOW_MINUTES + 1);
  const windowBuckets = buckets.slice(windowStart, nowParts.minute + 1);
  const windowSummary = summarizeBuckets(windowBuckets, MIN_WINDOW_ROUNDS);
  const previousBuckets = buckets.slice(Math.max(0, windowStart - WINDOW_MINUTES), windowStart);
  const previousSummary = summarizeBuckets(previousBuckets, MIN_WINDOW_ROUNDS);

  return {
    date: nowParts.date,
    hour: nowParts.hour,
    minute: nowParts.minute,
    updatedAt: now.toISOString(),
    totalRounds: currentHourRounds.length,
    dominantSide: windowSummary.dominantSide,
    score: windowSummary.score,
    temperature: windowSummary.temperature,
    trend: trendFromScores(previousSummary, windowSummary),
    windowMinutes: WINDOW_MINUTES,
    windowTotalRounds: windowSummary.total,
    buckets,
  };
}

function summarizeBuckets(buckets: MinuteHeatBucket[], minRounds: number) {
  const summary = emptyBucket(-1);
  for (const bucket of buckets) {
    summary.total += bucket.total;
    summary.banker += bucket.banker;
    summary.player += bucket.player;
    summary.tie += bucket.tie;
  }
  recomputeBucket(summary, minRounds);
  return summary;
}

function recomputeBucket(bucket: MinuteHeatBucket, minRounds: number) {
  const rows: Array<{ side: MinuteHeatSide; count: number }> = [
    { side: "BANKER" as MinuteHeatSide, count: bucket.banker },
    { side: "PLAYER" as MinuteHeatSide, count: bucket.player },
    { side: "TIE" as MinuteHeatSide, count: bucket.tie },
  ].sort((a, b) => b.count - a.count);
  const best = rows[0];
  bucket.dominantSide = best && best.count > 0 ? best.side : "NONE";
  bucket.score = bucket.total ? Math.round((best.count / bucket.total) * 1000) / 10 : 0;
  bucket.temperature = classifyMinuteHeat(bucket.score, bucket.total, minRounds);
}

export function classifyMinuteHeat(
  score: number,
  total: number,
  minRounds: number,
): MinuteHeatTemperature {
  if (total < minRounds) return "sem_amostra";
  if (score >= 89) return "quente";
  if (score >= 88) return "operavel";
  return "frio";
}

function trendFromScores(
  previous: Pick<MinuteHeatBucket, "score" | "total">,
  current: Pick<MinuteHeatBucket, "score" | "total">,
): MinuteHeatSnapshot["trend"] {
  if (previous.total < MIN_WINDOW_ROUNDS || current.total < MIN_WINDOW_ROUNDS) return "sem_amostra";
  const diff = current.score - previous.score;
  if (diff >= 8) return "aquecendo";
  if (diff <= -8) return "esfriando";
  return "estavel";
}

function emptyBucket(minute: number): MinuteHeatBucket {
  return {
    minute,
    total: 0,
    banker: 0,
    player: 0,
    tie: 0,
    dominantSide: "NONE",
    score: 0,
    temperature: "sem_amostra",
  };
}

function partsForRound(round: MinuteHeatRound, fallbackDate: string) {
  const timeParts = parseRoundTime(round.time);
  const sourceDate =
    round.day ||
    dateFromIso(round.sourceUpdatedAt) ||
    dateFromIso(round.capturedAt) ||
    fallbackDate;
  return {
    date: sourceDate,
    hour: timeParts.hour,
    minute: timeParts.minute,
  };
}

function parseRoundTime(time: string) {
  const match = String(time || "").match(/(\d{1,2}):(\d{2})/);
  const hour = clamp(Number(match?.[1] ?? 0), 0, 23);
  const minute = clamp(Number(match?.[2] ?? 0), 0, 59);
  return { hour, minute };
}

function dateFromIso(value: unknown) {
  if (typeof value !== "string") return "";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "";
  return saoPauloParts(parsed).date;
}

function saoPauloParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: clamp(Number(part("hour")), 0, 23),
    minute: clamp(Number(part("minute")), 0, 59),
  };
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function minuteHeatSideLabel(side: MinuteHeatSide) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "Neutro";
}
