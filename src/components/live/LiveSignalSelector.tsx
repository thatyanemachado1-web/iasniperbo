import { BellRing, CheckCircle2, CircleX, LoaderCircle, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardData } from "@/hooks/useDashboardData";
import {
  resolveLiveCardSignals,
  type LiveCardSignal,
  type LiveSignalModuleKey,
} from "@/lib/liveConfirmedSignals";
import { readUserSession } from "@/lib/userSession";
import { cn } from "@/lib/utils";

type LegacySignalFilter = "all" | LiveSignalModuleKey;

type SignalCardDefinition = {
  key: LiveSignalModuleKey;
  number: number;
  shortLabel: string;
  label: string;
};

type LiveCardDisplaySignal = LiveCardSignal & { card: SignalCardDefinition };
type HeldLiveResult = { signal: LiveCardDisplaySignal; expiresAt: number };

const LIVE_SIGNAL_FILTERS_STORAGE_KEY = "sniperbo:live-signal-card-filters:v2";
const LEGACY_LIVE_SIGNAL_FILTER_STORAGE_KEY = "sniperbo:live-signal-card-filter:v1";

const SIGNAL_CARDS: SignalCardDefinition[] = [
  { key: "paying_numbers", number: 1, shortLabel: "Neural", label: "Leitura Neural" },
  { key: "surf_alert", number: 2, shortLabel: "Surf", label: "Surf Analyzer" },
  { key: "ties_only", number: 3, shortLabel: "Empate", label: "Possível Empate" },
  { key: "ai_patterns", number: 4, shortLabel: "Padrões", label: "Padrões IA" },
  {
    key: "lateral_paying_numbers",
    number: 5,
    shortLabel: "Pagante lateral",
    label: "Número Pagante Lateral",
  },
  {
    key: "lateral_tie_patterns",
    number: 6,
    shortLabel: "Empate lateral",
    label: "Empate Lateral",
  },
];

const ALL_SIGNAL_CARD_KEYS = SIGNAL_CARDS.map((card) => card.key);
const VALID_SIGNAL_CARD_KEYS = new Set<LiveSignalModuleKey>(ALL_SIGNAL_CARD_KEYS);
const VALID_LEGACY_FILTERS = new Set<LegacySignalFilter>(["all", ...ALL_SIGNAL_CARD_KEYS]);

