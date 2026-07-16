import { replaceEqualDeep, useQuery, useQueryClient } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import { refreshAccessSession } from "@/lib/accessApi";
import { readAdminSession } from "@/lib/adminApi";
import { LOCAL_SIGNALS_API_BASE_URL } from "@/lib/runtimePorts";
import { clearUserSession, readUserSession } from "@/lib/userSession";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CurrentSignalSide,
  DashboardData,
  DashboardDailyResultsByModule,
  DashboardDisplayState,
  DashboardPersistentResult,
  ModuleToggles,
  NeuralReading,
  NeuralScoreboard,
} from "@/types/dashboard";
import { calculateMotorAssertiveness } from "@/utils/assertiveness";

const DEFAULT_POLLING_MS = 500;
const ERROR_BACKOFF_POLLING_MS = 1500;
const DASHBOARD_FETCH_DEDUP_MS = 250;
const DASHBOARD_FETCH_TIMEOUT_MS = 4_000;
const MAX_IN_FLIGHT_REQUESTS = 1;
const STREAM_ENABLED = false;
const DASHBOARD_AUTH_FAILURES_BEFORE_LOGOUT = 6;
const DASHBOARD_AUTH_FAILURE_WINDOW_MS = 45_000;
const CLIENT_MODULE_TOGGLES_KEY = "sniper_client_module_toggles";
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
const PUBLIC_LIVE_API_BASE_URL = "https://sniperbo.com";
const DASHBOARD_SOURCE_STORAGE_KEY = "sniper_admin_api_url";
const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
const ALLOWED_REMOTE_API_HOSTS = new Set(["sniperbo.com", "www.sniperbo.com"]);
const CONNECTING_DASHBOARD_DATA: DashboardData = {
  ...mockDashboardData,
  user: { name: "" },
  mockMode: false,
  revision: 0,
  sequenceId: 0,
  rounds: [],
  updatedAt: undefined,
  collectorStatus: "connecting",
  websocketStatus: "connecting",
  currentSignal: {
    id: "connecting",
    side: "NONE",
    status: "waiting",
    protection: "-",
    strength: 0,
  },
  lastSignalResult: null,
  displayState: "analyzing",
  displaySide: "NONE",
  displayRoundId: null,
  currentTieAlert: {
    id: "current-tie",
    level: "Baixo",
    confidence: 0,
    validityRounds: 0,
    status: "expired",
    source: "stale",
  },
  currentSurfAlert: {
    surf_alert: false,
    surf_phase: "SEM_RISCO",
    surf_side: "NONE",
    surf_status: "SEM_RISCO",
    surf_risk: 0,
    surf_break_risk: 0,
    surf_confidence: 0,
    stretched_count: 0,
    correction_count: 0,
    reason: "Aguardando dados reais da mesa.",
    panels: {
      big_road: "Aguardando dados reais.",
      big_eye_boy: "Aguardando dados reais.",
      small_road: "Aguardando dados reais.",
      cockroach_pig: "Aguardando dados reais.",
    },
    surf_prediction_side: "NONE",
    surf_prediction_status: "EXPIRED",
    surf_prediction_confidence: 0,
    surf_prediction_window: 0,
  },
  neuralReading: {
    mode: "SCANNING",
    numero: null,
    origem: null,
    origemTipo: null,
    direcao: null,
    validade: "G1",
    alertas: 0,
    acertos: 0,
    greenSemGale: 0,
    greenG1: 0,
    erros: 0,
    reds: 0,
    assertividade: 0,
    paganteStatus: "ANALISANDO",
    paganteAlert: "Aguardando dashboard real.",
  },
  neuralScoreboard: {
    totalAlerts: 0,
    acertos: 0,
    greens: 0,
    greenSemGale: 0,
    greenG1: 0,
    erros: 0,
    reds: 0,
    assertividade: 0,
  },
  neuralEntryState: null,
  neuralEntryLastResult: null,
  engineDecision: {
    state: "AGUARDAR",
    reason: "Aguardando dados reais da mesa.",
    confidence: 0,
  },
  mainScoreboard: {
    greens: 0,
    greensG1: 0,
    reds: 0,
    totalGreens: 0,
    totalEntries: 0,
    assertiveness: 0,
  },
  tieAlertScoreboard: {
    greenTieAlerts: 0,
    expired: 0,
    totalAlerts: 0,
    assertiveness: 0,
  },
  tieRadarHistory: undefined,
  monthlyTieStats: undefined,
  dailyResultsByModule: {},
  surfAnalyzerScoreboard: {
    totalAlerts: 0,
    hits: 0,
    fails: 0,
    expired: 0,
    greenSemGale: 0,
    greenG1: 0,
    reds: 0,
    blocked: 0,
    noRisk: 0,
    bankerHits: 0,
    playerHits: 0,
    assertiveness: 0,
    sequencePositive: 0,
    sequenceNegative: 0,
    maxBankerSurfHit: 0,
    maxPlayerSurfHit: 0,
    maxBreakDetected: 0,
    maxRetakeDetected: 0,
    currentHitStreak: 0,
  },
  pressureSeries: [],
};

let dashboardFetchInFlight:
  | {
      key: string;
      promise: Promise<DashboardData>;
    }
  | null = null;
let dashboardFetchCache:
  | {
      key: string;
      data: DashboardData;
      fetchedAt: number;
    }
  | null = null;
let dashboardAuthFailureCount = 0;
let dashboardAuthFailureFirstAt = 0;

function configuredDashboardUrl() {
  const directUrl = import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined;
  if (directUrl) return ensureDashboardPath(directUrl);

  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
    (import.meta.env.VITE_SNIPER_API_URL as string | undefined);
  if (apiBase) return ensureDashboardPath(apiBase);

  if (typeof window !== "undefined") {
    // Only accept the ?sniper_api= override on local dev frontends.
    // In production this would allow an attacker to redirect API calls via a
    // crafted link, so it is disabled outside of localhost.
    if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
      const queryUrl = dashboardUrlFromQuery(window.location.search);
      if (queryUrl) {
        window.localStorage.setItem(DASHBOARD_SOURCE_STORAGE_KEY, stripDashboardPath(queryUrl));
        return queryUrl;
      }
    }

    const savedAdminApi = window.localStorage.getItem(DASHBOARD_SOURCE_STORAGE_KEY);
    if (!isLocalFrontend() && isHostedAppOrigin()) {
      if (savedAdminApi) window.localStorage.removeItem(DASHBOARD_SOURCE_STORAGE_KEY);
      return defaultDashboardUrl();
    }
    if (savedAdminApi && isSameOriginApiBaseUrl(savedAdminApi)) {
      window.localStorage.removeItem(DASHBOARD_SOURCE_STORAGE_KEY);
      return defaultDashboardUrl();
    }
    if (savedAdminApi && isAllowedApiBaseUrl(savedAdminApi))
      return ensureDashboardPath(savedAdminApi);
    if (savedAdminApi) window.localStorage.removeItem(DASHBOARD_SOURCE_STORAGE_KEY);
  }

  return defaultDashboardUrl();
}

