import { BrainCircuit, CheckCircle2, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import type { NeuralEntryLastResult, SignalSide } from "@/types/dashboard";

type PopupKind = "green" | "red" | "tie";

interface NeuralEntryPopup {
  id: string;
  kind: PopupKind;
  side: SignalSide | "TIE";
  title: string;
  subtitle: string;
}

const RESULT_VISIBLE_MS = 2_000;
const POPUP_TTL_MS = 900;

export function NeuralEntryLivePopupBridge() {
  const { data, mode } = useDashboardData();
  const [popup, setPopup] = useState<NeuralEntryPopup | null>(null);
  const previousKeyRef = useRef("");
  const result = data.neuralEntryLastResult;
  const key = useMemo(() => neuralPopupKey(result), [result]);

  useEffect(() => {
    if (mode !== "live" || data.mockMode || !key || key === previousKeyRef.current) return;
    previousKeyRef.current = key;
    const nextPopup = buildNeuralPopup(result);
    if (nextPopup) setPopup(nextPopup);
  }, [data.mockMode, key, mode, result]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), POPUP_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [popup?.id]);

  if (!popup) return null;

  const tone = popupTone(popup.kind);

  return (
    <div className="pointer-events-none fixed left-1/2 top-[7.25rem] z-[84] w-[min(300px,calc(100vw-1rem))] -translate-x-1/2 sm:right-4 sm:left-auto sm:top-[7.75rem] sm:translate-x-0">
      <div
        className={`pointer-events-auto overflow-hidden rounded-xl border ${tone.border} ${tone.bg} shadow-xl backdrop-blur-xl`}
      >
        <div className={`h-0.5 ${tone.bar}`} />
        <div className="flex items-center gap-2 p-2.5">
          <div
            className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${tone.iconBorder} ${tone.iconBg}`}
          >
            {popup.kind === "red" ? (
              <XCircle className="size-4" />
            ) : popup.kind === "green" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <BrainCircuit className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm font-black leading-tight ${tone.text}`}>{popup.title}</div>
            <div className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{popup.subtitle}</div>
          </div>
          <button
            type="button"
            aria-label="Fechar alerta neural"
            onClick={() => setPopup(null)}
            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/45 text-muted-foreground transition hover:border-neon-cyan/50 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function neuralPopupKey(result?: NeuralEntryLastResult | null) {
  if (!result?.id || !isFreshResult(result.finishedAt)) return "";
  return `${result.id}:${result.outcome}:${result.kind}:${result.expectedSide ?? result.origem ?? ""}:${result.finishedAt}`;
}

function buildNeuralPopup(result?: NeuralEntryLastResult | null): NeuralEntryPopup | null {
  if (!result?.id || !isFreshResult(result.finishedAt)) return null;

  const side = normalizeSide(result.expectedSide ?? result.origem);
  if (result.outcome === "TIE" || result.kind === "tie_sg" || result.kind === "tie_g1") {
    const multiplier = result.tieMultiplier ? `${result.tieMultiplier}X` : "";
    return {
      id: `neural-tie-${result.id}`,
      kind: "tie",
      side: "TIE",
      title: `EMPATE ${multiplier}`.trim(),
      subtitle: "Leitura Neural confirmou empate na validade",
    };
  }

  if (result.outcome === "RED" || result.kind === "red") {
    return {
      id: `neural-red-${result.id}`,
      kind: "red",
      side,
      title: "RED NEURAL",
      subtitle: `${sideLabel(side)} não bateu na validade`,
    };
  }

  const greenLabel =
    result.kind === "g1" ? "GREEN G1 NEURAL" : result.kind === "sg" ? "GREEN SG NEURAL" : "GREEN NEURAL";
  return {
    id: `neural-green-${result.id}`,
    kind: "green",
    side,
    title: greenLabel,
    subtitle: `${sideLabel(side)} confirmado pela Leitura Neural`,
  };
}

function normalizeSide(side: SignalSide | "TIE" | null | undefined): SignalSide | "TIE" {
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") return side;
  return "TIE";
}

function sideLabel(side: SignalSide | "TIE") {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  return "Empate";
}

function isFreshResult(finishedAt?: string) {
  const time = Date.parse(finishedAt ?? "");
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= RESULT_VISIBLE_MS;
}

function popupTone(kind: PopupKind) {
  if (kind === "green") {
    return {
      border: "border-success/50",
      bg: "bg-success/10",
      bar: "bg-success",
      iconBorder: "border-success/40",
      iconBg: "bg-success/15 text-success",
      text: "text-success",
    };
  }
  if (kind === "red") {
    return {
      border: "border-destructive/55",
      bg: "bg-destructive/10",
      bar: "bg-destructive",
      iconBorder: "border-destructive/45",
      iconBg: "bg-destructive/15 text-destructive",
      text: "text-destructive",
    };
  }
  return {
    border: "border-warning/55",
    bg: "bg-warning/10",
    bar: "bg-warning",
    iconBorder: "border-warning/45",
    iconBg: "bg-warning/15 text-warning",
    text: "text-warning",
  };
}
