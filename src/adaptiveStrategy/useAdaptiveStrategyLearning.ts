import { useEffect, useMemo, useRef, useState } from "react";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { AdaptiveRoundRecord, AdaptiveSyncStatus } from "@/types/adaptiveStrategy";
import type { DashboardData, Round } from "@/types/dashboard";

const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
import {
  adaptiveSideFromRoundResult,
  analyzeAdaptiveStrategy,
} from "@/adaptiveStrategy/AdaptiveStrategyLearningEngine";

const STORAGE_KEY = "sniper_adaptive_strategy_learning_v1";
const MAX_RECORDS = 50000;
const LOCAL_DEV_DASHBOARD_TOKEN = "sniper-local-admin-token";

interface AdaptiveStore {
  collectionStartedAt: string;
  records: AdaptiveRoundRecord[];
  syncStatus: AdaptiveSyncStatus;
}

export function useAdaptiveStrategyLearning(data: DashboardData, enabled: boolean) {
  const [store, setStore] = useState<AdaptiveStore>(() => readStore());
  const lastSyncKey = useRef("");

  useEffect(() => {
    if (!enabled || data.mockMode || !data.rounds.length) return;
    setStore((current) => {
      const capturedAt = new Date().toISOString();
      const nextRecords = buildRecords(data, capturedAt);
      if (!nextRecords.length) return current;

      const byKey = new Map(current.records.map((record) => [record.key, record]));
      for (const record of nextRecords) {
        byKey.set(record.key, { ...byKey.get(record.key), ...record });
      }

      const next: AdaptiveStore = {
        collectionStartedAt: current.collectionStartedAt || capturedAt,
        records: Array.from(byKey.values()).sort(compareRecords).slice(-MAX_RECORDS),
        syncStatus: current.syncStatus,
      };
      writeStore(next);
      return next;
    });
  }, [data, enabled]);

  const snapshot = useMemo(
    () => analyzeAdaptiveStrategy(store.records, data, store.syncStatus),
    [data, store.records, store.syncStatus],
  );

  useEffect(() => {
    if (!enabled || !store.records.length) return;
    const lastRecord = store.records.at(-1);
    const syncKey = `${store.records.length}:${lastRecord?.key ?? ""}:${snapshot.entryScore.finalScore}`;
    if (lastSyncKey.current === syncKey) return;
    lastSyncKey.current = syncKey;

    void syncAdaptiveSnapshot(store.records, snapshot).then((syncStatus) => {
      if (!syncStatus) return;
      setStore((current) => {
        if (
          current.syncStatus.mode === syncStatus.mode &&
          current.syncStatus.message === syncStatus.message &&
          current.syncStatus.lastSyncedAt === syncStatus.lastSyncedAt
        ) {
          return current;
        }
        const next = { ...current, syncStatus };
        writeStore(next);
        return next;
      });
    });
  }, [enabled, snapshot, store.records]);

  function resetAdaptiveLearning() {
    const next: AdaptiveStore = {
      collectionStartedAt: new Date().toISOString(),
      records: [],
      syncStatus: {
        mode: "local",
        lastSyncedAt: null,
        message: "Motor reiniciado. Aguardando novas rodadas reais.",
      },
    };
    writeStore(next);
    setStore(next);
  }

  return { snapshot, records: store.records, resetAdaptiveLearning };
}

function buildRecords(data: DashboardData, capturedAt: string): AdaptiveRoundRecord[] {
  const sourceUpdatedAt = validIsoDate(data.updatedAt) ? data.updatedAt : null;
  const day = localDayKey(sourceUpdatedAt ?? capturedAt);
  const rounds = data.rounds;

  return rounds.map((round, index) => {
    const record = round as Round & Record<string, unknown>;
    const result = adaptiveSideFromRoundResult(round.result);
    const previousSequence = rounds
      .slice(Math.max(0, index - 4), index)
      .map((item) => adaptiveSideFromRoundResult(item.result)[0])
      .join("-");
    const nextResult = rounds[index + 1]?.result
      ? adaptiveSideFromRoundResult(rounds[index + 1].result)
      : null;
    const tableName =
      readText(record.tableName) || readText(record.table) || readText(record.mesa) || "Mesa principal";
    const timestamp = playedAt(day, round.time, sourceUpdatedAt ?? capturedAt);
    const tieMultiplier = readNumber(record.tieMultiplier ?? record.tie_multiplier ?? record.multiplier);

    return {
      key: `${day}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`,
      tableName,
      roundId: round.id,
      day,
      time: round.time,
      result,
      bankerScore: round.bankerScore,
      playerScore: round.playerScore,
      tieMultiplier,
      previousSequence,
      nextResult,
      timestamp,
      sourceUpdatedAt,
      capturedAt,
    };
  });
}

