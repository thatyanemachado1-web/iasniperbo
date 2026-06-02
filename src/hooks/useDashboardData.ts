import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import { useEffect, useMemo, useState } from "react";
import type {
  ActiveEntryMode,
  CurrentSignalSide,
  DashboardData,
  EntryMode,
  EntryModeStats,
  ModuleToggles,
  NeuralReading,
  SignalSide,
} from "@/types/dashboard";

const LIVE_REFETCH_INTERVAL_MS = 1_500;
const ENTRY_MODE_KEY = "sniper_entry_mode";
const ENTRY_MODE_COUNTERS_KEY = "sniper_entry_mode_counters_v3";
const CLIENT_MODULE_TOGGLES_KEY = "sniper_client_module_toggles";
const LEGACY_ENTRY_MODE_COUNTERS_KEYS = [
  "sniper_entry_mode_counters",
  "sniper_entry_mode_counters_v2",
];
const DEFAULT_ENTRY_MODE: EntryMode = "hunter";
const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
const ALLOWED_REMOTE_API_HOSTS = new Set([
  "sniperbo.com",
  "www.sniperbo.com",
]);
const ACTIVE_ENTRY_MODES = ["sniper", "hunter", "aggressive"] as const satisfies readonly ActiveEntryMode[];

type StoredEntryModeCounters = {
  stats: Partial<Record<ActiveEntryMode, EntryModeStats>>;
  signalModes: Record<string, ActiveEntryMode[]>;
  countedResults: Record<string, true>;
};

function configuredDashboardUrl() {
  const directUrl = import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined;
  if (directUrl) return directUrl;

  const apiBase = import.meta.env.VITE_SNIPER_API_URL as string | undefined;
  if (apiBase) return `${apiBase.replace(/\/+$/, "")}/dashboard`;

  if (typeof window !== "undefined") {
    // Only accept the ?sniper_api= override on local dev frontends.
    // In production this would allow an attacker to redirect API calls via a
    // crafted link, so it is disabled outside of localhost.
    if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
      const queryUrl = dashboardUrlFromQuery(window.location.search);
      if (queryUrl) {
        window.localStorage.setItem("sniper_admin_api_url", stripDashboardPath(queryUrl));
        return queryUrl;
      }
    }

    const savedAdminApi = window.localStorage.getItem("sniper_admin_api_url");
    if (savedAdminApi && isSameOriginApiBaseUrl(savedAdminApi)) {
      window.localStorage.removeItem("sniper_admin_api_url");
      return defaultDashboardUrl();
    }
    if (savedAdminApi && isAllowedApiBaseUrl(savedAdminApi)) return ensureDashboardPath(savedAdminApi);
    if (savedAdminApi) window.localStorage.removeItem("sniper_admin_api_url");
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
  if (["127.0.0.1", "localhost"].includes(parsed.hostname)) return true;
  if (typeof window !== "undefined" && parsed.hostname === window.location.hostname) return parsed.protocol === "https:";
  return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
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
  return `${window.location.origin}/dashboard`;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const url = configuredDashboardUrl();
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = adminSession?.token || userSession.clientToken;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return normalizeDashboardData(await response.json());
}

