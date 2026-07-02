import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ScoreChipVariant = "green" | "red" | "purple" | "cyan" | "yellow" | "neutral";

export interface ScoreChipData {
  label: string;
  value: string | number;
  variant: ScoreChipVariant;
}

export interface ModuleMiniScoreboardProps {
  moduleType: "MAIN" | "TIE" | "NEURAL" | "SURF";
  title: string;
  assertiveness: number;
  chips: ScoreChipData[];
  sequencePositive?: number;
  sequenceNegative?: number;
  sequenceExpired?: number;
  breakdown?: string;
}

const moduleTone = {
  MAIN: {
    border: "border-white/10",
    title: "text-muted-foreground",
    glow: "",
    progress: "rgba(255,255,255,0.42)",
    description: "Entradas Banker/Player, com SG, G1 e RED separados.",
  },
  TIE: {
    border: "border-white/10",
    title: "text-muted-foreground",
    glow: "",
    progress: "rgba(255,255,255,0.42)",
    description: "Tie Alert estatístico, com expirados separados de RED.",
  },
  NEURAL: {
    border: "border-white/10",
    title: "text-muted-foreground",
    glow: "",
    progress: "rgba(255,255,255,0.42)",
    description: "Leitura neural de números pagantes, separada da entrada principal.",
  },
  SURF: {
    border: "border-white/10",
    title: "text-muted-foreground",
    glow: "",
    progress: "rgba(255,255,255,0.42)",
    description: "Surf Analyzer separado dos outros módulos.",
  },
} as const;

