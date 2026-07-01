import type { Round, RoundResult, SurfAlert, SurfPhase, SurfSide } from "@/types/dashboard";

const DAILY_SURF_STORAGE_KEY = "sniper_daily_surf_max_v1";
const TIME_ZONE = "America/Sao_Paulo";

export type DailySurfSide = "BANKER" | "PLAYER" | "TIE";
export type DailySurfMemorySide = "BANKER" | "PLAYER";
export type DailySurfMemoryStatus =
  | "SEM_SURF"
  | "PRE_SURF"
  | "SURF_AGRESSIVO"
  | "SURF_DOMINANTE"
  | "RECUPERACAO_SURF"
  | "SURF_ESTICADO"
  | "RISCO_QUEBRA"
  | "VIRADA_SURF";

export interface DailySurfRound {
  round_id: string;
  result: DailySurfSide;
  round_time: string;
  table_id: string;
  date_br: string;
  order: number;
}

export interface DailySurfMemory {
  dateKey: string;
  playerDrops3Plus: number;
  bankerDrops3Plus: number;
  playerMaxDepth: number;
  bankerMaxDepth: number;
  totalDrops3Plus: number;
  dominantSide: DailySurfMemorySide | null;
  dominantPercent: number;
  recoverySide: DailySurfMemorySide | null;
  stretchedSide: DailySurfMemorySide | null;
  currentDropSide: DailySurfMemorySide | null;
  currentDropDepth: number;
  surfBias: DailySurfMemorySide | null;
  surfStatus: DailySurfMemoryStatus;
  confidence: number;
  reason: string;
  playerMaxDeficit: number;
  bankerMaxDeficit: number;
  recentResults: DailySurfSide[];
  recentTieCount: number;
  recentAlternationRate: number;
  recentPressureSide: DailySurfMemorySide | null;
  recentPressurePercent: number;
  lastBreakSide: DailySurfMemorySide | null;
  lastBreakDepth: number;
}

export interface DailySurfMaxSnapshot {
  currentStreak: {
    side: DailySurfSide | null;
    count: number;
  };
  dailyMaxSurf: {
    banker: number;
    player: number;
    tie: number;
    date: string;
    table_id: string;
    last_round_id: string | null;
    updated_at: string;
  };
  dailySurfMemory: DailySurfMemory;
}

export interface DailySurfRoundSource extends Round {
  key?: string;
  day?: string;
  capturedAt?: string;
  sourceUpdatedAt?: string;
}

export class DailySurfMaxEngine {
  static empty(tableId = "bac-bo", date = brasiliaDateKey()): DailySurfMaxSnapshot {
    return {
      currentStreak: {
        side: null,
        count: 0,
      },
      dailyMaxSurf: {
        banker: 0,
        player: 0,
        tie: 0,
        date,
        table_id: tableId,
        last_round_id: null,
        updated_at: new Date().toISOString(),
      },
      dailySurfMemory: emptyDailySurfMemory(date),
    };
  }

  static load(tableId = "bac-bo", scope = "default"): DailySurfMaxSnapshot {
    if (typeof window === "undefined") return this.empty(tableId);

    try {
      const value = window.localStorage.getItem(storageKey(tableId, scope));
      const parsed = value ? JSON.parse(value) : null;
      if (isDailySurfMaxSnapshot(parsed)) return normalizeSnapshot(parsed, tableId);
    } catch {
      // Local persistence is a fallback. If it fails, keep the engine running in memory.
    }

    return this.empty(tableId);
  }

