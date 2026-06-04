import type {
  CurrentSignalSide,
  DashboardData,
  NeuralReading,
  SurfAlert,
  TieAlert,
} from "@/types/dashboard";
import type { AdaptiveStrategySnapshot } from "@/types/adaptiveStrategy";
import { buildSurfCopy, buildTieCopy } from "@/lib/operationalCopy";
import { buildSurfEntrySummary } from "@/utils/surf";

export type VoiceNarrationStyle = "discreet" | "aggressive" | "professional";
export type VoicePriority = 1 | 2 | 3 | 4 | 5;
type VoiceLeadStyle = Exclude<VoiceNarrationStyle, "discreet">;
type PaganteStatusKind = "favorable" | "watch" | "risk";
type VoiceLeadKind =
  | "blocked"
  | "resultGreen"
  | "resultRed"
  | "tieResult"
  | "surfResult"
  | "neuralResultGreen"
  | "neuralResultRed"
  | "neuralOppositeResultGreen"
  | "neuralOppositeResultRed"
  | "entry"
  | "tieEntry"
  | "currentReading"
  | "observing"
  | "neuralRisk"
  | "neuralWatch"
  | "neuralFavorable"
  | "neuralOpposite"
  | "surf"
  | "tie";

const VOICE_LEADS: Record<VoiceLeadKind, Record<VoiceLeadStyle, readonly string[]>> = {
  blocked: {
    professional: ["Sem entrada agora.", "Entrada segurada.", "A leitura pediu bloqueio.", "Melhor aguardar agora."],
    aggressive: ["Segura essa entrada.", "Entrada travada agora.", "Risco no radar.", "Melhor não forçar agora."],
  },
  resultGreen: {
    professional: ["Resultado confirmado:", "Fechamento da entrada:", "Entrada encerrada:", "Atualização do sinal:"],
    aggressive: ["Boa leitura:", "Fechou positivo:", "Mandou bem nessa:", "Sinal respeitou:"],
  },
  resultRed: {
    professional: ["Resultado confirmado:", "Fechamento da entrada:", "Entrada encerrada:", "Atualização do sinal:"],
    aggressive: ["Resultado registrado:", "Não confirmou agora:", "Fechou contra:", "Gestão primeiro:"],
  },
  tieResult: {
    professional: ["Resultado do Tie:", "Fechamento do empate:", "Atualização do Tie:", "Leitura de empate encerrada:"],
    aggressive: ["Tie resolvido:", "Empate no radar fechou:", "Atualização forte do Tie:", "Linha do Tie encerrou:"],
  },
  surfResult: {
    professional: ["Resultado do Surf Analyzer:", "Fechamento da leitura de surf:", "Atualização do surf:", "Surf Analyzer finalizou:"],
    aggressive: ["Surf resolvido:", "Leitura de surf fechou:", "Atualização do Surf Analyzer:", "Movimento de surf encerrou:"],
  },
  neuralResultGreen: {
    professional: ["Número pagante respeitou.", "Previsão do pagante confirmou.", "Número pagante fechou green.", "Leitura do pagante bateu."],
    aggressive: ["Número pagante respeitou mesmo.", "Pagante bateu na leitura.", "Boa no pagante.", "Leitura do número cravou."],
  },
  neuralResultRed: {
    professional: ["Número pagante não confirmou agora.", "Previsão do pagante falhou agora.", "Pagante fechou contra.", "Leitura do número não bateu."],
    aggressive: ["Número pagante não confirmou agora.", "Pagante veio contra.", "Essa do número não bateu.", "Leitura do pagante falhou agora."],
  },
  neuralOppositeResultGreen: {
    professional: ["Gatilho oposto confirmou.", "Leitura oposta bateu.", "Gatilho oposto fechou green.", "Leitura complementar confirmou."],
    aggressive: ["Gatilho oposto bateu.", "Leitura oposta respeitou.", "Boa leitura no oposto.", "Complementar cravou agora."],
  },
  neuralOppositeResultRed: {
    professional: ["Gatilho oposto não confirmou agora.", "Leitura oposta falhou agora.", "Complementar fechou contra.", "Leitura oposta não bateu."],
    aggressive: ["Gatilho oposto veio contra.", "Oposto não confirmou agora.", "Essa complementar não bateu.", "Leitura oposta falhou agora."],
  },
  entry: {
    professional: ["Leitura atual favorece", "Entrada formada em", "Sinal confirmado em", "A mesa abriu entrada em"],
    aggressive: ["Leitura forte agora:", "Linha interessante agora:", "Sinal formou com presença:", "A mesa apontou firme:"],
  },
  tieEntry: {
    professional: ["Leitura atual favorece Tie.", "Tie ganhou leitura agora.", "Entrada de Tie formada.", "A mesa abriu janela de Tie."],
    aggressive: ["Tie ganhou força agora.", "Empate entrou com presença.", "Atenção no Tie agora.", "Linha de Tie formada."],
  },
  currentReading: {
    professional: ["Leitura do momento favorece", "A tendência atual aponta", "No momento, a mesa favorece", "Leitura parcial inclinada para"],
    aggressive: ["Leitura em formação:", "Momento pede atenção:", "Linha ganhando forma:", "Mesa começando a apontar:"],
  },
  observing: {
    professional: ["Mesa em observação.", "Aguardando confirmação.", "Sem gatilho limpo agora.", "Leitura ainda em formação."],
    aggressive: ["Mesa em observação.", "Calma nessa linha.", "Ainda não fechou entrada.", "Esperando confirmação limpa."],
  },
  neuralRisk: {
    professional: ["Atenção no número.", "Número em zona de risco.", "Pagante pede cautela.", "Leitura numérica travada."],
    aggressive: ["Atenção nesse número.", "Cuidado com esse pagante.", "Número veio pesado, mas com risco.", "Segura a mão nesse número."],
  },
  neuralWatch: {
    professional: ["Número em observação.", "Pagante ainda formando.", "Leitura numérica inicial.", "Número apareceu no radar."],
    aggressive: ["Número apareceu, mas calma.", "Pagante no radar, sem cravar.", "Olho nesse número.", "Leitura numérica querendo formar."],
  },
  neuralFavorable: {
    professional: ["Número pagante identificado.", "Pagante entrou na leitura.", "Número favorável no radar.", "Leitura numérica ativa."],
    aggressive: ["Pagante entrou forte.", "Número pagante com presença.", "Leitura forte no número.", "Pagante querendo pagar agora."],
  },
  neuralOpposite: {
    professional: ["Gatilho oposto identificado.", "Leitura oposta no radar.", "Gatilho complementar ativo.", "Oposto entrou na leitura."],
    aggressive: ["Gatilho oposto apareceu.", "Oposto entrou forte no radar.", "Leitura complementar pedindo atenção.", "Gatilho oposto com presença."],
  },
  surf: {
    professional: ["Leitura de surf detectada.", "Surf Analyzer em leitura.", "Movimento de surf no radar.", "Leitura paralela de surf ativa."],
    aggressive: ["Surf entrou no radar:", "Movimento de surf detectado:", "Surf pedindo atenção:", "Leitura de surf ativa:"],
  },
  tie: {
    professional: ["Atenção para empate.", "Tie entrou em observação.", "Pressão de empate detectada.", "Leitura de Tie ativa."],
    aggressive: ["Pressão de Tie no radar.", "Tie começou a pressionar.", "Empate entrou na leitura.", "Atenção nessa pressão de Tie."],
  },
};