export function ModuleMiniScoreboard({
  moduleType,
  title,
  assertiveness,
  chips,
  sequencePositive = 0,
  sequenceNegative = 0,
  sequenceExpired,
  breakdown,
}: ModuleMiniScoreboardProps) {
  const tone = moduleTone[moduleType];
  const sequenceChips: ScoreChipData[] = [
    { label: "Seq.", value: `+${sequencePositive}`, variant: "cyan" },
    sequenceExpired !== undefined
      ? { label: "Seq. Exp.", value: sequenceExpired, variant: "purple" }
      : { label: "Seq.", value: `-${sequenceNegative}`, variant: "red" },
  ];
  const allChips = [...chips, ...sequenceChips];
  const dataState = scoreboardDataState(chips);
  const sequenceState = moduleSequenceState(sequencePositive, sequenceNegative, sequenceExpired);

  return (
    <div
      className={cn(
        "digital-result-card relative overflow-hidden rounded-xl border bg-secondary/20 px-2.5 py-2.5 backdrop-blur-xl",
        tone.border,
        tone.glow,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.045]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/24 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-neon-cyan/22 to-transparent" />
      <div className="relative flex items-center gap-2.5">
        <MiniCircularProgress value={assertiveness} color={tone.progress} />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className={cn("flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em]", tone.title)}>
              <span className="size-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn("rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em]", dataState.className)}>
                {dataState.label}
              </span>
              <ScoreboardDetailsModal
                moduleType={moduleType}
                title={title}
                assertiveness={assertiveness}
                chips={allChips}
                breakdown={breakdown}
                description={tone.description}
                color={tone.progress}
                dataStateLabel={dataState.label}
              />
            </div>
          </div>

          <div className="result-chip-scroll">
            <div className="flex w-max items-center gap-1.5">
              {allChips.map((chip) => (
                <ScoreChip key={`${chip.label}-${chip.value}-${chip.variant}`} {...chip} />
              ))}
            </div>
          </div>

          {breakdown && (
            <div className="mt-1 truncate text-[9px] font-medium text-muted-foreground">
              {breakdown}
            </div>
          )}
          <div className="mt-1 text-[9px] font-medium text-muted-foreground">
            Ciclo oficial 00:01-00:00. Sem amostra suficiente, fica em coleta.
          </div>
          <div className={cn("mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]", sequenceState.className)}>
            <span className="truncate">Sequência atual: {sequenceState.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function moduleSequenceState(sequencePositive: number, sequenceNegative: number, sequenceExpired?: number) {
  if (sequenceExpired !== undefined && sequenceExpired > 0) {
    return {
      label: `${sequenceExpired} expirado${sequenceExpired === 1 ? "" : "s"}`,
      className: "border-tie/25 bg-tie/10 text-tie",
    };
  }

  if (sequenceNegative > 0) {
    return {
      label: `${sequenceNegative} RED ${sequenceNegative === 1 ? "atual" : "seguidos"}`,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
    };
  }

  if (sequencePositive > 0) {
    return {
      label: `${sequencePositive} GREEN ${sequencePositive === 1 ? "atual" : "seguidos"}`,
      className: "border-success/30 bg-success/10 text-success",
    };
  }

  return {
    label: "coletando",
    className: "border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan",
  };
}

function MiniCircularProgress({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const targetPct = clampPercent(value);
  const [animatedPct, setAnimatedPct] = useState(0);
  const currentPctRef = useRef(0);
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference - (animatedPct / 100) * circumference;

  useEffect(() => {
    const from = currentPctRef.current;
    const to = targetPct;

    if (typeof window === "undefined") {
      currentPctRef.current = to;
      setAnimatedPct(to);
      return;
    }

    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || Math.abs(to - from) < 0.1) {
      currentPctRef.current = to;
      setAnimatedPct(to);
      return;
    }

    let frame = 0;
    const duration = Math.min(1200, Math.max(650, Math.abs(to - from) * 9));
    const startedAt = performance.now();
    const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const next = from + (to - from) * easeOutCubic(progress);
      currentPctRef.current = next;
      setAnimatedPct(next);

      if (progress < 1) {
        frame = window.requestAnimationFrame(animate);
      } else {
        currentPctRef.current = to;
        setAnimatedPct(to);
      }
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [targetPct]);

  return (
    <div
      className="digital-dial relative grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-background/55 sm:size-14"
      aria-label={`Assertividade ${formatPercent(targetPct)}`}
    >
      <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          style={{
            filter: `drop-shadow(0 0 7px ${color})`,
          }}
        />
      </svg>
      <div className="relative grid size-9 place-items-center rounded-full bg-background/90 text-[10px] font-black text-foreground sm:size-10">
        {formatPercent(animatedPct)}
      </div>
    </div>
  );
}

function ScoreChip({ label, value, variant }: ScoreChipData) {
  return (
    <span
      className={cn(
        "digital-chip inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-extrabold leading-none",
        chipClass(variant),
      )}
    >
      <span className="font-semibold uppercase tracking-[0.08em] opacity-80">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ScoreboardDetailsModal({
  moduleType,
  title,
  assertiveness,
  chips,
  breakdown,
  description,
  color,
  dataStateLabel,
}: {
  moduleType: ModuleMiniScoreboardProps["moduleType"];
  title: string;
  assertiveness: number;
  chips: ScoreChipData[];
  breakdown?: string;
  description: string;
  color: string;
  dataStateLabel: string;
}) {
  const toolInfo = moduleToolInfo(moduleType);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground transition hover:border-neon-cyan/35 hover:text-neon-cyan">
          Ver detalhes
        </button>
      </DialogTrigger>
      <DialogContent className="border-neon-cyan/20 bg-background/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm uppercase tracking-[0.16em]">{title}</DialogTitle>
          <DialogDescription>{description} Fonte: dados reais do ciclo oficial 00:01-00:00.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 rounded-xl border border-neon-cyan/15 bg-neon-cyan/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <ToolInfoLine label="Para que serve" value={toolInfo.purpose} />
          <ToolInfoLine label="Como funciona" value={toolInfo.how} />
          <div className={cn("rounded-lg border px-2.5 py-2 font-black uppercase tracking-[0.08em]", toolInfo.entryClassName)}>
            {toolInfo.entry}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <MiniCircularProgress value={assertiveness} color={color} />
          <div>
            <div className="text-xs text-muted-foreground">Assertividade</div>
            <div className="text-3xl font-black text-foreground">{formatPercent(assertiveness)}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{dataStateLabel}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {chips.map((chip) => (
            <div key={`${chip.label}-${chip.value}`} className={cn("rounded-lg border px-3 py-2", chipClass(chip.variant))}>
              <div className="text-[10px] uppercase tracking-[0.12em] opacity-75">{chip.label}</div>
              <div className="text-lg font-black">{chip.value}</div>
            </div>
          ))}
        </div>
        {breakdown && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
            {breakdown}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ToolInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">{label}: </span>
      {value}
    </div>
  );
}

function moduleToolInfo(moduleType: ModuleMiniScoreboardProps["moduleType"]) {
  if (moduleType === "MAIN") {
    return {
      purpose: "mostra se a entrada oficial está pagando.",
      how: "conta SG, G1 e RED reais do card principal.",
      entry: "Entrada a seguir: a do card principal.",
      entryClassName: "border-white/10 bg-secondary/20 text-muted-foreground",
    };
  }

  if (moduleType === "NEURAL") {
    return {
      purpose: "mostra se número pagante está puxando lado.",
      how: "conta SG, G1 e RED reais da Neural.",
      entry: "Entrada pela Neural: o lado mostrado no ? da Leitura Neural.",
      entryClassName: "border-white/10 bg-secondary/20 text-muted-foreground",
    };
  }

  if (moduleType === "TIE") {
    return {
      purpose: "avisa quando existe pressão de empate.",
      how: "conta Green se o Tie aparece dentro da validade.",
      entry: "Entrada pelo Tie: só com alerta ativo e validade aberta.",
      entryClassName: "border-white/10 bg-secondary/20 text-muted-foreground",
    };
  }

  return {
    purpose: "mostra quando a mesa está puxando tendência.",
    how: "mede força do lado e risco de quebra.",
    entry: "Entrada pelo Surf: seguir o lado do surf com risco controlado.",
    entryClassName: "border-white/10 bg-secondary/20 text-muted-foreground",
  };
}

function scoreboardDataState(chips: ScoreChipData[]) {
  const totalChip = chips.find((chip) => normalizeLabel(chip.label) === "total" || normalizeLabel(chip.label) === "alertas");
  const totalValue = readChipNumber(totalChip?.value);
  const hasUsefulValue = chips.some((chip) => {
    const label = normalizeLabel(chip.label);
    if (label === "emp" || label === "mesa") return false;
    return readChipNumber(chip.value) > 0;
  });

  if ((totalChip && totalValue <= 0) || !hasUsefulValue) {
    return {
      label: "Coletando",
      className: "border-warning/25 bg-warning/10 text-warning",
    };
  }

  return {
    label: "Dados reais",
    className: "border-success/25 bg-success/10 text-success",
  };
}

function normalizeLabel(value: string) {
  return value.trim().toLowerCase();
}

function readChipNumber(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? Math.abs(parsed) : 0;
}

function chipClass(variant: ScoreChipVariant) {
  if (variant === "green") return "border-success/25 bg-success/10 text-success";
  if (variant === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (variant === "purple") return "border-tie/25 bg-tie/10 text-tie";
  if (variant === "yellow") return "border-warning/25 bg-warning/10 text-warning";
  if (variant === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number) {
  return `${clampPercent(value).toFixed(1).replace(".", ",")}%`;
}
