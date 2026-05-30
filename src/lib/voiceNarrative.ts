import type {
  CurrentSignalSide,
  DashboardData,
  NeuralReading,
  SurfAlert,
  TieAlert,
} from "@/types/dashboard";
import { buildSurfEntrySummary } from "@/utils/surf";

export type VoiceNarrationStyle = "balanced" | "aggressive";
export type VoicePriority = 1 | 2 | 3;
type PaganteStatusKind = "favorable" | "watch" | "risk";

export interface VoiceEvent {
  key: string;
  text: string;
  priority: VoicePriority;
  bypassCooldown: boolean;
}

export const DEFAULT_VOICE_NARRATION_STYLE: VoiceNarrationStyle = "balanced";

export function isVoiceNarrationStyle(value: unknown): value is VoiceNarrationStyle {
  return value === "balanced" || value === "aggressive";
}

export function buildVoiceResultEvents(
  previousData: DashboardData | null | undefined,
  data: DashboardData,
  style: VoiceNarrationStyle = DEFAULT_VOICE_NARRATION_STYLE,
): VoiceEvent[] {
  if (!previousData) return [];

  const name = firstName(data.user?.name);
  const events: VoiceEvent[] = [];
  const lastResult = data.currentSignal.lastResult;
  const previousLastResult = previousData.currentSignal.lastResult;

  if (lastResult && resultKey(lastResult) !== resultKey(previousLastResult)) {
    events.push(
      urgent(
        `result-main:${resultKey(lastResult)}:${style}`,
        mainResultText(name, lastResult.side, lastResult.status, lastResult.protection, style),
      ),
    );
  }

  if (
    data.currentTieAlert.status !== "active" &&
    tieResultKey(data.currentTieAlert) !== tieResultKey(previousData.currentTieAlert)
  ) {
    events.push(
      urgent(
        `result-tie:${tieResultKey(data.currentTieAlert)}:${style}`,
        tieResultText(name, data.currentTieAlert.status, style),
      ),
    );
  }

  const surfStatus = data.currentSurfAlert?.surf_prediction_status;
  if (
    surfStatus &&
    surfStatus !== "ACTIVE" &&
    surfResultKey(data.currentSurfAlert) !== surfResultKey(previousData.currentSurfAlert)
  ) {
    events.push(
      urgent(
        `result-surf:${surfResultKey(data.currentSurfAlert)}:${style}`,
        surfResultText(name, data.currentSurfAlert, style),
      ),
    );
  }

  const neuralEvent = buildNeuralResultEvent(previousData.neuralReading, data.neuralReading, name, style);
  if (neuralEvent) events.push(neuralEvent);

  return events;
}