export interface VoiceEvent {
  key: string;
  text: string;
  priority: VoicePriority;
  bypassCooldown: boolean;
}

export const DEFAULT_VOICE_NARRATION_STYLE: VoiceNarrationStyle = "professional";

export function isVoiceNarrationStyle(value: unknown): value is VoiceNarrationStyle {
  return value === "discreet" || value === "aggressive" || value === "professional";
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
    return events;
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
  adaptiveSnapshot?: AdaptiveStrategySnapshot,
): VoiceEvent[] {
  const signal = data.currentSignal;
  const decision = data.engineDecision;
  const roundId = String(data.rounds[data.rounds.length - 1]?.id ?? "sem-rodada");
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
  const adaptiveEvent = buildAdaptiveEvent(adaptiveSnapshot, name, style, roundId);

  if (neuralEvent) {
    candidateEvents.push(neuralEvent);
  }

  if (!hasTieEntry && signal.status === "tie_watch" && tieEvent) {
    candidateEvents.push(tieEvent);
  }

  if (surfEvent) {
    candidateEvents.push(surfEvent);
  }

  if (adaptiveEvent) {
    candidateEvents.push(adaptiveEvent);
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
    return `${voiceLead("blocked", style, `${reason}:${paganteText}`, name)}Entrada bloqueada por risco alto. Motivo: ${reason}${paganteText} Aqui é mão leve e gestão.`;
  }

  return `${voiceLead("blocked", style, `${reason}:${paganteText}`, name)}A leitura bloqueou por risco alto. Motivo: ${reason}${paganteText}`;
}

