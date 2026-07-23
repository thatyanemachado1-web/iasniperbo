export const LATERAL_RED_LIMIT = 2;
export const BAC_BO_ROAD_ROWS = 6;
export const HORIZONTAL_TIE_COLUMN_GAP = 4;
export const HORIZONTAL_TIE_ROUND_GAP = BAC_BO_ROAD_ROWS * HORIZONTAL_TIE_COLUMN_GAP;
export const HORIZONTAL_TIE_SOURCE_ROWS = [0, 1, 2, 3, 4, 5] as const;

export type LateralResolution = "SG" | "G1" | "TIE" | "RED";

export type LateralResolutionCounters = {
  sg: number;
  g1: number;
  ties: number;
  reds: number;
  samples: number;
};

export function isLateralPatternBlocked(reds: unknown) {
  const normalized = Number(reds);
  return Number.isFinite(normalized) && Math.max(0, Math.floor(normalized)) >= LATERAL_RED_LIMIT;
}

export function canOpenLateralEntry(greens: unknown, reds: unknown, minimumGreens = 2) {
  const normalizedGreens = Number(greens);
  const normalizedMinimum = Number(minimumGreens);
  const greenCount = Number.isFinite(normalizedGreens)
    ? Math.max(0, Math.floor(normalizedGreens))
    : 0;
  const requiredGreens = Number.isFinite(normalizedMinimum)
    ? Math.max(0, Math.floor(normalizedMinimum))
    : 0;
  return greenCount >= requiredGreens && !isLateralPatternBlocked(reds);
}

export function getTieLateralRiskState(reds: unknown) {
  return {
    dryTieRisk: isLateralPatternBlocked(reds),
    blocked: false as const,
  };
}

export function horizontalTieEntryIndexes(originPosition: unknown) {
  const normalized = Number(originPosition);
  if (!Number.isInteger(normalized) || normalized < 0) return null;
  const row = normalized % BAC_BO_ROAD_ROWS;
  if (!HORIZONTAL_TIE_SOURCE_ROWS.includes(row as (typeof HORIZONTAL_TIE_SOURCE_ROWS)[number])) {
    return null;
  }
  return {
    sg: normalized + HORIZONTAL_TIE_ROUND_GAP,
    g1: normalized + HORIZONTAL_TIE_ROUND_GAP + 1,
  };
}

export function isHorizontalTieFifthHouseProjection(
  originPosition: unknown,
  targetPosition: unknown,
) {
  const entry = horizontalTieEntryIndexes(originPosition);
  const target = Number(targetPosition);
  return Boolean(entry && Number.isInteger(target) && target === entry.sg);
}

export function isHorizontalTieRepeatProjection(originPosition: unknown, targetPosition: unknown) {
  const origin = Number(originPosition);
  const target = Number(targetPosition);
  if (!Number.isInteger(origin) || origin < 0 || !Number.isInteger(target)) return false;
  const distance = target - origin;
  return (
    distance >= HORIZONTAL_TIE_ROUND_GAP &&
    (distance - HORIZONTAL_TIE_ROUND_GAP) % BAC_BO_ROAD_ROWS === 0
  );
}

export function horizontalTieCampaignResolved(
  originPosition: unknown,
  targetPosition: unknown,
  sideAtPosition: (position: number) => unknown,
) {
  const origin = Number(originPosition);
  const target = Number(targetPosition);
  if (!isHorizontalTieRepeatProjection(origin, target)) return false;
  for (
    let sgPosition = origin + HORIZONTAL_TIE_ROUND_GAP;
    sgPosition < target;
    sgPosition += BAC_BO_ROAD_ROWS
  ) {
    if (
      String(sideAtPosition(sgPosition) ?? "").toUpperCase() === "TIE" ||
      String(sideAtPosition(sgPosition + 1) ?? "").toUpperCase() === "TIE"
    ) {
      return true;
    }
  }
  return false;
}

export function canProjectHorizontalTieCampaign(
  originPosition: unknown,
  targetPosition: unknown,
  sideAtPosition: (position: number) => unknown,
) {
  const origin = Number(originPosition);
  const target = Number(targetPosition);
  if (!isHorizontalTieRepeatProjection(origin, target)) return false;
  for (
    let sgPosition = origin + HORIZONTAL_TIE_ROUND_GAP;
    sgPosition < target;
    sgPosition += BAC_BO_ROAD_ROWS
  ) {
    const sgSide = String(sideAtPosition(sgPosition) ?? "").toUpperCase();
    const g1Side = String(sideAtPosition(sgPosition + 1) ?? "").toUpperCase();
    if (sgSide === "TIE" || g1Side === "TIE") return false;
    if (!sgSide || !g1Side) return false;
  }
  return true;
}

