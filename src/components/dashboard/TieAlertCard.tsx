import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import {
  DASHBOARD_MODULE_CARD_BODY,
  DASHBOARD_MODULE_CARD_FILL,
  DASHBOARD_MODULE_CARD_ROOT,
} from "@/components/dashboard/dashboardModuleCardLayout";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { buildTieCopy } from "@/lib/operationalCopy";
import { cn } from "@/lib/utils";
import {
  TIE_MULTIPLIER_LABELS,
  buildTiePullerStats,
  normalizeTieMultiplierCounts,
  tieMultiplierFromRound,
} from "@/tieRadar/TieRadarStatsEngine";
import type {
  ModuleToggles,
  Round,
  TieAlert,
  TieAlertScoreboard,
  TieHistoryEntry,
  TiePullerStat,
  TieRadarHistoryAnalysis,
} from "@/types/dashboard";
import type { PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

const EMPTY_TIE_MULTIPLIERS = TIE_MULTIPLIER_LABELS.map((label) => ({ label, value: 0 }));

export function TieAlertCard({
  alert,
  scoreboard,
  history,
  rounds,
  patternMinerSnapshot,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
  className,
}: {
  alert: TieAlert;
  scoreboard?: TieAlertScoreboard;
  history?: TieRadarHistoryAnalysis;
  rounds?: Round[];
  patternMinerSnapshot?: PatternMinerSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const enabled = toggles?.tieAlert !== false;
  const multipliers = tieMultiplierStats(rounds, scoreboard, history);
  const tiePullers = tiePullerStats(rounds, scoreboard);
  const mainTiePuller = tiePullers[0];
  const bestMultiplier = multipliers.reduce(
    (best, item) => (item.value > best.value ? item : best),
    multipliers[0],
  );
  const view = buildTieView(alert, mainTiePuller, bestMultiplier);

  if (compact) {
    return (
      <GlassCard
        className={cn(
          "digital-risk-card border-white/10 p-2 sm:p-2",
          DASHBOARD_MODULE_CARD_ROOT,
          view.borderClass,
          !enabled && "border-muted-foreground/20",
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Radar de Empate
          </div>
          <div className="flex max-w-[58%] shrink-0 flex-wrap items-center justify-end gap-1">
            <AppBadge
              tone={view.badgeTone}
              pulse={enabled && alert.status === "active"}
              className="max-w-full truncate px-1.5 py-0 text-[8px] tracking-[0.08em]"
            >
              {view.badge}
            </AppBadge>
            <ModuleToggleStrip toggles={toggles} modules={["tieAlert"]} onChange={onModuleTogglesChange} compact />
          </div>
        </div>

        <div className={cn(DASHBOARD_MODULE_CARD_BODY, "transition duration-200", !enabled && "opacity-45 saturate-50")}>
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
            <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>{view.action}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {view.headline}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
            <TieStatChip label="Forca" value={`${alert.confidence}%`} tone={view.badgeTone === "green" ? "green" : "amber"} />
            <TieStatChip label="Validade" value={`${alert.validityRounds}r`} tone="muted" />
            <TieStatChip label="Nivel" value={normalizeRiskLabel(alert.level)} tone={view.badgeTone === "green" ? "green" : "amber"} />
          </div>

          <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
            <div className="font-black uppercase tracking-[0.08em] text-muted-foreground">Puxador - reseta 00:00 (BR)</div>
            <div className="mt-0.5 font-semibold text-foreground">
              {mainTiePuller ? <TiePullerSummaryInline item={mainTiePuller} /> : "Coletando numeros puxadores"}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {multipliers.map((item) => (
              <div key={item.label} className="rounded-md border border-white/10 bg-secondary/20 px-1 py-0.5 text-center">
                <div className="text-[8px] font-black text-muted-foreground">{item.label}</div>
                <div className="text-[10px] font-black">{item.value}</div>
              </div>
            ))}
          </div>

          <TieHighPressurePanel history={history} compact />
          <TieRecentHistoryList history={history} compact />
          <div className={DASHBOARD_MODULE_CARD_FILL} aria-hidden />
        </div>

        {!enabled && <DisabledTieNote />}
        {locked && (
          <PremiumLock
            title="Radar de Empate Premium"
            description="Leitura estatistica de empate disponivel para assinantes"
          />
        )}
      </GlassCard>
    );
  }

  const status = tieRadarStatus(alert);
  const tiePattern = bestTiePattern(patternMinerSnapshot);

  return (
    <GlassCard
      className={cn(
        "digital-risk-card border-warning/18 p-3 sm:p-3",
        compact && "h-full p-2 sm:p-2",
        !enabled && "border-muted-foreground/20",
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/22 to-transparent" />
      <div
        className={cn(
          "mb-2 flex items-center justify-between gap-3",
          compact && "mb-2 min-h-[58px] items-start gap-1.5",
        )}
      >
        <div
          className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80",
            compact && "max-w-[94px] text-[9px] leading-tight tracking-[0.16em]",
          )}
        >
          Radar de Empate
        </div>
        <div className={cn("flex shrink-0 items-center gap-1.5", compact && "gap-1")}>
          <AppBadge
            tone={status.badgeTone}
            pulse={enabled && alert.status === "active"}
            className={compact ? "max-w-[82px] truncate px-1.5 py-0 text-[8px] tracking-[0.08em]" : undefined}
          >
            {status.badge}
          </AppBadge>
          <ModuleToggleStrip
            toggles={toggles}
            modules={["tieAlert"]}
            onChange={onModuleTogglesChange}
            compact={compact}
          />
        </div>
      </div>

      <div className={cn("transition duration-200", !enabled && "opacity-45 saturate-50")}>
        <div
          className={cn(
            "grid gap-2 sm:grid-cols-[minmax(160px,0.45fr)_minmax(0,1fr)] sm:items-stretch",
            compact && "gap-1.5 sm:grid-cols-1",
          )}
        >
          <div
            className={cn(
              "rounded-xl border border-warning/12 bg-background/24 px-3 py-2",
              compact && "px-2.5 py-1.5",
            )}
          >
            <div
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground",
                compact && "text-[9px]",
              )}
            >
              Agora
            </div>
            <div
              className={cn("mt-1 text-xl font-extrabold", compact && "text-lg", status.className)}
            >
              {status.label}
            </div>
            <div
              className={cn(
                "mt-1 text-[11px] text-muted-foreground",
                compact && "text-[10px] leading-snug",
              )}
            >
              {status.description}
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl border border-warning/12 bg-background/24 px-3 py-2",
              compact && "px-2.5 py-1.5",
            )}
          >
            <div
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground",
                compact && "text-[9px]",
              )}
            >
              Multiplicadores pegos
            </div>
            <div className={cn("mt-2 grid grid-cols-5 gap-1.5", compact && "mt-1.5 gap-1")}>
              {multipliers.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-lg border border-warning/18 bg-warning/10 px-1.5 py-1 text-center",
                    compact && "rounded-md px-1 py-0.5",
                  )}
                >
                  <div
                    className={cn("text-[10px] font-black text-warning", compact && "text-[9px]")}
                  >
                    {item.label}
                  </div>
                  <div className={cn("text-sm font-black text-foreground", compact && "text-xs")}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <details className="group mt-2 rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver mais &mdash; relat&oacute;rio e hist&oacute;rico</span>
            <span className="transition-transform group-open:rotate-180" aria-hidden="true">&#8964;</span>
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
        <div
          className={cn(
            "mt-2 grid grid-cols-3 gap-2 text-[11px]",
            compact && "mt-1.5 gap-1 text-[10px]",
          )}
        >
          <div
            className={cn(
              "rounded-xl border border-white/5 bg-secondary/20 px-2 py-1.5",
              compact && "px-1.5 py-1",
            )}
          >
            <div className="text-muted-foreground">Forca</div>
            <div className="font-semibold text-tie">{alert.confidence}%</div>
          </div>
          <div
            className={cn(
              "rounded-xl border border-white/5 bg-secondary/20 px-2 py-1.5",
              compact && "px-1.5 py-1",
            )}
          >
            <div className="text-muted-foreground">Validade</div>
            <div className="font-semibold">{alert.validityRounds} rodadas</div>
          </div>
          <div
            className={cn(
              "rounded-xl border border-white/5 bg-secondary/20 px-2 py-1.5",
              compact && "px-1.5 py-1",
            )}
          >
            <div className="text-muted-foreground">Status</div>
            <div
              className={`font-semibold ${alert.status === "expired" ? "text-muted-foreground" : "text-warning"}`}
            >
              {tieStatusLabel(alert.status)}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 grid gap-2 text-[11px] sm:grid-cols-2",
            compact && "mt-1.5 gap-1.5 text-[10px] sm:grid-cols-1",
          )}
        >
          <div
            className={cn(
              "rounded-xl border border-warning/12 bg-background/24 px-3 py-2",
              compact && "px-2.5 py-1.5",
            )}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              Numero puxando Tie
            </div>
            <div className={cn("mt-1 font-black text-warning", compact && "mt-0.5")}>
              {mainTiePuller ? <TiePullerSummaryInline item={mainTiePuller} /> : "Coletando"}
            </div>
          </div>
          <div
            className={cn(
              "rounded-xl border border-warning/12 bg-background/24 px-3 py-2",
              compact && "px-2.5 py-1.5",
            )}
          >
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
              Empate especifico
            </div>
            <div className={cn("mt-1 font-black text-warning", compact && "mt-0.5")}>
              {bestMultiplier?.value > 0
                ? `${bestMultiplier.label} (${bestMultiplier.value})`
                : "Coletando"}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 rounded-xl border border-warning/12 bg-background/24 px-3 py-2 text-[11px] leading-relaxed text-foreground/82",
            compact && "mt-1.5 px-2.5 py-1.5 text-[10px] leading-snug",
          )}
        >
          {buildTieCopy(alert)}
        </div>

        <TieHighPressurePanel history={history} compact={compact} />
        <TieRecentHistoryList history={history} compact={compact} />

        {tiePullers.length ? (
          <div
            className={cn(
              "mt-2 rounded-xl border border-warning/18 bg-warning/10 px-3 py-2 text-[11px]",
              compact && "mt-1.5 px-2.5 py-1.5 text-[10px]",
            )}
          >
            <div
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.12em] text-warning",
                compact && "text-[9px]",
              )}
            >
              Numeros puxando Tie ate 7 casas
            </div>
            <div className="mt-1 space-y-1">
              {tiePullers.slice(0, compact ? 3 : 5).map((item) => (
                <TiePullerLine key={item.key} item={item} compact={compact} />
              ))}
            </div>
          </div>
        ) : tiePattern ? (
          <div
            className={cn(
              "mt-2 rounded-xl border border-warning/18 bg-warning/10 px-3 py-2 text-[11px]",
              compact && "mt-1.5 px-2.5 py-1.5 text-[10px]",
            )}
          >
            <div
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.12em] text-warning",
                compact && "text-[9px]",
              )}
            >
              Padrao IA para Tie
            </div>
            <div className={cn("mt-1", compact && "origin-left scale-[0.9]")}>
              <PatternSequence sequence={tiePattern.sequence} compact />
            </div>
            <div className={cn("mt-1 grid grid-cols-3 gap-1.5", compact && "gap-1")}>
              <MiniStat compact={compact} label="Puxou Tie" value={tiePattern.tie} />
              <MiniStat compact={compact} label="Amostras" value={tiePattern.totalValidated} />
              <MiniStat compact={compact} label="Acerto" value={formatPercent(tiePattern.assertiveness)} />
            </div>
          </div>
        ) : null}
          </div>
        </details>
      </div>

      {!enabled && <DisabledTieNote />}

      {locked && (
        <PremiumLock
          title="Radar de Empate Premium"
          description="Leitura estatistica de empate disponivel para assinantes"
        />
      )}
    </GlassCard>
  );
}

