import { AppBadge } from "@/components/ui-app/AppBadge";
import type { BacBoResult } from "@/components/dashboard/BacBoBeadPlate";
import type { Round } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  LATERAL_TIE_TEMPLATES,
  buildLateralTieTimeline,
  getTieLateralRiskState,
  isLateralPatternBlocked,
  scoreLateralTieTemplate as templateScore,
  type LateralTieFormation,
  type LateralTieHistoryEntry,
  type LateralTieTemplate,
} from "@/utils/lateralMotors";

type Template = LateralTieTemplate;
type Formation = LateralTieFormation;
type TieEntry = LateralTieHistoryEntry;

const ALL_TEMPLATES: readonly Template[] = LATERAL_TIE_TEMPLATES;

export function LateralTiePatternCard({
  results,
  rounds,
}: {
  results: BacBoResult[];
  rounds: Round[];
}) {
  const cycle = attachTieRoundMetadata(results.slice(-200), rounds);
  const timeline = buildLateralTieTimeline(cycle);
  const fullHistory = timeline.history;
  const active = timeline.active;
  const activeStats = active ? templateScore(fullHistory, active.formation.template.id) : null;
  const tieRisk = getTieLateralRiskState(activeStats?.reds);
  const dryTieRisk = Boolean(active && tieRisk.dryTieRisk);
  const horizontalTieRisk = Boolean(active?.formation.template.horizontalFifthHouse);
  const warningActive = dryTieRisk || horizontalTieRisk;
  const history = fullHistory.slice(-30).reverse();
  const tieCount = history.filter((item) => item.result === "TIE").length;
  const reds = history.filter((item) => item.result === "RED").length;
  const resolved = tieCount + reds;
  const strength = resolved ? Math.round((tieCount / resolved) * 100) : 0;
  const riskTemplates = ALL_TEMPLATES.filter((template) =>
    isLateralPatternBlocked(templateScore(fullHistory, template.id).reds),
  ).length;
  const riskStrength =
    activeStats && activeStats.resolved
      ? Math.round((activeStats.ties / activeStats.resolved) * 100)
      : 0;
  const visibleStrength = dryTieRisk ? riskStrength : strength;
  const latestFormation = active?.formation ?? timeline.latestFormation;

  return (
    <section
      className={cn(
        "relative h-full min-w-0 overflow-hidden rounded-xl border bg-background/35 p-1.5 sm:p-2.5",
        warningActive ? "border-amber-400/55" : active ? "border-tie/40" : "border-white/10",
      )}
    >
      <div className="pointer-events-none absolute inset-0 scan-grid opacity-[0.025]" />
      <div className="relative mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">
            Motor de empate
          </div>
          <div className="text-[8px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Lateral • diagonal • espaçado • horizontal
          </div>
        </div>
        <div aria-live="polite">
          <AppBadge
            tone={active ? "amber" : "muted"}
            pulse={Boolean(active)}
            className="px-1.5 py-0 text-[8px]"
          >
            {horizontalTieRisk
              ? "⚠️ RISCO EMPATE"
              : dryTieRisk
                ? "⚠️ RISCO SECO"
                : active
                  ? active.attempt
                  : "Procurando"}
          </AppBadge>
        </div>
      </div>

      <div className="relative space-y-2">
        {active ? (
          <div
            className={cn(
              "rounded-xl border px-3 py-2.5 text-center",
              warningActive ? "border-amber-400/55 bg-amber-400/10" : "border-tie/40 bg-tie/10",
            )}
            role={warningActive ? "status" : undefined}
          >
            <div
              className={cn(
                "text-[11px] font-black uppercase leading-tight sm:text-lg sm:leading-none",
                warningActive ? "text-amber-300" : "text-tie",
              )}
            >
              {horizontalTieRisk
                ? active.attempt === "G1"
                  ? "Risco de empate • G1"
                  : "Risco de empate"
                : dryTieRisk
                  ? "Risco de empate seco"
                  : active.attempt === "G1"
                    ? "Aguardando G1 Empate"
                    : "Entrada Empate"}
            </div>
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.06em]">
              {horizontalTieRisk
                ? active.attempt === "G1"
                  ? "SG não pagou • proteção EMPATE no G1"
                  : "5ª casa alinhada • entrada EMPATE liberada até G1"
                : dryTieRisk
                  ? "Formação com 2 REDs • entrada EMPATE liberada até G1"
                  : `Empate • até G1 • ${strength || 100}% na amostra atual`}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-secondary/20 px-3 py-2.5 text-center">
            <div className="text-[11px] font-black uppercase leading-tight text-muted-foreground sm:text-lg sm:leading-none">
              Aguardar
            </div>
            <div className="mt-1 text-[7px] font-semibold uppercase tracking-[0.03em] text-muted-foreground sm:text-[9px] sm:tracking-[0.06em]">
              Procurando formação de empate
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <TieStat
            label="Força"
            value={active || resolved ? `${visibleStrength}%` : "--"}
            tone={active}
            warning={warningActive}
          />
          <TieStat
            label="Padrão"
            value={
              latestFormation
                ? `${latestFormation.firstValue}-${latestFormation.secondValue ?? "?"}`
                : "--"
            }
            tone={active}
            warning={warningActive}
          />
          <TieStat label="Validade" value="G1" />
        </div>

        <details className="group rounded-lg border border-white/10 bg-background/20">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2 py-2 text-[8px] font-black uppercase tracking-[0.08em] text-neon-cyan marker:content-none [&::-webkit-details-marker]:hidden">
            <span>Ver mais — resultados e análise</span>
            <span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-2 border-t border-white/10 p-2">
        <Info title="Placar do ciclo - reseta em 200">
          EMP {tieCount} - RD {reds} - {strength}%
        </Info>

        {active ? (
          <Info title={warningActive ? "Risco ativo" : "Leitura ativa"}>
            <TiePair formation={active.formation} /> -{" "}
            {horizontalTieRisk
              ? "quinta casa alinhada, puxando"
              : dryTieRisk
                ? "risco seco, mantendo"
                : "puxando"}{" "}
            <span className="font-black text-tie">EMPATE</span> - {active.attempt}
          </Info>
        ) : null}

        {latestFormation ? (
          <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black uppercase tracking-[0.08em] text-muted-foreground">
                Origem técnica
              </span>
              <span className="text-tie">Formação de empate</span>
            </div>
            <div className="mt-1">
              <TiePair formation={latestFormation} /> <b>{latestFormation.template.label}</b>
            </div>
            <div className="mt-0.5 flex justify-between gap-2">
              <span>
                Puxou: <b className="text-tie">EMPATE</b>
              </span>
              <span>{latestFormation.template.geometry}</span>
            </div>
            <div className="mt-0.5 flex justify-between gap-2 text-muted-foreground">
              <span>Formações: {ALL_TEMPLATES.length}</span>
              <span>Validade: G1</span>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[9px] text-muted-foreground">
          Entrada oficial:{" "}
          <span
            className={
              active ? (warningActive ? "font-black text-amber-300" : "font-black text-tie") : ""
            }
          >
            {active ? "EMPATE" : "aguardando"}
          </span>
        </div>

        <details className="rounded-lg border border-white/10 bg-background/20 px-2 py-1.5 text-[8px]">
          <summary className="relative cursor-pointer pr-[42px] font-black uppercase tracking-[0.08em] text-muted-foreground sm:pr-[88px]">
            Entradas / resultados
            <span className="absolute right-0 top-0 whitespace-nowrap">
              <span className="sr-only">{cycle.length}/200 no ciclo</span>
              <span aria-hidden="true" className="sm:hidden">
                {cycle.length}/200
              </span>
              <span aria-hidden="true" className="hidden sm:inline">
                {cycle.length}/200 no ciclo
              </span>
            </span>
          </summary>
          <div className="mt-1.5 w-full min-w-0 max-h-24 space-y-1 overflow-y-auto">
            {history.length ? (
              history.map((item) => <TieHistoryRow key={item.id} item={item} />)
            ) : (
              <div className="py-2 text-center text-muted-foreground">
                Sem entradas resolvidas neste ciclo
              </div>
            )}
          </div>
        </details>

        <div className="text-[8px] text-muted-foreground">
          {riskTemplates} de {ALL_TEMPLATES.length} formações em risco seco após 2 REDs. Entrada de
          empate permanece liberada.
        </div>
          </div>
        </details>
      </div>
    </section>
  );
}

function attachTieRoundMetadata(results: BacBoResult[], rounds: Round[]) {
  if (!rounds.length) return results;
  const roundMap = new Map(rounds.map((round) => [String(round.id), round]));
  return results.map((result) => {
    const round = roundMap.get(String(result.id));
    if (!round) return result;
    return {
      ...result,
      time: result.time ?? round.time ?? null,
      tieMultiplier: result.tieMultiplier ?? round.tieMultiplier ?? null,
    };
  });
}

function TieHistoryRow({ item }: { item: TieEntry }) {
  const label =
    item.result === "TIE" ? `EMPATE ${item.multiplier ? `${item.multiplier}X` : ""}`.trim() : "RED";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded border px-2 py-1 font-black",
        item.result === "TIE"
          ? "border-amber-400/25 text-amber-300"
          : "border-red-400/25 text-red-400",
      )}
    >
      <span>{label}</span>
      {item.time ? <span className="font-semibold text-muted-foreground">{item.time}</span> : null}
    </div>
  );
}

