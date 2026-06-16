import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/useDashboardData";
import { useRoundHistory } from "@/hooks/useRoundHistory";
import { fetchNeuralCalendar } from "@/lib/neuralCalendarApi";
import type {
  NeuralCalendarClassification,
  NeuralCalendarDailyStat,
  NeuralCalendarEngineKey,
  NeuralCalendarHourlyStat,
  NeuralCalendarPayload,
} from "@/types/neuralCalendar";
import {
  buildMinuteHeatSnapshot,
  minuteHeatSideLabel,
  type MinuteHeatBucket,
  type MinuteHeatSide,
  type MinuteHeatSnapshot,
  type MinuteHeatTemperature,
} from "@/utils/minuteHeatEngine";

export const Route = createFileRoute("/app/calendario")({
  component: NeuralCalendarPage,
});

const CALENDAR_START_DATE = "2026-06-10";
const CALENDAR_TIMEZONE = "America/Sao_Paulo";

const engineOptions: Array<{ id: NeuralCalendarEngineKey; label: string }> = [
  { id: "todos", label: "Todos os motores" },
  { id: "neural_pagante", label: "Neural Pagante" },
  { id: "padroes_quentes_ia", label: "Padroes Quentes IA" },
  { id: "surf_analyzer", label: "Surf Analyzer" },
  { id: "radar_empates", label: "Radar de Empates" },
  { id: "tendencia", label: "Tendencia" },
  { id: "personalizado", label: "Personalizado" },
];

