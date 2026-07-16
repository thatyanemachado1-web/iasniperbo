export const CALENDAR_AUDIT_TIMEZONE = "America/Campo_Grande";
export const CALENDAR_MIN_CLASSIFIED_SAMPLE = 10;

export type CalendarAuditClassification = "muito_pagante" | "operavel" | "perigoso" | "sem_amostra";
export type CalendarSampleStatus = "sem_dados" | "amostra_baixa" | "em_formacao" | "classificado";
export type CalendarOutcomeClass = "GREEN" | "RED" | "NEUTRAL";

export interface CalendarAuditModuleDefinition {
  engineKey: string;
  label: string;
  moduleKeys: string[];
  tieBehavior: "positive" | "neutral";
}

export const CALENDAR_AUDIT_MODULES: CalendarAuditModuleDefinition[] = [
  {
    engineKey: "neural_pagante",
    label: "Leitura Neural / Numero Pagante",
    moduleKeys: ["LEITURA_NEURAL_NUMERO_PAGANTE", "paying_numbers", "neural_pagante"],
    tieBehavior: "neutral",
  },
  {
    engineKey: "surf_analyzer",
    label: "Surf Analyzer",
    moduleKeys: ["SURF_ANALYZER", "surf_alert", "surf_analyzer"],
    tieBehavior: "neutral",
  },
  {
    engineKey: "radar_empates",
    label: "Radar de Empate",
    moduleKeys: ["RADAR_DE_EMPATE", "radar_empates"],
    tieBehavior: "positive",
  },
  {
    engineKey: "padroes_quentes_ia",
    label: "Padroes IA",
    moduleKeys: ["PADROES_IA", "ai_patterns", "padroes_quentes_ia"],
    tieBehavior: "neutral",
  },
  {
    engineKey: "numero_pagante_lateral",
    label: "Numero Pagante Lateral",
    moduleKeys: ["NUMERO_PAGANTE_LATERAL", "lateral_paying_numbers"],
    tieBehavior: "neutral",
  },
  {
    engineKey: "motor_empate",
    label: "Motor de Empate",
    moduleKeys: ["MOTOR_DE_EMPATE", "ties_only", "motor_empate"],
    tieBehavior: "positive",
  },
  {
    engineKey: "empate_lateral",
    label: "Motor de Empate Lateral",
    moduleKeys: ["EMPATE_LATERAL", "lateral_tie_patterns", "empate_lateral"],
    tieBehavior: "positive",
  },
  {
    engineKey: "tendencia",
    label: "Tendencia",
    moduleKeys: ["TENDENCIA", "tendencia"],
    tieBehavior: "neutral",
  },
  {
    engineKey: "validator",
    label: "Validador",
    moduleKeys: ["VALIDATOR", "validator"],
    tieBehavior: "neutral",
  },
];

export interface CalendarD1PreparedStatement {
  bind: (...values: unknown[]) => CalendarD1PreparedStatement;
  run?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
  first?: () => Promise<unknown>;
}

export interface CalendarD1Database {
  prepare: (sql: string) => CalendarD1PreparedStatement;
  batch?: (statements: CalendarD1PreparedStatement[]) => Promise<unknown>;
}

export interface CalendarResultEvent {
  eventKey: string;
  moduleKey: string;
  engineKey: string;
  moduleLabel: string;
  strategyId: string | null;
  patternId: string | null;
  signalId: string | null;
  roundId: string | null;
  entrySide: string | null;
  entryAt: string;
  resolvedAt: string;
  entryDayKey: string;
  entryHour: number;
  validity: string | null;
  finalResult: string;
  outcomeClass: CalendarOutcomeClass;
  attempt: string | null;
  status: "CLOSED";
  tieMultiplier: string | null;
  timezone: string;
  source: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

type Counter = {
  greens: number;
  greenSG: number;
  greenG1: number;
  reds: number;
  ties: number;
  neutral: number;
  openEntries: number;
  updatedAt: string;
};

type AggregateRow = {
  date: string;
  hour: number;
  engineKey: string;
  greens: number;
  greenSG: number;
  greenG1: number;
  reds: number;
  ties: number;
  neutral: number;
  updatedAt: string;
};

type RecentEventRow = {
  eventKey: string;
  engineKey: string;
  entryAt: string;
  resolvedAt: string;
  entryDayKey: string;
  entryHour: number;
  outcomeClass: CalendarOutcomeClass;
  finalResult: string;
  attempt: string;
};

const EMPTY_COUNTER: Counter = {
  greens: 0,
  greenSG: 0,
  greenG1: 0,
  reds: 0,
  ties: 0,
  neutral: 0,
  openEntries: 0,
  updatedAt: "",
};

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];

export function classifyCalendarAccuracy(
  accuracy: number,
  completedEntries: number,
): CalendarAuditClassification {
  if (completedEntries < CALENDAR_MIN_CLASSIFIED_SAMPLE) return "sem_amostra";
  if (accuracy >= 89) return "muito_pagante";
  if (accuracy >= 88) return "operavel";
  return "perigoso";
}

export function calendarAccuracyMessage(classification: CalendarAuditClassification) {
  if (classification === "muito_pagante") return "Muito bom para operar";
  if (classification === "operavel") return "Operável";
  if (classification === "perigoso") return "Perigoso";
  return "Sem amostra";
}

export function calendarSampleStatus(completedEntries: number): CalendarSampleStatus {
  if (completedEntries <= 0) return "sem_dados";
  if (completedEntries <= 4) return "amostra_baixa";
  if (completedEntries <= 9) return "em_formacao";
  return "classificado";
}

export function calendarMetricFromCounts(greens: number, reds: number) {
  return metricFromCounter({
    ...cloneCounter(),
    greens: Math.max(0, Math.floor(Number(greens) || 0)),
    reds: Math.max(0, Math.floor(Number(reds) || 0)),
  });
}

export function calendarModuleDefinition(value: unknown) {
  const normalized = normalizeKey(value);
  return (
    CALENDAR_AUDIT_MODULES.find(
      (module) =>
        normalizeKey(module.engineKey) === normalized ||
        module.moduleKeys.some((key) => normalizeKey(key) === normalized),
    ) || null
  );
}