function mainResultText(
  name: string,
  side: CurrentSignalSide,
  status: "green" | "green_g1" | "red",
  protection: string,
  style: VoiceNarrationStyle,
) {
  const resultSideText = sideLabel(side);
  const resultSeed = `${side}:${status}:${protection}`;
  if (status === "red") {
    return `${voiceLead("resultRed", style, resultSeed, name)}Red confirmado em ${resultSideText}. Aguarda a proxima leitura.`;
  }

  const resultGreenText = status === "green_g1" ? `Green no G1 em ${resultSideText}` : `Green em ${resultSideText}`;
  return `${voiceLead("resultGreen", style, resultSeed, name)}${resultGreenText}. Entrada finalizada. Aguarda a proxima leitura.`;
}

function tieResultText(name: string, status: TieAlert["status"], style: VoiceNarrationStyle) {
  if (status === "green") {
    return style === "aggressive"
      ? `${voiceLead("tieResult", style, status, name)}A análise Tie confirmou green. Agora segura a emoção e respeita a gestão.`
      : `${voiceLead("tieResult", style, status, name)}A análise Tie confirmou green.`;
  }

  return style === "aggressive"
    ? `${voiceLead("tieResult", style, status, name)}Tie expirou sem confirmar. Sem forçar a próxima mão; espera a leitura voltar.`
    : `${voiceLead("tieResult", style, status, name)}Tie expirou sem confirmar. Aguardar nova leitura.`;
}

function surfResultText(name: string, alert: SurfAlert | undefined, style: VoiceNarrationStyle) {
  const side = sideLabel(alert?.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert?.surf_side);

  if (alert?.surf_prediction_status === "HIT") {
    return style === "aggressive"
      ? `${voiceLead("surfResult", style, `${side}:hit`, name)}O surf respeitou em ${side}. Gestão mantida.`
      : `${voiceLead("surfResult", style, `${side}:hit`, name)}A leitura de surf confirmou em ${side}.`;
  }

  if (alert?.surf_prediction_status === "FAILED") {
    return style === "aggressive"
      ? `${voiceLead("surfResult", style, `${side}:failed`, name)}Surf não confirmou agora. Registra o red do Surf Analyzer e espera nova formação.`
      : `${voiceLead("surfResult", style, `${side}:failed`, name)}Surf Analyzer não confirmou agora. Aguardar nova formação.`;
  }

  return style === "aggressive"
    ? `${voiceLead("surfResult", style, `${side}:expired`, name)}Surf expirou sem confirmar. Melhor esperar outra leitura limpa.`
    : `${voiceLead("surfResult", style, `${side}:expired`, name)}Surf Analyzer expirou sem confirmar. Aguardar nova leitura.`;
}