function dashboardUrlFromQuery(search: string) {
  const params = new URLSearchParams(search);
  const rawUrl = params.get("sniper_api") || params.get("api");
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (!isAllowedParsedUrl(parsed)) {
      return null;
    }
    return ensureDashboardPath(parsed.toString());
  } catch {
    return null;
  }
}

function isAllowedApiBaseUrl(url: string) {
  try {
    return isAllowedParsedUrl(new URL(url));
  } catch {
    return false;
  }
}

function isSameOriginApiBaseUrl(url: string) {
  try {
    return typeof window !== "undefined" && new URL(url).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function isAllowedParsedUrl(parsed: URL) {
  if (["127.0.0.1", "localhost"].includes(parsed.hostname)) return isLocalFrontend();
  if (typeof window !== "undefined" && parsed.hostname === window.location.hostname)
    return parsed.protocol === "https:";
  return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
}

function isLocalFrontend() {
  return (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  );
}

function isHostedAppOrigin() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "sniperbo.com" || hostname === "www.sniperbo.com" || hostname.endsWith(".lovable.app");
}

function ensureDashboardPath(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/dashboard") ? trimmed : `${trimmed}/dashboard`;
}

function stripDashboardPath(url: string) {
  return url.replace(/\/dashboard\/?$/, "");
}

function defaultDashboardUrl() {
  if (typeof window === "undefined") return "";
  if (isLocalFrontend()) {
    return ensureDashboardPath(LOCAL_SIGNALS_API_BASE_URL);
  }
  if (isHostedAppOrigin()) {
    return ensureDashboardPath(PUBLIC_LIVE_API_BASE_URL);
  }
  return ensureDashboardPath(PUBLIC_LIVE_API_BASE_URL);
}

function configuredDashboardToken(url: string) {
  const envToken = import.meta.env.VITE_SNIPER_DASHBOARD_TOKEN as string | undefined;
  if (!envToken?.trim()) return "";
  return isLocalDashboardUrl(url) ? envToken.trim() : "";
}

function isLocalDashboardUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["127.0.0.1", "localhost"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchDashboardData(): Promise<DashboardData> {
  const url = configuredDashboardUrl();
  const key = dashboardRequestCacheKey(url);
  const now = Date.now();
  if (MAX_IN_FLIGHT_REQUESTS !== 1) {
    throw new Error("Dashboard polling supports a single in-flight request");
  }
  if (dashboardFetchInFlight?.key === key) return dashboardFetchInFlight.promise;
  if (
    dashboardFetchCache?.key === key &&
    now - dashboardFetchCache.fetchedAt < DASHBOARD_FETCH_DEDUP_MS
  ) {
    return dashboardFetchCache.data;
  }

  const promise = fetchDashboardDataOnce(url)
    .then((data) => {
      noteDashboardAuthSuccess();
      dashboardFetchCache = { key, data, fetchedAt: Date.now() };
      return data;
    })
    .finally(() => {
      if (dashboardFetchInFlight?.promise === promise) {
        dashboardFetchInFlight = null;
      }
    });
  dashboardFetchInFlight = { key, promise };
  return promise;
}

async function fetchDashboardDataOnce(url: string): Promise<DashboardData> {
  const response = await fetchDashboardResponse(url);

  if (response.status === 401 || response.status === 403) {
    const refreshed = await refreshAccessSession().catch(() => null);
    if (refreshed?.client_token) {
      noteDashboardAuthSuccess();
      const retry = await fetchDashboardResponse(url);
      if (retry.ok) {
        return normalizeDashboardData(await retry.json());
      }
      if (retry.status === 401 || retry.status === 403) {
        expireDashboardSessionAfterRepeatedAuthFailures();
      }
      throw new Error(`Dashboard API returned ${retry.status}`);
    }
    expireDashboardSessionAfterRepeatedAuthFailures();
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return normalizeDashboardData(await response.json());
}

function noteDashboardAuthSuccess() {
  dashboardAuthFailureCount = 0;
  dashboardAuthFailureFirstAt = 0;
}

function expireDashboardSessionAfterRepeatedAuthFailures() {
  if (typeof window === "undefined") return;
  const session = readUserSession();
  if (!session.clientToken) {
    expireDashboardSession();
    return;
  }

  const now = Date.now();
  if (!dashboardAuthFailureFirstAt || now - dashboardAuthFailureFirstAt > DASHBOARD_AUTH_FAILURE_WINDOW_MS) {
    dashboardAuthFailureFirstAt = now;
    dashboardAuthFailureCount = 0;
  }
  dashboardAuthFailureCount += 1;

  if (dashboardAuthFailureCount < DASHBOARD_AUTH_FAILURES_BEFORE_LOGOUT) {
    console.warn("[DASHBOARD_AUTH_GRACE]", {
      failures: dashboardAuthFailureCount,
      required: DASHBOARD_AUTH_FAILURES_BEFORE_LOGOUT,
    });
    return;
  }

  expireDashboardSession();
}

function expireDashboardSession() {
  if (typeof window === "undefined") return;
  clearUserSession();
  window.location.assign("/");
}

function dashboardRequestCacheKey(url: string) {
  return `${url}|${dashboardAuthTokenForUrl(url)}`;
}

function fetchDashboardResponse(url: string) {
  const liveUrl = dashboardPollUrl(url);
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = configuredDashboardToken(url) || adminSession?.token || userSession.clientToken;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DASHBOARD_FETCH_TIMEOUT_MS);
  return fetch(liveUrl, {
    cache: "no-store",
    signal: controller.signal,
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  }).finally(() => clearTimeout(timeoutId));
}

function dashboardPollUrl(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("rt", `${Date.now()}`);
    return parsed.toString();
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}rt=${Date.now()}`;
  }
}

function dashboardAuthTokenForUrl(url: string) {
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = configuredDashboardToken(url) || adminSession?.token || userSession.clientToken;
  return token || "";
}

function dashboardStreamUrl(url: string, token: string) {
  try {
    const parsed = new URL(url);
    parsed.pathname = "/dashboard";
    parsed.searchParams.set("stream", "1");
    parsed.searchParams.set("rt", `${Date.now()}`);
    if (token) {
      parsed.searchParams.set("access_token", token);
    } else {
      parsed.searchParams.delete("access_token");
    }
    return parsed.toString();
  } catch {
    const baseWithoutQuery = url.replace(/\?.*$/, "");
    const base = /\/dashboard\/?$/i.test(baseWithoutQuery)
      ? baseWithoutQuery.replace(/\/dashboard\/?$/, "")
      : baseWithoutQuery;
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const fallbackBase = normalizedBase ? `${normalizedBase}/dashboard` : "/dashboard";
    const tokenQuery = token
      ? `?stream=1&access_token=${encodeURIComponent(token)}&rt=${Date.now()}`
      : `?stream=1&rt=${Date.now()}`;
    return `${fallbackBase}${tokenQuery}`;
  }
}

export function useDashboardData() {
  const [mounted, setMounted] = useState(false);
  const dashboardUrl = configuredDashboardUrl();
  const initialDashboardData = dashboardUrl ? CONNECTING_DASHBOARD_DATA : mockDashboardData;
  const queryClient = useQueryClient();
  const [moduleToggles, setModuleTogglesState] = useState<ModuleToggles>(() =>
    readStoredModuleToggles(),
  );
  const [sessionRefreshNonce, setSessionRefreshNonce] = useState(0);
  const sessionRefreshInFlightRef = useRef<Promise<boolean> | null>(null);
  const streamToken = useMemo(() => dashboardAuthTokenForUrl(dashboardUrl), [dashboardUrl, sessionRefreshNonce]);
  const [, setStreamEnabled] = useState(false);
  const lastLoggedRevisionRef = useRef<number | string | null>(null);
  const query = useQuery({
    queryKey: ["dashboard-data", dashboardUrl],
    queryFn: fetchDashboardData,
    enabled: mounted && Boolean(dashboardUrl) && typeof window !== "undefined",
    initialData: initialDashboardData,
    refetchInterval: (activeQuery) =>
      activeQuery.state.error || activeQuery.state.fetchFailureCount > 0
        ? ERROR_BACKOFF_POLLING_MS
        : DEFAULT_POLLING_MS,
    refetchIntervalInBackground: true,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnReconnect: "always",
    refetchOnWindowFocus: "always",
    structuralSharing: (oldValue: unknown, newValue: unknown) => {
      const oldData = oldValue as DashboardData | undefined;
      const newData = newValue as DashboardData;
      if (oldData && !isDashboardSnapshotFreshEnough(newData, oldData)) return oldData;
      const mergedData = mergePersistentDashboardSnapshot(oldData, newData);
      // Revisions are assigned inside separate edge isolates, so two valid snapshots
      // can share (or even regress) the same numeric revision while an individual
      // card has already changed. Preserve equal branches, never the whole stale
      // dashboard solely because the revision happens to match.
      return oldData ? replaceEqualDeep(oldData, mergedData) : mergedData;
    },
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined" || !mounted || !dashboardUrl) {
      return undefined;
    }

    let lastSyncAt = 0;
    const queryKey = ["dashboard-data", dashboardUrl] as const;
    const syncNow = () => {
      const now = Date.now();
      if (now - lastSyncAt < DEFAULT_POLLING_MS) return;
      lastSyncAt = now;
      void queryClient.refetchQueries({ queryKey, type: "active" });
    };
    const syncWhenVisible = () => {
      if (!document.hidden) syncNow();
    };

    syncNow();
    window.addEventListener("focus", syncNow);
    window.addEventListener("pageshow", syncNow);
    window.addEventListener("online", syncNow);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.removeEventListener("focus", syncNow);
      window.removeEventListener("pageshow", syncNow);
      window.removeEventListener("online", syncNow);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [dashboardUrl, mounted, queryClient]);

  const data = useMemo(() => {
    const rawData = query.data ?? initialDashboardData;
    return {
      ...rawData,
      moduleToggles,
      entryMode: "off" as const,
      entryModeFilter: undefined,
    };
  }, [query.data, moduleToggles]);

  useEffect(() => {
    if (!query.data || query.data.mockMode) return;
    const revision = dashboardRevisionKey(query.data);
    if (!revision || revision === lastLoggedRevisionRef.current) return;
    lastLoggedRevisionRef.current = revision;
    console.info("[DASHBOARD_FETCH] frontend recebeu revision nova", {
      revision,
      updatedAt: query.data.updatedAt,
      signalStatus: query.data.currentSignal?.status,
      signalSide: query.data.currentSignal?.side,
      displayState: query.data.displayState,
      displaySide: query.data.displaySide,
    });
    console.info("[FRONT_DASHBOARD_RECEIVED]", {
      revision,
      displayState: query.data.displayState,
      side: query.data.displaySide,
    });
    console.info(window.innerWidth < 768 ? "[MOBILE_SYNC] mobile renderizou mesma revision" : "[WEB_SYNC] web renderizou mesma revision", {
      revision,
    });
  }, [query.data]);

  useEffect(() => {
    if (!STREAM_ENABLED) {
      setStreamEnabled(false);
      return undefined;
    }
    if (typeof window === "undefined" || !dashboardUrl) return;
    const streamUrl = dashboardStreamUrl(dashboardUrl, streamToken);
    let activeStream: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let aborted = false;
    let reconnectAttempts = 0;
    const refreshStreamSession = () => {
      if (sessionRefreshInFlightRef.current) return sessionRefreshInFlightRef.current;
      sessionRefreshInFlightRef.current = refreshAccessSession()
        .then((access) => {
          const refreshed = Boolean(access?.client_token);
          if (refreshed) {
            setSessionRefreshNonce((value) => value + 1);
            queryClient.invalidateQueries({ queryKey: ["dashboard-data", dashboardUrl] });
          }
          return refreshed;
        })
        .catch(() => false)
        .finally(() => {
          sessionRefreshInFlightRef.current = null;
        });
      return sessionRefreshInFlightRef.current;
    };
    const onMessage = (event: MessageEvent) => {
      reconnectAttempts = 0;
      setStreamEnabled(true);
      try {
        const parsed = normalizeDashboardData(JSON.parse(event.data));
        queryClient.setQueryData(["dashboard-data", dashboardUrl], (current: DashboardData | undefined) =>
          isDashboardSnapshotFreshEnough(parsed, current)
            ? mergePersistentDashboardSnapshot(current, parsed)
            : current ?? parsed,
        );
      } catch {
        // ignore malformed events
      }
    };
    const openStream = () => {
      if (aborted) return;
      const source = new EventSource(streamUrl);
      activeStream = source;
      const cleanupAndReopen = () => {
        source.close();
        if (aborted) return;
        setStreamEnabled(false);
        void refreshStreamSession().then((refreshed) => {
          if (aborted) return;
          reconnectAttempts = refreshed ? 0 : reconnectAttempts + 1;
          const delay = refreshed ? 100 : Math.min(750 * Math.pow(2, reconnectAttempts), 3000);
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(openStream, delay);
        });
      };
      source.addEventListener("dashboard", onMessage);
      source.onerror = cleanupAndReopen;
      source.onopen = () => {
        setStreamEnabled(true);
      };
    };

    openStream();
    return () => {
      aborted = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (activeStream) activeStream.close();
      setStreamEnabled(false);
    };
  }, [dashboardUrl, streamToken, queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncModuleToggles = (event: StorageEvent) => {
      if (event.key === clientModuleTogglesKey()) setModuleTogglesState(readStoredModuleToggles());
    };
    window.addEventListener("storage", syncModuleToggles);
    return () => window.removeEventListener("storage", syncModuleToggles);
  }, []);

  function setModuleToggles(nextToggles: ModuleToggles) {
    const normalized = normalizeModuleToggles(nextToggles, moduleToggles);
    setModuleTogglesState(normalized);
    writeStoredModuleToggles(normalized);
  }

  return {
    data,
    dashboardUrl,
    mode: !dashboardUrl
      ? "mock"
      : query.isError
        ? "fallback"
        : query.isLoading
          ? "connecting"
          : "live",
    error: query.error,
    setModuleToggles,
  } as const;
}

function readStoredModuleToggles(): ModuleToggles {
  if (typeof window === "undefined") return DEFAULT_MODULE_TOGGLES;
  try {
    return normalizeModuleToggles(
      JSON.parse(window.localStorage.getItem(clientModuleTogglesKey()) || "{}"),
      DEFAULT_MODULE_TOGGLES,
    );
  } catch {
    return DEFAULT_MODULE_TOGGLES;
  }
}

function writeStoredModuleToggles(toggles: ModuleToggles) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(clientModuleTogglesKey(), JSON.stringify(toggles));
}

function clientModuleTogglesKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${CLIENT_MODULE_TOGGLES_KEY}:${email}` : CLIENT_MODULE_TOGGLES_KEY;
}

function normalizeModuleToggles(value: unknown, fallback: ModuleToggles): ModuleToggles {
  const record = readRecord(value);
  return {
    tieAlert: readOptionalBoolean(record.tieAlert) ?? fallback.tieAlert,
    surfAnalyzer: readOptionalBoolean(record.surfAnalyzer) ?? fallback.surfAnalyzer,
  };
}

function normalizeDashboardData(payload: unknown): DashboardData {
  const data = readRecord(payload) as unknown as DashboardData;
  const currentSignal = normalizeCurrentSignal(data.currentSignal, data.lastSignalResult);
  const lastSignalResult = data.lastSignalResult ?? currentSignal.lastResult ?? null;
  const neuralReading =
    data.neuralReading ??
    (data as unknown as Record<string, unknown>).neural_reading ??
    (data as unknown as Record<string, unknown>).numeroPagante ??
    (data as unknown as Record<string, unknown>).numero_pagante;
  const neuralScoreboard =
    data.neuralScoreboard ??
    (data as unknown as Record<string, unknown>).neural_scoreboard ??
    (data as unknown as Record<string, unknown>).paganteScoreboard ??
    (data as unknown as Record<string, unknown>).pagante_scoreboard ??
    (data as unknown as Record<string, unknown>).neuralStats ??
    (data as unknown as Record<string, unknown>).neural_stats;
  const normalizedNeuralReading = normalizeNeuralReading(neuralReading, data.neuralReading);
  const normalizedData = {
    ...data,
    currentSignal,
    lastSignalResult,
    neuralReading: normalizedNeuralReading,
  };
  const displayState = normalizeDisplayState((data as unknown as Record<string, unknown>).displayState) ??
    deriveDashboardDisplayState(normalizedData);
  const displaySide = normalizeDisplaySide((data as unknown as Record<string, unknown>).displaySide) ??
    deriveDashboardDisplaySide(normalizedData);

  return {
    ...data,
    revision: readOptionalNumber((data as unknown as Record<string, unknown>).revision) ?? data.revision ?? 0,
    sequenceId: readOptionalNumber((data as unknown as Record<string, unknown>).sequenceId) ?? data.sequenceId ?? 0,
    currentSignal,
    lastSignalResult,
    displayState,
    displaySide,
    displayRoundId:
      normalizeDisplayRoundId((data as unknown as Record<string, unknown>).displayRoundId) ??
      data.rounds?.at(-1)?.id ??
      null,
    monthlyTieStats: data.monthlyTieStats ?? data.tieRadarHistory,
    dailyResultsByModule: normalizeFrontendDailyResultsByModule(data.dailyResultsByModule, dashboardDayKey(data)),
    ...applyNeuralScoreBaseline(
      normalizedNeuralReading,
      normalizeNeuralScoreboard(neuralScoreboard, data.neuralScoreboard),
      dashboardDayKey(data),
    ),
  };
}

function normalizeDisplayState(value: unknown): DashboardDisplayState | null {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (
    text === "analyzing" ||
    text === "monitoring" ||
    text === "entry_confirmed" ||
    text === "waiting_result" ||
    text === "result_green" ||
    text === "result_red" ||
    text === "result_tie" ||
    text === "expired"
  ) {
    return text as DashboardDisplayState;
  }
  return null;
}

function normalizeDisplaySide(value: unknown): CurrentSignalSide | null {
  const side = normalizeNeuralSide(value);
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") return side;
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "NONE" || text === "WAITING" || text === "AGUARDAR") return "NONE";
  return null;
}

