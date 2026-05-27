import { cn } from "@/lib/utils";
import type { MainResult, NeuralResult, SurfResult, TieResult } from "@/types/dashboard";

type ModuleType = "MAIN" | "TIE" | "NEURAL" | "SURF";

type ModuleResultTabsProps =
  | { moduleType: "MAIN"; data: MainResult; compact?: boolean }
  | { moduleType: "TIE"; data: TieResult; compact?: boolean }
  | { moduleType: "NEURAL"; data: NeuralResult; compact?: boolean }
  | { moduleType: "SURF"; data: SurfResult; compact?: boolean };

type ChipTone = "success" | "danger" | "cyan" | "purple" | "amber" | "muted";

export function ModuleResultTabs(props: ModuleResultTabsProps) {
  const config = buildConfig(props.moduleType, props.data);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-secondary/20 px-2.5 py-2 shadow-[0_0_28px_-22px_var(--neon-cyan)] backdrop-blur-xl",
        config.border,
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.05]" />
      <div className="relative flex items-center gap-2">
        <div className={cn("shrink-0 text-[9px] font-black uppercase tracking-[0.16em]", config.titleClass)}>
          {config.title}
        </div>
        <div className="min-w-0 flex-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max items-center gap-1.5">
            {config.chips.map((chip) => (
              <ResultChip key={`${chip.label}-${chip.value}`} {...chip} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function buildConfig(moduleType: ModuleType, data: MainResult | TieResult | NeuralResult | SurfResult) {
  if (moduleType === "MAIN") {
    const result = data as MainResult;
    return {
      title: "Resultado Principal",
      titleClass: "text-neon-cyan",
      border: "border-neon-cyan/18",
      chips: [
        { label: "SG", value: result.greenSemGale, tone: "success" as const },
        { label: "G1", value: result.greenG1, tone: "success" as const },
        { label: "RED", value: result.reds, tone: "danger" as const },
        { label: "", value: formatPercent(result.assertiveness), tone: "cyan" as const },
      ],
    };
  }

  if (moduleType === "TIE") {
    const result = data as TieResult;
    return {
      title: "Resultado Tie",
      titleClass: "text-tie",
      border: "border-tie/18",
      chips: [
        { label: "Tie Green", value: result.greens, tone: "success" as const },
        { label: "Exp.", value: result.expired, tone: "purple" as const },
        { label: "Total", value: result.total, tone: "muted" as const },
        { label: "", value: formatPercent(result.assertiveness), tone: "cyan" as const },
      ],
    };
  }

  if (moduleType === "NEURAL") {
    const result = data as NeuralResult;
    return {
      title: "Leitura Neural",
      titleClass: "text-gradient-brand",
      border: "border-neon-purple/18",
      chips: [
        { label: "Alertas", value: result.totalAlerts, tone: "muted" as const },
        { label: "Green", value: result.greens, tone: "success" as const },
        { label: "SG", value: result.greenSemGale, tone: "success" as const },
        { label: "G1", value: result.greenG1, tone: "cyan" as const },
        { label: "RED", value: result.reds, tone: "danger" as const },
        { label: "", value: formatPercent(result.assertiveness), tone: "cyan" as const },
      ],
    };
  }

  const result = data as SurfResult;
  return {
    title: "Resultado Surf",
    titleClass: "text-neon-blue",
    border: "border-neon-blue/18",
    chips: [
      { label: "Green", value: result.greens, tone: "success" as const },
      { label: "SG", value: result.greenSemGale, tone: "success" as const },
      { label: "G1", value: result.greenG1, tone: "cyan" as const },
      { label: "RED", value: result.reds, tone: "danger" as const },
      { label: "", value: formatPercent(result.assertiveness), tone: "cyan" as const },
      { label: "Alertas", value: result.totalAlerts, tone: "muted" as const },
      { label: "Bloq.", value: result.blocked, tone: "amber" as const },
      { label: "Sem risco", value: result.noRisk, tone: "muted" as const },
    ],
  };
}

function ResultChip({ label, value, tone }: { label: string; value: string | number; tone: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-extrabold leading-none",
        toneClass(tone),
      )}
    >
      {label && <span className="font-semibold uppercase tracking-[0.08em] opacity-80">{label}</span>}
      <span>{value}</span>
    </span>
  );
}

function toneClass(tone: ChipTone) {
  if (tone === "success") return "border-success/25 bg-success/10 text-success";
  if (tone === "danger") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "purple") return "border-tie/25 bg-tie/10 text-tie";
  if (tone === "amber") return "border-warning/25 bg-warning/10 text-warning";
  if (tone === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function formatPercent(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}
