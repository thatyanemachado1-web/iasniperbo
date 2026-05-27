import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Play, Radio, Tv } from "lucide-react";
import type { Round } from "@/types/dashboard";

export function LiveTableView({ lastRound, roundId }: { lastRound: Round; roundId: number }) {
  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full">
        {/* Background mesa */}
        <div className="absolute inset-0 scan-grid opacity-40" />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, oklch(0.32 0.12 150 / 0.55), transparent 65%), radial-gradient(ellipse at 50% 10%, color-mix(in oklab, var(--neon-blue) 30%, transparent), transparent 60%)",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[2px]" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <AppBadge tone="red" pulse className="!bg-destructive/25 !border-destructive/50">
            <Radio className="size-3" /> Bac Bo Ao Vivo
          </AppBadge>
          <AppBadge tone="green" pulse>Mesa online</AppBadge>
        </div>

        {/* Centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <div className="size-16 rounded-full glass-strong flex items-center justify-center glow-blue mb-3">
            <Tv className="size-7 text-neon-cyan" />
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-neon-cyan/80">Mesa conectada</div>
          <div className="mt-1 text-2xl sm:text-3xl font-bold text-gradient-brand">Bac Bo Ao Vivo</div>
          <div className="mt-1 text-xs text-muted-foreground max-w-xs">
            Acompanhamento estatístico em tempo real
          </div>

          <div className="mt-4 inline-flex items-center gap-2 glass-strong rounded-full px-3 py-1.5 text-xs">
            <Play className="size-3 text-neon-cyan" />
            Assistindo
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between text-[11px] bg-gradient-to-t from-background/90 to-transparent">
          <div className="font-mono text-muted-foreground">Rodada <span className="text-neon-cyan">#{roundId}</span></div>
          <div className="font-semibold">
            <span className="text-banker">Banker {lastRound.bankerScore}</span>
            <span className="text-muted-foreground"> x </span>
            <span className="text-player">Player {lastRound.playerScore}</span>
          </div>
          <div className="font-mono text-muted-foreground hidden sm:block">{lastRound.time}</div>
        </div>
      </div>
    </GlassCard>
  );
}