function DisabledTieNote() {
  return (
    <div className="mt-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
      Radar de Empate desativado neste painel.
    </div>
  );
}

function TieHighPressurePanel({
  history,
  compact = false,
}: {
  history?: TieRadarHistoryAnalysis;
  compact?: boolean;
}) {
  const high = history?.high;
  const pressure = high?.pressure ?? "baixa";
  const pressureClass = tiePressureClass(pressure);

  return (
    <div
      className={cn(
        "rounded-lg border border-warning/14 bg-background/24 px-2 py-1.5 text-[9px]",
        !compact && "mt-2 rounded-xl px-3 py-2 text-[11px]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-black uppercase tracking-[0.1em] text-warning">Empates Altos</div>
        <div className={cn("rounded-full border px-1.5 py-0.5 text-[8px] font-black uppercase", pressureClass)}>
          {pressure}
        </div>
      </div>
      <div className={cn("mt-1 grid grid-cols-2 gap-1", !compact && "mt-1.5 gap-1.5")}>
        <TieInfoLine label="Ultimo 88x" value={formatTieClock(high?.last88At)} tone="warning" />
        <TieInfoLine label="Ultimo 25x" value={formatTieClock(high?.last25At)} tone="tie" />
        <TieInfoLine label="Media 88" value={formatDuration(high?.average88IntervalMinutes)} tone="muted" />
        <TieInfoLine label="Tempo 88" value={formatDuration(high?.sinceLast88Minutes)} tone="warning" />
        <TieInfoLine label="Media 25" value={formatDuration(high?.average25IntervalMinutes)} tone="muted" />
        <TieInfoLine label="Prev. 88" value={formatTieClock(high?.estimatedNext88At)} tone="muted" />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-white/5 pt-1 text-[8px] font-semibold text-muted-foreground">
        <span>Dia {history?.daily?.totalTies ?? 0} ties</span>
        <span>Mes {history?.monthly?.totalTies ?? 0} ties</span>
        <span>Hora {history?.daily?.mostFrequentHour ?? "--"}</span>
      </div>
    </div>
  );
}

function TieRecentHistoryList({
  history,
  compact = false,
}: {
  history?: TieRadarHistoryAnalysis;
  compact?: boolean;
}) {
  const recent = history?.recent?.slice(0, 50) ?? [];

  return (
    <div
      className={cn(
        "rounded-lg border border-white/10 bg-background/18 px-2 py-1.5 text-[9px]",
        !compact && "mt-2 rounded-xl px-3 py-2 text-[11px]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-black uppercase tracking-[0.1em] text-muted-foreground">Historico de Empates</div>
        <div className="text-[8px] font-black text-warning">{recent.length}/50</div>
      </div>
      {recent.length ? (
        <div className={cn("mt-1 max-h-[74px] space-y-1 overflow-y-auto pr-1", !compact && "max-h-28")}>
          {recent.map((entry) => (
            <TieRecentHistoryLine key={entry.id} entry={entry} />
          ))}
        </div>
      ) : (
        <div className="mt-1 rounded-md border border-white/5 bg-secondary/15 px-2 py-1 text-muted-foreground">
          Aguardando empate real da mesa.
        </div>
      )}
    </div>
  );
}

function TieInfoLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "warning" | "tie" | "muted";
}) {
  const toneClass = {
    warning: "text-warning",
    tie: "text-tie",
    muted: "text-foreground",
  }[tone];

  return (
    <div className="min-w-0 rounded-md border border-white/5 bg-secondary/15 px-1.5 py-1">
      <div className="truncate text-[8px] font-black uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className={cn("truncate text-[10px] font-black leading-tight", toneClass)}>{value}</div>
    </div>
  );
}

function TieRecentHistoryLine({ entry }: { entry: TieHistoryEntry }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-secondary/15 px-1.5 py-0.5">
      <div className="min-w-0 truncate font-black text-foreground">{entry.hour}</div>
      <div className={cn("shrink-0 font-black", tieMultiplierTextClass(entry.multiplierLabel))}>
        {entry.multiplierLabel}
      </div>
      <div className="min-w-0 truncate text-right text-[8px] font-semibold text-muted-foreground">
        #{entry.roundId}
      </div>
    </div>
  );
}

function tiePressureClass(pressure: TieRadarHistoryAnalysis["high"]["pressure"]) {
  if (pressure === "alta") return "border-warning/35 bg-warning/12 text-warning";
  if (pressure === "moderada") return "border-tie/35 bg-tie/12 text-tie";
  return "border-border/60 bg-secondary/25 text-muted-foreground";
}

function tieMultiplierTextClass(label: string) {
  if (label === "88x") return "text-warning";
  if (label === "25x") return "text-tie";
  if (label === "10x") return "text-neon-cyan";
  return "text-muted-foreground";
}

function formatTieClock(value: string | null | undefined) {
  if (!value) return "--";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDuration(value: number | null | undefined) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "--";
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function TieStatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "amber" | "muted";
}) {
  const toneClass = {
    green: "border-success/30 bg-success/8 text-success",
    amber: "border-warning/30 bg-warning/8 text-warning",
    muted: "border-border/60 bg-secondary/25 text-foreground",
  }[tone];

  return (
    <div className={cn("rounded-lg border px-1 py-1.5", toneClass)}>
      <div className="text-[8px] font-black uppercase tracking-[0.08em] opacity-75">{label}</div>
      <div className="mt-0.5 text-[11px] font-black leading-none">{value}</div>
    </div>
  );
}

