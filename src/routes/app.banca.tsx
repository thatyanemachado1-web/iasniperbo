import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Banknote, Calculator, CalendarDays, CheckCircle2, PiggyBank, Save, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { cn } from "@/lib/utils";
import { readUserSession, type UserSession } from "@/lib/userSession";

export const Route = createFileRoute("/app/banca")({ component: BankrollManagerPage });

type Settings = { month: number; year: number; startingBankroll: number; monthlyGoal: number; dailyStopWin: number; dailyStopLoss: number };
type DayRow = { day: number; entriesCount: number; greens: number; reds: number; ties: number; deposits: number; withdrawals: number; dailyResult: number; notes: string };
type MonthPayload = Settings & { days: DayRow[]; updatedAt?: string };
type DayStatus = "stop_win" | "stop_loss" | "positive" | "negative" | "neutral";
type GaleLimit = "SG" | "G1" | "G2";
type RiskProfile = "conservador" | "moderado" | "agressivo";
type TieMainRule = "push" | "partial" | "loss";
type LeverageState = { currentBankroll: number; desiredBankroll: number; daysDeadline: number; initialEntry: number; galeLimit: GaleLimit; galeMultiplier: number; dailyStopWin: number; dailyStopLoss: number; maxEntriesPerDay: number; estimatedAccuracy: number; profile: RiskProfile };
type CoverageState = { side: "PLAYER" | "BANKER"; coverTie: boolean; tieCoverValue: number; tieMultiplier: 4 | 6 | 10 | 25 | 88; mainTieRule: TieMainRule };
type CoverageRow = { label: string; withoutCoverage: number; withCoverage: number; difference: number; status: string; tone: "green" | "amber" | "red" | "muted" };

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const inputClass = "h-10 w-full rounded-xl border border-border/70 bg-background/55 px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-neon-cyan/60 focus:ring-2 focus:ring-neon-cyan/15";
const compactInputClass = "h-9 min-w-[74px] rounded-lg border border-border/70 bg-background/55 px-2 text-xs text-foreground outline-none focus:border-neon-cyan/60";
const selectClass = `${inputClass} appearance-none`;
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function n(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : 0; }
function clamp(value: number, min: number, max: number) { return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min; }
function money(value: number) { return currency.format(Number.isFinite(value) ? value : 0); }
function moneyInputValue(value: number) { return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0); }
function normalizeMoneyDraft(value: string) {
  const trimmed = value.trim();
  const sign = trimmed.startsWith("-") ? "-" : "";
  let body = trimmed.replace(/[^\d,.]/g, "");
  if (!body.includes(",") && !body.includes(".")) body = body.replace(/^0+(?=\d)/, "");
  return sign + body;
}
function parseMoneyDraft(value: string) {
  const normalized = normalizeMoneyDraft(value).replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
function percent(value: number) { return pct.format(Number.isFinite(value) ? value : 0); }
function decimal(value: number) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Number.isFinite(value) ? value : 0); }
function daysInMonth(year: number, month: number) { return new Date(year, month, 0).getDate(); }
function createDays(year: number, month: number): DayRow[] { return Array.from({ length: daysInMonth(year, month) }, (_, index) => ({ day: index + 1, entriesCount: 0, greens: 0, reds: 0, ties: 0, deposits: 0, withdrawals: 0, dailyResult: 0, notes: "" })); }
function moneyNumber(value: unknown) { return Math.round(n(value) * 100) / 100; }
function cleanDayRow(day: DayRow): DayRow { return { day: Math.max(1, Math.floor(n(day.day))), entriesCount: Math.max(0, Math.floor(n(day.entriesCount))), greens: Math.max(0, Math.floor(n(day.greens))), reds: Math.max(0, Math.floor(n(day.reds))), ties: Math.max(0, Math.floor(n(day.ties))), deposits: moneyNumber(day.deposits), withdrawals: moneyNumber(day.withdrawals), dailyResult: moneyNumber(day.dailyResult), notes: String(day.notes || "").slice(0, 600) }; }
function normalizeDayPatch(current: DayRow, patch: Partial<DayRow>) {
  const next = cleanDayRow({ ...current, ...patch });
  const touchedResult = Object.prototype.hasOwnProperty.call(patch, "dailyResult");
  const touchedCounters = Object.prototype.hasOwnProperty.call(patch, "greens") || Object.prototype.hasOwnProperty.call(patch, "reds") || Object.prototype.hasOwnProperty.call(patch, "ties");
  if (touchedResult && current.greens === 0 && current.reds === 0 && current.ties === 0) {
    if (next.dailyResult > 0) next.greens = 1;
    if (next.dailyResult < 0) next.reds = 1;
  }
  if (touchedResult || touchedCounters) next.entriesCount = Math.max(next.entriesCount, next.greens + next.reds + next.ties);
  return next;
}
function syncDays(entries: DayRow[] | undefined, year: number, month: number) { const byDay = new Map((entries || []).map((entry) => [entry.day, entry])); return createDays(year, month).map((entry) => cleanDayRow({ ...entry, ...byDay.get(entry.day), day: entry.day })); }
function cleanMonthPayload(settings: Settings, days: DayRow[]): MonthPayload { const month = clamp(Math.floor(n(settings.month)), 1, 12); const year = clamp(Math.floor(n(settings.year)), 2000, 2100); return { month, year, startingBankroll: moneyNumber(settings.startingBankroll), monthlyGoal: moneyNumber(settings.monthlyGoal), dailyStopWin: moneyNumber(settings.dailyStopWin), dailyStopLoss: moneyNumber(settings.dailyStopLoss), days: syncDays(days.map(cleanDayRow), year, month), updatedAt: new Date().toISOString() }; }
function sum(days: DayRow[], key: keyof Omit<DayRow, "notes">) { return days.reduce((total, day) => total + n(day[key]), 0); }
function remainingDays(year: number, month: number, totalDays: number) { const now = new Date(); return now.getFullYear() === year && now.getMonth() + 1 === month ? Math.max(1, totalDays - now.getDate() + 1) : totalDays; }
function statusFor(result: number, stopWin: number, stopLoss: number): DayStatus { if (stopWin > 0 && result >= stopWin) return "stop_win"; if (stopLoss > 0 && result <= -Math.abs(stopLoss)) return "stop_loss"; if (result > 0) return "positive"; if (result < 0) return "negative"; return "neutral"; }
function summarize(settings: Settings, days: DayRow[]) { const totalEntries = sum(days, "entriesCount"); const totalGreens = sum(days, "greens"); const totalReds = sum(days, "reds"); const totalTies = sum(days, "ties"); const totalDeposits = sum(days, "deposits"); const totalWithdrawals = sum(days, "withdrawals"); const profit = sum(days, "dailyResult"); const currentBankroll = settings.startingBankroll + totalDeposits - totalWithdrawals + profit; const remainingGoal = Math.max(0, settings.monthlyGoal - profit); const requiredDaily = remainingGoal / Math.max(1, remainingDays(settings.year, settings.month, days.length)); const accuracy = totalGreens + totalReds > 0 ? totalGreens / (totalGreens + totalReds) * 100 : 0; return { totalEntries, totalGreens, totalReds, totalTies, totalDeposits, totalWithdrawals, profit, currentBankroll, remainingGoal, requiredDaily, accuracy, positiveDays: days.filter((d) => d.dailyResult > 0).length, negativeDays: days.filter((d) => d.dailyResult < 0).length, stopWinDays: days.filter((d) => settings.dailyStopWin > 0 && d.dailyResult >= settings.dailyStopWin).length, stopLossDays: days.filter((d) => settings.dailyStopLoss > 0 && d.dailyResult <= -Math.abs(settings.dailyStopLoss)).length }; }
function dayView(day: DayRow, settings: Settings, days: DayRow[], dailyGoal: number) { const index = days.findIndex((item) => item.day === day.day); const previous = days.slice(0, index + 1); const finalBankroll = settings.startingBankroll + sum(previous, "deposits") - sum(previous, "withdrawals") + sum(previous, "dailyResult"); return { finalBankroll, goalDiff: day.dailyResult - dailyGoal, status: statusFor(day.dailyResult, settings.dailyStopWin, settings.dailyStopLoss), dateLabel: new Date(settings.year, settings.month - 1, day.day).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", weekday: "short" }) }; }
function report(settings: Settings, summary: ReturnType<typeof summarize>) { const lines: string[] = []; if (settings.monthlyGoal > 0 && summary.profit >= settings.monthlyGoal) lines.push("Meta mensal batida. O foco agora deve ser preservar lucro, respeitar stop e programar saque."); else if (settings.monthlyGoal > 0) lines.push(`Faltam ${money(summary.remainingGoal)} para bater a meta mensal. A meta diária necessária agora é ${money(summary.requiredDaily)}.`); if (summary.totalGreens + summary.totalReds > 0 && summary.accuracy < 48) lines.push("Sua assertividade está baixa. Reduza a mão e revise os dias de red."); if (summary.stopLossDays >= 2) lines.push("Você teve dias batendo stop loss. Evite aumentar entrada para recuperar no mesmo dia."); if (summary.negativeDays > summary.positiveDays && summary.negativeDays >= 3) lines.push("Você teve muitos dias negativos. Reduza exposição e opere menos entradas."); if (!lines.length) lines.push("Sua operação está dentro do plano. Continue respeitando stop win e stop loss."); return lines; }
function monthStatusFor(settings: Settings, summary: ReturnType<typeof summarize>): { label: string; tone: "cyan" | "blue" | "green" | "red" | "amber" } { if (settings.monthlyGoal > 0 && summary.profit >= settings.monthlyGoal) return { label: "Meta batida", tone: "green" }; if (summary.stopLossDays > 0 || summary.profit < 0) return { label: "Atenção", tone: summary.profit < 0 ? "red" : "amber" }; if (summary.profit > 0) return { label: "Positivo", tone: "green" }; if (settings.startingBankroll > 0 || settings.monthlyGoal > 0) return { label: "Em andamento", tone: "blue" }; return { label: "Planejando", tone: "cyan" }; }

function BankrollManagerPage() {
  const session = readUserSession();
  const today = new Date();
  const [settings, setSettings] = useState<Settings>({ month: today.getMonth() + 1, year: today.getFullYear(), startingBankroll: 0, monthlyGoal: 0, dailyStopWin: 0, dailyStopLoss: 0 });
  const [days, setDays] = useState<DayRow[]>(() => createDays(today.getFullYear(), today.getMonth() + 1));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Carregando operação...");
  const liveMonth = useMemo(() => cleanMonthPayload(settings, days), [settings, days]);
  const liveSettings: Settings = liveMonth;
  const liveDays = liveMonth.days;
  const summary = useMemo(() => summarize(liveSettings, liveDays), [liveSettings, liveDays]);
  const dailyGoal = liveDays.length > 0 ? liveSettings.monthlyGoal / liveDays.length : 0;
  const [leverage, setLeverage] = useState<LeverageState>(() => leverageFromBankroll(settings, summary));
  const [coverage, setCoverage] = useState<CoverageState>({ side: "PLAYER", coverTie: true, tieCoverValue: 0, tieMultiplier: 4, mainTieRule: "push" });
  const leverageResult = useMemo(() => calculateLeverage(leverage), [leverage]);
  const coverageRows = useMemo(() => buildCoverageRows(leverage, coverage), [leverage, coverage]);

  useEffect(() => {
    let cancelled = false;
    async function loadMonth() {
      setLoading(true);
      setSaveStatus("Carregando operação...");
      const loaded = await loadBankrollMonth(session, settings.month, settings.year).catch(() => null);
      if (cancelled) return;
      if (loaded) {
        const nextSettings: Settings = { month: loaded.month, year: loaded.year, startingBankroll: n(loaded.startingBankroll), monthlyGoal: n(loaded.monthlyGoal), dailyStopWin: n(loaded.dailyStopWin), dailyStopLoss: n(loaded.dailyStopLoss) };
        const nextDays = syncDays(loaded.days, loaded.year, loaded.month);
        const nextSummary = summarize(nextSettings, nextDays);
        setSettings(nextSettings);
        setDays(nextDays);
        setLeverage(readLocalLeverage(session.email) || leverageFromBankroll(nextSettings, nextSummary));
        setSaveStatus(loaded.updatedAt ? `Último salvamento: ${formatDateTime(loaded.updatedAt)}` : "Dados carregados.");
      } else {
        const emptyDays = createDays(settings.year, settings.month);
        setDays(emptyDays);
        setLeverage(readLocalLeverage(session.email) || leverageFromBankroll(settings, summarize(settings, emptyDays)));
        setSaveStatus("Mês novo. Preencha e salve para guardar sua operação.");
      }
      setLoading(false);
    }
    void loadMonth();
    return () => { cancelled = true; };
  }, [session.clientToken, session.email, settings.month, settings.year]);

  function updateSetting(key: keyof Settings, value: number) { setSettings((current) => ({ ...current, [key]: moneyNumber(value) })); }
  function changePeriod(month: number, year: number) { setSettings((current) => ({ ...current, month: clamp(Math.floor(n(month)), 1, 12), year: clamp(Math.floor(n(year)), 2000, 2100) })); }
  function updateDay(day: number, patch: Partial<DayRow>) { setDays((current) => current.map((entry) => entry.day === day ? normalizeDayPatch(entry, patch) : entry)); }
  async function saveMonth() { setSaving(true); const payload = liveMonth; writeLocalBankroll(session.email, payload); try { const saved = await saveBankrollMonth(session, payload); setSaveStatus(saved ? "Operação salva no banco com segurança." : "Operação salva no backup local deste navegador."); } catch { setSaveStatus("Servidor indisponível. Salvei um backup local para não perder seus dados."); } finally { setSaving(false); } }
  function updateLeverage(patch: Partial<LeverageState>) { setLeverage((current) => { const next = { ...current, ...patch }; writeLocalLeverage(session.email, next); return next; }); }
  function applyBankrollToCalculator() { const next = leverageFromBankroll(liveSettings, summary); setLeverage(next); writeLocalLeverage(session.email, next); }

  const activeDayNumber = today.getFullYear() === liveSettings.year && today.getMonth() + 1 === liveSettings.month ? today.getDate() : 1;
  const launchDay = liveDays.find((day) => day.day === activeDayNumber) || liveDays[0];
  const launchView = launchDay ? dayView(launchDay, liveSettings, liveDays, dailyGoal) : null;
  const monthStatus = monthStatusFor(liveSettings, summary);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-neon-cyan">Gestor de Banca IA</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">Planilha Inteligente Sniper BO</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Controle sua banca, meta e stops em tempo real sem interferir nos motores de sinais.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><AppBadge tone="blue">Módulo separado</AppBadge><AppBadge tone="green">Dados por usuário</AppBadge><AppBadge tone="amber">Gestão de risco</AppBadge></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={<PiggyBank className="size-4" />} label="Banca atual" value={money(summary.currentBankroll)} tone="cyan" />
        <MetricCard icon={<CalendarDays className="size-4" />} label="Falta para meta" value={money(summary.remainingGoal)} tone={summary.remainingGoal <= 0 ? "green" : "amber"} />
        <MetricCard icon={<Banknote className="size-4" />} label="Meta diária necessária" value={money(summary.requiredDaily)} tone="blue" />
        <MetricCard icon={<TrendingUp className="size-4" />} label="Lucro / prejuízo" value={money(summary.profit)} tone={summary.profit >= 0 ? "green" : "red"} />
        <MetricCard icon={<CheckCircle2 className="size-4" />} label="Status do mês" value={monthStatus.label} tone={monthStatus.tone} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard>
          <SectionTitle title="Configuração simples" subtitle="Defina o plano mensal e os limites do dia." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mês"><select className={selectClass} value={liveSettings.month} onChange={(e) => changePeriod(Number(e.target.value), liveSettings.year)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select></Field>
            <Field label="Ano"><input className={inputClass} type="number" value={liveSettings.year} onChange={(e) => changePeriod(liveSettings.month, Number(e.target.value))} /></Field>
            <MoneyField label="Banca inicial" value={liveSettings.startingBankroll} onChange={(v) => updateSetting("startingBankroll", v)} />
            <MoneyField label="Meta mensal" value={liveSettings.monthlyGoal} onChange={(v) => updateSetting("monthlyGoal", v)} />
            <MoneyField label="Stop win diário" value={liveSettings.dailyStopWin} onChange={(v) => updateSetting("dailyStopWin", v)} />
            <MoneyField label="Stop loss diário" value={liveSettings.dailyStopLoss} onChange={(v) => updateSetting("dailyStopLoss", v)} />
          </div>
          <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3"><InlineStat label="Dias do mês" value={String(liveDays.length)} /><InlineStat label="Meta fixa por dia" value={money(dailyGoal)} /><InlineStat label="Status" value={loading ? "Carregando" : saveStatus} /></div>
          <button type="button" onClick={saveMonth} disabled={saving} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 px-4 text-sm font-black text-white shadow-[0_0_26px_rgba(14,165,233,0.25)] transition hover:brightness-110 disabled:opacity-60"><Save className="size-4" /> {saving ? "Salvando..." : "Salvar mês"}</button>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Relatório inteligente" subtitle="Leitura automática do seu gerenciamento." />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><SummaryPill label="Depósitos" value={money(summary.totalDeposits)} /><SummaryPill label="Saques" value={money(summary.totalWithdrawals)} /><SummaryPill label="Greens / Reds" value={`${summary.totalGreens} / ${summary.totalReds}`} /><SummaryPill label="Assertividade" value={`${percent(summary.accuracy)}%`} /></div>
          <div className="mt-4 space-y-2">{report(liveSettings, summary).map((message) => <div key={message} className="rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-sm text-muted-foreground">{message}</div>)}</div>
          <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4"><InlineStat label="Dias positivos" value={String(summary.positiveDays)} tone="green" /><InlineStat label="Dias negativos" value={String(summary.negativeDays)} tone="red" /><InlineStat label="Stops" value={`${summary.stopWinDays} WIN • ${summary.stopLossDays} LOSS`} tone="amber" /><InlineStat label="Entradas" value={String(summary.totalEntries)} tone="blue" /></div>
        </GlassCard>
      </div>

      <DailyLaunchCard day={launchDay} view={launchView} dailyGoal={dailyGoal} onChange={updateDay} />

      <GlassCard className="p-3 sm:p-4">
        <details className="group">
          <summary className="flex cursor-pointer list-none flex-col gap-2 rounded-2xl border border-border/70 bg-background/45 px-4 py-3 transition hover:border-neon-cyan/40 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-neon-cyan">Ver mês completo</div>
              <p className="mt-1 text-xs text-muted-foreground">Dias inexistentes do mês não aparecem. A banca final é calculada em sequência.</p>
            </div>
            <div className="flex items-center gap-2"><AppBadge tone="muted">{MONTHS[liveSettings.month - 1]} {liveSettings.year}</AppBadge><span className="text-xs font-bold text-muted-foreground group-open:hidden">Abrir</span><span className="hidden text-xs font-bold text-muted-foreground group-open:inline">Fechar</span></div>
          </summary>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1420px] border-separate border-spacing-y-2 text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><tr>{["Dia", "Data", "Entradas", "Greens", "Reds", "Empates", "Depósitos", "Saques", "Resultado", "Banca final", "Meta diária", "Diferença", "Status", "Anotações"].map((h) => <th key={h} className="px-2">{h}</th>)}</tr></thead>
              <tbody>{liveDays.map((day) => { const view = dayView(day, liveSettings, liveDays, dailyGoal); return (
                <tr key={day.day} className="rounded-xl bg-background/45 align-middle shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
                  <td className="rounded-l-xl px-2 py-2 font-black text-neon-cyan">{String(day.day).padStart(2, "0")}</td><td className="px-2 py-2 text-muted-foreground">{view.dateLabel}</td>
                  <EditNumber value={day.entriesCount} onChange={(v) => updateDay(day.day, { entriesCount: Math.max(0, Math.floor(v)) })} />
                  <EditNumber value={day.greens} onChange={(v) => updateDay(day.day, { greens: Math.max(0, Math.floor(v)) })} tone="green" />
                  <EditNumber value={day.reds} onChange={(v) => updateDay(day.day, { reds: Math.max(0, Math.floor(v)) })} tone="red" />
                  <EditNumber value={day.ties} onChange={(v) => updateDay(day.day, { ties: Math.max(0, Math.floor(v)) })} tone="amber" />
                  <EditMoney value={day.deposits} onChange={(v) => updateDay(day.day, { deposits: v })} />
                  <EditMoney value={day.withdrawals} onChange={(v) => updateDay(day.day, { withdrawals: v })} />
                  <EditMoney value={day.dailyResult} onChange={(v) => updateDay(day.day, { dailyResult: v })} tone={day.dailyResult >= 0 ? "green" : "red"} />
                  <td className="px-2 py-2 font-bold">{money(view.finalBankroll)}</td><td className="px-2 py-2 text-muted-foreground">{money(dailyGoal)}</td><td className={cn("px-2 py-2 font-bold", view.goalDiff >= 0 ? "text-success" : "text-destructive")}>{money(view.goalDiff)}</td><td className="px-2 py-2"><StatusBadge status={view.status} /></td>
                  <td className="rounded-r-xl px-2 py-2"><input className="h-9 w-56 rounded-lg border border-border/70 bg-background/50 px-2 text-xs outline-none focus:border-neon-cyan/60" value={day.notes} onChange={(e) => updateDay(day.day, { notes: e.target.value })} placeholder="Observação do dia" /></td>
                </tr>); })}</tbody>
            </table>
          </div>
        </details>
      </GlassCard>

      <LeverageCalculator leverage={leverage} coverage={coverage} result={leverageResult} coverageRows={coverageRows} onLeverageChange={updateLeverage} onCoverageChange={(patch) => setCoverage((current) => ({ ...current, ...patch }))} onUseBankroll={applyBankrollToCalculator} />
    </div>
  );
}