export function registerLateralResolution(
  counters: LateralResolutionCounters,
  outcome: LateralResolution,
): LateralResolutionCounters {
  if (isLateralPatternBlocked(counters.reds)) return counters;
  return {
    sg: counters.sg + (outcome === "SG" ? 1 : 0),
    g1: counters.g1 + (outcome === "G1" ? 1 : 0),
    ties: counters.ties + (outcome === "TIE" ? 1 : 0),
    reds: counters.reds + (outcome === "RED" ? 1 : 0),
    samples: counters.samples + 1,
  };
}

export type LateralBacBoSide = "BANKER" | "PLAYER" | "TIE";

export type LateralBacBoResult = {
  id: string;
  side: LateralBacBoSide;
  value: number;
  slot?: number;
  time?: string | null;
  tieMultiplier?: number | null;
};

export type LateralPayingOutcome = LateralResolution | "INCOMPLETE";

export type LateralPayingPattern = {
  key: string;
  triggerSide: LateralBacBoSide;
  triggerValue: number;
  target: LateralBacBoSide;
  sg: number;
  g1: number;
  ties: number;
  reds: number;
  samples: number;
};

export type LateralPayingReading = {
  pattern: LateralPayingPattern;
  attempt: "SG" | "G1";
  trigger: LateralBacBoResult;
};

export type LateralPayingEntryAnalysis = {
  confirmed: boolean;
  reason: "confirmed_entry" | "blocked_2_reds" | "no_qualified_pattern";
  signalKey: string;
  active: LateralPayingReading | null;
  blocked: LateralPayingReading | null;
  cycleSize: number;
};

export type LateralRoundMetadata = {
  id: string | number;
  time?: string | null;
  tieMultiplier?: number | null;
};

export type LateralPayingHistoryEntry = {
  id: string;
  resultId: string;
  outcome: Exclude<LateralPayingOutcome, "INCOMPLETE">;
  target: LateralBacBoSide;
  isTie: boolean;
  tieLabel?: string | null;
  time?: string | null;
};

/**
 * Pure implementation used by both the visual lateral card and Telegram V2.
 * The offsets intentionally mirror the six-row bead plate: SG is six results
 * to the right and G1 is the result immediately below SG when that row exists.
 */
export function buildLateralPayingPatterns(sourceResults: LateralBacBoResult[]) {
  const results = sourceResults.slice(-200);
  const patterns = new Map<string, LateralPayingPattern>();
  for (let index = 0; index < results.length; index += 1) {
    const trigger = results[index];
    const sg = results[index + BAC_BO_ROAD_ROWS];
    const g1 =
      index % BAC_BO_ROAD_ROWS < BAC_BO_ROAD_ROWS - 1
        ? results[index + BAC_BO_ROAD_ROWS + 1]
        : undefined;
    if (!sg) continue;
    for (const target of ["PLAYER", "BANKER", "TIE"] as LateralBacBoSide[]) {
      const outcome = resolveLateralPayingOutcome(target, sg, g1);
      if (outcome === "INCOMPLETE") continue;
      const key = `${trigger.value}:${trigger.side}:${target}`;
      const current = patterns.get(key) ?? {
        key,
        triggerSide: trigger.side,
        triggerValue: trigger.value,
        target,
        sg: 0,
        g1: 0,
        ties: 0,
        reds: 0,
        samples: 0,
      };
      const counters = registerLateralResolution(current, outcome);
      patterns.set(key, { ...current, ...counters });
    }
  }
  return [...patterns.values()];
}

export function resolveLateralPayingOutcome(
  target: LateralBacBoSide,
  sg: LateralBacBoResult,
  g1?: LateralBacBoResult,
): LateralPayingOutcome {
  if (sg.side === target) return "SG";
  if (target !== "TIE" && sg.side === "TIE") return "TIE";
  if (!g1) return "INCOMPLETE";
  if (g1.side === target) return "G1";
  if (target !== "TIE" && g1.side === "TIE") return "TIE";
  return "RED";
}

export function isQualifiedLateralPayingPattern(pattern: LateralPayingPattern) {
  return canOpenLateralEntry(pattern.sg + pattern.g1, pattern.reds);
}