function buildTieView(
  alert: TieAlert,
  mainTiePuller: TiePullerStat | undefined,
  bestMultiplier: { label: string; value: number },
) {
  if (alert.status === "green") {
    return {
      badge: "Tie green",
      badgeTone: "green" as const,
      action: "Tie pegou",
      headline: `Confirmado - Forca ${alert.confidence}% - ${alert.validityRounds} rodadas`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
    };
  }

  if (alert.status === "active" && (normalizeRisk(alert.level) === "ALTO" || alert.confidence >= 65)) {
    return {
      badge: "Tie forte",
      badgeTone: "amber" as const,
      action: "Possivel Tie",
      headline: mainTiePuller
        ? `${tiePullerSummary(mainTiePuller)} - Validade ${alert.validityRounds}r`
        : `Pressao alta - Validade ${alert.validityRounds} rodadas`,
      actionClass: "text-warning",
      panelClass: "border-warning/35 bg-warning/10",
      borderClass: "border-warning/30",
    };
  }

  if (alert.status === "active") {
    return {
      badge: "Em observacao",
      badgeTone: "amber" as const,
      action: "Monitorar",
      headline: `Empate em observacao - Forca ${alert.confidence}%`,
      actionClass: "text-warning",
      panelClass: "border-warning/25 bg-warning/8",
      borderClass: "border-warning/20",
    };
  }

  return {
    badge: "Observando",
    badgeTone: "muted" as const,
    action: "Aguardar",
    headline:
      bestMultiplier.value > 0
        ? `Sem alerta ativo - Maior mult. ${bestMultiplier.label}`
        : "Sem alerta de empate ativo agora",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
  };
}

