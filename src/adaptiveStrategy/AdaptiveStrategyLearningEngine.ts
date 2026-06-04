import type {
  AdaptiveDecisionLog,
  AdaptiveEntryScore,
  AdaptivePattern,
  AdaptivePatternKind,
  AdaptiveRanking,
  AdaptiveRoundRecord,
  AdaptiveSide,
  AdaptiveStrategySnapshot,
  AdaptiveSyncStatus,
} from "@/types/adaptiveStrategy";
import type { DashboardData, SignalSide } from "@/types/dashboard";

const MIN_OCCURRENCES = 30;
const MIN_ASSERTIVENESS = 65;
const TOP_LIMIT = 8;
const DEFAULT_SYNC_STATUS: AdaptiveSyncStatus = {
  mode: "local",
  lastSyncedAt: null,
  message: "Historico local ativo. Aguardando sincronizacao do banco.",
};

type PatternHit = {
  index: number;
  next: AdaptiveSide | null;
  g1: AdaptiveSide | null;
  timestamp: string;
};

type PatternBucket = {
  id: string;
  label: string;
  kind: AdaptivePatternKind;
  tableName: string;
  hour: string | null;
  hits: PatternHit[];
};

export function analyzeAdaptiveStrategy(
  records: AdaptiveRoundRecord[],
  data: DashboardData,
  syncStatus: AdaptiveSyncStatus = DEFAULT_SYNC_STATUS,
): AdaptiveStrategySnapshot {
  const generatedAt = new Date().toISOString();
  const ordered = records
    .filter((record) => record.result === "BANKER" || record.result === "PLAYER" || record.result === "TIE")
    .sort(compareRecords);
  const buckets = minePatternBuckets(ordered);
  const patterns = Array.from(buckets.values())
    .map((bucket) => buildPattern(bucket))
    .sort(comparePatterns);
  const ranking = buildRanking(patterns);
  const entryScore = buildEntryScore(patterns, ordered, data);
  const decisionLogs = buildDecisionLogs(patterns, ordered, entryScore, generatedAt);

  return {
    generatedAt,
    recordsStored: ordered.length,
    patternsFound: patterns.length,
    hotPatterns: patterns.filter((pattern) => pattern.status === "quente").length,
    pausedPatterns: patterns.filter((pattern) => pattern.status === "pausado").length,
    coldPatterns: patterns.filter((pattern) => pattern.status === "frio").length,
    observingPatterns: patterns.filter((pattern) => pattern.status === "observacao").length,
    minOccurrences: MIN_OCCURRENCES,
    minAssertiveness: MIN_ASSERTIVENESS,
    syncStatus,
    patterns,
    ranking,
    entryScore,
    decisionLogs,
  };
}

function minePatternBuckets(records: AdaptiveRoundRecord[]) {
  const buckets = new Map<string, PatternBucket>();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const next = records[index + 1]?.result ?? record.nextResult ?? null;
    const g1 = records[index + 2]?.result ?? null;
    const hit: PatternHit = { index, next, g1, timestamp: record.timestamp };

    for (const size of [2, 3, 4] as const) {
      if (index + 1 >= size) {
        const slice = records.slice(index + 1 - size, index + 1);
        addBucket(buckets, {
          kind: `sequence_${size}`,
          tableName: record.tableName,
          hour: null,
          label: slice.map(roundToken).join("-"),
          hit,
        });
      }
    }

    addBucket(buckets, {
      kind: "score",
      tableName: record.tableName,
      hour: null,
      label: `${sideLabel(record.result)} ${record.bankerScore}x${record.playerScore}`,
      hit,
    });

    if (records[index - 1]?.result === "TIE" || record.result === "TIE") {
      addBucket(buckets, {
        kind: "post_tie",
        tableName: record.tableName,
        hour: null,
        label: `Pos-Tie ${records[index - 1] ? roundToken(records[index - 1]) : "inicio"}>${roundToken(record)}`,
        hit,
      });
    }

    const payingNumber = paidNumber(record);
    if (payingNumber !== null) {
      addBucket(buckets, {
        kind: "paying_number",
        tableName: record.tableName,
        hour: null,
        label: `Número pagante ${payingNumber} ${sideLabel(record.result)}`,
        hit,
      });
    }

    const hour = hourLabel(record);
    if (hour) {
      addBucket(buckets, {
        kind: "hour",
        tableName: record.tableName,
        hour,
        label: `${hour}:00 ${sideLabel(record.result)}`,
        hit,
      });
    }

    const previous = records.slice(Math.max(0, index - 1), index + 1).map((item) => item.result[0]).join("-");
    addBucket(buckets, {
      kind: "table",
      tableName: record.tableName,
      hour: null,
      label: `${record.tableName} ${previous || sideLabel(record.result)}`,
      hit,
    });
  }

  return buckets;
}

