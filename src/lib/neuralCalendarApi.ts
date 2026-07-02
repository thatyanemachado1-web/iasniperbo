import { getInitialApiUrl } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { NeuralCalendarEngineKey, NeuralCalendarPayload } from "@/types/neuralCalendar";

const NEURAL_CALENDAR_REQUEST_TIMEOUT_MS = 12_000;

export async function fetchNeuralCalendar(params: {
  year: number;
  month: number;
  date?: string;
  range?: string;
  engine?: NeuralCalendarEngineKey;
  engines?: NeuralCalendarEngineKey[];
}) {
  const search = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    range: params.range || "este_mes",
  });
  if (params.date) search.set("date", params.date);
  if (params.engine) search.set("engine", params.engine);
  if (params.engines?.length) search.set("engines", params.engines.join(","));

  const token = readUserSession().clientToken || "";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), NEURAL_CALENDAR_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${publicApiBaseUrl()}/calendar/neural?${search.toString()}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(readApiError(text) || "Nao foi possivel carregar o Calendario Neural.");
    }
    const data = (await response.json()) as { calendar: NeuralCalendarPayload };
    return data.calendar;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("O Calendario Neural demorou para responder. Tente novamente em alguns segundos.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function readApiError(text: string) {
  try {
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error || "";
  } catch {
    return text;
  }
}

function publicApiBaseUrl() {
  if (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  ) {
    return window.location.origin;
  }
  return getInitialApiUrl().trim().replace(/\/+$/, "");
}
