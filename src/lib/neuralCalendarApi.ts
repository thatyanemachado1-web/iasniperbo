import { getInitialApiUrl } from "@/lib/adminApi";
import { buildLocalNeuralCalendar, localCalendarTotalRounds } from "@/lib/neuralCalendarLocalFallback";
import { readUserSession } from "@/lib/userSession";
import type { NeuralCalendarPayload } from "@/types/neuralCalendar";

export async function fetchNeuralCalendar(params: {
  year: number;
  month: number;
  date?: string;
  range?: string;
}) {
  const search = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
    range: params.range || "este_mes",
  });
  if (params.date) search.set("date", params.date);

  const token = readUserSession().clientToken || "";
  const localCalendar = buildLocalNeuralCalendar(params);
  try {
    const response = await fetch(`${publicApiBaseUrl()}/calendar/neural?${search.toString()}`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      const text = await response.text();
      if (localCalendar) return localCalendar;
      throw new Error(readApiError(text) || "Nao foi possivel carregar o Calendario Neural.");
    }
    const data = (await response.json()) as { calendar: NeuralCalendarPayload };
    const serverCalendar = data.calendar;
    return localCalendarTotalRounds(serverCalendar) > 0 || !localCalendar ? serverCalendar : localCalendar;
  } catch (error) {
    if (localCalendar) return localCalendar;
    throw error;
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
