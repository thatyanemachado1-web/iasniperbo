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
    border: "border-neon-cyan/20",
    title: "text-neon-cyan",
    glow: "shadow-[0_0_34px_-26px_var(--neon-cyan)]",
    progress: "var(--neon-cyan)",
    description: "Entradas Banker/Player, com SG, G1 e RED separados.",
  },
  TIE: {
    border: "border-tie/20",
    title: "text-tie",
    glow: "shadow-[0_0_34px_-26px_var(--tie)]",
    progress: "var(--tie)",
    description: "Tie Alert estatístico, com expirados separados de RED.",
  },
  NEURAL: {
    border: "border-neon-purple/20",
    title: "text-gradient-brand",
    glow: "shadow-[0_0_34px_-26px_var(--neon-purple)]",
    progress: "var(--neon-purple)",
    description: "Números pagantes e leitura neural contextual da mesa.",
  },
  SURF: {
    border: "border-neon-blue/20",
    title: "text-neon-blue",
    glow: "shadow-[0_0_34px_-26px_var(--neon-blue)]",
    progress: "var(--neon-blue)",
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

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-secondary/20 px-2.5 py-2 backdrop-blur-xl",
        tone.border,
        tone.glow,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.05]" />
      <div className="relative flex items-center gap-2.5">
        <MiniCircularProgress value={assertiveness} color={tone.progress} />

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className={cn("text-[9px] font-black uppercase tracking-[0.16em]", tone.title)}>
              {title}
            </div>
            <ScoreboardDetailsModal
              title={title}
              assertiveness={assertiveness}
              chips={allChips}
              breakdown={breakdown}
              description={tone.description}
              color={tone.progress}
            />
          </div>

          <div className="overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
        </div>
      </div>
    </div>
  );
}

function MiniCircularProgress({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  const pct = clampPercent(value);
  return (
    <div
      className="grid size-12 shrink-0 place-items-center rounded-full border border-white/10 bg-background/55 sm:size-14"
      style={{
        background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
      }}
      aria-label={`Assertividade ${formatPercent(pct)}`}
    >
      <div className="grid size-9 place-items-center rounded-full bg-background/90 text-[10px] font-black text-foreground sm:size-10">
        {formatPercent(pct)}
      </div>
    </div>
  );
}

function ScoreChip({ label, value, variant }: ScoreChipData) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-extrabold leading-none",
        chipClass(variant),
      )}
    >
      <span className="font-semibold uppercase tracking-[0.08em] opacity-80">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function ScoreboardDetailsModal({
  title,
  assertiveness,
  chips,
  breakdown,
  description,
  color,
}: {
  title: string;
  assertiveness: number;
  chips: ScoreChipData[];
  breakdown?: string;
  description: string;
  color: string;
}) {
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
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4">
          <MiniCircularProgress value={assertiveness} color={color} />
          <div>
            <div className="text-xs text-muted-foreground">Assertividade</div>
            <div className="text-3xl font-black text-neon-cyan">{formatPercent(assertiveness)}</div>
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