export function calendarResultEventFromPersistentResult(
  value: unknown,
  source = "dashboard_persistent_result",
): CalendarResultEvent | null {
  const row = toRecord(value);
  const moduleKey = readString(row.moduleKey ?? row.module_key ?? row.module);
  const module = calendarModuleDefinition(moduleKey);
  const resultId = readString(row.resultId ?? row.result_id ?? row.id);
  const resultType = normalizeResultType(row.resultType ?? row.result_type ?? row.result);
  if (!module || !resultId || !resultType) return null;

  const payload = toRecord(parseJsonValue(row.payload));
  const contract = toRecord(payload.contract);
  const resolvedAt = normalizeIso(
    row.resolvedAt ?? row.resolved_at ?? row.createdAt ?? row.created_at ?? row.closedAt,
  );
  const entryAt = normalizeIso(
    firstValue(
      payload.entryTimestamp,
      payload.entryAt,
      payload.openedAt,
      payload.startedAt,
      contract.entryTimestamp,
      contract.entryAt,
      contract.openedAt,
      row.entryTimestamp,
      row.entry_at,
      resolvedAt,
    ),
  );
  if (!entryAt || !resolvedAt) return null;

  const signalId = nullableString(
    row.signalId ?? row.signal_id ?? payload.signalId ?? contract.signalId,
  );
  const roundId = nullableString(
    row.roundId ??
      row.round_id ??
      payload.entryRoundId ??
      payload.closedRoundId ??
      contract.entryRoundId ??
      contract.closedRoundId,
  );
  const declaredAttempt = normalizeAttempt(
    row.attempt ?? payload.attempt ?? contract.attempt,
    resultType,
  );
  const identityAttempt = calendarAttemptFromIdentity(signalId, resultId);
  if (
    identityAttempt &&
    declaredAttempt &&
    identityAttempt !== declaredAttempt &&
    calendarResultUsesAttempt(resultType)
  ) {
    return null;
  }
  const attempt = identityAttempt || declaredAttempt;
  const outcomeClass = calendarOutcomeClass(module, resultType);
  const parts = zonedDateParts(entryAt, CALENDAR_AUDIT_TIMEZONE);
  const eventKey =
    signalId && roundId
      ? `${module.engineKey}:${signalId}:${roundId}`
      : `${module.engineKey}:${resultId}`;
  const nowIso = new Date().toISOString();
  const calendarAudit = {
    ...toRecord(payload.calendarAudit),
    resultId,
    identityAttempt,
  };

  return {
    eventKey,
    moduleKey,
    engineKey: module.engineKey,
    moduleLabel: module.label,
    strategyId: nullableString(
      payload.strategyId ?? payload.strategy_id ?? contract.strategyId ?? contract.strategy_id,
    ),
    patternId: nullableString(
      payload.patternId ?? payload.pattern_id ?? contract.patternId ?? contract.pattern_id,
    ),
    signalId,
    roundId,
    entrySide: nullableString(
      row.side ?? payload.entrySide ?? payload.technicalSide ?? contract.technicalSide,
    ),
    entryAt,
    resolvedAt,
    entryDayKey: parts.date,
    entryHour: parts.hour,
    validity: nullableString(payload.validity ?? payload.validade ?? contract.validity),
    finalResult: resultType,
    outcomeClass,
    attempt,
    status: "CLOSED",
    tieMultiplier: nullableString(
      row.tieMultiplier ?? row.tie_multiplier ?? payload.tieMultiplier ?? contract.tieMultiplier,
    ),
    timezone: CALENDAR_AUDIT_TIMEZONE,
    source,
    payload: { ...payload, calendarAudit },
    createdAt: resolvedAt,
    updatedAt: nowIso,
  };
}

export function calendarResultEventsFromLegacyEngineEvent(value: unknown) {
  const row = toRecord(value);
  const module = calendarModuleDefinition(row.engine_key ?? row.engineKey);
  const eventKey = readString(row.event_key ?? row.eventKey ?? row.id);
  const outcome = normalizeKey(row.outcome);
  const occurredAt = normalizeIso(row.occurred_at ?? row.occurredAt ?? row.created_at);
  if (!module || !eventKey || !occurredAt || !["green", "red", "tie"].includes(outcome)) {
    return [];
  }
  const parts = zonedDateParts(occurredAt, CALENDAR_AUDIT_TIMEZONE);
  const nowIso = new Date().toISOString();
  const payload = toRecord(parseJsonValue(row.payload_json ?? row.payload));
  const counters = {
    green: readNumber(row.greens),
    red: readNumber(row.reds),
    tie: readNumber(row.ties),
  };
  if (counters.green + counters.red + counters.tie === 0) counters[outcome] = 1;

  return (["green", "red", "tie"] as const).flatMap((kind) => {
    const resultType = kind === "green" ? "GREEN" : kind === "red" ? "RED" : "EMPATE";
    return Array.from({ length: counters[kind] }, (_, index): CalendarResultEvent => ({
      eventKey: `legacy:${eventKey}:${kind}:${index + 1}`,
      moduleKey: module.moduleKeys[0] || module.engineKey,
      engineKey: module.engineKey,
      moduleLabel: module.label,
      strategyId: null,
      patternId: null,
      signalId: `${eventKey}:${kind}:${index + 1}`,
      roundId: null,
      entrySide: null,
      entryAt: occurredAt,
      resolvedAt: occurredAt,
      entryDayKey: parts.date,
      entryHour: parts.hour,
      validity: null,
      finalResult: resultType,
      outcomeClass: calendarOutcomeClass(module, resultType),
      attempt: resultType === "GREEN" ? "SG" : null,
      status: "CLOSED",
      tieMultiplier: null,
      timezone: CALENDAR_AUDIT_TIMEZONE,
      source: "legacy_engine_signal_event",
      payload,
      createdAt: occurredAt,
      updatedAt: nowIso,
    }));
  });
}