const selectableEngineOptions = engineOptions.filter(
  (option) => option.id !== "todos" && option.id !== "personalizado",
);
const hourLabels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, "0")}h`);
const weekdayMeta = [
  { index: 0, label: "DOM", fullLabel: "Domingo" },
  { index: 1, label: "SEG", fullLabel: "Segunda" },
  { index: 2, label: "TER", fullLabel: "Terca" },
  { index: 3, label: "QUA", fullLabel: "Quarta" },
  { index: 4, label: "QUI", fullLabel: "Quinta" },
  { index: 5, label: "SEX", fullLabel: "Sexta" },
  { index: 6, label: "SAB", fullLabel: "Sabado" },
];

interface WeekdayHourCellData {
  label: string;
  hour: number;
  score: number;
  totalRounds: number;
}

function NeuralCalendarPage() {
  const today = useMemo(() => saoPauloTodayParts(), []);
  const { data: liveDashboardData } = useDashboardData();
  const { history: roundHistory } = useRoundHistory(liveDashboardData, !liveDashboardData.mockMode);
  const allowedYears = useMemo(() => [today.year - 1, today.year, today.year + 1], [today.year]);
  const [engineMode, setEngineMode] = useState<NeuralCalendarEngineKey>("todos");
  const [customEngines, setCustomEngines] = useState<NeuralCalendarEngineKey[]>(
    selectableEngineOptions.map((option) => option.id),
  );
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [calendar, setCalendar] = useState<NeuralCalendarPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const selectedEngineKeys = useMemo(
    () =>
      engineMode === "personalizado"
        ? customEngines
        : engineMode === "todos"
          ? selectableEngineOptions.map((option) => option.id)
          : [engineMode],
    [customEngines, engineMode],
  );
  const engineParam = selectedEngineKeys.join(",");
  const engineLabel = useMemo(
    () =>
      engineMode === "personalizado"
        ? `Personalizado (${customEngines.length})`
        : engineOptions.find((option) => option.id === engineMode)?.label || "Todos os motores",
    [customEngines.length, engineMode],
  );

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchNeuralCalendar({
      year,
      month,
      date: selectedDate || undefined,
      range: "este_mes",
      engine: engineMode,
      engines: selectedEngineKeys,
    })
      .then((payload) => {
        if (!active) return;
        setCalendar(payload);
        setSelectedHour(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar o Calendario Neural agora.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [engineMode, engineParam, month, selectedDate, selectedEngineKeys, year]);

  const selectedDay = useMemo(() => {
    if (!calendar || !selectedDate) return null;
    return calendar.month.days.find((day) => day.date === selectedDate) || null;
  }, [calendar, selectedDate]);

  const selectedHourStat = useMemo(() => {
    if (!calendar || selectedHour === null || !selectedDate) return null;
    return calendar.selectedHours.find((hour) => hour.hour === selectedHour) || null;
  }, [calendar, selectedDate, selectedHour]);
  const minuteHeat = useMemo(
    () => buildMinuteHeatSnapshot(roundHistory.todayRounds),
    [roundHistory.todayRounds],
  );

  const canMovePrevious = canMoveMonth(-1, year, month, allowedYears);
  const canMoveNext = canMoveMonth(1, year, month, allowedYears);

  function clearDetailSelection() {
    setSelectedDate("");
    setSelectedHour(null);
  }

  function selectMonth(nextMonth: number) {
    setMonth(nextMonth);
    clearDetailSelection();
  }

  function selectYear(nextYear: number) {
    if (!allowedYears.includes(nextYear)) return;
    setYear(nextYear);
    clearDetailSelection();
  }

  function goToday() {
    setYear(today.year);
    setMonth(today.month);
    setSelectedDate(today.date);
    setSelectedHour(null);
  }

  function moveByMonth(delta: number) {
    if (!canMoveMonth(delta, year, month, allowedYears)) return;
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
    clearDetailSelection();
  }

  return (
    <div className="space-y-4">
      <ModuleHeader />

      <CalendarToolbar
        allowedYears={allowedYears}
        year={year}
        month={month}
        engineMode={engineMode}
        customEngines={customEngines}
        canMovePrevious={canMovePrevious}
        canMoveNext={canMoveNext}
        onMoveMonth={moveByMonth}
        onSelectYear={selectYear}
        onSelectMonth={selectMonth}
        onToday={goToday}
        onEngineModeChange={(value) => {
          setEngineMode(value);
          clearDetailSelection();
        }}
        onCustomEnginesChange={(value) => {
          setCustomEngines(value);
          clearDetailSelection();
        }}
      />

      {status === "error" && (
        <GlassCard className="border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {error || "Nao foi possivel carregar o Calendario Neural agora."}
        </GlassCard>
      )}

      {calendar && status !== "loading" && (
        <BentoStatsGrid calendar={calendar} engineLabel={engineLabel} />
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GlassCard className="p-4">
          <CalendarPanelHeader
            title={calendar?.month.label || `${monthLabels[month - 1]} ${year}`}
            subtitle={`Consulta leve por agregados - ${CALENDAR_TIMEZONE}`}
          />
          {status === "loading" && <CalendarSkeleton />}
          {calendar && status !== "loading" && (
            <>
              <CalendarMonthGrid
                calendar={calendar}
                selectedDate={selectedDate}
                onSelectDate={(date) => {
                  setSelectedDate(date);
                  setSelectedHour(null);
                }}
              />
              <CalendarHoursOverview
                calendar={calendar}
                selectedDate={selectedDate}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
              <MinuteHeatPanel snapshot={minuteHeat} />
            </>
          )}
        </GlassCard>

        <CalendarDetailsPanel
          calendar={calendar}
          selectedDay={selectedDay}
          selectedDate={selectedDate}
          selectedHour={selectedHour}
          selectedHourStat={selectedHourStat}
          engineLabel={engineLabel}
          onSelectHour={setSelectedHour}
          onClear={clearDetailSelection}
        />
      </div>

      {calendar && status !== "loading" && <Rankings calendar={calendar} />}
    </div>
  );
}

function ModuleHeader() {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black tracking-wide">CALENDARIO NEURAL</h1>
          <AppBadge tone="blue">MODULO PREMIUM</AppBadge>
          <AppBadge tone="green">DADOS AGREGADOS</AppBadge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Ano, mes, dia e hora por motor, sem carregar rodadas brutas no navegador.
        </p>
      </div>
      <Button type="button" variant="outline" className="gap-2 rounded-xl border-border/70">
        <Download className="size-4" />
        Exportar
      </Button>
    </div>
  );
}

function CalendarToolbar({
  allowedYears,
  year,
  month,
  engineMode,
  customEngines,
  canMovePrevious,
  canMoveNext,
  onMoveMonth,
  onSelectYear,
  onSelectMonth,
  onToday,
  onEngineModeChange,
  onCustomEnginesChange,
}: {
  allowedYears: number[];
  year: number;
  month: number;
  engineMode: NeuralCalendarEngineKey;
  customEngines: NeuralCalendarEngineKey[];
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onMoveMonth: (delta: number) => void;
  onSelectYear: (year: number) => void;
  onSelectMonth: (month: number) => void;
  onToday: () => void;
  onEngineModeChange: (value: NeuralCalendarEngineKey) => void;
  onCustomEnginesChange: (value: NeuralCalendarEngineKey[]) => void;
}) {
  return (
    <GlassCard className="p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <EngineFilter
          engineMode={engineMode}
          customEngines={customEngines}
          onEngineModeChange={onEngineModeChange}
          onCustomEnginesChange={onCustomEnginesChange}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[430px] xl:grid-cols-1">
          <div className="flex flex-wrap gap-2">
            {allowedYears.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onSelectYear(item)}
                className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                  year === item
                    ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                    : "border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canMovePrevious}
              onClick={() => onMoveMonth(-1)}
              className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <select
              value={month}
              onChange={(event) => onSelectMonth(Number(event.target.value))}
              className="h-10 min-w-[150px] rounded-xl border border-border/70 bg-background px-3 text-sm font-bold"
            >
              {monthLabels.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!canMoveNext}
              onClick={() => onMoveMonth(1)}
              className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Proximo mes"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="h-10 rounded-xl border border-neon-cyan/40 bg-neon-cyan/10 px-4 text-xs font-black text-neon-cyan transition hover:bg-neon-cyan/15"
            >
              Hoje
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function EngineFilter({
  engineMode,
  customEngines,
  onEngineModeChange,
  onCustomEnginesChange,
}: {
  engineMode: NeuralCalendarEngineKey;
  customEngines: NeuralCalendarEngineKey[];
  onEngineModeChange: (value: NeuralCalendarEngineKey) => void;
  onCustomEnginesChange: (value: NeuralCalendarEngineKey[]) => void;
}) {
  function toggleCustomEngine(engine: NeuralCalendarEngineKey) {
    const exists = customEngines.includes(engine);
    if (exists && customEngines.length === 1) return;
    onCustomEnginesChange(
      exists ? customEngines.filter((item) => item !== engine) : [...customEngines, engine],
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-black uppercase tracking-[0.2em] text-neon-cyan">
          Motor
        </span>
        {engineOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onEngineModeChange(option.id)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              engineMode === option.id
                ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                : "border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {engineMode === "personalizado" && (
        <div className="grid gap-2 rounded-xl border border-border/70 bg-background/40 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {selectableEngineOptions.map((option) => {
            const checked = customEngines.includes(option.id);
            return (
              <label
                key={option.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                  checked
                    ? "border-neon-cyan/50 bg-neon-cyan/10 text-foreground"
                    : "border-border/60 bg-secondary/20 text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCustomEngine(option.id)}
                  className="size-4 accent-cyan-400"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BentoStatsGrid({
  calendar,
  engineLabel,
}: {
  calendar: NeuralCalendarPayload;
  engineLabel: string;
}) {
  const summary = calendar.month.summary;
  const totalSignals = monthTotalSignals(calendar);
  const bestHour = calendar.rankings.topHours[0];
  const bestEngine = calendar.rankings.topEngines?.[0];
  const sampleDays = calendar.month.days.filter((day) => day.classification !== "sem_amostra").length;
  const cards: Array<{
    label: string;
    title: string;
    detail: string;
    score?: number;
    total?: number;
  }> = [
    {
      label: "Media do periodo",
      title: sampleDays ? formatPercent(summary.averageScore) : "Sem amostra",
      detail: `${sampleDays} dias com dados`,
      score: summary.averageScore,
      total: sampleDays,
    },
    {
      label: "Melhor hora",
      title: bestHour ? bestHour.label : "-",
      detail: bestHour ? `${formatPercent(bestHour.score)} / ${formatNumber(bestHour.totalRounds)} sinais` : "Sem amostra",
      score: bestHour?.score,
      total: bestHour?.totalRounds,
    },
    {
      label: "Melhor dia",
      title: summary.bestDay ? formatDateShort(summary.bestDay.date) : "-",
      detail: summary.bestDay ? `${formatPercent(summary.bestDay.score)} / ${summary.bestDay.weekday}` : "Sem amostra",
      score: summary.bestDay?.score,
      total: summary.bestDay?.totalRounds,
    },
    {
      label: "Motor / filtro",
      title: bestEngine ? bestEngine.label : engineLabel,
      detail: bestEngine ? `${formatPercent(bestEngine.score)} no mes` : "Filtro atual",
      score: bestEngine?.score,
      total: bestEngine?.totalSignals,
    },
    {
      label: "Total de sinais",
      title: formatNumber(totalSignals),
      detail: "Somente agregados do periodo",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <StatCard key={card.label} {...card} />
      ))}
    </section>
  );
}

function StatCard({
  label,
  title,
  detail,
  score,
  total,
}: {
  label: string;
  title: string;
  detail: string;
  score?: number;
  total?: number;
}) {
  const hasScore = typeof score === "number";
  const visualClass = hasScore ? classifyScore(score || 0, total || 0) : total ? "operavel" : "sem_amostra";
  return (
    <GlassCard className="min-h-[118px] p-3 sm:p-4">
      <div className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
        {label}
      </div>
      <div className={`mt-2 truncate text-xl font-black sm:text-2xl ${classificationTextClass(visualClass)}`}>
        {title}
      </div>
      {hasScore && (
        <div className="mt-1">
          <div className="flex items-center justify-between gap-2">
            <span className={`text-xs font-black ${classificationTextClass(visualClass)}`}>
              {scoreLabel(score || 0, total || 0)}
            </span>
            <ClassificationBadge classification={visualClass} compact />
          </div>
          <ScoreMeter score={score || 0} total={total || 0} className="mt-2" />
        </div>
      )}
      <div className="mt-2 line-clamp-2 text-[11px] text-muted-foreground">{detail}</div>
    </GlassCard>
  );
}

function CalendarPanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-lg font-black">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
      <AppBadge tone="blue">HEATMAP NEURAL</AppBadge>
    </div>
  );
}

function CalendarMonthGrid({
  calendar,
  selectedDate,
  onSelectDate,
}: {
  calendar: NeuralCalendarPayload;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black uppercase text-muted-foreground sm:gap-2">
        {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
        {Array.from({ length: calendar.month.firstWeekday }).map((_, index) => (
          <div key={`blank-${index}`} className="min-h-[66px] rounded-xl border border-transparent" />
        ))}
        {calendar.month.days.map((day) => {
          const beforeStart = day.date < CALENDAR_START_DATE;
          const visualClass = classifyScore(day.score, beforeStart ? 0 : day.totalRounds);
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={`min-h-[62px] rounded-xl border p-1.5 text-left transition sm:min-h-[90px] sm:p-2 ${
                day.date === selectedDate
                  ? `${classificationCardClass(visualClass)} border-violet-300 ring-2 ring-neon-cyan/40 shadow-[0_0_24px_rgba(124,92,255,0.34)]`
                  : `${classificationCardClass(visualClass)} hover:border-neon-cyan/50`
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold text-muted-foreground">{day.day}</span>
                {day.totalRounds > 0 && (
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {formatCompactNumber(day.totalRounds)}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-center">
                <span
                  className={`flex h-8 min-w-8 items-center justify-center rounded-full px-1.5 text-[11px] font-black sm:size-10 sm:text-sm ${classificationBubbleClass(
                    visualClass,
                  )}`}
                >
                  {scoreShortLabel(day.score, beforeStart ? 0 : day.totalRounds)}
                </span>
              </div>
              <div className="mt-1 flex justify-center sm:hidden">
                <ClassificationDot classification={visualClass} />
              </div>
              <div className="mt-1 hidden truncate text-center text-[9px] font-bold sm:block sm:text-[10px]">
                {beforeStart ? "Sem amostra" : classificationLabel(visualClass)}
              </div>
            </button>
          );
        })}
      </div>
      <ClassificationLegend />
    </>
  );
}

