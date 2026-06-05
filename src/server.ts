import "./lib/error-capture";

import { mockDashboardData } from "./data/mockDashboardData";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  normalizeAnnouncementTone,
  normalizeAssetUrl,
  normalizeSiteContentSettings,
  type SiteContentSettings,
} from "./lib/siteContent";
import type {
  ActiveEntryMode,
  CurrentSignalSide,
  DashboardData,
  EntryModeStats,
  NeuralReading,
  SignalSide,
  SignalStatus,
} from "./types/dashboard";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type LiveDashboardData = DashboardData & {
  updatedAt?: string;
  cycleDate?: string;
  dailyCycleDate?: string;
  strictDailyCounters?: boolean;
  entryModeSignalModes?: Record<string, ActiveEntryMode[]>;
  entryModeCountedResults?: Record<string, true>;
  latestEntryModeSignalId?: string;
  latestEntryModeSignalModes?: ActiveEntryMode[];
  neuralSequenceLastOutcome?: "GREEN" | "RED" | null;
};
type WorkerCacheStorage = CacheStorage & { default?: Cache };
type AdminRole = "owner" | "admin";
type BillingPlanId = "free" | "premium" | "vip";
type SubscriptionStatus = "free" | "pending" | "active" | "expired" | "cancelled" | "past_due";
type SalesSettings = {
  salesClosed: boolean;
  updated_at: string;
  updated_by: string;
};
type LiveStateSaveStatus = {
  durable: boolean;
  cache: boolean;
  durableConfigured: boolean;
  saved_at: string;
};
type AdaptiveStrategySyncPayload = {
  records?: unknown[];
  patterns?: unknown[];
  decision?: Record<string, unknown>;
  logs?: unknown[];
};
type LocalAiSettings = {
  enabled: boolean;
  narrationEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  voiceProvider: string;
  voiceName: string;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  callsPerMinute: number;
  cooldownMs: number;
};
type LocalAiLog = {
  id: string;
  user: string;
  mesa: string;
  event: string;
  question: string;
  response: string;
  model: string;
  provider: string;
  durationMs: number;
  estimatedCost: number;
  status: string;
  error: string;
  timestamp: string;
  data: Record<string, unknown>;
};
type AdminManagedUserRole = "user" | "admin" | "owner";
type AdminManagedUserPlan = "free" | "trial" | "monthly" | "premium" | "vip_manual";
type AdminSubscriptionStatus =
  | "trial"
  | "active"
  | "expired"
  | "canceled"
  | "blocked"
  | "manual_vip";
type AdminActionType =
  | "UPDATE_USER"
  | "UPDATE_PLAN"
  | "UPDATE_SUBSCRIPTION_STATUS"
  | "EXTEND_ACCESS"
  | "BLOCK_USER"
  | "UNBLOCK_USER"
  | "UPDATE_ROLE"
  | "UPDATE_EXPIRATION_DATE"
  | "MANUAL_VIP_GRANTED"
  | "CANCEL_ACCESS"
  | "REACTIVATE_USER"
  | "DELETE_USER";

const LIVE_STATE_CACHE_URL = "https://sniperbo.com/__sniperbo_live_state_v1";
const LIVE_STATE_ID = "main";
const LIVE_STATE_TABLE = "sniper_live_state";
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
const MERCADOPAGO_PREFERENCE_URL = "https://api.mercadopago.com/checkout/preferences";
const MERCADOPAGO_PAYMENT_URL = "https://api.mercadopago.com/v1/payments";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_FAST_OUTPUT_FORMAT = "mp3_22050_32";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const DEFAULT_EDGE_TTS_VOICE = "pt-BR-AntonioNeural";
const LOCAL_DEV_DASHBOARD_TOKEN = "sniper-local-admin-token";
const MAX_NARRATION_CHARS = 900;
const CLIENT_SESSION_TTL_SECONDS = 60 * 60 * 8;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FREE_TRIAL_MINUTES = 10;
const ELEVENLABS_API_KEY_SECRET_NAMES = [
  "ELEVENLABS_TTS_API_KEY",
  "ELEVENLABS_TTS_API_KEY_2",
  "ELEVENLABS_TTS_API_KEY_3",
  "ELEVENLABS_TTS_API_KEY_4",
  "ELEVENLABS_TTS_API_KEY_5",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_API_KEY_2",
  "ELEVENLABS_API_KEY_3",
] as const;
const ELEVENLABS_VOICE_ID_SECRET_NAMES = [
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_VOICE_ID_2",
  "ELEVENLABS_VOICE",
  "ELEVENLABS_VOICEID",
  "VOICE_ID",
] as const;
const ACTIVE_ENTRY_MODES = [
  "sniper",
  "hunter",
  "aggressive",
] as const satisfies readonly ActiveEntryMode[];
const SNIPER_NEURAL_ASSERTIVENESS_MIN = 100;

let serverEntryPromise: Promise<ServerEntry> | undefined;
let liveDashboardData: LiveDashboardData = resetDashboardDailyCycle(mockDashboardData);
let liveRecipients: Array<Record<string, unknown>> = [];
let liveClients: Array<Record<string, unknown>> = [];
let liveAccessEvents: Array<Record<string, unknown>> = [];
let liveSubscriptions: Array<Record<string, unknown>> = [];
let livePayments: Array<Record<string, unknown>> = [];
let liveAdminUsers: Array<Record<string, unknown>> = [];
let liveAdminActionLogs: Array<Record<string, unknown>> = [];
let liveDeletedEntities: Array<Record<string, unknown>> = [];
let liveModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
let liveSalesSettings: SalesSettings = {
  salesClosed: false,
  updated_at: "",
  updated_by: "",
};
let liveSiteContentSettings: SiteContentSettings = DEFAULT_SITE_CONTENT_SETTINGS;
let liveLocalAiSettings: Partial<LocalAiSettings> = {};
let liveLocalAiLogs: LocalAiLog[] = [];
let liveStateSaveStatus: LiveStateSaveStatus = {
  durable: false,
  cache: false,
  durableConfigured: false,
  saved_at: "",
};
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const localAiRateBuckets = new Map<string, { count: number; resetAt: number }>();
const localAiCache = new Map<string, { response: string; createdAt: number }>();
const localAiCooldowns = new Map<string, number>();

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return withSecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const adminRedirect = redirectLegacyAdminRoute(request);
      if (adminRedirect) return withSecurityHeaders(adminRedirect);

      const rateLimitResponse = handleRateLimit(request);
      if (rateLimitResponse) return withSecurityHeaders(rateLimitResponse);

      await loadLiveState(env);

      const voiceResponse = await handleVoiceNarrationRequest(request, env);
      if (voiceResponse) return withSecurityHeaders(voiceResponse);

      const localVoiceResponse = await handleLocalVoiceRequest(request, env);
      if (localVoiceResponse) return withSecurityHeaders(localVoiceResponse);

      const voiceDiagnosticsResponse = await handleVoiceDiagnosticsRequest(request, env);
      if (voiceDiagnosticsResponse) return withSecurityHeaders(voiceDiagnosticsResponse);

      const localAiResponse = await handleLocalAiRequest(request, env);
      if (localAiResponse) return withSecurityHeaders(localAiResponse);

      const salesSettingsResponse = await handleSalesSettingsRequest(request);
      if (salesSettingsResponse) return withSecurityHeaders(salesSettingsResponse);

      const siteContentResponse = await handleSiteContentRequest(request);
      if (siteContentResponse) return withSecurityHeaders(siteContentResponse);

      const billingResponse = await handleBillingRequest(request, env);
      if (billingResponse) return withSecurityHeaders(billingResponse);

      const adminApiResponse = await handleAdminApiRequest(request, env);
      if (adminApiResponse) return withSecurityHeaders(adminApiResponse);

      const dashboardResponse = await handleDashboardRequest(request, env);
      if (dashboardResponse) return withSecurityHeaders(dashboardResponse);

      const adaptiveStrategyResponse = await handleAdaptiveStrategyRequest(request, env);
      if (adaptiveStrategyResponse) return withSecurityHeaders(adaptiveStrategyResponse);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(await injectSiteContentHeadResponse(request, normalizedResponse));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};

function redirectLegacyAdminRoute(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.headers.get("authorization") || request.headers.get("x-sniper-token")) return null;
  const url = new URL(request.url);
  const adminPageMap: Record<string, string> = {
    "/admin": "/app/admin",
    "/admin/login": "/app/admin",
    "/admin/users": "/app/admin/users",
    "/admin/logs": "/app/admin/logs",
    "/admin/modules": "/app/admin/modules",
    "/admin/broadcast": "/app/admin/broadcast",
  };
  const nextPath = adminPageMap[url.pathname];
  if (!nextPath) return null;

  url.pathname = nextPath;
  url.search = "";
  return Response.redirect(url.toString(), 302);
}

function handleRateLimit(request: Request) {
  if (request.method === "OPTIONS") return null;

  const url = new URL(request.url);
  const limit = rateLimitForRequest(request.method, url.pathname);
  if (!limit) return null;

  const now = Date.now();
  const key = `${getClientIp(request)}:${request.method}:${url.pathname}`;
  const current = rateLimitBuckets.get(key);
  const bucket =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, value] of rateLimitBuckets.entries()) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }

  if (bucket.count <= limit) return null;

  return json(
    {
      error: "Muitas requisicoes. Aguarde alguns instantes e tente novamente.",
    },
    429,
  );
}

function rateLimitForRequest(method: string, pathname: string) {
  if (pathname === "/auth/check" || pathname === "/auth/register" || pathname === "/admin/login") {
    return 30;
  }
  if (pathname === "/billing/checkout") return 12;
  if (
    pathname === "/sales/settings" ||
    pathname === "/admin/sales-settings" ||
    pathname === "/site-content" ||
    pathname === "/admin/site-content" ||
    pathname === "/admin/broadcast"
  ) {
    return 120;
  }
  if (pathname === "/webhooks/mercadopago") return 240;
  if (pathname === "/api/webhook/hubla" || pathname === "/api/webhooks/hubla") return 240;
  if (pathname === "/auth/verify") return 60;
  if (pathname === "/voice/narration") return 25;
  if (pathname === "/api/voice/speak") return 40;
  if (pathname === "/api/ai/local-commentary") return 60;
  if (pathname === "/dashboard") return method === "GET" ? 120 : 240;
  if (pathname === "/dashboard/signal") return 240;
  if (pathname === "/adaptive-strategy/sync") return 240;
  if (
    pathname === "/billing/plans" ||
    pathname === "/billing/subscription" ||
    pathname === "/billing/payments" ||
    pathname === "/admin/summary" ||
    pathname === "/telegram-recipients" ||
    pathname.startsWith("/telegram-recipients/") ||
    pathname === "/module-toggles" ||
    pathname === "/security-events" ||
    pathname === "/voice/diagnostics" ||
    pathname === "/admin/local-ai" ||
    pathname === "/auth/diagnostics"
  ) {
    return 120;
  }
  return null;
}

function getClientIp(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function handleVoiceNarrationRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/narration") return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method !== "POST") {
    return json({ error: "Método não permitido." }, 405);
  }

  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Não autorizado." }, 401);
  }

  const body = readRecord(await request.json().catch(() => ({})));
  const rawText = String(body.text || body.narration || "");
  const text = normalizeNarrationText(rawText);
  if (!text) {
    return json({ error: "Texto de voz obrigatório." }, 400);
  }
  if (text.length > MAX_NARRATION_CHARS) {
    return json(
      { error: `Texto de voz muito longo. Limite: ${MAX_NARRATION_CHARS} caracteres.` },
      413,
    );
  }

  if (!readServerBoolean(env, "ELEVENLABS_ENABLED", false)) {
    return json({
      fallback: "browser",
      reason: "Voz antiga desativada. Use /api/voice/speak com Edge TTS local.",
    });
  }

  const apiKeys = getElevenLabsApiKeys(env);
  if (!apiKeys.length) {
    return json({ error: "ELEVENLABS_API_KEY não configurada no backend." }, 503);
  }

  const voiceId = getElevenLabsVoiceId(env);
  if (!voiceId) {
    return json({ error: "ELEVENLABS_VOICE_ID não configurado no backend." }, 503);
  }

  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  let response: Response | null = null;
  let lastFailureStatus: number | "network_error" | null = null;
  for (const apiKey of apiKeys) {
    response = await fetch(
      `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_FAST_OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: false,
          },
        }),
      },
    ).catch(() => null);

    if (response?.ok) break;
    lastFailureStatus = response?.status ?? "network_error";
    response = null;
  }

  if (!response) {
    recordElevenLabsStatus(lastFailureStatus ?? "network_error");
    if (typeof lastFailureStatus === "number") {
      console.warn(`Falha ao gerar voz ElevenLabs (${lastFailureStatus}) em todas as chaves configuradas.`);
      return json(elevenLabsErrorPayload(lastFailureStatus), elevenLabsErrorStatus(lastFailureStatus));
    }
    return json({ error: "Falha de conexão ao gerar voz ElevenLabs." }, 502);
  }

  recordElevenLabsStatus("ok");
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-sniper-token,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
    },
  });
}

async function handleVoiceDiagnosticsRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/diagnostics") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);

  if (!isDashboardAuthorized(request, url, env)) {
    return json({ error: "Não autorizado." }, 401);
  }

  const apiKeys = getElevenLabsApiKeys(env);
  const hasElevenLabsKey = apiKeys.length > 0;
  const hasVoiceId = Boolean(getElevenLabsVoiceId(env));
  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  if (url.searchParams.get("check") === "elevenlabs") {
    let elevenLabsAuthOk = false;
    let elevenLabsAuthStatus: string | number = "no_api_key";
    for (const apiKey of apiKeys) {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          method: "GET",
          headers: { "xi-api-key": apiKey, Accept: "application/json" },
        });
        elevenLabsAuthOk = res.ok;
        elevenLabsAuthStatus = res.status;
        if (res.ok) break;
      } catch {
        elevenLabsAuthStatus = "network_error";
      }
    }
    return json({
      elevenLabsAuthOk,
      elevenLabsAuthStatus,
      hasElevenLabsKey,
      hasVoiceId,
      keyCount: apiKeys.length,
      modelId,
    });
  }

  return json({
    hasElevenLabsKey,
    hasVoiceId,
    keyCount: apiKeys.length,
    modelId,
    provider: "elevenlabs",
    lastElevenLabsStatus,
  });
}

async function handleLocalVoiceRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/voice/speak") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Não autorizado." }, 401);
  }

  const body = readRecord(await request.json().catch(() => ({})));
  const text = normalizeNarrationText(readString(body, "text"));
  if (!text) return json({ error: "Texto de voz obrigatório." }, 400);
  if (text.length > MAX_NARRATION_CHARS) {
    return json({ error: `Texto de voz muito longo. Limite: ${MAX_NARRATION_CHARS} caracteres.` }, 413);
  }

  const settings = getLocalAiSettings(env);
  const provider = readString(body, "provider") || settings.voiceProvider;
  if (provider === "elevenlabs") {
    return generateElevenLabsVoiceResponse(text, env);
  }
  if (provider !== "edge-tts") {
    return json({ fallback: "browser", reason: "Provedor local ainda não ativo no backend." });
  }

  const edgeTtsUrl = readServerEnvString(env, "EDGE_TTS_URL", "").replace(/\/+$/, "");
  if (!edgeTtsUrl) {
    return json({ fallback: "browser", reason: "EDGE_TTS_URL não configurado no backend." });
  }

  try {
    const response = await fetch(edgeTtsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: readString(body, "voice") || settings.voiceName,
        language: readString(body, "language") || "pt-BR",
        volume: safeServerNumber(body.volume, settings.voiceVolume),
        rate: safeServerNumber(body.rate, settings.voiceRate),
        pitch: safeServerNumber(body.pitch, settings.voicePitch),
      }),
    });
    if (!response.ok) {
      return json({ fallback: "browser", reason: `Edge TTS indisponível (${response.status}).` });
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") || "audio/mpeg",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers":
          "Content-Type,Authorization,x-sniper-token,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
      },
    });
  } catch (error) {
    console.warn("Edge TTS indisponível.", error);
    return json({ fallback: "browser", reason: "Falha de conexão com Edge TTS." });
  }
}

async function generateElevenLabsVoiceResponse(text: string, env: unknown) {
  const apiKeys = getElevenLabsApiKeys(env);
  if (!apiKeys.length) {
    return json({ error: "ELEVENLABS_API_KEY não configurada no backend." }, 503);
  }

  const voiceId = getElevenLabsVoiceId(env);
  if (!voiceId) {
    return json({ error: "ELEVENLABS_VOICE_ID não configurado no backend." }, 503);
  }

  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);
  let response: Response | null = null;
  let lastFailureStatus: number | "network_error" | null = null;

  for (const apiKey of apiKeys) {
    response = await fetch(
      `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_FAST_OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: false,
          },
        }),
      },
    ).catch(() => null);

    if (response?.ok) break;
    lastFailureStatus = response?.status ?? "network_error";
    response = null;
  }

  if (!response) {
    recordElevenLabsStatus(lastFailureStatus ?? "network_error");
    if (typeof lastFailureStatus === "number") {
      return json(elevenLabsErrorPayload(lastFailureStatus), elevenLabsErrorStatus(lastFailureStatus));
    }
    return json({ error: "Falha de conexão ao gerar voz ElevenLabs." }, 502);
  }

  recordElevenLabsStatus("ok");
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-sniper-token,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
    },
  });
}

async function handleLocalAiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);

  if (url.pathname === "/admin/local-ai") {
    if (request.method === "OPTIONS") return json(null, 204);
    const role = await getAdminRequestRole(request, env);
    if (!role) return json({ error: "Não autorizado." }, 401);
    if (request.method === "GET") {
      return json({
        settings: getLocalAiSettings(env),
        logs: liveLocalAiLogs.slice(0, 100),
        status: await probeOllamaStatus(env),
      });
    }
    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      liveLocalAiSettings = normalizeLocalAiSettingsPatch(body, getLocalAiSettings(env));
      await saveLiveState(env);
      return json({
        settings: getLocalAiSettings(env),
        logs: liveLocalAiLogs.slice(0, 100),
        status: await probeOllamaStatus(env),
      });
    }
    return json({ error: "Método não permitido." }, 405);
  }

  if (url.pathname !== "/api/ai/local-commentary") return null;
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Não autorizado." }, 401);
  }

  const startedAt = Date.now();
  const settings = getLocalAiSettings(env);
  const body = readRecord(await request.json().catch(() => ({})));
  const event = sanitizeQuestion(readString(body, "event") || "chat", 80);
  const question = sanitizeQuestion(readString(body, "question"), 260);
  const fallbackText = sanitizeQuestion(readString(body, "fallbackText"), 360);
  const userKey = localAiUserKey(request, body);
  const summary = buildLocalAiMarketSummary(liveDashboardData, body);

  if (!settings.enabled) {
    const commentary = fallbackText || fallbackLocalAiCommentary(event, summary);
    recordLocalAiLog(userKey, event, question, commentary, settings.ollamaModel, "fallback", Date.now() - startedAt, "disabled", "", summary);
    return json({ commentary, provider: "fallback", model: settings.ollamaModel, status: "disabled" });
  }

  const rateBlocked = consumeLocalAiRate(userKey, settings.callsPerMinute);
  if (rateBlocked) {
    return json({ error: "IA local em cooldown: muitas perguntas em pouco tempo." }, 429);
  }

  const cacheKey = hashServerText(JSON.stringify({ event, question, summary: compactLocalAiCacheSummary(summary) }));
  const cached = localAiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 90_000) {
    return json({
      commentary: cached.response,
      cached: true,
      provider: "ollama",
      model: settings.ollamaModel,
      status: "ok",
    });
  }

  const lastCall = localAiCooldowns.get(userKey) || 0;
  if (Date.now() - lastCall < settings.cooldownMs) {
    const commentary = fallbackText || fallbackLocalAiCommentary(event, summary);
    return json({ commentary, provider: "fallback", model: settings.ollamaModel, status: "fallback", cached: true });
  }
  localAiCooldowns.set(userKey, Date.now());

  const prompt = buildLocalAiPrompt(event, question, fallbackText, summary);
  const ollama = await callOllama(settings, prompt);
  const commentary = cleanLocalAiResponse(ollama.response || fallbackText || fallbackLocalAiCommentary(event, summary));
  const provider = ollama.ok ? "ollama" : "fallback";
  localAiCache.set(cacheKey, { response: commentary, createdAt: Date.now() });
  recordLocalAiLog(
    userKey,
    event,
    question,
    commentary,
    settings.ollamaModel,
    provider,
    Date.now() - startedAt,
    ollama.ok ? "ok" : "fallback",
    ollama.error,
    summary,
  );

  return json({
    commentary,
    provider,
    model: settings.ollamaModel,
    status: ollama.ok ? "ok" : "fallback",
    error: ollama.error || undefined,
  });
}