function normalizeRiskLabel(level: TieAlert["level"]) {
  const risk = normalizeRisk(level);
  if (risk === "ALTO") return "ALTO";
  if (risk === "MEDIO") return "MEDIO";
  return "BAIXO";
}

function tieStatusLabel(status: TieAlert["status"]) {
  if (status === "green") return "Green";
  if (status === "expired") return "Expirado";
  return "Ativo";
}

function tieRadarStatus(alert: TieAlert) {
  if (alert.status === "green") {
    return {
      badge: "Tie green",
      badgeTone: "green" as const,
      label: "Tie pegou",
      description: "Empate confirmado dentro da validade.",
      className: "text-success",
    };
  }

  if (alert.status === "expired") {
    return {
      badge: "Observando",
      badgeTone: "muted" as const,
      label: "Aguardando",
      description: "Sem entrada de empate ativa agora.",
      className: "text-muted-foreground",
    };
  }

  const high = normalizeRisk(alert.level) === "ALTO" || alert.confidence >= 75;
  if (high) {
    return {
      badge: "Tie forte",
      badgeTone: "amber" as const,
      label: "Possivel Tie",
      description: "So considerar entrada se a validade estiver aberta.",
      className: "text-warning",
    };
  }

  return {
    badge: "Em observacao",
    badgeTone: "amber" as const,
    label: "Observacao",
    description: "Empate sendo monitorado, sem confirmacao forte.",
    className: "text-warning",
  };
}

