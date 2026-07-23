import { getInitialApiUrl } from "@/lib/adminApi";
import { readUserSession, saveUserSession, type UserSession } from "@/lib/userSession";

export class AccessApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessApiError";
    this.status = status;
  }
}

export class AccessApiTimeoutError extends Error {
  constructor(message = "A requisição demorou demais. Verifique sua conexão e tente novamente.") {
    super(message);
    this.name = "AccessApiTimeoutError";
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

export interface ClientAccess {
  registered: boolean;
  approved: boolean;
  access_mode: "none" | "demo" | "pending" | "full" | "expired";
  access_status: string;
  plan: "free" | "premium" | "vip";
  email: string;
  full_name: string;
  expires_at: string;
  reason: string;
  client_token?: string;
  role?: UserSession["role"];
}

export interface ClientRegistrationPayload {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  phone_full?: string;
  city: string;
  country: string;
  country_code?: string;
  [key: string]: unknown;
}

export interface BillingPlan {
  id: "free" | "premium" | "vip";
  name: string;
  description: string;
  amount: number;
  oldPrice?: number;
  billingPeriod?: "monthly";
  currency: string;
  durationDays: number;
  features: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  badgeText?: string;
  status?: "active" | "inactive" | "promo" | "sold_out";
  sortOrder?: number;
  checkoutEnabled: boolean;
  checkoutProvider?: "hubla" | "mercadopago" | "";
}

export interface SalesSettings {
  salesClosed: boolean;
  mode: "open" | "closed";
  updated_at?: string;
  updated_by?: string;
  persistence?: "durable" | "temporary";
  storageReady?: boolean;
  warning?: string;
}

export interface BillingSubscriptionOverview {
  email: string;
  plan: "free" | "premium" | "vip";
  status: string;
  accessMode: ClientAccess["access_mode"];
  approved: boolean;
  starts_at: string;
  expires_at: string;
  subscription?: {
    id: string;
    plan: string;
    status: string;
    starts_at: string;
    expires_at: string;
    provider: string;
    provider_preference_id: string;
  };
  last_payment?: BillingPayment;
}

export interface BillingPayment {
  id: string;
  plan: "free" | "premium" | "vip";
  status: string;
  amount: number;
  currency: string;
  paid_at: string;
  created_at: string;
  provider_payment_id: string;
}

export function saveAccessSession(access: ClientAccess, fallbackEmail = "") {
  saveUserSession(access.email || fallbackEmail, {
    name: access.full_name || undefined,
    accessMode: access.access_mode,
    accessStatus: access.access_status,
    plan: access.plan,
    expiresAt: access.expires_at,
    registered: access.registered,
    approved: access.approved,
    clientToken: access.client_token || "",
    role: access.role || undefined,
  });
}

export async function checkClientAccess(
  email: string,
  password: string,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const data = await publicRequest<{ access: ClientAccess }>(
    "/auth/check",
    { email, password },
    timeoutMs,
  );
  return normalizeClientAccess(data.access, email);
}

export async function registerClient(
  payload: ClientRegistrationPayload,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
) {
  const data = await publicRequest<{ access: ClientAccess }>(
    "/auth/register",
    payload,
    timeoutMs,
  );
  return normalizeClientAccess(data.access, payload.email);
}

export function normalizeClientAccess(
  access: ClientAccess | null | undefined,
  fallbackEmail = "",
): ClientAccess {
  const email = String(access?.email || fallbackEmail || "")
    .trim()
    .toLowerCase();
  return {
    registered: Boolean(access?.registered),
    approved: Boolean(access?.approved),
    access_mode: access?.access_mode || "none",
    access_status: String(access?.access_status || "none"),
    plan: access?.plan === "premium" || access?.plan === "vip" ? access.plan : "free",
    email,
    full_name: String(access?.full_name || "").trim(),
    expires_at: String(access?.expires_at || ""),
    reason: String(access?.reason || ""),
    client_token: typeof access?.client_token === "string" ? access.client_token : "",
    role: access?.role,
  };
}

export function validateLoginAccess(access: ClientAccess) {
  if (!access.registered) {
    return { ok: false as const, code: "not_registered" as const, message: "" };
  }
  if (!access.client_token) {
    return {
      ok: false as const,
      code: "missing_session" as const,
      message:
        "Login feito, mas não foi possível carregar sua assinatura/perfil. O servidor não emitiu a sessão. Tente novamente ou fale com o suporte.",
    };
  }
  if (!access.email) {
    return {
      ok: false as const,
      code: "missing_profile" as const,
      message: "Login feito, mas não foi possível carregar sua assinatura/perfil.",
    };
  }
  return { ok: true as const, access };
}

export async function refreshAccessSession() {
  const session = readUserSession();
  if (!session.clientToken) return null;

  try {
    const data = await apiRequest<{ valid: boolean; access?: ClientAccess }>("/auth/verify", {
      method: "POST",
      authenticated: true,
      body: { email: session.email },
    });
    if (!data.valid || !data.access) return null;

    const access = normalizeClientAccess(data.access, session.email);
    if (!access.registered || !access.client_token) return null;

    saveAccessSession(access, session.email);
    return access;
  } catch (error) {
    if (error instanceof AccessApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}

export async function getBillingPlans() {
  const data = await apiRequest<{ plans: BillingPlan[]; salesSettings?: SalesSettings }>("/billing/plans", { method: "GET" });
  return data.plans ?? [];
}

export async function getSalesSettings() {
  const data = await apiRequest<{ salesSettings: SalesSettings }>("/sales/settings", { method: "GET" });
  return data.salesSettings ?? { salesClosed: false, mode: "open" as const };
}

export async function getBillingSubscription() {
  return apiRequest<{ subscription: BillingSubscriptionOverview; plans: BillingPlan[] }>(
    "/billing/subscription",
    { method: "GET", authenticated: true },
  );
}

export async function getBillingPayments() {
  const data = await apiRequest<{ payments: BillingPayment[] }>("/billing/payments", {
    method: "GET",
    authenticated: true,
  });
  return data.payments ?? [];
}

export async function createBillingCheckout(plan: "premium" | "vip") {
  const session = readUserSession();
  return apiRequest<{ checkout_url: string; provider?: string; preference_id?: string; subscription: BillingSubscriptionOverview["subscription"] }>(
    "/billing/checkout",
    {
      method: "POST",
      authenticated: true,
      body: {
        plan,
        email: session.email,
        full_name: session.name,
      },
    },
  );
}

export async function createPublicBillingCheckout(
  plan: "premium" | "vip",
  lead: {
    email: string;
    full_name?: string;
    phone?: string;
    phone_full?: string;
    city?: string;
    country?: string;
    country_code?: string;
  },
) {
  return apiRequest<{
    checkout_url: string;
    provider?: string;
    preference_id?: string;
    subscription: BillingSubscriptionOverview["subscription"];
  }>("/billing/checkout", {
    method: "POST",
    body: {
      plan,
      ...lead,
    },
  });
}

async function publicRequest<T>(
  path: string,
  body: Record<string, unknown>,
  timeoutMs?: number,
) {
  return apiRequest<T>(path, { method: "POST", body, timeoutMs });
}

async function apiRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    authenticated?: boolean;
    timeoutMs?: number;
  } = {},
) {
  const token = readUserSession().clientToken || "";
  const timeoutMs = init.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${publicApiBaseUrl()}${path}`, {
      method: init.method || "GET",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      let message = "";
      try {
        const parsed = JSON.parse(text) as { error?: string };
        message = parsed.error || "";
      } catch {
        message = text;
      }
      throw new AccessApiError(message || "Não foi possível validar o acesso.", response.status);
    }

    try {
      return (text ? JSON.parse(text) : {}) as T;
    } catch {
      throw new AccessApiError(
        "O servidor respondeu, mas não foi possível ler a resposta do login.",
        0,
      );
    }
  } catch (error) {
    if (error instanceof AccessApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AccessApiTimeoutError();
    }
    throw new AccessApiError(
      "Não foi possível conectar ao servidor de login. Verifique sua internet e tente novamente.",
      0,
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function publicApiBaseUrl() {
  if (typeof window === "undefined") {
    return normalizeBaseUrl(getInitialApiUrl());
  }

  if (isLocalFrontend()) {
    return window.location.origin;
  }

  if (isHostedAppOrigin()) {
    return window.location.origin;
  }

  const configured = normalizeBaseUrl(getInitialApiUrl());
  if (!configured || isSameOriginApiUrl(configured)) {
    return window.location.origin;
  }

  return configured;
}

function isSameOriginApiUrl(apiUrl: string) {
  try {
    const parsed = new URL(apiUrl);
    return parsed.hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function isLocalFrontend() {
  return (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  );
}

function isHostedAppOrigin() {
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "sniperbo.com" ||
    hostname === "www.sniperbo.com" ||
    hostname.endsWith(".lovable.app")
  );
}

function normalizeBaseUrl(apiUrl: string) {
  return apiUrl.trim().replace(/\/+$/, "");
}

export function accessLabel(session: UserSession) {
  if (session.accessMode === "full") return session.plan === "vip" ? "VIP liberado" : "Premium liberado";
  if (session.accessMode === "pending") return "Aguardando liberação";
  if (session.accessMode === "expired") return "Acesso expirado";
  if (session.accessMode === "demo") return "Teste gratuito";
  return "Sem cadastro";
}