function getLocalAiSettings(env: unknown): LocalAiSettings {
  return {
    enabled: readServerBoolean(env, "AI_LOCAL_ENABLED", true, liveLocalAiSettings.enabled),
    narrationEnabled: readServerBoolean(
      env,
      "AI_LOCAL_NARRATION_ENABLED",
      true,
      liveLocalAiSettings.narrationEnabled,
    ),
    ollamaBaseUrl:
      liveLocalAiSettings.ollamaBaseUrl ||
      readServerEnvString(env, "OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, ""),
    ollamaModel:
      liveLocalAiSettings.ollamaModel ||
      readServerEnvString(env, "OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
    voiceProvider:
      liveLocalAiSettings.voiceProvider ||
      readServerEnvString(env, "VOICE_PROVIDER", "edge-tts"),
    voiceName:
      liveLocalAiSettings.voiceName ||
      readServerEnvString(env, "VOICE_NAME", DEFAULT_EDGE_TTS_VOICE),
    voiceVolume: safeServerNumber(liveLocalAiSettings.voiceVolume, readServerNumber(env, "VOICE_VOLUME", 0.9)),
    voiceRate: safeServerNumber(liveLocalAiSettings.voiceRate, readServerNumber(env, "VOICE_RATE", 1)),
    voicePitch: safeServerNumber(liveLocalAiSettings.voicePitch, readServerNumber(env, "VOICE_PITCH", 0.95)),
    callsPerMinute: Math.max(
      1,
      Math.floor(safeServerNumber(liveLocalAiSettings.callsPerMinute, readServerNumber(env, "AI_LOCAL_CALLS_PER_MINUTE", 12))),
    ),
    cooldownMs: Math.max(
      0,
      Math.floor(safeServerNumber(liveLocalAiSettings.cooldownMs, readServerNumber(env, "AI_LOCAL_COOLDOWN_MS", 8000))),
    ),
  };
}

function normalizeLocalAiSettingsPatch(body: Record<string, unknown>, fallback: LocalAiSettings) {
  return {
    enabled: typeof body.enabled === "boolean" ? body.enabled : fallback.enabled,
    narrationEnabled:
      typeof body.narrationEnabled === "boolean" ? body.narrationEnabled : fallback.narrationEnabled,
    ollamaBaseUrl: readString(body, "ollamaBaseUrl") || fallback.ollamaBaseUrl,
    ollamaModel: readString(body, "ollamaModel") || fallback.ollamaModel,
    voiceProvider: readString(body, "voiceProvider") || fallback.voiceProvider,
    voiceName: readString(body, "voiceName") || fallback.voiceName,
    voiceVolume: safeServerNumber(body.voiceVolume, fallback.voiceVolume),
    voiceRate: safeServerNumber(body.voiceRate, fallback.voiceRate),
    voicePitch: safeServerNumber(body.voicePitch, fallback.voicePitch),
    callsPerMinute: safeServerNumber(body.callsPerMinute, fallback.callsPerMinute),
    cooldownMs: safeServerNumber(body.cooldownMs, fallback.cooldownMs),
  } satisfies LocalAiSettings;
}

async function probeOllamaStatus(env: unknown) {
  const settings = getLocalAiSettings(env);
  try {
    const response = await fetch(`${settings.ollamaBaseUrl}/api/tags`, { method: "GET" });
    return {
      online: response.ok,
      status: response.ok ? "Online" : `Offline (${response.status})`,
      model: settings.ollamaModel,
      baseUrl: settings.ollamaBaseUrl,
    };
  } catch {
    return {
      online: false,
      status: "Offline",
      model: settings.ollamaModel,
      baseUrl: settings.ollamaBaseUrl,
    };
  }
}

async function callOllama(settings: LocalAiSettings, prompt: string) {
  try {
    const response = await fetch(`${settings.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.45,
          top_p: 0.82,
          num_predict: 140,
        },
      }),
    });
    if (!response.ok) return { ok: false, response: "", error: `Ollama ${response.status}` };
    const payload = readRecord(await response.json().catch(() => ({})));
    return { ok: true, response: readString(payload, "response"), error: "" };
  } catch (error) {
    return { ok: false, response: "", error: "Ollama offline ou inacessivel." };
  }
}

function buildLocalAiPrompt(
  event: string,
  question: string,
  fallbackText: string,
  summary: Record<string, unknown>,
) {
  return [
    "Você é o Sniper Voice IA, analista virtual de Bac Bo dentro do Sniper Bo IA.",
    "Você NÃO decide entradas. As entradas já foram decididas pelos módulos internos.",
    "Use somente os dados reais enviados em JSON. Não invente porcentagens, estatísticas ou fatos.",
    "Nunca prometa lucro. Nunca diga certeza, garantida ou entrada garantida.",
    "Se não houver dados suficientes, diga que a mesa está em observação.",
    "Tom: natural, agressivo, confiante, profissional, frases curtas, sala ao vivo.",
    "Sempre mencione risco quando o risco estiver alto.",
    "Responda em português do Brasil com acentos corretos e no máximo 3 frases curtas.",
    `Evento: ${event || "chat"}`,
    question ? `Pergunta do usuário: ${question}` : "",
    fallbackText ? `Comentário base do sistema: ${fallbackText}` : "",
    `Dados reais do Sniper Bo IA: ${JSON.stringify(summary).slice(0, 6000)}`,
    "Resposta:",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLocalAiMarketSummary(data: LiveDashboardData, body: Record<string, unknown>) {
  const rounds = data.rounds.slice(-30);
  const adaptive = readRecord(body.adaptiveSnapshot);
  const entryScore = readRecord(adaptive.entryScore);
  const topPattern = Array.isArray(adaptive.patterns) ? readRecord(adaptive.patterns[0]) : {};
  return {
    mesa: "Mesa principal",
    updatedAt: data.updatedAt || "",
    ultimasRodadas: rounds,
    tendenciaAtual: summarizeRoundTrend(rounds),
    entradaAtual: data.currentSignal,
    decisaoEngine: data.engineDecision,
    surfAtual: data.currentSurfAlert || null,
    numeroPagante: data.neuralReading || null,
    tieAlert: data.currentTieAlert,
    scoreEntrada: entryScore.finalScore ?? null,
    estrategiaAtiva: {
      label: readString(topPattern, "label"),
      status: readString(topPattern, "status"),
      direcao: readString(topPattern, "direction"),
      ocorrencias: topPattern.occurrences ?? null,
      assertividade: topPattern.assertiveness ?? null,
    },
    placaresRecentes: {
      principal: data.mainScoreboard,
      tie: data.tieAlertScoreboard,
      surf: data.surfAnalyzerScoreboard,
      neural: data.neuralScoreboard || data.neuralReading || null,
    },
    risco: summarizeMarketRisk(data),
    logsRecentes: Array.isArray(adaptive.decisionLogs) ? adaptive.decisionLogs.slice(0, 8) : [],
  };
}

function summarizeRoundTrend(rounds: DashboardData["rounds"]) {
  const banker = rounds.filter((round) => round.result === "B").length;
  const player = rounds.filter((round) => round.result === "P").length;
  const tie = rounds.filter((round) => round.result === "T").length;
  return {
    banker,
    player,
    tie,
    dominante: banker >= player && banker >= tie ? "BANKER" : player >= tie ? "PLAYER" : "TIE",
    sequencia: rounds.slice(-12).map((round) => round.result).join(""),
  };
}

function summarizeMarketRisk(data: DashboardData) {
  const tieHigh =
    data.currentTieAlert.status === "active" &&
    normalizeText(data.currentTieAlert.level).includes("ALTO");
  const surfRisk = data.currentSurfAlert?.surf_break_risk ?? data.currentSurfAlert?.surf_risk ?? 0;
  const neuralRisk = data.neuralReading?.isSaturated || data.neuralReading?.isRedAlert;
  const blocked = data.engineDecision.state === "BLOQUEADO";
  const high = tieHigh || surfRisk >= 70 || neuralRisk || blocked;
  return {
    nivel: high ? "alto" : surfRisk >= 40 ? "medio" : "controlado",
    tieHigh,
    surfRisk,
    neuralRisk,
    blocked,
    motivo: data.engineDecision.reason,
  };
}

function fallbackLocalAiCommentary(event: string, summary: Record<string, unknown>) {
  const risk = readRecord(summary.risco);
  const entry = readRecord(summary.entradaAtual);
  const side = readString(entry, "side");
  if (readString(risk, "nivel") === "alto") {
    return "Cuidado. O mercado está pesado e o risco subiu. Melhor não forçar entrada agora.";
  }
  if (event.includes("green")) return "Bateu. Green confirmado. A leitura respeitou o padrão.";
  if (event.includes("red")) return "Red confirmado. O mercado quebrou a leitura. Gestão primeiro.";
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") {
    return `Entrada confirmada em ${side}. A leitura veio dos módulos internos e o risco está monitorado.`;
  }
  return "Mesa ainda em observação. Tem movimento, mas não existe confirmação limpa para entrada.";
}

function cleanLocalAiResponse(value: string) {
  const text = beautifyPortugueseText(sanitizeQuestion(value, 520))
    .replace(/entrada\s+garantida/gi, "entrada confirmada pelos módulos")
    .replace(/\bgarantid[ao]\b/gi, "confirmado pelos dados")
    .replace(/\bcerteza\b/gi, "leitura")
    .replace(/lucro\s+certo/gi, "resultado ainda depende do mercado");
  return text || "Mesa em observação. Ainda sem dados suficientes para comentário seguro.";
}

function beautifyPortugueseText(value: string) {
  const mojibakeFixed = value
    .replace(/nÃ£o/g, "não")
    .replace(/NÃ£o/g, "Não")
    .replace(/atenÃ§Ã£o/g, "atenção")
    .replace(/AtenÃ§Ã£o/g, "Atenção")
    .replace(/painÃ©is/g, "painéis")
    .replace(/indisponÃ­vel/g, "indisponível");

  return [
    ["voce", "você"],
    ["nao", "não"],
    ["atencao", "atenção"],
    ["observacao", "observação"],
    ["narracao", "narração"],
    ["comentario", "comentário"],
    ["analise", "análise"],
    ["numero", "número"],
    ["padrao", "padrão"],
    ["gestao", "gestão"],
    ["confianca", "confiança"],
    ["direcao", "direção"],
    ["protecao", "proteção"],
    ["confirmacao", "confirmação"],
    ["proxima", "próxima"],
    ["forcar", "forçar"],
    ["modulos", "módulos"],
    ["metricas", "métricas"],
    ["estatisticas", "estatísticas"],
    ["usuario", "usuário"],
    ["usuarios", "usuários"],
    ["responsavel", "responsável"],
    ["prejuizo", "prejuízo"],
    ["apos", "após"],
    ["ate", "até"],
    ["esta", "está"],
    ["ta", "tá"],
    ["so", "só"],
    ["mao", "mão"],
    ["tambem", "também"],
    ["valida", "válida"],
    ["possivel", "possível"],
    ["saida", "saída"],
  ].reduce((text, [plain, accented]) => replacePortugueseWord(text, plain, accented), mojibakeFixed);
}

function replacePortugueseWord(text: string, plain: string, accented: string) {
  return text.replace(new RegExp(`\\b${plain}\\b`, "gi"), (match) =>
    match[0] === match[0]?.toUpperCase()
      ? `${accented[0]?.toUpperCase() ?? ""}${accented.slice(1)}`
      : accented,
  );
}

function sanitizeQuestion(value: unknown, maxLength = 260) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\b(ignore|system prompt|developer|jailbreak|prompt injection)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function consumeLocalAiRate(userKey: string, limit: number) {
  const now = Date.now();
  const current = localAiRateBuckets.get(userKey);
  const bucket =
    current && current.resetAt > now ? current : { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  localAiRateBuckets.set(userKey, bucket);
  return bucket.count > limit;
}

function localAiUserKey(request: Request, body: Record<string, unknown>) {
  const explicit = readString(body, "user") || readString(body, "email");
  return explicit || getClientIp(request);
}

function compactLocalAiCacheSummary(summary: Record<string, unknown>) {
  return {
    entradaAtual: summary.entradaAtual,
    risco: summary.risco,
    tendenciaAtual: summary.tendenciaAtual,
    scoreEntrada: summary.scoreEntrada,
    estrategiaAtiva: summary.estrategiaAtiva,
  };
}

function recordLocalAiLog(
  user: string,
  event: string,
  question: string,
  response: string,
  model: string,
  provider: string,
  durationMs: number,
  status: string,
  error: string,
  data: Record<string, unknown>,
) {
  liveLocalAiLogs = [
    {
      id: crypto.randomUUID(),
      user,
      mesa: readString(data, "mesa") || "Mesa principal",
      event,
      question,
      response,
      model,
      provider,
      durationMs,
      estimatedCost: 0,
      status,
      error,
      timestamp: new Date().toISOString(),
      data,
    },
    ...liveLocalAiLogs,
  ].slice(0, 250);
}

function readServerBoolean(
  env: unknown,
  key: string,
  fallback: boolean,
  override?: boolean,
) {
  if (typeof override === "boolean") return override;
  const value = readServerEnvString(env, key, "");
  if (!value) return fallback;
  return ["1", "true", "sim", "yes", "on"].includes(value.trim().toLowerCase());
}

function safeServerNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashServerText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

async function handleSalesSettingsRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/sales/settings") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);

  return json({ salesSettings: publicSalesSettings() });
}

async function handleSiteContentRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/site-content") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Método não permitido." }, 405);

  return json({ siteContent: publicSiteContentSettings() });
}

async function handleBillingRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const billingPaths = new Set([
    "/billing/plans",
    "/billing/checkout",
    "/billing/subscription",
    "/billing/payments",
    "/webhooks/mercadopago",
    "/api/webhook/hubla",
    "/api/webhooks/hubla",
  ]);
  if (!billingPaths.has(url.pathname)) return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/billing/plans") {
    return json({
      plans: liveSalesSettings.salesClosed ? [] : getBillingPlans(env),
      salesSettings: publicSalesSettings(),
    });
  }

  if (request.method === "POST" && url.pathname === "/webhooks/mercadopago") {
    return handleMercadoPagoWebhook(request, url, env);
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/api/webhook/hubla" || url.pathname === "/api/webhooks/hubla")
  ) {
    return handleHublaWebhook(request, env);
  }

  if (request.method === "POST" && url.pathname === "/billing/checkout") {
    if (liveSalesSettings.salesClosed) {
      return json(
        { error: "Vendas encerradas no momento. Entre na fila de espera para a próxima abertura." },
        403,
      );
    }
    const body = readRecord(await request.json().catch(() => ({})));
    const plan = normalizeBillingPlanId(body.plan);
    if (!plan || plan === "free") {
      return json({ error: "Escolha um plano VIP ou Premium para abrir o checkout." }, 400);
    }
    const auth = await requireClientBillingSession(request, env);
    const client = auth.ok ? auth.client : await recoverCheckoutClientFromBody(env, request, body, auth);
    if (!client) {
      return json(
        {
          error:
            "Sessão expirada. Volte ao cadastro, entre com seu e-mail e tente comprar novamente.",
        },
        auth.status,
      );
    }
    return createMercadoPagoCheckout(request, env, client, plan);
  }

  const auth = await requireClientBillingSession(request, env);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (request.method === "GET" && url.pathname === "/billing/subscription") {
    refreshExpiredBillingForClient(auth.client);
    await saveLiveState(env);
    return json({
      subscription: buildBillingOverview(auth.client),
      plans: liveSalesSettings.salesClosed ? [] : getBillingPlans(env),
      salesSettings: publicSalesSettings(),
    });
  }

  if (request.method === "GET" && url.pathname === "/billing/payments") {
    const email = readString(auth.client, "email").toLowerCase();
    return json({
      payments: livePayments
        .filter((payment) => readString(payment, "email").toLowerCase() === email)
        .sort((a, b) => readString(b, "created_at").localeCompare(readString(a, "created_at"))),
    });
  }

  return json({ error: "Rota de assinatura não encontrada." }, 404);
}

async function requireClientBillingSession(
  request: Request,
  env: unknown,
): Promise<
  | { ok: true; client: Record<string, unknown>; session: SessionPayload }
  | { ok: false; status: number; error: string }
> {
  const token = getBearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Sessão obrigatória." };

  const session = await verifySessionToken(env, token);
  if (!session) return { ok: false, status: 401, error: "Sessão expirada." };
  if (session.scope !== "client") {
    return { ok: false, status: 403, error: "Use uma conta de cliente para assinar." };
  }

  const client =
    findClientByEmail(session.email) || (await hydrateClientFromBilling(env, session.email));
  if (!client) return { ok: false, status: 404, error: "Cliente não encontrado." };

  const sessionCheck = await validateClientSessionBinding(env, request, session, client);
  if (!sessionCheck.ok) {
    recordAccessEvent("client_session_blocked", {
      ...client,
      risk: "high",
      detail: sessionCheck.reason,
      ip_hash: sessionCheck.ipHash || "",
      user_agent_hash: sessionCheck.userAgentHash || "",
    });
    await saveLiveState(env);
    return { ok: false, status: 401, error: "Sessão inválida ou usada em outro dispositivo." };
  }

  return { ok: true, client, session };
}

async function recoverCheckoutClientFromBody(
  env: unknown,
  request: Request,
  body: Record<string, unknown>,
  auth: { ok: false; status: number; error: string },
) {
  const email = readString(body, "email").toLowerCase();
  if (!email) return null;

  const client =
    findClientByEmail(email) ||
    (await hydrateClientFromBilling(env, email)) ||
    (await createCheckoutLeadClientFromBody(env, request, body, email, auth));
  if (!client) return null;

  const binding = await requestSessionBinding(env, request);
  recordAccessEvent("checkout_session_recovered", {
    ...client,
    risk: auth.status >= 500 ? "medium" : "low",
    detail: `Checkout liberado por e-mail após falha de sessão: ${auth.error}`,
    ip_hash: binding.ipHash || "",
    user_agent_hash: binding.userAgentHash || "",
  });
  await saveLiveState(env);
  return client;
}

async function createCheckoutLeadClientFromBody(
  env: unknown,
  request: Request,
  body: Record<string, unknown>,
  email: string,
  auth: { ok: false; status: number; error: string },
) {
  if (!email.includes("@")) return null;

  const now = new Date().toISOString();
  const binding = await requestSessionBinding(env, request);
  const client: Record<string, unknown> = {
    id: crypto.randomUUID(),
    full_name: readString(body, "full_name") || readString(body, "name") || nameFromEmail(email),
    email,
    phone: readString(body, "phone"),
    phone_full: readString(body, "phone_full") || readString(body, "phoneFull"),
    city: readString(body, "city"),
    country: readString(body, "country"),
    country_code: readString(body, "country_code") || readString(body, "countryCode"),
    plan: "free",
    access_status: "pending",
    enabled: false,
    starts_at: todayIso(),
    validity_days: 0,
    expires_at: "",
    trial_started_at: "",
    trial_expires_at: "",
    trial_ip_hash: binding.ipHash,
    trial_user_agent_hash: binding.userAgentHash,
    trial_blocked_reason: `Checkout iniciado apos falha de sessao: ${auth.error}`,
    created_at: now,
    updated_at: now,
  };

  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("checkout_lead_created", {
    ...client,
    risk: "low",
    detail: "Contato pendente criado para nao perder checkout com sessao vencida.",
    ip_hash: binding.ipHash || "",
    user_agent_hash: binding.userAgentHash || "",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(email) || client;
}

async function createMercadoPagoCheckout(
  request: Request,
  env: unknown,
  client: Record<string, unknown>,
  plan: BillingPlanId,
) {
  const hublaCheckoutUrl = getHublaCheckoutUrl(plan, env);
  if (hublaCheckoutUrl) {
    const now = new Date().toISOString();
    const email = readString(client, "email").toLowerCase();
    const planConfig = getBillingPlan(plan, env);
    const subscriptionId = crypto.randomUUID();
    const externalReference = `sniperbo-hubla:${subscriptionId}:${email}:${plan}`;
    const subscription = upsertSubscriptionRecord({
      id: subscriptionId,
      user_id: readString(client, "id"),
      email,
      plan,
      status: "pending",
      provider: "hubla",
      provider_preference_id: "",
      provider_payment_id: "",
      external_reference: externalReference,
      starts_at: "",
      expires_at: "",
      created_at: now,
      updated_at: now,
    });
    const payment = upsertPaymentRecord({
      id: crypto.randomUUID(),
      user_id: readString(client, "id"),
      subscription_id: subscriptionId,
      email,
      plan,
      provider: "hubla",
      provider_preference_id: "",
      provider_payment_id: "",
      external_reference: externalReference,
      status: "pending",
      amount: planConfig.amount,
      currency: getMercadoPagoCurrency(env),
      paid_at: "",
      created_at: now,
      updated_at: now,
    });

    await saveLiveState(env);
    await persistBillingRecords(env, client, subscription, payment);
    return json({
      checkout_url: hublaCheckoutUrl,
      provider: "hubla",
      subscription: buildSubscriptionPublic(subscription),
    });
  }

  const accessToken = getMercadoPagoAccessToken(env);
  if (!accessToken) {
    return json(
      {
        error:
          "Checkout Hubla não configurado. Adicione HUBLA_CHECKOUT_URL ou o link do plano nos Secrets.",
      },
      503,
    );
  }

  const planConfig = getBillingPlan(plan, env);
  if (!planConfig || !planConfig.amount || planConfig.amount <= 0) {
    return json({ error: "Valor do plano não configurado." }, 503);
  }

  const now = new Date().toISOString();
  const email = readString(client, "email").toLowerCase();
  const subscriptionId = crypto.randomUUID();
  const externalReference = `sniperbo:${subscriptionId}:${email}:${plan}`;
  const origin = getPublicAppOrigin(request, env);
  const successUrl = readNamedServerSecret(
    env,
    "MERCADOPAGO_SUCCESS_URL",
    `${origin}/app/assinatura?status=approved`,
  );
  const pendingUrl = readNamedServerSecret(
    env,
    "MERCADOPAGO_PENDING_URL",
    `${origin}/app/assinatura?status=pending`,
  );
  const failureUrl = readNamedServerSecret(
    env,
    "MERCADOPAGO_FAILURE_URL",
    `${origin}/app/assinatura?status=failure`,
  );
  const preferenceBody = {
    items: [
      {
        id: planConfig.id,
        title: `SNIPER BO IA - ${planConfig.name}`,
        description: planConfig.description,
        quantity: 1,
        currency_id: getMercadoPagoCurrency(env),
        unit_price: planConfig.amount,
      },
    ],
    payer: {
      email,
      name: readString(client, "full_name") || nameFromEmail(email),
    },
    back_urls: {
      success: successUrl,
      pending: pendingUrl,
      failure: failureUrl,
    },
    auto_return: "approved",
    notification_url: `${origin}/webhooks/mercadopago`,
    external_reference: externalReference,
    metadata: {
      email,
      plan,
      subscription_id: subscriptionId,
    },
  };

  let preference: Record<string, unknown>;
  try {
    const response = await fetch(MERCADOPAGO_PREFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });
    preference = readRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      console.warn(`Mercado Pago preference falhou (${response.status}).`);
      return json({ error: "Não foi possível criar checkout no Mercado Pago." }, 502);
    }
  } catch (error) {
    console.warn("Falha de rede ao criar checkout Mercado Pago.", error);
    return json({ error: "Mercado Pago indisponível no momento." }, 502);
  }

  const preferenceId = readString(preference, "id");
  const checkoutUrl =
    readString(preference, "init_point") || readString(preference, "sandbox_init_point");
  if (!preferenceId || !checkoutUrl) {
    return json({ error: "Mercado Pago não retornou o link de checkout." }, 502);
  }

  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: "pending",
    provider: "mercadopago",
    provider_preference_id: preferenceId,
    external_reference: externalReference,
    starts_at: "",
    expires_at: "",
    created_at: now,
    updated_at: now,
  });
  const payment = upsertPaymentRecord({
    id: crypto.randomUUID(),
    user_id: readString(client, "id"),
    subscription_id: subscriptionId,
    email,
    plan,
    provider: "mercadopago",
    provider_preference_id: preferenceId,
    provider_payment_id: "",
    external_reference: externalReference,
    status: "pending",
    amount: planConfig.amount,
    currency: getMercadoPagoCurrency(env),
    paid_at: "",
    created_at: now,
    updated_at: now,
  });

  await saveLiveState(env);
  await persistBillingRecords(env, client, subscription, payment);
  return json({
    checkout_url: checkoutUrl,
    preference_id: preferenceId,
    subscription: buildSubscriptionPublic(subscription),
  });
}

async function handleMercadoPagoWebhook(request: Request, url: URL, env: unknown) {
  const rawBody = await request.text();
  const payload = readRecord(parseJsonSafe(rawBody));
  const paymentId = extractMercadoPagoPaymentId(url, payload);
  if (!paymentId) {
    return json({ ok: true, ignored: true });
  }

  const signatureOk = await validateMercadoPagoWebhookSignature(
    request,
    url,
    payload,
    env,
    paymentId,
  );
  if (!signatureOk) {
    return json({ error: "Webhook Mercado Pago inválido." }, 401);
  }

  const payment = await fetchMercadoPagoPayment(env, paymentId);
  if (!payment.ok) {
    return json({ error: payment.error }, payment.status);
  }

  const result = await applyMercadoPagoPayment(env, payment.payment);
  return json({ ok: true, status: result.status, activated: result.activated });
}

async function handleHublaWebhook(request: Request, env: unknown) {
  const rawBody = await request.text();
  if (!(await validateHublaWebhook(request, rawBody, env))) {
    return json({ error: "Webhook Hubla inválido." }, 401);
  }

  const payload = readRecord(parseJsonSafe(rawBody));
  const event = normalizeHublaWebhookPayload(payload, request, env);
  if (!event.email || !event.status) {
    return json({ ok: true, ignored: true, reason: "payload_incompleto" });
  }

  if (!["paid", "refunded", "chargeback", "canceled"].includes(event.status)) {
    return json({ ok: true, ignored: true, status: event.status });
  }

  const result = await applyHublaWebhookEvent(env, event, payload);
  return json({
    ok: true,
    provider: "hubla",
    status: event.status,
    activated: result.activated,
    deactivated: result.deactivated,
  });
}

async function validateHublaWebhook(request: Request, rawBody: string, env: unknown) {
  const token = getHublaWebhookToken(env);
  const incomingToken = request.headers.get("x-hubla-token")?.trim() || "";
  if (!token || !incomingToken || !constantTimeStringEqual(token, incomingToken)) {
    return false;
  }

  const hmacSecret = getHublaWebhookHmacSecret(env);
  if (!hmacSecret) return true;

  const signature =
    request.headers.get("x-hubla-signature")?.trim() ||
    request.headers.get("x-signature")?.trim() ||
    "";
  if (!signature) return false;

  const normalizedSignature = signature.replace(/^sha256=/i, "").trim();
  const expected = bytesToHex(await hmacSign(hmacSecret, rawBody));
  return constantTimeStringEqual(expected, normalizedSignature);
}

async function applyHublaWebhookEvent(
  env: unknown,
  event: ReturnType<typeof normalizeHublaWebhookPayload>,
  rawPayload: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const email = event.email.toLowerCase();
  const plan = event.plan || getHublaDefaultPlan(env);
  const planConfig = getBillingPlan(plan, env);
  const existingClient = findClientByEmail(email);
  const client = existingClient || {
    id: crypto.randomUUID(),
    full_name: event.fullName || nameFromEmail(email),
    email,
    phone: event.phone,
    city: "",
    country: "",
    password_hash: "",
    created_at: now,
  };
  const existingSubscription = latestSubscriptionForEmail(email);
  const subscriptionId =
    event.subscriptionId || readString(existingSubscription, "id") || crypto.randomUUID();
  const startsAt = event.paidAt ? event.paidAt.slice(0, 10) : todayIso();
  const expiresAt = event.expiresAt?.slice(0, 10) || addDaysIso(startsAt, planConfig.durationDays);
  const paymentId = event.paymentId || event.idempotencyKey || crypto.randomUUID();
  const shouldActivate = event.status === "paid";
  const shouldDeactivate = ["canceled", "refunded", "chargeback"].includes(event.status);

  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: shouldActivate ? "active" : shouldDeactivate ? "cancelled" : "pending",
    provider: "hubla",
    provider_preference_id: event.productId,
    provider_payment_id: paymentId,
    external_reference: event.eventType,
    starts_at: shouldActivate ? startsAt : readString(client, "starts_at"),
    expires_at: shouldActivate
      ? expiresAt
      : shouldDeactivate
        ? todayIso()
        : readString(client, "expires_at"),
    metadata: {
      hubla_event_type: event.eventType,
      hubla_product_id: event.productId,
      hubla_subscription_id: event.subscriptionId,
    },
    created_at: now,
    updated_at: now,
  });

  const payment = upsertPaymentRecord({
    id: event.idempotencyKey || paymentId,
    user_id: readString(client, "id"),
    subscription_id: subscriptionId,
    email,
    plan,
    provider: "hubla",
    provider_preference_id: event.productId,
    provider_payment_id: paymentId,
    external_reference: event.eventType,
    status: event.status,
    amount: event.amount,
    currency: event.currency || "BRL",
    paid_at: shouldActivate ? event.paidAt || now : "",
    raw_status: event.status,
    raw_payload: rawPayload,
    created_at: event.createdAt || now,
    updated_at: now,
  });

  let activated = false;
  let deactivated = false;
  let clientForPersistence = client;
  if (shouldActivate) {
    const updatedClient = {
      ...client,
      full_name: event.fullName || readString(client, "full_name") || nameFromEmail(email),
      phone: event.phone || readString(client, "phone"),
      plan,
      access_status: "approved",
      enabled: true,
      starts_at: startsAt,
      validity_days: planConfig.durationDays,
      expires_at: expiresAt,
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("hubla_payment_paid", {
      ...updatedClient,
      detail: `Assinatura ${planConfig.name} ativada via Hubla.`,
    });
    clientForPersistence = updatedClient;
    activated = true;
  } else if (shouldDeactivate) {
    const updatedClient = {
      ...client,
      plan,
      access_status: "expired",
      enabled: false,
      expires_at: todayIso(),
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("hubla_payment_reversed", {
      ...updatedClient,
      detail: `Assinatura Hubla desativada por status ${event.status}.`,
      risk: event.status === "chargeback" ? "high" : "medium",
    });
    clientForPersistence = updatedClient;
    deactivated = true;
  }

  await saveLiveState(env);
  await persistBillingRecords(env, clientForPersistence, subscription, payment);
  return { activated, deactivated };
}

async function fetchMercadoPagoPayment(
  env: unknown,
  paymentId: string,
): Promise<
  { ok: true; payment: Record<string, unknown> } | { ok: false; status: number; error: string }
> {
  const accessToken = getMercadoPagoAccessToken(env);
  if (!accessToken) {
    return { ok: false, status: 503, error: "Mercado Pago não configurado no servidor." };
  }

  try {
    const response = await fetch(`${MERCADOPAGO_PAYMENT_URL}/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const payment = readRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      console.warn(`Consulta de pagamento Mercado Pago falhou (${response.status}).`);
      return { ok: false, status: 502, error: "Não foi possível confirmar o pagamento." };
    }
    return { ok: true, payment };
  } catch (error) {
    console.warn("Falha de rede ao consultar pagamento Mercado Pago.", error);
    return { ok: false, status: 502, error: "Mercado Pago indisponível no momento." };
  }
}

async function applyMercadoPagoPayment(env: unknown, payment: Record<string, unknown>) {
  const status = readString(payment, "status") || "unknown";
  const paymentId = readString(payment, "id");
  const metadata = readRecord(payment.metadata);
  const externalReference = readString(payment, "external_reference");
  const parsedReference = parseBillingExternalReference(externalReference);
  const email = (
    readString(metadata, "email") ||
    parsedReference.email ||
    readString(readRecord(payment.payer), "email")
  ).toLowerCase();
  const plan = normalizeBillingPlanId(readString(metadata, "plan") || parsedReference.plan);
  const subscriptionId =
    readString(metadata, "subscription_id") ||
    parsedReference.subscriptionId ||
    crypto.randomUUID();
  const planConfig = plan ? getBillingPlan(plan, env) : null;
  const amount = Number(
    readRecord(payment.transaction_amount).value || payment.transaction_amount || 0,
  );
  const now = new Date().toISOString();
  const paidAt = readString(payment, "date_approved") || (status === "approved" ? now : "");

  const paymentRecord = upsertPaymentRecord({
    id: findPaymentId(paymentId, externalReference) || crypto.randomUUID(),
    user_id: "",
    subscription_id: subscriptionId,
    email,
    plan: plan || "free",
    provider: "mercadopago",
    provider_preference_id: readString(payment, "preference_id"),
    provider_payment_id: paymentId,
    external_reference: externalReference,
    status,
    amount: Number.isFinite(amount) ? amount : planConfig?.amount || 0,
    currency: readString(payment, "currency_id") || getMercadoPagoCurrency(env),
    paid_at: paidAt,
    raw_status: status,
    created_at: readString(payment, "date_created") || now,
    updated_at: now,
  });

  if (!email || !plan || !planConfig) {
    await saveLiveState(env);
    return { activated: false, status };
  }

  const existingClient = findClientByEmail(email);
  const client = existingClient || {
    id: crypto.randomUUID(),
    full_name: nameFromEmail(email),
    email,
    phone: "",
    city: "",
    country: "",
    password_hash: "",
    created_at: now,
  };

  let subscriptionStatus: SubscriptionStatus = status === "approved" ? "active" : "pending";
  if (["cancelled", "refunded", "charged_back"].includes(status)) subscriptionStatus = "cancelled";
  if (["rejected", "in_process", "pending"].includes(status)) subscriptionStatus = "pending";

  const startsAt = todayIso();
  const expiresAt = status === "approved" ? addDaysIso(startsAt, planConfig.durationDays) : "";
  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: subscriptionStatus,
    provider: "mercadopago",
    provider_preference_id: readString(payment, "preference_id"),
    provider_payment_id: paymentId,
    external_reference: externalReference,
    starts_at: status === "approved" ? startsAt : "",
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });

  let activated = false;
  let clientForPersistence = client;
  if (status === "approved") {
    const updatedClient = {
      ...client,
      plan,
      access_status: "approved",
      enabled: true,
      starts_at: startsAt,
      validity_days: planConfig.durationDays,
      expires_at: expiresAt,
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("payment_approved", {
      ...updatedClient,
      detail: `Assinatura ${planConfig.name} ativada via Mercado Pago.`,
    });
    clientForPersistence = updatedClient;
    activated = true;
  }

  await saveLiveState(env);
  await persistBillingRecords(env, clientForPersistence, subscription, paymentRecord);
  return { activated, status };
}

async function handleAdminApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const isAdminApiPath =
    url.pathname === "/admin/login" ||
    url.pathname === "/auth/check" ||
    url.pathname === "/auth/diagnostics" ||
    url.pathname === "/auth/register" ||
    url.pathname === "/auth/verify" ||
    url.pathname === "/admin/overview" ||
    url.pathname === "/admin/summary" ||
    url.pathname === "/admin/sales-settings" ||
    url.pathname === "/admin/site-content" ||
    url.pathname === "/admin/users" ||
    url.pathname.startsWith("/admin/users/") ||
    url.pathname === "/admin/logs" ||
    url.pathname === "/admin/broadcast" ||
    url.pathname === "/telegram-recipients" ||
    url.pathname.startsWith("/telegram-recipients/") ||
    url.pathname === "/module-toggles" ||
    url.pathname === "/security-events";

  if (!isAdminApiPath) return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/auth/diagnostics") {
    if (!isDashboardAuthorized(request, url, env)) {
      return json({ error: "Não autorizado." }, 401);
    }
    return json({
      hasAdminEmail: getAdminEmails(env).length > 0,
      hasAdminApproverEmail: getAdminApproverEmails(env).length > 0,
      hasAdminPassword: Boolean(getAdminPassword(env)),
      hasAdminToken: Boolean(getAdminToken(env)),
      hasSessionSecret: Boolean(getSessionSecret(env)),
      hasDurableClientStorage: Boolean(getSupabasePersistenceConfig(env)),
      durableClientStorageTable: LIVE_STATE_TABLE,
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/login") {
    const body = await request.json().catch(() => ({}));
    const loginEmail = readString(body, "email").toLowerCase();
    const adminRole = getAdminRoleForEmail(env, loginEmail);
    const adminPassword = getAdminPassword(env);

    if (!adminPassword || !getSessionSecret(env)) {
      return json({ error: "Credenciais admin não configuradas no servidor." }, 503);
    }

    if (adminRole && readString(body, "password") === adminPassword) {
      const binding = await requestSessionBinding(env, request);
      recordAccessEvent("admin_login", {
        email: loginEmail,
        full_name: nameFromEmail(loginEmail),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      const token = await issueSessionToken(
        env,
        {
          email: loginEmail,
          scope: adminRole === "owner" ? "owner" : "admin_approver",
          plan: adminRole === "owner" ? "vip" : "free",
          approved: adminRole === "owner",
          sid: crypto.randomUUID(),
          ua: binding.userAgentHash,
          iph: binding.ipHash,
        },
        ADMIN_SESSION_TTL_SECONDS,
      );
      return json({ token, email: loginEmail, role: adminRole });
    }

    return json({ error: "E-mail ou senha admin inválidos." }, 401);
  }

  if (request.method === "POST" && url.pathname === "/auth/check") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    const adminPassword = getAdminPassword(env);
    const adminRole = getAdminRoleForEmail(env, email);

    if (!getSessionSecret(env)) {
      return json({ error: "Sessão não configurada no servidor." }, 503);
    }

    if (adminRole === "owner" && adminPassword && password === adminPassword) {
      recordAccessEvent("owner_login", {
        email,
        full_name: nameFromEmail(email),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      return json({ access: await ownerAccess(env, email, request) });
    }

    if (adminRole === "admin" && adminPassword && password === adminPassword) {
      recordAccessEvent("admin_login", {
        email,
        full_name: nameFromEmail(email),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      return json({ access: await approverAccess(env, email, request) });
    }

    let client = findClientByEmail(email) || (await hydrateClientFromBilling(env, email));
    if (!client && password) {
      client = await ensureBlockedTrialClientForLogin(env, request, email, password);
    }
    if (!client) {
      return json({
        access: {
          registered: false,
          approved: false,
          access_mode: "none",
          access_status: "none",
          plan: "free",
          email,
          full_name: "",
          expires_at: "",
          reason: "E-mail ainda não cadastrado.",
        },
      });
    }

    const storedHash = readString(client, "password_hash");
    const legacyPassword = readString(client, "password");
    let ok = false;
    if (storedHash) {
      ok = await verifyPassword(password, storedHash);
    } else if (legacyPassword) {
      ok = legacyPassword === password;
      if (ok) {
        client.password_hash = await hashPassword(password);
        delete (client as Record<string, unknown>).password;
        await saveLiveState(env);
      }
    } else if (clientHasLiveAccess(client)) {
      return json(
        { error: "Compra localizada. Abra a aba Cadastro e crie sua senha para ativar o login." },
        401,
      );
    }
    if (!ok) {
      return json({ error: "Senha inválida." }, 401);
    }

    recordAccessEvent(client.enabled ? "client_login" : "client_pending_login", client);
    const access = await clientAccess(env, client, request);
    await saveLiveState(env);
    return json({ access });
  }

  if (request.method === "POST" && url.pathname === "/auth/register") {
    if (liveSalesSettings.salesClosed) {
      return json(
        { error: "Vagas encerradas no momento. Entre na fila de espera para a próxima abertura." },
        403,
      );
    }

    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    if (!email || !password) {
      return json({ error: "E-mail e senha são obrigatórios." }, 400);
    }
    if (!getSessionSecret(env)) {
      return json({ error: "Sessão não configurada no servidor." }, 503);
    }

    let existingIndex = liveClients.findIndex(
      (item) => readString(item, "email").toLowerCase() === email,
    );
    if (existingIndex < 0) {
      await hydrateClientFromBilling(env, email);
      existingIndex = liveClients.findIndex(
        (item) => readString(item, "email").toLowerCase() === email,
      );
    }
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const existingClient = existingIndex >= 0 ? liveClients[existingIndex] : {};
    const binding = await requestSessionBinding(env, request);
    const trialAccess = buildRegistrationTrialAccess(env, email, existingClient, binding, now);
    const client: Record<string, unknown> = {
      ...existingClient,
      id: existingIndex >= 0 ? existingClient.id : crypto.randomUUID(),
      full_name: readString(body, "full_name") || email,
      email,
      password_hash: passwordHash,
      phone: readString(body, "phone"),
      phone_full: readString(body, "phone_full"),
      city: readString(body, "city"),
      country: readString(body, "country"),
      country_code: readString(body, "country_code") || readString(body, "countryCode"),
      plan: trialAccess.plan,
      access_status: trialAccess.accessStatus,
      enabled: trialAccess.enabled,
      starts_at: trialAccess.startsAt,
      validity_days: trialAccess.validityDays,
      expires_at: trialAccess.expiresAt,
      trial_started_at: trialAccess.trialStartedAt,
      trial_expires_at: trialAccess.trialExpiresAt,
      trial_ip_hash: trialAccess.trialIpHash,
      trial_user_agent_hash: trialAccess.trialUserAgentHash,
      trial_blocked_reason: trialAccess.trialBlockedReason,
      created_at: existingIndex >= 0 ? existingClient.created_at || now : now,
      updated_at: now,
    };

    clearDeletedEntityForRecord(client);
    liveClients =
      existingIndex >= 0
        ? liveClients.map((item, index) => (index === existingIndex ? client : item))
        : [...liveClients, client];

    upsertRecipientFromClient(client);
    recordAccessEvent(existingIndex >= 0 ? "client_update" : "client_register", client);
    const access = await clientAccess(env, client, request);
    await saveLiveState(env);
    await persistBillingUser(env, client);
    return json({ access }, existingIndex >= 0 ? 200 : 201);
  }

  if (request.method === "POST" && url.pathname === "/auth/verify") {
    const body = readRecord(await request.json().catch(() => ({})));
    const token = readString(body, "token");
    const session = await verifySessionToken(env, token);
    if (!session) {
      return json({ valid: false }, 401);
    }

    if (session.scope === "owner") {
      if (!(await sessionMatchesRequestBinding(env, request, session))) {
        return json(
          { valid: false, reason: "Sessão inválida ou usada em outro dispositivo." },
          401,
        );
      }
      return json({ valid: true, access: await ownerAccess(env, session.email, request) });
    }

    if (session.scope === "admin_approver") {
      if (!(await sessionMatchesRequestBinding(env, request, session))) {
        return json(
          { valid: false, reason: "Sessão inválida ou usada em outro dispositivo." },
          401,
        );
      }
      return json({ valid: true, access: await approverAccess(env, session.email, request) });
    }

    let client =
      findClientByEmail(session.email) || (await hydrateClientFromBilling(env, session.email));
    if (!client && session.scope === "client") {
      client = await ensureSessionClientForExpiredTrial(env, request, session);
    }
    if (!client) {
      return json({
        valid: true,
        access: {
          registered: false,
          approved: false,
          access_mode: "none",
          access_status: "none",
          plan: "free",
          email: session.email,
          full_name: "",
          expires_at: "",
          reason: "E-mail ainda não cadastrado.",
          client_token: "",
        },
      });
    }

    const sessionCheck = await validateClientSessionBinding(env, request, session, client);
    if (!sessionCheck.ok) {
      recordAccessEvent("client_session_blocked", {
        ...client,
        risk: "high",
        detail: sessionCheck.reason,
        ip_hash: sessionCheck.ipHash || "",
        user_agent_hash: sessionCheck.userAgentHash || "",
      });
      await saveLiveState(env);
      return json({ valid: false, reason: "Sessão inválida ou usada em outro dispositivo." }, 401);
    }

    const access = await clientAccess(env, client, request, session);
    await saveLiveState(env);
    return json({ valid: true, access });
  }

  const adminRole = await getAdminRequestRole(request, env);
  if (!adminRole) {
    return json({ error: "Não autorizado." }, 401);
  }

  if (url.pathname === "/admin/sales-settings") {
    if (request.method === "GET") {
      return json({ salesSettings: adminSalesSettings(env) });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const nextClosed =
        typeof body.salesClosed === "boolean" ? body.salesClosed : Boolean(body.salesClosed);
      liveSalesSettings = {
        salesClosed: nextClosed,
        updated_at: new Date().toISOString(),
        updated_by: adminActorEmailFromRequest(request, env, adminRole),
      };
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: "sales-settings",
        targetEmail: "global",
        action: "UPDATE_USER",
        beforeJson: {},
        afterJson: adminSalesSettings(env),
        reason: nextClosed ? "Vendas encerradas pelo admin." : "Vendas reabertas pelo admin.",
      });
      const saveStatus = await saveLiveState(env);
      return json({ salesSettings: adminSalesSettings(env, saveStatus) });
    }

    return json({ error: "Método não permitido." }, 405);
  }

  if (url.pathname === "/admin/site-content") {
    if (request.method === "GET") {
      return json({ siteContent: adminSiteContentSettings(env) });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const before = liveSiteContentSettings;
      liveSiteContentSettings = normalizeSiteContentSettings(
        {
          ...body,
          popupId: readString(body, "popupId") || before.popupId,
          updatedAt: new Date().toISOString(),
          updatedBy: adminActorEmailFromRequest(request, env, adminRole),
        },
        before,
      );
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: "site-content",
        targetEmail: "global",
        action: "UPDATE_USER",
        beforeJson: before,
        afterJson: liveSiteContentSettings,
        reason: "Conteudo visual do site atualizado.",
      });
      const saveStatus = await saveLiveState(env);
      return json({ siteContent: adminSiteContentSettings(env, saveStatus) });
    }

    return json({ error: "Método não permitido." }, 405);
  }

  if (request.method === "GET" && url.pathname === "/admin/summary") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    return json({ summary: buildAdminSummary() });
  }

  if (request.method === "GET" && url.pathname === "/admin/overview") {
    await hydrateClientsFromBillingUsers(env);
    return json({ overview: buildAdminPanelOverview(syncAdminManagedUsers(env)) });
  }

  if (request.method === "GET" && url.pathname === "/admin/users") {
    await hydrateClientsFromBillingUsers(env);
    const users = syncAdminManagedUsers(env);
    await saveLiveState(env);
    return json({
      users,
      overview: buildAdminPanelOverview(users),
    });
  }

  const adminUserMatch = url.pathname.match(/^\/admin\/users\/([^/]+)(?:\/([^/]+))?$/);
  if (adminUserMatch) {
    const userId = decodeURIComponent(adminUserMatch[1]);
    const actionPath = adminUserMatch[2] || "";
    const target = findAdminManagedUser(userId, env);
    if (!target) return json({ error: "Usuário não encontrado." }, 404);

    if (request.method === "GET" && !actionPath) {
      return json({ user: target });
    }

    if (request.method === "DELETE" && !actionPath) {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await deleteAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        readString(body, "reason"),
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ ok: true, user: result.user });
    }

    if (request.method === "PATCH" && !actionPath) {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        body,
        "UPDATE_USER",
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "extend-access") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await extendAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        Number(body.days || 0),
        readString(body, "reason"),
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "block") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await blockAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        readString(body, "reason"),
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "unblock") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await unblockAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        readString(body, "reason"),
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "change-plan") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        body,
        "UPDATE_PLAN",
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "change-role") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        body,
        "UPDATE_ROLE",
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }
  }

  if (request.method === "GET" && url.pathname === "/admin/logs") {
    return json({
      logs: liveAdminActionLogs
        .map(normalizeAdminActionLog)
        .sort((a, b) => readString(b, "createdAt").localeCompare(readString(a, "createdAt")))
        .slice(0, 500),
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/broadcast") {
    const body = readRecord(await request.json().catch(() => ({})));
    const title = readString(body, "title");
    const message = readString(body, "message");
    if (!title || !message) return json({ error: "Título e mensagem são obrigatórios." }, 400);
    const before = liveSiteContentSettings;
    liveSiteContentSettings = normalizeSiteContentSettings(
      {
        ...before,
        popupEnabled: true,
        popupTitle: title,
        popupMessage: message,
        popupTone: normalizeAnnouncementTone(body.tone, before.popupTone),
        popupButtonLabel: readString(body, "buttonLabel"),
        popupButtonUrl: normalizeAssetUrl(body.buttonUrl),
        popupAudience: readString(body, "audience") || "all",
        popupId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        updatedBy: adminActorEmailFromRequest(request, env, adminRole),
      },
      before,
    );
    const log = recordAdminActionLog(env, request, adminRole, {
      targetUserId: "broadcast",
      targetEmail: readString(body, "audience") || "all",
      action: "UPDATE_USER",
      beforeJson: {},
      afterJson: {
        title,
        message,
        audience: readString(body, "audience") || "all",
      },
      reason: "Aviso geral disparado como pop-up.",
    });
    await saveLiveState(env);
    return json({ ok: true, log, siteContent: publicSiteContentSettings() });
  }

  if (url.pathname === "/telegram-recipients") {
    if (request.method === "GET") {
      const changed = syncRecipientsFromClients();
      if (changed) await saveLiveState(env);
      return json({
        recipients:
          adminRole === "owner"
            ? liveRecipients
            : liveRecipients.filter(
                (recipient) => readString(recipient, "access_status") === "pending",
              ),
      });
    }

    if (request.method === "POST") {
      if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
      const body = readRecord(await request.json().catch(() => ({})));
      const now = new Date().toISOString();
      const recipient = normalizeRecipient({
        ...body,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
      clearDeletedEntityForRecord(recipient);
      liveRecipients = [...liveRecipients, recipient];
      upsertClientFromRecipient(recipient);
      await updateClientPasswordFromBody(recipient, body);
      await saveLiveState(env);
      return json({ recipient }, 201);
    }
  }

  const recipientMatch = url.pathname.match(/^\/telegram-recipients\/([^/]+)$/);
  if (recipientMatch) {
    const recipientId = decodeURIComponent(recipientMatch[1]);
    const syncChanged = syncRecipientsFromClients();
    const index = liveRecipients.findIndex((recipient) => recipient.id === recipientId);

    if (index === -1) {
      const clientIndex = liveClients.findIndex((client) => client.id === recipientId);
      if (clientIndex === -1) {
        if (syncChanged) await saveLiveState(env);
        return json({ error: "Destinatário não encontrado." }, 404);
      }
      upsertRecipientFromClient(liveClients[clientIndex]);
      await saveLiveState(env);
      return handleAdminApiRequest(request, env);
    }

    if (request.method === "PATCH") {
      const body = readRecord(await request.json().catch(() => ({})));
      const patchBody =
        adminRole === "owner" ? body : approverPatchForPendingApproval(liveRecipients[index], body);
      if (!patchBody) return json({ error: "Permissao insuficiente." }, 403);
      const updated = normalizeRecipient({
        ...liveRecipients[index],
        ...patchBody,
        id: liveRecipients[index].id,
        created_at: liveRecipients[index].created_at,
        updated_at: new Date().toISOString(),
      });
      liveRecipients = liveRecipients.map((recipient, recipientIndex) =>
        recipientIndex === index ? updated : recipient,
      );
      upsertClientFromRecipient(updated);
      if (adminRole === "owner") {
        await updateClientPasswordFromBody(updated, body);
      }
      await saveLiveState(env);
      return json({ recipient: updated });
    }

    if (request.method === "DELETE") {
      if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
      const deletedRecipient = liveRecipients[index];
      markEntityDeleted(deletedRecipient);
      removeUserEntityEverywhere(deletedRecipient);
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: readString(deletedRecipient, "id"),
        targetEmail: readString(deletedRecipient, "email"),
        action: "DELETE_USER",
        beforeJson: deletedRecipient,
        afterJson: { deleted: true },
        reason: "Exclusao manual de cliente",
      });
      await deletePersistedBillingUser(env, deletedRecipient);
      await saveLiveState(env);
      return json({ ok: true });
    }
  }

  if (url.pathname === "/module-toggles") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    if (request.method === "GET") {
      return json({ moduleToggles: liveModuleToggles });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      liveModuleToggles = {
        tieAlert: typeof body.tieAlert === "boolean" ? body.tieAlert : liveModuleToggles.tieAlert,
        surfAnalyzer:
          typeof body.surfAnalyzer === "boolean"
            ? body.surfAnalyzer
            : liveModuleToggles.surfAnalyzer,
      };
      liveDashboardData = {
        ...liveDashboardData,
        moduleToggles: liveModuleToggles,
        updatedAt: new Date().toISOString(),
      };
      await saveLiveState(env);
      return json({ moduleToggles: liveModuleToggles });
    }
  }

  if (request.method === "GET" && url.pathname === "/security-events") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    const summary = summarizeSecurityEvents();
    return json({
      events: liveAccessEvents,
      summary,
    });
  }

  return json({ error: "Rota não encontrada." }, 404);
}

