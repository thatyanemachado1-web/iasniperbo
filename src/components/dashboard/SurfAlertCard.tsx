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
  compact = false,
}: {
  alert: SurfAlert;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
}) {
  const breakRisk = clampPercent(alert.surf_break_risk ?? alert.surf_risk);
  const confidence = clampPercent(alert.surf_confidence);
  const riskBand = surfRiskBand(breakRisk);
  const strengthBand = surfStrengthBand(confidence);
  const dominantSide =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side;
  const borderTone =
    strengthBand.tone === "red"
      ? "border-destructive/35"
      : strengthBand.tone === "amber"
        ? "border-warning/35"
        : "border-neon-cyan/30";
  const message = buildSurfCopy(alert);
  const enabled = toggles?.surfAnalyzer !== false;

  return (
    <GlassCard
      className={cn(
        "min-h-[220px]",
        compact && "h-full p-3 sm:p-3",
        borderTone,
        !enabled && "border-muted-foreground/20",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/35 to-transparent" />
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-neon-cyan/5 blur-2xl" />
      {compact ? (
        <div className="mb-3 flex min-w-0 flex-col items-start gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
              Surf Analyzer
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Fase da mesa, força e risco contrário.
            </div>
          </div>
          <div className="flex max-w-full flex-wrap items-center gap-1.5">
            <AppBadge
              tone={strengthBand.tone}
              pulse={enabled && alert.surf_alert}
              className="max-w-full truncate px-2 text-[9px]"
            >
              {alert.surf_status ?? alert.surf_phase}
            </AppBadge>
            <ModuleToggleStrip
              toggles={toggles}
              modules={["surfAnalyzer"]}
              onChange={onModuleTogglesChange}
            />
          </div>
        </div>
      ) : (
        <SectionTitle
          title="Surf Analyzer"
          subtitle="Fase da mesa, força e risco contrário."
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
      )}

      <div className={cn("transition duration-200", !enabled && "opacity-45 saturate-50")}>
        <div
          className={cn(
            "grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]",
            compact && "gap-2 sm:grid-cols-1",
          )}
        >
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-xl border border-neon-cyan/25 bg-background/35",
              compact && "size-10",
            )}
          >
            <Waves className={cn("size-6 text-neon-cyan", compact && "size-5")} />
          </div>

          <div className={cn("space-y-3", compact && "space-y-2")}>
            <div className="flex flex-wrap items-center gap-2">
              <AppBadge
                tone={
                  dominantSide === "BANKER" ? "red" : dominantSide === "PLAYER" ? "blue" : "muted"
                }
              >
                {dominantSide === "NONE" ? "SEM LADO" : `LADO ${dominantSide}`}
              </AppBadge>
              <AppBadge tone={strengthBand.tone}>{strengthBand.label}</AppBadge>
              <AppBadge tone={riskBand.tone}>QUEBRA {riskBand.label}</AppBadge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric
                icon={<Activity className="size-3.5" />}
                label="Força"
                value={`${confidence}%`}
                tone={strengthBand.tone}
              />
              <Metric
                icon={<Gauge className="size-3.5" />}
                label="Risco quebra"
                value={`${breakRisk}%`}
                tone={riskBand.tone}
              />
              <Metric label="Casas" value={`${alert.stretched_count}`} />
              <Metric
                label="Janela"
                value={alert.surf_prediction_window ? `${alert.surf_prediction_window}` : "-"}
              />
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-3 rounded-xl border border-neon-cyan/12 bg-background/28 p-3 text-xs",
            compact && "mt-2 p-2.5",
          )}
        >
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 size-3.5 text-neon-cyan" />
            <div>
              <div className="font-semibold text-foreground">{message}</div>
              <div className="mt-1 text-muted-foreground">{alert.reason}</div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 rounded-xl border border-warning/12 bg-background/24 p-3 text-xs",
            compact && "p-2.5",
          )}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-3.5 text-warning" />
            <div>
              <div className="font-semibold text-foreground">Risco de quebra: {riskBand.label}</div>
              <div className="mt-1 text-muted-foreground">{riskBand.status}</div>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2",
            compact && "mt-2",
          )}
        >
          <Panel label="Big Road" value={alert.panels.big_road} />
          <Panel label="Big Eye Boy" value={alert.panels.big_eye_boy} />
          <Panel label="Small Road" value={alert.panels.small_road} />
          <Panel label="Cockroach Pig" value={alert.panels.cockroach_pig} />
        </div>

        <div className={cn("mt-3 text-[11px] text-muted-foreground", compact && "mt-2")}>
          <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">Como usar: </span>
          mostra tendência. Só seguir o lado do Surf quando o risco de quebra estiver controlado.
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
    <div className="rounded-xl border border-white/5 bg-secondary/30 p-2">
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
    <div className="rounded-xl border border-border/60 bg-background/22 p-2">
      <div className="font-semibold text-neon-cyan">{label}</div>
      <div className="mt-1 text-muted-foreground">{value}</div>
    </div>
  );
}
