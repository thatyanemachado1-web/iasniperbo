import type { AdminSession, SignalRecipient } from "@/types/admin";

const API_URL_KEY = "sniper_admin_api_url";
const SESSION_KEY = "sniper_admin_session";

const defaultApiUrl = () =>
  (import.meta.env.VITE_SNIPER_API_URL as string | undefined) ||
  (import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined)?.replace(/\/dashboard\/?$/, "") ||
  "http://127.0.0.1:8787";

export function getInitialApiUrl() {
  if (typeof window === "undefined") return defaultApiUrl();
  return window.localStorage.getItem(API_URL_KEY) || defaultApiUrl();
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

export function clearAdminSession() {
  window.sessionStorage.removeItem(SESSION_KEY);
}

export async function adminLogin(apiUrl: string, email: string, password: string) {
  const response = await fetch(`${normalizeBaseUrl(apiUrl)}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error("Email ou senha admin invalidos.");
  }
  const data = (await response.json()) as { token?: string; email?: string };
  if (!data.token) {
    throw new Error("A API nao retornou uma chave de sessao.");
  }
  return {
    apiUrl: normalizeBaseUrl(apiUrl),
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

async function request<T>(session: AdminSession, path: string, init: RequestInit = {}) {
  const response = await fetch(`${normalizeBaseUrl(session.apiUrl)}${path}`, {
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
  return apiUrl.trim().replace(/\/+$/, "");
}
