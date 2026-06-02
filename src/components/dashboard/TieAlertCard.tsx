import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { buildTieCopy } from "@/lib/operationalCopy";
import { cn } from "@/lib/utils";
import type { ModuleToggles, TieAlert } from "@/types/dashboard";
import { Sparkles } from "lucide-react";

export function TieAlertCard({
  alert,
  toggles,
  onModuleTogglesChange,
  locked,
}: {
  alert: TieAlert;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
}) {
  const message = buildTieCopy(alert);
  const enabled = toggles?.tieAlert !== false;

  return (
    <GlassCard className={cn("digital-risk-card border-warning/20 p-3 sm:p-3", !enabled && "border-muted-foreground/20")}>
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/30 to-transparent" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
          Tie Alert estatístico
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <AppBadge tone="amber" pulse={enabled}>Pressão Tie</AppBadge>
          <ModuleToggleStrip
            toggles={toggles}
            modules={["tieAlert"]}
            onChange={onModuleTogglesChange}
          />
        </div>
      </div>

      <div className={cn("transition duration-200", !enabled && "opacity-45 saturate-50")}>
        <div className="grid gap-2 sm:grid-cols-[minmax(150px,0.42fr)_minmax(0,1fr)] sm:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-warning/20 bg-secondary/20">
              <Sparkles className="size-4 text-warning" />
            </div>
            <div>
              <div className="text-xl font-extrabold text-neon-purple">Nível {alert.level}</div>
              <div className="text-[11px] text-muted-foreground">Não substitui Banker/Player</div>
            </div>
          </div>
          <div className="rounded-lg border border-warning/10 bg-secondary/20 p-2 text-[11px] leading-relaxed text-foreground/85">
            {message}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border border-white/5 bg-secondary/20 px-2 py-1.5">
            <div className="text-muted-foreground">Confiança</div>
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
      </div>

      {!enabled && (
        <div className="mt-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          Tie Alert desativado neste painel.
        </div>
      )}

      {locked && (
        <PremiumLock
          title="Tie Alert Premium"
          description="Tie Alert estatístico disponível para assinantes"
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
