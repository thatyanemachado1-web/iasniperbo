import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { cn } from "@/lib/utils";
import type { DailySurfMaxSnapshot, DailySurfSide } from "@/surf/DailySurfMaxEngine";
import type { ModuleToggles, SurfAlert } from "@/types/dashboard";
import { clampPercent, surfRiskBand, surfStrengthBand } from "@/utils/surf";
import { Waves } from "lucide-react";

export function SurfAlertCard({
  alert,
  dailySurfMax,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
  showRoadPanels = true,
  className,
}: {
  alert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
  showRoadPanels?: boolean;
  className?: string;
}) {
  const view = buildSurfView(alert);
  const enabled = toggles?.surfAnalyzer !== false;

  if (compact) {
    return (
      <GlassCard
        className={cn(
          DASHBOARD_MODULE_CARD_ROOT,
          "p-3 sm:p-3",
          view.borderClass,
          !enabled && "border-muted-foreground/20",
          className,
        )}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/35 to-transparent" />
        <CompactHeader
          view={view}
          enabled={enabled}
          toggles={toggles}
          onModuleTogglesChange={onModuleTogglesChange}
        />
        <div className={cn(DASHBOARD_MODULE_CARD_BODY, "mt-2 transition duration-200", !enabled && "opacity-45 saturate-50")}>
          <ActionPanel view={view} />
          <StatsRow view={view} />
          <SurfMaximaPanel snapshot={dailySurfMax} compact />
          {view.reason && (
            <div className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{view.reason}</div>
          )}
          <div className={DASHBOARD_MODULE_CARD_FILL} aria-hidden />
        </div>
        {!enabled && <DisabledNote />}
        {locked && (
          <PremiumLock
            title="Surf Analyzer Premium"
            description="Leitura de surf e risco contrário em tempo real bloqueados"
          />
        )}
      </GlassCard>
    );
  }

  return (
    <GlassCard className={cn("min-h-[220px]", view.borderClass, !enabled && "border-muted-foreground/20")}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/35 to-transparent" />
      <SectionTitle
        title="Surf Analyzer"
        subtitle="Leitura objetiva de surf, lado e risco de quebra."
        right={
          <div className="flex shrink-0 items-center gap-1.5">
            <AppBadge tone={view.statusTone} pulse={enabled && view.isActive}>
              {view.statusLabel}
            </AppBadge>
            <ModuleToggleStrip toggles={toggles} modules={["surfAnalyzer"]} onChange={onModuleTogglesChange} />
          </div>
        }
      />
      <div className={cn("space-y-3 transition duration-200", !enabled && "opacity-45 saturate-50")}>
        <ActionPanel view={view} large />
        <StatsRow view={view} large />
        <SurfMaximaPanel snapshot={dailySurfMax} />
        {view.reason && <div className="text-xs text-muted-foreground">{view.reason}</div>}
        {showRoadPanels && (
          <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
            <Panel label="Big Road" value={alert.panels.big_road} />
            <Panel label="Big Eye Boy" value={alert.panels.big_eye_boy} />
            <Panel label="Small Road" value={alert.panels.small_road} />
            <Panel label="Cockroach Pig" value={alert.panels.cockroach_pig} />
          </div>
        )}
      </div>
      {!enabled && <DisabledNote />}
      {locked && (
        <PremiumLock
          title="Surf Analyzer Premium"
          description="Leitura de surf e risco contrário em tempo real bloqueados"
        />
      )}
    </GlassCard>
  );
}

function CompactHeader({
  view,
  enabled,
  toggles,
  onModuleTogglesChange,
}: {
  view: SurfView;
  enabled: boolean;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
          Surf Analyzer
        </div>
      </div>
      <div className="flex max-w-[58%] shrink-0 flex-wrap items-center justify-end gap-1">
        <AppBadge
          tone={view.statusTone}
          pulse={enabled && view.isActive}
          className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
        >
          {view.statusLabel}
        </AppBadge>
        <ModuleToggleStrip toggles={toggles} modules={["surfAnalyzer"]} onChange={onModuleTogglesChange} compact />
      </div>
    </div>
  );
}

function ActionPanel({ view, large = false }: { view: SurfView; large?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5 text-center shadow-[inset_0_0_28px_rgba(0,229,255,0.05)]",
        view.panelClass,
        large && "py-3",
      )}
    >
      <div className={cn("font-black uppercase leading-none", large ? "text-2xl" : "text-lg", view.actionClass)}>
        {view.action}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {view.headline}
      </div>
    </div>
  );
}

