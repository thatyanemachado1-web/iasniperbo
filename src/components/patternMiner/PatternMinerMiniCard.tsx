import { Link } from "@tanstack/react-router";
import { BrainCircuit, ChevronRight, Flame } from "lucide-react";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { PatternSequence } from "@/components/patternMiner/PatternSequence";
import { cn } from "@/lib/utils";
import {
  formatPercent,
  formatPulledSide,
  statusLabel,
  statusTone,
} from "@/patternMiner/PatternMinerDisplay";
import type {
  PatternMinerAlert,
  PatternMinerScoreboard,
  PatternMinerSnapshot,
  PatternMinerStrategy,
} from "@/types/patternMiner";

export function PatternMinerMiniCard({
  snapshot,
  isUsingRealData,
}: {
  snapshot: PatternMinerSnapshot;
  isUsingRealData: boolean;
}) {
  const confirmedAlert = snapshot.entryAlerts[0];
  const confirmedPattern = confirmedAlert?.strategy;
  const fallbackPattern = snapshot.hotStrategies[0] ?? snapshot.ranking[0];
  const currentPattern = confirmedPattern ?? fallbackPattern;
  const hasGeneralData = isUsingRealData && snapshot.scoreboard.totalValidated > 0;
  const hasPatternData =
    isUsingRealData && Boolean(currentPattern) && (currentPattern?.totalValidated ?? 0) > 0;
  const formingAlerts = snapshot.formingAlerts.slice(0, 2);

  return (
    <GlassCard className="h-full rounded-xl border-neon-cyan/35 p-3">
      <div className="flex h-full min-w-0 flex-col gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl btn-primary-grad glow-blue">
            <BrainCircuit className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black">Padrão Quente Detectado</div>
            {!isUsingRealData ? (
              <div className="mt-1 text-[10px] leading-snug text-warning">
                Aguardando histórico real da plataforma.
              </div>
            ) : confirmedPattern ? (
              <ConfirmedPatternBlock alert={confirmedAlert} />
            ) : (
              <div className="mt-1 rounded-xl border border-neon-cyan/12 bg-background/25 px-2.5 py-2 text-[10px] leading-snug text-muted-foreground">
                Aguardando padrão confirmado. Em formação aparece abaixo quando a sequência estiver
                perto.
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-1.5">
          <PatternScoreLine title="Geral" data={hasGeneralData ? snapshot.scoreboard : null} />
          <PatternScoreLine
            title="Atual"
            data={hasPatternData && currentPattern ? currentPattern : null}
          />
        </div>

        <div className="rounded-xl border border-neon-cyan/12 bg-background/20 px-2 py-1.5">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.14em] text-neon-cyan">
              Em formação
            </span>
            <span className="text-[9px] font-semibold text-muted-foreground">
              {formingAlerts.length ? `${formingAlerts.length} perto` : "coletando"}
            </span>
          </div>
          {formingAlerts.length ? (
            <div className="space-y-1">
              {formingAlerts.map((alert) => (
                <FormationMiniRow key={alert.id} alert={alert} />
              ))}
            </div>
          ) : (
            <div className="text-[10px] leading-snug text-muted-foreground">
              Nenhum padrão quente em formação neste momento.
            </div>
          )}
        </div>

        <Link
          to="/app/padroes"
          className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-neon-cyan hover:text-neon-blue"
        >
          Ver detalhes <ChevronRight className="size-3" />
        </Link>
      </div>
    </GlassCard>
  );
}

function ConfirmedPatternBlock({ alert }: { alert: PatternMinerAlert }) {
  const strategy = alert.strategy;

  return (
    <div className="mt-1 rounded-xl border border-success/20 bg-success/10 px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-success">
          Padrão confirmado
        </span>
        <AppBadge tone={statusTone(strategy.status)} className="px-2 text-[8px]">
          {statusLabel(strategy.status)}
        </AppBadge>
      </div>
      <div className="min-w-0">
        <PatternSequence sequence={strategy.sequence} compact />
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
        <span className="text-muted-foreground">Entrada:</span>
        {strategy.expectedResult ? (
          <span className="font-black">{formatPulledSide(strategy.expectedResult)}</span>
        ) : (
          <span className="text-warning">amostra insuficiente</span>
        )}
        <span className="text-neon-cyan">{formatPercent(strategy.assertiveness)}</span>
      </div>
    </div>
  );
}

function FormationMiniRow({ alert }: { alert: PatternMinerAlert }) {
  const strategy = alert.strategy;
  const progress = Math.round(alert.progress * 100);

  return (
    <div className="rounded-lg border border-white/5 bg-secondary/16 px-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Flame className="size-3 shrink-0 text-warning" />
          <span className="truncate text-[9px] font-black uppercase text-foreground">
            Padrão em form.
          </span>
        </div>
        <span className="rounded-full border border-success/25 bg-success/10 px-1.5 py-0.5 text-[7px] font-black text-success">
          {progress}%
        </span>
      </div>
      <div className="mt-0.5 flex min-w-0 items-center gap-1 overflow-hidden">
        <TinyPatternSequence sequence={strategy.sequence} maxItems={5} />
        <span className="shrink-0 text-[8px] text-muted-foreground">=</span>
        {strategy.expectedResult ? (
          <span className="shrink-0 text-[9px] font-black">
            {formatPulledSide(strategy.expectedResult)}
          </span>
        ) : (
          <span className="shrink-0 text-[9px] text-warning">sem amostra</span>
        )}
      </div>
      {alert.missingTokens.length > 0 && (
        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[8px] text-muted-foreground">
          <span>Falta:</span>
          <TinyPatternSequence sequence={alert.missingTokens} maxItems={2} tiny />
        </div>
      )}
      <div className="mt-0.5 flex items-center justify-between gap-2 text-[8px]">
        <span className="truncate text-muted-foreground">
          SG {strategy.sg} · G1 {strategy.g1} · RD {strategy.red}
        </span>
        <span className="shrink-0 font-black text-neon-cyan">
          {compactPercent(strategy.assertiveness)}
        </span>
      </div>
    </div>
  );
}

function TinyPatternSequence({
  sequence,
  maxItems,
  tiny = false,
}: {
  sequence: string[];
  maxItems: number;
  tiny?: boolean;
}) {
  const visible = sequence.slice(0, maxItems);
  const hidden = Math.max(0, sequence.length - visible.length);

  return (
    <div className="flex min-w-0 items-center gap-1 overflow-hidden">
      {visible.map((token, index) => (
        <div key={`${token}-${index}`} className="flex shrink-0 items-center gap-1">
          <TinyToken token={token} tiny={tiny} />
          {index < visible.length - 1 && (
            <span className="text-[9px] text-muted-foreground">→</span>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <span className="shrink-0 text-[8px] font-bold text-muted-foreground">+{hidden}</span>
      )}
    </div>
  );
}

function TinyToken({ token, tiny = false }: { token: string; tiny?: boolean }) {
  const side = token[0];
  const value = token.slice(1);
  const label = side === "T" && value ? `${value}x` : value || side;

  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full border font-black leading-none text-white",
        tiny ? "size-4 text-[7px]" : "size-5 text-[8px]",
        side === "B" && "border-banker/60 bg-banker",
        side === "P" && "border-player/60 bg-player",
        side === "T" && "border-warning/70 bg-warning text-background",
      )}
    >
      {label}
    </span>
  );
}

function PatternScoreLine({
  title,
  data,
}: {
  title: string;
  data: PatternMinerScoreboard | PatternMinerStrategy | null;
}) {
  return (
    <div className="rounded-xl border border-neon-cyan/12 bg-background/24 px-2 py-1.5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-neon-cyan">
          Placar {title}
        </span>
        <span className="truncate text-[9px] font-semibold text-muted-foreground">
          SQ {currentSequenceLabel(data)}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1 text-center">
        <TinyStat label="SG" value={formatScoreValue(data?.sg ?? null)} tone="green" />
        <TinyStat label="G1" value={formatScoreValue(data?.g1 ?? null)} tone="cyan" />
        <TinyStat label="RD" value={formatScoreValue(data?.red ?? null)} tone="red" />
        <TinyStat label="TIE" value={formatScoreValue(data?.tie ?? null)} tone="amber" />
        <TinyStat
          label="SQ+"
          value={formatScoreValue(data?.maxSequencePositive ?? null)}
          tone="green"
        />
        <TinyStat label="%" value={compactPercent(data?.assertiveness)} tone="cyan" />
      </div>
    </div>
  );
}

function TinyStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "cyan" | "red" | "amber" | "neutral";
}) {
  return (
    <div className={cn("min-w-0 rounded-md border px-1 py-0.5", scoreToneClass(tone))}>
      <div className="truncate text-[7px] font-bold uppercase opacity-75">{label}</div>
      <div className="truncate text-[10px] font-black leading-tight">{value}</div>
    </div>
  );
}

function currentSequenceLabel(data: PatternMinerScoreboard | PatternMinerStrategy | null) {
  if (!data) return "coletando";
  if (data.sequencePositive > 0) return `${data.sequencePositive}G`;
  if (data.sequenceNegative > 0) return `${data.sequenceNegative}R`;
  return "coletando";
}

function formatScoreValue(value: number | null) {
  return typeof value === "number" && value > 0 ? String(value) : "0";
}

function compactPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) return "--";
  return `${Math.round(value)}%`;
}

function scoreToneClass(tone: "green" | "cyan" | "red" | "amber" | "neutral") {
  if (tone === "green") return "border-success/25 bg-success/10 text-success";
  if (tone === "cyan") return "border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan";
  if (tone === "red") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (tone === "amber") return "border-warning/25 bg-warning/10 text-warning";
  return "border-border/45 bg-secondary/30 text-muted-foreground";
}