function addBucket(
  buckets: Map<string, PatternBucket>,
  input: {
    kind: AdaptivePatternKind;
    tableName: string;
    hour: string | null;
    label: string;
    hit: PatternHit;
  },
) {
  const id = stablePatternId(input.kind, input.tableName, input.hour, input.label);
  const existing =
    buckets.get(id) ??
    {
      id,
      label: input.label,
      kind: input.kind,
      tableName: input.tableName,
      hour: input.hour,
      hits: [],
    };
  existing.hits.push(input.hit);
  buckets.set(id, existing);
}

function buildPattern(bucket: PatternBucket): AdaptivePattern {
  const pulledBanker = bucket.hits.filter((hit) => hit.next === "BANKER").length;
  const pulledPlayer = bucket.hits.filter((hit) => hit.next === "PLAYER").length;
  const pulledTie = bucket.hits.filter((hit) => hit.next === "TIE").length;
  const direction = bestDirection(pulledBanker, pulledPlayer, pulledTie);
  const outcomes = bucket.hits.map((hit) => classifyHit(hit, direction));
  const sg = outcomes.filter((outcome) => outcome === "sg").length;
  const g1 = outcomes.filter((outcome) => outcome === "g1").length;
  const red = outcomes.filter((outcome) => outcome === "red").length;
  const expired = outcomes.filter((outcome) => outcome === "expired").length;
  const validated = sg + g1 + red;
  const assertiveness = percent(sg + g1, validated);
  const assertivenessSg = percent(sg, validated);
  const assertivenessG1 = percent(g1, validated);
  const greenRedSequence = currentGreenRedSequence(outcomes);
  const sampleWeak = bucket.hits.length < MIN_OCCURRENCES;
  const recentRedStreak = greenRedSequence.type === "red" ? greenRedSequence.count : 0;
  const tooManyRecentReds = recentRedStreak >= 3;
  const belowAssertiveness = validated > 0 && assertiveness < MIN_ASSERTIVENESS;
  const score = Math.round((sg * 2 + g1 - red * 2 - expired * 0.5) * 10) / 10;
  const blocked = sampleWeak || belowAssertiveness || tooManyRecentReds;
  const pausedReason = tooManyRecentReds
    ? "Sequência ruim recente: 3 ou mais REDs no padrão."
    : belowAssertiveness
      ? "Assertividade real abaixo de 65%."
      : sampleWeak
        ? "Amostra abaixo de 30 ocorrências."
        : null;
  const status = tooManyRecentReds
    ? "pausado"
    : sampleWeak || belowAssertiveness
      ? "frio"
      : assertiveness >= 75 && score > 0
        ? "quente"
        : "observacao";

  return {
    id: bucket.id,
    label: bucket.label,
    kind: bucket.kind,
    tableName: bucket.tableName,
    hour: bucket.hour,
    direction,
    occurrences: bucket.hits.length,
    pulledPlayer,
    pulledBanker,
    pulledTie,
    sg,
    g1,
    red,
    expired,
    assertiveness,
    assertivenessSg,
    assertivenessG1,
    lastSeenAt: bucket.hits.at(-1)?.timestamp ?? null,
    greenRedSequence,
    status,
    score,
    sampleWeak,
    blocked,
    pausedReason,
  };
}

function classifyHit(hit: PatternHit, direction: AdaptiveSide) {
  if (!hit.next) return "expired";
  if (hit.next === direction) return "sg";
  if (!hit.g1) return "expired";
  if (hit.g1 === direction) return "g1";
  return "red";
}

function currentGreenRedSequence(outcomes: string[]) {
  const validated = outcomes.filter((outcome) => outcome !== "expired");
  const last = validated.at(-1);
  if (!last) return { type: "none" as const, count: 0 };
  const type = last === "red" ? "red" : "green";
  let count = 0;
  for (let index = validated.length - 1; index >= 0; index -= 1) {
    const currentType = validated[index] === "red" ? "red" : "green";
    if (currentType !== type) break;
    count += 1;
  }
  return { type, count };
}

function bestDirection(banker: number, player: number, tie: number): AdaptiveSide {
  if (tie > banker && tie > player) return "TIE";
  return banker >= player ? "BANKER" : "PLAYER";
}

function buildRanking(patterns: AdaptivePattern[]): AdaptiveRanking {
  return {
    banker: top(patterns.filter((pattern) => pattern.direction === "BANKER")),
    player: top(patterns.filter((pattern) => pattern.direction === "PLAYER")),
    tie: top(patterns.filter((pattern) => pattern.direction === "TIE")),
    byTable: top(patterns.filter((pattern) => pattern.kind === "table")),
    byHour: top(patterns.filter((pattern) => pattern.kind === "hour")),
  };
}

