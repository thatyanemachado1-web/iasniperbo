import { useEffect, useMemo, useState } from "react";
import { readUserSession } from "@/lib/userSession";
import type { DashboardData, Round, RoundResult } from "@/types/dashboard";

const STORAGE_KEY = "sniper_round_history_v1";
const NEURAL_GENERAL_SCORE_KEY = "sniper_neural_general_score";
const MAX_STORED_ROUNDS = 20000;
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
      if (sourceUpdatedAt && localDayKey(sourceUpdatedAt) !== localDayKey(capturedAt)) return current;
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
      writeHistory(next);
      return next;
    });
  }, [data.mockMode, data.rounds, data.updatedAt, enabled]);

  const resetHistory = () => {
    const next: StoredHistory = { collectionStartedAt: new Date().toISOString(), rounds: [] };
    writeHistory(next);
    if (typeof window !== "undefined") window.localStorage.removeItem(NEURAL_GENERAL_SCORE_KEY);
    setHistory(next);
  };

  const snapshot = useMemo(() => {
    const now = new Date();
    const todayKey = localDayKey(now.toISOString());
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayKey = localDayKey(yesterday.toISOString());
    const lastRound = history.rounds.at(-1);
    const sourceUpdatedAt = lastRound?.sourceUpdatedAt ?? null;

    return {
      collectionStartedAt: history.collectionStartedAt || null,
      lastCapturedAt: lastRound?.capturedAt ?? null,
      sourceUpdatedAt,
      storedRounds: history.rounds.length,
      todayRounds: history.rounds
        .filter((round) => round.day === todayKey)
        .sort(compareStoredRounds),
      today: summarizeDay(history.rounds, todayKey),
      yesterday: summarizeDay(history.rounds, yesterdayKey),
      isSourceStale: sourceUpdatedAt ? localDayKey(sourceUpdatedAt) !== todayKey : false,
    };
  }, [history]);

  return { history: snapshot, resetHistory };
}

function readHistory(): StoredHistory {
  if (typeof window === "undefined") return { collectionStartedAt: "", rounds: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || "{}") as Partial<StoredHistory>;
    return {
      collectionStartedAt: typeof parsed.collectionStartedAt === "string" ? parsed.collectionStartedAt : "",
      rounds: Array.isArray(parsed.rounds) ? parsed.rounds.filter(isStoredRound) : [],
    };
  } catch {
    return { collectionStartedAt: "", rounds: [] };
  }
}

function writeHistory(history: StoredHistory) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(history));
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
    lastSequence: dayRounds.slice(-20).map((round) => round.result).join(""),
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
