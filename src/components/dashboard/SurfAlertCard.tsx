import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { buildSurfCopy } from "@/lib/operationalCopy";
import { cn } from "@/lib/utils";
import type { ModuleToggles, SurfAlert } from "@/types/dashboard";
import { clampPercent, surfRiskBand, surfStrengthBand } from "@/utils/surf";
import { Activity, AlertTriangle, Gauge, Target, Waves } from "lucide-react";
import type { ReactNode } from "react";

export function SurfAlertCard({
  alert,
  toggles,
  onModuleTogglesChange,
  locked,
}: {
  alert: SurfAlert;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
}) {
  const breakRisk = clampPercent(alert.surf_break_risk ?? alert.surf_risk);
  const confidence = clampPercent(alert.surf_confidence);
  const riskBand = surfRiskBand(breakRisk);
  const strengthBand = surfStrengthBand(confidence);
  const dominantSide = alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert.surf_side;
  const borderTone = strengthBand.tone === "red" ? "border-destructive/35" : strengthBand.tone === "amber" ? "border-warning/35" : "border-neon-cyan/30";
  const message = buildSurfCopy(alert);
  const enabled = toggles?.surfAnalyzer !== false;

  return (
    <GlassCard className={cn("min-h-[220px]", borderTone, !enabled && "border-muted-foreground/20")}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent" />
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-neon-cyan/10 blur-2xl" />
      <SectionTitle
        title="Surf Analyzer"
        subtitle="Leitura paralela da fase da mesa."
        right={
          <div className="flex shrink-0 items-center gap-1.5">
            <AppBadge tone={strengthBand.tone} pulse={enabled && alert.surf_alert}>
              {alert.surf_status ?? alert.surf_phase}
            </AppBadge>
            <ModuleToggleStrip
              toggles={toggles}
              modules={["surfAnalyzer"]}
              onChange={onModuleTogglesChange}
            />
          </div>
        }
      />

      <div className={cn("transition duration-200", !enabled && "opacity-45 saturate-50")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <div className="flex size-12 items-center justify-center rounded-xl border-neon-cyan/40 glass-strong glow-blue">
            <Waves className="size-6 text-neon-cyan" />
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge tone={dominantSide === "BANKER" ? "red" : dominantSide === "PLAYER" ? "blue" : "muted"}>
                {dominantSide === "NONE" ? "SEM LADO" : `RESPEITA ${dominantSide}`}
              </AppBadge>
              <AppBadge tone={strengthBand.tone}>{strengthBand.label}</AppBadge>
              <AppBadge tone={riskBand.tone}>QUEBRA {riskBand.label}</AppBadge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric icon={<Activity className="size-3.5" />} label="Força" value={`${confidence}%`} tone={strengthBand.tone} />
              <Metric icon={<Gauge className="size-3.5" />} label="Risco quebra" value={`${breakRisk}%`} tone={riskBand.tone} />
              <Metric label="Casas" value={`${alert.stretched_count}`} />
              <Metric label="Janela" value={alert.surf_prediction_window ? `${alert.surf_prediction_window}` : "-"} />
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-secondary/35 p-3 text-xs">
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 size-3.5 text-neon-cyan" />
            <div>
              <div className="font-semibold text-foreground">{message}</div>
              <div className="mt-1 text-muted-foreground">{alert.reason}</div>
            </div>
          </div>
        </div>

        <div className="mt-2 rounded-xl bg-secondary/30 p-3 text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 text-warning" />
            <div>
              <div className="font-semibold text-foreground">Risco de quebra: {riskBand.label}</div>
              <div className="mt-1 text-muted-foreground">{riskBand.status}</div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
          <Panel label="Big Road" value={alert.panels.big_road} />
          <Panel label="Big Eye Boy" value={alert.panels.big_eye_boy} />
          <Panel label="Small Road" value={alert.panels.small_road} />
          <Panel label="Cockroach Pig" value={alert.panels.cockroach_pig} />
        </div>

        <div className="mt-3 text-[11px] text-muted-foreground">
          Aviso paralelo: não bloqueia e não substitui Banker/Player.
        </div>
      </div>

      {!enabled && (
        <div className="mt-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          Surf Analyzer desativado neste painel.
        </div>
      )}

      {locked && (
        <PremiumLock
          title="Surf Analyzer Premium"
          description="Leitura de surf e risco contrário em tempo real bloqueados"
        />
      )}
    </GlassCard>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "muted",
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  tone?: "blue" | "purple" | "green" | "red" | "amber" | "gold" | "muted";
}) {
  const toneClass = {
    blue: "text-neon-cyan",
    purple: "text-neon-purple",
    green: "text-success",
    red: "text-destructive",
    amber: "text-warning",
    gold: "text-gold",
    muted: "text-foreground",
  }[tone];

  return (
    <div className="rounded-lg bg-secondary/40 p-2">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-0.5 font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Panel({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/25 p-2">
      <div className="font-semibold text-neon-cyan">{label}</div>
      <div className="mt-1 text-muted-foreground">{value}</div>
    </div>
  );
}