async function syncAdaptiveSnapshot(
  records: AdaptiveRoundRecord[],
  snapshot: ReturnType<typeof analyzeAdaptiveStrategy>,
): Promise<AdaptiveSyncStatus | null> {
  if (typeof window === "undefined") return null;

  const token = authToken();
  try {
    const response = await fetch("/adaptive-strategy/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        records: records.slice(-2000),
        patterns: snapshot.patterns.slice(0, 300),
        decision: snapshot.entryScore,
        logs: snapshot.decisionLogs.slice(0, 50),
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as Partial<AdaptiveSyncStatus> & {
      storage?: string;
      warning?: string;
      error?: string;
    };

    if (!response.ok) {
      return {
        mode: "error",
        lastSyncedAt: new Date().toISOString(),
        message: payload.error || "Falha ao sincronizar Adaptive Engine.",
      };
    }

    if (payload.mode === "database" || payload.storage === "database") {
      return {
        mode: "database",
        lastSyncedAt: payload.lastSyncedAt || new Date().toISOString(),
        message: payload.message || "Rodadas e decisões salvas no Supabase.",
      };
    }

    return {
      mode: "local",
      lastSyncedAt: payload.lastSyncedAt || new Date().toISOString(),
      message: payload.message || payload.warning || "Histórico local ativo.",
    };
  } catch {
    return {
      mode: "error",
      lastSyncedAt: new Date().toISOString(),
      message: "Sem conexão com o endpoint de sincronização. Histórico local preservado.",
    };
  }
}

function authToken() {
  const admin = readAdminSession();
  const user = readUserSession();
  if (admin?.token) return admin.token;
  if (user.clientToken) return user.clientToken;
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return LOCAL_DEV_DASHBOARD_TOKEN;
  return "";
}

function readStore(): AdaptiveStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey()) || "{}") as Partial<AdaptiveStore>;
    return {
      collectionStartedAt:
        typeof parsed.collectionStartedAt === "string" ? parsed.collectionStartedAt : "",
      records: Array.isArray(parsed.records) ? parsed.records.filter(isRecord) : [],
      syncStatus: normalizeSyncStatus(parsed.syncStatus),
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: AdaptiveStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(store));
}

function emptyStore(): AdaptiveStore {
  return {
    collectionStartedAt: "",
    records: [],
    syncStatus: {
      mode: "local",
      lastSyncedAt: null,
      message: "Histórico local ativo. Aguardando primeiras rodadas reais.",
    },
  };
}

function storageKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${STORAGE_KEY}:${email}` : STORAGE_KEY;
}

function normalizeSyncStatus(value: unknown): AdaptiveSyncStatus {
  const record = value && typeof value === "object" ? (value as Partial<AdaptiveSyncStatus>) : {};
  const mode = record.mode === "database" || record.mode === "error" ? record.mode : "local";
  return {
    mode,
    lastSyncedAt: typeof record.lastSyncedAt === "string" ? record.lastSyncedAt : null,
    message:
      typeof record.message === "string"
        ? record.message
        : "Histórico local ativo. Aguardando sincronização do banco.",
  };
}

function isRecord(value: unknown): value is AdaptiveRoundRecord {
  const record = value as Partial<AdaptiveRoundRecord>;
  return (
    typeof record.key === "string" &&
    typeof record.tableName === "string" &&
    typeof record.roundId === "number" &&
    (record.result === "BANKER" || record.result === "PLAYER" || record.result === "TIE") &&
    typeof record.bankerScore === "number" &&
    typeof record.playerScore === "number" &&
    typeof record.timestamp === "string"
  );
}

function compareRecords(left: AdaptiveRoundRecord, right: AdaptiveRoundRecord) {
  const time = Date.parse(left.timestamp) - Date.parse(right.timestamp);
  if (time) return time;
  return left.roundId - right.roundId;
}

function playedAt(day: string, time: string, fallback: string) {
  const cleanTime = String(time || "").trim();
  const match = cleanTime.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    const hour = match[1].padStart(2, "0");
    const minute = match[2];
    const second = match[3] ?? "00";
    const parsed = new Date(`${day}T${hour}:${minute}:${second}`);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  return fallback;
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

function readText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}
