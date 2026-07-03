import { BellRing, CheckCircle2, Clock3, X, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardData, isDashboardLive } from "@/hooks/useDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import {
  formatToken,
  matchesPattern,
  sideName,
  sideTone,
} from "@/neuralValidator/NeuralValidatorEngine";
import {
  currentUserId,
  readSavedPatterns,
  readValidatorHistory,
  writeSavedPatterns,
} from "@/neuralValidator/NeuralValidatorStorage";
import type { Round, RoundResult } from "@/types/dashboard";
import type {
  LiveValidatorHit,
  SavedValidatorPattern,
  ValidatorEntryType,
  ValidatorPatternToken,
} from "@/types/neuralValidator";

const TELEGRAM_SENT_KEY = "sniper_neural_validator_telegram_sent_v1";
const SAVED_PATTERN_REFRESH_MS = 3_000;
const SERVER_TAIL_REFRESH_MS = 1500;
const MAX_CLIENT_MONITOR_ROUNDS = 200;

type PopupStatus = "entry" | "green" | "red" | "tie";

interface PopupOutcome {
  status: PopupStatus;
  label: string;
  description: string;
  isTerminal: boolean;
  result?: RoundResult;
  resultRoundId?: number;
  galeUsed?: number;
  tieCount?: number;
}

interface PatternPopup {
  id: string;
  hit: LiveValidatorHit;
  outcome: PopupOutcome;
  createdAt: string;
  updatedAt: string;
}

