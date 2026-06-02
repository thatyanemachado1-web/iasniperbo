import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerStrategy } from "@/types/patternMiner";
import { cn } from "@/lib/utils";
import { formatPulledSide, sideBgClass, sideTextClass } from "@/patternMiner/PatternMinerDisplay";

const SIDE_ICON: Record<RoundResult, string> = {
  B: "🔴",
  P: "🔵",
  T: "🟡",
};

export function PatternSequence({
  sequence,
  compact = false,
}: {
  sequence: string[];
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sequence.map((token, index) => (
        <div key={`${token}-${index}`} className="inline-flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center rounded-full border font-bold",
              compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              sideBgClass[token[0] as RoundResult],
            )}
          >
            {SIDE_ICON[token[0] as RoundResult]} {token}
          </span>
          {index < sequence.length - 1 && <span className="text-muted-foreground">→</span>}
        </div>
      ))}
    </div>
  );
}

export function StrategyConclusion({
  strategy,
  compact = false,
}: {
  strategy: PatternMinerStrategy;
  compact?: boolean;
}) {
  if (strategy.insufficientSample || !strategy.expectedResult) {
    return (
      <div className={compact ? "text-[11px]" : "text-xs"}>
        <span className="font-semibold">Estratégia: </span>
        <PatternSequence sequence={strategy.sequence} compact={compact} />
        <div className="mt-1 text-warning">
          Padrão detectado, mas ainda sem amostra suficiente para dizer o que puxou.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[11px]" : "text-xs")}>
      <span className="font-semibold">Estratégia:</span>
      <PatternSequence sequence={strategy.sequence} compact={compact} />
      <span className="text-muted-foreground">= PAGANDO</span>
      <span className={cn("font-black", sideTextClass[strategy.expectedResult])}>
        {formatPulledSide(strategy.expectedResult)}
      </span>
    </div>
  );
}
