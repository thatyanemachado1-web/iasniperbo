import { cn } from "@/lib/utils";
import type { NeuralReading, SignalSide } from "@/types/dashboard";
import { BrainCircuit, Sparkles } from "lucide-react";

type LeituraNeuralMiniCardProps = NeuralReading & {
  className?: string;
};

const SCANNING_READING: NeuralReading = {
  mode: "SCANNING",
  numero: null,
  origem: null,
  direcao: null,
  validade: null,
  alertas: null,
  acertos: null,
  erros: null,
  assertividade: null,
};

export function LeituraNeuralMiniCard({
  className,
  ...reading
}: LeituraNeuralMiniCardProps) {
  const data = { ...SCANNING_READING, ...reading };
  const mode = data.mode ?? "SCANNING";
  const hasNumber = typeof data.numero === "number" && data.origem;
  const totalAlerts = totalFrom(data.alertas, data.acertos, data.erros);
  const accuracy = accuracyFrom(data.assertividade, data.acertos, data.erros);

  return (
    <aside
      className={cn(
        "neural-mini-card relative w-[122px] shrink-0 overflow-hidden rounded-xl border border-neon-cyan/35 bg-[#071020]/78 px-2.5 py-2 text-left shadow-[0_0_28px_-14px_var(--neon-cyan)] backdrop-blur-xl sm:w-[148px] lg:w-[156px]",
        mode === "ACTIVE" && "border-neon-purple/45 shadow-[0_0_32px_-14px_var(--neon-purple)]",
        className,
      )}
      aria-label="Leitura neural"
    >
      <div className="absolute inset-0 neural-mini-grid opacity-40" />
      <div className="absolute -right-5 -top-6 size-16 rounded-full bg-neon-purple/15 blur-2xl" />
      <div className="absolute -bottom-6 -left-5 size-16 rounded-full bg-neon-cyan/15 blur-2xl" />
      <span className="absolute right-2 top-2 size-1.5 rounded-full bg-success shadow-[0_0_12px_var(--success)]" />
      <span className="absolute inset-x-0 top-0 h-px neural-mini-shimmer" />

      <div className="relative flex items-center gap-1.5">
        <div className="relative grid size-6 place-items-center rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan">
          <BrainCircuit className="size-3.5 animate-neural-brain" />
          <span className="absolute -right-0.5 -top-0.5 size-1 rounded-full bg-neon-purple" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-gradient-brand sm:text-[10px]">
            Leitura Neural
          </div>
          <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
            IA contextual
          </div>
        </div>
      </div>

      {mode === "SCANNING" || !hasNumber ? (
        <div className="relative mt-2">
          <div className="line-clamp-2 text-[10px] font-semibold leading-snug text-foreground/85 sm:text-[11px]">
            IA procurando números pagantes...
          </div>
          <TypingDots />
          <div className="mt-1.5 text-[8px] leading-tight text-muted-foreground">
            Leitura complementar da IA
          </div>
        </div>
      ) : (
        <div className="relative mt-2 space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black leading-none text-foreground sm:text-xl">
              {data.numero}
            </span>
            <span className={cn("truncate text-[11px] font-extrabold", sideClass(data.origem))}>
              {sideLabel(data.origem)}
            </span>
          </div>
          {data.direcao ? (
            <div className="truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">
              <span className="text-neon-cyan">→</span>{" "}
              <span className={sideClass(data.direcao)}>{sideLabel(data.direcao)}</span>{" "}
              {data.validade ?? "G1"}
            </div>
          ) : (
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              Em observação neural
            </div>
          )}
          {mode === "ACTIVE" && totalAlerts !== null ? (
            <>
              <div className="h-px border-t border-dashed border-neon-cyan/25" />
              <div className="truncate text-[9px] text-muted-foreground">
                {totalAlerts} • {data.acertos ?? 0} • {data.erros ?? 0}
              </div>
              <div className="text-[11px] font-black text-neon-cyan">
                {formatPercent(accuracy)}
              </div>
            </>
          ) : (
            <div className="inline-flex items-center gap-1 text-[9px] font-semibold text-neon-cyan/85">
              <Sparkles className="size-2.5" />
              Observando
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function TypingDots() {
  return (
    <div className="mt-2 flex gap-1" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 rounded-full bg-neon-cyan animate-neural-dot"
          style={{ animationDelay: `${index * 0.18}s` }}
        />
      ))}
    </div>
  );
}

function totalFrom(
  alertas?: number | null,
  acertos?: number | null,
  erros?: number | null,
) {
  if (typeof acertos === "number" || typeof erros === "number") {
    return (acertos ?? 0) + (erros ?? 0);
  }
  return typeof alertas === "number" ? alertas : null;
}

function accuracyFrom(
  assertividade?: number | null,
  acertos?: number | null,
  erros?: number | null,
) {
  if (typeof acertos === "number" || typeof erros === "number") {
    const total = (acertos ?? 0) + (erros ?? 0);
    return total > 0 ? ((acertos ?? 0) / total) * 100 : null;
  }
  return typeof assertividade === "number" ? assertividade : null;
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function sideLabel(side?: SignalSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  return "";
}

function sideClass(side?: SignalSide | null) {
  if (side === "BANKER") return "text-banker";
  if (side === "PLAYER") return "text-player";
  return "text-muted-foreground";
}