function normalizeDisplayRoundId(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  return text ? text : null;
}

function deriveDashboardDisplayState(
  data: Pick<
    DashboardData,
    "currentSignal" | "lastSignalResult" | "neuralEntryState" | "neuralEntryLastResult" | "neuralReading"
  >,
): DashboardDisplayState {
  const signal = data.currentSignal;
  if (signal?.status === "green" || signal?.status === "green_g1") return "result_green";
  if (signal?.status === "red") return "result_red";
  if (signal?.status === "tie") return "result_tie";

  const entryResult = data.neuralEntryLastResult;
  if (entryResult && isRecentDisplayResult(entryResult.finishedAt)) {
    if (entryResult.outcome === "RED") return "result_red";
    if (entryResult.outcome === "TIE") return "result_tie";
    return "result_green";
  }

  if (signal?.side && signal.side !== "NONE" && signal.status === "g1") return "waiting_result";
  if (signal?.side && signal.side !== "NONE" && signal.status === "pending") return "entry_confirmed";
  if (data.neuralEntryState?.expectedSide) {
    return data.neuralEntryState.status === "awaiting_g1" ? "waiting_result" : "entry_confirmed";
  }
  const neuralCycleStatus = String(data.neuralReading?.cycleStatus || "").toUpperCase();
  const neuralCycleSide = normalizeActiveDisplaySide(data.neuralReading?.targetSide);
  if (neuralCycleSide && (neuralCycleStatus === "AGUARDANDO_RESULTADO" || neuralCycleStatus === "AGUARDANDO_G1")) {
    return neuralCycleStatus === "AGUARDANDO_G1" ? "waiting_result" : "entry_confirmed";
  }
  if (data.neuralReading?.mode === "ACTIVE" && (data.neuralReading.direcao || data.neuralReading.origem)) {
    return "entry_confirmed";
  }
  if (data.neuralReading?.mode === "OBSERVING") return "monitoring";
  return "analyzing";
}

