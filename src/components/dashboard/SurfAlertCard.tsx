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
import type {
  DashboardPersistentResult,
  ModuleToggles,
  SurfAlert,
  SurfCycle,
  SurfHistoryEntry,
} from "@/types/dashboard";
import { clampPercent, surfRiskBand, surfStrengthBand } from "@/utils/surf";
import { ChevronDown, Waves } from "lucide-react";
import { useState } from "react";

export function SurfAlertCard({
  alert,
  dailySurfMax,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
  showRoadPanels = true,
  persistedResults = [],
  className,
}: {
  alert: SurfAlert;
  dailySurfMax: DailySurfMaxSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
  showRoadPanels?: boolean;
  persistedResults?: DashboardPersistentResult[];
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
        <CompactHeader />
        <div
          className={cn(
            DASHBOARD_MODULE_CARD_BODY,
            "mt-2 transition duration-200",
            !enabled && "opacity-45 saturate-50",
          )}
        >
          <ActionPanel view={view} />
          <StatsRow view={view} />
          <details className="group rounded-lg border border-white/10 bg-background/20">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
              <span>Ver mais — resultados e análise</span>
              <ChevronDown className="size-3 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-2 border-t border-white/10 p-2">
              <DailySurfMemoryPanel alert={alert} compact />
              <SurfCycleResultsPanel alert={alert} persistedResults={persistedResults} compact />
              <SurfMaximaPanel snapshot={dailySurfMax} compact />
              {view.reason && (
                <div className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {view.reason}
                </div>
              )}
            </div>
          </details>
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
    <GlassCard
      className={cn("min-h-[220px]", view.borderClass, !enabled && "border-muted-foreground/20")}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-cyan/35 to-transparent" />
      <SectionTitle
        title="Surf Analyzer"
        subtitle="Leitura objetiva de surf, lado e risco de quebra."
        right={
          <div className="flex shrink-0 items-center gap-1.5">
            <AppBadge tone={view.statusTone} pulse={enabled && view.isActive}>
              {view.statusLabel}
            </AppBadge>
            <ModuleToggleStrip
              toggles={toggles}
              modules={["surfAnalyzer"]}
              onChange={onModuleTogglesChange}
            />
          </div>
        }
      />
      <div
        className={cn("space-y-3 transition duration-200", !enabled && "opacity-45 saturate-50")}
      >
        <ActionPanel view={view} large />
        <StatsRow view={view} large />
        <DailySurfMemoryPanel alert={alert} />
        <SurfCycleResultsPanel alert={alert} persistedResults={persistedResults} />
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

function CompactHeader() {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        Surf Analyzer
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
      <div
        className={cn(
          "font-black uppercase leading-none",
          large ? "text-2xl" : "text-lg",
          view.actionClass,
        )}
      >
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
      <StatChip label="Forca" value={`${view.confidence}%`} tone={view.strengthTone} />
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
    player: "border-player/35 bg-player/10 text-player",
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

function DailySurfMemoryPanel({ alert, compact = false }: { alert: SurfAlert; compact?: boolean }) {
  const memory = alert.dailySurfMemory;
  if (!memory) return null;

  const side =
    memory.surfBias ?? memory.stretchedSide ?? memory.recoverySide ?? memory.dominantSide;
  const activeSide =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side && alert.surf_side !== "NONE"
        ? alert.surf_side
        : null;
  const memoryAligned = Boolean(side && activeSide && side === activeSide);
  const status = memoryAligned
    ? `${formatSurfStatus(memory.surfStatus)}${side ? ` ${side}` : ""}`
    : "MEMORIA DO DIA";
  const dominant = memory.dominantSide
    ? `${memory.dominantSide} ${memory.dominantPercent}%`
    : `${memory.dominantPercent}%`;
  const tone = memoryAligned
    ? side === "BANKER"
      ? "text-banker"
      : side === "PLAYER"
        ? "text-player"
        : "text-muted-foreground"
    : "text-muted-foreground";
  const note =
    memoryAligned || !side || !activeSide
      ? memory.reason
      : `Memoria aponta ${side}, mas o sinal atual segue ${activeSide}. Usada apenas como contexto.`;

  return (
    <div
      className={cn(
        "rounded-lg border border-neon-cyan/15 bg-background/22 p-2",
        compact ? "space-y-1.5" : "space-y-2",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={cn("truncate text-[9px] font-black uppercase tracking-[0.12em]", tone)}>
          {status}
        </div>
        <div className="shrink-0 text-[9px] font-black text-neon-cyan">
          {memoryAligned ? `${memory.confidence}%` : "contexto"}
        </div>
      </div>
      <div className={cn("grid grid-cols-2 gap-1 text-[9px]", !compact && "sm:grid-cols-3")}>
        <MemoryChip label="Player 3+" value={`${memory.playerDrops3Plus}x`} tone="player" />
        <MemoryChip label="Banker 3+" value={`${memory.bankerDrops3Plus}x`} tone="banker" />
        <MemoryChip label="Dominancia" value={dominant} tone="muted" />
        <MemoryChip label="Maior P" value={`${memory.playerMaxDepth} casas`} tone="player" />
        <MemoryChip label="Maior B" value={`${memory.bankerMaxDepth} casas`} tone="banker" />
        <MemoryChip label="Atual" value={`${memory.currentDropDepth} casas`} tone="muted" />
      </div>
      {note && (
        <div className="line-clamp-2 text-[9px] leading-snug text-muted-foreground">{note}</div>
      )}
    </div>
  );
}

function SurfCycleResultsPanel({
  alert,
  persistedResults = [],
  compact = false,
}: {
  alert: SurfAlert;
  persistedResults?: DashboardPersistentResult[];
  compact?: boolean;
}) {
  const persistedHistory = persistedResults
    .map(surfHistoryFromPersistentResult)
    .filter((item): item is SurfHistoryEntry => Boolean(item));
  const history = dedupeSurfHistory([...persistedHistory, ...(alert.surfHistory ?? [])]);
  const [open, setOpen] = useState(false);
  const stats = alert.surfCycleStats;
  const persistedStats = buildSurfStatsFromHistory(history);
  const visibleStats = {
    greensSG: Math.max(persistedStats.greensSG, stats?.greensSG ?? 0),
    redsSG: Math.max(persistedStats.redsSG, stats?.redsSG ?? 0),
    empates: Math.max(persistedStats.empates, stats?.empates ?? 0),
  };
  const cycleCount = visibleStats.greensSG + visibleStats.redsSG + visibleStats.empates;

  return (
    <div className="rounded-lg border border-neon-cyan/15 bg-background/22">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <ChevronDown
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
            aria-hidden
          />
          <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            Entradas / Resultados
          </span>
        </div>
        <span className="shrink-0 whitespace-nowrap text-[6.5px] font-black uppercase tracking-[0.02em] text-neon-cyan">
          {cycleCount} no ciclo
        </span>
      </button>
      {open && (
        <div className={cn("border-t border-white/10 px-2 pb-2", compact ? "pt-1.5" : "pt-2")}>
          {(stats ||
            persistedStats.greensSG ||
            persistedStats.redsSG ||
            persistedStats.empates) && (
            <div className="mb-1.5 grid grid-cols-3 gap-1 text-center text-[8px]">
              <MiniResultStat label="GREEN SG" value={visibleStats.greensSG} tone="green" />
              <MiniResultStat label="RED SG" value={visibleStats.redsSG} tone="red" />
              <MiniResultStat label="EMPATE" value={visibleStats.empates} tone="tie" />
            </div>
          )}
          {history.length ? (
            <div
              className={cn("space-y-1 overflow-y-auto pr-1", compact ? "max-h-20" : "max-h-24")}
            >
              {history.map((item, index) => (
                <SurfHistoryRow
                  key={`${item.cycleId ?? item.patternId ?? index}:${item.closedRoundId ?? index}`}
                  item={item}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-white/10 bg-secondary/15 px-2 py-1.5 text-[9px] font-semibold text-muted-foreground">
              Sem resultados do Surf ainda.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function surfHistoryFromPersistentResult(row: DashboardPersistentResult): SurfHistoryEntry | null {
  if (!row.resultId || !row.createdAt) return null;
  const result =
    row.resultType === "EMPATE" || row.resultType === "EMPATE_G1"
      ? "EMPATE"
      : row.resultType === "RED"
        ? "RED"
        : "GREEN";
  return {
    cycleId: row.resultId,
    patternId: row.signalId ?? null,
    technicalSide: row.side === "BANKER" || row.side === "PLAYER" ? row.side : null,
    result,
    attempt: "SG",
    tieMultiplier:
      row.tieMultiplier === undefined || row.tieMultiplier === null
        ? null
        : String(row.tieMultiplier),
    entryRoundId: typeof row.payload?.entryRoundId === "string" ? row.payload.entryRoundId : null,
    closedRoundId: row.roundId ?? null,
    closedAt: row.createdAt,
    statusLabel: typeof row.payload?.statusLabel === "string" ? row.payload.statusLabel : null,
    label: row.label,
  };
}

function buildSurfStatsFromHistory(history: SurfHistoryEntry[]) {
  return {
    greensSG: history.filter((item) => item.result === "GREEN").length,
    redsSG: history.filter((item) => item.result === "RED").length,
    empates: history.filter((item) => item.result === "EMPATE").length,
  };
}

function MiniResultStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "red" | "tie";
}) {
  const toneClass = {
    green: "border-success/25 bg-success/8 text-success",
    red: "border-destructive/25 bg-destructive/8 text-destructive",
    tie: "border-tie/30 bg-tie/10 text-tie",
  }[tone];

  return (
    <div className={cn("rounded-md border px-1 py-1", toneClass)}>
      <div className="truncate font-black uppercase opacity-75">{label}</div>
      <div className="mt-0.5 text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function SurfHistoryRow({ item }: { item: SurfHistoryEntry }) {
  const result = item.result;
  const side = item.technicalSide ?? "TIE";
  const label = formatSurfHistoryLabel(item);
  const resultClass =
    result === "GREEN" ? "text-success" : result === "RED" ? "text-destructive" : "text-tie";
  const sideClass =
    side === "BANKER" ? "text-banker" : side === "PLAYER" ? "text-player" : "text-tie";

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-white/10 bg-secondary/15 px-2 py-1 text-[9px]">
      <div className="min-w-0 truncate font-black uppercase">
        <span className={sideClass}>{side}</span>
        <span className="mx-1 text-muted-foreground">/</span>
        <span className={resultClass}>{label}</span>
      </div>
      <div className="shrink-0 text-[8px] font-bold text-muted-foreground">
        {formatSurfHistoryTime(item.closedAt)}
      </div>
    </div>
  );
}

function formatSurfHistoryLabel(item: SurfHistoryEntry) {
  if (item.result === "GREEN") return "GREEN SG";
  if (item.result === "RED") return "RED SG";
  if (item.result === "EMPATE")
    return `EMPATE ${String(item.tieMultiplier ?? "").toUpperCase()}`.trim();
  return item.label ?? item.statusLabel ?? item.result;
}

function formatSurfHistoryTime(value?: string | null) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dedupeSurfHistory(history: SurfHistoryEntry[]) {
  const seen = new Set<string>();
  return history.filter((item) => {
    const key = `${item.cycleId ?? item.patternId ?? ""}:${item.closedRoundId ?? ""}:${item.result}:${item.attempt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function MemoryChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "banker" | "player" | "muted";
}) {
  const toneClass = {
    banker: "border-banker/25 bg-banker/8 text-banker",
    player: "border-player/30 bg-player/10 text-player",
    muted: "border-white/10 bg-secondary/20 text-foreground",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-md border px-1.5 py-1", toneClass)}>
      <div className="truncate text-[7px] font-black uppercase tracking-[0.08em] opacity-75">
        {label}
      </div>
      <div className="mt-0.5 truncate font-black leading-none">{value}</div>
    </div>
  );
}

function SurfMaximaPanel({
  snapshot,
  compact = false,
}: {
  snapshot: DailySurfMaxSnapshot;
  compact?: boolean;
}) {
  const maxima = snapshot.dailyMaxSurf;
  const best = bestDailySurf(maxima);

  if (compact) {
    return (
      <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
        <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">
          Maxima hoje - reseta 00:00 (BR)
        </div>
        <div className="mt-0.5">
          P {maxima.player} - E {maxima.tie} - B {maxima.banker}
          {best.value > 0 ? ` - Maior ${best.label} (${best.value})` : ""}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neon-cyan/12 bg-background/24 p-2">
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-neon-cyan">
        Maxima do Surf Hoje
      </div>
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
  tone: "banker" | "player" | "tie" | "muted";
}) {
  const toneClass = {
    banker: "border-banker/35 bg-banker/8 text-banker",
    player: "border-player/35 bg-player/10 text-player",
    tie: "border-tie/35 bg-tie/10 text-tie",
    muted: "border-border/60 bg-secondary/25 text-foreground",
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

type SurfCycleDecision = {
  action: string;
  headline: string;
  actionClass: string;
  panelClass: string;
  borderClass: string;
  statusLabel: string;
  statusTone: SurfView["statusTone"];
};

function buildSurfView(alert: SurfAlert): SurfView {
  const memory = alert.dailySurfMemory;
  const memoryStatus = memory?.surfStatus;
  const memorySide =
    memory?.surfBias ?? memory?.stretchedSide ?? memory?.recoverySide ?? memory?.dominantSide;
  const predictionSide =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE"
      ? alert.surf_prediction_side
      : alert.surf_side && alert.surf_side !== "NONE"
        ? alert.surf_side
        : null;
  const memoryAligned = Boolean(memorySide && predictionSide && memorySide === predictionSide);
  const breakRisk = clampPercent(
    memoryAligned && memoryStatus === "RISCO_QUEBRA"
      ? Math.max(alert.surf_break_risk ?? alert.surf_risk, 76)
      : memoryAligned && memoryStatus === "SURF_ESTICADO"
        ? Math.max(alert.surf_break_risk ?? alert.surf_risk, 58)
        : (alert.surf_break_risk ?? alert.surf_risk),
  );
  const confidence = clampPercent(alert.surf_prediction_confidence ?? alert.surf_confidence);
  const riskBand = surfRiskBand(breakRisk);
  const strengthBand = surfStrengthBand(confidence);
  const side = predictionSide ?? "NONE";
  const sideLabel = side === "BANKER" || side === "PLAYER" ? side : "AGUARDAR";
  const statusLabel =
    memoryAligned && memoryStatus && memoryStatus !== "SEM_SURF"
      ? `${formatSurfStatus(memoryStatus)}${memorySide ? ` ${memorySide}` : ""}`
      : formatSurfStatus(alert.surf_status ?? alert.surf_phase);
  const blockedByMemory =
    memoryAligned && (memoryStatus === "RISCO_QUEBRA" || memoryStatus === "SURF_ESTICADO");
  const isActive = Boolean(
    alert.surf_alert && !blockedByMemory && sideLabel !== "AGUARDAR" && confidence >= 60,
  );
  const cycleDecision = buildSurfCycleDecision(alert.surfCycle);
  const decision =
    cycleDecision ??
    buildSurfDecision(confidence, breakRisk, sideLabel, isActive, statusLabel, memoryStatus);
  const effectiveStatusLabel = cycleDecision?.statusLabel ?? statusLabel;
  const effectiveStatusTone =
    cycleDecision?.statusTone ?? (strengthBand.tone === "gold" ? "amber" : strengthBand.tone);

  return {
    side: side === "BANKER" || side === "PLAYER" ? side : "NONE",
    sideLabel,
    sideTone: side === "BANKER" ? "banker" : side === "PLAYER" ? "player" : "muted",
    confidence,
    breakRisk,
    stretchedCount: memory?.currentDropDepth ?? alert.stretched_count ?? 0,
    statusLabel: effectiveStatusLabel,
    statusTone: effectiveStatusTone,
    strengthTone: strengthBand.tone === "gold" ? "amber" : strengthBand.tone,
    riskTone: riskBand.tone === "gold" ? "amber" : riskBand.tone,
    isActive,
    action: decision.action,
    headline: decision.headline,
    reason: memory?.reason?.trim() || alert.reason?.trim() || "",
    actionClass: decision.actionClass,
    panelClass: decision.panelClass,
    borderClass: decision.borderClass,
  };
}

function buildSurfCycleDecision(cycle?: SurfCycle | null): SurfCycleDecision | null {
  if (!cycle) return null;
  const side = cycle.technicalSide ?? "AGUARDAR";
  if (cycle.cycleStatus === "AGUARDANDO_RESULTADO") {
    return {
      action: side === "BANKER" || side === "PLAYER" ? `Seguir ${side}` : "Aguardar",
      headline: "Aguardando resultado SG",
      actionClass: surfSideTextClass(side),
      panelClass: surfSidePanelClass(side),
      borderClass: surfSideBorderClass(side),
      statusLabel: "SG ABERTO",
      statusTone: "amber" as const,
    };
  }
  if (cycle.result === "GREEN") {
    return {
      action: "GREEN SG",
      headline: `${side} bateu na rodada seguinte`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
      statusLabel: "GREEN SG",
      statusTone: "green" as const,
    };
  }
  if (cycle.result === "RED") {
    return {
      action: "RED SG",
      headline: `${side} quebrou na rodada seguinte`,
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
      statusLabel: "RED SG",
      statusTone: "red" as const,
    };
  }
  if (cycle.result === "EMPATE") {
    const multiplier = String(cycle.tieMultiplier ?? "").toUpperCase();
    return {
      action: `EMPATE ${multiplier}`.trim(),
      headline: "Empate na rodada seguinte",
      actionClass: "text-tie",
      panelClass: "border-tie/35 bg-tie/10",
      borderClass: "border-tie/30",
      statusLabel: `EMPATE ${multiplier}`.trim(),
      statusTone: "amber" as const,
    };
  }
  return null;
}

function buildSurfDecision(
  confidence: number,
  breakRisk: number,
  sideLabel: string,
  isActive: boolean,
  statusLabel: string,
  statusKey?: string,
) {
  if (statusKey === "RISCO_QUEBRA") {
    return {
      action: "Nao seguir",
      headline: `Risco de quebra - ${statusLabel}`,
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
    };
  }

  if (statusKey === "SURF_ESTICADO") {
    return {
      action: "Aguardar",
      headline: `Coluna esticada - ${statusLabel}`,
      actionClass: "text-warning",
      panelClass: "border-warning/35 bg-warning/10",
      borderClass: "border-warning/30",
    };
  }

  if (isActive && sideLabel !== "AGUARDAR") {
    return {
      action: `Seguir ${sideLabel}`,
      headline: `${statusLabel} - Forca ${confidence}% - Quebra ${breakRisk}%`,
      actionClass: surfSideTextClass(sideLabel),
      panelClass: surfSidePanelClass(sideLabel),
      borderClass: surfSideBorderClass(sideLabel),
    };
  }

  if (breakRisk >= 66) {
    return {
      action: "Nao seguir",
      headline: `Risco de quebra alto - ${statusLabel}`,
      actionClass: "text-destructive",
      panelClass: "border-destructive/35 bg-destructive/10",
      borderClass: "border-destructive/30",
    };
  }

  if (confidence >= 50 && sideLabel !== "AGUARDAR") {
    return {
      action: "Aguardar",
      headline: `${statusLabel} - Confirmar mais uma casa`,
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

function surfSideTextClass(sideLabel: string) {
  if (sideLabel === "BANKER") return "text-banker";
  if (sideLabel === "PLAYER") return "text-player";
  return "text-muted-foreground";
}

function surfSidePanelClass(sideLabel: string) {
  if (sideLabel === "BANKER") return "border-banker/35 bg-banker/10";
  if (sideLabel === "PLAYER") return "border-player/35 bg-player/10";
  return "border-success/35 bg-success/10";
}

function surfSideBorderClass(sideLabel: string) {
  if (sideLabel === "BANKER") return "border-banker/35";
  if (sideLabel === "PLAYER") return "border-player/35";
  return "border-success/30";
}

function bestDailySurf(maxima: DailySurfMaxSnapshot["dailyMaxSurf"]): {
  label: DailySurfSide;
  value: number;
} {
  return [
    { label: "BANKER" as const, value: maxima.banker },
    { label: "PLAYER" as const, value: maxima.player },
    { label: "TIE" as const, value: maxima.tie },
  ].sort((left, right) => right.value - left.value)[0];
}
