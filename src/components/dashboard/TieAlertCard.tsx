import { ModuleToggleStrip } from "@/components/dashboard/ModuleToggleStrip";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { PremiumLock } from "@/components/ui-app/PremiumLock";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { buildTieCopy } from "@/lib/operationalCopy";
import { cn } from "@/lib/utils";
import type { ModuleToggles, Round, TieAlert } from "@/types/dashboard";
import type { PatternMinerSnapshot, PatternMinerStrategy } from "@/types/patternMiner";

const DEFAULT_TIE_MULTIPLIERS = [
  { label: "4x", value: 12 },
  { label: "6x", value: 4 },
  { label: "10x", value: 5 },
  { label: "25x", value: 1 },
  { label: "88x", value: 0 },
];

export function TieAlertCard({
  alert,
  rounds,
  patternMinerSnapshot,
  toggles,
  onModuleTogglesChange,
  locked,
  compact = false,
}: {
  alert: TieAlert;
  rounds?: Round[];
  patternMinerSnapshot?: PatternMinerSnapshot;
  toggles?: ModuleToggles;
  onModuleTogglesChange?: (toggles: ModuleToggles) => void;
  locked?: boolean;
  compact?: boolean;
}) {
  const enabled = toggles?.tieAlert !== false;
  const status = tieRadarStatus(alert);
  const multipliers = tieMultiplierStats(rounds);
  const tieNumber = bestTieNumber(rounds);
  const bestMultiplier = multipliers.reduce(
    (best, item) => (item.value > best.value ? item : best),
    multipliers[0],
  );
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
        className={cn("mb-2 flex items-center justify-between gap-3", compact && "mb-1.5 gap-1")}
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
            className={compact ? "px-2 text-[9px]" : undefined}
          >
            {status.badge}
          </AppBadge>
          <ModuleToggleStrip
            toggles={toggles}
            modules={["tieAlert"]}
            onChange={onModuleTogglesChange}
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
              {tieNumber ? `🟡 ${tieNumber.score} com ${tieNumber.count} Tie` : "Coletando"}
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
              {bestMultiplier
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

        {tiePattern ? (
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
              <MiniStat
                compact={compact}
                label="Acerto"
                value={formatPercent(tiePattern.assertiveness)}
              />
            </div>
          </div>
        ) : null}
      </div>

      {!enabled && (
        <div className="mt-2 rounded-lg border border-border/70 bg-secondary/25 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
          Radar de Empate desativado neste painel.
        </div>
      )}

      {locked && (
        <PremiumLock
          title="Radar de Empate Premium"
          description="Leitura estatistica de empate disponivel para assinantes"
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

function tieMultiplierStats(rounds: Round[] | undefined) {
  const counts = new Map(DEFAULT_TIE_MULTIPLIERS.map((item) => [item.label, 0]));
  for (const round of rounds ?? []) {
    if (round.result !== "T") continue;
    const multiplier = multiplierForTieRound(round);
    if (!multiplier) continue;
    const label = `${multiplier}x`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const hasLiveMultipliers = [...counts.values()].some((value) => value > 0);
  if (!hasLiveMultipliers) return DEFAULT_TIE_MULTIPLIERS;

  return DEFAULT_TIE_MULTIPLIERS.map((item) => ({
    label: item.label,
    value: counts.get(item.label) ?? 0,
  }));
}

function multiplierForTieRound(round: Round) {
  const explicit = normalizeMultiplier(round.tieMultiplier);
  if (explicit) return explicit;
  if (round.bankerScore !== round.playerScore) return null;

  const score = Math.round(Number(round.bankerScore));
  if (!Number.isFinite(score)) return null;
  if (score === 2 || score === 12) return 88;
  if (score === 3 || score === 11) return 25;
  if (score === 4 || score === 10) return 10;
  if (score === 5 || score === 9) return 6;
  if (score === 6 || score === 7 || score === 8) return 4;
  return null;
}

function normalizeMultiplier(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  return [4, 6, 10, 25, 88].includes(rounded) ? rounded : null;
}

function bestTieNumber(rounds: Round[] | undefined) {
  const counts = new Map<number, number>();
  for (const round of rounds ?? []) {
    if (round.result !== "T") continue;
    const score = round.bankerScore === round.playerScore ? round.bankerScore : null;
    if (!score) continue;
    counts.set(score, (counts.get(score) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([score, count]) => ({ score, count }))
    .sort((a, b) => b.count - a.count || b.score - a.score)[0];
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