function deriveDashboardDisplaySide(
  data: Pick<DashboardData, "currentSignal" | "neuralEntryState" | "neuralEntryLastResult" | "neuralReading">,
): CurrentSignalSide {
  return (
    normalizeActiveDisplaySide(data.currentSignal?.side) ??
    normalizeActiveDisplaySide(data.neuralEntryState?.expectedSide) ??
    normalizeActiveDisplaySide(data.neuralEntryLastResult?.expectedSide) ??
    normalizeActiveDisplaySide(data.neuralReading?.targetSide) ??
    normalizeActiveDisplaySide(data.neuralReading?.direcao) ??
    normalizeActiveDisplaySide(data.neuralReading?.origem) ??
    "NONE"
  );
}

function normalizeActiveDisplaySide(value: unknown): CurrentSignalSide | null {
  const side = normalizeDisplaySide(value);
  return side && side !== "NONE" ? side : null;
}

function isRecentDisplayResult(finishedAt?: string | null) {
  const time = Date.parse(String(finishedAt || ""));
  if (!Number.isFinite(time)) return false;
  const age = Date.now() - time;
  return age >= -5_000 && age <= 1_500;
}

function normalizeCurrentSignal(
  signal: DashboardData["currentSignal"],
  lastSignalResult?: DashboardData["lastSignalResult"] | null,
): DashboardData["currentSignal"] {
  const fallback = CONNECTING_DASHBOARD_DATA.currentSignal;
  const raw = signal ?? fallback;
  const terminal = raw.status === "green" || raw.status === "green_g1" || raw.status === "red" || raw.status === "tie";
  const result = raw.lastResult ?? lastSignalResult ?? null;

  if (terminal && result) {
    return {
      ...raw,
      lastResult: result,
    };
  }

  if (raw.side === "NONE" || raw.status === "waiting") {
    return {
      ...raw,
      side: "NONE",
      status: "waiting",
      protection: raw.protection || "-",
      strength: Number.isFinite(Number(raw.strength)) ? raw.strength : 0,
      lastResult: result,
    };
  }

  return {
    ...raw,
    lastResult: null,
  };
}

