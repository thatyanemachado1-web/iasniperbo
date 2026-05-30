import type { AdminSession, AdminSummary, SecurityEvent, SecuritySummary, SignalRecipient } from "@/types/admin";
import type { ModuleToggles } from "@/types/dashboard";

const API_URL_KEY = "sniper_admin_api_url";
const SESSION_KEY = "sniper_admin_session";
export const LOCAL_ADMIN_API_URL = "http://127.0.0.1:8787";
export const PUBLIC_ADMIN_API_URL = "https://isaac-therapist-indicators-michigan.trycloudflare.com";
const ALLOWED_REMOTE_API_HOSTS = new Set([
  "isaac-therapist-indicators-michigan.trycloudflare.com",
  "api.sniperbo.com",
  "sniperbo.com",
  "www.sniperbo.com",
]);

const defaultApiUrl = () =>
  (import.meta.env.VITE_SNIPER_API_URL as string | undefined) ||
  (import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined)?.replace(/\/dashboard\/?$/, "") ||
  (typeof window !== "undefined" && !isLocalFrontend() ? PUBLIC_ADMIN_API_URL : LOCAL_ADMIN_API_URL);

export function getInitialApiUrl() {
  if (typeof window === "undefined") return defaultApiUrl();
  const saved = normalizeMaybeUrl(window.localStorage.getItem(API_URL_KEY) || "");
  if (isLocalFrontend() && (!saved || !isLocalApiUrl(saved))) {
    window.localStorage.setItem(API_URL_KEY, LOCAL_ADMIN_API_URL);
    return LOCAL_ADMIN_API_URL;
  }
  if (!isLocalFrontend() && (!saved || isLocalApiUrl(saved) || !isAllowedRemoteApiUrl(saved))) {
    window.localStorage.setItem(API_URL_KEY, PUBLIC_ADMIN_API_URL);
    return PUBLIC_ADMIN_API_URL;
  }
  return saved || defaultApiUrl();
}

export function readAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AdminSession;
    return session?.token && session?.apiUrl ? session : null;
  } catch {
    return null;
  }
}

export function saveAdminSession(session: AdminSession) {
  window.localStorage.setItem(API_URL_KEY, session.apiUrl);
  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function useLocalAdminApiUrl() {
  if (typeof window === "undefined") return LOCAL_ADMIN_API_URL;
  window.localStorage.setItem(API_URL_KEY, LOCAL_ADMIN_API_URL);
  return LOCAL_ADMIN_API_URL;
}

export function clearAdminSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function adminLogin(apiUrl: string, email: string, password: string) {
  const normalizedApiUrl = normalizeMaybeUrl(apiUrl || getInitialApiUrl());
  const response = await fetch(`${normalizedApiUrl}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(`Email ou senha admin invalidos na API ${normalizedApiUrl}.`);
  }
  const data = (await response.json()) as { token?: string; email?: string };
  if (!data.token) {
    throw new Error("A API nao retornou uma chave de sessao.");
  }
  return {
    apiUrl: normalizedApiUrl,
    email: data.email || email,
    token: data.token,
  };
}

export async function listSignalRecipients(session: AdminSession) {
  const data = await request<{ recipients: SignalRecipient[] }>(session, "/telegram-recipients");
  return data.recipients ?? [];
}

export async function createSignalRecipient(
  session: AdminSession,
  payload: Partial<SignalRecipient>,
) {
  const data = await request<{ recipient: SignalRecipient }>(session, "/telegram-recipients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.recipient;
}

export async function updateSignalRecipient(
  session: AdminSession,
  recipientId: string,
  payload: Partial<SignalRecipient>,
) {
  const data = await request<{ recipient: SignalRecipient }>(
    session,
    `/telegram-recipients/${encodeURIComponent(recipientId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return data.recipient;
}

export async function deleteSignalRecipient(session: AdminSession, recipientId: string) {
  await request<{ ok: boolean }>(session, `/telegram-recipients/${encodeURIComponent(recipientId)}`, {
    method: "DELETE",
  });
}

export async function getModuleToggles(session: AdminSession) {
  const data = await request<{ moduleToggles: ModuleToggles }>(session, "/module-toggles");
  return data.moduleToggles;
}

export async function listSecurityEvents(session: AdminSession) {
  return request<{ events: SecurityEvent[]; summary: SecuritySummary }>(session, "/security-events");
}

export async function getAdminSummary(session: AdminSession) {
  const data = await request<{ summary: AdminSummary }>(session, "/admin/summary");
  return data.summary;
}

export async function updateModuleToggles(
  session: AdminSession,
  payload: Partial<ModuleToggles>,
) {
  const data = await request<{ moduleToggles: ModuleToggles }>(session, "/module-toggles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.moduleToggles;
}

async function request<T>(session: AdminSession, path: string, init: RequestInit = {}) {
  const response = await fetch(`${normalizeMaybeUrl(session.apiUrl)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) {
      clearAdminSession();
      throw new Error("Sessao admin expirada ou nao autorizada.");
    }
    const text = await response.text();
    throw new Error(text || "Falha ao conversar com a API admin.");
  }
  return (await response.json()) as T;
}

function normalizeBaseUrl(apiUrl: string) {
  const cleaned = apiUrl.trim();
  try {
    const parsed = new URL(cleaned);
    if (
      ["http:", "https:"].includes(parsed.protocol) &&
      (["127.0.0.1", "localhost"].includes(parsed.hostname) ||
        ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname))
    ) {
      return parsed.origin;
    }
  } catch {
    // Keep the original value below so invalid input still fails visibly.
  }
  return cleaned.replace(/\/+$/, "");
}

function normalizeMaybeUrl(apiUrl: string) {
  return normalizeBaseUrl(apiUrl).replace(/\/dashboard\/?$/, "");
}

function isLocalFrontend() {
  if (typeof window === "undefined") return false;
  return ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

function isLocalApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    return ["127.0.0.1", "localhost"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedRemoteApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    if (parsed.hostname.endsWith("trycloudflare.com")) {
      return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
    }
    if (typeof window !== "undefined" && parsed.hostname === window.location.hostname) return parsed.protocol === "https:";
    return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
