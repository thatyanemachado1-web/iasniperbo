import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { LOCAL_SIGNALS_API_BASE_URL } from "@/lib/runtimePorts";
import { readUserSession } from "@/lib/userSession";
import { useEffect, useMemo, useState } from "react";
import type { DashboardData, ModuleToggles, NeuralReading, NeuralScoreboard } from "@/types/dashboard";
import { calculateMotorAssertiveness } from "@/utils/assertiveness";

const LIVE_REFETCH_INTERVAL_MS = 4000;
const CLIENT_MODULE_TOGGLES_KEY = "sniper_client_module_toggles";
const NEURAL_SCORE_BASELINE_KEY = "sniper_neural_score_baseline_reset_2026_06_03_192855";
const NEURAL_SEQUENCE_KEY = "sniper_neural_live_sequence_v2";
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
const PUBLIC_LIVE_API_BASE_URL = "https://sniperbo.com";
const DASHBOARD_SOURCE_STORAGE_KEY = "sniper_admin_api_url";
const DEFAULT_MODULE_TOGGLES: ModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
const ALLOWED_REMOTE_API_HOSTS = new Set(["sniperbo.com", "www.sniperbo.com"]);

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
  if (ALLOWED_REMOTE_API_HOSTS.has(window.location.hostname)) {
    return ensureDashboardPath(`${window.location.protocol}//${window.location.host}`);
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
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = configuredDashboardToken(url) || adminSession?.token || userSession.clientToken;
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
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 1,
    staleTime: 2_000,
  });
  const liveFingerprint = useMemo(() => {
    const raw = query.data ?? mockDashboardData;
    const lastRound = raw.rounds?.at(-1);
    return [
      raw.updatedAt ?? "",
      raw.currentSignal?.id ?? "",
      raw.currentSignal?.status ?? "",
      raw.currentSignal?.side ?? "",
      raw.rounds?.length ?? 0,
      lastRound?.id ?? "",
      lastRound?.result ?? "",
    ].join("|");
  }, [query.data]);

  const data = useMemo(() => {
    const rawData = query.data ?? mockDashboardData;
    return {
      ...rawData,
      moduleToggles,
      entryMode: "off" as const,
      entryModeFilter: undefined,
    };
  }, [liveFingerprint, moduleToggles, query.data]);

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

  return {
    ...data,
    ...applyNeuralScoreBaseline(
      normalizedNeuralReading,
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

interface NeuralScoreBaseline {
  day: string;
  alertas: number;
  acertos: number;
  greenSemGale: number;
  greenG1: number;
  erros: number;
  reds: number;
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
  day: string,
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
  const providedSequence = scoreboard
    ? {
        sequencePositive: safeCounter(scoreboard.sequencePositive),
        sequenceNegative: safeCounter(scoreboard.sequenceNegative),
        maxSequencePositive: safeCounter(scoreboard.maxSequencePositive),
        maxSequenceNegative: safeCounter(scoreboard.maxSequenceNegative),
      }
    : currentNeuralSequence(reading);
  const numberSequence = currentNeuralSequence(reading);
  const liveSequence =
    typeof window === "undefined"
      ? {
          day,
          greens: totalGreens,
          reds: totalLosses,
          ...providedSequence,
          lastOutcome: null,
        }
      : updateNeuralLiveSequence(day, totalGreens, totalLosses, providedSequence);
  const sequencePositive = liveSequence.sequencePositive;
  const sequenceNegative = liveSequence.sequenceNegative;
  const maxSequencePositive = liveSequence.maxSequencePositive;
  const maxSequenceNegative = liveSequence.maxSequenceNegative;

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
    sequencePositive: 0,
    sequenceNegative: 0,
    maxSequencePositive: 0,
    maxSequenceNegative: 0,
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

function updateNeuralLiveSequence(
  day: string,
  greens: number,
  reds: number,
  provided: Partial<Pick<
    NeuralLiveSequence,
    "sequencePositive" | "sequenceNegative" | "maxSequencePositive" | "maxSequenceNegative"
  >> = {},
) {
  const key = neuralSequenceStorageKey();
  const previous = readNeuralLiveSequence(key);
  const base =
    previous && previous.day === day && previous.greens <= greens && previous.reds <= reds
      ? previous
      : {
          day,
          greens: 0,
          reds: 0,
          sequencePositive: 0,
          sequenceNegative: 0,
          maxSequencePositive: 0,
          maxSequenceNegative: 0,
          lastOutcome: null,
        };
  const greenDelta = Math.max(0, greens - base.greens);
  const redDelta = Math.max(0, reds - base.reds);
  const providedPositive = safeCounter(provided.sequencePositive);
  const providedNegative = safeCounter(provided.sequenceNegative);
  const hasProvidedCurrent =
    (providedPositive > 0 && providedNegative === 0) || (providedNegative > 0 && providedPositive === 0);
  const next: NeuralLiveSequence = {
    day,
    greens,
    reds,
    sequencePositive: base.sequencePositive,
    sequenceNegative: base.sequenceNegative,
    maxSequencePositive: Math.max(base.maxSequencePositive, safeCounter(provided.maxSequencePositive)),
    maxSequenceNegative: Math.max(base.maxSequenceNegative, safeCounter(provided.maxSequenceNegative)),
    lastOutcome: base.lastOutcome,
  };

  if (hasProvidedCurrent) {
    next.sequencePositive = providedPositive;
    next.sequenceNegative = providedNegative;
    next.lastOutcome = providedPositive > 0 ? "GREEN" : "RED";
  } else if (greenDelta > 0 && redDelta > 0) {
    next.sequencePositive = 0;
    next.sequenceNegative = 0;
    next.lastOutcome = null;
  } else if (greenDelta > 0) {
    next.sequencePositive = (base.lastOutcome === "GREEN" ? base.sequencePositive : 0) + greenDelta;
    next.sequenceNegative = 0;
    next.lastOutcome = "GREEN";
  } else if (redDelta > 0) {
    next.sequenceNegative = (base.lastOutcome === "RED" ? base.sequenceNegative : 0) + redDelta;
    next.sequencePositive = 0;
    next.lastOutcome = "RED";
  }

  next.maxSequencePositive = Math.max(next.maxSequencePositive, next.sequencePositive);
  next.maxSequenceNegative = Math.max(next.maxSequenceNegative, next.sequenceNegative);
  writeNeuralLiveSequence(key, next);
  return next;
}

function readNeuralLiveSequence(key: string): NeuralLiveSequence | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as Partial<NeuralLiveSequence> | null;
    if (!parsed || typeof parsed.day !== "string") return null;
    return {
      day: parsed.day,
      greens: safeCounter(parsed.greens),
      reds: safeCounter(parsed.reds),
      sequencePositive: safeCounter(parsed.sequencePositive),
      sequenceNegative: safeCounter(parsed.sequenceNegative),
      maxSequencePositive: safeCounter(parsed.maxSequencePositive ?? parsed.sequencePositive),
      maxSequenceNegative: safeCounter(parsed.maxSequenceNegative ?? parsed.sequenceNegative),
      lastOutcome: parsed.lastOutcome === "GREEN" || parsed.lastOutcome === "RED" ? parsed.lastOutcome : null,
    };
  } catch {
    return null;
  }
}

function writeNeuralLiveSequence(key: string, sequence: NeuralLiveSequence) {
  const payload = JSON.stringify(sequence);
  if (window.localStorage.getItem(key) === payload) return;
  window.localStorage.setItem(key, payload);
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

function neuralSequenceStorageKey() {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${NEURAL_SEQUENCE_KEY}:${email}` : NEURAL_SEQUENCE_KEY;
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
