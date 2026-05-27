import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { MainSignal } from "@/types/dashboard";
import { Target } from "lucide-react";

export function SignalCard({ signal, locked }: { signal: MainSignal; locked?: boolean }) {
  const sideColor = signal.side === "BANKER" ? "text-banker" : "text-player";
  return (
    <GlassCard className="min-h-[180px]">
      <SectionTitle
        title="Entrada confirmada"
        right={<AppBadge tone="amber" pulse>Sinal ativo</AppBadge>}
      />
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${sideColor}`}>
            {signal.side}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">Lado da entrada</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-neon-cyan/80">Start</div>
          <div className="text-lg font-semibold">Sinal liberado</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Proteção</div>
          <div className="font-semibold text-foreground">{signal.protection}</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Força</div>
          <div className="font-semibold text-neon-cyan">{signal.strength}%</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Status</div>
          <div className="font-semibold text-warning">Pendente</div>
        </div>
      </div>
      <Target className="absolute -right-4 -bottom-4 size-32 text-neon-blue/5" />
      {locked && (
        <PremiumLock
          title="Entrada Premium"
          description="Entrada principal em tempo real bloqueada"
        />
      )}
    </GlassCard>
  );
}