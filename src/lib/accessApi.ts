import { getInitialApiUrl } from "@/lib/adminApi";
import { saveUserSession, type UserSession } from "@/lib/userSession";

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

async function publicRequest<T>(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${normalizeBaseUrl(getInitialApiUrl())}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
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
