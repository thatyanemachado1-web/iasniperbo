import "./lib/error-capture";

import { mockDashboardData } from "./data/mockDashboardData";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { DashboardData } from "./types/dashboard";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type LiveDashboardData = DashboardData & { updatedAt?: string };
type WorkerCacheStorage = CacheStorage & { default?: Cache };

const LIVE_STATE_CACHE_URL = "https://sniperbo.com/__sniperbo_live_state_v1";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const MAX_NARRATION_CHARS = 900;

let serverEntryPromise: Promise<ServerEntry> | undefined;
let liveDashboardData: LiveDashboardData = {
  ...mockDashboardData,
  mockMode: false,
  updatedAt: new Date().toISOString(),
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

      await loadLiveState();

      const voiceResponse = await handleVoiceNarrationRequest(request, env);
      if (voiceResponse) return withSecurityHeaders(voiceResponse);

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
    return json({ error: "Falha de conexao ao gerar voz ElevenLabs." }, 502);
  }

  if (!response.ok) {
    console.warn(`Falha ao gerar voz ElevenLabs (${response.status}).`);
    return json(elevenLabsErrorPayload(response.status), elevenLabsErrorStatus(response.status));
  }

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

async function handleAdminApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const isAdminApiPath =
    url.pathname === "/admin/login" ||
    url.pathname === "/auth/check" ||
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

  if (request.method === "POST" && url.pathname === "/admin/login") {
    const body = await request.json().catch(() => ({}));
    const envRecord = readRecord(env);
    const adminEmail = String(envRecord.SNIPER_ADMIN_EMAIL || "").toLowerCase();
    const adminPassword = String(envRecord.SNIPER_ADMIN_PASSWORD || "");
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
      await saveLiveState();
      // Admin token is returned only inside a successful admin-login response.
      return json({ token: adminToken, email: adminEmail });
    }

    return json({ error: "Email ou senha admin invalidos." }, 401);
  }

  if (request.method === "POST" && url.pathname === "/auth/check") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    const envRecord = readRecord(env);
    const adminEmail = String(envRecord.SNIPER_ADMIN_EMAIL || "").toLowerCase();
    const adminPassword = String(envRecord.SNIPER_ADMIN_PASSWORD || "");

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
      await saveLiveState();
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
        await saveLiveState();
      }
    }
    if (!ok) {
      return json({ error: "Senha invalida." }, 401);
    }

    recordAccessEvent(Boolean(client.enabled) ? "client_login" : "client_pending_login", client);
    await saveLiveState();
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
    await saveLiveState();
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
      await saveLiveState();
      return json({ recipient }, 201);
    }
  }

  const recipientMatch = url.pathname.match(/^\/telegram-recipients\/([^/]+)$/);
  if (recipientMatch) {
    const recipientId = decodeURIComponent(recipientMatch[1]);
    const index = liveRecipients.findIndex((recipient) => recipient.id === recipientId);

    if (index === -1) {
      return json({ error: "Destinatario nao encontrado." }, 404);
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
      await saveLiveState();
      return json({ recipient: updated });
    }

    if (request.method === "DELETE") {
      liveRecipients = liveRecipients.filter((recipient) => recipient.id !== recipientId);
      await saveLiveState();
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
      await saveLiveState();
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
    await saveLiveState();
    return json({ ok: true, dashboard: liveDashboardData });
  }

  return null;
}

function updateDashboardData(current: DashboardData & { updatedAt?: string }, body: unknown) {
  const incoming = readRecord(readRecord(body).dashboard || body);
  const rounds = Array.isArray(incoming.rounds) ? normalizeRounds(incoming.rounds) : current.rounds;

  return {
    ...current,
    ...pickDashboardSections(incoming),
    mockMode: false,
    user: { ...current.user, ...readRecord(incoming.user) },
    rounds,
    currentSignal: normalizeSignal(readMainSignal(incoming), current.currentSignal),
    currentTieAlert: normalizeTieAlert(
      incoming.currentTieAlert || incoming.tieAlert,
      current.currentTieAlert,
    ),
    pressureSeries: Array.isArray(incoming.pressureSeries)
      ? incoming.pressureSeries
      : current.pressureSeries,
    updatedAt: new Date().toISOString(),
  };
}

