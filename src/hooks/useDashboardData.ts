import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import { useEffect, useMemo, useState } from "react";
import type { DashboardData, ModuleToggles, NeuralReading, NeuralScoreboard } from "@/types/dashboard";

const LIVE_REFETCH_INTERVAL_MS = 1_500;
const CLIENT_MODULE_TOGGLES_KEY = "sniper_client_module_toggles";
const LOCAL_DEV_DASHBOARD_TOKEN = "sniper-local-admin-token";
const NEURAL_SCORE_BASELINE_KEY = "sniper_neural_score_baseline_reset_2026_06_03_192855";
const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
const ALLOWED_REMOTE_API_HOSTS = new Set(["sniperbo.com", "www.sniperbo.com"]);

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
    if (savedAdminApi && isAllowedApiBaseUrl(savedAdminApi))
      return ensureDashboardPath(savedAdminApi);
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
  if (typeof window !== "undefined" && parsed.hostname === window.location.hostname)
    return parsed.protocol === "https:";
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

function localDevDashboardToken() {
  if (typeof window === "undefined") return "";
  return ["127.0.0.1", "localhost"].includes(window.location.hostname)
    ? LOCAL_DEV_DASHBOARD_TOKEN
    : "";
}

async function fetchDashboardData(): Promise<DashboardData> {
  const url = configuredDashboardUrl();
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = adminSession?.token || userSession.clientToken || localDevDashboardToken();
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
  const [moduleToggles, setModuleTogglesState] = useState<ModuleToggles>(() =>
    readStoredModuleToggles(),
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
  const data = useMemo(() => {
    const rawData = query.data ?? mockDashboardData;
    return {
      ...rawData,
      moduleToggles,
      entryMode: "off" as const,
      entryModeFilter: undefined,
    };
  }, [query.data, moduleToggles]);

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

  return {
    ...data,
    ...applyNeuralScoreBaseline(
      normalizeNeuralReading(neuralReading, data.neuralReading),
      normalizeNeuralScoreboard(neuralScoreboard, data.neuralScoreboard),
      dashboardDayKey(data),
    ),
  };
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
    sequencePositive:
      readOptionalNumber(
        firstDefined(record.sequencePositive, record.sequence_positive, record.seqPositive),
      ) ??
      fallback?.sequencePositive ??
      null,
    sequenceNegative:
      readOptionalNumber(
        firstDefined(record.sequenceNegative, record.sequence_negative, record.seqNegative),
      ) ??
      fallback?.sequenceNegative ??
      null,
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

interface NeuralScoreBaseline {
  day: string;
  alertas: number;
  acertos: number;
  greenSemGale: number;
  greenG1: number;
  erros: number;
  reds: number;
}

function applyNeuralScoreBaseline(
  reading: NeuralReading,
  scoreboard: NeuralScoreboard | undefined,
  day: string,
): Pick<DashboardData, "neuralReading" | "neuralScoreboard"> {
  if (typeof window === "undefined") return { neuralReading: reading, neuralScoreboard: scoreboard };
  const current = neuralScoreFrom(reading, scoreboard);
  const storageKey = neuralScoreBaselineStorageKey();
  const baseline = readNeuralScoreBaseline(storageKey);

  if (!baseline || baseline.day !== day || neuralScoreWentBackwards(current, baseline)) {
    writeNeuralScoreBaseline(storageKey, { day, ...current });
    const neuralReading = {
      ...reading,
      alertas: 0,
      acertos: 0,
      greenSemGale: 0,
      greenG1: 0,
      erros: 0,
      reds: 0,
      assertividade: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
    };
    return {
      neuralReading,
      neuralScoreboard: zeroNeuralScoreboard(scoreboard),
    };
  }

  const greenSemGale = Math.max(0, current.greenSemGale - baseline.greenSemGale);
  const greenG1 = Math.max(0, current.greenG1 - baseline.greenG1);
  const acertos = Math.max(0, current.acertos - baseline.acertos);
  const reds = Math.max(0, current.reds - baseline.reds);
  const erros = Math.max(0, current.erros - baseline.erros);
  const alertas = Math.max(0, current.alertas - baseline.alertas);
  const totalGreens = greenSemGale + greenG1 || acertos;
  const totalLosses = reds || erros;
  const total = totalGreens + totalLosses;

  const neuralReading = {
    ...reading,
    alertas: Math.max(alertas, total),
    acertos: totalGreens,
    greenSemGale,
    greenG1,
    erros: totalLosses,
    reds: totalLosses,
    assertividade: total > 0 ? Math.round((totalGreens / total) * 1000) / 10 : 0,
    sequencePositive: totalGreens > 0 && totalLosses === 0 ? totalGreens : reading.sequencePositive ?? 0,
    sequenceNegative: totalLosses > 0 && totalGreens === 0 ? totalLosses : reading.sequenceNegative ?? 0,
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
      assertividade: total > 0 ? Math.round((totalGreens / total) * 1000) / 10 : 0,
    },
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

function zeroNeuralScoreboard(scoreboard?: NeuralScoreboard): NeuralScoreboard | undefined {
  if (!scoreboard) return undefined;
  return {
    ...scoreboard,
    totalAlerts: 0,
    acertos: 0,
    greens: 0,
    greenSemGale: 0,
    greenG1: 0,
    erros: 0,
    reds: 0,
    assertividade: 0,
  };
}

function readNeuralScoreBaseline(key: string): NeuralScoreBaseline | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as Partial<NeuralScoreBaseline> | null;
    if (!parsed || typeof parsed.day !== "string") return null;
    return {
      day: parsed.day,
      alertas: safeCounter(parsed.alertas),
      acertos: safeCounter(parsed.acertos),
      greenSemGale: safeCounter(parsed.greenSemGale),
      greenG1: safeCounter(parsed.greenG1),
      erros: safeCounter(parsed.erros),
      reds: safeCounter(parsed.reds),
    };
  } catch {
    return null;
  }
}

function writeNeuralScoreBaseline(key: string, baseline: NeuralScoreBaseline) {
  window.localStorage.removeItem("sniper_neural_general_score");
  window.localStorage.removeItem("sniper_neural_score_baseline_v2");
  window.localStorage.removeItem("sniper_neural_score_baseline_v3");
  window.localStorage.removeItem("sniper_neural_score_baseline_v4");
  for (const storageKey of Object.keys(window.localStorage)) {
    if (
      storageKey !== key &&
      (storageKey.includes("sniper_neural_general_score") ||
        storageKey.includes("sniper_neural_score_baseline"))
    ) {
      window.localStorage.removeItem(storageKey);
    }
  }
  window.localStorage.setItem(key, JSON.stringify(baseline));
}

function neuralScoreWentBackwards(current: Omit<NeuralScoreBaseline, "day">, baseline: NeuralScoreBaseline) {
  return (
    current.alertas < baseline.alertas ||
    current.acertos < baseline.acertos ||
    current.greenSemGale < baseline.greenSemGale ||
    current.greenG1 < baseline.greenG1 ||
    current.erros < baseline.erros ||
    current.reds < baseline.reds
  );
}

function neuralScoreBaselineStorageKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${NEURAL_SCORE_BASELINE_KEY}:${email}` : NEURAL_SCORE_BASELINE_KEY;
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeCounter(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}