  static save(snapshot: DailySurfMaxSnapshot, scope = "default") {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey(snapshot.dailyMaxSurf.table_id, scope),
      JSON.stringify(snapshot),
    );
  }

  static processRound(snapshot: DailySurfMaxSnapshot, round: DailySurfRound): DailySurfMaxSnapshot {
    if (round.round_id === snapshot.dailyMaxSurf.last_round_id) return snapshot;

    const base =
      snapshot.dailyMaxSurf.date === round.date_br
        ? snapshot
        : DailySurfMaxEngine.empty(round.table_id, round.date_br);

    const nextStreak =
      base.currentStreak.side === round.result
        ? { side: round.result, count: base.currentStreak.count + 1 }
        : { side: round.result, count: 1 };

    const next = cloneSnapshot(base);
    next.currentStreak = nextStreak;
    next.dailyMaxSurf.last_round_id = round.round_id;
    next.dailyMaxSurf.updated_at = new Date().toISOString();

    if (nextStreak.side === "BANKER") {
      next.dailyMaxSurf.banker = Math.max(next.dailyMaxSurf.banker, nextStreak.count);
    }
    if (nextStreak.side === "PLAYER") {
      next.dailyMaxSurf.player = Math.max(next.dailyMaxSurf.player, nextStreak.count);
    }
    if (nextStreak.side === "TIE") {
      next.dailyMaxSurf.tie = Math.max(next.dailyMaxSurf.tie, nextStreak.count);
    }

    next.dailySurfMemory = calculateDailySurfMemory(base.dailySurfMemory, round);

    return next;
  }

  static recalculate(rounds: DailySurfRound[], tableId = "bac-bo", date = brasiliaDateKey()) {
    let snapshot = DailySurfMaxEngine.empty(tableId, date);
    for (const round of rounds.slice().sort(compareDailySurfRounds)) {
      if (round.date_br !== date) continue;
      snapshot = DailySurfMaxEngine.processRound(snapshot, round);
    }
    return snapshot;
  }

  static normalizeRounds(
    rounds: DailySurfRoundSource[],
    options: { tableId?: string; fallbackTimestamp?: string | null } = {},
  ) {
    return rounds
      .map((round) => normalizeRound(round, options))
      .filter((round): round is DailySurfRound => Boolean(round))
      .sort(compareDailySurfRounds);
  }

  static todayKey(timestamp?: string | Date) {
    return brasiliaDateKey(timestamp);
  }

  static msUntilNextDay(timestamp?: string | Date) {
    return msUntilNextBrasiliaDay(timestamp);
  }

  static applyDailySurfMemoryToAlert(alert: SurfAlert, memory: DailySurfMemory): SurfAlert {
    return applyDailySurfMemoryToAlert(alert, memory);
  }
}

export function compareDailySurfRounds(left: DailySurfRound, right: DailySurfRound) {
  const dateCompare = left.date_br.localeCompare(right.date_br);
  if (dateCompare) return dateCompare;
  const orderCompare = left.order - right.order;
  if (orderCompare) return orderCompare;
  const timeCompare = left.round_time.localeCompare(right.round_time);
  if (timeCompare) return timeCompare;
  return left.round_id.localeCompare(right.round_id);
}

function normalizeRound(
  round: DailySurfRoundSource,
  options: { tableId?: string; fallbackTimestamp?: string | null },
): DailySurfRound | null {
  const result = mapResult(round.result);
  if (!result) return null;

  const timestamp =
    validIsoDate(round.sourceUpdatedAt) ? round.sourceUpdatedAt :
    validIsoDate(round.capturedAt) ? round.capturedAt :
    validIsoDate(options.fallbackTimestamp) ? options.fallbackTimestamp :
    new Date().toISOString();

  const date = normalizeDayKey(round.day) ?? brasiliaDateKey(timestamp);

  return {
    round_id: `${round.id}:${round.time}:${round.result}:${round.bankerScore}:${round.playerScore}`,
    result,
    round_time: timestamp,
    table_id: options.tableId ?? "bac-bo",
    date_br: date,
    order: Number.isFinite(round.id) ? round.id : Date.parse(timestamp),
  };
}

function mapResult(result: RoundResult): DailySurfSide | null {
  if (result === "B") return "BANKER";
  if (result === "P") return "PLAYER";
  if (result === "T") return "TIE";
  return null;
}