async function handleDashboardRequest(request: Request, env: unknown) {
  const url = new URL(request.url);

  if (
    request.method === "OPTIONS" &&
    (url.pathname === "/dashboard" || url.pathname === "/dashboard/signal")
  ) {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/dashboard") {
    if (!(await isDashboardReadAuthorized(request, url, env))) {
      return json({ error: "Não autorizado." }, 401);
    }

    const cycle = ensureDashboardDailyCycle(liveDashboardData);
    if (cycle.changed) {
      liveDashboardData = cycle.dashboard;
      await saveLiveState(env);
    }
    return json(liveDashboardData);
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/dashboard" || url.pathname === "/dashboard/signal")
  ) {
    if (!isDashboardAuthorized(request, url, env)) {
      return json({ error: "Não autorizado." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    liveDashboardData = updateDashboardData(liveDashboardData, body);
    await saveLiveState(env);
    return json({ ok: true, dashboard: liveDashboardData });
  }

  return null;
}

async function handleAdaptiveStrategyRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/adaptive-strategy/sync") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Não autorizado." }, 401);
  }

  const config = getSupabasePersistenceConfig(env);
  if (!config) {
    return json({
      mode: "local",
      storage: "local",
      lastSyncedAt: new Date().toISOString(),
      message:
        "Supabase service role não configurado no backend. Adaptive Engine mantido no histórico local.",
    });
  }

  const payload = readRecord(await request.json().catch(() => ({}))) as AdaptiveStrategySyncPayload;
  const records = normalizeAdaptiveRoundRows(payload.records);
  const patterns = normalizeAdaptivePatternRows(payload.patterns);
  const decision = normalizeAdaptiveDecisionRow(payload.decision, payload.logs);

  const [roundsSaved, patternsSaved, decisionSaved] = await Promise.all([
    saveSupabaseRows(config, "adaptive_strategy_rounds", records, "round_key"),
    saveSupabaseRows(config, "adaptive_strategy_patterns", patterns, "pattern_id"),
    saveSupabaseRows(config, "adaptive_strategy_decision_logs", decision ? [decision] : [], "decision_key"),
  ]);

  if (!roundsSaved || !patternsSaved || !decisionSaved) {
    return json(
      {
        mode: "error",
        storage: "error",
        lastSyncedAt: new Date().toISOString(),
        error: "Não foi possível salvar todos os dados do Adaptive Engine no Supabase.",
      },
      502,
    );
  }

  return json({
    mode: "database",
    storage: "database",
    lastSyncedAt: new Date().toISOString(),
    message: "Rodadas, padroes e logs do Adaptive Engine salvos no Supabase.",
  });
}