export function buildVoiceEvents(
  data: DashboardData,
  style: VoiceNarrationStyle = DEFAULT_VOICE_NARRATION_STYLE,
): VoiceEvent[] {
  const signal = data.currentSignal;
  const decision = data.engineDecision;
  const roundId = data.rounds[data.rounds.length - 1]?.id ?? "sem-rodada";
  const name = firstName(data.user?.name);
  const hasMainEntry =
    (signal.status === "pending" || signal.status === "g1") &&
    (signal.side === "BANKER" || signal.side === "PLAYER");
  const hasTieEntry =
    (signal.status === "pending" || signal.status === "g1") && signal.side === "TIE";
  const mainEntrySide = hasMainEntry && (signal.side === "BANKER" || signal.side === "PLAYER")
    ? signal.side
    : undefined;

  const paganteContext = buildPaganteContext(data.neuralReading, mainEntrySide, style);
  const candidateEvents: VoiceEvent[] = [];

  if (decision.state === "BLOQUEADO") {
    candidateEvents.push(
      urgent(
        `blocked:${roundId}:${decision.reason}:${decision.confidence}:${style}`,
        blockedText(name, decision.reason, paganteContext.text, style),
      ),
    );
  }

  if (mainEntrySide) {
    const entryRiskText = buildEntryRiskText(data, mainEntrySide, paganteContext, style);
    candidateEvents.push(
      urgent(
        `entry:${signal.id}:${signal.side}:${signal.status}:${signal.protection}:${style}`,
        entryText(
          name,
          signal.side,
          signal.status,
          signal.protection,
          decision.reason,
          paganteContext.text,
          entryRiskText,
          style,
        ),
      ),
    );
  }

  if (hasTieEntry) {
    candidateEvents.push(
      urgent(
        `entry-tie:${signal.id}:${signal.status}:${paganteContext.key}:${style}`,
        tieEntryText(name, decision.reason, paganteContext.text, style),
      ),
    );
  }

  const surfEvent = buildSurfEvent(data.currentSurfAlert, name, style);
  const tieEvent = buildTieEvent(data.currentTieAlert, name, style);
  const neuralEvent = buildNeuralEvent(data.neuralReading, name, style, roundId);

  if (neuralEvent) {
    candidateEvents.push(neuralEvent);
  }

  if (!hasTieEntry && signal.status === "tie_watch" && tieEvent) {
    candidateEvents.push(tieEvent);
  }

  if (surfEvent) {
    candidateEvents.push(surfEvent);
  }

  if (!hasTieEntry && signal.status !== "tie_watch" && tieEvent) {
    candidateEvents.push(tieEvent);
  }

  const bestSide = currentBestSide(data);
  if (!hasMainEntry && !hasTieEntry && bestSide) {
    candidateEvents.push(
      medium(
        `current-reading:${roundId}:${decision.state}:${bestSide}:${decision.reason}:${paganteContext.key}:${style}`,
        currentReadingText(name, bestSide, decision.reason, paganteContext.text, style),
      ),
    );
  }

  if (!hasMainEntry && !hasTieEntry && signal.status === "waiting" && decision.state !== "BLOQUEADO") {
    const lastRoundId = data.rounds[data.rounds.length - 1]?.id ?? "sem-rodada";
    candidateEvents.push(
      common(
        `observing:${lastRoundId}:${decision.state}:${decision.reason}:${style}`,
        observingText(name, decision.reason, style),
      ),
    );
  }

  return candidateEvents;
}

function blockedText(name: string, reason: string, paganteText: string, style: VoiceNarrationStyle) {
  if (style === "aggressive") {
    return `${namePrefix(name)}atenção nessa linha. Entrada bloqueada por risco alto. Motivo: ${reason}${paganteText} Aqui é mão leve e gestão.`;
  }

  return `Sem entrada agora. A leitura bloqueou por risco alto. Motivo: ${reason}${paganteText}`;
}

function mainResultText(
  name: string,
  side: CurrentSignalSide,
  status: "green" | "green_g1" | "red",
  protection: string,
  style: VoiceNarrationStyle,
) {
  const sideText = sideLabel(side);
  if (status === "red") {
    return style === "aggressive"
      ? `${namePrefix(name)}red registrado na entrada principal em ${sideText}. Respeita a gestão e aguarda nova leitura.`
      : `Red registrado na entrada principal em ${sideText}. Aguardar nova análise.`;
  }

  const greenText = status === "green_g1" ? `Green no G1 em ${sideText}` : `Green em ${sideText}`;
  return style === "aggressive"
    ? `${namePrefix(name)}boa. ${greenText} na entrada principal. Protege a gestão.`
    : `${greenText} na entrada principal, com proteção ${protection}.`;
}

function tieResultText(name: string, status: TieAlert["status"], style: VoiceNarrationStyle) {
  if (status === "green") {
    return style === "aggressive"
      ? `${namePrefix(name)}tiro certo no empate. A análise Tie confirmou green. Agora segura a emoção e respeita a gestão.`
      : `Tiro certo no empate. A análise Tie confirmou green.`;
  }

  return style === "aggressive"
    ? `${namePrefix(name)}Tie expirou sem confirmar. Sem forçar a próxima mão; espera a leitura voltar.`
    : `Tie expirou sem confirmar. Aguardar nova leitura.`;
}

function surfResultText(name: string, alert: SurfAlert | undefined, style: VoiceNarrationStyle) {
  const side = sideLabel(alert?.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert?.surf_side);

  if (alert?.surf_prediction_status === "HIT") {
    return style === "aggressive"
      ? `${namePrefix(name)}acertamos no Surf Analyzer. O surf respeitou em ${side}. Gestão mantida.`
      : `Acertamos no Surf Analyzer. A leitura de surf confirmou em ${side}.`;
  }

  if (alert?.surf_prediction_status === "FAILED") {
    return style === "aggressive"
      ? `${namePrefix(name)}Surf não confirmou agora. Registra o red do Surf Analyzer e espera nova formação.`
      : `Surf Analyzer não confirmou agora. Aguardar nova formação.`;
  }

  return style === "aggressive"
    ? `${namePrefix(name)}Surf expirou sem confirmar. Melhor esperar outra leitura limpa.`
    : `Surf Analyzer expirou sem confirmar. Aguardar nova leitura.`;
}