function tieMultiplierStats(
  rounds: Round[] | undefined,
  scoreboard?: TieAlertScoreboard,
  history?: TieRadarHistoryAnalysis,
) {
  if (history?.daily?.counts) {
    const counts = normalizeTieMultiplierCounts(history.daily.counts);
    return TIE_MULTIPLIER_LABELS.map((label) => ({ label, value: counts[label] }));
  }

  if (scoreboard?.multipliers) {
    const counts = normalizeTieMultiplierCounts(scoreboard.multipliers);
    return TIE_MULTIPLIER_LABELS.map((label) => ({ label, value: counts[label] }));
  }

  const counts = normalizeTieMultiplierCounts();
  for (const round of rounds ?? []) {
    if (round.result !== "T") continue;
    const multiplier = tieMultiplierFromRound(round);
    if (!multiplier) continue;
    const label = `${multiplier}x` as (typeof TIE_MULTIPLIER_LABELS)[number];
    if (!TIE_MULTIPLIER_LABELS.includes(label)) continue;
    counts[label] += 1;
  }

  return EMPTY_TIE_MULTIPLIERS.map((item) => ({
    label: item.label,
    value: counts[item.label],
  }));
}

function tiePullerStats(rounds: Round[] | undefined, scoreboard?: TieAlertScoreboard) {
  if (scoreboard?.tiePullers?.length) return scoreboard.tiePullers;
  return buildTiePullerStats(rounds, 7, 5);
}