function CalendarHoursOverview({
  calendar,
  selectedDate,
  selectedHour,
  onSelectHour,
}: {
  calendar: NeuralCalendarPayload;
  selectedDate: string;
  selectedHour: number | null;
  onSelectHour: (hour: number) => void;
}) {
  const selectedDay = calendar.month.days.find((day) => day.date === selectedDate) || null;
  const weekdayRows = buildWeekdayHourRows(calendar);
  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-neon-cyan/20 bg-background/30 p-3 sm:p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neon-cyan">
            Horarios organizados
          </div>
          <div className="text-xs text-muted-foreground">
            Mapa leve por hora usando apenas agregados do calendario.
          </div>
        </div>
        <div className="text-[9px] font-bold uppercase leading-tight text-muted-foreground sm:text-[10px]">
          89-100 bom · 85-88 oper. · 0-84 ruim
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-xl border border-border/60 bg-secondary/10 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
              {selectedDay.weekday} · {formatDateShort(selectedDay.date)}
            </div>
            <ClassificationBadge classification={classifyScore(selectedDay.score, selectedDay.totalRounds)} compact />
          </div>
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-12 2xl:grid-cols-24">
            {calendar.selectedHours.map((hour) => (
              <CompactHourButton
                key={hour.id}
                hour={hour.hour}
                score={hour.score}
                total={hour.totalRounds}
                selected={selectedHour === hour.hour}
                onClick={() => onSelectHour(hour.hour)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <div
          className="grid items-center gap-0.5 text-center"
          style={{ gridTemplateColumns: "42px repeat(24, minmax(18px, 1fr))" }}
        >
          <div />
          {hourLabels.map((hour) => (
            <div key={hour} className="text-[7px] font-black leading-none text-muted-foreground xl:text-[8px]">
              {hour}
            </div>
          ))}
          {weekdayRows.map((row) => (
            <div key={row.label} className="contents">
              <div className="text-left text-[9px] font-black uppercase text-muted-foreground">
                {row.label}
              </div>
              {row.hours.map((cell) => (
                <WeekdayHourCell key={`${row.label}-${cell.hour}`} cell={cell} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {weekdayRows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 text-[10px] font-black uppercase text-muted-foreground">{row.fullLabel}</div>
            <div className="grid grid-cols-6 gap-1.5">
              {row.hours.map((cell) => (
                <WeekdayHourCell key={`${row.label}-${cell.hour}`} cell={cell} showHour />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MinuteHeatPanel({ snapshot }: { snapshot: MinuteHeatSnapshot }) {
  const currentBucket = snapshot.buckets[snapshot.minute];
  const hasWindowSample = snapshot.windowTotalRounds >= 3 && snapshot.temperature !== "sem_amostra";
  return (
    <div className="mt-4 rounded-2xl border border-neon-cyan/20 bg-background/35 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-neon-cyan">
            Temperatura minuto a minuto
          </div>
          <div className="text-xs text-muted-foreground">
            Hora atual {String(snapshot.hour).padStart(2, "0")}h · janela viva de {snapshot.windowMinutes} min.
          </div>
        </div>
        <div className={`rounded-xl border px-3 py-2 text-right ${minuteHeatTemperatureClass(snapshot.temperature)}`}>
          <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">Agora</div>
          <div className="text-lg font-black leading-none">
            {hasWindowSample ? formatPercent(snapshot.score) : "--"}
          </div>
          <div className="mt-1 text-[9px] font-black uppercase leading-tight">
            {minuteHeatTemperatureLabel(snapshot.temperature)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <MinuteHeatMetric
          label="Dominante"
          value={minuteHeatSideLabel(snapshot.dominantSide)}
          side={snapshot.dominantSide}
        />
        <MinuteHeatMetric
          label="Rodadas janela"
          value={formatNumber(snapshot.windowTotalRounds)}
        />
        <MinuteHeatMetric
          label="Tendencia"
          value={minuteHeatTrendLabel(snapshot.trend)}
        />
        <MinuteHeatMetric
          label="Minuto atual"
          value={`${String(snapshot.hour).padStart(2, "0")}:${String(snapshot.minute).padStart(2, "0")}`}
        />
      </div>

      <div className="mt-3 grid grid-cols-10 gap-1 sm:grid-cols-12 xl:grid-cols-[repeat(20,minmax(0,1fr))]">
        {snapshot.buckets.map((bucket) => (
          <MinuteHeatCell
            key={bucket.minute}
            bucket={bucket}
            isCurrent={bucket.minute === snapshot.minute}
            isFuture={bucket.minute > snapshot.minute}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>Quadrado = minuto da hora atual.</span>
        <span>Azul Player · Vermelho Banker · Amarelo Tie.</span>
        <span>Nao envia entrada, so mede a temperatura.</span>
        {currentBucket?.total ? (
          <span>
            Minuto {String(currentBucket.minute).padStart(2, "0")}: {formatNumber(currentBucket.total)} rodada(s).
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MinuteHeatMetric({
  label,
  value,
  side = "NONE",
}: {
  label: string;
  value: string;
  side?: MinuteHeatSide;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/15 px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-black ${minuteHeatSideTextClass(side)}`}>{value}</div>
    </div>
  );
}

function MinuteHeatCell({
  bucket,
  isCurrent,
  isFuture,
}: {
  bucket: MinuteHeatBucket;
  isCurrent: boolean;
  isFuture: boolean;
}) {
  const display = bucket.total ? minuteHeatShortSide(bucket.dominantSide) : "-";
  return (
    <div
      title={`${String(bucket.minute).padStart(2, "0")}min · ${
        bucket.total ? `${formatPercent(bucket.score)} ${minuteHeatSideLabel(bucket.dominantSide)}` : "Sem amostra"
      }`}
      className={`min-h-[34px] rounded-md border px-0.5 py-1 text-center transition ${
        isCurrent ? "ring-2 ring-neon-cyan/45" : ""
      } ${isFuture ? "opacity-40" : ""} ${minuteHeatCellClass(bucket)}`}
    >
      <div className="text-[7px] font-black leading-none text-muted-foreground">
        {String(bucket.minute).padStart(2, "0")}
      </div>
      <div className={`mt-1 text-[10px] font-black leading-none ${minuteHeatSideTextClass(bucket.dominantSide)}`}>
        {display}
      </div>
      {bucket.total > 0 && (
        <div className="mt-0.5 text-[7px] font-black leading-none text-muted-foreground">
          {Math.round(bucket.score)}%
        </div>
      )}
    </div>
  );
}

function CompactHourButton({
  hour,
  score,
  total,
  selected,
  onClick,
}: {
  hour: number;
  score: number;
  total: number;
  selected: boolean;
  onClick: () => void;
}) {
  const visualClass = classifyScore(score, total);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${String(hour).padStart(2, "0")}:00 · ${total ? formatPercent(score) : "Sem amostra"}`}
      className={`min-h-10 rounded-lg border px-1 py-1 text-center transition ${
        selected
          ? `${classificationCardClass(visualClass)} border-violet-300 ring-2 ring-neon-cyan/35`
          : classificationCardClass(visualClass)
      }`}
    >
      <div className="text-[9px] font-bold text-muted-foreground">{String(hour).padStart(2, "0")}h</div>
      <div className={`text-[11px] font-black ${classificationTextClass(visualClass)}`}>
        {scoreShortLabel(score, total)}
      </div>
    </button>
  );
}

function WeekdayHourCell({
  cell,
  showHour = false,
}: {
  cell: WeekdayHourCellData;
  showHour?: boolean;
}) {
  const visualClass = classifyScore(cell.score, cell.totalRounds);
  const cellSizeClass = showHour ? "min-h-[34px] flex-col gap-0.5 px-0.5" : "h-[20px] px-0";
  const scoreSizeClass = showHour ? "text-[9px]" : "text-[6px] xl:text-[7px] 2xl:text-[8px]";
  return (
    <div
      title={`${cell.label} ${String(cell.hour).padStart(2, "0")}:00 · ${
        cell.totalRounds ? formatPercent(cell.score) : "Sem amostra"
      }`}
      className={`flex min-w-0 items-center justify-center overflow-hidden rounded-[4px] border py-1 text-center ${cellSizeClass} ${classificationCardClass(visualClass)}`}
    >
      {showHour && <div className="text-[8px] font-bold text-muted-foreground">{String(cell.hour).padStart(2, "0")}h</div>}
      <div className={`whitespace-nowrap font-black leading-none ${scoreSizeClass} ${classificationTextClass(visualClass)}`}>
        {cell.totalRounds ? `${Math.round(cell.score)}%` : "-"}
      </div>
    </div>
  );
}

function CalendarDetailsPanel({
  calendar,
  selectedDay,
  selectedDate,
  selectedHour,
  selectedHourStat,
  engineLabel,
  onSelectHour,
  onClear,
}: {
  calendar: NeuralCalendarPayload | null;
  selectedDay: NeuralCalendarDailyStat | null;
  selectedDate: string;
  selectedHour: number | null;
  selectedHourStat: NeuralCalendarHourlyStat | null;
  engineLabel: string;
  onSelectHour: (hour: number) => void;
  onClear: () => void;
}) {
  const floatingClass = selectedDate
    ? "fixed inset-x-3 bottom-20 z-40 max-h-[72vh] overflow-y-auto xl:static xl:max-h-none xl:overflow-visible"
    : "";

  return (
    <div className={`space-y-4 ${floatingClass}`}>
      <GlassCard className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-black">
              {selectedHourStat
                ? `Detalhe da hora`
                : selectedDay
                  ? `Detalhe do dia`
                  : "Resumo do mes"}
            </div>
            <div className="text-xs text-muted-foreground">{engineLabel}</div>
          </div>
          {selectedDate && (
            <button
              type="button"
              onClick={onClear}
              className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
              aria-label="Fechar detalhes"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {!calendar ? (
          <div className="text-sm text-muted-foreground">Carregando inteligencia historica...</div>
        ) : selectedHourStat ? (
          <HourPanelContent hour={selectedHourStat} />
        ) : selectedDay ? (
          <DayPanelContent day={selectedDay} hours={calendar.selectedHours} />
        ) : (
          <MonthOverview calendar={calendar} engineLabel={engineLabel} />
        )}
      </GlassCard>
      {calendar && selectedDay && (
        <DailyHoursGrid
          hours={calendar.selectedHours}
          selectedHour={selectedHour}
          onSelectHour={onSelectHour}
        />
      )}
    </div>
  );
}

function MonthOverview({ calendar, engineLabel }: { calendar: NeuralCalendarPayload; engineLabel: string }) {
  const summary = calendar.month.summary;
  const totalSignals = monthTotalSignals(calendar);
  const bestHour = calendar.rankings.topHours[0];
  const counts = visualMonthCounts(calendar);
  return (
    <div className="space-y-3">
      <Metric label="Periodo" value={calendar.month.label} />
      <Metric label="Motor/filtro" value={engineLabel} />
      <Metric label="Total de sinais" value={formatNumber(totalSignals)} />
      <Metric
        label="Media"
        value={summary.averageScore ? formatPercent(summary.averageScore) : "Sem amostra"}
        tone={summary.averageScore >= 89 ? "green" : summary.averageScore >= 85 ? "amber" : undefined}
      />
      <ScoreSparkline
        points={calendar.month.days.map((day) => ({
          label: String(day.day),
          score: day.score,
          total: day.totalRounds,
        }))}
      />
      <Metric
        label="Melhor dia"
        value={summary.bestDay ? `${formatDateShort(summary.bestDay.date)} (${formatPercent(summary.bestDay.score)})` : "Sem amostra"}
      />
      <Metric
        label="Melhor hora"
        value={bestHour ? `${bestHour.label} (${formatPercent(bestHour.score)})` : "Sem amostra"}
      />
      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Resumo do mes
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <CountPill classification="muito_pagante" label="Dias muito bons" value={counts.muito_pagante} />
          <CountPill classification="operavel" label="Dias operaveis" value={counts.operavel} />
          <CountPill classification="perigoso" label="Dias ruins" value={counts.perigoso} />
          <CountPill classification="sem_amostra" label="Sem amostra" value={counts.sem_amostra} />
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
        Selecione um dia no calendario para abrir as 24 horas. Clique em uma hora para ver o detalhe fino.
      </div>
    </div>
  );
}

function DayPanelContent({ day, hours }: { day: NeuralCalendarDailyStat; hours: NeuralCalendarHourlyStat[] }) {
  const visualClass = classifyScore(day.score, day.totalRounds);
  const hasSample = visualClass !== "sem_amostra";
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground">{formatDateLong(day.date)}</div>
          <div className={`mt-2 text-4xl font-black sm:text-5xl ${classificationTextClass(visualClass)}`}>
            {hasSample ? formatPercent(day.score) : "--"}
          </div>
          <ClassificationBadge classification={visualClass} className="mt-2" />
          <ScoreMeter score={day.score} total={day.totalRounds} className="mt-3" />
          <ScoreSparkline
            points={hours.map((hour) => ({
              label: `${String(hour.hour).padStart(2, "0")}h`,
              score: hour.score,
              total: hour.totalRounds,
            }))}
            className="mt-3"
          />
        </div>
        <AppBadge tone={visualClass === "perigoso" ? "red" : hasSample ? "green" : "amber"}>
          {day.weekday}
        </AppBadge>
      </div>
      <div className="grid gap-2 text-sm">
        <Metric label="Total de sinais" value={formatNumber(day.totalRounds)} />
        <Metric label="Greens" value={formatNumber(day.greens)} tone="green" />
        <Metric label="Reds" value={formatNumber(day.reds)} tone="red" />
        <Metric label="Empates" value={formatNumber(day.ties)} tone="amber" />
        <Metric label="Assertividade" value={day.totalRounds ? formatPercent(day.accuracy) : "Sem amostra"} />
        <Metric label="Melhor hora" value={day.bestHour || "Sem dados"} />
        <Metric label="Pior hora" value={day.worstHour || "Sem dados"} />
        <Metric label="Melhor forca" value={forceLabel(day.bestForce)} />
      </div>
      <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
        {day.observation}
      </div>
    </div>
  );
}

function HourPanelContent({ hour }: { hour: NeuralCalendarHourlyStat }) {
  const visualClass = classifyScore(hour.score, hour.totalRounds);
  const hasSample = visualClass !== "sem_amostra";
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground">
            {formatDateShort(hour.date)} - {String(hour.hour).padStart(2, "0")}:00
          </div>
          <div className={`mt-2 text-4xl font-black sm:text-5xl ${classificationTextClass(visualClass)}`}>
            {hasSample ? formatPercent(hour.score) : "--"}
          </div>
          <ClassificationBadge classification={visualClass} className="mt-2" />
          <ScoreMeter score={hour.score} total={hour.totalRounds} className="mt-3" />
        </div>
        <AppBadge tone={visualClass === "perigoso" ? "red" : hasSample ? "green" : "amber"}>
          {hasSample ? "Com amostra" : "Sem amostra"}
        </AppBadge>
      </div>
      <div className="grid gap-2 text-sm">
        <Metric label="Total de sinais" value={formatNumber(hour.totalRounds)} />
        <Metric label="Greens" value={formatNumber(hour.greens)} tone="green" />
        <Metric label="Reds" value={formatNumber(hour.reds)} tone="red" />
        <Metric label="Empates" value={formatNumber(hour.ties)} tone="amber" />
        <Metric label="Assertividade" value={hour.totalRounds ? formatPercent(hour.accuracy) : "Sem amostra"} />
      </div>
      <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
        <ForceBar label="Banker" value={hour.bankerPercent} className="bg-red-400" />
        <ForceBar label="Player" value={hour.playerPercent} className="bg-blue-400" />
        <ForceBar label="Tie" value={hour.tiePercent} className="bg-yellow-400" />
      </div>
      <div className="grid gap-2 text-xs">
        <InfoLine icon={<ShieldCheck className="size-4" />} label="Melhor modulo" value={hour.bestModule || "Sem dados"} />
        <InfoLine icon={<BarChart3 className="size-4" />} label="Melhor leitura" value={hour.bestReading || "Sem dados"} />
      </div>
    </div>
  );
}

function DailyHoursGrid({
  hours,
  selectedHour,
  onSelectHour,
}: {
  hours: NeuralCalendarHourlyStat[];
  selectedHour: number | null;
  onSelectHour: (hour: number) => void;
}) {
  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black">Desempenho por horario</div>
          <div className="text-[10px] text-muted-foreground">24 horas do dia selecionado.</div>
        </div>
        <AppBadge tone="blue">24H</AppBadge>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4">
        {hours.map((hour) => {
          const visualClass = classifyScore(hour.score, hour.totalRounds);
          return (
            <button
              key={hour.id}
              type="button"
              onClick={() => onSelectHour(hour.hour)}
              className={`min-h-[56px] rounded-lg border p-1.5 text-center transition ${
                selectedHour === hour.hour
                  ? `${classificationCardClass(visualClass)} border-violet-300 ring-2 ring-neon-cyan/35`
                  : classificationCardClass(visualClass)
              }`}
            >
              <div className="text-[9px] font-bold text-muted-foreground">
                {String(hour.hour).padStart(2, "0")}:00
              </div>
              <div className={`mt-1 text-base font-black leading-none ${classificationTextClass(visualClass)}`}>
                {scoreShortLabel(hour.score, hour.totalRounds)}
              </div>
              <div className="mt-1 flex justify-center">
                <ClassificationDot classification={visualClass} />
              </div>
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}

function ScoreSparkline({
  points,
  className = "",
}: {
  points: Array<{ label: string; score: number; total: number }>;
  className?: string;
}) {
  const sampled = points.filter((point) => point.total > 0);
  if (sampled.length < 2) {
    return (
      <div className={`rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground ${className}`}>
        Grafico aparece quando houver mais de uma amostra no periodo.
      </div>
    );
  }

  const width = 280;
  const height = 78;
  const padX = 8;
  const padY = 10;
  const minScore = Math.min(...sampled.map((point) => point.score), 84);
  const maxScore = Math.max(...sampled.map((point) => point.score), 100);
  const spread = Math.max(1, maxScore - minScore);
  const coords = sampled.map((point, index) => {
    const x = padX + (index / Math.max(1, sampled.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.score - minScore) / spread) * (height - padY * 2);
    return { ...point, x, y };
  });
  const linePath = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${height - padY} L${coords[0].x.toFixed(1)},${height - padY} Z`;
  const last = coords[coords.length - 1];

  return (
    <div className={`rounded-xl border border-neon-cyan/20 bg-background/50 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Grafico neural</div>
        <div className={`text-xs font-black ${classificationTextClass(classifyScore(last.score, last.total))}`}>
          {formatPercent(last.score)}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[78px] w-full" role="img" aria-label="Grafico de desempenho neural">
        <path d={areaPath} fill="rgb(52 211 153)" opacity="0.12" />
        <path d={linePath} fill="none" stroke="rgb(52 211 153)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {coords.map((point) => (
          <circle
            key={`${point.label}-${point.x}`}
            cx={point.x}
            cy={point.y}
            r="2.8"
            fill={classificationSvgColor(classifyScore(point.score, point.total))}
          />
        ))}
      </svg>
    </div>
  );
}

function Rankings({ calendar }: { calendar: NeuralCalendarPayload }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black">
        <BarChart3 className="size-4 text-neon-cyan" />
        Rankings do periodo
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <VisualRankingList
          title="Top 5 horarios"
          rows={calendar.rankings.topHours.slice(0, 5).map((item) => ({
            label: item.label,
            value: formatPercent(item.score),
            detail: `${formatNumber(item.totalRounds)} sinais`,
          }))}
        />
        <VisualRankingList
          title="Top 5 dias da semana"
          rows={calendar.rankings.topWeekdays.slice(0, 5).map((item) => ({
            label: item.weekday,
            value: formatPercent(item.score),
            detail: `${item.total} dias`,
          }))}
        />
        <VisualRankingList
          title="Top 5 dias do mes"
          rows={calendar.rankings.topMonthDays.slice(0, 5).map((item) => ({
            label: item.label,
            value: formatPercent(item.score),
            detail: `${formatNumber(item.totalRounds)} sinais`,
          }))}
        />
        <VisualRankingList
          title="Top motores"
          rows={(calendar.rankings.topEngines || []).map((item) => ({
            label: item.label,
            value: formatPercent(item.score),
            detail: `${formatNumber(item.totalSignals)} sinais`,
          }))}
        />
      </div>
    </GlassCard>
  );
}

function RankingList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-black uppercase text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {rows.length ? (
          rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
            >
              <div>
                <div className="text-sm font-bold">
                  {index + 1}º {row.label}
                </div>
                <div className="text-[10px] text-muted-foreground">{row.detail}</div>
              </div>
              <div className="font-black text-neon-cyan">{row.value}</div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
            Sem amostra real.
          </div>
        )}
      </div>
    </div>
  );
}

function VisualRankingList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-black uppercase text-muted-foreground">{title}</div>
      <div className="space-y-2">
        {rows.length ? (
          rows.map((row, index) => {
            const score = percentStringToNumber(row.value);
            const visualClass = classifyScore(score, Number.isFinite(score) ? 1 : 0);
            return (
              <div
                key={`${row.label}-${index}`}
                className="rounded-xl border border-border/60 bg-background/40 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {index + 1}º {row.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{row.detail}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-black ${classificationTextClass(visualClass)}`}>
                      {formatPercent(score)}
                    </div>
                    <ClassificationBadge classification={visualClass} compact />
                  </div>
                </div>
                <ScoreMeter score={score} total={Number.isFinite(score) ? 1 : 0} className="mt-2" />
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
            Sem amostra real.
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 35 }).map((_, index) => (
        <div key={index} className="h-[76px] animate-pulse rounded-xl bg-secondary/30" />
      ))}
    </div>
  );
}

function ClassificationLegend() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
      <LegendDot className="bg-emerald-400" label="89-100 Muito bom para operar" />
      <LegendDot className="bg-yellow-400" label="85-88 Operavel" />
      <LegendDot className="bg-red-400" label="0-84 Ruim - nao operar" />
      <LegendDot className="bg-slate-500" label="Sem amostra" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`size-3 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function ClassificationBadge({
  classification,
  compact = false,
  className = "",
}: {
  classification: NeuralCalendarClassification;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-black uppercase ${
        compact ? "text-[8px]" : "text-[10px] tracking-[0.12em]"
      } ${classificationPillClass(classification)} ${className}`}
    >
      <ClassificationDot classification={classification} />
      <span>{classificationLabel(classification)}</span>
    </div>
  );
}

function ClassificationDot({ classification }: { classification: NeuralCalendarClassification }) {
  return <span className={`inline-block size-2 rounded-full ${classificationDotClass(classification)}`} />;
}

function CountPill({
  classification,
  label,
  value,
}: {
  classification: NeuralCalendarClassification;
  label: string;
  value: number;
}) {
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${classificationCardClass(classification)}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
        <ClassificationDot classification={classification} />
        {label}
      </div>
      <div className={`mt-1 text-lg font-black ${classificationTextClass(classification)}`}>{value}</div>
    </div>
  );
}

function ScoreMeter({ score, total, className = "" }: { score: number; total: number; className?: string }) {
  const visualClass = classifyScore(score, total);
  const width = visualClass === "sem_amostra" ? 0 : Math.max(2, Math.min(100, Number(score) || 0));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-secondary/60 ${className}`}>
      <div
        className={`h-full rounded-full transition-all ${classificationFillClass(visualClass)}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "amber" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-right font-black ${
          tone === "green"
            ? "text-emerald-300"
            : tone === "red"
              ? "text-red-300"
              : tone === "amber"
                ? "text-yellow-300"
                : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ForceBar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="grid grid-cols-[54px_1fr_46px] items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="h-2 rounded-full bg-secondary/60">
        <div className={`h-2 rounded-full ${className}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="text-right font-bold">{formatPercent(value)}</span>
    </div>
  );
}

function InfoLine({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="text-neon-cyan">{icon}</div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
        <div className="font-black">{value}</div>
      </div>
    </div>
  );
}

function buildWeekdayHourRows(calendar: NeuralCalendarPayload) {
  const buckets = new Map<string, { weightedScore: number; totalRounds: number }>();
  for (const item of calendar.month.heatmap) {
    const weekday = weekdayIndexFromDate(item.date);
    const key = `${weekday}:${item.hour}`;
    const current = buckets.get(key) || { weightedScore: 0, totalRounds: 0 };
    const totalRounds = Math.max(0, Math.floor(Number(item.totalRounds) || 0));
    current.weightedScore += (Number(item.score) || 0) * totalRounds;
    current.totalRounds += totalRounds;
    buckets.set(key, current);
  }

  return weekdayMeta.map((weekday) => ({
    ...weekday,
    hours: Array.from({ length: 24 }, (_, hour): WeekdayHourCellData => {
      const bucket = buckets.get(`${weekday.index}:${hour}`);
      const totalRounds = bucket?.totalRounds ?? 0;
      return {
        label: weekday.fullLabel,
        hour,
        score: totalRounds ? Math.round((bucket?.weightedScore ?? 0) / totalRounds) : 0,
        totalRounds,
      };
    }),
  }));
}

function weekdayIndexFromDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
  return parsed.getUTCDay();
}

function canMoveMonth(delta: number, year: number, month: number, allowedYears: number[]) {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  const nextYear = next.getUTCFullYear();
  return allowedYears.includes(nextYear);
}

function monthTotalSignals(calendar: NeuralCalendarPayload) {
  return calendar.month.days.reduce((sum, day) => sum + day.totalRounds, 0);
}

function minuteHeatTemperatureLabel(value: MinuteHeatTemperature) {
  if (value === "quente") return "Mesa quente";
  if (value === "operavel") return "Operavel";
  if (value === "frio") return "Fria";
  return "Sem amostra";
}

function minuteHeatTrendLabel(value: MinuteHeatSnapshot["trend"]) {
  if (value === "aquecendo") return "Aquecendo";
  if (value === "esfriando") return "Esfriando";
  if (value === "estavel") return "Estavel";
  return "Sem amostra";
}

function minuteHeatTemperatureClass(value: MinuteHeatTemperature) {
  if (value === "quente") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (value === "operavel") return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
  if (value === "frio") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-border/60 bg-secondary/20 text-muted-foreground";
}

function minuteHeatCellClass(bucket: MinuteHeatBucket) {
  if (!bucket.total || bucket.temperature === "sem_amostra") return "border-border/60 bg-secondary/20";
  if (bucket.dominantSide === "PLAYER") return "border-sky-400/30 bg-sky-500/12";
  if (bucket.dominantSide === "BANKER") return "border-red-400/30 bg-red-500/12";
  if (bucket.dominantSide === "TIE") return "border-yellow-400/30 bg-yellow-500/12";
  return "border-border/60 bg-secondary/20";
}

function minuteHeatSideTextClass(value: MinuteHeatSide) {
  if (value === "PLAYER") return "text-sky-300";
  if (value === "BANKER") return "text-red-300";
  if (value === "TIE") return "text-yellow-300";
  return "text-foreground";
}

function minuteHeatShortSide(value: MinuteHeatSide) {
  if (value === "PLAYER") return "P";
  if (value === "BANKER") return "B";
  if (value === "TIE") return "T";
  return "-";
}

function classificationLabel(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "Muito bom para operar";
  if (value === "operavel") return "Operavel";
  if (value === "perigoso") return "Ruim - nao operar";
  return "Sem amostra";
}

function classificationCardClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "border-emerald-400/20 bg-emerald-500/12";
  if (value === "operavel") return "border-yellow-400/20 bg-yellow-500/12";
  if (value === "perigoso") return "border-red-400/20 bg-red-500/12";
  return "border-border/60 bg-secondary/20";
}

function classificationBubbleClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "bg-emerald-500/25 text-emerald-200";
  if (value === "operavel") return "bg-yellow-500/25 text-yellow-200";
  if (value === "perigoso") return "bg-red-500/25 text-red-200";
  return "bg-slate-500/20 text-slate-300";
}

function classificationTextClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "text-emerald-300";
  if (value === "operavel") return "text-yellow-300";
  if (value === "perigoso") return "text-red-300";
  return "text-muted-foreground";
}

function classificationDotClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]";
  if (value === "operavel") return "bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]";
  if (value === "perigoso") return "bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]";
  return "bg-slate-500";
}

function classificationFillClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "bg-emerald-400";
  if (value === "operavel") return "bg-yellow-400";
  if (value === "perigoso") return "bg-red-400";
  return "bg-slate-500";
}

function classificationSvgColor(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "rgb(52 211 153)";
  if (value === "operavel") return "rgb(250 204 21)";
  if (value === "perigoso") return "rgb(248 113 113)";
  return "rgb(100 116 139)";
}

function classificationPillClass(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (value === "operavel") return "border-yellow-400/30 bg-yellow-500/10 text-yellow-200";
  if (value === "perigoso") return "border-red-400/30 bg-red-500/10 text-red-200";
  return "border-border/60 bg-secondary/30 text-slate-300";
}

function classifyScore(score: number, total: number): NeuralCalendarClassification {
  if (!total) return "sem_amostra";
  if (score >= 89) return "muito_pagante";
  if (score >= 85) return "operavel";
  return "perigoso";
}

function scoreLabel(score: number, total: number) {
  return total ? formatPercent(score) : "Sem amostra";
}

function scoreShortLabel(score: number, total: number) {
  return total ? `${Math.round(Number(score) || 0)}%` : "-";
}

function percentStringToNumber(value: string) {
  const normalized = value.replace("%", "").replace(/\./g, "").replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function visualMonthCounts(calendar: NeuralCalendarPayload) {
  return calendar.month.days.reduce(
    (counts, day) => {
      const classification = classifyScore(day.score, day.totalRounds);
      counts[classification] += 1;
      return counts;
    },
    {
      muito_pagante: 0,
      operavel: 0,
      perigoso: 0,
      sem_amostra: 0,
    } as Record<NeuralCalendarClassification, number>,
  );
}

function formatPercent(value: number) {
  return `${(Number(value) || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

function formatNumber(value: number) {
  return Math.max(0, Math.floor(Number(value) || 0)).toLocaleString("pt-BR");
}

function formatCompactNumber(value: number) {
  const safe = Math.max(0, Math.floor(Number(value) || 0));
  if (safe >= 1000) return `${Math.floor(safe / 1000)}k`;
  return String(safe);
}

function formatDateShort(date: string) {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateLong(date: string) {
  const [year, month, day] = date.split("-");
  return `${day} ${monthLabels[Number(month) - 1] || "Mes"} ${year}`;
}

function forceLabel(value: string) {
  if (value === "BANKER") return "Banker";
  if (value === "PLAYER") return "Player";
  if (value === "TIE") return "Tie";
  return "Sem leitura";
}

function saoPauloTodayParts() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CALENDAR_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.year);
  const month = Number(byType.month);
  const day = Number(byType.day);
  return {
    year,
    month,
    day,
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

const monthLabels = [
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