function StatsRow({ view, large = false }: { view: SurfView; large?: boolean }) {
  return (
    <div className={cn("grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4", large && "gap-2")}>
      <StatChip label="Lado" value={view.sideLabel} tone={view.sideTone} />
      <StatChip label="Força" value={`${view.confidence}%`} tone={view.strengthTone} />
      <StatChip label="Casas" value={`${view.stretchedCount}`} tone="muted" />
      <StatChip label="Quebra" value={`${view.breakRisk}%`} tone={view.riskTone} />
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "banker" | "player" | "green" | "red" | "amber" | "muted";
}) {
  const toneClass = {
    banker: "border-banker/30 bg-banker/8 text-banker",
    player: "border-player/30 bg-player/8 text-player",
    green: "border-success/30 bg-success/8 text-success",
    red: "border-destructive/30 bg-destructive/8 text-destructive",
    amber: "border-warning/30 bg-warning/8 text-warning",
    muted: "border-border/60 bg-secondary/25 text-foreground",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 truncate text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function SurfMaximaPanel({ snapshot, compact = false }: { snapshot: DailySurfMaxSnapshot; compact?: boolean }) {
  const maxima = snapshot.dailyMaxSurf;
  const best = bestDailySurf(maxima);

  if (compact) {
    return (
      <div className="rounded-lg border border-neon-cyan/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
        <div className="font-black uppercase tracking-[0.08em] text-neon-cyan/80">
          Máxima hoje · reseta 00:00 (BR)
        </div>
        <div className="mt-0.5">
          P {maxima.player} · E {maxima.tie} · B {maxima.banker}
          {best.value > 0 ? ` · Maior ${best.label} (${best.value})` : ""}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neon-cyan/12 bg-background/24 p-2">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-neon-cyan">Máxima do Surf Hoje</div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <SurfMaxMiniCard label="Player" value={maxima.player} tone="player" />
        <SurfMaxMiniCard label="Empate" value={maxima.tie} tone="tie" />
        <SurfMaxMiniCard label="Banker" value={maxima.banker} tone="banker" />
      </div>
    </div>
  );
}

function SurfMaxMiniCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "banker" | "player" | "tie";
}) {
  const toneClass = {
    banker: "border-banker/35 bg-banker/8 text-banker",
    player: "border-player/35 bg-player/8 text-player",
    tie: "border-tie/35 bg-tie/10 text-tie",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1.5 py-1.5 text-center", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.1em] opacity-80">{label}</div>
      <div className="mt-0.5 text-lg font-black leading-none">{value}</div>
    </div>
  );
}

function DisabledNote() {
  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
      Surf Analyzer desativado neste painel.
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

interface SurfView {
  side: "BANKER" | "PLAYER" | "NONE";
  sideLabel: string;
  sideTone: "banker" | "player" | "muted";
  confidence: number;
  breakRisk: number;
  stretchedCount: number;
  statusLabel: string;
  statusTone: "green" | "red" | "amber" | "muted";
  strengthTone: "green" | "red" | "amber" | "muted";
  riskTone: "green" | "red" | "amber" | "muted";
  isActive: boolean;
  action: string;
  headline: string;
  reason: string;
  actionClass: string;
  panelClass: string;
  borderClass: string;
}

function buildSurfView(alert: SurfAlert): SurfView {
  const breakRisk = clampPercent(alert.surf_break_risk ?? alert.surf_risk);
  const confidence = clampPercent(alert.surf_prediction_confidence ?? alert.surf_confidence);
  const riskBand = surfRiskBand(breakRisk);
  const strengthBand = surfStrengthBand(confidence);
  const side =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side;
  const sideLabel = side === "BANKER" || side === "PLAYER" ? side : "AGUARDAR";
  const statusLabel = formatSurfStatus(alert.surf_status ?? alert.surf_phase);
  const isActive = Boolean(alert.surf_alert && sideLabel !== "AGUARDAR" && confidence >= 60);
  const decision = buildSurfDecision(confidence, breakRisk, sideLabel, isActive, statusLabel);

  return {
    side: side === "BANKER" || side === "PLAYER" ? side : "NONE",
    sideLabel,
    sideTone: side === "BANKER" ? "banker" : side === "PLAYER" ? "player" : "muted",
    confidence,
    breakRisk,
    stretchedCount: alert.stretched_count ?? 0,
    statusLabel,
    statusTone: strengthBand.tone === "gold" ? "amber" : strengthBand.tone,
    strengthTone: strengthBand.tone === "gold" ? "amber" : strengthBand.tone,
    riskTone: riskBand.tone === "gold" ? "amber" : riskBand.tone,
    isActive,
    action: decision.action,
    headline: decision.headline,
    reason: alert.reason?.trim() ?? "",
    actionClass: decision.actionClass,
    panelClass: decision.panelClass,
    borderClass: decision.borderClass,
  };
}

function buildSurfDecision(
  confidence: number,
  breakRisk: number,
  sideLabel: string,
  isActive: boolean,
  statusLabel: string,
) {
  if (isActive && sideLabel !== "AGUARDAR") {
    return {
      action: `Seguir ${sideLabel}`,
      headline: `${statusLabel} · Força ${confidence}% · Quebra ${breakRisk}%`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
    };
  }

  if (breakRisk >= 66) {
    return {
      action: "Não seguir",
      headline: `Risco de quebra alto · ${statusLabel}`,
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
    };
  }

  if (confidence >= 50 && sideLabel !== "AGUARDAR") {
    return {
      action: "Aguardar",
      headline: `${statusLabel} · Confirmar mais uma casa`,
      actionClass: "text-warning",
      panelClass: "border-warning/35 bg-warning/10",
      borderClass: "border-warning/30",
    };
  }

  return {
    action: "Aguardar",
    headline: "Sem surf limpo no momento",
    actionClass: "text-muted-foreground",
    panelClass: "border-neon-cyan/20 bg-secondary/20",
    borderClass: "border-neon-cyan/30",
  };
}

function formatSurfStatus(status: string | null | undefined) {
  return String(status ?? "ANALISANDO").replaceAll("_", " ");
}

function bestDailySurf(maxima: DailySurfMaxSnapshot["dailyMaxSurf"]): { label: DailySurfSide; value: number } {
  return [
    { label: "BANKER" as const, value: maxima.banker },
    { label: "PLAYER" as const, value: maxima.player },
    { label: "TIE" as const, value: maxima.tie },
  ].sort((left, right) => right.value - left.value)[0];
}
