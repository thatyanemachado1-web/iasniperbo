import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { buildTieCopy } from "@/lib/operationalCopy";
import type { TieAlert } from "@/types/dashboard";
import { Sparkles } from "lucide-react";

export function TieAlertCard({ alert, locked }: { alert: TieAlert; locked?: boolean }) {
  const message = buildTieCopy(alert);

  return (
    <GlassCard className="digital-risk-card border-warning/20 p-3 sm:p-3">
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
          Tie Alert estatistico
        </div>
        <AppBadge tone="amber" pulse>Pressao Tie</AppBadge>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(150px,0.42fr)_minmax(0,1fr)] sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg border border-warning/20 bg-secondary/20">
            <Sparkles className="size-4 text-warning" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-neon-purple">Nivel {alert.level}</div>
            <div className="text-[11px] text-muted-foreground">Nao substitui Banker/Player</div>
          </div>
        </div>
        <div className="rounded-lg border border-warning/10 bg-secondary/20 p-2 text-[11px] leading-relaxed text-foreground/85">
          {message}
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-lg border border-white/5 bg-secondary/20 px-2 py-1.5">
          <div className="text-muted-foreground">Confianca</div>
          <div className="font-semibold text-neon-purple">{alert.confidence}%</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-secondary/20 px-2 py-1.5">
          <div className="text-muted-foreground">Validade</div>
          <div className="font-semibold">{alert.validityRounds} rodadas</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-secondary/20 px-2 py-1.5">
          <div className="text-muted-foreground">Status</div>
          <div className={`font-semibold ${alert.status === "expired" ? "text-neon-purple" : "text-success"}`}>
            {tieStatusLabel(alert.status)}
          </div>
        </div>
      </div>
      {locked && (
        <PremiumLock
          title="Tie Alert Premium"
          description="Tie Alert estatistico disponivel para assinantes"
        />
      )}
    </GlassCard>
  );
}

function tieStatusLabel(status: TieAlert["status"]) {
  if (status === "green") return "Green";
  if (status === "expired") return "Expirado";
  return "Ativo";
}