function cloneSnapshot(snapshot: DailySurfMaxSnapshot): DailySurfMaxSnapshot {
  return {
    currentStreak: { ...snapshot.currentStreak },
    dailyMaxSurf: { ...snapshot.dailyMaxSurf },
    dailySurfMemory: { ...snapshot.dailySurfMemory },
  };
}

function normalizeSnapshot(snapshot: DailySurfMaxSnapshot, tableId: string): DailySurfMaxSnapshot {
  const today = brasiliaDateKey();
  if (snapshot.dailyMaxSurf.date !== today || snapshot.dailyMaxSurf.table_id !== tableId) {
    return DailySurfMaxEngine.empty(tableId, today);
  }
  return {
    ...snapshot,
    dailySurfMemory: normalizeDailySurfMemory(snapshot.dailySurfMemory, today),
  };
}

function emptyDailySurfMemory(dateKey: string): DailySurfMemory {
  return {
    dateKey,
    playerDrops3Plus: 0,
    bankerDrops3Plus: 0,
    playerMaxDepth: 0,
    bankerMaxDepth: 0,
    totalDrops3Plus: 0,
    dominantSide: null,
    dominantPercent: 0,
    recoverySide: null,
    stretchedSide: null,
    currentDropSide: null,
    currentDropDepth: 0,
    surfBias: null,
    surfStatus: "SEM_SURF",
    confidence: 0,
    reason: "Sem memoria diaria suficiente para Surf.",
    playerMaxDeficit: 0,
    bankerMaxDeficit: 0,
    recentResults: [],
    recentTieCount: 0,
    recentAlternationRate: 0,
    recentPressureSide: null,
    recentPressurePercent: 0,
    lastBreakSide: null,
    lastBreakDepth: 0,
  };
}

function normalizeDailySurfMemory(memory: DailySurfMemory | undefined, dateKey: string) {
  if (!isDailySurfMemory(memory) || memory.dateKey !== dateKey) return emptyDailySurfMemory(dateKey);
  return {
    ...emptyDailySurfMemory(dateKey),
    ...memory,
  };
}

export function calculateDailySurfMemory(
  previous: DailySurfMemory | undefined,
  round: DailySurfRound | DailySurfMaxSnapshot["currentStreak"],
): DailySurfMemory {
  const memoryDateKey = "date_br" in round ? round.date_br : previous?.dateKey ?? brasiliaDateKey();
  const base = normalizeDailySurfMemory(previous, memoryDateKey);
  const next: DailySurfMemory = { ...base, recoverySide: null, stretchedSide: null };
  const result = "result" in round ? round.result : round.side;
  const recent = buildRecentSurfContext([...base.recentResults, result].slice(-12));

  next.recentResults = recent.results;
  next.recentTieCount = recent.tieCount;
  next.recentAlternationRate = recent.alternationRate;
  next.recentPressureSide = recent.pressureSide;
  next.recentPressurePercent = recent.pressurePercent;

  if (result === "TIE" || result === null) {
    if (base.currentDropSide && base.currentDropDepth >= 5) {
      next.stretchedSide = base.currentDropSide;
    }
    const decision = decideDailySurfMemory(next);
    return {
      ...next,
      ...decision,
    };
  }

  const currentSide = result;
  const previousSide = base.currentDropSide;
  const previousDepth = base.currentDropDepth;
  const currentDropDepth = previousSide === currentSide ? previousDepth + 1 : 1;

  next.currentDropSide = currentSide;
  next.currentDropDepth = currentDropDepth;

  if (previousSide && previousSide !== currentSide && previousDepth >= 3) {
    next.lastBreakSide = previousSide;
    next.lastBreakDepth = previousDepth;
  }

  if (currentSide === "PLAYER") {
    if (currentDropDepth === 3) next.playerDrops3Plus += 1;
    next.playerMaxDepth = Math.max(next.playerMaxDepth, currentDropDepth);
  }

  if (currentSide === "BANKER") {
    if (currentDropDepth === 3) next.bankerDrops3Plus += 1;
    next.bankerMaxDepth = Math.max(next.bankerMaxDepth, currentDropDepth);
  }

  next.totalDrops3Plus = next.playerDrops3Plus + next.bankerDrops3Plus;
  const playerDeficit = Math.max(0, next.bankerDrops3Plus - next.playerDrops3Plus);
  const bankerDeficit = Math.max(0, next.playerDrops3Plus - next.bankerDrops3Plus);
  next.playerMaxDeficit = Math.max(next.playerMaxDeficit, playerDeficit);
  next.bankerMaxDeficit = Math.max(next.bankerMaxDeficit, bankerDeficit);

  const leading = leadingDropSide(next);
  next.dominantSide = leading.side;
  next.dominantPercent = leading.percent;

  if (next.playerMaxDeficit >= 3 && playerDeficit >= 1 && playerDeficit <= 2) {
    next.recoverySide = "PLAYER";
  }
  if (next.bankerMaxDeficit >= 3 && bankerDeficit >= 1 && bankerDeficit <= 2) {
    next.recoverySide = "BANKER";
  }

  if (currentSide && currentDropDepth >= 5) {
    next.stretchedSide = currentSide;
  }

  const decision = decideDailySurfMemory(next);
  return {
    ...next,
    ...decision,
  };
}

