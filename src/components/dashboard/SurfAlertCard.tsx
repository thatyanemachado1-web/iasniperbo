import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { cn } from "@/lib/utils";
import type { DailySurfMaxSnapshot, DailySurfSide } from "@/surf/DailySurfMaxEngine";
import type { ModuleToggles, SurfAlert } from "@/types/dashboard";
import { clampPercent, surfRiskBand, surfStrengthBand } from "@/utils/surf";
import { Activity, AlertTriangle, Gauge, Target, Waves } from "lucide-react";
import type { ReactNode } from "react";

export function SurfAlertCard({
  alert,
  dailySurfMax,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
  showRoadPanels = true,
}: {
  alert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
  showRoadPanels?: boolean;
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
  const surfDecision = buildSurfDecision(confidence, breakRisk, dominantSide);
  const enabled = toggles?.surfAnalyzer !== false;
  const memory = dailySurfMax.dailySurfMemory;
  const memoryActionable = Boolean(
    memory.surfBias &&
      ["PRE_SURF", "SURF_AGRESSIVO", "SURF_DOMINANTE", "RECUPERACAO_SURF"].includes(
        memory.surfStatus,
      ),
  );
  const probableSurfEntry = memoryActionable && memory.surfBias ? memory.surfBias : "AGUARDAR";
  const compactConfidence = memory.totalDrops3Plus ? memory.confidence : 0;
  const compactStatus = memory.totalDrops3Plus ? memory.surfStatus : "SEM_SURF";

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
        <div className="mb-2 min-h-[58px] min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 pt-0.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
              Surf Analyzer
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Fase da mesa, força e risco contrário.
            </div>
          </div>
          <div className="flex max-w-[54%] shrink-0 flex-wrap items-center justify-end gap-1">
            <AppBadge
              tone={strengthBand.tone}
              pulse={enabled && alert.surf_alert}
              className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
            >
              {compactStatus}
            </AppBadge>
            <ModuleToggleStrip
              toggles={toggles}
              modules={["surfAnalyzer"]}
              onChange={onModuleTogglesChange}
              compact
            />
          </div>
          </div>
          <div className="mt-2 rounded-xl border border-neon-cyan/15 bg-background/30 px-2.5 py-2 shadow-[inset_0_0_18px_rgba(0,229,255,0.035)]">
            <div className="text-[8px] font-black uppercase tracking-[0.14em] text-neon-cyan">
              Entrada provável Surf
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span
                className={cn(
                  "truncate text-[13px] font-black uppercase leading-none",
                  probableSurfEntry === "BANKER"
                    ? "text-banker"
                    : probableSurfEntry === "PLAYER"
                      ? "text-player"
                      : "text-muted-foreground",
                )}
              >
                {probableSurfEntry}
              </span>
              <span className="shrink-0 text-[10px] font-black leading-none text-neon-cyan">
                {compactConfidence}%
              </span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 text-[8px] font-black uppercase tracking-[0.04em] text-muted-foreground">
              <span className="rounded-full border border-neon-cyan/15 bg-secondary/30 px-1.5 py-1">
                P3+ {memory.playerDrops3Plus}
              </span>
              <span className="rounded-full border border-neon-cyan/15 bg-secondary/30 px-1.5 py-1">
                B3+ {memory.bankerDrops3Plus}
              </span>
              <span className="rounded-full border border-neon-cyan/15 bg-secondary/30 px-1.5 py-1">
                AT {memory.currentDropDepth}
              </span>
            </div>
            <div className="mt-1.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground">
              {memory.reason}
            </div>
          </div>
          <div className="mt-2">
            <SurfMaximaPanel snapshot={dailySurfMax} />
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

      {!compact && (
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

            <SurfMaximaPanel snapshot={dailySurfMax} />
          </div>
        </div>

        <div
          className={cn(
            "mt-2 overflow-hidden rounded-xl border bg-background/42 p-2.5 text-center shadow-[inset_0_0_28px_rgba(0,229,255,0.05)]",
            surfDecision.borderClass,
            compact && "mt-2 p-2",
          )}
        >
          <div className="flex items-center justify-center gap-2">
            <Target className={cn("size-3.5", surfDecision.iconClass)} />
            <div className={cn("text-[9px] font-black uppercase tracking-[0.28em]", surfDecision.textClass)}>
              {surfDecision.kicker}
            </div>
          </div>
          <div className={cn("mt-1 text-lg font-black uppercase leading-none", surfDecision.textClass)}>
            {surfDecision.action}
          </div>
          <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {surfDecision.title}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Forca {confidence}% · Risco de quebra {breakRisk}% · {riskBand.label}
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

        {showRoadPanels && (
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
        )}

        <div className={cn("mt-3 text-[11px] text-muted-foreground", compact && "mt-2")}>
          <span className="font-black uppercase tracking-[0.1em] text-neon-cyan">Como usar: </span>
          mostra tendência. Só seguir o lado do Surf quando o risco de quebra estiver controlado.
        </div>
      </div>
      )}

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

function buildSurfDecision(confidence: number, breakRisk: number, side: string) {
  const sideLabel = side === "BANKER" || side === "PLAYER" ? side : "AGUARDAR";

  if (confidence >= 89 && sideLabel !== "AGUARDAR") {
    return {
      kicker: "Decisão do Surf",
      title: "Forte para surf",
      action: `Seguir ${sideLabel}`,
      borderClass: "border-success/35 bg-success/10",
      iconClass: "text-success",
      textClass: "text-success",
    };
  }

  if (confidence >= 85) {
    return {
      kicker: "Decisão do Surf",
      title: "Surf em observação",
      action: "Aguardar",
      borderClass: "border-warning/35 bg-warning/10",
      iconClass: "text-warning",
      textClass: "text-warning",
    };
  }

  if (breakRisk >= 66) {
    return {
      kicker: "Decisão do Surf",
      title: "Risco de quebra",
      action: "Não seguir",
      borderClass: "border-destructive/35 bg-destructive/10",
      iconClass: "text-destructive",
      textClass: "text-destructive",
    };
  }

  return {
    kicker: "Decisão do Surf",
    title: "Sem surf limpo",
    action: "Aguardar",
    borderClass: "border-neon-cyan/20 bg-secondary/20",
    iconClass: "text-neon-cyan",
    textClass: "text-foreground",
  };
}
function SurfMaximaPanel({ snapshot }: { snapshot: DailySurfMaxSnapshot }) {
  const maxima = snapshot.dailyMaxSurf;
  const best = bestDailySurf(maxima);
  const summary =
    best.value > 0
      ? `Maior surf detectado hoje: ${best.label} com ${best.value} seguidos`
      : "Aguardando rodadas de hoje para calcular a máxima.";

  return (
    <div className="rounded-xl border border-neon-cyan/12 bg-background/24 p-2">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-neon-cyan">
        Máxima do Surf Hoje
      </div>
      <div className="mt-1 text-[10px] font-semibold leading-snug text-muted-foreground">
        {summary}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <SurfMaxMiniCard
          label="Player"
          caption="Player seguidos"
          value={maxima.player}
          tone="player"
        />
        <SurfMaxMiniCard label="Empate" caption="Empates seguidos" value={maxima.tie} tone="tie" />
        <SurfMaxMiniCard
          label="Banker"
          caption="Banker seguidos"
          value={maxima.banker}
          tone="banker"
        />
      </div>
    </div>
  );
}

function SurfMaxMiniCard({
  label,
  caption,
  value,
  tone,
}: {
  label: string;
  caption: string;
  value: number;
  tone: "banker" | "player" | "tie";
}) {
  const toneClass = {
    banker: "border-banker/35 bg-banker/8 text-banker",
    player: "border-player/35 bg-player/8 text-player",
    tie: "border-tie/35 bg-tie/10 text-tie",
  }[tone];

  return (
    <div className={`min-w-0 rounded-lg border px-1.5 py-1.5 text-center ${toneClass}`}>
      <div className="text-[8px] font-black uppercase tracking-[0.1em] opacity-80">{label}</div>
      <div className="mt-0.5 text-lg font-black leading-none">{value}</div>
      <div className="mt-0.5 truncate text-[8px] font-semibold text-muted-foreground">
        {caption}
      </div>
    </div>
  );
}

function bestDailySurf(maxima: DailySurfMaxSnapshot["dailyMaxSurf"]): { label: DailySurfSide; value: number } {
  return [
    { label: "BANKER" as const, value: maxima.banker },
    { label: "PLAYER" as const, value: maxima.player },
    { label: "TIE" as const, value: maxima.tie },
  ].sort((left, right) => right.value - left.value)[0];
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