function dashboardRevisionKey(data: DashboardData) {
  if (data.revision !== undefined && data.revision !== null) return data.revision;
  if (data.sequenceId !== undefined && data.sequenceId !== null) return data.sequenceId;
  return data.updatedAt ?? "";
}

function isDashboardSnapshotFreshEnough(next: DashboardData, current?: DashboardData) {
  if (!current || current.mockMode) return true;
  if (next.mockMode) return false;

  const nextFreshness = dashboardFreshness(next);
  const currentFreshness = dashboardFreshness(current);

  // The result timestamp is the authoritative ordering signal and also handles
  // a table/session round-id reset. Numeric revisions are local to an edge
  // isolate and therefore are only a final tiebreaker.
  if (
    nextFreshness.roundRecordedAt >= 0 &&
    currentFreshness.roundRecordedAt >= 0 &&
    nextFreshness.roundRecordedAt !== currentFreshness.roundRecordedAt
  ) {
    return nextFreshness.roundRecordedAt >= currentFreshness.roundRecordedAt;
  }
  if (nextFreshness.roundId !== currentFreshness.roundId) {
    return nextFreshness.roundId >= currentFreshness.roundId;
  }
  if (nextFreshness.updatedAt !== currentFreshness.updatedAt) {
    return nextFreshness.updatedAt >= currentFreshness.updatedAt;
  }
  return nextFreshness.revision >= currentFreshness.revision;
}

function mergePersistentDashboardSnapshot(
  current: DashboardData | undefined,
  next: DashboardData,
): DashboardData {
  if (!current || current.mockMode || next.mockMode) return next;
  const nextDayKey = dashboardDayKey(next);
  const currentDayKey = dashboardDayKey(current);
  const nextMonthKey = nextDayKey.slice(0, 7);
  const currentMonthKey = currentDayKey.slice(0, 7);
  const nextDaily = normalizeFrontendDailyResultsByModule(next.dailyResultsByModule, nextDayKey);
  const currentDaily = normalizeFrontendDailyResultsByModule(current.dailyResultsByModule, nextDayKey);
  const mergedDaily =
    nextDayKey === currentDayKey
      ? mergeFrontendDailyResultsByModule(currentDaily, nextDaily, nextDayKey)
      : nextDaily;
  const nextMonthlyTieStats = next.monthlyTieStats ?? next.tieRadarHistory;
  const currentMonthlyTieStats = current.monthlyTieStats ?? current.tieRadarHistory;
  const shouldKeepCurrentTieStats =
    nextMonthKey === currentMonthKey &&
    !tieHistoryHasCurrentMonthStats(nextMonthlyTieStats, nextMonthKey) &&
    tieHistoryHasCurrentMonthStats(currentMonthlyTieStats, nextMonthKey);

  return {
    ...next,
    dailyResultsByModule: mergedDaily,
    monthlyTieStats: shouldKeepCurrentTieStats ? currentMonthlyTieStats : nextMonthlyTieStats,
    tieRadarHistory:
      shouldKeepCurrentTieStats && !tieHistoryHasCurrentMonthStats(next.tieRadarHistory, nextMonthKey)
        ? currentMonthlyTieStats
        : next.tieRadarHistory,
  };
}

function normalizeFrontendDailyResultsByModule(
  value: unknown,
  dayKey: string,
): DashboardDailyResultsByModule {
  const record = readRecord(value);
  const normalized: DashboardDailyResultsByModule = {};
  for (const [moduleKey, rows] of Object.entries(record)) {
    if (!Array.isArray(rows)) continue;
    const moduleRows = rows
      .map((row) => normalizeFrontendPersistentResult(row, moduleKey, dayKey))
      .filter((row): row is DashboardPersistentResult => Boolean(row));
    if (moduleRows.length) normalized[moduleKey] = moduleRows;
  }
  return {
    LEITURA_NEURAL_NUMERO_PAGANTE: normalized.LEITURA_NEURAL_NUMERO_PAGANTE ?? [],
    SURF_ANALYZER: normalized.SURF_ANALYZER ?? [],
    PADROES_IA: normalized.PADROES_IA ?? [],
    ...normalized,
  };
}

function mergeFrontendDailyResultsByModule(
  current: DashboardDailyResultsByModule,
  next: DashboardDailyResultsByModule,
  dayKey: string,
): DashboardDailyResultsByModule {
  const merged: DashboardDailyResultsByModule = {};
  for (const source of [current, next]) {
    for (const [moduleKey, rows] of Object.entries(source)) {
      if (!Array.isArray(rows)) continue;
      const byKey = new Map((merged[moduleKey] ?? []).map((row) => [frontendPersistentDedupeKey(row), row]));
      for (const row of rows) {
        if (row.dayKey !== dayKey) continue;
        const key = frontendPersistentDedupeKey(row);
        const existing = byKey.get(key);
        byKey.set(key, preferredFrontendPersistentResult(existing, row));
      }
      merged[moduleKey] = [...byKey.values()].sort(
        (a, b) => Date.parse(b.createdAt || "") - Date.parse(a.createdAt || ""),
      );
    }
  }
  return normalizeFrontendDailyResultsByModule(merged, dayKey);
}

function normalizeFrontendPersistentResult(
  value: unknown,
  fallbackModuleKey: string,
  fallbackDayKey: string,
): DashboardPersistentResult | null {
  const record = readRecord(value);
  const createdAt = readOptionalString(firstDefined(record.createdAt, record.closedAt, record.finishedAt)) || new Date().toISOString();
  const dayKey = readOptionalString(record.dayKey) || localDayKey(createdAt) || fallbackDayKey;
  if (dayKey !== fallbackDayKey) return null;
  const moduleKey = readOptionalString(firstDefined(record.moduleKey, record.module)) || fallbackModuleKey;
  const resultType = readOptionalString(firstDefined(record.resultType, record.result, record.outcome, record.kind));
  if (!moduleKey || !resultType) return null;
  const roundId = firstDefined(record.roundId, record.closedRoundId, record.resultRoundKey, record.entryRoundId);
  const signalId = readOptionalString(firstDefined(record.signalId, record.signal_id)) || null;
  const resultId =
    readOptionalString(firstDefined(record.resultId, record.cycleId, record.id)) ||
    [moduleKey, signalId ?? "", String(roundId ?? ""), resultType, readOptionalString(record.attempt) ?? ""].join(":");
  return {
    moduleKey,
    dayKey,
    monthKey: readOptionalString(record.monthKey) || dayKey.slice(0, 7),
    signalId,
    resultId,
    roundId: typeof roundId === "number" || typeof roundId === "string" ? roundId : null,
    resultType,
    side: normalizeDisplaySide(firstDefined(record.side, record.technicalSide, record.expectedSide, record.targetSide)),
    attempt: readOptionalString(record.attempt),
    tieMultiplier: firstDefined(record.tieMultiplier, record.tie_multiplier) as string | number | null | undefined,
    createdAt,
    displayTimeBR: readOptionalString(record.displayTimeBR) || formatFrontendDisplayTimeBR(createdAt),
    label: readOptionalString(record.label) || resultType,
    payload: readRecord(record.payload),
  };
}