export function LiveSignalSelector() {
  const { data, mode } = useDashboardData();
  const [selectedFilters, setSelectedFilters] = useState<LiveSignalModuleKey[]>(() => [
    ...ALL_SIGNAL_CARD_KEYS,
  ]);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [heldResults, setHeldResults] = useState<Record<string, HeldLiveResult>>({});
  const seenResultKeysRef = useRef(new Set<string>());
  const liveReady = mode === "live" && data.mockMode === false;

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storageKey = liveSignalFiltersStorageKey();
    const legacyStorageKey = legacyLiveSignalFilterStorageKey();
    try {
      const savedFilters = parseStoredSignalFilters(window.localStorage.getItem(storageKey));
      if (savedFilters) {
        setSelectedFilters(savedFilters);
      } else {
        const legacyFilter = window.localStorage.getItem(legacyStorageKey);
        const migratedFilters = signalFiltersFromLegacy(legacyFilter);
        if (migratedFilters) setSelectedFilters(migratedFilters);
      }
    } catch {
      // Keep the default when storage is unavailable in an embedded browser.
    }

    const syncFilter = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      if (!event.newValue) {
        setSelectedFilters([...ALL_SIGNAL_CARD_KEYS]);
        return;
      }
      const nextFilters = parseStoredSignalFilters(event.newValue);
      if (nextFilters) setSelectedFilters(nextFilters);
    };
    window.addEventListener("storage", syncFilter);
    setPreferenceLoaded(true);

    return () => window.removeEventListener("storage", syncFilter);
  }, []);

  useEffect(() => {
    if (!preferenceLoaded) return;
    try {
      window.localStorage.setItem(liveSignalFiltersStorageKey(), JSON.stringify(selectedFilters));
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
  }, [preferenceLoaded, selectedFilters]);

  const rawSignals = useMemo(() => {
    if (!liveReady) return [];

    return SIGNAL_CARDS.flatMap((card): LiveCardDisplaySignal[] =>
      resolveLiveCardSignals(data, card.key, nowMs).map((signal) => ({ card, ...signal })),
    );
  }, [data, liveReady, nowMs]);

  useEffect(() => {
    if (!liveReady) {
      setHeldResults((current) => (Object.keys(current).length ? {} : current));
      seenResultKeysRef.current.clear();
      return;
    }
    setHeldResults((current) => {
      const next = { ...current };
      let changed = false;
      for (const [key, held] of Object.entries(next)) {
        if (held.expiresAt <= nowMs) {
          delete next[key];
          changed = true;
        }
      }
      for (const signal of rawSignals) {
        if (signal.kind !== "result") continue;
        const resultKey = `${signal.card.key}:${signal.signalKey}`;
        if (seenResultKeysRef.current.has(resultKey)) continue;
        seenResultKeysRef.current.add(resultKey);
        next[resultKey] = { signal, expiresAt: nowMs + 5_000 };
        changed = true;
      }
      if (seenResultKeysRef.current.size > 500) {
        const newestKeys = [...seenResultKeysRef.current].slice(-250);
        seenResultKeysRef.current = new Set(newestKeys);
      }
      return changed ? next : current;
    });
  }, [liveReady, nowMs, rawSignals]);

  const liveSignals = useMemo(
    () => [
      ...Object.values(heldResults).map((held) => held.signal),
      ...rawSignals.filter((signal) => signal.kind === "entry"),
    ],
    [heldResults, rawSignals],
  );

  const selectedFilterSet = useMemo(() => new Set(selectedFilters), [selectedFilters]);
  const selectedCards = useMemo(
    () => SIGNAL_CARDS.filter((card) => selectedFilterSet.has(card.key)),
    [selectedFilterSet],
  );
  const allCardsSelected = selectedFilters.length === ALL_SIGNAL_CARD_KEYS.length;
  const visibleSignals = liveSignals.filter((signal) => selectedFilterSet.has(signal.card.key));

  const toggleFilter = (filter: LiveSignalModuleKey) => {
    setSelectedFilters((current) => {
      if (current.length === ALL_SIGNAL_CARD_KEYS.length) return [filter];
      if (current.includes(filter)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== filter);
      }
      return ALL_SIGNAL_CARD_KEYS.filter((item) => item === filter || current.includes(item));
    });
  };

  return (
    <section className="mb-2 rounded-xl border border-neon-cyan/20 bg-background/55 p-2 shadow-[0_0_24px_-20px_var(--neon-cyan)]">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <BellRing className="size-3.5 shrink-0 text-neon-cyan" />
          <span className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-foreground sm:text-[10px]">
            Receber sinais de
          </span>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.12em]",
            liveReady
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-amber-400/30 bg-amber-400/10 text-amber-300",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              liveReady ? "animate-pulse bg-emerald-400" : "bg-amber-300",
            )}
          />
          {liveReady
            ? selectedFilters.length === 1
              ? "1 card ativo"
              : `${selectedFilters.length} cards ativos`
            : "Sincronizando"}
        </span>
      </div>

      <div
        role="group"
        aria-label="Escolha de quais cards receber sinais"
        className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <FilterButton
          active={allCardsSelected}
          label="Todos"
          title="Selecionar os seis cards"
          onClick={() => setSelectedFilters([...ALL_SIGNAL_CARD_KEYS])}
        />
        {SIGNAL_CARDS.map((card) => (
          <FilterButton
            key={card.key}
            active={selectedFilterSet.has(card.key)}
            label={`${card.number} · ${card.shortLabel}`}
            title={`Card ${card.number} — ${card.label}`}
            onClick={() => toggleFilter(card.key)}
          />
        ))}
      </div>

      <div className="mt-1 min-h-10">
        {!liveReady ? (
          <SignalWaitingState
            icon={<LoaderCircle className="size-3.5 animate-spin" />}
            text="Conectando aos sinais oficiais dos minicards…"
          />
        ) : visibleSignals.length === 0 ? (
          <SignalWaitingState
            icon={<Radio className="size-3.5" />}
            text={
              selectedCards.length === 1
                ? `Aguardando entrada ou resultado do Card ${selectedCards[0].number} — ${selectedCards[0].label}.`
                : `Aguardando entrada ou resultado dos ${selectedCards.length} cards selecionados.`
            }
          />
        ) : (
          <div className="grid grid-cols-2 items-stretch gap-2 pb-0.5 sm:flex sm:overflow-x-auto sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
            {visibleSignals.map((signal) => (
              <LiveCardSignalPanel key={`${signal.card.key}:${signal.signalKey}`} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FilterButton({
  active,
  label,
  title,
  onClick,
}: {
  active: boolean;
  label: string;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        "h-7 shrink-0 rounded-lg border px-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:text-[10px]",
        active
          ? "border-neon-cyan/55 bg-neon-cyan/15 text-neon-cyan shadow-[0_0_16px_-10px_var(--neon-cyan)]"
          : "border-border/60 bg-secondary/25 text-muted-foreground hover:border-neon-cyan/30 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function SignalWaitingState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-10 items-center gap-2 rounded-lg border border-border/45 bg-secondary/15 px-2.5 text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
      <span className="shrink-0 text-neon-cyan/75">{icon}</span>
      <span className="truncate">{text}</span>
    </div>
  );
}

function LiveCardSignalPanel({ signal }: { signal: LiveCardDisplaySignal }) {
  const tone = signal.kind === "result" ? resultTone(signal.outcome) : signalTone(signal.side);
  const ResultIcon = signal.kind === "result" && signal.outcome === "RED" ? CircleX : CheckCircle2;
  return (
    <div
      aria-live="polite"
      className={cn(
        "flex h-full w-full min-w-0 items-start gap-1.5 rounded-lg border p-2 shadow-lg sm:min-w-[240px] sm:flex-1 sm:items-center sm:gap-2 sm:px-2.5",
        tone.panel,
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-lg border sm:size-7",
          tone.icon,
        )}
      >
        <ResultIcon className="size-3.5 sm:size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-[7px] font-black uppercase leading-tight tracking-[0.08em] text-muted-foreground sm:truncate sm:text-[8px] sm:tracking-[0.12em]">
          Card {signal.card.number} · {signal.card.label}
        </div>
        {signal.kind === "entry" ? (
          <div className="mt-0.5 min-w-0">
            <div
              className={cn(
                "break-words text-[11px] font-black uppercase leading-tight sm:text-[12px]",
                tone.text,
              )}
            >
              {signal.headline}
            </div>
            <div className="mt-0.5 break-words text-[7px] font-semibold uppercase leading-tight tracking-[0.02em] text-muted-foreground sm:text-[9px] sm:tracking-[0.04em]">
              {signal.detail}
            </div>
          </div>
        ) : (
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <span className="text-[9px] font-black uppercase text-muted-foreground">
              Resultado confirmado
            </span>
            <span className={cn("text-sm font-black", tone.text)}>{signal.label}</span>
            {signal.side !== "TIE" ? (
              <span className="text-[8px] font-bold uppercase text-muted-foreground">
                {signal.side}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function signalTone(side: LiveCardSignal["side"]) {
  if (side === "BANKER") {
    return {
      panel: "border-banker/40 bg-banker/10",
      icon: "border-banker/40 bg-banker/15 text-banker",
      text: "text-banker",
    };
  }
  if (side === "PLAYER") {
    return {
      panel: "border-player/40 bg-player/10",
      icon: "border-player/40 bg-player/15 text-player",
      text: "text-player",
    };
  }
  return {
    panel: "border-tie/40 bg-tie/10",
    icon: "border-tie/40 bg-tie/15 text-tie",
    text: "text-tie",
  };
}

function resultTone(outcome: Extract<LiveCardSignal, { kind: "result" }>["outcome"]) {
  if (outcome === "GREEN") {
    return {
      panel: "border-emerald-400/45 bg-emerald-400/10",
      icon: "border-emerald-400/45 bg-emerald-400/15 text-emerald-300",
      text: "text-emerald-300",
    };
  }
  if (outcome === "RED") {
    return {
      panel: "border-red-400/45 bg-red-400/10",
      icon: "border-red-400/45 bg-red-400/15 text-red-300",
      text: "text-red-300",
    };
  }
  return {
    panel: "border-tie/45 bg-tie/10",
    icon: "border-tie/45 bg-tie/15 text-tie",
    text: "text-tie",
  };
}

function parseStoredSignalFilters(value: string | null): LiveSignalModuleKey[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;
    const selected = new Set(
      parsed.filter(
        (item): item is LiveSignalModuleKey =>
          typeof item === "string" && VALID_SIGNAL_CARD_KEYS.has(item as LiveSignalModuleKey),
      ),
    );
    const normalized = ALL_SIGNAL_CARD_KEYS.filter((item) => selected.has(item));
    return normalized.length ? normalized : null;
  } catch {
    return null;
  }
}

function signalFiltersFromLegacy(value: string | null): LiveSignalModuleKey[] | null {
  if (!value || !VALID_LEGACY_FILTERS.has(value as LegacySignalFilter)) return null;
  return value === "all" ? [...ALL_SIGNAL_CARD_KEYS] : [value as LiveSignalModuleKey];
}

function liveSignalFiltersStorageKey() {
  return scopedLiveSignalStorageKey(LIVE_SIGNAL_FILTERS_STORAGE_KEY);
}

function legacyLiveSignalFilterStorageKey() {
  return scopedLiveSignalStorageKey(LEGACY_LIVE_SIGNAL_FILTER_STORAGE_KEY);
}

function scopedLiveSignalStorageKey(baseKey: string) {
  const email = readUserSession().email.trim().toLowerCase();
  return email ? `${baseKey}:${email}` : baseKey;
}
