import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { TieAlert } from "@/types/dashboard";
import { Sparkles } from "lucide-react";

export function TieAlertCard({ alert, locked }: { alert: TieAlert; locked?: boolean }) {
  return (
    <GlassCard className="min-h-[180px] border-neon-purple/30">
      <SectionTitle
        title="Tie Alert estatístico"
        right={<AppBadge tone="purple" pulse>Aviso paralelo</AppBadge>}
      />
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-xl glass-strong border-neon-purple/40 flex items-center justify-center glow-purple">
          <Sparkles className="size-5 text-neon-purple" />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-neon-purple">Nível {alert.level}</div>
          <div className="text-xs text-muted-foreground">Não substitui Banker/Player</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Confiança</div>
          <div className="font-semibold text-neon-purple">{alert.confidence}%</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Validade</div>
          <div className="font-semibold">{alert.validityRounds} rodadas</div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2">
          <div className="text-muted-foreground">Status</div>
          <div className="font-semibold text-success">Ativo</div>
        </div>
      </div>
      {locked && (
        <PremiumLock
          title="Tie Alert Premium"
          description="Tie Alert estatístico disponível para assinantes"
        />
      )}
    </GlassCard>
  );
}