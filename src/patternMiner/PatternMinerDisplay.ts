import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerStrategy, PatternMinerStrategyStatus } from "@/types/patternMiner";
import { sideBgClass, sideTextClass } from "@/lib/sideColors";

export { sideBgClass, sideTextClass };

const SIDE_LABEL: Record<RoundResult, string> = {
  B: "BANKER",
  P: "PLAYER",
  T: "TIE",
};

const SIDE_ICON: Record<RoundResult, string> = {
  B: "🔴",
  P: "",
  T: "",
};

export function formatPatternToken(token: string) {
  const side = token[0] as RoundResult;
  const icon = SIDE_ICON[side];
  return icon ? `${icon} ${token}` : token;
}

export function formatPatternSequence(sequence: string[]) {
  return sequence.map(formatPatternToken).join(" -> ");
}

export function formatPulledSide(side: RoundResult) {
  const icon = SIDE_ICON[side];
  return icon ? `${icon} ${SIDE_LABEL[side]}` : SIDE_LABEL[side];
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

export function statusLabel(status: PatternMinerStrategyStatus) {
  const labels: Record<PatternMinerStrategyStatus, string> = {
    VERY_HOT: "🔥 MUITO QUENTE",
    HOT: "🔥 QUENTE",
    STABLE: "🟡 ESTAVEL",
    OBSERVATION: "🟠 EM OBSERVACAO",
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
