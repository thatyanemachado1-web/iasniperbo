import { readAdminSession } from "@/lib/adminApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import type { AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";

export type LocalAiEvent =
  | "chat"
  | "entrada_confirmada"
  | "green"
  | "red"
  | "g1"
  | "padrao_formando"
  | "sem_entrada"
  | "surf_detectado"
  | "numero_pagante"
  | "tie_alert"
  | "risco_alto"
  | "mercado_esticado"
  | "mercado_sujo"
  | "mercado_virando"
  | "narracao";

export interface LocalAiCommentaryRequest {
  question?: string;
  event?: LocalAiEvent;
  fallbackText?: string;
  adaptiveSnapshot?: AdaptiveStrategySnapshot;
}

export interface LocalAiCommentaryResponse {
  commentary: string;
  cached?: boolean;
  provider: "ollama" | "fallback";
  model: string;
  status: "ok" | "disabled" | "fallback" | "error";
  error?: string;
}

export async function requestLocalAiCommentary(payload: LocalAiCommentaryRequest) {
  const response = await fetch(localAiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<LocalAiCommentaryResponse>;
  if (!response.ok) {
    throw new Error(data.error || "Falha ao consultar IA local.");
  }
  return {
    commentary: data.commentary || "Mesa em observacao. Ainda sem dados suficientes.",
    cached: data.cached === true,
    provider: data.provider || "fallback",
    model: data.model || "qwen2.5:7b",
    status: data.status || "fallback",
    error: data.error,
  } satisfies LocalAiCommentaryResponse;
}

function localAiUrl() {
  if (typeof window === "undefined") return "/api/ai/local-commentary";
  return `${window.location.origin}/api/ai/local-commentary`;
}

function authHeaders() {
  const admin = readAdminSession();
  if (admin?.token) return { Authorization: `Bearer ${admin.token}`, "x-sniper-token": admin.token };
  const user = readUserSession();
  if (user.clientToken) return { Authorization: `Bearer ${user.clientToken}` };
  if (hasFullAccess(user)) return { Authorization: "Bearer sniper-local-admin-token" };
  if (
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname)
  ) {
    return { Authorization: "Bearer sniper-local-admin-token" };
  }
  return {};
}