export function useDashboardData() {
  const dashboardUrl = configuredDashboardUrl();
  const [entryMode, setEntryModeState] = useState<EntryMode>(() => readStoredEntryMode());
  const [moduleToggles, setModuleTogglesState] = useState<ModuleToggles>(() => readStoredModuleToggles());
  const [entryModeStats, setEntryModeStats] = useState<Partial<Record<ActiveEntryMode, EntryModeStats>>>(() =>
    readStoredEntryModeCounters().stats,
  );
  const query = useQuery({
    queryKey: ["dashboard-data", dashboardUrl],
    queryFn: fetchDashboardData,
    enabled: Boolean(dashboardUrl) && typeof window !== "undefined",
    initialData: mockDashboardData,
    refetchInterval: dashboardUrl ? LIVE_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: true,
    retry: 1,
    staleTime: 0,
  });
  const data = useMemo(
    () => {
      const rawData = query.data ?? mockDashboardData;
      const statsData = {
        ...rawData,
        moduleToggles,
        entryModeStats: mergeEntryModeStats(rawData.entryModeStats, entryModeStats),
      };
      return applyEntryModePreference(statsData, entryMode);
    },
    [query.data, entryMode, entryModeStats, moduleToggles],
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncEntryMode = (event: StorageEvent) => {
      if (event.key === ENTRY_MODE_KEY) setEntryModeState(normalizeEntryMode(event.newValue));
      if (event.key === clientModuleTogglesKey()) setModuleTogglesState(readStoredModuleToggles());
    };
    window.addEventListener("storage", syncEntryMode);
    return () => window.removeEventListener("storage", syncEntryMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawData = query.data ?? mockDashboardData;
    const nextStats = trackEntryModeCounters(rawData);
    if (nextStats) setEntryModeStats(nextStats);
  }, [
    query.data?.currentSignal.id,
    query.data?.currentSignal.status,
    query.data?.currentSignal.side,
    query.data?.currentSignal.lastResult?.id,
    query.data?.currentSignal.lastResult?.status,
    query.data?.currentSignal.lastResult?.finishedAt,
  ]);

  function setEntryMode(nextMode: EntryMode) {
    const normalized = normalizeEntryMode(nextMode);
    setEntryModeState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(ENTRY_MODE_KEY, normalized);
    }
  }

  function setModuleToggles(nextToggles: ModuleToggles) {
    const normalized = normalizeModuleToggles(nextToggles, moduleToggles);
    setModuleTogglesState(normalized);
    writeStoredModuleToggles(normalized);
  }

  return {
    data,
    mode: !dashboardUrl ? "mock" : query.isError ? "fallback" : query.isLoading ? "connecting" : "live",
    error: query.error,
    entryMode,
    setEntryMode,
    setModuleToggles,
  } as const;
}

function readStoredEntryMode() {
  if (typeof window === "undefined") return DEFAULT_ENTRY_MODE;
  return normalizeEntryMode(window.localStorage.getItem(ENTRY_MODE_KEY));
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

function readStoredEntryModeCounters(): StoredEntryModeCounters {
  const emptyCounters: StoredEntryModeCounters = {
    stats: emptyEntryModeStatsByMode(),
    signalModes: {},
    countedResults: {},
  };
  if (typeof window === "undefined") return emptyCounters;

  try {
    for (const key of LEGACY_ENTRY_MODE_COUNTERS_KEYS) {
      window.localStorage.removeItem(key);
    }
    const stored = readRecord(JSON.parse(window.localStorage.getItem(ENTRY_MODE_COUNTERS_KEY) || "{}"));
    return {
      stats: normalizeEntryModeStatsByMode(stored.stats),
      signalModes: normalizeSignalModes(stored.signalModes),
      countedResults: normalizeCountedResults(stored.countedResults),
    };
  } catch {
    return emptyCounters;
  }
}

function writeStoredEntryModeCounters(counters: StoredEntryModeCounters) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ENTRY_MODE_COUNTERS_KEY, JSON.stringify(counters));
}

function trackEntryModeCounters(data: DashboardData) {
  const counters = readStoredEntryModeCounters();
  let changed = false;
  const signal = data.currentSignal;

  if (isEntrySide(signal.side) && signal.status === "pending") {
    const signalModes = modesThatWouldAcceptEntry(data);
    if (!sameModeList(counters.signalModes[signal.id], signalModes)) {
      counters.signalModes[signal.id] = signalModes;
      changed = true;
    }
  }

  const result = signal.lastResult;
  if (result) {
    const resultKey = entryModeResultKey(result);
    if (!counters.countedResults[resultKey]) {
      const resultModes = counters.signalModes[result.id] ?? [];
      if (resultModes.length > 0) {
        for (const resultMode of resultModes) {
          incrementEntryModeStats(counters.stats, resultMode, result);
        }
        counters.countedResults[resultKey] = true;
        changed = true;
      }
    }
  }

  if (!changed) return null;
  pruneEntryModeCounters(counters);
  writeStoredEntryModeCounters(counters);
  return counters.stats;
}

