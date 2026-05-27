import type { SignalSide, SurfAlert, SurfEntrySummary } from "@/types/dashboard";

type BadgeTone = "blue" | "purple" | "green" | "red" | "amber" | "gold" | "muted";

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function surfRiskBand(risk: number): { label: string; tone: BadgeTone; status: string } {
  const value = clampPercent(risk);
  if (value <= 15) return { label: "SEM RISCO", tone: "green", status: "Mesa limpa contra reversao." };
  if (value <= 30) return { label: "RISCO BAIXO", tone: "green", status: "Pequenas correcoes possiveis." };
  if (value <= 45) return { label: "BAIXO/MEDIO", tone: "amber", status: "Pre-surf contrario com atencao leve." };
  if (value <= 60) return { label: "RISCO MEDIO", tone: "amber", status: "Roads comecam a divergir." };
  if (value <= 75) return { label: "RISCO ALTO", tone: "red", status: "Surf contrario pode nascer." };
  if (value <= 90) return { label: "RISCO MUITO ALTO", tone: "red", status: "Possivel quebra de surf." };
  return { label: "QUEBRA IMINENTE", tone: "red", status: "Alta chance de virada ou correcao forte." };
}

export function surfOppositeRiskLevel(risk: number): SurfEntrySummary["oppositeRiskLevel"] {
  const value = clampPercent(risk);
  if (value <= 30) return "BAIXO";
  if (value <= 60) return "MEDIO";
  return "ALTO";
}

export function buildSurfEntrySummary(
  alert: SurfAlert | undefined,
  entrySide: SignalSide,
): SurfEntrySummary {
  if (!alert) {
    return {
      oppositeRisk: 0,
      oppositeRiskLevel: "BAIXO",
      status: "Sem leitura de surf relevante ate G1.",
    };
  }

  const oppositeSide: SignalSide = entrySide === "BANKER" ? "PLAYER" : "BANKER";
  const surfSide = alert.surf_side;
  const phase = alert.surf_phase;
  const alignedWithEntry = surfSide === entrySide;
  const againstEntry = surfSide === oppositeSide;
  let risk = againstEntry ? alert.surf_risk : Math.min(alert.surf_risk, 30);

  if (againstEntry && phase === "PRE_SURF") risk = Math.max(risk, 46);
  if (againstEntry && ["SURF_ATIVO", "SURF_ESTICADO", "VIRADA_OUTRO_LADO"].includes(phase)) {
    risk = Math.max(risk, 61);
  }
  if (alignedWithEntry && ["QUEBRA_SURF", "RETOMADA_MESMA_COR"].includes(phase)) {
    risk = Math.min(risk, 25);
  }

  risk = clampPercent(risk);

  let status = "Sem risco relevante ate G1.";
  if (alignedWithEntry) status = "Surf alinhado com a entrada.";
  if (againstEntry && phase === "PRE_SURF") status = "Atencao: pre-surf contra a entrada.";
  if (againstEntry && phase === "SURF_ATIVO") status = "Risco de surf ativo contra a entrada.";
  if (againstEntry && ["SURF_ESTICADO", "RISCO_QUEBRA", "VIRADA_OUTRO_LADO"].includes(phase)) {
    status = "Risco de surf virar contra a entrada.";
  }
  if (phase === "SEM_RISCO" || surfSide === "NONE") status = "Sem risco relevante ate G1.";

  return {
    oppositeRisk: risk,
    oppositeRiskLevel: surfOppositeRiskLevel(risk),
    status,
  };
}