function buildNeuralResultEvent(
  previousReading: NeuralReading | undefined,
  reading: NeuralReading | undefined,
  name: string,
  style: VoiceNarrationStyle,
): VoiceEvent | null {
  if (!previousReading || !reading || !isSameNeuralReading(previousReading, reading)) return null;
  if (!isPerfectPagante(reading)) return null;

  const previousGreens = neuralGreens(previousReading);
  const currentGreens = neuralGreens(reading);
  const previousReds = neuralReds(previousReading);
  const currentReds = neuralReds(reading);
  const side = reading.direcao ?? reading.origem;
  const number = reading.numero;
  const isOpposite = isOppositeTrigger(reading);
  const readingLabel = isOpposite ? `gatilho oposto ${number}` : `número pagante ${number}`;
  const greenLead = isOpposite ? "neuralOppositeResultGreen" : "neuralResultGreen";
  const redLead = isOpposite ? "neuralOppositeResultRed" : "neuralResultRed";

  if (typeof number === "number" && side && currentGreens > previousGreens) {
    const g1Increased = safeNumber(reading.greenG1) > safeNumber(previousReading.greenG1);
    const protection = g1Increased ? " no G1" : "";
    return urgent(
      `result-neural:green:${number}:${side}:${reading.origemTipo ?? ""}:${currentGreens}:${currentReds}:${style}`,
      style === "aggressive"
        ? `${voiceLead(greenLead, style, `${number}:${side}:${currentGreens}`, name)}Foi green${protection} na leitura de ${readingLabel}, puxando ${sideLabel(side)}.`
        : `${voiceLead(greenLead, style, `${number}:${side}:${currentGreens}`, name)}Foi green${protection} na leitura de ${readingLabel}, em ${sideLabel(side)}.`,
    );
  }

  if (typeof number === "number" && side && currentReds > previousReds) {
    return urgent(
      `result-neural:red:${number}:${side}:${reading.origemTipo ?? ""}:${currentGreens}:${currentReds}:${style}`,
      style === "aggressive"
        ? `${voiceLead(redLead, style, `${number}:${side}:${currentReds}`, name)}Red na leitura de ${readingLabel}; gestão primeiro.`
        : `${voiceLead(redLead, style, `${number}:${side}:${currentReds}`, name)}${capitalizeText(readingLabel)} não confirmou agora. Aguardar nova leitura.`,
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
  const reasonText = entryReasonPhrase(reason, paganteText, riskText);
  if (style === "aggressive") {
    return `${voiceLead("entry", style, `${side}:${status}:${protection}:${reason}:${paganteText}`, name)}Entrada confirmada em ${sideLabel(side)}. Motivo: ${reasonText}. ${action}`;
  }

  return `Entrada confirmada em ${sideLabel(side)}. Motivo: ${reasonText}. ${action}`;
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

  return `Entrada confirmada com proteção ${protection}. Aguardando fechamento para confirmar green ou red.`;
}

function entryReasonPhrase(reason: string, paganteText: string, riskText: string) {
  const normalized = normalizeText(`${reason} ${paganteText} ${riskText}`);
  const reasons = ["tendência ativa"];

  if (normalized.includes("PAGANTE") && normalized.includes("ALINH")) {
    reasons.push("número pagante favorável");
  }
  if (normalized.includes("SURF") && (normalized.includes("ALINH") || normalized.includes("FAVOR"))) {
    reasons.push("leitura de surf favorável");
  }

  if (normalized.includes("RISCO ALTO") || normalized.includes("RISCO ELEVADO")) {
    reasons.push("risco elevado monitorado");
  } else if (normalized.includes("RISCO MEDIO") || normalized.includes("RISCO MÉDIO")) {
    reasons.push("risco médio monitorado");
  } else {
    reasons.push("risco controlado");
  }

  return joinText(reasons);
}

function tieEntryText(name: string, reason: string, paganteText: string, style: VoiceNarrationStyle) {
  if (style === "aggressive") {
    return `${voiceLead("tieEntry", style, `${reason}:${paganteText}`, name)}Entrada confirmada em Tie. Motivo: ${reason}${paganteText} Gestão e cautela.`;
  }

  return `${voiceLead("tieEntry", style, `${reason}:${paganteText}`, name)}Entrada confirmada em Tie. Motivo: ${reason}${paganteText}`;
}

function currentReadingText(
  name: string,
  side: CurrentSignalSide,
  reason: string,
  paganteText: string,
  style: VoiceNarrationStyle,
) {
  if (style === "aggressive") {
    return `${voiceLead("currentReading", style, `${side}:${reason}:${paganteText}`, name)}${sideLabel(side)} está mais interessante, mas ainda sem entrada confirmada. Motivo: ${reason}${paganteText}`;
  }

  return `${voiceLead("currentReading", style, `${side}:${reason}:${paganteText}`, name)}${sideLabel(side)}, mas ainda sem entrada confirmada. Motivo: ${reason}${paganteText}`;
}

function observingText(name: string, reason: string, style: VoiceNarrationStyle) {
  if (style === "aggressive") {
    return `${voiceLead("observing", style, reason, name)}Ainda não tem entrada limpa. ${reason}`;
  }

  return `${voiceLead("observing", style, reason, name)}Sem entrada confirmada. ${reason}`;
}

function buildPaganteContext(
  reading: NeuralReading | undefined,
  entrySide: CurrentSignalSide | undefined,
  style: VoiceNarrationStyle,
) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number" || !isPerfectPagante(reading)) {
    return { key: "no-pagante", text: "", isAlignedWithEntry: false };
  }

  const paganteSide = reading.direcao ?? reading.origem;
  if (!paganteSide) return { key: "no-pagante-side", text: "", isAlignedWithEntry: false };

  const isOpposite = isOppositeTrigger(reading);
  const keyPrefix = isOpposite ? "oposto" : "pagante";
  const key = `${keyPrefix}:${reading.numero}:${paganteSide}:${reading.validade ?? ""}:${reading.paganteStatus ?? ""}`;
  const statusKind = paganteStatusKind(reading);
  const status = paganteStatusLabel(reading);
  const isEntrySide = entrySide && entrySide !== "NONE" && entrySide !== "TIE";
  const isAlignedWithEntry = Boolean(!isOpposite && isEntrySide && paganteSide === entrySide && statusKind === "favorable");

  if (statusKind === "risk") {
    const suffix = style === "aggressive" ? " Gestão primeiro." : "";
    if (isOpposite) {
      return {
        key,
        text: ` Atenção: gatilho oposto ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, mas está ${status}; não tratar como número pagante favorável agora.${suffix}`,
        isAlignedWithEntry: false,
      };
    }
    return {
      key,
      text: ` Atenção: número ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, mas está ${status}; não tratar como pagante favorável agora.${suffix}`,
      isAlignedWithEntry: false,
    };
  }

  if (statusKind === "watch") {
    if (isOpposite) {
      const text =
        style === "aggressive"
          ? ` Gatilho oposto ${reading.numero} apareceu em ${sideLabel(paganteSide)}, mas ainda sem confirmação forte.`
          : ` Gatilho oposto ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, ainda como leitura complementar.`;
      return { key, text, isAlignedWithEntry: false };
    }
    const text =
      style === "aggressive"
        ? ` Número ${reading.numero} apareceu em ${sideLabel(paganteSide)}, mas ainda sem confirmação forte.`
        : ` Número ${reading.numero} apareceu apontando ${sideLabel(paganteSide)}, mas ainda está ${status}.`;
    return { key, text, isAlignedWithEntry: false };
  }

  if (isOpposite) {
    const text = entrySide && entrySide !== "NONE" && entrySide !== "TIE"
      ? ` Gatilho oposto ${reading.numero} também aponta ${sideLabel(paganteSide)} agora; não entra como número pagante alinhado.`
      : ` Gatilho oposto ${reading.numero} aponta ${sideLabel(paganteSide)} agora; leitura complementar.`;
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
  const paganteHigh = !isOppositeTrigger(data.neuralReading) && paganteStatusKind(data.neuralReading) === "risk";

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
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number" || !isPerfectPagante(reading)) return null;

  const side = reading.direcao ?? reading.origem;
  if (!side) return null;

  const statusKind = paganteStatusKind(reading);
  const status = paganteStatusLabel(reading);
  const originSide = reading.origem ?? side;
  const details = [
    `${reading.numero} ${sideLabel(originSide)}`,
    `puxando ${sideLabel(side)}`,
    reading.validade ? `validade ${reading.validade}` : "",
    reading.paganteStatus ? `status ${reading.paganteStatus}` : "",
    reading.paganteAlert ?? "",
  ].filter(Boolean);

  return analysis(
    `neural:${roundId}:${reading.mode}:${reading.numero}:${reading.origem ?? ""}:${reading.origemTipo ?? ""}:${reading.direcao ?? ""}:${reading.validade ?? ""}:${reading.paganteStatus ?? ""}:${reading.alertas ?? ""}:${style}`,
    neuralEventText(reading, statusKind, reading.numero, side, status, details, reading.paganteAlert, name, style),
  );
}

function buildAdaptiveEvent(
  snapshot: AdaptiveStrategySnapshot | undefined,
  name: string,
  style: VoiceNarrationStyle,
  roundId: string,
): VoiceEvent | null {
  if (!snapshot || snapshot.recordsStored < snapshot.minOccurrences) return null;

  const score = snapshot.entryScore.finalScore;
  const side = snapshot.entryScore.side;
  const topPattern =
    snapshot.patterns.find((pattern) => pattern.status === "quente" && !pattern.blocked) ??
    snapshot.patterns.find((pattern) => pattern.status === "observacao" && !pattern.blocked);

  if (snapshot.entryScore.allowed && side && topPattern) {
    return high(
      `adaptive-entry:${roundId}:${topPattern.id}:${score}:${side}:${style}`,
      style === "aggressive"
        ? `${voiceLead("entry", style, `${topPattern.id}:${score}:${side}`, name)}Banco de estratégias confirmou. Entrada em ${sideLabel(side)} até G1. Score ${score}. Risco controlado.`
        : `Banco de estratégias confirmou ${sideLabel(side)}. Score ${score}. Padrão ${topPattern.label} validado pela amostra real.`,
    );
  }

  if (snapshot.pausedPatterns > 0 || score < 50) {
    return medium(
      `adaptive-risk:${roundId}:${snapshot.pausedPatterns}:${score}:${style}`,
      style === "aggressive"
        ? `${voiceLead("blocked", style, `${snapshot.pausedPatterns}:${score}`, name)}Cuidado. Banco de estratégias reduziu confiança. Score ${score}. Melhor não forçar.`
        : `Banco de estratégias em cautela. Score ${score}. A IA está bloqueando padrões com risco ou amostra fraca.`,
    );
  }

  if (topPattern && score >= 50) {
    return analysis(
      `adaptive-forming:${roundId}:${topPattern.id}:${score}:${style}`,
      style === "aggressive"
        ? `${voiceLead("currentReading", style, `${topPattern.id}:${score}`, name)}Padrão começando a formar. ${sideLabel(topPattern.direction)} ganhou leitura, mas ainda precisa confirmar.`
        : `Padrão em observação. ${topPattern.label} puxa ${sideLabel(topPattern.direction)}, mas a entrada ainda depende do score final.`,
    );
  }

  return null;
}

function neuralEventText(
  reading: NeuralReading,
  statusKind: PaganteStatusKind,
  number: number,
  side: CurrentSignalSide,
  status: string,
  details: string[],
  alert: string | null | undefined,
  name: string,
  style: VoiceNarrationStyle,
) {
  const isOpposite = isOppositeTrigger(reading);
  const originSide = sideLabel(reading.origem ?? side);

  if (statusKind === "risk") {
    const base = isOpposite
      ? `Gatilho oposto ${number} ${originSide} apareceu apontando ${sideLabel(side)}, mas está ${status}. Não tratar como número pagante favorável agora${alert ? `. ${alert}` : ""}.`
      : `Número ${number} apareceu apontando ${sideLabel(side)}, mas está ${status}. Não tratar como pagante favorável agora${alert ? `. ${alert}` : ""}.`;
    const lead = isOpposite ? "neuralOpposite" : "neuralRisk";
    return style === "aggressive"
      ? `${voiceLead(lead, style, `${number}:${side}:${status}:${alert ?? ""}`, name)}${base} Mão leve.`
      : `${voiceLead(lead, style, `${number}:${side}:${status}:${alert ?? ""}`, name)}${base}`;
  }

  if (statusKind === "watch") {
    if (isOpposite) {
      return style === "aggressive"
        ? `${voiceLead("neuralOpposite", style, `${number}:${side}:${status}`, name)}${number} ${originSide} apareceu apontando ${sideLabel(side)}, mas ainda precisa confirmar.`
        : `${voiceLead("neuralOpposite", style, `${number}:${side}:${status}`, name)}${number} ${originSide} apareceu apontando ${sideLabel(side)}, ainda como leitura complementar. ${details.join(", ")}.`;
    }
    return style === "aggressive"
      ? `${voiceLead("neuralWatch", style, `${number}:${side}:${status}`, name)}Número ${number} apareceu em ${sideLabel(side)}, mas ainda precisa confirmar.`
      : `${voiceLead("neuralWatch", style, `${number}:${side}:${status}`, name)}Número ${number} apareceu apontando ${sideLabel(side)}, ainda em observação. ${details.join(", ")}.`;
  }

  if (isOpposite) {
    return style === "aggressive"
      ? `${voiceLead("neuralOpposite", style, `${number}:${side}:${details.join(":")}`, name)}${number} ${originSide} aponta ${sideLabel(side)}. Leitura complementar forte, mas não entra como pagante alinhado. Gestão primeiro.`
      : `${voiceLead("neuralOpposite", style, `${number}:${side}:${details.join(":")}`, name)}${number} ${originSide} aponta ${sideLabel(side)}. Leitura complementar, não número pagante alinhado. ${details.join(", ")}.`;
  }

  return style === "aggressive"
    ? `${voiceLead("neuralFavorable", style, `${number}:${side}:${details.join(":")}`, name)}Em ${sideLabel(side)}. Leitura forte, mas mantém gestão. ${details.join(", ")}.`
    : `${voiceLead("neuralFavorable", style, `${number}:${side}:${details.join(":")}`, name)}${details.join(", ")}.`;
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
  const message = buildSurfCopy(alert);

  return analysis(
    `surf:${alert.surf_phase}:${alert.surf_side}:${alert.surf_prediction_side ?? ""}:${alert.surf_prediction_status ?? ""}:${breakRisk}:${alert.surf_confidence}:${style}`,
    style === "aggressive"
      ? `${voiceLead("surf", style, `${alert.surf_phase}:${side}:${risk}:${alert.surf_confidence}`, name)}${message} Sem exagero na mão.`
      : message,
  );
}

function buildTieEvent(
  alert: TieAlert,
  name: string,
  style: VoiceNarrationStyle,
): VoiceEvent | null {
  if (alert.status !== "active") return null;
  const message = buildTieCopy(alert);
  return high(
    `tie:${alert.id}:${alert.status}:${alert.level}:${alert.validityRounds}:${style}`,
    style === "aggressive"
      ? `${voiceLead("tie", style, `${alert.id}:${alert.level}:${alert.validityRounds}`, name)}${message} Aqui é cautela.`
      : message,
  );
}

function isFavorablePagante(reading?: NeuralReading) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return false;
  if (!isPerfectPagante(reading)) return false;
  if (isOppositeTrigger(reading)) return false;
  const side = reading.direcao ?? reading.origem;
  return Boolean(side) && paganteStatusKind(reading) === "favorable";
}

