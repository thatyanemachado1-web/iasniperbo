import { CheckCircle2, Radio, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardData, isDashboardLive } from "@/hooks/useDashboardData";
import type { MainSignal, SignalSide } from "@/types/dashboard";

type PopupKind = "entry" | "g1" | "green" | "red" | "tie";

interface MainSignalPopup {
  id: string;
  kind: PopupKind;
  side: SignalSide;
  title: string;
  subtitle: string;
  createdAt: number;
}

const RESULT_VISIBLE_MS = 45_000;
const POPUP_TTL_MS = 12_000;

export function MainSignalLivePopupBridge() {
  const { data, mode } = useDashboardData();
  const [popup, setPopup] = useState<MainSignalPopup | null>(null);
  const previousKeyRef = useRef("");
  const liveDashboard = isDashboardLive(data, mode);
  const key = useMemo(() => signalPopupKey(signal), [signal]);

  const signal = data.currentSignal;

  useEffect(() => {
    if (!liveDashboard || !key || key === previousKeyRef.current) return;
    previousKeyRef.current = key;
    const nextPopup = buildSignalPopup(signal);
    if (nextPopup) setPopup(nextPopup);
  }, [key, liveDashboard, signal]);

  useEffect(() => {
    if (!popup) return;
    const timer = window.setTimeout(() => setPopup(null), POPUP_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [popup?.id]);

  if (!popup) return null;

  const tone = popupTone(popup.kind);

  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-[85] w-[min(300px,calc(100vw-1rem))] -translate-x-1/2 sm:right-4 sm:left-auto sm:top-[4.5rem] sm:translate-x-0">
      <div className={`pointer-events-auto overflow-hidden rounded-xl border ${tone.border} ${tone.bg} shadow-xl backdrop-blur-xl`}>
        <div className={`h-0.5 ${tone.bar}`} />
        <div className="flex items-center gap-2 p-2.5">
          <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg border ${tone.iconBorder} ${tone.iconBg}`}>
            {popup.kind === "red" ? <XCircle className="size-4" /> : popup.kind === "green" ? <CheckCircle2 className="size-4" /> : <Radio className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate text-sm font-black leading-tight ${tone.text}`}>{popup.title}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
              <SideDot side={popup.side} />
              <span className="truncate">{popup.subtitle}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar alerta"
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

function signalPopupKey(signal: MainSignal) {
  const result = signal.lastResult;
  if (result && isFreshResult(result.finishedAt)) {
    return `result:${result.id}:${result.status}:${result.side}:${result.finishedAt ?? ""}`;
  }
  if ((signal.status === "pending" || signal.status === "g1") && isEntrySide(signal.side)) {
    return `entry:${signal.id}:${signal.status}:${signal.side}`;
  }
  return "";
}

function buildSignalPopup(signal: MainSignal): MainSignalPopup | null {
  const result = signal.lastResult;
  const now = Date.now();

  if (result && isFreshResult(result.finishedAt)) {
    const green = result.status === "green" || result.status === "green_g1";
    const tie = result.status === "tie";
    return {
      id: `main-result-${result.id}-${result.status}`,
      kind: tie ? "tie" : green ? "green" : "red",
      side: result.side,
      title: tie ? "TIE" : green ? (result.status === "green_g1" ? "GREEN G1" : "GREEN SG") : "RED",
      subtitle: tie ? `Empate protegido em ${sideLabel(result.side)}` : `${sideLabel(result.side)} finalizado`,
      createdAt: now,
    };
  }

  if ((signal.status === "pending" || signal.status === "g1") && isEntrySide(signal.side)) {
    return {
      id: `main-entry-${signal.id}-${signal.status}`,
      kind: signal.status === "g1" ? "g1" : "entry",
      side: signal.side,
      title: signal.status === "g1" ? "FAZ O G1" : "ENTRADA CONFIRMADA",
      subtitle: `${sideLabel(signal.side)} - ${signal.protection}`,
      createdAt: now,
    };
  }

  return null;
}

function isFreshResult(finishedAt?: string) {
  const time = Date.parse(finishedAt ?? "");
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= RESULT_VISIBLE_MS;
}

function isEntrySide(side: MainSignal["side"]): side is SignalSide {
  return side === "BANKER" || side === "PLAYER";
}

function sideLabel(side: SignalSide) {
  return side === "BANKER" ? "Banker" : "Player";
}

function SideDot({ side }: { side: SignalSide }) {
  return (
    <span
      className={`inline-flex size-2.5 shrink-0 rounded-full ${
        side === "BANKER" ? "bg-destructive shadow-[0_0_10px_rgba(255,45,85,0.7)]" : "bg-info shadow-[0_0_10px_rgba(59,130,246,0.7)]"
      }`}
    />
  );
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
  if (kind === "tie") {
    return {
      border: "border-warning/55",
      bg: "bg-warning/10",
      bar: "bg-warning",
      iconBorder: "border-warning/45",
      iconBg: "bg-warning/15 text-warning",
      text: "text-warning",
    };
  }
  if (kind === "g1") {
    return {
      border: "border-warning/55",
      bg: "bg-warning/10",
      bar: "bg-warning",
      iconBorder: "border-warning/45",
      iconBg: "bg-warning/15 text-warning",
      text: "text-warning",
    };
  }
  return {
    border: "border-neon-cyan/50",
    bg: "bg-neon-cyan/10",
    bar: "bg-neon-cyan",
    iconBorder: "border-neon-cyan/40",
    iconBg: "bg-neon-cyan/15 text-neon-cyan",
    text: "text-neon-cyan",
  };
}