function buildNeuralResultEvent(
  previousReading: NeuralReading | undefined,
  reading: NeuralReading | undefined,
  name: string,
  style: VoiceNarrationStyle,
): VoiceEvent | null {
  if (!previousReading || !reading || !isSameNeuralReading(previousReading, reading)) return null;

  const previousGreens = neuralGreens(previousReading);
  const currentGreens = neuralGreens(reading);
  const previousReds = neuralReds(previousReading);
  const currentReds = neuralReds(reading);
  const side = reading.direcao ?? reading.origem;
  const number = reading.numero;

  if (typeof number === "number" && side && currentGreens > previousGreens) {
    const g1Increased = safeNumber(reading.greenG1) > safeNumber(previousReading.greenG1);
    const protection = g1Increased ? " no G1" : "";
    return urgent(
      `result-neural:green:${number}:${side}:${currentGreens}:${currentReds}:${style}`,
      style === "aggressive"
        ? `${namePrefix(name)}número pagante respeitou mesmo. Foi green${protection} na previsão de número pagante ${number}, puxando ${sideLabel(side)}.`
        : `Número pagante respeitou. Foi green${protection} na previsão de número pagante ${number}, em ${sideLabel(side)}.`,
    );
  }

  if (typeof number === "number" && side && currentReds > previousReds) {
    return urgent(
      `result-neural:red:${number}:${side}:${currentGreens}:${currentReds}:${style}`,
      style === "aggressive"
        ? `${namePrefix(name)}número pagante não confirmou agora. Red na previsão do número ${number}; gestão primeiro.`
        : `Número pagante ${number} não confirmou agora. Aguardar nova leitura.`,
    );
  }

  return null;
}

function entryText(
  name: string,
  side: CurrentSignalSide,
  status: DashboardData["currentSignal"]["status"],
  protection: string,
  reason: string,
  paganteText: string,
  riskText: string,
  style: VoiceNarrationStyle,
) {
  const action = entryActionText(status, protection, style);
  if (style === "aggressive") {
    return `${namePrefix(name)}olha essa leitura: ${sideLabel(side)} está puxando forte. ${action} Motivo: ${reason}${paganteText}${riskText}`;
  }

  return `Leitura atual favorece ${sideLabel(side)}. ${action} Motivo: ${reason}${paganteText}${riskText}`;
}

function entryActionText(
  status: DashboardData["currentSignal"]["status"],
  protection: string,
  style: VoiceNarrationStyle,
) {
  if (status === "g1") {
    return style === "aggressive"
      ? `Fazer Gale 1 na proteção ${protection}, sem sair da gestão.`
      : `Proteção G1 ativa. Fazer Gale 1 com proteção ${protection}.`;
  }

  return `Entrada confirmada com proteção ${protection}.`;
}

function tieEntryText(name: string, reason: string, paganteText: string, style: VoiceNarrationStyle) {
  if (style === "aggressive") {
    return `${namePrefix(name)}atenção: leitura favorece Tie agora. Entrada confirmada em Tie. Motivo: ${reason}${paganteText} Gestão e cautela.`;
  }

  return `Leitura atual favorece Tie. Entrada confirmada em Tie. Motivo: ${reason}${paganteText}`;
}

function currentReadingText(
  name: string,
  side: CurrentSignalSide,
  reason: string,
  paganteText: string,
  style: VoiceNarrationStyle,
) {
  if (style === "aggressive") {
    return `${namePrefix(name)}olha essa leitura: ${sideLabel(side)} está mais interessante, mas ainda sem entrada confirmada. Motivo: ${reason}${paganteText}`;
  }

  return `Leitura do momento favorece ${sideLabel(side)}, mas ainda sem entrada confirmada. Motivo: ${reason}${paganteText}`;
}

