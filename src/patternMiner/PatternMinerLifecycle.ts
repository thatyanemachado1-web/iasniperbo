import type { Round, RoundResult } from "@/types/dashboard";
import type {
  PatternIaActiveSignal,
  PatternIaEntryHistoryItem,
  PatternIaEntryResultLabel,
  PatternIaLifecycleView,
  PatternIaResultStage,
  PatternMinerAlert,
  PatternMinerOperationalStatus,
  PatternMinerSnapshot,
} from "@/types/patternMiner";
import {
  appendPatternIaEntryHistory,
  buildPatternIaEntryHistoryItem,
  readPatternIaEntryHistory,
} from "./PatternMinerEntryHistory.ts";

const RESULT_FLASH_MS = 2_500;

interface LifecycleStore {
  active: PatternIaActiveSignal | null;
  queue: PatternIaActiveSignal[];
  resultStage: PatternIaResultStage;
  status: PatternMinerOperationalStatus;
  resultFlash: "none" | "green" | "tie" | "red";
  flashUntilMs: number;
  lastProcessedRoundId: number;
  seenSignalIds: Set<string>;
  entryHistory: PatternIaEntryHistoryItem[];
  historyBootstrapped: boolean;
}

const store: LifecycleStore = {
  active: null,
  queue: [],
  resultStage: "pending_sg",
  status: "AGUARDANDO PADRAO",
  resultFlash: "none",
  flashUntilMs: 0,
  lastProcessedRoundId: 0,
  seenSignalIds: new Set(),
  entryHistory: [],
  historyBootstrapped: false,
};

export function resetPatternIaLifecycleForTests() {
  store.active = null;
  store.queue = [];
  store.resultStage = "pending_sg";
  store.status = "AGUARDANDO PADRAO";
  store.resultFlash = "none";
  store.flashUntilMs = 0;
  store.lastProcessedRoundId = 0;
  store.seenSignalIds.clear();
  store.entryHistory = [];
  store.historyBootstrapped = false;
}

function ensureEntryHistoryLoaded() {
  if (store.historyBootstrapped) return;
  store.entryHistory = readPatternIaEntryHistory();
  store.historyBootstrapped = true;
}

function recordEntryHistory(
  active: PatternIaActiveSignal,
  resultLabel: PatternIaEntryResultLabel,
  resultRound: Round,
) {
  ensureEntryHistoryLoaded();
  const item = buildPatternIaEntryHistoryItem({
    signal_id: active.signal_id,
    event_id: active.event_id,
    entry_side: active.entry_side,
    result_label: resultLabel,
    result_round: resultRound,
  });
  store.entryHistory = appendPatternIaEntryHistory(store.entryHistory, item);
}

function isConfirmedEntryAlert(alert: PatternMinerAlert) {
  if (alert.kind !== "validated") return false;
  const status = String(alert.strategy.status || "");
  if (status.startsWith("BLOQUEADO")) return false;
  if (status === "ALERTA DE EMPATE") return false;
  return status === "ENTRADA CONFIRMADA" || status === "PADRAO 100%";
}

function buildActiveSignal(alert: PatternMinerAlert): PatternIaActiveSignal {
  const strategy = alert.strategy;
  const entrySide = (strategy.next_side ?? strategy.expectedResult ?? "P") as RoundResult;
  const signalId =
    strategy.signal_id ||
    `pattern-ai:${strategy.id}:${strategy.round_id}:${entrySide}:${Date.parse(strategy.generated_at || "") || Date.now()}`;
  const eventId = strategy.event_id || alert.id;
  return {
    signal_id: signalId,
    event_id: eventId,
    pattern_signature: strategy.pattern_signature || strategy.sequence.join("-"),
    entry_side: entrySide,
    entry_after_round_id: strategy.round_id ?? 0,
    confirmed_at: strategy.generated_at || new Date().toISOString(),
    strategy,
    alert,
  };
}