function leadingDropSide(memory: DailySurfMemory) {
  const total = memory.playerDrops3Plus + memory.bankerDrops3Plus;
  if (!total) return { side: null as DailySurfMemorySide | null, percent: 0 };
  if (memory.playerDrops3Plus === memory.bankerDrops3Plus) {
    return { side: null as DailySurfMemorySide | null, percent: 50 };
  }

  const side = memory.playerDrops3Plus > memory.bankerDrops3Plus ? "PLAYER" : "BANKER";
  const count = side === "PLAYER" ? memory.playerDrops3Plus : memory.bankerDrops3Plus;
  return { side, percent: clampPercent((count / total) * 100) };
}

function buildRecentSurfContext(results: DailySurfSide[]) {
  const sideResults = results.filter((result): result is DailySurfMemorySide =>
    result === "BANKER" || result === "PLAYER",
  );
  const tieCount = results.filter((result) => result === "TIE").length;
  const playerCount = sideResults.filter((result) => result === "PLAYER").length;
  const bankerCount = sideResults.filter((result) => result === "BANKER").length;
  const totalSides = playerCount + bankerCount;
  const pressureSide =
    totalSides === 0 || playerCount === bankerCount
      ? null
      : playerCount > bankerCount
        ? "PLAYER"
        : "BANKER";
  const pressureCount =
    pressureSide === "PLAYER" ? playerCount : pressureSide === "BANKER" ? bankerCount : 0;
  const alternations = sideResults.reduce((count, result, index) => {
    if (index === 0) return count;
    return sideResults[index - 1] !== result ? count + 1 : count;
  }, 0);

  return {
    results,
    tieCount,
    alternationRate:
      sideResults.length <= 1 ? 0 : clampPercent((alternations / (sideResults.length - 1)) * 100),
    pressureSide: pressureSide as DailySurfMemorySide | null,
    pressurePercent: totalSides ? clampPercent((pressureCount / totalSides) * 100) : 0,
  };
}

function decideDailySurfMemory(memory: DailySurfMemory): Pick<
  DailySurfMemory,
  "surfStatus" | "surfBias" | "confidence" | "reason"