function observingText(name: string, reason: string, style: VoiceNarrationStyle) {
  if (style === "aggressive") {
    return `${namePrefix(name)}mesa em observação. Ainda não tem entrada limpa. ${reason}`;
  }

  return `Mesa em observação sem entrada confirmada. ${reason}`;
}

function buildPaganteContext(
  reading: NeuralReading | undefined,
  entrySide: CurrentSignalSide | undefined,
  style: VoiceNarrationStyle,
) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") {
    return { key: "no-pagante", text: "", isAlignedWithEntry: false };
  }

  const paganteSide = reading.direcao ?? reading.origem;
  if (!paganteSide) return { key: "no-pagante-side", text: "", isAlignedWithEntry: false };

  const key = `pagante:${reading.numero}:${paganteSide}:${reading.validade ?? ""}:${reading.paganteStatus ?? ""}`;
  const statusKind = paganteStatusKind(reading);
  const status = paganteStatusLabel(reading);
  const isEntrySide = entrySide && entrySide !== "NONE" && entrySide !== "TIE";
  const isAlignedWithEntry = Boolean(isEntrySide && paganteSide === entrySide && statusKind === "favorable");

  if (statusKind === "risk") {
    const suffix = style === "aggressive" ? " Gestão primeiro." : "";
    return {
      key,
      text: ` Atenção: número ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, mas está ${status}; não tratar como pagante favorável agora.${suffix}`,
      isAlignedWithEntry: false,
    };
  }

  if (statusKind === "watch") {
    const text =
      style === "aggressive"
        ? ` Número ${reading.numero} apareceu em ${sideLabel(paganteSide)}, mas ainda sem confirmação forte.`
        : ` Número ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, mas ainda está ${status}.`;
    return { key, text, isAlignedWithEntry: false };
  }

  if (entrySide && entrySide !== "NONE" && entrySide !== "TIE") {
    const text = paganteSide !== entrySide
      ? againstEntryPaganteText(reading.numero, paganteSide, style)
      : alignedPaganteText(reading.numero, paganteSide, style);
    return { key, text, isAlignedWithEntry };
  }

  return {
    key,
    text: style === "aggressive"
      ? ` Número pagante ${reading.numero} apareceu em ${sideLabel(paganteSide)} agora; vale observar confirmação.`
      : ` Número pagante ${reading.numero} aponta ${sideLabel(paganteSide)} agora.`,
    isAlignedWithEntry,
  };
}

function againstEntryPaganteText(
  number: number,
  side: CurrentSignalSide,
  style: VoiceNarrationStyle,
) {
  if (style === "aggressive") {
    return ` Mas atenção: o número pagante ${number} apareceu contra, puxando ${sideLabel(side)}.`;
  }

  return ` Atenção: número pagante ${number} também aponta ${sideLabel(side)} agora.`;
}

function alignedPaganteText(
  number: number,
  side: CurrentSignalSide,
  style: VoiceNarrationStyle,
) {
  if (style === "aggressive") {
    return ` Número pagante ${number} alinhou junto com ${sideLabel(side)}.`;
  }

  return ` Número pagante ${number} alinhado com ${sideLabel(side)} agora.`;
}

function buildEntryRiskText(
  data: DashboardData,
  entrySide: "BANKER" | "PLAYER",
  paganteContext: ReturnType<typeof buildPaganteContext>,
  style: VoiceNarrationStyle,
) {
  if (!paganteContext.isAlignedWithEntry) {
    return style === "aggressive" ? " Entra com gestão." : "";
  }

  if (hasHighRiskForEntry(data, entrySide)) {
    return style === "aggressive"
      ? " Número pagante alinhado, mas tem risco alto no radar. Aqui é mão leve e gestão."
      : " Número pagante alinhado, mas ainda existe risco alto sinalizado; manter leitura protegida.";
  }

  return style === "aggressive"
    ? " Número pagante alinhado e sem risco alto identificado nos dados atuais. Dá para ir, só entra com gestão."
    : " Número pagante alinhado; sem risco alto identificado nos dados atuais.";
}