function normalizeAdaptiveRoundRows(value: unknown[] | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = readRecord(item);
      const result = readAdaptiveSide(record.result);
      if (!result) return null;
      const roundKey = readString(record, "key");
      const timestamp = safeIso(readString(record, "timestamp"));
      const capturedAt = safeIso(readString(record, "capturedAt")) || new Date().toISOString();
      if (!roundKey || !timestamp) return null;

      return {
        round_key: roundKey,
        table_name: readString(record, "tableName") || "Mesa principal",
        round_id: Math.floor(Number(record.roundId) || 0),
        day: readString(record, "day") || timestamp.slice(0, 10),
        time_label: readString(record, "time") || "--:--",
        result,
        banker_score: Math.floor(Number(record.bankerScore) || 0),
        player_score: Math.floor(Number(record.playerScore) || 0),
        tie_multiplier: readNullableNumber(record.tieMultiplier),
        previous_sequence: readString(record, "previousSequence"),
        next_result: readAdaptiveSide(record.nextResult),
        played_at: timestamp,
        source_updated_at: safeIso(readString(record, "sourceUpdatedAt")) || null,
        captured_at: capturedAt,
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function normalizeAdaptivePatternRows(value: unknown[] | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const pattern = readRecord(item);
      const direction = readAdaptiveSide(pattern.direction);
      const patternId = readString(pattern, "id");
      if (!patternId || !direction) return null;

      const sequence = readRecord(pattern.greenRedSequence);
      return {
        pattern_id: patternId,
        label: readString(pattern, "label") || patternId,
        kind: readString(pattern, "kind") || "sequence",
        table_name: readString(pattern, "tableName") || "Mesa principal",
        hour_label: readString(pattern, "hour") || null,
        direction,
        occurrences: safeInteger(pattern.occurrences),
        pulled_player: safeInteger(pattern.pulledPlayer),
        pulled_banker: safeInteger(pattern.pulledBanker),
        pulled_tie: safeInteger(pattern.pulledTie),
        sg: safeInteger(pattern.sg),
        g1: safeInteger(pattern.g1),
        red: safeInteger(pattern.red),
        expired: safeInteger(pattern.expired),
        assertiveness: safeNumber(pattern.assertiveness),
        assertiveness_sg: safeNumber(pattern.assertivenessSg),
        assertiveness_g1: safeNumber(pattern.assertivenessG1),
        last_seen_at: safeIso(readString(pattern, "lastSeenAt")) || null,
        green_red_sequence_type: readString(sequence, "type") || "none",
        green_red_sequence_count: safeInteger(sequence.count),
        status: readAdaptiveStatus(pattern.status),
        score: safeNumber(pattern.score),
        sample_weak: Boolean(pattern.sampleWeak),
        blocked: Boolean(pattern.blocked),
        paused_reason: readString(pattern, "pausedReason") || null,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function normalizeAdaptiveDecisionRow(
  decision: Record<string, unknown> | undefined,
  logs: unknown[] | undefined,
) {
  const record = readRecord(decision);
  if (!Object.keys(record).length) return null;
  const side = readAdaptiveSide(record.side);
  const finalScore = safeNumber(record.finalScore);
  const allowed = Boolean(record.allowed);
  const explanation = Array.isArray(record.explanation) ? record.explanation : [];
  const parts = Array.isArray(record.parts) ? record.parts : [];
  const rawLogs = Array.isArray(logs) ? logs : [];

  return {
    decision_key: `${new Date().toISOString().slice(0, 16)}:${side ?? "NONE"}:${finalScore}:${allowed}`,
    final_score: finalScore,
    allowed,
    side,
    explanation,
    score_parts: parts,
    raw_logs: rawLogs,
  };
}

async function saveSupabaseRows(
  config: { url: string; key: string },
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string,
) {
  if (!rows.length) return true;

  try {
    const response = await fetch(
      `${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumn)}`,
      {
        method: "POST",
        headers: {
          ...supabasePersistenceHeaders(config.key),
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
      },
    );
    if (!response.ok) {
      console.warn(`Adaptive Engine: falha ao salvar ${table} (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`Adaptive Engine: falha de conexão ao salvar ${table}.`, error);
    return false;
  }
}

function readAdaptiveSide(value: unknown) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "B" || text === "BANKER" || text === "BANCA") return "BANKER";
  if (text === "P" || text === "PLAYER" || text === "JOGADOR") return "PLAYER";
  if (text === "T" || text === "TIE" || text === "EMPATE") return "TIE";
  return null;
}

function readAdaptiveStatus(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "quente" || text === "pausado" || text === "observacao" || text === "frio") {
    return text;
  }
  return "frio";
}

function safeIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeInteger(value: unknown) {
  const number = Math.floor(Number(value) || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function updateDashboardData(current: LiveDashboardData, body: unknown) {
  const cycle = ensureDashboardDailyCycle(current);
  const currentDashboard = cycle.dashboard;
  const incoming = readRecord(readRecord(body).dashboard || body);
  const cycleDate = currentDashboardCycleDate();
  const incomingCycleDate = readDashboardCycleDate(incoming);
  const acceptsCurrentCycle = !incomingCycleDate || incomingCycleDate === cycleDate;
  const acceptsDailyCounters =
    acceptsCurrentCycle &&
    (!currentDashboard.strictDailyCounters || incomingCycleDate === cycleDate);
  const pickedSections = acceptsCurrentCycle ? pickDashboardSections(incoming) : {};
  if (!acceptsDailyCounters) {
    delete pickedSections.mainScoreboard;
    delete pickedSections.tieAlertScoreboard;
    delete pickedSections.surfAnalyzerScoreboard;
    delete pickedSections.entryModeStats;
    if (pickedSections.neuralReading) {
      pickedSections.neuralReading = resetNeuralReadingDailyCounters(pickedSections.neuralReading);
    }
  }
  const rounds =
    acceptsCurrentCycle && Array.isArray(incoming.rounds)
      ? normalizeRounds(incoming.rounds)
      : currentDashboard.rounds;

  const nextDashboard: LiveDashboardData = {
    ...currentDashboard,
    ...pickedSections,
    mockMode: false,
    user: { ...currentDashboard.user, ...readRecord(incoming.user) },
    rounds,
    currentSignal: acceptsCurrentCycle
      ? normalizeSignal(readMainSignal(incoming), currentDashboard.currentSignal)
      : currentDashboard.currentSignal,
    currentTieAlert: normalizeTieAlert(
      acceptsCurrentCycle ? incoming.currentTieAlert || incoming.tieAlert : {},
      currentDashboard.currentTieAlert,
    ),
    pressureSeries:
      acceptsCurrentCycle && Array.isArray(incoming.pressureSeries)
        ? incoming.pressureSeries
        : currentDashboard.pressureSeries,
    updatedAt: new Date().toISOString(),
    cycleDate,
    dailyCycleDate: cycleDate,
    strictDailyCounters: currentDashboard.strictDailyCounters && incomingCycleDate !== cycleDate,
  };

  return trackServerEntryModeStats(trackServerNeuralSequences(nextDashboard, currentDashboard));
}

function ensureDashboardDailyCycle(
  dashboard: DashboardData & { updatedAt?: string; cycleDate?: string; dailyCycleDate?: string },
) {
  const cycleDate = currentDashboardCycleDate();
  if (readDashboardCycleDate(dashboard) === cycleDate) {
    return {
      dashboard: {
        ...dashboard,
        cycleDate,
        dailyCycleDate: cycleDate,
        strictDailyCounters:
          (dashboard as unknown as { strictDailyCounters?: boolean }).strictDailyCounters ?? false,
      },
      changed: false,
    };
  }

  return {
    dashboard: resetDashboardDailyCycle(dashboard, cycleDate),
    changed: true,
  };
}

function resetDashboardDailyCycle(
  dashboard: DashboardData & { updatedAt?: string },
  cycleDate = currentDashboardCycleDate(),
): LiveDashboardData {
  return {
    ...dashboard,
    mockMode: false,
    rounds: [],
    currentSignal: {
      id: "waiting",
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: 0,
      lastResult: null,
    },
    currentTieAlert: {
      id: "current-tie",
      level: "Baixo",
      confidence: 0,
      validityRounds: 0,
      status: "expired",
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
      reason: "Novo ciclo diario iniciado. Aguardando leitura atual da mesa.",
      panels: {
        big_road: "Aguardando primeiras rodadas do ciclo.",
        big_eye_boy: "Aguardando primeiras rodadas do ciclo.",
        small_road: "Aguardando primeiras rodadas do ciclo.",
        cockroach_pig: "Aguardando primeiras rodadas do ciclo.",
      },
      surf_prediction_side: "NONE",
      surf_prediction_status: "EXPIRED",
      surf_prediction_confidence: 0,
      surf_prediction_window: 0,
    },
    neuralReading: {
      mode: "SCANNING",
      alertas: 0,
      acertos: 0,
      greenSemGale: 0,
      greenG1: 0,
      erros: 0,
      reds: 0,
      assertividade: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
      maxSequencePositive: 0,
      maxSequenceNegative: 0,
    },
    engineDecision: {
      state: "AGUARDAR",
      reason: "Novo ciclo diario iniciado. Aguardando primeiras rodadas.",
      confidence: 0,
      debug: "cycle=novo",
    },
    mainScoreboard: {
      greens: 0,
      greensG1: 0,
      reds: 0,
      totalGreens: 0,
      totalEntries: 0,
      assertiveness: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
    },
    entryModeStats: emptyServerEntryModeStatsByMode(),
    entryModeSignalModes: {},
    entryModeCountedResults: {},
    latestEntryModeSignalId: undefined,
    latestEntryModeSignalModes: [],
    neuralSequenceLastOutcome: null,
    tieAlertScoreboard: {
      greenTieAlerts: 0,
      expired: 0,
      totalAlerts: 0,
      assertiveness: 0,
      sequencePositive: 0,
      sequenceExpired: 0,
    },
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
    updatedAt: new Date().toISOString(),
    cycleDate,
    dailyCycleDate: cycleDate,
    strictDailyCounters: true,
  };
}

function resetNeuralReadingDailyCounters(
  reading: DashboardData["neuralReading"],
): DashboardData["neuralReading"] {
  if (!reading) return reading;
  return {
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
    maxSequencePositive: 0,
    maxSequenceNegative: 0,
  };
}

function trackServerNeuralSequences(
  dashboard: LiveDashboardData,
  previousDashboard: LiveDashboardData,
): LiveDashboardData {
  if (!dashboard.neuralReading && !dashboard.neuralScoreboard) return dashboard;

  const totals = serverReadNeuralTotalsFromDashboard(dashboard);
  const previousTotals = serverReadNeuralTotalsFromDashboard(previousDashboard);
  const countersWentBack = totals.greens < previousTotals.greens || totals.reds < previousTotals.reds;
  const previousPositive = countersWentBack
    ? 0
    : serverSafeCounter(
        previousDashboard.neuralReading?.sequencePositive ??
          previousDashboard.neuralScoreboard?.sequencePositive,
      );
  const previousNegative = countersWentBack
    ? 0
    : serverSafeCounter(
        previousDashboard.neuralReading?.sequenceNegative ??
          previousDashboard.neuralScoreboard?.sequenceNegative,
      );
  const explicitPositive = serverSafeCounter(
    dashboard.neuralReading?.sequencePositive ?? dashboard.neuralScoreboard?.sequencePositive,
  );
  const explicitNegative = serverSafeCounter(
    dashboard.neuralReading?.sequenceNegative ?? dashboard.neuralScoreboard?.sequenceNegative,
  );
  const hasExplicitSequence =
    (explicitPositive > 0 && explicitNegative === 0) ||
    (explicitNegative > 0 && explicitPositive === 0);
  let sequencePositive = hasExplicitSequence ? explicitPositive : previousPositive;
  let sequenceNegative = hasExplicitSequence ? explicitNegative : previousNegative;
  let lastOutcome: LiveDashboardData["neuralSequenceLastOutcome"] =
    previousDashboard.neuralSequenceLastOutcome ??
    inferServerNeuralOutcome(previousPositive, previousNegative);

  const greenDelta = countersWentBack
    ? totals.greens
    : Math.max(0, totals.greens - previousTotals.greens);
  const redDelta = countersWentBack
    ? totals.reds
    : Math.max(0, totals.reds - previousTotals.reds);

  if (hasExplicitSequence) {
    lastOutcome = explicitPositive > 0 ? "GREEN" : "RED";
  } else if (greenDelta > 0 && redDelta > 0) {
    sequencePositive = 0;
    sequenceNegative = 0;
    lastOutcome = null;
  } else if (greenDelta > 0) {
    sequencePositive = lastOutcome === "GREEN" ? previousPositive + greenDelta : greenDelta;
    sequenceNegative = 0;
    lastOutcome = "GREEN";
  } else if (redDelta > 0) {
    sequenceNegative = lastOutcome === "RED" ? previousNegative + redDelta : redDelta;
    sequencePositive = 0;
    lastOutcome = "RED";
  }

  const previousMaxPositive = countersWentBack
    ? 0
    : serverSafeCounter(
        previousDashboard.neuralReading?.maxSequencePositive ??
          previousDashboard.neuralScoreboard?.maxSequencePositive,
      );
  const previousMaxNegative = countersWentBack
    ? 0
    : serverSafeCounter(
        previousDashboard.neuralReading?.maxSequenceNegative ??
          previousDashboard.neuralScoreboard?.maxSequenceNegative,
      );
  const explicitMaxPositive = serverSafeCounter(
    dashboard.neuralReading?.maxSequencePositive ?? dashboard.neuralScoreboard?.maxSequencePositive,
  );
  const explicitMaxNegative = serverSafeCounter(
    dashboard.neuralReading?.maxSequenceNegative ?? dashboard.neuralScoreboard?.maxSequenceNegative,
  );
  const maxSequencePositive = Math.max(previousMaxPositive, explicitMaxPositive, sequencePositive);
  const maxSequenceNegative = Math.max(previousMaxNegative, explicitMaxNegative, sequenceNegative);
  const neuralReading = dashboard.neuralReading
    ? {
        ...dashboard.neuralReading,
        sequencePositive,
        sequenceNegative,
        maxSequencePositive,
        maxSequenceNegative,
      }
    : dashboard.neuralReading;
  const neuralScoreboard = dashboard.neuralScoreboard
    ? {
        ...dashboard.neuralScoreboard,
        sequencePositive,
        sequenceNegative,
        maxSequencePositive,
        maxSequenceNegative,
      }
    : dashboard.neuralScoreboard;

  return {
    ...dashboard,
    neuralReading,
    neuralScoreboard,
    neuralSequenceLastOutcome: lastOutcome,
  };
}

function serverReadNeuralTotalsFromDashboard(dashboard: Pick<DashboardData, "neuralReading" | "neuralScoreboard">) {
  const reading = dashboard.neuralReading;
  const scoreboard = dashboard.neuralScoreboard;
  const greenSemGale = serverSafeCounter(scoreboard?.greenSemGale ?? reading?.greenSemGale);
  const greenG1 = serverSafeCounter(scoreboard?.greenG1 ?? reading?.greenG1);
  const splitGreens = greenSemGale + greenG1;
  const greens =
    splitGreens > 0
      ? splitGreens
      : serverSafeCounter(scoreboard?.greens ?? scoreboard?.acertos ?? reading?.acertos);
  const reds = serverSafeCounter(scoreboard?.reds ?? scoreboard?.erros ?? reading?.reds ?? reading?.erros);
  return { greens, reds };
}

function inferServerNeuralOutcome(
  sequencePositive: number,
  sequenceNegative: number,
): LiveDashboardData["neuralSequenceLastOutcome"] {
  if (sequencePositive > 0 && sequenceNegative === 0) return "GREEN";
  if (sequenceNegative > 0 && sequencePositive === 0) return "RED";
  return null;
}

function readDashboardCycleDate(value: unknown) {
  const record = readRecord(value);
  const explicit = readString(record, "cycleDate") || readString(record, "dailyCycleDate");
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const updatedAt = readString(record, "updatedAt");
  if (!updatedAt) return "";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  return currentDashboardCycleDate(date);
}

function currentDashboardCycleDate(now = new Date()) {
  const parts = dashboardCycleDateParts(now);
  if (parts.hour === "00" && parts.minute === "00") {
    return dashboardCycleDateParts(new Date(now.getTime() - 60_000)).date;
  }
  return parts.date;
}

function dashboardCycleDateParts(value: Date) {
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

function pickDashboardSections(incoming: Record<string, unknown>): Partial<LiveDashboardData> {
  const out: Partial<LiveDashboardData> = {};
  if (incoming.currentSurfAlert)
    out.currentSurfAlert = incoming.currentSurfAlert as DashboardData["currentSurfAlert"];
  if (incoming.surfAlert)
    out.currentSurfAlert = incoming.surfAlert as DashboardData["currentSurfAlert"];
  if (incoming.neuralReading)
    out.neuralReading = incoming.neuralReading as DashboardData["neuralReading"];
  if (incoming.neuralScoreboard)
    out.neuralScoreboard = incoming.neuralScoreboard as DashboardData["neuralScoreboard"];
  if (incoming.neural_scoreboard)
    out.neuralScoreboard = incoming.neural_scoreboard as DashboardData["neuralScoreboard"];
  if (incoming.moduleToggles)
    out.moduleToggles = incoming.moduleToggles as DashboardData["moduleToggles"];
  if (incoming.engineDecision)
    out.engineDecision = incoming.engineDecision as DashboardData["engineDecision"];
  if (incoming.mainScoreboard)
    out.mainScoreboard = incoming.mainScoreboard as DashboardData["mainScoreboard"];
  if (incoming.tieAlertScoreboard)
    out.tieAlertScoreboard = incoming.tieAlertScoreboard as DashboardData["tieAlertScoreboard"];
  if (incoming.surfAnalyzerScoreboard)
    out.surfAnalyzerScoreboard =
      incoming.surfAnalyzerScoreboard as DashboardData["surfAnalyzerScoreboard"];
  const incomingEntryModeStats = normalizeServerIncomingEntryModeStats(
    incoming.entryModeStats ?? incoming.entry_mode_stats,
  );
  if (incomingEntryModeStats) out.entryModeStats = incomingEntryModeStats;
  if (incoming.entryModeSignalModes)
    out.entryModeSignalModes = normalizeServerSignalModes(incoming.entryModeSignalModes);
  if (incoming.entryModeCountedResults)
    out.entryModeCountedResults = normalizeServerCountedResults(incoming.entryModeCountedResults);
  if (incoming.latestEntryModeSignalId)
    out.latestEntryModeSignalId = String(incoming.latestEntryModeSignalId);
  if (incoming.latestEntryModeSignalModes)
    out.latestEntryModeSignalModes = normalizeServerModeList(incoming.latestEntryModeSignalModes);
  return out;
}

function readMainSignal(payload: Record<string, unknown>) {
  return readRecord(
    payload.currentSignal ||
      payload.current_signal ||
      payload.mainSignal ||
      payload.main_signal ||
      payload.primarySignal ||
      payload.primary_signal ||
      payload.entradaPrincipal ||
      payload.entrada_principal ||
      payload.sinalPrincipal ||
      payload.sinal_principal ||
      payload.signal ||
      payload.sinal ||
      payload,
  );
}

function normalizeSignal(
  signal: Record<string, unknown>,
  fallback: DashboardData["currentSignal"],
): DashboardData["currentSignal"] {
  const side = normalizeSignalSide(signal.side || signal.direcao || signal.entry || signal.entrada);
  const status = normalizeSignalStatus(signal.status || signal.resultado || signal.state, side);
  const protection = String(
    signal.protection || signal.validade || signal.gale || fallback.protection || "G1",
  );
  const terminalStatus = terminalSignalStatus(status);
  const incomingLastResult = (signal.lastResult ??
    null) as DashboardData["currentSignal"]["lastResult"];
  const lastResult: DashboardData["currentSignal"]["lastResult"] =
    incomingLastResult ||
    fallback.lastResult ||
    (terminalStatus && (side === "BANKER" || side === "PLAYER")
      ? {
          id: String(signal.id || signal.signalId || `result-${Date.now()}`),
          side,
          status: terminalStatus,
          protection,
          finishedAt: readString(signal, "finishedAt") || new Date().toISOString(),
        }
      : null);

  if (terminalStatus) {
    return {
      id: "waiting",
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: clampPercent(
        signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength,
      ),
      lastResult,
    };
  }

  return {
    id: String(signal.id || signal.signalId || `signal-${Date.now()}`),
    side,
    status,
    protection,
    strength: clampPercent(
      signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength,
    ),
    lastResult,
  };
}

function terminalSignalStatus(status: DashboardData["currentSignal"]["status"]) {
  if (status === "green" || status === "green_g1" || status === "red") return status;
  return null;
}

function trackServerEntryModeStats(dashboard: LiveDashboardData): LiveDashboardData {
  const signal = dashboard.currentSignal;
  const signalModes = normalizeServerSignalModes(dashboard.entryModeSignalModes);
  const countedResults = normalizeServerCountedResults(dashboard.entryModeCountedResults);
  const stats = normalizeServerEntryModeStatsByMode(dashboard.entryModeStats);
  let latestSignalId = String(dashboard.latestEntryModeSignalId || "");
  let latestSignalModes = normalizeServerModeList(dashboard.latestEntryModeSignalModes);

  if (isServerEntrySide(signal.side) && signal.status === "pending") {
    const modes = serverModesThatWouldAcceptEntry(dashboard);
    if (!sameServerModeList(signalModes[signal.id], modes)) {
      signalModes[signal.id] = modes;
      latestSignalId = signal.id;
      latestSignalModes = modes;
    }
  }

  const result = signal.lastResult;
  if (result) {
    const resultKey = serverEntryModeResultKey(result);
    if (!countedResults[resultKey]) {
      const resultModes = signalModes[result.id] ?? latestSignalModes ?? [];
      for (const mode of resultModes) {
        incrementServerEntryModeStats(stats, mode, result);
      }
      countedResults[resultKey] = true;
    }
  }

  return {
    ...dashboard,
    entryModeStats: stats,
    entryModeSignalModes: pruneServerSignalModes(signalModes),
    entryModeCountedResults: pruneServerCountedResults(countedResults),
    latestEntryModeSignalId: latestSignalId || undefined,
    latestEntryModeSignalModes: latestSignalModes,
  };
}

function serverModesThatWouldAcceptEntry(data: DashboardData) {
  return ACTIVE_ENTRY_MODES.filter((mode) => !serverBuildEntryModeFilter(data, mode));
}

function serverBuildEntryModeFilter(data: DashboardData, mode: ActiveEntryMode) {
  const signal = data.currentSignal;
  if (mode === "aggressive") return null;
  if (signal.status !== "pending" || !isServerEntrySide(signal.side)) return null;

  const confidence = clampPercent(data.engineDecision?.confidence ?? 0);
  const strength = clampPercent(signal.strength ?? 0);
  const surfRisk = serverOppositeSurfRisk(data, signal.side);
  const neuralRisk = serverHasNeuralRisk(data.neuralReading);
  const sniperNeuralGate = serverReadSniperNeuralGate(data.neuralReading, signal.side);
  const tieActive = data.currentTieAlert.status === "active";
  const tieHigh = tieActive && serverNormalizeText(data.currentTieAlert.level).includes("ALTO");
  const engineConfirmed = data.engineDecision.state === "ENTRADA";

  if (mode === "sniper") {
    return Boolean(
      !engineConfirmed ||
      confidence < 80 ||
      strength < 78 ||
      tieActive ||
      surfRisk >= 40 ||
      neuralRisk ||
      !sniperNeuralGate.accepted,
    );
  }

  return Boolean(
    !engineConfirmed || confidence < 70 || strength < 70 || tieHigh || surfRisk >= 65 || neuralRisk,
  );
}

function incrementServerEntryModeStats(
  statsByMode: Partial<Record<ActiveEntryMode, EntryModeStats>>,
  mode: ActiveEntryMode,
  result: NonNullable<DashboardData["currentSignal"]["lastResult"]>,
) {
  const current = normalizeServerEntryModeStatsRecord(statsByMode[mode]);
  const kind = serverReadEntryModeResultKind(result);
  const sg = serverSafeCounter(current.greenSemGale ?? current.sg ?? current.greens);
  const g1 = serverSafeCounter(current.greenG1 ?? current.greensG1);
  const emp = serverSafeCounter(current.emp ?? current.ties);
  const reds = serverSafeCounter(current.reds);

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
    assertiveness:
      totalEntries > 0 ? Math.round((totalGreens / totalEntries) * 1000) / 10 : undefined,
  };
}

function serverReadEntryModeResultKind(
  result: NonNullable<DashboardData["currentSignal"]["lastResult"]>,
) {
  const record = readRecord(result);
  const status = serverNormalizeText(readString(record, "status"));
  const side = serverNormalizeText(readString(record, "side"));
  const protection = serverNormalizeText(readString(record, "protection"));
  if (
    status.includes("TIE") ||
    status.includes("EMPATE") ||
    status.includes("EMP") ||
    side === "TIE" ||
    side === "EMPATE"
  )
    return "emp";
  if (status.includes("RED") || status.includes("LOSS")) return "red";
  if (status.includes("G1") || protection.includes("G1")) return "g1";
  return "sg";
}

function serverEntryModeResultKey(
  result: NonNullable<DashboardData["currentSignal"]["lastResult"]>,
) {
  const record = readRecord(result);
  return [
    readString(record, "id"),
    readString(record, "status"),
    readString(record, "side"),
    readString(record, "protection"),
    readString(record, "finishedAt"),
  ].join(":");
}

function isServerEntrySide(side: CurrentSignalSide): side is SignalSide {
  return side === "BANKER" || side === "PLAYER";
}

function serverOppositeSurfRisk(data: DashboardData, side: SignalSide) {
  const alert = data.currentSurfAlert;
  if (!alert) return 0;
  const surfSide =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side;
  if (surfSide === "NONE" || surfSide === side) return 0;
  return clampPercent(alert.surf_break_risk ?? alert.surf_risk ?? 0);
}

function serverHasNeuralRisk(reading?: NeuralReading | null) {
  if (!reading) return false;
  const status = serverNormalizeText(reading.paganteStatus);
  return Boolean(
    reading.isRedAlert ||
    reading.isSaturated ||
    status.includes("RISCO") ||
    status.includes("ESTICADO"),
  );
}

function serverReadSniperNeuralGate(
  reading: NeuralReading | null | undefined,
  entrySide: SignalSide,
) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number")
    return { accepted: false };
  if (reading.origemTipo === "OPOSTO") return { accepted: false };
  if (serverReadPaganteKind(reading) !== "favorable") return { accepted: false };

  const paganteSide = reading.direcao ?? reading.origem ?? null;
  if (paganteSide !== entrySide) return { accepted: false };

  const performance = serverReadNeuralPerformance(reading);
  return {
    accepted: Boolean(
      performance &&
      performance.greens > 0 &&
      performance.assertiveness >= SNIPER_NEURAL_ASSERTIVENESS_MIN,
    ),
  };
}

function serverReadPaganteKind(reading?: NeuralReading | null): "favorable" | "watch" | "risk" {
  if (!reading) return "watch";
  const status = serverNormalizeText(reading.paganteStatus);
  if (
    reading.isRedAlert ||
    reading.isSaturated ||
    status.includes("RISCO") ||
    status.includes("ESTICADO")
  ) {
    return "risk";
  }
  if (
    reading.mode === "OBSERVING" ||
    status.includes("INICIANTE") ||
    status.includes("OBSERV") ||
    status.includes("POS-EMPATE") ||
    status.includes("POS EMPATE")
  ) {
    return "watch";
  }
  return "favorable";
}

function serverReadNeuralPerformance(reading: NeuralReading) {
  const greenSemGale = serverNumberOrZero(reading.greenSemGale ?? null);
  const greenG1 = serverNumberOrZero(reading.greenG1 ?? null);
  const greensFromSplit = greenSemGale + greenG1;
  const greens =
    greensFromSplit > 0 ? greensFromSplit : serverNumberOrZero(reading.acertos ?? null);
  const reds = serverNumberOrZero(reading.reds ?? reading.erros ?? null);
  const total = greens + reds;
  const providedAssertiveness = serverReadOptionalNumber(reading.assertividade);

  if (typeof providedAssertiveness === "number") {
    return {
      greens,
      reds,
      total,
      assertiveness: serverClampPercentDecimal(providedAssertiveness),
    };
  }

  if (total <= 0) return null;
  return {
    greens,
    reds,
    total,
    assertiveness: Math.round((greens / total) * 1000) / 10,
  };
}

function normalizeServerEntryModeStatsByMode(
  value: unknown,
): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    stats[mode] = normalizeServerEntryModeStatsRecord(record[mode]);
  }
  return stats;
}

function normalizeServerIncomingEntryModeStats(
  value: unknown,
): Partial<Record<ActiveEntryMode, EntryModeStats>> | undefined {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    const rawStats = readRecord(record[mode]);
    if (Object.keys(rawStats).length > 0) {
      stats[mode] = normalizeServerEntryModeStatsRecord(rawStats);
    }
  }
  return ACTIVE_ENTRY_MODES.some((mode) => hasServerEntryModeStats(stats[mode]))
    ? stats
    : undefined;
}

function normalizeServerEntryModeStatsRecord(value: unknown): EntryModeStats {
  const record = readRecord(value);
  const sg =
    serverReadOptionalNumber(
      serverFirstDefined(record.sg, record.greenSemGale, record.green_sem_gale, record.greens),
    ) ?? 0;
  const g1 =
    serverReadOptionalNumber(
      serverFirstDefined(record.greenG1, record.green_g1, record.greensG1, record.greens_g1),
    ) ?? 0;
  const emp =
    serverReadOptionalNumber(
      serverFirstDefined(record.emp, record.ties, record.tie, record.empates),
    ) ?? 0;
  const reds =
    serverReadOptionalNumber(serverFirstDefined(record.reds, record.red, record.erros)) ?? 0;
  const totalGreens =
    serverReadOptionalNumber(serverFirstDefined(record.totalGreens, record.total_greens)) ??
    sg + g1;
  const totalEntries =
    serverReadOptionalNumber(serverFirstDefined(record.totalEntries, record.total_entries)) ??
    totalGreens + reds;
  const total = serverReadOptionalNumber(record.total) ?? totalEntries + emp;
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
    assertiveness:
      serverReadOptionalNumber(serverFirstDefined(record.assertiveness, record.assertividade)) ??
      undefined,
  };
}

function hasServerEntryModeStats(stats?: EntryModeStats) {
  if (!stats) return false;
  return [
    stats.sg,
    stats.greenSemGale,
    stats.greens,
    stats.greenG1,
    stats.greensG1,
    stats.emp,
    stats.ties,
    stats.reds,
    stats.totalGreens,
    stats.totalEntries,
    stats.total,
  ].some((value) => serverNumberOrZero(serverReadOptionalNumber(value)) > 0);
}

function emptyServerEntryModeStatsByMode(): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  return Object.fromEntries(
    ACTIVE_ENTRY_MODES.map((mode) => [mode, normalizeServerEntryModeStatsRecord({})]),
  );
}

function normalizeServerSignalModes(value: unknown) {
  const record = readRecord(value);
  const modes: Record<string, ActiveEntryMode[]> = {};
  for (const [key, rawModes] of Object.entries(record)) {
    const modeList = normalizeServerModeList(rawModes);
    if (key && modeList.length > 0) modes[key] = modeList;
  }
  return modes;
}

function normalizeServerModeList(value: unknown) {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  const selected = new Set<ActiveEntryMode>();
  for (const rawMode of values) {
    const text = String(rawMode || "")
      .trim()
      .toLowerCase();
    if (text === "sniper") selected.add("sniper");
    if (text === "hunter" || text === "cacador" || text === "caçador") selected.add("hunter");
    if (text === "aggressive" || text === "agressivo") selected.add("aggressive");
  }
  return ACTIVE_ENTRY_MODES.filter((mode) => selected.has(mode));
}

function normalizeServerCountedResults(value: unknown) {
  const record = readRecord(value);
  return Object.fromEntries(
    Object.keys(record)
      .filter(Boolean)
      .map((key) => [key, true]),
  );
}

function sameServerModeList(left: ActiveEntryMode[] | undefined, right: ActiveEntryMode[]) {
  const safeLeft = left ?? [];
  if (safeLeft.length !== right.length) return false;
  return ACTIVE_ENTRY_MODES.every((mode) => safeLeft.includes(mode) === right.includes(mode));
}

function pruneServerSignalModes(signalModes: Record<string, ActiveEntryMode[]>) {
  const keys = Object.keys(signalModes);
  if (keys.length <= 300) return signalModes;
  return Object.fromEntries(keys.slice(-220).map((key) => [key, signalModes[key]]));
}

function pruneServerCountedResults(countedResults: Record<string, true>) {
  const keys = Object.keys(countedResults);
  if (keys.length <= 300) return countedResults;
  return Object.fromEntries(keys.slice(-220).map((key) => [key, true]));
}

function serverFirstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function serverReadOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function serverSafeCounter(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function serverNumberOrZero(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function serverClampPercentDecimal(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function serverNormalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeTieAlert(value: unknown, fallback: DashboardData["currentTieAlert"]) {
  const alert = readRecord(value);
  return {
    ...fallback,
    id: String(alert.id || fallback.id),
    level: normalizeTieLevel(alert.level || alert.nivel || fallback.level),
    confidence: clampPercent(alert.confidence ?? alert.confianca ?? fallback.confidence),
    validityRounds: Number(alert.validityRounds ?? alert.validade ?? fallback.validityRounds),
    status: ["active", "green", "expired"].includes(String(alert.status))
      ? (String(alert.status) as "active" | "green" | "expired")
      : fallback.status,
  };
}

function normalizeRounds(rounds: unknown[]) {
  return rounds
    .map((round, index) => {
      const item = readRecord(round);
      const result = normalizeRoundResult(item.result || item.side || item.winner);
      if (!result) return null;
      return {
        id: Number(item.id || item.round || item.roundId || 1000 + index),
        result,
        bankerScore: Number(item.bankerScore ?? item.banker_score ?? item.banker ?? 0),
        playerScore: Number(item.playerScore ?? item.player_score ?? item.player ?? 0),
        time: String(item.time || item.createdAt || "--:--"),
      };
    })
    .filter((round): round is DashboardData["rounds"][number] => Boolean(round))
    .slice(-30);
}

function normalizeSignalSide(value: unknown): CurrentSignalSide {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return "NONE";
}

function normalizeSignalStatus(
  value: unknown,
  side: DashboardData["currentSignal"]["side"],
): SignalStatus {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (["pending", "entrada", "active", "ativo"].includes(text)) return "pending";
  if (["g1", "gale1"].includes(text)) return "g1";
  if (["green", "win", "sg"].includes(text)) return "green";
  if (["green_g1", "greeng1"].includes(text)) return "green_g1";
  if (["red", "loss"].includes(text)) return "red";
  if (["tie_watch", "empate"].includes(text)) return "tie_watch";
  if (side === "BANKER" || side === "PLAYER") return "pending";
  if (side === "TIE") return "tie_watch";
  return "waiting";
}

function normalizeRoundResult(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "B";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "P";
  if (["T", "TIE", "EMPATE"].includes(text)) return "T";
  return null;
}

function normalizeTieLevel(value: unknown): DashboardData["currentTieAlert"]["level"] {
  const text = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (text.includes("ALTO")) return "Alto";
  if (text.includes("MED")) return "Medio";
  return "Baixo";
}

function clampPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function isDashboardAuthorized(request: Request, _url: URL, env: unknown) {
  const token =
    readNamedServerSecret(env, "SNIPER_DASHBOARD_TOKEN", "") ||
    readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", "");
  const headerToken =
    request.headers.get("x-sniper-token")?.trim() ||
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim();
  if (token) return headerToken === token;
  return isLocalDevelopmentRequest(request) && headerToken === LOCAL_DEV_DASHBOARD_TOKEN;
}

function isLocalDevelopmentRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function isDashboardReadAuthorized(request: Request, url: URL, env: unknown) {
  if (isDashboardAuthorized(request, url, env)) return true;

  const token = getBearerToken(request);
  if (!token) return false;

  const session = await verifySessionToken(env, token);
  if (!session) return false;
  if (session.scope === "owner") return sessionMatchesRequestBinding(env, request, session);
  if (session.scope !== "client") return false;

  const client = findClientByEmail(session.email);
  if (!client) return false;
  if (!clientHasLiveAccess(client)) return false;

  const sessionCheck = await validateClientSessionBinding(env, request, session, client);
  return sessionCheck.ok;
}

async function getAdminRequestRole(request: Request, env: unknown): Promise<AdminRole | null> {
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!headerToken) return null;
  if (headerToken === getAdminToken(env)) return "owner";

  const session = await verifySessionToken(env, headerToken);
  if (session?.scope === "owner" && (await sessionMatchesRequestBinding(env, request, session))) {
    return "owner";
  }
  if (
    session?.scope === "admin_approver" &&
    (await sessionMatchesRequestBinding(env, request, session))
  ) {
    return "admin";
  }
  return null;
}

function getBearerToken(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    request.headers.get("x-sniper-token")?.trim() ||
    ""
  );
}

function getAdminToken(env: unknown) {
  return readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", "");
}

function getAdminEmails(env: unknown) {
  return parseEmailList(
    `${readNamedServerSecret(env, "SNIPER_ADMIN_EMAIL", "")},${readNamedServerSecret(
      env,
      "SNIPER_ADMIN_EMAILS",
      "",
    )}`,
  );
}

function getAdminApproverEmails(env: unknown) {
  return parseEmailList(
    `${readNamedServerSecret(env, "SNIPER_ADMIN_APPROVER_EMAIL", "")},${readNamedServerSecret(
      env,
      "SNIPER_ADMIN_APPROVER_EMAILS",
      "",
    )}`,
  ).filter((email) => !getAdminEmails(env).includes(email));
}

function getAdminRoleForEmail(env: unknown, email: string): AdminRole | null {
  const cleanEmail = email.trim().toLowerCase();
  if (getAdminEmails(env).includes(cleanEmail)) return "owner";
  if (getAdminApproverEmails(env).includes(cleanEmail)) return "admin";
  return null;
}

function getAdminPassword(env: unknown) {
  return readNamedServerSecret(env, "SNIPER_ADMIN_PASSWORD", "");
}

function getMercadoPagoAccessToken(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "MERCADOPAGO_ACCESS_TOKEN", ""));
}

function getMercadoPagoWebhookSecret(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "MERCADOPAGO_WEBHOOK_SECRET", ""));
}

function getMercadoPagoCurrency(env: unknown) {
  return readNamedServerSecret(env, "MERCADOPAGO_CURRENCY", "BRL") || "BRL";
}

function getHublaWebhookToken(env: unknown) {
  const mode = readNamedServerSecret(env, "HUBLA_ENVIRONMENT", "production").toLowerCase();
  const scopedToken =
    mode === "sandbox"
      ? readNamedServerSecret(env, "HUBLA_SANDBOX_WEBHOOK_TOKEN", "")
      : readNamedServerSecret(env, "HUBLA_PRODUCTION_WEBHOOK_TOKEN", "");
  return normalizeSecretValue(scopedToken || readNamedServerSecret(env, "HUBLA_WEBHOOK_TOKEN", ""));
}

function getHublaWebhookHmacSecret(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "HUBLA_WEBHOOK_HMAC_SECRET", ""));
}

function getHublaDefaultPlan(env: unknown): BillingPlanId {
  const plan = normalizeBillingPlanId(readNamedServerSecret(env, "HUBLA_DEFAULT_PLAN", "vip"));
  return plan && plan !== "free" ? plan : "vip";
}

function getHublaCheckoutUrl(plan: BillingPlanId, env: unknown) {
  if (plan === "free") return "";
  const candidates =
    plan === "premium"
      ? ["HUBLA_PREMIUM_CHECKOUT_URL", "HUBLA_ANUAL_CHECKOUT_URL", "HUBLA_CHECKOUT_URL"]
      : ["HUBLA_MENSAL_CHECKOUT_URL", "HUBLA_VIP_CHECKOUT_URL", "HUBLA_CHECKOUT_URL"];
  for (const key of candidates) {
    const value = readNamedServerSecret(env, key, "");
    if (value && /^https?:\/\//i.test(value)) return value;
  }
  return "";
}

function getBillingPlans(env: unknown) {
  return (["free", "premium", "vip"] as BillingPlanId[]).map((plan) => {
    const config = getBillingPlan(plan, env);
    const hublaCheckoutUrl = getHublaCheckoutUrl(config.id, env);
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      amount: config.amount,
      currency: getMercadoPagoCurrency(env),
      durationDays: config.durationDays,
      features: config.features,
      checkoutEnabled:
        config.id !== "free" &&
        (Boolean(hublaCheckoutUrl) || Boolean(getMercadoPagoAccessToken(env))),
      checkoutProvider: hublaCheckoutUrl
        ? "hubla"
        : getMercadoPagoAccessToken(env)
          ? "mercadopago"
          : "",
    };
  });
}

function getBillingPlan(plan: BillingPlanId, env: unknown) {
  const premiumAmount = readServerNumber(env, "MERCADOPAGO_PREMIUM_PRICE", 497);
  const vipAmount = readServerNumber(env, "MERCADOPAGO_VIP_PRICE", 297);
  const plans = {
    free: {
      id: "free" as const,
      name: "Free",
      description: "Cadastro gratuito com acesso limitado e sem sinais premium.",
      amount: 0,
      durationDays: 7,
      features: ["Cadastro no app", "Acesso a telas basicas", "Sem sinais premium ao vivo"],
    },
    vip: {
      id: "vip" as const,
      name: "VIP",
      description: "Acesso VIP mensal ao painel operacional.",
      amount: vipAmount,
      durationDays: 30,
      features: [
        "Painel ao vivo",
        "Sinais protegidos",
        "Surf, Tie e numero pagante",
        "Assistente IA",
      ],
    },
    premium: {
      id: "premium" as const,
      name: "Premium",
      description: "Acesso Premium mensal com recursos completos.",
      amount: premiumAmount,
      durationDays: 30,
      features: ["Tudo do VIP", "Narracao IA", "Leituras completas", "Prioridade operacional"],
    },
  };
  return plans[plan];
}

function readServerNumber(env: unknown, key: string, fallback: number) {
  const text = readNamedServerSecret(env, key, "");
  if (!String(text).trim()) return fallback;
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeBillingPlanId(value: unknown): BillingPlanId | null {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "free" || text === "premium" || text === "vip") return text;
  if (text === "mensal" || text === "monthly") return "vip";
  return null;
}

function normalizeHublaWebhookPayload(
  payload: Record<string, unknown>,
  request: Request,
  env: unknown,
) {
  const event = readRecord(payload.event);
  const user = readRecord(event.user);
  const subscription = readRecord(event.subscription);
  const invoice = readRecord(event.invoice);
  const member = readRecord(event.member);
  const customer = readRecord(event.customer);
  const payment = readRecord(event.payment);
  const product = readRecord(event.product);
  const eventType = readString(payload, "type");
  const email = (
    readString(user, "email") ||
    readString(subscription, "email") ||
    readString(invoice, "email") ||
    readString(member, "email") ||
    readString(customer, "email") ||
    readString(payment, "email") ||
    readString(payload, "email")
  ).toLowerCase();
  const firstName = readString(user, "firstName") || readString(customer, "firstName");
  const lastName = readString(user, "lastName") || readString(customer, "lastName");
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    readString(user, "name") ||
    readString(customer, "name") ||
    readString(payload, "name");
  return {
    email,
    fullName,
    phone:
      readString(user, "phone") ||
      readString(subscription, "phone") ||
      readString(customer, "phone"),
    status: normalizeHublaStatus(payload),
    eventType,
    idempotencyKey:
      request.headers.get("x-hubla-idempotency")?.trim() || readString(payload, "idempotencyKey"),
    productId:
      readString(product, "id") || firstHublaProductId(event) || readString(payload, "productId"),
    plan: getHublaPlanFromPayload(payload, env),
    subscriptionId:
      readString(subscription, "id") ||
      readString(invoice, "subscriptionId") ||
      readString(payload, "subscriptionId"),
    paymentId:
      readString(invoice, "id") ||
      readString(payment, "id") ||
      readString(payload, "paymentId") ||
      readString(payload, "id"),
    amount: readHublaAmount(event),
    currency:
      readString(invoice, "currency") ||
      readString(payment, "currency") ||
      readString(payload, "currency") ||
      "BRL",
    paidAt:
      readString(invoice, "paidAt") ||
      readString(payment, "paidAt") ||
      readString(subscription, "activatedAt"),
    expiresAt:
      readString(subscription, "expiresAt") ||
      readString(subscription, "expires_at") ||
      readString(subscription, "currentPeriodEnd") ||
      readString(subscription, "current_period_end") ||
      readString(event, "expiresAt"),
    createdAt:
      readString(invoice, "createdAt") ||
      readString(subscription, "createdAt") ||
      readString(payload, "createdAt"),
  };
}

function normalizeHublaStatus(payload: Record<string, unknown>) {
  const event = readRecord(payload.event);
  const text = (
    readString(payload, "status") ||
    readString(readRecord(event.invoice), "status") ||
    readString(readRecord(event.payment), "status") ||
    readString(readRecord(event.subscription), "status") ||
    readString(payload, "type")
  )
    .trim()
    .toLowerCase()
    .replace(/\./g, "_");

  if (["paid", "invoice_paid", "payment_paid", "subscription_activated", "active"].includes(text)) {
    return "paid";
  }
  if (["refunded", "invoice_refunded", "refund_succeeded"].includes(text)) return "refunded";
  if (["chargeback", "charged_back", "invoice_chargeback"].includes(text)) return "chargeback";
  if (["canceled", "cancelled", "subscription_deactivated", "deactivated"].includes(text)) {
    return "canceled";
  }
  return text;
}

function firstHublaProductId(event: Record<string, unknown>) {
  const products = Array.isArray(event.products) ? event.products.map(readRecord) : [];
  for (const product of products) {
    const id = readString(product, "id");
    if (id) return id;
  }
  return "";
}

function getHublaPlanFromPayload(
  payload: Record<string, unknown>,
  env: unknown,
): BillingPlanId | null {
  const event = readRecord(payload.event);
  const product = readRecord(event.product);
  const productId = readString(product, "id") || firstHublaProductId(event);
  const productName = (
    readString(product, "name") ||
    readString(payload, "productName") ||
    ""
  ).toLowerCase();

  if (productName.includes("premium")) return "premium";
  if (productName.includes("vip") || productName.includes("mensal")) return "vip";
  if (productName.includes("free") || productName.includes("trial")) return "free";

  if (productId) {
    const premiumIds = parseCsvList(readNamedServerSecret(env, "HUBLA_PREMIUM_PRODUCT_IDS", ""));
    const vipIds = parseCsvList(readNamedServerSecret(env, "HUBLA_VIP_PRODUCT_IDS", ""));
    if (premiumIds.includes(productId)) return "premium";
    if (vipIds.includes(productId)) return "vip";
  }

  return null;
}

function readHublaAmount(event: Record<string, unknown>) {
  const invoice = readRecord(event.invoice);
  const payment = readRecord(event.payment);
  const amount = readRecord(invoice.amount);
  const candidates = [
    { value: amount.totalCents, cents: true },
    { value: amount.subtotalCents, cents: true },
    { value: amount.total, cents: false },
    { value: invoice.totalCents, cents: true },
    { value: invoice.amount, cents: false },
    { value: invoice.total, cents: false },
    { value: invoice.totalAmount, cents: false },
    { value: readRecord(invoice.total).amount, cents: false },
    { value: readRecord(invoice.total).value, cents: false },
    { value: payment.amount, cents: false },
    { value: payment.total, cents: false },
  ];
  for (const candidate of candidates) {
    const value = Number(String(candidate.value ?? "").replace(",", "."));
    if (Number.isFinite(value)) return candidate.cents ? Number((value / 100).toFixed(2)) : value;
  }
  return 0;
}

function parseCsvList(value: unknown) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPublicAppOrigin(request: Request, env: unknown) {
  const configured =
    readNamedServerSecret(env, "PUBLIC_APP_URL", "") || readNamedServerSecret(env, "APP_URL", "");
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function extractMercadoPagoPaymentId(url: URL, payload: Record<string, unknown>) {
  const data = readRecord(payload.data);
  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    readString(data, "id") ||
    readString(payload, "id") ||
    ""
  );
}

async function validateMercadoPagoWebhookSignature(
  request: Request,
  _url: URL,
  _payload: Record<string, unknown>,
  env: unknown,
  dataId: string,
) {
  const secret = getMercadoPagoWebhookSecret(env);
  if (!secret) {
    // The payment is still confirmed server-to-server with Mercado Pago before access is released.
    return true;
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  if (!xSignature || !xRequestId) return false;

  const signatureParts = parseMercadoPagoSignature(xSignature);
  if (!signatureParts.ts || !signatureParts.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${signatureParts.ts};`;
  const expected = bytesToHex(await hmacSign(secret, manifest));
  return constantTimeStringEqual(expected, signatureParts.v1);
}

function parseMercadoPagoSignature(value: string) {
  return value.split(",").reduce(
    (acc, part) => {
      const [key, raw] = part.split("=");
      if (key?.trim() === "ts") acc.ts = String(raw || "").trim();
      if (key?.trim() === "v1") acc.v1 = String(raw || "").trim();
      return acc;
    },
    { ts: "", v1: "" },
  );
}

function parseBillingExternalReference(value: string) {
  const parts = value.split(":");
  if (parts.length >= 4 && parts[0] === "sniperbo") {
    return {
      subscriptionId: parts[1],
      email: parts[2],
      plan: parts[3],
    };
  }
  return { subscriptionId: "", email: "", plan: "" };
}

function upsertLiveClient(client: Record<string, unknown>) {
  if (isEntityDeleted(client)) return;
  const id = readString(client, "id");
  const email = readString(client, "email").toLowerCase();
  const index = liveClients.findIndex((item) => {
    const sameId = id && readString(item, "id") === id;
    const sameEmail = email && readString(item, "email").toLowerCase() === email;
    return sameId || sameEmail;
  });
  liveClients =
    index >= 0
      ? liveClients.map((item, itemIndex) => (itemIndex === index ? { ...item, ...client } : item))
      : [...liveClients, client];
}

function upsertSubscriptionRecord(record: Record<string, unknown>) {
  if (isEntityDeleted(record)) return record;
  const id = readString(record, "id");
  const paymentId = readString(record, "provider_payment_id");
  const externalReference = readString(record, "external_reference");
  const index = liveSubscriptions.findIndex((item) => {
    return (
      (id && readString(item, "id") === id) ||
      (paymentId && readString(item, "provider_payment_id") === paymentId) ||
      (externalReference && readString(item, "external_reference") === externalReference)
    );
  });
  const merged = {
    ...(index >= 0 ? liveSubscriptions[index] : {}),
    ...record,
    updated_at: readString(record, "updated_at") || new Date().toISOString(),
  };
  liveSubscriptions =
    index >= 0
      ? liveSubscriptions.map((item, itemIndex) => (itemIndex === index ? merged : item))
      : [merged, ...liveSubscriptions].slice(0, 500);
  return merged;
}

function upsertPaymentRecord(record: Record<string, unknown>) {
  if (isEntityDeleted(record)) return record;
  const id = readString(record, "id");
  const paymentId = readString(record, "provider_payment_id");
  const preferenceId = readString(record, "provider_preference_id");
  const externalReference = readString(record, "external_reference");
  const index = livePayments.findIndex((item) => {
    return (
      (id && readString(item, "id") === id) ||
      (paymentId && readString(item, "provider_payment_id") === paymentId) ||
      (!paymentId && preferenceId && readString(item, "provider_preference_id") === preferenceId) ||
      (!paymentId &&
        externalReference &&
        readString(item, "external_reference") === externalReference)
    );
  });
  const merged = {
    ...(index >= 0 ? livePayments[index] : {}),
    ...record,
    updated_at: readString(record, "updated_at") || new Date().toISOString(),
  };
  livePayments =
    index >= 0
      ? livePayments.map((item, itemIndex) => (itemIndex === index ? merged : item))
      : [merged, ...livePayments].slice(0, 1000);
  return merged;
}

function findPaymentId(providerPaymentId: string, externalReference: string) {
  const existing = livePayments.find((payment) => {
    return (
      (providerPaymentId && readString(payment, "provider_payment_id") === providerPaymentId) ||
      (externalReference && readString(payment, "external_reference") === externalReference)
    );
  });
  return existing ? readString(existing, "id") : "";
}

function buildBillingOverview(client: Record<string, unknown>) {
  const email = readString(client, "email").toLowerCase();
  const subscription = latestSubscriptionForEmail(email);
  const expiresAt = readString(client, "expires_at") || readString(subscription, "expires_at");
  const expired = isExpiredIso(expiresAt);
  const trial = readString(client, "access_status").toLowerCase() === "trial" && !expired;
  const liveAccess = clientHasLiveAccess(client);
  return {
    email,
    plan: readString(client, "plan") || readString(subscription, "plan") || "free",
    status: expired
      ? "expired"
      : readString(subscription, "status") || readString(client, "access_status") || "pending",
    accessMode: trial ? "demo" : liveAccess ? "full" : expired ? "expired" : "pending",
    approved: liveAccess && !trial,
    starts_at: readString(client, "starts_at") || readString(subscription, "starts_at"),
    expires_at: expiresAt,
    subscription: buildSubscriptionPublic(subscription),
    last_payment: buildPaymentPublic(
      livePayments
        .filter((payment) => readString(payment, "email").toLowerCase() === email)
        .sort((a, b) =>
          readString(b, "updated_at").localeCompare(readString(a, "updated_at")),
        )[0] || {},
    ),
  };
}

function latestSubscriptionForEmail(email: string) {
  return (
    liveSubscriptions
      .filter((subscription) => readString(subscription, "email").toLowerCase() === email)
      .sort((a, b) => readString(b, "updated_at").localeCompare(readString(a, "updated_at")))[0] ||
    {}
  );
}

function buildSubscriptionPublic(subscription: Record<string, unknown>) {
  return {
    id: readString(subscription, "id"),
    plan: readString(subscription, "plan") || "free",
    status: readString(subscription, "status") || "pending",
    starts_at: readString(subscription, "starts_at"),
    expires_at: readString(subscription, "expires_at"),
    provider: readString(subscription, "provider"),
    provider_preference_id: readString(subscription, "provider_preference_id"),
  };
}

function buildPaymentPublic(payment: Record<string, unknown>) {
  return {
    id: readString(payment, "id"),
    plan: readString(payment, "plan") || "free",
    status: readString(payment, "status"),
    amount: Number(payment.amount || 0),
    currency: readString(payment, "currency") || "BRL",
    paid_at: readString(payment, "paid_at"),
    created_at: readString(payment, "created_at"),
    provider_payment_id: readString(payment, "provider_payment_id"),
  };
}

async function hydrateClientFromBilling(env: unknown, email: string) {
  const client = await loadBillingClientByEmail(env, email);
  if (!client) return null;
  if (isEntityDeleted(client)) return null;

  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_hydrated_from_billing", {
    ...client,
    detail: "Cliente reconstruido a partir das tabelas de assinatura/pagamento.",
  });
  await saveLiveState(env);
  return findClientByEmail(email) || client;
}

async function loadBillingClientByEmail(env: unknown, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !getSupabasePersistenceConfig(env)) return null;

  const encodedEmail = encodeURIComponent(cleanEmail);
  const [users, subscriptions, payments] = await Promise.all([
    fetchSupabaseRows(env, "users", `select=*&email=ilike.${encodedEmail}&limit=1`),
    fetchSupabaseRows(
      env,
      "subscriptions",
      `select=*&email=ilike.${encodedEmail}&order=updated_at.desc.nullslast&limit=20`,
    ),
    fetchSupabaseRows(
      env,
      "payments",
      `select=*&email=ilike.${encodedEmail}&order=updated_at.desc.nullslast&limit=20`,
    ),
  ]);

  const user = users[0] || {};
  const subscription = pickBillingSubscription(subscriptions);
  const payment = pickBillingPayment(payments);
  if (!hasRecordFields(user) && !hasRecordFields(subscription) && !hasRecordFields(payment)) {
    return null;
  }

  return billingClientFromPersistedRows(env, cleanEmail, user, subscription, payment);
}

async function hydrateClientsFromBillingUsers(env: unknown) {
  if (!getSupabasePersistenceConfig(env)) return false;

  const users = await fetchSupabaseRowsPaged(
    env,
    "users",
    "select=*&order=created_at.desc.nullslast",
  );
  if (!users.length) return false;

  let changed = false;
  for (const user of users) {
    const email = readString(user, "email").toLowerCase();
    if (!email || isEntityDeleted(user)) continue;
    const client = billingClientFromPersistedRows(env, email, user, {}, {});
    if (!client || isEntityDeleted(client)) continue;
    upsertLiveClient(client);
    upsertRecipientFromClient(client);
    changed = true;
  }
  return changed;
}

function billingClientFromPersistedRows(
  env: unknown,
  cleanEmail: string,
  user: Record<string, unknown>,
  subscription: Record<string, unknown>,
  payment: Record<string, unknown>,
) {
  const paidAt = readString(payment, "paid_at") || readString(payment, "created_at");
  const startsAt =
    readString(user, "starts_at") ||
    readString(subscription, "starts_at") ||
    paidAt.slice(0, 10) ||
    readString(user, "created_at") ||
    todayIso();
  const plan =
    normalizeBillingPlanId(readString(user, "plan")) ||
    normalizeBillingPlanId(readString(subscription, "plan")) ||
    normalizeBillingPlanId(readString(payment, "plan")) ||
    "free";
  const planConfig = getBillingPlan(plan, env);
  const expiresAt =
    readString(user, "expires_at") ||
    readString(subscription, "expires_at") ||
    (billingPaymentIsPaid(payment) ? addDaysIso(startsAt, planConfig.durationDays) : "");
  const subscriptionActive = billingSubscriptionIsActive(subscription, expiresAt);
  const paymentActive =
    billingPaymentIsPaid(payment) && Boolean(expiresAt) && !isExpiredIso(expiresAt);
  const persistedStatus = readString(user, "access_status").toLowerCase();
  const trialActive = persistedStatus === "trial" && Boolean(expiresAt) && !isExpiredIso(expiresAt);
  const enabled =
    readBooleanField(user, "enabled") ||
    subscriptionActive ||
    paymentActive ||
    trialActive ||
    ["approved", "active", "manual_vip"].includes(persistedStatus);
  const accessStatus =
    persistedStatus === "trial" && isExpiredIso(expiresAt)
      ? "expired"
      : persistedStatus ||
        (enabled
          ? subscriptionActive || paymentActive
            ? "approved"
            : "trial"
          : isExpiredIso(expiresAt)
            ? "expired"
            : readString(subscription, "status") || readString(payment, "status") || "expired");

  return {
    id:
      readString(user, "id") ||
      readString(subscription, "user_id") ||
      readString(payment, "user_id") ||
      crypto.randomUUID(),
    full_name: readString(user, "full_name") || nameFromEmail(cleanEmail),
    email: cleanEmail,
    phone: readString(user, "phone"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    password_hash: readString(user, "password_hash"),
    plan,
    access_status: accessStatus,
    enabled: enabled && accessStatus !== "expired",
    starts_at: startsAt,
    validity_days: Number(user.validity_days || planConfig.durationDays || 0),
    expires_at: expiresAt,
    trial_started_at: readString(user, "trial_started_at"),
    trial_expires_at: readString(user, "trial_expires_at") || expiresAt,
    trial_ip_hash: readString(user, "trial_ip_hash"),
    trial_user_agent_hash: readString(user, "trial_user_agent_hash"),
    trial_blocked_reason: readString(user, "trial_blocked_reason"),
    is_blocked: readBooleanField(user, "is_blocked"),
    adminNote: readString(user, "admin_note") || readString(user, "adminNote"),
    created_at:
      readString(user, "created_at") ||
      readString(subscription, "created_at") ||
      new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function pickBillingSubscription(rows: Record<string, unknown>[]) {
  const sorted = sortBillingRows(rows).sort(
    (a, b) => Number(billingSubscriptionIsActive(b)) - Number(billingSubscriptionIsActive(a)),
  );
  return sorted[0] || {};
}

function pickBillingPayment(rows: Record<string, unknown>[]) {
  const sorted = sortBillingRows(rows).sort(
    (a, b) => Number(billingPaymentIsPaid(b)) - Number(billingPaymentIsPaid(a)),
  );
  return sorted[0] || {};
}

function sortBillingRows(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => billingRowTime(b) - billingRowTime(a));
}

function billingRowTime(row: Record<string, unknown>) {
  const time = Date.parse(
    readString(row, "updated_at") ||
      readString(row, "paid_at") ||
      readString(row, "created_at") ||
      readString(row, "starts_at") ||
      "",
  );
  return Number.isFinite(time) ? time : 0;
}

function billingSubscriptionIsActive(
  subscription: Record<string, unknown>,
  fallbackExpiresAt = "",
) {
  const status = readString(subscription, "status").toLowerCase();
  const expiresAt = readString(subscription, "expires_at") || fallbackExpiresAt;
  return (
    ["active", "approved", "paid"].includes(status) && (!expiresAt || !isExpiredIso(expiresAt))
  );
}

function billingPaymentIsPaid(payment: Record<string, unknown>) {
  const status = (readString(payment, "status") || readString(payment, "raw_status")).toLowerCase();
  return ["approved", "paid"].includes(status);
}

function refreshExpiredBillingForClient(client: Record<string, unknown>) {
  const expiresAt = readString(client, "expires_at");
  if (!expiresAt || !isExpiredIso(expiresAt)) return false;

  client.enabled = false;
  client.access_status = "expired";
  client.updated_at = new Date().toISOString();
  const email = readString(client, "email").toLowerCase();
  liveSubscriptions = liveSubscriptions.map((subscription) =>
    readString(subscription, "email").toLowerCase() === email &&
    readString(subscription, "status") === "active" &&
    isExpiredIso(readString(subscription, "expires_at"))
      ? { ...subscription, status: "expired", updated_at: new Date().toISOString() }
      : subscription,
  );
  upsertRecipientFromClient(client);
  return true;
}

async function persistBillingRecords(
  env: unknown,
  client: Record<string, unknown>,
  subscription: Record<string, unknown>,
  payment: Record<string, unknown>,
) {
  await Promise.allSettled([
    persistBillingUser(env, client),
    persistSupabaseRow(env, "subscriptions", subscription),
    persistSupabaseRow(env, "payments", payment),
  ]);
}

async function persistBillingUser(env: unknown, client: Record<string, unknown>) {
  const email = readString(client, "email").toLowerCase();
  if (!email) return;
  const baseRow = {
    id: readString(client, "id") || crypto.randomUUID(),
    email,
    full_name: readString(client, "full_name") || nameFromEmail(email),
    phone: readString(client, "phone"),
    city: readString(client, "city"),
    country: readString(client, "country"),
    password_hash: readString(client, "password_hash"),
    created_at: readString(client, "created_at") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const fullRow = {
    ...baseRow,
    plan: normalizeBillingPlanId(readString(client, "plan")) || "free",
    access_status: readString(client, "access_status") || "expired",
    enabled: Boolean(client.enabled),
    starts_at: readString(client, "starts_at"),
    validity_days: Number(client.validity_days || 0),
    expires_at: readString(client, "expires_at"),
    trial_started_at: readString(client, "trial_started_at"),
    trial_expires_at: readString(client, "trial_expires_at"),
    trial_ip_hash: readString(client, "trial_ip_hash"),
    trial_user_agent_hash: readString(client, "trial_user_agent_hash"),
    trial_blocked_reason: readString(client, "trial_blocked_reason"),
    is_blocked: Boolean(client.isBlocked) || Boolean(client.is_blocked),
    admin_note: readString(client, "adminNote") || readString(client, "notes"),
  };
  const savedFull = await persistSupabaseRow(env, "users", fullRow);
  if (!savedFull) await persistSupabaseRow(env, "users", baseRow);
}

async function deletePersistedBillingUser(env: unknown, user: Record<string, unknown>) {
  await deletePersistedBillingRecords(env, user, true);
}

async function deletePersistedBillingAccess(env: unknown, user: Record<string, unknown>) {
  await deletePersistedBillingRecords(env, user, false);
}

async function deletePersistedBillingRecords(
  env: unknown,
  user: Record<string, unknown>,
  includeUser: boolean,
) {
  const email = readString(user, "email").toLowerCase();
  const id = readString(user, "id");
  const encodedEmail = encodeURIComponent(email);
  const encodedId = encodeURIComponent(id);
  const idFilters = isUuidLike(id) ? [`user_id=eq.${encodedId}`] : [];

  await Promise.allSettled([
    ...(email ? [deleteSupabaseRows(env, "payments", `email=eq.${encodedEmail}`)] : []),
    ...idFilters.map((filter) => deleteSupabaseRows(env, "payments", filter)),
    ...(email ? [deleteSupabaseRows(env, "subscriptions", `email=eq.${encodedEmail}`)] : []),
    ...idFilters.map((filter) => deleteSupabaseRows(env, "subscriptions", filter)),
    ...(includeUser && email ? [deleteSupabaseRows(env, "users", `email=eq.${encodedEmail}`)] : []),
    ...(includeUser && isUuidLike(id)
      ? [deleteSupabaseRows(env, "users", `id=eq.${encodedId}`)]
      : []),
  ]);
}

async function fetchSupabaseRows(env: unknown, table: string, query: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return [];

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: supabasePersistenceHeaders(config.key),
    });
    if (response.status === 404 || response.status === 406) return [];
    if (!response.ok) {
      console.warn(`Não foi possível carregar ${table} (${response.status}).`);
      return [];
    }

    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows.map(readRecord).filter(hasRecordFields) : [];
  } catch (error) {
    console.warn(`Não foi possível carregar ${table}.`, error);
    return [];
  }
}

async function fetchSupabaseRowsPaged(
  env: unknown,
  table: string,
  query: string,
  pageSize = 1000,
) {
  const rows: Record<string, unknown>[] = [];
  let page = 0;

  while (true) {
    const pageRows = await fetchSupabaseRowsRange(env, table, query, page * pageSize, pageSize);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    page += 1;
  }

  return rows;
}

async function fetchSupabaseRowsRange(
  env: unknown,
  table: string,
  query: string,
  offset: number,
  pageSize: number,
) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return [];

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: {
        ...supabasePersistenceHeaders(config.key),
        Range: `${offset}-${offset + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (response.status === 404 || response.status === 406) return [];
    if (!response.ok) {
      console.warn(`NÃ£o foi possÃ­vel carregar ${table} (${response.status}).`);
      return [];
    }

    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows.map(readRecord).filter(hasRecordFields) : [];
  } catch (error) {
    console.warn(`NÃ£o foi possÃ­vel carregar ${table}.`, error);
    return [];
  }
}

async function persistSupabaseRow(env: unknown, table: string, row: Record<string, unknown>) {
  const config = getSupabasePersistenceConfig(env);
  if (!config || Object.keys(row).length === 0) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Não foi possível salvar ${table} (${response.status}).`);
      return false;
    }
    return response.ok;
  } catch (error) {
    console.warn(`Não foi possível salvar ${table}.`, error);
    return false;
  }
}

async function deleteSupabaseRows(env: unknown, table: string, query: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config || !query) return;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      method: "DELETE",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        Prefer: "return=minimal",
      },
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Não foi possível apagar ${table} (${response.status}).`);
    }
  } catch (error) {
    console.warn(`Não foi possível apagar ${table}.`, error);
  }
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getElevenLabsApiKeys(env: unknown) {
  const keys = ELEVENLABS_API_KEY_SECRET_NAMES.map((name) =>
    normalizeSecretValue(readNamedServerSecret(env, name, "")),
  ).filter(Boolean);
  return [...new Set(keys)];
}

function getElevenLabsVoiceId(env: unknown) {
  for (const name of ELEVENLABS_VOICE_ID_SECRET_NAMES) {
    const value = normalizeSecretValue(readNamedServerSecret(env, name, ""));
    if (value) return value;
  }
  return DEFAULT_ELEVENLABS_VOICE_ID;
}

let lastElevenLabsStatus: { code: number | "ok" | "network_error"; at: string } | null = null;
function recordElevenLabsStatus(code: number | "ok" | "network_error") {
  lastElevenLabsStatus = { code, at: new Date().toISOString() };
}

function readServerEnvString(env: unknown, key: string, fallback: string) {
  const envRecord = readRecord(env);
  return readConfigString(readProcessEnv(key) || envRecord[key], fallback);
}

function readNamedServerSecret(env: unknown, key: string, fallback: string) {
  return stripNamedSecretPrefix(readServerEnvString(env, key, fallback), key);
}

function stripNamedSecretPrefix(value: unknown, key: string) {
  let raw = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  const prefix = new RegExp(`^${escapeRegExp(key)}\\s*[:=]\\s*`, "i");
  while (prefix.test(raw)) {
    raw = raw
      .replace(prefix, "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  }
  return raw;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSecretValue(value: unknown) {
  let raw = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  // Strip common accidental prefixes (env var name pasted in, or auth scheme).
  const prefixes = [
    /^ELEVENLABS_TTS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_SECRET_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_VOICE_ID\s*[:=]\s*/i,
    /^ELEVENLABS_VOICEID\s*[:=]\s*/i,
    /^ELEVENLABS_VOICE\s*[:=]\s*/i,
    /^VOICE_ID\s*[:=]\s*/i,
    /^Bearer\s+/i,
    /^Token\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of prefixes) {
      if (re.test(raw)) {
        raw = raw
          .replace(re, "")
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim();
        changed = true;
      }
    }
  }
  return raw.replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
}

function elevenLabsErrorStatus(status: number) {
  if (status === 401 || status === 403 || status === 404 || status === 422 || status === 429) {
    return status;
  }
  return 502;
}

function elevenLabsErrorPayload(status: number) {
  if (status === 401 || status === 403) {
    return { error: "API key ElevenLabs inválida ou sem permissão." };
  }
  if (status === 404 || status === 422) {
    return { error: "ELEVENLABS_VOICE_ID inválido ou indisponível." };
  }
  if (status === 429) {
    return { error: "Quota ou limite da ElevenLabs atingido." };
  }
  return { error: "Falha ao gerar voz ElevenLabs." };
}

function readProcessEnv(key: string) {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return globalWithProcess.process?.env?.[key] || "";
}

function normalizeNarrationText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function readConfigString(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeRecipient(recipient: Record<string, unknown>) {
  const startsAt = readString(recipient, "starts_at") || todayIso();
  const validityDays = Number(recipient.validity_days || 30);
  const enabled = Boolean(recipient.enabled);
  const accessStatus = normalizeRecipientAccessStatus(
    readString(recipient, "access_status"),
    enabled,
  );

  return {
    id: readString(recipient, "id") || crypto.randomUUID(),
    name: readString(recipient, "name") || readString(recipient, "full_name") || "Cliente",
    full_name: readString(recipient, "full_name") || readString(recipient, "name"),
    email: readString(recipient, "email"),
    phone: readString(recipient, "phone"),
    phone_full: readString(recipient, "phone_full") || readString(recipient, "phoneFull"),
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
    country_code: readString(recipient, "country_code") || readString(recipient, "countryCode"),
    chat_id: readString(recipient, "chat_id"),
    kind: ["group", "channel", "user"].includes(readString(recipient, "kind"))
      ? readString(recipient, "kind")
      : "user",
    enabled,
    plan: ["free", "premium", "vip"].includes(readString(recipient, "plan"))
      ? readString(recipient, "plan")
      : "vip",
    access_status: accessStatus,
    starts_at: startsAt,
    validity_days: Number.isFinite(validityDays) ? validityDays : 30,
    expires_at: readString(recipient, "expires_at") || addDaysIso(startsAt, validityDays || 30),
    notes: readString(recipient, "notes"),
    created_at: readString(recipient, "created_at") || new Date().toISOString(),
    updated_at: readString(recipient, "updated_at") || new Date().toISOString(),
  };
}

function approverPatchForPendingApproval(
  currentRecipient: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const currentStatus = readString(currentRecipient, "access_status");
  const wantsApproval =
    body.enabled === true &&
    readString(body, "access_status") === "approved" &&
    ["premium", "vip"].includes(readString(body, "plan"));

  if (currentStatus !== "pending" || !wantsApproval) return null;

  const startsAt = readString(body, "starts_at") || todayIso();
  const validityDays = Number(body.validity_days || 30);
  const expiresAt = readString(body, "expires_at") || addDaysIso(startsAt, validityDays || 30);

  return {
    enabled: true,
    access_status: "approved",
    plan: readString(body, "plan") === "vip" ? "vip" : "premium",
    starts_at: startsAt,
    validity_days: Number.isFinite(validityDays) ? validityDays : 30,
    expires_at: expiresAt,
  };
}

function findClientByEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return liveClients.find((item) => readString(item, "email").toLowerCase() === cleanEmail) || null;
}

function clientHasLiveAccess(client: Record<string, unknown>) {
  const status = readString(client, "access_status").toLowerCase();
  if (Boolean(client.isBlocked) || Boolean(client.is_blocked) || status === "blocked") return false;
  if (status === "expired") return false;
  const enabled =
    Boolean(client.enabled) ||
    status === "approved" ||
    status === "active" ||
    status === "manual_vip" ||
    status === "trial";
  return enabled && !isExpiredIso(readString(client, "expires_at"));
}

function buildRegistrationTrialAccess(
  env: unknown,
  email: string,
  existingClient: Record<string, unknown>,
  binding: { ipHash: string; userAgentHash: string },
  now: string,
) {
  const existingStatus = readString(existingClient, "access_status").toLowerCase();
  const existingPlan = normalizeBillingPlanId(readString(existingClient, "plan"));
  const existingExpiresAt = readString(existingClient, "expires_at");
  const existingTrialExpiresAt =
    readString(existingClient, "trial_expires_at") || existingExpiresAt;

  if (existingPlan && existingPlan !== "free") {
    return {
      plan: existingPlan,
      accessStatus: existingStatus || "pending",
      enabled: Boolean(existingClient.enabled),
      startsAt: readString(existingClient, "starts_at") || todayIso(),
      validityDays: Number(existingClient.validity_days || 30),
      expiresAt: existingExpiresAt,
      trialStartedAt: readString(existingClient, "trial_started_at"),
      trialExpiresAt: readString(existingClient, "trial_expires_at"),
      trialIpHash: readString(existingClient, "trial_ip_hash"),
      trialUserAgentHash: readString(existingClient, "trial_user_agent_hash"),
      trialBlockedReason: readString(existingClient, "trial_blocked_reason"),
    };
  }

  if (clientHasUsedFreeTrial(existingClient)) {
    const activeTrial = existingStatus === "trial" && !isExpiredIso(existingTrialExpiresAt);
    return {
      plan: "free" as const,
      accessStatus: activeTrial ? "trial" : "expired",
      enabled: activeTrial,
      startsAt: readString(existingClient, "starts_at") || now,
      validityDays: 0,
      expiresAt: existingTrialExpiresAt || now,
      trialStartedAt: readString(existingClient, "trial_started_at") || now,
      trialExpiresAt: existingTrialExpiresAt || now,
      trialIpHash: readString(existingClient, "trial_ip_hash") || binding.ipHash,
      trialUserAgentHash:
        readString(existingClient, "trial_user_agent_hash") || binding.userAgentHash,
      trialBlockedReason: readString(existingClient, "trial_blocked_reason"),
    };
  }

  const previousTrial = findFreeTrialClaim(email, binding);
  if (previousTrial) {
    return {
      plan: "free" as const,
      accessStatus: "expired",
      enabled: false,
      startsAt: now,
      validityDays: 0,
      expiresAt: now,
      trialStartedAt: now,
      trialExpiresAt: now,
      trialIpHash: binding.ipHash,
      trialUserAgentHash: binding.userAgentHash,
      trialBlockedReason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    };
  }

  const trialExpiresAt = addMinutesIso(now, freeTrialMinutes(env));
  return {
    plan: "free" as const,
    accessStatus: "trial",
    enabled: true,
    startsAt: now,
    validityDays: 0,
    expiresAt: trialExpiresAt,
    trialStartedAt: now,
    trialExpiresAt,
    trialIpHash: binding.ipHash,
    trialUserAgentHash: binding.userAgentHash,
    trialBlockedReason: "",
  };
}

function normalizeRecipientAccessStatus(value: string, enabled: boolean) {
  const status = value.trim().toLowerCase();
  if (
    status === "approved" ||
    status === "paused" ||
    status === "pending" ||
    status === "expired" ||
    status === "blocked" ||
    status === "trial" ||
    status === "manual_vip"
  ) {
    return status;
  }
  return enabled ? "approved" : "pending";
}

function clientHasUsedFreeTrial(client: Record<string, unknown>) {
  return Boolean(
    readString(client, "trial_started_at") ||
    readString(client, "trial_expires_at") ||
    readString(client, "trial_ip_hash") ||
    readString(client, "trial_user_agent_hash") ||
    readString(client, "trial_blocked_reason") ||
    readString(client, "access_status").toLowerCase() === "trial",
  );
}

function findFreeTrialClaim(email: string, binding: { ipHash: string; userAgentHash: string }) {
  const cleanEmail = email.trim().toLowerCase();
  return liveClients.find((client) => {
    if (readString(client, "email").toLowerCase() === cleanEmail) return false;
    if (!clientHasUsedFreeTrial(client)) return false;
    const trialIpHash = readString(client, "trial_ip_hash");
    const trialUserAgentHash = readString(client, "trial_user_agent_hash");
    return Boolean(
      binding.ipHash &&
      binding.userAgentHash &&
      trialIpHash &&
      trialUserAgentHash &&
      trialIpHash === binding.ipHash &&
      trialUserAgentHash === binding.userAgentHash,
    );
  });
}

async function ensureBlockedTrialClientForLogin(
  env: unknown,
  request: Request,
  email: string,
  password: string,
) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return null;

  const binding = await requestSessionBinding(env, request);
  const previousTrial = findFreeTrialClaim(cleanEmail, binding);
  if (!previousTrial) return null;

  const now = new Date().toISOString();
  const client = removeLegacyPassword({
    id: crypto.randomUUID(),
    full_name: nameFromEmail(cleanEmail),
    email: cleanEmail,
    phone: "",
    city: "",
    country: "",
    password_hash: await hashPassword(password),
    plan: "free",
    access_status: "expired",
    enabled: false,
    starts_at: now,
    validity_days: 0,
    expires_at: now,
    trial_started_at: now,
    trial_expires_at: now,
    trial_ip_hash: binding.ipHash,
    trial_user_agent_hash: binding.userAgentHash,
    trial_blocked_reason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    created_at: now,
    updated_at: now,
  });

  if (isEntityDeleted(client)) return null;
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_trial_recreated_for_checkout", {
    ...client,
    risk: "medium",
    detail: "Conta recriada como teste expirado para permitir checkout sem novo periodo gratis.",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(cleanEmail) || client;
}

async function ensureSessionClientForExpiredTrial(
  env: unknown,
  request: Request,
  session: SessionPayload,
) {
  if (session.scope !== "client" || session.approved || session.plan !== "free") return null;
  if (!(await sessionMatchesRequestBinding(env, request, session))) return null;

  const now = new Date().toISOString();
  const client = {
    id: crypto.randomUUID(),
    full_name: nameFromEmail(session.email),
    email: session.email,
    phone: "",
    city: "",
    country: "",
    password_hash: "",
    plan: "free",
    access_status: "expired",
    enabled: false,
    starts_at: now,
    validity_days: 0,
    expires_at: now,
    trial_started_at: now,
    trial_expires_at: now,
    trial_ip_hash: session.iph,
    trial_user_agent_hash: session.ua,
    trial_blocked_reason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    created_at: now,
    updated_at: now,
  };

  if (isEntityDeleted(client)) return null;
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_trial_session_recovered", {
    ...client,
    risk: "medium",
    detail: "Sessao de teste expirado recuperada para manter checkout disponivel.",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(session.email) || client;
}

async function validateClientSessionBinding(
  env: unknown,
  request: Request,
  session: SessionPayload,
  client: Record<string, unknown>,
) {
  const binding = await requestSessionBinding(env, request);

  if (session.ua && session.ua !== binding.userAgentHash) {
    return { ok: false, reason: "user_agent_changed", ...binding };
  }

  return { ok: true, reason: "", ...binding };
}

async function sessionMatchesRequestBinding(
  env: unknown,
  request: Request,
  session: SessionPayload,
) {
  if (!session.ua || !session.iph) return false;
  const binding = await requestSessionBinding(env, request);
  return session.ua === binding.userAgentHash && session.iph === binding.ipHash;
}

async function requestSessionBinding(env: unknown, request: Request) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip = getClientIp(request);
  return {
    userAgentHash: await hashSessionValue(env, `ua:${userAgent}`),
    ipHash: await hashSessionValue(env, `ip:${ip}`),
  };
}

async function hashSessionValue(env: unknown, value: string) {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  return bytesToB64Url(await hmacSign(secret, `session-binding:${value}`)).slice(0, 32);
}

async function ownerAccess(env: unknown, email: string, request?: Request) {
  const binding = request
    ? await requestSessionBinding(env, request)
    : { userAgentHash: "", ipHash: "" };
  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "owner",
      plan: "vip",
      approved: true,
      sid: crypto.randomUUID(),
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    ADMIN_SESSION_TTL_SECONDS,
  );
  return {
    registered: true,
    approved: true,
    access_mode: "full",
    access_status: "owner",
    plan: "vip",
    role: "owner",
    email,
    full_name: nameFromEmail(email),
    expires_at: "",
    reason: "Acesso do administrador.",
    client_token: token,
  };
}

async function approverAccess(env: unknown, email: string, request?: Request) {
  const binding = request
    ? await requestSessionBinding(env, request)
    : { userAgentHash: "", ipHash: "" };
  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "admin_approver",
      plan: "free",
      approved: false,
      sid: crypto.randomUUID(),
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    ADMIN_SESSION_TTL_SECONDS,
  );
  return {
    registered: true,
    approved: false,
    access_mode: "pending",
    access_status: "admin_approver",
    plan: "free",
    role: "admin",
    email,
    full_name: nameFromEmail(email),
    expires_at: "",
    reason: "Acesso limitado para aprovar clientes.",
    client_token: token,
  };
}

async function clientAccess(
  env: unknown,
  client: Record<string, unknown>,
  request?: Request,
  session?: SessionPayload,
) {
  const rawStatus = readString(client, "access_status").toLowerCase();
  const blocked =
    Boolean(client.isBlocked) || Boolean(client.is_blocked) || rawStatus === "blocked";
  const trial = rawStatus === "trial";
  const expiresAt = readString(client, "expires_at");
  const enabled =
    !blocked &&
    (Boolean(client.enabled) ||
      rawStatus === "approved" ||
      rawStatus === "active" ||
      rawStatus === "manual_vip" ||
      rawStatus === "trial");
  const expired = !blocked && (rawStatus === "expired" || isExpiredIso(expiresAt));
  if (expired && readString(client, "access_status").toLowerCase() !== "expired") {
    client.enabled = false;
    client.access_status = "expired";
    client.updated_at = new Date().toISOString();
    upsertRecipientFromClient(client);
  }
  const approved = enabled && !expired && !trial;
  const accessStatus = blocked
    ? "blocked"
    : readString(client, "access_status") || (enabled ? "approved" : "pending");
  const plan = ["premium", "vip"].includes(readString(client, "plan"))
    ? readString(client, "plan")
    : "free";
  const email = readString(client, "email");
  const previousSessionId = readString(client, "active_session_id");
  const sessionId =
    session?.sid && session.sid === previousSessionId ? session.sid : crypto.randomUUID();
  const binding = request
    ? await requestSessionBinding(env, request)
    : {
        ipHash: readString(client, "active_session_ip_hash"),
        userAgentHash: readString(client, "active_session_user_agent_hash"),
      };

  if (request) {
    if (previousSessionId && previousSessionId !== sessionId) {
      recordAccessEvent("client_session_replaced", {
        ...client,
        risk: "medium",
        detail: "Nova sessão derrubou a sessão anterior.",
        ip_hash: binding.ipHash,
        user_agent_hash: binding.userAgentHash,
      });
    }

    const now = new Date().toISOString();
    client.active_session_id = sessionId;
    client.active_session_user_agent_hash = binding.userAgentHash;
    client.active_session_ip_hash = binding.ipHash;
    client.active_session_started_at =
      previousSessionId === sessionId
        ? readString(client, "active_session_started_at") || now
        : now;
    client.active_session_last_seen_at = now;
  }

  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "client",
      plan,
      approved,
      sid: sessionId,
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    CLIENT_SESSION_TTL_SECONDS,
  );

  return {
    registered: true,
    approved,
    access_mode: expired ? "expired" : trial && enabled ? "demo" : enabled ? "full" : "pending",
    access_status: expired ? "expired" : accessStatus,
    plan,
    role: normalizeManagedUserRole(client.role),
    email,
    full_name:
      readString(client, "full_name") || readString(client, "name") || readString(client, "email"),
    expires_at: expiresAt,
    reason: expired
      ? "Seu teste gratuito expirou. Atualize seu plano para continuar recebendo sinais."
      : trial && enabled
        ? "Teste gratuito ativo por tempo limitado."
        : enabled
          ? "Acesso liberado pelo administrador."
          : "Aguardando liberação do administrador.",
    client_token: token,
  };
}

function recordAccessEvent(type: string, source: Record<string, unknown>) {
  const event = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    type,
    email: readString(source, "email"),
    full_name: readString(source, "full_name") || readString(source, "name"),
    city: readString(source, "city"),
    country: readString(source, "country"),
    risk: readString(source, "risk"),
    detail: readString(source, "detail"),
    ip_hash: readString(source, "ip_hash"),
    user_agent_hash: readString(source, "user_agent_hash"),
  };
  liveAccessEvents = [event, ...liveAccessEvents].slice(0, 200);
}

function summarizeSecurityEvents() {
  const summary = { total: liveAccessEvents.length, low: 0, medium: 0, high: 0, critical: 0 };
  for (const event of liveAccessEvents) {
    const risk = readString(event, "risk").toLowerCase();
    if (risk === "critical") summary.critical += 1;
    else if (risk === "high") summary.high += 1;
    else if (risk === "medium") summary.medium += 1;
    else summary.low += 1;
  }
  return summary;
}

function buildAdminSummary() {
  const people = uniquePeople([...liveClients, ...liveRecipients]);
  const approved = people.filter(isActivePaidRecipient);
  const pending = people.filter((person) => readString(person, "access_status") === "pending");
  const paused = people.filter((person) => readString(person, "access_status") === "paused");
  const uniqueAccesses = new Set(
    liveAccessEvents.map((event) => readString(event, "email")).filter(Boolean),
  ).size;

  return {
    totalRegistrations: people.length,
    approved: approved.length,
    pending: pending.length,
    paused: paused.length,
    totalAccesses: liveAccessEvents.length,
    uniqueAccesses,
    cityBreakdown: buildLocationBreakdown(people, "city"),
    countryBreakdown: buildLocationBreakdown(people, "country"),
    recentAccesses: liveAccessEvents.slice(0, 8).map((event) => ({
      id: readString(event, "id"),
      created_at: readString(event, "created_at"),
      type: readString(event, "type"),
      email: readString(event, "email"),
      full_name: readString(event, "full_name"),
      city: readString(event, "city"),
      country: readString(event, "country"),
    })),
  };
}

function isActivePaidRecipient(person: Record<string, unknown>) {
  const plan = readString(person, "plan").toLowerCase();
  if (plan === "free") return false;
  if (isExpiredIso(readString(person, "expires_at"))) return false;
  return Boolean(person.enabled) || readString(person, "access_status") === "approved";
}

function buildAdminPanelOverview(users = syncAdminManagedUsers()) {
  const now = Date.now();
  const clientUsers = users.filter((user) => normalizeManagedUserRole(user.role) === "user");
  const active = clientUsers.filter(
    (user) =>
      !user.isBlocked &&
      ["active", "manual_vip", "trial"].includes(readString(user, "subscriptionStatus")) &&
      Date.parse(readString(user, "currentPeriodEnd")) > now,
  );
  const paidActive = active.filter((user) =>
    ["active", "manual_vip"].includes(readString(user, "subscriptionStatus")),
  );
  const premium = active.filter((user) =>
    ["premium", "vip_manual"].includes(readString(user, "plan")),
  );
  const trials = active.filter(
    (user) =>
      readString(user, "plan") === "trial" || readString(user, "subscriptionStatus") === "trial",
  );
  const currentSignal = readRecord((liveDashboardData as Record<string, unknown>).currentSignal);
  const side =
    readString(currentSignal, "side") ||
    readString((liveDashboardData as Record<string, unknown>).entrySide) ||
    readString((liveDashboardData as Record<string, unknown>).recommendedSide) ||
    "BANKER";

  return {
    engineStatus: "Online",
    tableStatus: "Conectada",
    activeUsers: active.length,
    activeSubscriptions: paidActive.length,
    activeTrials: trials.length,
    premiumUsers: premium.length,
    onlineNow: countOnlineClientUsers(now),
    lastSignal: side.toUpperCase(),
    lastSignalAt: relativeTimeFromIso(
      readString(liveDashboardData as Record<string, unknown>, "updatedAt"),
    ),
  };
}

function countOnlineClientUsers(now = Date.now()) {
  const onlineEmails = new Set<string>();
  for (const event of liveAccessEvents) {
    const createdAt = Date.parse(readString(event, "created_at"));
    if (!Number.isFinite(createdAt) || now - createdAt >= 5 * 60 * 1000) continue;

    const type = readString(event, "type");
    if (!type.startsWith("client_")) continue;

    const email = readString(event, "email").toLowerCase();
    if (email) onlineEmails.add(email);
  }
  return onlineEmails.size;
}

function syncAdminManagedUsers(env?: unknown) {
  const byEmail = new Map<string, Record<string, unknown>>();

  for (const user of liveAdminUsers) {
    const normalized = normalizeAdminManagedUser(user, env);
    const email = readString(normalized, "email").toLowerCase();
    if (email) byEmail.set(email, { ...(byEmail.get(email) || {}), ...normalized });
  }

  for (const client of [...liveRecipients, ...liveClients]) {
    const user = adminManagedUserFromClient(client, env);
    const email = readString(user, "email").toLowerCase();
    if (email) byEmail.set(email, { ...(byEmail.get(email) || {}), ...user });
  }

  for (const email of getAdminEmails(env)) {
    const existing = byEmail.get(email) || {};
    byEmail.set(
      email,
      normalizeAdminManagedUser(
        {
          ...existing,
          email,
          name: readString(existing, "name") || nameFromEmail(email),
          role: "owner",
          plan: readString(existing, "plan") || "premium",
          subscriptionStatus: "manual_vip",
          currentPeriodEnd:
            readString(existing, "currentPeriodEnd") || addDaysIso(new Date().toISOString(), 3650),
          isBlocked: false,
        },
        env,
      ),
    );
  }

  for (const email of getAdminApproverEmails(env)) {
    const existing = byEmail.get(email) || {};
    byEmail.set(
      email,
      normalizeAdminManagedUser(
        {
          ...existing,
          email,
          name: readString(existing, "name") || nameFromEmail(email),
          role: "admin",
          plan: readString(existing, "plan") || "free",
          subscriptionStatus: readString(existing, "subscriptionStatus") || "active",
          currentPeriodEnd:
            readString(existing, "currentPeriodEnd") || addDaysIso(new Date().toISOString(), 3650),
          isBlocked: false,
        },
        env,
      ),
    );
  }

  if (byEmail.size === 0) {
    for (const user of mockAdminManagedUsers()) {
      byEmail.set(readString(user, "email").toLowerCase(), user);
    }
  }

  const users = [...byEmail.values()]
    .map((user) => normalizeAdminManagedUser(user, env))
    .sort((a, b) => readString(a, "name").localeCompare(readString(b, "name")));
  liveAdminUsers = users;
  return users;
}

function findAdminManagedUser(id: string, env?: unknown) {
  return (
    syncAdminManagedUsers(env).find((user) => {
      return (
        readString(user, "id") === id ||
        readString(user, "email").toLowerCase() === id.toLowerCase()
      );
    }) || null
  );
}

function adminManagedUserFromClient(client: Record<string, unknown>, env?: unknown) {
  const email = readString(client, "email").toLowerCase();
  const expiresAt = readString(client, "expires_at") || readString(client, "currentPeriodEnd");
  const blocked =
    Boolean(client.isBlocked) ||
    Boolean(client.is_blocked) ||
    readString(client, "access_status").toLowerCase() === "blocked";
  return normalizeAdminManagedUser(
    {
      id: readString(client, "id") || email || crypto.randomUUID(),
      name: readString(client, "full_name") || readString(client, "name") || nameFromEmail(email),
      email,
      phone: readString(client, "phone"),
      phoneFull: readString(client, "phone_full") || readString(client, "phoneFull"),
      city: readString(client, "city"),
      country: readString(client, "country"),
      countryCode: readString(client, "country_code") || readString(client, "countryCode"),
      role: readString(client, "role"),
      plan: mapClientPlanToAdminPlan(
        readString(client, "plan"),
        readString(client, "access_status"),
      ),
      subscriptionStatus: mapClientStatusToAdminStatus(client),
      currentPeriodStart:
        readString(client, "starts_at") ||
        readString(client, "currentPeriodStart") ||
        readString(client, "created_at") ||
        new Date().toISOString(),
      currentPeriodEnd: expiresAt || addDaysIso(new Date().toISOString(), 7),
      isBlocked: blocked,
      adminNote: readString(client, "adminNote") || readString(client, "notes"),
      createdAt: readString(client, "created_at") || new Date().toISOString(),
      lastAccess: latestAccessLabel(email),
    },
    env,
  );
}

function normalizeAdminManagedUser(user: Record<string, unknown>, env?: unknown) {
  const email = readString(user, "email").toLowerCase();
  const currentPeriodEnd =
    readString(user, "currentPeriodEnd") ||
    readString(user, "current_period_end") ||
    readString(user, "expires_at") ||
    addDaysIso(new Date().toISOString(), 7);
  const rawStatus = normalizeAdminSubscriptionStatus(
    readString(user, "subscriptionStatus") ||
      readString(user, "subscription_status") ||
      readString(user, "access_status"),
  );
  const isBlocked = Boolean(user.isBlocked) || Boolean(user.is_blocked) || rawStatus === "blocked";
  const status = isBlocked
    ? "blocked"
    : isExpiredIso(currentPeriodEnd) && rawStatus !== "canceled"
      ? "expired"
      : rawStatus;
  return {
    id: readString(user, "id") || email || crypto.randomUUID(),
    name: readString(user, "name") || readString(user, "full_name") || nameFromEmail(email),
    email,
    phone: readString(user, "phone"),
    phoneFull: readString(user, "phoneFull") || readString(user, "phone_full"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    countryCode: readString(user, "countryCode") || readString(user, "country_code"),
    role: normalizeManagedUserRole(
      isAdminOwnerEmailForEnv(env, email)
        ? "owner"
        : isAdminApproverEmailForEnv(env, email)
          ? "admin"
          : readString(user, "role"),
    ),
    plan: normalizeAdminPlan(readString(user, "plan")),
    subscriptionStatus: status,
    currentPeriodStart:
      readString(user, "currentPeriodStart") ||
      readString(user, "current_period_start") ||
      readString(user, "starts_at") ||
      readString(user, "created_at") ||
      new Date().toISOString(),
    currentPeriodEnd,
    isBlocked,
    adminNote:
      readString(user, "adminNote") || readString(user, "admin_note") || readString(user, "notes"),
    createdAt:
      readString(user, "createdAt") || readString(user, "created_at") || new Date().toISOString(),
    lastAccess:
      readString(user, "lastAccess") || readString(user, "last_access") || latestAccessLabel(email),
  };
}

async function updateAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  body: Record<string, unknown>,
  preferredAction: AdminActionType,
): Promise<
  { ok: true; user: Record<string, unknown> } | { ok: false; status: number; error: string }
> {
  const before = normalizeAdminManagedUser(target, env);
  const actorEmail = adminActorEmailFromRequest(request, env, adminRole);
  const nextRole = Object.hasOwn(body, "role") ? normalizeManagedUserRole(body.role) : before.role;
  const changingRole = nextRole !== before.role;
  const requestedBlocked = Object.hasOwn(body, "isBlocked")
    ? Boolean(body.isBlocked)
    : before.isBlocked;

  const permission = canEditAdminManagedUser(adminRole, actorEmail, before, {
    changingRole,
    nextRole,
    requestedBlocked,
  });
  if (!permission.ok) return permission;

  const requestedPlan = Object.hasOwn(body, "plan") ? normalizeAdminPlan(body.plan) : before.plan;
  let status = Object.hasOwn(body, "subscriptionStatus")
    ? normalizeAdminSubscriptionStatus(body.subscriptionStatus)
    : before.subscriptionStatus;
  if (requestedPlan === "free" && ["active", "manual_vip", "trial"].includes(status)) {
    status = "canceled";
  }
  const updated = normalizeAdminManagedUser(
    {
      ...before,
      name: Object.hasOwn(body, "name") ? readString(body, "name") : before.name,
      email: Object.hasOwn(body, "email") ? readString(body, "email").toLowerCase() : before.email,
      phone: Object.hasOwn(body, "phone") ? readString(body, "phone") : before.phone,
      phoneFull: Object.hasOwn(body, "phoneFull")
        ? readString(body, "phoneFull")
        : Object.hasOwn(body, "phone_full")
          ? readString(body, "phone_full")
          : before.phoneFull,
      city: Object.hasOwn(body, "city") ? readString(body, "city") : before.city,
      country: Object.hasOwn(body, "country") ? readString(body, "country") : before.country,
      countryCode: Object.hasOwn(body, "countryCode")
        ? readString(body, "countryCode")
        : Object.hasOwn(body, "country_code")
          ? readString(body, "country_code")
          : before.countryCode,
      role: nextRole,
      plan: requestedPlan,
      subscriptionStatus: requestedBlocked ? "blocked" : status,
      currentPeriodStart: Object.hasOwn(body, "currentPeriodStart")
        ? readString(body, "currentPeriodStart")
        : before.currentPeriodStart,
      currentPeriodEnd: Object.hasOwn(body, "currentPeriodEnd")
        ? readString(body, "currentPeriodEnd")
        : before.currentPeriodEnd,
      isBlocked: requestedBlocked,
      adminNote: Object.hasOwn(body, "adminNote")
        ? readString(body, "adminNote")
        : before.adminNote,
    },
    env,
  );

  upsertAdminManagedUser(updated);
  applyAdminManagedUserToClient(updated);
  if (shouldClearBillingAccessForAdminUpdate(updated)) {
    clearBillingStateForUser(updated);
    await deletePersistedBillingAccess(env, updated);
  }
  recordAdminActionLog(env, request, adminRole, {
    targetUserId: readString(updated, "id"),
    targetEmail: readString(updated, "email"),
    action: inferAdminAction(preferredAction, before, updated),
    beforeJson: before,
    afterJson: updated,
    reason: readString(body, "reason"),
  });
  return { ok: true, user: updated };
}

async function extendAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  days: number,
  reason: string,
) {
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return { ok: false as const, status: 400, error: "Quantidade de dias inválida." };
  }
  const before = normalizeAdminManagedUser(target, env);
  const baseMs = Date.parse(before.currentPeriodEnd);
  const base = Number.isFinite(baseMs) && baseMs > Date.now() ? new Date(baseMs) : new Date();
  const currentPeriodEnd = addDaysIso(base.toISOString(), days);
  const status =
    before.plan === "vip_manual" || before.subscriptionStatus === "manual_vip"
      ? "manual_vip"
      : before.plan === "trial"
        ? "trial"
        : "active";
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    before,
    {
      currentPeriodEnd,
      subscriptionStatus: status,
      isBlocked: false,
      reason: reason || `Prorrogação de ${days} dias`,
    },
    "EXTEND_ACCESS",
  );
}

async function blockAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
) {
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    target,
    {
      isBlocked: true,
      subscriptionStatus: "blocked",
      reason: reason || "Bloqueio manual",
    },
    "BLOCK_USER",
  );
}

async function unblockAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
) {
  const before = normalizeAdminManagedUser(target, env);
  const nextStatus = isExpiredIso(before.currentPeriodEnd)
    ? "expired"
    : before.plan === "vip_manual"
      ? "manual_vip"
      : before.plan === "trial"
        ? "trial"
        : "active";
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    target,
    {
      isBlocked: false,
      subscriptionStatus: nextStatus,
      reason: reason || "Reativação manual",
    },
    "UNBLOCK_USER",
  );
}

async function deleteAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
): Promise<
  { ok: true; user: Record<string, unknown> } | { ok: false; status: number; error: string }
> {
  const before = normalizeAdminManagedUser(target, env);
  const actorEmail = adminActorEmailFromRequest(request, env, adminRole);
  const permission = canDeleteAdminManagedUser(adminRole, actorEmail, before);
  if (!permission.ok) return permission;

  markEntityDeleted(before);
  removeUserEntityEverywhere(before);
  recordAdminActionLog(env, request, adminRole, {
    targetUserId: readString(before, "id"),
    targetEmail: readString(before, "email"),
    action: "DELETE_USER",
    beforeJson: before,
    afterJson: { deleted: true },
    reason: reason || "Exclusão manual de cadastro",
  });
  await deletePersistedBillingUser(env, before);
  return { ok: true, user: before };
}

function canDeleteAdminManagedUser(
  adminRole: AdminRole,
  actorEmail: string,
  target: Record<string, unknown>,
): { ok: true } | { ok: false; status: number; error: string } {
  if (adminRole !== "owner") {
    return { ok: false, status: 403, error: "Apenas owner pode excluir cadastros." };
  }

  const targetEmail = readString(target, "email").toLowerCase();
  const targetRole = normalizeManagedUserRole(target.role);
  if (targetRole === "owner") {
    const ownerCount = syncAdminManagedUsers().filter(
      (user) => normalizeManagedUserRole(user.role) === "owner",
    ).length;
    if (ownerCount <= 1) {
      return { ok: false, status: 403, error: "Não é permitido excluir o único owner ativo." };
    }
  }

  if (targetEmail && targetEmail === actorEmail) {
    return {
      ok: false,
      status: 403,
      error: "Não é permitido excluir o próprio cadastro por esta rota.",
    };
  }

  return { ok: true };
}

function canEditAdminManagedUser(
  adminRole: AdminRole,
  actorEmail: string,
  target: Record<string, unknown>,
  change: { changingRole: boolean; nextRole: AdminManagedUserRole; requestedBlocked: boolean },
): { ok: true } | { ok: false; status: number; error: string } {
  const targetRole = normalizeManagedUserRole(target.role);
  const targetEmail = readString(target, "email").toLowerCase();
  if (adminRole !== "owner" && targetRole !== "user") {
    return { ok: false, status: 403, error: "Admin não pode alterar outro admin ou owner." };
  }
  if (change.changingRole && adminRole !== "owner") {
    return {
      ok: false,
      status: 403,
      error: "Apenas owner pode alterar permissoes administrativas.",
    };
  }
  if (targetRole === "owner" && adminRole !== "owner") {
    return { ok: false, status: 403, error: "Admin não pode alterar owner." };
  }
  if (
    adminRole !== "owner" &&
    targetEmail === actorEmail &&
    (change.changingRole || change.requestedBlocked)
  ) {
    return {
      ok: false,
      status: 403,
      error: "Admin não pode remover o próprio acesso por esta rota.",
    };
  }
  if (
    targetRole === "owner" &&
    targetEmail === actorEmail &&
    (change.nextRole !== "owner" || change.requestedBlocked)
  ) {
    const ownerCount = syncAdminManagedUsers().filter(
      (user) => normalizeManagedUserRole(user.role) === "owner",
    ).length;
    if (ownerCount <= 1) {
      return { ok: false, status: 403, error: "Não é permitido remover o único owner ativo." };
    }
  }
  return { ok: true };
}

function upsertAdminManagedUser(user: Record<string, unknown>) {
  const normalized = normalizeAdminManagedUser(user);
  const id = readString(normalized, "id");
  const email = readString(normalized, "email").toLowerCase();
  const index = liveAdminUsers.findIndex((item) => {
    return readString(item, "id") === id || readString(item, "email").toLowerCase() === email;
  });
  liveAdminUsers =
    index >= 0
      ? liveAdminUsers.map((item, itemIndex) => (itemIndex === index ? normalized : item))
      : [normalized, ...liveAdminUsers];
}

function applyAdminManagedUserToClient(user: Record<string, unknown>) {
  const client = adminManagedUserToClient(user);
  clearDeletedEntityForRecord(client);
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  if (shouldClearBillingAccessForAdminUpdate(user)) {
    clearBillingStateForUser(user);
    return;
  }
  const email = readString(client, "email").toLowerCase();
  if (email) {
    upsertSubscriptionRecord({
      id: `admin-${email}`,
      email,
      plan: readString(user, "plan"),
      status: readString(user, "subscriptionStatus"),
      starts_at: readString(user, "currentPeriodStart"),
      expires_at: readString(user, "currentPeriodEnd"),
      provider: "admin_manual",
      updated_at: new Date().toISOString(),
    });
  }
}

function shouldClearBillingAccessForAdminUpdate(user: Record<string, unknown>) {
  const plan = normalizeAdminPlan(readString(user, "plan"));
  const status = normalizeAdminSubscriptionStatus(readString(user, "subscriptionStatus"));
  return (
    plan === "free" ||
    plan === "trial" ||
    status === "canceled" ||
    status === "blocked" ||
    status === "expired"
  );
}

function adminManagedUserToClient(user: Record<string, unknown>) {
  const status = normalizeAdminSubscriptionStatus(readString(user, "subscriptionStatus"));
  const blocked = Boolean(user.isBlocked) || status === "blocked";
  const expiresAt = readString(user, "currentPeriodEnd");
  const active =
    !blocked && ["active", "manual_vip", "trial"].includes(status) && !isExpiredIso(expiresAt);
  return {
    id: readString(user, "id"),
    full_name: readString(user, "name"),
    email: readString(user, "email").toLowerCase(),
    phone: readString(user, "phone"),
    phone_full: readString(user, "phoneFull") || readString(user, "phone_full"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    country_code: readString(user, "countryCode") || readString(user, "country_code"),
    role: normalizeManagedUserRole(user.role),
    plan: mapAdminPlanToClientPlan(normalizeAdminPlan(readString(user, "plan"))),
    access_status: blocked ? "blocked" : active ? "approved" : status,
    enabled: active,
    isBlocked: blocked,
    starts_at: readString(user, "currentPeriodStart"),
    expires_at: expiresAt,
    notes: readString(user, "adminNote"),
    adminNote: readString(user, "adminNote"),
    created_at: readString(user, "createdAt") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function recordAdminActionLog(
  env: unknown,
  request: Request,
  adminRole: AdminRole,
  log: {
    targetUserId: string;
    targetEmail: string;
    action: AdminActionType;
    beforeJson: Record<string, unknown>;
    afterJson: Record<string, unknown>;
    reason: string;
  },
) {
  const adminEmail = adminActorEmailFromRequest(request, env, adminRole);
  const entry = {
    id: crypto.randomUUID(),
    adminUserId: adminEmail || adminRole,
    adminEmail,
    targetUserId: log.targetUserId,
    targetEmail: log.targetEmail,
    action: log.action,
    beforeJson: log.beforeJson,
    afterJson: log.afterJson,
    reason: log.reason,
    createdAt: new Date().toISOString(),
  };
  liveAdminActionLogs = [entry, ...liveAdminActionLogs].slice(0, 500);
  recordAccessEvent("admin_action", {
    email: adminEmail,
    full_name: nameFromEmail(adminEmail),
    detail: `${log.action} em ${log.targetEmail}`,
    risk: "low",
  });
  return entry;
}

function normalizeAdminActionLog(log: Record<string, unknown>) {
  return {
    id: readString(log, "id") || crypto.randomUUID(),
    adminUserId: readString(log, "adminUserId") || readString(log, "admin_user_id"),
    adminEmail: readString(log, "adminEmail") || readString(log, "admin_email"),
    targetUserId: readString(log, "targetUserId") || readString(log, "target_user_id"),
    targetEmail: readString(log, "targetEmail") || readString(log, "target_email"),
    action: normalizeAdminAction(readString(log, "action")),
    beforeJson: readRecord(log.beforeJson || log.before_json),
    afterJson: readRecord(log.afterJson || log.after_json),
    reason: readString(log, "reason"),
    createdAt:
      readString(log, "createdAt") || readString(log, "created_at") || new Date().toISOString(),
  };
}

function inferAdminAction(
  preferred: AdminActionType,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AdminActionType {
  if (preferred === "UPDATE_ROLE") return "UPDATE_ROLE";
  if (preferred === "EXTEND_ACCESS") return "EXTEND_ACCESS";
  if (preferred === "BLOCK_USER" || readString(after, "subscriptionStatus") === "blocked")
    return "BLOCK_USER";
  if (preferred === "UNBLOCK_USER") return "UNBLOCK_USER";
  if (readString(after, "subscriptionStatus") === "manual_vip") return "MANUAL_VIP_GRANTED";
  if (readString(after, "subscriptionStatus") === "canceled") return "CANCEL_ACCESS";
  if (readString(before, "currentPeriodEnd") !== readString(after, "currentPeriodEnd"))
    return "UPDATE_EXPIRATION_DATE";
  if (readString(before, "plan") !== readString(after, "plan")) return "UPDATE_PLAN";
  if (readString(before, "subscriptionStatus") !== readString(after, "subscriptionStatus"))
    return "UPDATE_SUBSCRIPTION_STATUS";
  return preferred;
}

function mapClientPlanToAdminPlan(plan: string, status: string): AdminManagedUserPlan {
  const cleanPlan = plan.toLowerCase();
  const cleanStatus = status.toLowerCase();
  if (cleanStatus === "trial") return "trial";
  if (cleanStatus === "manual_vip") return "vip_manual";
  if (cleanPlan === "vip") return "premium";
  if (cleanPlan === "premium") return "premium";
  return "free";
}

function mapAdminPlanToClientPlan(plan: AdminManagedUserPlan): BillingPlanId {
  if (plan === "premium" || plan === "monthly") return "premium";
  if (plan === "vip_manual") return "vip";
  return "free";
}

function mapClientStatusToAdminStatus(client: Record<string, unknown>): AdminSubscriptionStatus {
  const status = readString(client, "access_status").toLowerCase();
  if (Boolean(client.isBlocked) || Boolean(client.is_blocked) || status === "blocked")
    return "blocked";
  if (status === "manual_vip") return "manual_vip";
  if (status === "trial") return "trial";
  if (status === "canceled" || status === "cancelled") return "canceled";
  if (isExpiredIso(readString(client, "expires_at"))) return "expired";
  if (Boolean(client.enabled) || status === "approved" || status === "active") return "active";
  return "expired";
}

function normalizeManagedUserRole(value: unknown): AdminManagedUserRole {
  const text = String(value || "user")
    .trim()
    .toLowerCase();
  if (text === "owner") return "owner";
  if (text === "admin" || text === "approver") return "admin";
  return "user";
}

function normalizeAdminPlan(value: unknown): AdminManagedUserPlan {
  const text = String(value || "free")
    .trim()
    .toLowerCase();
  if (text === "trial" || text === "monthly" || text === "premium" || text === "vip_manual")
    return text;
  if (text === "vip") return "premium";
  return "free";
}

function normalizeAdminSubscriptionStatus(value: unknown): AdminSubscriptionStatus {
  const text = String(value || "expired")
    .trim()
    .toLowerCase();
  if (
    text === "trial" ||
    text === "active" ||
    text === "expired" ||
    text === "canceled" ||
    text === "blocked" ||
    text === "manual_vip"
  )
    return text;
  if (text === "cancelled") return "canceled";
  if (text === "approved") return "active";
  if (text === "paused") return "blocked";
  return "expired";
}

function normalizeAdminAction(value: string): AdminActionType {
  const actions: AdminActionType[] = [
    "UPDATE_USER",
    "UPDATE_PLAN",
    "UPDATE_SUBSCRIPTION_STATUS",
    "EXTEND_ACCESS",
    "BLOCK_USER",
    "UNBLOCK_USER",
    "UPDATE_ROLE",
    "UPDATE_EXPIRATION_DATE",
    "MANUAL_VIP_GRANTED",
    "CANCEL_ACCESS",
    "REACTIVATE_USER",
    "DELETE_USER",
  ];
  return actions.includes(value as AdminActionType) ? (value as AdminActionType) : "UPDATE_USER";
}

function adminActorEmailFromRequest(request: Request, env: unknown, role: AdminRole) {
  const token = getBearerToken(request);
  if (token === getAdminToken(env)) return role;
  const payload = decodeJwtPayload(token);
  return readString(payload, "email").toLowerCase() || role;
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return readRecord(JSON.parse(atob(padded)));
  } catch {
    return {};
  }
}

function isAdminOwnerEmailForEnv(env: unknown, email: string) {
  return getAdminEmails(env).includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

function isAdminApproverEmailForEnv(env: unknown, email: string) {
  return getAdminApproverEmails(env).includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

function latestAccessLabel(email: string) {
  const event = liveAccessEvents.find(
    (item) => readString(item, "email").toLowerCase() === email.toLowerCase(),
  );
  return event ? relativeTimeFromIso(readString(event, "created_at")) : "Sem registro";
}

function relativeTimeFromIso(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "ha pouco";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;
  const days = Math.floor(hours / 24);
  return `ha ${days} dias`;
}

function mockAdminManagedUsers() {
  return [
    {
      id: "1",
      name: "Gabriel",
      email: "gabriel@email.com",
      role: "owner",
      plan: "premium",
      subscriptionStatus: "manual_vip",
      currentPeriodStart: "2026-06-01T10:00:00Z",
      currentPeriodEnd: "2026-06-30T23:59:59Z",
      isBlocked: false,
      adminNote: "Mock inicial.",
      createdAt: "2026-06-01T10:00:00Z",
      lastAccess: "ha 5 min",
    },
    {
      id: "2",
      name: "Cliente Teste",
      email: "cliente@email.com",
      role: "user",
      plan: "monthly",
      subscriptionStatus: "active",
      currentPeriodStart: "2026-06-01T12:00:00Z",
      currentPeriodEnd: "2026-06-15T23:59:59Z",
      isBlocked: false,
      adminNote: "",
      createdAt: "2026-06-01T12:00:00Z",
      lastAccess: "ha 2 horas",
    },
    {
      id: "3",
      name: "Usuário Vencido",
      email: "vencido@email.com",
      role: "user",
      plan: "monthly",
      subscriptionStatus: "expired",
      currentPeriodStart: "2026-05-01T12:00:00Z",
      currentPeriodEnd: "2026-05-01T23:59:59Z",
      isBlocked: false,
      adminNote: "",
      createdAt: "2026-05-01T12:00:00Z",
      lastAccess: "ha 3 dias",
    },
    {
      id: "4",
      name: "Usuário Bloqueado",
      email: "bloqueado@email.com",
      role: "user",
      plan: "premium",
      subscriptionStatus: "blocked",
      currentPeriodStart: "2026-05-20T12:00:00Z",
      currentPeriodEnd: "2026-07-01T23:59:59Z",
      isBlocked: true,
      adminNote: "",
      createdAt: "2026-05-20T12:00:00Z",
      lastAccess: "ha 7 dias",
    },
  ];
}

function uniquePeople(records: Array<Record<string, unknown>>) {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const key = readString(record, "email").toLowerCase() || readString(record, "id");
    if (!key) continue;
    byKey.set(key, { ...(byKey.get(key) || {}), ...record });
  }
  return [...byKey.values()];
}

function buildLocationBreakdown(
  records: Array<Record<string, unknown>>,
  field: "city" | "country",
) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = readString(record, field) || "Não informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function upsertRecipientFromClient(client: Record<string, unknown>) {
  if (isEntityDeleted(client)) return false;
  const email = readString(client, "email").toLowerCase();
  if (!email) return false;
  const existingIndex = liveRecipients.findIndex(
    (recipient) => readString(recipient, "email").toLowerCase() === email,
  );
  const recipient = normalizeRecipient({
    ...(existingIndex >= 0 ? liveRecipients[existingIndex] : {}),
    name: readString(client, "full_name") || email,
    full_name: readString(client, "full_name") || email,
    email,
    phone: readString(client, "phone"),
    phone_full: readString(client, "phone_full") || readString(client, "phoneFull"),
    city: readString(client, "city"),
    country: readString(client, "country"),
    country_code: readString(client, "country_code") || readString(client, "countryCode"),
    enabled: Boolean(client.enabled),
    plan: readString(client, "plan") || "free",
    access_status: readString(client, "access_status") || "pending",
    starts_at: readString(client, "starts_at") || todayIso(),
    validity_days: Number(client.validity_days || 30),
    expires_at: readString(client, "expires_at"),
  });

  liveRecipients =
    existingIndex >= 0
      ? liveRecipients.map((item, index) => (index === existingIndex ? recipient : item))
      : [...liveRecipients, recipient];
  return true;
}

function upsertClientFromRecipient(recipient: Record<string, unknown>) {
  if (isEntityDeleted(recipient)) return;
  const email = readString(recipient, "email").toLowerCase();
  if (!email) return;
  const existingIndex = liveClients.findIndex(
    (client) => readString(client, "email").toLowerCase() === email,
  );
  const client = {
    ...(existingIndex >= 0 ? liveClients[existingIndex] : {}),
    full_name: readString(recipient, "full_name") || readString(recipient, "name") || email,
    email,
    phone: readString(recipient, "phone"),
    phone_full: readString(recipient, "phone_full") || readString(recipient, "phoneFull"),
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
    country_code: readString(recipient, "country_code") || readString(recipient, "countryCode"),
    plan: readString(recipient, "plan") || "free",
    access_status: readString(recipient, "access_status") || "pending",
    enabled: Boolean(recipient.enabled),
    starts_at: readString(recipient, "starts_at"),
    validity_days: Number(recipient.validity_days || 30),
    expires_at: readString(recipient, "expires_at"),
    created_at: readString(recipient, "created_at") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  liveClients =
    existingIndex >= 0
      ? liveClients.map((item, index) => (index === existingIndex ? client : item))
      : [...liveClients, client];
}

async function updateClientPasswordFromBody(
  clientHint: Record<string, unknown>,
  body: Record<string, unknown>,
) {
  const password = readString(body, "password") || readString(body, "new_password");
  if (!password) return false;

  const id = readString(clientHint, "id");
  const email = readString(clientHint, "email").toLowerCase();
  const clientIndex = liveClients.findIndex((client) => {
    const sameId = id && readString(client, "id") === id;
    const sameEmail = email && readString(client, "email").toLowerCase() === email;
    return sameId || sameEmail;
  });
  if (clientIndex === -1) return false;

  const passwordHash = await hashPassword(password);
  liveClients = liveClients.map((client, index) =>
    index === clientIndex
      ? removeLegacyPassword({
          ...client,
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
      : client,
  );
  return true;
}

function removeLegacyPassword(client: Record<string, unknown>) {
  const updated = { ...client };
  delete updated.password;
  return updated;
}

function syncRecipientsFromClients() {
  let changed = false;
  for (const client of liveClients) {
    const before = JSON.stringify(liveRecipients);
    const didSync = upsertRecipientFromClient(client);
    changed = changed || (didSync && before !== JSON.stringify(liveRecipients));
  }
  return changed;
}

function isExpiredIso(value: string) {
  if (!value) return false;
  const clean = value.trim();
  const expiration = new Date(clean.includes("T") ? clean : `${clean}T23:59:59`);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration.getTime() < Date.now();
}

function readString(record: Record<string, unknown>, key: string) {
  return String(record[key] || "").trim();
}

function readBooleanField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "sim", "yes", "on", "approved", "active"].includes(text);
}

function parseEmailList(value: unknown) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,;\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Administrador";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(startIso: string, days: number) {
  const clean = startIso.trim();
  const hasTime = clean.includes("T");
  const date = new Date(hasTime ? clean : `${clean}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + Math.max(0, Math.floor(Number(days) || 0)));
    return hasTime ? fallback.toISOString() : fallback.toISOString().slice(0, 10);
  }
  date.setDate(date.getDate() + Math.max(0, Math.floor(Number(days) || 0)));
  return hasTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