export function findActiveLateralPayingReading(
  sourceResults: LateralBacBoResult[],
  patterns = buildLateralPayingPatterns(sourceResults),
) {
  return findLateralPayingReading(
    sourceResults.slice(-200),
    patterns,
    bestQualifiedLateralPatternForTrigger,
  );
}

export function findBlockedLateralPayingReading(
  sourceResults: LateralBacBoResult[],
  patterns = buildLateralPayingPatterns(sourceResults),
) {
  return findLateralPayingReading(
    sourceResults.slice(-200),
    patterns,
    bestBlockedLateralPatternForTrigger,
  );
}

export function analyzeLateralPayingNumbersEntry(
  sourceResults: LateralBacBoResult[],
): LateralPayingEntryAnalysis {
  const results = sourceResults.slice(-200);
  const patterns = buildLateralPayingPatterns(results);
  const active = findActiveLateralPayingReading(results, patterns);
  const blocked = active ? null : findBlockedLateralPayingReading(results, patterns);
  if (!active) {
    return {
      confirmed: false,
      reason: blocked ? "blocked_2_reds" : "no_qualified_pattern",
      signalKey: "",
      active: null,
      blocked,
      cycleSize: results.length,
    };
  }
  const anchor = results.at(-1)?.id || "empty";
  return {
    confirmed: true,
    reason: "confirmed_entry",
    signalKey: [
      "lateral-paying",
      active.pattern.key,
      `trigger:${active.trigger.id}`,
      `attempt:${active.attempt}`,
      `anchor:${anchor}`,
    ].join(":"),
    active,
    blocked: null,
    cycleSize: results.length,
  };
}

function findLateralPayingReading(
  results: LateralBacBoResult[],
  patterns: LateralPayingPattern[],
  selectPattern: (
    items: LateralPayingPattern[],
    trigger: LateralBacBoResult,
  ) => LateralPayingPattern | null,
): LateralPayingReading | null {
  const length = results.length;
  const g1Trigger = results[length - (BAC_BO_ROAD_ROWS + 1)];
  const lastSg = results[length - 1];
  if (
    g1Trigger &&
    lastSg &&
    (length - (BAC_BO_ROAD_ROWS + 1)) % BAC_BO_ROAD_ROWS < BAC_BO_ROAD_ROWS - 1
  ) {
    const g1Pattern = selectPattern(patterns, g1Trigger);
    if (g1Pattern && lastSg.side !== g1Pattern.target && lastSg.side !== "TIE") {
      return { pattern: g1Pattern, attempt: "G1", trigger: g1Trigger };
    }
  }
  const sgTrigger = results[length - BAC_BO_ROAD_ROWS];
  if (!sgTrigger) return null;
  const sgPattern = selectPattern(patterns, sgTrigger);
  return sgPattern ? { pattern: sgPattern, attempt: "SG", trigger: sgTrigger } : null;
}

export function bestQualifiedLateralPatternForTrigger(
  patterns: LateralPayingPattern[],
  trigger: LateralBacBoResult,
) {
  return (
    patterns
      .filter(
        (item) =>
          item.triggerValue === trigger.value &&
          item.triggerSide === trigger.side &&
          isQualifiedLateralPayingPattern(item),
      )
      .sort((a, b) => b.samples - a.samples || b.sg - a.sg)[0] ?? null
  );
}

/**
 * Builds the exact resolved history used by the lateral paying-numbers card.
 * Keeping this in the motor prevents the live selector from reimplementing a
 * slightly different SG/G1/TIE/RED decision tree.
 */