function hasHighRiskForEntry(data: DashboardData, entrySide: "BANKER" | "PLAYER") {
  const tieHigh =
    data.currentTieAlert.status === "active" &&
    normalizeText(data.currentTieAlert.level).includes("ALTO");
  const surfHigh = buildSurfEntrySummary(data.currentSurfAlert, entrySide).oppositeRiskLevel === "ALTO";
  const paganteHigh = paganteStatusKind(data.neuralReading) === "risk";

  return tieHigh || surfHigh || paganteHigh || data.engineDecision.state === "BLOQUEADO";
}

function appendEventText(event: VoiceEvent, text: string) {
  if (!text) return event;
  return { ...event, key: `${event.key}:${text}`, text: `${event.text}${text}` };
}

function currentBestSide(data: DashboardData): CurrentSignalSide | null {
  const surfSide = data.currentSurfAlert?.surf_prediction_side || data.currentSurfAlert?.surf_side;
  if (surfSide === "BANKER" || surfSide === "PLAYER") return surfSide;

  const neuralSide = isFavorablePagante(data.neuralReading)
    ? data.neuralReading?.direcao ?? data.neuralReading?.origem
    : null;
  if (neuralSide === "BANKER" || neuralSide === "PLAYER" || neuralSide === "TIE") {
    return neuralSide;
  }

  return null;
}

function buildNeuralEvent(
  reading: NeuralReading | undefined,
  name: string,
  style: VoiceNarrationStyle,
  roundId: string,
): VoiceEvent | null {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return null;

  const side = reading.direcao ?? reading.origem;
  if (!side) return null;

  const statusKind = paganteStatusKind(reading);
  const status = paganteStatusLabel(reading);
  const details = [
    `${sideLabel(side)} ${reading.numero}`,
    reading.validade ? `validade ${reading.validade}` : "",
    reading.paganteStatus ? `status ${reading.paganteStatus}` : "",
    reading.paganteAlert ?? "",
  ].filter(Boolean);

  return analysis(
    `neural:${roundId}:${reading.mode}:${reading.numero}:${reading.origem ?? ""}:${reading.direcao ?? ""}:${reading.validade ?? ""}:${reading.paganteStatus ?? ""}:${reading.alertas ?? ""}:${style}`,
    neuralEventText(statusKind, reading.numero, side, status, details, reading.paganteAlert, name, style),
  );
}

function neuralEventText(
  statusKind: PaganteStatusKind,
  number: number,
  side: CurrentSignalSide,
  status: string,
  details: string[],
  alert: string | null | undefined,
  name: string,
  style: VoiceNarrationStyle,
) {
  if (statusKind === "risk") {
    const base = `Número ${number} apareceu apontando ${sideLabel(side)}, mas está ${status}. Não tratar como pagante favorável agora${alert ? `. ${alert}` : ""}.`;
    return style === "aggressive" ? `${namePrefix(name)}atenção nesse número. ${base} Mão leve.` : base;
  }

  if (statusKind === "watch") {
    return style === "aggressive"
      ? `${namePrefix(name)}olha essa leitura: número ${number} apareceu em ${sideLabel(side)}, mas ainda precisa confirmar.`
      : `Número ${number} apareceu apontando ${sideLabel(side)}, ainda em observação. ${details.join(", ")}.`;
  }

  return style === "aggressive"
    ? `${namePrefix(name)}número pagante identificado em ${sideLabel(side)}. Leitura forte, mas mantém gestão. ${details.join(", ")}.`
    : `Número pagante identificado. ${details.join(", ")}.`;
}

function buildSurfEvent(
  alert: SurfAlert | undefined,
  name: string,
  style: VoiceNarrationStyle,
): VoiceEvent | null {
  if (!alert || (!alert.surf_alert && alert.surf_phase === "SEM_RISCO")) return null;

  const breakRisk = alert.surf_break_risk ?? alert.surf_risk;
  const risk = riskLabel(breakRisk);
  const side = sideLabel(
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side,
  );
  const status = alert.surf_status ?? phaseLabel(alert.surf_phase);

  return analysis(
    `surf:${alert.surf_phase}:${alert.surf_side}:${alert.surf_prediction_side ?? ""}:${alert.surf_prediction_status ?? ""}:${breakRisk}:${alert.surf_confidence}:${style}`,
    style === "aggressive"
      ? `${namePrefix(name)}atenção na leitura de surf: ${side} em ${status}, risco ${risk} de quebra. Sem exagero na mão.`
      : `Leitura de surf detectada. ${side} em ${status}, com risco ${risk} de quebra.`,
  );
}