> {
  const dominantCount = memory.dominantSide === "PLAYER"
    ? memory.playerDrops3Plus
    : memory.dominantSide === "BANKER"
      ? memory.bankerDrops3Plus
      : 0;
  const tiePressure = memory.recentTieCount >= 2 || memory.recentResults.at(-1) === "TIE";
  const noisyRoad = memory.recentAlternationRate >= 55;
  const recentAgainstCurrent =
    Boolean(memory.recentPressureSide) &&
    Boolean(memory.currentDropSide) &&
    memory.recentPressureSide !== memory.currentDropSide &&
    memory.recentPressurePercent >= 60;
  const riskBreak =
    Boolean(memory.stretchedSide) &&
    (memory.currentDropDepth >= 6 ||
      tiePressure ||
      noisyRoad ||
      recentAgainstCurrent ||
      Boolean(memory.dominantSide && memory.currentDropSide && memory.dominantSide !== memory.currentDropSide) ||
      Boolean(memory.recoverySide && memory.currentDropSide && memory.recoverySide !== memory.currentDropSide));

  if (riskBreak) {
    return {
      surfStatus: "RISCO_QUEBRA",
      surfBias: null,
      confidence: 25,
      reason: `${memory.currentDropSide} esticado em ${memory.currentDropDepth} casas com sinal de perda de pressao.`,
    };
  }

  if (memory.stretchedSide) {
    return {
      surfStatus: "SURF_ESTICADO",
      surfBias: null,
      confidence: 45,
      reason: `${memory.stretchedSide} esta esticado em ${memory.currentDropDepth} casas. Nao fortalecer entrada atrasada.`,
    };
  }

  if (memory.recoverySide) {
    return {
      surfStatus: "RECUPERACAO_SURF",
      surfBias: memory.recoverySide,
      confidence: clampPercent(70 + Math.min(12, memory.totalDrops3Plus * 2)),
      reason: `${memory.recoverySide} estava atras e encostou na memoria diaria de descidas 3+.`,
    };
  }

  if (memory.dominantSide && dominantCount >= 4 && memory.dominantPercent >= 70) {
    return {
      surfStatus: "SURF_DOMINANTE",
      surfBias: memory.dominantSide,
      confidence: clampPercent(82 + Math.min(12, dominantCount * 2)),
      reason: `${memory.dominantSide} domina ${memory.dominantPercent}% das descidas longas do dia.`,
    };
  }

  if (memory.dominantSide && dominantCount >= 3 && memory.dominantPercent >= 60) {
    return {
      surfStatus: "SURF_AGRESSIVO",
      surfBias: memory.dominantSide,
      confidence: clampPercent(74 + Math.min(10, dominantCount * 2)),
      reason: `${memory.dominantSide} tem ${dominantCount} descidas 3+ e ${memory.dominantPercent}% do dia.`,
    };
  }

  if (memory.dominantSide && dominantCount >= 2) {
    return {
      surfStatus: "PRE_SURF",
      surfBias: memory.dominantSide,
      confidence: clampPercent(58 + Math.min(12, dominantCount * 4)),
      reason: `${memory.dominantSide} ja tem ${dominantCount} descidas 3+ no dia.`,
    };
  }

  if (
    memory.lastBreakSide &&
    memory.currentDropSide &&
    memory.currentDropSide !== memory.lastBreakSide &&
    memory.currentDropDepth >= 2
  ) {
    return {
      surfStatus: "VIRADA_SURF",
      surfBias: memory.currentDropSide,
      confidence: clampPercent(62 + Math.min(18, memory.currentDropDepth * 5)),
      reason: `${memory.currentDropSide} virou apos quebra de coluna ${memory.lastBreakSide} com ${memory.lastBreakDepth} casas.`,
    };
  }

  if (
    memory.dominantSide &&
    memory.recentPressureSide &&
    memory.recentPressureSide !== memory.dominantSide &&
    memory.recentPressurePercent >= 65 &&
    memory.currentDropSide === memory.recentPressureSide &&
    memory.currentDropDepth >= 2
  ) {
    return {
      surfStatus: "VIRADA_SURF",
      surfBias: memory.recentPressureSide,
      confidence: clampPercent(58 + Math.min(18, memory.recentPressurePercent - 55)),
      reason: `${memory.recentPressureSide} virou a pressao recente contra o dominante do dia.`,
    };
  }

  return {
    surfStatus: "SEM_SURF",
    surfBias: null,
    confidence: 0,
    reason: "Sem memoria diaria suficiente para Surf.",
  };
}

