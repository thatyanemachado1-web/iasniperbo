import { useEffect, useMemo, useState } from "react";
import { readUserSession } from "@/lib/userSession";
import type { DashboardData, Round, RoundResult } from "@/types/dashboard";

const STORAGE_KEY = "sniper_round_history_v1";
const NEURAL_GENERAL_SCORE_KEY = "sniper_neural_general_score";
const MAX_STORED_ROUNDS = 4000;
const MIN_QUOTA_FALLBACK_ROUNDS = 250;
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";

export interface StoredRound extends Round {
  key: string;
  day: string;
  capturedAt: string;
  sourceUpdatedAt?: string;
}

export interface DayRoundSummary {
  day: string;
  total: number;
  banker: number;
  player: number;
  tie: number;
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
  firstTime: string | null;
  lastTime: string | null;
  lastSequence: string;
}

export interface RoundHistorySnapshot {
  collectionStartedAt: string | null;
  lastCapturedAt: string | null;
  sourceUpdatedAt: string | null;
  storedRounds: number;
  todayRounds: StoredRound[];
  today: DayRoundSummary;
  yesterday: DayRoundSummary;
  isSourceStale: boolean;
}

export interface UseRoundHistoryResult {
  history: RoundHistorySnapshot;
  resetHistory: () => void;
}

interface StoredHistory {
  collectionStartedAt: string;
  rounds: StoredRound[];
}

export function useRoundHistory(data: DashboardData, enabled: boolean): UseRoundHistoryResult {
  const [history, setHistory] = useState<StoredHistory>(() => readHistory());

  useEffect(() => {
    if (!enabled || data.mockMode || !data.rounds.length) return;

    setHistory((current) => {
      const capturedAt = new Date().toISOString();
      const sourceUpdatedAt = validIsoDate(data.updatedAt) ? data.updatedAt : undefined;
      if (sourceUpdatedAt && localDayKey(sourceUpdatedAt) !== localDayKey(capturedAt))
        return current;
      const day = localDayKey(sourceUpdatedAt ?? capturedAt);
      const byKey = new Map(current.rounds.map((round) => [round.key, round]));

      for (const round of data.rounds) {
        const key = buildRoundKey(round, day);
        if (!byKey.has(key)) {
          byKey.set(key, { ...round, key, day, capturedAt, sourceUpdatedAt });
        }
      }

      const next: StoredHistory = {
        collectionStartedAt: current.collectionStartedAt || capturedAt,
        rounds: Array.from(byKey.values()).sort(compareStoredRounds).slice(-MAX_STORED_ROUNDS),
      };
      return writeHistory(next);
    });
  }, [data.mockMode, data.rounds, data.updatedAt, enabled]);

  const resetHistory = () => {
    const next: StoredHistory = { collectionStartedAt: new Date().toISOString(), rounds: [] };
    const persisted = writeHistory(next);
    if (typeof window !== "undefined") window.localStorage.removeItem(NEURAL_GENERAL_SCORE_KEY);
    setHistory(persisted);
  };

  const snapshot = useMemo(() => {
    const now = new Date();
    const todayKey = localDayKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = localDayKey(yesterday.toISOString());
    const officialRounds = buildOfficialRounds(data, enabled);
    const sourceRounds = mergeStoredRounds(history.rounds, officialRounds);
    const lastRound = sourceRounds.at(-1);
    const sourceUpdatedAt = lastRound?.sourceUpdatedAt ?? null;

    return {
      collectionStartedAt: officialRounds[0]?.capturedAt ?? history.collectionStartedAt ?? null,
      lastCapturedAt: lastRound?.capturedAt ?? null,
      sourceUpdatedAt,
      storedRounds: sourceRounds.length,
      todayRounds: sourceRounds.filter((round) => round.day === todayKey).sort(compareStoredRounds),
      today: summarizeDay(sourceRounds, todayKey),
      yesterday: summarizeDay(sourceRounds, yesterdayKey),
      isSourceStale: sourceUpdatedAt ? localDayKey(sourceUpdatedAt) !== todayKey : false,
    };
  }, [data, enabled, history]);

  return { history: snapshot, resetHistory };
}

function readHistory(): StoredHistory {
  if (typeof window === "undefined") return { collectionStartedAt: "", rounds: [] };
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(storageKey()) || "{}",
    ) as Partial<StoredHistory>;
    return {
      collectionStartedAt:
        typeof parsed.collectionStartedAt === "string" ? parsed.collectionStartedAt : "",
      rounds: Array.isArray(parsed.rounds)
        ? parsed.rounds.filter(isStoredRound).slice(-MAX_STORED_ROUNDS)
        : [],
    };
  } catch {
    return { collectionStartedAt: "", rounds: [] };
  }
}