export function buildLateralPayingHistory(
  sourceResults: LateralBacBoResult[],
  rounds: LateralRoundMetadata[] = [],
): LateralPayingHistoryEntry[] {
  const results = sourceResults.slice(-200);
  const roundMap = new Map(rounds.map((round) => [String(round.id), round]));
  const rows: LateralPayingHistoryEntry[] = [];

  for (let sgIndex = BAC_BO_ROAD_ROWS; sgIndex < results.length; sgIndex += 1) {
    const triggerIndex = sgIndex - BAC_BO_ROAD_ROWS;
    if (triggerIndex % BAC_BO_ROAD_ROWS >= BAC_BO_ROAD_ROWS - 1) continue;
    const trigger = results[triggerIndex];
    const pattern = bestQualifiedLateralPatternForTrigger(
      buildLateralPayingPatterns(results.slice(0, sgIndex)),
      trigger,
    );
    if (!pattern) continue;

    const sg = results[sgIndex];
    const g1 = results[sgIndex + 1];
    const outcome = resolveLateralPayingOutcome(pattern.target, sg, g1);
    if (outcome === "INCOMPLETE") continue;
    const resolvedResult =
      outcome === "SG"
        ? sg
        : outcome === "G1" || outcome === "RED"
          ? g1
          : sg.side === "TIE"
            ? sg
            : g1;
    if (!resolvedResult) continue;

    const tieResult =
      resolvedResult.side === "TIE"
        ? resolvedResult
        : sg.side === "TIE"
          ? sg
          : g1?.side === "TIE"
            ? g1
            : null;
    const round = roundMap.get(String(resolvedResult.id));
    const tieRound = tieResult ? roundMap.get(String(tieResult.id)) : undefined;
    const multiplier =
      tieResult?.tieMultiplier ??
      tieRound?.tieMultiplier ??
      (tieResult ? lateralTieMultiplierFromValue(tieResult.value) : null);

    rows.push({
      id: `${pattern.key}:${trigger.id}:${resolvedResult.id}`,
      resultId: String(resolvedResult.id),
      outcome,
      target: pattern.target,
      isTie: Boolean(tieResult),
      tieLabel: multiplier ? `${multiplier}X` : tieResult ? "EMPATE" : null,
      time: tieResult?.time ?? resolvedResult.time ?? tieRound?.time ?? round?.time ?? null,
    });
    if (resolvedResult === g1) sgIndex += 1;
  }

  return rows;
}

function bestBlockedLateralPatternForTrigger(
  patterns: LateralPayingPattern[],
  trigger: LateralBacBoResult,
) {
  return (
    patterns
      .filter(
        (item) =>
          item.triggerValue === trigger.value &&
          item.triggerSide === trigger.side &&
          isLateralPatternBlocked(item.reds),
      )
      .sort((a, b) => b.samples - a.samples || b.sg - a.sg)[0] ?? null
  );
}

export type LateralTieTemplate = {
  id: string;
  label: string;
  rowDelta: number;
  columnDelta: number;
  geometry: string;
  priority?: number;
  horizontalFifthHouse?: boolean;
};

export type LateralTieFormation = {
  template: LateralTieTemplate;
  firstValue: number;
  secondValue: number | null;
  firstId: string;
  secondId: string;
  originIndex: number;
  targetIndex: number;
  originPosition: number;
  targetPosition: number;
};

export type LateralTieHistoryEntry = {
  id: string;
  formation: LateralTieFormation | null;
  attempt: "SG" | "G1" | null;
  result: "TIE" | "RED";
  multiplier: number | null;
  time: string | null;
  order: number;
};

export type LateralTieTimeline = {
  history: LateralTieHistoryEntry[];
  active: { formation: LateralTieFormation; attempt: "SG" | "G1" } | null;
  latestFormation: LateralTieFormation | null;
};

export const LATERAL_TIE_TEMPLATES: readonly LateralTieTemplate[] = [
  {
    id: "spaced",
    label: "Empate espaçado",
    rowDelta: 0,
    columnDelta: 2,
    geometry: "uma casa após a lateral",
  },
  {
    id: "high-row",
    label: "Empate remada alta",
    rowDelta: -1,
    columnDelta: 1,
    geometry: "diagonal alta, paga na cabeça",
  },
  {
    id: "low-row",
    label: "Empate remada baixa",
    rowDelta: 0,
    columnDelta: 1,
    geometry: "continuação lateral na linha baixa",
  },
  {
    id: "spaced-below",
    label: "Empate espaçado abaixo",
    rowDelta: 2,
    columnDelta: 0,
    geometry: "uma casa de espaço abaixo",
  },
  {
    id: "lateral-low",
    label: "Empate lateral baixo",
    rowDelta: 1,
    columnDelta: 0,
    geometry: "continuação imediatamente abaixo",
  },
  {
    id: "snake",
    label: "Empate cobrinha lateral",
    rowDelta: 1,
    columnDelta: 2,
    geometry: "cobrinha, paga na segunda linha",
  },
  {
    id: "tie-horizontal-fifth-house",
    label: "Empate quinta casa horizontal",
    rowDelta: 0,
    columnDelta: HORIZONTAL_TIE_COLUMN_GAP,
    geometry: "4 alinhamentos de 6; entrada na 5ª casa",
    priority: 100,
    horizontalFifthHouse: true,
  },
] as const;

export type LateralTieEntryAnalysis = {
  confirmed: boolean;
  reason: "confirmed_entry" | "no_tie_formation";
  signalKey: string;
  active: LateralTieTimeline["active"];
  dryTieRisk: boolean;
  horizontalTieRisk: boolean;
  templateTies: number;
  templateReds: number;
  cycleSize: number;
};