function applyDailySurfMemoryToAlert(alert: SurfAlert, memory: DailySurfMemory): SurfAlert {
  if (memory.surfStatus === "SEM_SURF" || memory.totalDrops3Plus === 0) return alert;

  const currentSide = alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert.surf_side;
  const actionable = isActionableMemory(memory);
  const memorySide: SurfSide = memory.surfBias ?? "NONE";
  const sideAligned = memory.surfBias && currentSide === memory.surfBias;
  const sideDiverged =
    memory.surfBias &&
    (currentSide === "BANKER" || currentSide === "PLAYER") &&
    currentSide !== memory.surfBias;

  const memoryConfidence = sideAligned
    ? clampPercent(memory.confidence + 6)
    : sideDiverged
      ? clampPercent(memory.confidence - 12)
      : memory.confidence;
  const panels = evaluateSurfPanels(alert);
  const panelConfidenceDelta =
    panels.state === "CONFIRMADO" ? 6 : panels.state === "DIVERGENTE" ? -10 : panels.state === "SUJO" ? -14 : 0;
  const contextRiskFloor = Math.max(
    memory.recentTieCount >= 2 ? 48 : 0,
    memory.recentAlternationRate >= 55 ? 52 : 0,
    panels.riskFloor,
  );
  const riskFloor = Math.max(
    memory.surfStatus === "RISCO_QUEBRA" ? 78 : memory.surfStatus === "SURF_ESTICADO" ? 62 : 0,
    memory.surfStatus === "VIRADA_SURF" ? 42 : 0,
    contextRiskFloor,
  );
  const adjustedMemoryConfidence = clampPercent(memoryConfidence + panelConfidenceDelta);
  const confidence = actionable
    ? Math.max(clampPercent(alert.surf_confidence), adjustedMemoryConfidence)
    : Math.min(clampPercent(alert.surf_confidence), adjustedMemoryConfidence);
  const breakRisk = Math.max(clampPercent(alert.surf_break_risk ?? alert.surf_risk), riskFloor);

  return {
    ...alert,
    surf_alert: actionable,
    surf_phase: memoryStatusToSurfPhase(memory.surfStatus),
    surf_side: actionable ? memorySide : "NONE",
    surf_status: memory.surfStatus,
    surf_risk: breakRisk,
    surf_break_risk: breakRisk,
    surf_confidence: confidence,
    stretched_count: memory.currentDropDepth || alert.stretched_count,
    reason: `${memory.reason} ${panels.reason} ${alert.reason ?? ""}`.trim(),
    surf_prediction_side: actionable ? memorySide : "NONE",
    surf_prediction_status: actionable ? "ACTIVE" : alert.surf_prediction_status,
    surf_prediction_confidence: confidence,
    surf_prediction_window: memory.currentDropDepth || alert.surf_prediction_window,
  };
}

function isActionableMemory(memory: DailySurfMemory) {
  return Boolean(
    memory.surfBias &&
      ["PRE_SURF", "SURF_AGRESSIVO", "SURF_DOMINANTE", "RECUPERACAO_SURF", "VIRADA_SURF"].includes(
        memory.surfStatus,
      ),
  );
}

function memoryStatusToSurfPhase(status: DailySurfMemoryStatus): SurfPhase {
  if (status === "PRE_SURF") return "PRE_SURF";
  if (status === "SURF_AGRESSIVO") return "SURF_FORTE";
  if (status === "SURF_DOMINANTE") return "SURF_EXTREMO";
  if (status === "RECUPERACAO_SURF") return "RETOMADA_MESMA_COR";
  if (status === "SURF_ESTICADO") return "EXAUSTAO";
  if (status === "RISCO_QUEBRA") return "RISCO_QUEBRA";
  if (status === "VIRADA_SURF") return "VIRADA_OUTRO_LADO";
  return "SEM_RISCO";
}

