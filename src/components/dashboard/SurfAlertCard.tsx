import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { SurfAlert } from "@/types/dashboard";
import { clampPercent, surfRiskBand, surfStrengthBand } from "@/utils/surf";
import { Activity, AlertTriangle, Gauge, Target, Waves } from "lucide-react";
import type { ReactNode } from "react";

export function SurfAlertCard({ alert, locked }: { alert: SurfAlert; locked?: boolean }) {
  const breakRisk = clampPercent(alert.surf_break_risk ?? alert.surf_risk);
  const confidence = clampPercent(alert.surf_confidence);
  const riskBand = surfRiskBand(breakRisk);
  const strengthBand = surfStrengthBand(confidence);
  const dominantSide = alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
    ? alert.surf_prediction_side
    : alert.surf_side;
  const borderTone = strengthBand.tone === "red" ? "border-destructive/35" : strengthBand.tone === "amber" ? "border-warning/35" : "border-neon-cyan/30";

  return (
    <GlassCard className={`min-h-[220px] ${borderTone}`}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/70 to-transparent" />
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-neon-cyan/10 blur-2xl" />
      <SectionTitle
        title="Surf Analyzer"
        subtitle="Leitura paralela da fase da mesa."
        right={<AppBadge tone={strengthBand.tone} pulse={alert.surf_alert}>{alert.surf_status ?? alert.surf_phase}</AppBadge>}
      />

      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
        <div className="size-12 rounded-xl glass-strong border-neon-cyan/40 flex items-center justify-center glow-blue">
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
            <Metric icon={<Activity className="size-3.5" />} label="Forca" value={`${confidence}%`} tone={strengthBand.tone} />
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
            <div className="font-semibold text-foreground">{strengthBand.status}</div>
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

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <Panel label="Big Road" value={alert.panels.big_road} />
        <Panel label="Big Eye Boy" value={alert.panels.big_eye_boy} />
        <Panel label="Small Road" value={alert.panels.small_road} />
        <Panel label="Cockroach Pig" value={alert.panels.cockroach_pig} />
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground">
        Aviso paralelo: nao bloqueia e nao substitui Banker/Player.
      </div>

      {locked && (
        <PremiumLock
          title="Surf Analyzer Premium"
          description="Leitura de surf e risco contrario em tempo real bloqueados"
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
