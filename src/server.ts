import "./lib/error-capture";

import { mockDashboardData } from "./data/mockDashboardData";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { CurrentSignalSide, DashboardData, SignalStatus } from "./types/dashboard";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type LiveDashboardData = DashboardData & {
  updatedAt?: string;
  cycleDate?: string;
  dailyCycleDate?: string;
  strictDailyCounters?: boolean;
};
type WorkerCacheStorage = CacheStorage & { default?: Cache };

const LIVE_STATE_CACHE_URL = "https://sniperbo.com/__sniperbo_live_state_v1";
const LIVE_STATE_ID = "main";
const LIVE_STATE_TABLE = "sniper_live_state";
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const MAX_NARRATION_CHARS = 900;

let serverEntryPromise: Promise<ServerEntry> | undefined;
let liveDashboardData: LiveDashboardData = {
  ...mockDashboardData,
  mockMode: false,
  updatedAt: new Date().toISOString(),
  cycleDate: currentDashboardCycleDate(),
  dailyCycleDate: currentDashboardCycleDate(),
  strictDailyCounters: false,
};
let liveRecipients: Array<Record<string, unknown>> = [];
let liveClients: Array<Record<string, unknown>> = [];
let liveAccessEvents: Array<Record<string, unknown>> = [];
let liveModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};

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

      await loadLiveState(env);

      const voiceResponse = await handleVoiceNarrationRequest(request, env);
      if (voiceResponse) return withSecurityHeaders(voiceResponse);

      const voiceDiagnosticsResponse = await handleVoiceDiagnosticsRequest(request, env);
      if (voiceDiagnosticsResponse) return withSecurityHeaders(voiceDiagnosticsResponse);

      const adminApiResponse = await handleAdminApiRequest(request, env);
      if (adminApiResponse) return withSecurityHeaders(adminApiResponse);

      const dashboardResponse = await handleDashboardRequest(request, env);
      if (dashboardResponse) return withSecurityHeaders(dashboardResponse);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};

function redirectLegacyAdminRoute(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (url.pathname !== "/admin" && url.pathname !== "/admin/login") return null;

  url.pathname = "/app/admin";
  url.search = "";
  return Response.redirect(url.toString(), 302);
}

