import "./lib/error-capture";

import { mockDashboardData } from "./data/mockDashboardData";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import type { DashboardData } from "./types/dashboard";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let liveDashboardData: DashboardData & { updatedAt?: string } = {
  ...mockDashboardData,
  mockMode: false,
  updatedAt: new Date().toISOString(),
};
let liveRecipients: Array<Record<string, unknown>> = [];
let liveModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return withSecurityHeaders(new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  }));
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

async function handleAdminApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const isAdminApiPath =
    url.pathname === "/admin/login" ||
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
    const adminEmail = String(envRecord.SNIPER_ADMIN_EMAIL || "gabrielmendespromove@gmail.com");
    const adminPassword = String(envRecord.SNIPER_ADMIN_PASSWORD || "admin123");
    const adminToken = getAdminToken(env);

    if (readString(body, "email") === adminEmail && readString(body, "password") === adminPassword) {
      return json({ token: adminToken, email: adminEmail });
    }

    return json({ error: "Email ou senha admin invalidos." }, 401);
  }

  if (!isAdminAuthorized(request, env)) {
    return json({ error: "Nao autorizado." }, 401);
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
      liveRecipients = liveRecipients.map((recipient, recipientIndex) => (recipientIndex === index ? updated : recipient));
      return json({ recipient: updated });
    }

    if (request.method === "DELETE") {
      liveRecipients = liveRecipients.filter((recipient) => recipient.id !== recipientId);
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
        surfAnalyzer: typeof body.surfAnalyzer === "boolean" ? body.surfAnalyzer : liveModuleToggles.surfAnalyzer,
      };
      liveDashboardData = {
        ...liveDashboardData,
        moduleToggles: liveModuleToggles,
        updatedAt: new Date().toISOString(),
      };
      return json({ moduleToggles: liveModuleToggles });
    }
  }

  if (request.method === "GET" && url.pathname === "/security-events") {
    return json({
      events: [],
      summary: {
        total: 0,
        low: 0,
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

  if (request.method === "OPTIONS" && (url.pathname === "/dashboard" || url.pathname === "/dashboard/signal")) {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/dashboard") {
    return json(liveDashboardData);
  }

  if (request.method === "POST" && (url.pathname === "/dashboard" || url.pathname === "/dashboard/signal")) {
    if (!isDashboardAuthorized(request, url, env)) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    liveDashboardData = updateDashboardData(liveDashboardData, body);
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
    currentTieAlert: normalizeTieAlert(incoming.currentTieAlert || incoming.tieAlert, current.currentTieAlert),
    pressureSeries: Array.isArray(incoming.pressureSeries) ? incoming.pressureSeries : current.pressureSeries,
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
    ...(incoming.surfAnalyzerScoreboard ? { surfAnalyzerScoreboard: incoming.surfAnalyzerScoreboard } : {}),
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

function normalizeSignal(signal: Record<string, unknown>, fallback: DashboardData["currentSignal"]) {
  const side = normalizeSignalSide(signal.side || signal.direcao || signal.entry || signal.entrada);
  return {
    id: String(signal.id || signal.signalId || `signal-${Date.now()}`),
    side,
    status: normalizeSignalStatus(signal.status || signal.resultado || signal.state, side),
    protection: String(signal.protection || signal.validade || signal.gale || fallback.protection || "G1"),
    strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
    lastResult: signal.lastResult || fallback.lastResult || null,
  };
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
  const text = String(value || "").trim().toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return "NONE";
}

function normalizeSignalStatus(value: unknown, side: DashboardData["currentSignal"]["side"]) {
  const text = String(value || "").trim().toLowerCase();
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
  const text = String(value || "").trim().toUpperCase();
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
  const token = String(envRecord.SNIPER_DASHBOARD_TOKEN || envRecord.SNIPER_ADMIN_TOKEN || "sniper-local-admin-token");
  const headerToken =
    request.headers.get("x-sniper-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
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
    kind: ["group", "channel", "user"].includes(readString(recipient, "kind")) ? readString(recipient, "kind") : "user",
    enabled,
    plan: ["free", "premium", "vip"].includes(readString(recipient, "plan")) ? readString(recipient, "plan") : "vip",
    access_status: ["approved", "paused", "pending"].includes(readString(recipient, "access_status"))
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

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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