export function ValidatorLivePopupBridge() {
  const { data, mode } = useDashboardData();
  const [patterns, setPatterns] = useState<SavedValidatorPattern[]>(() => readSavedPatterns());
  const [serverRounds, setServerRounds] = useState<Round[]>([]);
  const [popups, setPopups] = useState<PatternPopup[]>([]);
  const telegramSendKeysRef = useRef(new Set<string>());
  const liveRounds = isDashboardLive(data, mode) ? data.rounds : [];
  const storedRounds = useMemo(
    () => readValidatorHistory(liveRounds).slice(-MAX_CLIENT_MONITOR_ROUNDS),
    [liveRounds, data.updatedAt],
  );
  const rounds = useMemo(
    () => mergeRoundSources([storedRounds, serverRounds]).slice(-MAX_CLIENT_MONITOR_ROUNDS),
    [storedRounds, serverRounds],
  );
  const roundsKey = roundsSignature(rounds);
  const liveHits = useMemo(() => detectSavedPatternHits(patterns, rounds), [patterns, roundsKey]);
  const liveHitKey = liveHits.map((hit) => `${hit.pattern.id}:${hit.detectedRoundId}`).join("|");

  useEffect(() => {
    let stopped = false;

    function refreshPatterns() {
      setPatterns((current) => mergeSavedPatterns(current, readSavedPatterns()));
    }

    async function refreshServerPatterns() {
      try {
        const serverPatterns = await fetchServerSavedPatterns();
        if (stopped) return;
        setPatterns((current) => {
          const next = mergeSavedPatterns(current, readSavedPatterns(), serverPatterns);
          writeSavedPatterns(next);
          return next;
        });
      } catch {
        refreshPatterns();
      }
    }

    refreshPatterns();
    void refreshServerPatterns();
    const interval = window.setInterval(() => {
      refreshPatterns();
      void refreshServerPatterns();
    }, SAVED_PATTERN_REFRESH_MS);
    const onStorage = () => refreshPatterns();
    window.addEventListener("storage", onStorage);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!patterns.length) {
      setServerRounds([]);
      return;
    }

    let stopped = false;
    const limit = monitorRoundLimit(patterns);

    async function refreshRoundTail() {
      try {
        const nextRounds = await fetchValidatorRoundTail(limit);
        if (!stopped) setServerRounds(nextRounds);
      } catch {
        if (!stopped) setServerRounds([]);
      }
    }

    void refreshRoundTail();
    const interval = window.setInterval(refreshRoundTail, SERVER_TAIL_REFRESH_MS);
    const onVisibilityChange = () => {
      if (!document.hidden) void refreshRoundTail();
    };
    const onFocus = () => void refreshRoundTail();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [patterns.map((pattern) => `${pattern.id}:${pattern.updatedAt}:${pattern.pattern.length}:${pattern.galeLimit}`).join("|")]);

  useEffect(() => {
    if (!liveHits.length) return;

    const now = new Date().toISOString();
    setPopups((current) => {
      const byId = new Map(current.map((popup) => [popup.id, popup]));
      for (const hit of liveHits) {
        if (!byId.has(hit.id)) {
          byId.set(hit.id, {
            id: hit.id,
            hit,
            outcome: resolveLiveOutcome(hit, rounds),
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      return [...byId.values()]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 4);
    });

    setPatterns((current) => {
      let changed = false;
      const hitByPatternId = new Map(liveHits.map((hit) => [hit.pattern.id, hit]));
      const next = current.map((pattern) => {
        const hit = hitByPatternId.get(pattern.id);
        if (!hit || pattern.lastDetectedRoundId === hit.detectedRoundId) return pattern;
        changed = true;
        return {
          ...pattern,
          lastDetectedAt: now,
          lastDetectedRoundId: hit.detectedRoundId,
          updatedAt: now,
        };
      });
      if (changed) writeSavedPatterns(next);
      return changed ? next : current;
    });

    for (const hit of liveHits) {
      void sendLiveHitToTelegram(hit, telegramSendKeysRef.current);
    }
  }, [liveHitKey]);

  useEffect(() => {
    if (!popups.length || !rounds.length) return;
    const now = new Date().toISOString();
    setPopups((current) =>
      current.map((popup) => {
        if (popup.outcome.isTerminal) return popup;
        const outcome = resolveLiveOutcome(popup.hit, rounds);
        if (sameOutcome(popup.outcome, outcome)) return popup;
        return { ...popup, outcome, updatedAt: now };
      }),
    );
  }, [roundsKey]);

  if (!popups.length) return null;

  return (
    <div className="pointer-events-none fixed right-2 top-16 z-[80] w-[min(292px,calc(100vw-1rem))] space-y-1.5 sm:right-4 lg:top-[4.5rem]">
      {popups.map((popup) => (
        <PatternPopupCard
          key={popup.id}
          popup={popup}
          onDismiss={() => setPopups((current) => current.filter((item) => item.id !== popup.id))}
        />
      ))}
    </div>
  );
}

function PatternPopupCard({
  popup,
  onDismiss,
}: {
  popup: PatternPopup;
  onDismiss: () => void;
}) {
  const tone = popupTone(popup.outcome.status);
  const entry = popup.hit.entry;
  return (
    <div className={`pointer-events-auto overflow-hidden rounded-xl border ${tone.border} ${tone.bg} shadow-xl backdrop-blur-xl`}>
      <div className={`h-0.5 ${tone.bar}`} />
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border ${tone.iconBorder} ${tone.iconBg}`}>
              {popupIcon(popup.outcome.status)}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">
                {popup.outcome.status === "entry" ? "Padrao detectado" : "Resultado"}
              </div>
              <div className={`text-sm font-black leading-tight ${tone.text}`}>{popup.outcome.label}</div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar alerta"
            onClick={onDismiss}
            className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background/45 text-muted-foreground transition hover:border-neon-cyan/50 hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>

        <div className="mt-2 rounded-lg border border-border/55 bg-background/45 px-2 py-1.5">
          <PopupPatternLine pattern={popup.hit.pattern.pattern} />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">Entrada:</span>
            <SideLine side={entry} inline />
            <span className="text-muted-foreground">G{Number(popup.hit.pattern.galeLimit) || 0}</span>
          </div>
          {popup.outcome.resultRoundId ? (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Rod. {popup.outcome.resultRoundId}
              {popup.outcome.result ? (
                <>
                  {" "}
                  saiu <SideLine side={popup.outcome.result} inline />
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PopupPatternLine({ pattern }: { pattern: ValidatorPatternToken[] }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs font-black">
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-center gap-1">
          <span className={sideTone(token.side)}>{sideEmoji(token.side)}{token.score ?? ""}</span>
          {index < pattern.length - 1 ? <span className="text-muted-foreground">-&gt;</span> : null}
        </span>
      ))}
    </div>
  );
}

function SideLine({
  side,
  inline = false,
}: {
  side: RoundResult | null | undefined;
  inline?: boolean;
}) {
  return (
    <span className={`${inline ? "inline-flex" : "flex"} items-center gap-1 font-black ${sideTone(side)}`}>
      {side ? <span>{sideEmoji(side)}</span> : null}
      {sideName(side)}
    </span>
  );
}

async function fetchServerSavedPatterns() {
  const response = await fetch("/validator/patterns", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Validator patterns unavailable");
  const data = await response.json().catch(() => null) as { patterns?: SavedValidatorPattern[] } | null;
  return Array.isArray(data?.patterns) ? data.patterns.filter(isSavedPattern) : [];
}

async function fetchValidatorRoundTail(limit: number) {
  const url = new URL("/validator/round-history", window.location.origin);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Validator round tail unavailable");
  const data = await response.json().catch(() => null) as { rounds?: unknown[] } | null;
  return Array.isArray(data?.rounds)
    ? data.rounds.filter(isValidatorRound).sort(compareValidatorRounds)
    : [];
}

function monitorRoundLimit(patterns: SavedValidatorPattern[]) {
  const needed = patterns.reduce((max, pattern) => {
    const patternLength = Math.max(1, pattern.pattern.length);
    const gale = Math.max(0, Number(pattern.galeLimit) || 0);
    return Math.max(max, patternLength + gale + 8);
  }, 40);
  return Math.min(200, Math.max(60, needed));
}

function mergeSavedPatterns(...sources: SavedValidatorPattern[][]) {
  const byId = new Map<string, SavedValidatorPattern>();
  for (const source of sources) {
    for (const pattern of source.filter(isSavedPattern)) {
      const current = byId.get(pattern.id);
      if (!current || Date.parse(pattern.updatedAt || "") >= Date.parse(current.updatedAt || "")) {
        byId.set(pattern.id, pattern);
      }
    }
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function mergeRoundSources(sources: Round[][]) {
  const byKey = new Map<string, Round>();
  for (const source of sources) {
    for (const round of source.filter(isValidatorRound)) {
      byKey.set(roundSourceKey(round), round);
    }
  }
  return [...byKey.values()].sort(compareValidatorRounds);
}

function roundSourceKey(round: Round) {
  return `${round.time}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function compareValidatorRounds(a: Round, b: Round) {
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  const timeCompare = a.time.localeCompare(b.time);
  if (timeCompare) return timeCompare;
  return `${a.result}:${a.bankerScore}:${a.playerScore}`.localeCompare(
    `${b.result}:${b.bankerScore}:${b.playerScore}`,
  );
}

function isValidatorRound(value: unknown): value is Round {
  const round = value as Partial<Round>;
  return (
    typeof round.id === "number" &&
    (round.result === "B" || round.result === "P" || round.result === "T") &&
    typeof round.bankerScore === "number" &&
    typeof round.playerScore === "number" &&
    typeof round.time === "string"
  );
}

function isSavedPattern(value: unknown): value is SavedValidatorPattern {
  const pattern = value as Partial<SavedValidatorPattern>;
  return (
    typeof pattern.id === "string" &&
    Array.isArray(pattern.pattern) &&
    typeof pattern.updatedAt === "string"
  );
}

function detectSavedPatternHits(patterns: SavedValidatorPattern[], rounds: Round[]): LiveValidatorHit[] {
  const latestRound = rounds.at(-1);
  if (!latestRound) return [];
  return patterns
    .filter((pattern) => pattern.isActive && pattern.destination !== "disabled" && pattern.pattern.length)
    .filter((pattern) => {
      const cooldown = Math.max(0, Number(pattern.cooldownRounds) || 0);
      if (pattern.lastDetectedRoundId && latestRound.id - pattern.lastDetectedRoundId <= cooldown) return false;
      return rounds.length >= pattern.pattern.length &&
        matchesPattern(rounds.slice(-pattern.pattern.length), pattern.pattern);
    })
    .map((pattern) => {
      const matchedRounds = rounds.slice(-pattern.pattern.length);
      return {
        id: `hit-${pattern.id}-${latestRound.id}`,
        pattern,
        matchedRounds,
        entry: resolvePatternEntry(pattern, matchedRounds),
        detectedRoundId: latestRound.id,
        detectedAt: new Date().toISOString(),
      };
    });
}

function resolvePatternEntry(pattern: SavedValidatorPattern, matchedRounds: Round[]): RoundResult | null {
  if (pattern.pulledSide) return pattern.pulledSide;
  const direct = entryTypeToSide(pattern.entryType);
  if (direct) return direct;
  const lastSide = matchedRounds.at(-1)?.result;
  if (!lastSide || lastSide === "T") return null;
  if (pattern.entryType === "SAME_LAST") return lastSide;
  if (pattern.entryType === "OPPOSITE") return lastSide === "B" ? "P" : "B";
  return null;
}

function resolveLiveOutcome(hit: LiveValidatorHit, rounds: Round[]): PopupOutcome {
  const detectedIndex = rounds.findIndex((round) => round.id === hit.detectedRoundId);
  const entry = hit.entry;
  if (detectedIndex < 0 || !entry) {
    return {
      status: "entry",
      label: "Entrada aguardando",
      description: "Padrao apareceu, mas a entrada ainda nao foi definida.",
      isTerminal: false,
    };
  }

  const maxGale = Math.max(0, Number(hit.pattern.galeLimit) || 0);
  let attempts = 0;
  let tieCount = 0;

  for (let index = detectedIndex + 1; index < rounds.length; index += 1) {
    const round = rounds[index];
    if (round.result === "T") {
      tieCount += 1;
      if (hit.pattern.tieProtection) continue;
      return {
        status: "tie",
        label: "TIE",
        description: "Empate apareceu sem cobertura. Contado separado de green e red.",
        isTerminal: true,
        result: "T",
        resultRoundId: round.id,
        galeUsed: attempts,
        tieCount,
      };
    }

    if (round.result === entry) {
      return {
        status: "green",
        label: attempts === 0 ? "GREEN SG" : `GREEN G${attempts}`,
        description: attempts === 0
          ? `Bateu direto em ${sideName(entry)}.`
          : `Bateu em ${sideName(entry)} no G${attempts}.`,
        isTerminal: true,
        result: round.result,
        resultRoundId: round.id,
        galeUsed: attempts,
        tieCount,
      };
    }

    attempts += 1;
    if (attempts > maxGale) {
      return {
        status: "red",
        label: "RED",
        description: `Falhou ate G${maxGale}.`,
        isTerminal: true,
        result: round.result,
        resultRoundId: round.id,
        galeUsed: maxGale,
        tieCount,
      };
    }
  }

  if (tieCount) {
    return {
      status: "tie",
      label: "TIE protegido",
      description: "Empate protegido. Aguardando a proxima rodada para decidir.",
      isTerminal: false,
      tieCount,
    };
  }

  return {
    status: "entry",
    label: "Entrada disparada",
    description: `Aguardando resultado em ${sideName(entry)}.`,
    isTerminal: false,
  };
}

async function sendLiveHitToTelegram(hit: LiveValidatorHit, inMemoryKeys: Set<string>) {
  if (hit.pattern.destination !== "telegram" && hit.pattern.destination !== "site_telegram") return;
  const sendKey = `${hit.pattern.id}:${hit.detectedRoundId}`;
  if (inMemoryKeys.has(sendKey) || wasTelegramNotificationSent(sendKey)) return;

  inMemoryKeys.add(sendKey);
  markTelegramNotificationSent(sendKey);
  try {
    const response = await fetch("/validator/live-hit/send", {
      method: "POST",
      cache: "no-store",
      headers: validatorApiHeaders(true),
      body: JSON.stringify({
        patternId: hit.pattern.id,
        detectedRoundId: hit.detectedRoundId,
      }),
    });
    if (!response.ok) {
      inMemoryKeys.delete(sendKey);
      forgetTelegramNotificationSent(sendKey);
    }
  } catch {
    inMemoryKeys.delete(sendKey);
    forgetTelegramNotificationSent(sendKey);
  }
}

function validatorApiHeaders(withJson = false) {
  const session = readUserSession();
  const adminSession = readAdminSession();
  const token = session.clientToken || adminSession?.token;
  return {
    Accept: "application/json",
    "X-Validator-User-Id": currentUserId(),
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function sameOutcome(a: PopupOutcome, b: PopupOutcome) {
  return (
    a.status === b.status &&
    a.label === b.label &&
    a.resultRoundId === b.resultRoundId &&
    a.result === b.result &&
    a.tieCount === b.tieCount
  );
}

function entryTypeToSide(entryType: ValidatorEntryType): RoundResult | null {
  if (entryType === "BANKER") return "B";
  if (entryType === "PLAYER") return "P";
  if (entryType === "TIE") return "T";
  return null;
}

function roundsSignature(rounds: Round[]) {
  const first = rounds[0];
  const last = rounds.at(-1);
  return `${rounds.length}:${first?.id ?? 0}:${last?.id ?? 0}:${last?.result ?? ""}`;
}

function telegramSentStorageKey() {
  return `${TELEGRAM_SENT_KEY}:${currentUserId()}`;
}

function readTelegramSentKeys() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(telegramSentStorageKey()) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function wasTelegramNotificationSent(key: string) {
  return readTelegramSentKeys().includes(key);
}

function markTelegramNotificationSent(key: string) {
  if (typeof window === "undefined") return;
  const next = Array.from(new Set([key, ...readTelegramSentKeys()])).slice(0, 400);
  window.localStorage.setItem(telegramSentStorageKey(), JSON.stringify(next));
}

function forgetTelegramNotificationSent(key: string) {
  if (typeof window === "undefined") return;
  const next = readTelegramSentKeys().filter((item) => item !== key);
  window.localStorage.setItem(telegramSentStorageKey(), JSON.stringify(next));
}

function sideEmoji(side: RoundResult) {
  if (side === "B") return "🔴";
  if (side === "P") return "🔵";
  return "🟡";
}

function popupIcon(status: PopupStatus) {
  if (status === "green") return <CheckCircle2 className="size-4 text-success" />;
  if (status === "red") return <XCircle className="size-4 text-destructive" />;
  if (status === "tie") return <Clock3 className="size-4 text-warning" />;
  return <BellRing className="size-4 text-neon-cyan" />;
}

function popupTone(status: PopupStatus) {
  if (status === "green") {
    return {
      border: "border-success/50",
      bg: "bg-success/10",
      bar: "bg-success",
      iconBorder: "border-success/40",
      iconBg: "bg-success/15",
      text: "text-success",
    };
  }
  if (status === "red") {
    return {
      border: "border-destructive/55",
      bg: "bg-destructive/10",
      bar: "bg-destructive",
      iconBorder: "border-destructive/45",
      iconBg: "bg-destructive/15",
      text: "text-destructive",
    };
  }
  if (status === "tie") {
    return {
      border: "border-warning/55",
      bg: "bg-warning/10",
      bar: "bg-warning",
      iconBorder: "border-warning/45",
      iconBg: "bg-warning/15",
      text: "text-warning",
    };
  }
  return {
    border: "border-neon-cyan/50",
    bg: "bg-neon-cyan/10",
    bar: "bg-neon-cyan",
    iconBorder: "border-neon-cyan/40",
    iconBg: "bg-neon-cyan/15",
    text: "text-neon-cyan",
  };
}