function writeHistory(history: StoredHistory): StoredHistory {
  const normalized: StoredHistory = {
    collectionStartedAt: history.collectionStartedAt,
    rounds: history.rounds.slice(-MAX_STORED_ROUNDS),
  };
  if (typeof window === "undefined") return normalized;

  const key = storageKey();
  let candidate = normalized;
  while (candidate.rounds.length > MIN_QUOTA_FALLBACK_ROUNDS) {
    try {
      window.localStorage.setItem(key, JSON.stringify(candidate));
      return candidate;
    } catch (error) {
      if (!isStorageQuotaError(error)) {
        console.warn("[ROUND_HISTORY_STORAGE] falha ao salvar histórico local", error);
        return candidate;
      }
      const nextLength = Math.floor(candidate.rounds.length * 0.75);
      candidate = {
        ...candidate,
        rounds: candidate.rounds.slice(-Math.max(MIN_QUOTA_FALLBACK_ROUNDS, nextLength)),
      };
    }
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(candidate));
  } catch (error) {
    console.warn(
      "[ROUND_HISTORY_STORAGE] limite local atingido; mantendo somente em memória",
      error,
    );
  }
  return candidate;
}

function isStorageQuotaError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function storageKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${STORAGE_KEY}:${email}` : STORAGE_KEY;
}

function summarizeDay(rounds: StoredRound[], day: string): DayRoundSummary {
  const dayRounds = rounds.filter((round) => round.day === day).sort(compareStoredRounds);
  const total = dayRounds.length;
  const banker = countResult(dayRounds, "B");
  const player = countResult(dayRounds, "P");
  const tie = countResult(dayRounds, "T");

  return {
    day,
    total,
    banker,
    player,
    tie,
    bankerPercent: percent(banker, total),
    playerPercent: percent(player, total),
    tiePercent: percent(tie, total),
    firstTime: dayRounds[0]?.time ?? null,
    lastTime: dayRounds.at(-1)?.time ?? null,
    lastSequence: dayRounds
      .slice(-20)
      .map((round) => round.result)
      .join(""),
  };
}

function countResult(rounds: StoredRound[], result: RoundResult) {
  return rounds.filter((round) => round.result === result).length;
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

function buildRoundKey(round: Round, day: string) {
  return `${day}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function compareStoredRounds(a: StoredRound, b: StoredRound) {
  const dayCompare = a.day.localeCompare(b.day);
  if (dayCompare) return dayCompare;
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  return a.capturedAt.localeCompare(b.capturedAt);
}

function localDayKey(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = cycleDateParts(date);
  if (parts.hour === "00" && parts.minute === "00") {
    return cycleDateParts(new Date(date.getTime() - 60_000)).date;
  }
  return parts.date;
}

function mergeStoredRounds(stored: StoredRound[], incoming: StoredRound[]) {
  const byKey = new Map(stored.map((round) => [round.key, round]));
  for (const round of incoming) {
    const previous = byKey.get(round.key);
    byKey.set(
      round.key,
      previous ? { ...previous, ...round, capturedAt: previous.capturedAt } : round,
    );
  }
  return [...byKey.values()].sort(compareStoredRounds).slice(-MAX_STORED_ROUNDS);
}

function buildOfficialRounds(data: DashboardData, enabled: boolean): StoredRound[] {
  if (!enabled || data.mockMode || !data.rounds.length) return [];
  const capturedAt = validIsoDate(data.updatedAt) ? data.updatedAt : new Date().toISOString();
  const day = localDayKey(capturedAt);
  return data.rounds
    .map((round) => ({
      ...round,
      key: buildRoundKey(round, day),
      day,
      capturedAt,
      sourceUpdatedAt: validIsoDate(data.updatedAt) ? data.updatedAt : capturedAt,
    }))
    .sort(compareStoredRounds);
}

function cycleDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_CYCLE_TIME_ZONE,
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
    hour: part("hour"),
    minute: part("minute"),
  };
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function isStoredRound(value: unknown): value is StoredRound {
  const round = value as Partial<StoredRound>;
  return (
    typeof round.key === "string" &&
    typeof round.day === "string" &&
    typeof round.capturedAt === "string" &&
    typeof round.id === "number" &&
    (round.result === "B" || round.result === "P" || round.result === "T") &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}