function DailyLaunchCard({ day, view, dailyGoal, onChange }: { day?: DayRow; view: ReturnType<typeof dayView> | null; dailyGoal: number; onChange: (day: number, patch: Partial<DayRow>) => void }) {
  if (!day || !view) return null;
  return (
    <GlassCard className="border-neon-cyan/25">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <SectionTitle title="Lançamento de hoje" subtitle="Digite a operação do dia. A tela recalcula tudo na hora." />
        <div className="flex flex-wrap items-center gap-2"><AppBadge tone="blue">{view.dateLabel}</AppBadge><StatusBadge status={view.status} /></div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PanelNumberField label="Entradas" value={day.entriesCount} onChange={(v) => onChange(day.day, { entriesCount: Math.max(0, Math.floor(v)) })} />
        <PanelNumberField label="Greens" value={day.greens} onChange={(v) => onChange(day.day, { greens: Math.max(0, Math.floor(v)) })} tone="green" />
        <PanelNumberField label="Reds" value={day.reds} onChange={(v) => onChange(day.day, { reds: Math.max(0, Math.floor(v)) })} tone="red" />
        <PanelNumberField label="Empates" value={day.ties} onChange={(v) => onChange(day.day, { ties: Math.max(0, Math.floor(v)) })} tone="amber" />
        <PanelMoneyField label="Depósito" value={day.deposits} onChange={(v) => onChange(day.day, { deposits: v })} />
        <PanelMoneyField label="Saque" value={day.withdrawals} onChange={(v) => onChange(day.day, { withdrawals: v })} />
        <PanelMoneyField label="Resultado do dia" value={day.dailyResult} onChange={(v) => onChange(day.day, { dailyResult: v })} tone={day.dailyResult >= 0 ? "green" : "red"} />
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1"><InlineStat label="Banca final" value={money(view.finalBankroll)} /><InlineStat label="Diferença da meta" value={money(view.goalDiff)} tone={view.goalDiff >= 0 ? "green" : "red"} /></div>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_0.55fr]">
        <Field label="Observação"><textarea className="min-h-20 w-full rounded-xl border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-neon-cyan/60 focus:ring-2 focus:ring-neon-cyan/15" value={day.notes} onChange={(e) => onChange(day.day, { notes: e.target.value })} placeholder="O que aconteceu hoje?" /></Field>
        <div className="rounded-2xl border border-border/70 bg-background/45 p-3 text-xs text-muted-foreground"><div className="font-black uppercase tracking-[0.16em] text-neon-cyan">Resumo do dia</div><p className="mt-2">Meta diária: <strong className="text-foreground">{money(dailyGoal)}</strong></p><p>Entradas registradas: <strong className="text-foreground">{day.entriesCount}</strong></p><p>Placar: <strong className="text-success">{day.greens} green</strong> / <strong className="text-destructive">{day.reds} red</strong> / <strong className="text-warning">{day.ties} empate</strong></p></div>
      </div>
    </GlassCard>
  );
}

