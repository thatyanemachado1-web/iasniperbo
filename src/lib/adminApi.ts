import type {
  AdminSession,
  AdminSummary,
  SecurityEvent,
  SecuritySummary,
  SignalRecipient,
} from "@/types/admin";
import type {
  AdminActionLog,
  AdminLogsResponse,
  AdminManagedUser,
  AdminPanelOverview,
  AdminUsersResponse,
} from "@/types/adminPanel";
import type { ModuleToggles } from "@/types/dashboard";
import type { SalesSettings } from "@/lib/accessApi";
import type { AnnouncementTone, SiteContentSettings } from "@/lib/siteContent";

export interface LocalAiAdminSettings {
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
}

export interface LocalAiAdminStatus {
  online: boolean;
  status: string;
  model: string;
  baseUrl: string;
}

export interface LocalAiAdminLog {
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
}

const API_URL_KEY = "sniper_admin_api_url";
const SESSION_KEY = "sniper_admin_session";
export const LOCAL_ADMIN_API_URL = "http://127.0.0.1:8787";
export const PUBLIC_ADMIN_API_URL = "https://sniperbo.com";
const ALLOWED_REMOTE_API_HOSTS = new Set(["sniperbo.com", "www.sniperbo.com"]);

const defaultApiUrl = () =>
  (import.meta.env.VITE_SNIPER_API_URL as string | undefined) ||
  (import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined)?.replace(
    /\/dashboard\/?$/,
    "",
  ) ||
  (typeof window !== "undefined" && !isLocalFrontend()
    ? PUBLIC_ADMIN_API_URL
    : LOCAL_ADMIN_API_URL);

