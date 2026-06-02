import { getInitialApiUrl } from "@/lib/adminApi";
import { readUserSession, saveUserSession, type UserSession } from "@/lib/userSession";

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
  city: string;
  country: string;
  [key: string]: unknown;
}

export interface BillingPlan {
  id: "free" | "premium" | "vip";
  name: string;
  description: string;
  amount: number;
  currency: string;
  durationDays: number;
  features: string[];
  checkoutEnabled: boolean;
  checkoutProvider?: "hubla" | "mercadopago" | "";
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

export async function checkClientAccess(email: string, password: string) {
  const data = await publicRequest<{ access: ClientAccess }>("/auth/check", { email, password });
  return data.access;
}

export async function registerClient(payload: ClientRegistrationPayload) {
  const data = await publicRequest<{ access: ClientAccess }>("/auth/register", payload);
  return data.access;
}

export async function refreshAccessSession() {
  const session = readUserSession();
  if (!session.clientToken) return null;

  const data = await publicRequest<{ valid: boolean; access?: ClientAccess }>("/auth/verify", {
    token: session.clientToken,
  });
  if (!data.valid || !data.access) return null;

  saveAccessSession(data.access, session.email);
  return data.access;
}

export async function getBillingPlans() {
  const data = await apiRequest<{ plans: BillingPlan[] }>("/billing/plans", { method: "GET" });
  return data.plans ?? [];
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
  return apiRequest<{ checkout_url: string; provider?: string; preference_id?: string; subscription: BillingSubscriptionOverview["subscription"] }>(
    "/billing/checkout",
    {
      method: "POST",
      authenticated: true,
      body: { plan },
    },
  );
}

async function publicRequest<T>(path: string, body: Record<string, unknown>) {
  return apiRequest<T>(path, { method: "POST", body });
}

async function apiRequest<T>(
  path: string,
  init: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    authenticated?: boolean;
  } = {},
) {
  const token = readUserSession().clientToken || "";
  const response = await fetch(`${normalizeBaseUrl(getInitialApiUrl())}${path}`, {
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    let message = "";
    try {
      const parsed = JSON.parse(text) as { error?: string };
      message = parsed.error || "";
    } catch {
      message = text;
    }
    throw new Error(message || "Nao foi possivel validar o acesso.");
  }
  return (await response.json()) as T;
}

function normalizeBaseUrl(apiUrl: string) {
  return apiUrl.trim().replace(/\/+$/, "");
}

export function accessLabel(session: UserSession) {
  if (session.accessMode === "full") return session.plan === "vip" ? "VIP liberado" : "Premium liberado";
  if (session.accessMode === "pending") return "Aguardando liberacao";
  if (session.accessMode === "expired") return "Acesso expirado";
  if (session.accessMode === "demo") return "Modo demo";
  return "Sem cadastro";
}