function buildTieEvent(
  alert: TieAlert,
  name: string,
  style: VoiceNarrationStyle,
): VoiceEvent | null {
  if (alert.status !== "active") return null;
  return high(
    `tie:${alert.id}:${alert.status}:${alert.level}:${alert.validityRounds}:${style}`,
    style === "aggressive"
      ? `${namePrefix(name)}atenção nessa linha. Tem pressão de Tie, validade até ${alert.validityRounds} rodadas. Aqui é cautela.`
      : `Atenção para empate. Mesa com pressão de Tie, validade até ${alert.validityRounds} rodadas.`,
  );
}

function isFavorablePagante(reading?: NeuralReading) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return false;
  const side = reading.direcao ?? reading.origem;
  return Boolean(side) && paganteStatusKind(reading) === "favorable";
}

function paganteStatusKind(reading?: NeuralReading): PaganteStatusKind {
  if (!reading) return "watch";

  const status = normalizeText(reading.paganteStatus);
  if (
    reading.isRedAlert ||
    reading.isSaturated ||
    status.includes("RISCO") ||
    status.includes("ESTICADO")
  ) {
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

function paganteStatusLabel(reading?: NeuralReading) {
  const status = reading?.paganteStatus?.trim();
  return status ? status.toLocaleLowerCase("pt-BR").replace(/_/g, " ") : "em observação";
}

function resultKey(result: DashboardData["currentSignal"]["lastResult"] | undefined | null) {
  if (!result) return "no-result";
  return `${result.id}:${result.status}:${result.side}:${result.protection}:${result.finishedAt ?? ""}`;
}

function tieResultKey(alert: TieAlert | undefined) {
  if (!alert) return "no-tie";
  return `${alert.id}:${alert.status}:${alert.level}:${alert.validityRounds}`;
}

function surfResultKey(alert: SurfAlert | undefined) {
  if (!alert) return "no-surf";
  return [
    alert.surf_prediction_status ?? "",
    alert.surf_prediction_side ?? "",
    alert.surf_phase,
    alert.surf_side,
    alert.surf_prediction_window ?? "",
    alert.surf_prediction_confidence ?? "",
    alert.surf_confidence,
    alert.stretched_count,
    alert.correction_count,
  ].join(":");
}

function isSameNeuralReading(previousReading: NeuralReading, reading: NeuralReading) {
  return (
    previousReading.mode !== "SCANNING" &&
    reading.mode !== "SCANNING" &&
    previousReading.numero === reading.numero &&
    previousReading.origem === reading.origem &&
    previousReading.direcao === reading.direcao
  );
}

function neuralGreens(reading?: NeuralReading) {
  const splitGreens = safeNumber(reading?.greenSemGale) + safeNumber(reading?.greenG1);
  return splitGreens || safeNumber(reading?.acertos);
}

function neuralReds(reading?: NeuralReading) {
  return safeNumber(reading?.reds ?? reading?.erros);
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function urgent(key: string, text: string): VoiceEvent {
  return { key, text, priority: 3, bypassCooldown: true };
}

function high(key: string, text: string): VoiceEvent {
  return { key, text, priority: 3, bypassCooldown: true };
}

function medium(key: string, text: string): VoiceEvent {
  return { key, text, priority: 2, bypassCooldown: false };
}

function analysis(key: string, text: string): VoiceEvent {
  return { key, text, priority: 2, bypassCooldown: true };
}

function common(key: string, text: string): VoiceEvent {
  return { key, text, priority: 1, bypassCooldown: false };
}

function firstName(name?: string) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

function namePrefix(_name: string) {
  return "";
}

function sideLabel(side?: CurrentSignalSide | null) {
  if (side === "BANKER") return "Banker";
  if (side === "PLAYER") return "Player";
  if (side === "TIE") return "Tie";
  return "mesa";
}

function riskLabel(value: number) {
  if (value >= 70) return "alto";
  if (value >= 40) return "médio";
  return "baixo";
}

function phaseLabel(phase: SurfAlert["surf_phase"]) {
  return phase.toLowerCase().replace(/_/g, " ");
}

function normalizeText(value?: string | null) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