function buildEntryScore(
  patterns: AdaptivePattern[],
  records: AdaptiveRoundRecord[],
  data: DashboardData,
): AdaptiveEntryScore {
  const candidate =
    patterns.find((pattern) => !pattern.blocked && pattern.status === "quente") ??
    patterns.find((pattern) => !pattern.blocked && pattern.status === "observacao") ??
    patterns[0];
  const side = candidate?.direction ?? null;

  if (!candidate || !side) {
    return {
      side: null,
      finalScore: 0,
      allowed: false,
      parts: [],
      explanation: ["Sem padrão real suficiente para confirmar entrada."],
    };
  }

  const neuralSide = normalizeModuleSide(data.neuralReading?.direcao ?? data.neuralReading?.origem);
  const surfSide = normalizeModuleSide(
    data.currentSurfAlert?.surf_prediction_side ?? data.currentSurfAlert?.surf_side,
  );
  const trendSide = trendFromLastRounds(records.slice(-30));
  const exhaustionRisk = hasExhaustionRisk(records, side, candidate, data);
  const marketTurnAgainst = isMarketTurnAgainst(records, side);
  const strategyPoints = !candidate.blocked && candidate.assertiveness >= MIN_ASSERTIVENESS ? 25 : 0;

  const parts = [
    {
      label: "Neural Pagante",
      value: neuralSide === side ? 20 : 0,
      reason: neuralSide === side ? `Favorece ${sideLabel(side)}.` : "Sem confirmação a favor.",
    },
    {
      label: "Surf Analyzer",
      value: surfSide === side ? 25 : 0,
      reason: surfSide === side ? `Surf aponta ${sideLabel(side)}.` : "Sem surf alinhado.",
    },
    {
      label: "Tendência",
      value: trendSide === side ? 20 : 0,
      reason: trendSide === side ? "Últimas 30 rodadas confirmam lado." : "Tendência sem alinhamento.",
    },
    {
      label: "Banco de Estratégias",
      value: strategyPoints,
      reason: strategyPoints
        ? `Padrão ${candidate.label} aprovado pela amostra.`
        : "Padrão bloqueado pela proteção estatística.",
    },
    {
      label: "Risco de Exaustão",
      value: exhaustionRisk ? -15 : 0,
      reason: exhaustionRisk ? "Exaustão ou sequência ruim detectada." : "Risco controlado.",
    },
    {
      label: "Market Turn contra",
      value: marketTurnAgainst ? -20 : 0,
      reason: marketTurnAgainst ? "Janela curta virou contra a entrada." : "Sem virada contra.",
    },
  ];
  const finalScore = clamp(parts.reduce((total, part) => total + part.value, 0), 0, 100);
  const allowed = finalScore > 75 && !candidate.blocked && candidate.status !== "pausado";

  return {
    side,
    finalScore,
    allowed,
    parts,
    explanation: [
      `Entrada ${allowed ? "confirmada" : "bloqueada"} em ${sideLabel(side)}.`,
      `Padrão ${candidate.label} apareceu ${candidate.occurrences} vezes e puxou ${sideLabel(
        side,
      )} em ${candidate.assertiveness.toFixed(2)}%.`,
      neuralSide === side ? "Neural Pagante favorece a mesma direção." : "Neural Pagante não confirmou.",
      surfSide === side ? "Surf ativo para a mesma direção." : "Surf não confirmou.",
      trendSide === side ? "Tendência das últimas 30 rodadas confirma." : "Tendência não confirmou.",
      exhaustionRisk ? "Risco de exaustão reduziu o score." : "Risco controlado.",
    ],
  };
}

function buildDecisionLogs(
  patterns: AdaptivePattern[],
  records: AdaptiveRoundRecord[],
  entryScore: AdaptiveEntryScore,
  timestamp: string,
): AdaptiveDecisionLog[] {
  const logs: AdaptiveDecisionLog[] = [
    {
      id: `records-${timestamp}`,
      timestamp,
      message: `${records.length} rodadas reais processadas no Adaptive Strategy Learning Engine.`,
      score: entryScore.finalScore,
    },
    {
      id: `score-${timestamp}`,
      timestamp,
      message: `Score final ${entryScore.finalScore}/100. Entrada ${
        entryScore.allowed ? "liberada" : "bloqueada"
      }.`,
      score: entryScore.finalScore,
    },
  ];

  for (const pattern of patterns.slice(0, 18)) {
    if (pattern.blocked) {
      logs.push({
        id: `${pattern.id}-${timestamp}`,
        timestamp,
        patternId: pattern.id,
        status: pattern.status,
        score: pattern.score,
        message: `${pattern.label}: ${pattern.pausedReason ?? "bloqueado pela proteção estatística"}`,
      });
    }
  }

  return logs.slice(0, 24);
}