function frontendPersistentDedupeKey(row: DashboardPersistentResult) {
  if (
    row.moduleKey === "LEITURA_NEURAL_NUMERO_PAGANTE" &&
    (row.signalId || (row.roundId !== null && row.roundId !== undefined))
  ) {
    const resultType = String(row.resultType || "").trim().toUpperCase();
    const resultFamily =
      resultType === "GREEN" || resultType === "GREEN_G1"
        ? "GREEN"
        : resultType === "EMPATE" || resultType === "EMPATE_G1"
          ? "EMPATE"
          : resultType;
    return [row.moduleKey, row.dayKey ?? "", row.signalId ?? "", row.roundId ?? "", resultFamily].join(":");
  }
  return [
    row.moduleKey,
    row.dayKey ?? "",
    row.resultId,
    row.signalId ?? "",
    row.roundId ?? "",
    row.resultType,
    row.attempt ?? "",
  ].join(":");
}

function preferredFrontendPersistentResult(
  current: DashboardPersistentResult | undefined,
  candidate: DashboardPersistentResult,
) {
  if (!current) return candidate;
  const specificity = (row: DashboardPersistentResult) => {
    const type = String(row.resultType || "").trim().toUpperCase();
    let score = type === "GREEN_G1" || type === "EMPATE_G1" ? 4 : 0;
    if (String(row.attempt || "").toUpperCase() === "G1") score += 2;
    if (row.tieMultiplier !== null && row.tieMultiplier !== undefined && row.tieMultiplier !== "") score += 1;
    return score;
  };
  const currentRank = specificity(current);
  const candidateRank = specificity(candidate);
  if (candidateRank !== currentRank) return candidateRank > currentRank ? candidate : current;
  const currentTime = Date.parse(current.createdAt || "");
  const candidateTime = Date.parse(candidate.createdAt || "");
  if (Number.isFinite(candidateTime) && (!Number.isFinite(currentTime) || candidateTime > currentTime)) {
    return candidate;
  }
  return current;
}

function tieHistoryHasCurrentMonthStats(history: DashboardData["tieRadarHistory"], monthKey: string) {
  if (!history) return false;
  return history.monthly?.key === monthKey || history.recent?.some((item) => item.monthKey === monthKey);
}