function addMinutesIso(startIso: string, minutes: number) {
  const date = new Date(startIso.trim() || new Date().toISOString());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  safeDate.setMinutes(safeDate.getMinutes() + Math.max(0, Math.floor(Number(minutes) || 0)));
  return safeDate.toISOString();
}

function freeTrialMinutes(env: unknown) {
  return Math.max(
    1,
    Math.floor(readServerNumber(env, "SNIPER_FREE_TRIAL_MINUTES", FREE_TRIAL_MINUTES)),
  );
}

function getLiveStateCache() {
  return (globalThis as { caches?: WorkerCacheStorage }).caches?.default || null;
}

function liveStateCacheRequest() {
  return new Request(LIVE_STATE_CACHE_URL, { method: "GET" });
}

async function loadLiveState(env: unknown) {
  const currentSalesSettings = liveSalesSettings;
  const currentSiteContentSettings = liveSiteContentSettings;
  const [durableState, cacheState] = await Promise.all([
    loadDurableLiveState(env),
    loadLiveStateCache(),
  ]);
  const state = mergeLiveStates(durableState, cacheState);
  if (state) {
    applyLiveState(state);
    if (isSalesSettingsNewer(currentSalesSettings, liveSalesSettings)) {
      liveSalesSettings = currentSalesSettings;
    }
    if (isSiteContentSettingsNewer(currentSiteContentSettings, liveSiteContentSettings)) {
      liveSiteContentSettings = currentSiteContentSettings;
    }
    await saveLiveState(env);
  }
}

