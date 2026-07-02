import { Activity, AlertTriangle, DatabaseZap, RotateCcw } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type { DayRoundSummary, RoundHistorySnapshot } from "@/hooks/useRoundHistory";

export function RoundHistoryAuditCard({
  history,
  onReset,
}: {
  history: RoundHistorySnapshot;
  onReset: () => void;
}) {
  return (
    <GlassCard>
      <SectionTitle
        title="Auditoria real de rodadas"
        subtitle="Comparacao salva a partir das rodadas recebidas da API ao vivo."
        right={
          <AppBadge tone={history.isSourceStale ? "amber" : "green"} pulse={!history.isSourceStale}>
            {history.isSourceStale ? (
              <>
                <AlertTriangle className="size-3" /> Fonte antiga
              </>
            ) : (
              <>
                <DatabaseZap className="size-3" /> Coletando real
              </>
            )}
          </AppBadge>
        }
      />

      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-neon-cyan transition hover:bg-neon-cyan/15"
        >
          <RotateCcw className="size-3" />
          Reiniciar coleta
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <DaySummaryCard label="Ontem" summary={history.yesterday} />
        <DaySummaryCard label="Hoje" summary={history.today} />
      </div>

      <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-3">
        <Info label="Coleta iniciou" value={formatDateTime(history.collectionStartedAt)} />
        <Info label="Ultima captura" value={formatDateTime(history.lastCapturedAt)} />
        <Info label="Fonte atualizou" value={formatDateTime(history.sourceUpdatedAt)} />
      </div>
    </GlassCard>
  );
}

function DaySummaryCard({ label, summary }: { label: string; summary: DayRoundSummary }) {
  const hasData = summary.total > 0;

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {label} - {formatDay(summary.day)}
          </div>
          <div className="mt-1 text-2xl font-black text-foreground">{summary.total}</div>
        </div>
        <Activity className="size-5 text-neon-cyan" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Metric label="Banker" value={summary.banker} percent={summary.bankerPercent} tone="text-banker" />
        <Metric label="Player" value={summary.player} percent={summary.playerPercent} tone="text-muted-foreground" />
        <Metric label="Tie" value={summary.tie} percent={summary.tiePercent} tone="text-tie" />
      </div>

      <div className="mt-3 rounded-lg bg-background/35 px-2 py-1.5 text-[11px] text-muted-foreground">
        {hasData ? (
          <>
            {summary.firstTime} ate {summary.lastTime}
            <span className="ml-2 text-foreground/80">{summary.lastSequence || "-"}</span>
          </>
        ) : (
          "Sem rodadas salvas nesse dia ainda"
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  percent,
  tone,
}: {
  label: string;
  value: number;
  percent: number;
  tone: string;
}) {
  return (
    <div className="rounded-lg bg-background/35 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-sm font-black ${tone}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{percent.toFixed(1)}%</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wider">{label}</div>
      <div className="font-semibold text-foreground">{value}</div>
    </div>
  );
}

function formatDay(value: string) {
  if (!value) return "-";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