function formatFrontendDisplayTimeBR(value: unknown) {
  const date = new Date(String(value || ""));
  if (!Number.isFinite(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dashboardFreshness(data: DashboardData) {
  const latestRound = Array.isArray(data.rounds) ? data.rounds.at(-1) : undefined;
  return {
    roundId: safeFreshnessNumber(latestRound?.id),
    roundRecordedAt: safeFreshnessTimestamp(latestRound?.recordedAt),
    revision: safeFreshnessNumber(data.revision ?? data.sequenceId),
    updatedAt: safeFreshnessTimestamp(data.updatedAt),
  };
}

function safeFreshnessNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : -1;
}

function safeFreshnessTimestamp(value: unknown) {
  const time = Date.parse(String(value || ""));
  return Number.isFinite(time) ? time : -1;
}

function normalizeNeuralScoreboard(
  value: unknown,
  fallback?: NeuralScoreboard,
): NeuralScoreboard | undefined {
  const record = readRecord(value);
  if (!Object.keys(record).length && !fallback) return undefined;

  const greenG1 = readOptionalNumber(
    firstDefined(
      record.greenG1,
      record.green_g1,
      record.greensG1,
      record.greens_g1,
      record.g1,
      record.greenGale1,
      record.green_gale_1,
      fallback?.greenG1,
    ),
  );
  const greenSemGale = readOptionalNumber(
    firstDefined(
      record.greenSemGale,
      record.green_sem_gale,
      record.greenSG,
      record.green_sg,
      record.sg,
      record.greensSemGale,
      record.greens_sem_gale,
      greenG1 !== null ? record.greens : undefined,
      fallback?.greenSemGale,
    ),
  );
  const splitGreens =
    greenSemGale !== null || greenG1 !== null
      ? numberOrZero(greenSemGale) + numberOrZero(greenG1)
      : undefined;
  const sequencePositive =
    readOptionalNumber(
      firstDefined(
        record.sequencePositive,
        record.sequence_positive,
        record.currentGreenSequence,
        record.current_green_sequence,
        fallback?.sequencePositive,
      ),
    ) ?? 0;
  const sequenceNegative =
    readOptionalNumber(
      firstDefined(
        record.sequenceNegative,
        record.sequence_negative,
        record.currentRedSequence,
        record.current_red_sequence,
        fallback?.sequenceNegative,
      ),
    ) ?? 0;
  const maxSequencePositive =
    readOptionalNumber(
      firstDefined(
        record.maxSequencePositive,
        record.max_sequence_positive,
        record.bestGreenSequence,
        record.best_green_sequence,
        record.maxGreenSequence,
        record.max_green_sequence,
        fallback?.maxSequencePositive,
      ),
    ) ?? 0;
  const maxSequenceNegative =
    readOptionalNumber(
      firstDefined(
        record.maxSequenceNegative,
        record.max_sequence_negative,
        record.bestRedSequence,
        record.best_red_sequence,
        record.maxRedSequence,
        record.max_red_sequence,
        fallback?.maxSequenceNegative,
      ),
    ) ?? 0;

  return {
    ...fallback,
    totalAlerts:
      readOptionalNumber(
        firstDefined(record.totalAlerts, record.total_alerts, record.alertas, record.alerts),
      ) ?? fallback?.totalAlerts ?? null,
    acertos:
      readOptionalNumber(
        firstDefined(
          record.acertos,
          record.hits,
          record.greens,
          record.totalGreens,
          record.total_greens,
          splitGreens,
        ),
      ) ?? fallback?.acertos ?? null,
    greens:
      readOptionalNumber(
        firstDefined(record.greens, record.totalGreens, record.total_greens, splitGreens),
      ) ?? fallback?.greens ?? null,
    greenSemGale,
    greenG1,
    erros:
      readOptionalNumber(
        firstDefined(record.erros, record.reds, record.red, record.fails, record.losses),
      ) ?? fallback?.erros ?? null,
    reds:
      readOptionalNumber(
        firstDefined(record.reds, record.red, record.erros, record.fails, record.losses),
      ) ?? fallback?.reds ?? null,
    assertividade:
      readOptionalNumber(
        firstDefined(
          record.assertividade,
          record.assertiveness,
          record.accuracy,
          record.porcentagem,
          record.percentual,
          record.percent,
          record.winRate,
          record.win_rate,
        ),
      ) ?? fallback?.assertividade ?? null,
    sequencePositive,
    sequenceNegative,
    maxSequencePositive: Math.max(maxSequencePositive, sequencePositive),
    maxSequenceNegative: Math.max(maxSequenceNegative, sequenceNegative),
  };
}

function normalizeNeuralReading(value: unknown, fallback?: NeuralReading): NeuralReading {
  const record = readRecord(value);
  const rawG1 = readOptionalNumber(
    firstDefined(
      record.greenG1,
      record.green_g1,
      record.greensG1,
      record.greens_g1,
      record.g1,
      record.greenGale1,
      record.green_gale_1,
    ),
  );
  const rawSg = readOptionalNumber(
    firstDefined(
      record.greenSemGale,
      record.green_sem_gale,
      record.greenSG,
      record.green_sg,
      record.sg,
      record.greenSemGaleCount,
      record.greensSemGale,
      record.greens_sem_gale,
      rawG1 !== null ? record.greens : undefined,
    ),
  );
  const splitTotal =
    rawSg !== null || rawG1 !== null ? numberOrZero(rawSg) + numberOrZero(rawG1) : undefined;
  const sequencePositive =
    readOptionalNumber(
      firstDefined(
        record.sequencePositive,
        record.sequence_positive,
        record.currentGreenSequence,
        record.current_green_sequence,
        fallback?.sequencePositive,
      ),
    ) ?? 0;
  const sequenceNegative =
    readOptionalNumber(
      firstDefined(
        record.sequenceNegative,
        record.sequence_negative,
        record.currentRedSequence,
        record.current_red_sequence,
        fallback?.sequenceNegative,
      ),
    ) ?? 0;
  const maxSequencePositive =
    readOptionalNumber(
      firstDefined(
        record.maxSequencePositive,
        record.max_sequence_positive,
        record.bestGreenSequence,
        record.best_green_sequence,
        record.maxGreenSequence,
        record.max_green_sequence,
        fallback?.maxSequencePositive,
      ),
    ) ?? 0;
  const maxSequenceNegative =
    readOptionalNumber(
      firstDefined(
        record.maxSequenceNegative,
        record.max_sequence_negative,
        record.bestRedSequence,
        record.best_red_sequence,
        record.maxRedSequence,
        record.max_red_sequence,
        fallback?.maxSequenceNegative,
      ),
    ) ?? 0;

  return {
    ...(fallback ?? { mode: "SCANNING" }),
    ...record,
    mode: normalizeNeuralMode(firstDefined(record.mode, record.status, fallback?.mode)),
    numero:
      readOptionalNumber(
        firstDefined(record.numero, record.number, record.numero_pagante, record.payingNumber),
      ) ??
      fallback?.numero ??
      null,
    origem:
      normalizeNeuralSide(
        firstDefined(record.origem, record.source, record.side, record.lado, record.numberSide),
      ) ??
      fallback?.origem ??
      null,
    origemTipo:
      normalizeNeuralOriginKind(
        firstDefined(
          record.origemTipo,
          record.origem_tipo,
          record.triggerKind,
          record.trigger_kind,
          record.originKind,
          record.origin_kind,
          record.paganteKind,
          record.pagante_kind,
        ),
      ) ??
      fallback?.origemTipo ??
      null,
    direcao:
      normalizeNeuralSide(
        firstDefined(
          record.direcao,
          record.direction,
          record.puxando,
          record.pulling,
          record.pullSide,
          record.targetSide,
          record.entrySide,
          record.prediction,
          record.previsao,
        ),
      ) ??
      fallback?.direcao ??
      null,
    validade: String(
      firstDefined(record.validade, record.validity, record.gale, fallback?.validade) ?? "G1",
    ),
    alertas:
      readOptionalNumber(
        firstDefined(record.alertas, record.alerts, record.totalAlerts, record.total_alerts),
      ) ??
      fallback?.alertas ??
      null,
    acertos:
      readOptionalNumber(
        firstDefined(
          record.acertos,
          record.hits,
          record.totalGreens,
          record.total_greens,
          record.greensTotal,
          record.greens_total,
          splitTotal,
          record.greens,
        ),
      ) ??
      fallback?.acertos ??
      null,
    greenSemGale: rawSg ?? fallback?.greenSemGale ?? null,
    greenG1: rawG1 ?? fallback?.greenG1 ?? null,
    erros:
      readOptionalNumber(
        firstDefined(
          record.erros,
          record.reds,
          record.red,
          record.redCount,
          record.red_count,
          record.fails,
          record.losses,
        ),
      ) ??
      fallback?.erros ??
      null,
    reds:
      readOptionalNumber(
        firstDefined(
          record.reds,
          record.red,
          record.redCount,
          record.red_count,
          record.erros,
          record.fails,
          record.losses,
        ),
      ) ??
      fallback?.reds ??
      null,
    assertividade:
      readOptionalNumber(
        firstDefined(
          record.assertividade,
          record.assertiveness,
          record.accuracy,
          record.porcentagem,
          record.percentual,
          record.percent,
          record.winRate,
          record.win_rate,
        ),
      ) ??
      fallback?.assertividade ??
      null,
    sequencePositive,
    sequenceNegative,
    maxSequencePositive: Math.max(maxSequencePositive, sequencePositive),
    maxSequenceNegative: Math.max(maxSequenceNegative, sequenceNegative),
    paganteStatus:
      readOptionalString(
        firstDefined(record.paganteStatus, record.pagante_status, record.statusPagante),
      ) ??
      fallback?.paganteStatus ??
      null,
    paganteAlert:
      readOptionalString(firstDefined(record.paganteAlert, record.pagante_alert, record.alert)) ??
      fallback?.paganteAlert ??
      null,
    paganteWindow:
      readOptionalNumber(
        firstDefined(record.paganteWindow, record.pagante_window, record.window),
      ) ??
      fallback?.paganteWindow ??
      null,
    paganteCycleProgress:
      readOptionalNumber(
        firstDefined(
          record.paganteCycleProgress,
          record.pagante_cycle_progress,
          record.cycleProgress,
          record.cycle_progress,
        ),
      ) ??
      fallback?.paganteCycleProgress ??
      null,
    paganteCycleLimit:
      readOptionalNumber(
        firstDefined(
          record.paganteCycleLimit,
          record.pagante_cycle_limit,
          record.cycleLimit,
          record.cycle_limit,
        ),
      ) ??
      fallback?.paganteCycleLimit ??
      null,
    isSaturated:
      readOptionalBoolean(firstDefined(record.isSaturated, record.is_saturated)) ??
      fallback?.isSaturated ??
      null,
    isRedAlert:
      readOptionalBoolean(firstDefined(record.isRedAlert, record.is_red_alert)) ??
      fallback?.isRedAlert ??
      null,
    postTie:
      readOptionalBoolean(firstDefined(record.postTie, record.post_tie)) ??
      fallback?.postTie ??
      null,
  };
}

function normalizeNeuralMode(value: unknown): NeuralReading["mode"] {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["ACTIVE", "ATIVO", "VALIDO", "VALID"].includes(text)) return "ACTIVE";
  if (["OBSERVING", "OBSERVACAO", "OBSERVANDO"].includes(text)) return "OBSERVING";
  return "SCANNING";
}

function normalizeNeuralSide(value: unknown): NeuralReading["origem"] {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return null;
}

function normalizeNeuralOriginKind(value: unknown): NeuralReading["origemTipo"] {
  const text = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!text) return null;
  if (["PAGANTE", "PAGANTE_REAL", "WINNER", "WINNING", "VENCEDOR"].includes(text)) return "PAGANTE";
  if (
    [
      "OPOSTO",
      "OPPOSITE",
      "LOSER",
      "LOSING",
      "PERDEDOR",
      "CONTRA",
      "NEGATIVE",
      "NEGATIVO",
    ].includes(text)
  ) {
    return "OPOSTO";
  }
  if (["TIE", "EMPATE", "POS_EMPATE", "POST_TIE"].includes(text)) return "TIE";
  return null;
}

function firstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function readOptionalString(value: unknown) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function readOptionalBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "sim"].includes(text)) return true;
  if (["false", "0", "no", "nao", "não"].includes(text)) return false;
  return null;
}

function numberOrZero(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

interface NeuralLiveSequence {
  day: string;
  greens: number;
  reds: number;
  sequencePositive: number;
  sequenceNegative: number;
  maxSequencePositive: number;
  maxSequenceNegative: number;
  lastOutcome: "GREEN" | "RED" | null;
}

function applyNeuralScoreBaseline(
  reading: NeuralReading,
  scoreboard: NeuralScoreboard | undefined,
  _day: string,
): Pick<DashboardData, "neuralReading" | "neuralScoreboard"> {
  const generalScore = neuralScoreFrom(reading, scoreboard);
  const numberScore = neuralScoreFrom(reading);
  const greenSemGale = generalScore.greenSemGale;
  const greenG1 = generalScore.greenG1;
  const acertos = generalScore.acertos;
  const reds = generalScore.reds;
  const erros = generalScore.erros;
  const alertas = generalScore.alertas;
  const totalGreens = greenSemGale + greenG1 || acertos;
  const totalLosses = reds || erros;
  const total = totalGreens + totalLosses;
  const numberGreenSemGale = numberScore.greenSemGale;
  const numberGreenG1 = numberScore.greenG1;
  const numberAcertos = numberScore.acertos;
  const numberReds = numberScore.reds;
  const numberErros = numberScore.erros;
  const numberAlertas = numberScore.alertas;
  const numberTotalGreens = numberGreenSemGale + numberGreenG1 || numberAcertos;
  const numberTotalLosses = numberReds || numberErros;
  const numberTotal = numberTotalGreens + numberTotalLosses;
  const generalSequence = currentNeuralSequence(reading, scoreboard);
  const numberSequence = currentNeuralSequence(reading);
  const sequencePositive = generalSequence.sequencePositive;
  const sequenceNegative = generalSequence.sequenceNegative;
  const maxSequencePositive = generalSequence.maxSequencePositive;
  const maxSequenceNegative = generalSequence.maxSequenceNegative;

  const neuralReading = {
    ...reading,
    alertas: Math.max(numberAlertas, numberTotal),
    acertos: numberTotalGreens,
    greenSemGale: numberGreenSemGale,
    greenG1: numberGreenG1,
    erros: numberTotalLosses,
    reds: numberTotalLosses,
    assertividade: calculateMotorAssertiveness(numberTotalGreens, numberTotalLosses),
    sequencePositive: numberSequence.sequencePositive,
    sequenceNegative: numberSequence.sequenceNegative,
    maxSequencePositive: numberSequence.maxSequencePositive,
    maxSequenceNegative: numberSequence.maxSequenceNegative,
  };
  return {
    neuralReading,
    neuralScoreboard: {
      ...scoreboard,
      totalAlerts: Math.max(alertas, total),
      acertos: totalGreens,
      greens: totalGreens,
      greenSemGale,
      greenG1,
      erros: totalLosses,
      reds: totalLosses,
      assertividade: calculateMotorAssertiveness(totalGreens, totalLosses),
      sequencePositive,
      sequenceNegative,
      maxSequencePositive: Math.max(maxSequencePositive, sequencePositive),
      maxSequenceNegative: Math.max(maxSequenceNegative, sequenceNegative),
    },
  };
}

function currentNeuralSequence(
  reading: NeuralReading,
  scoreboard?: NeuralScoreboard,
): Pick<
  NeuralLiveSequence,
  "sequencePositive" | "sequenceNegative" | "maxSequencePositive" | "maxSequenceNegative"
> {
  const scoreboardPositive = safeCounter(scoreboard?.sequencePositive);
  const scoreboardNegative = safeCounter(scoreboard?.sequenceNegative);
  const readingPositive = safeCounter(reading.sequencePositive);
  const readingNegative = safeCounter(reading.sequenceNegative);
  const hasReadingCurrent = readingPositive > 0 || readingNegative > 0;
  const sequencePositive = hasReadingCurrent ? readingPositive : scoreboardPositive;
  const sequenceNegative = hasReadingCurrent ? readingNegative : scoreboardNegative;

  return {
    sequencePositive,
    sequenceNegative,
    maxSequencePositive: Math.max(
      safeCounter(scoreboard?.maxSequencePositive),
      safeCounter(reading.maxSequencePositive),
      sequencePositive,
    ),
    maxSequenceNegative: Math.max(
      safeCounter(scoreboard?.maxSequenceNegative),
      safeCounter(reading.maxSequenceNegative),
      sequenceNegative,
    ),
  };
}

function neuralScoreFrom(reading: NeuralReading, scoreboard?: NeuralScoreboard) {
  const greenSemGale = safeCounter(scoreboard?.greenSemGale ?? reading.greenSemGale);
  const greenG1 = safeCounter(scoreboard?.greenG1 ?? reading.greenG1);
  const acertos = safeCounter(scoreboard?.acertos ?? scoreboard?.greens ?? reading.acertos ?? greenSemGale + greenG1);
  const reds = safeCounter(scoreboard?.reds ?? scoreboard?.erros ?? reading.reds ?? reading.erros);
  const erros = safeCounter(scoreboard?.erros ?? scoreboard?.reds ?? reading.erros ?? reading.reds);
  const alertas = safeCounter(scoreboard?.totalAlerts ?? reading.alertas ?? acertos + erros);
  return { alertas, acertos, greenSemGale, greenG1, erros, reds };
}

function dashboardDayKey(data: DashboardData) {
  const record = data as unknown as Record<string, unknown>;
  const explicit = readOptionalString(firstDefined(record.dailyCycleDate, record.cycleDate));
  if (explicit && /^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const updatedAt = readOptionalString(data.updatedAt);
  if (updatedAt) return localDayKey(updatedAt);
  return localDayKey(new Date().toISOString());
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

function safeCounter(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
