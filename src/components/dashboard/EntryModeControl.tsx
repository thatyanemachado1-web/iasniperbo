import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ActiveEntryMode, EntryMode, EntryModeStats } from "@/types/dashboard";
import { Crosshair, Flame, HelpCircle, Power, Radar } from "lucide-react";
import type { ComponentType } from "react";

type ModeOption = {
  value: ActiveEntryMode;
  label: string;
  detail: string;
  Icon: ComponentType<{ className?: string }>;
};

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "sniper",
    label: "Sniper",
    detail: "Ultra seletivo: exige pagante ativo, alinhado com a principal, 99% ou mais de assertividade real e mesa sem risco forte.",
    Icon: Crosshair,
  },
  {
    value: "hunter",
    label: "Caçador",
    detail: "Modo recomendado. Filtra risco alto, mas ainda acompanha oportunidades boas da engine em paralelo.",
    Icon: Radar,
  },
  {
    value: "aggressive",
    label: "Agressivo",
    detail: "Aceita mais oportunidades do motor e também mais risco. A porcentagem diária mostra se está compensando.",
    Icon: Flame,
  },
];

export function EntryModeControl({
  value,
  onChange,
  stats,
}: {
  value: EntryMode;
  onChange: (mode: EntryMode) => void;
  stats?: Partial<Record<ActiveEntryMode, EntryModeStats>>;
}) {
  return (
    <>
      <div className="grid w-full max-w-full grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-1">
        <span className="inline-flex h-7 items-center justify-center rounded-full border border-neon-cyan/25 bg-neon-cyan/5 px-2 text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan sm:h-8 sm:px-3 sm:text-[10px]">
          Modo
        </span>
        {MODE_OPTIONS.map(({ value: optionValue, label, detail, Icon }) => {
          const active = value === optionValue;
          const modeStats = stats?.[optionValue];
          const percent = calculateModePercent(modeStats);
          const percentLabel = formatModePercent(percent);
          const counts = summarizeModeStats(modeStats);
          return (
            <div
              key={optionValue}
              className={cn(
                "inline-flex h-7 min-w-0 items-center overflow-hidden rounded-full border bg-background/55 text-[8px] uppercase tracking-[0.04em] transition sm:h-8 sm:text-[9px] sm:tracking-[0.08em] xl:text-[10px]",
                active
                  ? "border-neon-cyan/55 text-neon-cyan shadow-[0_0_18px_-13px_var(--neon-cyan)]"
                  : "border-border/70 text-muted-foreground hover:border-neon-cyan/35 hover:text-neon-cyan/85",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-full min-w-0 flex-1 items-center gap-1 px-1.5 font-black transition sm:gap-1.5 sm:px-2",
                  active ? "bg-neon-cyan/10" : "",
                )}
              >
                <Icon className="size-3 shrink-0 sm:size-3.5" />
                <span className="min-w-0 truncate">{label}</span>
                <span
                  className={cn(
                    "shrink-0 font-black",
                    percent === null ? "text-muted-foreground" : active ? "text-success" : "text-neon-cyan/70",
                  )}
                >
                  {percentLabel}
                </span>
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "grid h-full w-5 shrink-0 place-items-center border-l transition sm:w-6",
                      "hover:bg-neon-cyan/10 hover:text-neon-cyan",
                      active ? "border-neon-cyan/20 text-neon-cyan" : "border-border/60 text-muted-foreground",
                    )}
                    aria-label={`Explicar modo ${label}`}
                  >
                    <HelpCircle className="size-2.5 sm:size-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  align="center"
                  className="w-[min(calc(100vw-2rem),18rem)] rounded-lg border border-neon-cyan/30 bg-[#061022] px-3 py-2 text-[11px] leading-relaxed text-foreground shadow-[0_0_30px_-16px_var(--neon-cyan)]"
                >
                  <div className="font-black uppercase tracking-[0.12em] text-neon-cyan">
                    {label}
                  </div>
                  <div className="mt-1 text-foreground/85">{detail}</div>
                  <div className="mt-2 grid grid-cols-4 gap-1 border-t border-neon-cyan/15 pt-2">
                    <ModeCount label="SG" value={counts.sg} tone="text-success" />
                    <ModeCount label="G1" value={counts.g1} tone="text-neon-cyan" />
                    <ModeCount label="EMP" value={counts.emp} tone="text-tie" />
                    <ModeCount label="RED" value={counts.reds} tone="text-destructive" />
                  </div>
                  <div className="mt-2 border-t border-neon-cyan/15 pt-2 text-muted-foreground">
                    {percent === null ? "Aguardando resultado real deste modo hoje." : `Assertividade diária: ${percentLabel}.`}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => onChange(active ? "off" : optionValue)}
                className={cn(
                  "mr-1 inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border px-1 text-[8px] font-black transition sm:h-6 sm:gap-1 sm:px-1.5 sm:text-[9px]",
                  "hover:border-neon-cyan/40 hover:bg-neon-cyan/10 hover:text-neon-cyan",
                  active
                    ? "border-success/30 bg-success/15 text-success"
                    : "border-muted-foreground/20 bg-secondary/30 text-muted-foreground",
                )}
                aria-pressed={active}
                title={active ? `Desligar modo ${label}` : `Ativar modo ${label}`}
              >
                <Power className="size-2.5 sm:size-3" />
                {active ? "ON" : "OFF"}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ModeCount({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-background/45 px-1.5 py-1 text-center">
      <div className="text-[8px] font-black uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-xs font-black", tone)}>{value}</div>
    </div>
  );
}

function calculateModePercent(stats?: EntryModeStats) {
  if (!stats) return null;

  const greenSemGale = optionalNumber(stats.greenSemGale ?? stats.greens) ?? 0;
  const greenG1 = optionalNumber(stats.greenG1 ?? stats.greensG1) ?? 0;
  const totalGreens = optionalNumber(stats.totalGreens) ?? greenSemGale + greenG1;
  const reds = optionalNumber(stats.reds) ?? 0;
  const total = optionalNumber(stats.totalEntries ?? stats.total) ?? totalGreens + reds;

  if (total > 0) return clampPercent((totalGreens / total) * 100);

  const providedAssertiveness = optionalNumber(stats.assertiveness);
  return providedAssertiveness === null ? null : clampPercent(providedAssertiveness);
}

function summarizeModeStats(stats?: EntryModeStats) {
  return {
    sg: counter(stats?.greenSemGale ?? stats?.sg ?? stats?.greens),
    g1: counter(stats?.greenG1 ?? stats?.greensG1),
    emp: counter(stats?.emp ?? stats?.ties),
    reds: counter(stats?.reds),
  };
}

function formatModePercent(value: number | null) {
  if (value === null) return "--%";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}

function counter(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