function enqueueConfirmedSignals(snapshot: PatternMinerSnapshot) {
  for (const alert of snapshot.entryAlerts) {
    if (!isConfirmedEntryAlert(alert)) continue;
    const signal = buildActiveSignal(alert);
    if (store.seenSignalIds.has(signal.signal_id)) continue;
    store.seenSignalIds.add(signal.signal_id);
    if (store.active?.signal_id === signal.signal_id) continue;
    if (store.queue.some((item) => item.signal_id === signal.signal_id)) continue;
    if (!store.active) {
      store.active = signal;
      store.resultStage = "pending_sg";
      store.status = "ENTRADA CONFIRMADA";
      store.resultFlash = "none";
    } else {
      store.queue.push(signal);
    }
  }
}

function roundsAfterEntry(rounds: Round[], entryAfterRoundId: number) {
  return rounds.filter((round) => round.id > entryAfterRoundId);
}

function resolveRoundOutcome(round: Round, entrySide: RoundResult): "win" | "loss" | "tie" {
  if (round.result === entrySide) return "win";
  if (round.result === "T") return "tie";
  return "loss";
}

function advanceLifecycle(rounds: Round[], nowMs = Date.now()) {
  if (store.resultFlash !== "none" && nowMs < store.flashUntilMs) {
    return;
  }
  if (store.resultFlash !== "none" && nowMs >= store.flashUntilMs) {
    store.resultFlash = "none";
    if (store.resultStage === "green_sg" || store.resultStage === "green_g1" || store.resultStage === "red_final" || store.resultStage === "tie_hit") {
      store.active = store.queue.shift() ?? null;
      store.resultStage = store.active ? "pending_sg" : "pending_sg";
      store.status = store.active ? "ENTRADA CONFIRMADA" : "AGUARDANDO PADRAO";
    }
  }

  if (!store.active) return;
  const pendingRounds = roundsAfterEntry(rounds, store.active.entry_after_round_id);
  if (!pendingRounds.length) return;

  const latestPending = pendingRounds[pendingRounds.length - 1];
  if (latestPending.id <= store.lastProcessedRoundId) return;
  store.lastProcessedRoundId = latestPending.id;

  const entrySide = store.active.entry_side;
  const outcome = resolveRoundOutcome(latestPending, entrySide);

  if (store.resultStage === "pending_sg") {
    if (outcome === "win") {
      store.resultStage = "green_sg";
      store.status = "GREEN SG";
      store.resultFlash = entrySide === "T" ? "tie" : "green";
      store.flashUntilMs = nowMs + RESULT_FLASH_MS;
      recordEntryHistory(store.active, "GREEN SG", latestPending);
      logPatternResult(store.active, entrySide, entrySide === "T" ? "TIE" : "GREEN", "green_sg", 0, true);
      return;
    }
    if (outcome === "tie" && entrySide !== "T") {
      store.resultStage = "tie_hit";
      store.status = "GREEN SG";
      store.resultFlash = "tie";
      store.flashUntilMs = nowMs + RESULT_FLASH_MS;
      recordEntryHistory(store.active, "GREEN SG", latestPending);
      logPatternResult(store.active, entrySide, "TIE", "green_sg", 0, true);
      return;
    }
    store.resultStage = "pending_g1";
    store.status = "FAZER GALE 1";
    logPatternResult(store.active, entrySide, "LOSS_SG", "pending_g1", 1, false);
    return;
  }

  if (store.resultStage === "pending_g1") {
    if (outcome === "win") {
      store.resultStage = "green_g1";
      store.status = "GREEN G1";
      store.resultFlash = entrySide === "T" ? "tie" : "green";
      store.flashUntilMs = nowMs + RESULT_FLASH_MS;
      recordEntryHistory(store.active, "GREEN G1", latestPending);
      logPatternResult(store.active, entrySide, entrySide === "T" ? "TIE" : "GREEN", "green_g1", 1, true);
      return;
    }
    if (outcome === "tie" && entrySide !== "T") {
      store.resultStage = "tie_hit";
      store.status = "GREEN G1";
      store.resultFlash = "tie";
      store.flashUntilMs = nowMs + RESULT_FLASH_MS;
      recordEntryHistory(store.active, "GREEN G1", latestPending);
      logPatternResult(store.active, entrySide, "TIE", "green_g1", 1, true);
      return;
    }
    store.resultStage = "red_final";
    store.status = "RED FINAL";
    store.resultFlash = "red";
    store.flashUntilMs = nowMs + RESULT_FLASH_MS;
    recordEntryHistory(store.active, "RED G1", latestPending);
    logPatternResult(store.active, entrySide, "RED", "red_final", 1, true);
  }
}

