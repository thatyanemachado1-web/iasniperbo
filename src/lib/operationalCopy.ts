import type {
  CurrentSignalSide,
  DashboardData,
  EngineDecision,
  NeuralReading,
  SignalSide,
  SurfAlert,
  TieAlert,
} from "@/types/dashboard";

type PaganteKind = "favorable" | "watch" | "risk";

export function buildEngineDecisionCopy(data: DashboardData) {
  const signal = data.currentSignal;
  const hasMainEntry =
    (signal.status === "pending" || signal.status === "g1") &&
    (signal.side === "BANKER" || signal.side === "PLAYER");

  if (data.engineDecision.state === "BLOQUEADO") {
    return "Entrada bloqueada por risco elevado. Aguardar nova confirmação da engine.";
  }

  if (hasMainEntry && (signal.side === "BANKER" || signal.side === "PLAYER")) {
    return buildEntryCopy(data, signal.side);
  }

  if (data.currentTieAlert.status === "active") {
    return "Mesa em observação. Tie Alert ativo em paralelo, mas sem entrada principal confirmada. Aguardar.";
  }

  const paganteSide = activePaganteSide(data.neuralReading, false);
  if (paganteSide) {
    return `Mesa em observação. Número pagante ativo no ${sideLabel(paganteSide)}, mas a leitura de surf ainda não confirmou direção. Aguardar.`;
  }

  if (data.engineDecision.state === "AGUARDAR" || data.engineDecision.state === "ATENCAO") {
    return "A engine está aguardando uma confirmação mais forte antes de liberar entrada.";
  }

  return "Mesa em observação. Nenhuma entrada principal confirmada no momento. Aguardar.";
}

export function buildAssistantCopy(data: DashboardData) {
  return buildEngineDecisionCopy(data);
}

export function buildSignalCopy(data: DashboardData) {
  const signal = data.currentSignal;
  if (signal.lastResult && (signal.status === "waiting" || isFinalSignalStatus(signal.status))) {
    const result = signal.lastResult.status === "red"
      ? "Red registrado na entrada principal. Aguardar nova análise."
      : `Green registrado na entrada principal em ${sideLabel(signal.lastResult.side)}. Aguardar nova análise.`;
    return result;
  }

  return buildEngineDecisionCopy(data);
}

export function buildSurfCopy(alert?: SurfAlert | null) {
  if (!alert || (!alert.surf_alert && alert.surf_phase === "SEM_RISCO")) {
    return "Leitura de contexto. Aguardar confirmação da entrada principal.";
  }

  const side = surfSide(alert);
  const risk = riskLabel(alert.surf_break_risk ?? alert.surf_risk);
  const suffix = risk === "alto" ? " Aguardar confirmação." : "";
  return `Leitura de surf detectada. ${sideLabel(side)} mostra força no momento, com risco ${risk} de quebra.${suffix}`;
}

export function buildNeuralCopy(reading?: NeuralReading | null) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number" || !reading.origem) {
    return "Nenhum número pagante confirmado no momento. Aguardar.";
  }

  const side = sideLabel(reading.origem);
  const number = reading.numero;
  const direction = reading.direcao;
  const status = paganteKind(reading);

  if (status === "risk") {
    return `Número ${number} apareceu em ${side}, mas está em risco elevado. Aguardar nova confirmação.`;
  }

  if (status === "watch") {
    return `Número ${number} apareceu em ${side}, ainda como leitura complementar. Aguardar confirmação da engine.`;
  }

  if (direction) {
    return `Número pagante identificado. ${side} ${number} apareceu com força e está puxando ${sideLabel(direction)} até ${reading.validade ?? "G1"}.`;
  }

  return `Número pagante identificado. ${side} ${number} apareceu com força nas últimas rodadas.`;
}

export function buildTieCopy(alert: TieAlert) {
  if (alert.status === "green") {
    return "Empate confirmado dentro da validade. Green Tie Alert registrado no placar paralelo.";
  }

  if (alert.status === "expired") {
    return "O alerta de empate expirou. Expiração não é RED.";
  }

  const level = riskLabelFromText(alert.level);
  return `Atenção para empate. Mesa com pressão ${level} de Tie, validade de até ${roundsText(alert.validityRounds)}.`;
}

