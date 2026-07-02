import type { Round, RoundResult } from "@/types/dashboard";
import type { PatternIaEntryHistoryItem, PatternIaEntryResultLabel } from "@/types/patternMiner";

export const PATTERN_IA_ENTRY_HISTORY_STORAGE_KEY = "pattern-ia-entry-history-v1";
export const MAX_PATTERN_IA_ENTRY_HISTORY = 30;

export function readPatternIaEntryHistory(): PatternIaEntryHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(PATTERN_IA_ENTRY_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(normalizePatternIaEntryHistoryItem)
      .filter((item): item is PatternIaEntryHistoryItem => Boolean(item))
      .slice(0, MAX_PATTERN_IA_ENTRY_HISTORY);
  } catch {
    return [];
  }
}

export function writePatternIaEntryHistory(history: PatternIaEntryHistoryItem[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      PATTERN_IA_ENTRY_HISTORY_STORAGE_KEY,
      JSON.stringify(history.slice(0, MAX_PATTERN_IA_ENTRY_HISTORY)),
    );
  } catch {
    // Local persistence is only a visual convenience.
  }
}

export function appendPatternIaEntryHistory(
  history: PatternIaEntryHistoryItem[],
  item: PatternIaEntryHistoryItem,
) {
  const next = [item, ...history.filter((entry) => entry.id !== item.id && entry.signal_id !== item.signal_id)].slice(
    0,
    MAX_PATTERN_IA_ENTRY_HISTORY,
  );
  writePatternIaEntryHistory(next);
  return next;
}

export function buildPatternIaEntryHistoryItem(params: {
  signal_id: string;
  event_id?: string;
  entry_side: RoundResult;
  result_label: PatternIaEntryResultLabel;
  result_round?: Round;
  finalized_at?: string;
}): PatternIaEntryHistoryItem {
  const finalizedAt = params.finalized_at || new Date().toISOString();
  const tieMultiplier = params.result_round ? tieMultiplierFromRound(params.result_round) : undefined;

  return {
    id: `${params.signal_id}:${params.result_label}:${Date.parse(finalizedAt) || Date.now()}`,
    signal_id: params.signal_id,
    event_id: params.event_id,
    entry_side: params.entry_side,
    result_label: params.result_label,
    tie_multiplier: tieMultiplier,
    finalized_at: finalizedAt,
    minute: minuteLabelFromRound(params.result_round, finalizedAt),
  };
}

export function patternIaEntrySideLabel(side: RoundResult, tieMultiplier?: number) {
  if (side === "B") return "B BANKER";
  if (side === "P") return "P PLAYER";
  if (tieMultiplier) return `T EMPATE ${tieMultiplier}X`;
  return "T EMPATE";
}

export function patternIaEntryResultClass(label: PatternIaEntryResultLabel) {
  if (label === "RED G1") return "text-destructive";
  return "text-success";
}

export function patternIaEntrySideClass(side: RoundResult) {
  if (side === "B") return "text-banker";
  if (side === "P") return "text-player";
  return "text-warning";
}

function normalizePatternIaEntryHistoryItem(value: unknown): PatternIaEntryHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<PatternIaEntryHistoryItem>;
  if (record.entry_side !== "B" && record.entry_side !== "P" && record.entry_side !== "T") return null;
  if (record.result_label !== "GREEN SG" && record.result_label !== "GREEN G1" && record.result_label !== "RED G1") {
    return null;
  }

  return {
    id: typeof record.id === "string" && record.id ? record.id : `restored:${Date.now()}`,
    signal_id: typeof record.signal_id === "string" ? record.signal_id : "",
    event_id: typeof record.event_id === "string" ? record.event_id : undefined,
    entry_side: record.entry_side,
    result_label: record.result_label,
    tie_multiplier:
      typeof record.tie_multiplier === "number" && Number.isFinite(record.tie_multiplier)
        ? record.tie_multiplier
        : undefined,
    finalized_at: typeof record.finalized_at === "string" ? record.finalized_at : new Date().toISOString(),
    minute: typeof record.minute === "string" && record.minute ? record.minute : "--",
  };
}

function tieMultiplierFromRound(round: Round) {
  if (round.result !== "T") return undefined;
  if (typeof round.tieMultiplier === "number" && Number.isFinite(round.tieMultiplier)) {
    return Math.round(round.tieMultiplier);
  }
  return undefined;
}

function minuteLabelFromRound(round: Round | undefined, finalizedAt: string) {
  const fromRound = minuteLabelFromTimeText(round?.time);
  if (fromRound) return fromRound;
  return minuteLabelFromIso(finalizedAt) ?? "--";
}

function minuteLabelFromTimeText(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.match(/\b\d{1,2}:(\d{2})(?::\d{2})?\b/);
  return match?.[1] ?? null;
}

function minuteLabelFromIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    minute: "2-digit",
  });
}

export function resetPatternIaEntryHistoryForTests() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PATTERN_IA_ENTRY_HISTORY_STORAGE_KEY);
}
