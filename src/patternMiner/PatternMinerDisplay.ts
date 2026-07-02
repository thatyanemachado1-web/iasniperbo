import type { RoundResult } from "@/types/dashboard";
import type {
  PatternMinerOperationalStatus,
  PatternMinerStrategy,
  PatternMinerStrategyStatus,
} from "@/types/patternMiner";

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
  const normalized = value <= 1 && value >= 0 ? value * 100 : value;
  return `${normalized.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

const OPERATIONAL_LABELS: Record<PatternMinerOperationalStatus, string> = {
  "AGUARDANDO PADRAO": "AGUARDANDO PADRÃO",
  "PADRAO EM FORMACAO": "PADRÃO EM FORMAÇÃO",
  "PADRAO QUENTE": "PADRÃO QUENTE",
  "PADRAO 100%": "PADRÃO 100%",
  "ENTRADA CONFIRMADA": "ENTRADA CONFIRMADA",
  "ALERTA DE EMPATE": "ALERTA DE EMPATE",
  "BLOQUEADO POR MAIS DE 2 REDS": "BLOQUEADO POR MAIS DE 2 REDS",
  "BLOQUEADO POR AMOSTRA BAIXA": "BLOQUEADO POR AMOSTRA BAIXA",
  "BLOQUEADO POR FEED STALE": "BLOQUEADO POR FEED STALE",
  "BLOQUEADO POR SNAPSHOT ANTIGO": "BLOQUEADO POR SNAPSHOT ANTIGO",
  "FAZER GALE 1": "FAZER GALE 1",
  "GREEN SG": "GREEN SG",
  "GREEN G1": "GREEN G1",
  "RED FINAL": "RED FINAL",
};

const HEAT_LABELS: Record<PatternMinerStrategyStatus, string> = {
  VERY_HOT: "MUITO QUENTE",
  HOT: "QUENTE",
  STABLE: "ESTAVEL",
  OBSERVATION: "EM OBSERVACAO",
  WEAK: "FRACA",
  INACTIVE: "INATIVA",
};

export function statusLabel(status: PatternMinerOperationalStatus | PatternMinerStrategyStatus) {
  if (status in OPERATIONAL_LABELS) return OPERATIONAL_LABELS[status as PatternMinerOperationalStatus];
  if (status in HEAT_LABELS) return HEAT_LABELS[status as PatternMinerStrategyStatus];
  return String(status);
}

export function statusTone(status: PatternMinerOperationalStatus | PatternMinerStrategyStatus) {
  if (status === "ENTRADA CONFIRMADA" || status === "PADRAO 100%" || status === "PADRAO QUENTE" || status === "GREEN SG" || status === "GREEN G1")
    return "green";
  if (status === "PADRAO EM FORMACAO" || status === "AGUARDANDO PADRAO" || status === "FAZER GALE 1") return "amber";
  if (status === "ALERTA DE EMPATE") return "gold";
  if (status === "RED FINAL") return "red";
  if (String(status).startsWith("BLOQUEADO")) return "red";
  if (status === "VERY_HOT" || status === "HOT") return "green";
  if (status === "STABLE") return "amber";
  if (status === "OBSERVATION") return "gold";
  if (status === "WEAK") return "red";
  return "muted";
}
