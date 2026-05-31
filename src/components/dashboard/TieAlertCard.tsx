import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { buildTieCopy } from "@/lib/operationalCopy";
import type { TieAlert } from "@/types/dashboard";
import { Sparkles } from "lucide-react";

export function TieAlertCard({ alert, locked }: { alert: TieAlert; locked?: boolean }) {
  const message = buildTieCopy(alert);

  return (
    <GlassCard className="digital-risk-card min-h-[180px] border-warning/20">
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent" />
      <SectionTitle
        title="Tie Alert estatistico"
        right={<AppBadge tone="amber" pulse>Pressao Tie</AppBadge>}
      />
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl border border-warning/20 bg-secondary/20">
          <Sparkles className="size-5 text-warning" />
        </div>
        <div>
          <div className="text-2xl font-extrabold text-neon-purple">Nivel {alert.level}</div>
          <div className="text-xs text-muted-foreground">Nao substitui Banker/Player</div>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-warning/10 bg-secondary/25 p-3 text-xs leading-relaxed text-foreground/85">
        {message}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-white/5 bg-secondary/25 p-2">
          <div className="text-muted-foreground">Confianca</div>
          <div className="font-semibold text-neon-purple">{alert.confidence}%</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-secondary/25 p-2">
          <div className="text-muted-foreground">Validade</div>
          <div className="font-semibold">{alert.validityRounds} rodadas</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-secondary/25 p-2">
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
