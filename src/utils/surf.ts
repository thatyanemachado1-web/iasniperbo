import type { SignalSide, SurfAlert, SurfEntrySummary } from "@/types/dashboard";

type BadgeTone = "blue" | "purple" | "green" | "red" | "amber" | "gold" | "muted";

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function surfRiskBand(risk: number): { label: string; tone: BadgeTone; status: string } {
  const value = clampPercent(risk);
  if (value <= 25) return { label: "BAIXO", tone: "green", status: "Quebra pouco provÃ¡vel agora." };
  if (value <= 45) return { label: "OBSERVAÃ‡ÃƒO", tone: "amber", status: "CorreÃ§Ãµes curtas possÃ­veis." };
  if (value <= 65) return { label: "MÃ‰DIO", tone: "amber", status: "Roads pedem cautela tÃ©cnica." };
  if (value <= 85) return { label: "ALTO", tone: "red", status: "Quebra ou virada em monitoramento." };
  return { label: "MUITO ALTO", tone: "red", status: "Estrutura muito pressionada para quebra." };
}

export function surfStrengthBand(confidence: number): { label: string; tone: BadgeTone; status: string } {
  const value = clampPercent(confidence);
  if (value >= 89) {
    return { label: "FORTE PARA SURF", tone: "green", status: "Forca suficiente para seguir o lado do surf." };
  }
  if (value >= 85) {
    return { label: "SURF EM OBSERVACAO", tone: "amber", status: "Aguardar mais uma casa antes de seguir." };
  }
  return { label: "RISCO DE QUEBRA", tone: "red", status: "Nao seguir surf agora." };
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
      status: "Sem leitura de surf relevante atÃ© G1.",
    };
  }

  const oppositeSide: SignalSide = entrySide === "BANKER" ? "PLAYER" : "BANKER";
  const surfSide = alert.surf_side;
  const phase = alert.surf_phase;
  const alignedWithEntry = surfSide === entrySide;
  const againstEntry = surfSide === oppositeSide;
  const breakRisk = alert.surf_break_risk ?? alert.surf_risk;
  let risk = againstEntry ? breakRisk : Math.min(breakRisk, 30);

  if (againstEntry && phase === "PRE_SURF") risk = Math.max(risk, 46);
  if (againstEntry && ["CONTINUIDADE", "SURF_FORTE", "SURF_EXTREMO", "VIRADA_OUTRO_LADO", "POS_MANIPULACAO"].includes(phase)) {
    risk = Math.max(risk, 61);
  }
  if (againstEntry && ["EXAUSTAO", "RISCO_QUEBRA"].includes(phase)) {
    risk = Math.max(risk, 61);
  }
  if (alignedWithEntry && ["QUEBRA_SURF", "RETOMADA_MESMA_COR", "CONTINUIDADE", "SURF_FORTE"].includes(phase)) {
    risk = Math.min(risk, 25);
  }

  risk = clampPercent(risk);

  let status = "Sem risco relevante atÃ© G1.";
  if (alignedWithEntry) status = "Surf alinhado com a entrada.";
  if (againstEntry && phase === "PRE_SURF") status = "AtenÃ§Ã£o: prÃ©-surf contra a entrada.";
  if (againstEntry && phase === "CONTINUIDADE") status = "PossÃ­vel continuidade contra a entrada.";
  if (againstEntry && ["SURF_FORTE", "SURF_EXTREMO", "RISCO_QUEBRA", "VIRADA_OUTRO_LADO", "POS_MANIPULACAO"].includes(phase)) {
    status = "PossÃ­vel virada contra a entrada.";
  }
  if (phase === "SEM_RISCO" || surfSide === "NONE") status = "Sem risco relevante atÃ© G1.";

  return {
    oppositeRisk: risk,
    oppositeRiskLevel: surfOppositeRiskLevel(risk),
    status,
  };
}