export function analyzeLateralTiePatternEntry(
  sourceResults: LateralBacBoResult[],
): LateralTieEntryAnalysis {
  const results = sourceResults.slice(-200);
  const timeline = buildLateralTieTimeline(results);
  const active = timeline.active;
  if (!active) {
    return {
      confirmed: false,
      reason: "no_tie_formation",
      signalKey: "",
      active: null,
      dryTieRisk: false,
      horizontalTieRisk: false,
      templateTies: 0,
      templateReds: 0,
      cycleSize: results.length,
    };
  }
  const score = scoreLateralTieTemplate(timeline.history, active.formation.template.id);
  const dryTieRisk = getTieLateralRiskState(score.reds).dryTieRisk;
  const horizontalTieRisk = Boolean(active.formation.template.horizontalFifthHouse);
  return {
    confirmed: true,
    reason: "confirmed_entry",
    signalKey: [
      "lateral-tie",
      active.formation.template.id,
      `origin:${active.formation.firstId}`,
      `target:${active.formation.targetPosition}`,
      `attempt:${active.attempt}`,
    ].join(":"),
    active,
    dryTieRisk,
    horizontalTieRisk,
    templateTies: score.ties,
    templateReds: score.reds,
    cycleSize: results.length,
  };
}

export function buildLateralTieTimeline(sourceResults: LateralBacBoResult[]): LateralTieTimeline {
  const results = sourceResults
    .slice(-200)
    .map((result, index) => ({ result, position: lateralRoadPosition(result, index) }))
    .sort((left, right) => left.position - right.position)
    .map(({ result }) => result);
  const history: LateralTieHistoryEntry[] = [];
  const countedTieIds = new Set<string>();
  let pendingG1: { formation: LateralTieFormation; sg: LateralBacBoResult } | null = null;
  let latestFormation: LateralTieFormation | null = null;

  for (let index = 0; index < results.length; index += 1) {
    const current = results[index];
    const currentPosition = lateralRoadPosition(current, index);

    if (pendingG1) {
      const expectedG1Position = pendingG1.formation.targetPosition + 1;
      if (currentPosition === expectedG1Position) {
        const result = current.side === "TIE" ? "TIE" : "RED";
        const overlappingSg = projectLateralTieFormationAtPosition(results, currentPosition);
        const resolvedFormation = {
          ...pendingG1.formation,
          secondValue: pendingG1.sg.value,
          secondId: pendingG1.sg.id,
        };
        pushLateralTieResolution(
          history,
          countedTieIds,
          resolvedFormation,
          pendingG1.sg,
          current,
          "G1",
          result,
          currentPosition,
        );
        pendingG1 =
          result === "RED" && overlappingSg ? { formation: overlappingSg, sg: current } : null;
        latestFormation = pendingG1?.formation ?? resolvedFormation;
        continue;
      }
      if (currentPosition > expectedG1Position) pendingG1 = null;
    }

    const formation = projectLateralTieFormationAtPosition(results, currentPosition);
    if (!formation) continue;
    latestFormation = formation;
    if (current.side === "TIE") {
      const resolvedFormation = {
        ...formation,
        secondValue: current.value,
        secondId: current.id,
      };
      pushLateralTieResolution(
        history,
        countedTieIds,
        resolvedFormation,
        current,
        current,
        "SG",
        "TIE",
        currentPosition,
      );
      latestFormation = resolvedFormation;
    } else {
      pendingG1 = { formation, sg: current };
    }
  }

  const lastPosition = results.length
    ? lateralRoadPosition(results[results.length - 1], results.length - 1)
    : -1;
  const nextPosition = lastPosition + 1;
  let active: LateralTieTimeline["active"] = null;
  if (pendingG1 && nextPosition === pendingG1.formation.targetPosition + 1) {
    active = { formation: pendingG1.formation, attempt: "G1" };
    latestFormation = pendingG1.formation;
  } else {
    const nextProjection = projectLateralTieFormationAtPosition(results, nextPosition);
    if (nextProjection) {
      active = { formation: nextProjection, attempt: "SG" };
      latestFormation = nextProjection;
    }
  }

  for (let index = 0; index < results.length; index += 1) {
    const tie = results[index];
    if (tie.side !== "TIE" || countedTieIds.has(String(tie.id))) continue;
    const position = lateralRoadPosition(tie, index);
    history.push({
      id: `table-tie:${tie.id}:${position}`,
      formation: null,
      attempt: null,
      result: "TIE",
      multiplier: tie.tieMultiplier ?? lateralTieMultiplierFromValue(tie.value),
      time: tie.time ?? null,
      order: position,
    });
  }

  return {
    history: history.sort((a, b) => a.order - b.order),
    active,
    latestFormation,
  };
}

