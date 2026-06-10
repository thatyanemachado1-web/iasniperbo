import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Download,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { Button } from "@/components/ui/button";
import { fetchNeuralCalendar } from "@/lib/neuralCalendarApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import type {
  NeuralCalendarClassification,
  NeuralCalendarDailyStat,
  NeuralCalendarHourlyStat,
  NeuralCalendarPayload,
} from "@/types/neuralCalendar";

export const Route = createFileRoute("/app/calendario")({
  component: NeuralCalendarPage,
});

const rangeOptions = [
  { id: "hoje", label: "Hoje" },
  { id: "ontem", label: "Ontem" },
  { id: "7_dias", label: "7 dias" },
  { id: "30_dias", label: "30 dias" },
  { id: "90_dias", label: "90 dias" },
  { id: "este_mes", label: "Este mes" },
  { id: "mes_passado", label: "Mes passado" },
  { id: "este_ano", label: "Este ano" },
  { id: "ano_passado", label: "Ano passado" },
] as const;

function NeuralCalendarPage() {
  const session = readUserSession();
  const fullAccess = hasFullAccess(session);
  const now = new Date();
  const [range, setRange] = useState("este_mes");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState("");
  const [calendar, setCalendar] = useState<NeuralCalendarPayload | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!fullAccess) return;
    let active = true;
    setStatus("loading");
    fetchNeuralCalendar({ year, month, date: selectedDate, range })
      .then((payload) => {
        if (!active) return;
        setCalendar(payload);
        setSelectedDate(payload.selected.date);
        setSelectedHour(null);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar Calendario Neural.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [fullAccess, month, range, selectedDate, year]);

  const selectedHourStat = useMemo(() => {
    if (!calendar || selectedHour === null) return null;
    return calendar.selectedHours.find((hour) => hour.hour === selectedHour) || null;
  }, [calendar, selectedHour]);

  if (!fullAccess) {
    return (
      <div className="space-y-4">
        <ModuleHeader />
        <GlassCard className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-black">Calendario Neural premium</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Disponivel para usuarios Premium e VIP com historico real coletado.
              </p>
            </div>
            <Link
              to="/app/planos"
              className="inline-flex items-center justify-center gap-2 rounded-xl btn-gold-grad px-4 py-3 text-sm font-black"
            >
              <Crown className="size-4" />
              Liberar Premium
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ModuleHeader />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {rangeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRange(option.id)}
                    className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                      range === option.id
                        ? "border-neon-cyan/60 bg-neon-cyan/15 text-neon-cyan"
                        : "border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={month}
                  onChange={(event) => {
                    setSelectedDate("");
                    setMonth(Number(event.target.value));
                  }}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-bold"
                >
                  {monthLabels.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={year}
                  onChange={(event) => {
                    setSelectedDate("");
                    setYear(Number(event.target.value));
                  }}
                  className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-bold"
                >
                  {(calendar?.years.length ? calendar.years : [year]).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => moveMonth(-1, year, month, setYear, setMonth, setSelectedDate)}
                className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div className="text-center">
                <div className="text-xl font-black">
                  {calendar?.month.label || `${monthLabels[month - 1]} ${year}`}
                </div>
                <div className="text-xs text-muted-foreground">Coleta real desde 10/06/2026</div>
              </div>
              <button
                type="button"
                onClick={() => moveMonth(1, year, month, setYear, setMonth, setSelectedDate)}
                className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-secondary/20 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {status === "loading" && <CalendarSkeleton />}
            {status === "error" && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                {error}
              </div>
            )}
            {calendar && status !== "loading" && (
              <>
                <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-black uppercase text-muted-foreground sm:gap-2">
                  {["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"].map((day) => (
                    <div key={day}>{day}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                  {Array.from({ length: calendar.month.firstWeekday }).map((_, index) => (
                    <div key={`blank-${index}`} className="min-h-[70px] rounded-xl border border-transparent" />
                  ))}
                  {calendar.month.days.map((day) => (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={`min-h-[72px] rounded-xl border p-2 text-left transition sm:min-h-[88px] ${
                        day.date === calendar.selected.date
                          ? "border-neon-cyan bg-neon-cyan/15 shadow-[0_0_22px_rgba(0,229,255,0.22)]"
                          : `${classificationCardClass(day.classification)} hover:border-neon-cyan/50`
                      }`}
                    >
                      <div className="text-xs font-bold text-muted-foreground">{day.day}</div>
                      <div className="mt-1 flex items-center justify-center">
                        <span
                          className={`flex size-9 items-center justify-center rounded-full text-sm font-black sm:size-10 ${classificationBubbleClass(
                            day.classification,
                          )}`}
                        >
                          {day.classification === "sem_amostra" ? "-" : Math.round(day.score)}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-center text-[9px] font-bold sm:text-[10px]">
                        {classificationLabel(day.classification)}
                      </div>
                    </button>
                  ))}
                </div>
                <ClassificationLegend />
              </>
            )}
          </GlassCard>

          {calendar && <MonthSummary calendar={calendar} />}
        </div>

        <div className="space-y-4 xl:sticky xl:top-20">
          {calendar ? (
            <>
              <DayPanel day={calendar.selectedDay} />
              <HourGrid
                hours={calendar.selectedHours}
                selectedHour={selectedHour}
                onSelectHour={setSelectedHour}
              />
              <HourPanel hour={selectedHourStat} />
            </>
          ) : (
            <GlassCard className="p-4">
              <div className="text-sm text-muted-foreground">Carregando inteligencia historica...</div>
            </GlassCard>
          )}
        </div>
      </div>

      {calendar && (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <Rankings calendar={calendar} />
          <Heatmap calendar={calendar} />
        </div>
      )}
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
          <AppBadge tone="green">DADOS REAIS</AppBadge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Mapa historico de dias e horarios pagantes em horario de Brasilia.
        </p>
      </div>
      <Button type="button" variant="outline" className="gap-2 rounded-xl border-border/70">
        <Download className="size-4" />
        Exportar
      </Button>
    </div>
  );
}

function MonthSummary({ calendar }: { calendar: NeuralCalendarPayload }) {
  const summary = calendar.month.summary;
  const cards = [
    {
      label: "Media do mes",
      value: summary.averageScore ? `${formatPercent(summary.averageScore)}` : "Sem amostra",
      detail: "Somente dias com amostra real",
    },
    {
      label: "Melhor dia",
      value: summary.bestDay ? formatDateShort(summary.bestDay.date) : "-",
      detail: summary.bestDay ? `${Math.round(summary.bestDay.score)}/100` : "Sem amostra",
    },
    {
      label: "Pior dia",
      value: summary.worstDay ? formatDateShort(summary.worstDay.date) : "-",
      detail: summary.worstDay ? `${Math.round(summary.worstDay.score)}/100` : "Sem amostra",
    },
    {
      label: "Melhor horario",
      value: summary.bestHour ? `${String(summary.bestHour.hour).padStart(2, "0")}:00` : "-",
      detail: summary.bestHour ? `${Math.round(summary.bestHour.score)}/100` : "Sem amostra",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <GlassCard key={card.label} className="p-4">
          <div className="text-xs font-bold uppercase text-muted-foreground">{card.label}</div>
          <div className="mt-2 text-2xl font-black">{card.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{card.detail}</div>
        </GlassCard>
      ))}
    </div>
  );
}

function DayPanel({ day }: { day: NeuralCalendarDailyStat }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase text-muted-foreground">Score do dia</div>
          <div className={`mt-2 text-5xl font-black ${classificationTextClass(day.classification)}`}>
            {day.classification === "sem_amostra" ? "--" : Math.round(day.score)}
            <span className="text-xl text-muted-foreground">/100</span>
          </div>
          <div className={`mt-1 text-sm font-black ${classificationTextClass(day.classification)}`}>
            {classificationLabel(day.classification)}
          </div>
        </div>
        <AppBadge tone={day.classification === "perigoso" ? "red" : day.classification === "sem_amostra" ? "amber" : "green"}>
          {formatDateLong(day.date)}
        </AppBadge>
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <Metric label="Total de rodadas" value={formatNumber(day.totalRounds)} />
        <Metric label="Greens" value={formatNumber(day.greens)} tone="green" />
        <Metric label="Reds" value={formatNumber(day.reds)} tone="red" />
        <Metric label="Empates" value={formatNumber(day.ties)} tone="amber" />
        <Metric label="Assertividade" value={day.totalRounds ? formatPercent(day.accuracy) : "Sem amostra"} />
        <Metric label="Melhor forca" value={forceLabel(day.bestForce)} />
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
        {day.observation}
      </div>
    </GlassCard>
  );
}

function HourGrid({
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
      <div className="mb-3 flex items-center gap-2 text-sm font-black">
        <Clock3 className="size-4 text-neon-cyan" />
        Desempenho por horario
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4">
        {hours.map((hour) => (
          <button
            key={hour.id}
            type="button"
            onClick={() => onSelectHour(hour.hour)}
            className={`rounded-xl border p-2 text-center transition ${
              selectedHour === hour.hour
                ? "border-neon-cyan bg-neon-cyan/15"
                : classificationCardClass(hour.classification)
            }`}
          >
            <div className="text-[10px] text-muted-foreground">
              {String(hour.hour).padStart(2, "0")}:00
            </div>
            <div className={`mt-1 text-lg font-black ${classificationTextClass(hour.classification)}`}>
              {hour.classification === "sem_amostra" ? "-" : Math.round(hour.score)}
            </div>
            <div className="truncate text-[9px] font-bold">{classificationLabel(hour.classification)}</div>
          </button>
        ))}
      </div>
    </GlassCard>
  );
}

function HourPanel({ hour }: { hour: NeuralCalendarHourlyStat | null }) {
  if (!hour) {
    return (
      <GlassCard className="p-4">
        <div className="text-sm font-bold">Detalhe do horario</div>
        <p className="mt-1 text-xs text-muted-foreground">Selecione um horario para ver a leitura completa.</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm font-black">
          {formatDateShort(hour.date)} - {String(hour.hour).padStart(2, "0")}:00
        </div>
        <div className={`text-2xl font-black ${classificationTextClass(hour.classification)}`}>
          {hour.classification === "sem_amostra" ? "--" : Math.round(hour.score)}
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </div>
      <div className="grid gap-2 text-sm">
        <Metric label="Rodadas" value={formatNumber(hour.totalRounds)} />
        <Metric label="Greens" value={formatNumber(hour.greens)} tone="green" />
        <Metric label="Reds" value={formatNumber(hour.reds)} tone="red" />
        <Metric label="Empates" value={formatNumber(hour.ties)} tone="amber" />
        <Metric label="Assertividade" value={hour.totalRounds ? formatPercent(hour.accuracy) : "Sem amostra"} />
      </div>
      <div className="mt-4 space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
        <ForceBar label="Banker" value={hour.bankerPercent} className="bg-red-400" />
        <ForceBar label="Player" value={hour.playerPercent} className="bg-blue-400" />
        <ForceBar label="Tie" value={hour.tiePercent} className="bg-yellow-400" />
      </div>
      <div className="mt-4 grid gap-2 text-xs">
        <InfoLine icon={<ShieldCheck className="size-4" />} label="Melhor modulo" value={hour.bestModule} />
        <InfoLine icon={<BarChart3 className="size-4" />} label="Melhor leitura" value={hour.bestReading} />
      </div>
    </GlassCard>
  );
}

function Rankings({ calendar }: { calendar: NeuralCalendarPayload }) {
  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black">
        <BarChart3 className="size-4 text-neon-cyan" />
        Rankings automaticos
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <RankingList
          title="Top horarios"
          rows={calendar.rankings.topHours.map((item) => ({
            label: item.label,
            value: formatPercent(item.score),
            detail: `${formatNumber(item.totalRounds)} rodadas`,
          }))}
        />
        <RankingList
          title="Top dias da semana"
          rows={calendar.rankings.topWeekdays.map((item) => ({
            label: item.weekday,
            value: formatPercent(item.score),
            detail: `${item.total} dias`,
          }))}
        />
        <RankingList
          title="Top dias do mes"
          rows={calendar.rankings.topMonthDays.map((item) => ({
            label: item.label,
            value: formatPercent(item.score),
            detail: `${formatNumber(item.totalRounds)} rodadas`,
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

function Heatmap({ calendar }: { calendar: NeuralCalendarPayload }) {
  const buckets = ["00-04h", "04-08h", "08-12h", "12-16h", "16-20h", "20-24h"];
  const days = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-black">
        <CalendarDays className="size-4 text-neon-cyan" />
        Mapa de calor dias x horas
      </div>
      <div className="space-y-2">
        {buckets.map((bucket, bucketIndex) => (
          <div key={bucket} className="grid grid-cols-[58px_repeat(7,1fr)] items-center gap-1.5">
            <div className="text-[10px] text-muted-foreground">{bucket}</div>
            {days.map((day, dayIndex) => {
              const cell = heatmapCell(calendar, bucketIndex, dayIndex);
              return (
                <div
                  key={`${bucket}-${day}`}
                  title={`${day} ${bucket}: ${cell ? Math.round(cell.score) : "sem dados"}`}
                  className={`h-7 rounded-md border ${classificationCardClass(
                    cell?.classification || "sem_amostra",
                  )}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
        <span>Perigoso</span>
        <span>Muito pagante</span>
      </div>
    </GlassCard>
  );
}

function heatmapCell(calendar: NeuralCalendarPayload, bucketIndex: number, weekdayIndex: number) {
  const startHour = bucketIndex * 4;
  const rows = calendar.month.heatmap.filter((item) => {
    const date = new Date(`${item.date}T12:00:00Z`);
    return date.getUTCDay() === weekdayIndex && item.hour >= startHour && item.hour < startHour + 4;
  });
  if (!rows.length) return null;
  const score = rows.reduce((sum, item) => sum + item.score, 0) / rows.length;
  return {
    score,
    classification: classifyScore(score, rows.length),
  };
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
      <LegendDot className="bg-green-400" label="87-100 Muito Pagante" />
      <LegendDot className="bg-yellow-400" label="56-86 Operavel" />
      <LegendDot className="bg-red-400" label="0-55 Perigoso" />
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

function Metric({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" | "amber" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-black ${
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

function moveMonth(
  delta: number,
  year: number,
  month: number,
  setYear: (year: number) => void,
  setMonth: (month: number) => void,
  setSelectedDate: (date: string) => void,
) {
  const next = new Date(Date.UTC(year, month - 1 + delta, 1));
  setYear(next.getUTCFullYear());
  setMonth(next.getUTCMonth() + 1);
  setSelectedDate("");
}

function classificationLabel(value: NeuralCalendarClassification) {
  if (value === "muito_pagante") return "Muito Pagante";
  if (value === "operavel") return "Operavel";
  if (value === "perigoso") return "Perigoso";
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

function classifyScore(score: number, total: number): NeuralCalendarClassification {
  if (!total) return "sem_amostra";
  if (score >= 87) return "muito_pagante";
  if (score >= 56) return "operavel";
  return "perigoso";
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
