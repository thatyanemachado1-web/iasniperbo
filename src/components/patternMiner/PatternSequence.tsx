import type { RoundResult } from "@/types/dashboard";
import type { PatternMinerStrategy } from "@/types/patternMiner";
import { cn } from "@/lib/utils";
import { sideDotClass } from "@/lib/sideColors";
import { sideTextClass } from "@/patternMiner/PatternMinerDisplay";

const SIDE_DOT_CLASS = sideDotClass;

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
                  {patternTokenSideLabel(side)}
                </span>
              )}
            </span>
            {index < sequence.length - 1 && <span className="text-muted-foreground">-&gt;</span>}
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
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  return "TIE/EMPATE";
}

function patternTokenValue(token: string) {
  return /^[BPT]\d+$/.test(token) ? token : token[0];
}

function patternTokenTitle(token: string) {
  const side = token[0];
  const value = token.slice(1);
  if (side === "B") return value ? `Banker ${value}` : "Banker";
  if (side === "P") return value ? `Player ${value}` : "Player";
  if (side === "T") return value ? `Empate ${value}` : "Empate";
  return token;
}

function patternTokenSideLabel(side: RoundResult) {
  if (side === "B") return "BANKER";
  if (side === "P") return "PLAYER";
  return "EMPATE";
}