async function loadLiveStateCache() {
  const cache = getLiveStateCache();
  if (!cache) return null;

  try {
    const response = await cache.match(liveStateCacheRequest());
    if (!response) return null;

    return readRecord(await response.json().catch(() => null));
  } catch (error) {
    console.warn("Não foi possível carregar estado vivo do cache.", error);
    return null;
  }
}

function applyLiveState(state: Record<string, unknown>) {
  const dashboard = readRecord(state.dashboard);
  if (Object.keys(dashboard).length > 0) {
    liveDashboardData = restoreDashboardData(dashboard);
  }

  if (Array.isArray(state.recipients)) {
    liveRecipients = state.recipients
      .map(readRecord)
      .filter((recipient) => Object.keys(recipient).length > 0);
  }

  if (Array.isArray(state.clients)) {
    liveClients = state.clients.map(readRecord).filter((client) => Object.keys(client).length > 0);
  }

  if (Array.isArray(state.accessEvents)) {
    liveAccessEvents = state.accessEvents
      .map(readRecord)
      .filter((event) => Object.keys(event).length > 0)
      .slice(0, 200);
  }

  if (Array.isArray(state.subscriptions)) {
    liveSubscriptions = state.subscriptions
      .map(readRecord)
      .filter((subscription) => Object.keys(subscription).length > 0)
      .slice(0, 500);
  }

  if (Array.isArray(state.payments)) {
    livePayments = state.payments
      .map(readRecord)
      .filter((payment) => Object.keys(payment).length > 0)
      .slice(0, 1000);
  }

  if (Array.isArray(state.adminUsers)) {
    liveAdminUsers = state.adminUsers
      .map(readRecord)
      .filter((user) => Object.keys(user).length > 0);
  }

  if (Array.isArray(state.adminActionLogs)) {
    liveAdminActionLogs = state.adminActionLogs
      .map(readRecord)
      .filter((log) => Object.keys(log).length > 0)
      .slice(0, 500);
  }

  if (Array.isArray(state.deletedEntities)) {
    liveDeletedEntities = state.deletedEntities
      .map(readRecord)
      .filter((entry) => Object.keys(entry).length > 0)
      .slice(0, 1000);
  }

  applyDeletedEntityTombstones();

  const moduleToggles = readRecord(state.moduleToggles);
  if (Object.keys(moduleToggles).length > 0) {
    liveModuleToggles = restoreModuleToggles(moduleToggles);
    liveDashboardData = { ...liveDashboardData, moduleToggles: liveModuleToggles };
  }

  const salesSettings = readRecord(state.salesSettings);
  if (Object.keys(salesSettings).length > 0) {
    liveSalesSettings = restoreSalesSettings(salesSettings);
  }

  const siteContent = readRecord(state.siteContent);
  if (Object.keys(siteContent).length > 0) {
    liveSiteContentSettings = restoreSiteContentSettings(siteContent);
  }

  const localAiSettings = readRecord(state.localAiSettings);
  if (Object.keys(localAiSettings).length > 0) {
    liveLocalAiSettings = normalizeLocalAiSettingsPatch(localAiSettings, getLocalAiSettings({}));
  }

  if (Array.isArray(state.localAiLogs)) {
    liveLocalAiLogs = state.localAiLogs
      .map(readRecord)
      .filter((log) => Object.keys(log).length > 0)
      .slice(0, 250) as LocalAiLog[];
  }
}

