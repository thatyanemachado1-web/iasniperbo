import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
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
import type { ModuleToggles, Round, TieAlert, TieAlertScoreboard, TiePullerStat } from "@/types/dashboard";
import type { PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

const EMPTY_TIE_MULTIPLIERS = TIE_MULTIPLIER_LABELS.map((label) => ({ label, value: 0 }));

export function TieAlertCard({
  alert,
  scoreboard,
  rounds,
  patternMinerSnapshot,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
}: {
  alert: TieAlert;
  scoreboard?: TieAlertScoreboard;
  rounds?: Round[];
  patternMinerSnapshot?: PatternMinerSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
}) {
  const enabled = toggles?.tieAlert !== false;
  const multipliers = tieMultiplierStats(rounds, scoreboard);
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
          "digital-risk-card h-full min-h-[220px] border-warning/18 p-2 sm:p-2",
          view.borderClass,
          !enabled && "border-muted-foreground/20",
        )}
      >
        <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.03]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-warning/22 to-transparent" />
        <div className="mb-2 flex min-w-0 items-start justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neon-cyan/80">
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

        <div className={cn("space-y-2 transition duration-200", !enabled && "opacity-45 saturate-50")}>
          <div className={cn("rounded-xl border px-3 py-2.5 text-center", view.panelClass)}>
            <div className={cn("text-lg font-black uppercase leading-none", view.actionClass)}>{view.action}</div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {view.headline}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-center sm:grid-cols-3">
            <TieStatChip label="Força" value={`${alert.confidence}%`} tone={view.badgeTone === "green" ? "green" : "amber"} />
            <TieStatChip label="Validade" value={`${alert.validityRounds}r`} tone="muted" />
            <TieStatChip label="Nível" value={normalizeRiskLabel(alert.level)} tone={view.badgeTone === "green" ? "green" : "amber"} />
          </div>

          <div className="rounded-lg border border-warning/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
            <div className="font-black uppercase tracking-[0.08em] text-warning/85">Puxador · reseta 00:00 (BR)</div>
            <div className="mt-0.5 font-semibold text-foreground">
              {mainTiePuller ? tiePullerSummary(mainTiePuller) : "Coletando numeros puxadores"}
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1">
            {multipliers.map((item) => (
              <div key={item.label} className="rounded-md border border-warning/18 bg-warning/10 px-1 py-0.5 text-center">
                <div className="text-[8px] font-black text-warning">{item.label}</div>
                <div className="text-[10px] font-black">{item.value}</div>
              </div>
            ))}
          </div>
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
            <div className="font-semibold text-neon-purple">{alert.confidence}%</div>
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
              {mainTiePuller ? tiePullerSummary(mainTiePuller) : "Coletando"}
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
                ? `🟡 ${bestMultiplier.label} (${bestMultiplier.value})`
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
      headline: `Confirmado · Força ${alert.confidence}% · ${alert.validityRounds} rodadas`,
      actionClass: "text-success",
      panelClass: "border-success/35 bg-success/10",
      borderClass: "border-success/30",
    };
  }

  if (alert.status === "active" && (normalizeRisk(alert.level) === "ALTO" || alert.confidence >= 65)) {
    return {
      badge: "Tie forte",
      badgeTone: "amber" as const,
      action: "Possível Tie",
      headline: mainTiePuller
        ? `${tiePullerSummary(mainTiePuller)} · Validade ${alert.validityRounds}r`
        : `Pressão alta · Validade ${alert.validityRounds} rodadas`,
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
      headline: `Empate em observação · Força ${alert.confidence}%`,
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
        ? `Sem alerta ativo · Maior mult. ${bestMultiplier.label}`
        : "Sem alerta de empate ativo agora",
    actionClass: "text-muted-foreground",
    panelClass: "border-border/60 bg-secondary/20",
    borderClass: "border-border/50",
  };
}

function normalizeRiskLabel(level: TieAlert["level"]) {
  const risk = normalizeRisk(level);
  if (risk === "ALTO") return "ALTO";
  if (risk === "MEDIO") return "MÉDIO";
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
      label: "🟡 Tie pegou",
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
      label: "🟡 Possivel Tie",
      description: "So considerar entrada se a validade estiver aberta.",
      className: "text-warning",
    };
  }

  return {
    badge: "Em observacao",
    badgeTone: "amber" as const,
    label: "🟡 Observacao",
    description: "Empate sendo monitorado, sem confirmacao forte.",
    className: "text-warning",
  };
}

function tieMultiplierStats(rounds: Round[] | undefined, scoreboard?: TieAlertScoreboard) {
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
  return `${sideDot(item.side)} ${sideShortLabel(item.side)}${item.score} com ${item.ties} Tie`;
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
        <div className={cn("truncate font-black", sideTextClass(item.side))}>
          {sideDot(item.side)} {sideShortLabel(item.side)}{item.score}
          <span className="ml-1 text-warning">puxou {item.ties} Tie</span>
        </div>
        <div className="text-[9px] font-semibold text-muted-foreground">
          ate {item.window} casas · {item.samples} amostras
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

function sideDot(side: TiePullerStat["side"]) {
  if (side === "B") return "🔴";
  if (side === "P") return "🔵";
  return "🟡";
}

function sideShortLabel(side: TiePullerStat["side"]) {
  if (side === "B") return "B";
  if (side === "P") return "P";
  return "T";
}

function sideTextClass(side: TiePullerStat["side"]) {
  if (side === "B") return "text-destructive";
  if (side === "P") return "text-neon-blue";
  return "text-warning";
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
