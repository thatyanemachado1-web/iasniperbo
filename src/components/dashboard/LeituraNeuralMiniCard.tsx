import { CircleHelp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildNeuralCopy } from "@/lib/operationalCopy";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { NeuralReading, NeuralScoreboard, SignalSide } from "@/types/dashboard";

type NeuralSide = SignalSide | "TIE";

interface NeuralScoreSummary {
  totalAlerts: number | null;
  greens: number | null;
  sg: number | null;
  g1: number | null;
  reds: number | null;
  total: number;
  accuracy: number | null;
}

type LeituraNeuralMiniCardProps = NeuralReading & {
  className?: string;
  greenFlash?: boolean;
  generalScoreboard?: NeuralScoreboard;
};

const SCANNING_READING: NeuralReading = {
  mode: "SCANNING",
  numero: null,
  origem: null,
  direcao: null,
  validade: null,
  alertas: null,
  acertos: null,
  greenSemGale: null,
  greenG1: null,
  erros: null,
  assertividade: null,
};

export function LeituraNeuralMiniCard({
  className,
  greenFlash = false,
  generalScoreboard,
  ...reading
}: LeituraNeuralMiniCardProps) {
  const data = { ...SCANNING_READING, ...reading };
  const mode = data.mode ?? "SCANNING";
  const hasNumber = typeof data.numero === "number" && Boolean(data.origem);
  const totalAlerts = totalFrom(data.alertas, data.acertos, data.erros);
  const accuracy = accuracyFrom(data.assertividade, data.acertos, data.erros);
  const sg = optionalNumberFrom(data.greenSemGale);
  const g1 = optionalNumberFrom(data.greenG1);
  const red = optionalNumberFrom(data.reds ?? data.erros);
  const totalGreens = totalGreensFrom(data.acertos, data.greenSemGale, data.greenG1);
  const resolvedTotal = numberFrom(totalGreens) + numberFrom(red);
  const showPayingStats = hasNumber || totalGreens !== null || accuracy !== null || totalAlerts !== null;
  const alertTone = data.isRedAlert ? "red" : data.isSaturated ? "yellow" : "cyan";
  const postTie = Boolean(data.postTie);
  const originKind = neuralOriginKind(data);
  const originBadge = originBadgeFor(originKind);
  const pullingSide = data.direcao ?? data.origem;
  const message = buildNeuralCopy(data);
  const statusKind = neuralStatusKind(data);
  const generalScore = buildGeneralScore(generalScoreboard, data);

  return (
    <aside
      className={cn(
        "neural-mini-card relative w-[140px] shrink-0 overflow-hidden rounded-xl border border-neon-cyan/35 bg-[#071020]/78 px-2.5 py-2 text-left shadow-[0_0_28px_-14px_var(--neon-cyan)] backdrop-blur-xl sm:w-[170px] lg:w-[180px]",
        mode === "ACTIVE" && "border-neon-purple/45 shadow-[0_0_32px_-14px_var(--neon-purple)]",
        greenFlash && "result-green-flash",
        className,
      )}
      aria-label="Leitura neural de numeros pagantes"
      title={message}
    >
      <div className="absolute inset-0 neural-mini-grid opacity-40" />
      <div className="absolute -right-5 -top-6 size-16 rounded-full bg-neon-purple/15 blur-2xl" />
      <div className="absolute -bottom-6 -left-5 size-16 rounded-full bg-neon-cyan/15 blur-2xl" />
      <NeuralGeneralScorePopover
        score={generalScore}
        statusKind={statusKind}
        statusLabel={statusLabel(data)}
      />
      <span className="absolute inset-x-0 top-0 h-px neural-mini-shimmer" />

      <div className="relative flex items-center gap-1.5">
        <AssistantOrb />
        <div className="min-w-0">
          <div className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-gradient-brand sm:text-[9px]">
            Leitura Neural
          </div>
          <div className="truncate text-[7px] font-bold uppercase tracking-[0.1em] text-neon-cyan/75 sm:text-[8px]">
            {originKind === "OPOSTO" ? "gatilho oposto" : postTie ? "cor pos-empate" : "numero pagante"}
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
          <div className="flex flex-wrap items-center gap-1">
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="text-lg font-black leading-none text-foreground sm:text-xl">
                {data.origem === "TIE" ? `${data.numero}x${data.numero}` : data.numero}
              </span>
              <span className={cn("truncate text-[11px] font-extrabold", sideClass(data.origem))}>
                {sideLabel(data.origem)}
              </span>
            </span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase leading-none tracking-[0.08em]",
                originBadge.className,
              )}
            >
              {originBadge.label}
            </span>
          </div>

          {pullingSide ? (
            <div className="truncate text-[10px] font-bold text-muted-foreground sm:text-[11px]">
              <span className="text-neon-cyan">{postTie ? "Cor pos-empate" : "Puxando"}</span>{" "}
              <span className={sideClass(pullingSide)}>{sideLabel(pullingSide)}</span>{" "}
              <span className="text-[9px] text-muted-foreground/85">até {data.validade ?? "G1"}</span>
            </div>
          ) : (
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              Em observação pagante
            </div>
          )}

          {showPayingStats ? (
            <div className="rounded-lg border border-neon-cyan/15 bg-background/35 px-1.5 py-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className="text-[7px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {originKind === "OPOSTO"
                    ? "Oposto"
                    : postTie
                      ? "Pos-empate"
                      : typeof data.numero === "number"
                        ? `Numero ${data.numero}`
                        : "Pagando"}
                </span>
                <span className="text-[11px] font-black text-neon-cyan">
                  {formatPercent(accuracy)}
                </span>
              </div>
              <div className="truncate text-[8px] font-semibold text-muted-foreground sm:text-[9px]">
                SG:{formatCount(sg)}  G1:{formatCount(g1)}  RED:{formatCount(red, true)}
              </div>
              <div className="truncate text-[8px] font-black uppercase tracking-[0.04em] text-foreground/90 sm:text-[9px]">
                Placar: {formatCount(totalGreens)}G / {formatCount(red, true)}R
              </div>
              {data.paganteWindow ? (
                <div className="truncate text-[7px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Janela: {data.paganteWindow} rodadas
                </div>
              ) : null}
              {data.paganteStatus && data.paganteStatus !== "VALIDO" ? (
                <div
                  className={cn(
                    "mt-1 truncate rounded-full border px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.08em]",
                    alertTone === "red" && "border-destructive/35 bg-destructive/10 text-destructive",
                    alertTone === "yellow" && "border-warning/35 bg-warning/10 text-warning",
                    alertTone === "cyan" && "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan",
                  )}
                  title={data.paganteAlert ?? undefined}
                >
                  {data.paganteStatus}
                </div>
              ) : null}
            </div>
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

function NeuralGeneralScorePopover({
  score,
  statusKind,
  statusLabel,
}: {
  score: NeuralScoreSummary;
  statusKind: "green" | "amber" | "red" | "muted";
  statusLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full border bg-background/75 text-muted-foreground shadow-sm backdrop-blur transition hover:border-neon-cyan/45 hover:text-neon-cyan",
            statusButtonClass(statusKind),
          )}
          aria-label="Abrir placar geral da Leitura Neural"
          title="Placar geral da Leitura Neural"
        >
          <span
            className={cn(
              "absolute right-0.5 top-0.5 size-1.5 rounded-full",
              statusDotClass(statusKind),
            )}
          />
          <CircleHelp className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="left"
        align="start"
        className="w-[236px] rounded-xl border-neon-purple/25 bg-background/95 p-3 shadow-[0_0_30px_-18px_var(--neon-purple)]"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-gradient-brand">
                Placar Geral
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {statusLabel}
              </div>
            </div>
            <div className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black", statusPillClass(statusKind))}>
              {formatPercent(score.accuracy)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <ScoreBox label="Green geral" value={score.greens} tone="green" />
            <ScoreBox label="RED geral" value={score.reds} tone="red" />
            <ScoreBox label="SG geral" value={score.sg} tone="green" />
            <ScoreBox label="G1 geral" value={score.g1} tone="cyan" />
            <ScoreBox label="Alertas" value={score.totalAlerts} tone="neutral" />
            <ScoreBox label="Total" value={score.total} tone="neutral" />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ScoreBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "green" | "red" | "cyan" | "neutral";
}) {
  return (
    <div className={cn("rounded-lg border px-2 py-1.5", scoreBoxClass(tone))}>
      <div className="text-[8px] font-bold uppercase tracking-[0.1em] opacity-75">{label}</div>
      <div className="text-sm font-black leading-tight">{formatCount(value)}</div>
    </div>
  );
}

function AssistantOrb() {
  return (
    <div className="relative grid size-6 shrink-0 place-items-center overflow-hidden rounded-full border border-neon-cyan/35 bg-[#020817] shadow-[0_0_18px_-6px_var(--neon-cyan)]">
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,var(--neon-cyan),var(--neon-purple),var(--neon-blue),var(--neon-cyan))] opacity-85 animate-spin [animation-duration:5.5s]" />
      <span className="absolute inset-[3px] rounded-full bg-background/90" />
      <span className="absolute size-3.5 rounded-full bg-[radial-gradient(circle_at_35%_25%,white_0%,var(--neon-cyan)_34%,var(--neon-purple)_70%,transparent_100%)] shadow-[0_0_14px_var(--neon-cyan)] animate-neural-brain" />
      <span className="absolute left-1 top-1 size-1 rounded-full bg-white/90 blur-[1px]" />
    </div>
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
  if (typeof assertividade === "number") return assertividade;
  return null;
}

function totalGreensFrom(
  acertos?: number | null,
  greenSemGale?: number | null,
  greenG1?: number | null,
) {
  if (typeof acertos === "number" && Number.isFinite(acertos)) return acertos;
  const sg = optionalNumberFrom(greenSemGale);
  const g1 = optionalNumberFrom(greenG1);
  if (sg === null && g1 === null) return null;
  return numberFrom(sg) + numberFrom(g1);
}

function buildGeneralScore(
  scoreboard: NeuralScoreboard | undefined,
  fallbackReading: NeuralReading,
): NeuralScoreSummary {
  const sg = optionalNumberFrom(scoreboard?.greenSemGale ?? fallbackReading.greenSemGale);
  const g1 = optionalNumberFrom(scoreboard?.greenG1 ?? fallbackReading.greenG1);
  const splitGreens = sg !== null || g1 !== null ? numberFrom(sg) + numberFrom(g1) : null;
  const greens = optionalNumberFrom(
    scoreboard?.greens ??
      scoreboard?.acertos ??
      splitGreens ??
      fallbackReading.acertos ??
      fallbackReading.greenSemGale,
  );
  const reds = optionalNumberFrom(scoreboard?.reds ?? scoreboard?.erros ?? fallbackReading.reds ?? fallbackReading.erros);
  const total = numberFrom(greens) + numberFrom(reds);
  const totalAlerts = optionalNumberFrom(scoreboard?.totalAlerts ?? fallbackReading.alertas ?? total);
  const accuracy = optionalNumberFrom(scoreboard?.assertividade ?? fallbackReading.assertividade) ?? accuracyFrom(null, greens, reds);

  return {
    totalAlerts,
    greens,
    sg,
    g1,
    reds,
    total,
    accuracy,
  };
}

function optionalNumberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberFrom(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function neuralOriginKind(reading: NeuralReading) {
  if (reading.postTie || reading.origem === "TIE") return "TIE";
  return reading.origemTipo ?? "PAGANTE";
}

function originBadgeFor(kind: NonNullable<NeuralReading["origemTipo"]>) {
  if (kind === "OPOSTO") {
    return {
      label: "Oposto",
      className: "border-warning/35 bg-warning/10 text-warning",
    };
  }
  if (kind === "TIE") {
    return {
      label: "Tie",
      className: "border-tie/35 bg-tie/10 text-tie",
    };
  }
  return {
    label: "Pagante",
    className: "border-success/35 bg-success/10 text-success",
  };
}

function formatPercent(value: number | null) {
  if (value === null) return "--";
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function formatCount(value: number | null, pad = false) {
  if (value === null) return "--";
  return pad && value >= 0 && value < 10 ? `0${value}` : String(value);
}

function neuralStatusKind(reading: NeuralReading): "green" | "amber" | "red" | "muted" {
  if (reading.mode === "SCANNING" || typeof reading.numero !== "number") return "muted";

  const status = normalizeStatus(reading.paganteStatus);
  if (
    reading.isRedAlert ||
    reading.isSaturated ||
    status.includes("RISCO") ||
    status.includes("ESTICADO") ||
    status.includes("RED") ||
    status.includes("FALH")
  ) {
    return "red";
  }

  if (
    reading.mode === "OBSERVING" ||
    status.includes("INICIANTE") ||
    status.includes("OBSERV") ||
    status.includes("AGUARD") ||
    status.includes("POS-EMPATE") ||
    status.includes("POS EMPATE")
  ) {
    return "amber";
  }

  if (
    reading.mode === "ACTIVE" &&
    (status === "" ||
      status.includes("VALID") ||
      status.includes("GREEN") ||
      status.includes("CONFIRM") ||
      status.includes("FAVOR"))
  ) {
    return "green";
  }

  return "amber";
}

function statusLabel(reading: NeuralReading) {
  if (reading.mode === "SCANNING" || typeof reading.numero !== "number") return "Procurando pagante";
  const status = reading.paganteStatus?.trim();
  if (status) return status.toLocaleLowerCase("pt-BR").replace(/_/g, " ");
  if (neuralStatusKind(reading) === "green") return "leitura batendo";
  return "em observacao";
}

function normalizeStatus(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/_/g, " ");
}

function statusButtonClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "border-success/30 text-success";
  if (status === "red") return "border-destructive/35 text-destructive";
  if (status === "amber") return "border-warning/35 text-warning";
  return "border-white/10 text-muted-foreground";
}

function statusDotClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "bg-success shadow-[0_0_10px_var(--success)]";
  if (status === "red") return "bg-destructive shadow-[0_0_10px_var(--destructive)]";
  if (status === "amber") return "bg-warning shadow-[0_0_10px_var(--warning)]";
  return "bg-muted-foreground/55";
}

function statusPillClass(status: "green" | "amber" | "red" | "muted") {
  if (status === "green") return "border-success/25 bg-success/10 text-success";
  if (status === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "amber") return "border-warning/25 bg-warning/10 text-warning";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function scoreBoxClass(tone: "green" | "red" | "cyan" | "neutral") {
  if (tone === "green") return "border-success/25 bg-success/10 text-success";
  if (tone === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  return "border-white/10 bg-white/5 text-muted-foreground";
}

function sideLabel(side?: NeuralSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Empate";
  return "";
}

function sideClass(side?: NeuralSide | null) {
  if (side === "BANKER") return "text-banker";
  if (side === "PLAYER") return "text-player";
  if (side === "TIE") return "text-tie";
  return "text-muted-foreground";
}
