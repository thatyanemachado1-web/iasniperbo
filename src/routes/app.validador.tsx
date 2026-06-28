import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  BellRing,
  Bot,
  DatabaseZap,
  Eraser,
  Eye,
  History,
  Layers3,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Trophy,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDashboardData } from "@/hooks/useDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { hasFullAccess, readUserSession } from "@/lib/userSession";
import {
  DEFAULT_VALIDATOR_CONFIG,
  NeuralValidatorEngine,
  VALIDATOR_HISTORY_OPTIONS,
  formatPercent,
  formatToken,
  matchesPattern,
  sideName,
  sideTone,
  type PatternMiningFilters,
} from "@/neuralValidator/NeuralValidatorEngine";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  createStorageId,
  currentUserId,
  maskBotToken,
  readNotificationChannels,
  readPatternDraft,
  readSavedPatterns,
  removeNotificationChannel,
  removeSavedPattern,
  upsertNotificationChannel,
  upsertSavedPattern,
  writeNotificationChannels,
  writeSavedPatterns,
} from "@/neuralValidator/NeuralValidatorStorage";
import type { Round, RoundResult } from "@/types/dashboard";
import type {
  LiveValidatorHit,
  PatternSuggestion,
  SavedValidatorPattern,
  ValidatorConfig,
  ValidatorDestination,
  ValidatorEntryType,
  ValidatorGaleLimit,
  ValidatorNotificationChannel,
  ValidatorPatternToken,
  ValidatorResult,
} from "@/types/neuralValidator";

export const Route = createFileRoute("/app/validador")({
  component: NeuralValidatorPage,
});

const engine = new NeuralValidatorEngine();
const TELEGRAM_SENT_KEY = "sniper_neural_validator_telegram_sent_v3";
const VALIDATOR_DELETED_PATTERNS_KEY = "sniper_neural_validator_deleted_patterns_v1";
const VALIDATOR_CLIENT_HISTORY_LIMIT = 200;

const ENTRY_OPTIONS: Array<{ value: ValidatorEntryType; label: string }> = [
  { value: "AI", label: "Entrada sugerida pela IA" },
  { value: "BANKER", label: "Entrar no Banker" },
  { value: "PLAYER", label: "Entrar no Player" },
  { value: "TIE", label: "Entrar no Tie" },
  { value: "OPPOSITE", label: "Entrar no lado oposto" },
  { value: "SAME_LAST", label: "Mesmo lado do ultimo resultado" },
];

const DESTINATION_OPTIONS: Array<{ value: ValidatorDestination; label: string }> = [
  { value: "site", label: "Somente no site" },
  { value: "telegram", label: "Somente Telegram" },
  { value: "site_telegram", label: "Site + Telegram" },
  { value: "monitor", label: "Apenas monitorar" },
  { value: "disabled", label: "Desativado" },
];

type ValidatorTelegramModuleKey =
  | "ai_patterns"
  | "paying_numbers"
  | "surf_alert"
  | "ties_only"
  | "validator";
type ValidatorTelegramButtonConfig = {
  enabled: boolean;
  label: string;
  url: string;
};
type ValidatorTelegramTemplateKey =
  | "entry"
  | "analyzing"
  | "green"
  | "gale"
  | "red"
  | "expired"
  | "canceled";
type ValidatorTelegramModuleConfig = {
  enabled: boolean;
  entryType: "AUTO" | "BANKER" | "PLAYER" | "TIE";
  galeLimit: number;
  coverTie: boolean;
  tieCoverage: number;
  cooldownSeconds: number;
  template: string;
  analyzingTemplate: string;
  greenTemplate: string;
  galeTemplate: string;
  redTemplate: string;
  tieTemplate: string;
  expiredTemplate: string;
  canceledTemplate: string;
  buttons: ValidatorTelegramButtonConfig[];
};
type ValidatorChannelWithModules = ValidatorNotificationChannel & {
  signalModules?: Partial<Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>>;
};
type ValidatorChannelRuntimeState = ValidatorNotificationChannel & {
  serverConfirmed?: boolean;
};
type ValidatorTelegramNotification = {
  id: string;
  type: string;
  userId: string;
  channelId: string;
  roundId: number;
  status: string;
  error: string;
  payloadJson?: Record<string, unknown>;
  sentAt: string;
  updatedAt: string;
};
type ChannelFormState = {
  name: string;
  botToken: string;
  chatId: string;
  buttonLink: string;
  isActive: boolean;
  entryTemplate: string;
  analyzingEnabled: boolean;
  analyzingCooldownRounds: number;
  analyzingTemplate: string;
  signalModules: Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>;
};
const TELEGRAM_MODULE_OPTIONS: Array<{ key: ValidatorTelegramModuleKey; label: string }> = [
  { key: "ai_patterns", label: "SEGUIR PADROES IA" },
  { key: "paying_numbers", label: "SEGUIR NUMEROS PAGANTES" },
  { key: "surf_alert", label: "SEGUIR AVISO DE SURF" },
  { key: "ties_only", label: "SEGUIR SOMENTE EMPATES" },
  { key: "validator", label: "SEGUIR VALIDADOR" },
];
const MAX_TELEGRAM_BUTTONS = 4;
const DEFAULT_TELEGRAM_BUTTON_LABEL = "Abrir Sniper Bo IA";
const DEFAULT_TELEGRAM_MODULE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F916} <b>PADR\u00C3O IA CONFIRMADO</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{confidence}}`,
  paying_numbers: `\u{1F48E} <b>N\u00DAMERO PAGANTE CONFIRMADO</b>\n\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entryLabel}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CC} <b>Status:</b> {{status}}`,
  surf_alert: `\u{1F30A} <b>AVISO DE SURF CONFIRMADO</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entryCompact}}\n\u26A0\uFE0F <b>Risco:</b> {{risk}}\n\u{1F4CA} <b>Confian\u00E7a:</b> {{confidence}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u{1F7E1} <b>POSS\u00CDVEL EMPATE</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Cobertura:</b> at\u00E9 G{{tieCoverage}}\n\u{1F4CA} <b>N\u00EDvel:</b> {{level}}`,
  validator: `\u{1F916} <b>PADR\u00C3O VALIDADOR</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{percentage}}`,
};
const DEFAULT_TELEGRAM_GREEN_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u2705 <b>{{result}}</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  paying_numbers: `\u2705 <b>{{result}}</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  surf_alert: `\u2705 <b>{{result}}</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u2705 <b>{{result}}</b>\n\n\u{1F7E1} <b>Empate confirmado</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  validator: `\u2705 <b>{{result}}</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
};
const DEFAULT_TELEGRAM_ANALYZING_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F50E} <b>ANALISANDO PADR\u00C3O IA</b>\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  paying_numbers: `\u{1F50E} <b>ANALISANDO N\u00DAMERO PAGANTE</b>\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  surf_alert: `\u{1F50E} <b>ANALISANDO SURF</b>\n\u{1F30A} <b>Dire\u00E7\u00E3o:</b> {{side}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  ties_only: `\u{1F50E} <b>ANALISANDO EMPATE</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  validator: `\u{1F50E} <b>ANALISANDO VALIDADOR</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u23F3 Aguardando entrada validada.`,
};
const DEFAULT_TELEGRAM_GALE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
  paying_numbers: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
  surf_alert: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
  ties_only: `\u{1F6E1}\uFE0F <b>COBRIR EMPATE {{gale}}</b>\n\u{1F7E1} <b>Press\u00E3o:</b> {{tie_pressure}}`,
  validator: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
};
const DEFAULT_TELEGRAM_RED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u274C <b>RED</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  paying_numbers: `\u274C <b>RED</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  surf_alert: `\u274C <b>RED</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u274C <b>RED</b>\n\n\u{1F7E1} <b>Empate n\u00E3o confirmou</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  validator: `\u274C <b>RED</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
};
const DEFAULT_TELEGRAM_EXPIRED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
  paying_numbers: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}`,
  surf_alert: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Dire\u00E7\u00E3o:</b> {{side}}`,
  ties_only: `\u231B <b>ALERTA DE EMPATE EXPIRADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}`,
  validator: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
};
const DEFAULT_TELEGRAM_CANCELED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  paying_numbers: `\u{1F6AB} <b>SINAL BLOQUEADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  surf_alert: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  ties_only: `\u{1F6AB} <b>ALERTA CANCELADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  validator: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
};
const DEFAULT_TELEGRAM_TIE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: DEFAULT_TELEGRAM_GREEN_TEMPLATES.ai_patterns,
  paying_numbers: DEFAULT_TELEGRAM_GREEN_TEMPLATES.paying_numbers,
  surf_alert: DEFAULT_TELEGRAM_GREEN_TEMPLATES.surf_alert,
  ties_only: DEFAULT_TELEGRAM_GREEN_TEMPLATES.ties_only,
  validator: DEFAULT_TELEGRAM_GREEN_TEMPLATES.validator,
};

