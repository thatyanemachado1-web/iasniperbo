import { useEffect, useState } from "react";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { Round } from "@/types/dashboard";

const DASHBOARD_ROUND_HISTORY_REFRESH_MS = 5_000;

interface DashboardRoundHistoryState {
  rounds: Round[];
  updatedAt: string | null;
  status: "idle" | "loading" | "ready" | "error";
}

interface UseDashboardRoundHistoryParams {
  enabled?: boolean;
  limit?: number;
  tableId?: string;
}

export function useDashboardRoundHistory({
  enabled = true,
  limit = 20_000,
  tableId = "bac-bo",
}: UseDashboardRoundHistoryParams = {}): DashboardRoundHistoryState {
  const [state, setState] = useState<DashboardRoundHistoryState>({
    rounds: [],
    updatedAt: null,
    status: enabled ? "loading" : "idle",
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      setState((current) => ({ ...current, status: "idle" }));
      return;
    }

    let stopped = false;
    let timeoutId: number | undefined;

    async function load() {
      setState((current) => ({ ...current, status: current.rounds.length ? "ready" : "loading" }));
      try {
        const next = await fetchDashboardRoundHistory(limit, tableId);
        if (!stopped) setState(next);
      } catch {
        if (!stopped) {
          setState((current) => ({ ...current, status: current.rounds.length ? "ready" : "error" }));
        }
      } finally {
        if (!stopped) {
          timeoutId = window.setTimeout(load, DASHBOARD_ROUND_HISTORY_REFRESH_MS);
        }
      }
    }

    load();

    return () => {
      stopped = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [enabled, limit, tableId]);

  return state;
}

async function fetchDashboardRoundHistory(limit: number, tableId: string): Promise<DashboardRoundHistoryState> {
  const url = new URL("/dashboard/round-history", window.location.origin);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("tableId", tableId);

  const session = readUserSession();
  const adminSession = readAdminSession();
  const token = session.clientToken || adminSession?.token || "";
  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) throw new Error(`Round history returned ${response.status}`);

  const payload = (await response.json().catch(() => null)) as {
    rounds?: unknown[];
    updatedAt?: unknown;
  } | null;

  return {
    rounds: Array.isArray(payload?.rounds) ? payload.rounds.filter(isRound) : [],
    updatedAt: typeof payload?.updatedAt === "string" ? payload.updatedAt : null,
    status: "ready",
  };
}

function isRound(value: unknown): value is Round {
  const round = value as Partial<Round>;
  return (
    typeof round?.id === "number" &&
    (round.result === "B" || round.result === "P" || round.result === "T") &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}
