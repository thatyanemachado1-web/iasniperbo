import { readUserSession } from "@/lib/userSession";
import type { Round, RoundResult } from "@/types/dashboard";
import type {
  NeuralCalendarClassification,
  NeuralCalendarDailyStat,
  NeuralCalendarForce,
  NeuralCalendarHourlyStat,
  NeuralCalendarPayload,
} from "@/types/neuralCalendar";

const ROUND_HISTORY_KEY = "sniper_round_history_v1";
const TIME_ZONE = "America/Sao_Paulo";
const MIN_DAILY_SAMPLE = 5;
const MIN_HOURLY_SAMPLE = 2;

interface StoredRound extends Round {
  key: string;
  day: string;
  capturedAt: string;
  sourceUpdatedAt?: string;
}

interface StoredHistory {
  collectionStartedAt?: string;
  rounds?: StoredRound[];
}

interface DateParts {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: string;
}

export function buildLocalNeuralCalendar(params: {
  year: number;
  month: number;
  date?: string;
  range?: string;
}): NeuralCalendarPayload | null {
  if (typeof window === "undefined") return null;
  const history = readLocalRoundHistory();
  if (!history.rounds.length) return null;

  const dailyStats = buildDailyStats(history.rounds);
  const hourlyStats = buildHourlyStats(history.rounds);
  if (!dailyStats.some((day) => day.totalRounds > 0)) return null;

  for (const daily of dailyStats) {
    refreshDailyExtremes(daily, hourlyStats);
  }

  return buildPayload({
    year: params.year,
    month: params.month,
    selectedDate: normalizeDate(params.date || ""),
    range: params.range || "este_mes",
    dailyStats,
    hourlyStats,
    startDate:
      history.collectionStartedAt && Number.isFinite(Date.parse(history.collectionStartedAt))
        ? dateParts(new Date(history.collectionStartedAt)).date
        : dailyStats[0]?.date || todayParts().date,
  });
}

export function localCalendarTotalRounds(payload: NeuralCalendarPayload | null) {
  if (!payload) return 0;
  return payload.month.days.reduce((sum, day) => sum + day.totalRounds, 0);
}

function readLocalRoundHistory(): { collectionStartedAt: string; rounds: StoredRound[] } {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || "{}") as StoredHistory;
    return {
      collectionStartedAt:
        typeof parsed.collectionStartedAt === "string" ? parsed.collectionStartedAt : "",
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.filter(isStoredRound) : [],
    };
  } catch {
    return { collectionStartedAt: "", rounds: [] };
  }
}

function storageKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${ROUND_HISTORY_KEY}:${email}` : ROUND_HISTORY_KEY;
}

function buildDailyStats(rounds: StoredRound[]) {
  const byDate = new Map<string, NeuralCalendarDailyStat>();
  for (const round of rounds) {
    const parts = partsForRound(round);
    const current = byDate.get(parts.date) || emptyDailyStat(parts);
    incrementStat(current, round);
    byDate.set(parts.date, current);
  }
  const rows = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const row of rows) recomputeStat(row, MIN_DAILY_SAMPLE);
  return rows;
}

function buildHourlyStats(rounds: StoredRound[]) {
  const byHour = new Map<string, NeuralCalendarHourlyStat>();
  for (const round of rounds) {
    const parts = partsForRound(round);
    const id = `${parts.date}:${String(parts.hour).padStart(2, "0")}`;
    const current = byHour.get(id) || emptyHourlyStat(parts);
    incrementStat(current, round);
    byHour.set(id, current);
  }
  const rows = [...byHour.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const row of rows) recomputeStat(row, MIN_HOURLY_SAMPLE);
  return rows;
}

function buildPayload({
  year,
  month,
  selectedDate,
  range,
  dailyStats,
  hourlyStats,
  startDate,
}: {
  year: number;
  month: number;
  selectedDate: string;
  range: string;
  dailyStats: NeuralCalendarDailyStat[];
  hourlyStats: NeuralCalendarHourlyStat[];
  startDate: string;
}): NeuralCalendarPayload {
  const now = todayParts();
  const years = availableYears(dailyStats, now.year);
  const dailyByDate = new Map(dailyStats.map((day) => [day.date, day]));
  const hourlyById = new Map(hourlyStats.map((hour) => [hour.id, hour]));
  const daysInMonth = calendarDaysInMonth(year, month);
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
    const date = calendarDateString(year, month, index + 1);
    return dailyByDate.get(date) || emptyDailyStat(partsFromDate(date));
  });
  const fallbackSelected =
    [...monthDays]
      .filter((day) => day.totalRounds > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.date ||
    (now.year === year && now.month === month ? now.date : calendarDateString(year, month, 1));
  const cleanSelectedDate =
    selectedDate && selectedDate.startsWith(`${year}-${String(month).padStart(2, "0")}`)
      ? selectedDate
      : fallbackSelected;
  const selectedDay =
    dailyByDate.get(cleanSelectedDate) || emptyDailyStat(partsFromDate(cleanSelectedDate));
  const selectedHours = Array.from({ length: 24 }, (_, hour) => {
    const id = `${cleanSelectedDate}:${String(hour).padStart(2, "0")}`;
    return hourlyById.get(id) || emptyHourlyStat({ ...partsFromDate(cleanSelectedDate), hour });
  });

  return {
    timezone: TIME_ZONE,
    startDate,
    updatedAt: new Date().toISOString(),
    range,
    years,
    selected: { year, month, date: cleanSelectedDate },
    month: {
      year,
      month,
      label: monthLabel(year, month),
      firstWeekday: firstWeekday(year, month),
      days: monthDays,
      summary: monthSummary(monthDays, selectedHours),
      distribution: distribution(monthDays),
      weekdayAverages: weekdayAverages(monthDays),
      heatmap: heatmap(year, month, hourlyStats),
    },
    selectedDay,
    selectedHours,
    rankings: {
      topHours: topHours(hourlyStats),
      topWeekdays: topWeekdays(dailyStats),
      topMonthDays: topMonthDays(dailyStats),
    },
  };
}

function emptyDailyStat(parts: DateParts): NeuralCalendarDailyStat {
  const now = new Date().toISOString();
  return {
    id: parts.date,
    date: parts.date,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
    totalRounds: 0,
    greens: 0,
    reds: 0,
    ties: 0,
    bankerCount: 0,
    playerCount: 0,
    tieCount: 0,
    accuracy: 0,
    score: 0,
    classification: "sem_amostra",
    bestHour: "",
    worstHour: "",
    bestModule: "Tendencia",
    bestForce: "NONE",
    observation: "Sem amostra suficiente no historico real coletado.",
    createdAt: now,
    updatedAt: now,
  };
}

function emptyHourlyStat(parts: DateParts): NeuralCalendarHourlyStat {
  return {
    ...emptyDailyStat(parts),
    id: `${parts.date}:${String(parts.hour).padStart(2, "0")}`,
    hour: parts.hour,
    bankerPercent: 0,
    playerPercent: 0,
    tiePercent: 0,
    bestReading: "Aguardando amostra real.",
  };
}

function incrementStat(
  stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat,
  round: StoredRound,
) {
  stat.totalRounds += 1;
  if (round.result === "B") stat.bankerCount += 1;
  if (round.result === "P") stat.playerCount += 1;
  if (round.result === "T") {
    stat.tieCount += 1;
    stat.ties += 1;
  }
  stat.updatedAt = new Date().toISOString();
}

function recomputeStat(
  stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat,
  minSample: number,
) {
  const best = bestForce(stat);
  const total = Math.max(0, stat.totalRounds);
  stat.bestForce = best.force;
  stat.greens = best.count;
  stat.reds = Math.max(0, total - best.count);
  stat.accuracy = total ? roundPercent((best.count / total) * 100) : 0;
  stat.score = stat.accuracy;
  stat.classification = classifyScore(stat.score, total, minSample);
  stat.bestModule = inferModule(stat);
  stat.observation = observation(stat);

  if ("hour" in stat) {
    stat.bankerPercent = total ? roundPercent((stat.bankerCount / total) * 100) : 0;
    stat.playerPercent = total ? roundPercent((stat.playerCount / total) * 100) : 0;
    stat.tiePercent = total ? roundPercent((stat.tieCount / total) * 100) : 0;
    stat.bestReading =
      stat.bestForce === "NONE"
        ? "Aguardando amostra real."
        : `${forceLabel(stat.bestForce)} dominante no horario.`;
  }
}

function refreshDailyExtremes(daily: NeuralCalendarDailyStat, hours: NeuralCalendarHourlyStat[]) {
  const rows = hours
    .filter((hour) => hour.date === daily.date && hour.classification !== "sem_amostra")
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds);
  daily.bestHour = rows[0] ? `${String(rows[0].hour).padStart(2, "0")}:00` : "";
  daily.worstHour = rows.at(-1) ? `${String(rows.at(-1)?.hour ?? 0).padStart(2, "0")}:00` : "";
}

function bestForce(
  stat: Pick<NeuralCalendarDailyStat, "bankerCount" | "playerCount" | "tieCount">,
) {
  const rows: Array<{ force: NeuralCalendarForce; count: number }> = [
    { force: "BANKER", count: stat.bankerCount },
    { force: "PLAYER", count: stat.playerCount },
    { force: "TIE", count: stat.tieCount },
  ];
  rows.sort((a, b) => b.count - a.count);
  return rows[0]?.count ? rows[0] : { force: "NONE" as const, count: 0 };
}

function classifyScore(
  score: number,
  total: number,
  minSample: number,
): NeuralCalendarClassification {
  if (total < minSample) return "sem_amostra";
  if (score >= 89) return "muito_pagante";
  if (score >= 88) return "operavel";
  return "perigoso";
}

function inferModule(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat) {
  if (stat.bestForce === "TIE") return "Validador";
  if (stat.classification === "muito_pagante") return "Neural Pagante";
  if (stat.classification === "perigoso") return "Surf Analyzer";
  return "Tendencia";
}

function observation(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat) {
  if (stat.classification === "sem_amostra")
    return "Sem amostra suficiente no historico real coletado.";
  if (stat.classification === "muito_pagante") return "Muito bom para operar.";
  if (stat.classification === "operavel") return "Operável.";
  return "Perigoso.";
}

function monthSummary(days: NeuralCalendarDailyStat[], selectedHours: NeuralCalendarHourlyStat[]) {
  const sampledDays = days.filter((day) => day.classification !== "sem_amostra");
  const sampledHours = selectedHours.filter((hour) => hour.classification !== "sem_amostra");
  const bestDay =
    [...sampledDays].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstDay =
    [...sampledDays].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  const bestHour =
    [...sampledHours].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstHour =
    [...sampledHours].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  return {
    averageScore: sampledDays.length
      ? roundPercent(sampledDays.reduce((sum, day) => sum + day.score, 0) / sampledDays.length)
      : 0,
    bestDay,
    worstDay,
    bestHour,
    worstHour,
    counts: distribution(days),
  };
}

function distribution(days: NeuralCalendarDailyStat[]) {
  return days.reduce(
    (acc, day) => {
      acc[day.classification] += 1;
      return acc;
    },
    { muito_pagante: 0, operavel: 0, perigoso: 0, sem_amostra: 0 },
  );
}

function weekdayAverages(days: NeuralCalendarDailyStat[]) {
  const byWeekday = new Map<string, { total: number; count: number }>();
  for (const day of days) {
    if (day.classification === "sem_amostra") continue;
    const current = byWeekday.get(day.weekday) || { total: 0, count: 0 };
    current.total += day.score;
    current.count += 1;
    byWeekday.set(day.weekday, current);
  }
  return weekdayOrder().map((weekday) => {
    const item = byWeekday.get(weekday) || { total: 0, count: 0 };
    const score = item.count ? roundPercent(item.total / item.count) : 0;
    return {
      weekday,
      score,
      total: item.count,
      classification: classifyScore(score, item.count, 1),
    };
  });
}

function heatmap(year: number, month: number, hours: NeuralCalendarHourlyStat[]) {
  return hours
    .filter((hour) => hour.year === year && hour.month === month)
    .map((hour) => ({
      date: hour.date,
      day: hour.day,
      hour: hour.hour,
      score: hour.score,
      classification: hour.classification,
      totalRounds: hour.totalRounds,
    }));
}

function topHours(hours: NeuralCalendarHourlyStat[]) {
  const byHour = new Map<number, { totalScore: number; count: number; totalRounds: number }>();
  for (const hour of hours) {
    if (hour.classification === "sem_amostra") continue;
    const current = byHour.get(hour.hour) || { totalScore: 0, count: 0, totalRounds: 0 };
    current.totalScore += hour.score;
    current.totalRounds += hour.totalRounds;
    current.count += 1;
    byHour.set(hour.hour, current);
  }
  return [...byHour.entries()]
    .map(([hour, value]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      score: value.count ? roundPercent(value.totalScore / value.count) : 0,
      totalRounds: value.totalRounds,
    }))
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

function topWeekdays(days: NeuralCalendarDailyStat[]) {
  return weekdayAverages(days)
    .filter((item) => item.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 7);
}

function topMonthDays(days: NeuralCalendarDailyStat[]) {
  return days
    .filter((day) => day.classification !== "sem_amostra")
    .map((day) => ({
      date: day.date,
      label: `${String(day.day).padStart(2, "0")}/${String(day.month).padStart(2, "0")}`,
      score: day.score,
      totalRounds: day.totalRounds,
      classification: day.classification,
    }))
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

function partsForRound(round: StoredRound): DateParts {
  const baseDate =
    normalizeDate(round.day) || dateParts(new Date(round.sourceUpdatedAt || round.capturedAt)).date;
  const hour =
    hourFromTime(round.time) ?? dateParts(new Date(round.sourceUpdatedAt || round.capturedAt)).hour;
  return { ...partsFromDate(baseDate), hour };
}

function partsFromDate(date: string): DateParts {
  const [year, month, day] = date.split("-").map((item) => Math.floor(Number(item) || 0));
  const safeYear = year || 2026;
  const safeMonth = month || 1;
  const safeDay = day || 1;
  const utcDate = new Date(Date.UTC(safeYear, safeMonth - 1, safeDay, 12));
  return {
    date: calendarDateString(safeYear, safeMonth, safeDay),
    year: safeYear,
    month: safeMonth,
    day: safeDay,
    hour: 0,
    weekday: weekdayFromDate(utcDate),
  };
}

function dateParts(date: Date): DateParts {
  if (!Number.isFinite(date.getTime())) return todayParts();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const year = Math.floor(Number(parts.year) || date.getFullYear());
  const month = Math.floor(Number(parts.month) || date.getMonth() + 1);
  const day = Math.floor(Number(parts.day) || date.getDate());
  return {
    date: calendarDateString(year, month, day),
    year,
    month,
    day,
    hour: Math.max(0, Math.min(23, Math.floor(Number(parts.hour) || 0))),
    weekday: normalizeWeekday(parts.weekday),
  };
}

function todayParts() {
  return dateParts(new Date());
}

function hourFromTime(value: unknown) {
  const match = String(value || "").match(/^(\d{1,2}):\d{2}(?::\d{2})?$/);
  return match ? Math.max(0, Math.min(23, Math.floor(Number(match[1]) || 0))) : null;
}

function calendarDateString(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function calendarDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function firstWeekday(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function availableYears(days: NeuralCalendarDailyStat[], currentYear: number) {
  const years = new Set([2026, currentYear]);
  for (const day of days) years.add(day.year);
  return [...years].sort((a, b) => b - a);
}

function monthLabel(year: number, month: number) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function weekdayFromDate(date: Date) {
  return normalizeWeekday(
    new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date),
  );
}

function normalizeWeekday(value: unknown) {
  const text = String(value || "")
    .slice(0, 3)
    .toLowerCase();
  const map: Record<string, string> = {
    sun: "Domingo",
    mon: "Segunda",
    tue: "Terca",
    wed: "Quarta",
    thu: "Quinta",
    fri: "Sexta",
    sat: "Sabado",
  };
  return map[text] || "Segunda";
}

function weekdayOrder() {
  return ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
}

function forceLabel(force: NeuralCalendarForce) {
  if (force === "BANKER") return "Banker";
  if (force === "PLAYER") return "Player";
  if (force === "TIE") return "Tie";
  return "Aguardando";
}

function roundPercent(value: number) {
  return Math.round(value * 100) / 100;
}

function isStoredRound(value: unknown): value is StoredRound {
  const round = value as Partial<StoredRound>;
  return (
    typeof round.key === "string" &&
    typeof round.day === "string" &&
    typeof round.capturedAt === "string" &&
    typeof round.id === "number" &&
    isRoundResult(round.result) &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}

function isRoundResult(value: unknown): value is RoundResult {
  return value === "B" || value === "P" || value === "T";
}
