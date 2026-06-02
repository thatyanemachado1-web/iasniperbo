import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight } from "lucide-react";
import type { PatternMinerSnapshot } from "@/types/patternMiner";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { formatPercent, formatPulledSide } from "@/patternMiner/PatternMinerDisplay";

export function PatternMinerMiniCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  const hotPattern =
    snapshot.entryAlerts[0]?.strategy ?? snapshot.hotStrategies[0] ?? snapshot.ranking[0];

  return (
    <GlassCard className="rounded-xl p-3 border-neon-cyan/35">
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl btn-primary-grad flex items-center justify-center glow-blue">
          <BrainCircuit className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black">🧠 Padrão Quente Detectado</div>
          {!isUsingRealData ? (
            <div className="mt-1 text-[11px] text-warning">
              Aguardando histórico real da plataforma.
            </div>
          ) : hotPattern ? (
            <div className="mt-2 space-y-2">
              <PatternSequence sequence={hotPattern.sequence} compact />
              <div className="text-[11px]">
                <span className="text-muted-foreground">Leitura: </span>
                {hotPattern.expectedResult ? (
                  <span className="font-black">{formatPulledSide(hotPattern.expectedResult)}</span>
                ) : (
                  <span className="text-warning">Amostra insuficiente</span>
                )}
              </div>
              <div className="text-[11px] text-neon-cyan">
                {formatPercent(hotPattern.assertiveness)}
              </div>
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Padrão detectado, mas ainda sem amostra suficiente para dizer o que puxou.
            </div>
          )}
          <Link
            to="/app/padroes"
            className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-neon-cyan hover:text-neon-blue"
          >
            Ver detalhes <ChevronRight className="size-3" />
          </Link>
        </div>
      </div>
    </GlassCard>
  );
}