export async function persistCalendarResultEvents(
  db: CalendarD1Database,
  events: CalendarResultEvent[],
) {
  const unique = new Map(events.map((event) => [event.eventKey, event]));
  const statements = [...unique.values()].map((event) =>
    db
      .prepare(
        `INSERT INTO calendar_result_events (
           event_key, module_key, engine_key, module_label, strategy_id, pattern_id,
           signal_id, round_id, entry_side, entry_at, resolved_at, entry_day_key,
           entry_hour, validity, final_result, outcome_class, attempt, status,
           tie_multiplier, timezone, source, payload, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(event_key) DO UPDATE SET
           module_key = excluded.module_key,
           engine_key = excluded.engine_key,
           module_label = excluded.module_label,
           strategy_id = COALESCE(excluded.strategy_id, calendar_result_events.strategy_id),
           pattern_id = COALESCE(excluded.pattern_id, calendar_result_events.pattern_id),
           signal_id = COALESCE(excluded.signal_id, calendar_result_events.signal_id),
           round_id = COALESCE(excluded.round_id, calendar_result_events.round_id),
           entry_side = COALESCE(excluded.entry_side, calendar_result_events.entry_side),
           entry_at = excluded.entry_at,
           resolved_at = excluded.resolved_at,
           entry_day_key = excluded.entry_day_key,
           entry_hour = excluded.entry_hour,
           validity = COALESCE(excluded.validity, calendar_result_events.validity),
           final_result = excluded.final_result,
           outcome_class = excluded.outcome_class,
           attempt = COALESCE(excluded.attempt, calendar_result_events.attempt),
           status = excluded.status,
           tie_multiplier = COALESCE(excluded.tie_multiplier, calendar_result_events.tie_multiplier),
           timezone = excluded.timezone,
           source = excluded.source,
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
      )
      .bind(
        event.eventKey,
        event.moduleKey,
        event.engineKey,
        event.moduleLabel,
        event.strategyId,
        event.patternId,
        event.signalId,
        event.roundId,
        event.entrySide,
        event.entryAt,
        event.resolvedAt,
        event.entryDayKey,
        event.entryHour,
        event.validity,
        event.finalResult,
        event.outcomeClass,
        event.attempt,
        event.status,
        event.tieMultiplier,
        event.timezone,
        event.source,
        JSON.stringify(event.payload),
        event.createdAt,
        event.updatedAt,
      ),
  );

  for (let offset = 0; offset < statements.length; offset += 50) {
    const batch = statements.slice(offset, offset + 50);
    if (typeof db.batch === "function") await db.batch(batch);
    else for (const statement of batch) await statement.run?.();
  }
  return unique.size;
}

export async function loadCalendarAuditPayloadFromD1(
  db: CalendarD1Database,
  options: {
    year: number;
    month: number;
    selectedDate?: string;
    range?: string;
    engineMode?: string;
    engineKeys?: string[];
    now?: Date;
  },
) {
  const now = options.now || new Date();
  const nowParts = zonedDateParts(now.toISOString(), CALENDAR_AUDIT_TIMEZONE);
  const year = options.year;
  const month = options.month;
  const selectedDate = normalizeSelectedDate(options.selectedDate, year, month, nowParts.date);
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const monthStart = dateKey(year, month, 1);
  const monthEnd = dateKey(year, month, daysInMonth(year, month));
  const selectedEngines = normalizeSelectedEngines(options.engineMode, options.engineKeys);
  const allEngines = CALENDAR_AUDIT_MODULES.map((module) => module.engineKey);
  const recentStart = addDays(nowParts.date, -8);

  try {
    const [monthRows, weekRows, recentRows, boundsRows] = await Promise.all([
      readAggregateRows(db, monthStart, monthEnd, selectedEngines),
      readAggregateRows(db, weekStart, weekEnd, selectedEngines),
      readRecentEvents(db, recentStart, nowParts.date, nowParts.hour, allEngines),
      d1All(
        db
          .prepare(
            "SELECT MIN(entry_day_key) AS first_date, MAX(entry_day_key) AS last_date, MAX(updated_at) AS updated_at FROM calendar_result_events",
          )
          .bind(),
      ),
    ]);

    const monthMap = aggregateRowMap(monthRows);
    const weekMap = aggregateRowMap([...monthRows, ...weekRows]);
    const bounds = toRecord(boundsRows[0]);
    const firstStoredDate = readString(bounds.first_date);
    if (!firstStoredDate) return null;
    const startDate = firstStoredDate;
    const updatedAt = readString(bounds.updated_at) || now.toISOString();
    const monthDays = buildMonthDays(year, month, monthMap, selectedEngines);
    const week = buildWeekPayload(weekStart, weekMap, selectedEngines);
    const selectedWeekDay = week.days.find((day) => day.date === selectedDate);
    const selectedDay =
      monthDays.find((day) => day.date === selectedDate) ||
      selectedWeekDay?.summary ||
      buildDayStat(selectedDate, [], selectedEngines);
    const selectedHours =
      selectedWeekDay?.hours ||
      Array.from({ length: 24 }, (_, hour) =>
        buildHourStat(selectedDate, hour, [], selectedEngines),
      );
    const monthSummary = buildMonthSummary(monthDays, monthRows, selectedEngines);
    const vision = buildDailyVision(recentRows, now, nowParts);

    return {
      dataStatus: "live" as const,
      dataSource: "official_result_events",
      dataStatusMessage: "Entradas finalizadas e deduplicadas dos modulos oficiais.",
      timezone: CALENDAR_AUDIT_TIMEZONE,
      startDate,
      updatedAt,
      range: options.range || "este_mes",
      engineFilter: {
        mode: options.engineMode || "todos",
        selected: selectedEngines,
        available: allEngines,
      },
      years: [nowParts.year - 1, nowParts.year, nowParts.year + 1],
      selected: { year, month, date: selectedDate },
      month: {
        year,
        month,
        label: monthLabel(year, month),
        firstWeekday: new Date(Date.UTC(year, month - 1, 1)).getUTCDay(),
        days: monthDays,
        summary: monthSummary,
        distribution: monthSummary.counts,
        weekdayAverages: buildWeekdayAverages(monthRows, selectedEngines),
        heatmap: groupRows(monthRows, (row) => `${row.date}:${row.hour}`)
          .map((rows) => {
            const first = rows[0];
            const metric = metricFromCounter(sumCounters(rows.map(counterFromRow)));
            return {
              date: first.date,
              day: Number(first.date.slice(8, 10)),
              hour: first.hour,
              score: metric.accuracy,
              classification: metric.classification,
              totalRounds: metric.completedEntries,
              completedEntries: metric.completedEntries,
            };
          })
          .filter((row) => row.completedEntries > 0),
      },
      week,
      selectedDay,
      selectedHours,
      dailyVision: vision,
      rankings: buildRankings(monthRows, monthDays, selectedEngines),
    };
  } catch (error) {
    if (String(error).toLowerCase().includes("no such table")) return null;
    throw error;
  }
}

async function readAggregateRows(
  db: CalendarD1Database,
  startDate: string,
  endDate: string,
  engineKeys: string[],
) {
  if (!engineKeys.length) return [];
  const placeholders = engineKeys.map(() => "?").join(",");
  const result = await d1All(
    db
      .prepare(
        `SELECT
           entry_day_key AS date,
           entry_hour AS hour,
           engine_key,
           SUM(CASE WHEN outcome_class = 'GREEN' THEN 1 ELSE 0 END) AS greens,
           SUM(CASE WHEN outcome_class = 'GREEN' AND COALESCE(attempt, '') <> 'G1' THEN 1 ELSE 0 END) AS green_sg,
           SUM(CASE WHEN outcome_class = 'GREEN' AND attempt = 'G1' THEN 1 ELSE 0 END) AS green_g1,
           SUM(CASE WHEN outcome_class = 'RED' THEN 1 ELSE 0 END) AS reds,
           SUM(CASE WHEN final_result LIKE 'EMPATE%' OR final_result LIKE 'TIE%'
                    OR tie_multiplier IS NOT NULL THEN 1 ELSE 0 END) AS ties,
           SUM(CASE WHEN outcome_class = 'NEUTRAL' THEN 1 ELSE 0 END) AS neutral,
           MAX(resolved_at) AS updated_at
         FROM calendar_result_events
         WHERE status = 'CLOSED'
           AND entry_day_key >= ?
           AND entry_day_key <= ?
           AND engine_key IN (${placeholders})
         GROUP BY entry_day_key, entry_hour, engine_key
         ORDER BY entry_day_key, entry_hour, engine_key`,
      )
      .bind(startDate, endDate, ...engineKeys),
  );
  return result.map(normalizeAggregateRow).filter((row): row is AggregateRow => Boolean(row));
}

async function readRecentEvents(
  db: CalendarD1Database,
  startDate: string,
  endDate: string,
  currentHour: number,
  engineKeys: string[],
) {
  if (!engineKeys.length) return [];
  const placeholders = engineKeys.map(() => "?").join(",");
  const previousDate = addDays(endDate, -1);
  const previousDayCarryHour = currentHour + 20;
  const rows = await d1All(
    db
      .prepare(
        `SELECT event_key, engine_key, entry_at, resolved_at, entry_day_key, entry_hour,
                outcome_class, final_result, COALESCE(attempt, '') AS attempt
         FROM calendar_result_events
         WHERE status = 'CLOSED'
           AND (
             entry_day_key = ?
             OR (
               entry_day_key >= ?
               AND entry_day_key < ?
               AND entry_hour = ?
             )
             OR (
               ? < 4
               AND entry_day_key = ?
               AND entry_hour >= ?
             )
           )
           AND engine_key IN (${placeholders})
         ORDER BY entry_at DESC
         LIMIT 10000`,
      )
      .bind(
        endDate,
        startDate,
        endDate,
        currentHour,
        currentHour,
        previousDate,
        previousDayCarryHour,
        ...engineKeys,
      ),
  );
  return rows.map(normalizeRecentEventRow).filter((row): row is RecentEventRow => Boolean(row));
}

async function d1All(statement: CalendarD1PreparedStatement) {
  const response = await statement.all?.();
  if (Array.isArray(response)) return response.map(toRecord);
  const record = toRecord(response);
  return Array.isArray(record.results) ? record.results.map(toRecord) : [];
}

function aggregateRowMap(rows: AggregateRow[]) {
  const map = new Map<string, AggregateRow>();
  for (const row of rows) {
    const key = `${row.date}:${row.hour}:${row.engineKey}`;
    const current = map.get(key);
    if (!current || Date.parse(row.updatedAt) >= Date.parse(current.updatedAt)) map.set(key, row);
  }
  return map;
}

function buildMonthDays(
  year: number,
  month: number,
  rows: Map<string, AggregateRow>,
  engineKeys: string[],
) {
  return Array.from({ length: daysInMonth(year, month) }, (_, index) => {
    const date = dateKey(year, month, index + 1);
    const dateRows = [...rows.values()].filter((row) => row.date === date);
    return buildDayStat(date, dateRows, engineKeys);
  });
}

function buildWeekPayload(
  weekStart: string,
  rows: Map<string, AggregateRow>,
  engineKeys: string[],
) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateRows = [...rows.values()].filter((row) => row.date === date);
    const hours = Array.from({ length: 24 }, (_, hour) =>
      buildHourStat(
        date,
        hour,
        dateRows.filter((row) => row.hour === hour),
        engineKeys,
      ),
    );
    return {
      date,
      weekday: WEEKDAY_LABELS[index],
      summary: buildDayStat(date, dateRows, engineKeys),
      hours,
    };
  });
  return { startDate: weekStart, endDate: addDays(weekStart, 6), days };
}

function buildDayStat(date: string, rows: AggregateRow[], engineKeys: string[]) {
  const byModule = moduleStatsForRows(rows, engineKeys);
  const counter = sumCounters(byModule.map(moduleCounter));
  const metric = metricFromCounter(counter);
  const sampledHours = groupRows(rows, (row) => String(row.hour)).map((items) => {
    const itemMetric = metricFromCounter(sumCounters(items.map(counterFromRow)));
    return { hour: items[0]?.hour || 0, ...itemMetric };
  });
  const bestHour = bestMetric(sampledHours, true);
  const worstHour = bestMetric(sampledHours, false);
  const bestModule = bestModuleStat(byModule, true);
  const dateObject = parseDateKey(date);
  return {
    id: `audit:daily:${date}`,
    date,
    year: dateObject.getUTCFullYear(),
    month: dateObject.getUTCMonth() + 1,
    day: dateObject.getUTCDate(),
    weekday: WEEKDAY_LABELS[dateObject.getUTCDay()],
    totalRounds: metric.completedEntries,
    completedEntries: metric.completedEntries,
    openEntries: counter.openEntries,
    greens: counter.greens,
    greenSG: counter.greenSG,
    greenG1: counter.greenG1,
    reds: counter.reds,
    ties: counter.ties,
    neutralResults: counter.neutral,
    bankerCount: 0,
    playerCount: 0,
    tieCount: counter.ties,
    accuracy: metric.accuracy,
    score: metric.accuracy,
    classification: metric.classification,
    sampleStatus: metric.sampleStatus,
    sampleLabel: sampleLabel(metric.completedEntries),
    bestHour: bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "",
    worstHour: worstHour ? `${String(worstHour.hour).padStart(2, "0")}:00` : "",
    bestModule: bestModule?.label || "-",
    bestForce: "NONE" as const,
    observation: sampleObservation(metric),
    moduleStats: byModule,
    createdAt: counter.updatedAt || `${date}T00:00:00.000Z`,
    updatedAt: counter.updatedAt || `${date}T00:00:00.000Z`,
  };
}

function buildHourStat(date: string, hour: number, rows: AggregateRow[], engineKeys: string[]) {
  const day = buildDayStat(date, rows, engineKeys);
  return {
    ...day,
    id: `audit:hourly:${date}:${String(hour).padStart(2, "0")}`,
    engineKey: "todos",
    totalSignals: day.completedEntries,
    hour,
    bankerPercent: 0,
    playerPercent: 0,
    tiePercent: 0,
    bestReading: sampleObservation({
      accuracy: day.accuracy,
      completedEntries: day.completedEntries,
      classification: day.classification,
      sampleStatus: day.sampleStatus,
    }),
  };
}

function moduleStatsForRows(rows: AggregateRow[], engineKeys: string[]) {
  return engineKeys.map((engineKey) => {
    const module = calendarModuleDefinition(engineKey);
    const counter = sumCounters(
      rows.filter((row) => row.engineKey === engineKey).map(counterFromRow),
    );
    const metric = metricFromCounter(counter);
    return {
      engineKey,
      label: module?.label || engineKey,
      greens: counter.greens,
      greenSG: counter.greenSG,
      greenG1: counter.greenG1,
      reds: counter.reds,
      ties: counter.ties,
      neutralResults: counter.neutral,
      completedEntries: metric.completedEntries,
      openEntries: counter.openEntries,
      accuracy: metric.accuracy,
      score: metric.accuracy,
      classification: metric.classification,
      sampleStatus: metric.sampleStatus,
      sampleLabel: sampleLabel(metric.completedEntries),
      updatedAt: counter.updatedAt,
    };
  });
}

function moduleCounter(value: Record<string, unknown>) {
  return {
    greens: readNumber(value.greens),
    greenSG: readNumber(value.greenSG),
    greenG1: readNumber(value.greenG1),
    reds: readNumber(value.reds),
    ties: readNumber(value.ties),
    neutral: readNumber(value.neutralResults),
    openEntries: readNumber(value.openEntries),
    updatedAt: readString(value.updatedAt),
  };
}

function buildMonthSummary(
  days: Array<Record<string, unknown>>,
  rows: AggregateRow[],
  engineKeys: string[],
) {
  const counter = sumCounters(rows.map(counterFromRow));
  const metric = metricFromCounter(counter);
  const sampledDays = days.filter((day) => readNumber(day.completedEntries) > 0);
  const bestDay = rankMetricRecords(sampledDays, true)[0] || null;
  const worstDay = rankMetricRecords(sampledDays, false)[0] || null;
  const hourly = groupRows(rows, (row) => String(row.hour)).map((items) =>
    buildHourStat("1970-01-01", items[0]?.hour || 0, items, engineKeys),
  );
  const bestHour = rankMetricRecords(hourly.filter(hasCompletedEntries), true)[0] || null;
  const worstHour = rankMetricRecords(hourly.filter(hasCompletedEntries), false)[0] || null;
  const counts = days.reduce(
    (acc, day) => {
      const key = readString(day.classification) as CalendarAuditClassification;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    { muito_pagante: 0, operavel: 0, perigoso: 0, sem_amostra: 0 } as Record<
      CalendarAuditClassification,
      number
    >,
  );
  return {
    averageScore: metric.accuracy,
    greens: counter.greens,
    reds: counter.reds,
    ties: counter.ties,
    completedEntries: metric.completedEntries,
    sampleStatus: metric.sampleStatus,
    bestDay,
    worstDay,
    bestHour,
    worstHour,
    counts,
  };
}

function buildWeekdayAverages(rows: AggregateRow[], engineKeys: string[]) {
  return WEEKDAY_LABELS.map((weekday, weekdayIndex) => {
    const weekdayRows = rows.filter((row) => parseDateKey(row.date).getUTCDay() === weekdayIndex);
    const counter = sumCounters(weekdayRows.map(counterFromRow));
    const metric = metricFromCounter(counter);
    return {
      weekday,
      score: metric.accuracy,
      total: metric.completedEntries,
      completedEntries: metric.completedEntries,
      greens: counter.greens,
      reds: counter.reds,
      classification: metric.classification,
      sampleStatus: metric.sampleStatus,
      moduleStats: moduleStatsForRows(weekdayRows, engineKeys),
    };
  });
}

function buildRankings(
  rows: AggregateRow[],
  days: Array<Record<string, unknown>>,
  engineKeys: string[],
) {
  const hourlyCandidates = groupRows(rows, (row) => String(row.hour))
    .map((items) => {
      const counter = sumCounters(items.map(counterFromRow));
      const metric = metricFromCounter(counter);
      const hour = items[0]?.hour || 0;
      return {
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        score: metric.accuracy,
        totalRounds: metric.completedEntries,
        completedEntries: metric.completedEntries,
        classification: metric.classification,
        sampleStatus: metric.sampleStatus,
      };
    })
    .filter(hasCompletedEntries);
  const topHours = rankMetricRecords(hourlyCandidates, true).slice(0, 8);
  const topMonthDays = rankMetricRecords(days.filter(hasCompletedEntries), true)
    .slice(0, 10)
    .map((day) => ({
      date: readString(day.date),
      label: formatDateShort(readString(day.date)),
      score: readNumber(day.score),
      totalRounds: readNumber(day.completedEntries),
      completedEntries: readNumber(day.completedEntries),
      classification: readString(day.classification),
      sampleStatus: readString(day.sampleStatus),
    }));
  const topEngines = rankMetricRecords(
    moduleStatsForRows(rows, engineKeys).filter(hasCompletedEntries),
    true,
  ).map((module) => ({
    engineKey: module.engineKey,
    label: module.label,
    score: module.accuracy,
    totalSignals: module.completedEntries,
    completedEntries: module.completedEntries,
    classification: module.classification,
    sampleStatus: module.sampleStatus,
  }));
  const topWeekdays = rankMetricRecords(
    buildWeekdayAverages(rows, engineKeys).filter(hasCompletedEntries),
    true,
  );
  return {
    topHours,
    topWeekdays,
    topMonthDays,
    topEngines,
    bestHour: topHours[0] || null,
    bestDay: topMonthDays[0] || null,
    bestWeek: null,
    bestMonth: null,
    bestYear: null,
  };
}

function buildDailyVision(events: RecentEventRow[], now: Date, nowParts: ZonedDateParts) {
  const nowMs = now.getTime();
  const modules = CALENDAR_AUDIT_MODULES.map((module) => {
    const moduleEvents = events
      .filter((event) => event.engineKey === module.engineKey)
      .sort((first, second) => Date.parse(second.entryAt) - Date.parse(first.entryAt));
    const windows = {
      oneHour: visionWindow(moduleEvents, nowMs - 60 * 60_000, nowMs),
      twoHours: visionWindow(moduleEvents, nowMs - 2 * 60 * 60_000, nowMs),
      fourHours: visionWindow(moduleEvents, nowMs - 4 * 60 * 60_000, nowMs),
      today: visionWindowByDay(moduleEvents, nowParts.date),
      sameHour7d: visionSameHourWindow(moduleEvents, nowParts.date, nowParts.hour),
    };
    windows.oneHour.variation = variationAgainst(
      windows.oneHour,
      visionWindow(moduleEvents, nowMs - 2 * 60 * 60_000, nowMs - 60 * 60_000),
    );
    windows.twoHours.variation = variationAgainst(
      windows.twoHours,
      visionWindow(moduleEvents, nowMs - 4 * 60 * 60_000, nowMs - 2 * 60 * 60_000),
    );
    windows.fourHours.variation = variationAgainst(
      windows.fourHours,
      visionWindow(moduleEvents, nowMs - 8 * 60 * 60_000, nowMs - 4 * 60 * 60_000),
    );
    windows.today.variation = variationAgainst(
      windows.today,
      visionWindowByDay(moduleEvents, addDays(nowParts.date, -1)),
    );
    const recent = moduleEvents.slice(0, 10);
    const stability = visionStability([
      windows.oneHour,
      windows.twoHours,
      windows.fourHours,
      windows.today,
    ]);
    const score = consistencyScore(windows, recent, stability);
    const validWindows = Object.entries(windows).filter(
      ([key, value]) => key !== "sameHour7d" && value.completedEntries > 0,
    );
    const bestWindow = validWindows.sort(
      (first, second) =>
        second[1].accuracy - first[1].accuracy ||
        second[1].completedEntries - first[1].completedEntries,
    )[0];
    return {
      engineKey: module.engineKey,
      label: module.label,
      windows,
      sampleStatus: visionSampleStatus(windows.today.completedEntries),
      stability: stability.label,
      stabilitySpread: stability.spread,
      consistencyScore: score,
      recentSequence: recent.map(sequenceToken),
      last5: recentOutcomeSummary(recent.slice(0, 5)),
      last10: recentOutcomeSummary(recent),
      recentRedStreak: consecutiveReds(recent),
      bestWindow: bestWindow?.[0] || null,
      latestEntryAt: moduleEvents[0]?.entryAt || null,
    };
  });

  const activeModules = modules.filter((module) => module.windows.today.completedEntries > 0);
  const best = selectDailyVisionBestModule(activeModules);
  const alert =
    [...activeModules].sort(
      (first, second) =>
        first.windows.oneHour.accuracy - second.windows.oneHour.accuracy ||
        second.recentRedStreak - first.recentRedStreak,
    )[0] || null;
  const status = dailyVisionStatus(activeModules, best);
  const stability = best?.stability || "SEM_DADOS";
  const latestUpdate =
    events
      .map((event) => event.resolvedAt)
      .sort((first, second) => Date.parse(second) - Date.parse(first))[0] || null;
  const consistentHour = bestHourRange(events, nowParts.date);
  const qualifiedTitle = Boolean(best && best.windows.today.completedEntries >= 10);

  return {
    status,
    stability,
    title: qualifiedTitle ? "CARD MAIS ASSERTIVO" : "MELHOR DESEMPENHO PARCIAL",
    subtitle: qualifiedTitle ? "Amostra minima validada" : "AMOSTRA AINDA EM FORMACAO",
    bestModule: best?.label || null,
    bestEngineKey: best?.engineKey || null,
    assertiveness: best?.windows.today.accuracy || 0,
    hits: best?.windows.today.greens || 0,
    sample: best?.windows.today.completedEntries || 0,
    bestWindow: best?.bestWindow || null,
    mostConsistentHour: consistentHour,
    alertModule: alert?.label || null,
    latestUpdate,
    summary: dailyVisionSummary(status, best),
    modules,
  };
}

export function selectDailyVisionBestModule<
  T extends {
    consistencyScore: number;
    windows: { today: { completedEntries: number } };
  },
>(modules: T[]) {
  const active = modules.filter((module) => module.windows.today.completedEntries > 0);
  const qualified = active.filter(
    (module) => module.windows.today.completedEntries >= CALENDAR_MIN_CLASSIFIED_SAMPLE,
  );
  return (
    [...(qualified.length ? qualified : active)].sort(
      (first, second) =>
        second.consistencyScore - first.consistencyScore ||
        second.windows.today.completedEntries - first.windows.today.completedEntries,
    )[0] || null
  );
}

function visionWindow(events: RecentEventRow[], startMs: number, endMs: number) {
  return visionMetric(
    events.filter((event) => {
      const time = Date.parse(event.entryAt);
      return Number.isFinite(time) && time >= startMs && time < endMs;
    }),
  );
}

function visionWindowByDay(events: RecentEventRow[], dayKey: string) {
  return visionMetric(events.filter((event) => event.entryDayKey === dayKey));
}

function visionSameHourWindow(events: RecentEventRow[], today: string, hour: number) {
  const oldest = addDays(today, -7);
  return visionMetric(
    events.filter(
      (event) =>
        event.entryDayKey >= oldest && event.entryDayKey < today && event.entryHour === hour,
    ),
  );
}

function visionMetric(events: RecentEventRow[]) {
  const counter = events.reduce<Counter>((acc, event) => {
    if (event.outcomeClass === "GREEN") acc.greens += 1;
    if (event.outcomeClass === "RED") acc.reds += 1;
    if (event.outcomeClass === "NEUTRAL") acc.neutral += 1;
    if (event.outcomeClass === "GREEN" && event.attempt === "G1") acc.greenG1 += 1;
    if (event.outcomeClass === "GREEN" && event.attempt !== "G1") acc.greenSG += 1;
    if (/^(EMPATE|TIE)/i.test(event.finalResult)) acc.ties += 1;
    if (Date.parse(event.resolvedAt) > Date.parse(acc.updatedAt || ""))
      acc.updatedAt = event.resolvedAt;
    return acc;
  }, cloneCounter());
  const metric = metricFromCounter(counter);
  return { ...counter, ...metric, variation: null as number | null };
}

function variationAgainst(
  current: { completedEntries: number; accuracy: number },
  previous: { completedEntries: number; accuracy: number },
) {
  if (!current.completedEntries || !previous.completedEntries) return null;
  return roundPercent(current.accuracy - previous.accuracy);
}

function visionStability(windows: Array<{ completedEntries: number; accuracy: number }>) {
  const valid = windows
    .filter((window) => window.completedEntries >= 5)
    .map((window) => window.accuracy);
  if (valid.length < 2) return { label: "EM_FORMACAO", spread: null };
  const spread = roundPercent(Math.max(...valid) - Math.min(...valid));
  if (spread <= 5) return { label: "ESTAVEL", spread };
  if (spread <= 10) return { label: "OSCILANDO", spread };
  return { label: "INSTAVEL", spread };
}

function consistencyScore(
  windows: Record<string, { completedEntries: number; accuracy: number }>,
  recent: RecentEventRow[],
  stability: { label: string; spread: number | null },
) {
  const today = windows.today;
  const accuracy = today.accuracy;
  const sample = Math.min(100, (today.completedEntries / 20) * 100);
  const stabilityScore =
    stability.label === "ESTAVEL"
      ? 100
      : stability.label === "OSCILANDO"
        ? 65
        : stability.label === "INSTAVEL"
          ? 25
          : 35;
  const recentMetric = visionMetric(recent);
  const recentScore = recentMetric.completedEntries ? recentMetric.accuracy : 0;
  const redPenaltyScore = Math.max(0, 100 - consecutiveReds(recent) * 30);
  return roundPercent(
    accuracy * 0.4 +
      sample * 0.2 +
      stabilityScore * 0.2 +
      recentScore * 0.15 +
      redPenaltyScore * 0.05,
  );
}

function dailyVisionStatus(
  modules: Array<{
    windows: Record<
      string,
      { completedEntries: number; accuracy: number; variation: number | null }
    >;
    stability: string;
    recentRedStreak: number;
  }>,
  best: {
    windows: Record<
      string,
      { completedEntries: number; accuracy: number; variation: number | null }
    >;
    stability: string;
    recentRedStreak: number;
  } | null,
) {
  if (!modules.length || !best) return "SEM_LEITURA";
  const today = best.windows.today;
  const validAbove89 = [
    best.windows.oneHour,
    best.windows.twoHours,
    best.windows.fourHours,
    today,
  ].filter((window) => window.completedEntries >= 5 && window.accuracy >= 89).length;
  if (
    today.completedEntries >= 10 &&
    today.accuracy >= 89 &&
    validAbove89 >= 2 &&
    best.recentRedStreak < 2 &&
    best.stability !== "INSTAVEL"
  ) {
    return "FAVORAVEL";
  }
  if (
    (today.completedEntries >= 10 && today.accuracy >= 88) ||
    (today.completedEntries < 10 && today.accuracy >= 89) ||
    best.stability === "INSTAVEL"
  ) {
    return "ATENCAO";
  }
  if (modules.every((module) => module.windows.today.accuracy < 88) || best.recentRedStreak >= 2) {
    return "DESFAVORAVEL";
  }
  return "ATENCAO";
}

function dailyVisionSummary(
  status: string,
  best: {
    label: string;
    windows: Record<string, { completedEntries: number; accuracy: number; greens: number }>;
    stability: string;
  } | null,
) {
  if (!best) return "Nenhum modulo possui entradas finalizadas suficientes no momento.";
  const today = best.windows.today;
  if (today.completedEntries < 10) {
    return `${best.label} tem o melhor desempenho parcial, com ${formatPercent(today.accuracy)} em ${today.greens}/${today.completedEntries}. A amostra ainda esta em formacao.`;
  }
  if (status === "FAVORAVEL") {
    return `${best.label} e o modulo mais consistente do dia, com ${formatPercent(today.accuracy)} em ${today.greens}/${today.completedEntries} entradas e estabilidade ${best.stability.toLowerCase()}.`;
  }
  return `O desempenho esta ${best.stability.toLowerCase()}. ${best.label} lidera com ${formatPercent(today.accuracy)} em ${today.greens}/${today.completedEntries}, sem garantia de continuidade.`;
}

function bestHourRange(events: RecentEventRow[], dayKey: string) {
  const today = events.filter((event) => event.entryDayKey === dayKey);
  let best: { start: number; accuracy: number; sample: number } | null = null;
  for (let start = 0; start <= 22; start += 1) {
    const metric = visionMetric(
      today.filter((event) => event.entryHour >= start && event.entryHour < start + 2),
    );
    if (metric.completedEntries < 5) continue;
    if (
      !best ||
      metric.accuracy > best.accuracy ||
      (metric.accuracy === best.accuracy && metric.completedEntries > best.sample)
    ) {
      best = { start, accuracy: metric.accuracy, sample: metric.completedEntries };
    }
  }
  return best
    ? `${String(best.start).padStart(2, "0")}h as ${String(best.start + 2).padStart(2, "0")}h`
    : null;
}

function recentOutcomeSummary(events: RecentEventRow[]) {
  const metric = visionMetric(events);
  return {
    greens: metric.greens,
    reds: metric.reds,
    ties: metric.ties,
    completedEntries: metric.completedEntries,
    accuracy: metric.accuracy,
  };
}

function consecutiveReds(events: RecentEventRow[]) {
  let count = 0;
  for (const event of events) {
    if (event.outcomeClass !== "RED") break;
    count += 1;
  }
  return count;
}

function sequenceToken(event: RecentEventRow) {
  if (/^(EMPATE|TIE)/i.test(event.finalResult)) return "E";
  return event.outcomeClass === "GREEN" ? "G" : event.outcomeClass === "RED" ? "R" : "N";
}

function visionSampleStatus(sample: number) {
  if (sample <= 0) return "SEM_DADOS";
  if (sample <= 4) return "AMOSTRA_BAIXA";
  if (sample <= 9) return "EM_FORMACAO";
  if (sample <= 19) return "AMOSTRA_MODERADA";
  return "AMOSTRA_FORTE";
}

function normalizeSelectedEngines(mode?: string, requested: string[] = []) {
  const available = new Set(CALENDAR_AUDIT_MODULES.map((module) => module.engineKey));
  const selected = requested
    .map((value) => calendarModuleDefinition(value)?.engineKey || "")
    .filter((value) => available.has(value));
  if (mode === "todos" || !selected.length) return [...available];
  return [...new Set(selected)];
}

function calendarOutcomeClass(
  module: CalendarAuditModuleDefinition,
  resultType: string,
): CalendarOutcomeClass {
  if (resultType.startsWith("GREEN")) return "GREEN";
  if (resultType === "RED" || (resultType === "EXPIRADO" && module.tieBehavior === "positive")) {
    return "RED";
  }
  if (resultType.startsWith("EMPATE") || resultType.startsWith("TIE")) {
    return module.tieBehavior === "positive" ? "GREEN" : "NEUTRAL";
  }
  return "NEUTRAL";
}

function normalizeResultType(value: unknown) {
  const normalized = normalizeKey(value).toUpperCase();
  if (!normalized) return "";
  if (normalized === "GREEN SG" || normalized === "GREEN_SG") return "GREEN";
  if (normalized === "GREEN G1" || normalized === "GREEN_G1") return "GREEN_G1";
  if (normalized.startsWith("GREEN")) return normalized.includes("G1") ? "GREEN_G1" : "GREEN";
  if (normalized.startsWith("RED")) return "RED";
  if (normalized.startsWith("EMPATE") || normalized.startsWith("TIE")) {
    return normalized.includes("G1") ? "EMPATE_G1" : "EMPATE";
  }
  if (normalized.startsWith("CANCEL")) return "CANCELADO";
  if (normalized.startsWith("EXPIR")) return "EXPIRADO";
  return "";
}

function normalizeAttempt(value: unknown, resultType: string) {
  const normalized = normalizeKey(value).toUpperCase();
  if (normalized === "G1" || resultType.endsWith("G1")) return "G1";
  if (normalized === "SG" || resultType.startsWith("GREEN")) return "SG";
  return nullableString(value);
}

function calendarAttemptFromIdentity(signalId: string | null, resultId: string) {
  const identity = `${signalId || ""}:${resultId}`.toLowerCase();
  if (/(?:^|:)(?:tie_)?g1(?=:|$)/.test(identity)) return "G1";
  if (/(?:^|:)(?:tie_)?sg(?=:|$)/.test(identity)) return "SG";
  return null;
}

function calendarResultUsesAttempt(resultType: string) {
  return /^(GREEN|EMPATE|TIE)/.test(resultType);
}

function normalizeAggregateRow(value: unknown): AggregateRow | null {
  const row = toRecord(value);
  const date = readString(row.date);
  const engineKey = readString(row.engine_key ?? row.engineKey);
  const hour = readNumber(row.hour);
  if (!isDateKey(date) || !calendarModuleDefinition(engineKey) || hour < 0 || hour > 23)
    return null;
  return {
    date,
    hour,
    engineKey: calendarModuleDefinition(engineKey)?.engineKey || engineKey,
    greens: readNumber(row.greens),
    greenSG: readNumber(row.green_sg ?? row.greenSG),
    greenG1: readNumber(row.green_g1 ?? row.greenG1),
    reds: readNumber(row.reds),
    ties: readNumber(row.ties),
    neutral: readNumber(row.neutral),
    updatedAt: readString(row.updated_at ?? row.updatedAt),
  };
}

function normalizeRecentEventRow(value: unknown): RecentEventRow | null {
  const row = toRecord(value);
  const eventKey = readString(row.event_key ?? row.eventKey);
  const engineKey = calendarModuleDefinition(row.engine_key ?? row.engineKey)?.engineKey || "";
  const entryAt = normalizeIso(row.entry_at ?? row.entryAt);
  const entryDayKey = readString(row.entry_day_key ?? row.entryDayKey);
  const outcomeClass = readString(row.outcome_class ?? row.outcomeClass) as CalendarOutcomeClass;
  if (
    !eventKey ||
    !engineKey ||
    !entryAt ||
    !isDateKey(entryDayKey) ||
    !["GREEN", "RED", "NEUTRAL"].includes(outcomeClass)
  )
    return null;
  return {
    eventKey,
    engineKey,
    entryAt,
    resolvedAt: normalizeIso(row.resolved_at ?? row.resolvedAt) || entryAt,
    entryDayKey,
    entryHour: Math.max(0, Math.min(23, readNumber(row.entry_hour ?? row.entryHour))),
    outcomeClass,
    finalResult: readString(row.final_result ?? row.finalResult),
    attempt: readString(row.attempt),
  };
}

function counterFromRow(row: AggregateRow): Counter {
  return {
    greens: row.greens,
    greenSG: row.greenSG,
    greenG1: row.greenG1,
    reds: row.reds,
    ties: row.ties,
    neutral: row.neutral,
    openEntries: 0,
    updatedAt: row.updatedAt,
  };
}

function cloneCounter(): Counter {
  return { ...EMPTY_COUNTER };
}

function sumCounters(counters: Counter[]) {
  return counters.reduce<Counter>((acc, counter) => {
    acc.greens += counter.greens;
    acc.greenSG += counter.greenSG;
    acc.greenG1 += counter.greenG1;
    acc.reds += counter.reds;
    acc.ties += counter.ties;
    acc.neutral += counter.neutral;
    acc.openEntries += counter.openEntries;
    if (Date.parse(counter.updatedAt || "") > Date.parse(acc.updatedAt || "")) {
      acc.updatedAt = counter.updatedAt;
    }
    return acc;
  }, cloneCounter());
}

function metricFromCounter(counter: Counter) {
  const completedEntries = counter.greens + counter.reds;
  const accuracy = completedEntries ? roundPercent((counter.greens / completedEntries) * 100) : 0;
  return {
    completedEntries,
    accuracy,
    classification: classifyCalendarAccuracy(accuracy, completedEntries),
    sampleStatus: calendarSampleStatus(completedEntries),
  };
}

function sampleLabel(sample: number) {
  if (sample <= 0) return "SEM DADOS";
  if (sample <= 4) return "AMOSTRA BAIXA";
  if (sample <= 9) return "EM FORMACAO";
  return sample >= 10 ? "AMOSTRA VALIDADA" : "SEM DADOS";
}

function sampleObservation(metric: {
  accuracy: number;
  completedEntries: number;
  classification: CalendarAuditClassification;
  sampleStatus: CalendarSampleStatus;
}) {
  if (!metric.completedEntries) return "Sem entradas finalizadas neste periodo.";
  if (metric.sampleStatus === "amostra_baixa") {
    return `${formatPercent(metric.accuracy)} na amostra atual. Amostra baixa.`;
  }
  if (metric.sampleStatus === "em_formacao") {
    return `${formatPercent(metric.accuracy)} na amostra atual. Em formacao.`;
  }
  return `${calendarAccuracyMessage(metric.classification)}.`;
}

function bestModuleStat(rows: Array<Record<string, unknown>>, descending: boolean) {
  return rankMetricRecords(rows.filter(hasCompletedEntries), descending)[0] || null;
}

function bestMetric<T extends { accuracy: number; completedEntries: number }>(
  rows: T[],
  descending: boolean,
) {
  const sampled = rows.filter((row) => row.completedEntries > 0);
  const qualified = sampled.filter((row) => row.completedEntries >= CALENDAR_MIN_CLASSIFIED_SAMPLE);
  const pool = qualified.length ? qualified : sampled;
  return (
    [...pool].sort((first, second) =>
      descending
        ? second.accuracy - first.accuracy || second.completedEntries - first.completedEntries
        : first.accuracy - second.accuracy || second.completedEntries - first.completedEntries,
    )[0] || null
  );
}

function rankMetricRecords<T>(rows: T[], descending: boolean) {
  const sampled = rows.filter((row) => hasCompletedEntries(toRecord(row)));
  const qualified = sampled.filter(
    (row) =>
      readNumber(
        toRecord(row).completedEntries ?? toRecord(row).totalRounds ?? toRecord(row).total,
      ) >= CALENDAR_MIN_CLASSIFIED_SAMPLE,
  );
  const pool = qualified.length ? qualified : sampled;
  return [...pool].sort((first, second) =>
    compareMetricRecords(descending)(toRecord(first), toRecord(second)),
  );
}

function compareMetricRecords(descending: boolean) {
  return (first: Record<string, unknown>, second: Record<string, unknown>) => {
    const firstAccuracy = readNumber(first.accuracy ?? first.score);
    const secondAccuracy = readNumber(second.accuracy ?? second.score);
    const firstSample = readNumber(first.completedEntries ?? first.totalRounds ?? first.total);
    const secondSample = readNumber(second.completedEntries ?? second.totalRounds ?? second.total);
    return descending
      ? secondAccuracy - firstAccuracy || secondSample - firstSample
      : firstAccuracy - secondAccuracy || secondSample - firstSample;
  };
}

function hasCompletedEntries(value: Record<string, unknown>) {
  return readNumber(value.completedEntries ?? value.totalRounds ?? value.total) > 0;
}

function groupRows<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) || []), row]);
  return [...groups.values()];
}

function normalizeSelectedDate(value: unknown, year: number, month: number, today: string) {
  const candidate = readString(value);
  if (isDateKey(candidate) && candidate.startsWith(`${year}-${String(month).padStart(2, "0")}-`)) {
    return candidate;
  }
  if (today.startsWith(`${year}-${String(month).padStart(2, "0")}-`)) return today;
  return dateKey(year, month, 1);
}

function startOfWeek(date: string) {
  return addDays(date, -parseDateKey(date).getUTCDay());
}

function addDays(date: string, amount: number) {
  const parsed = parseDateKey(date);
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return dateKey(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate());
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateKey(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

type ZonedDateParts = {
  date: string;
  year: number;
  month: number;
  day: number;
  hour: number;
};

function zonedDateParts(value: string, timeZone: string): ZonedDateParts {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  const year = readPart("year");
  const month = readPart("month");
  const day = readPart("day");
  return { date: dateKey(year, month, day), year, month, day, hour: readPart("hour") };
}

function monthLabel(year: number, month: number) {
  const labels = [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${labels[month - 1] || month} ${year}`;
}

function formatDateShort(value: string) {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}`;
}

function formatPercent(value: number) {
  return `${roundPercent(value).toFixed(2).replace(".", ",")}%`;
}

function roundPercent(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function normalizeIso(value: unknown) {
  const text = readString(value);
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function nullableString(value: unknown) {
  const text = readString(value);
  return text || null;
}

function normalizeKey(value: unknown) {
  return readString(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function readString(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function readNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function firstValue(...values: unknown[]) {
  return values.find((value) => readString(value)) ?? "";
}

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function toRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