function mergeLiveStates(
  durableState: Record<string, unknown> | null,
  cacheState: Record<string, unknown> | null,
) {
  if (!durableState && !cacheState) return null;
  const durable = durableState || {};
  const cache = cacheState || {};
  const durableSavedAt = stateSavedAtMs(durable);
  const cacheSavedAt = stateSavedAtMs(cache);
  const deletedEntities = mergeDeletedEntityStates(
    durable.deletedEntities,
    cache.deletedEntities,
  ).slice(0, 1000);
  return {
    ...cache,
    ...durable,
    dashboard: pickDashboardState(durable.dashboard, cache.dashboard),
    recipients: filterDeletedEntityRows(
      mergeEntityStateArrays(
        durable.recipients,
        cache.recipients,
        durableSavedAt,
        cacheSavedAt,
        true,
      ),
      deletedEntities,
    ),
    clients: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.clients, cache.clients, durableSavedAt, cacheSavedAt, true),
      deletedEntities,
    ),
    accessEvents: mergeStateArrays(durable.accessEvents, cache.accessEvents).slice(0, 200),
    subscriptions: filterDeletedEntityRows(
      mergeEntityStateArrays(
        durable.subscriptions,
        cache.subscriptions,
        durableSavedAt,
        cacheSavedAt,
      ),
      deletedEntities,
    ).slice(0, 500),
    payments: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.payments, cache.payments, durableSavedAt, cacheSavedAt),
      deletedEntities,
    ).slice(0, 1000),
    adminUsers: filterDeletedEntityRows(
      mergeEntityStateArrays(
        durable.adminUsers,
        cache.adminUsers,
        durableSavedAt,
        cacheSavedAt,
        true,
      ),
      deletedEntities,
    ),
    adminActionLogs: mergeStateArrays(durable.adminActionLogs, cache.adminActionLogs).slice(0, 500),
    deletedEntities,
    moduleToggles: pickStateObject(durable.moduleToggles, cache.moduleToggles),
    salesSettings: pickStateObjectByUpdatedAt(durable.salesSettings, cache.salesSettings),
    siteContent: pickStateObjectByUpdatedAt(durable.siteContent, cache.siteContent),
    savedAt:
      readString(durable, "savedAt") || readString(cache, "savedAt") || new Date().toISOString(),
  };
}