export function scoreLateralTieTemplate(history: LateralTieHistoryEntry[], templateId: string) {
  return history.reduce(
    (score, item) => {
      if (item.formation?.template.id !== templateId) return score;
      if (item.result === "TIE") score.ties += 1;
      else score.reds += 1;
      score.resolved += 1;
      return score;
    },
    { ties: 0, reds: 0, resolved: 0 },
  );
}

export function projectLateralTieFormationAtPosition(
  results: LateralBacBoResult[],
  targetPosition: number,
): LateralTieFormation | null {
  if (targetPosition < 0) return null;
  const resultByPosition = new Map(
    results.map((result, index) => [lateralRoadPosition(result, index), { result, index }]),
  );
  const targetEntry = resultByPosition.get(targetPosition);
  const target = targetEntry?.result;
  const row = targetPosition % BAC_BO_ROAD_ROWS;
  const column = Math.floor(targetPosition / BAC_BO_ROAD_ROWS);
  const matches: LateralTieFormation[] = [];

  for (const template of LATERAL_TIE_TEMPLATES) {
    if (template.horizontalFifthHouse) {
      for (const [originPosition, originEntry] of resultByPosition) {
        const first = originEntry.result;
        if (
          first.side !== "TIE" ||
          !canProjectHorizontalTieCampaign(
            originPosition,
            targetPosition,
            (position) => resultByPosition.get(position)?.result.side,
          )
        ) {
          continue;
        }
        matches.push({
          template,
          firstValue: first.value,
          secondValue: target?.value ?? null,
          firstId: first.id,
          secondId: target?.id ?? `future-${targetPosition}`,
          originIndex: originEntry.index,
          targetIndex: targetEntry?.index ?? results.length,
          originPosition,
          targetPosition,
        });
      }
      continue;
    }

    const firstRow = row - template.rowDelta;
    const firstColumn = column - template.columnDelta;
    if (firstRow < 0 || firstRow >= BAC_BO_ROAD_ROWS || firstColumn < 0) continue;
    const originPosition = firstColumn * BAC_BO_ROAD_ROWS + firstRow;
    if (originPosition >= targetPosition) continue;
    const originEntry = resultByPosition.get(originPosition);
    const first = originEntry?.result;
    if (first?.side === "TIE" && originEntry) {
      matches.push({
        template,
        firstValue: first.value,
        secondValue: target?.value ?? null,
        firstId: first.id,
        secondId: target?.id ?? `future-${targetPosition}`,
        originIndex: originEntry.index,
        targetIndex: targetEntry?.index ?? results.length,
        originPosition,
        targetPosition,
      });
    }
  }
  return (
    matches.sort(
      (left, right) =>
        (right.template.priority ?? 0) - (left.template.priority ?? 0) ||
        right.originPosition - left.originPosition,
    )[0] ?? null
  );
}

function pushLateralTieResolution(
  history: LateralTieHistoryEntry[],
  countedTieIds: Set<string>,
  formation: LateralTieFormation,
  sg: LateralBacBoResult,
  resolved: LateralBacBoResult,
  attempt: "SG" | "G1",
  result: "TIE" | "RED",
  order: number,
) {
  const multiplier =
    result === "TIE"
      ? (resolved.tieMultiplier ?? lateralTieMultiplierFromValue(resolved.value))
      : null;
  if (result === "TIE") countedTieIds.add(String(resolved.id));
  history.push({
    id: `${formation.template.id}:${formation.firstId}:${sg.id}:${resolved.id}`,
    formation,
    attempt,
    result,
    multiplier,
    time: resolved.time ?? null,
    order,
  });
}

function lateralRoadPosition(result: LateralBacBoResult, fallbackIndex: number) {
  return Number.isInteger(result.slot) ? Number(result.slot) : fallbackIndex;
}

function lateralTieMultiplierFromValue(value: number) {
  const score = Math.round(Number(value));
  if (score === 2 || score === 12) return 88;
  if (score === 3 || score === 11) return 25;
  if (score === 4 || score === 10) return 10;
  if (score === 5 || score === 9) return 6;
  if (score === 6 || score === 7 || score === 8) return 4;
  return null;
}