function evaluateSurfPanels(alert: SurfAlert) {
  const text = [
    alert.panels?.big_road,
    alert.panels?.big_eye_boy,
    alert.panels?.small_road,
    alert.panels?.cockroach_pig,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const hasNoDivergence = text.includes("sem divergencia");
  const hasNoReversal = text.includes("sem reversao");
  const positive =
    text.includes("continuidade") ||
    text.includes("sustentada") ||
    text.includes("saudavel") ||
    text.includes("favoravel") ||
    text.includes("controlada") ||
    hasNoDivergence ||
    hasNoReversal;
  const divergent =
    (!hasNoDivergence && text.includes("divergencia forte")) ||
    (!hasNoReversal && text.includes("reversao tardia")) ||
    text.includes("virada") ||
    text.includes("quebra");
  const dirty =
    (!text.includes("alternancia controlada") && text.includes("alternancia")) ||
    text.includes("sem continuidade") ||
    text.includes("sujeira") ||
    text.includes("instavel");

  if (divergent) {
    return { state: "DIVERGENTE" as const, riskFloor: 62, reason: "Paineis derivados divergentes." };
  }
  if (dirty) {
    return { state: "SUJO" as const, riskFloor: 55, reason: "Paineis derivados indicam mesa suja." };
  }
  if (positive) {
    return { state: "CONFIRMADO" as const, riskFloor: 0, reason: "Paineis derivados confirmam estabilidade." };
  }
  return { state: "NEUTRO" as const, riskFloor: 0, reason: "" };
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isDailySurfMaxSnapshot(value: unknown): value is DailySurfMaxSnapshot {
  const snapshot = value as Partial<DailySurfMaxSnapshot>;
  return (
    Boolean(snapshot) &&
    typeof snapshot === "object" &&
    typeof snapshot.currentStreak?.count === "number" &&
    (snapshot.currentStreak.side === "BANKER" ||
      snapshot.currentStreak.side === "PLAYER" ||
      snapshot.currentStreak.side === "TIE" ||
      snapshot.currentStreak.side === null) &&
    typeof snapshot.dailyMaxSurf?.banker === "number" &&
    typeof snapshot.dailyMaxSurf?.player === "number" &&
    typeof snapshot.dailyMaxSurf?.tie === "number" &&
    typeof snapshot.dailyMaxSurf?.date === "string" &&
    typeof snapshot.dailyMaxSurf?.table_id === "string"
  );
}

function isDailySurfMemory(value: unknown): value is DailySurfMemory {
  const memory = value as Partial<DailySurfMemory>;
  return (
    Boolean(memory) &&
    typeof memory === "object" &&
    typeof memory.dateKey === "string" &&
    typeof memory.playerDrops3Plus === "number" &&
    typeof memory.bankerDrops3Plus === "number" &&
    typeof memory.playerMaxDepth === "number" &&
    typeof memory.bankerMaxDepth === "number" &&
    typeof memory.totalDrops3Plus === "number" &&
    typeof memory.dominantPercent === "number" &&
    typeof memory.currentDropDepth === "number" &&
    typeof memory.confidence === "number" &&
    typeof memory.reason === "string"
  );
}

function storageKey(tableId: string, scope: string) {
  return `${DAILY_SURF_STORAGE_KEY}:${scope}:${tableId}`;
}

function normalizeDayKey(value: unknown) {
  if (typeof value !== "string") return null;
  const isoDateOnly = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateOnly) return isoDateOnly[1];
  return validIsoDate(value) ? brasiliaDateKey(value) : null;
}

function brasiliaDateKey(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function msUntilNextBrasiliaDay(value: string | Date = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  const safeDate = Number.isFinite(date.getTime()) ? date : new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(safeDate);
  const numberPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  const hour = numberPart("hour");
  const minute = numberPart("minute");
  const second = numberPart("second");
  const remainingSeconds = (23 - hour) * 60 * 60 + (59 - minute) * 60 + (60 - second);
  const remainingMs = remainingSeconds * 1000 - safeDate.getMilliseconds() + 500;
  return Math.max(1000, Math.min(86_401_000, remainingMs));
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