function modesThatWouldAcceptEntry(data: DashboardData) {
  return ACTIVE_ENTRY_MODES.filter((mode) => !buildEntryModeFilter(data, mode));
}

function sameModeList(left: ActiveEntryMode[] | undefined, right: ActiveEntryMode[]) {
  const safeLeft = left ?? [];
  if (safeLeft.length !== right.length) return false;
  return ACTIVE_ENTRY_MODES.every((mode) => safeLeft.includes(mode) === right.includes(mode));
}

function incrementEntryModeStats(
  statsByMode: Partial<Record<ActiveEntryMode, EntryModeStats>>,
  mode: ActiveEntryMode,
  result: NonNullable<DashboardData["currentSignal"]["lastResult"]>,
) {
  const current = normalizeEntryModeStatsRecord(statsByMode[mode]);
  const kind = readEntryModeResultKind(result);
  const sg = safeCounter(current.greenSemGale ?? current.sg ?? current.greens);
  const g1 = safeCounter(current.greenG1 ?? current.greensG1);
  const emp = safeCounter(current.emp ?? current.ties);
  const reds = safeCounter(current.reds);

  const nextSg = kind === "sg" ? sg + 1 : sg;
  const nextG1 = kind === "g1" ? g1 + 1 : g1;
  const nextEmp = kind === "emp" ? emp + 1 : emp;
  const nextReds = kind === "red" ? reds + 1 : reds;
  const totalGreens = nextSg + nextG1;
  const totalEntries = totalGreens + nextReds;

  statsByMode[mode] = {
    sg: nextSg,
    greens: nextSg,
    greenSemGale: nextSg,
    greenG1: nextG1,
    greensG1: nextG1,
    emp: nextEmp,
    ties: nextEmp,
    reds: nextReds,
    totalGreens,
    totalEntries,
    total: totalEntries + nextEmp,
    assertiveness: totalEntries > 0 ? Math.round((totalGreens / totalEntries) * 1000) / 10 : undefined,
  };
}

function readEntryModeResultKind(result: NonNullable<DashboardData["currentSignal"]["lastResult"]>) {
  const record = readRecord(result);
  const status = normalizeText(record.status);
  const side = normalizeText(record.side);
  const protection = normalizeText(record.protection);
  if (status.includes("TIE") || status.includes("EMPATE") || side === "TIE" || side === "EMPATE") return "emp";
  if (status.includes("RED")) return "red";
  if (status.includes("G1") || protection.includes("G1")) return "g1";
  return "sg";
}

function entryModeResultKey(result: NonNullable<DashboardData["currentSignal"]["lastResult"]>) {
  return [
    result.id,
    result.status,
    result.side,
    result.protection,
    result.finishedAt ?? "",
  ].join(":");
}

function pruneEntryModeCounters(counters: StoredEntryModeCounters) {
  const counted = Object.keys(counters.countedResults);
  if (counted.length > 300) {
    counters.countedResults = Object.fromEntries(counted.slice(-220).map((key) => [key, true]));
  }

  const signalIds = Object.keys(counters.signalModes);
  if (signalIds.length > 300) {
    counters.signalModes = Object.fromEntries(signalIds.slice(-220).map((key) => [key, counters.signalModes[key]]));
  }
}

function mergeEntryModeStats(
  remoteStats?: DashboardData["entryModeStats"],
  localStats?: Partial<Record<ActiveEntryMode, EntryModeStats>>,
): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  const merged: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    merged[mode] = hasEntryModeStats(remoteStats?.[mode])
      ? normalizeEntryModeStatsRecord(remoteStats?.[mode])
      : normalizeEntryModeStatsRecord(localStats?.[mode]);
  }
  return merged;
}