function tiePullerSummary(item: TiePullerStat) {
  return `${sideLabel(item.side)} ${item.score} com ${item.ties} Tie`;
}

function TiePullerLine({ item, compact = false }: { item: TiePullerStat; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-warning/12 bg-background/25 px-2 py-1",
        compact && "gap-1 px-1.5 py-0.5",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 font-black">
          <SideNumber side={item.side} value={item.score} />
          <span className="min-w-0 truncate text-warning">puxou {item.ties} Tie</span>
        </div>
        <div className="text-[9px] font-semibold text-muted-foreground">
          ate {item.window} casas - {item.samples} amostras
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] font-black text-neon-cyan">{formatPercent(item.hitRate)}</div>
        {item.lastDistance ? (
          <div className="text-[8px] font-semibold text-muted-foreground">ult. {item.lastDistance}c</div>
        ) : null}
      </div>
    </div>
  );
}

function TiePullerSummaryInline({ item }: { item: TiePullerStat }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <SideNumber side={item.side} value={item.score} />
      <span className="truncate">
        <span className={sideTextClass(item.side)}>com {item.ties}</span>{" "}
        <span className="text-warning">Tie</span>
      </span>
    </span>
  );
}

function SideNumber({ side, value }: { side: TiePullerStat["side"]; value: number }) {
  return (
    <span
      className={cn(
        "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-black leading-none",
        sideDotClass(side),
      )}
      title={`${sideLabel(side)} ${value}`}
    >
      {value}
    </span>
  );
}

function sideLabel(side: TiePullerStat["side"]) {
  if (side === "B") return "Banker";
  if (side === "P") return "Player";
  return "Tie";
}

function sideDotClass(side: TiePullerStat["side"]) {
  if (side === "B") return "border-banker/60 bg-banker text-white shadow-[0_0_14px_-6px_var(--banker)]";
  if (side === "P") return "border-player/60 bg-player text-white shadow-[0_0_14px_-6px_var(--player)]";
  return "border-tie/70 bg-tie text-background shadow-[0_0_14px_-6px_var(--tie)]";
}

function sideTextClass(side: TiePullerStat["side"]) {
  if (side === "B") return "text-banker";
  if (side === "P") return "text-player";
  return "text-tie";
}

function normalizeRisk(level: TieAlert["level"]) {
  const text = String(level)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (text.includes("ALTO")) return "ALTO";
  if (text.includes("MED")) return "MEDIO";
  return "BAIXO";
}

function bestTiePattern(snapshot?: PatternMinerSnapshot) {
  const strategies = [
    ...(snapshot?.hotStrategies ?? []),
    ...(snapshot?.ranking ?? []),
    ...(snapshot?.strategies ?? []),
  ];
  const unique = new Map<string, PatternMinerStrategy>();
  for (const strategy of strategies) unique.set(strategy.id, strategy);

  return [...unique.values()]
    .filter((strategy) => strategy.totalValidated > 0)
    .filter((strategy) => strategy.expectedResult === "T" || strategy.tie >= 2)
    .sort((a, b) => tiePatternScore(b) - tiePatternScore(a))[0];
}

function tiePatternScore(strategy: PatternMinerStrategy) {
  const tieWeight = strategy.expectedResult === "T" ? 50 : 0;
  const hotWeight = strategy.status === "VERY_HOT" ? 30 : strategy.status === "HOT" ? 20 : 0;
  return (
    tieWeight +
    hotWeight +
    strategy.tie * 6 +
    (strategy.assertiveness ?? 0) +
    strategy.totalValidated / 10
  );
}

function MiniStat({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-white/5 bg-background/30 px-2 py-1",
        compact && "px-1.5 py-1",
      )}
    >
      <div className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("font-black text-foreground", compact && "text-[10px]")}>{value}</div>
    </div>
  );
}

function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return "Sem amostra";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