function pickStateObject(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  if (Object.keys(first).length > 0) return first;
  return readRecord(secondary);
}

function pickStateObjectByUpdatedAt(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  const second = readRecord(secondary);
  if (!hasRecordFields(first)) return second;
  if (!hasRecordFields(second)) return first;

  const firstTime = stateEntityUpdatedAtMs(first);
  const secondTime = stateEntityUpdatedAtMs(second);
  return firstTime >= secondTime ? first : second;
}

function isSalesSettingsNewer(left: SalesSettings, right: SalesSettings) {
  const leftTime = stateEntityUpdatedAtMs(left as unknown as Record<string, unknown>);
  const rightTime = stateEntityUpdatedAtMs(right as unknown as Record<string, unknown>);
  if (leftTime || rightTime) return leftTime > rightTime;
  return left.salesClosed !== right.salesClosed && Boolean(left.updated_at);
}

function isSiteContentSettingsNewer(left: SiteContentSettings, right: SiteContentSettings) {
  const leftTime = stateEntityUpdatedAtMs(left as unknown as Record<string, unknown>);
  const rightTime = stateEntityUpdatedAtMs(right as unknown as Record<string, unknown>);
  if (leftTime || rightTime) return leftTime > rightTime;
  return left.popupId !== right.popupId && Boolean(left.updatedAt);
}

function pickDashboardState(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  const second = readRecord(secondary);
  if (!hasRecordFields(first)) return second;
  if (!hasRecordFields(second)) return first;
  return compareDashboardStateFreshness(first, second) >= 0 ? first : second;
}

function compareDashboardStateFreshness(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
) {
  const leftScore = dashboardStateFreshnessScore(left);
  const rightScore = dashboardStateFreshnessScore(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    const diff = leftScore[index] - rightScore[index];
    if (diff !== 0) return diff;
  }
  return 0;
}

function dashboardStateFreshnessScore(state: Record<string, unknown>) {
  const cycleDate = currentDashboardCycleDate();
  const rounds = Array.isArray(state.rounds) ? state.rounds.map(readRecord) : [];
  const lastRound = rounds[rounds.length - 1] ?? {};
  const lastRoundId = Number(readString(lastRound, "id") || lastRound.id || 0) || 0;
  const updatedAtMs = Date.parse(readString(state, "updatedAt") || "");
  const hasCurrentCycle = readDashboardCycleDate(state) === cycleDate ? 1 : 0;
  const hasLiveRounds = rounds.length > 0 ? 1 : 0;
  return [
    hasCurrentCycle,
    hasLiveRounds,
    lastRoundId,
    Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
    rounds.length,
  ];
}

function pickStateArray(primary: unknown, secondary: unknown) {
  const first = Array.isArray(primary) ? primary.map(readRecord).filter(hasRecordFields) : [];
  const second = Array.isArray(secondary) ? secondary.map(readRecord).filter(hasRecordFields) : [];
  return first.length >= second.length ? first : second;
}

function pickStateArrayByFreshness(
  primary: unknown,
  secondary: unknown,
  primarySavedAt: number,
  secondarySavedAt: number,
) {
  const first = Array.isArray(primary) ? primary.map(readRecord).filter(hasRecordFields) : [];
  const second = Array.isArray(secondary) ? secondary.map(readRecord).filter(hasRecordFields) : [];
  if (first.length === 0) return second;
  if (second.length === 0) return first;
  if (primarySavedAt || secondarySavedAt) {
    return primarySavedAt >= secondarySavedAt ? first : second;
  }
  return first.length >= second.length ? first : second;
}

function mergeStateArrays(primary: unknown, secondary: unknown) {
  const rows = [...pickStateArray(primary, []), ...pickStateArray(secondary, [])];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key =
      readString(row, "id") || readString(row, "email").toLowerCase() || JSON.stringify(row);
    byKey.set(key, { ...(byKey.get(key) || {}), ...row });
  }
  return [...byKey.values()];
}

function mergeEntityStateArrays(
  primary: unknown,
  secondary: unknown,
  primarySavedAt: number,
  secondarySavedAt: number,
  preferEmailKey = false,
) {
  const rows = [
    ...pickStateArray(primary, []).map((row) => ({ row, sourceSavedAt: primarySavedAt })),
    ...pickStateArray(secondary, []).map((row) => ({ row, sourceSavedAt: secondarySavedAt })),
  ];
  const byKey = new Map<string, { row: Record<string, unknown>; sourceSavedAt: number }>();

  for (const item of rows) {
    const key = stateEntityKey(item.row, preferEmailKey);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const incomingIsNewer =
      compareStateEntityFreshness(
        item.row,
        item.sourceSavedAt,
        existing.row,
        existing.sourceSavedAt,
      ) >= 0;
    byKey.set(
      key,
      incomingIsNewer
        ? { row: mergeStateEntityRecord(existing.row, item.row), sourceSavedAt: item.sourceSavedAt }
        : {
            row: mergeStateEntityRecord(item.row, existing.row),
            sourceSavedAt: existing.sourceSavedAt,
          },
    );
  }

  return [...byKey.values()].map((item) => item.row);
}

function stateEntityKey(row: Record<string, unknown>, preferEmailKey = false) {
  if (preferEmailKey) {
    return readString(row, "email").toLowerCase() || readString(row, "id") || JSON.stringify(row);
  }

  return (
    readString(row, "id") ||
    readString(row, "provider_payment_id") ||
    readString(row, "external_reference") ||
    readString(row, "email").toLowerCase() ||
    JSON.stringify(row)
  );
}

function compareStateEntityFreshness(
  left: Record<string, unknown>,
  leftSourceSavedAt: number,
  right: Record<string, unknown>,
  rightSourceSavedAt: number,
) {
  const leftScore = [stateEntityUpdatedAtMs(left), leftSourceSavedAt];
  const rightScore = [stateEntityUpdatedAtMs(right), rightSourceSavedAt];
  for (let index = 0; index < leftScore.length; index += 1) {
    const diff = leftScore[index] - rightScore[index];
    if (diff !== 0) return diff;
  }
  return 0;
}

function stateEntityUpdatedAtMs(row: Record<string, unknown>) {
  const time = Date.parse(
    readString(row, "updated_at") ||
      readString(row, "updatedAt") ||
      readString(row, "created_at") ||
      readString(row, "createdAt") ||
      "",
  );
  return Number.isFinite(time) ? time : 0;
}

function mergeStateEntityRecord(base: Record<string, unknown>, preferred: Record<string, unknown>) {
  const merged = { ...base, ...preferred };
  for (const [key, value] of Object.entries(base)) {
    if (isBlankStateValue(merged[key]) && !isBlankStateValue(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

function isBlankStateValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function mergeDeletedEntityStates(primary: unknown, secondary: unknown) {
  const rows = [...pickStateArray(primary, []), ...pickStateArray(secondary, [])];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = deletedEntityKey(row);
    const existing = byKey.get(key);
    if (!existing || deletedEntityTime(row) >= deletedEntityTime(existing)) {
      byKey.set(key, normalizeDeletedEntity(row));
    }
  }
  return [...byKey.values()];
}

function markEntityDeleted(row: Record<string, unknown>) {
  const deleted = normalizeDeletedEntity({
    id: readString(row, "id"),
    email: readString(row, "email").toLowerCase(),
    deleted_at: new Date().toISOString(),
  });
  if (!readString(deleted, "id") && !readString(deleted, "email")) return;

  liveDeletedEntities = [
    deleted,
    ...liveDeletedEntities.filter((entry) => !deletedEntitiesMatch(entry, deleted)),
  ].slice(0, 1000);
}

function removeUserEntityEverywhere(row: Record<string, unknown>) {
  liveRecipients = liveRecipients.filter((recipient) => !userEntityMatches(recipient, row));
  liveClients = liveClients.filter((client) => !userEntityMatches(client, row));
  liveAdminUsers = liveAdminUsers.filter((user) => !userEntityMatches(user, row));
  clearBillingStateForUser(row);
}

function clearBillingStateForUser(row: Record<string, unknown>) {
  liveSubscriptions = liveSubscriptions.filter(
    (subscription) => !userEntityMatches(subscription, row),
  );
  livePayments = livePayments.filter((payment) => !userEntityMatches(payment, row));
}

function userEntityMatches(row: Record<string, unknown>, target: Record<string, unknown>) {
  const targetId = readString(target, "id");
  const targetEmail = readString(target, "email").toLowerCase();
  const rowId = readString(row, "id");
  const rowUserId = readString(row, "user_id");
  const rowEmail = readString(row, "email").toLowerCase();
  return Boolean(
    (targetId && (rowId === targetId || rowUserId === targetId)) ||
    (targetEmail && rowEmail === targetEmail),
  );
}

function clearDeletedEntityForRecord(row: Record<string, unknown>) {
  liveDeletedEntities = liveDeletedEntities.filter((entry) => !deletedEntitiesMatch(entry, row));
}

function applyDeletedEntityTombstones() {
  liveRecipients = filterDeletedEntityRows(liveRecipients);
  liveClients = filterDeletedEntityRows(liveClients);
  liveAdminUsers = filterDeletedEntityRows(liveAdminUsers);
  liveSubscriptions = filterDeletedEntityRows(liveSubscriptions);
  livePayments = filterDeletedEntityRows(livePayments);
}

function filterDeletedEntityRows(
  rows: Record<string, unknown>[],
  deletedEntities = liveDeletedEntities,
) {
  return rows.filter((row) => !isEntityDeleted(row, deletedEntities));
}

function isEntityDeleted(row: Record<string, unknown>, deletedEntities = liveDeletedEntities) {
  const rowTime = stateEntityUpdatedAtMs(row);
  return deletedEntities.some((entry) => {
    if (!deletedEntitiesMatch(entry, row)) return false;
    const deletedAt = deletedEntityTime(entry);
    return !rowTime || !deletedAt || rowTime <= deletedAt;
  });
}

function deletedEntitiesMatch(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftId = readString(left, "id");
  const rightId = readString(right, "id");
  const leftEmail = readString(left, "email").toLowerCase();
  const rightEmail = readString(right, "email").toLowerCase();
  return Boolean(
    (leftId && rightId && leftId === rightId) ||
    (leftEmail && rightEmail && leftEmail === rightEmail),
  );
}

function normalizeDeletedEntity(row: Record<string, unknown>) {
  return {
    id: readString(row, "id"),
    email: readString(row, "email").toLowerCase(),
    deleted_at:
      readString(row, "deleted_at") || readString(row, "deletedAt") || new Date().toISOString(),
  };
}

function deletedEntityKey(row: Record<string, unknown>) {
  return readString(row, "email").toLowerCase() || readString(row, "id") || JSON.stringify(row);
}

function deletedEntityTime(row: Record<string, unknown>) {
  const time = Date.parse(readString(row, "deleted_at") || readString(row, "deletedAt") || "");
  return Number.isFinite(time) ? time : 0;
}

function hasRecordFields(record: Record<string, unknown>) {
  return Object.keys(record).length > 0;
}

function stateSavedAtMs(state: Record<string, unknown>) {
  const savedAt = Date.parse(readString(state, "savedAt") || "");
  return Number.isFinite(savedAt) ? savedAt : 0;
}

function buildLiveStateSnapshot() {
  return {
    dashboard: liveDashboardData,
    recipients: liveRecipients,
    clients: liveClients,
    accessEvents: liveAccessEvents,
    subscriptions: liveSubscriptions,
    payments: livePayments,
    adminUsers: liveAdminUsers,
    adminActionLogs: liveAdminActionLogs,
    deletedEntities: liveDeletedEntities,
    moduleToggles: liveModuleToggles,
    salesSettings: liveSalesSettings,
    siteContent: liveSiteContentSettings,
    localAiSettings: liveLocalAiSettings,
    localAiLogs: liveLocalAiLogs.slice(0, 250),
    savedAt: new Date().toISOString(),
  };
}

async function saveLiveState(env: unknown): Promise<LiveStateSaveStatus> {
  const state = buildLiveStateSnapshot();
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  const [durableResult, cacheResult] = await Promise.allSettled([
    saveDurableLiveState(env, state),
    saveLiveStateCache(state),
  ]);
  liveStateSaveStatus = {
    durable: durableResult.status === "fulfilled" && durableResult.value === true,
    cache: cacheResult.status === "fulfilled" && cacheResult.value === true,
    durableConfigured,
    saved_at: new Date().toISOString(),
  };
  return liveStateSaveStatus;
}

async function saveLiveStateCache(state: Record<string, unknown>) {
  const cache = getLiveStateCache();
  if (!cache) return false;

  try {
    await cache.put(
      liveStateCacheRequest(),
      new Response(JSON.stringify(state), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "public, max-age=31536000",
        },
      }),
    );
    return true;
  } catch (error) {
    console.warn("Não foi possível salvar estado vivo no cache.", error);
    return false;
  }
}

async function loadDurableLiveState(env: unknown) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return null;

  try {
    const response = await fetch(
      `${config.url}/rest/v1/${LIVE_STATE_TABLE}?id=eq.${encodeURIComponent(LIVE_STATE_ID)}&select=state`,
      {
        headers: supabasePersistenceHeaders(config.key),
      },
    );
    if (response.status === 404 || response.status === 406) return null;
    if (!response.ok) {
      console.warn(`Estado durável indisponível (${response.status}).`);
      return null;
    }

    const rows = await response.json().catch(() => null);
    const row = Array.isArray(rows) ? readRecord(rows[0]) : readRecord(rows);
    const state = readRecord(row.state);
    return Object.keys(state).length > 0 ? state : null;
  } catch (error) {
    console.warn("Não foi possível carregar estado durável.", error);
    return null;
  }
}

async function saveDurableLiveState(env: unknown, state: Record<string, unknown>) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/${LIVE_STATE_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: LIVE_STATE_ID,
        state,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!response.ok) {
      console.warn(`Não foi possível salvar estado durável (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Não foi possível salvar estado durável.", error);
    return false;
  }
}

function getSupabasePersistenceConfig(env: unknown) {
  const url = (
    readServerEnvString(env, "SUPABASE_URL", "") ||
    readServerEnvString(env, "VITE_SUPABASE_URL", "")
  ).replace(/\/+$/, "");
  const key =
    readServerEnvString(env, "SUPABASE_SERVICE_ROLE_KEY", "") ||
    readServerEnvString(env, "SUPABASE_SERVICE_KEY", "");

  if (!url || !key) return null;
  return { url, key };
}

function supabasePersistenceHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function restoreDashboardData(value: Record<string, unknown>): LiveDashboardData {
  if (isDefaultMockDashboardState(value)) {
    return resetDashboardDailyCycle(liveDashboardData);
  }

  if (
    compareDashboardStateFreshness(liveDashboardData as unknown as Record<string, unknown>, value) >
    0
  ) {
    return ensureDashboardDailyCycle(liveDashboardData).dashboard;
  }

  const incomingCycleDate = readDashboardCycleDate(value);
  const currentCycleDate = currentDashboardCycleDate();
  if (incomingCycleDate && incomingCycleDate !== currentCycleDate) {
    return ensureDashboardDailyCycle(liveDashboardData).dashboard;
  }

  const restored = updateDashboardData(liveDashboardData, value);
  const cycleDate = incomingCycleDate || restored.cycleDate || currentCycleDate;
  const restoredWithMetadata = {
    ...restored,
    updatedAt: readString(value, "updatedAt") || restored.updatedAt,
    cycleDate,
    dailyCycleDate: cycleDate,
  };
  return ensureDashboardDailyCycle(restoredWithMetadata).dashboard;
}

function isDefaultMockDashboardState(value: Record<string, unknown>) {
  const reading = readRecord(value.neuralReading);
  const signal = readRecord(value.currentSignal);
  const rounds = Array.isArray(value.rounds) ? value.rounds : [];
  return (
    rounds.length === mockDashboardData.rounds.length &&
    readString(signal, "id") === "current" &&
    readString(signal, "side") === "BANKER" &&
    readString(signal, "status") === "pending" &&
    serverSafeCounter(signal.strength) === 82 &&
    serverSafeCounter(reading.alertas) === 177 &&
    serverSafeCounter(reading.acertos) === 77 &&
    serverSafeCounter(reading.greenSemGale) === 52 &&
    serverSafeCounter(reading.greenG1) === 25 &&
    serverSafeCounter(reading.reds ?? reading.erros) === 100
  );
}

function restoreModuleToggles(value: Record<string, unknown>) {
  return {
    tieAlert: typeof value.tieAlert === "boolean" ? value.tieAlert : liveModuleToggles.tieAlert,
    surfAnalyzer:
      typeof value.surfAnalyzer === "boolean" ? value.surfAnalyzer : liveModuleToggles.surfAnalyzer,
  };
}

function restoreSalesSettings(value: Record<string, unknown>): SalesSettings {
  return {
    salesClosed:
      typeof value.salesClosed === "boolean" ? value.salesClosed : liveSalesSettings.salesClosed,
    updated_at:
      readString(value, "updated_at") ||
      readString(value, "updatedAt") ||
      liveSalesSettings.updated_at,
    updated_by:
      readString(value, "updated_by") ||
      readString(value, "updatedBy") ||
      liveSalesSettings.updated_by,
  };
}

function restoreSiteContentSettings(value: Record<string, unknown>): SiteContentSettings {
  return normalizeSiteContentSettings(value, liveSiteContentSettings);
}

function publicSalesSettings() {
  return {
    salesClosed: liveSalesSettings.salesClosed,
    mode: liveSalesSettings.salesClosed ? "closed" : "open",
  };
}

function publicSiteContentSettings() {
  return {
    ...liveSiteContentSettings,
    updatedBy: "",
  };
}

function adminSalesSettings(env?: unknown, saveStatus = liveStateSaveStatus) {
  const durableConfigured = env
    ? Boolean(getSupabasePersistenceConfig(env))
    : saveStatus.durableConfigured;
  const durableReady = saveStatus.durable || (durableConfigured && !saveStatus.saved_at);
  const warning = !durableConfigured
    ? "Persistência fixa não configurada. Configure SUPABASE_SERVICE_ROLE_KEY no Lovable para a chave não voltar sozinha."
    : saveStatus.saved_at && !saveStatus.durable
      ? "Não foi possível confirmar o salvamento durável. Verifique a tabela sniper_live_state no Supabase."
      : "";
  return {
    ...publicSalesSettings(),
    updated_at: liveSalesSettings.updated_at,
    updated_by: liveSalesSettings.updated_by,
    persistence: durableReady ? "durable" : "temporary",
    storageReady: durableConfigured,
    warning,
  };
}

function adminSiteContentSettings(env?: unknown, saveStatus = liveStateSaveStatus) {
  const durableConfigured = env
    ? Boolean(getSupabasePersistenceConfig(env))
    : saveStatus.durableConfigured;
  const durableReady = saveStatus.durable || (durableConfigured && !saveStatus.saved_at);
  const warning = !durableConfigured
    ? "Persistência fixa não configurada. Configure SUPABASE_SERVICE_ROLE_KEY no Lovable para salvar definitivo."
    : saveStatus.saved_at && !saveStatus.durable
      ? "Não foi possível confirmar o salvamento durável. Verifique a tabela sniper_live_state no Supabase."
      : "";
  return {
    ...liveSiteContentSettings,
    persistence: durableReady ? "durable" : "temporary",
    storageReady: durableConfigured,
    warning,
  };
}

async function injectSiteContentHeadResponse(request: Request, response: Response) {
  if (request.method !== "GET") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const nextHtml = injectSiteContentHead(html, request.url);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(nextHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function injectSiteContentHead(html: string, requestUrl: string) {
  const settings = publicSiteContentSettings();
  const title = escapeHtmlText(settings.shareTitle);
  const description = escapeHtmlAttribute(settings.shareDescription);
  const imageUrl = absoluteSiteUrl(settings.shareImageUrl, requestUrl);
  const faviconUrl = absoluteSiteUrl(settings.faviconUrl, requestUrl);
  const tags = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${escapeHtmlAttribute(settings.shareTitle)}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    imageUrl ? `<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}">` : "",
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtmlAttribute(settings.shareTitle)}">`,
    `<meta name="twitter:description" content="${description}">`,
    imageUrl ? `<meta name="twitter:image" content="${escapeHtmlAttribute(imageUrl)}">` : "",
    faviconUrl ? `<link rel="icon" href="${escapeHtmlAttribute(faviconUrl)}">` : "",
    faviconUrl ? `<link rel="apple-touch-icon" href="${escapeHtmlAttribute(faviconUrl)}">` : "",
  ]
    .filter(Boolean)
    .join("");

  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  if (!/<title>[\s\S]*?<\/title>/i.test(next)) {
    next = next.replace(/<\/head>/i, `<title>${title}</title></head>`);
  }

  next = removeHeadTag(next, "meta", "name", "description");
  next = removeHeadTag(next, "meta", "property", "og:title");
  next = removeHeadTag(next, "meta", "property", "og:description");
  next = removeHeadTag(next, "meta", "property", "og:type");
  next = removeHeadTag(next, "meta", "property", "og:image");
  next = removeHeadTag(next, "meta", "name", "twitter:card");
  next = removeHeadTag(next, "meta", "name", "twitter:title");
  next = removeHeadTag(next, "meta", "name", "twitter:description");
  next = removeHeadTag(next, "meta", "name", "twitter:image");
  next = next.replace(/<link\b(?=[^>]*\brel=["'](?:icon|apple-touch-icon)["'])[^>]*>/gi, "");
  return next.replace(/<\/head>/i, `${tags}</head>`);
}

function removeHeadTag(html: string, tag: string, attribute: string, value: string) {
  const pattern = new RegExp(
    `<${tag}\\b(?=[^>]*\\b${attribute}=["']${escapeRegex(value)}["'])[^>]*>`,
    "gi",
  );
  return html.replace(pattern, "");
}

function absoluteSiteUrl(value: string, requestUrl: string) {
  const normalized = normalizeAssetUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized, requestUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJsonSafe(value: string) {
  if (!value) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-sniper-token,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
    },
  });
}

// ===== Password hashing (PBKDF2 via Web Crypto) =====
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEYLEN = 32;

function bytesToB64Url(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function b64UrlToBytes(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function constantTimeStringEqual(left: string, right: string) {
  return constantTimeEqual(new TextEncoder().encode(left), new TextEncoder().encode(right));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    PBKDF2_KEYLEN * 8,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToB64Url(salt)}$${bytesToB64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !stored.startsWith("pbkdf2$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]) || PBKDF2_ITERATIONS;
  const salt = b64UrlToBytes(parts[2]);
  const expected = b64UrlToBytes(parts[3]);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

// ===== Session tokens (HMAC-SHA256 signed) =====
type SessionPayload = {
  email: string;
  scope: "client" | "owner" | "admin_approver";
  plan: string;
  approved: boolean;
  sid?: string;
  ua?: string;
  iph?: string;
  exp: number; // unix seconds
};

function getSessionSecret(env: unknown): string {
  // Prefer dedicated secret; fall back to admin token only as keying material.
  return (
    readNamedServerSecret(env, "SNIPER_SESSION_SECRET", "") ||
    readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", "")
  );
}

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function issueSessionToken(
  env: unknown,
  payload: Omit<SessionPayload, "exp">,
  ttlSeconds = 60 * 60 * 24,
): Promise<string> {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(full)));
  const sig = bytesToB64Url(await hmacSign(secret, body));
  return `${body}.${sig}`;
}

export async function verifySessionToken(
  env: unknown,
  token: string,
): Promise<SessionPayload | null> {
  const secret = getSessionSecret(env);
  if (!secret || !token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = bytesToB64Url(await hmacSign(secret, body));
  // length-safe compare
  if (!constantTimeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) {
    return null;
  }
  try {
    const decoded = JSON.parse(new TextDecoder().decode(b64UrlToBytes(body))) as SessionPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