function normalizeEntryModeStatsByMode(value: unknown): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    stats[mode] = normalizeEntryModeStatsRecord(record[mode]);
  }
  return stats;
}

function normalizeEntryModeStatsRecord(value: unknown): EntryModeStats {
  const record = readRecord(value);
  const sg = readOptionalNumber(firstDefined(record.sg, record.greenSemGale, record.green_sem_gale, record.greens)) ?? 0;
  const g1 = readOptionalNumber(firstDefined(record.greenG1, record.green_g1, record.greensG1, record.greens_g1)) ?? 0;
  const emp = readOptionalNumber(firstDefined(record.emp, record.ties, record.tie, record.empates)) ?? 0;
  const reds = readOptionalNumber(firstDefined(record.reds, record.red, record.erros)) ?? 0;
  const totalGreens = readOptionalNumber(firstDefined(record.totalGreens, record.total_greens)) ?? sg + g1;
  const totalEntries = readOptionalNumber(firstDefined(record.totalEntries, record.total_entries)) ?? totalGreens + reds;
  const total = readOptionalNumber(record.total) ?? totalEntries + emp;
  return {
    sg,
    greens: sg,
    greenSemGale: sg,
    greenG1: g1,
    greensG1: g1,
    emp,
    ties: emp,
    reds,
    totalGreens,
    totalEntries,
    total,
    assertiveness: readOptionalNumber(firstDefined(record.assertiveness, record.assertividade)) ?? undefined,
  };
}

function emptyEntryModeStatsByMode(): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  return Object.fromEntries(ACTIVE_ENTRY_MODES.map((mode) => [mode, normalizeEntryModeStatsRecord({})]));
}

function normalizeSignalModes(value: unknown) {
  const record = readRecord(value);
  const modes: Record<string, ActiveEntryMode[]> = {};
  for (const [key, rawModes] of Object.entries(record)) {
    const modeList = normalizeModeList(rawModes);
    if (key && modeList.length > 0) modes[key] = modeList;
  }
  return modes;
}

function normalizeModeList(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  const selected = new Set<ActiveEntryMode>();
  for (const rawMode of values) {
    const mode = normalizeEntryMode(rawMode);
    if (mode !== "off") selected.add(mode);
  }
  return ACTIVE_ENTRY_MODES.filter((mode) => selected.has(mode));
}

function normalizeCountedResults(value: unknown) {
  const record = readRecord(value);
  return Object.fromEntries(Object.keys(record).filter(Boolean).map((key) => [key, true]));
}

function hasEntryModeStats(value: unknown) {
  const record = readRecord(value);
  return Object.keys(record).length > 0;
}

