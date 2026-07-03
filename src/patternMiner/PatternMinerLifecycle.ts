import type { Round, RoundResult } from "@/types/dashboard";
import type {
  PatternIaActiveSignal,
  PatternIaDisplayState,
  PatternIaEntryHistoryItem,
  PatternIaEntryResultLabel,
  PatternIaLastSignalResult,
  PatternIaLifecycleView,
  PatternIaResultStage,
  PatternMinerAlert,
  PatternMinerSnapshot,
} from "@/types/patternMiner";
import {
  appendPatternIaEntryHistory,
  buildPatternIaEntryHistoryItem,
  readPatternIaEntryHistory,
} from "./PatternMinerEntryHistory.ts";

const RESULT_FLASH_MS = 1_200;

interface LifecycleStore {
  activeSignal: PatternIaActiveSignal | null;
  lastSignalResult: PatternIaLastSignalResult | null;
  queue: PatternIaActiveSignal[];
  displayState: PatternIaDisplayState;
  resultStage: PatternIaResultStage;
  resultFlashUntilMs: number;
  lastProcessedRoundId: number;
  completedSignalKeys: Set<string>;
  entryHistory: PatternIaEntryHistoryItem[];
  historyBootstrapped: boolean;
}

const store: LifecycleStore = {
  activeSignal: null,
  lastSignalResult: null,
  queue: [],
  displayState: "analyzing",
  resultStage: "pending_sg",
  resultFlashUntilMs: 0,
  lastProcessedRoundId: 0,
  completedSignalKeys: new Set(),
  entryHistory: [],
  historyBootstrapped: false,
};

export function resetPatternIaLifecycleForTests() {
  store.activeSignal = null;
  store.lastSignalResult = null;
  store.queue = [];
  store.displayState = "analyzing";
  store.resultStage = "pending_sg";
  store.resultFlashUntilMs = 0;
  store.lastProcessedRoundId = 0;
  store.completedSignalKeys.clear();
  store.entryHistory = [];
  store.historyBootstrapped = false;
}

function ensureEntryHistoryLoaded() {
  if (store.historyBootstrapped) return;
  store.entryHistory = readPatternIaEntryHistory();
  store.historyBootstrapped = true;
}

