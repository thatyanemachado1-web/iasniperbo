import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerStrategy } from "@/types/patternMiner";
import { cn } from "@/lib/utils";
import { sideTextClass } from "@/patternMiner/PatternMinerDisplay";

const SIDE_DOT_CLASS: Record<RoundResult, string> = {
  B: "border-banker/60 bg-banker text-white shadow-[0_0_14px_-6px_var(--banker)]",
  P: "border-player/60 bg-player text-white shadow-[0_0_14px_-6px_var(--player)]",
  T: "border-warning/70 bg-warning text-background shadow-[0_0_14px_-6px_var(--warning)]",
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
      {sequence.map((token, index) => {
        const side = token[0] as RoundResult;
        const value = patternTokenValue(token);

        return (
          <div key={`${token}-${index}`} className="inline-flex items-center gap-1.5">
            <span className="inline-flex flex-col items-center gap-0.5" title={patternTokenTitle(token)}>
              <span
                className={cn(
                  "grid place-items-center rounded-full border font-black leading-none",
                  compact ? "size-6 text-[10px]" : "size-8 text-xs",
                  SIDE_DOT_CLASS[side],
                )}
              >
                {value}
              </span>
              {!compact && (
                <span className={cn("text-[8px] font-black uppercase leading-none", sideTextClass[side])}>
                  {side}
                </span>
              )}
            </span>
            {index < sequence.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        );
      })}
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
        <span className="font-semibold">Estrategia: </span>
        <PatternSequence sequence={strategy.sequence} compact={compact} />
        <div className="mt-1 text-warning">
          Padrao detectado, mas ainda sem amostra suficiente para dizer o que puxou.
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact ? "text-[11px]" : "text-xs")}>
      <span className="font-semibold">Estrategia:</span>
      <PatternSequence sequence={strategy.sequence} compact={compact} />
      <span className="text-muted-foreground">= puxou</span>
      <span className={cn("font-black", sideTextClass[strategy.expectedResult])}>
        {pulledSideLabel(strategy.expectedResult)}
      </span>
    </div>
  );
}

function pulledSideLabel(side: RoundResult) {
  if (side === "B") return "🔴 BANKER";
  if (side === "P") return "🔵 PLAYER";
  return "🟡 TIE";
}

function patternTokenValue(token: string) {
  const side = token[0];
  const value = token.slice(1);
  if (side === "T" && value) return `${value}x`;
  return value || side;
}

function patternTokenTitle(token: string) {
  const side = token[0];
  const value = token.slice(1);
  if (side === "B") return value ? `Banker ${value}` : "Banker";
  if (side === "P") return value ? `Player ${value}` : "Player";
  if (side === "T") return value ? `Tie ${value}x` : "Tie";
  return token;
}