function isPerfectPagante(reading?: NeuralReading | null) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return false;
  if (isOppositeTrigger(reading)) return false;
  return safeNumber(reading.assertividade) >= 100;
}

function isOppositeTrigger(reading?: NeuralReading | null) {
  return reading?.origemTipo === "OPOSTO";
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
  return { key, text, priority: 5, bypassCooldown: true };
}

function high(key: string, text: string): VoiceEvent {
  return { key, text, priority: 4, bypassCooldown: true };
}

function medium(key: string, text: string): VoiceEvent {
  return { key, text, priority: 2, bypassCooldown: false };
}

function analysis(key: string, text: string): VoiceEvent {
  return { key, text, priority: 3, bypassCooldown: true };
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

function voiceLead(kind: VoiceLeadKind, style: VoiceNarrationStyle, seed: string, name = "") {
  const leadStyle: VoiceLeadStyle = style === "discreet" ? "professional" : style;
  return `${namePrefix(name)}${pickVoiceVariant(`${kind}:${style}:${seed}`, VOICE_LEADS[kind][leadStyle])} `;
}

function pickVoiceVariant(seed: string, variants: readonly string[]) {
  return variants[hashText(seed) % variants.length];
}

function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function joinText(parts: string[]) {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
}

function capitalizeText(value: string) {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
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