export function buildDecisionFallbackCopy(decision: EngineDecision) {
  if (decision.state === "BLOQUEADO") {
    return "Entrada bloqueada por risco elevado. Aguardar nova confirmação da engine.";
  }
  if (decision.state === "AGUARDAR" || decision.state === "ATENCAO") {
    return "A engine está aguardando uma confirmação mais forte antes de liberar entrada.";
  }
  return "Entrada confirmada pela engine. Acompanhar a proteção indicada.";
}

function buildEntryCopy(data: DashboardData, side: SignalSide) {
  const reasons = ["tendência ativa"];
  const paganteSide = activePaganteSide(data.neuralReading);
  const surf = data.currentSurfAlert;
  const surfAligned = surf && surfSide(surf) === side && surf.surf_alert;
  const risk = entryRisk(data, side);

  if (paganteSide === side) reasons.push("número pagante favorável");
  if (surfAligned) reasons.push("leitura de surf favorável");

  if (risk === "alto") {
    return `Entrada confirmada em ${sideLabel(side)}. Motivo: ${joinReasons(reasons)}, mas com risco elevado monitorado.`;
  }

  if (risk === "médio") {
    return `Entrada confirmada em ${sideLabel(side)}. Motivo: ${joinReasons(reasons)}, mas com risco médio monitorado.`;
  }

  reasons.push("risco controlado");
  return `Entrada confirmada em ${sideLabel(side)}. Motivo: ${joinReasons(reasons)}.`;
}

function entryRisk(data: DashboardData, side: SignalSide) {
  const tieHigh = data.currentTieAlert.status === "active" && riskLabelFromText(data.currentTieAlert.level) === "alta";
  const surf = data.currentSurfAlert;
  const surfOpposite = surf && surfSide(surf) !== side && (surf.surf_break_risk ?? surf.surf_risk) >= 65;
  const paganteRisk = paganteKind(data.neuralReading) === "risk";
  const mediumSurf = surf && (surf.surf_break_risk ?? surf.surf_risk) >= 40;

  if (tieHigh || surfOpposite || paganteRisk) return "alto";
  if (mediumSurf) return "médio";
  return "baixo";
}

function activePaganteSide(reading?: NeuralReading | null, favorableOnly = true): CurrentSignalSide | null {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return null;
  const status = paganteKind(reading);
  if (status === "risk" || (favorableOnly && status !== "favorable")) return null;
  return reading.direcao ?? reading.origem ?? null;
}

function paganteKind(reading?: NeuralReading | null): PaganteKind {
  if (!reading) return "watch";
  const status = normalizeText(reading.paganteStatus);
  if (reading.isRedAlert || reading.isSaturated || status.includes("RISCO") || status.includes("ESTICADO")) {
    return "risk";
  }
  if (
    reading.mode === "OBSERVING" ||
    status.includes("INICIANTE") ||
    status.includes("OBSERV") ||
    status.includes("POS-EMPATE") ||
    status.includes("POS EMPATE")
  ) {
    return "watch";
  }
  return "favorable";
}

function surfSide(alert: SurfAlert): CurrentSignalSide {
  if (alert.surf_prediction_side && alert.surf_prediction_side !== "NONE") return alert.surf_prediction_side;
  return alert.surf_side === "NONE" ? "NONE" : alert.surf_side;
}

function isFinalSignalStatus(status: DashboardData["currentSignal"]["status"]) {
  return status === "green" || status === "green_g1" || status === "red";
}

function riskLabel(value: number) {
  if (value >= 70) return "alto";
  if (value >= 40) return "médio";
  return "baixo";
}

function riskLabelFromText(value: string) {
  const normalized = normalizeText(value);
  if (normalized.includes("ALTO")) return "alta";
  if (normalized.includes("MED")) return "média";
  return "baixa";
}

function sideLabel(side?: CurrentSignalSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "mesa";
}

function roundsText(value: number) {
  if (value <= 1) return "uma rodada";
  if (value === 2) return "duas rodadas";
  if (value === 3) return "três rodadas";
  if (value === 4) return "quatro rodadas";
  return `${value} rodadas`;
}

function joinReasons(reasons: string[]) {
  if (reasons.length <= 1) return reasons[0] ?? "confirmação da engine";
  return `${reasons.slice(0, -1).join(", ")} e ${reasons[reasons.length - 1]}`;
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