const lifecycleLogDedupe = new Map<string, number>();

function logPatternResult(
  active: PatternIaActiveSignal,
  entrySide: RoundResult,
  result: string,
  resultStage: PatternIaResultStage,
  currentGale: number,
  finalized: boolean,
) {
  const key = `result:${active.signal_id}:${resultStage}:${result}`;
  const now = Date.now();
  if (lifecycleLogDedupe.get(key) && now - (lifecycleLogDedupe.get(key) || 0) < 5_000) return;
  lifecycleLogDedupe.set(key, now);
  console.info(
    JSON.stringify({
      event: "[PATTERN_IA_RESULT]",
      signal_id: active.signal_id,
      entry_side: entrySide,
      result,
      result_stage: resultStage,
      current_gale: currentGale,
      finalized,
    }),
  );
}

export function resolvePatternIaLifecycle(
  snapshot: PatternMinerSnapshot,
  rounds: Round[],
  nowMs = Date.now(),
): PatternIaLifecycleView {
  ensureEntryHistoryLoaded();
  enqueueConfirmedSignals(snapshot);
  advanceLifecycle(rounds, nowMs);

  const strategy = store.active?.strategy;
  const flashActive = store.resultFlash !== "none" && nowMs < store.flashUntilMs;

  return {
    active: store.active,
    queueLength: store.queue.length,
    resultStage: store.resultStage,
    status: store.status,
    resultFlash: flashActive ? store.resultFlash : "none",
    current_gale: store.resultStage === "pending_g1" ? 1 : 0,
    max_gale: 1,
    finalized:
      store.resultStage === "green_sg" ||
      store.resultStage === "green_g1" ||
      store.resultStage === "red_final" ||
      store.resultStage === "tie_hit",
    blocked_reason: strategy?.blocked_reason,
    entryHistory: store.entryHistory,
  };
}

export function logPatternIaRenderState(
  lifecycle: PatternIaLifecycleView,
  snapshot: PatternMinerSnapshot,
) {
  const strategy = lifecycle.active?.strategy ?? snapshot.entryAlerts[0]?.strategy;
  if (!strategy) return;
  const key = `render:${strategy.signal_id || strategy.id}:${lifecycle.status}:${lifecycle.resultStage}`;
  const now = Date.now();
  if (lifecycleLogDedupe.get(key) && now - (lifecycleLogDedupe.get(key) || 0) < 8_000) return;
  lifecycleLogDedupe.set(key, now);
  console.info(
    JSON.stringify({
      event: "[PATTERN_IA_RENDER_STATE]",
      card: "Padrões IA",
      signal_id: strategy.signal_id || lifecycle.active?.signal_id || "",
      event_id: strategy.event_id || lifecycle.active?.event_id || "",
      pattern_signature: strategy.pattern_signature || strategy.sequence.join("-"),
      status: lifecycle.status,
      next_side: strategy.next_side || strategy.expectedResult || "",
      accuracy: strategy.accuracy ?? strategy.assertiveness ?? 0,
      occurrences: strategy.occurrences,
      sg_count: strategy.sg_count ?? strategy.sg,
      g1_count: strategy.g1_count ?? strategy.g1,
      red_count: strategy.red_count ?? strategy.red,
      tie_after_count: strategy.tie_after_count ?? strategy.tie,
      rendered_at: new Date(now).toISOString(),
    }),
  );
}
