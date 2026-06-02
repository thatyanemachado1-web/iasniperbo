import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerStrategy, PatternMinerStrategyStatus } from "@/types/patternMiner";

const SIDE_LABEL: Record<RoundResult, string> = {
  B: "BANKER",
  P: "PLAYER",
  T: "TIE",
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
  return `${SIDE_ICON[side]} ${token}`;
}

export function formatPatternSequence(sequence: string[]) {
  return sequence.map(formatPatternToken).join(" → ");
}

export function formatPulledSide(side: RoundResult) {
  return `${SIDE_ICON[side]} ${SIDE_LABEL[side]}`;
}

export function formatStrategyConclusion(strategy: PatternMinerStrategy) {
  const sequence = formatPatternSequence(strategy.sequence);
  if (strategy.insufficientSample || !strategy.expectedResult) {
    return `${sequence} = Padrão detectado, mas ainda sem amostra suficiente para dizer o que puxou.`;
  }
  return `${sequence} = PAGANDO ${formatPulledSide(strategy.expectedResult)}`;
}

export function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return "Sem amostra";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function statusLabel(status: PatternMinerStrategyStatus) {
  const labels: Record<PatternMinerStrategyStatus, string> = {
    VERY_HOT: "🔥 MUITO QUENTE",
    HOT: "🔥 QUENTE",
    STABLE: "🟡 ESTÁVEL",
    OBSERVATION: "🟠 EM OBSERVAÇÃO",
    WEAK: "🔴 FRACA",
    INACTIVE: "⚫ INATIVA",
  };
  return labels[status];
}

export function statusTone(status: PatternMinerStrategyStatus) {
  if (status === "VERY_HOT" || status === "HOT") return "green";
  if (status === "STABLE") return "amber";
  if (status === "OBSERVATION") return "gold";
  if (status === "WEAK") return "red";
  return "muted";
}