function NeuralValidatorPage() {
  const { data, mode } = useDashboardData();
  const session = readUserSession();
  const adminSession = readAdminSession();
  const hasClientSession = Boolean(session.clientToken);
  const adminAccess = Boolean(adminSession?.token && !hasClientSession);
  const fullAccess = adminAccess || hasFullAccess(session);
  const [activeTab, setActiveTab] = useState("dashboard");
  const realTimeRounds = mode === "live" && !data.mockMode ? data.rounds : [];
  const planLimits = adminAccess ? planLimitForSession("vip", true) : planLimitForSession(session.plan, fullAccess);
  const [serverHistory, setServerHistory] = useState<Round[]>([]);
  const [serverHistoryStatus, setServerHistoryStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const historyRounds = useMemo(
    () => mergeRoundSources([serverHistory, realTimeRounds]).slice(-VALIDATOR_CLIENT_HISTORY_LIMIT),
    [realTimeRounds, serverHistory],
  );
  const hasHistory = historyRounds.length > 0;
  const [notice, setNotice] = useState("");

  const [pattern, setPattern] = useState<ValidatorPatternToken[]>(() => {
    const draft = readPatternDraft();
    return draft.length ? draft : [{ side: "B" }, { side: "P" }, { side: "B" }];
  });
  const [tokenScore, setTokenScore] = useState("");
  const [config, setConfig] = useState<ValidatorConfig>({
    ...DEFAULT_VALIDATOR_CONFIG,
    name: "Estrategia Neural",
    entryType: "BANKER",
    historySize: Math.min(DEFAULT_VALIDATOR_CONFIG.historySize, planLimits.history),
  });
  const [manualResult, setManualResult] = useState<ValidatorResult | null>(null);
  const [savedPatterns, setSavedPatterns] = useState<SavedValidatorPattern[]>(() => readSavedPatterns());
  const [channels, setChannels] = useState<ValidatorNotificationChannel[]>([]);
  const [recentTelegramNotifications, setRecentTelegramNotifications] = useState<ValidatorTelegramNotification[]>([]);
  const [testingTelegramId, setTestingTelegramId] = useState("");
  const [savingChannel, setSavingChannel] = useState(false);
  const [channelValidation, setChannelValidation] = useState({
    key: "",
    code: "",
    validatedAt: "",
  });
  const [siteAlerts, setSiteAlerts] = useState<LiveValidatorHit[]>([]);
  const telegramSendKeysRef = useRef(new Set<string>());
  const [channelForm, setChannelForm] = useState<ChannelFormState>({
    name: "Sala Premium",
    botToken: "",
    chatId: "",
    buttonLink: "",
    isActive: true,
    entryTemplate: DEFAULT_MESSAGE_TEMPLATES.entry,
    analyzingEnabled: false,
    analyzingCooldownRounds: 3,
    analyzingTemplate: DEFAULT_MESSAGE_TEMPLATES.analyzing,
    signalModules: defaultTelegramModuleConfigs(),
  });
  const [filters, setFilters] = useState<PatternMiningFilters>({
    historySize: Math.min(5000, planLimits.history),
    patternLength: 3,
    entryType: "AI",
    galeLimit: 1,
    minAccuracy: 70,
    minOccurrences: 5,
    includeTie: true,
    includeNumbers: true,
    includeOpposite: true,
    hotOnly: false,
    lowRedOnly: false,
  });

  const suggestions = useMemo(() => {
    if (!hasHistory || !planLimits.ai) return [];
    return engine.minePatterns(historyRounds, filters);
  }, [filters, hasHistory, historyRounds, planLimits.ai]);

  const historySignature = roundsSignature(historyRounds);
  const patternSignature = pattern.map(formatToken).join(">");
  const validationHistoryRounds = historyRounds;
  const hasValidationHistory = Boolean(manualResult?.analyzedRounds || historyRounds.length);
  const currentSavedPattern = useMemo(
    () => findSavedPattern(savedPatterns, pattern, config),
    [savedPatterns, pattern, config.entryType, config.galeLimit, config.tableId, config.tieProtection],
  );

  const liveHits = useMemo(
    () => detectLiveHits(savedPatterns, historyRounds),
    [savedPatterns, historyRounds],
  );
  const validatorTelegramReadySignature = useMemo(
    () =>
      channels
        .map((channel) => {
          const modules = normalizeTelegramModuleConfigs(channel.signalModules);
          return [
            channel.id,
            channel.isActive ? "1" : "0",
            channel.chatId ? "chat" : "no-chat",
            modules.validator.enabled ? "validator-on" : "validator-off",
          ].join(":");
        })
        .join("|"),
    [channels],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadValidatorHistory() {
      setServerHistoryStatus("loading");
      try {
        const rounds = await fetchValidatorRoundHistory(VALIDATOR_CLIENT_HISTORY_LIMIT);
        if (cancelled) return;
        setServerHistory(rounds);
        setServerHistoryStatus("ready");
      } catch {
        if (cancelled) return;
        setServerHistoryStatus("error");
      }
    }

    void loadValidatorHistory();

    return () => {
      cancelled = true;
    };
  }, [data.updatedAt]);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendValidatorData() {
      let confirmedChannels: ValidatorNotificationChannel[] | null = null;

      try {
        const serverChannels = await fetchServerValidatorChannels();
        if (cancelled) return;

        confirmedChannels = markServerConfirmedChannels(mergeValidatorChannels(serverChannels));
        writeNotificationChannels(confirmedChannels);
        setChannels(confirmedChannels);
      } catch (error) {
        if (cancelled) return;
        console.warn("[VALIDATOR_CHANNELS] load_failed_preserving_local", {
          error: error instanceof Error ? error.message : String(error),
        });
        confirmedChannels = [];
        setChannels([]);
      }

      try {
        const serverPatterns = await fetchServerValidatorPatterns();
        if (cancelled) return;

        const syncedChannels = confirmedChannels ?? [];
        const deletedPatternIds = readDeletedValidatorPatternIds();
        const mergedPatterns = autoPrepareAdminTelegramDelivery(
          serverPatterns.filter((item) => !deletedPatternIds.has(item.id)),
          syncedChannels,
          adminAccess,
        );
        writeSavedPatterns(mergedPatterns);
        setSavedPatterns(mergedPatterns);

        const patternsToSync = mergedPatterns.filter((item) => shouldSyncValidatorItem(item, serverPatterns));
        await Promise.all([
          ...patternsToSync.map((item) => saveServerValidatorPattern(item).catch(() => null)),
        ]);
      } catch {
        // Local storage remains the fallback when backend sync is unavailable.
      }

      try {
        const notifications = await fetchServerValidatorNotifications();
        if (!cancelled) setRecentTelegramNotifications(notifications);
      } catch {
        if (!cancelled) setRecentTelegramNotifications([]);
      }
    }

    void loadBackendValidatorData();

    return () => {
      cancelled = true;
    };
  }, [session.email, session.clientToken, adminSession?.email, adminSession?.token]);

  useEffect(() => {
    let cancelled = false;

    async function validateCurrentPattern() {
      if (pattern.length < 1) {
        setManualResult(null);
        return;
      }

      setManualResult(null);
      try {
        const result = await validatePatternOnServer(pattern, config);
        if (!cancelled) setManualResult(result);
      } catch {
        if (cancelled) return;
        const fallbackHistory = validationHistoryRounds.slice(-VALIDATOR_CLIENT_HISTORY_LIMIT);
        setManualResult(
          fallbackHistory.length
            ? engine.validatePattern(fallbackHistory, pattern, {
              ...config,
              historySize: fallbackHistory.length,
            })
            : null,
        );
      }
    }

    void validateCurrentPattern();

    return () => {
      cancelled = true;
    };
  }, [
    config.entryType,
    config.galeLimit,
    config.historySize,
    config.tableId,
    config.tieProtection,
    data.updatedAt,
    historySignature,
    patternSignature,
  ]);

  useEffect(() => {
    if (!liveHits.length) return;
    setSiteAlerts((current) => {
      const byId = new Map(current.map((hit) => [hit.id, hit]));
      for (const hit of liveHits) byId.set(hit.id, hit);
      return [...byId.values()]
        .sort((a, b) => b.detectedRoundId - a.detectedRoundId)
        .slice(0, 5);
    });
    void Promise.all(liveHits.map((hit) => sendLiveHitToTelegram(hit)));
    setSavedPatterns((current) => {
      let changed = false;
      const now = new Date().toISOString();
      const next = current.map((patternItem) => {
        const hit = liveHits.find((item) => item.pattern.id === patternItem.id);
        if (!hit || patternItem.lastDetectedRoundId === hit.detectedRoundId) return patternItem;
        changed = true;
        return {
          ...patternItem,
          lastDetectedAt: now,
          lastDetectedRoundId: hit.detectedRoundId,
          updatedAt: now,
        };
      });
      if (changed) writeSavedPatterns(next);
      return changed ? next : current;
    });
  }, [liveHits.map((hit) => `${hit.pattern.id}:${hit.detectedRoundId}`).join("|"), validatorTelegramReadySignature]);

  function addToken(side: RoundResult, scoreText = tokenScore) {
    const score = Number(scoreText);
    const token: ValidatorPatternToken = {
      side,
      ...(Number.isFinite(score) && score > 0 ? { score } : {}),
    };
    setPattern((current) => [...current, token]);
    setTokenScore("");
  }

  function saveCurrentPattern(
    sourceResult: ValidatorResult | null = manualResult,
    sourcePattern = pattern,
    name = config.name,
  ) {
    if (!sourcePattern.length) {
      showNotice("Monte pelo menos uma bolinha antes de salvar.");
      return false;
    }
    const duplicate = findSavedPattern(savedPatterns, sourcePattern, config);
    if (duplicate) {
      showNotice("Padrao ja salvo em Padroes Salvos.");
      return false;
    }
    if (savedPatterns.length >= planLimits.patterns) {
      showNotice(`Seu plano permite ate ${planLimits.patterns} padroes salvos.`);
      return false;
    }
    const sourceHistory = validationHistoryRounds.length ? validationHistoryRounds : historyRounds;
    const validation =
      sourceResult ?? engine.validatePattern(sourceHistory, sourcePattern, config);
    const now = new Date().toISOString();
    const saved: SavedValidatorPattern = {
      id: createStorageId("pattern"),
      userId: currentUserId(),
      name: name || "Estrategia Neural",
      tableId: config.tableId,
      pattern: sourcePattern,
      entryType: config.entryType,
      pulledSide: validation.pulledSide,
      galeLimit: config.galeLimit,
      tieProtection: config.tieProtection,
      destination: "site",
      telegramChannelId: "",
      messageOverride: "",
      cooldownRounds: 2,
      isActive: true,
      validation,
      currentGreenStreak: validation.currentGreenStreak,
      wins: validation.sgWins + validation.g1Wins + validation.g2Wins,
      losses: validation.losses,
      lastDetectedAt: "",
      createdAt: now,
      updatedAt: now,
    };
    const next = upsertSavedPattern(saved);
    setSavedPatterns(next);
    void saveServerValidatorPattern(saved).then((serverPattern) => {
      if (!serverPattern) {
        showNotice("Padrao salvo no navegador, mas o servidor nao confirmou. Telegram precisa do padrao no servidor.");
      }
    });
    showNotice(sourceHistory.length ? "Padrao salvo em Padroes Salvos." : "Padrao salvo sem amostra historica.");
    return true;
  }

  function saveAndClearPattern() {
    if (!saveCurrentPattern()) return;
    setPattern([]);
  }

  function saveSuggestion(suggestion: PatternSuggestion) {
    saveCurrentPattern(
      suggestion.validation,
      suggestion.pattern,
      `IA ${sideName(suggestion.pulledSide)} ${formatPercent(suggestion.validation.accuracy)}`,
    );
  }

  function removePattern(id: string) {
    markDeletedValidatorPatternId(id);
    const nextPatterns = removeSavedPattern(id).filter((item) => item.id !== id);
    writeSavedPatterns(nextPatterns);
    setSavedPatterns(nextPatterns);
    void deleteServerValidatorPattern(id)
      .then(() => showNotice("Padrao excluido definitivamente."))
      .catch((error) => {
        showNotice(error instanceof Error ? error.message : "Padrao removido localmente; servidor nao confirmou.");
      });
  }

  async function refreshPattern(patternItem: SavedValidatorPattern) {
    const validationConfig = {
      ...config,
      entryType: patternItem.entryType,
      galeLimit: patternItem.galeLimit,
      tieProtection: patternItem.tieProtection,
      tableId: patternItem.tableId,
    };
    const validation = await validatePatternOnServer(patternItem.pattern, validationConfig).catch(() =>
      engine.validatePattern(historyRounds, patternItem.pattern, {
        ...validationConfig,
        historySize: Math.min(historyRounds.length || 1, VALIDATOR_CLIENT_HISTORY_LIMIT),
      }),
    );
    const nextItem = {
      ...patternItem,
      validation,
      pulledSide: validation.pulledSide,
      wins: validation.sgWins + validation.g1Wins + validation.g2Wins,
      losses: validation.losses,
      currentGreenStreak: validation.currentGreenStreak,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(nextItem));
    void saveServerValidatorPattern(nextItem);
    showNotice("Padrao atualizado com o historico real disponivel.");
  }

  function resetPatternScore(patternItem: SavedValidatorPattern) {
    const nextItem = {
      ...patternItem,
      wins: 0,
      losses: 0,
      currentGreenStreak: 0,
      lastDetectedAt: "",
      lastDetectedRoundId: undefined,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(nextItem));
    void saveServerValidatorPattern(nextItem);
    showNotice("Placar do padrao zerado.");
  }

  function updateSavedPattern(patternItem: SavedValidatorPattern, patch: Partial<SavedValidatorPattern>) {
    const updated = {
      ...patternItem,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setSavedPatterns(upsertSavedPattern(updated));
    void saveServerValidatorPattern(updated);
  }

  function updateAllSavedPatternDelivery(
    destination: ValidatorDestination,
    telegramChannelId: string,
  ) {
    if (!savedPatterns.length) {
      showNotice("Nenhum padrao salvo para configurar.");
      return;
    }
    const needsTelegram = destination === "telegram" || destination === "site_telegram";
    if (needsTelegram && !telegramChannelId) {
      showNotice("Escolha um canal Telegram antes de aplicar em todos.");
      return;
    }

    const now = new Date().toISOString();
    const next = savedPatterns.map((patternItem) => ({
      ...patternItem,
      destination,
      telegramChannelId: needsTelegram ? telegramChannelId : patternItem.telegramChannelId,
      updatedAt: now,
    }));
    writeSavedPatterns(next);
    setSavedPatterns(next);
    void Promise.all(next.map((patternItem) => saveServerValidatorPattern(patternItem)));
    showNotice(`${next.length} padroes atualizados para ${destinationLabel(destination)}.`);
  }

  async function sendLiveHitToTelegram(hit: LiveValidatorHit) {
    const patternItem = hit.pattern;
    if (patternItem.destination === "disabled" || patternItem.destination === "monitor") {
      showNotice("Padrao detectado no site. Telegram nao enviado porque o destino esta monitorar/desativado.");
      return;
    }
    const channel = channels.find((item) => item.id === patternItem.telegramChannelId) ||
      channels.find((item) => item.isActive && item.chatId) ||
      channels[0];
    if (!channel || !channel.isActive) {
      console.info("[VALIDATOR_LIVE_HIT] blocked", {
        reason: "no_active_channel",
        patternId: patternItem.id,
        detectedRoundId: hit.detectedRoundId,
        channels: channels.length,
      });
      showNotice("Padrao detectado no site. Telegram nao enviado: nenhum canal ativo.");
      return;
    }

    if (!channel.chatId) {
      console.info("[VALIDATOR_LIVE_HIT] blocked", {
        reason: "channel_without_chat_id",
        patternId: patternItem.id,
        channelId: channel.id,
        detectedRoundId: hit.detectedRoundId,
      });
      showNotice("Padrao detectado no site. Telegram nao enviado: canal sem Chat ID.");
      return;
    }

    const moduleConfig = normalizeTelegramModuleConfigs(channel.signalModules).validator;
    if (!moduleConfig.enabled) {
      console.info("[VALIDATOR_LIVE_HIT] blocked", {
        reason: "validator_module_inactive",
        patternId: patternItem.id,
        channelId: channel.id,
        detectedRoundId: hit.detectedRoundId,
      });
      showNotice("Padrao detectado no site. Telegram nao enviado: Seguir Validador esta inativo.");
      return;
    }

    const sendKey = `${patternItem.id}:${channel.id}:${hit.detectedRoundId}`;
    if (telegramSendKeysRef.current.has(sendKey) || wasTelegramNotificationSent(sendKey)) return;

    telegramSendKeysRef.current.add(sendKey);
    try {
      console.info("[VALIDATOR_LIVE_HIT] sending", {
        patternId: patternItem.id,
        channelId: channel.id,
        detectedRoundId: hit.detectedRoundId,
      });
      await postValidatorLiveHitTelegram({
        patternId: patternItem.id,
        detectedRoundId: hit.detectedRoundId,
        pattern: patternItem,
      });
      markTelegramNotificationSent(sendKey);
      console.info("[VALIDATOR_LIVE_HIT] sent", {
        patternId: patternItem.id,
        channelId: channel.id,
        detectedRoundId: hit.detectedRoundId,
      });
      showNotice(`Sinal enviado no Telegram: ${channel.name}.`);
    } catch (error) {
      telegramSendKeysRef.current.delete(sendKey);
      forgetTelegramNotificationSent(sendKey);
      console.warn("[VALIDATOR_LIVE_HIT] error", {
        patternId: patternItem.id,
        channelId: channel.id,
        detectedRoundId: hit.detectedRoundId,
        error: error instanceof Error ? error.message : String(error),
      });
      showNotice(error instanceof Error ? error.message : "Falha ao enviar sinal no Telegram.");
    }
  }

  function saveChannel() {
    if (!planLimits.telegram) {
      showNotice("Telegram fica bloqueado para o plano Free.");
      return;
    }
    const name = channelForm.name.trim() || "Canal Telegram";
    const token = channelForm.botToken.trim();
    const chatId = channelForm.chatId.trim();
    const buttonLink = channelForm.buttonLink.trim();
    const matchingChannel = channels.find((channel) => {
      const sameName = channel.name.trim().toLowerCase() === name.toLowerCase();
      const sameChat = chatId ? channel.chatId === chatId || !channel.chatId : true;
      return sameName && sameChat;
    });
    const duplicateChannel = chatId
      ? channels.find((channel) =>
          normalizeValidatorChannelCode(channel.chatId) === normalizeValidatorChannelCode(chatId) &&
          channel.id !== matchingChannel?.id
        )
      : null;
    if (duplicateChannel) {
      showNotice("Ja existe um canal com este Chat ID/codigo.");
      return;
    }
    if (channels.length >= planLimits.channels && !matchingChannel) {
      showNotice(`Seu plano permite ate ${planLimits.channels} canais.`);
      return;
    }
    if (!token && !matchingChannel?.botTokenMasked) {
      showNotice("Informe o Bot Token para salvar o canal no servidor.");
      return;
    }
    if (!chatId && !matchingChannel?.chatId) {
      showNotice("Informe o Chat ID/codigo do canal.");
      return;
    }
    const validationKey = telegramChannelValidationKey(token, chatId);
    const now = new Date().toISOString();
    const channel: ValidatorNotificationChannel = {
      id: matchingChannel?.id || createStorageId("channel"),
      userId: currentUserId(),
      name,
      botTokenMasked: token ? maskBotToken(token) : matchingChannel?.botTokenMasked || "",
      botTokenEncoded: "",
      chatId: chatId || matchingChannel?.chatId || "",
      buttonLink: buttonLink || matchingChannel?.buttonLink || "",
      isActive: channelForm.isActive,
      analyzingEnabled: channelForm.analyzingEnabled,
      analyzingCooldownRounds: Math.max(1, Number(channelForm.analyzingCooldownRounds) || 3),
      templates: {
        ...DEFAULT_MESSAGE_TEMPLATES,
        entry: channelForm.entryTemplate || DEFAULT_MESSAGE_TEMPLATES.entry,
        analyzing: channelForm.analyzingTemplate || DEFAULT_MESSAGE_TEMPLATES.analyzing,
      },
      signalModules: normalizeTelegramModuleConfigs(channelForm.signalModules),
      createdAt: matchingChannel?.createdAt || now,
      updatedAt: now,
    } as ValidatorNotificationChannel;
    setSavingChannel(true);
    void saveServerValidatorChannel(channel, token, channelValidation.key === validationKey ? channelValidation.code : "")
      .then((serverChannel) => {
        setChannels(markServerConfirmedChannels(upsertNotificationChannel(markServerConfirmedChannel(serverChannel))));
        setChannelForm((current) => ({ ...current, botToken: "", chatId: "", buttonLink: "" }));
        setChannelValidation({ key: "", code: "", validatedAt: "" });
        showNotice("Canal salvo no servidor. Token fica mascarado depois de salvo.");
      })
      .catch((error) => {
        showNotice(error instanceof Error ? error.message : "Servidor nao confirmou o canal.");
      })
      .finally(() => setSavingChannel(false));
  }

  function updateNotificationChannel(
    channel: ValidatorNotificationChannel,
    patch: Partial<ValidatorNotificationChannel>,
  ) {
    const updated = {
      ...channel,
      ...patch,
      templates: {
        ...DEFAULT_MESSAGE_TEMPLATES,
        ...channel.templates,
        ...patch.templates,
      },
      updatedAt: new Date().toISOString(),
    };
    const savePromise =
      channel.botTokenEncoded === "__cloudflare__" && patch.signalModules
        ? fetch(`/telegram/channels/${encodeURIComponent(channel.id)}`, {
            method: "PATCH",
            cache: "no-store",
            headers: validatorApiHeaders(true),
            body: JSON.stringify({ channel: { signalModules: updated.signalModules, isActive: updated.isActive } }),
          }).then(async (response) => {
            const data = (await response.json().catch(() => null)) as { channel?: ValidatorNotificationChannel; error?: string } | null;
            if (!response.ok) throw new Error(data?.error || "Servidor nao confirmou a atualizacao.");
            if (!data?.channel) throw new Error("Servidor nao retornou o canal salvo.");
            return data.channel;
          })
        : saveServerValidatorChannel(updated);
    void savePromise
      .then((serverChannel) => setChannels(markServerConfirmedChannels(upsertNotificationChannel(markServerConfirmedChannel(serverChannel)))))
      .catch((error) => {
        showNotice(error instanceof Error ? error.message : "Servidor nao confirmou a atualizacao.");
      });
  }

  function applyChannelUpdate(channel: ValidatorNotificationChannel) {
    setChannels((current) => {
      const next = replaceValidatorChannel(current, channel);
      writeNotificationChannels(next);
      return next;
    });
  }

  async function toggleNotificationChannelModule(
    channel: ValidatorNotificationChannel,
    motorKey: ValidatorTelegramModuleKey,
    enabled: boolean,
  ) {
    const currentModules = normalizeTelegramModuleConfigs(channel.signalModules);
    const optimisticChannel = markServerConfirmedChannel({
      ...channel,
      signalModules: normalizeTelegramModuleConfigs({
        ...currentModules,
        [motorKey]: {
          ...currentModules[motorKey],
          enabled,
        },
      }),
      updatedAt: new Date().toISOString(),
    });
    applyChannelUpdate(optimisticChannel);

    try {
      const serverChannel = await toggleServerValidatorMotor(channel.id, motorKey, enabled);
      applyChannelUpdate(markServerConfirmedChannel(serverChannel));
    } catch (error) {
      applyChannelUpdate(channel);
      showNotice(error instanceof Error ? error.message : "Servidor nao confirmou a ativacao do motor.");
    }
  }

  async function testChannelFromForm() {
    if (!planLimits.telegram) {
      showNotice("Telegram fica bloqueado para o plano Free.");
      return;
    }
    const botToken = channelForm.botToken.trim();
    const chatId = channelForm.chatId.trim();
    if (!botToken || !chatId) {
      showNotice("Informe Bot Token e Chat ID para procurar o grupo.");
      return;
    }
    setTestingTelegramId("form");
    try {
      const validation = await validateServerValidatorChannel(botToken, chatId);
      setChannelValidation({
        key: telegramChannelValidationKey(botToken, chatId),
        code: validation.validationCode,
        validatedAt: new Date().toISOString(),
      });
      showNotice("Conexao validada: mensagem teste enviada no Telegram.");
    } catch (error) {
      setChannelValidation({ key: "", code: "", validatedAt: "" });
      showNotice(error instanceof Error ? error.message : "Falha ao validar grupo no Telegram.");
    } finally {
      setTestingTelegramId("");
    }
  }

  async function testSavedChannel(channel: ValidatorNotificationChannel) {
    if (!isServerConfirmedChannel(channel)) {
      showNotice("Canal ainda nao foi confirmado pelo servidor. Valide e salve novamente antes de testar.");
      return;
    }
    setTestingTelegramId(channel.id);
    try {
      const result = await testServerValidatorChannel(channel.id);
      if (result.channel) {
        setChannels(markServerConfirmedChannels(upsertNotificationChannel(markServerConfirmedChannel(result.channel))));
      }
      showNotice(result.messageId ? `Teste enviado no Telegram. message_id ${result.messageId}.` : "Teste enviado no Telegram.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Canal salvo sem token ou Chat ID no servidor.");
    } finally {
      setTestingTelegramId("");
    }
  }

  async function testTelegramChannel(channel: {
    id: string;
    name: string;
    botToken: string;
    chatId: string;
    buttonLink: string;
  }) {
    setTestingTelegramId(channel.id);
    try {
      await postValidatorTelegramMessage({
        botToken: channel.botToken,
        chatId: channel.chatId,
        buttonLink: channel.buttonLink || `${window.location.origin}/app/validador`,
        message:
          "ENTRADA CONFIRMADA\n" +
          "Mesa: Bac Bo\n" +
          "\u{1F9E9} Padr\u00E3o: \u{1F534}10\u{1F535}7\u{1F7E1}6\n" +
          "\u{1F3AF} Entrada: \u{1F534} BANKER\n" +
          "\u{1F6E1}\uFE0F Prote\u00E7\u00E3o: At\u00E9 G1\n" +
          "\u{1F91D} Prote\u00E7\u00E3o Tie: Ativa\n" +
          `Canal: ${channel.name}`,
        buttonLabel: "Abrir Sniper Bo IA",
      });
      showNotice("Teste enviado no Telegram.");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Falha ao enviar teste no Telegram.");
    } finally {
      setTestingTelegramId("");
    }
  }

  function removeChannel(id: string) {
    const channel = channels.find((item) => item.id === id);
    const idsToRemove = new Set([id]);
    if (channel) {
      const channelKey = validatorChannelDedupeKey(channel);
      for (const item of channels) {
        if (validatorChannelDedupeKey(item) === channelKey) idsToRemove.add(item.id);
      }
    }
    const next = channels.filter((item) => !idsToRemove.has(item.id));
    writeNotificationChannels(next);
    setChannels(next);
    for (const channelId of idsToRemove) {
      removeNotificationChannel(channelId);
      void deleteServerValidatorChannel(channelId);
    }
    showNotice(idsToRemove.size > 1 ? `${idsToRemove.size} canais duplicados removidos.` : "Canal removido.");
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  const currentChannelValidationKey = telegramChannelValidationKey(
    channelForm.botToken,
    channelForm.chatId,
  );
  const isChannelFormValidated = Boolean(
    currentChannelValidationKey &&
    channelValidation.key === currentChannelValidationKey &&
    channelValidation.code,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-black text-gradient-brand">Validador Neural de Estrategias</h1>
            <AppBadge tone="blue" pulse>Módulo premium</AppBadge>
            <AppBadge tone="green">Motor independente</AppBadge>
          </div>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Monte, valide, salve e monitore estrategias usando apenas historico real coletado pela plataforma.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone={hasHistory ? "green" : "amber"}>
            {hasHistory ? `${historyRounds.length.toLocaleString("pt-BR")} rodadas reais` : "Sem historico real"}
          </AppBadge>
          <AppBadge tone={serverHistory.length ? "green" : serverHistoryStatus === "loading" ? "blue" : "amber"}>
            Banco Validador: {serverHistory.length.toLocaleString("pt-BR")}
          </AppBadge>
          <AppBadge tone={fullAccess ? "green" : "amber"}>{planLimits.label}</AppBadge>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 px-4 py-3 text-sm text-neon-cyan">
          {notice}
        </div>
      )}

      <SitePatternAlerts
        alerts={siteAlerts}
        onDismiss={(id) => setSiteAlerts((current) => current.filter((hit) => hit.id !== id))}
        onClear={() => setSiteAlerts([])}
      />

      {!hasHistory && (
        <GlassCard className="border-warning/40">
          <div className="flex items-start gap-3">
            <DatabaseZap className="mt-0.5 size-5 text-warning" />
            <div>
              <div className="text-sm font-black text-warning">Aguardando historico real da mesa</div>
              <p className="mt-1 text-xs text-muted-foreground">
                O validador nao calcula green, red ou assertividade com dados ficticios. Assim que a mesa enviar rodadas reais para o banco do Validador, a validacao fica ativa.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-5">
          <TabsTrigger value="dashboard" className="gap-1.5"><Activity className="size-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="channels" className="gap-1.5"><Send className="size-3.5" /> Central Telegram</TabsTrigger>
          <TabsTrigger value="validator" className="gap-1.5"><ShieldCheck className="size-3.5" /> Validador</TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5"><Wand2 className="size-3.5" /> IA de Padroes</TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5"><Save className="size-3.5" /> Padroes Salvos</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <DashboardTab
            hasHistory={hasHistory}
            liveHits={liveHits}
            savedPatterns={savedPatterns}
            suggestions={suggestions}
            channels={channels}
            historyRounds={historyRounds}
          />
        </TabsContent>

        <TabsContent value="validator" className="space-y-4">
          <ValidatorTab
            pattern={pattern}
            setPattern={setPattern}
            tokenScore={tokenScore}
            setTokenScore={setTokenScore}
            addToken={addToken}
            config={config}
            setConfig={setConfig}
            manualResult={manualResult}
            saveCurrentPattern={saveCurrentPattern}
            saveAndClearPattern={saveAndClearPattern}
            hasHistory={hasValidationHistory}
            savedPatternName={currentSavedPattern?.name ?? ""}
            recentSavedPatterns={savedPatterns.slice(0, 4)}
          />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AiPatternsTab
            filters={filters}
            setFilters={setFilters}
            suggestions={suggestions}
            hasHistory={hasHistory}
            aiEnabled={planLimits.ai}
            historyLimit={planLimits.history}
            onValidateSuggestion={(suggestion) => {
              setPattern(suggestion.pattern);
              setManualResult(suggestion.validation);
              showNotice("Sugestao carregada no validador.");
            }}
            onSaveSuggestion={saveSuggestion}
          />
        </TabsContent>

        <TabsContent value="saved" className="space-y-4">
          <SavedPatternsTab
            patterns={savedPatterns}
            channels={channels}
            onRemove={removePattern}
            onRefresh={refreshPattern}
            onReset={resetPatternScore}
            onToggle={(patternItem) => {
              const updated = { ...patternItem, isActive: !patternItem.isActive, updatedAt: new Date().toISOString() };
              setSavedPatterns(upsertSavedPattern(updated));
              void saveServerValidatorPattern(updated);
            }}
            onUpdate={updateSavedPattern}
            onBulkDeliveryUpdate={updateAllSavedPatternDelivery}
          />
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <CentralTelegramTab
            channels={channels}
            channelForm={channelForm}
            setChannelForm={setChannelForm}
            onSave={saveChannel}
            onRemove={removeChannel}
            onTestForm={testChannelFromForm}
            onTestChannel={testSavedChannel}
            onUpdateChannel={updateNotificationChannel}
            onToggleModule={toggleNotificationChannelModule}
            isChannelFormValidated={isChannelFormValidated}
            savingChannel={savingChannel}
            telegramEnabled={planLimits.telegram}
            testingTelegramId={testingTelegramId}
            recentNotifications={recentTelegramNotifications}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SitePatternAlerts({
  alerts,
  onDismiss,
  onClear,
}: {
  alerts: LiveValidatorHit[];
  onDismiss: (id: string) => void;
  onClear: () => void;
}) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wide text-neon-cyan">Sinais do site</div>
        {alerts.length > 1 && (
          <Button type="button" size="sm" variant="secondary" onClick={onClear}>
            Limpar sinais
          </Button>
        )}
      </div>
      {alerts.map((hit) => (
        <GlassCard key={hit.id} className="border-neon-cyan/50 bg-neon-cyan/10 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-neon-cyan">
                <BellRing className="size-4" /> PADRAO SALVO DETECTADO
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Mesa: <span className="font-bold text-foreground">{hit.pattern.tableId || "Bac Bo"}</span>
                <span className="mx-2">|</span>
                Rodada: <span className="font-bold text-foreground">{hit.detectedRoundId}</span>
              </div>
              <div className="mt-2">
                <PatternLine pattern={hit.pattern.pattern} pulledSide={hit.entry} />
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="rounded-xl border border-border/70 bg-background/45 px-3 py-2 text-xs">
                Entrada: <SideLabel side={hit.entry} />
                <span className="mx-2 text-muted-foreground">|</span>
                Gale: ate G{hit.pattern.galeLimit}
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => onDismiss(hit.id)}>
                Fechar
              </Button>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function DashboardTab({
  hasHistory,
  liveHits,
  savedPatterns,
  suggestions,
  channels,
  historyRounds,
}: {
  hasHistory: boolean;
  liveHits: LiveValidatorHit[];
  savedPatterns: SavedValidatorPattern[];
  suggestions: PatternSuggestion[];
  channels: ValidatorNotificationChannel[];
  historyRounds: Round[];
}) {
  const activePatterns = savedPatterns.filter((pattern) => pattern.isActive);
  const totalWins = savedPatterns.reduce((sum, pattern) => sum + pattern.wins, 0);
  const totalLosses = savedPatterns.reduce((sum, pattern) => sum + pattern.losses, 0);
  const accuracy = totalWins + totalLosses ? (totalWins / (totalWins + totalLosses)) * 100 : undefined;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Metric label="Padroes salvos" value={savedPatterns.length} icon={<Layers3 className="size-4" />} />
        <Metric label="Ativos" value={activePatterns.length} icon={<Eye className="size-4" />} tone="text-neon-cyan" />
        <Metric label="Canais" value={channels.length} icon={<Send className="size-4" />} />
        <Metric label="Rodadas reais" value={historyRounds.length} icon={<History className="size-4" />} tone="text-success" />
        <Metric label="Assertividade" value={formatPercent(accuracy)} icon={<Trophy className="size-4" />} tone="text-neon-cyan" />
      </div>

      {liveHits.length ? (
        <div className="space-y-3">
          {liveHits.map((hit) => (
            <GlassCard key={hit.id} className="border-neon-cyan/40">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-neon-cyan">
                    <BellRing className="size-4" /> PADRAO SALVO DETECTADO
                  </div>
                  <div className="mt-2 text-sm">
                    Mesa: <span className="font-bold">Bac Bo</span>
                  </div>
                  <div className="mt-1">
                    <PatternLine pattern={hit.pattern.pattern} pulledSide={hit.entry} />
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-secondary/25 p-3 text-xs">
                  <div>Entrada: <SideLabel side={hit.entry} /></div>
                  <div>Gale: ate G{hit.pattern.galeLimit}</div>
                  <div>Destino: {destinationLabel(hit.pattern.destination)}</div>
                  <div>Detectado na rodada {hit.detectedRoundId}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="flex items-start gap-3">
            <Bot className="mt-0.5 size-5 text-neon-cyan" />
            <div>
              <div className="text-sm font-black">Monitoramento ao vivo</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {hasHistory
                  ? "Nenhum padrao salvo apareceu nas ultimas rodadas."
                  : "Aguardando historico real para monitorar os padroes salvos."}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionTitle title="Estrategias quentes da IA" subtitle="Top sugestoes calculadas com o historico real disponivel." />
          <div className="mt-4 space-y-2">
            {suggestions.slice(0, 4).map((suggestion, index) => (
              <SuggestionRow key={suggestion.id} suggestion={suggestion} rank={index + 1} />
            ))}
            {!suggestions.length && (
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
                Nenhuma sugestao com amostra suficiente no filtro atual.
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Ultimos padroes salvos" subtitle="Contadores proprios, separados dos outros motores." />
          <div className="mt-4 space-y-2">
            {savedPatterns.slice(0, 4).map((pattern) => (
              <div key={pattern.id} className="rounded-xl border border-border/70 bg-secondary/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">{pattern.name}</div>
                    <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} compact />
                  </div>
                  <AppBadge tone={pattern.isActive ? "green" : "muted"}>{pattern.isActive ? "ativo" : "inativo"}</AppBadge>
                </div>
              </div>
            ))}
            {!savedPatterns.length && (
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 text-xs text-muted-foreground">
                Nenhum padrao salvo ainda.
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ValidatorTab(props: {
  pattern: ValidatorPatternToken[];
  setPattern: (pattern: ValidatorPatternToken[]) => void;
  tokenScore: string;
  setTokenScore: (score: string) => void;
  addToken: (side: RoundResult, score?: string) => void;
  config: ValidatorConfig;
  setConfig: (config: ValidatorConfig) => void;
  manualResult: ValidatorResult | null;
  saveCurrentPattern: () => boolean;
  saveAndClearPattern: () => void;
  hasHistory: boolean;
  savedPatternName: string;
  recentSavedPatterns: SavedValidatorPattern[];
}) {
  const {
    pattern,
    setPattern,
    tokenScore,
    setTokenScore,
    addToken,
    config,
    setConfig,
    manualResult,
    saveCurrentPattern,
    saveAndClearPattern,
    hasHistory,
    savedPatternName,
    recentSavedPatterns,
  } = props;

  const [showDetails, setShowDetails] = useState(false);
  const isPatternSaved = Boolean(savedPatternName);
  const canSave = pattern.length >= 1 && !isPatternSaved;
  const totalSignals = manualResult?.totalSignals ?? 0;
  const setGaleLimit = (value: number) => {
    setConfig({ ...config, galeLimit: Math.min(2, Math.max(0, value)) as ValidatorGaleLimit });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-2.5">
      <GlassCard>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.44fr)]">
          <div className="space-y-3">
            <div className="rounded-xl border border-border/60 bg-background/30 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Padrao</div>
                    {isPatternSaved && <AppBadge tone="blue">Padrao ja salvo</AppBadge>}
                  </div>
                  <CompactPatternLine
                    pattern={pattern}
                    className="mt-2"
                    onRemove={(index) => setPattern(pattern.filter((_, tokenIndex) => tokenIndex !== index))}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <IconToolButton label="Inverter" onClick={() => setPattern(pattern.map(invertToken))}>
                    <RotateCcw className="size-4" />
                  </IconToolButton>
                  <IconToolButton label="Remover" onClick={() => setPattern(pattern.slice(0, -1))} disabled={!pattern.length}>
                    <Trash2 className="size-4" />
                  </IconToolButton>
                  <IconToolButton label="Limpar" onClick={() => setPattern([])}>
                    <Eraser className="size-4" />
                  </IconToolButton>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <QuickToken side="B" score={tokenScore} label="Banker" onClick={addToken} />
                <QuickToken side="P" score={tokenScore} label="Player" onClick={addToken} />
                <QuickToken side="T" score={tokenScore} label="Tie" onClick={addToken} />
                <Input
                  value={tokenScore}
                  onChange={(event) => setTokenScore(event.target.value)}
                  inputMode="numeric"
                  placeholder="Numero"
                  className="h-8 w-20 bg-secondary/30 text-center text-xs"
                />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Input
                  value={config.name}
                  onChange={(event) => setConfig({ ...config, name: event.target.value })}
                  placeholder="Nome do padrao"
                  className="h-9 bg-secondary/30 text-sm"
                />
                <div className="rounded-lg border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
                  Apareceu <span className="font-black text-neon-cyan">{totalSignals}</span> vezes
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <SimpleInfoCard label="Entrada">
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  <EntrySideButton
                    side="B"
                    selected={config.entryType === "BANKER"}
                    onClick={() => setConfig({ ...config, entryType: "BANKER" })}
                  />
                  <EntrySideButton
                    side="P"
                    selected={config.entryType === "PLAYER"}
                    onClick={() => setConfig({ ...config, entryType: "PLAYER" })}
                  />
                </div>
              </SimpleInfoCard>

              <SimpleInfoCard label="Gale">
                <div className="mt-2 flex h-8 items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-2">
                  <button type="button" className="px-2 text-muted-foreground hover:text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) - 1)}>-</button>
                  <span className="text-xs font-black">Até G{Number(config.galeLimit)}</span>
                  <button type="button" className="px-2 text-muted-foreground hover:text-neon-cyan" onClick={() => setGaleLimit(Number(config.galeLimit) + 1)}>+</button>
                </div>
              </SimpleInfoCard>

              <SimpleInfoCard label="Proteção no empate">
                <label className="mt-2 flex h-8 cursor-pointer items-center justify-between rounded-md border border-border/60 bg-secondary/20 px-3 text-xs">
                  <span className="font-black">{config.tieProtection ? "Ativa" : "Inativa"}</span>
                  <Checkbox
                    checked={config.tieProtection}
                    onCheckedChange={(checked) => setConfig({ ...config, tieProtection: checked === true })}
                    className="border-warning data-[state=checked]:bg-warning data-[state=checked]:text-background"
                  />
                </label>
              </SimpleInfoCard>
            </div>

            <div>
              {isPatternSaved && (
                <div className="mb-2 rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-xs font-bold text-neon-cyan">
                  Padrao ja salvo{savedPatternName ? `: ${savedPatternName}` : ""}.
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" className="btn-primary-grad w-full" onClick={() => saveCurrentPattern()} disabled={!canSave}>
                  {isPatternSaved ? "Padrao ja salvo" : "Salvar Padrao"}
                </Button>
                <Button type="button" variant="secondary" className="w-full" onClick={saveAndClearPattern} disabled={!canSave}>
                  Salvar e limpar
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <ValidationSummaryPanel
              result={manualResult}
              hasHistory={hasHistory}
              config={config}
              onToggleDetails={() => setShowDetails((value) => !value)}
              showDetails={showDetails}
            />
            <RecentSavedPatternsPanel patterns={recentSavedPatterns} />
          </div>
        </div>
      </GlassCard>

      {showDetails && <ValidationDetailsPanel result={manualResult} config={config} />}
    </div>
  );
}

function RecentSavedPatternsPanel({ patterns }: { patterns: SavedValidatorPattern[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Salvos recentes</div>
        <span className="text-[10px] font-bold text-muted-foreground">{patterns.length}</span>
      </div>
      <div className="mt-3 space-y-2">
        {patterns.map((pattern) => (
          <div key={pattern.id} className="rounded-lg border border-border/50 bg-secondary/15 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-xs font-black">{pattern.name}</div>
                <div className="mt-1">
                  <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} compact />
                </div>
              </div>
              <span className="shrink-0 text-xs font-black text-neon-cyan">
                {formatPercent(pattern.validation?.accuracy)}
              </span>
            </div>
          </div>
        ))}
        {!patterns.length && (
          <div className="rounded-lg border border-border/50 bg-secondary/15 px-3 py-2 text-xs text-muted-foreground">
            Nenhum padrao salvo ainda.
          </div>
        )}
      </div>
    </div>
  );
}

function AiPatternsTab({
  filters,
  setFilters,
  suggestions,
  hasHistory,
  aiEnabled,
  historyLimit,
  onValidateSuggestion,
  onSaveSuggestion,
}: {
  filters: PatternMiningFilters;
  setFilters: (filters: PatternMiningFilters) => void;
  suggestions: PatternSuggestion[];
  hasHistory: boolean;
  aiEnabled: boolean;
  historyLimit: number;
  onValidateSuggestion: (suggestion: PatternSuggestion) => void;
  onSaveSuggestion: (suggestion: PatternSuggestion) => void;
}) {
  return (
    <div className="space-y-4">
      <GlassCard>
        <SectionTitle title="Filtros da IA" subtitle="A IA minera apenas o historico real da mesa." />
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="Historico">
            <Select value={String(filters.historySize)} onValueChange={(value) => setFilters({ ...filters, historySize: Math.min(Number(value), historyLimit) })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableHistoryOptions(historyLimit).map((option) => <SelectItem key={option} value={String(option)}>{option / 1000}k</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tamanho">
            <Select value={String(filters.patternLength)} onValueChange={(value) => setFilters({ ...filters, patternLength: Number(value) })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2, 3, 4, 5].map((value) => <SelectItem key={value} value={String(value)}>{value} resultados</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Entrada">
            <Select value={filters.entryType} onValueChange={(value) => setFilters({ ...filters, entryType: value as ValidatorEntryType })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTRY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Gale maximo">
            <Select value={String(filters.galeLimit)} onValueChange={(value) => setFilters({ ...filters, galeLimit: Number(value) as ValidatorGaleLimit })}>
              <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">SG</SelectItem>
                <SelectItem value="1">G1</SelectItem>
                <SelectItem value="2">G2</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assertividade minima">
            <Input type="number" value={filters.minAccuracy} onChange={(event) => setFilters({ ...filters, minAccuracy: Number(event.target.value) || 0 })} />
          </Field>
          <Field label="Minimo aparicoes">
            <Input type="number" value={filters.minOccurrences} onChange={(event) => setFilters({ ...filters, minOccurrences: Number(event.target.value) || 1 })} />
          </Field>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <FilterSwitch label="Incluir Tie" checked={filters.includeTie} onCheckedChange={(checked) => setFilters({ ...filters, includeTie: checked })} />
          <FilterSwitch label="Incluir numeros" checked={filters.includeNumbers} onCheckedChange={(checked) => setFilters({ ...filters, includeNumbers: checked })} />
          <FilterSwitch label="Lado oposto" checked={filters.includeOpposite} onCheckedChange={(checked) => setFilters({ ...filters, includeOpposite: checked })} />
          <FilterSwitch label="Apenas quentes" checked={filters.hotOnly} onCheckedChange={(checked) => setFilters({ ...filters, hotOnly: checked })} />
          <FilterSwitch label="Baixo RED" checked={filters.lowRedOnly} onCheckedChange={(checked) => setFilters({ ...filters, lowRedOnly: checked })} />
        </div>
      </GlassCard>

      {!aiEnabled && (
        <GlassCard className="border-warning/40">
          <div className="text-sm font-black text-warning">IA de Padroes liberada para VIP/Admin.</div>
          <p className="mt-1 text-xs text-muted-foreground">Clientes Free podem validar poucos padroes manualmente, sem mineracao completa.</p>
        </GlassCard>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <SuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            rank={index + 1}
            onValidate={() => onValidateSuggestion(suggestion)}
            onSave={() => onSaveSuggestion(suggestion)}
          />
        ))}
      </div>
      {hasHistory && aiEnabled && !suggestions.length && (
        <GlassCard>
          <div className="text-sm text-muted-foreground">Nenhum padrao encontrou a assertividade minima com amostra real suficiente.</div>
        </GlassCard>
      )}
    </div>
  );
}

function SavedPatternsTab({
  patterns,
  channels,
  onRemove,
  onRefresh,
  onReset,
  onToggle,
  onUpdate,
  onBulkDeliveryUpdate,
}: {
  patterns: SavedValidatorPattern[];
  channels: ValidatorNotificationChannel[];
  onRemove: (id: string) => void;
  onRefresh: (pattern: SavedValidatorPattern) => void;
  onReset: (pattern: SavedValidatorPattern) => void;
  onToggle: (pattern: SavedValidatorPattern) => void;
  onUpdate: (pattern: SavedValidatorPattern, patch: Partial<SavedValidatorPattern>) => void;
  onBulkDeliveryUpdate: (destination: ValidatorDestination, telegramChannelId: string) => void;
}) {
  const [bulkDestination, setBulkDestination] = useState<ValidatorDestination>("site_telegram");
  const [bulkChannelId, setBulkChannelId] = useState("");
  const activeChannels = channels.filter((channel) => channel.isActive);
  const selectedBulkChannelId = bulkChannelId || activeChannels[0]?.id || channels[0]?.id || "";
  const bulkNeedsTelegram = bulkDestination === "telegram" || bulkDestination === "site_telegram";

  return (
    <div className="space-y-3">
      <GlassCard className="rounded-xl p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] lg:items-start">
          <SectionTitle
            title="Padroes salvos"
            subtitle="Configure destino, canal e mensagem somente depois que o padrao estiver salvo."
          />
          <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-3">
            <div className="text-xs font-black uppercase tracking-wider text-neon-cyan">
              Envio em massa
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Select
                value={bulkDestination}
                onValueChange={(value) => setBulkDestination(value as ValidatorDestination)}
              >
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site">Todos no site</SelectItem>
                  <SelectItem value="telegram">Todos no Telegram</SelectItem>
                  <SelectItem value="site_telegram">Site + Telegram</SelectItem>
                  <SelectItem value="monitor">Apenas monitorar</SelectItem>
                  <SelectItem value="disabled">Desativar envio</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={selectedBulkChannelId || "none"}
                onValueChange={(value) => setBulkChannelId(value === "none" ? "" : value)}
                disabled={!bulkNeedsTelegram}
              >
                <SelectTrigger className="bg-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum canal</SelectItem>
                  {channels.map((channel) => (
                    <SelectItem key={channel.id} value={channel.id}>
                      {channel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              className="btn-primary-grad mt-3 w-full"
              onClick={() => onBulkDeliveryUpdate(bulkDestination, bulkNeedsTelegram ? selectedBulkChannelId : "")}
              disabled={!patterns.length || (bulkNeedsTelegram && !selectedBulkChannelId)}
            >
              Aplicar em todos os padroes
            </Button>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Atualiza todos os padroes salvos de uma vez. O canal individual pode ser ajustado depois.
            </p>
          </div>
        </div>
      </GlassCard>
      {patterns.map((pattern) => {
        const channel = channels.find((item) => item.id === pattern.telegramChannelId);
        return (
          <GlassCard key={pattern.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-black">{pattern.name}</h3>
                  <AppBadge tone={pattern.isActive ? "green" : "muted"}>{pattern.isActive ? "ativo" : "inativo"}</AppBadge>
                  <AppBadge tone="blue">{destinationLabel(pattern.destination)}</AppBadge>
                </div>
                <PatternLine pattern={pattern.pattern} pulledSide={pattern.pulledSide} />
                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-7">
                  <MiniStat label="Entrada" value={sideName(pattern.pulledSide)} />
                  <MiniStat label="Gale" value={`G${pattern.galeLimit}`} />
                  <MiniStat label="Tie" value={pattern.tieProtection ? "protegido" : "normal"} />
                  <MiniStat label="Sinais" value={pattern.validation?.totalSignals ?? 0} />
                  <MiniStat label="Green" value={pattern.wins} tone="text-success" />
                  <MiniStat label="Red" value={pattern.losses} tone="text-destructive" />
                  <MiniStat label="Assert." value={formatPercent(pattern.validation?.accuracy)} tone="text-neon-cyan" />
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Canal: {channel?.name || "nenhum"} | Ultima deteccao: {pattern.lastDetectedAt ? new Date(pattern.lastDetectedAt).toLocaleString("pt-BR") : "ainda nao detectado"}
                </div>
                <details className="rounded-xl border border-border/60 bg-background/30 p-3 text-xs">
                  <summary className="cursor-pointer font-bold text-muted-foreground">Configurar envio</summary>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <Input
                      value={pattern.name}
                      onChange={(event) => onUpdate(pattern, { name: event.target.value })}
                      placeholder="Nome da estrategia"
                    />
                    <Input
                      value={pattern.tableId}
                      onChange={(event) => onUpdate(pattern, { tableId: event.target.value })}
                      placeholder="Mesa"
                    />
                    <Select
                      value={pattern.destination}
                      onValueChange={(value) => onUpdate(pattern, { destination: value as ValidatorDestination })}
                    >
                      <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DESTINATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={pattern.telegramChannelId || "none"}
                      onValueChange={(value) => onUpdate(pattern, { telegramChannelId: value === "none" ? "" : value })}
                    >
                      <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum canal</SelectItem>
                        {channels.map((channelItem) => (
                          <SelectItem key={channelItem.id} value={channelItem.id}>{channelItem.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={pattern.cooldownRounds}
                      onChange={(event) => onUpdate(pattern, { cooldownRounds: Math.max(0, Number(event.target.value) || 0) })}
                      type="number"
                      placeholder="Cooldown"
                    />
                    <div className="flex min-h-9 items-center rounded-md border border-border/60 bg-secondary/20 px-3 text-xs text-muted-foreground">
                      Destino atual: {destinationLabel(pattern.destination)}
                    </div>
                  </div>
                  <Textarea
                    value={pattern.messageOverride ?? ""}
                    onChange={(event) => onUpdate(pattern, { messageOverride: event.target.value })}
                    placeholder="Mensagem personalizada opcional. Use {{pattern}}, {{entry}}, {{percentage}}, {{table}}"
                    className="mt-3 min-h-20"
                  />
                </details>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <Button type="button" variant="secondary" size="sm" onClick={() => onToggle(pattern)}>
                  {pattern.isActive ? "Desativar" : "Ativar"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onRefresh(pattern)}>
                  Atualizar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => onReset(pattern)}>
                  Zerar
                </Button>
                <Button type="button" variant="destructive" size="sm" onClick={() => onRemove(pattern.id)}>
                  Excluir
                </Button>
              </div>
            </div>
          </GlassCard>
        );
      })}
      {!patterns.length && (
        <GlassCard>
          <div className="text-sm text-muted-foreground">Nenhum padrao salvo ainda. Valide uma estrategia e clique em salvar padrao.</div>
        </GlassCard>
      )}
    </div>
  );
}

function CentralTelegramTab({
  channels,
  channelForm,
  setChannelForm,
  onSave,
  onRemove,
  onTestForm,
  onTestChannel,
  onUpdateChannel,
  onToggleModule,
  isChannelFormValidated,
  savingChannel,
  telegramEnabled,
  testingTelegramId,
  recentNotifications,
}: {
  channels: ValidatorNotificationChannel[];
  channelForm: ChannelFormState;
  setChannelForm: (form: ChannelFormState) => void;
  onSave: () => void;
  onRemove: (id: string) => void;
  onTestForm: () => void;
  onTestChannel: (channel: ValidatorNotificationChannel) => void;
  onUpdateChannel: (channel: ValidatorNotificationChannel, patch: Partial<ValidatorNotificationChannel>) => void;
  onToggleModule: (
    channel: ValidatorNotificationChannel,
    motorKey: ValidatorTelegramModuleKey,
    enabled: boolean,
  ) => Promise<void>;
  isChannelFormValidated: boolean;
  savingChannel: boolean;
  telegramEnabled: boolean;
  testingTelegramId: string;
  recentNotifications: ValidatorTelegramNotification[];
}) {
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedModuleKey, setSelectedModuleKey] = useState<ValidatorTelegramModuleKey>("ai_patterns");
  const [configuringModuleKey, setConfiguringModuleKey] = useState<ValidatorTelegramModuleKey | null>(null);
  const validatingChannelForm = testingTelegramId === "form";
  const saveBlockedByValidation = false;
  const selectedChannel =
    channels.find((channel) => channel.id === selectedChannelId) ||
    channels.find((channel) => channel.isActive) ||
    channels[0] ||
    null;
  const selectedChannelModules = selectedChannel ? channelSignalModules(selectedChannel) : defaultTelegramModuleConfigs();
  const selectedChannelServerConfirmed = isServerConfirmedChannel(selectedChannel);
  const selectedConnectionStatus = telegramChannelConnectionStatus(selectedChannel);
  const connected = Boolean(
    selectedChannelServerConfirmed &&
      selectedConnectionStatus === "connected" &&
      selectedChannel?.isActive &&
      selectedChannel.chatId &&
      (selectedChannel.botTokenMasked || (selectedChannel as ValidatorChannelWithModules).botTokenEncoded),
  );
  const engineActive = connected && TELEGRAM_MODULE_OPTIONS.some((option) => selectedChannelModules[option.key]?.enabled);
  const activeConfigModuleKey = configuringModuleKey || selectedModuleKey;

  function patchChannelModule(key: ValidatorTelegramModuleKey, patch: Partial<ValidatorTelegramModuleConfig>) {
    if (!selectedChannel || !connected) return;
    if (typeof patch.enabled === "boolean" && Object.keys(patch).length === 1) {
      void onToggleModule(selectedChannel, key, patch.enabled);
      return;
    }
    const nextModules = normalizeTelegramModuleConfigs({
      ...selectedChannelModules,
      [key]: {
        ...selectedChannelModules[key],
        ...patch,
      },
    });
    onUpdateChannel(selectedChannel, {
      signalModules: nextModules,
    } as Partial<ValidatorNotificationChannel>);
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="space-y-4">
          <GlassCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SectionTitle title="Central Telegram" subtitle="Disparo direto pela API, sem precisar deixar o site aberto." />
              <div className="flex flex-wrap gap-2">
                <AppBadge tone={connected ? "green" : "amber"}>{connected ? "Canal conectado" : "Canal pendente"}</AppBadge>
                <AppBadge tone={engineActive ? "green" : "amber"}>{engineActive ? "Motor ativo" : "Motor inativo"}</AppBadge>
              </div>
            </div>
          </GlassCard>

          {!telegramEnabled && (
            <GlassCard className="border-warning/40">
              <div className="text-sm font-black text-warning">Telegram bloqueado no plano Free.</div>
            </GlassCard>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {TELEGRAM_MODULE_OPTIONS.map((option) => {
              const moduleConfig = selectedChannelModules[option.key] || defaultTelegramModuleConfig(option.key);
              return (
                <TelegramModeCard
                  key={option.key}
                  name={option.label}
                  description={telegramModuleDescription(option.key)}
                  active={Boolean(moduleConfig.enabled)}
                  disabled={!telegramEnabled || !connected}
                  selected={selectedModuleKey === option.key}
                  onToggle={() => patchChannelModule(option.key, { enabled: !moduleConfig.enabled })}
                  onConfigure={() => {
                    setSelectedModuleKey(option.key);
                    setConfiguringModuleKey(option.key);
                  }}
                />
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <GlassCard>
            <SectionTitle title="Status do motor" subtitle={selectedChannel?.name || "Nenhum canal selecionado"} />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <MiniStat label="Canal" value={connected ? "Conectado" : "Pendente"} tone={connected ? "text-success" : "text-warning"} />
              <MiniStat label="Motor" value={engineActive ? "Ativo" : "Inativo"} tone={engineActive ? "text-success" : "text-warning"} />
            </div>
            {channels.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Field label="Canal Telegram">
                  <Select value={selectedChannel?.id || ""} onValueChange={setSelectedChannelId}>
                    <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-5 h-9"
                  onClick={() => selectedChannel && onTestChannel(selectedChannel)}
                  disabled={!telegramEnabled || !selectedChannel || testingTelegramId === selectedChannel.id}
                >
                  <Send className="size-4" /> Testar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="mt-5 h-9"
                  onClick={() => selectedChannel && onRemove(selectedChannel.id)}
                  disabled={!selectedChannel}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}
          </GlassCard>

          {!channels.length ? (
            <GlassCard>
              <SectionTitle title="Conectar Telegram" subtitle="Cadastre e valide o grupo primeiro." />
              <div className="mt-4 space-y-3">
                <Field label="Nome do canal">
                  <Input value={channelForm.name} onChange={(event) => setChannelForm({ ...channelForm, name: event.target.value })} />
                </Field>
                <Field label="Bot Token">
                  <Input
                    type="password"
                    autoComplete="off"
                    value={channelForm.botToken}
                    onChange={(event) => setChannelForm({ ...channelForm, botToken: event.target.value })}
                    placeholder="8825...F69U"
                  />
                </Field>
                <Field label="Chat ID">
                  <Input value={channelForm.chatId} onChange={(event) => setChannelForm({ ...channelForm, chatId: event.target.value })} />
                </Field>
                {(validatingChannelForm || isChannelFormValidated) && (
                  <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                    isChannelFormValidated
                      ? "border-success/35 bg-success/10 text-success"
                      : "border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan"
                  }`}>
                    {validatingChannelForm ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    {validatingChannelForm ? "Validando Telegram..." : "Conexao validada com teste real"}
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className={`w-full ${isChannelFormValidated ? "border-success/40 bg-success/10 text-success hover:bg-success/15" : ""}`}
                    onClick={onTestForm}
                    disabled={!telegramEnabled || validatingChannelForm || savingChannel}
                  >
                    {validatingChannelForm ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                    {isChannelFormValidated ? "Conexao validada" : "Procurar grupo"}
                  </Button>
                  <Button
                    type="button"
                    className="w-full btn-primary-grad"
                    onClick={onSave}
                    disabled={!telegramEnabled || savingChannel || validatingChannelForm || saveBlockedByValidation}
                  >
                    {savingChannel ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Salvar canal
                  </Button>
                </div>
              </div>
            </GlassCard>
          ) : null}

          <TelegramDayPerformanceCards notifications={recentNotifications} />
          <RecentTelegramSignals notifications={recentNotifications} />
        </div>
      </div>

      <Sheet open={Boolean(configuringModuleKey && selectedChannel)} onOpenChange={(open) => !open && setConfiguringModuleKey(null)}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-y-auto border-neon-cyan/30 bg-background p-4 sm:max-w-2xl lg:max-w-3xl">
          <SheetHeader className="pr-8">
            <SheetTitle>Configurar {moduleDisplayName(activeConfigModuleKey)}</SheetTitle>
            <SheetDescription>
              {selectedChannel?.name || "Canal Telegram"} - templates e botoes deste motor.
            </SheetDescription>
          </SheetHeader>
          {selectedChannel ? (
            <TelegramModuleConfigPanel
              channels={channels}
              selectedChannelId={selectedChannel.id}
              onSelectedChannelChange={setSelectedChannelId}
              moduleKey={activeConfigModuleKey}
              config={selectedChannelModules[activeConfigModuleKey] || defaultTelegramModuleConfig(activeConfigModuleKey)}
              onSave={(nextConfig) => {
                patchChannelModule(activeConfigModuleKey, { ...nextConfig, enabled: true });
                setConfiguringModuleKey(null);
              }}
              onPreview={(message, buttons) => previewServerValidatorChannel(selectedChannel.id, message, buttons)}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function TelegramModeCard({
  name,
  description,
  active,
  disabled,
  selected,
  onToggle,
  onConfigure,
}: {
  name: string;
  description: string;
  active: boolean;
  disabled: boolean;
  selected: boolean;
  onToggle: () => void;
  onConfigure: () => void;
}) {
  return (
    <GlassCard className={`rounded-xl p-4 ${selected ? "border-neon-cyan/45" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-black">{name}</div>
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        </div>
        <AppBadge tone={active ? "green" : "amber"}>{active ? "Ativo" : "Inativo"}</AppBadge>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button type="button" className="h-10 w-full" variant={active ? "secondary" : "default"} onClick={onToggle} disabled={disabled}>
          {active ? "Desativar" : "Ativar"}
        </Button>
        <Button type="button" className="h-10 w-full" variant="secondary" onClick={onConfigure}>
          Configurar
        </Button>
      </div>
    </GlassCard>
  );
}

function TelegramModuleConfigPanel({
  channels,
  selectedChannelId,
  onSelectedChannelChange,
  moduleKey,
  config,
  onSave,
  onPreview,
}: {
  channels: ValidatorNotificationChannel[];
  selectedChannelId: string;
  onSelectedChannelChange: (channelId: string) => void;
  moduleKey: ValidatorTelegramModuleKey;
  config: ValidatorTelegramModuleConfig;
  onSave: (config: ValidatorTelegramModuleConfig) => void;
  onPreview: (message: string, buttons: ValidatorTelegramButtonConfig[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => normalizeTelegramModuleConfig(moduleKey, config));
  const [templateKey, setTemplateKey] = useState<ValidatorTelegramTemplateKey>("entry");
  const [validationError, setValidationError] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setDraft(normalizeTelegramModuleConfig(moduleKey, config));
    setTemplateKey("entry");
    setValidationError("");
    setPreviewStatus("");
  }, [
    moduleKey,
    config.enabled,
    config.entryType,
    config.galeLimit,
    config.coverTie,
    config.cooldownSeconds,
    config.template,
    config.analyzingTemplate,
    config.greenTemplate,
    config.galeTemplate,
    config.redTemplate,
    config.tieTemplate,
    config.expiredTemplate,
    config.canceledTemplate,
    JSON.stringify(config.buttons || []),
  ]);

  const templateOptions = telegramTemplateOptionsForModule(draft);
  const activeTemplate = getTelegramModuleTemplate(draft, templateKey);
  const variables = telegramTemplateVariablesForModule(moduleKey, templateKey);

  function saveDraft() {
    const error = validateTelegramModuleConfig(moduleKey, draft);
    setValidationError(error);
    setPreviewStatus("");
    if (error) return;
    onSave(draft);
  }

  async function sendPreview() {
    const error = validateTelegramTemplate(moduleKey, templateKey, activeTemplate);
    setValidationError(error);
    setPreviewStatus("");
    if (error) return;
    setPreviewing(true);
    try {
      await onPreview(
        `[PRÉVIA DE TESTE]\n${telegramModulePreview(moduleKey, { ...draft, template: activeTemplate })}`,
        normalizeTelegramModuleButtons(draft.buttons),
      );
      setPreviewStatus("Previa enviada no Telegram.");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Falha ao enviar previa.");
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col space-y-3">
      <Field label="Canal Telegram">
        <Select value={selectedChannelId} onValueChange={onSelectedChannelChange}>
          <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            {channels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Tipo de entrada">
        <Select
          value={draft.entryType}
          onValueChange={(value) => setDraft({ ...draft, entryType: value as ValidatorTelegramModuleConfig["entryType"] })}
        >
          <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="AUTO">Automatico</SelectItem>
            <SelectItem value="BANKER">Banker</SelectItem>
            <SelectItem value="PLAYER">Player</SelectItem>
            <SelectItem value="TIE">Tie</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Proteção de gale">
          <Select
            value={String(draft.galeLimit)}
            onValueChange={(value) => setDraft({ ...draft, galeLimit: Number(value) || 0 })}
          >
            <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sem gale</SelectItem>
              <SelectItem value="1">G1</SelectItem>
              <SelectItem value="2">G2</SelectItem>
              <SelectItem value="3">G3</SelectItem>
              <SelectItem value="4">G4</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Tempo minimo">
          <Input
            type="number"
            min={0}
            max={300}
            value={draft.cooldownSeconds}
            onChange={(event) => setDraft({
              ...draft,
              cooldownSeconds: clampTelegramModuleNumber(event.target.value, draft.cooldownSeconds, 0, 300),
            })}
          />
        </Field>
        <Field label="Cobrir empate">
          <div className="flex h-9 items-center justify-between rounded-md border border-input bg-secondary/20 px-3">
            <span className="text-sm">{draft.coverTie ? "Sim" : "Nao"}</span>
            <Switch checked={draft.coverTie} onCheckedChange={(checked) => setDraft({ ...draft, coverTie: checked })} />
          </div>
        </Field>
      </div>
      <div className="rounded-xl border border-border/70 bg-secondary/15 p-3">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-black">Mensagens do motor</div>
            <div className="mt-1 text-[11px] text-muted-foreground">Cada aba salva uma mensagem independente deste motor.</div>
          </div>
          <AppBadge tone="blue">{telegramTemplateStorageLabel(moduleKey)}</AppBadge>
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-7">
          {templateOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setTemplateKey(option.key);
                setValidationError("");
                setPreviewStatus("");
              }}
              className={`h-9 rounded-lg border px-2 text-xs font-black transition ${
                templateKey === option.key
                  ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan"
                  : "border-border/70 bg-background/30 text-muted-foreground hover:bg-secondary/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <Field label={telegramTemplateLabel(templateKey)}>
            <Textarea
              value={activeTemplate}
              onChange={(event) => setDraft(patchTelegramModuleTemplate(draft, templateKey, event.target.value))}
              className="min-h-52 resize-y font-mono text-xs"
            />
          </Field>
          <div className="rounded-lg border border-border/60 bg-background/30 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Variaveis disponiveis</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <span key={variable} className="rounded-full border border-neon-cyan/35 bg-neon-cyan/10 px-2 py-1 text-[11px] font-bold text-neon-cyan">
                  {`{{${variable}}}`}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="space-y-3 rounded-xl border border-border/70 bg-secondary/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black">Botoes do Telegram</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Ative ate 4 botoes com texto e link proprio para este modo.
            </div>
          </div>
          <AppBadge tone={draft.buttons.some((button) => button.enabled) ? "green" : "amber"}>
            {draft.buttons.filter((button) => button.enabled).length} ativo(s)
          </AppBadge>
        </div>
        <div className="space-y-2">
          {draft.buttons.map((button, index) => (
            <div key={`telegram-button-${index}`} className="rounded-lg border border-border/60 bg-background/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black">Botao {index + 1}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {button.enabled ? "Sim" : "Nao"}
                  <Switch
                    checked={button.enabled}
                    onCheckedChange={(checked) => setDraft({
                      ...draft,
                      buttons: patchTelegramModuleButton(draft.buttons, index, { enabled: checked }),
                    })}
                  />
                </div>
              </div>
              {button.enabled && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Texto do botao</span>
                    <Input
                      value={button.label}
                      maxLength={64}
                      onChange={(event) => setDraft({
                        ...draft,
                        buttons: patchTelegramModuleButton(draft.buttons, index, { label: event.target.value }),
                      })}
                      placeholder={DEFAULT_TELEGRAM_BUTTON_LABEL}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Link do botao</span>
                    <Input
                      value={button.url}
                      onChange={(event) => setDraft({
                        ...draft,
                        buttons: patchTelegramModuleButton(draft.buttons, index, { url: event.target.value }),
                      })}
                      placeholder="https://t.me/seu-canal"
                    />
                  </label>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-border/70 bg-secondary/15 p-3 text-xs">
        <div className="font-black">Preview da mensagem</div>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-muted-foreground">
          {telegramModulePreview(moduleKey, { ...draft, template: activeTemplate })}
        </pre>
      </div>
      {validationError && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive">
          {validationError}
        </div>
      )}
      {previewStatus && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs font-bold text-success">
          {previewStatus}
        </div>
      )}
      <div className="sticky bottom-0 z-10 grid gap-2 border-t border-border/60 bg-background/95 pt-3 backdrop-blur sm:grid-cols-3">
        <Button
          type="button"
          className="h-10 w-full"
          variant="secondary"
          onClick={() => setDraft(resetTelegramModuleTemplateFields(moduleKey, draft))}
        >
          <RotateCcw className="size-4" /> Restaurar padrao
        </Button>
        <Button
          type="button"
          className="h-10 w-full"
          variant="secondary"
          onClick={sendPreview}
          disabled={previewing}
        >
          {previewing ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Enviar previa
        </Button>
        <Button
          type="button"
          className="h-10 w-full btn-primary-grad"
          onClick={saveDraft}
        >
          <Save className="size-4" /> Salvar e ativar
        </Button>
      </div>
    </div>
  );
}

function TelegramDayPerformanceCards({ notifications }: { notifications: ValidatorTelegramNotification[] }) {
  const stats = telegramDayStats(notifications);
  return (
    <GlassCard>
      <SectionTitle title="Desempenho do dia" subtitle="Resumo dos disparos enviados hoje." />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniStat label="Sinais enviados hoje" value={stats.sent} tone="text-neon-cyan" />
        <MiniStat label="Greens" value={stats.greens} tone="text-success" />
        <MiniStat label="Reds" value={stats.reds} tone="text-destructive" />
        <MiniStat label="Assertividade" value={stats.assertiveness} tone="text-neon-cyan" />
        <div className="col-span-2">
          <MiniStat label="Ultimo sinal" value={stats.lastSignal} />
        </div>
      </div>
    </GlassCard>
  );
}

function RecentTelegramSignals({ notifications }: { notifications: ValidatorTelegramNotification[] }) {
  const signals = notifications.slice(0, 10);
  return (
    <GlassCard>
      <SectionTitle title="Ultimos sinais enviados" subtitle="Linha rapida do que saiu no Telegram." />
      <div className="mt-4 space-y-2">
        {signals.map((notification) => (
          <div key={notification.id} className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-2 text-xs">
            {formatTelegramSignalLine(notification)}
          </div>
        ))}
        {!signals.length && (
          <div className="rounded-lg border border-border/60 bg-secondary/15 px-3 py-3 text-xs text-muted-foreground">
            Nenhum sinal enviado ainda.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function ValidationSummaryPanel({
  result,
  hasHistory,
  config,
  onToggleDetails,
  showDetails,
}: {
  result: ValidatorResult | null;
  hasHistory: boolean;
  config: ValidatorConfig;
  onToggleDetails: () => void;
  showDetails: boolean;
}) {
  const noSampleText = !hasHistory
    ? "Banco do Validador sem rodadas"
    : !result
      ? "Aguardando validacao"
      : !result.totalValidated
        ? "Padrao sem ocorrencia validada"
        : "";

  if (noSampleText) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/30 p-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resultado</div>
        <div className="mt-3 text-sm font-black text-warning">{noSampleText}</div>
        <div className="mt-3 text-xs text-muted-foreground">
          {!hasHistory
            ? "Envie rodadas reais para o banco do Validador para liberar o calculo."
            : "Esse padrao ainda nao teve amostra finalizada no historico real disponivel."}
        </div>
      </div>
    );
  }

  const greens = result.sgWins + result.g1Wins + result.g2Wins;

  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resultado</div>
        <AppBadge tone="green">{result.status}</AppBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
        <SummaryMetric label="Assertividade" value={formatPercent(result.accuracy)} tone="text-neon-cyan" />
        <SummaryMetric label="Greens" value={greens} tone="text-success" />
        <SummaryMetric label="Reds" value={result.losses} tone="text-destructive" />
        <SummaryMetric label="Seq." value={result.currentGreenStreak} tone="text-neon-cyan" />
        <SummaryMetric label="G1" value={result.g1Wins} />
        <SummaryMetric label="Sinais" value={result.totalSignals} />
      </div>
      <div className="mt-4 rounded-lg border border-border/60 bg-secondary/15 px-3 py-2 text-xs">
        <div className="text-muted-foreground">Proteção no empate</div>
        <div className="mt-1 font-black">{config.tieProtection ? "Ativa" : "Inativa"}</div>
      </div>
      <Button type="button" variant="secondary" className="mt-4 w-full" onClick={onToggleDetails}>
        {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
      </Button>
    </div>
  );
}

function ValidationDetailsPanel({ result, config }: { result: ValidatorResult | null; config: ValidatorConfig }) {
  const selectedEntry = entryTypeToSide(config.entryType) ?? result?.entry ?? null;

  if (!result || !result.totalValidated) {
    return (
      <div className="rounded-xl border border-border/60 bg-background/35 p-4 text-sm text-warning">
        Aguardando validacao
      </div>
    );
  }

  const totalGreen = result.sgWins + result.g1Wins + result.g2Wins;

  return (
    <div className="rounded-xl border border-border/60 bg-background/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black">Detalhes da validacao</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <ResultChip label="Entrada" side={selectedEntry ?? result.entry} />
          <ResultChip label="Empate" value={config.tieProtection ? "TIE coberto" : "TIE sem cobertura"} />
          <ResultChip label="Rodadas" value={result.analyzedRounds.toLocaleString("pt-BR")} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <ResultLine label="Total de sinais" value={result.totalSignals} tone="text-neon-cyan" />
        <ResultLine label="Validados" value={result.totalValidated} />
        <ResultLine label="Sem Gale" value={formatCountPercent(result.sgWins, result.totalValidated)} tone="text-success" />
        <ResultLine label="Green G1" value={formatCountPercent(result.g1Wins, result.totalValidated)} tone="text-neon-cyan" />
        <ResultLine label="Green G2" value={formatCountPercent(result.g2Wins, result.totalValidated)} tone="text-neon-cyan" />
        <ResultLine label="Empates" value={result.ties ? result.ties : "Nenhum empate registrado."} tone="text-warning" />
        <ResultLine label="Acertos" value={formatCountPercent(totalGreen, result.totalValidated)} tone="text-success" />
        <ResultLine label="Sequencia desde o ultimo loss" value={result.currentGreenStreak} tone="text-neon-cyan" />
        <ResultLine label="Maior sequencia" value={result.bestGreenStreak} tone="text-success" />
        <ResultLine label="Maior sequencia de loss" value={result.bestLossStreak} tone="text-destructive" />
        <ResultLine label="Erros" value={formatCountPercent(result.losses, result.totalValidated)} tone="text-destructive" />
        <ResultLine label="Assertividade" value={formatPercent(result.accuracy)} tone="text-neon-cyan" />
      </div>

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
        {result.details.slice(-24).reverse().map((detail) => (
          <div key={`${detail.roundId}-${detail.status}-${detail.galeUsed}`} className="rounded-lg bg-background/35 px-3 py-2 text-xs">
            {detail.roundLabel} - Entrada <SideLabel side={detail.entry} /> - <span className={detail.status === "RED" ? "text-destructive" : detail.status === "TIE" ? "text-warning" : "text-success"}>{detail.status}</span>
          </div>
        ))}
        {!result.details.length && (
          <div className="rounded-lg bg-background/35 px-3 py-2 text-xs text-muted-foreground">
            Nenhuma rodada validada ainda para este padrao.
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionCard({
  suggestion,
  rank,
  onValidate,
  onSave,
}: {
  suggestion: PatternSuggestion;
  rank: number;
  onValidate: () => void;
  onSave: () => void;
}) {
  return (
    <GlassCard className="rounded-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black">
            Padrao IA Top {rank}
          </div>
          <div className="mt-2"><PatternLine pattern={suggestion.pattern} pulledSide={suggestion.pulledSide} /></div>
        </div>
        <AppBadge tone={suggestion.status === "quente" ? "green" : "blue"}>{suggestion.status}</AppBadge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <MiniStat label="Apareceu" value={suggestion.occurrences} />
        <MiniStat label="SG" value={suggestion.validation.sgWins} tone="text-success" />
        <MiniStat label="G1" value={suggestion.validation.g1Wins} tone="text-neon-cyan" />
        <MiniStat label="RED" value={suggestion.validation.losses} tone="text-destructive" />
        <MiniStat label="TIE" value={suggestion.validation.ties} tone="text-warning" />
        <MiniStat label="Assert." value={formatPercent(suggestion.validation.accuracy)} tone="text-neon-cyan" />
        <MiniStat label="Risco" value={suggestion.risk} />
        <MiniStat label="Loss max" value={suggestion.validation.bestLossStreak} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" className="btn-primary-grad" onClick={onValidate}>Validar</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onSave}>Salvar padrao</Button>
        <Button type="button" size="sm" variant="secondary" onClick={onSave}>Monitorar ao vivo</Button>
      </div>
    </GlassCard>
  );
}

function SuggestionRow({ suggestion, rank }: { suggestion: PatternSuggestion; rank: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="flex size-7 items-center justify-center rounded-lg bg-neon-cyan/10 font-black text-neon-cyan">{rank}</span>
        <div className="min-w-0 flex-1"><PatternLine pattern={suggestion.pattern} pulledSide={suggestion.pulledSide} compact /></div>
        <span className="font-black text-neon-cyan">{formatPercent(suggestion.validation.accuracy)}</span>
      </div>
    </div>
  );
}

function PatternLine({
  pattern,
  pulledSide,
  compact = false,
}: {
  pattern: ValidatorPatternToken[];
  pulledSide?: RoundResult | null;
  compact?: boolean;
}) {
  return (
    <div className={`flex min-w-0 flex-wrap items-end gap-x-1.5 gap-y-2 ${compact ? "text-xs" : "text-sm"}`}>
      <span className="mb-3 font-semibold text-muted-foreground">Estrategia:</span>
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-start gap-1">
          <TokenPill token={token} />
          {index < pattern.length - 1 && <span className="mt-2 text-muted-foreground">&rarr;</span>}
        </span>
      ))}
      <span className="mb-3 text-muted-foreground">= puxou</span>
      {pulledSide === undefined ? (
        <span className="mb-3 text-muted-foreground">aguardando validacao</span>
      ) : pulledSide ? (
        <span className="mb-3">
          <SideLabel side={pulledSide} />
        </span>
      ) : (
        <span className="mb-3 text-warning">sem amostra suficiente</span>
      )}
    </div>
  );
}

function TokenPill({ token }: { token: ValidatorPatternToken }) {
  const value = token.score ? String(token.score) : sideEmoji(token.side);

  return (
    <span className="inline-flex shrink-0 flex-col items-center gap-0.5">
      <span className={`inline-flex size-8 items-center justify-center rounded-full border text-[11px] font-black leading-none shadow-lg ${tokenCircleClass(token.side)}`}>
        {value}
      </span>
      <span className={`text-[8px] font-black leading-none ${sideTone(token.side)}`}>
        {sideEmoji(token.side)}
      </span>
    </span>
  );
}

function CompactPatternLine({
  pattern,
  className = "",
  onRemove,
}: {
  pattern: ValidatorPatternToken[];
  className?: string;
  onRemove?: (index: number) => void;
}) {
  if (!pattern.length) {
    return (
      <div className={`text-sm font-bold text-muted-foreground ${className}`}>
        Aguardando padrao
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-wrap items-start gap-x-2 gap-y-3 pt-1 text-base font-black ${className}`}>
      {pattern.map((token, index) => (
        <span key={`${formatToken(token)}-${index}`} className="inline-flex items-start gap-1.5">
          <span className="relative inline-flex">
            <TokenPill token={token} />
            {onRemove ? (
              <button
                type="button"
                aria-label={`Remover ${formatToken(token)}`}
                title="Remover bolinha"
                onClick={() => onRemove(index)}
                className="absolute -right-2 -top-2 inline-flex size-4 items-center justify-center rounded-full border border-border/70 bg-background text-[10px] font-black leading-none text-muted-foreground shadow-sm transition hover:border-destructive/70 hover:text-destructive"
              >
                x
              </button>
            ) : null}
          </span>
          {index < pattern.length - 1 && <span className="mt-2 text-sm text-muted-foreground">&rarr;</span>}
        </span>
      ))}
    </div>
  );
}

function SimpleInfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function SideLabel({ side }: { side: RoundResult | null | undefined }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black ${sideTone(side)}`}>
      {side ? <span className={`inline-flex size-2.5 rounded-full ${sideDotClass(side)}`} /> : null}
      {sideName(side)}
    </span>
  );
}

function QuickToken({
  side,
  score,
  label,
  onClick,
}: {
  side: RoundResult;
  score?: string;
  label: string;
  onClick: (side: RoundResult, score?: string) => void;
}) {
  const scoreText = score?.trim();

  return (
    <button
      type="button"
      onClick={() => onClick(side, score)}
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-full border px-2.5 text-xs font-black transition hover:-translate-y-0.5 ${tokenClass(side)}`}
    >
      <span className="text-base leading-none">{sideEmoji(side)}</span>
      {scoreText ? <span>{scoreText}</span> : null}
      <span>{label}</span>
    </button>
  );
}

function IconToolButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg border border-border/70 bg-secondary/20 text-muted-foreground transition hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function EntrySideButton({ side, selected, onClick }: { side: RoundResult; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-black transition ${
        selected ? `${tokenClass(side)} ring-1 ring-current` : "border-border/70 bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
      }`}
    >
      <span className="text-base leading-none">{sideEmoji(side)}</span>
      {sideName(side)}
    </button>
  );
}

function ResultChip({ label, side, value }: { label: string; side?: RoundResult | null; value?: string | number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      {side !== undefined ? <SideLabel side={side} /> : <span className="font-black">{value}</span>}
    </div>
  );
}

function ResultLine({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-bold">{label}:</span>
      <span className={`font-black ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className={`mt-1 text-base font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone?: string }) {
  return (
    <GlassCard className="rounded-xl p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className={tone ?? "text-neon-cyan"}>{icon}</span>
        {label}
      </div>
      <div className={`mt-1 text-xl font-black ${tone ?? ""}`}>{value}</div>
    </GlassCard>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-black ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilterSwitch({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function TelegramModulesEditor({
  modules,
  onChange,
}: {
  modules: Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>;
  onChange: (modules: Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>) => void;
}) {
  const normalized = normalizeTelegramModuleConfigs(modules);

  function patchModule(key: ValidatorTelegramModuleKey, patch: Partial<ValidatorTelegramModuleConfig>) {
    onChange({
      ...normalized,
      [key]: {
        ...normalized[key],
        ...patch,
      },
    });
  }

  return (
    <div className="space-y-2">
      {TELEGRAM_MODULE_OPTIONS.map((option) => {
        const moduleConfig = normalized[option.key];
        return (
          <div key={option.key} className="rounded-lg border border-border/60 bg-background/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black">{option.label}</span>
              <Switch
                checked={moduleConfig.enabled}
                onCheckedChange={(checked) => patchModule(option.key, { enabled: checked })}
              />
            </div>
            {moduleConfig.enabled && (
              <div className="mt-3 grid gap-2 lg:grid-cols-[110px_130px_130px_minmax(0,1fr)]">
                <Field label="Gale">
                  <Select
                    value={String(moduleConfig.galeLimit)}
                    onValueChange={(value) => patchModule(option.key, { galeLimit: Number(value) || 0 })}
                  >
                    <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">SG</SelectItem>
                      <SelectItem value="1">G1</SelectItem>
                      <SelectItem value="2">G2</SelectItem>
                      <SelectItem value="3">G3</SelectItem>
                      <SelectItem value="4">G4</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Empate">
                  <Select
                    value={String(moduleConfig.tieCoverage)}
                    onValueChange={(value) => patchModule(option.key, { tieCoverage: Number(value) || 0 })}
                  >
                    <SelectTrigger className="bg-secondary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Seco</SelectItem>
                      <SelectItem value="1">G1</SelectItem>
                      <SelectItem value="2">G2</SelectItem>
                      <SelectItem value="3">G3</SelectItem>
                      <SelectItem value="4">G4</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Intervalo seg.">
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={moduleConfig.cooldownSeconds}
                    onChange={(event) => patchModule(option.key, {
                      cooldownSeconds: clampTelegramModuleNumber(event.target.value, 0, 0, 300),
                    })}
                  />
                </Field>
                <Field label="Template">
                  <Textarea
                    value={moduleConfig.template}
                    onChange={(event) => patchModule(option.key, { template: event.target.value })}
                    className="min-h-20"
                  />
                </Field>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function defaultTelegramModuleConfigs() {
  return normalizeTelegramModuleConfigs({});
}

function normalizeTelegramModuleConfigs(value: unknown) {
  const record = moduleRecord(value);
  return TELEGRAM_MODULE_OPTIONS.reduce<Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>>(
    (acc, option) => {
      const defaults = defaultTelegramModuleConfig(option.key);
      const raw = moduleRecord(record[option.key]);
      const hasEnabled = Object.prototype.hasOwnProperty.call(raw, "enabled");
      acc[option.key] = {
        enabled: hasEnabled ? moduleBoolean(raw.enabled) : defaults.enabled,
        entryType: moduleEntryType(raw.entryType, defaults.entryType),
        galeLimit: clampTelegramModuleNumber(raw.galeLimit, defaults.galeLimit, 0, 4),
        coverTie: Object.prototype.hasOwnProperty.call(raw, "coverTie")
          ? moduleBoolean(raw.coverTie)
          : defaults.coverTie,
        tieCoverage: clampTelegramModuleNumber(raw.tieCoverage, defaults.tieCoverage, 0, 4),
        cooldownSeconds: clampTelegramModuleNumber(raw.cooldownSeconds, defaults.cooldownSeconds, 0, 300),
        template: resolveTelegramModuleTemplate(option.key, raw.template, defaults.template),
        analyzingTemplate: moduleString(raw.analyzingTemplate) || defaults.analyzingTemplate,
        greenTemplate: moduleString(raw.greenTemplate) || defaults.greenTemplate,
        galeTemplate: moduleString(raw.galeTemplate) || defaults.galeTemplate,
        redTemplate: moduleString(raw.redTemplate) || defaults.redTemplate,
        tieTemplate: moduleString(raw.tieTemplate) || defaults.tieTemplate,
        expiredTemplate: moduleString(raw.expiredTemplate) || defaults.expiredTemplate,
        canceledTemplate: moduleString(raw.canceledTemplate) || defaults.canceledTemplate,
        buttons: normalizeTelegramModuleButtons(raw.buttons, raw, defaults.buttons),
      };
      return acc;
    },
    {} as Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>,
  );
}

function resolveTelegramModuleTemplate(key: ValidatorTelegramModuleKey, value: unknown, defaultTemplate: string) {
  const template = moduleString(value);
  return shouldUseDefaultTelegramModuleTemplate(key, template) ? defaultTemplate : template;
}

function shouldUseDefaultTelegramModuleTemplate(_key: ValidatorTelegramModuleKey, template: string) {
  const text = normalizeTelegramModuleTemplateFingerprint(template);
  if (!text) return true;
  return text.includes("ENTRADA CONFIRMADA");
}

function normalizeTelegramModuleTemplateFingerprint(value: string) {
  return moduleString(value)
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function defaultTelegramModuleConfig(key: ValidatorTelegramModuleKey): ValidatorTelegramModuleConfig {
  return {
    enabled: true,
    entryType: "AUTO",
    galeLimit: key === "ties_only" ? 0 : 1,
    coverTie: key === "ties_only",
    tieCoverage: key === "ties_only" ? 4 : 1,
    cooldownSeconds: key === "validator" ? 0 : 2,
    template: DEFAULT_TELEGRAM_MODULE_TEMPLATES[key],
    analyzingTemplate: DEFAULT_TELEGRAM_ANALYZING_TEMPLATES[key],
    greenTemplate: DEFAULT_TELEGRAM_GREEN_TEMPLATES[key],
    galeTemplate: DEFAULT_TELEGRAM_GALE_TEMPLATES[key],
    redTemplate: DEFAULT_TELEGRAM_RED_TEMPLATES[key],
    tieTemplate: DEFAULT_TELEGRAM_TIE_TEMPLATES[key],
    expiredTemplate: DEFAULT_TELEGRAM_EXPIRED_TEMPLATES[key],
    canceledTemplate: DEFAULT_TELEGRAM_CANCELED_TEMPLATES[key],
    buttons: defaultTelegramModuleButtons(),
  };
}

function resetTelegramModuleTemplateFields(
  key: ValidatorTelegramModuleKey,
  config: ValidatorTelegramModuleConfig,
): ValidatorTelegramModuleConfig {
  const defaults = defaultTelegramModuleConfig(key);
  return {
    ...config,
    template: defaults.template,
    analyzingTemplate: defaults.analyzingTemplate,
    greenTemplate: defaults.greenTemplate,
    galeTemplate: defaults.galeTemplate,
    redTemplate: defaults.redTemplate,
    tieTemplate: defaults.tieTemplate,
    expiredTemplate: defaults.expiredTemplate,
    canceledTemplate: defaults.canceledTemplate,
  };
}

function normalizeTelegramModuleConfig(
  key: ValidatorTelegramModuleKey,
  value: Partial<ValidatorTelegramModuleConfig>,
) {
  return normalizeTelegramModuleConfigs({ [key]: value })[key];
}

function defaultTelegramModuleButtons(): ValidatorTelegramButtonConfig[] {
  return Array.from({ length: MAX_TELEGRAM_BUTTONS }, (_, index) => ({
    enabled: index === 0,
    label: index === 0 ? DEFAULT_TELEGRAM_BUTTON_LABEL : "",
    url: "",
  }));
}

function normalizeTelegramModuleButtons(
  value: unknown,
  legacyRecord: Record<string, unknown> = {},
  fallback: ValidatorTelegramButtonConfig[] = defaultTelegramModuleButtons(),
): ValidatorTelegramButtonConfig[] {
  const source = Array.isArray(value) ? value.slice(0, MAX_TELEGRAM_BUTTONS) : [];
  const normalized = source.map((item) => {
    const record = moduleRecord(item);
    return {
      enabled: Object.prototype.hasOwnProperty.call(record, "enabled") ? moduleBoolean(record.enabled) : true,
      label: (moduleString(record.label) || DEFAULT_TELEGRAM_BUTTON_LABEL).slice(0, 64),
      url: moduleString(record.url),
    };
  });

  if (!normalized.length) {
    const hasLegacyButton =
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonEnabled") ||
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonLabel") ||
      Object.prototype.hasOwnProperty.call(legacyRecord, "buttonUrl");
    if (hasLegacyButton) {
      normalized.push({
        enabled: Object.prototype.hasOwnProperty.call(legacyRecord, "buttonEnabled")
          ? moduleBoolean(legacyRecord.buttonEnabled)
          : true,
        label: (moduleString(legacyRecord.buttonLabel) || DEFAULT_TELEGRAM_BUTTON_LABEL).slice(0, 64),
        url: moduleString(legacyRecord.buttonUrl),
      });
    } else {
      normalized.push(...fallback.map((button) => ({ ...button })));
    }
  }

  while (normalized.length < MAX_TELEGRAM_BUTTONS) {
    normalized.push({ enabled: false, label: "", url: "" });
  }
  return normalized.slice(0, MAX_TELEGRAM_BUTTONS);
}

function patchTelegramModuleButton(
  buttons: ValidatorTelegramButtonConfig[],
  index: number,
  patch: Partial<ValidatorTelegramButtonConfig>,
) {
  return normalizeTelegramModuleButtons(buttons).map((button, buttonIndex) => (
    buttonIndex === index ? { ...button, ...patch } : button
  ));
}

function telegramTemplateOptionsForModule(config: ValidatorTelegramModuleConfig) {
  const options: Array<{ key: ValidatorTelegramTemplateKey; label: string }> = [
    { key: "entry", label: "Entrada" },
    { key: "analyzing", label: "Analisando" },
    { key: "green", label: "Green" },
  ];
  if (config.galeLimit > 0 || config.coverTie) options.push({ key: "gale", label: "Gale" });
  options.push(
    { key: "red", label: "Red" },
    { key: "expired", label: "Expirado" },
    { key: "canceled", label: "Cancelado" },
  );
  return options;
}

function telegramTemplateLabel(key: ValidatorTelegramTemplateKey) {
  if (key === "entry") return "Mensagem de Entrada Confirmada";
  if (key === "analyzing") return "Mensagem de Analisando / Aguarde";
  if (key === "green") return "Mensagem Green";
  if (key === "gale") return "Mensagem G1/G2";
  if (key === "red") return "Mensagem Red";
  if (key === "expired") return "Mensagem Expirada";
  return "Mensagem Cancelada/Bloqueada";
}

function telegramTemplateStorageLabel(key: ValidatorTelegramModuleKey) {
  if (key === "ai_patterns") return "telegram_templates.patterns";
  if (key === "paying_numbers") return "telegram_templates.payers";
  if (key === "surf_alert") return "telegram_templates.surf";
  if (key === "ties_only") return "telegram_templates.ties";
  return "telegram_templates.validator";
}

function getTelegramModuleTemplate(config: ValidatorTelegramModuleConfig, key: ValidatorTelegramTemplateKey) {
  if (key === "entry") return config.template;
  if (key === "analyzing") return config.analyzingTemplate;
  if (key === "green") return config.greenTemplate;
  if (key === "gale") return config.galeTemplate;
  if (key === "red") return config.redTemplate;
  if (key === "expired") return config.expiredTemplate;
  return config.canceledTemplate;
}

function patchTelegramModuleTemplate(
  config: ValidatorTelegramModuleConfig,
  key: ValidatorTelegramTemplateKey,
  value: string,
): ValidatorTelegramModuleConfig {
  if (key === "entry") return { ...config, template: value };
  if (key === "analyzing") return { ...config, analyzingTemplate: value };
  if (key === "green") return { ...config, greenTemplate: value };
  if (key === "gale") return { ...config, galeTemplate: value };
  if (key === "red") return { ...config, redTemplate: value };
  if (key === "expired") return { ...config, expiredTemplate: value };
  return { ...config, canceledTemplate: value };
}

function telegramTemplateVariablesForModule(
  key: ValidatorTelegramModuleKey,
  templateKey: ValidatorTelegramTemplateKey,
) {
  const common = ["module", "table", "entry", "entryLabel", "entryCompact", "gale", "protection", "result", "time", "round", "confidence", "percentage", "channel", "tieCoverage", "tieProtection"];
  const byModule: Record<ValidatorTelegramModuleKey, string[]> = {
    ai_patterns: ["pattern", "score", "side", "status", "risk"],
    paying_numbers: ["numbers", "number", "side", "score", "status", "risk", "level"],
    surf_alert: ["side", "score", "status", "risk", "level"],
    ties_only: ["numbers", "number", "tie_pressure", "side", "score", "level", "status", "risk", "tieMultiplier"],
    validator: ["pattern", "score", "side", "status", "risk"],
  };
  const resultOnly = templateKey === "green" || templateKey === "gale" || templateKey === "red";
  return [...new Set([...common, ...byModule[key], ...(resultOnly ? ["result"] : [])])].sort();
}

function validateTelegramModuleConfig(key: ValidatorTelegramModuleKey, config: ValidatorTelegramModuleConfig) {
  for (const option of telegramTemplateOptionsForModule(config)) {
    const error = validateTelegramTemplate(key, option.key, getTelegramModuleTemplate(config, option.key));
    if (error) return `${option.label}: ${error}`;
  }
  return "";
}

function validateTelegramTemplate(
  key: ValidatorTelegramModuleKey,
  templateKey: ValidatorTelegramTemplateKey,
  template: string,
) {
  if (!template.trim()) return "a mensagem nao pode ficar vazia.";
  const allowed = new Set(telegramTemplateVariablesForModule(key, templateKey));
  const variables = [...template.matchAll(/{{\s*([a-zA-Z_]+)\s*}}/g)].map((match) => match[1]);
  const invalid = variables.find((variable) => !allowed.has(variable));
  if (invalid) return `variavel invalida {{${invalid}}} para este motor.`;
  return validateTelegramHtmlTags(template);
}

function validateTelegramHtmlTags(template: string) {
  const stack: string[] = [];
  const supportedTags = new Set(["b", "strong", "i", "em", "u", "ins", "s", "strike", "del", "code", "pre", "a", "spoiler", "tg-spoiler", "blockquote"]);
  for (const match of template.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    if (!supportedTags.has(tag)) return `tag HTML <${tag}> nao e permitida pelo Telegram.`;
    if (raw.endsWith("/>")) continue;
    if (raw.startsWith("</")) {
      const current = stack.pop();
      if (current !== tag) return `tag </${tag}> sem abertura correta.`;
      continue;
    }
    stack.push(tag);
  }
  if (stack.length) return `tag <${stack.at(-1)}> ficou aberta.`;
  return "";
}

function channelSignalModules(channel: ValidatorNotificationChannel) {
  const channelRecord = channel as ValidatorChannelWithModules;
  const templatesRecord = moduleRecord(channel.templates);
  return normalizeTelegramModuleConfigs(channelRecord.signalModules || templatesRecord.signalModules);
}

function moduleRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function moduleString(value: unknown) {
  return String(value || "").trim();
}

function moduleBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "sim", "yes", "on", "active", "ativo"].includes(moduleString(value).toLowerCase());
}

function moduleEntryType(value: unknown, fallback: ValidatorTelegramModuleConfig["entryType"]) {
  const text = moduleString(value).toUpperCase();
  if (text === "AUTO" || text === "BANKER" || text === "PLAYER" || text === "TIE") {
    return text as ValidatorTelegramModuleConfig["entryType"];
  }
  return fallback;
}

function clampTelegramModuleNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function moduleDisplayName(key: ValidatorTelegramModuleKey) {
  return TELEGRAM_MODULE_OPTIONS.find((option) => option.key === key)?.label.replace("SEGUIR ", "") || key;
}

function telegramModuleDescription(key: ValidatorTelegramModuleKey) {
  if (key === "ai_patterns") return "Envia quando a IA confirmar uma entrada.";
  if (key === "paying_numbers") return "Segue os numeros pagantes confirmados.";
  if (key === "surf_alert") return "Avisa quando o Surf confirmar sinal.";
  if (key === "ties_only") return "Cobre possiveis empates.";
  return "Segue as estrategias salvas no Validador.";
}

function telegramModulePreview(key: ValidatorTelegramModuleKey, config: ValidatorTelegramModuleConfig) {
  const previewSide = key === "ties_only" ? "TIE" : config.entryType === "AUTO" ? "PLAYER" : config.entryType;
  const variables: Record<string, string> = {
    table: "Bac Bo",
    pattern: "\u{1F535}\u{1F534}\u{1F535}7",
    entry: telegramEntryPreviewLabel(previewSide),
    entryLabel: telegramEntryPreviewPlainLabel(previewSide),
    entryCompact: telegramEntryPreviewCompactLabel(previewSide),
    gale: formatTelegramProtection(config.galeLimit),
    protection: formatTelegramProtection(config.galeLimit),
    tieCoverage: config.coverTie ? "4" : "0",
    tieProtection: config.coverTie ? "Ativa" : "Inativa",
    confidence: key === "surf_alert" ? "34,00%" : "100.00%",
    percentage: "100.00%",
    channel: "Canal Teste Cliente",
    score: "2x0",
    status: key === "paying_numbers" ? "VALIDO_FORTE" : "CONFIRMADO",
    risk: key === "surf_alert" ? "28,00%" : "baixo",
    numbers: "\u{1F534}10, \u{1F535}7, \u{1F7E1}6",
    side: "Banker",
    tie_pressure: "forte",
    number: "\u{1F535}9",
    level: "Alto",
    time: "14:32",
    round: "123456",
    module: moduleDisplayName(key),
    result: "Green G1",
    tieMultiplier: "4x",
  };
  const message = config.template.replace(/{{\s*([a-zA-Z_]+)\s*}}/g, (_, variable: string) => variables[variable] ?? "");
  const activeButtons = normalizeTelegramModuleButtons(config.buttons).filter((button) => button.enabled);
  if (!activeButtons.length) return message;
  return [
    message,
    "",
    "Botoes:",
    ...activeButtons.map((button, index) => `${index + 1}. ${button.label || DEFAULT_TELEGRAM_BUTTON_LABEL} - ${button.url || "link do canal"}`),
  ].join("\n");
}

function telegramEntryPreviewLabel(entryType: ValidatorTelegramModuleConfig["entryType"]) {
  if (entryType === "BANKER") return "\u{1F534} BANKER";
  if (entryType === "PLAYER") return "\u{1F535} PLAYER";
  if (entryType === "TIE") return "\u{1F7E1} TIE";
  return signalEntryLabel(entryType);
}

function telegramEntryPreviewPlainLabel(entryType: ValidatorTelegramModuleConfig["entryType"]) {
  if (entryType === "BANKER") return "Banker";
  if (entryType === "PLAYER") return "Player";
  if (entryType === "TIE") return "Tie";
  return signalEntryLabel(entryType);
}

function telegramEntryPreviewCompactLabel(entryType: ValidatorTelegramModuleConfig["entryType"]) {
  if (entryType === "BANKER") return "\u{1F534}Banker";
  if (entryType === "PLAYER") return "\u{1F535}Player";
  if (entryType === "TIE") return "\u{1F7E1}Tie";
  return signalEntryLabel(entryType);
}

function telegramDayStats(notifications: ValidatorTelegramNotification[]) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySignals = notifications.filter((notification) => (notification.sentAt || notification.updatedAt).slice(0, 10) === today);
  const sent = todaySignals.filter((notification) => notification.status === "sent").length;
  const greens = todaySignals.filter((notification) => telegramSignalResult(notification).toLowerCase().startsWith("green")).length;
  const reds = todaySignals.filter((notification) => telegramSignalResult(notification).toLowerCase() === "red").length;
  const closed = greens + reds;
  return {
    sent,
    greens,
    reds,
    assertiveness: closed ? formatPercent((greens / closed) * 100) : "--",
    lastSignal: todaySignals[0] ? compactTelegramSignal(todaySignals[0]) : "--",
  };
}

function formatTelegramSignalLine(notification: ValidatorTelegramNotification) {
  const time = formatTelegramSignalTime(notification.sentAt || notification.updatedAt);
  return `${time} - ${telegramSignalType(notification)} - ${telegramSignalEntry(notification)} - ${telegramSignalProtection(notification)} - ${telegramSignalResult(notification)}`;
}

function compactTelegramSignal(notification: ValidatorTelegramNotification) {
  return `${telegramSignalType(notification)} / ${telegramSignalEntry(notification)} / ${telegramSignalProtection(notification)}`;
}

function telegramSignalType(notification: ValidatorTelegramNotification) {
  const payload = moduleRecord(notification.payloadJson);
  const moduleKey = moduleString(payload.moduleKey);
  if (moduleKey === "ai_patterns" || notification.type === "module:ai_patterns") return "Padroes IA";
  if (moduleKey === "paying_numbers" || notification.type === "module:paying_numbers") return "Numeros Pagantes";
  if (moduleKey === "surf_alert" || notification.type === "module:surf_alert") return "Aviso de Surf";
  if (moduleKey === "ties_only" || notification.type === "module:ties_only") return "Empate";
  return "Validador";
}

function telegramSignalEntry(notification: ValidatorTelegramNotification) {
  const payload = moduleRecord(notification.payloadJson);
  return signalEntryLabel(payload.entryText || payload.entry || payload.expectedSide || "Aguardando");
}

function telegramSignalProtection(notification: ValidatorTelegramNotification) {
  const payload = moduleRecord(notification.payloadJson);
  const protection = moduleString(payload.protection);
  return protection || "--";
}

function telegramSignalResult(notification: ValidatorTelegramNotification) {
  const payload = moduleRecord(notification.payloadJson);
  const result = moduleString(payload.result);
  if (result) return result;
  if (notification.status === "error") return "Aguardando resultado";
  return "Aguardando resultado";
}

function signalEntryLabel(value: unknown) {
  const text = moduleString(value).toUpperCase();
  if (text === "B" || text === "BANKER" || text.includes("BANKER")) return "Banker";
  if (text === "P" || text === "PLAYER" || text.includes("PLAYER")) return "Player";
  if (text === "T" || text === "TIE" || text.includes("TIE")) return "Tie";
  return moduleString(value) || "Aguardando";
}

function formatTelegramProtection(value: unknown) {
  const gale = clampTelegramModuleNumber(value, 0, 0, 4);
  return gale <= 0 ? "SG" : `G${gale}`;
}

function formatTelegramSignalTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

async function fetchValidatorRoundHistory(limit: number) {
  if (typeof window === "undefined") return [];

  const url = new URL("/validator/round-history", window.location.origin);
  url.searchParams.set("limit", String(limit));
  const session = readUserSession();
  const adminSession = readAdminSession();
  const tokens = [session.clientToken, adminSession?.token].filter(
    (token, index, values): token is string => Boolean(token) && values.indexOf(token) === index,
  );
  const requestTokens = tokens.length ? tokens : [""];
  let lastStatus = 0;

  for (const token of requestTokens) {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    lastStatus = response.status;
    if (!response.ok) continue;

    const payload = await response.json().catch(() => null) as { rounds?: unknown[] } | null;
    return Array.isArray(payload?.rounds) ? payload.rounds.filter(isValidatorRound) : [];
  }

  throw new Error(`Validator history returned ${lastStatus || "unknown"}`);
}

async function validatePatternOnServer(pattern: ValidatorPatternToken[], config: ValidatorConfig) {
  if (typeof window === "undefined") throw new Error("Validador indisponivel.");

  const response = await fetch("/validator/validate", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      tableId: config.tableId,
      pattern,
      entryType: config.entryType,
      galeLimit: config.galeLimit,
      tieProtection: config.tieProtection,
      historySize: config.historySize,
    }),
  });
  const payload = await response.json().catch(() => null) as { result?: unknown; error?: string } | null;
  if (!response.ok) throw new Error(payload?.error || "Falha ao validar no servidor.");
  if (!isValidatorResult(payload?.result)) throw new Error("Resultado do Validador invalido.");
  return payload.result;
}

async function fetchServerValidatorPatterns() {
  const response = await fetch("/validator/patterns", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Backend do Validador indisponivel.");
  const data = await response.json().catch(() => null) as { patterns?: SavedValidatorPattern[] } | null;
  return Array.isArray(data?.patterns) ? data.patterns : [];
}

async function saveServerValidatorPattern(pattern: SavedValidatorPattern) {
  const response = await fetch("/validator/patterns", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({ pattern }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null) as { pattern?: SavedValidatorPattern } | null;
  return data?.pattern ?? null;
}

async function deleteServerValidatorPattern(patternId: string) {
  const response = await fetch(`/validator/patterns/${encodeURIComponent(patternId)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Servidor nao confirmou a exclusao do padrao.");
}

async function fetchServerValidatorChannels() {
  const response = await fetch("/telegram/channels", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Backend do Validador indisponivel.");
  const data = await response.json().catch(() => null) as { channels?: ValidatorNotificationChannel[] } | null;
  return Array.isArray(data?.channels) ? data.channels : [];
}

async function fetchServerValidatorNotifications() {
  const response = await fetch("/validator/notifications", {
    cache: "no-store",
    headers: validatorApiHeaders(),
  });
  if (!response.ok) throw new Error("Backend do Validador indisponivel.");
  const data = await response.json().catch(() => null) as { notifications?: ValidatorTelegramNotification[] } | null;
  return Array.isArray(data?.notifications) ? data.notifications : [];
}

async function saveServerValidatorChannel(
  channel: ValidatorNotificationChannel,
  botToken?: string,
  validationCode?: string,
) {
  const response = await fetch("/telegram/channels", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      channel: {
        ...channel,
        ...(botToken?.trim() ? { botToken: botToken.trim() } : {}),
      },
      ...(validationCode?.trim() ? { validationCode: validationCode.trim() } : {}),
    }),
  });
  const data = await response.json().catch(() => null) as { channel?: ValidatorNotificationChannel; error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Servidor nao confirmou o canal.");
  if (!data?.channel) throw new Error("Servidor nao retornou o canal salvo.");
  return data.channel;
}

async function validateServerValidatorChannel(botToken: string, chatId: string) {
  const response = await fetch("/telegram/channels/validate", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      botToken: botToken.trim(),
      chatId: chatId.trim(),
    }),
  });
  const data = await response.json().catch(() => null) as { validationCode?: string; error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao validar grupo no Telegram.");
  if (!data?.validationCode) throw new Error("Grupo validado, mas o servidor nao confirmou o salvamento.");
  return { validationCode: data?.validationCode || "" };
}

async function deleteServerValidatorChannel(channelId: string) {
  await fetch(`/telegram/channels/${encodeURIComponent(channelId)}`, {
    method: "DELETE",
    cache: "no-store",
    headers: validatorApiHeaders(),
  }).catch(() => null);
}

async function testServerValidatorChannel(channelId: string) {
  const response = await fetch("/telegram/channels/test", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({ channelId }),
  });
  const data = await response.json().catch(() => null) as {
    error?: string;
    messageId?: number | string | null;
    channel?: ValidatorNotificationChannel;
  } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao testar canal salvo.");
  return { messageId: data?.messageId ?? null, channel: data?.channel ?? null };
}

async function toggleServerValidatorMotor(
  channelId: string,
  motorKey: ValidatorTelegramModuleKey,
  enabled: boolean,
) {
  const response = await fetch("/telegram/motors/toggle", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({ channelId, motorKey, enabled }),
  });
  const data = await response.json().catch(() => null) as {
    channel?: ValidatorNotificationChannel;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error || "Servidor nao confirmou a ativacao do motor.");
  if (!data?.channel) throw new Error("Servidor nao retornou o canal salvo.");
  return data.channel;
}

async function previewServerValidatorChannel(
  channelId: string,
  message: string,
  buttons: ValidatorTelegramButtonConfig[],
) {
  const response = await fetch("/telegram/channels/preview", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify({
      channelId,
      message,
      buttons: normalizeTelegramModuleButtons(buttons)
        .filter((button) => button.enabled)
        .map((button) => ({ label: button.label, url: button.url })),
    }),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao enviar previa no Telegram.");
}

async function postValidatorLiveHitTelegram(payload: {
  patternId: string;
  detectedRoundId: number;
  pattern?: SavedValidatorPattern;
}) {
  const response = await fetch("/validator/live-hit/send", {
    method: "POST",
    cache: "no-store",
    headers: validatorApiHeaders(true),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error || "Falha ao enviar sinal salvo no Telegram.");
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

function mergeValidatorItems<T extends { id: string; updatedAt: string }>(primary: T[], secondary: T[]) {
  const byId = new Map<string, T>();
  for (const item of [...secondary, ...primary]) {
    const existing = byId.get(item.id);
    if (!existing || Date.parse(item.updatedAt || "") >= Date.parse(existing.updatedAt || "")) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function mergeValidatorChannels(primary: ValidatorNotificationChannel[], secondary: ValidatorNotificationChannel[] = []) {
  const byKey = new Map<string, ValidatorNotificationChannel>();
  for (const channel of [...secondary, ...primary]) {
    const key = validatorChannelDedupeKey(channel);
    const existing = byKey.get(key);
    if (!existing || Date.parse(channel.updatedAt || "") >= Date.parse(existing.updatedAt || "")) {
      byKey.set(key, existing ? { ...existing, ...channel } : channel);
    }
  }
  return [...byKey.values()].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

function replaceValidatorChannel(
  channels: ValidatorNotificationChannel[],
  channel: ValidatorNotificationChannel,
) {
  const replaced = channels.some((item) => item.id === channel.id)
    ? channels.map((item) => (item.id === channel.id ? channel : item))
    : [channel, ...channels];
  return mergeValidatorChannels(replaced);
}

function markServerConfirmedChannel(channel: ValidatorNotificationChannel): ValidatorNotificationChannel {
  return { ...channel, serverConfirmed: true } as ValidatorChannelRuntimeState;
}

function markServerConfirmedChannels(channels: ValidatorNotificationChannel[]) {
  return channels.map(markServerConfirmedChannel);
}

function markLocalFallbackChannels(channels: ValidatorNotificationChannel[]) {
  return channels.map((channel) => ({ ...channel, serverConfirmed: false }) as ValidatorChannelRuntimeState);
}

function isServerConfirmedChannel(channel: ValidatorNotificationChannel | null | undefined) {
  return Boolean(channel && (channel as ValidatorChannelRuntimeState).serverConfirmed === true);
}

function telegramChannelConnectionStatus(channel: ValidatorNotificationChannel | null | undefined) {
  const status = channel?.connectionStatus;
  if (status === "connected" || status === "invalid" || status === "pending") return status;
  if (channel?.isActive && channel.chatId && (channel.botTokenMasked || channel.botTokenEncoded)) return "connected";
  return "pending";
}

function validatorChannelDedupeKey(channel: Pick<ValidatorNotificationChannel, "id" | "userId" | "name" | "chatId">) {
  const userId = (channel.userId || currentUserId()).trim().toLowerCase();
  const chatId = normalizeValidatorChannelCode(channel.chatId);
  if (chatId) return `${userId}:chat:${chatId}`;
  return `${userId}:name:${channel.name.trim().toLowerCase() || channel.id}`;
}

function normalizeValidatorChannelCode(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

function telegramChannelValidationKey(botToken: string, chatId: string) {
  const token = botToken.trim();
  const code = normalizeValidatorChannelCode(chatId);
  return token && code ? `${token}:${code}` : "";
}

function shouldSyncValidatorItem<T extends { id: string; updatedAt: string }>(item: T, serverItems: T[]) {
  const serverItem = serverItems.find((candidate) => candidate.id === item.id);
  if (!serverItem) return true;
  return Date.parse(item.updatedAt || "") > Date.parse(serverItem.updatedAt || "");
}

function autoPrepareAdminTelegramDelivery(
  patterns: SavedValidatorPattern[],
  channels: ValidatorNotificationChannel[],
  enabled: boolean,
) {
  if (!enabled || !patterns.length) return patterns;
  const channel = channels.find((item) => item.isActive) || channels[0];
  if (!channel) return patterns;
  const now = new Date().toISOString();
  return patterns.map((pattern) => {
    if (!pattern.isActive || pattern.destination === "disabled") return pattern;
    if (
      (pattern.destination === "telegram" || pattern.destination === "site_telegram") &&
      pattern.telegramChannelId
    ) {
      return pattern;
    }
    return {
      ...pattern,
      destination: "site_telegram" as ValidatorDestination,
      telegramChannelId: channel.id,
      updatedAt: now,
    };
  });
}

async function postValidatorTelegramMessage(payload: {
  botToken: string;
  chatId: string;
  buttonLink: string;
  message: string;
  buttonLabel: string;
}) {
  if (typeof window === "undefined") return;

  const session = readUserSession();
  const adminSession = readAdminSession();
  const token = session.clientToken || adminSession?.token;
  const response = await fetch("/validator/telegram/send", {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) {
    throw new Error(data?.error || `Telegram retornou ${response.status}.`);
  }
}

function mergeRoundSources(sources: Round[][]) {
  const byKey = new Map<string, Round>();
  for (const source of sources) {
    for (const round of source) byKey.set(roundSourceKey(round), round);
  }
  return [...byKey.values()].sort(compareValidatorRounds);
}

function roundsSignature(rounds: Round[]) {
  const first = rounds[0];
  const last = rounds.at(-1);
  return `${rounds.length}:${first?.id ?? 0}:${last?.id ?? 0}:${last?.result ?? ""}`;
}

function findSavedPattern(
  patterns: SavedValidatorPattern[],
  pattern: ValidatorPatternToken[],
  config: Pick<ValidatorConfig, "entryType" | "galeLimit" | "tableId" | "tieProtection">,
) {
  if (!pattern.length) return null;
  const currentKey = validatorPatternSaveKey(
    pattern,
    config.entryType,
    config.galeLimit,
    config.tieProtection,
    config.tableId,
  );
  return patterns.find((savedPattern) =>
    validatorPatternSaveKey(
      savedPattern.pattern,
      savedPattern.entryType,
      savedPattern.galeLimit,
      savedPattern.tieProtection,
      savedPattern.tableId,
    ) === currentKey
  ) ?? null;
}

function validatorPatternSaveKey(
  pattern: ValidatorPatternToken[],
  entryType: ValidatorEntryType,
  galeLimit: ValidatorGaleLimit,
  tieProtection: boolean,
  tableId: string,
) {
  return [
    pattern.map(formatToken).join(">"),
    entryType,
    Number(galeLimit),
    tieProtection ? "tie-on" : "tie-off",
    tableId.trim().toLowerCase(),
  ].join("|");
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

function isValidatorResult(value: unknown): value is ValidatorResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<ValidatorResult>;
  return (
    typeof result.totalSignals === "number" &&
    typeof result.totalValidated === "number" &&
    typeof result.sgWins === "number" &&
    typeof result.g1Wins === "number" &&
    typeof result.g2Wins === "number" &&
    typeof result.losses === "number" &&
    typeof result.ties === "number" &&
    typeof result.tieWins === "number" &&
    typeof result.currentGreenStreak === "number" &&
    typeof result.bestGreenStreak === "number" &&
    typeof result.bestLossStreak === "number" &&
    typeof result.analyzedRounds === "number" &&
    Array.isArray(result.details)
  );
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

function detectLiveHits(patterns: SavedValidatorPattern[], rounds: Round[]): LiveValidatorHit[] {
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
    .map((pattern) => ({
      id: `hit-${pattern.id}-${latestRound.id}`,
      pattern,
      matchedRounds: rounds.slice(-pattern.pattern.length),
      entry: pattern.pulledSide,
      detectedRoundId: latestRound.id,
      detectedAt: new Date().toISOString(),
    }));
}

function telegramSentStorageKey() {
  return `${TELEGRAM_SENT_KEY}:${currentUserId()}`;
}

function deletedValidatorPatternsStorageKey() {
  return `${VALIDATOR_DELETED_PATTERNS_KEY}:${currentUserId()}`;
}

function readDeletedValidatorPatternIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(deletedValidatorPatternsStorageKey()) || "[]") as unknown;
    const ids = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    return new Set(ids);
  } catch {
    return new Set<string>();
  }
}

function markDeletedValidatorPatternId(id: string) {
  if (typeof window === "undefined") return;
  const cleanId = id.trim();
  if (!cleanId) return;
  const next = Array.from(new Set([cleanId, ...readDeletedValidatorPatternIds()])).slice(0, 500);
  window.localStorage.setItem(deletedValidatorPatternsStorageKey(), JSON.stringify(next));
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

function invertToken(token: ValidatorPatternToken): ValidatorPatternToken {
  if (token.side === "B") return { ...token, side: "P" };
  if (token.side === "P") return { ...token, side: "B" };
  return token;
}

function sideEmoji(side: RoundResult) {
  if (side === "B") return "B";
  if (side === "P") return "P";
  return "T";
}

function entryTypeToSide(entryType: ValidatorEntryType): RoundResult | null {
  if (entryType === "BANKER") return "B";
  if (entryType === "PLAYER") return "P";
  if (entryType === "TIE") return "T";
  return null;
}

function tokenClass(side: RoundResult) {
  if (side === "B") return "border-banker/40 bg-banker/10 text-banker";
  if (side === "P") return "border-player/40 bg-player/10 text-player";
  return "border-warning/50 bg-warning/10 text-warning";
}

function tokenCircleClass(side: RoundResult) {
  if (side === "B") return "border-banker/70 bg-banker text-white shadow-banker/25";
  if (side === "P") return "border-player/70 bg-player text-white shadow-player/25";
  return "border-warning/70 bg-warning text-background shadow-warning/25";
}

function sideDotClass(side: RoundResult) {
  if (side === "B") return "bg-banker shadow-lg shadow-banker/25";
  if (side === "P") return "bg-player shadow-lg shadow-player/25";
  return "bg-warning shadow-lg shadow-warning/25";
}

function formatCountPercent(count: number, total: number) {
  if (!total) return String(count);
  return `${count} (${formatPercent((count / total) * 100)})`;
}

function destinationLabel(destination: ValidatorDestination) {
  const option = DESTINATION_OPTIONS.find((item) => item.value === destination);
  return option?.label ?? destination;
}

function planLimitForSession(plan: string, fullAccess: boolean) {
  if (!fullAccess) {
    return { label: "Free", history: 1000, patterns: 3, channels: 0, telegram: false, ai: false };
  }
  if (plan === "vip") {
    return { label: "VIP/Admin", history: 20000, patterns: 80, channels: 10, telegram: true, ai: true };
  }
  return { label: "Premium", history: 10000, patterns: 20, channels: 3, telegram: true, ai: true };
}

function availableHistoryOptions(limit: number) {
  const options = VALIDATOR_HISTORY_OPTIONS.filter((option) => option <= limit);
  return options.length ? options : [limit];
}