async function handleVoiceNarrationRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/narration") return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  if (!isDashboardAuthorized(request, url, env)) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const body = readRecord(await request.json().catch(() => ({})));
  const rawText = String(body.text || body.narration || "");
  const text = normalizeNarrationText(rawText);
  if (!text) {
    return json({ error: "Texto de voz obrigatorio." }, 400);
  }
  if (text.length > MAX_NARRATION_CHARS) {
    return json({ error: `Texto de voz muito longo. Limite: ${MAX_NARRATION_CHARS} caracteres.` }, 413);
  }

  const apiKey = getElevenLabsApiKey(env);
  if (!apiKey) {
    return json({ error: "ELEVENLABS_API_KEY nao configurada no backend." }, 503);
  }

  const voiceId = readServerEnvString(env, "ELEVENLABS_VOICE_ID", "");
  if (!voiceId) {
    return json({ error: "ELEVENLABS_VOICE_ID nao configurado no backend." }, 503);
  }

  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  const response = await fetch(
    `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
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
          use_speaker_boost: true,
        },
      }),
    },
  ).catch(() => null);

  if (!response) {
    recordElevenLabsStatus("network_error");
    return json({ error: "Falha de conexao ao gerar voz ElevenLabs." }, 502);
  }

  if (!response.ok) {
    recordElevenLabsStatus(response.status);
    console.warn(`Falha ao gerar voz ElevenLabs (${response.status}).`);
    return json(elevenLabsErrorPayload(response.status), elevenLabsErrorStatus(response.status));
  }

  recordElevenLabsStatus("ok");
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "Content-Type,Authorization,x-sniper-token",
    },
  });
}

async function handleVoiceDiagnosticsRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/diagnostics") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);

  if (!isDashboardAuthorized(request, url, env)) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const apiKey = getElevenLabsApiKey(env);
  const hasElevenLabsKey = Boolean(apiKey);
  const hasVoiceId = Boolean(readServerEnvString(env, "ELEVENLABS_VOICE_ID", ""));
  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  if (url.searchParams.get("check") === "elevenlabs") {
    let elevenLabsAuthOk = false;
    let elevenLabsAuthStatus: string | number = "no_api_key";
    if (apiKey) {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          method: "GET",
          headers: { "xi-api-key": apiKey, Accept: "application/json" },
        });
        elevenLabsAuthOk = res.ok;
        elevenLabsAuthStatus = res.status;
      } catch {
        elevenLabsAuthStatus = "network_error";
      }
    }
    return json({
      elevenLabsAuthOk,
      elevenLabsAuthStatus,
      hasElevenLabsKey,
      hasVoiceId,
      modelId,
    });
  }

  return json({
    hasElevenLabsKey,
    hasVoiceId,
    modelId,
    provider: "elevenlabs",
    lastElevenLabsStatus,
  });
}

async function handleAdminApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const isAdminApiPath =
    url.pathname === "/admin/login" ||
    url.pathname === "/auth/check" ||
    url.pathname === "/auth/diagnostics" ||
    url.pathname === "/auth/register" ||
    url.pathname === "/admin/summary" ||
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
      return json({ error: "Nao autorizado." }, 401);
    }
    return json({
      hasAdminEmail: Boolean(getAdminEmail(env)),
      hasAdminPassword: Boolean(getAdminPassword(env)),
      hasAdminToken: Boolean(getAdminToken(env)),
      hasSessionSecret: Boolean(getSessionSecret(env)),
      hasDurableClientStorage: Boolean(getSupabasePersistenceConfig(env)),
      durableClientStorageTable: LIVE_STATE_TABLE,
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/login") {
    const body = await request.json().catch(() => ({}));
    const adminEmail = getAdminEmail(env);
    const adminPassword = getAdminPassword(env);
    const adminToken = getAdminToken(env);

    if (!adminEmail || !adminPassword || !adminToken || !getSessionSecret(env)) {
      return json({ error: "Credenciais admin nao configuradas no servidor." }, 503);
    }

    if (
      readString(body, "email").toLowerCase() === adminEmail &&
      readString(body, "password") === adminPassword
    ) {
      recordAccessEvent("admin_login", {
        email: adminEmail,
        full_name: "Gabriel Mendes",
        city: "",
        country: "",
      });
      await saveLiveState(env);
      // Admin token is returned only inside a successful admin-login response.
      return json({ token: adminToken, email: adminEmail });
    }

    return json({ error: "Email ou senha admin invalidos." }, 401);
  }

  if (request.method === "POST" && url.pathname === "/auth/check") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    const adminEmail = getAdminEmail(env);
    const adminPassword = getAdminPassword(env);

    if (!getSessionSecret(env)) {
      return json({ error: "Sessao nao configurada no servidor." }, 503);
    }

    if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
      recordAccessEvent("owner_login", {
        email,
        full_name: "Gabriel Mendes",
        city: "",
        country: "",
      });
      await saveLiveState(env);
      return json({ access: await ownerAccess(env, email) });
    }

    const client = liveClients.find((item) => readString(item, "email").toLowerCase() === email);
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
          reason: "Email ainda nao cadastrado.",
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
    }
    if (!ok) {
      return json({ error: "Senha invalida." }, 401);
    }

    recordAccessEvent(Boolean(client.enabled) ? "client_login" : "client_pending_login", client);
    await saveLiveState(env);
    return json({ access: await clientAccess(env, client) });
  }

  if (request.method === "POST" && url.pathname === "/auth/register") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    if (!email || !password) {
      return json({ error: "Email e senha sao obrigatorios." }, 400);
    }
    if (!getSessionSecret(env)) {
      return json({ error: "Sessao nao configurada no servidor." }, 503);
    }

    const existingIndex = liveClients.findIndex(
      (item) => readString(item, "email").toLowerCase() === email,
    );
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);
    const client: Record<string, unknown> = {
      id: existingIndex >= 0 ? liveClients[existingIndex].id : crypto.randomUUID(),
      full_name: readString(body, "full_name") || email,
      email,
      password_hash: passwordHash,
      phone: readString(body, "phone"),
      city: readString(body, "city"),
      country: readString(body, "country"),
      plan: existingIndex >= 0 ? liveClients[existingIndex].plan || "free" : "free",
      access_status:
        existingIndex >= 0 ? liveClients[existingIndex].access_status || "pending" : "pending",
      enabled: existingIndex >= 0 ? Boolean(liveClients[existingIndex].enabled) : false,
      starts_at:
        existingIndex >= 0 ? liveClients[existingIndex].starts_at || todayIso() : todayIso(),
      validity_days: existingIndex >= 0 ? liveClients[existingIndex].validity_days || 30 : 30,
      expires_at: existingIndex >= 0 ? liveClients[existingIndex].expires_at || "" : "",
      created_at: existingIndex >= 0 ? liveClients[existingIndex].created_at || now : now,
      updated_at: now,
    };

    liveClients =
      existingIndex >= 0
        ? liveClients.map((item, index) => (index === existingIndex ? client : item))
        : [...liveClients, client];

    upsertRecipientFromClient(client);
    recordAccessEvent(existingIndex >= 0 ? "client_update" : "client_register", client);
    await saveLiveState(env);
    return json(
      { access: await clientAccess(env, client) },
      existingIndex >= 0 ? 200 : 201,
    );
  }

  if (request.method === "POST" && url.pathname === "/auth/verify") {
    const body = readRecord(await request.json().catch(() => ({})));
    const token = readString(body, "token");
    const session = await verifySessionToken(env, token);
    if (!session) {
      return json({ valid: false }, 401);
    }
    return json({
      valid: true,
      email: session.email,
      scope: session.scope,
      plan: session.plan,
      approved: session.approved,
      exp: session.exp,
    });
  }

  if (!isAdminAuthorized(request, env)) {
    return json({ error: "Nao autorizado." }, 401);
  }

  if (request.method === "GET" && url.pathname === "/admin/summary") {
    return json({ summary: buildAdminSummary() });
  }

  if (url.pathname === "/telegram-recipients") {
    if (request.method === "GET") {
      const changed = syncRecipientsFromClients();
      if (changed) await saveLiveState(env);
      return json({ recipients: liveRecipients });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const now = new Date().toISOString();
      const recipient = normalizeRecipient({
        ...body,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
      liveRecipients = [...liveRecipients, recipient];
      upsertClientFromRecipient(recipient);
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
        return json({ error: "Destinatario nao encontrado." }, 404);
      }
      upsertRecipientFromClient(liveClients[clientIndex]);
      await saveLiveState(env);
      return handleAdminApiRequest(request, env);
    }

    if (request.method === "PATCH") {
      const body = readRecord(await request.json().catch(() => ({})));
      const updated = normalizeRecipient({
        ...liveRecipients[index],
        ...body,
        id: liveRecipients[index].id,
        created_at: liveRecipients[index].created_at,
        updated_at: new Date().toISOString(),
      });
      liveRecipients = liveRecipients.map((recipient, recipientIndex) =>
        recipientIndex === index ? updated : recipient,
      );
      upsertClientFromRecipient(updated);
      await saveLiveState(env);
      return json({ recipient: updated });
    }

    if (request.method === "DELETE") {
      const deletedRecipient = liveRecipients[index];
      const deletedEmail = readString(deletedRecipient, "email").toLowerCase();
      liveRecipients = liveRecipients.filter((recipient) => recipient.id !== recipientId);
      liveClients = liveClients.filter((client) => {
        const clientId = readString(client, "id");
        const clientEmail = readString(client, "email").toLowerCase();
        return clientId !== recipientId && (!deletedEmail || clientEmail !== deletedEmail);
      });
      await saveLiveState(env);
      return json({ ok: true });
    }
  }

  if (url.pathname === "/module-toggles") {
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
    return json({
      events: liveAccessEvents,
      summary: {
        total: liveAccessEvents.length,
        low: liveAccessEvents.length,
        medium: 0,
        high: 0,
        critical: 0,
      },
    });
  }

  return json({ error: "Rota nao encontrada." }, 404);
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
      return json({ error: "Nao autorizado." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    liveDashboardData = updateDashboardData(liveDashboardData, body);
    await saveLiveState(env);
    return json({ ok: true, dashboard: liveDashboardData });
  }

  return null;
}

function updateDashboardData(current: LiveDashboardData, body: unknown) {
  const cycle = ensureDashboardDailyCycle(current);
  const currentDashboard = cycle.dashboard;
  const incoming = readRecord(readRecord(body).dashboard || body);
  const cycleDate = currentDashboardCycleDate();
  const incomingCycleDate = readDashboardCycleDate(incoming);
  const acceptsCurrentCycle = !incomingCycleDate || incomingCycleDate === cycleDate;
  const acceptsDailyCounters =
    acceptsCurrentCycle && (!currentDashboard.strictDailyCounters || incomingCycleDate === cycleDate);
  const pickedSections = acceptsCurrentCycle ? pickDashboardSections(incoming) : {};
  if (!acceptsDailyCounters) {
    delete pickedSections.mainScoreboard;
    delete pickedSections.tieAlertScoreboard;
    delete pickedSections.surfAnalyzerScoreboard;
    if (pickedSections.neuralReading) {
      pickedSections.neuralReading = resetNeuralReadingDailyCounters(pickedSections.neuralReading);
    }
  }
  const rounds =
    acceptsCurrentCycle && Array.isArray(incoming.rounds)
      ? normalizeRounds(incoming.rounds)
      : currentDashboard.rounds;

  return {
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
    pressureSeries: acceptsCurrentCycle && Array.isArray(incoming.pressureSeries)
      ? incoming.pressureSeries
      : currentDashboard.pressureSeries,
    updatedAt: new Date().toISOString(),
    cycleDate,
    dailyCycleDate: cycleDate,
    strictDailyCounters: currentDashboard.strictDailyCounters && incomingCycleDate !== cycleDate,
  };
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
        strictDailyCounters: (dashboard as unknown as { strictDailyCounters?: boolean }).strictDailyCounters ?? false,
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
  };
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_CYCLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function pickDashboardSections(incoming: Record<string, unknown>): Partial<DashboardData> {
  const out: Partial<DashboardData> = {};
  if (incoming.currentSurfAlert) out.currentSurfAlert = incoming.currentSurfAlert as DashboardData["currentSurfAlert"];
  if (incoming.surfAlert) out.currentSurfAlert = incoming.surfAlert as DashboardData["currentSurfAlert"];
  if (incoming.neuralReading) out.neuralReading = incoming.neuralReading as DashboardData["neuralReading"];
  if (incoming.moduleToggles) out.moduleToggles = incoming.moduleToggles as DashboardData["moduleToggles"];
  if (incoming.engineDecision) out.engineDecision = incoming.engineDecision as DashboardData["engineDecision"];
  if (incoming.mainScoreboard) out.mainScoreboard = incoming.mainScoreboard as DashboardData["mainScoreboard"];
  if (incoming.tieAlertScoreboard) out.tieAlertScoreboard = incoming.tieAlertScoreboard as DashboardData["tieAlertScoreboard"];
  if (incoming.surfAnalyzerScoreboard) out.surfAnalyzerScoreboard = incoming.surfAnalyzerScoreboard as DashboardData["surfAnalyzerScoreboard"];
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
  const incomingLastResult = (signal.lastResult ?? null) as DashboardData["currentSignal"]["lastResult"];
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
      strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
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

function normalizeSignalStatus(value: unknown, side: DashboardData["currentSignal"]["side"]): SignalStatus {
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

function isDashboardAuthorized(request: Request, url: URL, env: unknown) {
  const token =
    readNamedServerSecret(env, "SNIPER_DASHBOARD_TOKEN", "") ||
    readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", "sniper-local-admin-token");
  const headerToken =
    request.headers.get("x-sniper-token") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(token) && (headerToken === token || url.searchParams.get("token") === token);
}

function isAdminAuthorized(request: Request, env: unknown) {
  const headerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(headerToken) && headerToken === getAdminToken(env);
}

function getAdminToken(env: unknown) {
  return readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", "sniper-local-admin-token");
}

function getAdminEmail(env: unknown) {
  return readNamedServerSecret(env, "SNIPER_ADMIN_EMAIL", "").toLowerCase();
}

function getAdminPassword(env: unknown) {
  return readNamedServerSecret(env, "SNIPER_ADMIN_PASSWORD", "");
}

function getElevenLabsApiKey(env: unknown) {
  // Only read the canonical secret name to avoid conflicts with legacy values.
  return normalizeSecretValue(readServerEnvString(env, "ELEVENLABS_TTS_API_KEY", ""));
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
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "").trim();
  const prefix = new RegExp(`^${escapeRegExp(key)}\\s*[:=]\\s*`, "i");
  while (prefix.test(raw)) {
    raw = raw.replace(prefix, "").trim().replace(/^["']|["']$/g, "").trim();
  }
  return raw;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSecretValue(value: unknown) {
  let raw = String(value || "").trim().replace(/^["']|["']$/g, "").trim();
  // Strip common accidental prefixes (env var name pasted in, or auth scheme).
  const prefixes = [
    /^ELEVENLABS_TTS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_SECRET_KEY\s*[:=]\s*/i,
    /^Bearer\s+/i,
    /^Token\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of prefixes) {
      if (re.test(raw)) {
        raw = raw.replace(re, "").trim().replace(/^["']|["']$/g, "").trim();
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
    return { error: "API key ElevenLabs invalida ou sem permissao." };
  }
  if (status === 404 || status === 422) {
    return { error: "ELEVENLABS_VOICE_ID invalido ou indisponivel." };
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

  return {
    id: readString(recipient, "id") || crypto.randomUUID(),
    name: readString(recipient, "name") || readString(recipient, "full_name") || "Cliente",
    full_name: readString(recipient, "full_name") || readString(recipient, "name"),
    email: readString(recipient, "email"),
    phone: readString(recipient, "phone"),
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
    chat_id: readString(recipient, "chat_id"),
    kind: ["group", "channel", "user"].includes(readString(recipient, "kind"))
      ? readString(recipient, "kind")
      : "user",
    enabled,
    plan: ["free", "premium", "vip"].includes(readString(recipient, "plan"))
      ? readString(recipient, "plan")
      : "vip",
    access_status: ["approved", "paused", "pending"].includes(
      readString(recipient, "access_status"),
    )
      ? readString(recipient, "access_status")
      : enabled
        ? "approved"
        : "pending",
    starts_at: startsAt,
    validity_days: Number.isFinite(validityDays) ? validityDays : 30,
    expires_at: readString(recipient, "expires_at") || addDaysIso(startsAt, validityDays || 30),
    notes: readString(recipient, "notes"),
    created_at: readString(recipient, "created_at") || new Date().toISOString(),
    updated_at: readString(recipient, "updated_at") || new Date().toISOString(),
  };
}

async function ownerAccess(env: unknown, email: string) {
  const token = await issueSessionToken(env, {
    email,
    scope: "owner",
    plan: "vip",
    approved: true,
  });
  return {
    registered: true,
    approved: true,
    access_mode: "full",
    access_status: "owner",
    plan: "vip",
    email,
    full_name: "Gabriel Mendes",
    expires_at: "",
    reason: "Acesso do administrador.",
    client_token: token,
  };
}

async function clientAccess(env: unknown, client: Record<string, unknown>) {
  const enabled = Boolean(client.enabled) || readString(client, "access_status") === "approved";
  const expired = enabled && isExpiredIso(readString(client, "expires_at"));
  const approved = enabled && !expired;
  const accessStatus = readString(client, "access_status") || (enabled ? "approved" : "pending");
  const plan = ["premium", "vip"].includes(readString(client, "plan"))
    ? readString(client, "plan")
    : "free";
  const email = readString(client, "email");

  const token = approved
    ? await issueSessionToken(env, { email, scope: "client", plan, approved: true })
    : "";

  return {
    registered: true,
    approved,
    access_mode: expired ? "expired" : enabled ? "full" : "pending",
    access_status: expired ? "expired" : accessStatus,
    plan,
    email,
    full_name:
      readString(client, "full_name") || readString(client, "name") || readString(client, "email"),
    expires_at: readString(client, "expires_at"),
    reason: expired
      ? "Acesso expirado. Fale com o administrador para renovar."
      : enabled
      ? "Acesso liberado pelo administrador."
      : "Aguardando liberacao do administrador.",
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
  };
  liveAccessEvents = [event, ...liveAccessEvents].slice(0, 200);
}

function buildAdminSummary() {
  const people = uniquePeople([...liveClients, ...liveRecipients]);
  const approved = people.filter(
    (person) => Boolean(person.enabled) || readString(person, "access_status") === "approved",
  );
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
    const label = readString(record, field) || "Nao informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function upsertRecipientFromClient(client: Record<string, unknown>) {
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
    city: readString(client, "city"),
    country: readString(client, "country"),
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
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
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
  const expiration = new Date(`${value}T23:59:59`);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration.getTime() < Date.now();
}

function readString(record: Record<string, unknown>, key: string) {
  return String(record[key] || "").trim();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(startIso: string, days: number) {
  const date = new Date(`${startIso}T00:00:00`);
  date.setDate(date.getDate() + Math.max(0, Math.floor(Number(days) || 0)));
  return date.toISOString().slice(0, 10);
}

function getLiveStateCache() {
  return (globalThis as { caches?: WorkerCacheStorage }).caches?.default || null;
}

function liveStateCacheRequest() {
  return new Request(LIVE_STATE_CACHE_URL, { method: "GET" });
}

async function loadLiveState(env: unknown) {
  const [durableState, cacheState] = await Promise.all([
    loadDurableLiveState(env),
    loadLiveStateCache(),
  ]);
  const state = mergeLiveStates(durableState, cacheState);
  if (state) {
    applyLiveState(state);
    await Promise.allSettled([saveLiveStateCache(state), saveDurableLiveState(env, state)]);
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
    console.warn("Nao foi possivel carregar estado vivo do cache.", error);
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
    liveClients = state.clients
      .map(readRecord)
      .filter((client) => Object.keys(client).length > 0);
  }

  if (Array.isArray(state.accessEvents)) {
    liveAccessEvents = state.accessEvents
      .map(readRecord)
      .filter((event) => Object.keys(event).length > 0)
      .slice(0, 200);
  }

  const moduleToggles = readRecord(state.moduleToggles);
  if (Object.keys(moduleToggles).length > 0) {
    liveModuleToggles = restoreModuleToggles(moduleToggles);
    liveDashboardData = { ...liveDashboardData, moduleToggles: liveModuleToggles };
  }
}

function mergeLiveStates(
  durableState: Record<string, unknown> | null,
  cacheState: Record<string, unknown> | null,
) {
  if (!durableState && !cacheState) return null;
  const durable = durableState || {};
  const cache = cacheState || {};
  return {
    ...cache,
    ...durable,
    dashboard: pickDashboardState(durable.dashboard, cache.dashboard),
    recipients: pickStateArray(durable.recipients, cache.recipients),
    clients: pickStateArray(durable.clients, cache.clients),
    accessEvents: mergeStateArrays(durable.accessEvents, cache.accessEvents).slice(0, 200),
    moduleToggles: pickStateObject(durable.moduleToggles, cache.moduleToggles),
    savedAt: readString(durable, "savedAt") || readString(cache, "savedAt") || new Date().toISOString(),
  };
}

function pickStateObject(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  if (Object.keys(first).length > 0) return first;
  return readRecord(secondary);
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

function mergeStateArrays(primary: unknown, secondary: unknown) {
  const rows = [...pickStateArray(primary, []), ...pickStateArray(secondary, [])];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = readString(row, "id") || readString(row, "email").toLowerCase() || JSON.stringify(row);
    byKey.set(key, { ...(byKey.get(key) || {}), ...row });
  }
  return [...byKey.values()];
}

function hasRecordFields(record: Record<string, unknown>) {
  return Object.keys(record).length > 0;
}

function buildLiveStateSnapshot() {
  return {
    dashboard: liveDashboardData,
    recipients: liveRecipients,
    clients: liveClients,
    accessEvents: liveAccessEvents,
    moduleToggles: liveModuleToggles,
    savedAt: new Date().toISOString(),
  };
}

async function saveLiveState(env: unknown) {
  const state = buildLiveStateSnapshot();
  await Promise.allSettled([saveDurableLiveState(env, state), saveLiveStateCache(state)]);
}

async function saveLiveStateCache(state: Record<string, unknown>) {
  const cache = getLiveStateCache();
  if (!cache) return;

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
  } catch (error) {
    console.warn("Nao foi possivel salvar estado vivo no cache.", error);
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
      console.warn(`Estado duravel indisponivel (${response.status}).`);
      return null;
    }

    const rows = await response.json().catch(() => null);
    const row = Array.isArray(rows) ? readRecord(rows[0]) : readRecord(rows);
    const state = readRecord(row.state);
    return Object.keys(state).length > 0 ? state : null;
  } catch (error) {
    console.warn("Nao foi possivel carregar estado duravel.", error);
    return null;
  }
}

async function saveDurableLiveState(env: unknown, state: Record<string, unknown>) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return;

  try {
    const response = await fetch(`${config.url}/rest/v1/${LIVE_STATE_TABLE}`, {
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
      console.warn(`Nao foi possivel salvar estado duravel (${response.status}).`);
    }
  } catch (error) {
    console.warn("Nao foi possivel salvar estado duravel.", error);
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
  if (compareDashboardStateFreshness(liveDashboardData as unknown as Record<string, unknown>, value) > 0) {
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

function restoreModuleToggles(value: Record<string, unknown>) {
  return {
    tieAlert: typeof value.tieAlert === "boolean" ? value.tieAlert : liveModuleToggles.tieAlert,
    surfAnalyzer:
      typeof value.surfAnalyzer === "boolean" ? value.surfAnalyzer : liveModuleToggles.surfAnalyzer,
  };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
      "access-control-allow-headers": "Content-Type,Authorization,x-sniper-token",
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
  scope: "client" | "owner";
  plan: string;
  approved: boolean;
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

export async function issueSessionToken(env: unknown, payload: Omit<SessionPayload, "exp">, ttlSeconds = 60 * 60 * 24): Promise<string> {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(full)));
  const sig = bytesToB64Url(await hmacSign(secret, body));
  return `${body}.${sig}`;
}

export async function verifySessionToken(env: unknown, token: string): Promise<SessionPayload | null> {
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