function safeCounter(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function normalizeEntryMode(value: unknown): EntryMode {
  const text = String(value || "").trim().toLowerCase();
  if (text === "off" || text === "desligado" || text === "none") return "off";
  if (text === "sniper") return "sniper";
  if (text === "aggressive" || text === "agressivo") return "aggressive";
  if (text === "hunter" || text === "cacador" || text === "caçador") return "hunter";
  return DEFAULT_ENTRY_MODE;
}

function normalizeModuleToggles(value: unknown, fallback: ModuleToggles): ModuleToggles {
  const record = readRecord(value);
  return {
    tieAlert: readOptionalBoolean(record.tieAlert) ?? fallback.tieAlert,
    surfAnalyzer: readOptionalBoolean(record.surfAnalyzer) ?? fallback.surfAnalyzer,
  };
}

function applyEntryModePreference(data: DashboardData, entryMode: EntryMode): DashboardData {
  const mode = normalizeEntryMode(entryMode);
  const base: DashboardData = { ...data, entryMode: mode, entryModeFilter: undefined };
  const filter = buildEntryModeFilter(base, mode);
  if (!filter?.blocked) return base;

  return {
    ...base,
    currentSignal: {
      ...base.currentSignal,
      id: `${base.currentSignal.id}-${mode}-hold`,
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: 0,
      lastResult: base.currentSignal.lastResult ?? null,
    },
    engineDecision: {
      ...base.engineDecision,
      state: "ATENCAO",
      reason: filter.reason,
    },
    entryModeFilter: filter,
  };
}

function buildEntryModeFilter(data: DashboardData, mode: EntryMode) {
  const signal = data.currentSignal;
  if (mode === "off") return null;
  if (mode === "aggressive") return null;
  if (signal.status !== "pending" || !isEntrySide(signal.side)) return null;

  const confidence = clampPercent(data.engineDecision?.confidence ?? 0);
  const strength = clampPercent(signal.strength ?? 0);
  const surfRisk = oppositeSurfRisk(data, signal.side);
  const neuralRisk = hasNeuralRisk(data.neuralReading);
  const tieActive = data.currentTieAlert.status === "active";
  const tieHigh = tieActive && normalizeText(data.currentTieAlert.level).includes("ALTO");
  const engineConfirmed = data.engineDecision.state === "ENTRADA";

  let reason = "";
  if (mode === "sniper") {
    if (!engineConfirmed) reason = "Modo Sniper segurou: a engine ainda não confirmou uma entrada limpa.";
    else if (confidence < 80 || strength < 78) reason = "Modo Sniper segurou: exige confiança alta e força acima do corte.";
    else if (tieActive) reason = "Modo Sniper segurou: Tie ativo deixa a principal em observação.";
    else if (surfRisk >= 40) reason = "Modo Sniper segurou: Surf mostra risco contrário relevante.";
    else if (neuralRisk) reason = "Modo Sniper segurou: número pagante ou gatilho está em zona de risco.";
  } else {
    if (!engineConfirmed) reason = "Modo Caçador segurou: a engine ainda está em atenção.";
    else if (confidence < 70 || strength < 70) reason = "Modo Caçador segurou: confiança ou força abaixo do mínimo.";
    else if (tieHigh) reason = "Modo Caçador segurou: Tie alto pressionando a mesa.";
    else if (surfRisk >= 65) reason = "Modo Caçador segurou: Surf contra com risco alto.";
    else if (neuralRisk) reason = "Modo Caçador segurou: leitura de número em risco.";
  }

  if (!reason) return null;
  return {
    mode,
    blocked: true,
    reason,
    originalSide: signal.side,
    originalStrength: strength,
  };
}

function isEntrySide(side: CurrentSignalSide): side is SignalSide {
  return side === "BANKER" || side === "PLAYER";
}

function oppositeSurfRisk(data: DashboardData, side: SignalSide) {
  const alert = data.currentSurfAlert;
  if (!alert) return 0;
  const surfSide = alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert.surf_side;
  if (surfSide === "NONE" || surfSide === side) return 0;
  return clampPercent(alert.surf_break_risk ?? alert.surf_risk ?? 0);
}

function hasNeuralRisk(reading?: NeuralReading | null) {
  if (!reading) return false;
  const status = normalizeText(reading.paganteStatus);
  return Boolean(
    reading.isRedAlert ||
      reading.isSaturated ||
      status.includes("RISCO") ||
      status.includes("ESTICADO"),
  );
}

function clampPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeDashboardData(payload: unknown): DashboardData {
  const data = readRecord(payload) as unknown as DashboardData;
  const neuralReading =
    data.neuralReading ??
    (data as unknown as Record<string, unknown>).neural_reading ??
    (data as unknown as Record<string, unknown>).numeroPagante ??
    (data as unknown as Record<string, unknown>).numero_pagante;
  const entryModeStats = normalizeEntryModeStats(
    data.entryModeStats ?? (data as unknown as Record<string, unknown>).entry_mode_stats,
  );

  return {
    ...data,
    neuralReading: normalizeNeuralReading(neuralReading, data.neuralReading),
    ...(entryModeStats ? { entryModeStats } : {}),
  };
}

function normalizeEntryModeStats(value: unknown): DashboardData["entryModeStats"] | undefined {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    const rawStats = readRecord(record[mode]);
    if (Object.keys(rawStats).length > 0) {
      stats[mode] = {
        ...normalizeEntryModeStatsRecord(rawStats),
      };
    }
  }
  return Object.keys(stats).length > 0 ? stats : undefined;
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

  return {
    ...(fallback ?? { mode: "SCANNING" }),
    ...record,
    mode: normalizeNeuralMode(firstDefined(record.mode, record.status, fallback?.mode)),
    numero: readOptionalNumber(
      firstDefined(record.numero, record.number, record.numero_pagante, record.payingNumber),
    ) ?? fallback?.numero ?? null,
    origem:
      normalizeNeuralSide(
        firstDefined(record.origem, record.source, record.side, record.lado, record.numberSide),
      ) ?? fallback?.origem ?? null,
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
      ) ?? fallback?.origemTipo ?? null,
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
      ) ?? fallback?.direcao ?? null,
    validade: String(firstDefined(record.validade, record.validity, record.gale, fallback?.validade) ?? "G1"),
    alertas:
      readOptionalNumber(firstDefined(record.alertas, record.alerts, record.totalAlerts, record.total_alerts)) ??
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
      ) ?? fallback?.acertos ?? null,
    greenSemGale: rawSg ?? fallback?.greenSemGale ?? null,
    greenG1: rawG1 ?? fallback?.greenG1 ?? null,
    erros:
      readOptionalNumber(
        firstDefined(record.erros, record.reds, record.red, record.redCount, record.red_count, record.fails, record.losses),
      ) ??
      fallback?.erros ??
      null,
    reds:
      readOptionalNumber(
        firstDefined(record.reds, record.red, record.redCount, record.red_count, record.erros, record.fails, record.losses),
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
      ) ?? fallback?.assertividade ?? null,
    sequencePositive:
      readOptionalNumber(firstDefined(record.sequencePositive, record.sequence_positive, record.seqPositive)) ??
      fallback?.sequencePositive ??
      null,
    sequenceNegative:
      readOptionalNumber(firstDefined(record.sequenceNegative, record.sequence_negative, record.seqNegative)) ??
      fallback?.sequenceNegative ??
      null,
    paganteStatus:
      readOptionalString(firstDefined(record.paganteStatus, record.pagante_status, record.statusPagante)) ??
      fallback?.paganteStatus ??
      null,
    paganteAlert:
      readOptionalString(firstDefined(record.paganteAlert, record.pagante_alert, record.alert)) ??
      fallback?.paganteAlert ??
      null,
    paganteWindow:
      readOptionalNumber(firstDefined(record.paganteWindow, record.pagante_window, record.window)) ??
      fallback?.paganteWindow ??
      null,
    isSaturated: readOptionalBoolean(firstDefined(record.isSaturated, record.is_saturated)) ?? fallback?.isSaturated ?? null,
    isRedAlert: readOptionalBoolean(firstDefined(record.isRedAlert, record.is_red_alert)) ?? fallback?.isRedAlert ?? null,
    postTie: readOptionalBoolean(firstDefined(record.postTie, record.post_tie)) ?? fallback?.postTie ?? null,
  };
}

function normalizeNeuralMode(value: unknown): NeuralReading["mode"] {
  const text = String(value || "").trim().toUpperCase();
  if (["ACTIVE", "ATIVO", "VALIDO", "VALID"].includes(text)) return "ACTIVE";
  if (["OBSERVING", "OBSERVACAO", "OBSERVANDO"].includes(text)) return "OBSERVING";
  return "SCANNING";
}

function normalizeNeuralSide(value: unknown): NeuralReading["origem"] {
  const text = String(value || "").trim().toUpperCase();
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
  if (["OPOSTO", "OPPOSITE", "LOSER", "LOSING", "PERDEDOR", "CONTRA", "NEGATIVE", "NEGATIVO"].includes(text)) {
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