function PanelNumberField({ label, value, onChange, tone }: { label: string; value: number; onChange: (value: number) => void; tone?: "green" | "red" | "amber" }) { return <Field label={label}><input className={cn(inputClass, tone === "green" && "text-success", tone === "red" && "text-destructive", tone === "amber" && "text-warning")} type="number" step="1" value={Number.isFinite(value) ? value : 0} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange(Number(e.target.value) || 0)} /></Field>; }
function PanelMoneyField({ label, value, onChange, tone }: { label: string; value: number; onChange: (value: number) => void; tone?: "green" | "red" | "amber" }) { return <Field label={label}><CurrencyInput className={cn(inputClass, tone === "green" && "text-success", tone === "red" && "text-destructive", tone === "amber" && "text-warning")} value={value} onChange={onChange} /></Field>; }
function LeverageCalculator({ leverage, coverage, result, coverageRows, onLeverageChange, onCoverageChange, onUseBankroll }: { leverage: LeverageState; coverage: CoverageState; result: ReturnType<typeof calculateLeverage>; coverageRows: CoverageRow[]; onLeverageChange: (patch: Partial<LeverageState>) => void; onCoverageChange: (patch: Partial<CoverageState>) => void; onUseBankroll: () => void }) {
  return (
    <GlassCard>
      <SectionTitle title="Calculadora de Alavancagem IA" subtitle="Resumo de risco para decidir a mão antes de operar." right={<button type="button" onClick={onUseBankroll} className="rounded-full border border-neon-cyan/35 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neon-cyan hover:bg-neon-cyan/10">Puxar da planilha</button>} />
      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard icon={<Calculator className="size-4" />} label="Entrada sugerida" value={money(leverage.initialEntry)} tone="blue" />
        <MetricCard icon={<ShieldAlert className="size-4" />} label="Risco" value={`${result.riskStatusLabel} · ${percent(result.riskPerEntryPercent)}%`} tone={riskTone(result.riskStatus)} />
        <MetricCard icon={<TrendingDown className="size-4" />} label="Reds suportados" value={decimal(result.redsSupported)} tone={result.redsSupported <= 3 ? "red" : "green"} />
      </div>
      <div className="mt-3 rounded-2xl border border-border/70 bg-background/45 p-4"><div className="mb-2 flex items-center justify-between gap-2"><div className="text-[11px] font-black uppercase tracking-[0.18em] text-neon-cyan">Diagnóstico IA</div><AppBadge tone={riskTone(result.riskStatus)}>{result.riskStatusLabel}</AppBadge></div><div className="space-y-2 text-sm text-muted-foreground">{result.messages.slice(0, 3).map((m) => <p key={m}>{m}</p>)}</div></div>
      <details className="mt-4 rounded-2xl border border-border/70 bg-background/35 p-3">
        <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:text-neon-cyan">Ajustar simulação avançada</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoneyField label="Banca atual" value={leverage.currentBankroll} onChange={(v) => onLeverageChange({ currentBankroll: v })} />
          <MoneyField label="Banca desejada" value={leverage.desiredBankroll} onChange={(v) => onLeverageChange({ desiredBankroll: v })} />
          <Field label="Prazo em dias"><input className={inputClass} type="number" value={leverage.daysDeadline} onChange={(e) => onLeverageChange({ daysDeadline: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></Field>
          <MoneyField label="Entrada inicial" value={leverage.initialEntry} onChange={(v) => onLeverageChange({ initialEntry: v })} />
          <Field label="Gale"><select className={selectClass} value={leverage.galeLimit} onChange={(e) => onLeverageChange({ galeLimit: e.target.value as GaleLimit })}><option value="SG">Sem gale</option><option value="G1">G1</option><option value="G2">G2</option></select></Field>
          <Field label="Multiplicador"><input className={inputClass} type="number" step="0.1" value={leverage.galeMultiplier} onChange={(e) => onLeverageChange({ galeMultiplier: Math.max(1, Number(e.target.value) || 1) })} /></Field>
          <MoneyField label="Stop win diário" value={leverage.dailyStopWin} onChange={(v) => onLeverageChange({ dailyStopWin: v })} />
          <MoneyField label="Stop loss diário" value={leverage.dailyStopLoss} onChange={(v) => onLeverageChange({ dailyStopLoss: v })} />
        </div>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><InlineStat label="Lucro necessário" value={money(result.profitNeeded)} tone="blue" /><InlineStat label="Meta diária" value={money(result.dailyTarget)} tone={result.metaAggressive ? "amber" : "green"} /><InlineStat label="Exposição com gale" value={money(result.totalExposure)} tone={riskTone(result.exposureStatus)} /></div>
      </details>
      <details className="mt-3 rounded-2xl border border-border/70 bg-background/35 p-3">
        <summary className="cursor-pointer list-none text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:text-neon-cyan">Simulador de cobertura de empate</summary>
        <CoverageSimulator leverage={leverage} coverage={coverage} rows={coverageRows} onChange={onCoverageChange} />
      </details>
    </GlassCard>
  );
}
function CoverageSimulator({ leverage, coverage, rows, onChange }: { leverage: LeverageState; coverage: CoverageState; rows: CoverageRow[]; onChange: (patch: Partial<CoverageState>) => void }) {
  return (
    <div className="mt-5 rounded-2xl border border-border/70 bg-background/45 p-4">
      <SectionTitle title="Simulador de Cobertura" subtitle="Compare entrada com e sem proteção no empate antes de operar." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Lado da entrada"><select className={selectClass} value={coverage.side} onChange={(e) => onChange({ side: e.target.value as CoverageState["side"] })}><option value="PLAYER">Player</option><option value="BANKER">Banker</option></select></Field>
        <Field label="Cobrir empate?"><select className={selectClass} value={coverage.coverTie ? "yes" : "no"} onChange={(e) => onChange({ coverTie: e.target.value === "yes" })}><option value="yes">Sim</option><option value="no">Não</option></select></Field>
        <MoneyField label="Cobertura Tie" value={coverage.tieCoverValue} onChange={(v) => onChange({ tieCoverValue: v })} />
        <Field label="Empate simulado"><select className={selectClass} value={coverage.tieMultiplier} onChange={(e) => onChange({ tieMultiplier: Number(e.target.value) as CoverageState["tieMultiplier"] })}>{[4, 6, 10, 25, 88].map((x) => <option key={x} value={x}>{x}x</option>)}</select></Field>
        <Field label="Regra do empate"><select className={selectClass} value={coverage.mainTieRule} onChange={(e) => onChange({ mainTieRule: e.target.value as TieMainRule })}><option value="push">Push / devolve</option><option value="partial">Perda parcial</option><option value="loss">Perda total</option></select></Field>
      </div>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3"><InlineStat label="Exposição total" value={money(leverage.initialEntry + (coverage.coverTie ? coverage.tieCoverValue : 0))} tone="amber" /><InlineStat label="Risco na banca" value={`${percent(leverage.currentBankroll > 0 ? ((leverage.initialEntry + (coverage.coverTie ? coverage.tieCoverValue : 0)) / leverage.currentBankroll) * 100 : 0)}%`} tone="blue" /><InlineStat label="Entradas suportadas" value={decimal((leverage.currentBankroll || 0) / Math.max(1, leverage.initialEntry + (coverage.coverTie ? coverage.tieCoverValue : 0)))} tone="green" /></div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><tr><th className="px-3">Cenário</th><th className="px-3">Sem cobertura</th><th className="px-3">Com cobertura</th><th className="px-3">Diferença</th><th className="px-3">Status</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.label} className="bg-background/55 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]"><td className="rounded-l-xl px-3 py-2 font-bold">{row.label}</td><td className={cn("px-3 py-2 font-bold", moneyTone(row.withoutCoverage))}>{money(row.withoutCoverage)}</td><td className={cn("px-3 py-2 font-bold", moneyTone(row.withCoverage))}>{money(row.withCoverage)}</td><td className={cn("px-3 py-2 font-bold", moneyTone(row.difference))}>{money(row.difference)}</td><td className="rounded-r-xl px-3 py-2"><AppBadge tone={row.tone}>{row.status}</AppBadge></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: "cyan" | "blue" | "green" | "red" | "amber" }) { const tones = { cyan: "text-neon-cyan border-neon-cyan/25 bg-neon-cyan/10", blue: "text-neon-blue border-neon-blue/25 bg-neon-blue/10", green: "text-success border-success/25 bg-success/10", red: "text-destructive border-destructive/25 bg-destructive/10", amber: "text-warning border-warning/25 bg-warning/10" } as const; return <div className="rounded-2xl border border-border/70 bg-background/55 p-3"><div className={cn("mb-2 inline-flex size-8 items-center justify-center rounded-xl border", tones[tone])}>{icon}</div><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className={cn("mt-1 text-lg font-black", tones[tone].split(" ")[0])}>{value}</div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>{children}</label>; }
function CurrencyInput({ value, onChange, className }: { value: number; onChange: (value: number) => void; className: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? moneyInputValue(value);
  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={displayValue}
      placeholder="0,00"
      onFocus={(event) => {
        setDraft(value === 0 ? "" : moneyInputValue(value));
        window.requestAnimationFrame(() => event.currentTarget.select());
      }}
      onChange={(event) => {
        const nextDraft = normalizeMoneyDraft(event.target.value);
        setDraft(nextDraft);
        onChange(parseMoneyDraft(nextDraft));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
function MoneyField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><CurrencyInput className={inputClass} value={value} onChange={onChange} /></Field>; }
function EditMoney({ value, onChange, tone }: { value: number; onChange: (value: number) => void; tone?: "green" | "red" | "amber" }) { return <td className="px-2 py-2"><CurrencyInput className={cn(compactInputClass, tone === "green" && "text-success", tone === "red" && "text-destructive", tone === "amber" && "text-warning")} value={value} onChange={onChange} /></td>; }
function EditNumber({ value, onChange, tone }: { value: number; onChange: (value: number) => void; tone?: "green" | "red" | "amber" }) { return <td className="px-2 py-2"><input className={cn(compactInputClass, tone === "green" && "text-success", tone === "red" && "text-destructive", tone === "amber" && "text-warning")} type="number" step="1" value={Number.isFinite(value) ? value : 0} onFocus={(e) => e.currentTarget.select()} onChange={(e) => onChange(Number(e.target.value) || 0)} /></td>; }
function InlineStat({ label, value, tone = "muted" }: { label: string; value: string; tone?: "green" | "red" | "amber" | "blue" | "muted" }) { const toneClass = { green: "text-success", red: "text-destructive", amber: "text-warning", blue: "text-neon-cyan", muted: "text-foreground" }[tone]; return <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2"><div className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className={cn("mt-1 text-sm font-black", toneClass)}>{value}</div></div>; }
function SummaryPill({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div><div className="mt-1 text-base font-black text-foreground">{value}</div></div>; }
function StatusBadge({ status }: { status: DayStatus }) { const config = { stop_win: ["green", "Stop win atingido"], stop_loss: ["red", "Stop loss atingido"], positive: ["green", "Positivo"], negative: ["red", "Negativo"], neutral: ["muted", "Neutro"] } as const; const [tone, label] = config[status]; return <AppBadge tone={tone}>{label}</AppBadge>; }

function leverageFromBankroll(settings: Settings, summary: ReturnType<typeof summarize>): LeverageState { const current = Math.max(0, summary.currentBankroll || settings.startingBankroll || 0); return { currentBankroll: current, desiredBankroll: current + Math.max(0, settings.monthlyGoal - summary.profit), daysDeadline: Math.max(1, remainingDays(settings.year, settings.month, daysInMonth(settings.year, settings.month))), initialEntry: current > 0 ? Math.round(current * 2) / 100 : 0, galeLimit: "G1", galeMultiplier: 2, dailyStopWin: settings.dailyStopWin, dailyStopLoss: settings.dailyStopLoss, maxEntriesPerDay: 5, estimatedAccuracy: 55, profile: "conservador" }; }
function exposure(entry: number, gale: GaleLimit, multiplier: number) { const g1 = entry * multiplier; const g2 = g1 * multiplier; if (gale === "G2") return entry + g1 + g2; if (gale === "G1") return entry + g1; return entry; }
function calculateLeverage(s: LeverageState) { const profitNeeded = Math.max(0, s.desiredBankroll - s.currentBankroll); const dailyTarget = profitNeeded / Math.max(1, s.daysDeadline); const growthPercent = s.currentBankroll > 0 ? profitNeeded / s.currentBankroll * 100 : 0; const totalExposure = exposure(s.initialEntry, s.galeLimit, s.galeMultiplier); const riskPerEntryPercent = s.currentBankroll > 0 ? s.initialEntry / s.currentBankroll * 100 : 0; const exposurePercent = s.currentBankroll > 0 ? totalExposure / s.currentBankroll * 100 : 0; const redsSupported = totalExposure > 0 ? s.currentBankroll / totalExposure : 0; const badDaysSupported = s.dailyStopLoss > 0 ? s.currentBankroll / Math.abs(s.dailyStopLoss) : 0; const positiveEntriesNeeded = s.initialEntry > 0 ? dailyTarget / s.initialEntry : 0; const metaAggressive = dailyTarget > s.currentBankroll * 0.08 || positiveEntriesNeeded > s.maxEntriesPerDay; const riskStatus = exposurePercent >= 35 || redsSupported <= 2 ? "extremo" : riskPerEntryPercent > 5 ? "alto" : riskPerEntryPercent > 2 ? "moderado" : "baixo"; const exposureStatus = exposurePercent >= 25 ? "alto" : exposurePercent >= 12 ? "moderado" : "baixo"; const messages = [`Sua entrada representa ${percent(riskPerEntryPercent)}% da banca. ${riskStatus === "baixo" ? "Gestão conservadora." : riskStatus === "moderado" ? "Gestão aceitável, mas exige disciplina." : "Entrada pesada para a banca."}`, `Com ${s.galeLimit === "SG" ? "sem gale" : s.galeLimit}, sua exposição real é de ${money(totalExposure)}.`, `Sua banca suporta aproximadamente ${decimal(redsSupported)} sequências de red nessa exposição.`, `Para bater essa meta, você precisa fazer ${money(dailyTarget)} por dia.`, metaAggressive ? "Essa alavancagem está agressiva. Reduza a mão ou aumente o prazo." : "Plano saudável: meta diária compatível com o risco informado.", s.dailyStopLoss > s.currentBankroll * 0.2 ? "Seu stop loss está muito alto para o tamanho da banca." : `Dias ruins suportados pelo stop: ${decimal(badDaysSupported)}.`]; return { profitNeeded, dailyTarget, growthPercent, totalExposure, riskPerEntryPercent, exposurePercent, redsSupported, badDaysSupported, positiveEntriesNeeded, metaAggressive, riskStatus, exposureStatus, riskStatusLabel: riskStatus === "baixo" ? "Risco baixo" : riskStatus === "moderado" ? "Risco moderado" : riskStatus === "alto" ? "Risco alto" : "Risco extremo", messages }; }
function mainTieAdjustment(main: number, rule: TieMainRule) { if (rule === "push") return 0; if (rule === "partial") return -(main / 2); return -main; }
function compareCoverage(label: string, withoutCoverage: number, withCoverage: number): CoverageRow { const difference = withCoverage - withoutCoverage; const protects = difference > 0; const positive = withCoverage >= 0; return { label, withoutCoverage, withCoverage, difference, status: protects && positive ? "Protege bem" : protects ? "Reduz prejuízo" : difference < 0 ? "Come lucro" : "Neutro", tone: protects && positive ? "green" : protects ? "amber" : difference < 0 ? "red" : "muted" }; }
function buildCoverageRows(leverage: LeverageState, coverage: CoverageState): CoverageRow[] { const main = Math.max(0, leverage.initialEntry); const cover = coverage.coverTie ? Math.max(0, coverage.tieCoverValue) : 0; const rows = [compareCoverage("Green Player/Banker", main, main - cover), compareCoverage("Red", -main, -(main + cover))]; for (const multiplier of [4, 6, 10, 25, 88] as const) { const withoutCoverage = mainTieAdjustment(main, coverage.mainTieRule); const withCoverage = cover > 0 ? cover * multiplier + mainTieAdjustment(main, coverage.mainTieRule) - cover : withoutCoverage; rows.push(compareCoverage(`Tie ${multiplier}x`, withoutCoverage, withCoverage)); } return rows; }
function riskTone(status: string): "green" | "amber" | "red" { if (status === "baixo") return "green"; if (status === "moderado") return "amber"; return "red"; }
function moneyTone(value: number) { if (value > 0) return "text-success"; if (value < 0) return "text-destructive"; return "text-muted-foreground"; }
function formatDateTime(value: string) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : value; }

async function loadBankrollMonth(session: UserSession, month: number, year: number): Promise<MonthPayload | null> {
  const local = readLocalBankroll(session.email, month, year);
  if (!session.clientToken) return local;
  const response = await fetch(`/bankroll/month?month=${month}&year=${year}`, { headers: { Authorization: `Bearer ${session.clientToken}` } });
  if (!response.ok) return local;
  const data = await response.json().catch(() => null) as { month?: MonthPayload | null } | null;
  return data?.month || local;
}
async function saveBankrollMonth(session: UserSession, payload: MonthPayload) {
  if (!session.clientToken) return false;
  const response = await fetch("/bankroll/month", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.clientToken}` }, body: JSON.stringify(payload) });
  return response.ok;
}
function localKey(email: string, month: number, year: number) { return `sniper_bankroll:${email.trim().toLowerCase() || "local"}:${year}:${month}`; }
function readLocalBankroll(email: string, month: number, year: number): MonthPayload | null { if (typeof window === "undefined") return null; try { const raw = window.localStorage.getItem(localKey(email, month, year)); return raw ? JSON.parse(raw) as MonthPayload : null; } catch { return null; } }
function writeLocalBankroll(email: string, payload: MonthPayload) { if (typeof window === "undefined") return; window.localStorage.setItem(localKey(email, payload.month, payload.year), JSON.stringify({ ...payload, updatedAt: new Date().toISOString() })); }
function leverageKey(email: string) { return `sniper_leverage:${email.trim().toLowerCase() || "local"}`; }
function readLocalLeverage(email: string): LeverageState | null { if (typeof window === "undefined") return null; try { const raw = window.localStorage.getItem(leverageKey(email)); return raw ? JSON.parse(raw) as LeverageState : null; } catch { return null; } }
function writeLocalLeverage(email: string, value: LeverageState) { if (typeof window === "undefined") return; window.localStorage.setItem(leverageKey(email), JSON.stringify(value)); }