function TieStat({
  label,
  value,
  tone,
  warning,
}: {
  label: string;
  value: string;
  tone?: unknown;
  warning?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border bg-background/30 px-1 py-1.5 sm:px-2 sm:py-2",
        warning ? "border-amber-400/40" : tone ? "border-tie/35" : "border-white/10",
      )}
    >
      <div className="truncate text-[6px] font-black uppercase text-muted-foreground sm:text-[8px]">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-[10px] font-black sm:text-sm",
          warning ? "text-amber-300" : Boolean(tone) && "text-tie",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function TiePair({ formation }: { formation: Formation }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <TieToken value={formation.firstValue} />
      <span>→</span>
      <TieToken value={formation.secondValue ?? "?"} />
    </span>
  );
}
function TieToken({ value }: { value: number | string }) {
  return (
    <span className="inline-flex size-5 items-center justify-center rounded-full bg-tie text-[10px] font-black text-background">
      {value}
    </span>
  );
}
function Info({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 break-words rounded-lg border border-white/10 bg-background/20 px-1.5 py-1.5 text-[7px] sm:px-2 sm:text-[9px]">
      <div className="font-black uppercase tracking-[0.04em] text-muted-foreground sm:tracking-[0.08em]">
        {title}
      </div>
      <div className="mt-0.5 font-semibold text-foreground">{children}</div>
    </div>
  );
}
