import type { Round, RoundResult } from "@/types/dashboard";

const DAILY_SURF_STORAGE_KEY = "sniper_daily_surf_max_v1";
const TIME_ZONE = "America/Sao_Paulo";

export type DailySurfSide = "BANKER" | "PLAYER" | "TIE";

export interface DailySurfRound {
  round_id: string;
  result: DailySurfSide;
  round_time: string;
  table_id: string;
  date_br: string;
  order: number;
}

export interface DailySurfMaxSnapshot {
  currentStreak: {
    side: DailySurfSide | null;
    count: number;
  };
  dailyMaxSurf: {
    banker: number;
    player: number;
    tie: number;
    date: string;
    table_id: string;
    last_round_id: string | null;
    updated_at: string;
  };
}

export interface DailySurfRoundSource extends Round {
  key?: string;
  day?: string;
  capturedAt?: string;
  sourceUpdatedAt?: string;
}

export class DailySurfMaxEngine {
  static empty(tableId = "bac-bo", date = brasiliaDateKey()): DailySurfMaxSnapshot {
    return {
      currentStreak: {
        side: null,
        count: 0,
      },
      dailyMaxSurf: {
        banker: 0,
        player: 0,
        tie: 0,
        date,
        table_id: tableId,
        last_round_id: null,
        updated_at: new Date().toISOString(),
      },
    };
  }

  static load(tableId = "bac-bo", scope = "default"): DailySurfMaxSnapshot {
    if (typeof window === "undefined") return this.empty(tableId);

    try {
      const value = window.localStorage.getItem(storageKey(tableId, scope));
      const parsed = value ? JSON.parse(value) : null;
      if (isDailySurfMaxSnapshot(parsed)) return normalizeSnapshot(parsed, tableId);
    } catch {
      // Local persistence is a fallback. If it fails, keep the engine running in memory.
    }

    return this.empty(tableId);
  }

  static save(snapshot: DailySurfMaxSnapshot, scope = "default") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey(snapshot.dailyMaxSurf.table_id, scope),
      JSON.stringify(snapshot),
    );
  }

  static processRound(snapshot: DailySurfMaxSnapshot, round: DailySurfRound): DailySurfMaxSnapshot {
    if (round.round_id === snapshot.dailyMaxSurf.last_round_id) return snapshot;

    const base =
      snapshot.dailyMaxSurf.date === round.date_br
        ? snapshot
        : DailySurfMaxEngine.empty(round.table_id, round.date_br);

    const nextStreak =
      base.currentStreak.side === round.result
        ? { side: round.result, count: base.currentStreak.count + 1 }
        : { side: round.result, count: 1 };

    const next = cloneSnapshot(base);
    next.currentStreak = nextStreak;
    next.dailyMaxSurf.last_round_id = round.round_id;
    next.dailyMaxSurf.updated_at = new Date().toISOString();

    if (nextStreak.side === "BANKER") {
      next.dailyMaxSurf.banker = Math.max(next.dailyMaxSurf.banker, nextStreak.count);
    }
    if (nextStreak.side === "PLAYER") {
      next.dailyMaxSurf.player = Math.max(next.dailyMaxSurf.player, nextStreak.count);
    }
    if (nextStreak.side === "TIE") {
      next.dailyMaxSurf.tie = Math.max(next.dailyMaxSurf.tie, nextStreak.count);
    }

    return next;
  }

  static recalculate(rounds: DailySurfRound[], tableId = "bac-bo", date = brasiliaDateKey()) {
    let snapshot = DailySurfMaxEngine.empty(tableId, date);
    for (const round of rounds.slice().sort(compareDailySurfRounds)) {
      if (round.date_br !== date) continue;
      snapshot = DailySurfMaxEngine.processRound(snapshot, round);
    }
    return snapshot;
  }

  static normalizeRounds(
    rounds: DailySurfRoundSource[],
    options: { tableId?: string; fallbackTimestamp?: string | null } = {},
  ) {
    return rounds
      .map((round) => normalizeRound(round, options))
      .filter((round): round is DailySurfRound => Boolean(round))
      .sort(compareDailySurfRounds);
  }

  static todayKey(timestamp?: string | Date) {
    return brasiliaDateKey(timestamp);
  }
}

export function compareDailySurfRounds(left: DailySurfRound, right: DailySurfRound) {
  const dateCompare = left.date_br.localeCompare(right.date_br);
  if (dateCompare) return dateCompare;
  const orderCompare = left.order - right.order;
  if (orderCompare) return orderCompare;
  const timeCompare = left.round_time.localeCompare(right.round_time);
  if (timeCompare) return timeCompare;
  return left.round_id.localeCompare(right.round_id);
}

function normalizeRound(
  round: DailySurfRoundSource,
  options: { tableId?: string; fallbackTimestamp?: string | null },
): DailySurfRound | null {
  const result = mapResult(round.result);
  if (!result) return null;

  const timestamp =
    validIsoDate(round.sourceUpdatedAt) ? round.sourceUpdatedAt :
    validIsoDate(round.capturedAt) ? round.capturedAt :
    validIsoDate(options.fallbackTimestamp) ? options.fallbackTimestamp :
    new Date().toISOString();

  const date = round.day && round.day.length >= 10 ? round.day : brasiliaDateKey(timestamp);

  return {
    round_id: round.key ?? `${round.id}:${round.time}:${round.result}:${round.bankerScore}:${round.playerScore}`,
    result,
    round_time: timestamp,
    table_id: options.tableId ?? "bac-bo",
    date_br: date,
    order: Number.isFinite(round.id) ? round.id : Date.parse(timestamp),
  };
}

function mapResult(result: RoundResult): DailySurfSide | null {
  if (result === "B") return "BANKER";
  if (result === "P") return "PLAYER";
  if (result === "T") return "TIE";
  return null;
}

function cloneSnapshot(snapshot: DailySurfMaxSnapshot): DailySurfMaxSnapshot {
  return {
    currentStreak: { ...snapshot.currentStreak },
    dailyMaxSurf: { ...snapshot.dailyMaxSurf },
  };
}

function normalizeSnapshot(snapshot: DailySurfMaxSnapshot, tableId: string): DailySurfMaxSnapshot {
  const today = brasiliaDateKey();
  if (snapshot.dailyMaxSurf.date !== today || snapshot.dailyMaxSurf.table_id !== tableId) {
    return DailySurfMaxEngine.empty(tableId, today);
  }
  return snapshot;
}

function isDailySurfMaxSnapshot(value: unknown): value is DailySurfMaxSnapshot {
  const snapshot = value as Partial<DailySurfMaxSnapshot>;
  return (
    Boolean(snapshot) &&
    typeof snapshot === "object" &&
    typeof snapshot.currentStreak?.count === "number" &&
    (snapshot.currentStreak.side === "BANKER" ||
      snapshot.currentStreak.side === "PLAYER" ||
      snapshot.currentStreak.side === "TIE" ||
      snapshot.currentStreak.side === null) &&
    typeof snapshot.dailyMaxSurf?.banker === "number" &&
    typeof snapshot.dailyMaxSurf?.player === "number" &&
    typeof snapshot.dailyMaxSurf?.tie === "number" &&
    typeof snapshot.dailyMaxSurf?.date === "string" &&
    typeof snapshot.dailyMaxSurf?.table_id === "string"
  );
}

function storageKey(tableId: string, scope: string) {
  return `${DAILY_SURF_STORAGE_KEY}:${scope}:${tableId}`;
}

function brasiliaDateKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
