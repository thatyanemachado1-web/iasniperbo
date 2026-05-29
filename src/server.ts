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
