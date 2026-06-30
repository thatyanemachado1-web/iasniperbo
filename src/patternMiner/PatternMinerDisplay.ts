import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerOperationalStatus, PatternMinerStrategy } from "@/types/patternMiner";

const SIDE_LABEL: Record<RoundResult, string> = {
  B: "BANKER",
  P: "PLAYER",
  T: "TIE/EMPATE",
};

const SIDE_ICON: Record<RoundResult, string> = {
  B: "🔴",
  P: "🔵",
  T: "🟡",
};

export const sideTextClass: Record<RoundResult, string> = {
  B: "text-banker",
  P: "text-player",
  T: "text-warning",
};

export const sideBgClass: Record<RoundResult, string> = {
  B: "bg-banker/15 border-banker/35 text-banker",
  P: "bg-player/15 border-player/35 text-player",
  T: "bg-warning/15 border-warning/35 text-warning",
};

export function formatPatternToken(token: string) {
  const side = token[0] as RoundResult;
  const value = token.slice(1);
  if (side === "T") return `${SIDE_ICON[side]} ${value ? `Empate ${value}` : "Empate"}`;
  return `${SIDE_ICON[side]} ${token}`;
}

export function formatPatternSequence(sequence: string[]) {
  return sequence.map(formatPatternToken).join(" -> ");
}

export function formatPulledSide(side: RoundResult) {
  return `${SIDE_ICON[side]} ${SIDE_LABEL[side]}`;
}

export function formatStrategyConclusion(strategy: PatternMinerStrategy) {
  const sequence = formatPatternSequence(strategy.sequence);
  if (strategy.insufficientSample || !strategy.expectedResult) {
    return `${sequence} = Padrao detectado, mas ainda sem amostra suficiente para dizer o que puxou.`;
  }
  return `${sequence} = PAGANDO ${formatPulledSide(strategy.expectedResult)}`;
}

export function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return "Sem amostra";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function statusLabel(status: PatternMinerOperationalStatus) {
  const labels: Record<PatternMinerOperationalStatus, string> = {
    "AGUARDANDO PADRAO": "AGUARDANDO PADRÃO",
    "PADRAO EM FORMACAO": "PADRÃO EM FORMAÇÃO",
    "PADRAO QUENTE": "PADRÃO QUENTE",
    "PADRAO 100%": "PADRÃO 100%",
    "ENTRADA CONFIRMADA": "ENTRADA CONFIRMADA",
    "ALERTA DE EMPATE": "ALERTA DE EMPATE",
    "BLOQUEADO POR 2 REDS": "BLOQUEADO POR 2 REDS",
    "BLOQUEADO POR AMOSTRA BAIXA": "BLOQUEADO POR AMOSTRA BAIXA",
    "BLOQUEADO POR FEED STALE": "BLOQUEADO POR FEED STALE",
    "BLOQUEADO POR SNAPSHOT ANTIGO": "BLOQUEADO POR SNAPSHOT ANTIGO",
  };
  return labels[status];
}

export function statusTone(status: PatternMinerOperationalStatus) {
  if (status === "ENTRADA CONFIRMADA" || status === "PADRAO 100%" || status === "PADRAO QUENTE")
    return "green";
  if (status === "PADRAO EM FORMACAO" || status === "AGUARDANDO PADRAO") return "amber";
  if (status === "ALERTA DE EMPATE") return "gold";
  if (status.startsWith("BLOQUEADO")) return "red";
  return "muted";
}