function signalKey(signal: PatternIaActiveSignal) {
  return signal.event_id || `${signal.signal_id}:${signal.entry_after_round_id}`;
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

function activateSignal(signal: PatternIaActiveSignal) {
  store.activeSignal = signal;
  store.lastSignalResult = null;
  store.resultStage = "pending_sg";
  store.lastProcessedRoundId = signal.entry_after_round_id;
  store.displayState = "entry_confirmed";
}

function enqueueConfirmedSignals(snapshot: PatternMinerSnapshot) {
  if (store.activeSignal || store.lastSignalResult) return;

  for (const alert of snapshot.entryAlerts) {
    if (!isConfirmedEntryAlert(alert)) continue;
    const signal = buildActiveSignal(alert);
    const key = signalKey(signal);
    if (store.completedSignalKeys.has(key)) continue;
    if (store.queue.some((item) => signalKey(item) === key)) continue;
    if (store.activeSignal) {
      store.queue.push(signal);
    } else {
      activateSignal(signal);
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

function tieMultiplierFromRound(round: Round) {
  if (round.result !== "T") return undefined;
  if (typeof round.tieMultiplier === "number" && Number.isFinite(round.tieMultiplier)) {
    return Math.round(round.tieMultiplier);
  }
  return undefined;
}

function finalizeResult(
  active: PatternIaActiveSignal,
  resultLabel: PatternIaEntryResultLabel,
  resultRound: Round,
  resultStage: PatternIaResultStage,
  nowMs: number,
) {
  recordEntryHistory(active, resultLabel, resultRound);
  const isTieProtected =
    resultRound.result === "T" && active.entry_side !== "T" && (resultLabel === "GREEN SG" || resultLabel === "GREEN G1");
  const displayState: PatternIaDisplayState = isTieProtected
    ? "result_tie"
    : resultLabel === "RED G1"
      ? "result_red"
      : "result_green";

  store.lastSignalResult = {
    signal_id: active.signal_id,
    event_id: active.event_id,
    entry_side: active.entry_side,
    result_label: resultLabel,
    display_label: isTieProtected ? "EMPATE" : resultLabel === "RED G1" ? "RED" : resultLabel,
    tie_multiplier: tieMultiplierFromRound(resultRound),
    strategy: active.strategy,
    finalized_at: new Date(nowMs).toISOString(),
  };
  store.activeSignal = null;
  store.resultStage = resultStage;
  store.displayState = displayState;
  store.resultFlashUntilMs = nowMs + RESULT_FLASH_MS;
  store.completedSignalKeys.add(signalKey(active));

  logPatternResult(
    active,
    active.entry_side,
    store.lastSignalResult.display_label,
    resultStage,
    resultLabel === "RED G1" ? 1 : 0,
    true,
  );
}

function expireResultFlash(nowMs: number) {
  if (!store.lastSignalResult) return;
  if (nowMs < store.resultFlashUntilMs) return;

  store.lastSignalResult = null;
  store.displayState = "analyzing";
  store.resultStage = "pending_sg";
  store.resultFlashUntilMs = 0;

  const next = store.queue.shift();
  if (next) activateSignal(next);
}

function advanceActiveSignal(rounds: Round[], nowMs: number) {
  if (!store.activeSignal) return;

  const pendingRounds = roundsAfterEntry(rounds, store.activeSignal.entry_after_round_id);
  if (!pendingRounds.length) {
    store.displayState = "entry_confirmed";
    return;
  }

  store.displayState = "waiting_result";

  const latestPending = pendingRounds[pendingRounds.length - 1];
  if (latestPending.id <= store.lastProcessedRoundId) return;
  store.lastProcessedRoundId = latestPending.id;

  const active = store.activeSignal;
  const entrySide = active.entry_side;
  const outcome = resolveRoundOutcome(latestPending, entrySide);

  if (store.resultStage === "pending_sg") {
    if (outcome === "win") {
      finalizeResult(active, "GREEN SG", latestPending, "green_sg", nowMs);
      return;
    }
    if (outcome === "tie" && entrySide !== "T") {
      finalizeResult(active, "GREEN SG", latestPending, "tie_hit", nowMs);
      return;
    }
    store.resultStage = "pending_g1";
    store.displayState = "waiting_result";
    logPatternResult(active, entrySide, "LOSS_SG", "pending_g1", 0, false);
    return;
  }

  if (store.resultStage === "pending_g1") {
    if (outcome === "win") {
      finalizeResult(active, "GREEN G1", latestPending, "green_g1", nowMs);
      return;
    }
    if (outcome === "tie" && entrySide !== "T") {
      finalizeResult(active, "GREEN G1", latestPending, "tie_hit", nowMs);
      return;
    }
    finalizeResult(active, "RED G1", latestPending, "red_final", nowMs);
  }
}

function resolveMonitoringState(snapshot: PatternMinerSnapshot): PatternIaDisplayState {
  if (snapshot.formingAlerts.length > 0) return "monitoring";
  return "analyzing";
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

  expireResultFlash(nowMs);

  if (!store.lastSignalResult) {
    advanceActiveSignal(rounds, nowMs);
    if (!store.activeSignal) {
      enqueueConfirmedSignals(snapshot);
      if (!store.activeSignal && !store.lastSignalResult) {
        store.displayState = resolveMonitoringState(snapshot);
      }
    }
  }

  const resultFlash =
    store.lastSignalResult && nowMs < store.resultFlashUntilMs
      ? store.displayState === "result_red"
        ? "red"
        : store.displayState === "result_tie"
          ? "tie"
          : "green"
      : "none";

  const status = resolveLifecycleStatus(store.displayState, store.resultStage);

  return {
    activeSignal: store.activeSignal,
    active: store.activeSignal,
    lastSignalResult: store.lastSignalResult,
    displayState: store.displayState,
    queueLength: store.queue.length,
    resultStage: store.resultStage,
    status,
    resultFlash,
    current_gale: store.resultStage === "pending_g1" && store.activeSignal ? 1 : 0,
    max_gale: 1,
    finalized: Boolean(store.lastSignalResult) || store.resultStage === "red_final",
    entryHistory: store.entryHistory,
  };
}

function resolveLifecycleStatus(displayState: PatternIaDisplayState, resultStage: PatternIaResultStage) {
  if (displayState === "result_green") return resultStage === "green_g1" ? "GREEN G1" : "GREEN SG";
  if (displayState === "result_red") return "RED FINAL";
  if (displayState === "result_tie") return "GREEN SG";
  if (displayState === "entry_confirmed") return "ENTRADA CONFIRMADA";
  if (displayState === "waiting_result" && resultStage === "pending_g1") return "FAZER GALE 1";
  if (displayState === "waiting_result") return "ENTRADA CONFIRMADA";
  if (displayState === "monitoring") return "PADRAO EM FORMACAO";
  return "AGUARDANDO PADRAO";
}

export function logPatternIaRenderState(
  lifecycle: PatternIaLifecycleView,
  snapshot: PatternMinerSnapshot,
) {
  const strategy =
    lifecycle.activeSignal?.strategy ??
    lifecycle.lastSignalResult?.strategy ??
    snapshot.entryAlerts[0]?.strategy;
  if (!strategy) return;

  const key = `render:${lifecycle.displayState}:${strategy.signal_id || strategy.id}:${lifecycle.lastSignalResult?.signal_id || ""}`;
  const now = Date.now();
  if (lifecycleLogDedupe.get(key) && now - (lifecycleLogDedupe.get(key) || 0) < 8_000) return;
  lifecycleLogDedupe.set(key, now);

  console.info(
    JSON.stringify({
      event: "[PATTERN_IA_RENDER_STATE]",
      card: "Padrões IA",
      displayState: lifecycle.displayState,
      signal_id: lifecycle.activeSignal?.signal_id || lifecycle.lastSignalResult?.signal_id || strategy.signal_id || "",
      event_id: lifecycle.activeSignal?.event_id || strategy.event_id || "",
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
      has_active_signal: Boolean(lifecycle.activeSignal),
      has_last_result: Boolean(lifecycle.lastSignalResult),
    }),
  );
}