export function getInitialApiUrl() {
  if (typeof window === "undefined") return defaultApiUrl();
  const saved = normalizeMaybeUrl(window.localStorage.getItem(API_URL_KEY) || "");
  if (isLocalFrontend() && (!saved || !isLocalApiUrl(saved))) {
    window.localStorage.setItem(API_URL_KEY, LOCAL_ADMIN_API_URL);
    return LOCAL_ADMIN_API_URL;
  }
  if (
    !isLocalFrontend() &&
    (!saved || isLocalApiUrl(saved) || isSameOriginApiUrl(saved) || !isAllowedRemoteApiUrl(saved))
  ) {
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
  const data = (await response.json()) as {
    token?: string;
    email?: string;
    role?: AdminSession["role"];
  };
  if (!data.token) {
    throw new Error("A API nao retornou uma chave de sessao.");
  }
  return {
    apiUrl: normalizedApiUrl,
    email: data.email || email,
    token: data.token,
    role: normalizeAdminRole(data.role),
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
  await request<{ ok: boolean }>(
    session,
    `/telegram-recipients/${encodeURIComponent(recipientId)}`,
    {
      method: "DELETE",
    },
  );
}

export async function getModuleToggles(session: AdminSession) {
  const data = await request<{ moduleToggles: ModuleToggles }>(session, "/module-toggles");
  return data.moduleToggles;
}

export async function getLocalAiAdmin(session: AdminSession) {
  return request<{
    settings: LocalAiAdminSettings;
    logs: LocalAiAdminLog[];
    status: LocalAiAdminStatus;
  }>(session, "/admin/local-ai");
}

export async function updateLocalAiAdmin(
  session: AdminSession,
  payload: Partial<LocalAiAdminSettings>,
) {
  return request<{
    settings: LocalAiAdminSettings;
    logs: LocalAiAdminLog[];
    status: LocalAiAdminStatus;
  }>(session, "/admin/local-ai", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getAdminSalesSettings(session: AdminSession) {
  const data = await request<{ salesSettings: SalesSettings }>(session, "/admin/sales-settings");
  return data.salesSettings;
}

export async function updateAdminSalesSettings(
  session: AdminSession,
  payload: Pick<SalesSettings, "salesClosed">,
) {
  const data = await request<{ salesSettings: SalesSettings }>(session, "/admin/sales-settings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.salesSettings;
}

export async function getAdminSiteContent(session: AdminSession) {
  const data = await request<{ siteContent: SiteContentSettings }>(session, "/admin/site-content");
  return data.siteContent;
}

export async function updateAdminSiteContent(
  session: AdminSession,
  payload: Partial<SiteContentSettings>,
) {
  const data = await request<{ siteContent: SiteContentSettings }>(session, "/admin/site-content", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.siteContent;
}

export async function listSecurityEvents(session: AdminSession) {
  return request<{ events: SecurityEvent[]; summary: SecuritySummary }>(
    session,
    "/security-events",
  );
}

export async function getAdminSummary(session: AdminSession) {
  const data = await request<{ summary: AdminSummary }>(session, "/admin/summary");
  return data.summary;
}

export async function listAdminUsers(session: AdminSession) {
  return request<AdminUsersResponse>(session, "/admin/users");
}

export async function getAdminPanelOverview(session: AdminSession) {
  const data = await request<{ overview: AdminPanelOverview }>(session, "/admin/overview");
  return data.overview;
}

export async function updateAdminUser(
  session: AdminSession,
  userId: string,
  payload: Partial<AdminManagedUser> & { reason?: string },
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
  return data.user;
}

export async function deleteAdminUser(
  session: AdminSession,
  userId: string,
  reason = "Exclusao manual",
) {
  await request<{ ok: boolean }>(session, `/admin/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
}

export async function extendAdminUserAccess(
  session: AdminSession,
  userId: string,
  days: number,
  reason = "Prorrogacao manual",
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}/extend-access`,
    {
      method: "POST",
      body: JSON.stringify({ days, reason }),
    },
  );
  return data.user;
}

export async function blockAdminUser(
  session: AdminSession,
  userId: string,
  reason = "Bloqueio manual",
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}/block`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
  return data.user;
}

export async function unblockAdminUser(
  session: AdminSession,
  userId: string,
  reason = "Reativacao manual",
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}/unblock`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
  return data.user;
}

export async function changeAdminUserPlan(
  session: AdminSession,
  userId: string,
  payload: Pick<AdminManagedUser, "plan" | "subscriptionStatus" | "currentPeriodEnd"> & {
    reason?: string;
  },
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}/change-plan`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return data.user;
}

export async function changeAdminUserRole(
  session: AdminSession,
  userId: string,
  role: AdminManagedUser["role"],
  reason = "Alteracao de permissao",
) {
  const data = await request<{ user: AdminManagedUser }>(
    session,
    `/admin/users/${encodeURIComponent(userId)}/change-role`,
    {
      method: "POST",
      body: JSON.stringify({ role, reason }),
    },
  );
  return data.user;
}

export async function listAdminLogs(session: AdminSession) {
  const data = await request<AdminLogsResponse>(session, "/admin/logs");
  return data.logs ?? [];
}

export async function sendAdminBroadcast(
  session: AdminSession,
  payload: {
    title: string;
    message: string;
    audience: string;
    tone?: AnnouncementTone;
    buttonLabel?: string;
    buttonUrl?: string;
  },
) {
  return request<{ ok: boolean; log?: AdminActionLog; siteContent?: SiteContentSettings }>(
    session,
    "/admin/broadcast",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function updateModuleToggles(session: AdminSession, payload: Partial<ModuleToggles>) {
  const data = await request<{ moduleToggles: ModuleToggles }>(session, "/module-toggles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.moduleToggles;
}

function normalizeAdminRole(role: unknown): NonNullable<AdminSession["role"]> {
  const value = String(role || "owner")
    .trim()
    .toLowerCase();
  return value === "admin" || value === "approver" ? "admin" : "owner";
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

function isSameOriginApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    return typeof window !== "undefined" && parsed.hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function isAllowedRemoteApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    if (typeof window !== "undefined" && parsed.hostname === window.location.hostname)
      return parsed.protocol === "https:";
    return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}