function top(patterns: AdaptivePattern[]) {
  return patterns.sort(comparePatterns).slice(0, TOP_LIMIT);
}

function comparePatterns(a: AdaptivePattern, b: AdaptivePattern) {
  const statusWeight = statusScore(b.status) - statusScore(a.status);
  if (statusWeight) return statusWeight;
  const blockedWeight = Number(a.blocked) - Number(b.blocked);
  if (blockedWeight) return blockedWeight;
  const assertivenessWeight = b.assertiveness - a.assertiveness;
  if (assertivenessWeight) return assertivenessWeight;
  const occurrenceWeight = b.occurrences - a.occurrences;
  if (occurrenceWeight) return occurrenceWeight;
  return b.score - a.score;
}

function statusScore(status: AdaptivePattern["status"]) {
  if (status === "quente") return 4;
  if (status === "observacao") return 3;
  if (status === "pausado") return 2;
  return 1;
}

function trendFromLastRounds(records: AdaptiveRoundRecord[]): AdaptiveSide | null {
  const banker = records.filter((record) => record.result === "BANKER").length;
  const player = records.filter((record) => record.result === "PLAYER").length;
  const tie = records.filter((record) => record.result === "TIE").length;
  if (!records.length) return null;
  if (tie > banker && tie > player) return "TIE";
  return banker >= player ? "BANKER" : "PLAYER";
}

function hasExhaustionRisk(
  records: AdaptiveRoundRecord[],
  side: AdaptiveSide,
  pattern: AdaptivePattern,
  data: DashboardData,
) {
  if (data.neuralReading?.isSaturated || data.neuralReading?.isRedAlert) return true;
  if (pattern.greenRedSequence.type === "red" && pattern.greenRedSequence.count >= 2) return true;
  let streak = 0;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    if (records[index].result !== side) break;
    streak += 1;
  }
  return streak >= 5;
}

function isMarketTurnAgainst(records: AdaptiveRoundRecord[], side: AdaptiveSide) {
  const window = records.slice(-6);
  if (window.length < 6) return false;
  const opposite = side === "BANKER" ? "PLAYER" : side === "PLAYER" ? "BANKER" : null;
  if (!opposite) return false;
  return window.filter((record) => record.result === opposite).length >= 4;
}

function normalizeModuleSide(value: unknown): AdaptiveSide | null {
  const text = String(value || "").trim().toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return null;
}

function compareRecords(left: AdaptiveRoundRecord, right: AdaptiveRoundRecord) {
  const time = Date.parse(left.timestamp) - Date.parse(right.timestamp);
  if (time) return time;
  return left.roundId - right.roundId;
}

function roundToken(record: AdaptiveRoundRecord) {
  if (record.result === "BANKER") return `B${record.bankerScore}`;
  if (record.result === "PLAYER") return `P${record.playerScore}`;
  return `T${record.tieMultiplier ?? `${record.bankerScore}x${record.playerScore}`}`;
}

function paidNumber(record: AdaptiveRoundRecord) {
  if (record.result === "BANKER") return record.bankerScore;
  if (record.result === "PLAYER") return record.playerScore;
  if (record.result === "TIE") return record.tieMultiplier ?? record.bankerScore;
  return null;
}

function hourLabel(record: AdaptiveRoundRecord) {
  const time = record.time || record.timestamp;
  const match = time.match(/(\d{1,2}):/);
  if (match) return match[1].padStart(2, "0");
  const date = new Date(record.timestamp);
  return Number.isFinite(date.getTime()) ? String(date.getHours()).padStart(2, "0") : null;
}

function sideLabel(side: AdaptiveSide) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  return "Tie";
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 10000) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function stablePatternId(kind: string, tableName: string, hour: string | null, label: string) {
  return `${kind}:${tableName}:${hour ?? "all"}:${label}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function adaptiveSideFromRoundResult(result: "B" | "P" | "T"): AdaptiveSide {
  if (result === "B") return "BANKER";
  if (result === "P") return "PLAYER";
  return "TIE";
}

export function adaptiveSideToShort(side: AdaptiveSide | null) {
  if (side === "BANKER") return "B";
  if (side === "PLAYER") return "P";
  if (side === "TIE") return "T";
  return "-";
}

export function adaptiveSideToSignalSide(side: AdaptiveSide | null): SignalSide | null {
  if (side === "BANKER" || side === "PLAYER") return side;
  return null;
}