function pickDashboardSections(incoming: Record<string, unknown>) {
  return {
    ...(incoming.currentSurfAlert ? { currentSurfAlert: incoming.currentSurfAlert } : {}),
    ...(incoming.surfAlert ? { currentSurfAlert: incoming.surfAlert } : {}),
    ...(incoming.neuralReading ? { neuralReading: incoming.neuralReading } : {}),
    ...(incoming.moduleToggles ? { moduleToggles: incoming.moduleToggles } : {}),
    ...(incoming.engineDecision ? { engineDecision: incoming.engineDecision } : {}),
    ...(incoming.mainScoreboard ? { mainScoreboard: incoming.mainScoreboard } : {}),
    ...(incoming.tieAlertScoreboard ? { tieAlertScoreboard: incoming.tieAlertScoreboard } : {}),
    ...(incoming.surfAnalyzerScoreboard
      ? { surfAnalyzerScoreboard: incoming.surfAnalyzerScoreboard }
      : {}),
  };
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
) {
  const side = normalizeSignalSide(signal.side || signal.direcao || signal.entry || signal.entrada);
  const status = normalizeSignalStatus(signal.status || signal.resultado || signal.state, side);
  const protection = String(
    signal.protection || signal.validade || signal.gale || fallback.protection || "G1",
  );
  const terminalStatus = terminalSignalStatus(status);
  const lastResult =
    signal.lastResult ||
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
      side: "NONE" as const,
      status: "waiting" as const,
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

function normalizeSignalSide(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return "NONE";
}

function normalizeSignalStatus(value: unknown, side: DashboardData["currentSignal"]["side"]) {
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

function normalizeTieLevel(value: unknown) {
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
  const envRecord = readRecord(env);
  const token = String(
    envRecord.SNIPER_DASHBOARD_TOKEN || envRecord.SNIPER_ADMIN_TOKEN || "sniper-local-admin-token",
  );
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
  const envRecord = readRecord(env);
  return String(envRecord.SNIPER_ADMIN_TOKEN || "sniper-local-admin-token");
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

function normalizeSecretValue(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/^ELEVENLABS_API_KEY\s*=\s*/i, "")
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
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

function ownerAccess(email: string, token: string) {
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

function clientAccess(client: Record<string, unknown>, token: string) {
  const enabled = Boolean(client.enabled) || readString(client, "access_status") === "approved";
  const accessStatus = readString(client, "access_status") || (enabled ? "approved" : "pending");
  const plan = ["premium", "vip"].includes(readString(client, "plan"))
    ? readString(client, "plan")
    : "free";

  return {
    registered: true,
    approved: enabled,
    access_mode: enabled ? "full" : "pending",
    access_status: accessStatus,
    plan,
    email: readString(client, "email"),
    full_name:
      readString(client, "full_name") || readString(client, "name") || readString(client, "email"),
    expires_at: readString(client, "expires_at"),
    reason: enabled
      ? "Acesso liberado pelo administrador."
      : "Aguardando liberacao do administrador.",
    client_token: enabled ? token : "",
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
  if (!email) return;
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

async function loadLiveState() {
  const cache = getLiveStateCache();
  if (!cache) return;

  try {
    const response = await cache.match(liveStateCacheRequest());
    if (!response) return;

    const state = readRecord(await response.json().catch(() => null));
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
  } catch (error) {
    console.warn("Nao foi possivel carregar estado vivo do cache.", error);
  }
}

async function saveLiveState() {
  const cache = getLiveStateCache();
  if (!cache) return;

  const state = {
    dashboard: liveDashboardData,
    recipients: liveRecipients,
    clients: liveClients,
    accessEvents: liveAccessEvents,
    moduleToggles: liveModuleToggles,
    savedAt: new Date().toISOString(),
  };

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

function restoreDashboardData(value: Record<string, unknown>): LiveDashboardData {
  const restored = updateDashboardData(liveDashboardData, value);
  return {
    ...restored,
    updatedAt: readString(value, "updatedAt") || restored.updatedAt,
  };
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
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
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
  const envRecord = readRecord(env);
  // Prefer dedicated secret; fall back to admin token only as keying material.
  const secret = String(envRecord.SNIPER_SESSION_SECRET || envRecord.SNIPER_ADMIN_TOKEN || "");
  return secret;
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
