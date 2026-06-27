import "./lib/error-capture";

import bcrypt from "bcryptjs";
import { mockDashboardData } from "./data/mockDashboardData";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { calculateMotorAssertiveness } from "./utils/assertiveness";
import { NeuralValidatorEngine } from "./neuralValidator/NeuralValidatorEngine";
import { buildNumeroPaganteNeural } from "./utils/numeroPaganteNeural";
import {
  buildTiePullerStats,
  emptyTieMultiplierCounts,
  incrementTieMultiplierCounts,
  normalizeTieMultiplierCounts,
  tieMultiplierFromRound,
} from "./tieRadar/TieRadarStatsEngine";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  normalizeAnnouncementTone,
  normalizeAssetUrl,
  normalizeSiteContentSettings,
  type SiteContentSettings,
} from "./lib/siteContent";
import type {
  ActiveEntryMode,
  CurrentSignalSide,
  DashboardData,
  EntryModeStats,
  NeuralEntryLastResult,
  NeuralEntryState,
  NeuralReading,
  NeuralScoreboard,
  Round,
  SignalSide,
  SignalStatus,
} from "./types/dashboard";
import type {
  SavedValidatorPattern,
  ValidatorDestination,
  ValidatorEntryType,
  ValidatorGaleLimit,
  ValidatorMessageTemplates,
  ValidatorNotificationChannel,
  ValidatorPatternToken,
  ValidatorResult,
} from "./types/neuralValidator";
import type {
  CrmClient,
  CrmDeal,
  CrmDealStage,
  CrmInvoice,
  CrmInvoiceStatus,
  CrmResponse,
  CrmSummary,
} from "./types/crm";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};
type ExecutionContextLike = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

type LiveDashboardData = DashboardData & {
  updatedAt?: string;
  cycleDate?: string;
  dailyCycleDate?: string;
  strictDailyCounters?: boolean;
  tieAlertCountedRoundKeys?: Record<string, true>;
  entryModeSignalModes?: Record<string, ActiveEntryMode[]>;
  entryModeCountedResults?: Record<string, true>;
  latestEntryModeSignalId?: string;
  latestEntryModeSignalModes?: ActiveEntryMode[];
  lateSignalHold?: DashboardData["currentSignal"] | null;
  neuralSequenceLastOutcome?: "GREEN" | "RED" | null;
  neuralPanelCycleResetVersion?: string;
  neuralPanelCycleResetRoundKey?: string;
  neuralEntryState?: NeuralEntryState | null;
  neuralEntryLastResult?: NeuralEntryLastResult | null;
};
const LATE_ENTRY_BLOCK_SECONDS = 2.2;
const BETTING_TIMING_MAX_AGE_MS = 20_000;
type NeuralCalendarClassification = "muito_pagante" | "operavel" | "perigoso" | "sem_amostra";
type CalendarEngineKey =
  | "todos"
  | "neural_pagante"
  | "padroes_quentes_ia"
  | "surf_analyzer"
  | "radar_empates"
  | "tendencia"
  | "personalizado";
type CalendarSignalEngineKey = Exclude<CalendarEngineKey, "todos" | "personalizado">;
type CalendarHourlyOutcome = "green" | "red" | "tie";
type CalendarHourlyStatsScope = "day" | "week" | "month" | "year" | "all";
type CalendarEngineCounterSnapshot = {
  greens: number;
  reds: number;
  ties: number;
};
type EngineCalendarAggregateKind = "hourly" | "daily" | "weekly" | "monthly" | "yearly";
type EngineCalendarAggregateStat = {
  id: string;
  engineKey: CalendarEngineKey;
  periodKind: EngineCalendarAggregateKind;
  periodStart: string;
  periodEnd: string;
  date: string;
  hour: number | null;
  week: number | null;
  month: number;
  year: number;
  greens: number;
  reds: number;
  ties: number;
  totalSignals: number;
  accuracy: number;
  score: number;
  classification: NeuralCalendarClassification;
  createdAt: string;
  updatedAt: string;
};
type EngineCalendarAggregateChangeSet = {
  changed: boolean;
  hourlyIds: Set<string>;
  dailyIds: Set<string>;
  weeklyIds: Set<string>;
  monthlyIds: Set<string>;
  yearlyIds: Set<string>;
  events: EngineCalendarSignalEvent[];
};
type EngineCalendarSignalEvent = {
  id: string;
  eventKey: string;
  engineKey: CalendarSignalEngineKey;
  outcome: CalendarHourlyOutcome;
  greens: number;
  reds: number;
  ties: number;
  totalSignals: number;
  occurredAt: string;
  date: string;
  hour: number;
  week: number;
  month: number;
  year: number;
  source: string;
  payload: Record<string, unknown>;
};
type EngineCalendarBackfillSourceReport = {
  source: string;
  table: string;
  rowsRead: number;
  snapshotsRead: number;
  countersFound: number;
  countersApplied: number;
  skipped: Record<string, number>;
  error?: string;
};
type EngineCalendarBackfillReport = {
  ok: boolean;
  mode: "real_history_only";
  preservedExistingHistory: true;
  sources: EngineCalendarBackfillSourceReport[];
  appliedCounters: CalendarEngineCounterSnapshot;
  changedRows: Record<EngineCalendarAggregateKind, number>;
  keysStored: number;
  updatedAt: string;
  error?: string;
};
type EngineCalendarBackfillDashboardSnapshot = {
  key: string;
  occurredAt: Date;
  data: Record<string, unknown>;
};
type NeuralCalendarForce = "BANKER" | "PLAYER" | "TIE" | "NONE";
type NeuralCalendarModule = "Neural Pagante" | "Surf Analyzer" | "Tendencia" | "Validador";
type NeuralCalendarDailyStat = {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  totalRounds: number;
  greens: number;
  reds: number;
  ties: number;
  bankerCount: number;
  playerCount: number;
  tieCount: number;
  accuracy: number;
  score: number;
  classification: NeuralCalendarClassification;
  bestHour: string;
  worstHour: string;
  bestModule: NeuralCalendarModule;
  bestForce: NeuralCalendarForce;
  observation: string;
  createdAt: string;
  updatedAt: string;
};
type NeuralCalendarHourlyStat = NeuralCalendarDailyStat & {
  engineKey: CalendarEngineKey;
  totalSignals: number;
  hour: number;
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
  bestReading: string;
};
type NeuralCalendarChangeSet = {
  changed: boolean;
  dailyIds: Set<string>;
  hourlyIds: Set<string>;
};
type NeuralCalendarDateParts = {
  date: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
};
type WorkerCacheStorage = CacheStorage & { default?: Cache };
type AdminRole = "owner" | "admin";
type BillingPlanId = "free" | "premium" | "vip";
type SubscriptionStatus = "free" | "pending" | "active" | "expired" | "cancelled" | "past_due";
type SalesSettings = {
  salesClosed: boolean;
  updated_at: string;
  updated_by: string;
};
type LiveStateSaveStatus = {
  durable: boolean;
  cache: boolean;
  clientBackup?: boolean;
  durableConfigured: boolean;
  saved_at: string;
};
type AdaptiveStrategySyncPayload = {
  records?: unknown[];
  patterns?: unknown[];
  decision?: Record<string, unknown>;
  logs?: unknown[];
};
type LocalAiSettings = {
  enabled: boolean;
  narrationEnabled: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  voiceProvider: string;
  voiceName: string;
  voiceVolume: number;
  voiceRate: number;
  voicePitch: number;
  callsPerMinute: number;
  cooldownMs: number;
};
type LocalAiLog = {
  id: string;
  user: string;
  mesa: string;
  event: string;
  question: string;
  response: string;
  model: string;
  provider: string;
  durationMs: number;
  estimatedCost: number;
  status: string;
  error: string;
  timestamp: string;
  data: Record<string, unknown>;
};
type AdminManagedUserRole = "user" | "admin" | "owner";
type AdminManagedUserPlan = "free" | "trial" | "monthly" | "premium" | "vip_manual";
type AdminSubscriptionStatus = "trial" | "active" | "expired" | "canceled" | "blocked" | "manual_vip";
type AdminActionType =
  | "UPDATE_USER"
  | "UPDATE_PLAN"
  | "UPDATE_SUBSCRIPTION_STATUS"
  | "EXTEND_ACCESS"
  | "BLOCK_USER"
  | "UNBLOCK_USER"
  | "UPDATE_ROLE"
  | "UPDATE_EXPIRATION_DATE"
  | "MANUAL_VIP_GRANTED"
  | "CANCEL_ACCESS"
  | "REACTIVATE_USER"
  | "DELETE_USER";

const LIVE_STATE_CACHE_URL = "https://sniperbo.com/__sniperbo_live_state_v1";
const LIVE_STATE_ID = "main";
const LIVE_STATE_TABLE = "sniper_live_state";
const SNIPER_DEPLOY_MARKER = "2026-06-25-client-registration-persistence-v3";
const CLIENT_REGISTRY_SNAPSHOT_LATEST_ID = `${LIVE_STATE_ID}:client_registry_latest`;
const CLIENT_REGISTRY_SNAPSHOT_PREFIX = `${LIVE_STATE_ID}:client_registry:`;
const CRM_CLIENTS_TABLE = "crm_clients";
const CRM_DEALS_TABLE = "crm_deals";
const CRM_INVOICES_TABLE = "crm_invoices";
const VALIDATOR_ROUNDS_TABLE = "validator_rounds";
const VALIDATOR_PATTERNS_TABLE = "validator_saved_patterns";
const VALIDATOR_CHANNELS_TABLE = "validator_channels";
const VALIDATOR_NOTIFICATIONS_TABLE = "validator_notifications";
const VALIDATOR_PATTERN_DELETED_STATE_PREFIX = "validator_pattern_deleted:";
const VALIDATOR_CHANNEL_STATE_PREFIX = "validator_channel:";
const VALIDATOR_CHANNEL_DELETED_STATE_PREFIX = "validator_channel_deleted:";
const LEGACY_PATTERN_LIVE_HITS_TABLE = "pattern_live_hits";
const CALENDAR_DAILY_STATS_TABLE = "calendar_daily_stats";
const CALENDAR_HOURLY_STATS_TABLE = "calendar_hourly_stats";
const ENGINE_HOURLY_STATS_TABLE = "engine_hourly_stats";
const ENGINE_DAILY_STATS_TABLE = "engine_daily_stats";
const ENGINE_WEEKLY_STATS_TABLE = "engine_weekly_stats";
const ENGINE_MONTHLY_STATS_TABLE = "engine_monthly_stats";
const ENGINE_YEARLY_STATS_TABLE = "engine_yearly_stats";
const ENGINE_SIGNAL_EVENTS_TABLE = "engine_signal_events";
const DASHBOARD_CYCLE_TIME_ZONE = "America/Sao_Paulo";
const DEFAULT_CALENDAR_ENGINE_KEY: CalendarEngineKey = "todos";
const CALENDAR_ENGINE_KEYS: CalendarEngineKey[] = [
  "todos",
  "neural_pagante",
  "padroes_quentes_ia",
  "surf_analyzer",
  "radar_empates",
  "tendencia",
  "personalizado",
];
const CALENDAR_SIGNAL_ENGINE_KEYS: CalendarSignalEngineKey[] = [
  "neural_pagante",
  "padroes_quentes_ia",
  "surf_analyzer",
  "radar_empates",
  "tendencia",
];
const CALENDAR_BACKFILL_ENGINE_KEYS: CalendarSignalEngineKey[] = [...CALENDAR_SIGNAL_ENGINE_KEYS];
const NEURAL_CALENDAR_START_DATE = "2026-06-10";
const NEURAL_CALENDAR_AGGREGATE_VERSION = "2026-06-10-time-v2";
const NEURAL_CALENDAR_MIN_DAILY_SAMPLE = 5;
const NEURAL_CALENDAR_MIN_HOURLY_SAMPLE = 2;
const NEURAL_CALENDAR_CATCHUP_ROUND_LIMIT = 20_000;
const NEURAL_CALENDAR_CATCHUP_TIMEOUT_MS = 8_000;
const MAX_NEURAL_CALENDAR_COUNTED_KEYS = 120_000;
const MAX_ENGINE_CALENDAR_BACKFILL_KEYS = 200_000;
const MERCADOPAGO_PREFERENCE_URL = "https://api.mercadopago.com/checkout/preferences";
const MERCADOPAGO_PAYMENT_URL = "https://api.mercadopago.com/v1/payments";
const ELEVENLABS_TTS_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_FAST_OUTPUT_FORMAT = "mp3_22050_32";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";
const DEFAULT_EDGE_TTS_VOICE = "pt-BR-AntonioNeural";
const MAX_SERVER_ROUND_HISTORY = 50_000;
const MAX_MONITOR_ROUND_HISTORY = 300;
const MAX_VALIDATOR_ROUND_WRITE_BATCH = 500;
const MAX_VALIDATOR_DETAIL_RESPONSE = 200;
const VALIDATOR_ROUND_PRUNE_MIN_INTERVAL_MS = 10 * 60_000;
const VALIDATOR_MONITOR_CACHE_TTL_MS = 30_000;
const VALIDATOR_TELEGRAM_MAX_PARALLEL_SENDS = 80;
const NEURAL_PANEL_CYCLE_RESET_VERSION = "2026-06-11-manual-reset-v1";
const MAX_NARRATION_CHARS = 900;
const CLIENT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;
const RATE_LIMIT_WINDOW_MS = 60_000;
const LIVE_STATE_IO_TIMEOUT_MS = 2_500;
const LIVE_STATE_LOAD_MIN_INTERVAL_MS = 8_000;
const CLIENT_REGISTRY_PROTECTION_INTERVAL_MS = 60_000;
const CLIENT_REGISTRY_SNAPSHOT_INTERVAL_MS = 5 * 60_000;
const TELEGRAM_SEND_TIMEOUT_MS = 4_000;
const VALIDATOR_TELEGRAM_TARGET_MS = 200;
const VALIDATOR_TELEGRAM_DEDUPE_RESERVATION_TTL_MS = 30_000;
const LIVE_FEED_STALE_MS = 150_000;
const FREE_TRIAL_MINUTES = 30;
const ELEVENLABS_API_KEY_SECRET_NAMES = [
  "ELEVENLABS_TTS_API_KEY",
  "ELEVENLABS_TTS_API_KEY_2",
  "ELEVENLABS_TTS_API_KEY_3",
  "ELEVENLABS_TTS_API_KEY_4",
  "ELEVENLABS_TTS_API_KEY_5",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_API_KEY_2",
  "ELEVENLABS_API_KEY_3",
] as const;
const ELEVENLABS_VOICE_ID_SECRET_NAMES = [
  "ELEVENLABS_VOICE_ID",
  "ELEVENLABS_VOICE_ID_2",
  "ELEVENLABS_VOICE",
  "ELEVENLABS_VOICEID",
  "VOICE_ID",
] as const;
const ACTIVE_ENTRY_MODES = ["sniper", "hunter", "aggressive"] as const satisfies readonly ActiveEntryMode[];
const SNIPER_NEURAL_ASSERTIVENESS_MIN = 99;
const DEFAULT_VALIDATOR_MESSAGE_TEMPLATES: ValidatorMessageTemplates = {
  entry:
    "\u{1F916} <b>PADR\u00C3O VALIDADOR</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{percentage}}",
  gale: "\u{1F6E1}\uFE0F <b>FAZ O {{gale}}</b>\n\u{1F3AF} <b>Entrada:</b> {{entry}}",
  green: "\u2705 <b>{{result}}</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}",
  red: "\u274C <b>RED</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}",
  scoreboard: "{{wins}} GREEN / {{loss}} RED / {{percentage}}",
  greenStreak: "{{wins}} GREENS SEGUIDOS",
  preAlert: "\u{1F9E9} <b>Padr\u00E3o quase formado</b>\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F4CC} <b>Condi\u00E7\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Poss\u00EDvel entrada:</b> {{entry}}",
  analyzing: "\u{1F50E} <b>ANALISANDO PADR\u00C3O</b>\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u23F3 Aguardando entrada validada",
};
type ValidatorTelegramModuleKey = "ai_patterns" | "paying_numbers" | "surf_alert" | "ties_only" | "validator";
type ValidatorTelegramButtonConfig = {
  enabled: boolean;
  label: string;
  url: string;
};
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
type ValidatorTelegramModuleSignal = {
  moduleKey: ValidatorTelegramModuleKey;
  channel: ValidatorNotificationChannel;
  notificationKey: string;
  signalKey: string;
  roundId: number;
  message: string;
  detectedAt: string;
  matchedAtMs: number;
  payloadJson?: Record<string, unknown>;
};
const VALIDATOR_TELEGRAM_MODULE_KEYS: ValidatorTelegramModuleKey[] = [
  "ai_patterns",
  "paying_numbers",
  "surf_alert",
  "ties_only",
  "validator",
];
const MAX_VALIDATOR_TELEGRAM_BUTTONS = 4;
const DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL = "Abrir Sniper Bo IA";
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F916} <b>PADR\u00C3O IA CONFIRMADO</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{confidence}}`,
  paying_numbers: `\u{1F48E} <b>N\u00DAMERO PAGANTE CONFIRMADO</b>\n\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entryLabel}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CC} <b>Status:</b> {{status}}`,
  surf_alert: `\u{1F30A} <b>AVISO DE SURF CONFIRMADO</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entryCompact}}\n\u26A0\uFE0F <b>Risco:</b> {{risk}}\n\u{1F4CA} <b>Confian\u00E7a:</b> {{confidence}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u{1F7E1} <b>POSS\u00CDVEL EMPATE</b>\n\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Cobertura:</b> at\u00E9 G{{tieCoverage}}\n\u{1F4CA} <b>N\u00EDvel:</b> {{level}}`,
  validator: `\u{1F916} <b>PADR\u00C3O VALIDADOR</b>\n\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}\n\u{1F4CA} <b>Assertividade:</b> {{percentage}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u2705 <b>{{result}}</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  paying_numbers: `\u2705 <b>{{result}}</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  surf_alert: `\u2705 <b>{{result}}</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u2705 <b>{{result}}</b>\n\n\u{1F7E1} <b>Empate confirmado</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  validator: `\u2705 <b>{{result}}</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_ANALYZING_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F50E} <b>ANALISANDO PADR\u00C3O IA</b>\n\u{1F3B2} <b>Mesa:</b> {{table}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  paying_numbers: `\u{1F50E} <b>ANALISANDO N\u00DAMERO PAGANTE</b>\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  surf_alert: `\u{1F50E} <b>ANALISANDO SURF</b>\n\u{1F30A} <b>Dire\u00E7\u00E3o:</b> {{side}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  ties_only: `\u{1F50E} <b>ANALISANDO EMPATE</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u23F3 Aguardando confirma\u00E7\u00E3o real.`,
  validator: `\u{1F50E} <b>ANALISANDO VALIDADOR</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u23F3 Aguardando entrada validada.`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_GALE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
  paying_numbers: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F522} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
  surf_alert: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
  ties_only: `\u{1F6E1}\uFE0F <b>COBRIR EMPATE {{gale}}</b>\n\u{1F7E1} <b>Press\u00E3o:</b> {{tie_pressure}}`,
  validator: `\u{1F6E1}\uFE0F <b>FAZER {{gale}}</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_RED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u274C <b>RED</b>\n\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  paying_numbers: `\u274C <b>RED</b>\n\n\u{1F48E} <b>N\u00FAmero:</b> {{number}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  surf_alert: `\u274C <b>RED</b>\n\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  ties_only: `\u274C <b>RED</b>\n\n\u{1F7E1} <b>Empate n\u00E3o confirmou</b>\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
  validator: `\u274C <b>RED</b>\n\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F3AF} <b>Entrada:</b> {{entry}}\n\u{1F6E1}\uFE0F <b>Prote\u00E7\u00E3o:</b> {{gale}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_EXPIRED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
  paying_numbers: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F522} <b>N\u00FAmeros:</b> {{numbers}}`,
  surf_alert: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F3AF} <b>Dire\u00E7\u00E3o:</b> {{side}}`,
  ties_only: `\u231B <b>ALERTA DE EMPATE EXPIRADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}`,
  validator: `\u231B <b>SINAL EXPIRADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_CANCELED_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F916} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  paying_numbers: `\u{1F6AB} <b>SINAL BLOQUEADO</b>\n\u{1F48E} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  surf_alert: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F30A} <b>M\u00F3dulo:</b> {{module}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  ties_only: `\u{1F6AB} <b>ALERTA CANCELADO</b>\n\u{1F7E1} <b>Press\u00E3o Tie:</b> {{tie_pressure}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
  validator: `\u{1F6AB} <b>SINAL CANCELADO</b>\n\u{1F9E9} <b>Padr\u00E3o:</b> {{pattern}}\n\u{1F4CC} <b>Motivo:</b> {{result}}`,
};
const DEFAULT_VALIDATOR_TELEGRAM_MODULE_TIE_TEMPLATES: Record<ValidatorTelegramModuleKey, string> = {
  ai_patterns: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES.ai_patterns,
  paying_numbers: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES.paying_numbers,
  surf_alert: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES.surf_alert,
  ties_only: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES.ties_only,
  validator: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES.validator,
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let liveDashboardData: LiveDashboardData = resetDashboardDailyCycle(mockDashboardData);
let liveValidatorRoundHistory: Round[] = [];
let liveValidatorPatterns: SavedValidatorPattern[] = [];
let liveValidatorChannels: ValidatorNotificationChannel[] = [];
let liveValidatorNotifications: Array<Record<string, unknown>> = [];
let liveValidatorPatternDeletedRefs: Array<Record<string, unknown>> = [];
let liveValidatorChannelDeletedRefs: Array<Record<string, unknown>> = [];
let liveNeuralCalendarDailyStats: NeuralCalendarDailyStat[] = [];
let liveNeuralCalendarHourlyStats: NeuralCalendarHourlyStat[] = [];
let liveNeuralCalendarCountedRoundKeys: Record<string, true> = {};
let liveNeuralCalendarStorageVersion = "";
let neuralCalendarHydratedFromTables = false;
let liveEngineHourlyStats: EngineCalendarAggregateStat[] = [];
let liveEngineDailyStats: EngineCalendarAggregateStat[] = [];
let liveEngineWeeklyStats: EngineCalendarAggregateStat[] = [];
let liveEngineMonthlyStats: EngineCalendarAggregateStat[] = [];
let liveEngineYearlyStats: EngineCalendarAggregateStat[] = [];
let liveEngineCalendarBackfillKeys: Record<string, true> = {};
let engineCalendarAutoBackfillPromise: Promise<void> | null = null;
let engineCalendarAutoBackfillAttemptedAt = 0;
let engineCalendarAutoBackfillCompleted = false;
let liveRecipients: Array<Record<string, unknown>> = [];
let liveClients: Array<Record<string, unknown>> = [];
let liveAccessEvents: Array<Record<string, unknown>> = [];
let liveSubscriptions: Array<Record<string, unknown>> = [];
let livePayments: Array<Record<string, unknown>> = [];
let liveAdminUsers: Array<Record<string, unknown>> = [];
let liveAdminActionLogs: Array<Record<string, unknown>> = [];
let liveDeletedEntities: Array<Record<string, unknown>> = [];
let liveModuleToggles = {
  tieAlert: true,
  surfAnalyzer: true,
};
let liveSalesSettings: SalesSettings = {
  salesClosed: false,
  updated_at: "",
  updated_by: "",
};
let liveSiteContentSettings: SiteContentSettings = DEFAULT_SITE_CONTENT_SETTINGS;
let liveLocalAiSettings: Partial<LocalAiSettings> = {};
let liveLocalAiLogs: LocalAiLog[] = [];
let liveStateSaveStatus: LiveStateSaveStatus = {
  durable: false,
  cache: false,
  durableConfigured: false,
  saved_at: "",
};
let liveStateLoadedAt = 0;
let liveStateLoadPromise: Promise<void> | null = null;
let liveStateSavePromise: Promise<LiveStateSaveStatus> | null = null;
let liveStateSavePending = false;
let protectedClientRegistryState: Record<string, unknown> | null = null;
let protectedClientRegistryLoadedAt = 0;
let clientRegistrySnapshotSavedAt = 0;
let clientRegistrySnapshotFingerprint = "";
const validatorRoundPrunedAt = new Map<string, number>();
const serverValidatorEngine = new NeuralValidatorEngine();
let validatorMonitorCacheLoadedAt = 0;
let validatorMonitorCachePromise: Promise<void> | null = null;
let validatorOfficialDispatchersBootstrapped = false;
let validatorInitialOfficialSignalKeys = new Set<string>();
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
const localAiRateBuckets = new Map<string, { count: number; resetAt: number }>();
const localAiCache = new Map<string, { response: string; createdAt: number }>();
const localAiCooldowns = new Map<string, number>();
const SERVER_STARTED_AT = Date.now();

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return withSecurityHeaders(
    new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} ??? try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const adminRedirect = redirectLegacyAdminRoute(request);
      if (adminRedirect) return withSecurityHeaders(adminRedirect);

      const healthResponse = handleHealthRequest(request, env);
      if (healthResponse) return withSecurityHeaders(healthResponse);

      const rateLimitResponse = handleRateLimit(request);
      if (rateLimitResponse) return withSecurityHeaders(rateLimitResponse);

      if (shouldLoadLiveStateForRequest(request)) {
        await loadLiveState(env);
      }

      const voiceResponse = await handleVoiceNarrationRequest(request, env);
      if (voiceResponse) return withSecurityHeaders(voiceResponse);

      const localVoiceResponse = await handleLocalVoiceRequest(request, env);
      if (localVoiceResponse) return withSecurityHeaders(localVoiceResponse);

      const voiceDiagnosticsResponse = await handleVoiceDiagnosticsRequest(request, env);
      if (voiceDiagnosticsResponse) return withSecurityHeaders(voiceDiagnosticsResponse);

      const localAiResponse = await handleLocalAiRequest(request, env);
      if (localAiResponse) return withSecurityHeaders(localAiResponse);

      const salesSettingsResponse = await handleSalesSettingsRequest(request);
      if (salesSettingsResponse) return withSecurityHeaders(salesSettingsResponse);

      const siteContentResponse = await handleSiteContentRequest(request);
      if (siteContentResponse) return withSecurityHeaders(siteContentResponse);

      const billingResponse = await handleBillingRequest(request, env);
      if (billingResponse) return withSecurityHeaders(billingResponse);

      const adminApiResponse = await handleAdminApiRequest(request, env);
      if (adminApiResponse) return withSecurityHeaders(adminApiResponse);

      const dashboardResponse = await handleDashboardRequest(request, env, ctx);
      if (dashboardResponse) return withSecurityHeaders(dashboardResponse);

      const adaptiveStrategyResponse = await handleAdaptiveStrategyRequest(request, env);
      if (adaptiveStrategyResponse) return withSecurityHeaders(adaptiveStrategyResponse);

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalizedResponse = await normalizeCatastrophicSsrResponse(response);
      return withSecurityHeaders(await injectSiteContentHeadResponse(request, normalizedResponse));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};

function handleHealthRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/health") return null;

  const uptimeSeconds = Math.max(0, Math.round((Date.now() - SERVER_STARTED_AT) / 1000));
  return json({
    status: "online",
    service: "signals-api",
    port: readServerNumber(env, "SIGNALS_API_PORT", 8787),
    pid: typeof process !== "undefined" ? String(process.pid) : "edge-runtime",
    uptime: `${uptimeSeconds}s`,
    uptimeSeconds,
    startedAt: new Date(SERVER_STARTED_AT).toISOString(),
  });
}

function redirectLegacyAdminRoute(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  if (request.headers.get("authorization")) return null;
  const url = new URL(request.url);
  const adminPageMap: Record<string, string> = {
    "/admin": "/app/admin",
    "/admin/login": "/app/admin",
    "/admin/users": "/app/admin/users",
    "/admin/logs": "/app/admin/logs",
    "/admin/modules": "/app/admin/modules",
    "/admin/broadcast": "/app/admin/broadcast",
  };
  const nextPath = adminPageMap[url.pathname];
  if (!nextPath) return null;

  url.pathname = nextPath;
  url.search = "";
  return Response.redirect(url.toString(), 302);
}

function shouldLoadLiveStateForRequest(request: Request) {
  if (request.method === "OPTIONS") return false;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/assets/")) return false;
  if (url.pathname.startsWith("/favicon")) return false;
  if (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml" || url.pathname === "/manifest.webmanifest") {
    return false;
  }
  return !/\.(?:avif|css|gif|ico|jpeg|jpg|js|json|map|mp3|png|svg|txt|webm|webp|woff2?)$/i.test(url.pathname);
}

function handleRateLimit(request: Request) {
  if (request.method === "OPTIONS") return null;

  const url = new URL(request.url);
  const limit = rateLimitForRequest(request.method, url.pathname);
  if (!limit) return null;

  const now = Date.now();
  const key = `${getClientIp(request)}:${request.method}:${url.pathname}`;
  const current = rateLimitBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  bucket.count += 1;
  rateLimitBuckets.set(key, bucket);

  if (rateLimitBuckets.size > 5000) {
    for (const [bucketKey, value] of rateLimitBuckets.entries()) {
      if (value.resetAt <= now) rateLimitBuckets.delete(bucketKey);
    }
  }

  if (bucket.count <= limit) return null;

  return json(
    {
      error: "Muitas requisicoes. Aguarde alguns instantes e tente novamente.",
    },
    429,
  );
}

function rateLimitForRequest(method: string, pathname: string) {
  if (pathname === "/auth/check" || pathname === "/auth/register" || pathname === "/admin/login") {
    return 30;
  }
  if (pathname === "/billing/checkout") return 12;
  if (
    pathname === "/sales/settings" ||
    pathname === "/admin/sales-settings" ||
    pathname === "/site-content" ||
    pathname === "/admin/site-content" ||
    pathname === "/admin/broadcast"
  ) {
    return 120;
  }
  if (pathname === "/webhooks/mercadopago") return 240;
  if (pathname === "/api/webhook/hubla" || pathname === "/api/webhooks/hubla") return 240;
  if (pathname === "/auth/verify") return 60;
  if (pathname === "/voice/narration") return 25;
  if (pathname === "/api/voice/speak") return 40;
  if (pathname === "/api/ai/local-commentary") return 60;
  if (pathname === "/dashboard") return method === "GET" ? 120 : 240;
  if (pathname === "/dashboard/round-history") return 120;
  if (pathname === "/dashboard/signal") return 240;
  if (pathname === "/dashboard/publish") return 240;
  if (pathname === "/validator/validate") return 120;
  if (pathname === "/validator/round-history") return method === "GET" ? 120 : 240;
  if (
    pathname === "/validator/patterns" ||
    pathname.startsWith("/validator/patterns/") ||
    pathname === "/validator/channels" ||
    pathname.startsWith("/validator/channels/") ||
    pathname === "/validator/channels/test" ||
    isTelegramServiceRoutePath(pathname)
  )
    return 120;
  if (pathname === "/validator/telegram/test" || pathname === "/validator/telegram/send") return 30;
  if (pathname === "/adaptive-strategy/sync") return 240;
  if (
    pathname === "/billing/plans" ||
    pathname === "/billing/subscription" ||
    pathname === "/billing/payments" ||
    pathname === "/admin/summary" ||
    pathname === "/telegram-recipients" ||
    pathname.startsWith("/telegram-recipients/") ||
    pathname === "/module-toggles" ||
    pathname === "/security-events" ||
    pathname === "/voice/diagnostics" ||
    pathname === "/admin/local-ai" ||
    pathname === "/auth/diagnostics"
  ) {
    return 120;
  }
  return null;
}

function getClientIp(request: Request) {
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

async function handleVoiceNarrationRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/narration") return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method !== "POST") {
    return json({ error: "Metodo nao permitido." }, 405);
  }

  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const body = readRecord(await request.json().catch(() => ({})));
  const rawText = String(body.text || body.narration || "");
  const text = normalizeNarrationText(rawText);
  if (!text) {
    return json({ error: "Texto de voz obrigatorio." }, 400);
  }
  if (text.length > MAX_NARRATION_CHARS) {
    return json({ error: `Texto de voz muito longo. Limite: ${MAX_NARRATION_CHARS} caracteres.` }, 413);
  }

  if (!readServerBoolean(env, "ELEVENLABS_ENABLED", false)) {
    return json({
      fallback: "browser",
      reason: "Voz antiga desativada. Use /api/voice/speak com Edge TTS local.",
    });
  }

  const apiKeys = getElevenLabsApiKeys(env);
  if (!apiKeys.length) {
    return json({ error: "ELEVENLABS_API_KEY nao configurada no backend." }, 503);
  }

  const voiceId = getElevenLabsVoiceId(env);
  if (!voiceId) {
    return json({ error: "ELEVENLABS_VOICE_ID nao configurado no backend." }, 503);
  }

  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  let response: Response | null = null;
  let lastFailureStatus: number | "network_error" | null = null;
  for (const apiKey of apiKeys) {
    response = await fetch(
      `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_FAST_OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: false,
          },
        }),
      },
    ).catch(() => null);

    if (response?.ok) break;
    lastFailureStatus = response?.status ?? "network_error";
    response = null;
  }

  if (!response) {
    recordElevenLabsStatus(lastFailureStatus ?? "network_error");
    if (typeof lastFailureStatus === "number") {
      console.warn(`Falha ao gerar voz ElevenLabs (${lastFailureStatus}) em todas as chaves configuradas.`);
      return json(elevenLabsErrorPayload(lastFailureStatus), elevenLabsErrorStatus(lastFailureStatus));
    }
    return json({ error: "Falha de conexao ao gerar voz ElevenLabs." }, 502);
  }

  recordElevenLabsStatus("ok");
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
    },
  });
}

async function handleVoiceDiagnosticsRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/voice/diagnostics") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);

  if (!(await isDashboardAuthorized(request, url, env))) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const apiKeys = getElevenLabsApiKeys(env);
  const hasElevenLabsKey = apiKeys.length > 0;
  const hasVoiceId = Boolean(getElevenLabsVoiceId(env));
  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);

  if (url.searchParams.get("check") === "elevenlabs") {
    let elevenLabsAuthOk = false;
    let elevenLabsAuthStatus: string | number = "no_api_key";
    for (const apiKey of apiKeys) {
      try {
        const res = await fetch("https://api.elevenlabs.io/v1/user", {
          method: "GET",
          headers: { "xi-api-key": apiKey, Accept: "application/json" },
        });
        elevenLabsAuthOk = res.ok;
        elevenLabsAuthStatus = res.status;
        if (res.ok) break;
      } catch {
        elevenLabsAuthStatus = "network_error";
      }
    }
    return json({
      elevenLabsAuthOk,
      elevenLabsAuthStatus,
      hasElevenLabsKey,
      hasVoiceId,
      keyCount: apiKeys.length,
      modelId,
    });
  }

  return json({
    hasElevenLabsKey,
    hasVoiceId,
    keyCount: apiKeys.length,
    modelId,
    provider: "elevenlabs",
    lastElevenLabsStatus,
  });
}

async function handleLocalVoiceRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/voice/speak") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const body = readRecord(await request.json().catch(() => ({})));
  const text = normalizeNarrationText(readString(body, "text"));
  if (!text) return json({ error: "Texto de voz obrigatorio." }, 400);
  if (text.length > MAX_NARRATION_CHARS) {
    return json({ error: `Texto de voz muito longo. Limite: ${MAX_NARRATION_CHARS} caracteres.` }, 413);
  }

  const settings = getLocalAiSettings(env);
  const provider = readString(body, "provider") || settings.voiceProvider;
  if (provider === "elevenlabs") {
    return generateElevenLabsVoiceResponse(text, env);
  }
  if (provider !== "edge-tts") {
    return json({ fallback: "browser", reason: "Provedor local ainda nao ativo no backend." });
  }

  const edgeTtsUrl = readServerEnvString(env, "EDGE_TTS_URL", "").replace(/\/+$/, "");
  if (!edgeTtsUrl) {
    return json({ fallback: "browser", reason: "EDGE_TTS_URL nao configurado no backend." });
  }

  try {
    const response = await fetch(edgeTtsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: readString(body, "voice") || settings.voiceName,
        language: readString(body, "language") || "pt-BR",
        volume: safeServerNumber(body.volume, settings.voiceVolume),
        rate: safeServerNumber(body.rate, settings.voiceRate),
        pitch: safeServerNumber(body.pitch, settings.voicePitch),
      }),
    });
    if (!response.ok) {
      return json({ fallback: "browser", reason: `Edge TTS indisponivel (${response.status}).` });
    }

    return new Response(await response.arrayBuffer(), {
      status: 200,
      headers: {
        "content-type": response.headers.get("content-type") || "audio/mpeg",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers":
          "Content-Type,Authorization,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
      },
    });
  } catch (error) {
    console.warn("Edge TTS indisponivel.", error);
    return json({ fallback: "browser", reason: "Falha de conexao com Edge TTS." });
  }
}

async function generateElevenLabsVoiceResponse(text: string, env: unknown) {
  const apiKeys = getElevenLabsApiKeys(env);
  if (!apiKeys.length) {
    return json({ error: "ELEVENLABS_API_KEY nao configurada no backend." }, 503);
  }

  const voiceId = getElevenLabsVoiceId(env);
  if (!voiceId) {
    return json({ error: "ELEVENLABS_VOICE_ID nao configurado no backend." }, 503);
  }

  const modelId = readServerEnvString(env, "ELEVENLABS_MODEL_ID", DEFAULT_ELEVENLABS_MODEL_ID);
  let response: Response | null = null;
  let lastFailureStatus: number | "network_error" | null = null;

  for (const apiKey of apiKeys) {
    response = await fetch(
      `${ELEVENLABS_TTS_URL}/${encodeURIComponent(voiceId)}?output_format=${ELEVENLABS_FAST_OUTPUT_FORMAT}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: false,
          },
        }),
      },
    ).catch(() => null);

    if (response?.ok) break;
    lastFailureStatus = response?.status ?? "network_error";
    response = null;
  }

  if (!response) {
    recordElevenLabsStatus(lastFailureStatus ?? "network_error");
    if (typeof lastFailureStatus === "number") {
      return json(elevenLabsErrorPayload(lastFailureStatus), elevenLabsErrorStatus(lastFailureStatus));
    }
    return json({ error: "Falha de conexao ao gerar voz ElevenLabs." }, 502);
  }

  recordElevenLabsStatus("ok");
  return new Response(await response.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature",
    },
  });
}

async function handleLocalAiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);

  if (url.pathname === "/admin/local-ai") {
    if (request.method === "OPTIONS") return json(null, 204);
    const role = await getAdminRequestRole(request, env);
    if (!role) return json({ error: "Nao autorizado." }, 401);
    if (request.method === "GET") {
      return json({
        settings: getLocalAiSettings(env),
        logs: liveLocalAiLogs.slice(0, 100),
        status: await probeOllamaStatus(env),
      });
    }
    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      liveLocalAiSettings = normalizeLocalAiSettingsPatch(body, getLocalAiSettings(env));
      await saveLiveState(env);
      return json({
        settings: getLocalAiSettings(env),
        logs: liveLocalAiLogs.slice(0, 100),
        status: await probeOllamaStatus(env),
      });
    }
    return json({ error: "Metodo nao permitido." }, 405);
  }

  if (url.pathname !== "/api/ai/local-commentary") return null;
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);
  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const startedAt = Date.now();
  const settings = getLocalAiSettings(env);
  const body = readRecord(await request.json().catch(() => ({})));
  const event = sanitizeQuestion(readString(body, "event") || "chat", 80);
  const question = sanitizeQuestion(readString(body, "question"), 260);
  const fallbackText = sanitizeQuestion(readString(body, "fallbackText"), 360);
  const userKey = localAiUserKey(request, body);
  const summary = buildLocalAiMarketSummary(liveDashboardData, body);

  if (!settings.enabled) {
    const commentary = fallbackText || fallbackLocalAiCommentary(event, summary);
    recordLocalAiLog(
      userKey,
      event,
      question,
      commentary,
      settings.ollamaModel,
      "fallback",
      Date.now() - startedAt,
      "disabled",
      "",
      summary,
    );
    return json({ commentary, provider: "fallback", model: settings.ollamaModel, status: "disabled" });
  }

  const rateBlocked = consumeLocalAiRate(userKey, settings.callsPerMinute);
  if (rateBlocked) {
    return json({ error: "IA local em cooldown: muitas perguntas em pouco tempo." }, 429);
  }

  const cacheKey = hashServerText(JSON.stringify({ event, question, summary: compactLocalAiCacheSummary(summary) }));
  const cached = localAiCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 90_000) {
    return json({
      commentary: cached.response,
      cached: true,
      provider: "ollama",
      model: settings.ollamaModel,
      status: "ok",
    });
  }

  const lastCall = localAiCooldowns.get(userKey) || 0;
  if (Date.now() - lastCall < settings.cooldownMs) {
    const commentary = fallbackText || fallbackLocalAiCommentary(event, summary);
    return json({ commentary, provider: "fallback", model: settings.ollamaModel, status: "fallback", cached: true });
  }
  localAiCooldowns.set(userKey, Date.now());

  const prompt = buildLocalAiPrompt(event, question, fallbackText, summary);
  const ollama = await callOllama(settings, prompt);
  const commentary = cleanLocalAiResponse(ollama.response || fallbackText || fallbackLocalAiCommentary(event, summary));
  const provider = ollama.ok ? "ollama" : "fallback";
  localAiCache.set(cacheKey, { response: commentary, createdAt: Date.now() });
  recordLocalAiLog(
    userKey,
    event,
    question,
    commentary,
    settings.ollamaModel,
    provider,
    Date.now() - startedAt,
    ollama.ok ? "ok" : "fallback",
    ollama.error,
    summary,
  );

  return json({
    commentary,
    provider,
    model: settings.ollamaModel,
    status: ollama.ok ? "ok" : "fallback",
    error: ollama.error || undefined,
  });
}

function getLocalAiSettings(env: unknown): LocalAiSettings {
  return {
    enabled: readServerBoolean(env, "AI_LOCAL_ENABLED", true, liveLocalAiSettings.enabled),
    narrationEnabled: readServerBoolean(env, "AI_LOCAL_NARRATION_ENABLED", true, liveLocalAiSettings.narrationEnabled),
    ollamaBaseUrl:
      liveLocalAiSettings.ollamaBaseUrl ||
      readServerEnvString(env, "OLLAMA_BASE_URL", DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, ""),
    ollamaModel: liveLocalAiSettings.ollamaModel || readServerEnvString(env, "OLLAMA_MODEL", DEFAULT_OLLAMA_MODEL),
    voiceProvider: liveLocalAiSettings.voiceProvider || readServerEnvString(env, "VOICE_PROVIDER", "edge-tts"),
    voiceName: liveLocalAiSettings.voiceName || readServerEnvString(env, "VOICE_NAME", DEFAULT_EDGE_TTS_VOICE),
    voiceVolume: safeServerNumber(liveLocalAiSettings.voiceVolume, readServerNumber(env, "VOICE_VOLUME", 0.9)),
    voiceRate: safeServerNumber(liveLocalAiSettings.voiceRate, readServerNumber(env, "VOICE_RATE", 1)),
    voicePitch: safeServerNumber(liveLocalAiSettings.voicePitch, readServerNumber(env, "VOICE_PITCH", 0.95)),
    callsPerMinute: Math.max(
      1,
      Math.floor(
        safeServerNumber(liveLocalAiSettings.callsPerMinute, readServerNumber(env, "AI_LOCAL_CALLS_PER_MINUTE", 12)),
      ),
    ),
    cooldownMs: Math.max(
      0,
      Math.floor(safeServerNumber(liveLocalAiSettings.cooldownMs, readServerNumber(env, "AI_LOCAL_COOLDOWN_MS", 8000))),
    ),
  };
}

function normalizeLocalAiSettingsPatch(body: Record<string, unknown>, fallback: LocalAiSettings) {
  return {
    enabled: typeof body.enabled === "boolean" ? body.enabled : fallback.enabled,
    narrationEnabled: typeof body.narrationEnabled === "boolean" ? body.narrationEnabled : fallback.narrationEnabled,
    ollamaBaseUrl: readString(body, "ollamaBaseUrl") || fallback.ollamaBaseUrl,
    ollamaModel: readString(body, "ollamaModel") || fallback.ollamaModel,
    voiceProvider: readString(body, "voiceProvider") || fallback.voiceProvider,
    voiceName: readString(body, "voiceName") || fallback.voiceName,
    voiceVolume: safeServerNumber(body.voiceVolume, fallback.voiceVolume),
    voiceRate: safeServerNumber(body.voiceRate, fallback.voiceRate),
    voicePitch: safeServerNumber(body.voicePitch, fallback.voicePitch),
    callsPerMinute: safeServerNumber(body.callsPerMinute, fallback.callsPerMinute),
    cooldownMs: safeServerNumber(body.cooldownMs, fallback.cooldownMs),
  } satisfies LocalAiSettings;
}

async function probeOllamaStatus(env: unknown) {
  const settings = getLocalAiSettings(env);
  try {
    const response = await fetch(`${settings.ollamaBaseUrl}/api/tags`, { method: "GET" });
    return {
      online: response.ok,
      status: response.ok ? "Online" : `Offline (${response.status})`,
      model: settings.ollamaModel,
      baseUrl: settings.ollamaBaseUrl,
    };
  } catch {
    return {
      online: false,
      status: "Offline",
      model: settings.ollamaModel,
      baseUrl: settings.ollamaBaseUrl,
    };
  }
}

async function callOllama(settings: LocalAiSettings, prompt: string) {
  try {
    const response = await fetch(`${settings.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: settings.ollamaModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.45,
          top_p: 0.82,
          num_predict: 140,
        },
      }),
    });
    if (!response.ok) return { ok: false, response: "", error: `Ollama ${response.status}` };
    const payload = readRecord(await response.json().catch(() => ({})));
    return { ok: true, response: readString(payload, "response"), error: "" };
  } catch (error) {
    return { ok: false, response: "", error: "Ollama offline ou inacessivel." };
  }
}

function buildLocalAiPrompt(event: string, question: string, fallbackText: string, summary: Record<string, unknown>) {
  return [
    "Voce e o Sniper Voice IA, analista virtual de Bac Bo dentro do Sniper Bo IA.",
    "Voce NAO decide entradas. As entradas ja foram decididas pelos modulos internos.",
    "Use somente os dados reais enviados em JSON. Nao invente porcentagens, estatisticas ou fatos.",
    "Nunca prometa lucro. Nunca diga certeza, garantida ou entrada garantida.",
    "Se nao houver dados suficientes, diga que a mesa esta em observacao.",
    "Tom: natural, agressivo, confiante, profissional, frases curtas, sala ao vivo.",
    "Sempre mencione risco quando o risco estiver alto.",
    "Responda em portugues do Brasil, com no maximo 3 frases curtas.",
    `Evento: ${event || "chat"}`,
    question ? `Pergunta do usuario: ${question}` : "",
    fallbackText ? `Comentario base do sistema: ${fallbackText}` : "",
    `Dados reais do Sniper Bo IA: ${JSON.stringify(summary).slice(0, 6000)}`,
    "Resposta:",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildLocalAiMarketSummary(data: LiveDashboardData, body: Record<string, unknown>) {
  const rounds = data.rounds.slice(-30);
  const adaptive = readRecord(body.adaptiveSnapshot);
  const entryScore = readRecord(adaptive.entryScore);
  const topPattern = Array.isArray(adaptive.patterns) ? readRecord(adaptive.patterns[0]) : {};
  return {
    mesa: "Mesa principal",
    updatedAt: data.updatedAt || "",
    ultimasRodadas: rounds,
    tendenciaAtual: summarizeRoundTrend(rounds),
    entradaAtual: data.currentSignal,
    decisaoEngine: data.engineDecision,
    surfAtual: data.currentSurfAlert || null,
    numeroPagante: data.neuralReading || null,
    tieAlert: data.currentTieAlert,
    scoreEntrada: entryScore.finalScore ?? null,
    estrategiaAtiva: {
      label: readString(topPattern, "label"),
      status: readString(topPattern, "status"),
      direcao: readString(topPattern, "direction"),
      ocorrencias: topPattern.occurrences ?? null,
      assertividade: topPattern.assertiveness ?? null,
    },
    placaresRecentes: {
      principal: data.mainScoreboard,
      tie: data.tieAlertScoreboard,
      surf: data.surfAnalyzerScoreboard,
      neural: data.neuralScoreboard || data.neuralReading || null,
    },
    risco: summarizeMarketRisk(data),
    logsRecentes: Array.isArray(adaptive.decisionLogs) ? adaptive.decisionLogs.slice(0, 8) : [],
  };
}

function summarizeRoundTrend(rounds: DashboardData["rounds"]) {
  const banker = rounds.filter((round) => round.result === "B").length;
  const player = rounds.filter((round) => round.result === "P").length;
  const tie = rounds.filter((round) => round.result === "T").length;
  return {
    banker,
    player,
    tie,
    dominante: banker >= player && banker >= tie ? "BANKER" : player >= tie ? "PLAYER" : "TIE",
    sequencia: rounds
      .slice(-12)
      .map((round) => round.result)
      .join(""),
  };
}

function summarizeMarketRisk(data: DashboardData) {
  const tieHigh =
    data.currentTieAlert.status === "active" && normalizeText(data.currentTieAlert.level).includes("ALTO");
  const surfRisk = data.currentSurfAlert?.surf_break_risk ?? data.currentSurfAlert?.surf_risk ?? 0;
  const neuralRisk = data.neuralReading?.isSaturated || data.neuralReading?.isRedAlert;
  const blocked = data.engineDecision.state === "BLOQUEADO";
  const high = tieHigh || surfRisk >= 70 || neuralRisk || blocked;
  return {
    nivel: high ? "alto" : surfRisk >= 40 ? "medio" : "controlado",
    tieHigh,
    surfRisk,
    neuralRisk,
    blocked,
    motivo: data.engineDecision.reason,
  };
}

function fallbackLocalAiCommentary(event: string, summary: Record<string, unknown>) {
  const risk = readRecord(summary.risco);
  const entry = readRecord(summary.entradaAtual);
  const side = readString(entry, "side");
  if (readString(risk, "nivel") === "alto") {
    return "Cuidado. O mercado esta pesado e o risco subiu. Melhor nao forcar entrada agora.";
  }
  if (event.includes("green")) return "Bateu. Green confirmado. A leitura respeitou o padrao.";
  if (event.includes("red")) return "Red confirmado. O mercado quebrou a leitura. Gestao primeiro.";
  if (side === "BANKER" || side === "PLAYER" || side === "TIE") {
    return `Entrada confirmada em ${side}. A leitura veio dos modulos internos e o risco esta monitorado.`;
  }
  return "Mesa ainda em observacao. Tem movimento, mas nao existe confirmação limpa para entrada.";
}

function cleanLocalAiResponse(value: string) {
  const text = beautifyPortugueseText(sanitizeQuestion(value, 520))
    .replace(/entrada\s+garantida/gi, "entrada confirmada pelos modulos")
    .replace(/\bgarantid[ao]\b/gi, "confirmado pelos dados")
    .replace(/\bcerteza\b/gi, "leitura")
    .replace(/lucro\s+certo/gi, "resultado ainda depende do mercado");
  return text || "Mesa em observacao. Ainda sem dados suficientes para comentario seguro.";
}

function beautifyPortugueseText(value: string) {
  const mojibakeFixed = value;

  return [
    ["voce", "voce"],
    ["nao", "nao"],
    ["atencao", "atencao"],
    ["observacao", "observacao"],
    ["narracao", "narracao"],
    ["comentario", "comentario"],
    ["analise", "analise"],
    ["numero", "numero"],
    ["padrao", "padrao"],
    ["gestao", "gestao"],
    ["confianca", "confianca"],
    ["direcao", "direcao"],
    ["protecao", "protecao"],
    ["confirmação", "confirmação"],
    ["proxima", "proxima"],
    ["forcar", "forcar"],
    ["modulos", "modulos"],
    ["metricas", "metricas"],
    ["estatisticas", "estatisticas"],
    ["usuario", "usuario"],
    ["usuarios", "usuarios"],
    ["responsavel", "responsavel"],
    ["prejuizo", "prejuizo"],
    ["apos", "apos"],
    ["ate", "ate"],
    ["esta", "esta"],
    ["ta", "ta"],
    ["so", "so"],
    ["mao", "mao"],
    ["tambem", "tambem"],
    ["valida", "valida"],
    ["possivel", "possivel"],
    ["saida", "saida"],
  ].reduce((text, [plain, accented]) => replacePortugueseWord(text, plain, accented), mojibakeFixed);
}

function replacePortugueseWord(text: string, plain: string, accented: string) {
  return text.replace(new RegExp(`\\b${plain}\\b`, "gi"), (match) =>
    match[0] === match[0]?.toUpperCase() ? `${accented[0]?.toUpperCase() ?? ""}${accented.slice(1)}` : accented,
  );
}

function sanitizeQuestion(value: unknown, maxLength = 260) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\b(ignore|system prompt|developer|jailbreak|prompt injection)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function consumeLocalAiRate(userKey: string, limit: number) {
  const now = Date.now();
  const current = localAiRateBuckets.get(userKey);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + 60_000 };
  bucket.count += 1;
  localAiRateBuckets.set(userKey, bucket);
  return bucket.count > limit;
}

function localAiUserKey(request: Request, body: Record<string, unknown>) {
  const explicit = readString(body, "user") || readString(body, "email");
  return explicit || getClientIp(request);
}

function compactLocalAiCacheSummary(summary: Record<string, unknown>) {
  return {
    entradaAtual: summary.entradaAtual,
    risco: summary.risco,
    tendenciaAtual: summary.tendenciaAtual,
    scoreEntrada: summary.scoreEntrada,
    estrategiaAtiva: summary.estrategiaAtiva,
  };
}

function recordLocalAiLog(
  user: string,
  event: string,
  question: string,
  response: string,
  model: string,
  provider: string,
  durationMs: number,
  status: string,
  error: string,
  data: Record<string, unknown>,
) {
  liveLocalAiLogs = [
    {
      id: crypto.randomUUID(),
      user,
      mesa: readString(data, "mesa") || "Mesa principal",
      event,
      question,
      response,
      model,
      provider,
      durationMs,
      estimatedCost: 0,
      status,
      error,
      timestamp: new Date().toISOString(),
      data,
    },
    ...liveLocalAiLogs,
  ].slice(0, 250);
}

function readServerBoolean(env: unknown, key: string, fallback: boolean, override?: boolean) {
  if (typeof override === "boolean") return override;
  const value = readServerEnvString(env, key, "");
  if (!value) return fallback;
  return ["1", "true", "sim", "yes", "on"].includes(value.trim().toLowerCase());
}

function safeServerNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashServerText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

async function handleSalesSettingsRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/sales/settings") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);

  return json({ salesSettings: publicSalesSettings() });
}

async function handleSiteContentRequest(request: Request) {
  const url = new URL(request.url);
  if (url.pathname !== "/site-content") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);

  return json({ siteContent: publicSiteContentSettings() });
}

async function handleBillingRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  const billingPaths = new Set([
    "/billing/plans",
    "/billing/checkout",
    "/billing/subscription",
    "/billing/payments",
    "/webhooks/mercadopago",
    "/api/webhook/hubla",
    "/api/webhooks/hubla",
  ]);
  if (!billingPaths.has(url.pathname)) return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/billing/plans") {
    return json({
      plans: liveSalesSettings.salesClosed ? [] : getBillingPlans(env),
      salesSettings: publicSalesSettings(),
    });
  }

  if (request.method === "POST" && url.pathname === "/webhooks/mercadopago") {
    return handleMercadoPagoWebhook(request, url, env);
  }

  if (request.method === "POST" && (url.pathname === "/api/webhook/hubla" || url.pathname === "/api/webhooks/hubla")) {
    return handleHublaWebhook(request, env);
  }

  if (request.method === "POST" && url.pathname === "/billing/checkout") {
    if (liveSalesSettings.salesClosed) {
      return json({ error: "Vendas encerradas no momento. Entre na fila de espera para a proxima abertura." }, 403);
    }
    const body = readRecord(await request.json().catch(() => ({})));
    const plan = normalizeBillingPlanId(body.plan);
    if (!plan || plan === "free") {
      return json({ error: "Escolha um plano VIP ou Premium para abrir o checkout." }, 400);
    }
    const auth = await requireClientBillingSession(request, env);
    const client = auth.ok ? auth.client : await recoverCheckoutClientFromBody(env, request, body, auth);
    if (!client) {
      return json(
        {
          error: "Sessao expirada. Volte ao cadastro, entre com seu e-mail e tente comprar novamente.",
        },
        auth.status,
      );
    }
    return createMercadoPagoCheckout(request, env, client, plan);
  }

  const auth = await requireClientBillingSession(request, env);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (request.method === "GET" && url.pathname === "/billing/subscription") {
    refreshExpiredBillingForClient(auth.client);
    await saveLiveState(env);
    return json({
      subscription: buildBillingOverview(auth.client),
      plans: liveSalesSettings.salesClosed ? [] : getBillingPlans(env),
      salesSettings: publicSalesSettings(),
    });
  }

  if (request.method === "GET" && url.pathname === "/billing/payments") {
    const email = readString(auth.client, "email").toLowerCase();
    return json({
      payments: livePayments
        .filter((payment) => readString(payment, "email").toLowerCase() === email)
        .sort((a, b) => readString(b, "created_at").localeCompare(readString(a, "created_at"))),
    });
  }

  return json({ error: "Rota de assinatura nao encontrada." }, 404);
}

async function requireClientBillingSession(
  request: Request,
  env: unknown,
): Promise<
  { ok: true; client: Record<string, unknown>; session: SessionPayload } | { ok: false; status: number; error: string }
> {
  const token = getBearerToken(request);
  if (!token) return { ok: false, status: 401, error: "Sessao obrigatoria." };

  const session = await verifySessionToken(env, token);
  if (!session) return { ok: false, status: 401, error: "Sessao expirada." };
  if (session.scope !== "client") {
    return { ok: false, status: 403, error: "Use uma conta de cliente para assinar." };
  }

  const client = findClientByEmail(session.email) || (await hydrateClientFromBilling(env, session.email));
  if (!client) return { ok: false, status: 404, error: "Cliente nao encontrado." };

  const sessionCheck = await validateClientSessionBinding(env, request, session, client);
  if (!sessionCheck.ok) {
    recordAccessEvent("client_session_blocked", {
      ...client,
      risk: "high",
      detail: sessionCheck.reason,
      ip_hash: sessionCheck.ipHash || "",
      user_agent_hash: sessionCheck.userAgentHash || "",
    });
    await saveLiveState(env);
    return { ok: false, status: 401, error: "Sessao invalida ou usada em outro dispositivo." };
  }

  return { ok: true, client, session };
}

async function recoverCheckoutClientFromBody(
  env: unknown,
  request: Request,
  body: Record<string, unknown>,
  auth: { ok: false; status: number; error: string },
) {
  const email = readString(body, "email").toLowerCase();
  if (!email) return null;

  const client =
    findClientByEmail(email) ||
    (await hydrateClientFromBilling(env, email)) ||
    (await createCheckoutLeadClientFromBody(env, request, body, email, auth));
  if (!client) return null;

  const binding = await requestSessionBinding(env, request);
  recordAccessEvent("checkout_session_recovered", {
    ...client,
    risk: auth.status >= 500 ? "medium" : "low",
    detail: `Checkout liberado por e-mail apos falha de sessao: ${auth.error}`,
    ip_hash: binding.ipHash || "",
    user_agent_hash: binding.userAgentHash || "",
  });
  await saveLiveState(env);
  return client;
}

async function createCheckoutLeadClientFromBody(
  env: unknown,
  request: Request,
  body: Record<string, unknown>,
  email: string,
  auth: { ok: false; status: number; error: string },
) {
  if (!email.includes("@")) return null;

  const now = new Date().toISOString();
  const binding = await requestSessionBinding(env, request);
  const client: Record<string, unknown> = {
    id: crypto.randomUUID(),
    full_name: readString(body, "full_name") || readString(body, "name") || nameFromEmail(email),
    email,
    phone: readString(body, "phone"),
    phone_full: readString(body, "phone_full") || readString(body, "phoneFull"),
    city: readString(body, "city"),
    country: readString(body, "country"),
    country_code: readString(body, "country_code") || readString(body, "countryCode"),
    plan: "free",
    access_status: "pending",
    enabled: false,
    starts_at: todayIso(),
    validity_days: 0,
    expires_at: "",
    trial_started_at: "",
    trial_expires_at: "",
    trial_ip_hash: binding.ipHash,
    trial_user_agent_hash: binding.userAgentHash,
    trial_blocked_reason: `Checkout iniciado apos falha de sessao: ${auth.error}`,
    created_at: now,
    updated_at: now,
  };

  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("checkout_lead_created", {
    ...client,
    risk: "low",
    detail: "Contato pendente criado para nao perder checkout com sessao vencida.",
    ip_hash: binding.ipHash || "",
    user_agent_hash: binding.userAgentHash || "",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(email) || client;
}

async function createMercadoPagoCheckout(
  request: Request,
  env: unknown,
  client: Record<string, unknown>,
  plan: BillingPlanId,
) {
  const hublaCheckoutUrl = getHublaCheckoutUrl(plan, env);
  if (hublaCheckoutUrl) {
    const now = new Date().toISOString();
    const email = readString(client, "email").toLowerCase();
    const planConfig = getBillingPlan(plan, env);
    const subscriptionId = crypto.randomUUID();
    const externalReference = `sniperbo-hubla:${subscriptionId}:${email}:${plan}`;
    const subscription = upsertSubscriptionRecord({
      id: subscriptionId,
      user_id: readString(client, "id"),
      email,
      plan,
      status: "pending",
      provider: "hubla",
      provider_preference_id: "",
      provider_payment_id: "",
      external_reference: externalReference,
      starts_at: "",
      expires_at: "",
      created_at: now,
      updated_at: now,
    });
    const payment = upsertPaymentRecord({
      id: crypto.randomUUID(),
      user_id: readString(client, "id"),
      subscription_id: subscriptionId,
      email,
      plan,
      provider: "hubla",
      provider_preference_id: "",
      provider_payment_id: "",
      external_reference: externalReference,
      status: "pending",
      amount: planConfig.amount,
      currency: getMercadoPagoCurrency(env),
      paid_at: "",
      created_at: now,
      updated_at: now,
    });

    await saveLiveState(env);
    await persistBillingRecords(env, client, subscription, payment);
    return json({
      checkout_url: hublaCheckoutUrl,
      provider: "hubla",
      subscription: buildSubscriptionPublic(subscription),
    });
  }

  const accessToken = getMercadoPagoAccessToken(env);
  if (!accessToken) {
    return json(
      {
        error: "Checkout Hubla nao configurado. Adicione HUBLA_CHECKOUT_URL ou o link do plano nos Secrets.",
      },
      503,
    );
  }

  const planConfig = getBillingPlan(plan, env);
  if (!planConfig || !planConfig.amount || planConfig.amount <= 0) {
    return json({ error: "Valor do plano nao configurado." }, 503);
  }

  const now = new Date().toISOString();
  const email = readString(client, "email").toLowerCase();
  const subscriptionId = crypto.randomUUID();
  const externalReference = `sniperbo:${subscriptionId}:${email}:${plan}`;
  const origin = getPublicAppOrigin(request, env);
  const successUrl = readNamedServerSecret(env, "MERCADOPAGO_SUCCESS_URL", `${origin}/app/assinatura?status=approved`);
  const pendingUrl = readNamedServerSecret(env, "MERCADOPAGO_PENDING_URL", `${origin}/app/assinatura?status=pending`);
  const failureUrl = readNamedServerSecret(env, "MERCADOPAGO_FAILURE_URL", `${origin}/app/assinatura?status=failure`);
  const preferenceBody = {
    items: [
      {
        id: planConfig.id,
        title: `SNIPER BO IA - ${planConfig.name}`,
        description: planConfig.description,
        quantity: 1,
        currency_id: getMercadoPagoCurrency(env),
        unit_price: planConfig.amount,
      },
    ],
    payer: {
      email,
      name: readString(client, "full_name") || nameFromEmail(email),
    },
    back_urls: {
      success: successUrl,
      pending: pendingUrl,
      failure: failureUrl,
    },
    auto_return: "approved",
    notification_url: `${origin}/webhooks/mercadopago`,
    external_reference: externalReference,
    metadata: {
      email,
      plan,
      subscription_id: subscriptionId,
    },
  };

  let preference: Record<string, unknown>;
  try {
    const response = await fetch(MERCADOPAGO_PREFERENCE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceBody),
    });
    preference = readRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      console.warn(`Mercado Pago preference falhou (${response.status}).`);
      return json({ error: "Nao foi possivel criar checkout no Mercado Pago." }, 502);
    }
  } catch (error) {
    console.warn("Falha de rede ao criar checkout Mercado Pago.", error);
    return json({ error: "Mercado Pago indisponivel no momento." }, 502);
  }

  const preferenceId = readString(preference, "id");
  const checkoutUrl = readString(preference, "init_point") || readString(preference, "sandbox_init_point");
  if (!preferenceId || !checkoutUrl) {
    return json({ error: "Mercado Pago nao retornou o link de checkout." }, 502);
  }

  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: "pending",
    provider: "mercadopago",
    provider_preference_id: preferenceId,
    external_reference: externalReference,
    starts_at: "",
    expires_at: "",
    created_at: now,
    updated_at: now,
  });
  const payment = upsertPaymentRecord({
    id: crypto.randomUUID(),
    user_id: readString(client, "id"),
    subscription_id: subscriptionId,
    email,
    plan,
    provider: "mercadopago",
    provider_preference_id: preferenceId,
    provider_payment_id: "",
    external_reference: externalReference,
    status: "pending",
    amount: planConfig.amount,
    currency: getMercadoPagoCurrency(env),
    paid_at: "",
    created_at: now,
    updated_at: now,
  });

  await saveLiveState(env);
  await persistBillingRecords(env, client, subscription, payment);
  return json({
    checkout_url: checkoutUrl,
    preference_id: preferenceId,
    subscription: buildSubscriptionPublic(subscription),
  });
}

async function handleMercadoPagoWebhook(request: Request, url: URL, env: unknown) {
  const rawBody = await request.text();
  const payload = readRecord(parseJsonSafe(rawBody));
  const paymentId = extractMercadoPagoPaymentId(url, payload);
  if (!paymentId) {
    return json({ ok: true, ignored: true });
  }

  const signatureOk = await validateMercadoPagoWebhookSignature(request, url, payload, env, paymentId);
  if (!signatureOk) {
    return json({ error: "Webhook Mercado Pago invalido." }, 401);
  }

  const payment = await fetchMercadoPagoPayment(env, paymentId);
  if (!payment.ok) {
    return json({ error: payment.error }, payment.status);
  }

  const result = await applyMercadoPagoPayment(env, payment.payment);
  return json({ ok: true, status: result.status, activated: result.activated });
}

async function handleHublaWebhook(request: Request, env: unknown) {
  const rawBody = await request.text();
  if (!(await validateHublaWebhook(request, rawBody, env))) {
    return json({ error: "Webhook Hubla invalido." }, 401);
  }

  const payload = readRecord(parseJsonSafe(rawBody));
  const event = normalizeHublaWebhookPayload(payload, request, env);
  if (!event.email || !event.status) {
    return json({ ok: true, ignored: true, reason: "payload_incompleto" });
  }

  if (!["paid", "refunded", "chargeback", "canceled"].includes(event.status)) {
    return json({ ok: true, ignored: true, status: event.status });
  }

  const result = await applyHublaWebhookEvent(env, event, payload);
  return json({
    ok: true,
    provider: "hubla",
    status: event.status,
    activated: result.activated,
    deactivated: result.deactivated,
  });
}

async function validateHublaWebhook(request: Request, rawBody: string, env: unknown) {
  const token = getHublaWebhookToken(env);
  const incomingToken = request.headers.get("x-hubla-token")?.trim() || "";
  if (!token || !incomingToken || !constantTimeStringEqual(token, incomingToken)) {
    return false;
  }

  const hmacSecret = getHublaWebhookHmacSecret(env);
  if (!hmacSecret) return true;

  const signature =
    request.headers.get("x-hubla-signature")?.trim() || request.headers.get("x-signature")?.trim() || "";
  if (!signature) return false;

  const normalizedSignature = signature.replace(/^sha256=/i, "").trim();
  const expected = bytesToHex(await hmacSign(hmacSecret, rawBody));
  return constantTimeStringEqual(expected, normalizedSignature);
}

async function applyHublaWebhookEvent(
  env: unknown,
  event: ReturnType<typeof normalizeHublaWebhookPayload>,
  rawPayload: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  const email = event.email.toLowerCase();
  const plan = event.plan || getHublaDefaultPlan(env);
  const planConfig = getBillingPlan(plan, env);
  const existingClient = findClientByEmail(email);
  const client = existingClient || {
    id: crypto.randomUUID(),
    full_name: event.fullName || nameFromEmail(email),
    email,
    phone: event.phone,
    city: "",
    country: "",
    password_hash: "",
    created_at: now,
  };
  const existingSubscription = latestSubscriptionForEmail(email);
  const subscriptionId = event.subscriptionId || readString(existingSubscription, "id") || crypto.randomUUID();
  const startsAt = event.paidAt ? event.paidAt.slice(0, 10) : todayIso();
  const expiresAt = event.expiresAt?.slice(0, 10) || addDaysIso(startsAt, planConfig.durationDays);
  const paymentId = event.paymentId || event.idempotencyKey || crypto.randomUUID();
  const shouldActivate = event.status === "paid";
  const shouldDeactivate = ["canceled", "refunded", "chargeback"].includes(event.status);

  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: shouldActivate ? "active" : shouldDeactivate ? "cancelled" : "pending",
    provider: "hubla",
    provider_preference_id: event.productId,
    provider_payment_id: paymentId,
    external_reference: event.eventType,
    starts_at: shouldActivate ? startsAt : readString(client, "starts_at"),
    expires_at: shouldActivate ? expiresAt : shouldDeactivate ? todayIso() : readString(client, "expires_at"),
    metadata: {
      hubla_event_type: event.eventType,
      hubla_product_id: event.productId,
      hubla_subscription_id: event.subscriptionId,
    },
    created_at: now,
    updated_at: now,
  });

  const payment = upsertPaymentRecord({
    id: event.idempotencyKey || paymentId,
    user_id: readString(client, "id"),
    subscription_id: subscriptionId,
    email,
    plan,
    provider: "hubla",
    provider_preference_id: event.productId,
    provider_payment_id: paymentId,
    external_reference: event.eventType,
    status: event.status,
    amount: event.amount,
    currency: event.currency || "BRL",
    paid_at: shouldActivate ? event.paidAt || now : "",
    raw_status: event.status,
    raw_payload: rawPayload,
    created_at: event.createdAt || now,
    updated_at: now,
  });

  let activated = false;
  let deactivated = false;
  let clientForPersistence = client;
  if (shouldActivate) {
    const updatedClient = {
      ...client,
      full_name: event.fullName || readString(client, "full_name") || nameFromEmail(email),
      phone: event.phone || readString(client, "phone"),
      plan,
      access_status: "approved",
      enabled: true,
      starts_at: startsAt,
      validity_days: planConfig.durationDays,
      expires_at: expiresAt,
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("hubla_payment_paid", {
      ...updatedClient,
      detail: `Assinatura ${planConfig.name} ativada via Hubla.`,
    });
    clientForPersistence = updatedClient;
    activated = true;
  } else if (shouldDeactivate) {
    const updatedClient = {
      ...client,
      plan,
      access_status: "expired",
      enabled: false,
      expires_at: todayIso(),
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("hubla_payment_reversed", {
      ...updatedClient,
      detail: `Assinatura Hubla desativada por status ${event.status}.`,
      risk: event.status === "chargeback" ? "high" : "medium",
    });
    clientForPersistence = updatedClient;
    deactivated = true;
  }

  await saveLiveState(env);
  await persistBillingRecords(env, clientForPersistence, subscription, payment);
  return { activated, deactivated };
}

async function fetchMercadoPagoPayment(
  env: unknown,
  paymentId: string,
): Promise<{ ok: true; payment: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const accessToken = getMercadoPagoAccessToken(env);
  if (!accessToken) {
    return { ok: false, status: 503, error: "Mercado Pago nao configurado no servidor." };
  }

  try {
    const response = await fetch(`${MERCADOPAGO_PAYMENT_URL}/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    const payment = readRecord(await response.json().catch(() => ({})));
    if (!response.ok) {
      console.warn(`Consulta de pagamento Mercado Pago falhou (${response.status}).`);
      return { ok: false, status: 502, error: "Nao foi possivel confirmar o pagamento." };
    }
    return { ok: true, payment };
  } catch (error) {
    console.warn("Falha de rede ao consultar pagamento Mercado Pago.", error);
    return { ok: false, status: 502, error: "Mercado Pago indisponivel no momento." };
  }
}

async function applyMercadoPagoPayment(env: unknown, payment: Record<string, unknown>) {
  const status = readString(payment, "status") || "unknown";
  const paymentId = readString(payment, "id");
  const metadata = readRecord(payment.metadata);
  const externalReference = readString(payment, "external_reference");
  const parsedReference = parseBillingExternalReference(externalReference);
  const email = (
    readString(metadata, "email") ||
    parsedReference.email ||
    readString(readRecord(payment.payer), "email")
  ).toLowerCase();
  const plan = normalizeBillingPlanId(readString(metadata, "plan") || parsedReference.plan);
  const subscriptionId =
    readString(metadata, "subscription_id") || parsedReference.subscriptionId || crypto.randomUUID();
  const planConfig = plan ? getBillingPlan(plan, env) : null;
  const amount = Number(readRecord(payment.transaction_amount).value || payment.transaction_amount || 0);
  const now = new Date().toISOString();
  const paidAt = readString(payment, "date_approved") || (status === "approved" ? now : "");

  const paymentRecord = upsertPaymentRecord({
    id: findPaymentId(paymentId, externalReference) || crypto.randomUUID(),
    user_id: "",
    subscription_id: subscriptionId,
    email,
    plan: plan || "free",
    provider: "mercadopago",
    provider_preference_id: readString(payment, "preference_id"),
    provider_payment_id: paymentId,
    external_reference: externalReference,
    status,
    amount: Number.isFinite(amount) ? amount : planConfig?.amount || 0,
    currency: readString(payment, "currency_id") || getMercadoPagoCurrency(env),
    paid_at: paidAt,
    raw_status: status,
    created_at: readString(payment, "date_created") || now,
    updated_at: now,
  });

  if (!email || !plan || !planConfig) {
    await saveLiveState(env);
    return { activated: false, status };
  }

  const existingClient = findClientByEmail(email);
  const client = existingClient || {
    id: crypto.randomUUID(),
    full_name: nameFromEmail(email),
    email,
    phone: "",
    city: "",
    country: "",
    password_hash: "",
    created_at: now,
  };

  let subscriptionStatus: SubscriptionStatus = status === "approved" ? "active" : "pending";
  if (["cancelled", "refunded", "charged_back"].includes(status)) subscriptionStatus = "cancelled";
  if (["rejected", "in_process", "pending"].includes(status)) subscriptionStatus = "pending";

  const startsAt = todayIso();
  const expiresAt = status === "approved" ? addDaysIso(startsAt, planConfig.durationDays) : "";
  const subscription = upsertSubscriptionRecord({
    id: subscriptionId,
    user_id: readString(client, "id"),
    email,
    plan,
    status: subscriptionStatus,
    provider: "mercadopago",
    provider_preference_id: readString(payment, "preference_id"),
    provider_payment_id: paymentId,
    external_reference: externalReference,
    starts_at: status === "approved" ? startsAt : "",
    expires_at: expiresAt,
    created_at: now,
    updated_at: now,
  });

  let activated = false;
  let clientForPersistence = client;
  if (status === "approved") {
    const updatedClient = {
      ...client,
      plan,
      access_status: "approved",
      enabled: true,
      starts_at: startsAt,
      validity_days: planConfig.durationDays,
      expires_at: expiresAt,
      updated_at: now,
    };
    upsertLiveClient(updatedClient);
    upsertRecipientFromClient(updatedClient);
    recordAccessEvent("payment_approved", {
      ...updatedClient,
      detail: `Assinatura ${planConfig.name} ativada via Mercado Pago.`,
    });
    clientForPersistence = updatedClient;
    activated = true;
  }

  await saveLiveState(env);
  await persistBillingRecords(env, clientForPersistence, subscription, paymentRecord);
  return { activated, status };
}

async function handleAdminApiRequest(request: Request, env: unknown) {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/__sniperbo/version") {
    return json({
      ok: true,
      marker: SNIPER_DEPLOY_MARKER,
      hasAdminEmail: getAdminEmails(env).length > 0,
      hasAdminPasswordConfig: hasAdminPasswordConfig(env),
      hasSessionSecret: Boolean(getSessionSecret(env)),
      hasDurableClientStorage: Boolean(getSupabasePersistenceConfig(env)),
    });
  }

  const isAdminApiPath =
    url.pathname === "/admin/login" ||
    url.pathname === "/auth/check" ||
    url.pathname === "/auth/diagnostics" ||
    url.pathname === "/auth/register" ||
    url.pathname === "/auth/verify" ||
    url.pathname === "/admin/overview" ||
    url.pathname === "/admin/summary" ||
    url.pathname === "/admin/sales-settings" ||
    url.pathname === "/admin/site-content" ||
    url.pathname === "/admin/client-registry/backup" ||
    url.pathname === "/admin/crm" ||
    url.pathname.startsWith("/admin/crm/") ||
    url.pathname === "/admin/users" ||
    url.pathname.startsWith("/admin/users/") ||
    url.pathname === "/admin/logs" ||
    url.pathname === "/admin/broadcast" ||
    url.pathname === "/telegram-recipients" ||
    url.pathname.startsWith("/telegram-recipients/") ||
    url.pathname === "/module-toggles" ||
    url.pathname === "/security-events";

  if (!isAdminApiPath) return null;

  if (request.method === "OPTIONS") {
    return json(null, 204);
  }

  if (request.method === "GET" && url.pathname === "/auth/diagnostics") {
    if (!(await isDashboardAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }
    return json({
      hasAdminEmail: getAdminEmails(env).length > 0,
      hasAdminApproverEmail: getAdminApproverEmails(env).length > 0,
      hasAdminPasswordHash: hasAdminPasswordConfig(env),
      hasSessionSecret: Boolean(getSessionSecret(env)),
      hasDurableClientStorage: Boolean(getSupabasePersistenceConfig(env)),
      durableClientStorageTable: LIVE_STATE_TABLE,
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/login") {
    const body = await request.json().catch(() => ({}));
    const loginEmail = readString(body, "email").toLowerCase();
    const adminRole = getAdminRoleForEmail(env, loginEmail);
    const adminPasswordConfigured = hasAdminPasswordConfig(env);

    if (!adminPasswordConfigured || !getSessionSecret(env)) {
      return json({ error: "Credenciais admin nao configuradas no servidor." }, 503);
    }

    if (adminRole && (await verifyConfiguredAdminPassword(env, readString(body, "password")))) {
      const binding = await requestSessionBinding(env, request);
      recordAccessEvent("admin_login", {
        email: loginEmail,
        full_name: nameFromEmail(loginEmail),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      const token = await issueSessionToken(
        env,
        {
          email: loginEmail,
          scope: adminRole === "owner" ? "owner" : "admin_approver",
          role: "admin",
          plan: adminRole === "owner" ? "vip" : "free",
          approved: adminRole === "owner",
          sid: crypto.randomUUID(),
          ua: binding.userAgentHash,
          iph: binding.ipHash,
        },
        ADMIN_SESSION_TTL_SECONDS,
      );
      return json({ token, email: loginEmail, role: adminRole });
    }

    return json({ error: "E-mail ou senha admin invalidos." }, 401);
  }

  if (request.method === "POST" && url.pathname === "/auth/check") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    const adminPasswordConfigured = hasAdminPasswordConfig(env);
    const adminRole = getAdminRoleForEmail(env, email);

    if (!getSessionSecret(env)) {
      return json({ error: "Sessao nao configurada no servidor." }, 503);
    }

    if (adminRole === "owner" && adminPasswordConfigured && (await verifyConfiguredAdminPassword(env, password))) {
      recordAccessEvent("owner_login", {
        email,
        full_name: nameFromEmail(email),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      return json({ access: await ownerAccess(env, email, request) });
    }

    if (adminRole === "admin" && adminPasswordConfigured && (await verifyConfiguredAdminPassword(env, password))) {
      recordAccessEvent("admin_login", {
        email,
        full_name: nameFromEmail(email),
        city: "",
        country: "",
      });
      await saveLiveState(env);
      return json({ access: await approverAccess(env, email, request) });
    }

    if (adminRole) {
      return json(
        {
          error: adminPasswordConfigured ? "Senha admin invalida." : "Senha admin nao configurada no servidor.",
        },
        adminPasswordConfigured ? 401 : 503,
      );
    }

    let client =
      findClientByEmail(email) ||
      (await hydrateClientFromBilling(env, email)) ||
      syncClientFromRecipientEmail(email) ||
      syncClientFromAdminUserEmail(env, email);
    if (!client) {
      await recoverClientRegistryForAuth(env, email, "auth_check");
      client =
        findClientByEmail(email) ||
        (await hydrateClientFromBilling(env, email)) ||
        syncClientFromRecipientEmail(email) ||
        syncClientFromAdminUserEmail(env, email);
    }
    if (!client && password) {
      client = await ensureBlockedTrialClientForLogin(env, request, email, password);
    }
    if (!client) {
      return json({
        access: {
          registered: false,
          approved: false,
          access_mode: "none",
          access_status: "none",
          plan: "free",
          email,
          full_name: "",
          expires_at: "",
          reason: "E-mail ainda nao cadastrado.",
        },
      });
    }

    const storedHash = readString(client, "password_hash");
    const legacyPassword = readString(client, "password");
    let ok = false;
    if (storedHash) {
      ok = await verifyPassword(password, storedHash);
      if (ok && passwordHashNeedsUpgrade(storedHash)) {
        client.password_hash = await hashPassword(password);
        await saveLiveState(env);
      }
      if (ok && "password" in client) {
        delete (client as Record<string, unknown>).password;
        await saveLiveState(env);
      }
    } else if (legacyPassword) {
      ok = constantTimeStringEqual(password, legacyPassword);
      if (ok) {
        client.password_hash = await hashPassword(password);
        delete (client as Record<string, unknown>).password;
        await saveLiveState(env);
      }
    } else if (clientCanBindPasswordDuringMigration(client)) {
      client.password_hash = await hashPassword(password);
      client.updated_at = new Date().toISOString();
      upsertLiveClient(client);
      upsertRecipientFromClient(client);
      const persisted = await persistClientRegistryAfterClientChange(env, client, "auth_check_password_bind");
      if (!persisted.ok) return clientRegistryDurableSaveError();
      recordAccessEvent("client_password_bound_after_migration", {
        ...client,
        risk: "medium",
        detail: "Senha vinculada automaticamente para cliente premium migrado sem password_hash.",
      });
      ok = true;
    } else {
      return json(
        {
          error:
            "Conta encontrada sem senha. Abra a aba Cadastro e crie sua senha para entrar ou finalizar o checkout.",
        },
        401,
      );
    }
    if (!ok) {
      return json({ error: "Senha invalida." }, 401);
    }

    recordAccessEvent(client.enabled ? "client_login" : "client_pending_login", client);
    const access = await clientAccess(env, client, request);
    await saveLiveState(env);
    return json({ access });
  }

  if (request.method === "POST" && url.pathname === "/auth/register") {
    const body = readRecord(await request.json().catch(() => ({})));
    const email = readString(body, "email").toLowerCase();
    const password = readString(body, "password");
    if (!email || !password) {
      return json({ error: "E-mail e senha sao obrigatorios." }, 400);
    }
    if (!getSessionSecret(env)) {
      return json({ error: "Sessao nao configurada no servidor." }, 503);
    }

    if (getAdminRoleForEmail(env, email)) {
      return json({ error: "E-mail de administrador. Use a aba Entrar com a senha admin." }, 409);
    }

    let existingIndex = liveClients.findIndex((item) => readString(item, "email").toLowerCase() === email);
    if (existingIndex < 0) {
      await hydrateClientFromBilling(env, email);
      syncClientFromRecipientEmail(email) || syncClientFromAdminUserEmail(env, email);
      existingIndex = liveClients.findIndex((item) => readString(item, "email").toLowerCase() === email);
    }
    if (existingIndex < 0) {
      await recoverClientRegistryForAuth(env, email, "auth_register");
      await hydrateClientFromBilling(env, email);
      syncClientFromRecipientEmail(email) || syncClientFromAdminUserEmail(env, email);
      existingIndex = liveClients.findIndex((item) => readString(item, "email").toLowerCase() === email);
    }
    if (liveSalesSettings.salesClosed && existingIndex < 0) {
      return json({ error: "Vagas encerradas no momento. Entre na fila de espera para a proxima abertura." }, 403);
    }
    const now = new Date().toISOString();
    const existingClient = existingIndex >= 0 ? liveClients[existingIndex] : {};
    const existingPasswordHash = readString(existingClient, "password_hash");
    const existingLegacyPassword = readString(existingClient, "password");

    if (existingIndex >= 0 && (existingPasswordHash || existingLegacyPassword)) {
      const passwordMatches = existingPasswordHash
        ? await verifyPassword(password, existingPasswordHash)
        : constantTimeStringEqual(password, existingLegacyPassword);
      if (!passwordMatches) {
        return json(
          {
            error:
              "E-mail ja cadastrado. Use a aba Entrar com a senha cadastrada ou fale com o suporte para redefinir.",
          },
          409,
        );
      }
    }

    const passwordHash = await hashPassword(password);
    const binding = await requestSessionBinding(env, request);
    const trialAccess = buildRegistrationTrialAccess(env, email, existingClient, binding, now);
    const client: Record<string, unknown> = {
      ...existingClient,
      id: existingIndex >= 0 ? existingClient.id : crypto.randomUUID(),
      full_name: readString(body, "full_name") || email,
      email,
      password_hash: passwordHash,
      phone: readString(body, "phone"),
      phone_full: readString(body, "phone_full"),
      city: readString(body, "city"),
      country: readString(body, "country"),
      country_code: readString(body, "country_code") || readString(body, "countryCode"),
      plan: trialAccess.plan,
      access_status: trialAccess.accessStatus,
      enabled: trialAccess.enabled,
      starts_at: trialAccess.startsAt,
      validity_days: trialAccess.validityDays,
      expires_at: trialAccess.expiresAt,
      trial_started_at: trialAccess.trialStartedAt,
      trial_expires_at: trialAccess.trialExpiresAt,
      trial_ip_hash: trialAccess.trialIpHash,
      trial_user_agent_hash: trialAccess.trialUserAgentHash,
      trial_blocked_reason: trialAccess.trialBlockedReason,
      created_at: existingIndex >= 0 ? existingClient.created_at || now : now,
      updated_at: now,
    };

    clearDeletedEntityForRecord(client);
    liveClients =
      existingIndex >= 0
        ? liveClients.map((item, index) => (index === existingIndex ? client : item))
        : [...liveClients, client];

    upsertRecipientFromClient(client);
    recordAccessEvent(existingIndex >= 0 ? "client_update" : "client_register", client);
    const persisted = await persistClientRegistryAfterClientChange(
      env,
      client,
      existingIndex >= 0 ? "auth_register_update" : "auth_register_new",
    );
    if (!persisted.ok) return clientRegistryDurableSaveError();
    const access = await clientAccess(env, client, request);
    return json({ access }, existingIndex >= 0 ? 200 : 201);
  }

  if (request.method === "POST" && url.pathname === "/auth/verify") {
    const token = getBearerToken(request);
    const session = await verifySessionToken(env, token);
    if (!session) {
      return json({ valid: false }, 401);
    }

    if (session.scope === "owner") {
      if (!(await sessionMatchesRequestBinding(env, request, session))) {
        return json({ valid: false, reason: "Sessao invalida ou usada em outro dispositivo." }, 401);
      }
      return json({ valid: true, access: await ownerAccess(env, session.email, request) });
    }

    if (session.scope === "admin_approver") {
      if (!(await sessionMatchesRequestBinding(env, request, session))) {
        return json({ valid: false, reason: "Sessao invalida ou usada em outro dispositivo." }, 401);
      }
      return json({ valid: true, access: await approverAccess(env, session.email, request) });
    }

    let client =
      findClientByEmail(session.email) ||
      (await hydrateClientFromBilling(env, session.email)) ||
      syncClientFromRecipientEmail(session.email) ||
      syncClientFromAdminUserEmail(env, session.email);
    if (!client) {
      await recoverClientRegistryForAuth(env, session.email, "auth_verify");
      client =
        findClientByEmail(session.email) ||
        (await hydrateClientFromBilling(env, session.email)) ||
        syncClientFromRecipientEmail(session.email) ||
        syncClientFromAdminUserEmail(env, session.email);
    }
    if (!client && session.scope === "client") {
      client = await ensureSessionClientForExpiredTrial(env, request, session);
    }
    if (!client && session.scope === "client" && session.approved && ["premium", "vip"].includes(session.plan)) {
      client = await restoreClientFromApprovedSession(env, request, session);
    }
    if (!client) {
      return json({
        valid: true,
        access: {
          registered: false,
          approved: false,
          access_mode: "none",
          access_status: "none",
          plan: "free",
          email: session.email,
          full_name: "",
          expires_at: "",
          reason: "E-mail ainda nao cadastrado.",
          client_token: "",
        },
      });
    }

    const sessionCheck = await validateClientSessionBinding(env, request, session, client);
    if (!sessionCheck.ok) {
      recordAccessEvent("client_session_blocked", {
        ...client,
        risk: "high",
        detail: sessionCheck.reason,
        ip_hash: sessionCheck.ipHash || "",
        user_agent_hash: sessionCheck.userAgentHash || "",
      });
      await saveLiveState(env);
      return json({ valid: false, reason: "Sessao invalida ou usada em outro dispositivo." }, 401);
    }

    const access = await clientAccess(env, client, request, session);
    await saveLiveState(env);
    return json({ valid: true, access });
  }

  const adminRole = await getAdminRequestRole(request, env);
  if (!adminRole) {
    return json({ error: "Nao autorizado." }, 401);
  }

  if (url.pathname === "/admin/sales-settings") {
    if (request.method === "GET") {
      return json({ salesSettings: adminSalesSettings(env) });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const nextClosed = typeof body.salesClosed === "boolean" ? body.salesClosed : Boolean(body.salesClosed);
      liveSalesSettings = {
        salesClosed: nextClosed,
        updated_at: new Date().toISOString(),
        updated_by: adminActorEmailFromRequest(request, env, adminRole),
      };
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: "sales-settings",
        targetEmail: "global",
        action: "UPDATE_USER",
        beforeJson: {},
        afterJson: adminSalesSettings(env),
        reason: nextClosed ? "Vendas encerradas pelo admin." : "Vendas reabertas pelo admin.",
      });
      const saveStatus = await saveLiveState(env);
      return json({ salesSettings: adminSalesSettings(env, saveStatus) });
    }

    return json({ error: "Metodo nao permitido." }, 405);
  }

  if (url.pathname === "/admin/site-content") {
    if (request.method === "GET") {
      return json({ siteContent: adminSiteContentSettings(env) });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const before = liveSiteContentSettings;
      liveSiteContentSettings = normalizeSiteContentSettings(
        {
          ...body,
          popupId: readString(body, "popupId") || before.popupId,
          updatedAt: new Date().toISOString(),
          updatedBy: adminActorEmailFromRequest(request, env, adminRole),
        },
        before,
      );
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: "site-content",
        targetEmail: "global",
        action: "UPDATE_USER",
        beforeJson: before,
        afterJson: liveSiteContentSettings,
        reason: "Conteudo visual do site atualizado.",
      });
      const saveStatus = await saveLiveState(env);
      return json({ siteContent: adminSiteContentSettings(env, saveStatus) });
    }

    return json({ error: "Metodo nao permitido." }, 405);
  }

  if (request.method === "GET" && url.pathname === "/admin/summary") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    return json({ summary: buildAdminSummary() });
  }

  if (request.method === "GET" && url.pathname === "/admin/overview") {
    await hydrateClientsFromBillingUsers(env);
    return json({ overview: buildAdminPanelOverview(syncAdminManagedUsers(env)) });
  }

  if (url.pathname === "/admin/client-registry/backup") {
    return handleAdminClientRegistryBackupRequest(request, env, adminRole);
  }

  if (url.pathname === "/admin/crm" || url.pathname.startsWith("/admin/crm/")) {
    return handleAdminCrmRequest(request, url, env, adminRole);
  }

  if (request.method === "GET" && url.pathname === "/admin/users") {
    await hydrateClientsFromBillingUsers(env);
    const users = syncAdminManagedUsers(env);
    await saveLiveState(env);
    return json({
      users,
      overview: buildAdminPanelOverview(users),
    });
  }

  const adminUserMatch = url.pathname.match(/^\/admin\/users\/([^/]+)(?:\/([^/]+))?$/);
  if (adminUserMatch) {
    const userId = decodeURIComponent(adminUserMatch[1]);
    const actionPath = adminUserMatch[2] || "";
    const target = findAdminManagedUser(userId, env);
    if (!target) return json({ error: "Usuario nao encontrado." }, 404);

    if (request.method === "GET" && !actionPath) {
      return json({ user: target });
    }

    if (request.method === "DELETE" && !actionPath) {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await deleteAdminManagedUser(env, adminRole, request, target, readString(body, "reason"));
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ ok: true, user: result.user });
    }

    if (request.method === "PATCH" && !actionPath) {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(env, adminRole, request, target, body, "UPDATE_USER");
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "extend-access") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await extendAdminManagedUser(
        env,
        adminRole,
        request,
        target,
        Number(body.days || 0),
        readString(body, "reason"),
      );
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "block") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await blockAdminManagedUser(env, adminRole, request, target, readString(body, "reason"));
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "unblock") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await unblockAdminManagedUser(env, adminRole, request, target, readString(body, "reason"));
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "change-plan") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(env, adminRole, request, target, body, "UPDATE_PLAN");
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }

    if (request.method === "POST" && actionPath === "change-role") {
      const body = readRecord(await request.json().catch(() => ({})));
      const result = await updateAdminManagedUser(env, adminRole, request, target, body, "UPDATE_ROLE");
      if (!result.ok) return json({ error: result.error }, result.status);
      await saveLiveState(env);
      return json({ user: result.user });
    }
  }

  if (request.method === "GET" && url.pathname === "/admin/logs") {
    return json({
      logs: liveAdminActionLogs
        .map(normalizeAdminActionLog)
        .sort((a, b) => readString(b, "createdAt").localeCompare(readString(a, "createdAt")))
        .slice(0, 500),
    });
  }

  if (request.method === "POST" && url.pathname === "/admin/broadcast") {
    const body = readRecord(await request.json().catch(() => ({})));
    const title = readString(body, "title");
    const message = readString(body, "message");
    if (!title || !message) return json({ error: "Titulo e mensagem sao obrigatorios." }, 400);
    const before = liveSiteContentSettings;
    liveSiteContentSettings = normalizeSiteContentSettings(
      {
        ...before,
        popupEnabled: true,
        popupTitle: title,
        popupMessage: message,
        popupTone: normalizeAnnouncementTone(body.tone, before.popupTone),
        popupButtonLabel: readString(body, "buttonLabel"),
        popupButtonUrl: normalizeAssetUrl(body.buttonUrl),
        popupAudience: readString(body, "audience") || "all",
        popupId: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        updatedBy: adminActorEmailFromRequest(request, env, adminRole),
      },
      before,
    );
    const log = recordAdminActionLog(env, request, adminRole, {
      targetUserId: "broadcast",
      targetEmail: readString(body, "audience") || "all",
      action: "UPDATE_USER",
      beforeJson: {},
      afterJson: {
        title,
        message,
        audience: readString(body, "audience") || "all",
      },
      reason: "Aviso geral disparado como pop-up.",
    });
    await saveLiveState(env);
    return json({ ok: true, log, siteContent: publicSiteContentSettings() });
  }

  if (url.pathname === "/telegram-recipients") {
    if (request.method === "GET") {
      const changed = syncRecipientsFromClients();
      if (changed) await saveLiveState(env);
      return json({
        recipients:
          adminRole === "owner"
            ? liveRecipients
            : liveRecipients.filter((recipient) => readString(recipient, "access_status") === "pending"),
      });
    }

    if (request.method === "POST") {
      if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
      const body = readRecord(await request.json().catch(() => ({})));
      const now = new Date().toISOString();
      const recipient = normalizeRecipient({
        ...body,
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
      });
      clearDeletedEntityForRecord(recipient);
      liveRecipients = [...liveRecipients, recipient];
      upsertClientFromRecipient(recipient);
      await updateClientPasswordFromBody(recipient, body);
      await saveLiveState(env);
      return json({ recipient }, 201);
    }
  }

  const recipientMatch = url.pathname.match(/^\/telegram-recipients\/([^/]+)$/);
  if (recipientMatch) {
    const recipientId = decodeURIComponent(recipientMatch[1]);
    const syncChanged = syncRecipientsFromClients();
    const index = liveRecipients.findIndex((recipient) => recipient.id === recipientId);

    if (index === -1) {
      const clientIndex = liveClients.findIndex((client) => client.id === recipientId);
      if (clientIndex === -1) {
        if (syncChanged) await saveLiveState(env);
        return json({ error: "Destinatario nao encontrado." }, 404);
      }
      upsertRecipientFromClient(liveClients[clientIndex]);
      await saveLiveState(env);
      return handleAdminApiRequest(request, env);
    }

    if (request.method === "PATCH") {
      const body = readRecord(await request.json().catch(() => ({})));
      const patchBody = adminRole === "owner" ? body : approverPatchForPendingApproval(liveRecipients[index], body);
      if (!patchBody) return json({ error: "Permissao insuficiente." }, 403);
      const updated = normalizeRecipient({
        ...liveRecipients[index],
        ...patchBody,
        id: liveRecipients[index].id,
        created_at: liveRecipients[index].created_at,
        updated_at: new Date().toISOString(),
      });
      liveRecipients = liveRecipients.map((recipient, recipientIndex) =>
        recipientIndex === index ? updated : recipient,
      );
      upsertClientFromRecipient(updated);
      if (adminRole === "owner") {
        await updateClientPasswordFromBody(updated, body);
      }
      await saveLiveState(env);
      return json({ recipient: updated });
    }

    if (request.method === "DELETE") {
      if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
      const deletedRecipient = liveRecipients[index];
      markEntityDeleted(deletedRecipient);
      removeUserEntityEverywhere(deletedRecipient);
      recordAdminActionLog(env, request, adminRole, {
        targetUserId: readString(deletedRecipient, "id"),
        targetEmail: readString(deletedRecipient, "email"),
        action: "DELETE_USER",
        beforeJson: deletedRecipient,
        afterJson: { deleted: true },
        reason: "Exclusao manual de cliente",
      });
      await deletePersistedBillingUser(env, deletedRecipient);
      await saveLiveState(env);
      return json({ ok: true });
    }
  }

  if (url.pathname === "/module-toggles") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    if (request.method === "GET") {
      return json({ moduleToggles: liveModuleToggles });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      liveModuleToggles = {
        tieAlert: typeof body.tieAlert === "boolean" ? body.tieAlert : liveModuleToggles.tieAlert,
        surfAnalyzer: typeof body.surfAnalyzer === "boolean" ? body.surfAnalyzer : liveModuleToggles.surfAnalyzer,
      };
      liveDashboardData = {
        ...liveDashboardData,
        moduleToggles: liveModuleToggles,
        updatedAt: new Date().toISOString(),
      };
      await saveLiveState(env);
      return json({ moduleToggles: liveModuleToggles });
    }
  }

  if (request.method === "GET" && url.pathname === "/security-events") {
    if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);
    const summary = summarizeSecurityEvents();
    return json({
      events: liveAccessEvents,
      summary,
    });
  }

  return json({ error: "Rota nao encontrada." }, 404);
}

async function handleDashboardRequest(request: Request, env: unknown, ctx?: unknown) {
  const url = new URL(request.url);

  if (
    request.method === "OPTIONS" &&
    (url.pathname === "/dashboard" ||
      url.pathname === "/dashboard/signal" ||
      url.pathname === "/dashboard/round-history" ||
      url.pathname === "/calendar/neural" ||
      url.pathname === "/calendar/neural/backfill" ||
      url.pathname === "/calendar/neural/reset" ||
      url.pathname === "/validator/validate" ||
      url.pathname === "/validator/round-history" ||
      url.pathname === "/validator/patterns" ||
      url.pathname.startsWith("/validator/patterns/") ||
      url.pathname === "/validator/channels" ||
      url.pathname.startsWith("/validator/channels/") ||
      url.pathname === "/validator/channels/test" ||
      isTelegramServiceRoutePath(url.pathname) ||
      url.pathname === "/validator/live-hit/send" ||
      url.pathname === "/validator/telegram/test" ||
      url.pathname === "/validator/telegram/send")
  ) {
    return json(null, 204);
  }

  const neuralCalendarResetResponse = await handleNeuralCalendarResetRequest(request, url, env);
  if (neuralCalendarResetResponse) return neuralCalendarResetResponse;

  const neuralCalendarBackfillResponse = await handleNeuralCalendarBackfillRequest(request, url, env);
  if (neuralCalendarBackfillResponse) return neuralCalendarBackfillResponse;

  const neuralCalendarResponse = await handleNeuralCalendarRequest(request, url, env);
  if (neuralCalendarResponse) return neuralCalendarResponse;

  const telegramServiceResponse = await handleTelegramServiceRequest(request, url, env);
  if (telegramServiceResponse) return telegramServiceResponse;

  const validatorStorageResponse = await handleValidatorStorageRequest(request, url, env);
  if (validatorStorageResponse) return validatorStorageResponse;

  const validatorValidationResponse = await handleValidatorValidationRequest(request, url, env);
  if (validatorValidationResponse) return validatorValidationResponse;

  if (
    request.method === "POST" &&
    (url.pathname === "/validator/telegram/test" || url.pathname === "/validator/telegram/send")
  ) {
    if (!(await isDashboardReadAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const body = readRecord(await request.json().catch(() => ({})));
    const botToken = normalizeSecretValue(readString(body, "botToken"));
    const chatId = readString(body, "chatId");
    const message = normalizeTelegramMessage(readString(body, "message"));
    const buttonLabel = readString(body, "buttonLabel") || "Abrir Sniper Bo IA";
    const buttonUrl = normalizeTelegramButtonUrl(readString(body, "buttonLink"));

    if (!botToken) return json({ error: "Bot Token obrigatorio." }, 400);
    if (!chatId) return json({ error: "Chat ID obrigatorio." }, 400);
    if (!message) return json({ error: "Mensagem obrigatoria." }, 400);

    const result = await sendTelegramMessage({
      botToken,
      chatId,
      message,
      buttonLabel,
      buttonUrl,
      allowInsecureNodeFallback: isLocalDevelopmentRequest(request),
    });

    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ ok: true, messageId: result.messageId });
  }

  if (
    request.method === "GET" &&
    (url.pathname === "/dashboard/round-history" || url.pathname === "/validator/round-history")
  ) {
    if (!(await isDashboardReadAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const limit = clampRoundHistoryLimit(url.searchParams.get("limit"));
    const storedRounds = await withTimeout(
      fetchStoredValidatorRounds(
        env,
        limit,
        validatorTableId(url.searchParams.get("tableId") || url.searchParams.get("table")),
      ),
      LIVE_STATE_IO_TIMEOUT_MS,
      "carregar historico do Validador",
      [] as Round[],
    );
    if (storedRounds.length) {
      liveValidatorRoundHistory = mergeMonitorRoundHistory(liveValidatorRoundHistory, storedRounds);
    }
    const rounds = mergeRoundHistoryWithLimit(storedRounds, liveValidatorRoundHistory, limit);
    return json({
      rounds,
      total: rounds.length,
      limit,
      updatedAt: liveDashboardData.updatedAt ?? "",
    });
  }

  if (request.method === "POST" && url.pathname === "/validator/round-history") {
    if (!(await isDashboardWriteAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const body = readRecord(await request.json().catch(() => ({})));
    const sourceRounds = Array.isArray(body.rounds)
      ? body.rounds
      : Array.isArray(readRecord(body.dashboard).rounds)
        ? readRecord(body.dashboard).rounds
        : [];
    const incomingRounds = normalizeRounds(sourceRounds, MAX_SERVER_ROUND_HISTORY);
    if (incomingRounds.length) {
      liveValidatorRoundHistory = mergeMonitorRoundHistory(liveValidatorRoundHistory, incomingRounds);
      const calendarChange = trackNeuralCalendarRounds(incomingRounds);
      const dashboardBeforeTieScoreboard = liveDashboardData;
      liveDashboardData = trackServerTieRoundScoreboard(
        liveDashboardData,
        dashboardBeforeTieScoreboard,
        incomingRounds,
      );
      const engineCalendarChange = trackEngineCalendarAggregates(dashboardBeforeTieScoreboard, liveDashboardData);
      runBackgroundTask(
        ctx,
        persistDashboardRoundIngestion(
          env,
          incomingRounds,
          calendarChange,
          engineCalendarChange,
          isLocalDevelopmentRequest(request),
        ),
        "persistir historico e monitorar Validador",
      );
    }

    return json({
      ok: true,
      received: incomingRounds.length,
      total: liveValidatorRoundHistory.length,
    });
  }

  if (request.method === "GET" && url.pathname === "/dashboard") {
    if (!(await isDashboardReadAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }

    await syncDashboardReadState(env);
    const cycle = ensureDashboardDailyCycle(liveDashboardData);
    if (cycle.changed) {
      liveDashboardData = cycle.dashboard;
      runBackgroundTask(ctx, saveLiveState(env), "salvar ciclo do dashboard");
    }
    runBackgroundTask(
      ctx,
      processValidatorLiveMonitoring(env, { fast: true, roundReceivedAtMs: Date.now() }),
      "monitorar sinais no read do dashboard",
    );
    return json(publicDashboardSnapshot(liveDashboardData));
  }

  if (
    request.method === "POST" &&
    (url.pathname === "/dashboard" || url.pathname === "/dashboard/signal" || url.pathname === "/dashboard/publish")
  ) {
    if (!(await isDashboardWriteAuthorized(request, url, env))) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const incomingRounds = normalizeRoundsFromPayload(body, MAX_SERVER_ROUND_HISTORY);
    const incomingState = readRecord(body);
    if (
      incomingRounds.length &&
      compareDashboardStateFreshness(liveDashboardData as unknown as Record<string, unknown>, incomingState) > 0
    ) {
      return json({
        ok: true,
        ignored: "stale",
        saved: "skipped",
        dashboard: publicDashboardSnapshot(liveDashboardData),
      });
    }
    if (incomingRounds.length) {
      liveValidatorRoundHistory = mergeMonitorRoundHistory(liveValidatorRoundHistory, incomingRounds);
    }
    const dashboardBeforeUpdate = liveDashboardData;
    liveDashboardData = updateDashboardData(liveDashboardData, body);
    const engineCalendarChange = trackEngineCalendarAggregates(dashboardBeforeUpdate, liveDashboardData);
    const calendarChange = incomingRounds.length
      ? trackNeuralCalendarRounds(incomingRounds)
      : emptyNeuralCalendarChangeSet();
    const saveStateTask = saveLiveState(env);
    runBackgroundTask(ctx, saveStateTask, "salvar estado vivo do dashboard");
    runBackgroundTask(
      ctx,
      persistDashboardRoundIngestion(
        env,
        incomingRounds,
        calendarChange,
        engineCalendarChange,
        isLocalDevelopmentRequest(request),
      ),
      "persistir rodada e monitorar sinais",
    );
    if (url.pathname === "/dashboard/publish" || url.pathname === "/dashboard/signal") {
      const saveStatus = await saveStateTask;
      return json({ ok: true, saved: saveStatus, dashboard: publicDashboardSnapshot(liveDashboardData) });
    }
    return json({ ok: true, saved: "queued", dashboard: publicDashboardSnapshot(liveDashboardData) });
  }

  return null;
}

function runBackgroundTask(ctx: unknown, promise: Promise<unknown>, label: string) {
  const task = promise.catch((error) => {
    console.warn(`Falha em tarefa de fundo: ${label}.`, error);
  });
  const waitUntil = (ctx as ExecutionContextLike | undefined)?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil.call(ctx, task);
    return;
  }
  void task;
}

async function persistDashboardRoundIngestion(
  env: unknown,
  incomingRounds: Round[],
  calendarChange: NeuralCalendarChangeSet,
  engineCalendarChange: EngineCalendarAggregateChangeSet,
  allowInsecureTelegramFallback: boolean,
) {
  const roundReceivedAtMs = Date.now();
  const writes = [
    withTimeout(
      persistValidatorRounds(env, incomingRounds),
      LIVE_STATE_IO_TIMEOUT_MS,
      "salvar rodadas do Validador",
      false,
    ),
  ];
  if (calendarChange.changed) {
    writes.push(
      withTimeout(
        persistNeuralCalendarStats(env, calendarChange),
        LIVE_STATE_IO_TIMEOUT_MS,
        "salvar Calendario Neural",
        false,
      ),
    );
  }
  if (engineCalendarChange.changed) {
    writes.push(
      withTimeout(
        persistEngineCalendarAggregateStats(env, engineCalendarChange),
        LIVE_STATE_IO_TIMEOUT_MS,
        "salvar agregados do Calendario por motor",
        false,
      ),
    );
  }
  const monitorTask = processValidatorLiveMonitoring(env, { allowInsecureTelegramFallback, fast: true, roundReceivedAtMs });
  await Promise.all([...writes, monitorTask]);
  await saveLiveState(env);
}

async function handleNeuralCalendarRequest(request: Request, url: URL, env: unknown) {
  if (url.pathname !== "/calendar/neural") return null;
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "GET") return json({ error: "Metodo nao permitido." }, 405);

  if (!(await isNeuralCalendarAuthorized(request, url, env))) {
    return json({ error: "Calendario Neural disponivel apenas para usuarios premium." }, 403);
  }

  await hydrateNeuralCalendarStatsFromTables(env);
  await ensureEngineCalendarAggregatesAvailable(env);

  const now = saoPauloDateParts();
  const requestedYear = clampCalendarYear(url.searchParams.get("year"), now.year);
  const allowedYears = new Set([now.year - 1, now.year, now.year + 1]);
  const year = allowedYears.has(requestedYear) ? requestedYear : now.year;
  const month = clampCalendarMonth(url.searchParams.get("month"), now.month);
  const selectedDate = normalizeCalendarDateParam(url.searchParams.get("date"));
  const engineSelection = calendarEngineSelectionFromUrl(url);

  return json({
    calendar: buildEngineNeuralCalendarPayload({
      year,
      month,
      selectedDate,
      range: readString({ range: url.searchParams.get("range") }, "range") || "este_mes",
      engineMode: engineSelection.mode,
      engineKeys: engineSelection.engineKeys,
    }),
  });
}

async function handleNeuralCalendarResetRequest(request: Request, url: URL, env: unknown) {
  if (url.pathname !== "/calendar/neural/reset") return null;
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  if (!(await isDashboardAuthorized(request, url, env))) {
    return json({ error: "Reset permitido apenas para administrador." }, 403);
  }

  const reset = await resetEngineCalendarAggregates(env);
  return json({ ok: reset.ok, reset }, reset.ok ? 200 : 500);
}

async function handleNeuralCalendarBackfillRequest(request: Request, url: URL, env: unknown) {
  if (url.pathname !== "/calendar/neural/backfill") return null;
  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  if (!(await isDashboardAuthorized(request, url, env))) {
    return json({ error: "Backfill permitido apenas para administrador." }, 403);
  }

  const backfill = await runEngineCalendarBackfill(env);
  return json({ ok: backfill.ok, backfill }, backfill.ok ? 200 : 500);
}

async function resetEngineCalendarAggregates(env: unknown) {
  const tables = [
    ENGINE_SIGNAL_EVENTS_TABLE,
    ENGINE_HOURLY_STATS_TABLE,
    ENGINE_DAILY_STATS_TABLE,
    ENGINE_WEEKLY_STATS_TABLE,
    ENGINE_MONTHLY_STATS_TABLE,
    ENGINE_YEARLY_STATS_TABLE,
  ];
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  const tableResults = tables.map((table) => ({
    table,
    ok: true,
    status: 0,
    preserved: true,
    action: "not_deleted",
  }));

  const hadCalendarRowsBeforeReload = hasEngineCalendarAggregateRows();
  // Calendar history is permanent: reload must merge stored rows, never blank previous days.
  neuralCalendarHydratedFromTables = false;
  await hydrateNeuralCalendarStatsFromTables(env);
  const hasCalendarRowsAfterReload = hasEngineCalendarAggregateRows();
  if (hadCalendarRowsBeforeReload || hasCalendarRowsAfterReload) {
    await saveLiveState(env);
  }

  return {
    ok: true,
    durableConfigured,
    clearedTables: [],
    preservedTables: tables,
    mode: "non_destructive_cache_reload",
    preserved: [
      "engine_hourly_stats",
      "engine_daily_stats",
      "engine_weekly_stats",
      "engine_monthly_stats",
      "engine_yearly_stats",
      "engine_signal_events",
      "validator_rounds",
      "raw_round_history",
      "users",
      "clients",
      "subscriptions",
      "payments",
      "original_engines",
    ],
    tableResults,
    liveStateSaved: hadCalendarRowsBeforeReload || hasCalendarRowsAfterReload,
    resetAt: new Date().toISOString(),
  };
}

async function runEngineCalendarBackfill(env: unknown): Promise<EngineCalendarBackfillReport> {
  const report = emptyEngineCalendarBackfillReport();
  if (!getSupabasePersistenceConfig(env)) {
    report.ok = false;
    report.error = "Supabase nao configurado para persistencia.";
    return report;
  }

  await hydrateNeuralCalendarStatsFromTables(env);

  const change = emptyEngineCalendarAggregateChangeSet();
  await backfillEngineCalendarFromValidatorRounds(env, change, report);
  await backfillEngineCalendarFromLegacyPatternLiveHits(env, change, report);
  await backfillEngineCalendarFromLiveStateSnapshots(env, change, report);

  if (change.changed) {
    await persistEngineCalendarAggregateStats(env, change);
  }
  liveEngineCalendarBackfillKeys = pruneEngineCalendarBackfillKeys(liveEngineCalendarBackfillKeys);
  await saveLiveState(env);

  report.changedRows = engineCalendarChangedRows(change);
  report.keysStored = Object.keys(liveEngineCalendarBackfillKeys).length;
  report.updatedAt = new Date().toISOString();
  return report;
}

function emptyEngineCalendarBackfillReport(): EngineCalendarBackfillReport {
  return {
    ok: true,
    mode: "real_history_only",
    preservedExistingHistory: true,
    sources: [],
    appliedCounters: { greens: 0, reds: 0, ties: 0 },
    changedRows: { hourly: 0, daily: 0, weekly: 0, monthly: 0, yearly: 0 },
    keysStored: Object.keys(liveEngineCalendarBackfillKeys).length,
    updatedAt: new Date().toISOString(),
  };
}

function engineCalendarChangedRows(
  change: EngineCalendarAggregateChangeSet,
): Record<EngineCalendarAggregateKind, number> {
  return {
    hourly: change.hourlyIds.size,
    daily: change.dailyIds.size,
    weekly: change.weeklyIds.size,
    monthly: change.monthlyIds.size,
    yearly: change.yearlyIds.size,
  };
}

function createEngineCalendarBackfillSourceReport(source: string, table: string): EngineCalendarBackfillSourceReport {
  return {
    source,
    table,
    rowsRead: 0,
    snapshotsRead: 0,
    countersFound: 0,
    countersApplied: 0,
    skipped: {},
  };
}

function addEngineCalendarBackfillSkip(source: EngineCalendarBackfillSourceReport, reason: string, count = 1) {
  source.skipped[reason] = (source.skipped[reason] || 0) + count;
}

async function backfillEngineCalendarFromValidatorRounds(
  env: unknown,
  change: EngineCalendarAggregateChangeSet,
  report: EngineCalendarBackfillReport,
) {
  const source = createEngineCalendarBackfillSourceReport(
    "validator_rounds_explicit_engine_results",
    VALIDATOR_ROUNDS_TABLE,
  );
  report.sources.push(source);

  try {
    const rows = await fetchSupabaseRowsPaged(env, VALIDATOR_ROUNDS_TABLE, "select=*&order=created_at.asc");
    source.rowsRead = rows.length;

    rows.forEach((row, index) => {
      const engineKey = normalizeBackfillEngineKey(
        row.engine_key ?? row.engineKey ?? row.module ?? row.motor ?? row.source ?? row.engine,
      );
      if (!engineKey) {
        addEngineCalendarBackfillSkip(source, "raw_round_without_engine_key");
        return;
      }

      const counters = readBackfillCountersFromRow(row) || backfillCountersFromOutcome(row);
      if (!counters || !calendarCountersTotal(counters)) {
        addEngineCalendarBackfillSkip(source, "engine_row_without_green_red_tie_result");
        return;
      }

      const occurredAt = readBackfillOccurredAt(row);
      if (!occurredAt) {
        addEngineCalendarBackfillSkip(source, "missing_valid_timestamp");
        return;
      }

      const rowKey =
        readString(row, "id") ||
        readString(row, "round_id") ||
        readString(row, "roundId") ||
        `${occurredAt.toISOString()}:${index}`;
      applyEngineCalendarBackfillCounters({
        key: `validator_rounds:${safeBackfillKey(rowKey)}:${engineKey}`,
        engineKey,
        counters,
        occurredAt,
        change,
        source,
        report,
      });
    });
  } catch (error) {
    source.error = errorMessage(error);
  }
}

async function backfillEngineCalendarFromLegacyPatternLiveHits(
  env: unknown,
  change: EngineCalendarAggregateChangeSet,
  report: EngineCalendarBackfillReport,
) {
  const source = createEngineCalendarBackfillSourceReport(
    "pattern_live_hits_explicit_results",
    LEGACY_PATTERN_LIVE_HITS_TABLE,
  );
  report.sources.push(source);

  try {
    const rows = await fetchSupabaseRowsPaged(env, LEGACY_PATTERN_LIVE_HITS_TABLE, "select=*&order=created_at.asc");
    source.rowsRead = rows.length;

    rows.forEach((row, index) => {
      const counters = backfillCountersFromOutcome(row);
      if (!counters || !calendarCountersTotal(counters)) {
        addEngineCalendarBackfillSkip(source, "pattern_hit_without_final_green_red_tie_result");
        return;
      }

      const occurredAt = readBackfillOccurredAt(row);
      if (!occurredAt) {
        addEngineCalendarBackfillSkip(source, "missing_valid_timestamp");
        return;
      }

      const rowKey =
        readString(row, "id") ||
        readString(row, "detected_round_id") ||
        readString(row, "entry_round_id") ||
        `${occurredAt.toISOString()}:${index}`;
      applyEngineCalendarBackfillCounters({
        key: `pattern_live_hits:${safeBackfillKey(rowKey)}:padroes_quentes_ia`,
        engineKey: "padroes_quentes_ia",
        counters,
        occurredAt,
        change,
        source,
        report,
      });
    });
  } catch (error) {
    source.error = errorMessage(error);
  }
}

async function backfillEngineCalendarFromLiveStateSnapshots(
  env: unknown,
  change: EngineCalendarAggregateChangeSet,
  report: EngineCalendarBackfillReport,
) {
  const source = createEngineCalendarBackfillSourceReport("sniper_live_state_dashboard_snapshots", LIVE_STATE_TABLE);
  report.sources.push(source);

  try {
    const rows = await fetchSupabaseRowsPaged(env, LIVE_STATE_TABLE, "select=id,state,updated_at&order=updated_at.asc");
    source.rowsRead = rows.length;

    const snapshots = rows
      .flatMap((row, index) => collectEngineCalendarBackfillSnapshots(row, index, source))
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    source.snapshotsRead = snapshots.length;

    if (snapshots.length < 2) {
      addEngineCalendarBackfillSkip(
        source,
        "insufficient_dashboard_snapshots_for_delta",
        Math.max(1, snapshots.length),
      );
      return;
    }

    let previousSnapshot: EngineCalendarBackfillDashboardSnapshot | null = null;
    let previousCounters: Partial<Record<CalendarEngineKey, CalendarEngineCounterSnapshot>> | null = null;
    for (const snapshot of snapshots) {
      const nextCounters = readEngineCalendarCounterSnapshots(snapshot.data);
      if (!engineSnapshotHasCounters(nextCounters)) {
        addEngineCalendarBackfillSkip(source, "snapshot_without_engine_counters");
        continue;
      }
      if (!previousSnapshot || !previousCounters) {
        previousSnapshot = snapshot;
        previousCounters = nextCounters;
        continue;
      }

      const sameHour = isSameSaoPauloHour(previousSnapshot.occurredAt, snapshot.occurredAt);
      for (const engineKey of CALENDAR_BACKFILL_ENGINE_KEYS) {
        const delta = diffEngineCalendarCounters(previousCounters[engineKey], nextCounters[engineKey]);
        const total = calendarCountersTotal(delta);
        if (!total) continue;
        if (!sameHour) {
          addEngineCalendarBackfillSkip(source, "snapshot_delta_crosses_hour_boundary", total);
          continue;
        }
        applyEngineCalendarBackfillCounters({
          key: `sniper_live_state:${safeBackfillKey(snapshot.key)}:${engineKey}`,
          engineKey,
          counters: delta,
          occurredAt: snapshot.occurredAt,
          change,
          source,
          report,
        });
      }
      previousSnapshot = snapshot;
      previousCounters = nextCounters;
    }
  } catch (error) {
    source.error = errorMessage(error);
  }
}

function collectEngineCalendarBackfillSnapshots(
  row: Record<string, unknown>,
  rowIndex: number,
  source: EngineCalendarBackfillSourceReport,
): EngineCalendarBackfillDashboardSnapshot[] {
  const rowId = readString(row, "id") || `row-${rowIndex}`;
  const fallbackDate = readBackfillOccurredAt(row) || new Date();
  const state = readBackfillRecord(row.state);
  const snapshots: EngineCalendarBackfillDashboardSnapshot[] = [];

  addEngineCalendarBackfillSnapshot(snapshots, {
    key: `${rowId}:state`,
    occurredAt: fallbackDate,
    data: state,
  });

  for (const key of [
    "dashboardSnapshots",
    "engineSnapshots",
    "calendarSnapshots",
    "signalSnapshots",
    "snapshots",
    "history",
    "events",
  ]) {
    const items = Array.isArray(state[key]) ? state[key] : [];
    items.forEach((item, index) => {
      const itemRecord = readBackfillRecord(item);
      const data = firstBackfillRecord([itemRecord.dashboard, itemRecord.data, itemRecord.state, itemRecord]);
      if (!Object.keys(data).length) {
        addEngineCalendarBackfillSkip(source, "snapshot_item_without_data");
        return;
      }
      const occurredAt = readBackfillOccurredAt(itemRecord) || fallbackDate;
      addEngineCalendarBackfillSnapshot(snapshots, {
        key: `${rowId}:${key}:${index}:${occurredAt.toISOString()}`,
        occurredAt,
        data,
      });
    });
  }

  return snapshots;
}

function addEngineCalendarBackfillSnapshot(
  snapshots: EngineCalendarBackfillDashboardSnapshot[],
  snapshot: EngineCalendarBackfillDashboardSnapshot,
) {
  if (!Object.keys(snapshot.data).length) return;
  if (!engineSnapshotHasCounters(readEngineCalendarCounterSnapshots(snapshot.data))) return;
  snapshots.push(snapshot);
}

function applyEngineCalendarBackfillCounters(input: {
  key: string;
  engineKey: CalendarSignalEngineKey;
  counters: CalendarEngineCounterSnapshot;
  occurredAt: Date;
  change: EngineCalendarAggregateChangeSet;
  source: EngineCalendarBackfillSourceReport;
  report: EngineCalendarBackfillReport;
}) {
  const counters = normalizeCalendarCounterSnapshot(input.counters);
  const total = calendarCountersTotal(counters);
  if (!total) {
    addEngineCalendarBackfillSkip(input.source, "empty_counter_delta");
    return;
  }

  input.source.countersFound += total;
  const safeKey = safeBackfillKey(input.key);
  if (liveEngineCalendarBackfillKeys[safeKey]) {
    addEngineCalendarBackfillSkip(input.source, "already_backfilled", total);
    return;
  }

  liveEngineCalendarBackfillKeys[safeKey] = true;
  mergeEngineCalendarAggregateChange(
    input.change,
    incrementEngineCalendarAggregates(input.engineKey, counters, input.occurredAt, input.source.source, input.key),
  );
  input.source.countersApplied += total;
  input.report.appliedCounters.greens += counters.greens;
  input.report.appliedCounters.reds += counters.reds;
  input.report.appliedCounters.ties += counters.ties;
}

function normalizeCalendarCounterSnapshot(counters: CalendarEngineCounterSnapshot): CalendarEngineCounterSnapshot {
  return {
    greens: Math.max(0, Math.floor(Number(counters.greens) || 0)),
    reds: Math.max(0, Math.floor(Number(counters.reds) || 0)),
    ties: Math.max(0, Math.floor(Number(counters.ties) || 0)),
  };
}

function readBackfillCountersFromRow(row: Record<string, unknown>): CalendarEngineCounterSnapshot | null {
  const counters = normalizeCalendarCounterSnapshot({
    greens: firstCalendarNumber(row, ["greens", "green", "wins", "acertos", "sg_wins", "sgWins"]),
    reds: firstCalendarNumber(row, ["reds", "red", "losses", "loss", "erros", "losses_count"]),
    ties: firstCalendarNumber(row, ["ties", "tie", "empates", "emp", "tie_wins", "tieWins"]),
  });
  return calendarCountersTotal(counters) ? counters : null;
}

function backfillCountersFromOutcome(row: Record<string, unknown>): CalendarEngineCounterSnapshot | null {
  const payload = readBackfillRecord(row.payload_json ?? row.payloadJson ?? row.payload);
  const outcome = normalizeBackfillOutcome(
    row.outcome ??
      row.signal_outcome ??
      row.signalOutcome ??
      row.status ??
      row.result_status ??
      row.resultStatus ??
      row.resultado ??
      row.result ??
      payload.outcome ??
      payload.status ??
      payload.result,
  );
  if (outcome === "green") return { greens: 1, reds: 0, ties: 0 };
  if (outcome === "red") return { greens: 0, reds: 1, ties: 0 };
  if (outcome === "tie") return { greens: 0, reds: 0, ties: 1 };
  return null;
}

function normalizeBackfillOutcome(value: unknown): CalendarHourlyOutcome | null {
  const text = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!text) return null;
  if (
    ["green", "win", "winner", "sg", "g1", "g2", "acerto", "batido", "gain"].includes(text) ||
    text.includes("green") ||
    text.includes("win") ||
    text.includes("acerto")
  ) {
    return "green";
  }
  if (
    ["red", "loss", "lose", "lost", "erro", "rd"].includes(text) ||
    text.includes("red") ||
    text.includes("loss") ||
    text.includes("erro")
  ) {
    return "red";
  }
  if (
    ["tie", "empate", "emp", "tie_win", "tie_result"].includes(text) ||
    text.includes("tie") ||
    text.includes("empate")
  ) {
    return "tie";
  }
  return null;
}

function normalizeBackfillEngineKey(value: unknown): CalendarSignalEngineKey | null {
  const text = String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!text || text === "todos" || text === "personalizado") return null;
  if (text.includes("neural") || text.includes("numero_pagante") || text.includes("pagante")) {
    return "neural_pagante";
  }
  if (text.includes("padroes") || text.includes("pattern") || text.includes("miner") || text.includes("quente")) {
    return "padroes_quentes_ia";
  }
  if (text.includes("surf")) return "surf_analyzer";
  if (text.includes("empate") || text.includes("tie") || text.includes("radar")) return "radar_empates";
  if (text.includes("tendencia") || text.includes("entrada_principal") || text.includes("main")) return "tendencia";
  return CALENDAR_BACKFILL_ENGINE_KEYS.includes(text as CalendarSignalEngineKey)
    ? (text as CalendarSignalEngineKey)
    : null;
}

function readBackfillOccurredAt(row: Record<string, unknown>): Date | null {
  for (const key of [
    "resolved_at",
    "resolvedAt",
    "sent_at",
    "sentAt",
    "detected_at",
    "detectedAt",
    "created_at",
    "createdAt",
    "updated_at",
    "updatedAt",
    "timestamp",
    "recordedAt",
    "recorded_at",
  ]) {
    const value = readString(row, key);
    if (!value) continue;
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed;
  }
  return null;
}

function readBackfillRecord(value: unknown): Record<string, unknown> {
  const direct = readRecord(value);
  if (Object.keys(direct).length) return direct;
  if (typeof value === "string") return readRecord(parseJsonSafe(value));
  return {};
}

function firstBackfillRecord(values: unknown[]) {
  for (const value of values) {
    const record = readBackfillRecord(value);
    if (Object.keys(record).length) return record;
  }
  return {};
}

function engineSnapshotHasCounters(snapshot: Partial<Record<CalendarEngineKey, CalendarEngineCounterSnapshot>>) {
  return CALENDAR_BACKFILL_ENGINE_KEYS.some((engineKey) => calendarCountersTotal(snapshot[engineKey]));
}

function calendarCountersTotal(counters: CalendarEngineCounterSnapshot | undefined) {
  if (!counters) return 0;
  return (
    Math.max(0, Math.floor(Number(counters.greens) || 0)) +
    Math.max(0, Math.floor(Number(counters.reds) || 0)) +
    Math.max(0, Math.floor(Number(counters.ties) || 0))
  );
}

function isSameSaoPauloHour(first: Date, second: Date) {
  const firstParts = saoPauloDateParts(first);
  const secondParts = saoPauloDateParts(second);
  return firstParts.date === secondParts.date && firstParts.hour === secondParts.hour;
}

function safeBackfillKey(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/[^a-z0-9:._-]+/gi, "_")
    .slice(0, 220);
}

async function isNeuralCalendarAuthorized(request: Request, url: URL, env: unknown) {
  if (await isDashboardAuthorized(request, url, env)) return true;

  const token = getBearerToken(request);
  if (!token) return false;

  const session = await verifySessionToken(env, token);
  if (!session) return false;
  if (!sessionMatchesRequestBinding(env, request, session)) return false;
  return session.scope === "owner" || session.scope === "admin_approver" || session.scope === "client";
}

function trackNeuralCalendarRounds(rounds: Round[]): NeuralCalendarChangeSet {
  const change = emptyNeuralCalendarChangeSet();
  if (!rounds.length) return change;

  const dailyById = new Map(liveNeuralCalendarDailyStats.map((row) => [row.id, row]));
  const hourlyById = new Map(liveNeuralCalendarHourlyStats.map((row) => [row.id, row]));
  const counted = { ...liveNeuralCalendarCountedRoundKeys };

  for (const round of rounds) {
    const parts = neuralCalendarPartsForRound(round);
    if (!parts || parts.date < NEURAL_CALENDAR_START_DATE) continue;

    const countedKey = `${parts.date}:${roundHistoryKey(round)}`;
    if (counted[countedKey]) continue;
    counted[countedKey] = true;

    const dailyId = parts.date;
    const hourlyId = `${parts.date}:${String(parts.hour).padStart(2, "0")}`;
    const daily = dailyById.get(dailyId) || emptyNeuralCalendarDailyStat(parts);
    const hourly = hourlyById.get(hourlyId) || emptyNeuralCalendarHourlyStat(parts);

    incrementNeuralCalendarStat(daily, round);
    incrementNeuralCalendarStat(hourly, round);
    recomputeNeuralCalendarStat(daily, NEURAL_CALENDAR_MIN_DAILY_SAMPLE);
    recomputeNeuralCalendarStat(hourly, NEURAL_CALENDAR_MIN_HOURLY_SAMPLE);

    dailyById.set(dailyId, daily);
    hourlyById.set(hourlyId, hourly);
    change.changed = true;
    change.dailyIds.add(dailyId);
    change.hourlyIds.add(hourlyId);
  }

  if (!change.changed) return change;

  for (const dailyId of change.dailyIds) {
    const daily = dailyById.get(dailyId);
    if (!daily) continue;
    refreshNeuralCalendarDailyExtremes(daily, defaultCalendarHourlyStats([...hourlyById.values()]));
    dailyById.set(dailyId, daily);
  }

  liveNeuralCalendarDailyStats = [...dailyById.values()].sort((a, b) => a.date.localeCompare(b.date));
  liveNeuralCalendarHourlyStats = [...hourlyById.values()].sort((a, b) => a.id.localeCompare(b.id));
  liveNeuralCalendarCountedRoundKeys = pruneNeuralCalendarCountedKeys(counted);
  return change;
}

function emptyNeuralCalendarChangeSet(): NeuralCalendarChangeSet {
  return {
    changed: false,
    dailyIds: new Set(),
    hourlyIds: new Set(),
  };
}

function emptyNeuralCalendarDailyStat(parts: NeuralCalendarDateParts): NeuralCalendarDailyStat {
  const now = new Date().toISOString();
  return {
    id: parts.date,
    date: parts.date,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    weekday: parts.weekday,
    totalRounds: 0,
    greens: 0,
    reds: 0,
    ties: 0,
    bankerCount: 0,
    playerCount: 0,
    tieCount: 0,
    accuracy: 0,
    score: 0,
    classification: "sem_amostra",
    bestHour: "",
    worstHour: "",
    bestModule: "Tendencia",
    bestForce: "NONE",
    observation: "Sem amostra suficiente no historico real coletado.",
    createdAt: now,
    updatedAt: now,
  };
}

function emptyNeuralCalendarHourlyStat(parts: NeuralCalendarDateParts): NeuralCalendarHourlyStat {
  return {
    ...emptyNeuralCalendarDailyStat(parts),
    id: `${parts.date}:${String(parts.hour).padStart(2, "0")}`,
    engineKey: DEFAULT_CALENDAR_ENGINE_KEY,
    totalSignals: 0,
    hour: parts.hour,
    bankerPercent: 0,
    playerPercent: 0,
    tiePercent: 0,
    bestReading: "Aguardando amostra real.",
  };
}

function incrementNeuralCalendarStat(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat, round: Round) {
  stat.totalRounds += 1;
  if (round.result === "B") stat.bankerCount += 1;
  if (round.result === "P") stat.playerCount += 1;
  if (round.result === "T") {
    stat.tieCount += 1;
    stat.ties += 1;
  }
  stat.updatedAt = new Date().toISOString();
}

function recomputeNeuralCalendarStat(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat, minSample: number) {
  const best = neuralCalendarBestForce(stat);
  const total = Math.max(0, stat.totalRounds);
  stat.bestForce = best.force;
  stat.greens = best.count;
  stat.reds = Math.max(0, total - best.count);
  stat.accuracy = total ? roundCalendarPercent((best.count / total) * 100) : 0;
  stat.score = stat.accuracy;
  stat.classification = classifyNeuralCalendarScore(stat.score, total, minSample);
  stat.bestModule = inferNeuralCalendarModule(stat);
  stat.observation = neuralCalendarObservation(stat);

  if ("hour" in stat) {
    stat.bankerPercent = total ? roundCalendarPercent((stat.bankerCount / total) * 100) : 0;
    stat.playerPercent = total ? roundCalendarPercent((stat.playerCount / total) * 100) : 0;
    stat.tiePercent = total ? roundCalendarPercent((stat.tieCount / total) * 100) : 0;
    stat.bestReading =
      stat.bestForce === "NONE"
        ? "Aguardando amostra real."
        : `${neuralCalendarForceLabel(stat.bestForce)} dominante no horario.`;
  }
}

function refreshNeuralCalendarDailyExtremes(daily: NeuralCalendarDailyStat, hourlyStats: NeuralCalendarHourlyStat[]) {
  const hours = hourlyStats
    .filter((hour) => hour.date === daily.date && hour.classification !== "sem_amostra")
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds);
  daily.bestHour = hours[0] ? `${String(hours[0].hour).padStart(2, "0")}:00` : "";
  daily.worstHour = hours.at(-1) ? `${String(hours.at(-1)?.hour ?? 0).padStart(2, "0")}:00` : "";
}

function neuralCalendarBestForce(stat: Pick<NeuralCalendarDailyStat, "bankerCount" | "playerCount" | "tieCount">) {
  const rows: Array<{ force: NeuralCalendarForce; count: number }> = [
    { force: "BANKER", count: stat.bankerCount },
    { force: "PLAYER", count: stat.playerCount },
    { force: "TIE", count: stat.tieCount },
  ];
  rows.sort((a, b) => b.count - a.count);
  return rows[0]?.count ? rows[0] : { force: "NONE" as const, count: 0 };
}

function classifyNeuralCalendarScore(
  score: number,
  totalRounds: number,
  minSample: number,
): NeuralCalendarClassification {
  if (totalRounds < minSample) return "sem_amostra";
  if (score >= 89) return "muito_pagante";
  if (score >= 85) return "operavel";
  return "perigoso";
}

function inferNeuralCalendarModule(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat): NeuralCalendarModule {
  if (stat.bestForce === "TIE") return "Validador";
  if (stat.classification === "muito_pagante") return "Neural Pagante";
  if (stat.classification === "perigoso") return "Surf Analyzer";
  return "Tendencia";
}

function neuralCalendarObservation(stat: NeuralCalendarDailyStat | NeuralCalendarHourlyStat) {
  if (stat.classification === "sem_amostra") {
    return "Sem amostra suficiente no historico real coletado.";
  }
  if (stat.classification === "muito_pagante") {
    return "Periodo favoravel. A forca dominante apareceu com alta consistencia no historico real.";
  }
  if (stat.classification === "operavel") {
    return "Periodo operavel. Existe vantagem historica, mas precisa de leitura e protecao.";
  }
  return "Periodo perigoso. Historico com baixa concentracao e maior risco de quebra.";
}

function buildNeuralCalendarPayload({
  year,
  month,
  selectedDate,
  range,
}: {
  year: number;
  month: number;
  selectedDate: string;
  range: string;
}) {
  const now = saoPauloDateParts();
  const years = neuralCalendarAvailableYears(now.year);
  const dailyByDate = new Map(liveNeuralCalendarDailyStats.map((row) => [row.date, row]));
  const baseHourlyStats = defaultCalendarHourlyStats();
  const hourlyById = new Map(baseHourlyStats.map((row) => [row.id, row]));
  const daysInMonth = calendarDaysInMonth(year, month);
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
    const date = calendarDateString(year, month, index + 1);
    return dailyByDate.get(date) || emptyNeuralCalendarDailyStat(calendarPartsFromDateString(date));
  });
  const fallbackSelectedDate =
    [...monthDays].filter((day) => day.classification !== "sem_amostra").sort((a, b) => b.date.localeCompare(a.date))[0]
      ?.date || (now.year === year && now.month === month ? now.date : calendarDateString(year, month, 1));
  const cleanSelectedDate =
    selectedDate && selectedDate.startsWith(`${year}-${String(month).padStart(2, "0")}`)
      ? selectedDate
      : fallbackSelectedDate;
  const selectedDay =
    dailyByDate.get(cleanSelectedDate) || emptyNeuralCalendarDailyStat(calendarPartsFromDateString(cleanSelectedDate));
  const selectedHours = Array.from({ length: 24 }, (_, hour) => {
    const id = `${cleanSelectedDate}:${String(hour).padStart(2, "0")}`;
    return (
      hourlyById.get(id) ||
      emptyNeuralCalendarHourlyStat({
        ...calendarPartsFromDateString(cleanSelectedDate),
        hour,
      })
    );
  });

  return {
    timezone: DASHBOARD_CYCLE_TIME_ZONE,
    startDate: NEURAL_CALENDAR_START_DATE,
    updatedAt: new Date().toISOString(),
    range,
    years,
    selected: {
      year,
      month,
      date: cleanSelectedDate,
    },
    month: {
      year,
      month,
      label: neuralCalendarMonthLabel(year, month),
      days: monthDays,
      firstWeekday: calendarFirstWeekday(year, month),
      summary: neuralCalendarMonthSummary(monthDays, selectedHours),
      distribution: neuralCalendarDistribution(monthDays),
      weekdayAverages: neuralCalendarWeekdayAverages(monthDays),
      heatmap: neuralCalendarHeatmap(year, month, baseHourlyStats),
    },
    selectedDay,
    selectedHours,
    rankings: {
      topHours: neuralCalendarTopHours(baseHourlyStats),
      topWeekdays: neuralCalendarTopWeekdays(),
      topMonthDays: neuralCalendarTopMonthDays(),
    },
  };
}

function neuralCalendarMonthSummary(days: NeuralCalendarDailyStat[], selectedHours: NeuralCalendarHourlyStat[]) {
  const sampledDays = days.filter((day) => day.classification !== "sem_amostra");
  const sampledHours = selectedHours.filter((hour) => hour.classification !== "sem_amostra");
  const bestDay = [...sampledDays].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstDay = [...sampledDays].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  const bestHour = [...sampledHours].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstHour = [...sampledHours].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  return {
    averageScore: sampledDays.length
      ? roundCalendarPercent(sampledDays.reduce((sum, day) => sum + day.score, 0) / sampledDays.length)
      : 0,
    bestDay,
    worstDay,
    bestHour,
    worstHour,
    counts: neuralCalendarDistribution(days),
  };
}

function engineCalendarMonthSummary(
  days: NeuralCalendarDailyStat[],
  monthHours: NeuralCalendarHourlyStat[],
  monthAggregate: EngineCalendarAggregateStat | null,
) {
  const sampledDays = days.filter((day) => day.classification !== "sem_amostra" && day.totalRounds > 0);
  const sampledHours = monthHours.filter((hour) => hour.classification !== "sem_amostra" && hour.totalRounds > 0);
  const bestDay = [...sampledDays].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstDay = [...sampledDays].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  const bestHour = [...sampledHours].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstHour = [...sampledHours].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;

  return {
    averageScore: monthAggregate?.totalSignals ? monthAggregate.score : 0,
    bestDay,
    worstDay,
    bestHour,
    worstHour,
    counts: neuralCalendarDistribution(days),
  };
}

function decorateEngineCalendarDayWithHours(
  day: NeuralCalendarDailyStat,
  hours: NeuralCalendarHourlyStat[],
): NeuralCalendarDailyStat {
  const sampledHours = hours.filter((hour) => hour.classification !== "sem_amostra" && hour.totalRounds > 0);
  const bestHour = [...sampledHours].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const worstHour = [...sampledHours].sort((a, b) => a.score - b.score || b.totalRounds - a.totalRounds)[0] || null;
  return {
    ...day,
    bestHour: bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "",
    worstHour: worstHour ? `${String(worstHour.hour).padStart(2, "0")}:00` : "",
  };
}

function neuralCalendarDistribution(days: NeuralCalendarDailyStat[]) {
  return days.reduce(
    (acc, day) => {
      acc[day.classification] += 1;
      return acc;
    },
    { muito_pagante: 0, operavel: 0, perigoso: 0, sem_amostra: 0 },
  );
}

function neuralCalendarWeekdayAverages(days: NeuralCalendarDailyStat[]) {
  const byWeekday = new Map<string, { total: number; count: number }>();
  for (const day of days) {
    if (day.classification === "sem_amostra") continue;
    const current = byWeekday.get(day.weekday) || { total: 0, count: 0 };
    current.total += day.score;
    current.count += 1;
    byWeekday.set(day.weekday, current);
  }
  return calendarWeekdayOrder().map((weekday) => {
    const item = byWeekday.get(weekday) || { total: 0, count: 0 };
    return {
      weekday,
      score: item.count ? roundCalendarPercent(item.total / item.count) : 0,
      total: item.count,
      classification: classifyNeuralCalendarScore(item.count ? item.total / item.count : 0, item.count, 1),
    };
  });
}

function neuralCalendarHeatmap(year: number, month: number, rows = defaultCalendarHourlyStats()) {
  return rows
    .filter((hour) => hour.year === year && hour.month === month)
    .map((hour) => ({
      date: hour.date,
      day: hour.day,
      hour: hour.hour,
      score: hour.score,
      classification: hour.classification,
      totalRounds: hour.totalRounds,
    }));
}

function neuralCalendarTopHours(rows = defaultCalendarHourlyStats()) {
  const byHour = new Map<number, { totalScore: number; count: number; totalRounds: number }>();
  for (const hour of rows) {
    if (hour.classification === "sem_amostra") continue;
    const current = byHour.get(hour.hour) || { totalScore: 0, count: 0, totalRounds: 0 };
    current.totalScore += hour.score;
    current.totalRounds += hour.totalRounds;
    current.count += 1;
    byHour.set(hour.hour, current);
  }
  return [...byHour.entries()]
    .map(([hour, value]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      score: value.count ? roundCalendarPercent(value.totalScore / value.count) : 0,
      totalRounds: value.totalRounds,
    }))
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

function neuralCalendarTopWeekdays() {
  return neuralCalendarWeekdayAverages(liveNeuralCalendarDailyStats)
    .filter((item) => item.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 7);
}

function neuralCalendarTopMonthDays() {
  return liveNeuralCalendarDailyStats
    .filter((day) => day.classification !== "sem_amostra")
    .map((day) => ({
      date: day.date,
      label: `${String(day.day).padStart(2, "0")}/${String(day.month).padStart(2, "0")}`,
      score: day.score,
      totalRounds: day.totalRounds,
      classification: day.classification,
    }))
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

async function hydrateNeuralCalendarStatsFromTables(env: unknown) {
  if (!getSupabasePersistenceConfig(env) || neuralCalendarHydratedFromTables) return;

  const [
    storedDailyStats,
    storedHourlyStats,
    storedEngineHourlyStats,
    storedEngineDailyStats,
    storedEngineWeeklyStats,
    storedEngineMonthlyStats,
    storedEngineYearlyStats,
  ] = await Promise.all([
    fetchStoredNeuralCalendarDailyStats(env),
    fetchStoredNeuralCalendarHourlyStats(env),
    fetchStoredEngineCalendarAggregateStats(env, "hourly"),
    fetchStoredEngineCalendarAggregateStats(env, "daily"),
    fetchStoredEngineCalendarAggregateStats(env, "weekly"),
    fetchStoredEngineCalendarAggregateStats(env, "monthly"),
    fetchStoredEngineCalendarAggregateStats(env, "yearly"),
  ]);
  if (storedDailyStats.length) {
    liveNeuralCalendarDailyStats = mergeNeuralCalendarDailyStats([
      ...liveNeuralCalendarDailyStats,
      ...storedDailyStats,
    ]);
  }
  if (storedHourlyStats.length) {
    liveNeuralCalendarHourlyStats = mergeNeuralCalendarHourlyStats([
      ...liveNeuralCalendarHourlyStats,
      ...storedHourlyStats,
    ]);
  }
  if (storedEngineHourlyStats.length) {
    liveEngineHourlyStats = mergeEngineCalendarAggregateStats([...liveEngineHourlyStats, ...storedEngineHourlyStats]);
  }
  if (storedEngineDailyStats.length) {
    liveEngineDailyStats = mergeEngineCalendarAggregateStats([...liveEngineDailyStats, ...storedEngineDailyStats]);
  }
  if (storedEngineWeeklyStats.length) {
    liveEngineWeeklyStats = mergeEngineCalendarAggregateStats([...liveEngineWeeklyStats, ...storedEngineWeeklyStats]);
  }
  if (storedEngineMonthlyStats.length) {
    liveEngineMonthlyStats = mergeEngineCalendarAggregateStats([
      ...liveEngineMonthlyStats,
      ...storedEngineMonthlyStats,
    ]);
  }
  if (storedEngineYearlyStats.length) {
    liveEngineYearlyStats = mergeEngineCalendarAggregateStats([...liveEngineYearlyStats, ...storedEngineYearlyStats]);
  }
  if (storedDailyStats.length || storedHourlyStats.length) {
    liveNeuralCalendarDailyStats = liveNeuralCalendarDailyStats.map((daily) => {
      refreshNeuralCalendarDailyExtremes(daily, defaultCalendarHourlyStats());
      return daily;
    });
  }
  neuralCalendarHydratedFromTables = true;
}

async function ensureEngineCalendarAggregatesAvailable(env: unknown) {
  if (!getSupabasePersistenceConfig(env)) return;

  const now = Date.now();
  const hasRows = hasEngineCalendarAggregateRows();
  if (hasRows && engineCalendarAutoBackfillCompleted) return;
  if (engineCalendarAutoBackfillPromise) {
    await engineCalendarAutoBackfillPromise;
    return;
  }
  if (engineCalendarAutoBackfillAttemptedAt && now - engineCalendarAutoBackfillAttemptedAt < 5 * 60 * 1000) {
    return;
  }

  engineCalendarAutoBackfillAttemptedAt = now;
  engineCalendarAutoBackfillPromise = runEngineCalendarBackfill(env)
    .then((report) => {
      if (!report.ok) {
        console.warn("Backfill automatico do Calendario Neural nao concluiu.", report.error || report);
        return;
      }
      engineCalendarAutoBackfillCompleted = true;
    })
    .catch((error) => {
      console.warn("Backfill automatico do Calendario Neural falhou.", error);
    })
    .finally(() => {
      engineCalendarAutoBackfillPromise = null;
    });
  await engineCalendarAutoBackfillPromise;
}

function hasEngineCalendarAggregateRows() {
  return Boolean(
    liveEngineHourlyStats.length ||
    liveEngineDailyStats.length ||
    liveEngineWeeklyStats.length ||
    liveEngineMonthlyStats.length ||
    liveEngineYearlyStats.length,
  );
}

async function fetchStoredNeuralCalendarDailyStats(env: unknown) {
  const rows = await fetchSupabaseRowsPaged(env, CALENDAR_DAILY_STATS_TABLE, "select=*&order=date.asc");
  return rows
    .map((row) => neuralCalendarDailyFromRow(row))
    .filter((row): row is NeuralCalendarDailyStat => Boolean(row));
}

async function fetchStoredNeuralCalendarHourlyStats(env: unknown) {
  const rows = await fetchSupabaseRowsPaged(env, CALENDAR_HOURLY_STATS_TABLE, "select=*&order=date.asc,hour.asc");
  return rows
    .map((row) => neuralCalendarHourlyFromRow(row))
    .filter((row): row is NeuralCalendarHourlyStat => Boolean(row));
}

async function fetchStoredEngineCalendarAggregateStats(env: unknown, kind: EngineCalendarAggregateKind) {
  const rows = await fetchSupabaseRowsPaged(env, engineCalendarAggregateTable(kind), "select=*&order=period_start.asc");
  return rows
    .map((row) => engineCalendarAggregateFromRow(row, kind))
    .filter((row): row is EngineCalendarAggregateStat => Boolean(row));
}

async function persistNeuralCalendarStats(env: unknown, change: NeuralCalendarChangeSet) {
  if (!getSupabasePersistenceConfig(env) || !change.changed) return false;
  const dailyRows = liveNeuralCalendarDailyStats
    .filter((row) => change.dailyIds.has(row.id))
    .map(neuralCalendarDailyToRow);
  const hourlyRows = liveNeuralCalendarHourlyStats
    .filter((row) => change.hourlyIds.has(row.id))
    .map(neuralCalendarHourlyToRow);
  const [dailySaved, hourlySaved] = await Promise.all([
    persistSupabaseRows(env, CALENDAR_DAILY_STATS_TABLE, dailyRows, "id"),
    persistSupabaseRows(env, CALENDAR_HOURLY_STATS_TABLE, hourlyRows, "id"),
  ]);
  return dailySaved || hourlySaved;
}

async function persistEngineCalendarAggregateStats(env: unknown, change: EngineCalendarAggregateChangeSet) {
  if (!getSupabasePersistenceConfig(env) || !change.changed) return false;
  const [eventsSaved, hourlySaved, dailySaved, weeklySaved, monthlySaved, yearlySaved] = await Promise.all([
    persistSupabaseRows(
      env,
      ENGINE_SIGNAL_EVENTS_TABLE,
      dedupeEngineCalendarSignalEvents(change.events).map(engineCalendarSignalEventToRow),
      "event_key",
    ),
    persistSupabaseRows(
      env,
      ENGINE_HOURLY_STATS_TABLE,
      liveEngineHourlyStats.filter((row) => change.hourlyIds.has(row.id)).map(engineCalendarAggregateToRow),
      "id",
    ),
    persistSupabaseRows(
      env,
      ENGINE_DAILY_STATS_TABLE,
      liveEngineDailyStats.filter((row) => change.dailyIds.has(row.id)).map(engineCalendarAggregateToRow),
      "id",
    ),
    persistSupabaseRows(
      env,
      ENGINE_WEEKLY_STATS_TABLE,
      liveEngineWeeklyStats.filter((row) => change.weeklyIds.has(row.id)).map(engineCalendarAggregateToRow),
      "id",
    ),
    persistSupabaseRows(
      env,
      ENGINE_MONTHLY_STATS_TABLE,
      liveEngineMonthlyStats.filter((row) => change.monthlyIds.has(row.id)).map(engineCalendarAggregateToRow),
      "id",
    ),
    persistSupabaseRows(
      env,
      ENGINE_YEARLY_STATS_TABLE,
      liveEngineYearlyStats.filter((row) => change.yearlyIds.has(row.id)).map(engineCalendarAggregateToRow),
      "id",
    ),
  ]);
  return eventsSaved || hourlySaved || dailySaved || weeklySaved || monthlySaved || yearlySaved;
}

function dedupeEngineCalendarSignalEvents(events: EngineCalendarSignalEvent[]) {
  return [...new Map(events.map((event) => [event.eventKey, event])).values()];
}

function mergeNeuralCalendarDailyStats(rows: NeuralCalendarDailyStat[]) {
  const byId = new Map<string, NeuralCalendarDailyStat>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (
      !existing ||
      stateEntityUpdatedAtMs(neuralCalendarDailyToRow(row)) >=
        stateEntityUpdatedAtMs(neuralCalendarDailyToRow(existing))
    ) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeNeuralCalendarHourlyStats(rows: NeuralCalendarHourlyStat[]) {
  const byId = new Map<string, NeuralCalendarHourlyStat>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (
      !existing ||
      stateEntityUpdatedAtMs(neuralCalendarHourlyToRow(row)) >=
        stateEntityUpdatedAtMs(neuralCalendarHourlyToRow(existing))
    ) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function mergeEngineCalendarAggregateStats(rows: EngineCalendarAggregateStat[]) {
  const byId = new Map<string, EngineCalendarAggregateStat>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    if (
      !existing ||
      stateEntityUpdatedAtMs(engineCalendarAggregateToRow(row)) >=
        stateEntityUpdatedAtMs(engineCalendarAggregateToRow(existing))
    ) {
      byId.set(row.id, row);
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function engineCalendarAggregateToRow(stat: EngineCalendarAggregateStat) {
  return {
    id: stat.id,
    engine_key: stat.engineKey,
    period_start: stat.periodStart,
    period_end: stat.periodEnd,
    date: stat.date,
    hour: stat.hour,
    week: stat.week,
    month: stat.month,
    year: stat.year,
    greens: stat.greens,
    reds: stat.reds,
    ties: stat.ties,
    total_signals: stat.totalSignals,
    accuracy: stat.accuracy,
    score: stat.score,
    classification: stat.classification,
    created_at: stat.createdAt,
    updated_at: stat.updatedAt,
  };
}

function engineCalendarSignalEventToRow(event: EngineCalendarSignalEvent) {
  return {
    id: event.id,
    event_key: event.eventKey,
    engine_key: event.engineKey,
    outcome: event.outcome,
    greens: event.greens,
    reds: event.reds,
    ties: event.ties,
    total_signals: event.totalSignals,
    occurred_at: event.occurredAt,
    date: event.date,
    hour: event.hour,
    week: event.week,
    month: event.month,
    year: event.year,
    source: event.source,
    payload_json: event.payload,
  };
}

function buildEngineNeuralCalendarPayload({
  year,
  month,
  selectedDate,
  range,
  engineMode,
  engineKeys,
}: {
  year: number;
  month: number;
  selectedDate: string;
  range: string;
  engineMode: CalendarEngineKey;
  engineKeys: CalendarEngineKey[];
}) {
  const now = saoPauloDateParts();
  const availableYears = [now.year - 1, now.year, now.year + 1];
  const monthHourlyAggregateRows = combineEngineCalendarRowsForPayload("hourly", engineKeys).filter(
    (row) => row.year === year && row.month === month,
  );
  const monthDailyRows = engineCalendarDailyRowsForDisplay(year, month, engineKeys, monthHourlyAggregateRows).map(
    engineAggregateToCalendarDailyStat,
  );
  const monthHourlyRows = monthHourlyAggregateRows.map(engineAggregateToCalendarHourlyStat);
  const monthAggregate =
    combineEngineCalendarRowsForPayload("monthly", engineKeys).find(
      (row) => row.year === year && row.month === month,
    ) || null;
  const dailyByDate = new Map(monthDailyRows.map((row) => [row.date, row]));
  const daysInMonth = calendarDaysInMonth(year, month);
  const monthDays = Array.from({ length: daysInMonth }, (_, index) => {
    const date = calendarDateString(year, month, index + 1);
    return dailyByDate.get(date) || emptyEngineCalendarDailyStat(date, engineKeys);
  });
  const fallbackSelectedDate =
    [...monthDays].filter((day) => day.classification !== "sem_amostra").sort((a, b) => b.date.localeCompare(a.date))[0]
      ?.date || (now.year === year && now.month === month ? now.date : calendarDateString(year, month, 1));
  const cleanSelectedDate =
    selectedDate && selectedDate.startsWith(`${year}-${String(month).padStart(2, "0")}`)
      ? selectedDate
      : fallbackSelectedDate;
  const selectedDay = dailyByDate.get(cleanSelectedDate) || emptyEngineCalendarDailyStat(cleanSelectedDate, engineKeys);
  const selectedHourlyRows = combineEngineCalendarRowsForPayload("hourly", engineKeys)
    .filter((row) => row.date === cleanSelectedDate)
    .map(engineAggregateToCalendarHourlyStat);
  const hourlyByHour = new Map(selectedHourlyRows.map((row) => [row.hour, row]));
  const selectedHours = Array.from({ length: 24 }, (_, hour) => {
    return hourlyByHour.get(hour) || emptyEngineCalendarHourlyStat(cleanSelectedDate, hour, engineKeys);
  });
  const sampledMonthDays = monthDays.filter((day) => day.classification !== "sem_amostra" && day.totalRounds > 0);
  const bestMonthDay =
    [...sampledMonthDays].sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)[0] || null;
  const topWeekdays = neuralCalendarWeekdayAverages(monthDays)
    .filter((item) => item.total > 0)
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 7);
  const topMonthDays = sampledMonthDays
    .map((day) => {
      const parts = calendarPartsFromDateString(day.date);
      return {
        date: day.date,
        label: `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`,
        score: day.score,
        totalRounds: day.totalRounds,
        classification: day.classification,
      };
    })
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);

  return {
    timezone: DASHBOARD_CYCLE_TIME_ZONE,
    startDate: engineCalendarStartDate(engineKeys),
    updatedAt: new Date().toISOString(),
    range,
    engineFilter: {
      mode: engineMode,
      selected: engineKeys,
      available: CALENDAR_SIGNAL_ENGINE_KEYS,
    },
    years: availableYears.length ? availableYears : neuralCalendarAvailableYears(now.year),
    selected: {
      year,
      month,
      date: cleanSelectedDate,
    },
    month: {
      year,
      month,
      label: neuralCalendarMonthLabel(year, month),
      days: monthDays,
      firstWeekday: calendarFirstWeekday(year, month),
      summary: engineCalendarMonthSummary(monthDays, monthHourlyRows, monthAggregate),
      distribution: neuralCalendarDistribution(monthDays),
      weekdayAverages: neuralCalendarWeekdayAverages(monthDays),
      heatmap: engineCalendarHeatmap(year, month, engineKeys),
    },
    selectedDay: decorateEngineCalendarDayWithHours(selectedDay, selectedHours),
    selectedHours,
    rankings: {
      topHours: engineCalendarTopHours(year, month, engineKeys),
      topWeekdays,
      topMonthDays,
      topEngines: engineCalendarTopEngines(year, month, engineKeys),
      bestHour: bestEngineHourOverall(engineKeys),
      bestDay: bestMonthDay || bestEngineDay(engineKeys),
      bestWeek: bestEngineWeek(engineKeys),
      bestMonth: bestEngineMonth(engineKeys),
      bestYear: bestEngineYear(engineKeys),
    },
  };
}

function combineEngineCalendarRowsForPayload(kind: EngineCalendarAggregateKind, engineKeys: CalendarEngineKey[]) {
  const selected = normalizeCalendarEngineSelection(engineKeys);
  const rows = combineEngineCalendarRowsForPayloadRaw(kind, selected);
  if (kind === "hourly") return filterConsistentEngineHourlyRows(rows, selected);
  if (kind === "daily") return filterConsistentEngineDailyRows(rows, selected);
  return rows;
}

function engineCalendarDailyRowsForDisplay(
  year: number,
  month: number,
  engineKeys: CalendarEngineKey[],
  hourlyRows: EngineCalendarAggregateStat[],
) {
  const storedRows = combineEngineCalendarRowsForPayload("daily", engineKeys).filter(
    (row) => row.year === year && row.month === month,
  );
  const derivedRows = deriveEngineDailyRowsFromHourly(hourlyRows, engineKeys);
  return mergeEngineCalendarDailyRowsForDisplay(storedRows, derivedRows);
}

function deriveEngineDailyRowsFromHourly(hourlyRows: EngineCalendarAggregateStat[], engineKeys: CalendarEngineKey[]) {
  const engineKey = engineKeys.length === 1 ? engineKeys[0] : DEFAULT_CALENDAR_ENGINE_KEY;
  const byDate = new Map<string, EngineCalendarAggregateStat>();

  for (const row of hourlyRows) {
    if (!row.date || row.totalSignals <= 0) continue;
    let daily = byDate.get(row.date);
    if (!daily) {
      const parts = calendarPartsFromDateString(row.date);
      const start = saoPauloLocalIso(row.date, 0);
      daily = {
        id: `engine:derived:daily:${engineKey}:${row.date}`,
        engineKey,
        periodKind: "daily",
        periodStart: start,
        periodEnd: addMillisecondsIso(start, 24 * 60 * 60 * 1000),
        date: row.date,
        hour: null,
        week: saoPauloWeekNumber(row.date),
        month: row.month || parts.month,
        year: row.year || parts.year,
        greens: 0,
        reds: 0,
        ties: 0,
        totalSignals: 0,
        accuracy: 0,
        score: 0,
        classification: "sem_amostra",
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
      byDate.set(row.date, daily);
    }

    daily.greens += row.greens;
    daily.reds += row.reds;
    daily.ties += row.ties;
    daily.totalSignals += row.totalSignals;
    if (new Date(row.createdAt).getTime() < new Date(daily.createdAt).getTime()) daily.createdAt = row.createdAt;
    if (new Date(row.updatedAt).getTime() > new Date(daily.updatedAt).getTime()) daily.updatedAt = row.updatedAt;
  }

  for (const daily of byDate.values()) recomputeEngineCalendarAggregate(daily);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function mergeEngineCalendarDailyRowsForDisplay(
  storedRows: EngineCalendarAggregateStat[],
  derivedRows: EngineCalendarAggregateStat[],
) {
  const byDate = new Map<string, EngineCalendarAggregateStat>();
  for (const row of derivedRows) byDate.set(row.date, row);
  for (const row of storedRows) {
    const derived = byDate.get(row.date);
    if (!derived || row.totalSignals > 0) byDate.set(row.date, row);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function combineEngineCalendarRowsForPayloadRaw(kind: EngineCalendarAggregateKind, selected: CalendarEngineKey[]) {
  return combineEngineCalendarAggregateRows(
    engineCalendarAggregateRows(kind).filter((row) => selected.includes(row.engineKey)),
  );
}

function filterConsistentEngineDailyRows(rows: EngineCalendarAggregateStat[], selected: CalendarEngineKey[]) {
  const monthlyByKey = new Map(
    combineEngineCalendarRowsForPayloadRaw("monthly", selected).map((row) => [
      `${row.year}-${String(row.month).padStart(2, "0")}`,
      row,
    ]),
  );
  const activeDaysByMonth = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    if (row.totalSignals > 0) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const dailyTotalsByMonth = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    acc[key] = (acc[key] || 0) + row.totalSignals;
    return acc;
  }, {});

  return rows.filter((row) => {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    const month = monthlyByKey.get(key);
    if (!month?.totalSignals || !row.totalSignals) return true;
    if ((dailyTotalsByMonth[key] || 0) > month.totalSignals) return true;
    if (row.totalSignals > month.totalSignals) return false;
    if ((activeDaysByMonth[key] || 0) > 1 && row.totalSignals >= month.totalSignals) return false;
    return true;
  });
}

function filterConsistentEngineHourlyRows(rows: EngineCalendarAggregateStat[], selected: CalendarEngineKey[]) {
  const dailyByDate = new Map(combineEngineCalendarRowsForPayloadRaw("daily", selected).map((row) => [row.date, row]));
  const monthlyByKey = new Map(
    combineEngineCalendarRowsForPayloadRaw("monthly", selected).map((row) => [
      `${row.year}-${String(row.month).padStart(2, "0")}`,
      row,
    ]),
  );
  const activeHoursByDate = rows.reduce<Record<string, number>>((acc, row) => {
    if (row.totalSignals > 0) acc[row.date] = (acc[row.date] || 0) + 1;
    return acc;
  }, {});
  const activeDaysByMonth = Array.from(dailyByDate.values()).reduce<Record<string, number>>((acc, row) => {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    if (row.totalSignals > 0) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const hourlyTotalsByDate = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.date] = (acc[row.date] || 0) + row.totalSignals;
    return acc;
  }, {});
  const hourlyTotalsByMonth = rows.reduce<Record<string, number>>((acc, row) => {
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    acc[key] = (acc[key] || 0) + row.totalSignals;
    return acc;
  }, {});

  return rows.filter((row) => {
    const day = dailyByDate.get(row.date);
    const monthKey = `${row.year}-${String(row.month).padStart(2, "0")}`;
    const month = monthlyByKey.get(monthKey);
    if (day?.totalSignals && (hourlyTotalsByDate[row.date] || 0) <= day.totalSignals) {
      if (row.totalSignals > day.totalSignals) return false;
      if ((activeHoursByDate[row.date] || 0) > 1 && row.totalSignals >= day.totalSignals) return false;
    }
    if (month?.totalSignals && (hourlyTotalsByMonth[monthKey] || 0) <= month.totalSignals) {
      if (row.totalSignals > month.totalSignals) return false;
      if ((activeDaysByMonth[monthKey] || 0) > 1 && row.totalSignals >= month.totalSignals) return false;
    }
    return true;
  });
}

function engineAggregateToCalendarDailyStat(row: EngineCalendarAggregateStat): NeuralCalendarDailyStat {
  const parts = calendarPartsFromDateString(row.date);
  return {
    id: `engine:${row.periodKind}:${row.date}`,
    date: row.date,
    year: row.year || parts.year,
    month: row.month || parts.month,
    day: parts.day,
    weekday: parts.weekday,
    totalRounds: row.totalSignals,
    greens: row.greens,
    reds: row.reds,
    ties: row.ties,
    bankerCount: 0,
    playerCount: 0,
    tieCount: row.ties,
    accuracy: row.accuracy,
    score: row.score,
    classification: row.classification,
    bestHour: "",
    worstHour: "",
    bestModule: calendarEngineLabel(row.engineKey),
    bestForce: "NONE",
    observation: engineCalendarObservation(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function engineAggregateToCalendarHourlyStat(row: EngineCalendarAggregateStat): NeuralCalendarHourlyStat {
  return {
    ...engineAggregateToCalendarDailyStat(row),
    id: `engine:hourly:${row.date}:${String(row.hour ?? 0).padStart(2, "0")}`,
    engineKey: row.engineKey,
    totalSignals: row.totalSignals,
    hour: Math.max(0, Math.min(23, Math.floor(Number(row.hour) || 0))),
    bankerPercent: 0,
    playerPercent: 0,
    tiePercent: row.totalSignals ? roundCalendarPercent((row.ties / row.totalSignals) * 100) : 0,
    bestReading: "Historico agregado por motor.",
  };
}

function emptyEngineCalendarDailyStat(date: string, engineKeys: CalendarEngineKey[]): NeuralCalendarDailyStat {
  const stat = emptyNeuralCalendarDailyStat(calendarPartsFromDateString(date));
  stat.bestModule = engineKeys.length === 1 ? calendarEngineLabel(engineKeys[0]) : "Todos os motores";
  stat.observation = "Sem amostra agregada para o filtro selecionado.";
  return stat;
}

function emptyEngineCalendarHourlyStat(
  date: string,
  hour: number,
  engineKeys: CalendarEngineKey[],
): NeuralCalendarHourlyStat {
  return {
    ...emptyEngineCalendarDailyStat(date, engineKeys),
    id: `engine:empty:${date}:${String(hour).padStart(2, "0")}`,
    engineKey: engineKeys[0] || DEFAULT_CALENDAR_ENGINE_KEY,
    totalSignals: 0,
    hour,
    bankerPercent: 0,
    playerPercent: 0,
    tiePercent: 0,
    bestReading: "Aguardando amostra agregada.",
  };
}

function engineCalendarHeatmap(year: number, month: number, engineKeys: CalendarEngineKey[]) {
  return combineEngineCalendarRowsForPayload("hourly", engineKeys)
    .filter((row) => row.year === year && row.month === month)
    .map((row) => ({
      date: row.date,
      day: calendarPartsFromDateString(row.date).day,
      hour: row.hour || 0,
      score: row.score,
      classification: row.classification,
      totalRounds: row.totalSignals,
    }));
}

function engineCalendarTopHours(year: number, month: number, engineKeys: CalendarEngineKey[]) {
  const byHour = new Map<number, EngineCalendarAggregateStat>();
  for (const row of combineEngineCalendarRowsForPayload("hourly", engineKeys).filter(
    (item) => item.year === year && item.month === month,
  )) {
    const hour = row.hour || 0;
    const current = byHour.get(hour);
    if (!current) {
      byHour.set(hour, { ...row });
      continue;
    }
    current.greens += row.greens;
    current.reds += row.reds;
    current.ties += row.ties;
    current.totalSignals = current.greens + current.reds + current.ties;
    recomputeEngineCalendarAggregate(current);
  }
  return [...byHour.values()]
    .filter((row) => row.totalSignals > 0)
    .map((row) => ({
      hour: row.hour || 0,
      label: `${String(row.hour || 0).padStart(2, "0")}:00`,
      score: row.score,
      totalRounds: row.totalSignals,
    }))
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

function engineCalendarTopWeekdays(year: number, month: number, engineKeys: CalendarEngineKey[]) {
  const byWeekday = new Map<string, EngineCalendarAggregateStat & { days: number }>();
  for (const row of combineEngineCalendarRowsForPayload("daily", engineKeys).filter(
    (item) => item.year === year && item.month === month,
  )) {
    const weekday = calendarPartsFromDateString(row.date).weekday;
    const current = byWeekday.get(weekday);
    if (!current) {
      byWeekday.set(weekday, { ...row, days: 1 });
      continue;
    }
    current.days += 1;
    current.greens += row.greens;
    current.reds += row.reds;
    current.ties += row.ties;
    current.totalSignals = current.greens + current.reds + current.ties;
    recomputeEngineCalendarAggregate(current);
  }
  return [...byWeekday.entries()]
    .map(([weekday, row]) => ({
      weekday,
      score: row.score,
      total: row.days,
      classification: row.classification,
    }))
    .sort((a, b) => b.score - a.score || b.total - a.total)
    .slice(0, 7);
}

function engineCalendarTopMonthDays(year: number, month: number, engineKeys: CalendarEngineKey[]) {
  return combineEngineCalendarRowsForPayload("daily", engineKeys)
    .filter((row) => row.year === year && row.month === month && row.classification !== "sem_amostra")
    .map((row) => {
      const parts = calendarPartsFromDateString(row.date);
      return {
        date: row.date,
        label: `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}`,
        score: row.score,
        totalRounds: row.totalSignals,
        classification: row.classification,
      };
    })
    .sort((a, b) => b.score - a.score || b.totalRounds - a.totalRounds)
    .slice(0, 8);
}

function engineCalendarTopEngines(year: number, month: number, engineKeys: CalendarEngineKey[]) {
  const selected = normalizeCalendarEngineSelection(engineKeys);
  return liveEngineMonthlyStats
    .filter((row) => selected.includes(row.engineKey) && row.year === year && row.month === month)
    .filter((row) => row.totalSignals > 0)
    .map((row) => ({
      engineKey: row.engineKey,
      label: calendarEngineLabel(row.engineKey),
      score: row.score,
      totalSignals: row.totalSignals,
      classification: row.classification,
    }))
    .sort((a, b) => b.score - a.score || b.totalSignals - a.totalSignals)
    .slice(0, 5);
}

function engineCalendarStartDate(engineKeys: CalendarEngineKey[]) {
  return (
    combineEngineCalendarRowsForPayload("daily", engineKeys)
      .map((row) => row.date)
      .sort()[0] || NEURAL_CALENDAR_START_DATE
  );
}

function engineCalendarObservation(row: EngineCalendarAggregateStat) {
  if (row.classification === "sem_amostra") return "Sem amostra agregada para o filtro selecionado.";
  if (row.classification === "muito_pagante") return "Periodo muito pagante neste filtro de motor.";
  if (row.classification === "operavel") return "Periodo operavel neste filtro de motor.";
  return "Periodo perigoso neste filtro de motor.";
}

function engineCalendarAggregateFromRow(
  row: Record<string, unknown>,
  periodKind: EngineCalendarAggregateKind,
): EngineCalendarAggregateStat | null {
  const engineKey = normalizeCalendarEngineKey(row.engine_key ?? row.engineKey);
  if (engineKey === DEFAULT_CALENDAR_ENGINE_KEY || engineKey === "personalizado") return null;
  const date = readString(row, "date");
  if (!isValidCalendarDateString(date)) return null;
  const parts = calendarPartsFromDateString(date);
  const safeHour =
    row.hour === null || row.hour === undefined ? null : Math.max(0, Math.min(23, Math.floor(Number(row.hour) || 0)));
  const fallbackOccurredAt = new Date(saoPauloLocalIso(date, periodKind === "hourly" ? (safeHour ?? 0) : 0));
  const fallbackPeriod = engineCalendarPeriod(periodKind, fallbackOccurredAt);
  const stat: EngineCalendarAggregateStat = {
    id: readString(row, "id") || `${engineKey}:${periodKind}:${date}`,
    engineKey,
    periodKind,
    periodStart: readString(row, "period_start") || readString(row, "periodStart") || fallbackPeriod.start,
    periodEnd: readString(row, "period_end") || readString(row, "periodEnd") || fallbackPeriod.end,
    date,
    hour: periodKind === "hourly" ? (safeHour ?? fallbackPeriod.hour) : null,
    week:
      row.week === null || row.week === undefined
        ? fallbackPeriod.week
        : Math.max(1, Math.floor(Number(row.week) || saoPauloWeekNumber(date))),
    month: Math.max(1, Math.min(12, Math.floor(Number(row.month) || parts.month))),
    year: Math.max(2000, Math.floor(Number(row.year) || parts.year)),
    greens: Math.max(0, Math.floor(Number(row.greens) || 0)),
    reds: Math.max(0, Math.floor(Number(row.reds) || 0)),
    ties: Math.max(0, Math.floor(Number(row.ties) || 0)),
    totalSignals: Math.max(0, Math.floor(Number(row.total_signals ?? row.totalSignals) || 0)),
    accuracy: roundCalendarPercent(Number(row.accuracy) || 0),
    score: roundCalendarPercent(Number(row.score) || 0),
    classification: normalizeNeuralCalendarClassification(row.classification),
    createdAt: readString(row, "created_at") || readString(row, "createdAt") || new Date().toISOString(),
    updatedAt: readString(row, "updated_at") || readString(row, "updatedAt") || new Date().toISOString(),
  };
  recomputeEngineCalendarAggregate(stat);
  return stat;
}

function neuralCalendarDailyToRow(stat: NeuralCalendarDailyStat) {
  return {
    id: stat.id,
    date: stat.date,
    year: stat.year,
    month: stat.month,
    day: stat.day,
    weekday: stat.weekday,
    total_rounds: stat.totalRounds,
    greens: stat.greens,
    reds: stat.reds,
    ties: stat.ties,
    banker_count: stat.bankerCount,
    player_count: stat.playerCount,
    tie_count: stat.tieCount,
    accuracy: stat.accuracy,
    score: stat.score,
    classification: stat.classification,
    best_hour: stat.bestHour,
    worst_hour: stat.worstHour,
    best_module: stat.bestModule,
    best_force: stat.bestForce,
    observation: stat.observation,
    created_at: stat.createdAt,
    updated_at: stat.updatedAt,
  };
}

function neuralCalendarHourlyToRow(stat: NeuralCalendarHourlyStat) {
  return {
    ...neuralCalendarDailyToRow(stat),
    engine_key: stat.engineKey || DEFAULT_CALENDAR_ENGINE_KEY,
    total_signals: stat.totalSignals ?? stat.totalRounds,
    hour: stat.hour,
    banker_percent: stat.bankerPercent,
    player_percent: stat.playerPercent,
    tie_percent: stat.tiePercent,
    best_reading: stat.bestReading,
  };
}

function neuralCalendarDailyFromRow(row: Record<string, unknown>): NeuralCalendarDailyStat | null {
  const date = readString(row, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parts = calendarPartsFromDateString(date);
  const stat = {
    ...emptyNeuralCalendarDailyStat(parts),
    id: readString(row, "id") || date,
    date,
    year: Math.floor(Number(row.year) || parts.year),
    month: Math.floor(Number(row.month) || parts.month),
    day: Math.floor(Number(row.day) || parts.day),
    weekday: readString(row, "weekday") || parts.weekday,
    totalRounds: Math.max(0, Math.floor(Number(row.total_rounds ?? row.totalRounds) || 0)),
    greens: Math.max(0, Math.floor(Number(row.greens) || 0)),
    reds: Math.max(0, Math.floor(Number(row.reds) || 0)),
    ties: Math.max(0, Math.floor(Number(row.ties) || 0)),
    bankerCount: Math.max(0, Math.floor(Number(row.banker_count ?? row.bankerCount) || 0)),
    playerCount: Math.max(0, Math.floor(Number(row.player_count ?? row.playerCount) || 0)),
    tieCount: Math.max(0, Math.floor(Number(row.tie_count ?? row.tieCount ?? row.ties) || 0)),
    accuracy: roundCalendarPercent(Number(row.accuracy) || 0),
    score: roundCalendarPercent(Number(row.score) || 0),
    classification: normalizeNeuralCalendarClassification(row.classification),
    bestHour: readString(row, "best_hour") || readString(row, "bestHour"),
    worstHour: readString(row, "worst_hour") || readString(row, "worstHour"),
    bestModule: normalizeNeuralCalendarModule(row.best_module ?? row.bestModule),
    bestForce: normalizeNeuralCalendarForce(row.best_force ?? row.bestForce),
    observation: readString(row, "observation"),
    createdAt: readString(row, "created_at") || readString(row, "createdAt") || new Date().toISOString(),
    updatedAt: readString(row, "updated_at") || readString(row, "updatedAt") || new Date().toISOString(),
  };
  recomputeNeuralCalendarStat(stat, NEURAL_CALENDAR_MIN_DAILY_SAMPLE);
  return stat;
}

function neuralCalendarHourlyFromRow(row: Record<string, unknown>): NeuralCalendarHourlyStat | null {
  const daily = neuralCalendarDailyFromRow(row);
  if (!daily) return null;
  const hour = Math.max(0, Math.min(23, Math.floor(Number(row.hour) || 0)));
  const engineKey = normalizeCalendarEngineKey(row.engine_key ?? row.engineKey);
  const totalSignals = Math.max(
    0,
    Math.floor(Number(row.total_signals ?? row.totalSignals ?? row.total_rounds ?? row.totalRounds) || 0),
  );
  const stat: NeuralCalendarHourlyStat = {
    ...daily,
    id: readString(row, "id") || `${daily.date}:${String(hour).padStart(2, "0")}`,
    engineKey,
    totalSignals,
    totalRounds: engineKey === DEFAULT_CALENDAR_ENGINE_KEY ? daily.totalRounds : totalSignals,
    greens: Math.max(0, Math.floor(Number(row.greens) || 0)),
    reds: Math.max(0, Math.floor(Number(row.reds) || 0)),
    ties: Math.max(0, Math.floor(Number(row.ties) || 0)),
    hour,
    bankerPercent: roundCalendarPercent(Number(row.banker_percent ?? row.bankerPercent) || 0),
    playerPercent: roundCalendarPercent(Number(row.player_percent ?? row.playerPercent) || 0),
    tiePercent: roundCalendarPercent(Number(row.tie_percent ?? row.tiePercent) || 0),
    bestReading: readString(row, "best_reading") || readString(row, "bestReading") || "Aguardando amostra real.",
  };
  if (engineKey === DEFAULT_CALENDAR_ENGINE_KEY) {
    recomputeNeuralCalendarStat(stat, NEURAL_CALENDAR_MIN_HOURLY_SAMPLE);
  } else {
    recomputeCalendarHourlySignalStat(stat);
  }
  return stat;
}

function pruneNeuralCalendarCountedKeys(keys: Record<string, true>) {
  const entries = Object.keys(keys).sort();
  if (entries.length <= MAX_NEURAL_CALENDAR_COUNTED_KEYS) return keys;
  return entries.slice(-MAX_NEURAL_CALENDAR_COUNTED_KEYS).reduce<Record<string, true>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

function pruneEngineCalendarBackfillKeys(keys: Record<string, true>) {
  const entries = Object.keys(keys).sort();
  if (entries.length <= MAX_ENGINE_CALENDAR_BACKFILL_KEYS) return keys;
  return entries.slice(-MAX_ENGINE_CALENDAR_BACKFILL_KEYS).reduce<Record<string, true>>((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

function neuralCalendarPartsForRound(round: Round): NeuralCalendarDateParts | null {
  const recordedAt = getRoundRecordedAt(round);
  if (recordedAt) {
    const recordedDate = new Date(recordedAt);
    if (Number.isFinite(recordedDate.getTime())) {
      const parts = saoPauloDateParts(recordedDate);
      const timeHour = roundHourFromTimeText(round.time);
      return timeHour === null ? parts : { ...parts, hour: timeHour };
    }
  }

  const raw = String(round.time || "").trim();
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const current = saoPauloDateParts();
    return {
      ...current,
      hour: Math.max(0, Math.min(23, Math.floor(Number(timeMatch[1]) || 0))),
    };
  }

  const date = parseRoundDate(round);
  if (!date || Number.isNaN(date.getTime())) return null;
  return saoPauloDateParts(date);
}

function normalizeRoundRecordedAt(item: Record<string, unknown>) {
  const direct =
    readString(item, "recordedAt") ||
    readString(item, "recorded_at") ||
    readString(item, "createdAt") ||
    readString(item, "created_at");
  if (direct && Number.isFinite(Date.parse(direct))) return new Date(direct).toISOString();

  const time = readString(item, "time") || readString(item, "round_time");
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(time)) {
    const now = new Date();
    const [hour, minute, second = "0"] = time.split(":");
    now.setHours(Number(hour), Number(minute), Number(second), 0);
    return now.toISOString();
  }

  return new Date().toISOString();
}

function getRoundRecordedAt(round: Round) {
  const record = round as unknown as Record<string, unknown>;
  const value =
    readString(record, "recordedAt") ||
    readString(record, "recorded_at") ||
    readString(record, "createdAt") ||
    readString(record, "created_at");
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : "";
}

function roundHourFromTimeText(value: unknown) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):\d{2}(?::\d{2})?$/);
  if (!match) return null;
  return Math.max(0, Math.min(23, Math.floor(Number(match[1]) || 0)));
}

function parseRoundDate(round: Round) {
  const raw = String(round.time || "").trim();
  if (!raw || raw === "--:--") return new Date();
  const direct = new Date(raw);
  if (Number.isFinite(direct.getTime())) return direct;
  const timeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    const now = new Date();
    now.setHours(Number(timeMatch[1]), Number(timeMatch[2]), Number(timeMatch[3] || 0), 0);
    return now;
  }
  return null;
}

function saoPauloDateParts(date = new Date()): NeuralCalendarDateParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_CYCLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  const year = Math.floor(Number(parts.year) || date.getFullYear());
  const month = Math.floor(Number(parts.month) || date.getMonth() + 1);
  const day = Math.floor(Number(parts.day) || date.getDate());
  return {
    date: calendarDateString(year, month, day),
    year,
    month,
    day,
    hour: Math.max(0, Math.min(23, Math.floor(Number(parts.hour) || 0))),
    weekday: normalizeCalendarWeekday(parts.weekday),
  };
}

function calendarPartsFromDateString(date: string): NeuralCalendarDateParts {
  const [year, month, day] = date.split("-").map((part) => Math.floor(Number(part) || 0));
  const safeYear = year || 2026;
  const safeMonth = Math.max(1, Math.min(12, month || 1));
  const safeDay = Math.max(1, Math.min(calendarDaysInMonth(safeYear, safeMonth), day || 1));
  const utcDate = new Date(Date.UTC(safeYear, safeMonth - 1, safeDay, 12));
  return {
    date: calendarDateString(safeYear, safeMonth, safeDay),
    year: safeYear,
    month: safeMonth,
    day: safeDay,
    hour: 0,
    weekday: normalizeCalendarWeekday(
      new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(utcDate),
    ),
  };
}

function calendarDateString(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeCalendarDateParam(value: string | null) {
  const text = String(value || "").trim();
  return isValidCalendarDateString(text) ? text : "";
}

function calendarDaysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidCalendarDateString(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Math.floor(Number(match[1]) || 0);
  const month = Math.floor(Number(match[2]) || 0);
  const day = Math.floor(Number(match[3]) || 0);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= calendarDaysInMonth(year, month) && calendarDateString(year, month, day) === value;
}

function calendarFirstWeekday(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

function clampCalendarYear(value: string | null, fallback: number) {
  const year = Math.floor(Number(value) || fallback);
  return Math.max(2026, Math.min(2100, year));
}

function clampCalendarMonth(value: string | null, fallback: number) {
  const month = Math.floor(Number(value) || fallback);
  return Math.max(1, Math.min(12, month));
}

function neuralCalendarAvailableYears(currentYear: number) {
  const years = new Set([2026, currentYear]);
  for (const stat of liveNeuralCalendarDailyStats) years.add(stat.year);
  return [...years].sort((a, b) => b - a);
}

function normalizeCalendarWeekday(value: unknown) {
  const text = String(value || "")
    .slice(0, 3)
    .toLowerCase();
  const map: Record<string, string> = {
    sun: "Domingo",
    mon: "Segunda",
    tue: "Terca",
    wed: "Quarta",
    thu: "Quinta",
    fri: "Sexta",
    sat: "Sabado",
    dom: "Domingo",
    seg: "Segunda",
    ter: "Terca",
    qua: "Quarta",
    qui: "Quinta",
    sex: "Sexta",
    sab: "Sabado",
  };
  return map[text] || "Segunda";
}

function calendarWeekdayOrder() {
  return ["Domingo", "Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado"];
}

function neuralCalendarMonthLabel(year: number, month: number) {
  const labels = [
    "Janeiro",
    "Fevereiro",
    "Marco",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${labels[month - 1] || "Mes"} ${year}`;
}

function roundCalendarPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round((Number(value) || 0) * 100) / 100));
}

function neuralCalendarForceLabel(force: NeuralCalendarForce) {
  if (force === "BANKER") return "Banker";
  if (force === "PLAYER") return "Player";
  if (force === "TIE") return "Tie";
  return "Sem leitura";
}

function normalizeNeuralCalendarClassification(value: unknown): NeuralCalendarClassification {
  const text = String(value || "").toLowerCase();
  if (text === "muito_pagante" || text === "operavel" || text === "perigoso" || text === "sem_amostra") {
    return text;
  }
  return "sem_amostra";
}

function normalizeNeuralCalendarForce(value: unknown): NeuralCalendarForce {
  const text = String(value || "").toUpperCase();
  if (text === "BANKER" || text === "PLAYER" || text === "TIE") return text;
  return "NONE";
}

function normalizeNeuralCalendarModule(value: unknown): NeuralCalendarModule {
  const text = String(value || "");
  if (text === "Neural Pagante" || text === "Surf Analyzer" || text === "Tendencia" || text === "Validador") {
    return text;
  }
  return "Tendencia";
}

function normalizeCalendarEngineKey(value: unknown): CalendarEngineKey {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return CALENDAR_ENGINE_KEYS.includes(text as CalendarEngineKey)
    ? (text as CalendarEngineKey)
    : DEFAULT_CALENDAR_ENGINE_KEY;
}

function emptyEngineCalendarAggregateChangeSet(): EngineCalendarAggregateChangeSet {
  return {
    changed: false,
    hourlyIds: new Set(),
    dailyIds: new Set(),
    weeklyIds: new Set(),
    monthlyIds: new Set(),
    yearlyIds: new Set(),
    events: [],
  };
}

function trackEngineCalendarAggregates(previous: DashboardData, next: DashboardData, occurredAt = new Date()) {
  const change = emptyEngineCalendarAggregateChangeSet();
  const previousCounters = readEngineCalendarCounterSnapshots(previous);
  const nextCounters = readEngineCalendarCounterSnapshots(next);

  for (const engineKey of CALENDAR_SIGNAL_ENGINE_KEYS) {
    const delta = diffEngineCalendarCounters(previousCounters[engineKey], nextCounters[engineKey]);
    if (!delta.greens && !delta.reds && !delta.ties) continue;
    mergeEngineCalendarAggregateChange(
      change,
      incrementEngineCalendarAggregates(engineKey, delta, occurredAt, "dashboard_delta"),
    );
  }

  return change;
}

function readEngineCalendarCounterSnapshots(
  data: unknown,
): Partial<Record<CalendarEngineKey, CalendarEngineCounterSnapshot>> {
  const root = readRecord(data);
  const mainScoreboard = readRecord(root.mainScoreboard);
  const neuralScoreboard = readRecord(root.neuralScoreboard);
  const neuralReading = readRecord(root.neuralReading);
  const surfScoreboard = readRecord(root.surfAnalyzerScoreboard);
  const tieScoreboard = readRecord(root.tieAlertScoreboard);
  const patternMiner = readRecord(root.patternMinerSnapshot || root.patternMiner);
  const patternScoreboard = readRecord(patternMiner.scoreboard);
  const patternCounters = patternMinerCalendarCounters(patternMiner, patternScoreboard);

  return {
    tendencia: {
      greens:
        firstCalendarNumber(mainScoreboard, ["totalGreens", "greens"]) ||
        firstCalendarNumber(mainScoreboard, ["greenSemGale", "sg"]) +
          firstCalendarNumber(mainScoreboard, ["greensG1", "greenG1"]),
      reds: firstCalendarNumber(mainScoreboard, ["reds"]),
      ties: firstCalendarNumber(mainScoreboard, ["ties", "emp"]),
    },
    neural_pagante: {
      greens:
        firstCalendarNumber(neuralScoreboard, ["greens", "acertos"]) ||
        firstCalendarNumber(neuralScoreboard, ["greenSemGale", "sg"]) +
          firstCalendarNumber(neuralScoreboard, ["greenG1"]) ||
        firstCalendarNumber(neuralReading, ["acertos"]),
      reds:
        firstCalendarNumber(neuralScoreboard, ["reds", "erros"]) ||
        firstCalendarNumber(neuralReading, ["reds", "erros"]),
      ties: firstCalendarNumber(neuralScoreboard, ["ties", "emp"]),
    },
    surf_analyzer: {
      greens:
        firstCalendarNumber(surfScoreboard, ["hits", "greens"]) ||
        firstCalendarNumber(surfScoreboard, ["greenSemGale", "sg"]) + firstCalendarNumber(surfScoreboard, ["greenG1"]),
      reds:
        firstCalendarNumber(surfScoreboard, ["reds"]) ||
        firstCalendarNumber(surfScoreboard, ["fails"]) + firstCalendarNumber(surfScoreboard, ["expired"]),
      ties: firstCalendarNumber(surfScoreboard, ["ties", "emp"]),
    },
    radar_empates: {
      greens: firstCalendarNumber(tieScoreboard, ["greenTieAlerts", "greens", "ties"]),
      reds: firstCalendarNumber(tieScoreboard, ["expired", "reds"]),
      ties: 0,
    },
    padroes_quentes_ia: patternCounters,
  };
}

function patternMinerCalendarCounters(
  patternMiner: Record<string, unknown>,
  patternScoreboard: Record<string, unknown>,
): CalendarEngineCounterSnapshot {
  const scoreboardCounters = {
    greens:
      firstCalendarNumber(patternScoreboard, ["greens", "totalGreens", "acertos", "wins"]) ||
      firstCalendarNumber(patternScoreboard, ["sg", "greenSemGale"]) +
        firstCalendarNumber(patternScoreboard, ["g1", "greenG1"]),
    reds: firstCalendarNumber(patternScoreboard, ["red", "reds", "erros", "losses"]),
    ties: firstCalendarNumber(patternScoreboard, ["tie", "ties", "empates"]),
  };
  if (scoreboardCounters.greens || scoreboardCounters.reds || scoreboardCounters.ties) {
    return scoreboardCounters;
  }

  const strategies = [
    ...(Array.isArray(patternMiner.hotStrategies) ? patternMiner.hotStrategies : []),
    ...(Array.isArray(patternMiner.ranking) ? patternMiner.ranking : []),
    ...(Array.isArray(patternMiner.strategies) ? patternMiner.strategies : []),
  ].map(readRecord);
  const unique = new Map<string, Record<string, unknown>>();
  for (const strategy of strategies) {
    const key = readString(strategy, "id") || readString(strategy, "sequence") || JSON.stringify(strategy);
    if (key && !unique.has(key)) unique.set(key, strategy);
  }

  return [...unique.values()].reduce<CalendarEngineCounterSnapshot>(
    (acc, strategy) => {
      acc.greens +=
        firstCalendarNumber(strategy, ["greens", "totalGreens", "acertos"]) ||
        firstCalendarNumber(strategy, ["sg"]) + firstCalendarNumber(strategy, ["g1"]);
      acc.reds += firstCalendarNumber(strategy, ["red", "reds", "erros"]);
      acc.ties += firstCalendarNumber(strategy, ["tie", "ties", "empates"]);
      return acc;
    },
    { greens: 0, reds: 0, ties: 0 },
  );
}

function firstCalendarNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return Math.max(0, Math.floor(value));
  }
  return 0;
}

function diffEngineCalendarCounters(
  previous: CalendarEngineCounterSnapshot | undefined,
  next: CalendarEngineCounterSnapshot | undefined,
): CalendarEngineCounterSnapshot {
  return {
    greens: diffCalendarCounter(previous?.greens, next?.greens),
    reds: diffCalendarCounter(previous?.reds, next?.reds),
    ties: diffCalendarCounter(previous?.ties, next?.ties),
  };
}

function diffCalendarCounter(previous = 0, next = 0) {
  const cleanPrevious = Math.max(0, Math.floor(Number(previous) || 0));
  const cleanNext = Math.max(0, Math.floor(Number(next) || 0));
  if (cleanNext > cleanPrevious) return cleanNext - cleanPrevious;
  if (cleanNext < cleanPrevious) return cleanNext;
  return 0;
}

function incrementEngineCalendarAggregates(
  engineKey: CalendarSignalEngineKey,
  counters: CalendarEngineCounterSnapshot,
  occurredAt = new Date(),
  source = "dashboard_delta",
  eventKey = "",
) {
  const change = emptyEngineCalendarAggregateChangeSet();
  if (!counters.greens && !counters.reds && !counters.ties) return change;

  for (const kind of ["hourly", "daily", "weekly", "monthly", "yearly"] as const) {
    const stat = upsertEngineCalendarAggregate(kind, engineKey, counters, occurredAt);
    change.changed = true;
    if (kind === "hourly") change.hourlyIds.add(stat.id);
    if (kind === "daily") change.dailyIds.add(stat.id);
    if (kind === "weekly") change.weeklyIds.add(stat.id);
    if (kind === "monthly") change.monthlyIds.add(stat.id);
    if (kind === "yearly") change.yearlyIds.add(stat.id);
  }
  const event = createEngineCalendarSignalEvent(engineKey, counters, occurredAt, source, eventKey);
  if (event) change.events.push(event);

  return change;
}

function createEngineCalendarSignalEvent(
  engineKey: CalendarSignalEngineKey,
  counters: CalendarEngineCounterSnapshot,
  occurredAt: Date,
  source: string,
  eventKey = "",
): EngineCalendarSignalEvent | null {
  const normalized = normalizeCalendarCounterSnapshot(counters);
  const totalSignals = calendarCountersTotal(normalized);
  if (!totalSignals) return null;

  const parts = saoPauloDateParts(occurredAt);
  const outcome: CalendarHourlyOutcome =
    normalized.reds > 0 ? "red" : normalized.ties > 0 && normalized.greens === 0 ? "tie" : "green";
  const safeKey =
    eventKey ||
    `${source}:${engineKey}:${occurredAt.toISOString()}:${normalized.greens}:${normalized.reds}:${normalized.ties}`;
  const id = `${engineKey}:${safeBackfillKey(safeKey)}:${safeBackfillKey(randomCalendarEventSuffix())}`;

  return {
    id: id.slice(0, 240),
    eventKey: safeKey.slice(0, 240),
    engineKey,
    outcome,
    greens: normalized.greens,
    reds: normalized.reds,
    ties: normalized.ties,
    totalSignals,
    occurredAt: occurredAt.toISOString(),
    date: parts.date,
    hour: parts.hour,
    week: saoPauloWeekNumber(parts.date),
    month: parts.month,
    year: parts.year,
    source,
    payload: {
      counters: normalized,
      aggregateVersion: NEURAL_CALENDAR_AGGREGATE_VERSION,
    },
  };
}

function randomCalendarEventSuffix() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function upsertEngineCalendarAggregate(
  kind: EngineCalendarAggregateKind,
  engineKey: CalendarEngineKey,
  counters: CalendarEngineCounterSnapshot,
  occurredAt: Date,
) {
  const stat =
    findEngineCalendarAggregate(kind, engineKey, occurredAt) ||
    emptyEngineCalendarAggregateStat(kind, engineKey, occurredAt);
  stat.greens += counters.greens;
  stat.reds += counters.reds;
  stat.ties += counters.ties;
  stat.totalSignals = stat.greens + stat.reds + stat.ties;
  recomputeEngineCalendarAggregate(stat);
  writeEngineCalendarAggregate(kind, stat);
  return stat;
}

function findEngineCalendarAggregate(
  kind: EngineCalendarAggregateKind,
  engineKey: CalendarEngineKey,
  occurredAt: Date,
) {
  const id = engineCalendarAggregateId(kind, engineKey, occurredAt);
  return engineCalendarAggregateRows(kind).find((row) => row.id === id) || null;
}

function emptyEngineCalendarAggregateStat(
  kind: EngineCalendarAggregateKind,
  engineKey: CalendarEngineKey,
  occurredAt: Date,
): EngineCalendarAggregateStat {
  const now = new Date().toISOString();
  const period = engineCalendarPeriod(kind, occurredAt);
  return {
    id: engineCalendarAggregateId(kind, engineKey, occurredAt),
    engineKey,
    periodKind: kind,
    periodStart: period.start,
    periodEnd: period.end,
    date: period.date,
    hour: period.hour,
    week: period.week,
    month: period.month,
    year: period.year,
    greens: 0,
    reds: 0,
    ties: 0,
    totalSignals: 0,
    accuracy: 0,
    score: 0,
    classification: "sem_amostra",
    createdAt: now,
    updatedAt: now,
  };
}

function recomputeEngineCalendarAggregate(stat: EngineCalendarAggregateStat) {
  const validated = stat.greens + stat.reds;
  stat.accuracy = validated ? roundCalendarPercent((stat.greens / validated) * 100) : 0;
  stat.score = stat.accuracy;
  stat.classification = classifyNeuralCalendarScore(stat.score, validated, 1);
  stat.totalSignals = stat.greens + stat.reds + stat.ties;
  stat.updatedAt = new Date().toISOString();
}

function recomputeCalendarHourlySignalStat(stat: NeuralCalendarHourlyStat) {
  stat.totalSignals = stat.greens + stat.reds + stat.ties;
  stat.totalRounds = stat.totalSignals;
  const validated = stat.greens + stat.reds;
  stat.accuracy = validated ? roundCalendarPercent((stat.greens / validated) * 100) : 0;
  stat.score = stat.accuracy;
  stat.classification = classifyNeuralCalendarScore(stat.score, validated, 1);
  stat.updatedAt = new Date().toISOString();
}

function mergeEngineCalendarAggregateChange(
  target: EngineCalendarAggregateChangeSet,
  source: EngineCalendarAggregateChangeSet,
) {
  if (!source.changed) return target;
  target.changed = true;
  source.hourlyIds.forEach((id) => target.hourlyIds.add(id));
  source.dailyIds.forEach((id) => target.dailyIds.add(id));
  source.weeklyIds.forEach((id) => target.weeklyIds.add(id));
  source.monthlyIds.forEach((id) => target.monthlyIds.add(id));
  source.yearlyIds.forEach((id) => target.yearlyIds.add(id));
  target.events.push(...source.events);
  return target;
}

function engineCalendarAggregateRows(kind: EngineCalendarAggregateKind) {
  if (kind === "hourly") return liveEngineHourlyStats;
  if (kind === "daily") return liveEngineDailyStats;
  if (kind === "weekly") return liveEngineWeeklyStats;
  if (kind === "monthly") return liveEngineMonthlyStats;
  return liveEngineYearlyStats;
}

function engineCalendarAggregateTable(kind: EngineCalendarAggregateKind) {
  if (kind === "hourly") return ENGINE_HOURLY_STATS_TABLE;
  if (kind === "daily") return ENGINE_DAILY_STATS_TABLE;
  if (kind === "weekly") return ENGINE_WEEKLY_STATS_TABLE;
  if (kind === "monthly") return ENGINE_MONTHLY_STATS_TABLE;
  return ENGINE_YEARLY_STATS_TABLE;
}

function writeEngineCalendarAggregate(kind: EngineCalendarAggregateKind, stat: EngineCalendarAggregateStat) {
  const rows = mergeEngineCalendarAggregateStats([...engineCalendarAggregateRows(kind), stat]);
  if (kind === "hourly") liveEngineHourlyStats = rows;
  if (kind === "daily") liveEngineDailyStats = rows;
  if (kind === "weekly") liveEngineWeeklyStats = rows;
  if (kind === "monthly") liveEngineMonthlyStats = rows;
  if (kind === "yearly") liveEngineYearlyStats = rows;
}

function engineCalendarAggregateId(kind: EngineCalendarAggregateKind, engineKey: CalendarEngineKey, occurredAt: Date) {
  const period = engineCalendarPeriod(kind, occurredAt);
  if (kind === "hourly") return `${engineKey}:${kind}:${period.date}:${String(period.hour ?? 0).padStart(2, "0")}`;
  if (kind === "daily") return `${engineKey}:${kind}:${period.date}`;
  if (kind === "weekly") return `${engineKey}:${kind}:${period.year}:W${String(period.week ?? 0).padStart(2, "0")}`;
  if (kind === "monthly") return `${engineKey}:${kind}:${period.year}-${String(period.month).padStart(2, "0")}`;
  return `${engineKey}:${kind}:${period.year}`;
}

function engineCalendarPeriod(kind: EngineCalendarAggregateKind, occurredAt: Date) {
  const parts = saoPauloDateParts(occurredAt);
  const week = saoPauloWeekNumber(parts.date);

  if (kind === "hourly") {
    const start = saoPauloLocalIso(parts.date, parts.hour);
    return {
      start,
      end: addMillisecondsIso(start, 60 * 60 * 1000),
      date: parts.date,
      hour: parts.hour,
      week,
      month: parts.month,
      year: parts.year,
    };
  }

  if (kind === "daily") {
    const start = saoPauloLocalIso(parts.date, 0);
    return {
      start,
      end: addMillisecondsIso(start, 24 * 60 * 60 * 1000),
      date: parts.date,
      hour: null,
      week,
      month: parts.month,
      year: parts.year,
    };
  }

  if (kind === "weekly") {
    const weekDate = saoPauloWeekStartDate(parts.date);
    const start = saoPauloLocalIso(weekDate, 0);
    const weekParts = calendarPartsFromDateString(weekDate);
    return {
      start,
      end: addMillisecondsIso(start, 7 * 24 * 60 * 60 * 1000),
      date: weekDate,
      hour: null,
      week: saoPauloWeekNumber(weekDate),
      month: weekParts.month,
      year: weekParts.year,
    };
  }

  if (kind === "monthly") {
    const date = `${parts.year}-${String(parts.month).padStart(2, "0")}-01`;
    const start = saoPauloLocalIso(date, 0);
    const nextMonth = parts.month === 12 ? 1 : parts.month + 1;
    const nextYear = parts.month === 12 ? parts.year + 1 : parts.year;
    const end = saoPauloLocalIso(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01`, 0);
    return {
      start,
      end,
      date,
      hour: null,
      week: saoPauloWeekNumber(date),
      month: parts.month,
      year: parts.year,
    };
  }

  const date = `${parts.year}-01-01`;
  return {
    start: saoPauloLocalIso(date, 0),
    end: saoPauloLocalIso(`${parts.year + 1}-01-01`, 0),
    date,
    hour: null,
    week: saoPauloWeekNumber(date),
    month: 1,
    year: parts.year,
  };
}

function saoPauloLocalIso(date: string, hour: number) {
  const safeHour = Math.max(0, Math.min(23, Math.floor(Number(hour) || 0)));
  return new Date(`${date}T${String(safeHour).padStart(2, "0")}:00:00-03:00`).toISOString();
}

function addMillisecondsIso(iso: string, milliseconds: number) {
  return new Date(new Date(iso).getTime() + milliseconds).toISOString();
}

function saoPauloWeekStartDate(date: string) {
  const local = new Date(`${date}T00:00:00-03:00`);
  const day = local.getUTCDay();
  const offset = day;
  local.setUTCDate(local.getUTCDate() - offset);
  return local.toISOString().slice(0, 10);
}

function saoPauloWeekNumber(date: string) {
  const parts = calendarPartsFromDateString(date);
  const currentStart = new Date(`${saoPauloWeekStartDate(date)}T00:00:00-03:00`).getTime();
  const yearStart = new Date(`${saoPauloWeekStartDate(`${parts.year}-01-01`)}T00:00:00-03:00`).getTime();
  return Math.max(1, Math.floor((currentStart - yearStart) / (7 * 24 * 60 * 60 * 1000)) + 1);
}

function bestEngineHourOfDay(date: string, engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("hourly", { date, engineKeys, limit: 1 })[0] || null;
}

function bestEngineHourOfWeek(year: number, week: number, engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("hourly", { year, week, engineKeys, limit: 1 })[0] || null;
}

function bestEngineHourOfMonth(year: number, month: number, engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("hourly", { year, month, engineKeys, limit: 1 })[0] || null;
}

function bestEngineHourOfYear(year: number, engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("hourly", { year, engineKeys, limit: 1 })[0] || null;
}

function bestEngineHourOverall(engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("hourly", { engineKeys, limit: 1 })[0] || null;
}

function bestEngineDay(engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("daily", { engineKeys, limit: 1 })[0] || null;
}

function bestEngineWeek(engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("weekly", { engineKeys, limit: 1 })[0] || null;
}

function bestEngineMonth(engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("monthly", { engineKeys, limit: 1 })[0] || null;
}

function bestEngineYear(engineKeys: CalendarEngineKey[] | "todos" = "todos") {
  return queryBestEngineCalendarStats("yearly", { engineKeys, limit: 1 })[0] || null;
}

function queryBestEngineCalendarStats(
  kind: EngineCalendarAggregateKind,
  options: {
    engineKeys?: CalendarEngineKey[] | "todos";
    date?: string;
    year?: number;
    month?: number;
    week?: number;
    limit?: number;
  } = {},
) {
  const engines = normalizeCalendarEngineSelection(options.engineKeys);
  const rows = engineCalendarAggregateRows(kind).filter((row) => {
    if (!engines.includes(row.engineKey)) return false;
    if (options.date && row.date !== options.date) return false;
    if (options.year && row.year !== options.year) return false;
    if (options.month && row.month !== options.month) return false;
    if (options.week && row.week !== options.week) return false;
    return true;
  });

  return combineEngineCalendarAggregateRows(rows)
    .filter((row) => row.totalSignals > 0)
    .sort((a, b) => b.score - a.score || b.totalSignals - a.totalSignals)
    .slice(0, Math.max(1, Math.floor(Number(options.limit) || 1)));
}

function combineEngineCalendarAggregateRows(rows: EngineCalendarAggregateStat[]) {
  const byPeriod = new Map<string, EngineCalendarAggregateStat>();
  for (const row of rows) {
    const key = `${row.periodKind}:${row.periodStart}:${row.hour ?? "all"}`;
    const current = byPeriod.get(key);
    if (!current) {
      byPeriod.set(key, { ...row });
      continue;
    }
    current.greens += row.greens;
    current.reds += row.reds;
    current.ties += row.ties;
    current.totalSignals = current.greens + current.reds + current.ties;
    recomputeEngineCalendarAggregate(current);
  }
  return [...byPeriod.values()];
}

function normalizeCalendarEngineSelection(value: CalendarEngineKey[] | "todos" | undefined) {
  if (!value || value === "todos") return [...CALENDAR_SIGNAL_ENGINE_KEYS];
  const selected = value
    .map(normalizeCalendarEngineKey)
    .filter(
      (engine): engine is CalendarSignalEngineKey =>
        engine !== DEFAULT_CALENDAR_ENGINE_KEY && engine !== "personalizado",
    );
  return selected.length ? Array.from(new Set(selected)) : [...CALENDAR_SIGNAL_ENGINE_KEYS];
}

function calendarEngineSelectionFromUrl(url: URL) {
  const rawMode = readString({ engine: url.searchParams.get("engine") }, "engine") || DEFAULT_CALENDAR_ENGINE_KEY;
  const mode = normalizeCalendarEngineKey(rawMode);
  const enginesParam = readString({ engines: url.searchParams.get("engines") }, "engines");
  const customEngines = enginesParam
    .split(",")
    .map((item) => normalizeCalendarEngineKey(item))
    .filter(
      (engine): engine is CalendarEngineKey => engine !== DEFAULT_CALENDAR_ENGINE_KEY && engine !== "personalizado",
    );

  if (mode === "personalizado") {
    return {
      mode,
      engineKeys: customEngines.length ? Array.from(new Set(customEngines)) : [...CALENDAR_SIGNAL_ENGINE_KEYS],
    };
  }

  if (mode !== DEFAULT_CALENDAR_ENGINE_KEY) {
    return {
      mode,
      engineKeys: [mode],
    };
  }

  return {
    mode: DEFAULT_CALENDAR_ENGINE_KEY,
    engineKeys: [...CALENDAR_SIGNAL_ENGINE_KEYS],
  };
}

function calendarEngineLabel(engineKey: CalendarEngineKey) {
  if (engineKey === "neural_pagante") return "Neural Pagante";
  if (engineKey === "padroes_quentes_ia") return "Padroes IA";
  if (engineKey === "surf_analyzer") return "Surf Analyzer";
  if (engineKey === "radar_empates") return "Radar de Empates";
  if (engineKey === "tendencia") return "Tendencia";
  if (engineKey === "personalizado") return "Personalizado";
  return "Todos os motores";
}

async function handleValidatorValidationRequest(request: Request, url: URL, env: unknown) {
  if (url.pathname !== "/validator/validate") return null;
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  const userId = await validatorRequestUserId(request, url, env);
  if (!userId) return json({ error: "Nao autorizado." }, 401);

  const body = readRecord(await request.json().catch(() => ({})));
  const pattern = normalizeServerPatternTokens(body.pattern);
  if (!pattern.length) return json({ error: "Padrao invalido." }, 400);

  const tableId = validatorTableId(readString(body, "tableId"));
  const historySize = clampRoundHistoryLimit(String(body.historySize || ""));
  const storedRounds = await withTimeout(
    fetchStoredValidatorRounds(env, historySize, tableId),
    LIVE_STATE_IO_TIMEOUT_MS,
    "validar estrategia no backend",
    [] as Round[],
  );
  const rounds = mergeRoundHistoryWithLimit(storedRounds, liveValidatorRoundHistory, historySize);
  const result = serverValidatorEngine.validatePattern(rounds, pattern, {
    tableId,
    entryType: normalizeValidatorEntryType(body.entryType),
    galeLimit: normalizeValidatorGaleLimit(body.galeLimit),
    tieProtection: readBooleanField(body, "tieProtection"),
    historySize,
  });

  return json({
    result: summarizeValidatorResultForResponse(result),
    history: {
      requested: historySize,
      available: rounds.length,
      tableId,
    },
  });
}

function summarizeValidatorResultForResponse(result: ValidatorResult): ValidatorResult {
  return {
    ...result,
    details: result.details.slice(-MAX_VALIDATOR_DETAIL_RESPONSE),
  };
}

function isDefaultCalendarHourlyStat(row: NeuralCalendarHourlyStat) {
  return !row.engineKey || row.engineKey === DEFAULT_CALENDAR_ENGINE_KEY;
}

async function handleBankrollRequest(request: Request, url: URL, env: unknown) {
  if (url.pathname !== "/bankroll/month") return null;
  if (request.method === "OPTIONS") return json(null, 204);

  const userId = await bankrollRequestUserId(request, url, env);
  if (!userId) return json({ error: "Nao autorizado." }, 401);

  if (request.method === "GET") {
    const month = clampBankrollMonth(url.searchParams.get("month"));
    const year = clampBankrollYear(url.searchParams.get("year"));
    if (!month || !year) return json({ error: "Periodo invalido." }, 400);
    const row = await loadBankrollMonthRow(env, userId, month, year);
    return json({ month: row ? publicBankrollMonth(row, userId, month, year) : null });
  }

  if (request.method === "POST" || request.method === "PUT") {
    const body = readRecord(await request.json().catch(() => ({})));
    const normalized = normalizeBankrollMonthPayload(body, userId);
    if (!normalized) return json({ error: "Dados invalidos." }, 400);
    const existing = await loadBankrollMonthRow(env, userId, normalized.month, normalized.year);
    const now = new Date().toISOString();
    const row = bankrollMonthToRow(normalized, userId, readString(existing, "created_at") || now, now);
    const saved = await persistSupabaseRow(env, BANKROLL_MONTHLY_TABLE, row, "id");
    if (!saved) return json({ error: "Nao foi possivel salvar a banca no banco." }, 500);
    return json({ ok: true, month: publicBankrollMonth(row, userId, normalized.month, normalized.year) });
  }

  return json({ error: "Metodo nao permitido." }, 405);
}

async function bankrollRequestUserId(request: Request, url: URL, env: unknown) {
  const token = getBearerToken(request);
  const session = token ? await verifySessionToken(env, token) : null;
  if (session) {
    const bindingOk = await sessionMatchesRequestBinding(env, request, session);
    if (bindingOk && (session.scope === "client" || session.scope === "owner" || session.scope === "admin_approver")) {
      return normalizeBankrollUserId(session.email);
    }
  }

  if ((await isDashboardAuthorized(request, url, env)) && isLocalDevelopmentRequest(request)) {
    return normalizeBankrollUserId(request.headers.get("x-bankroll-user-id") || "local-user");
  }

  return "";
}

function normalizeBankrollUserId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function bankrollMonthId(userId: string, month: number, year: number) {
  return userId + ":" + year + ":" + String(month).padStart(2, "0");
}

function clampBankrollMonth(value: unknown) {
  const month = Math.floor(Number(value));
  return month >= 1 && month <= 12 ? month : 0;
}

function clampBankrollYear(value: unknown) {
  const year = Math.floor(Number(value));
  return year >= 2000 && year <= 2100 ? year : 0;
}

async function loadBankrollMonthRow(env: unknown, userId: string, month: number, year: number) {
  const id = bankrollMonthId(userId, month, year);
  const rows = await fetchSupabaseRows(
    env,
    BANKROLL_MONTHLY_TABLE,
    "select=*&id=eq." + encodeURIComponent(id) + "&limit=1",
  );
  return rows[0] || null;
}

type ServerBankrollMonth = {
  month: number;
  year: number;
  startingBankroll: number;
  monthlyGoal: number;
  dailyStopWin: number;
  dailyStopLoss: number;
  days: Record<string, unknown>[];
};

function normalizeBankrollMonthPayload(value: unknown, userId: string): ServerBankrollMonth | null {
  const record = readRecord(value);
  const month = clampBankrollMonth(record.month);
  const year = clampBankrollYear(record.year);
  if (!userId || !month || !year) return null;
  const totalDays = new Date(year, month, 0).getDate();
  const days = Array.isArray(record.days)
    ? (record.days
        .map(readRecord)
        .map((day) => normalizeBankrollDay(day, totalDays))
        .filter(Boolean) as Record<string, unknown>[])
    : [];
  return {
    month,
    year,
    startingBankroll: finiteBankrollNumber(record.startingBankroll),
    monthlyGoal: finiteBankrollNumber(record.monthlyGoal),
    dailyStopWin: finiteBankrollNumber(record.dailyStopWin),
    dailyStopLoss: finiteBankrollNumber(record.dailyStopLoss),
    days,
  };
}

function normalizeBankrollDay(day: Record<string, unknown>, totalDays: number) {
  const dayNumber = Math.floor(Number(day.day));
  if (dayNumber < 1 || dayNumber > totalDays) return null;
  return {
    day: dayNumber,
    entriesCount: Math.max(0, Math.floor(Number(day.entriesCount) || 0)),
    greens: Math.max(0, Math.floor(Number(day.greens) || 0)),
    reds: Math.max(0, Math.floor(Number(day.reds) || 0)),
    ties: Math.max(0, Math.floor(Number(day.ties) || 0)),
    deposits: finiteBankrollNumber(day.deposits),
    withdrawals: finiteBankrollNumber(day.withdrawals),
    dailyResult: finiteBankrollNumber(day.dailyResult),
    notes: readString(day, "notes").slice(0, 600),
  };
}

function finiteBankrollNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round(number * 100) / 100;
}

function bankrollMonthToRow(month: ServerBankrollMonth, userId: string, createdAt: string, updatedAt: string) {
  return {
    id: bankrollMonthId(userId, month.month, month.year),
    user_id: userId,
    month: month.month,
    year: month.year,
    starting_bankroll: month.startingBankroll,
    monthly_goal: month.monthlyGoal,
    daily_stop_win: month.dailyStopWin,
    daily_stop_loss: month.dailyStopLoss,
    days_json: month.days,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function publicBankrollMonth(
  row: Record<string, unknown>,
  userId: string,
  fallbackMonth: number,
  fallbackYear: number,
) {
  const month = clampBankrollMonth(row.month) || fallbackMonth;
  const year = clampBankrollYear(row.year) || fallbackYear;
  const daysJson = row.days_json;
  return {
    id: readString(row, "id") || bankrollMonthId(userId, month, year),
    userId,
    month,
    year,
    startingBankroll: finiteBankrollNumber(row.starting_bankroll),
    monthlyGoal: finiteBankrollNumber(row.monthly_goal),
    dailyStopWin: finiteBankrollNumber(row.daily_stop_win),
    dailyStopLoss: finiteBankrollNumber(row.daily_stop_loss),
    days: Array.isArray(daysJson) ? daysJson.map(readRecord) : [],
    updatedAt: readString(row, "updated_at"),
  };
}

function defaultCalendarHourlyStats(rows = liveNeuralCalendarHourlyStats) {
  return rows.filter(isDefaultCalendarHourlyStat);
}

const TELEGRAM_CONNECTION_TEST_MESSAGE = "[TESTE TELEGRAM]\nCanal conectado com sucesso.";

function isTelegramServiceRoutePath(pathname: string) {
  return (
    pathname === "/telegram/channels" ||
    pathname.startsWith("/telegram/channels/") ||
    pathname === "/telegram/channels/test" ||
    pathname === "/telegram/channels/validate" ||
    pathname === "/telegram/channels/preview" ||
    pathname === "/telegram/motors/toggle" ||
    pathname === "/telegram/status"
  );
}

const telegramService = {
  createChannel: telegramServiceCreateChannel,
  listChannels: telegramServiceListPublicChannels,
  testChannel: telegramServiceTestChannel,
  getConnectedChannel: telegramServiceGetConnectedChannel,
  toggleMotor: telegramServiceToggleMotor,
  sendTelegramMessage: telegramServiceSendTelegramMessage,
  getClientsWithMotorEnabled: telegramServiceGetClientsWithMotorEnabled,
  sendGlobalConfirmedSignalToEnabledClients: telegramServiceSendGlobalConfirmedSignalToEnabledClients,
  sendValidatorSignal: telegramServiceSendValidatorSignal,
};

async function handleTelegramServiceRequest(request: Request, url: URL, env: unknown) {
  if (!isTelegramServiceRoutePath(url.pathname)) return null;

  const clientId = await validatorRequestUserId(request, url, env);
  if (!clientId) return json({ error: "Nao autorizado." }, 401);

  await withTimeout(
    hydrateValidatorUserCache(env, clientId),
    LIVE_STATE_IO_TIMEOUT_MS,
    "carregar Central Telegram",
    undefined,
  );

  if (request.method === "GET" && url.pathname === "/telegram/channels") {
    return json({ channels: await telegramService.listChannels(env, clientId) });
  }

  if (request.method === "POST" && url.pathname === "/telegram/channels") {
    const body = readRecord(await request.json().catch(() => ({})));
    return telegramService.createChannel(env, request, clientId, body);
  }

  if (request.method === "POST" && url.pathname === "/telegram/channels/validate") {
    const body = readRecord(await request.json().catch(() => ({})));
    const botToken = normalizeSecretValue(readString(body, "botToken"));
    const chatId = readString(body, "chatId");
    if (!botToken) return json({ error: "Token invalido ou revogado." }, 400);
    if (!chatId) return json({ error: "Chat ID invalido." }, 400);

    const existingByCode = findValidatorChannelByIncomingCode(liveValidatorChannels, clientId, { chatId });
    if (existingByCode && existingByCode.userId === clientId) {
      return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409);
    }

    const validation = await validateTelegramChannelAccess(request, botToken, chatId);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
    return json({
      ok: true,
      validated: true,
      messageId: validation.messageId,
      validationCode: await issueTelegramChannelValidationCode(env, clientId, botToken, chatId),
    });
  }

  if (request.method === "POST" && url.pathname === "/telegram/channels/test") {
    const body = readRecord(await request.json().catch(() => ({})));
    const channelId = readString(body, "channelId");
    return telegramService.testChannel(env, request, clientId, channelId);
  }

  if (request.method === "POST" && url.pathname === "/telegram/channels/preview") {
    const body = readRecord(await request.json().catch(() => ({})));
    const channelId = readString(body, "channelId");
    const message = normalizeTelegramMessage(readString(body, "message"));
    const buttons = Array.isArray(body.buttons)
      ? body.buttons.map(readRecord).map((button) => ({
          label: readString(button, "label"),
          url: readString(button, "url"),
        }))
      : [];
    if (!message) return json({ error: "Mensagem de previa obrigatoria." }, 400);
    const result = await telegramService.sendTelegramMessage(env, request, clientId, channelId, message, buttons);
    if (!result.ok) return json({ error: result.error }, result.status || 502);
    return json({ ok: true, messageId: result.messageId, preview: true });
  }

  if (request.method === "POST" && url.pathname === "/telegram/motors/toggle") {
    const body = readRecord(await request.json().catch(() => ({})));
    return telegramService.toggleMotor(
      env,
      clientId,
      readString(body, "channelId"),
      readString(body, "motorKey") as ValidatorTelegramModuleKey,
      readBooleanField(body, "enabled"),
    );
  }

  if (request.method === "GET" && url.pathname === "/telegram/status") {
    const channels = await telegramServiceListChannelsRaw(env, clientId);
    const connectedChannels = channels.filter(telegramServiceChannelIsConnected);
    const activeMotors = new Set<string>();
    for (const channel of connectedChannels) {
      const modules = validatorChannelSignalModules(channel);
      for (const key of VALIDATOR_TELEGRAM_MODULE_KEYS) {
        if (modules[key]?.enabled) activeMotors.add(key);
      }
    }
    return json({
      channelStatus: connectedChannels.length ? "connected" : channels.length ? "pending" : "missing",
      motorStatus: activeMotors.size ? "active" : "inactive",
      channels: channels.map(publicTelegramServiceChannel),
      activeMotors: [...activeMotors],
    });
  }

  const channelMatch = url.pathname.match(/^\/telegram\/channels\/([^/]+)$/);
  if (channelMatch) {
    const channelId = decodeURIComponent(channelMatch[1] || "");
    const current = await findValidatorChannelForUser(env, clientId, channelId);

    if (request.method === "PATCH") {
      if (!current) return json({ error: "Canal nao encontrado." }, 404);
      const body = readRecord(await request.json().catch(() => ({})));
      const next = normalizeServerNotificationChannel({ ...current, ...body, id: current.id }, clientId, current);
      if (!next) return json({ error: "Canal invalido." }, 400);
      const saved = await telegramServicePersistChannel(env, next);
      return json({ channel: publicTelegramServiceChannel(saved) });
    }

    if (request.method === "DELETE") {
      const idsToDelete = new Set<string>([channelId]);
      const channelCodeToDelete = current ? normalizeValidatorChannelCode(current.chatId) : "";
      if (current) {
        for (const relatedId of validatorChannelRelatedIds(liveValidatorChannels, current)) {
          idsToDelete.add(relatedId);
        }
        for (const relatedId of await findStoredValidatorChannelRelatedIds(env, clientId, current)) {
          idsToDelete.add(relatedId);
        }
      }
      const deletedIds = [...idsToDelete].filter(Boolean);
      liveValidatorChannels = liveValidatorChannels.filter(
        (channel) =>
          !(
            channel.userId === clientId &&
            (idsToDelete.has(channel.id) ||
              (channelCodeToDelete && normalizeValidatorChannelCode(channel.chatId) === channelCodeToDelete))
          ),
      );
      liveValidatorPatterns = liveValidatorPatterns.map((pattern) =>
        pattern.userId === clientId && idsToDelete.has(pattern.telegramChannelId)
          ? { ...pattern, telegramChannelId: "", updatedAt: new Date().toISOString() }
          : pattern,
      );
      liveValidatorNotifications = liveValidatorNotifications.filter((notification) => {
        const notificationUserId = normalizeValidatorUserId(
          readString(notification, "userId") || readString(notification, "user_id"),
        );
        const notificationChannelId = readString(notification, "channelId") || readString(notification, "channel_id");
        return !(notificationUserId === clientId && idsToDelete.has(notificationChannelId));
      });
      await Promise.allSettled(deletedIds.map((id) => deleteCloudValidatorChannel(env, clientId, id, current?.chatId || "")));
      await deleteValidatorChannelRows(env, clientId, deletedIds);
      await deleteValidatorChannelNotificationRows(env, clientId, deletedIds);
      await markValidatorChannelsDeleted(env, clientId, deletedIds, current?.chatId || "");
      if (current?.chatId) {
        await deleteValidatorChannelsByCode(env, clientId, current.chatId);
      }
      await Promise.all(
        liveValidatorPatterns
          .filter((pattern) => pattern.userId === clientId && pattern.telegramChannelId === "")
          .map((pattern) => persistValidatorPattern(env, pattern)),
      );
      await saveLiveState(env);
      return json({ ok: true, deleted: deletedIds.length });
    }
  }

  return json({ error: "Rota Telegram nao encontrada." }, 404);
}

async function telegramServiceListChannelsRaw(env: unknown, clientId: string) {
  const normalizedClientId = normalizeValidatorUserId(clientId);
  if (!normalizedClientId) return [] as ValidatorNotificationChannel[];
  return loadValidatorChannelsForUser(env, normalizedClientId);
}

async function telegramServiceListPublicChannels(env: unknown, clientId: string) {
  return (await telegramServiceListChannelsRaw(env, clientId)).map(publicTelegramServiceChannel);
}

async function telegramServiceCreateChannel(env: unknown, request: Request, clientId: string, body: Record<string, unknown>) {
  const incoming = readRecord(body.channel || body);
  const incomingToken = normalizeSecretValue(readString(incoming, "botToken"));
  const validationCode = readString(body, "validationCode") || readString(incoming, "validationCode");
  const channels = await telegramServiceListChannelsRaw(env, clientId);
  const incomingId = readString(incoming, "id");
  const existingById = channels.find((channel) => channel.id === incomingId);
  const existingByCode = findValidatorChannelByIncomingCode(channels, clientId, incoming);
  if (existingByCode && existingByCode.id !== existingById?.id) {
    return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409);
  }

  const existing = existingById || existingByCode || undefined;
  const channel = normalizeServerNotificationChannel(incoming, clientId, existing);
  if (!channel) return json({ error: "Canal invalido." }, 400);

  const botToken = decodeServerToken(channel.botTokenEncoded);
  if (!botToken || !channel.chatId) {
    return json({ error: "Bot Token e Chat ID sao obrigatorios para salvar o canal." }, 400);
  }

  let messageId: number | string | null = null;
  if (incomingToken || !existing || !telegramServiceChannelIsConnected(existing)) {
    const validationOk = await verifyTelegramChannelValidationCode(
      env,
      clientId,
      botToken,
      channel.chatId,
      validationCode,
    );
    if (!validationOk) {
      const validation = await validateTelegramChannelAccess(request, botToken, channel.chatId);
      if (!validation.ok) return json({ error: validation.error }, validation.status);
      messageId = validation.messageId;
    }
  }

  const saved = await telegramServicePersistChannel(
    env,
    stampTelegramChannelConnection(channel, "connected", messageId || readTelegramChannelMessageId(existing), ""),
  );
  return json({ channel: publicTelegramServiceChannel(saved), messageId: readTelegramChannelMessageId(saved) }, 201);
}

async function telegramServiceTestChannel(env: unknown, request: Request, clientId: string, channelId: string) {
  const channel = await findValidatorChannelForUser(env, clientId, channelId);
  if (!channel) {
    const cloudResult = await testSavedCloudValidatorChannel(env, clientId, channelId);
    if (!cloudResult.ok) return json({ error: cloudResult.error }, cloudResult.status || 404);
    return json({ ok: true, messageId: cloudResult.messageId, channelId });
  }

  const result = isCloudValidatorTelegramChannel(channel)
    ? await testSavedCloudValidatorChannel(env, clientId, channel.id)
    : await testDirectValidatorChannel(request, channel);

  if (!result.ok) {
    await telegramServicePersistChannel(env, stampTelegramChannelConnection(channel, "invalid", null, result.error));
    return json({ error: result.error }, result.status || 502);
  }

  if (!result.messageId) {
    const error = "Telegram aceitou o teste, mas nao retornou message_id. Tente novamente.";
    await telegramServicePersistChannel(env, stampTelegramChannelConnection(channel, "invalid", null, error));
    return json({ error }, 502);
  }

  const saved = await telegramServicePersistChannel(
    env,
    stampTelegramChannelConnection(channel, "connected", result.messageId, ""),
  );
  return json({ ok: true, messageId: result.messageId, channelId: saved.id, channel: publicTelegramServiceChannel(saved) });
}

async function telegramServiceToggleMotor(
  env: unknown,
  clientId: string,
  channelId: string,
  motorKey: ValidatorTelegramModuleKey,
  enabled: boolean,
) {
  if (!VALIDATOR_TELEGRAM_MODULE_KEYS.includes(motorKey)) {
    return json({ error: "Motor Telegram invalido." }, 400);
  }
  const channel = await findValidatorChannelForUser(env, clientId, channelId);
  if (!channel) return json({ error: "Canal nao encontrado." }, 404);
  if (enabled && !telegramServiceChannelIsConnected(channel)) {
    return json({ error: "Teste o canal no Telegram antes de ativar o motor." }, 400);
  }
  const modules = validatorChannelSignalModules(channel);
  const nextModules = {
    ...modules,
    [motorKey]: {
      ...modules[motorKey],
      enabled,
    },
  };
  const next = {
    ...channel,
    signalModules: nextModules,
    isActive: channel.isActive !== false,
    updatedAt: new Date().toISOString(),
  } as ValidatorNotificationChannel;
  const saved = await telegramServicePersistChannel(env, next);
  return json({ channel: publicTelegramServiceChannel(saved), motorKey, enabled });
}

async function telegramServiceGetConnectedChannel(env: unknown, clientId: string, channelId: string) {
  const channel = await findValidatorChannelForUser(env, clientId, channelId);
  return channel && telegramServiceChannelIsConnected(channel) ? channel : null;
}

async function telegramServiceSendTelegramMessage(
  env: unknown,
  request: Request,
  clientId: string,
  channelId: string,
  message: string,
  buttons: Array<{ label: string; url: string }> = [],
) {
  const channel = await telegramServiceGetConnectedChannel(env, clientId, channelId);
  if (!channel) return { ok: false as const, status: 404, error: "Canal nao encontrado ou pendente de teste." };
  if (isCloudValidatorTelegramChannel(channel)) {
    return sendCloudValidatorChannelPreview(env, clientId, channel.id, message, buttons);
  }
  const botToken = decodeServerToken(channel.botTokenEncoded);
  if (!botToken || !channel.chatId) {
    return { ok: false as const, status: 400, error: "Canal Telegram sem Bot Token ou Chat ID." };
  }
  return sendTelegramMessage({
    botToken,
    chatId: channel.chatId,
    message,
    buttonLabel: "Abrir Sniper Bo IA",
    buttonUrl: normalizeTelegramButtonUrl(channel.buttonLink),
    buttons,
    allowInsecureNodeFallback: isLocalDevelopmentRequest(request),
  });
}

async function telegramServiceGetClientsWithMotorEnabled(env: unknown, motorKey: ValidatorTelegramModuleKey) {
  const channels = await fetchStoredActiveValidatorChannels(env);
  return [
    ...new Set(
      channels
        .filter((channel) => validatorChannelModuleEnabled(channel, motorKey, false))
        .map((channel) => channel.userId)
        .filter(Boolean),
    ),
  ];
}

async function telegramServiceSendGlobalConfirmedSignalToEnabledClients(
  _env: unknown,
  _motorKey: ValidatorTelegramModuleKey,
  _confirmedSignal: Record<string, unknown>,
) {
  return { ok: true, delegatedToMonitor: true };
}

async function telegramServiceSendValidatorSignal(
  _env: unknown,
  _clientId: string,
  _strategySignal: Record<string, unknown>,
) {
  return { ok: true, delegatedToValidator: true };
}

async function telegramServicePersistChannel(env: unknown, channel: ValidatorNotificationChannel) {
  const cloudResult = await persistCloudValidatorChannel(env, channel);
  if (cloudResult.configured && !cloudResult.ok) {
    console.warn(
      JSON.stringify({
        event: "[TELEGRAM_SERVICE] cloud_persist_failed",
        user: maskTelemetryUserId(channel.userId),
        channelId: channel.id,
        error: cloudResult.error,
      }),
    );
  }
  const persistedChannel = cloudResult.ok && cloudResult.channel ? cloudResult.channel : channel;
  await clearValidatorChannelDeletedState(env, persistedChannel);
  liveValidatorChannels = upsertValidatorChannel(persistedChannel);
  await persistValidatorChannel(env, persistedChannel);
  await saveLiveState(env);
  return persistedChannel;
}

async function persistCloudValidatorChannel(env: unknown, channel: ValidatorNotificationChannel) {
  const config = getTelegramEngineConfig(env);
  if (!config) return { ok: false as const, configured: false as const, status: 503, error: "" };
  const clientId = normalizeValidatorUserId(channel.userId);
  if (!clientId || !channel.id) {
    return { ok: false as const, configured: true as const, status: 400, error: "Canal sem usuario ou ID." };
  }

  const botToken = decodeServerToken(channel.botTokenEncoded);
  const payload = cloudValidatorChannelPayload(channel, botToken);
  const cloudPath = `/validator/channels/${encodeURIComponent(channel.id)}`;
  const shouldPatchCloud = isCloudValidatorTelegramChannel(channel) && !botToken;
  const response = shouldPatchCloud
    ? await callCloudValidatorChannelEndpoint(env, clientId, cloudPath, payload, "PATCH")
    : await saveDirectChannelToCloudValidatorEngine(env, clientId, channel, payload, botToken);

  if (!response.ok) {
    return {
      ok: false as const,
      configured: true as const,
      status: response.status,
      error: response.error,
    };
  }

  const cloudChannel =
    normalizeCloudValidatorChannel(readRecord(response.data).channel, clientId) ||
    normalizeCloudValidatorChannel(payload, clientId);
  return {
    ok: true as const,
    configured: true as const,
    status: response.status,
    channel: cloudChannel || channel,
  };
}

async function saveDirectChannelToCloudValidatorEngine(
  env: unknown,
  clientId: string,
  channel: ValidatorNotificationChannel,
  payload: Record<string, unknown>,
  botToken: string,
) {
  if (!botToken || !channel.chatId) {
    return { ok: false as const, status: 400, error: "Bot Token e Chat ID sao obrigatorios." };
  }
  const validation = await callCloudValidatorChannelEndpoint(
    env,
    clientId,
    "/validator/channels/validate",
    {
      id: channel.id,
      channelId: channel.id,
      botToken,
      chatId: channel.chatId,
    },
    "POST",
  );
  if (!validation.ok) return validation;
  return callCloudValidatorChannelEndpoint(
    env,
    clientId,
    "/validator/channels",
    {
      channel: payload,
      validationCode: readString(readRecord(validation.data).validationCode),
    },
    "POST",
  );
}

function cloudValidatorChannelPayload(channel: ValidatorNotificationChannel, botToken = "") {
  return {
    id: channel.id,
    userId: channel.userId,
    name: channel.name,
    ...(botToken ? { botToken } : {}),
    chatId: channel.chatId,
    buttonLink: channel.buttonLink,
    isActive: channel.isActive !== false,
    analyzingEnabled: Boolean(channel.analyzingEnabled),
    analyzingCooldownRounds: Math.max(1, Math.floor(Number(channel.analyzingCooldownRounds) || 3)),
    templates: channel.templates,
    signalModules: validatorChannelSignalModules(channel),
    connectionStatus: readString(channel as unknown as Record<string, unknown>, "connectionStatus"),
    lastTestedAt: readString(channel as unknown as Record<string, unknown>, "lastTestedAt"),
    lastTestMessageId: readTelegramChannelMessageId(channel),
  };
}

async function deleteCloudValidatorChannel(env: unknown, clientId: string, channelId: string, chatId = "") {
  const normalizedChannelId = readString(channelId);
  if (!normalizedChannelId) return { ok: false as const, status: 400, error: "Canal Telegram obrigatorio." };
  return callCloudValidatorChannelEndpoint(
    env,
    clientId,
    `/validator/channels/${encodeURIComponent(normalizedChannelId)}`,
    { chatId: readString(chatId) },
    "DELETE",
  );
}

async function testDirectValidatorChannel(request: Request, channel: ValidatorNotificationChannel) {
  const botToken = decodeServerToken(channel.botTokenEncoded);
  if (!botToken || !channel.chatId) {
    return { ok: false as const, status: 400, error: "Canal Telegram sem Bot Token ou Chat ID. Salve o canal novamente." };
  }
  return validateTelegramChannelAccess(request, botToken, channel.chatId);
}

async function testCloudValidatorChannel(env: unknown, clientId: string, channelId: string) {
  const response = await sendTelegramEngineSignal(env, {
    userId: clientId,
    channelId,
    moduleKey: "validator",
    signalKey: `connection-test:${channelId}:${Date.now()}`,
    roundId: Date.now(),
    entry: "",
    message: TELEGRAM_CONNECTION_TEST_MESSAGE,
    forceMessage: true,
  });
  if (!response.ok) return response;
  const messageId = response.messageId;
  return messageId
    ? { ok: true as const, status: 200, messageId }
    : { ok: false as const, status: 502, error: "Cloudflare Telegram nao retornou message_id." };
}

async function testSavedCloudValidatorChannel(env: unknown, clientId: string, channelId: string) {
  const normalizedChannelId = readString(channelId);
  if (!normalizedChannelId) return { ok: false as const, status: 400, error: "Canal Telegram obrigatorio." };
  const response = await callCloudValidatorChannelEndpoint(env, clientId, "/validator/channels/test", {
    channelId: normalizedChannelId,
  });
  if (!response.ok) return response;
  const messageId = response.messageId;
  return messageId
    ? { ok: true as const, status: 200, messageId }
    : { ok: false as const, status: 502, error: "Cloudflare Telegram nao retornou message_id." };
}

async function sendCloudValidatorChannelPreview(
  env: unknown,
  clientId: string,
  channelId: string,
  message: string,
  buttons: Array<{ label: string; url: string }>,
) {
  const response = await callCloudValidatorChannelEndpoint(env, clientId, "/validator/channels/preview", {
    channelId,
    message,
    buttons,
  });
  if (!response.ok) return response;
  return { ok: true as const, status: 200, messageId: response.messageId || null };
}

async function callCloudValidatorChannelEndpoint(
  env: unknown,
  clientId: string,
  path: string,
  payload: Record<string, unknown>,
  method = "POST",
) {
  const config = getTelegramEngineConfig(env);
  if (!config) return { ok: false as const, status: 503, error: "Cloudflare Telegram Engine nao configurado." };
  const response = await fetch(`${config.url}${path}`, {
    method,
    cache: "no-store",
    headers: telegramEngineHeaders(config.secret, normalizeValidatorUserId(clientId), true),
    body: JSON.stringify(payload),
  }).catch(() => null);
  if (!response) return { ok: false as const, status: 502, error: "Cloudflare Telegram Engine indisponivel." };
  const data = readRecord(await response.json().catch(() => ({})));
  if (!response.ok || data.ok === false) {
    return {
      ok: false as const,
      status: response.status || 502,
      error: readString(data, "error") || "Cloudflare Telegram nao confirmou o canal.",
    };
  }
  return {
    ok: true as const,
    status: response.status,
    messageId: readTelegramMessageId(data),
    data,
  };
}

function stampTelegramChannelConnection(
  channel: ValidatorNotificationChannel,
  status: "pending" | "connected" | "invalid",
  messageId: number | string | null,
  error: string,
) {
  const now = new Date().toISOString();
  return {
    ...channel,
    connectionStatus: status,
    lastTestedAt: now,
    lastTestMessageId: status === "connected" ? messageId : null,
    lastConnectionError: status === "invalid" ? error : "",
    updatedAt: now,
  } as ValidatorNotificationChannel;
}

function publicTelegramServiceChannel(channel: ValidatorNotificationChannel) {
  const publicChannel = publicValidatorChannel(channel);
  return {
    ...publicChannel,
    connectionStatus: telegramServiceConnectionStatus(channel),
    lastTestedAt: readString(channel as unknown as Record<string, unknown>, "lastTestedAt"),
    lastTestMessageId: readTelegramChannelMessageId(channel),
    lastConnectionError:
      telegramServiceConnectionStatus(channel) === "invalid"
        ? readString(channel as unknown as Record<string, unknown>, "lastConnectionError")
        : "",
  } as ValidatorNotificationChannel;
}

function telegramServiceConnectionStatus(channel?: ValidatorNotificationChannel | null) {
  if (!channel) return "pending";
  const raw = readString(channel as unknown as Record<string, unknown>, "connectionStatus");
  if (raw === "connected" || raw === "invalid" || raw === "pending") return raw;
  return isUsableValidatorTelegramChannel(channel) ? "connected" : "pending";
}

function telegramServiceChannelIsConnected(channel?: ValidatorNotificationChannel | null) {
  return Boolean(
    channel && telegramServiceConnectionStatus(channel) === "connected" && isUsableValidatorTelegramChannel(channel),
  );
}

function readTelegramChannelMessageId(channel?: ValidatorNotificationChannel | null) {
  if (!channel) return null;
  return readTelegramMessageId(channel as unknown as Record<string, unknown>);
}

function readTelegramMessageId(record: Record<string, unknown>) {
  const candidates = [
    record.messageId,
    record.message_id,
    record.telegramMessageId,
    record.lastTestMessageId,
    record.notificationId,
  ];
  for (const candidate of candidates) {
    const value = typeof candidate === "number" ? candidate : readString({ value: candidate }, "value");
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

async function handleValidatorStorageRequest(request: Request, url: URL, env: unknown) {
  const isPatternsRoute = url.pathname === "/validator/patterns" || url.pathname.startsWith("/validator/patterns/");
  const isChannelsRoute =
    url.pathname === "/validator/channels" ||
    url.pathname.startsWith("/validator/channels/") ||
    url.pathname === "/validator/channels/test";
  const isLiveHitRoute = url.pathname === "/validator/live-hit/send";
  const isNotificationsRoute = url.pathname === "/validator/notifications";
  if (!isPatternsRoute && !isChannelsRoute && !isLiveHitRoute && !isNotificationsRoute) return null;

  const userId = await validatorRequestUserId(request, url, env);
  if (!userId) return json({ error: "Nao autorizado." }, 401);
  const shouldForwardToTelegramEngine = isChannelsRoute || isNotificationsRoute;
  if (shouldForwardToTelegramEngine) {
    if (!getTelegramEngineConfig(env)) {
      return json({ error: "Telegram Engine secrets missing" }, 500);
    }
    const telegramAccess = await syncTelegramEngineUserAccess(env, userId, findClientByEmail(userId)).catch(
      (error) => ({
        ok: false,
        status: 502,
        error: errorMessage(error),
      }),
    );
    if (!telegramAccess.ok) {
      return json(
        { error: "Falha ao preparar Central Telegram.", detail: telegramAccess.error },
        telegramAccess.status,
      );
    }
    const cloudResponse = await forwardTelegramEngineRequest(request, url, env, userId).catch((error) => {
      console.warn("Cloudflare Telegram Engine indisponivel.", error);
      return null;
    });
    if (cloudResponse) return cloudResponse;
    return json({ error: "Telegram Engine unavailable" }, 502);
  }
  await withTimeout(
    hydrateValidatorUserCache(env, userId),
    LIVE_STATE_IO_TIMEOUT_MS,
    "carregar dados do Validador",
    undefined,
  );

  if (request.method === "GET" && isNotificationsRoute) {
    const storedNotifications = getSupabasePersistenceConfig(env)
      ? await withTimeout(
          fetchStoredRecentValidatorNotifications(env),
          LIVE_STATE_IO_TIMEOUT_MS,
          "carregar notificacoes do Validador",
          [] as Array<Record<string, unknown>>,
        )
      : [];
    const notifications = mergeValidatorNotifications(storedNotifications, liveValidatorNotifications)
      .filter(
        (notification) =>
          normalizeValidatorUserId(readString(notification, "userId") || readString(notification, "user_id")) ===
          userId,
      )
      .filter((notification) => !isValidatorResultNotification(notification))
      .sort((a, b) => validatorNotificationTimeMs(b) - validatorNotificationTimeMs(a))
      .slice(0, 50)
      .map(publicValidatorNotification);
    return json({ notifications });
  }

  if (request.method === "POST" && isLiveHitRoute) {
    const body = readRecord(await request.json().catch(() => ({})));
    const patternId = readString(body, "patternId");
    const detectedRoundId = Math.floor(Number(body.detectedRoundId) || 0);
    const incomingPattern = normalizeServerSavedPattern(body.pattern, userId);
    let pattern = liveValidatorPatterns.find((item) => item.userId === userId && item.id === patternId);
    if (!pattern && incomingPattern && incomingPattern.id === patternId) {
      pattern = incomingPattern;
      liveValidatorPatterns = upsertValidatorPattern(incomingPattern);
      await persistValidatorPattern(env, incomingPattern);
    }
    console.info(
      JSON.stringify({
        event: "[VALIDATOR_DISPATCH] live_hit_received",
        user: maskTelemetryUserId(userId),
        patternId,
        detectedRoundId,
        patternFound: Boolean(pattern),
        incomingPattern: Boolean(incomingPattern),
        channelsForUser: liveValidatorChannels.filter((channel) => channel.userId === userId).length,
      }),
    );
    if (!pattern) {
      console.warn(
        JSON.stringify({
          event: "[VALIDATOR_DISPATCH] blocked",
          user: maskTelemetryUserId(userId),
          patternId,
          detectedRoundId,
          reason: "pattern_not_found",
        }),
      );
      return json({ error: "Padrao nao encontrado no servidor. Salve a estrategia novamente." }, 404);
    }
    if (!pattern.isActive) return json({ error: "Padrao inativo." }, 400);
    if (!validatorPatternAllowsTelegramForward(pattern)) {
      return json({ error: "Padrao esta em monitorar/desativado." }, 400);
    }

    const channel = findValidatorTelegramChannelForPattern(pattern);
    if (!channel) {
      console.warn(
        JSON.stringify({
          event: "[VALIDATOR_DISPATCH] blocked",
          user: maskTelemetryUserId(userId),
          patternId: pattern.id,
          detectedRoundId,
          reason: "channel_not_found",
          telegramChannelId: pattern.telegramChannelId,
          userChannels: liveValidatorChannels.filter((item) => item.userId === pattern.userId).length,
          usableChannels: liveValidatorChannels.filter((item) => item.userId === pattern.userId && isUsableValidatorTelegramChannel(item)).length,
        }),
      );
      return json({ error: "Nenhum canal Telegram ativo com token e Chat ID." }, 400);
    }

    const roundId = detectedRoundId || Date.now();
    const notificationKey = `${pattern.userId}:${pattern.id}:${channel.id}:${roundId}`;
    if (validatorNotificationAlreadySent(notificationKey)) {
      return json({ ok: true, skipped: true });
    }

    if (!validatorChannelModuleEnabled(channel, "validator", true)) {
      console.warn(
        JSON.stringify({
          event: "[VALIDATOR_DISPATCH] blocked",
          user: maskTelemetryUserId(pattern.userId),
          patternId: pattern.id,
          channelId: channel.id,
          roundId,
          reason: "validator_module_inactive",
        }),
      );
      return json({ error: "Seguir Validador esta inativo neste canal." }, 400);
    }

    const sentAt = new Date().toISOString();
    const message = buildServerValidatorTelegramMessage(pattern, channel);
    const entrySide = pattern.pulledSide || validatorEntrySide(pattern.entryType) || "B";
    const moduleConfig = validatorChannelModuleConfig(channel, "validator");
    const buttons = validatorModuleTelegramButtons(moduleConfig, channel);
    const result = isCloudValidatorTelegramChannel(channel)
      ? await sendTelegramEngineSignal(env, {
          userId: pattern.userId,
          channelId: channel.id,
          moduleKey: "validator",
          signalKey: notificationKey,
          roundId,
          entry: entrySide,
          message,
          variables: buildServerValidatorTelegramVariables(pattern, channel),
          buttons,
          forceMessage: true,
        })
      : await sendTelegramMessage({
          botToken: decodeServerToken(channel.botTokenEncoded),
          chatId: channel.chatId,
          message,
          buttonLabel: "Abrir Sniper Bo IA",
          buttonUrl: normalizeTelegramButtonUrl(channel.buttonLink),
          buttons,
          allowInsecureNodeFallback: isLocalDevelopmentRequest(request),
        });
    console[result.ok ? "info" : "warn"](
      JSON.stringify({
        event: result.ok ? "[VALIDATOR_DISPATCH] sent" : "[VALIDATOR_DISPATCH] telegram_error",
        user: maskTelemetryUserId(pattern.userId),
        patternId: pattern.id,
        channelId: channel.id,
        roundId,
        cloudChannel: isCloudValidatorTelegramChannel(channel),
        telegramResult: result.ok ? "success" : "error",
        status: result.status,
        messageId: result.ok ? result.messageId : null,
        error: result.ok ? "" : result.error,
      }),
    );

    const notification = {
      id: notificationKey,
      type: "entry",
      userId: pattern.userId,
      patternId: pattern.id,
      channelId: channel.id,
      roundId,
      status: result.ok ? "sent" : "error",
      error: result.ok ? "" : result.error,
      payloadJson: {
        moduleKey: "validator",
        entry: pattern.pulledSide
          ? formatServerTelegramSide(pattern.pulledSide)
          : formatServerTelegramSide(validatorEntrySide(pattern.entryType) || "B"),
        protection: formatValidatorModuleGale(pattern.galeLimit),
        result: "Aguardando resultado",
        pattern: pattern.pattern,
        percentage: formatServerPercent(pattern.validation?.accuracy),
        telegramMessageId: result.ok ? result.messageId : null,
      },
      sentAt,
      updatedAt: sentAt,
    };
    liveValidatorNotifications = [
      notification,
      ...liveValidatorNotifications.filter((item) => readString(item, "id") !== notificationKey),
    ].slice(0, 1000);
    void persistValidatorNotification(env, notification);

    if (result.ok) {
      let updatedPattern: SavedValidatorPattern | null = null;
      liveValidatorPatterns = liveValidatorPatterns.map((item) =>
        item.userId === pattern.userId && item.id === pattern.id
          ? (updatedPattern = { ...item, lastDetectedAt: sentAt, lastDetectedRoundId: roundId, updatedAt: sentAt })
          : item,
      );
      if (updatedPattern) void persistValidatorPattern(env, updatedPattern);
      await saveLiveState(env);
      return json({ ok: true, skipped: false, messageId: result.messageId });
    }

    await saveLiveState(env);
    return json({ error: result.error }, result.status);
  }

  if (url.pathname === "/validator/patterns") {
    if (request.method === "GET") {
      return json({
        patterns: liveValidatorPatterns
          .filter((pattern) => pattern.userId === userId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      });
    }

    if (request.method === "POST") {
      try {
        const body = readRecord(await request.json().catch(() => ({})));
        const pattern = normalizeServerSavedPattern(body.pattern || body, userId);
        if (!pattern) return json({ error: "Padrao invalido." }, 400);
        if (isValidatorPatternDeleted(pattern)) {
          await deleteValidatorPatternRow(env, userId, pattern.id);
          return json({ error: "Padrao excluido definitivamente. Salve uma nova estrategia para recriar." }, 410);
        }
        liveValidatorPatterns = upsertValidatorPattern(pattern);
        await persistValidatorPattern(env, pattern);
        await saveLiveState(env);
        return json({ pattern }, 201);
      } catch (error) {
        console.warn("Falha ao salvar padrao do Validador.", error);
        return json(
          {
            error: "Falha ao salvar padrao no servidor.",
            detail: isLocalDevelopmentRequest(request) ? errorMessage(error) : "",
          },
          500,
        );
      }
    }
  }

  const patternMatch = url.pathname.match(/^\/validator\/patterns\/([^/]+)$/);
  if (patternMatch) {
    const patternId = decodeURIComponent(patternMatch[1] || "");
    const current = liveValidatorPatterns.find((pattern) => pattern.userId === userId && pattern.id === patternId);
    if (!current && request.method !== "DELETE") return json({ error: "Padrao nao encontrado." }, 404);

    if (request.method === "PATCH") {
      if (!current) return json({ error: "Padrao nao encontrado." }, 404);
      const body = readRecord(await request.json().catch(() => ({})));
      const next = normalizeServerSavedPattern({ ...current, ...body, id: current.id }, userId);
      if (!next) return json({ error: "Padrao invalido." }, 400);
      if (isValidatorPatternDeleted(next)) {
        await deleteValidatorPatternRow(env, userId, next.id);
        return json({ error: "Padrao excluido definitivamente. Salve uma nova estrategia para recriar." }, 410);
      }
      liveValidatorPatterns = upsertValidatorPattern(next);
      await persistValidatorPattern(env, next);
      await saveLiveState(env);
      return json({ pattern: next });
    }

    if (request.method === "DELETE") {
      markValidatorPatternDeleted(userId, patternId);
      await markValidatorPatternDeletedDurable(env, userId, patternId);
      liveValidatorPatterns = liveValidatorPatterns.filter(
        (pattern) => !(pattern.userId === userId && pattern.id === patternId),
      );
      liveValidatorNotifications = liveValidatorNotifications.filter((notification) => {
        const notificationUserId = normalizeValidatorUserId(
          readString(notification, "userId") || readString(notification, "user_id"),
        );
        const notificationPatternId = readString(notification, "patternId") || readString(notification, "pattern_id");
        return !(notificationUserId === userId && notificationPatternId === patternId);
      });
      await deleteValidatorPatternRow(env, userId, patternId);
      await deleteValidatorPatternNotificationRows(env, userId, patternId);
      await saveLiveState(env);
      return json({ ok: true });
    }
  }

  if (url.pathname === "/validator/channels") {
    if (request.method === "GET") {
      const userChannels = await loadValidatorChannelsForUser(env, userId);
      return json({
        channels: userChannels.map(publicValidatorChannel).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      });
    }

    if (request.method === "POST") {
      const body = readRecord(await request.json().catch(() => ({})));
      const incoming = readRecord(body.channel || body);
      const incomingToken = normalizeSecretValue(readString(incoming, "botToken"));
      const validationCode = readString(body, "validationCode") || readString(incoming, "validationCode");
      const existingById = liveValidatorChannels.find(
        (channel) => channel.userId === userId && channel.id === readString(incoming, "id"),
      );
      const existingByCode = findValidatorChannelByIncomingCode(liveValidatorChannels, userId, incoming);
      if (existingByCode && existingByCode.id !== existingById?.id) {
        return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409);
      }
      const existing = existingById || existingByCode;
      const channel = normalizeServerNotificationChannel(incoming, userId, existing);
      if (!channel) return json({ error: "Canal invalido." }, 400);
      const botToken = decodeServerToken(channel.botTokenEncoded);
      if (!botToken || !channel.chatId) {
        return json({ error: "Bot Token e Chat ID sao obrigatorios para salvar o canal." }, 400);
      }
      if (incomingToken || !existing) {
        const validationOk = await verifyTelegramChannelValidationCode(
          env,
          userId,
          botToken,
          channel.chatId,
          validationCode,
        );
        if (!validationOk) {
          const validation = await validateTelegramChannelAccess(request, botToken, channel.chatId);
          if (!validation.ok) return json({ error: validation.error }, validation.status);
        }
      }
      const duplicateIds = [
        ...new Set([
          ...validatorChannelRelatedIds(liveValidatorChannels, channel),
          ...(await findStoredValidatorChannelRelatedIds(env, userId, channel)),
        ]),
      ].filter((channelId) => channelId !== channel.id);
      liveValidatorChannels = upsertValidatorChannel(channel);
      if (duplicateIds.length) {
        await deleteValidatorChannelRows(env, userId, duplicateIds);
        await markValidatorChannelsDeleted(env, userId, duplicateIds, "");
        liveValidatorChannels = liveValidatorChannels.filter(
          (item) => !(item.userId === userId && duplicateIds.includes(item.id)),
        );
      }
      const userChannels = mergeValidatorChannelList(liveValidatorChannels.filter((item) => item.userId === userId));
      liveValidatorChannels = [
        ...userChannels,
        ...liveValidatorChannels.filter((item) => item.userId !== userId),
      ].slice(0, 1000);
      const persisted = await persistValidatorChannel(env, channel);
      const saveStatus = await saveLiveState(env);
      if (getSupabasePersistenceConfig(env) && !persisted && !saveStatus.durable && !saveStatus.cache) {
        console.warn("Canal do Validador salvo apenas em memoria; armazenamento duravel indisponivel.");
      }
      return json(
        {
          channel: publicValidatorChannel(channel),
          persisted,
          storage: {
            dedicated: persisted,
            durable: saveStatus.durable,
            cache: saveStatus.cache,
            deduped: duplicateIds.length,
          },
        },
        201,
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/validator/channels/validate") {
    const body = readRecord(await request.json().catch(() => ({})));
    const botToken = normalizeSecretValue(readString(body, "botToken"));
    const chatId = readString(body, "chatId");
    if (!botToken) return json({ error: "Bot Token obrigatorio." }, 400);
    if (!chatId) return json({ error: "Chat ID obrigatorio." }, 400);

    const existingByCode = findValidatorChannelByIncomingCode(liveValidatorChannels, userId, { chatId });
    if (existingByCode) return json({ error: "Ja existe um canal com este Chat ID/codigo." }, 409);

    const validation = await validateTelegramChannelAccess(request, botToken, chatId);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
    return json({
      ok: true,
      validated: true,
      messageId: validation.messageId,
      validationCode: await issueTelegramChannelValidationCode(env, userId, botToken, chatId),
    });
  }

  if (request.method === "POST" && url.pathname === "/validator/channels/test") {
    const body = readRecord(await request.json().catch(() => ({})));
    const channelId = readString(body, "channelId");
    const channel = await findValidatorChannelForUser(env, userId, channelId);
    if (!channel) {
      const cloudResult = await testSavedCloudValidatorChannel(env, userId, channelId);
      if (!cloudResult.ok) return json({ error: cloudResult.error }, cloudResult.status || 404);
      return json({ ok: true, messageId: cloudResult.messageId, channelId });
    }
    if (isCloudValidatorTelegramChannel(channel)) {
      const result = await testSavedCloudValidatorChannel(env, userId, channel.id);
      if (!result.ok) return json({ error: result.error }, result.status || 502);
      return json({ ok: true, messageId: result.messageId, channelId: channel.id });
    }
    const botToken = decodeServerToken(channel.botTokenEncoded);
    if (!botToken || !channel.chatId) {
      return json({ error: "Canal Telegram sem Bot Token ou Chat ID. Salve o canal novamente." }, 400);
    }
    const validation = await validateTelegramChannelAccess(request, botToken, channel.chatId);
    if (!validation.ok) return json({ error: validation.error }, validation.status);
    return json({ ok: true, messageId: validation.messageId, channelId: channel.id });
  }

  const channelMatch = url.pathname.match(/^\/validator\/channels\/([^/]+)$/);
  if (channelMatch) {
    const channelId = decodeURIComponent(channelMatch[1] || "");

    if (request.method === "DELETE") {
      const current = await findValidatorChannelForUser(env, userId, channelId);
      const idsToDelete = new Set<string>([channelId]);
      const channelCodeToDelete = current ? normalizeValidatorChannelCode(current.chatId) : "";
      if (current) {
        for (const relatedId of validatorChannelRelatedIds(liveValidatorChannels, current)) {
          idsToDelete.add(relatedId);
        }
        for (const relatedId of await findStoredValidatorChannelRelatedIds(env, userId, current)) {
          idsToDelete.add(relatedId);
        }
      }
      const deletedIds = [...idsToDelete].filter(Boolean);
      liveValidatorChannels = liveValidatorChannels.filter(
        (channel) =>
          !(
            channel.userId === userId &&
            (idsToDelete.has(channel.id) ||
              (channelCodeToDelete && normalizeValidatorChannelCode(channel.chatId) === channelCodeToDelete))
          ),
      );
      liveValidatorPatterns = liveValidatorPatterns.map((pattern) =>
        pattern.userId === userId && idsToDelete.has(pattern.telegramChannelId)
          ? { ...pattern, telegramChannelId: "", updatedAt: new Date().toISOString() }
          : pattern,
      );
      liveValidatorNotifications = liveValidatorNotifications.filter((notification) => {
        const notificationUserId = normalizeValidatorUserId(
          readString(notification, "userId") || readString(notification, "user_id"),
        );
        const notificationChannelId = readString(notification, "channelId") || readString(notification, "channel_id");
        return !(notificationUserId === userId && idsToDelete.has(notificationChannelId));
      });
      await deleteValidatorChannelRows(env, userId, deletedIds);
      await deleteValidatorChannelNotificationRows(env, userId, deletedIds);
      await markValidatorChannelsDeleted(env, userId, deletedIds, current?.chatId || "");
      if (current?.chatId) {
        await deleteValidatorChannelsByCode(env, userId, current.chatId);
      }
      await Promise.all(
        liveValidatorPatterns
          .filter((pattern) => pattern.userId === userId && pattern.telegramChannelId === "")
          .map((pattern) => persistValidatorPattern(env, pattern)),
      );
      await saveLiveState(env);
      return json({ ok: true, deleted: deletedIds.length });
    }

    const current = await findValidatorChannelForUser(env, userId, channelId);
    if (!current) return json({ error: "Canal nao encontrado." }, 404);

    if (request.method === "PATCH") {
      const body = readRecord(await request.json().catch(() => ({})));
      const next = normalizeServerNotificationChannel({ ...current, ...body, id: current.id }, userId, current);
      if (!next) return json({ error: "Canal invalido." }, 400);
      if (validatorChannelActivatesAnyModule(current, next)) {
        if (isCloudValidatorTelegramChannel(next)) {
          const result = await sendTelegramEngineSignal(env, {
            userId,
            channelId: next.id,
            moduleKey: "validator",
            signalKey: `activation-test:${next.id}:${Date.now()}`,
            roundId: Date.now(),
            entry: "",
            message: "[TESTE CONEXAO TELEGRAM]\nCentral Telegram conectada com sucesso.",
            forceMessage: true,
          });
          if (!result.ok) return json({ error: result.error }, result.status || 502);
        } else {
          const botToken = decodeServerToken(next.botTokenEncoded);
          if (!botToken || !next.chatId) {
            return json({ error: "Canal Telegram sem Bot Token ou Chat ID. Salve o canal novamente." }, 400);
          }
          const validation = await validateTelegramChannelAccess(request, botToken, next.chatId);
          if (!validation.ok) return json({ error: validation.error }, validation.status);
        }
      }
      liveValidatorChannels = upsertValidatorChannel(next);
      await persistValidatorChannel(env, next);
      await saveLiveState(env);
      return json({ channel: publicValidatorChannel(next) });
    }
  }

  return json({ error: "Rota do Validador nao encontrada." }, 404);
}

async function findValidatorChannelForUser(env: unknown, userId: string, channelId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedChannelId = readString(channelId);
  if (!normalizedUserId || !normalizedChannelId) return null;

  const userChannels = await loadValidatorChannelsForUser(env, normalizedUserId);
  const byId = userChannels.find((channel) => channel.id === normalizedChannelId) || null;
  if (byId) return byId;

  const selected = liveValidatorChannels.find(
    (channel) => channel.userId === normalizedUserId && channel.id === normalizedChannelId,
  );
  if (selected) {
    const selectedKey = validatorChannelUniqueKey(selected);
    const bySelectedKey = userChannels.find((channel) => validatorChannelUniqueKey(channel) === selectedKey) || null;
    if (bySelectedKey) return bySelectedKey;
    return selected;
  }

  console.warn(
    JSON.stringify({
      event: "[VALIDATOR_CHANNEL] not_found",
      user: maskTelemetryUserId(normalizedUserId),
      channelId: normalizedChannelId,
      loadedChannels: userChannels.length,
    }),
  );
  return null;
}

async function loadValidatorChannelsForUser(env: unknown, userId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  if (!normalizedUserId) return [] as ValidatorNotificationChannel[];

  const [hydratedChannels, deletedRefs] = await Promise.all([
    withTimeout(
      fetchStoredValidatorChannels(env, normalizedUserId),
      LIVE_STATE_IO_TIMEOUT_MS,
      "carregar canais do Validador",
      [] as ValidatorNotificationChannel[],
    ),
    fetchValidatorChannelDeletedRefs(env, normalizedUserId),
  ]);

  const userChannels = mergeValidatorChannelList(
    hydratedChannels,
    liveValidatorChannels.filter((channel) => channel.userId === normalizedUserId),
  ).filter((channel) => !isValidatorChannelDeleted(channel, deletedRefs));
  liveValidatorChannels = [
    ...userChannels,
    ...liveValidatorChannels.filter((channel) => channel.userId !== normalizedUserId),
  ].slice(0, 1000);
  return userChannels;
}

async function validateTelegramChannelAccess(request: Request, botToken: string, chatId: string) {
  const cleanToken = normalizeSecretValue(botToken);
  const cleanChatId = normalizeTelegramChatId(chatId);
  const allowInsecureNodeFallback = isLocalDevelopmentRequest(request);

  if (!cleanToken) {
    return { ok: false as const, status: 400, error: "Token invalido ou revogado." };
  }
  if (!cleanChatId) {
    return { ok: false as const, status: 400, error: "Chat ID obrigatorio." };
  }

  const getMe = await callTelegramJson(cleanToken, "getMe", {});
  if (!getMe.ok) {
    return {
      ok: false as const,
      status: getMe.status,
      error: getMe.status === 401 ? "Token invalido ou revogado." : getMe.error,
    };
  }

  const bot = readRecord(getMe.result);
  const botId = Number(bot.id);
  if (!Number.isFinite(botId)) {
    return { ok: false as const, status: 400, error: "Token invalido ou revogado." };
  }

  const chat = await callTelegramJson(cleanToken, "getChat", { chat_id: cleanChatId });
  if (!chat.ok) {
    return {
      ok: false as const,
      status: chat.status,
      error: chat.error || "Chat ID nao encontrado. Confira o Chat ID e adicione o bot no canal.",
    };
  }

  const chatRecord = readRecord(chat.result);
  const chatType = readString(chatRecord, "type");
  const member = await callTelegramJson(cleanToken, "getChatMember", {
    chat_id: cleanChatId,
    user_id: botId,
  });
  if (!member.ok) {
    return {
      ok: false as const,
      status: member.status,
      error: "Adicione o bot como administrador do canal.",
    };
  }

  const memberRecord = readRecord(member.result);
  const status = readString(memberRecord, "status");
  if (status === "left" || status === "kicked") {
    return {
      ok: false as const,
      status: 403,
      error: "Adicione o bot como administrador do canal.",
    };
  }
  if (chatType === "channel" && status !== "administrator" && status !== "creator") {
    return {
      ok: false as const,
      status: 403,
      error: "Adicione o bot como administrador do canal.",
    };
  }
  if (
    (status === "administrator" || status === "creator") &&
    memberRecord.can_post_messages === false
  ) {
    return {
      ok: false as const,
      status: 403,
      error: "De permissao para postar mensagens.",
    };
  }

  const sendResult = await sendTelegramMessage({
    botToken: cleanToken,
    chatId: cleanChatId,
    message: TELEGRAM_CONNECTION_TEST_MESSAGE,
    buttonLabel: "Abrir Sniper Bo IA",
    buttonUrl: "",
    allowInsecureNodeFallback,
  });

  if (!sendResult.ok) return sendResult;
  if (!sendResult.messageId) {
    return {
      ok: false as const,
      status: 502,
      error: "Telegram aceitou o teste, mas nao retornou message_id. Tente novamente.",
    };
  }

  return sendResult;
}

function normalizeTelegramChatId(value: string) {
  return String(value || "").trim().replace(/\s+/g, "");
}

async function callTelegramJson(
  botToken: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<{ ok: true; result: unknown } | { ok: false; status: number; error: string }> {
  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    return {
      ok: false,
      status: 502,
      error: "Nao foi possivel conectar ao Telegram agora.",
    };
  } finally {
    clearTimeout(timeout);
  }

  const data = readRecord(await response.json().catch(() => ({})));
  if (!response.ok || data.ok !== true) {
    return {
      ok: false,
      status: telegramHttpStatus(response.status),
      error: friendlyTelegramError(response.status, readString(data, "description")),
    };
  }
  return { ok: true, result: data.result };
}

async function issueTelegramChannelValidationCode(env: unknown, userId: string, botToken: string, chatId: string) {
  const bucket = telegramValidationBucket();
  const signature = await telegramChannelValidationSignature(env, userId, botToken, chatId, bucket);
  return signature ? `${bucket}.${signature}` : "";
}

async function verifyTelegramChannelValidationCode(
  env: unknown,
  userId: string,
  botToken: string,
  chatId: string,
  validationCode: string,
) {
  const [bucketText, signature] = validationCode.split(".");
  const bucket = Number(bucketText);
  if (!Number.isFinite(bucket) || !signature) return false;
  const currentBucket = telegramValidationBucket();
  if (bucket < currentBucket - 1 || bucket > currentBucket) return false;
  const expected = await telegramChannelValidationSignature(env, userId, botToken, chatId, bucket);
  return Boolean(expected && constantTimeStringEqual(signature, expected));
}

async function telegramChannelValidationSignature(
  env: unknown,
  userId: string,
  botToken: string,
  chatId: string,
  bucket: number,
) {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  const payload = [
    normalizeValidatorUserId(userId),
    normalizeSecretValue(botToken),
    normalizeValidatorChannelCode(chatId),
    String(bucket),
  ].join("|");
  return bytesToB64Url(await hmacSign(secret, payload));
}

function telegramValidationBucket() {
  return Math.floor(Date.now() / (10 * 60_000));
}

async function sendTelegramMessage({
  botToken,
  chatId,
  message,
  buttonLabel,
  buttonUrl,
  buttons,
  allowInsecureNodeFallback = false,
}: {
  botToken: string;
  chatId: string;
  message: string;
  buttonLabel: string;
  buttonUrl: string;
  buttons?: Array<{ label: string; url: string }>;
  allowInsecureNodeFallback?: boolean;
}): Promise<{ ok: true; messageId: number | null } | { ok: false; status: number; error: string }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text: sanitizeValidatorTelegramOutgoingText(message).slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  const inlineButtons = Array.isArray(buttons)
    ? buttons
        .map((button) => ({
          text: String(button.label || DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL).slice(0, 64),
          url: normalizeTelegramButtonUrl(button.url),
        }))
        .filter((button) => button.text && button.url)
        .slice(0, MAX_VALIDATOR_TELEGRAM_BUTTONS)
    : [];
  if (!inlineButtons.length && buttonUrl) {
    inlineButtons.push({
      text: buttonLabel.slice(0, 64) || "Abrir",
      url: buttonUrl,
    });
  }

  if (inlineButtons.length) {
    payload.reply_markup = {
      inline_keyboard: [inlineButtons],
    };
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch {
    if (allowInsecureNodeFallback) {
      const fallback = await sendTelegramMessageWithNodeHttpsFallback({
        botToken,
        payload,
      });
      if (fallback) return fallback;
    }
    return {
      ok: false,
      status: 502,
      error: "Nao foi possivel conectar ao Telegram agora.",
    };
  } finally {
    clearTimeout(timeout);
  }

  const data = readRecord(await response.json().catch(() => ({})));
  if (!response.ok || data.ok !== true) {
    return {
      ok: false,
      status: telegramHttpStatus(response.status),
      error: friendlyTelegramError(response.status, readString(data, "description")),
    };
  }

  const result = readRecord(data.result);
  const messageId = Number(result.message_id);
  return {
    ok: true,
    messageId: Number.isFinite(messageId) ? messageId : null,
  };
}

async function sendTelegramMessageWithNodeHttpsFallback({
  botToken,
  payload,
}: {
  botToken: string;
  payload: Record<string, unknown>;
}): Promise<{ ok: true; messageId: number | null } | { ok: false; status: number; error: string } | null> {
  if (!isNodeRuntime()) return null;

  try {
    const nodeHttps = await importNodeHttps();
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null || value === "") continue;
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    const body = form.toString();

    return await new Promise((resolve) => {
      const request = nodeHttps.request(
        {
          hostname: "api.telegram.org",
          path: `/bot${botToken}/sendMessage`,
          method: "POST",
          rejectUnauthorized: false,
          timeout: 15000,
          headers: {
            "content-type": "application/x-www-form-urlencoded",
          },
        },
        (response: {
          statusCode?: number;
          setEncoding: (encoding: string) => void;
          on: (event: string, callback: (chunk?: string) => void) => void;
        }) => {
          let responseBody = "";
          response.setEncoding("utf8");
          response.on("data", (chunk = "") => {
            responseBody += chunk;
          });
          response.on("end", () => {
            const data = readRecord(parseJsonSafe(responseBody));
            if (response.statusCode === 200 && data.ok === true) {
              const result = readRecord(data.result);
              const messageId = Number(result.message_id);
              resolve({
                ok: true,
                messageId: Number.isFinite(messageId) ? messageId : null,
              });
              return;
            }
            resolve({
              ok: false,
              status: telegramHttpStatus(response.statusCode || 502),
              error: friendlyTelegramError(response.statusCode || 502, readString(data, "description")),
            });
          });
        },
      );
      request.on("error", () => {
        resolve({
          ok: false,
          status: 502,
          error: "Nao foi possivel conectar ao Telegram agora.",
        });
      });
      request.on("timeout", () => {
        request.destroy();
        resolve({
          ok: false,
          status: 502,
          error: "Tempo esgotado ao conectar no Telegram.",
        });
      });
      request.end(body);
    });
  } catch {
    return null;
  }
}

function isNodeRuntime() {
  const runtime = globalThis as typeof globalThis & {
    process?: { versions?: { node?: string } };
  };
  return Boolean(runtime.process?.versions?.node);
}

async function importNodeHttps(): Promise<{
  request: (...args: unknown[]) => {
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    end: (body?: string) => void;
    destroy: () => void;
  };
}> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  return dynamicImport("node:https") as Promise<{
    request: (...args: unknown[]) => {
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      end: (body?: string) => void;
      destroy: () => void;
    };
  }>;
}

function normalizeTelegramMessage(value: string) {
  return value.replace(/\r\n/g, "\n").trim().slice(0, 4096);
}

function normalizeTelegramButtonUrl(value: string) {
  const clean = value.trim();
  if (!clean) return "";
  try {
    const url = new URL(clean);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function telegramHttpStatus(status: number) {
  if (status === 400 || status === 401 || status === 403 || status === 429) return status;
  return 502;
}

function friendlyTelegramError(status: number, description: string) {
  const text = description.toLowerCase();
  if (status === 401) return "Bot Token invalido.";
  if (status === 403) return "O bot nao tem permissao para enviar nesse canal ou grupo.";
  if (status === 429) return "Telegram limitou os envios. Aguarde e tente novamente.";
  if (text.includes("chat not found")) {
    return "Chat ID nao encontrado. Adicione o bot no canal/grupo e confira o Chat ID.";
  }
  if (text.includes("not enough rights")) {
    return "O bot precisa ser administrador ou ter permissao de publicar mensagens.";
  }
  if (text.includes("can't parse reply keyboard") || text.includes("wrong http url")) {
    return "Link do botao invalido. Use um link com http ou https.";
  }
  return description || "Falha ao enviar mensagem no Telegram.";
}

async function validatorRequestUserId(request: Request, url: URL, env: unknown) {
  const token = getBearerToken(request);
  const session = token ? await verifySessionToken(env, token) : null;
  if (session) {
    const bindingOk = await sessionMatchesRequestBinding(env, request, session);
    if (bindingOk && (session.scope === "client" || session.scope === "owner" || session.scope === "admin_approver")) {
      const requestedUserId = normalizeValidatorUserId(request.headers.get("x-validator-user-id"));
      if (session.scope === "client") {
        const client = findClientByEmail(session.email);
        if (!client || !clientHasLiveAccess(client)) {
          if (client) await syncTelegramEngineUserAccess(env, session.email, client).catch(() => null);
          return "";
        }
        await syncTelegramEngineUserAccess(env, session.email, client).catch(() => null);
        return normalizeValidatorUserId(session.email);
      }
      const effectiveUserId = requestedUserId || normalizeValidatorUserId(session.email);
      if (requestedUserId && requestedUserId !== normalizeValidatorUserId(session.email)) {
        const requestedClient = findClientByEmail(requestedUserId);
        await syncTelegramEngineUserAccess(env, requestedUserId, requestedClient).catch(() => null);
      }
      return effectiveUserId;
    }
  }

  if ((await isDashboardAuthorized(request, url, env)) && isLocalDevelopmentRequest(request)) {
    return normalizeValidatorUserId(request.headers.get("x-validator-user-id") || "local-user");
  }

  return "";
}

function normalizeValidatorUserId(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeServerSavedPattern(value: unknown, userId: string): SavedValidatorPattern | null {
  const record = readRecord(value);
  const normalizedUserId = normalizeValidatorUserId(userId || readString(record, "userId"));
  const pattern = normalizeServerPatternTokens(record.pattern);
  if (!normalizedUserId || !pattern.length) return null;
  const now = new Date().toISOString();
  const validation = normalizeValidatorResult(record.validation);
  const entryType = normalizeValidatorEntryType(record.entryType);
  return {
    id: readString(record, "id") || crypto.randomUUID(),
    userId: normalizedUserId,
    name: readString(record, "name") || "Estrategia Neural",
    tableId: readString(record, "tableId") || "bac-bo",
    pattern,
    entryType,
    pulledSide: normalizeRoundResult(record.pulledSide) || validatorEntrySide(entryType),
    galeLimit: normalizeValidatorGaleLimit(record.galeLimit),
    tieProtection: readBooleanField(record, "tieProtection"),
    destination: normalizeValidatorDestination(record.destination),
    telegramChannelId: readString(record, "telegramChannelId"),
    messageOverride: readString(record, "messageOverride"),
    cooldownRounds: Math.max(0, Math.floor(Number(record.cooldownRounds) || 0)),
    isActive: record.isActive !== false,
    validation,
    currentGreenStreak: Math.max(0, Math.floor(Number(record.currentGreenStreak) || 0)),
    wins: Math.max(0, Math.floor(Number(record.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(record.losses) || 0)),
    lastDetectedAt: readString(record, "lastDetectedAt"),
    lastDetectedRoundId: Number.isFinite(Number(record.lastDetectedRoundId))
      ? Number(record.lastDetectedRoundId)
      : undefined,
    createdAt: readString(record, "createdAt") || now,
    updatedAt: readString(record, "updatedAt") || now,
  };
}

function normalizeServerNotificationChannel(
  value: unknown,
  userId: string,
  existing?: ValidatorNotificationChannel,
): ValidatorNotificationChannel | null {
  const record = readRecord(value);
  const normalizedUserId = normalizeValidatorUserId(userId || readString(record, "userId"));
  if (!normalizedUserId) return null;
  const now = new Date().toISOString();
  const incomingToken = normalizeSecretValue(readString(record, "botToken"));
  const tokenEncoded = incomingToken
    ? encodeServerToken(incomingToken)
    : readString(record, "botTokenEncoded") || existing?.botTokenEncoded || "";
  const decodedToken = decodeServerToken(tokenEncoded);
  const templatesRecord = readRecord(record.templates);
  const existingModules = validatorChannelSignalModules(existing);
  const signalModulesSource = readRecord(record.signalModules);
  const templateModulesSource = readRecord(templatesRecord.signalModules);
  const signalModules = normalizeValidatorChannelSignalModules(
    hasRecordFields(signalModulesSource)
      ? signalModulesSource
      : hasRecordFields(templateModulesSource)
        ? templateModulesSource
        : existingModules,
  );
  return {
    id: readString(record, "id") || crypto.randomUUID(),
    userId: normalizedUserId,
    name: readString(record, "name") || "Canal Telegram",
    botTokenMasked: readString(record, "botTokenMasked") || maskServerBotToken(decodedToken),
    botTokenEncoded: tokenEncoded,
    chatId: readString(record, "chatId"),
    buttonLink: readString(record, "buttonLink"),
    isActive: record.isActive !== false,
    analyzingEnabled: readBooleanField(record, "analyzingEnabled"),
    analyzingCooldownRounds: Math.max(1, Math.floor(Number(record.analyzingCooldownRounds) || 3)),
    templates: {
      ...DEFAULT_VALIDATOR_MESSAGE_TEMPLATES,
      ...templatesRecord,
    },
    signalModules,
    createdAt: readString(record, "createdAt") || now,
    updatedAt: readString(record, "updatedAt") || now,
  } as ValidatorNotificationChannel;
}

function normalizeValidatorChannelSignalModules(value: unknown) {
  const record = readRecord(value);
  return VALIDATOR_TELEGRAM_MODULE_KEYS.reduce<Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>>(
    (acc, key) => {
      const defaults = defaultValidatorTelegramModuleConfig(key);
      const raw = readRecord(record[key]);
      const hasEnabled = Object.prototype.hasOwnProperty.call(raw, "enabled");
      acc[key] = {
        enabled: hasEnabled ? readBooleanField(raw, "enabled") : defaults.enabled,
        entryType: normalizeValidatorModuleEntryType(raw.entryType, defaults.entryType),
        galeLimit: clampValidatorModuleNumber(raw.galeLimit, defaults.galeLimit, 0, 4),
        coverTie: Object.prototype.hasOwnProperty.call(raw, "coverTie")
          ? readBooleanField(raw, "coverTie")
          : defaults.coverTie,
        tieCoverage: clampValidatorModuleNumber(raw.tieCoverage, defaults.tieCoverage, 0, 4),
        cooldownSeconds: clampValidatorModuleNumber(raw.cooldownSeconds, defaults.cooldownSeconds, 0, 300),
        template: resolveValidatorModuleTemplate(key, raw.template, defaults.template),
        analyzingTemplate: readString(raw, "analyzingTemplate") || defaults.analyzingTemplate,
        greenTemplate: readString(raw, "greenTemplate") || defaults.greenTemplate,
        galeTemplate: readString(raw, "galeTemplate") || defaults.galeTemplate,
        redTemplate: readString(raw, "redTemplate") || defaults.redTemplate,
        tieTemplate: readString(raw, "tieTemplate") || defaults.tieTemplate,
        expiredTemplate: readString(raw, "expiredTemplate") || defaults.expiredTemplate,
        canceledTemplate: readString(raw, "canceledTemplate") || defaults.canceledTemplate,
        buttons: normalizeValidatorTelegramButtons(raw.buttons, raw, defaults.buttons),
      };
      return acc;
    },
    {} as Record<ValidatorTelegramModuleKey, ValidatorTelegramModuleConfig>,
  );
}

function resolveValidatorModuleTemplate(key: ValidatorTelegramModuleKey, value: unknown, defaultTemplate: string) {
  const template = readString({ value }, "value");
  return shouldUseDefaultValidatorModuleTemplate(key, template) ? defaultTemplate : template;
}

function shouldUseDefaultValidatorModuleTemplate(_key: ValidatorTelegramModuleKey, template: string) {
  const text = normalizeValidatorModuleTemplateFingerprint(template);
  if (!text) return true;
  return text.includes("ENTRADA CONFIRMADA");
}

function normalizeValidatorModuleTemplateFingerprint(value: string) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function defaultValidatorTelegramModuleConfig(key: ValidatorTelegramModuleKey): ValidatorTelegramModuleConfig {
  return {
    enabled: key === "validator",
    entryType: "AUTO",
    galeLimit: key === "ties_only" ? 0 : 1,
    coverTie: key === "ties_only",
    tieCoverage: key === "ties_only" ? 4 : 1,
    cooldownSeconds: key === "validator" ? 0 : 2,
    template: DEFAULT_VALIDATOR_TELEGRAM_MODULE_TEMPLATES[key],
    analyzingTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_ANALYZING_TEMPLATES[key],
    greenTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GREEN_TEMPLATES[key],
    galeTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_GALE_TEMPLATES[key],
    redTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_RED_TEMPLATES[key],
    tieTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_TIE_TEMPLATES[key],
    expiredTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_EXPIRED_TEMPLATES[key],
    canceledTemplate: DEFAULT_VALIDATOR_TELEGRAM_MODULE_CANCELED_TEMPLATES[key],
    buttons: defaultValidatorTelegramButtons(),
  };
}

function defaultValidatorTelegramButtons(): ValidatorTelegramButtonConfig[] {
  return Array.from({ length: MAX_VALIDATOR_TELEGRAM_BUTTONS }, (_, index) => ({
    enabled: index === 0,
    label: index === 0 ? DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL : "",
    url: "",
  }));
}

function normalizeValidatorTelegramButtons(
  value: unknown,
  legacyRecord: Record<string, unknown> = {},
  fallback: ValidatorTelegramButtonConfig[] = defaultValidatorTelegramButtons(),
): ValidatorTelegramButtonConfig[] {
  const source = Array.isArray(value) ? value.slice(0, MAX_VALIDATOR_TELEGRAM_BUTTONS) : [];
  const normalized = source.map((item) => {
    const record = readRecord(item);
    return {
      enabled: Object.prototype.hasOwnProperty.call(record, "enabled") ? readBooleanField(record, "enabled") : true,
      label: (readString(record, "label") || DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL).slice(0, 64),
      url: readString(record, "url"),
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
          ? readBooleanField(legacyRecord, "buttonEnabled")
          : true,
        label: (readString(legacyRecord, "buttonLabel") || DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL).slice(0, 64),
        url: readString(legacyRecord, "buttonUrl"),
      });
    } else {
      normalized.push(...fallback.map((button) => ({ ...button })));
    }
  }

  while (normalized.length < MAX_VALIDATOR_TELEGRAM_BUTTONS) {
    normalized.push({ enabled: false, label: "", url: "" });
  }
  return normalized.slice(0, MAX_VALIDATOR_TELEGRAM_BUTTONS);
}

function validatorChannelSignalModules(channel?: ValidatorNotificationChannel | null) {
  if (!channel) return normalizeValidatorChannelSignalModules({});
  const record = channel as ValidatorChannelWithModules;
  const templatesRecord = readRecord(channel.templates);
  const modulesRecord = readRecord(record.signalModules);
  const templateModulesRecord = readRecord(templatesRecord.signalModules);
  return normalizeValidatorChannelSignalModules(hasRecordFields(modulesRecord) ? modulesRecord : templateModulesRecord);
}

function validatorChannelActivatesAnyModule(
  current: ValidatorNotificationChannel,
  next: ValidatorNotificationChannel,
) {
  const currentModules = validatorChannelSignalModules(current);
  const nextModules = validatorChannelSignalModules(next);
  return VALIDATOR_TELEGRAM_MODULE_KEYS.some(
    (key) => Boolean(nextModules[key]?.enabled) && !Boolean(currentModules[key]?.enabled),
  );
}

function validatorChannelModuleConfig(channel: ValidatorNotificationChannel, key: ValidatorTelegramModuleKey) {
  return validatorChannelSignalModules(channel)[key] || defaultValidatorTelegramModuleConfig(key);
}

function validatorChannelModuleConfigState(channel: ValidatorNotificationChannel, key: ValidatorTelegramModuleKey) {
  const record = channel as ValidatorChannelWithModules;
  const templatesRecord = readRecord(channel.templates);
  const modulesRecord = readRecord(record.signalModules);
  const templateModulesRecord = readRecord(templatesRecord.signalModules);
  const source = hasRecordFields(modulesRecord)
    ? modulesRecord
    : hasRecordFields(templateModulesRecord)
      ? templateModulesRecord
      : null;
  if (!source || !Object.prototype.hasOwnProperty.call(source, key)) return null;
  return {
    source: hasRecordFields(modulesRecord) ? "channel" : "templates",
    config: normalizeValidatorChannelSignalModules(source)[key],
  };
}

function validatorChannelModuleEnabled(
  channel: ValidatorNotificationChannel,
  key: ValidatorTelegramModuleKey,
  fallbackEnabled = false,
) {
  const rawModules = readRecord((channel as ValidatorChannelWithModules).signalModules);
  const templateModules = readRecord(readRecord(channel.templates).signalModules);
  const hasConfig = hasRecordFields(rawModules) || hasRecordFields(templateModules);
  if (!hasConfig) return fallbackEnabled;
  return Boolean(validatorChannelModuleConfig(channel, key).enabled);
}

function clampValidatorModuleNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeValidatorModuleEntryType(value: unknown, fallback: ValidatorTelegramModuleConfig["entryType"]) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "AUTO" || text === "BANKER" || text === "PLAYER" || text === "TIE") {
    return text as ValidatorTelegramModuleConfig["entryType"];
  }
  return fallback;
}

function normalizeServerPatternTokens(value: unknown): ValidatorPatternToken[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = readRecord(item);
      const side = normalizeRoundResult(record.side);
      if (!side) return null;
      const score = Number(record.score);
      return {
        side,
        ...(Number.isFinite(score) && score > 0 ? { score } : {}),
      };
    })
    .filter((token): token is ValidatorPatternToken => Boolean(token));
}

function normalizeValidatorResult(value: unknown): ValidatorResult | null {
  const record = readRecord(value);
  if (!Object.keys(record).length) return null;
  return {
    totalSignals: Math.max(0, Math.floor(Number(record.totalSignals) || 0)),
    totalValidated: Math.max(0, Math.floor(Number(record.totalValidated) || 0)),
    sgWins: Math.max(0, Math.floor(Number(record.sgWins) || 0)),
    g1Wins: Math.max(0, Math.floor(Number(record.g1Wins) || 0)),
    g2Wins: Math.max(0, Math.floor(Number(record.g2Wins) || 0)),
    losses: Math.max(0, Math.floor(Number(record.losses) || 0)),
    ties: Math.max(0, Math.floor(Number(record.ties) || 0)),
    tieWins: Math.max(0, Math.floor(Number(record.tieWins) || 0)),
    accuracy: readNullableNumber(record.accuracy) ?? undefined,
    sgAccuracy: readNullableNumber(record.sgAccuracy) ?? undefined,
    galeAccuracy: readNullableNumber(record.galeAccuracy) ?? undefined,
    currentGreenStreak: Math.max(0, Math.floor(Number(record.currentGreenStreak) || 0)),
    bestGreenStreak: Math.max(0, Math.floor(Number(record.bestGreenStreak) || 0)),
    bestLossStreak: Math.max(0, Math.floor(Number(record.bestLossStreak) || 0)),
    lastPatternResult: readString(record, "lastPatternResult") || "Sem validacao",
    details: Array.isArray(record.details) ? (record.details.map(readRecord) as ValidatorResult["details"]) : [],
    entry: normalizeRoundResult(record.entry),
    pulledSide: normalizeRoundResult(record.pulledSide),
    risk: ["baixo", "medio", "alto"].includes(readString(record, "risk"))
      ? (readString(record, "risk") as ValidatorResult["risk"])
      : "alto",
    status: ["quente", "estavel", "observacao", "fraco", "sem_amostra"].includes(readString(record, "status"))
      ? (readString(record, "status") as ValidatorResult["status"])
      : "sem_amostra",
    analyzedRounds: Math.max(0, Math.floor(Number(record.analyzedRounds) || 0)),
  };
}

function normalizeValidatorEntryType(value: unknown): ValidatorEntryType {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (
    text === "BANKER" ||
    text === "PLAYER" ||
    text === "TIE" ||
    text === "OPPOSITE" ||
    text === "SAME_LAST" ||
    text === "AI"
  ) {
    return text as ValidatorEntryType;
  }
  return "BANKER";
}

function normalizeValidatorDestination(value: unknown): ValidatorDestination {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "site" || text === "telegram" || text === "site_telegram" || text === "monitor" || text === "disabled") {
    return text as ValidatorDestination;
  }
  return "site";
}

function normalizeValidatorGaleLimit(value: unknown): ValidatorGaleLimit {
  const number = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(2, number)) as ValidatorGaleLimit;
}

function publicValidatorChannel(channel: ValidatorNotificationChannel): ValidatorNotificationChannel {
  return {
    ...channel,
    botTokenEncoded: "",
    botTokenMasked: channel.botTokenMasked || maskServerBotToken(decodeServerToken(channel.botTokenEncoded)),
  };
}

async function hydrateValidatorUserCache(env: unknown, userId: string) {
  if (!getSupabasePersistenceConfig(env)) return;
  const [storedPatterns, storedChannels, durableDeletedRefs] = await Promise.all([
    fetchStoredValidatorPatterns(env, userId),
    fetchStoredValidatorChannels(env, userId),
    fetchValidatorPatternDeletedRefs(env, userId),
  ]);
  const deletedRefs = mergeValidatorPatternDeletedRefs(liveValidatorPatternDeletedRefs, durableDeletedRefs);
  liveValidatorPatternDeletedRefs = deletedRefs;
  const legacyPatterns = liveValidatorPatterns
    .filter((pattern) => pattern.userId === userId)
    .filter((pattern) => !isValidatorPatternDeleted(pattern, deletedRefs));
  const patterns = mergeValidatorEntityList(storedPatterns, legacyPatterns).filter(
    (pattern) => !isValidatorPatternDeleted(pattern, deletedRefs),
  );
  const channels = mergeValidatorChannelList(storedChannels);

  if (!storedPatterns.length && legacyPatterns.length) {
    void Promise.all(legacyPatterns.map((pattern) => persistValidatorPattern(env, pattern)));
  }

  liveValidatorPatterns = [...patterns, ...liveValidatorPatterns.filter((pattern) => pattern.userId !== userId)].slice(
    0,
    5000,
  );
  liveValidatorChannels = [...channels, ...liveValidatorChannels.filter((channel) => channel.userId !== userId)].slice(
    0,
    1000,
  );
}

function mergeValidatorEntityList<T extends { id: string }>(stored: T[], legacy: T[]) {
  const byId = new Map<string, T>();
  for (const item of [...legacy, ...stored]) {
    if (!item.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
      continue;
    }

    const itemIsNewer =
      stateEntityUpdatedAtMs(item as Record<string, unknown>) >=
      stateEntityUpdatedAtMs(existing as Record<string, unknown>);
    const merged = itemIsNewer
      ? mergeStateEntityRecord(existing as Record<string, unknown>, item as Record<string, unknown>)
      : mergeStateEntityRecord(item as Record<string, unknown>, existing as Record<string, unknown>);
    byId.set(item.id, merged as T);
  }

  return [...byId.values()].sort(
    (left, right) =>
      stateEntityUpdatedAtMs(right as Record<string, unknown>) -
      stateEntityUpdatedAtMs(left as Record<string, unknown>),
  );
}

function normalizeValidatorPatternDeletedRefs(value: unknown) {
  const refs = Array.isArray(value) ? value : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of refs.map(readRecord)) {
    const userId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    const patternId = readString(row, "patternId") || readString(row, "pattern_id") || readString(row, "id");
    if (!userId || !patternId) continue;
    const deletedAt = readString(row, "deletedAt") || readString(row, "deleted_at") || new Date().toISOString();
    const key = `${userId}:${patternId}`;
    const current = byKey.get(key);
    if (!current || Date.parse(deletedAt) >= Date.parse(readString(current, "deletedAt"))) {
      byKey.set(key, { userId, patternId, deletedAt });
    }
  }
  return [...byKey.values()].sort(
    (left, right) => Date.parse(readString(right, "deletedAt")) - Date.parse(readString(left, "deletedAt")),
  );
}

function mergeValidatorPatternDeletedRefs(left: unknown, right: unknown) {
  return normalizeValidatorPatternDeletedRefs([
    ...normalizeValidatorPatternDeletedRefs(left),
    ...normalizeValidatorPatternDeletedRefs(right),
  ]).slice(0, 2000);
}

function markValidatorPatternDeleted(userId: string, patternId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedPatternId = readString(patternId);
  if (!normalizedUserId || !normalizedPatternId) return;
  liveValidatorPatternDeletedRefs = mergeValidatorPatternDeletedRefs(liveValidatorPatternDeletedRefs, [
    { userId: normalizedUserId, patternId: normalizedPatternId, deletedAt: new Date().toISOString() },
  ]);
}

function clearValidatorPatternDeleted(userId: string, patternId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedPatternId = readString(patternId);
  if (!normalizedUserId || !normalizedPatternId) return;
  liveValidatorPatternDeletedRefs = liveValidatorPatternDeletedRefs.filter((row) => {
    const rowUserId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    const rowPatternId = readString(row, "patternId") || readString(row, "pattern_id") || readString(row, "id");
    return !(rowUserId === normalizedUserId && rowPatternId === normalizedPatternId);
  });
}

function normalizeValidatorChannelDeletedRefs(value: unknown) {
  const refs = Array.isArray(value) ? value : [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of refs.map(readRecord)) {
    const userId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    const channelId = readString(row, "channelId") || readString(row, "channel_id") || readString(row, "id");
    const chatId = readString(row, "chatId") || readString(row, "chat_id");
    const code = normalizeValidatorChannelCode(readString(row, "code") || chatId);
    if (!userId || (!channelId && !code)) continue;
    const deletedAt = readString(row, "deletedAt") || readString(row, "deleted_at") || new Date().toISOString();
    const key = `${userId}:${channelId}:${code}`;
    const current = byKey.get(key);
    const deletedAtMs = Date.parse(deletedAt);
    const currentDeletedAtMs = Date.parse(readString(current || {}, "deletedAt"));
    if (!current || !Number.isFinite(currentDeletedAtMs) || deletedAtMs >= currentDeletedAtMs) {
      byKey.set(key, {
        type: "validator_channel_deleted",
        userId,
        channelId,
        chatId,
        code,
        deletedAt,
      });
    }
  }
  return [...byKey.values()].sort(
    (left, right) => Date.parse(readString(right, "deletedAt")) - Date.parse(readString(left, "deletedAt")),
  );
}

function mergeValidatorChannelDeletedRefs(left: unknown, right: unknown) {
  return normalizeValidatorChannelDeletedRefs([
    ...normalizeValidatorChannelDeletedRefs(left),
    ...normalizeValidatorChannelDeletedRefs(right),
  ]).slice(0, 2000);
}

function createValidatorChannelDeletedRefLookup(value: unknown, userId?: string) {
  const ids = new Set<string>();
  const codes = new Set<string>();
  const idTimes = new Map<string, number>();
  const codeTimes = new Map<string, number>();
  const normalizedUserId = normalizeValidatorUserId(userId || "");
  for (const row of normalizeValidatorChannelDeletedRefs(value)) {
    const rowUserId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    if (normalizedUserId && rowUserId !== normalizedUserId) continue;
    const channelId = readString(row, "channelId") || readString(row, "channel_id") || readString(row, "id");
    const code = normalizeValidatorChannelCode(readString(row, "code") || readString(row, "chatId"));
    const deletedAt = Date.parse(readString(row, "deletedAt") || readString(row, "deleted_at") || "");
    const deletedAtMs = Number.isFinite(deletedAt) ? deletedAt : Date.now();
    if (channelId) {
      ids.add(channelId);
      idTimes.set(channelId, Math.max(idTimes.get(channelId) || 0, deletedAtMs));
    }
    if (code) {
      codes.add(code);
      codeTimes.set(code, Math.max(codeTimes.get(code) || 0, deletedAtMs));
    }
  }
  return { ids, codes, idTimes, codeTimes };
}

function markValidatorChannelDeletedLive(userId: string, channelIds: string[], chatId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const ids = [...new Set(channelIds.map(readString).filter(Boolean))];
  const normalizedCode = normalizeValidatorChannelCode(chatId);
  if (!normalizedUserId || (!ids.length && !normalizedCode)) return false;
  const now = new Date().toISOString();
  const rows = [
    ...ids.map((channelId) => ({
      type: "validator_channel_deleted",
      userId: normalizedUserId,
      channelId,
      chatId: readString(chatId),
      code: normalizedCode,
      deletedAt: now,
    })),
    normalizedCode
      ? {
          type: "validator_channel_deleted",
          userId: normalizedUserId,
          chatId: readString(chatId),
          code: normalizedCode,
          deletedAt: now,
        }
      : null,
  ].filter(Boolean);
  liveValidatorChannelDeletedRefs = mergeValidatorChannelDeletedRefs(liveValidatorChannelDeletedRefs, rows);
  return true;
}

function clearValidatorChannelDeletedLive(channel: ValidatorNotificationChannel) {
  const userId = normalizeValidatorUserId(channel.userId);
  const channelId = readString(channel.id);
  const code = normalizeValidatorChannelCode(channel.chatId);
  if (!userId || (!channelId && !code)) return;
  liveValidatorChannelDeletedRefs = liveValidatorChannelDeletedRefs.filter((row) => {
    const rowUserId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    const rowChannelId = readString(row, "channelId") || readString(row, "channel_id") || readString(row, "id");
    const rowCode = normalizeValidatorChannelCode(readString(row, "code") || readString(row, "chatId"));
    return !(rowUserId === userId && ((channelId && rowChannelId === channelId) || (code && rowCode === code)));
  });
}

async function markValidatorPatternDeletedDurable(env: unknown, userId: string, patternId: string) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedPatternId = readString(patternId);
  if (!normalizedUserId || !normalizedPatternId) return false;
  return saveDurableLiveStateById(env, validatorPatternDeletedStateId(normalizedUserId, normalizedPatternId), {
    type: "validator_pattern_deleted",
    userId: normalizedUserId,
    patternId: normalizedPatternId,
    deletedAt: new Date().toISOString(),
  });
}

async function fetchValidatorPatternDeletedRefs(env: unknown, userId?: string) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const normalizedUserId = normalizeValidatorUserId(userId || "");
  const prefix = normalizedUserId
    ? `${VALIDATOR_PATTERN_DELETED_STATE_PREFIX}${normalizedUserId}:`
    : VALIDATOR_PATTERN_DELETED_STATE_PREFIX;
  const rows = await fetchSupabaseRows(
    env,
    LIVE_STATE_TABLE,
    `select=id,state,updated_at&id=like.${encodePostgrestLikeValue(`${prefix}*`)}&order=updated_at.desc&limit=5000`,
  );
  return normalizeValidatorPatternDeletedRefs(
    rows.map((row) => {
      const state = readRecord(row.state);
      const rowId = readString(row, "id");
      const parts = rowId.split(":");
      const patternId = readString(state, "patternId") || (parts.length >= 3 ? parts.slice(2).join(":") : "");
      return {
        userId: readString(state, "userId") || normalizedUserId,
        patternId,
        deletedAt: readString(state, "deletedAt") || readString(state, "deleted_at") || readString(row, "updated_at"),
      };
    }),
  );
}

function isValidatorPatternDeleted(
  pattern: Pick<SavedValidatorPattern, "id" | "userId" | "updatedAt"> | Record<string, unknown>,
  refs = liveValidatorPatternDeletedRefs,
) {
  const patternRecord = pattern as Record<string, unknown>;
  const userId = normalizeValidatorUserId(readString(patternRecord, "userId") || readString(patternRecord, "user_id"));
  const patternId =
    readString(patternRecord, "id") ||
    readString(patternRecord, "patternId") ||
    readString(patternRecord, "pattern_id");
  if (!userId || !patternId) return false;
  const updatedAtMs = Date.parse(
    readString(patternRecord, "updatedAt") || readString(patternRecord, "updated_at") || "",
  );
  return normalizeValidatorPatternDeletedRefs(refs).some((row) => {
    const rowUserId = normalizeValidatorUserId(readString(row, "userId") || readString(row, "user_id"));
    const rowPatternId = readString(row, "patternId") || readString(row, "pattern_id") || readString(row, "id");
    if (rowUserId !== userId || rowPatternId !== patternId) return false;
    const deletedAtMs = Date.parse(readString(row, "deletedAt") || readString(row, "deleted_at") || "");
    return !Number.isFinite(updatedAtMs) || !Number.isFinite(deletedAtMs) || updatedAtMs <= deletedAtMs;
  });
}

function mergeValidatorChannelList(...lists: ValidatorNotificationChannel[][]) {
  const byKey = new Map<string, ValidatorNotificationChannel>();
  for (const channel of lists.flat()) {
    if (!channel.id) continue;
    const key = validatorChannelUniqueKey(channel);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, channel);
      continue;
    }

    const channelIsCloud = isCloudValidatorTelegramChannel(channel);
    const existingIsCloud = isCloudValidatorTelegramChannel(existing);
    const channelIsNewer =
      stateEntityUpdatedAtMs(channel as unknown as Record<string, unknown>) >=
      stateEntityUpdatedAtMs(existing as unknown as Record<string, unknown>);
    const preferIncoming = channelIsCloud || (!existingIsCloud && channelIsNewer);
    const merged = preferIncoming
      ? mergeStateEntityRecord(
          existing as unknown as Record<string, unknown>,
          channel as unknown as Record<string, unknown>,
        )
      : mergeStateEntityRecord(
          channel as unknown as Record<string, unknown>,
          existing as unknown as Record<string, unknown>,
        );
    byKey.set(key, merged as unknown as ValidatorNotificationChannel);
  }

  return [...byKey.values()].sort(
    (left, right) =>
      stateEntityUpdatedAtMs(right as unknown as Record<string, unknown>) -
      stateEntityUpdatedAtMs(left as unknown as Record<string, unknown>),
  );
}

function validatorChannelUniqueKey(channel: Pick<ValidatorNotificationChannel, "id" | "userId" | "name" | "chatId">) {
  const userId = normalizeValidatorUserId(channel.userId);
  const chatId = normalizeValidatorChannelCode(channel.chatId);
  if (chatId) return `${userId}:chat:${chatId}`;
  const name = readString(channel.name).trim().toLowerCase();
  return `${userId}:name:${name || readString(channel.id)}`;
}

function normalizeValidatorChannelCode(value: unknown) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function findValidatorChannelByIncomingCode(
  channels: ValidatorNotificationChannel[],
  userId: string,
  incoming: Record<string, unknown>,
) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const incomingCode = normalizeValidatorChannelCode(readString(incoming, "chatId"));
  if (!normalizedUserId || !incomingCode) return null;
  return (
    channels.find(
      (channel) =>
        channel.userId === normalizedUserId && normalizeValidatorChannelCode(channel.chatId) === incomingCode,
    ) || null
  );
}

function validatorChannelRelatedIds(
  channels: ValidatorNotificationChannel[],
  target: Pick<ValidatorNotificationChannel, "id" | "userId" | "name" | "chatId">,
) {
  const key = validatorChannelUniqueKey(target);
  const userId = normalizeValidatorUserId(target.userId);
  return channels
    .filter(
      (channel) =>
        channel.userId === userId && (channel.id === target.id || validatorChannelUniqueKey(channel) === key),
    )
    .map((channel) => channel.id)
    .filter(Boolean);
}

async function refreshValidatorMonitorCache(env: unknown, force = false) {
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  const cloudEngineConfigured = Boolean(getTelegramEngineConfig(env));
  if (!durableConfigured && !cloudEngineConfigured) return;
  const now = Date.now();
  if (!force && validatorMonitorCacheLoadedAt && now - validatorMonitorCacheLoadedAt < VALIDATOR_MONITOR_CACHE_TTL_MS)
    return;
  if (validatorMonitorCachePromise) {
    await validatorMonitorCachePromise;
    return;
  }

  validatorMonitorCachePromise = (async () => {
    const [patterns, channels, notifications] = await Promise.all([
      durableConfigured ? fetchStoredActiveValidatorPatterns(env) : Promise.resolve(liveValidatorPatterns),
      fetchStoredActiveValidatorChannels(env),
      durableConfigured ? fetchStoredRecentValidatorNotifications(env) : Promise.resolve(liveValidatorNotifications),
    ]);
    liveValidatorPatterns = patterns;
    liveValidatorChannels = channels;
    liveValidatorNotifications = notifications;
    console.info(
      JSON.stringify({
        event: "[TELEGRAM_AUTO] canais ativos encontrados",
        cloudEngineConfigured,
        durableConfigured,
        channels: channels.length,
        usableChannels: channels.filter(isUsableValidatorTelegramChannel).length,
        patterns: patterns.length,
        notifications: notifications.length,
      }),
    );
    validatorMonitorCacheLoadedAt = Date.now();
  })().finally(() => {
    validatorMonitorCachePromise = null;
  });
  await validatorMonitorCachePromise;
}

async function fetchStoredValidatorPatterns(env: unknown, userId: string) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const [rows, deletedRefs] = await Promise.all([
    fetchSupabaseRows(
      env,
      VALIDATOR_PATTERNS_TABLE,
      `select=*&user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=1000`,
    ),
    fetchValidatorPatternDeletedRefs(env, userId),
  ]);
  liveValidatorPatternDeletedRefs = mergeValidatorPatternDeletedRefs(liveValidatorPatternDeletedRefs, deletedRefs);
  return rows
    .map(validatorPatternFromRow)
    .filter((pattern): pattern is SavedValidatorPattern => Boolean(pattern))
    .filter((pattern) => !isValidatorPatternDeleted(pattern, liveValidatorPatternDeletedRefs));
}

async function fetchStoredActiveValidatorPatterns(env: unknown) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const [rows, deletedRefs] = await Promise.all([
    fetchSupabaseRows(
      env,
      VALIDATOR_PATTERNS_TABLE,
      "select=*&is_active=eq.true&destination=not.eq.disabled&order=updated_at.desc&limit=5000",
    ),
    fetchValidatorPatternDeletedRefs(env),
  ]);
  liveValidatorPatternDeletedRefs = mergeValidatorPatternDeletedRefs(liveValidatorPatternDeletedRefs, deletedRefs);
  return rows
    .map(validatorPatternFromRow)
    .filter((pattern): pattern is SavedValidatorPattern => Boolean(pattern))
    .filter((pattern) => !isValidatorPatternDeleted(pattern, liveValidatorPatternDeletedRefs));
}

async function fetchStoredValidatorChannel(env: unknown, userId: string, channelId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedChannelId = readString(channelId);
  if (!normalizedUserId || !normalizedChannelId) return null;
  const deletedRefs = await fetchValidatorChannelDeletedRefs(env, normalizedUserId);
  const cloudChannel = (await fetchCloudValidatorChannels(env, normalizedUserId)).find(
    (channel) => channel.id === normalizedChannelId,
  );
  if (cloudChannel && !isValidatorChannelDeleted(cloudChannel, deletedRefs)) return cloudChannel;
  if (!getSupabasePersistenceConfig(env)) return null;

  const [rows, stateChannel] = await Promise.all([
    fetchSupabaseRows(
      env,
      VALIDATOR_CHANNELS_TABLE,
      `select=*&user_id=eq.${encodeURIComponent(normalizedUserId)}&id=eq.${encodeURIComponent(normalizedChannelId)}&limit=1`,
    ),
    fetchValidatorChannelStateChannel(env, normalizedUserId, normalizedChannelId),
  ]);
  const dedicatedChannel =
    rows.map(validatorChannelFromRow).find((channel): channel is ValidatorNotificationChannel => Boolean(channel)) ||
    null;
  return (
    mergeValidatorChannelList(dedicatedChannel ? [dedicatedChannel] : [], stateChannel ? [stateChannel] : []).find(
      (channel) => !isValidatorChannelDeleted(channel, deletedRefs),
    ) || null
  );
}

async function fetchStoredValidatorChannels(env: unknown, userId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  if (!normalizedUserId) return [];
  const cloudChannels = await fetchCloudValidatorChannels(env, normalizedUserId);
  const liveDeletedRefs = await fetchValidatorChannelDeletedRefs(env, normalizedUserId);
  if (!getSupabasePersistenceConfig(env)) {
    return cloudChannels.filter((channel) => !isValidatorChannelDeleted(channel, liveDeletedRefs));
  }
  const [rows, stateChannels, deletedRefs] = await Promise.all([
    fetchSupabaseRows(
      env,
      VALIDATOR_CHANNELS_TABLE,
      `select=*&user_id=eq.${encodeURIComponent(normalizedUserId)}&order=updated_at.desc&limit=1000`,
    ),
    fetchValidatorChannelStateChannels(env, normalizedUserId),
    fetchValidatorChannelDeletedRefs(env, normalizedUserId),
  ]);
  const storedChannels = rows
    .map(validatorChannelFromRow)
    .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel));
  return mergeValidatorChannelList(cloudChannels, storedChannels, stateChannels).filter(
    (channel) => !isValidatorChannelDeleted(channel, deletedRefs),
  );
}

async function fetchRawStoredValidatorChannels(env: unknown, userId: string) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const normalizedUserId = normalizeValidatorUserId(userId);
  if (!normalizedUserId) return [];
  const [rows, stateChannels] = await Promise.all([
    fetchSupabaseRows(
      env,
      VALIDATOR_CHANNELS_TABLE,
      `select=*&user_id=eq.${encodeURIComponent(normalizedUserId)}&order=updated_at.desc&limit=1000`,
    ),
    fetchValidatorChannelStateChannels(env, normalizedUserId),
  ]);
  const storedChannels = rows
    .map(validatorChannelFromRow)
    .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel));
  return [...storedChannels, ...stateChannels].filter((channel) => channel.userId === normalizedUserId);
}

async function findStoredValidatorChannelRelatedIds(
  env: unknown,
  userId: string,
  target: Pick<ValidatorNotificationChannel, "id" | "userId" | "name" | "chatId">,
) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const targetCode = normalizeValidatorChannelCode(target.chatId);
  const targetKey = validatorChannelUniqueKey({ ...target, userId: normalizedUserId });
  if (!normalizedUserId) return [];
  const rawChannels = await fetchRawStoredValidatorChannels(env, normalizedUserId);
  return rawChannels
    .filter((channel) => {
      if (channel.id === target.id) return true;
      if (targetCode && normalizeValidatorChannelCode(channel.chatId) === targetCode) return true;
      return validatorChannelUniqueKey(channel) === targetKey;
    })
    .map((channel) => channel.id)
    .filter(Boolean);
}

async function fetchStoredActiveValidatorChannels(env: unknown) {
  const cloudChannels = await fetchCloudValidatorChannels(env);
  const liveDeletedRefs = await fetchValidatorChannelDeletedRefs(env);
  if (!getSupabasePersistenceConfig(env)) {
    return cloudChannels.filter((channel) => channel.isActive && !isValidatorChannelDeleted(channel, liveDeletedRefs));
  }
  const [rows, stateChannels, deletedRefs] = await Promise.all([
    fetchSupabaseRows(env, VALIDATOR_CHANNELS_TABLE, "select=*&is_active=eq.true&order=updated_at.desc&limit=1000"),
    fetchValidatorChannelStateChannels(env),
    fetchValidatorChannelDeletedRefs(env),
  ]);
  const storedChannels = rows
    .map(validatorChannelFromRow)
    .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel));
  return mergeValidatorChannelList(cloudChannels, storedChannels, stateChannels, liveValidatorChannels).filter(
    (channel) => channel.isActive && !isValidatorChannelDeleted(channel, deletedRefs),
  );
}

async function fetchStoredRecentValidatorNotifications(env: unknown) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const rows = await fetchSupabaseRows(
    env,
    VALIDATOR_NOTIFICATIONS_TABLE,
    "select=*&order=sent_at.desc.nullslast&limit=1000",
  );
  return rows.map(validatorNotificationFromRow).filter(hasRecordFields);
}

async function persistValidatorPattern(env: unknown, pattern: SavedValidatorPattern) {
  if (!getSupabasePersistenceConfig(env)) return false;
  return persistSupabaseRow(env, VALIDATOR_PATTERNS_TABLE, validatorPatternToRow(pattern), "id");
}

async function deleteValidatorPatternRow(env: unknown, userId: string, patternId: string) {
  if (!getSupabasePersistenceConfig(env)) return false;
  await deleteSupabaseRows(
    env,
    VALIDATOR_PATTERNS_TABLE,
    `user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(patternId)}`,
  );
  return true;
}

async function deleteValidatorPatternNotificationRows(env: unknown, userId: string, patternId: string) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedPatternId = readString(patternId);
  if (!normalizedUserId || !normalizedPatternId) return false;
  await deleteSupabaseRows(
    env,
    VALIDATOR_NOTIFICATIONS_TABLE,
    `user_id=eq.${encodeURIComponent(normalizedUserId)}&pattern_id=eq.${encodeURIComponent(normalizedPatternId)}`,
  );
  return true;
}

async function persistValidatorChannel(env: unknown, channel: ValidatorNotificationChannel) {
  if (!getSupabasePersistenceConfig(env)) return false;
  await clearValidatorChannelDeletedState(env, channel);
  const [dedicated, state] = await Promise.all([
    persistSupabaseRow(env, VALIDATOR_CHANNELS_TABLE, validatorChannelToRow(channel), "id"),
    persistValidatorChannelState(env, channel),
  ]);
  return dedicated || state;
}

async function deleteValidatorChannelRow(env: unknown, userId: string, channelId: string) {
  return deleteValidatorChannelRows(env, userId, [channelId]);
}

async function deleteValidatorChannelRows(env: unknown, userId: string, channelIds: string[]) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const ids = [...new Set(channelIds.map(readString).filter(Boolean))];
  if (!normalizedUserId || !ids.length) return false;
  const results = await Promise.allSettled(
    ids.map(async (channelId) => {
      await Promise.allSettled([
        deleteSupabaseRows(
          env,
          VALIDATOR_CHANNELS_TABLE,
          `user_id=eq.${encodeURIComponent(normalizedUserId)}&id=eq.${encodeURIComponent(channelId)}`,
        ),
        deleteValidatorChannelState(env, normalizedUserId, channelId),
      ]);
    }),
  );
  return results.some((result) => result.status === "fulfilled");
}

async function deleteValidatorChannelNotificationRows(env: unknown, userId: string, channelIds: string[]) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const ids = [...new Set(channelIds.map(readString).filter(Boolean))];
  if (!normalizedUserId || !ids.length) return false;
  const results = await Promise.allSettled(
    ids.map((channelId) =>
      deleteSupabaseRows(
        env,
        VALIDATOR_NOTIFICATIONS_TABLE,
        `user_id=eq.${encodeURIComponent(normalizedUserId)}&channel_id=eq.${encodeURIComponent(channelId)}`,
      ),
    ),
  );
  return results.some((result) => result.status === "fulfilled");
}

async function deleteValidatorChannelsByCode(env: unknown, userId: string, chatId: string) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedCode = normalizeValidatorChannelCode(chatId);
  if (!normalizedUserId || !normalizedCode) return false;

  const rawChannels = await fetchRawStoredValidatorChannels(env, normalizedUserId);
  const ids = rawChannels
    .filter((channel) => normalizeValidatorChannelCode(channel.chatId) === normalizedCode)
    .map((channel) => channel.id)
    .filter(Boolean);

  await Promise.allSettled([
    deleteValidatorChannelRows(env, normalizedUserId, ids),
    deleteValidatorChannelNotificationRows(env, normalizedUserId, ids),
    deleteSupabaseRows(
      env,
      VALIDATOR_CHANNELS_TABLE,
      `user_id=eq.${encodeURIComponent(normalizedUserId)}&chat_id=eq.${encodeURIComponent(chatId)}`,
    ),
  ]);
  return true;
}

async function persistValidatorChannelState(env: unknown, channel: ValidatorNotificationChannel) {
  return saveDurableLiveStateById(env, validatorChannelStateId(channel.userId, channel.id), {
    type: "validator_channel",
    channel,
    savedAt: new Date().toISOString(),
  });
}

async function deleteValidatorChannelState(env: unknown, userId: string, channelId: string) {
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedChannelId = readString(channelId);
  if (!normalizedUserId || !normalizedChannelId) return false;
  await deleteSupabaseRows(
    env,
    LIVE_STATE_TABLE,
    `id=eq.${encodeURIComponent(validatorChannelStateId(normalizedUserId, normalizedChannelId))}`,
  );
  return true;
}

async function clearValidatorChannelDeletedState(env: unknown, channel: ValidatorNotificationChannel) {
  clearValidatorChannelDeletedLive(channel);
  if (!getSupabasePersistenceConfig(env)) return true;
  const ids = [
    validatorChannelDeletedStateId(channel.userId, channel.id),
    validatorChannelDeletedCodeStateId(channel.userId, channel.chatId),
  ].filter(Boolean);
  if (!ids.length) return false;
  await Promise.allSettled(
    ids.map((id) => deleteSupabaseRows(env, LIVE_STATE_TABLE, `id=eq.${encodeURIComponent(id)}`)),
  );
  return true;
}

async function markValidatorChannelsDeleted(env: unknown, userId: string, channelIds: string[], chatId: string) {
  const liveMarked = markValidatorChannelDeletedLive(userId, channelIds, chatId);
  if (!getSupabasePersistenceConfig(env)) return liveMarked;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const ids = [...new Set(channelIds.map(readString).filter(Boolean))];
  const normalizedCode = normalizeValidatorChannelCode(chatId);
  if (!normalizedUserId || (!ids.length && !normalizedCode)) return false;
  const now = new Date().toISOString();
  const results = await Promise.allSettled([
    ...ids.map((channelId) =>
      saveDurableLiveStateById(env, validatorChannelDeletedStateId(normalizedUserId, channelId), {
        type: "validator_channel_deleted",
        userId: normalizedUserId,
        channelId,
        chatId: readString(chatId),
        code: normalizedCode,
        deletedAt: now,
      }),
    ),
    normalizedCode
      ? saveDurableLiveStateById(env, validatorChannelDeletedCodeStateId(normalizedUserId, chatId), {
          type: "validator_channel_deleted",
          userId: normalizedUserId,
          chatId: readString(chatId),
          code: normalizedCode,
          deletedAt: now,
        })
      : Promise.resolve(false),
  ]);
  return liveMarked || results.some((result) => result.status === "fulfilled" && result.value);
}

async function fetchValidatorChannelStateChannels(env: unknown, userId?: string) {
  if (!getSupabasePersistenceConfig(env)) return [];
  const prefix = userId
    ? `${VALIDATOR_CHANNEL_STATE_PREFIX}${normalizeValidatorUserId(userId)}:`
    : VALIDATOR_CHANNEL_STATE_PREFIX;
  const rows = await fetchSupabaseRows(
    env,
    LIVE_STATE_TABLE,
    `select=id,state&id=like.${encodePostgrestLikeValue(`${prefix}*`)}&order=updated_at.desc&limit=1000`,
  );
  return rows
    .map(validatorChannelFromStateRow)
    .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel));
}

async function fetchValidatorChannelStateChannel(env: unknown, userId: string, channelId: string) {
  if (!getSupabasePersistenceConfig(env)) return null;
  const normalizedUserId = normalizeValidatorUserId(userId);
  const normalizedChannelId = readString(channelId);
  if (!normalizedUserId || !normalizedChannelId) return null;
  const deletedState = await loadDurableLiveStateById(
    env,
    validatorChannelDeletedStateId(normalizedUserId, normalizedChannelId),
  );
  if (deletedState && hasRecordFields(deletedState)) return null;
  const state = await loadDurableLiveStateById(env, validatorChannelStateId(normalizedUserId, normalizedChannelId));
  return state ? validatorChannelFromStateRecord(state) : null;
}

async function fetchValidatorChannelDeletedIds(env: unknown, userId?: string) {
  return (await fetchValidatorChannelDeletedRefs(env, userId)).ids;
}

async function fetchValidatorChannelDeletedRefs(env: unknown, userId?: string) {
  const liveRefs = createValidatorChannelDeletedRefLookup(liveValidatorChannelDeletedRefs, userId);
  if (!getSupabasePersistenceConfig(env)) return liveRefs;
  const normalizedUserId = normalizeValidatorUserId(userId || "");
  const prefix = normalizedUserId
    ? `${VALIDATOR_CHANNEL_DELETED_STATE_PREFIX}${normalizedUserId}:`
    : VALIDATOR_CHANNEL_DELETED_STATE_PREFIX;
  const rows = await fetchSupabaseRows(
    env,
    LIVE_STATE_TABLE,
    `select=id,state&id=like.${encodePostgrestLikeValue(`${prefix}*`)}&order=updated_at.desc&limit=1000`,
  );
  const durableRefs = rows.map((row) => {
    const state = readRecord(row.state);
    const rowId = readString(row, "id");
    const parts = rowId.split(":");
    const codeFromId = parts.length >= 4 && parts[2] === "code" ? parts.slice(3).join(":") : "";
    const idFromId = parts.length >= 3 && parts[2] !== "code" ? parts.slice(2).join(":") : "";
    const channelId = readString(state, "channelId") || idFromId;
    const code = normalizeValidatorChannelCode(readString(state, "code") || readString(state, "chatId") || codeFromId);
    return {
      type: "validator_channel_deleted",
      userId: readString(state, "userId") || (parts.length >= 2 ? parts[1] : ""),
      channelId,
      chatId: readString(state, "chatId"),
      code,
      deletedAt: readString(state, "deletedAt") || readString(state, "deleted_at") || readString(row, "updated_at"),
    };
  });
  liveValidatorChannelDeletedRefs = mergeValidatorChannelDeletedRefs(
    liveValidatorChannelDeletedRefs,
    durableRefs,
  );
  return createValidatorChannelDeletedRefLookup(liveValidatorChannelDeletedRefs, userId);
}

function isValidatorChannelDeleted(
  channel: ValidatorNotificationChannel,
  deletedRefs: {
    ids: Set<string>;
    codes: Set<string>;
    idTimes?: Map<string, number>;
    codeTimes?: Map<string, number>;
  },
) {
  const code = normalizeValidatorChannelCode(channel.chatId);
  if (!deletedRefs.ids.has(channel.id) && !(code && deletedRefs.codes.has(code))) return false;
  const channelTime = stateEntityUpdatedAtMs(channel as unknown as Record<string, unknown>);
  const idDeletedAt =
    deletedRefs.idTimes?.get(channel.id) || (deletedRefs.ids.has(channel.id) ? Number.MAX_SAFE_INTEGER : 0);
  const codeDeletedAt = code
    ? deletedRefs.codeTimes?.get(code) || (deletedRefs.codes.has(code) ? Number.MAX_SAFE_INTEGER : 0)
    : 0;
  return Boolean(
    (idDeletedAt && (!channelTime || channelTime <= idDeletedAt)) ||
    (codeDeletedAt && (!channelTime || channelTime <= codeDeletedAt)),
  );
}

function isLocallyDeletedValidatorChannel(
  channel: ValidatorNotificationChannel,
  deletedRefs: {
    ids: Set<string>;
    codes: Set<string>;
    idTimes?: Map<string, number>;
    codeTimes?: Map<string, number>;
  },
) {
  if (isCloudValidatorTelegramChannel(channel)) return false;
  return isValidatorChannelDeleted(channel, deletedRefs);
}

function validatorChannelStateId(userId: string, channelId: string) {
  return `${VALIDATOR_CHANNEL_STATE_PREFIX}${normalizeValidatorUserId(userId)}:${readString(channelId)}`;
}

function validatorPatternDeletedStateId(userId: string, patternId: string) {
  return `${VALIDATOR_PATTERN_DELETED_STATE_PREFIX}${normalizeValidatorUserId(userId)}:${readString(patternId)}`;
}

function validatorChannelDeletedStateId(userId: string, channelId: string) {
  return `${VALIDATOR_CHANNEL_DELETED_STATE_PREFIX}${normalizeValidatorUserId(userId)}:${readString(channelId)}`;
}

function validatorChannelDeletedCodeStateId(userId: string, chatId: string) {
  const code = normalizeValidatorChannelCode(chatId);
  return code ? `${VALIDATOR_CHANNEL_DELETED_STATE_PREFIX}${normalizeValidatorUserId(userId)}:code:${code}` : "";
}

function encodePostgrestLikeValue(value: string) {
  return encodeURIComponent(value).replace(/%2A/gi, "*");
}

async function persistValidatorNotification(env: unknown, notification: Record<string, unknown>) {
  if (!getSupabasePersistenceConfig(env)) return false;
  return persistSupabaseRow(env, VALIDATOR_NOTIFICATIONS_TABLE, validatorNotificationToRow(notification), "id");
}

async function reserveValidatorNotificationDedupe(env: unknown, notification: Record<string, unknown>) {
  const config = getSupabasePersistenceConfig(env);
  const row = validatorNotificationToRow(notification);
  const id = readString(row, "id");
  if (!config) {
    return {
      ok: false as const,
      reserved: false,
      duplicate: false,
      status: 503,
      action: "error",
      error: "Supabase dedupe persistence unavailable.",
    };
  }
  if (!id) {
    return {
      ok: false as const,
      reserved: false,
      duplicate: false,
      status: 400,
      action: "error",
      error: "Dedupe id obrigatorio.",
    };
  }

  try {
    const response = await fetch(
      `${config.url}/rest/v1/${VALIDATOR_NOTIFICATIONS_TABLE}?on_conflict=id`,
      {
        method: "POST",
        headers: {
          ...supabasePersistenceHeaders(config.key),
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates,return=representation",
        },
        body: JSON.stringify(row),
      },
    );
    const data = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      return {
        ok: false as const,
        reserved: false,
        duplicate: false,
        status: response.status,
        action: "error",
        error: readString(readRecord(data), "message") || `Supabase dedupe retornou ${response.status}.`,
      };
    }
    const rows = Array.isArray(data) ? data.map(readRecord) : [];
    const reserved = rows.some((item) => readString(item, "id") === id);
    if (!reserved) {
      const retry = await retryReserveValidatorNotificationDedupe(config, row, id);
      if (retry.reserved || retry.error) return retry;
    }
    return {
      ok: true as const,
      reserved,
      duplicate: !reserved,
      status: response.status,
      action: reserved ? "reserved" : "duplicate",
      error: "",
    };
  } catch (error) {
    return {
      ok: false as const,
      reserved: false,
      duplicate: false,
      status: 502,
      action: "error",
      error: errorMessage(error),
    };
  }
}

async function retryReserveValidatorNotificationDedupe(
  config: { url: string; key: string },
  row: Record<string, unknown>,
  id: string,
) {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - VALIDATOR_TELEGRAM_DEDUPE_RESERVATION_TTL_MS).toISOString();
  const payloadJson = readRecord(row.payload_json);
  const retryRow = {
    ...row,
    status: "reserved",
    error: "",
    payload_json: {
      ...payloadJson,
      retryAllowedAt: now,
      retryReason: "previous_error_or_stale_reservation",
    },
    updated_at: now,
  };
  const filters = [
    {
      action: "retry_allowed_error",
      query: `id=eq.${encodeURIComponent(id)}&status=eq.error`,
    },
    {
      action: "retry_allowed_stale_reserved",
      query: `id=eq.${encodeURIComponent(id)}&status=eq.reserved&updated_at=lt.${encodeURIComponent(cutoff)}`,
    },
  ];

  for (const filter of filters) {
    try {
      const response = await fetch(`${config.url}/rest/v1/${VALIDATOR_NOTIFICATIONS_TABLE}?${filter.query}`, {
        method: "PATCH",
        headers: {
          ...supabasePersistenceHeaders(config.key),
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(retryRow),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        return {
          ok: false as const,
          reserved: false,
          duplicate: false,
          status: response.status,
          action: "error",
          error: readString(readRecord(data), "message") || `Supabase retry dedupe retornou ${response.status}.`,
        };
      }
      const rows = Array.isArray(data) ? data.map(readRecord) : [];
      if (rows.some((item) => readString(item, "id") === id)) {
        return {
          ok: true as const,
          reserved: true,
          duplicate: false,
          status: response.status,
          action: filter.action,
          error: "",
        };
      }
    } catch (error) {
      return {
        ok: false as const,
        reserved: false,
        duplicate: false,
        status: 502,
        action: "error",
        error: errorMessage(error),
      };
    }
  }

  return {
    ok: true as const,
    reserved: false,
    duplicate: true,
    status: 200,
    action: "duplicate",
    error: "",
  };
}

function validatorPatternToRow(pattern: SavedValidatorPattern) {
  return {
    id: pattern.id,
    user_id: pattern.userId,
    name: pattern.name,
    table_id: pattern.tableId,
    pattern_json: pattern.pattern,
    entry_type: pattern.entryType,
    pulled_side: pattern.pulledSide,
    gale_limit: Number(pattern.galeLimit) || 0,
    tie_protection: Boolean(pattern.tieProtection),
    destination: pattern.destination,
    telegram_channel_id: pattern.telegramChannelId,
    message_override: pattern.messageOverride || "",
    cooldown_rounds: Math.max(0, Math.floor(Number(pattern.cooldownRounds) || 0)),
    is_active: Boolean(pattern.isActive),
    validation_json: pattern.validation || null,
    current_green_streak: Math.max(0, Math.floor(Number(pattern.currentGreenStreak) || 0)),
    wins: Math.max(0, Math.floor(Number(pattern.wins) || 0)),
    losses: Math.max(0, Math.floor(Number(pattern.losses) || 0)),
    last_detected_at: pattern.lastDetectedAt || null,
    last_detected_round_id: pattern.lastDetectedRoundId ?? null,
    created_at: pattern.createdAt || new Date().toISOString(),
    updated_at: pattern.updatedAt || new Date().toISOString(),
  };
}

function validatorPatternFromRow(row: Record<string, unknown>) {
  const id = readString(row, "id");
  const userId = readString(row, "user_id") || readString(row, "userId");
  if (!id || !userId) return null;
  return normalizeServerSavedPattern(
    {
      id,
      userId,
      name: readString(row, "name"),
      tableId: readString(row, "table_id"),
      pattern: row.pattern_json,
      entryType: readString(row, "entry_type"),
      pulledSide: readString(row, "pulled_side"),
      galeLimit: row.gale_limit,
      tieProtection: row.tie_protection,
      destination: readString(row, "destination"),
      telegramChannelId: readString(row, "telegram_channel_id"),
      messageOverride: readString(row, "message_override"),
      cooldownRounds: row.cooldown_rounds,
      isActive: row.is_active,
      validation: row.validation_json,
      currentGreenStreak: row.current_green_streak,
      wins: row.wins,
      losses: row.losses,
      lastDetectedAt: readString(row, "last_detected_at"),
      lastDetectedRoundId: row.last_detected_round_id,
      createdAt: readString(row, "created_at"),
      updatedAt: readString(row, "updated_at"),
    },
    userId,
  );
}

function validatorChannelToRow(channel: ValidatorNotificationChannel) {
  const signalModules = validatorChannelSignalModules(channel);
  return {
    id: channel.id,
    user_id: channel.userId,
    name: channel.name,
    bot_token_masked: channel.botTokenMasked,
    bot_token_encoded: channel.botTokenEncoded,
    chat_id: channel.chatId,
    button_link: channel.buttonLink,
    is_active: Boolean(channel.isActive),
    analyzing_enabled: Boolean(channel.analyzingEnabled),
    analyzing_cooldown_rounds: Math.max(1, Math.floor(Number(channel.analyzingCooldownRounds) || 3)),
    templates_json: {
      ...channel.templates,
      signalModules,
    },
    created_at: channel.createdAt || new Date().toISOString(),
    updated_at: channel.updatedAt || new Date().toISOString(),
  };
}

function validatorChannelFromRow(row: Record<string, unknown>) {
  const id = readString(row, "id");
  const userId = readString(row, "user_id") || readString(row, "userId");
  if (!id || !userId) return null;
  const templatesRecord = readRecord(row.templates_json);
  return normalizeServerNotificationChannel(
    {
      id,
      userId,
      name: readString(row, "name"),
      botTokenMasked: readString(row, "bot_token_masked"),
      botTokenEncoded: readString(row, "bot_token_encoded"),
      chatId: readString(row, "chat_id"),
      buttonLink: readString(row, "button_link"),
      isActive: row.is_active,
      analyzingEnabled: row.analyzing_enabled,
      analyzingCooldownRounds: row.analyzing_cooldown_rounds,
      templates: templatesRecord,
      signalModules: templatesRecord.signalModules,
      createdAt: readString(row, "created_at"),
      updatedAt: readString(row, "updated_at"),
    },
    userId,
  );
}

function validatorChannelFromStateRow(row: Record<string, unknown>) {
  return validatorChannelFromStateRecord(readRecord(row.state));
}

function validatorChannelFromStateRecord(state: Record<string, unknown>) {
  const channelRecord = readRecord(state.channel || state.validatorChannel);
  const idFromState = readString(channelRecord, "id") || readString(state, "channelId");
  const userIdFromState = readString(channelRecord, "userId") || readString(state, "userId");
  if (!idFromState || !userIdFromState) return null;
  return normalizeServerNotificationChannel(
    {
      ...channelRecord,
      id: idFromState,
      userId: userIdFromState,
      signalModules: channelRecord.signalModules || readRecord(channelRecord.templates).signalModules,
    },
    userIdFromState,
  );
}

function validatorNotificationToRow(notification: Record<string, unknown>) {
  const sentAt = readString(notification, "sentAt") || readString(notification, "sent_at") || new Date().toISOString();
  return {
    id: readString(notification, "id") || crypto.randomUUID(),
    type: readString(notification, "type") || "entry",
    user_id: readString(notification, "userId") || readString(notification, "user_id"),
    pattern_id: readString(notification, "patternId") || readString(notification, "pattern_id"),
    channel_id: readString(notification, "channelId") || readString(notification, "channel_id"),
    round_id: Math.floor(Number(notification.roundId ?? notification.round_id) || 0),
    status: readString(notification, "status") || "sent",
    error: readString(notification, "error"),
    payload_json: readRecord(notification.payload_json || notification.payloadJson),
    sent_at: sentAt,
    updated_at: readString(notification, "updatedAt") || readString(notification, "updated_at") || sentAt,
  };
}

function validatorNotificationFromRow(row: Record<string, unknown>) {
  return {
    id: readString(row, "id"),
    type: readString(row, "type") || "entry",
    userId: readString(row, "user_id"),
    patternId: readString(row, "pattern_id"),
    channelId: readString(row, "channel_id"),
    roundId: Math.floor(Number(row.round_id) || 0),
    status: readString(row, "status"),
    error: readString(row, "error"),
    payloadJson: readRecord(row.payload_json || row.payloadJson),
    sentAt: readString(row, "sent_at"),
    updatedAt: readString(row, "updated_at"),
  };
}

function mergeValidatorNotifications(
  primary: Array<Record<string, unknown>>,
  secondary: Array<Record<string, unknown>>,
) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const notification of [...secondary, ...primary].map(readRecord)) {
    const id = readString(notification, "id");
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || validatorNotificationTimeMs(notification) >= validatorNotificationTimeMs(existing)) {
      byId.set(id, notification);
    }
  }
  return [...byId.values()];
}

function validatorNotificationTimeMs(notification: Record<string, unknown>) {
  const sentAt =
    readString(notification, "updatedAt") ||
    readString(notification, "updated_at") ||
    readString(notification, "sentAt") ||
    readString(notification, "sent_at");
  const time = Date.parse(sentAt);
  return Number.isFinite(time) ? time : 0;
}

function publicValidatorNotification(notification: Record<string, unknown>) {
  const payloadJson = readRecord(notification.payloadJson || notification.payload_json);
  return {
    id: readString(notification, "id"),
    type: readString(notification, "type") || "entry",
    userId: normalizeValidatorUserId(readString(notification, "userId") || readString(notification, "user_id")),
    channelId: readString(notification, "channelId") || readString(notification, "channel_id"),
    roundId: Math.floor(Number(notification.roundId ?? notification.round_id) || 0),
    status: readString(notification, "status"),
    error: readString(notification, "error"),
    payloadJson,
    sentAt: readString(notification, "sentAt") || readString(notification, "sent_at"),
    updatedAt: readString(notification, "updatedAt") || readString(notification, "updated_at"),
  };
}

function upsertValidatorPattern(pattern: SavedValidatorPattern) {
  clearValidatorPatternDeleted(pattern.userId, pattern.id);
  const current = liveValidatorPatterns.filter((item) => !(item.userId === pattern.userId && item.id === pattern.id));
  return [pattern, ...current].slice(0, 5000);
}

function upsertValidatorChannel(channel: ValidatorNotificationChannel) {
  const current = liveValidatorChannels.filter((item) => !(item.userId === channel.userId && item.id === channel.id));
  return [channel, ...current].slice(0, 1000);
}

function encodeServerToken(token: string) {
  const clean = token.trim();
  if (!clean) return "";
  const bytes = new TextEncoder().encode(clean);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeServerToken(encoded: string) {
  if (!encoded) return "";
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes).trim();
  } catch {
    return "";
  }
}

function maskServerBotToken(token: string) {
  const clean = token.trim();
  if (!clean) return "";
  if (clean.length <= 10) return `${clean.slice(0, 3)}...`;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

type ValidatorMonitorOptions = {
  allowInsecureTelegramFallback?: boolean;
  fast?: boolean;
  roundReceivedAtMs?: number;
};

async function processValidatorLiveMonitoring(env: unknown, options: ValidatorMonitorOptions = {}) {
  const hasWarmMonitorCache = liveValidatorChannels.some(isUsableValidatorTelegramChannel);
  console.info(
    JSON.stringify({
      event: "[TELEGRAM_AUTO] monitor iniciado",
      monitor_called: true,
      fast: Boolean(options.fast),
      cachedChannels: liveValidatorChannels.length,
      usableCachedChannels: liveValidatorChannels.filter(isUsableValidatorTelegramChannel).length,
      cachedPatterns: liveValidatorPatterns.length,
      willRefresh: true,
    }),
  );
  await withTimeout(
    refreshValidatorMonitorCache(env, true),
    LIVE_STATE_IO_TIMEOUT_MS,
    "carregar monitor do Validador",
    undefined,
  );
  if (Array.isArray(liveDashboardData.rounds) && liveDashboardData.rounds.length) {
    liveValidatorRoundHistory = mergeMonitorRoundHistory(liveValidatorRoundHistory, liveDashboardData.rounds);
  }
  const latestRound = liveValidatorRoundHistory.at(-1);
  if (!latestRound) return false;
  const suppressInitialOfficialSignals = !validatorOfficialDispatchersBootstrapped && !options.roundReceivedAtMs;
  validatorOfficialDispatchersBootstrapped = true;
  console.info(
    JSON.stringify({
      event: "[TELEGRAM_AUTO] card detectado",
      roundId: latestRound.id,
      aiEntryAlerts: Array.isArray(readRecord(liveDashboardData.patternMinerSnapshot || liveDashboardData.patternMiner).entryAlerts)
        ? readRecord(liveDashboardData.patternMinerSnapshot || liveDashboardData.patternMiner).entryAlerts.length
        : 0,
      neuralMode: liveDashboardData.neuralReading?.mode || "",
      neuralStatus: liveDashboardData.neuralReading?.paganteStatus || "",
      suppressInitialOfficialSignals,
      tieStatus: readString(readRecord(liveDashboardData.currentTieAlert), "status"),
      surfAlert: Boolean(readRecord(liveDashboardData.currentSurfAlert).surf_alert),
    }),
  );

  let changed = false;
  const entryChannelKeys = new Set<string>();
  const entrySendTasks: Array<() => Promise<boolean>> = buildValidatorModuleTelegramSendTasks(
    env,
    latestRound,
    entryChannelKeys,
    options,
    { suppressInitialOfficialSignals },
  );
  for (const pattern of liveValidatorPatterns) {
    if (!shouldMonitorValidatorPattern(pattern, latestRound)) continue;
    const matchedRounds = liveValidatorRoundHistory.slice(-pattern.pattern.length);
    if (!matchesServerValidatorPattern(matchedRounds, pattern.pattern)) continue;

    const matchedAtMs = Date.now();
    const detectedAt = new Date(matchedAtMs).toISOString();
    pattern.lastDetectedAt = detectedAt;
    pattern.lastDetectedRoundId = latestRound.id;
    pattern.updatedAt = detectedAt;
    void persistValidatorPattern(env, pattern);
    changed = true;

    if (!validatorPatternAllowsTelegramForward(pattern)) continue;
    const channel = findValidatorTelegramChannelForPattern(pattern);
    if (!channel) continue;
    if (!validatorChannelModuleEnabled(channel, "validator", true)) continue;
    if (validatorChannelModuleCoolingDown(channel, "validator", matchedAtMs)) continue;
    entryChannelKeys.add(validatorChannelKey(channel));
    const notificationKey = `${pattern.userId}:${pattern.id}:${channel.id}:${latestRound.id}`;
    if (validatorNotificationAlreadySent(notificationKey)) continue;
    entrySendTasks.push(() =>
      sendValidatorEntryTelegramNotification(
        env,
        pattern,
        channel,
        latestRound.id,
        notificationKey,
        detectedAt,
        matchedAtMs,
        options,
      ),
    );
  }

  if (entrySendTasks.length) {
    const results = await runLimitedValidatorTelegramSends(entrySendTasks);
    changed = results.some(Boolean) || changed;
  }
  const resultChanged = await processValidatorTelegramResultMessages(env, latestRound, options);
  changed = changed || resultChanged;
  const analysisChanged = await sendValidatorAnalyzingMessages(env, latestRound, entryChannelKeys, options);
  changed = changed || analysisChanged;

  return changed;
}

async function sendValidatorEntryTelegramNotification(
  env: unknown,
  pattern: SavedValidatorPattern,
  channel: ValidatorNotificationChannel,
  roundId: number,
  notificationKey: string,
  detectedAt: string,
  matchedAtMs: number,
  options: ValidatorMonitorOptions,
) {
  const roundReceivedAtMs = options.roundReceivedAtMs || matchedAtMs;
  const telegramSendStartedAtMs = Date.now();
  const message = buildServerValidatorTelegramMessage(pattern, channel);
  const entrySide = pattern.pulledSide || validatorEntrySide(pattern.entryType) || "B";
  const moduleConfig = validatorChannelModuleConfig(channel, "validator");
  const buttons = validatorModuleTelegramButtons(moduleConfig, channel);
  const result = isCloudValidatorTelegramChannel(channel)
    ? await sendTelegramEngineSignal(env, {
        userId: pattern.userId,
        channelId: channel.id,
        moduleKey: "validator",
        signalKey: notificationKey,
        roundId,
        entry: entrySide,
        message,
        variables: buildServerValidatorTelegramVariables(pattern, channel),
        buttons,
        forceMessage: true,
      })
    : await sendTelegramMessage({
        botToken: decodeServerToken(channel.botTokenEncoded),
        chatId: channel.chatId,
        message,
        buttonLabel: "Abrir Sniper Bo IA",
        buttonUrl: normalizeTelegramButtonUrl(channel.buttonLink),
        buttons,
        allowInsecureNodeFallback: Boolean(options.allowInsecureTelegramFallback),
      });
  const telegramRespondedAtMs = Date.now();
  const latency = {
    roundReceivedAt: new Date(roundReceivedAtMs).toISOString(),
    patternMatchedAt: new Date(matchedAtMs).toISOString(),
    telegramSendStartedAt: new Date(telegramSendStartedAtMs).toISOString(),
    telegramRespondedAt: new Date(telegramRespondedAtMs).toISOString(),
    roundToMatchMs: Math.max(0, matchedAtMs - roundReceivedAtMs),
    matchToTelegramStartMs: Math.max(0, telegramSendStartedAtMs - matchedAtMs),
    telegramApiMs: Math.max(0, telegramRespondedAtMs - telegramSendStartedAtMs),
    totalMs: Math.max(0, telegramRespondedAtMs - roundReceivedAtMs),
    targetMs: VALIDATOR_TELEGRAM_TARGET_MS,
  };
  logValidatorTelegramLatency(pattern, channel, roundId, result.ok ? "sent" : "error", latency);
  const notification = {
    id: notificationKey,
    type: "entry",
    userId: pattern.userId,
    patternId: pattern.id,
    channelId: channel.id,
    roundId,
    status: result.ok ? "sent" : "error",
    error: result.ok ? "" : result.error,
    payloadJson: {
      moduleKey: "validator",
      entry: pattern.pulledSide
        ? formatServerTelegramSide(pattern.pulledSide)
        : formatServerTelegramSide(validatorEntrySide(pattern.entryType) || "B"),
      protection: formatValidatorModuleGale(pattern.galeLimit),
      result: "Aguardando resultado",
      pattern: pattern.pattern,
      percentage: formatServerPercent(pattern.validation?.accuracy),
      latency,
      telegramMessageId: result.ok ? result.messageId : null,
      targetExceeded: latency.totalMs > VALIDATOR_TELEGRAM_TARGET_MS,
    },
    sentAt: detectedAt,
    updatedAt: new Date(telegramRespondedAtMs).toISOString(),
  };
  liveValidatorNotifications = [
    notification,
    ...liveValidatorNotifications.filter((item) => readString(item, "id") !== notificationKey),
  ].slice(0, 1000);
  void persistValidatorNotification(env, notification);
  return true;
}

function buildValidatorModuleTelegramSendTasks(
  env: unknown,
  latestRound: Round,
  entryChannelKeys: Set<string>,
  options: ValidatorMonitorOptions,
  dispatcherOptions: { suppressInitialOfficialSignals?: boolean } = {},
) {
  const tasks: Array<() => Promise<boolean>> = buildPayingNumbersTelegramSendTasks(
    env,
    latestRound,
    entryChannelKeys,
    options,
    dispatcherOptions,
  );
  for (const channel of liveValidatorChannels) {
    if (!isUsableValidatorTelegramChannel(channel)) continue;
    for (const moduleKey of VALIDATOR_TELEGRAM_MODULE_KEYS) {
      if (moduleKey === "validator" || moduleKey === "paying_numbers") continue;
      if (!validatorChannelModuleEnabled(channel, moduleKey, false)) continue;
      const signal = buildValidatorChannelModuleSignal(channel, moduleKey, latestRound);
      if (!signal) continue;
      if (shouldSuppressInitialOfficialSignal(signal, dispatcherOptions.suppressInitialOfficialSignals)) {
        console.info(
          JSON.stringify({
            event: "[TELEGRAM_AUTO] sinal inicial bloqueado",
            moduleKey,
            channelId: channel.id,
            signalKey: signal.signalKey,
            dedupeKey: signal.notificationKey,
            reason: "initial_active_state",
          }),
        );
        continue;
      }
      if (validatorNotificationAlreadySent(signal.notificationKey)) {
        continue;
      }
      if (validatorChannelModuleCoolingDown(channel, moduleKey, signal.matchedAtMs)) {
        continue;
      }
      entryChannelKeys.add(validatorChannelKey(channel));
      tasks.push(() => sendValidatorModuleTelegramNotification(env, signal, options));
    }
  }
  return tasks;
}

function shouldSuppressInitialOfficialSignal(
  signal: ValidatorTelegramModuleSignal,
  suppressInitialOfficialSignals = false,
) {
  if (suppressInitialOfficialSignals) {
    validatorInitialOfficialSignalKeys.add(signal.notificationKey);
    return true;
  }
  return validatorInitialOfficialSignalKeys.has(signal.notificationKey);
}

function buildValidatorChannelModuleSignal(
  channel: ValidatorNotificationChannel,
  moduleKey: ValidatorTelegramModuleKey,
  latestRound: Round,
): ValidatorTelegramModuleSignal | null {
  if (moduleKey === "ai_patterns") return buildAiPatternsModuleSignal(channel, latestRound);
  if (moduleKey === "surf_alert") return buildSurfAlertModuleSignal(channel, latestRound);
  if (moduleKey === "ties_only") return buildTiesOnlyModuleSignal(channel, latestRound);
  return null;
}

function buildAiPatternsModuleSignal(channel: ValidatorNotificationChannel, latestRound: Round) {
  const moduleConfig = validatorChannelModuleConfig(channel, "ai_patterns");
  const confirmed = readDashboardConfirmedAiPattern();
  if (!confirmed) return null;
  if (!validatorModuleAllowsRoundEntry(moduleConfig, confirmed.entry)) return null;
  return createValidatorModuleSignal(
    channel,
    "ai_patterns",
    latestRound,
    `ai-dashboard:${confirmed.eventId}`,
    {
      table: "Bac Bo",
      pattern: confirmed.sequenceText,
      entry: formatServerTelegramSide(confirmed.entry),
      entryLabel: formatServerSideLabel(confirmed.entry),
      entryCompact: formatServerCompactSide(confirmed.entry),
      gale: formatValidatorModuleGale(moduleConfig.galeLimit),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      tieCoverage: String(moduleConfig.tieCoverage),
      tieProtection: moduleConfig.coverTie ? "Ativa" : "Inativa",
      confidence: formatServerPercent(confirmed.assertiveness),
      percentage: formatServerPercent(confirmed.assertiveness),
      status: confirmed.status,
      risk: confirmed.status,
      number: "",
      level: "",
      round: String(latestRound.id),
      module: "Padroes IA",
    },
    {
      pattern: confirmed.sequenceText,
      entry: confirmed.entry,
      entryText: formatServerTelegramSide(confirmed.entry),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      result: "Aguardando resultado",
      accuracy: confirmed.assertiveness ?? null,
      status: confirmed.status,
    },
  );
}

function readDashboardConfirmedAiPattern() {
  const snapshot = readRecord(liveDashboardData.patternMinerSnapshot || liveDashboardData.patternMiner);
  const entryAlerts = Array.isArray(snapshot.entryAlerts) ? snapshot.entryAlerts.map(readRecord) : [];
  const alert = entryAlerts.find((item) => {
    const kind = readString(item, "kind");
    const title = readString(item, "title").toLowerCase();
    return kind === "validated" || title.includes("validado") || title.includes("confirmado");
  });
  if (!alert) return null;

  const strategy = readRecord(alert.strategy);
  const expected = normalizeRoundResult(strategy.expectedResult);
  if (!expected) return null;
  const sequence = Array.isArray(strategy.sequence) ? strategy.sequence.map(String).map((item) => item.trim()).filter(Boolean) : [];
  if (!sequence.length) return null;
  const matchedRounds = Array.isArray(alert.matchedRounds) ? alert.matchedRounds.map(readRecord) : [];
  const lastMatchedRound = matchedRounds.at(-1) || {};
  const lastMatchedRoundId =
    readString(lastMatchedRound, "id") ||
    readString(lastMatchedRound, "roundId") ||
    readString(lastMatchedRound, "round_id") ||
    readString(lastMatchedRound, "time");
  const alertId = readString(alert, "id") || readString(strategy, "id") || sequence.join(">");
  const eventId = [alertId, lastMatchedRoundId, expected, sequence.join(">")].filter(Boolean).join(":");
  return {
    id: readString(strategy, "id") || sequence.join(">"),
    eventId,
    entry: expected,
    sequenceText: formatServerTelegramSequenceText(sequence),
    assertiveness: readNullableNumber(strategy.assertiveness) ?? undefined,
    status: readString(strategy, "status") || "CONFIRMADO",
  };
}

function buildPayingNumbersTelegramSendTasks(
  env: unknown,
  latestRound: Round,
  entryChannelKeys: Set<string>,
  options: ValidatorMonitorOptions,
  dispatcherOptions: { suppressInitialOfficialSignals?: boolean } = {},
) {
  const tasks: Array<() => Promise<boolean>> = [];
  const channels = liveValidatorChannels
    .filter(isUsableValidatorTelegramChannel)
    .filter((channel) => validatorChannelModuleEnabled(channel, "paying_numbers", false));
  const card = readServerPayingNumbersConfirmedCard(liveDashboardData.neuralReading ?? null, latestRound);

  console.info(
    JSON.stringify({
      event: "[NUMEROS_PAGANTES] detectado",
      moduleKey: "paying_numbers",
      handler_called: true,
      roundId: latestRound.id,
      activeChannels: channels.length,
      confirmed: card.confirmed,
      reason: card.confirmed ? "confirmed_entry_card" : card.reason,
      readingMode: card.mode,
      cardStatus: card.status,
      numero: card.numero,
      expectedSide: card.side || "",
      signalId: card.signalKey || "",
      telegram_send_called: false,
    }),
  );

  if (!card.confirmed) {
    for (const channel of channels) {
      logPayingNumbersTelegramDecision(channel, "blocked", card.reason, {
        moduleKey: "paying_numbers",
        roundId: latestRound.id,
        readingMode: card.mode,
        cardStatus: card.status,
        numero: card.numero,
        expectedSide: card.side || "",
        signalId: card.signalKey || "",
        dedupe_action: "not_checked",
        telegram_send_called: false,
        telegram_result: "not_called",
      });
    }
    return tasks;
  }

  for (const channel of channels) {
    const moduleConfig = validatorChannelModuleConfig(channel, "paying_numbers");
    if (!validatorModuleAllowsSignalEntry(moduleConfig, card.side)) {
      logPayingNumbersTelegramDecision(channel, "blocked", "entry_not_allowed", {
        moduleKey: "paying_numbers",
        roundId: latestRound.id,
        signalId: card.signalKey,
        expectedSide: card.side,
        allowedEntry: moduleConfig.entryType,
        dedupe_action: "not_checked",
        telegram_send_called: false,
        telegram_result: "not_called",
      });
      continue;
    }

    const signal = createPayingNumbersModuleSignal(channel, moduleConfig, latestRound, card);
    if (shouldSuppressInitialOfficialSignal(signal, dispatcherOptions.suppressInitialOfficialSignals)) {
      logPayingNumbersTelegramDecision(channel, "blocked", "initial_active_state", {
        moduleKey: signal.moduleKey,
        roundId: latestRound.id,
        signalId: signal.signalKey,
        dedupeKey: signal.notificationKey,
        dedupe_action: "baseline_suppressed",
        telegram_send_called: false,
        telegram_result: "not_called",
      });
      continue;
    }
    if (validatorNotificationAlreadySent(signal.notificationKey)) {
      logPayingNumbersTelegramDecision(channel, "blocked", "duplicate_signal", {
        moduleKey: signal.moduleKey,
        roundId: latestRound.id,
        signalId: signal.signalKey,
        dedupeKey: signal.notificationKey,
        dedupe_action: "memory_sent_duplicate",
        telegram_send_called: false,
        telegram_result: "not_called",
      });
      continue;
    }
    if (validatorChannelModuleCoolingDown(channel, "paying_numbers", signal.matchedAtMs)) {
      logPayingNumbersTelegramDecision(channel, "blocked", "cooldown_active", {
        moduleKey: signal.moduleKey,
        roundId: latestRound.id,
        signalId: signal.signalKey,
        cooldownSeconds: moduleConfig.cooldownSeconds,
        dedupe_action: "not_checked",
        telegram_send_called: false,
        telegram_result: "not_called",
      });
      continue;
    }

    console.info(
      JSON.stringify({
        event: "[NUMEROS_PAGANTES] confirmado",
        user: maskTelemetryUserId(channel.userId),
        channelId: channel.id,
        moduleKey: signal.moduleKey,
        roundId: latestRound.id,
        signalId: signal.signalKey,
        dedupeKey: signal.notificationKey,
        expectedSide: card.side,
        entryText: formatServerSignalSide(card.side),
        dedupe_action: "pending_reservation",
        telegram_send_called: false,
      }),
    );
    entryChannelKeys.add(validatorChannelKey(channel));
    tasks.push(() => sendValidatorModuleTelegramNotification(env, signal, options));
  }
  return tasks;
}

type ServerPayingNumbersConfirmedCard =
  | {
      confirmed: true;
      reason: "confirmed_entry_card";
      reading: NeuralReading;
      key: string;
      signalKey: string;
      side: NonNullable<NeuralEntryState["expectedSide"]>;
      mode: NeuralReading["mode"];
      numero: number | null;
      status: string;
    }
  | {
      confirmed: false;
      reason: string;
      reading: NeuralReading | null;
      key: string;
      signalKey: string;
      side: NeuralEntryState["expectedSide"];
      mode: string;
      numero: number | null;
      status: string;
    };

function readServerPayingNumbersConfirmedCard(
  reading: NeuralReading | null,
  latestRound: Round,
): ServerPayingNumbersConfirmedCard {
  const side = reading ? readServerNeuralSide(reading.direcao ?? reading.origem) : null;
  const key = reading ? serverPayingNumbersReadingKey(reading, side) : "";
  const mode = reading?.mode || "";
  const numero = typeof reading?.numero === "number" ? reading.numero : null;
  const status = String(reading?.paganteStatus || "");
  const signalKey = key ? `paying:Bac Bo:${key}:round:${latestRound.id}:side:${side}` : "";

  if (!reading) {
    return { confirmed: false, reason: "site_reading_missing", reading, key, signalKey, side, mode, numero, status };
  }
  if (!isServerPayingNumbersCardConfirmed(reading, side)) {
    return { confirmed: false, reason: "card_not_confirmed", reading, key, signalKey, side, mode, numero, status };
  }
  if (!key || !signalKey || !side) {
    return { confirmed: false, reason: "missing_signal_key", reading, key, signalKey, side, mode, numero, status };
  }
  return { confirmed: true, reason: "confirmed_entry_card", reading, key, signalKey, side, mode: reading.mode, numero, status };
}

function createPayingNumbersModuleSignal(
  channel: ValidatorNotificationChannel,
  moduleConfig: ValidatorTelegramModuleConfig,
  latestRound: Round,
  card: Extract<ServerPayingNumbersConfirmedCard, { confirmed: true }>,
) {
  return createValidatorModuleSignal(
    channel,
    "paying_numbers",
    latestRound,
    card.signalKey,
    {
      table: "Bac Bo",
      pattern: "",
      entry: formatServerSignalSide(card.side),
      entryLabel: formatServerSideLabel(card.side),
      entryCompact: formatServerCompactSide(card.side),
      gale: formatValidatorModuleGale(moduleConfig.galeLimit),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      tieCoverage: moduleConfig.coverTie ? String(moduleConfig.tieCoverage) : "0",
      tieProtection: moduleConfig.coverTie ? "Ativa" : "Inativa",
      confidence: formatServerPercent(serverReadOptionalNumber(card.reading.assertividade)),
      percentage: formatServerPercent(serverReadOptionalNumber(card.reading.assertividade)),
      status: card.status || "ENTRADA_CONFIRMADA",
      risk: serverReadPaganteKind(card.reading),
      number: typeof card.reading.numero === "number" ? `${serverSignalCircle(card.side)}${card.reading.numero}` : "",
      level: "",
      round: String(latestRound.id),
      module: "Numeros Pagantes",
    },
    {
      key: card.key,
      mesa: "Bac Bo",
      numero: card.numero,
      expectedSide: card.side,
      entryText: formatServerSignalSide(card.side),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      coverTie: moduleConfig.coverTie,
      tieCoverage: moduleConfig.coverTie ? moduleConfig.tieCoverage : 0,
      result: "Aguardando resultado",
      status: card.status || "ENTRADA_CONFIRMADA",
      source: "site_neuralReading",
      confirmedEntryCard: true,
    },
  );
}

function isServerPayingNumbersCardConfirmed(
  reading: NeuralReading,
  expectedSide: NeuralEntryState["expectedSide"],
) {
  return reading.mode === "ACTIVE" && Boolean(expectedSide);
}

function serverPayingNumbersReadingKey(reading: NeuralReading, expectedSide: NeuralEntryState["expectedSide"]) {
  const numero = typeof reading.numero === "number" ? String(reading.numero) : "";
  const origem = readServerNeuralSide(reading.origem) || "";
  const origemTipo = readServerNeuralOriginKind(reading.origemTipo) || "SEM_TIPO";
  const validade = String(reading.validade || "G1").trim().toUpperCase();
  if (!numero || !origem || !expectedSide) return "";
  return `${numero}:${origem}:${origemTipo}:${expectedSide}:${validade}`;
}

function buildSurfAlertModuleSignal(channel: ValidatorNotificationChannel, latestRound: Round) {
  const alert = readRecord(liveDashboardData.currentSurfAlert);
  if (!hasRecordFields(alert)) return null;
  const side = normalizeSignalSide(alert.surf_prediction_side || alert.surf_side || alert.side || alert.entry);
  if (!isServerEntrySide(side)) return null;
  const moduleConfig = validatorChannelModuleConfig(channel, "surf_alert");
  if (!validatorModuleAllowsSignalEntry(moduleConfig, side)) return null;
  const risk = clampPercent(alert.surf_break_risk ?? alert.surf_risk ?? alert.risk ?? 0);
  const confidence = clampPercent(alert.surf_confidence ?? alert.confidence ?? alert.confianca ?? risk);
  const statusText = serverNormalizeText(alert.surf_status || alert.status || alert.phase || alert.surf_phase);
  const active = Boolean(
    readBooleanField(alert, "surf_alert") ||
    statusText.includes("ATIVO") ||
    statusText.includes("ACTIVE") ||
    statusText.includes("CONFIRM") ||
    statusText.includes("ALERTA") ||
    risk >= 70,
  );
  if (!active) return null;
  return createValidatorModuleSignal(
    channel,
    "surf_alert",
    latestRound,
    `surf:${readString(alert, "id") || latestRound.id}:${side}:${Math.round(risk)}`,
    {
      table: "Bac Bo",
      pattern: "",
      entry: formatServerSignalSide(side),
      entryLabel: formatServerSideLabel(side),
      entryCompact: formatServerCompactSide(side),
      gale: formatValidatorModuleGale(moduleConfig.galeLimit),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      tieCoverage: String(moduleConfig.tieCoverage),
      tieProtection: moduleConfig.coverTie ? "Ativa" : "Inativa",
      confidence: formatServerPercent(confidence),
      percentage: formatServerPercent(confidence),
      status: statusText || "CONFIRMADO",
      risk: formatServerPercent(risk),
      number: "",
      level: statusText || "",
      round: String(latestRound.id),
      module: "Aviso de Surf",
    },
    {
      side,
      entryText: formatServerSignalSide(side),
      protection: formatValidatorModuleGale(moduleConfig.galeLimit),
      result: "Aguardando resultado",
      risk,
      confidence,
      status: statusText,
    },
  );
}

function buildTiesOnlyModuleSignal(channel: ValidatorNotificationChannel, latestRound: Round) {
  const alert = readRecord(liveDashboardData.currentTieAlert);
  if (!hasRecordFields(alert)) return null;
  const status = readString(alert, "status");
  if (status !== "active") return null;
  const moduleConfig = validatorChannelModuleConfig(channel, "ties_only");
  if (!validatorModuleAllowsSignalEntry(moduleConfig, "TIE")) return null;
  const confidence = clampPercent(alert.confidence ?? alert.confianca ?? 0);
  const level = readString(alert, "level") || readString(alert, "nivel") || "ativo";
  return createValidatorModuleSignal(
    channel,
    "ties_only",
    latestRound,
    `tie:${readString(alert, "id") || latestRound.id}:${level}:${Math.round(confidence)}`,
    {
      table: "Bac Bo",
      pattern: "",
      entry: formatServerSignalSide("TIE"),
      entryLabel: formatServerSideLabel("TIE"),
      entryCompact: formatServerCompactSide("TIE"),
      gale: formatValidatorModuleGale(moduleConfig.galeLimit),
      protection: moduleConfig.coverTie ? `G${moduleConfig.tieCoverage}` : formatValidatorModuleGale(moduleConfig.galeLimit),
      tieCoverage: String(moduleConfig.tieCoverage),
      confidence: formatServerPercent(confidence),
      percentage: formatServerPercent(confidence),
      status,
      risk: level,
      number: "",
      level,
      round: String(latestRound.id),
      module: "Somente Empates",
    },
    {
      level,
      confidence,
      entryText: formatServerSignalSide("TIE"),
      protection: moduleConfig.coverTie ? `G${moduleConfig.tieCoverage}` : "SG",
      result: "Aguardando resultado",
      tieCoverage: moduleConfig.tieCoverage,
    },
  );
}

function createValidatorModuleSignal(
  channel: ValidatorNotificationChannel,
  moduleKey: ValidatorTelegramModuleKey,
  latestRound: Round,
  signalKey: string,
  variables: Record<string, string>,
  payloadJson: Record<string, unknown>,
): ValidatorTelegramModuleSignal {
  const moduleConfig = validatorChannelModuleConfig(channel, moduleKey);
  const matchedAtMs = Date.now();
  const detectedAt = new Date(matchedAtMs).toISOString();
  const signalHash = hashServerText(signalKey);
  return {
    moduleKey,
    channel,
    signalKey,
    notificationKey: `module:${channel.id}:${moduleKey}:${signalHash}`,
    roundId: latestRound.id,
    message: renderValidatorTelegramTemplate(moduleConfig.template, variables),
    detectedAt,
    matchedAtMs,
    payloadJson: {
      moduleKey,
      signalKey,
      ...variables,
      entry: variables.entry,
      protection: variables.protection || variables.gale,
      result: "Aguardando resultado",
      ...payloadJson,
    },
  };
}

async function sendValidatorModuleTelegramNotification(
  env: unknown,
  signal: ValidatorTelegramModuleSignal,
  options: ValidatorMonitorOptions,
) {
  const telegramSendStartedAtMs = Date.now();
  const moduleConfig = validatorChannelModuleConfig(signal.channel, signal.moduleKey);
  const buttons = validatorModuleTelegramButtons(moduleConfig, signal.channel);
  const reservedAt = new Date().toISOString();
  const reservation = {
    id: signal.notificationKey,
    type: `module:${signal.moduleKey}`,
    userId: signal.channel.userId,
    channelId: signal.channel.id,
    roundId: signal.roundId,
    status: "reserved",
    error: "",
    payloadJson: {
      ...signal.payloadJson,
      dedupeKey: signal.notificationKey,
      dedupeShape: "channelId+module+signalId",
      reservedAt,
    },
    sentAt: signal.detectedAt,
    updatedAt: reservedAt,
  };
  const reservationResult = await reserveValidatorNotificationDedupe(env, reservation);
  if (!reservationResult.ok || !reservationResult.reserved) {
    const reason = reservationResult.duplicate ? "persistent_duplicate" : "dedupe_persistence_unavailable";
    console.warn(
      JSON.stringify({
        event: "[TELEGRAM_AUTO] envio bloqueado por dedupe persistente",
        user: maskTelemetryUserId(signal.channel.userId),
        channelId: signal.channel.id,
        moduleKey: signal.moduleKey,
        roundId: signal.roundId,
        signalKey: signal.signalKey,
        dedupeKey: signal.notificationKey,
        dedupe_action: reservationResult.action || reason,
        telegram_send_called: false,
        telegram_result: "not_called",
        status: reservationResult.status,
        reason,
        error: reservationResult.error,
      }),
    );
    if (signal.moduleKey === "paying_numbers") {
      logPayingNumbersTelegramDecision(signal.channel, "blocked", reason, {
        moduleKey: signal.moduleKey,
        roundId: signal.roundId,
        signalId: signal.signalKey,
        dedupeKey: signal.notificationKey,
        dedupe_action: reservationResult.action || reason,
        telegram_send_called: false,
        telegram_result: "not_called",
        status: reservationResult.status,
        error: reservationResult.error,
      });
    }
    return false;
  }
  liveValidatorNotifications = [
    reservation,
    ...liveValidatorNotifications.filter((item) => readString(item, "id") !== signal.notificationKey),
  ].slice(0, 1000);
  console.info(
    JSON.stringify({
      event: "[TELEGRAM_AUTO] enviando",
      user: maskTelemetryUserId(signal.channel.userId),
      channelId: signal.channel.id,
      moduleKey: signal.moduleKey,
      roundId: signal.roundId,
      signalId: signal.signalKey,
      dedupeKey: signal.notificationKey,
      dedupe_action: reservationResult.action || "reserved",
      telegram_send_called: true,
    }),
  );
  const result = isCloudValidatorTelegramChannel(signal.channel)
    ? await sendTelegramEngineSignal(env, {
        userId: signal.channel.userId,
        channelId: signal.channel.id,
        moduleKey: signal.moduleKey,
        signalKey: signal.signalKey,
        roundId: signal.roundId,
        entry:
          readString(signal.payloadJson, "expectedSide") ||
          readString(signal.payloadJson, "side") ||
          readString(signal.payloadJson, "entry"),
        message: signal.message,
        result: readString(signal.payloadJson, "result") || "Aguardando resultado",
        protection: readString(signal.payloadJson, "protection") || readString(signal.payloadJson, "gale"),
        variables: validatorTelegramPayloadVariables(signal.moduleKey, signal.payloadJson, {
          label: readString(signal.payloadJson, "result") || "Aguardando resultado",
          roundId: signal.roundId,
          tieMultiplier: "",
        }),
        buttons,
        forceMessage: true,
      })
    : await sendTelegramMessage({
        botToken: decodeServerToken(signal.channel.botTokenEncoded),
        chatId: signal.channel.chatId,
        message: signal.message,
        buttonLabel: "Abrir Sniper Bo IA",
        buttonUrl: normalizeTelegramButtonUrl(signal.channel.buttonLink),
        buttons,
        allowInsecureNodeFallback: Boolean(options.allowInsecureTelegramFallback),
      });
  const telegramRespondedAtMs = Date.now();
  console[result.ok ? "info" : "warn"](
    JSON.stringify({
      event: result.ok ? "[TELEGRAM_AUTO] enviado com sucesso" : "[TELEGRAM_AUTO] erro: motivo completo",
      user: maskTelemetryUserId(signal.channel.userId),
      channelId: signal.channel.id,
      moduleKey: signal.moduleKey,
      roundId: signal.roundId,
      signalId: signal.signalKey,
      dedupeKey: signal.notificationKey,
      dedupe_action: reservationResult.action || "reserved",
      telegram_send_called: true,
      telegram_result: result.ok ? "success" : "error",
      status: result.status,
      telegramMessageId: result.ok ? result.messageId : null,
      error: result.ok ? "" : result.error,
    }),
  );
  const latency = {
    roundReceivedAt: options.roundReceivedAtMs ? new Date(options.roundReceivedAtMs).toISOString() : "",
    moduleMatchedAt: new Date(signal.matchedAtMs).toISOString(),
    telegramSendStartedAt: new Date(telegramSendStartedAtMs).toISOString(),
    telegramRespondedAt: new Date(telegramRespondedAtMs).toISOString(),
    matchToTelegramStartMs: Math.max(0, telegramSendStartedAtMs - signal.matchedAtMs),
    telegramApiMs: Math.max(0, telegramRespondedAtMs - telegramSendStartedAtMs),
  };
  const notification = {
    id: signal.notificationKey,
    type: `module:${signal.moduleKey}`,
    userId: signal.channel.userId,
    channelId: signal.channel.id,
    roundId: signal.roundId,
    status: result.ok ? "sent" : "error",
    error: result.ok ? "" : result.error,
    payloadJson: {
      ...signal.payloadJson,
      latency,
      telegramMessageId: result.ok ? result.messageId : null,
    },
    sentAt: signal.detectedAt,
    updatedAt: new Date(telegramRespondedAtMs).toISOString(),
  };
  liveValidatorNotifications = [
    notification,
    ...liveValidatorNotifications.filter((item) => readString(item, "id") !== signal.notificationKey),
  ].slice(0, 1000);
  void persistValidatorNotification(env, notification).then((saved) => {
    if (saved) return;
    console.warn(
      JSON.stringify({
        event: "[TELEGRAM_AUTO] dedupe persistente reservado mas atualizacao final falhou",
        channelId: signal.channel.id,
        moduleKey: signal.moduleKey,
        roundId: signal.roundId,
        signalKey: signal.signalKey,
        dedupeKey: signal.notificationKey,
      }),
    );
  });
  if (signal.moduleKey === "paying_numbers") {
    logPayingNumbersTelegramDecision(
      signal.channel,
      result.ok ? "sent" : "blocked",
      result.ok ? "sent_to_telegram" : "telegram_error",
      {
        moduleKey: signal.moduleKey,
        roundId: signal.roundId,
        signalId: signal.signalKey,
        dedupe_action: reservationResult.action || "reserved",
        telegram_send_called: true,
        telegram_result: result.ok ? "success" : "error",
        telegramMessageId: result.ok ? result.messageId : null,
        error: result.ok ? "" : result.error,
      },
    );
  }
  return true;
}

async function processValidatorTelegramResultMessages(
  env: unknown,
  latestRound: Round,
  options: ValidatorMonitorOptions,
) {
  const tasks: Array<() => Promise<boolean>> = [];
  for (const notification of liveValidatorNotifications) {
    const pending = readPendingValidatorTelegramEntry(notification);
    if (!pending) continue;
    const outcome = resolveValidatorTelegramEntryOutcome(notification);
    if (!outcome) continue;
    const channel = findValidatorTelegramChannelForNotification(notification);
    if (!channel) continue;
    const resultNotificationKey = `${pending.id}:result:${outcome.status}:${outcome.roundId}`;
    if (validatorNotificationAlreadySent(resultNotificationKey)) continue;
    tasks.push(() =>
      sendValidatorTelegramResultNotification(
        env,
        notification,
        channel,
        outcome,
        resultNotificationKey,
        latestRound,
        options,
      ),
    );
  }
  if (!tasks.length) return false;
  const results = await runLimitedValidatorTelegramSends(tasks);
  return results.some(Boolean);
}

function readPendingValidatorTelegramEntry(notification: Record<string, unknown>) {
  const id = readString(notification, "id");
  const type = readString(notification, "type") || "entry";
  const status = readString(notification, "status");
  const payloadJson = readRecord(notification.payloadJson || notification.payload_json);
  if (!id || status !== "sent") return null;
  if (isValidatorResultNotification(notification)) return null;
  if (type !== "entry" && !type.startsWith("module:")) return null;
  const result = readString(payloadJson, "result").toLowerCase();
  if (result && !result.includes("aguardando")) return null;
  return { id, type, payloadJson };
}

function resolveValidatorTelegramEntryOutcome(notification: Record<string, unknown>) {
  const payloadJson = readRecord(notification.payloadJson || notification.payload_json);
  const entry = readValidatorTelegramEntrySide(payloadJson);
  if (!entry) return null;
  const triggerRoundId = Math.floor(Number(notification.roundId ?? notification.round_id) || 0);
  const triggerIndex = findValidatorRoundIndexById(triggerRoundId);
  if (triggerIndex < 0) return null;
  const maxGale = readValidatorProtectionGale(payloadJson.protection || payloadJson.gale);
  let attempts = 0;
  for (const round of liveValidatorRoundHistory.slice(triggerIndex + 1)) {
    if (round.result === "T") {
      const tieMultiplier = formatServerTieMultiplier(round);
      const tieLabel = tieMultiplier ? `Green no empate ${tieMultiplier}` : "Green no empate";
      return {
        status: "TIE",
        label: tieLabel,
        roundId: round.id,
        galeUsed: attempts,
        tieMultiplier,
      };
    }
    if (round.result === entry) {
      return {
        status: attempts <= 0 ? "GREEN_SG" : `GREEN_G${Math.min(4, attempts)}`,
        label: attempts <= 0 ? "Green" : `Green G${Math.min(4, attempts)}`,
        roundId: round.id,
        galeUsed: attempts,
        tieMultiplier: "",
      };
    }
    attempts += 1;
    if (attempts > maxGale) {
      return {
        status: "RED",
        label: "Red",
        roundId: round.id,
        galeUsed: maxGale,
        tieMultiplier: "",
      };
    }
  }
  return null;
}

async function sendValidatorTelegramResultNotification(
  env: unknown,
  originalNotification: Record<string, unknown>,
  channel: ValidatorNotificationChannel,
  outcome: {
    status: string;
    label: string;
    roundId: number;
    galeUsed: number;
    tieMultiplier: string;
  },
  resultNotificationKey: string,
  latestRound: Round,
  options: ValidatorMonitorOptions,
) {
  const payloadJson = readRecord(originalNotification.payloadJson || originalNotification.payload_json);
  const moduleKey = readValidatorNotificationModuleKey(originalNotification);
  const moduleConfig = validatorChannelModuleConfig(channel, moduleKey);
  const buttons = validatorModuleTelegramButtons(moduleConfig, channel);
  const variables = validatorTelegramResultVariables(moduleKey, payloadJson, outcome, latestRound);
  const template =
    outcome.status === "RED"
      ? moduleConfig.redTemplate
      : outcome.status === "TIE"
        ? moduleConfig.tieTemplate
        : moduleConfig.greenTemplate;
  const sentAt = new Date().toISOString();
  const message = renderValidatorTelegramTemplate(template, variables);
  const result = isCloudValidatorTelegramChannel(channel)
    ? await sendTelegramEngineSignal(env, {
        userId: readString(originalNotification, "userId") || readString(originalNotification, "user_id"),
        channelId: channel.id,
        moduleKey,
        signalKey: resultNotificationKey,
        roundId: outcome.roundId,
        entry:
          readString(payloadJson, "expectedSide") ||
          readString(payloadJson, "side") ||
          readString(payloadJson, "entry"),
        message,
        result: outcome.label,
        protection: outcome.galeUsed <= 0 ? "SG" : `G${Math.min(4, outcome.galeUsed)}`,
        variables,
        buttons,
        forceMessage: true,
      })
    : await sendTelegramMessage({
        botToken: decodeServerToken(channel.botTokenEncoded),
        chatId: channel.chatId,
        message,
        buttonLabel: "Abrir Sniper Bo IA",
        buttonUrl: normalizeTelegramButtonUrl(channel.buttonLink),
        buttons,
        allowInsecureNodeFallback: Boolean(options.allowInsecureTelegramFallback),
      });
  const resultNotification = {
    id: resultNotificationKey,
    type: `result:${moduleKey}`,
    userId: readString(originalNotification, "userId") || readString(originalNotification, "user_id"),
    channelId: channel.id,
    roundId: outcome.roundId,
    status: result.ok ? "sent" : "error",
    error: result.ok ? "" : result.error,
    payloadJson: {
      moduleKey,
      originalNotificationId: readString(originalNotification, "id"),
      result: outcome.label,
      resultStatus: outcome.status,
      resultRoundId: outcome.roundId,
      tieMultiplier: outcome.tieMultiplier,
      telegramMessageId: result.ok ? result.messageId : null,
    },
    sentAt,
    updatedAt: sentAt,
  };
  liveValidatorNotifications = [
    resultNotification,
    ...liveValidatorNotifications.filter((item) => readString(item, "id") !== resultNotificationKey),
  ].slice(0, 1000);
  void persistValidatorNotification(env, resultNotification);
  if (!result.ok) return false;

  const updatedOriginal = {
    ...originalNotification,
    payloadJson: {
      ...payloadJson,
      result: outcome.label,
      resultStatus: outcome.status,
      resultRoundId: outcome.roundId,
      resultSentAt: sentAt,
      resultNotificationId: resultNotificationKey,
      tieMultiplier: outcome.tieMultiplier,
    },
    updatedAt: sentAt,
  };
  liveValidatorNotifications = [
    updatedOriginal,
    ...liveValidatorNotifications.filter((item) => readString(item, "id") !== readString(originalNotification, "id")),
  ].slice(0, 1000);
  void persistValidatorNotification(env, updatedOriginal);
  return true;
}

function validatorTelegramResultVariables(
  moduleKey: ValidatorTelegramModuleKey,
  payloadJson: Record<string, unknown>,
  outcome: {
    status: string;
    label: string;
    roundId: number;
    galeUsed: number;
    tieMultiplier: string;
  },
  latestRound: Round,
) {
  const entry = readString(payloadJson, "entryText") || readString(payloadJson, "entry") || "Entrada";
  const protection = readString(payloadJson, "protection") || readString(payloadJson, "gale") || "";
  return {
    table: "Bac Bo",
    module: formatValidatorModuleName(moduleKey),
    pattern: formatValidatorPayloadPattern(payloadJson.pattern),
    entry,
    gale: protection,
    protection,
    result: outcome.label,
    status: outcome.status,
    round: String(outcome.roundId || latestRound.id),
    number: String(payloadJson.numero ?? payloadJson.number ?? ""),
    percentage: readString(payloadJson, "percentage"),
    confidence: readString(payloadJson, "confidence"),
    tieMultiplier: outcome.tieMultiplier,
  };
}

function validatorTelegramPayloadVariables(
  moduleKey: ValidatorTelegramModuleKey,
  payloadJson: Record<string, unknown>,
  outcome: {
    label: string;
    roundId: number;
    tieMultiplier: string;
  },
) {
  const entry = readString(payloadJson, "entryText") || readString(payloadJson, "entry") || "Entrada";
  const protection = readString(payloadJson, "protection") || readString(payloadJson, "gale") || "";
  return {
    table: "Bac Bo",
    module: formatValidatorModuleName(moduleKey),
    pattern: formatValidatorPayloadPattern(payloadJson.pattern),
    entry,
    gale: protection,
    protection,
    result: outcome.label,
    round: String(outcome.roundId),
    number: String(payloadJson.numero ?? payloadJson.number ?? ""),
    status: readString(payloadJson, "status"),
    tieProtection: readString(payloadJson, "tieProtection"),
    percentage: readString(payloadJson, "percentage"),
    confidence: readString(payloadJson, "confidence") || formatServerPercent(readNullableNumber(payloadJson.accuracy)),
    tieMultiplier: outcome.tieMultiplier,
  };
}

function findValidatorTelegramChannelForNotification(notification: Record<string, unknown>) {
  const userId = normalizeValidatorUserId(readString(notification, "userId") || readString(notification, "user_id"));
  const channelId = readString(notification, "channelId") || readString(notification, "channel_id");
  return (
    liveValidatorChannels.find(
      (channel) => channel.userId === userId && channel.id === channelId && isUsableValidatorTelegramChannel(channel),
    ) || null
  );
}

function readValidatorNotificationModuleKey(notification: Record<string, unknown>): ValidatorTelegramModuleKey {
  const payloadJson = readRecord(notification.payloadJson || notification.payload_json);
  const payloadModule = readString(payloadJson, "moduleKey");
  if (VALIDATOR_TELEGRAM_MODULE_KEYS.includes(payloadModule as ValidatorTelegramModuleKey)) {
    return payloadModule as ValidatorTelegramModuleKey;
  }
  const type = readString(notification, "type");
  const fromType = type
    .replace(/^module:/, "")
    .replace(/^result:/, "")
    .replace(/:result$/, "");
  if (VALIDATOR_TELEGRAM_MODULE_KEYS.includes(fromType as ValidatorTelegramModuleKey)) {
    return fromType as ValidatorTelegramModuleKey;
  }
  return "validator";
}

function isValidatorResultNotification(notification: Record<string, unknown>) {
  const type = readString(notification, "type");
  return type.startsWith("result:") || type.endsWith(":result");
}

function readValidatorTelegramEntrySide(payloadJson: Record<string, unknown>): Round["result"] | null {
  const text = String(payloadJson.entryText || payloadJson.entry || payloadJson.expectedSide || "")
    .trim()
    .toUpperCase();
  if (text === "B" || text === "BANKER" || text.includes("BANKER")) return "B";
  if (text === "P" || text === "PLAYER" || text.includes("PLAYER")) return "P";
  if (text === "T" || text === "TIE" || text.includes("TIE") || text.includes("EMPATE")) return "T";
  return null;
}

function readValidatorProtectionGale(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "SG" || text === "SEM GALE") return 0;
  const match = text.match(/G([0-4])/);
  if (match) return Number(match[1]);
  const number = Math.floor(Number(value) || 0);
  return Math.max(0, Math.min(4, number));
}

function findValidatorRoundIndexById(roundId: number) {
  if (!roundId) return -1;
  for (let index = liveValidatorRoundHistory.length - 1; index >= 0; index -= 1) {
    if (liveValidatorRoundHistory[index]?.id === roundId) return index;
  }
  return -1;
}

function formatServerTieMultiplier(round: Round) {
  const multiplier = Number(round.tieMultiplier ?? serverTieMultiplierFromRound(round));
  if (!Number.isFinite(multiplier) || multiplier <= 0) return "";
  return `${multiplier}x`;
}

function formatValidatorModuleName(moduleKey: ValidatorTelegramModuleKey) {
  if (moduleKey === "ai_patterns") return "Padroes IA";
  if (moduleKey === "paying_numbers") return "Numeros Pagantes";
  if (moduleKey === "surf_alert") return "Aviso de Surf";
  if (moduleKey === "ties_only") return "Somente Empates";
  return "Validador";
}

function formatValidatorPayloadPattern(value: unknown) {
  if (typeof value === "string") return value;
  const pattern = normalizeServerPatternTokens(value);
  return pattern.length ? formatServerTelegramPattern(pattern) : "";
}

function validatorChannelModuleCoolingDown(
  channel: ValidatorNotificationChannel,
  moduleKey: ValidatorTelegramModuleKey,
  nowMs = Date.now(),
) {
  const cooldownSeconds = Math.max(0, Number(validatorChannelModuleConfig(channel, moduleKey).cooldownSeconds) || 0);
  if (!cooldownSeconds) return false;
  const cooldownMs = cooldownSeconds * 1000;
  return liveValidatorNotifications.some((notification) => {
    if (readString(notification, "status") !== "sent") return false;
    if (readString(notification, "userId") !== channel.userId) return false;
    if (readString(notification, "channelId") !== channel.id) return false;
    if (!validatorNotificationMatchesModule(notification, moduleKey)) return false;
    const sentAt = Date.parse(readString(notification, "sentAt") || readString(notification, "sent_at"));
    return Number.isFinite(sentAt) && nowMs - sentAt < cooldownMs;
  });
}

function validatorNotificationMatchesModule(
  notification: Record<string, unknown>,
  moduleKey: ValidatorTelegramModuleKey,
) {
  const type = readString(notification, "type");
  if (moduleKey === "validator") return !type || type === "entry" || type === "module:validator";
  return type === `module:${moduleKey}`;
}

function renderValidatorTelegramTemplate(template: string, variables: Record<string, string>) {
  return sanitizeValidatorTelegramOutgoingText(
    (template || "").replace(/{{\s*([a-zA-Z_]+)\s*}}/g, (_, key: string) => variables[key] ?? ""),
  );
}

function sanitizeValidatorTelegramOutgoingText(value: unknown) {
  const text = String(value || "")
    .replace(/\[PR[\uFFFD?]+E?VIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/\[PREVIA DE TESTE\]/gi, "[PR\u00C9VIA DE TESTE]")
    .replace(/PADR[\uFFFD?]+O/g, "PADRAO")
    .replace(/Padr[\uFFFD?]+o/gi, "Padrao")
    .replace(/Prote[\uFFFD?]+o/gi, "Proteção")
    .replace(/M[\uFFFD?]+dulo/gi, "Módulo")
    .replace(/N[\uFFFD?]+mero/gi, "Numero")
    .replace(/Confian[\uFFFD?]+a/gi, "Confianca")
    .replace(/\bPADRAO\b/g, "PADR\u00C3O")
    .replace(/\bPadrao\b/g, "Padr\u00E3o")
    .replace(/\bProteção\b/gi, "Prote\u00E7\u00E3o")
    .replace(/\bMódulo\b/gi, "M\u00F3dulo")
    .replace(/\bNumero\b/gi, "N\u00FAmero")
    .replace(/\bConfianca\b/gi, "Confian\u00E7a")
    .replace(/^\?{1,4}\s*((?:<b>)?ENTRADA CONFIRMADA(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?PADR?O IA CONFIRMADO(?:<\/b>)?)/gim, "\u{1F916} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Mesa:\s*(?:<\/b>)?)/gim, "\u{1F3B2} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Padrão:\s*(?:<\/b>)?)/gim, "\u{1F9E9} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Entrada:\s*(?:<\/b>)?)/gim, "\u{1F3AF} $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Prote??o:\s*(?:<\/b>)?)/gim, "\u{1F6E1}\uFE0F $1")
    .replace(/^\?{1,4}\s*((?:<b>)?Assertividade:\s*(?:<\/b>)?)/gim, "\u{1F4CA} $1")
    .replace(/\?{1,4}\s*(BANKER|Banker)\b/g, "\u{1F534} $1")
    .replace(/\?{1,4}\s*(PLAYER|Player)\b/g, "\u{1F535} $1")
    .replace(/\?{1,4}\s*(TIE|Tie)\b/g, "\u{1F7E1} $1")
    .replace(/\u{1F534}\s*Banker\b/gu, "\u{1F534} BANKER")
    .replace(/\u{1F535}\s*Player\b/gu, "\u{1F535} PLAYER")
    .replace(/\u{1F7E1}\s*Tie\b/gu, "\u{1F7E1} TIE");
  return decorateValidatorTelegramPatternLines(decorateKnownValidatorTelegramLines(text));
}

function decorateKnownValidatorTelegramLines(value: string) {
  return String(value || "")
    .split(/\r?\n/)
    .map(decorateKnownValidatorTelegramLine)
    .join("\n");
}

function decorateKnownValidatorTelegramLine(line: string) {
  const source = String(line || "");
  const match = source.match(/^(\s*)(.*)$/);
  const indent = match?.[1] || "";
  const body = match?.[2] || "";
  const cleanBody = body.replace(/^\?{1,4}\s*/, "");
  if (!cleanBody || startsWithValidatorTelegramEmoji(cleanBody)) return indent + cleanBody;
  const plain = cleanBody
    .replace(/<[^>]+>/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  const emoji = validatorTelegramEmojiForLine(plain);
  return indent + (emoji ? `${emoji} ` : "") + cleanBody;
}

function startsWithValidatorTelegramEmoji(value: string) {
  return /^(?:[\u{1F300}-\u{1FAFF}]|\u2600|\u26A0|\u2705|\u274C)/u.test(String(value || "").trim());
}

function validatorTelegramEmojiForLine(plain: string) {
  if (!plain || plain.startsWith("[PREVIA DE TESTE]")) return "";
  if (plain.startsWith("ENTRADA CONFIRMADA")) return "\u{1F916}";
  if (plain.startsWith("PADRAO IA CONFIRMADO")) return "\u{1F916}";
  if (plain.startsWith("PADRAO VALIDADOR")) return "\u{1F916}";
  if (plain.startsWith("NUMERO PAGANTE CONFIRMADO")) return "\u{1F48E}";
  if (plain.startsWith("AVISO DE SURF CONFIRMADO")) return "\u{1F30A}";
  if (plain.startsWith("POSSIVEL EMPATE")) return "\u{1F7E1}";
  if (plain.startsWith("MESA:")) return "\u{1F3B2}";
  if (plain.startsWith("PADRAO:")) return "\u{1F9E9}";
  if (plain.startsWith("ENTRADA:")) return "\u{1F3AF}";
  if (plain.startsWith("PROTECAO:")) return "\u{1F6E1}\uFE0F";
  if (plain.startsWith("PROTECAO TIE:")) return "\u{1F91D}";
  if (plain.startsWith("COBERTURA:")) return "\u{1F6E1}\uFE0F";
  if (plain.startsWith("ASSERTIVIDADE:")) return "\u{1F4CA}";
  if (plain.startsWith("NUMERO:")) return "\u{1F522}";
  if (plain.startsWith("NUMEROS:")) return "\u{1F522}";
  if (plain.startsWith("STATUS:")) return "\u{1F4CC}";
  if (plain.startsWith("RISCO:")) return "\u26A0\uFE0F";
  if (plain.startsWith("CONFIANCA:")) return "\u{1F4CA}";
  if (plain.startsWith("NIVEL:")) return "\u{1F4CA}";
  if (plain.startsWith("MODULO:")) return "\u{1F916}";
  return "";
}

function decorateValidatorTelegramPatternLines(value: string) {
  const puzzle = "\u{1F9E9}";
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => {
      const match = String(line || "").match(/^(\s*)(?:\u{1F9E9}\s*)?(?:<b>)?Padr(?:\u00E3o|ao):?(?:<\/b>)?:?\s*(.*)$/iu);
      if (!match) return line;
      const expression = String(match[2] || "").trim();
      return `${match[1] || ""}${puzzle} <b>Padr\u00E3o:</b> ${decorateValidatorTelegramPatternExpression(expression)}`;
    })
    .join("\n");
}

function decorateValidatorTelegramPatternExpression(value: unknown) {
  const raw = String(value || "");
  const compactEmojiPattern = raw.match(/[\u{1F534}\u{1F535}\u{1F7E1}]\s*\d*/gu);
  if (compactEmojiPattern && compactEmojiPattern.length > 1) {
    return compactEmojiPattern.map((item) => item.replace(/\s+/g, "")).join("");
  }
  const parts = raw
    .split(/\s*(?:\u2192|->|>)\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return formatValidatorTelegramPatternToken(value);
  return parts.map(formatValidatorTelegramPatternToken).join("");
}

function formatValidatorTelegramPatternToken(token: unknown) {
  const source = String(token || "");
  const hadRed = source.includes("\u{1F534}");
  const hadBlue = source.includes("\u{1F535}");
  const hadYellow = source.includes("\u{1F7E1}");
  const clean = source
    .replace(/<[^>]+>/g, "")
    .replace(/[\uFFFD?]/g, "")
    .replace(/[\u{1F534}\u{1F535}\u{1F7E1}]/gu, "")
    .trim();
  const normalized = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, "");
  const side = hadRed || normalized.startsWith("BANKER") || normalized.startsWith("B")
    ? "B"
    : hadBlue || normalized.startsWith("PLAYER") || normalized.startsWith("P")
      ? "P"
      : hadYellow || normalized.startsWith("TIE") || normalized.startsWith("T")
        ? "T"
        : "";
  if (!side) return clean || source.trim();
  const number = normalized.match(/\d{1,2}/)?.[0] || "";
  return serverSideCircle(side as Round["result"]) + number;
}


function formatValidatorModuleGale(value: unknown) {
  const gale = Math.max(0, Math.min(4, Math.floor(Number(value) || 0)));
  return gale <= 0 ? "SG" : `G${gale}`;
}

function normalizeServerSideForTelegram(side: unknown): Round["result"] | null {
  const text = String(side || "").trim().toUpperCase();
  if (text === "B" || text === "BANKER") return "B";
  if (text === "P" || text === "PLAYER") return "P";
  if (text === "T" || text === "TIE") return "T";
  return null;
}

function formatServerSideLabel(side: unknown) {
  const roundSide = normalizeServerSideForTelegram(side);
  if (roundSide === "B") return "Banker";
  if (roundSide === "P") return "Player";
  if (roundSide === "T") return "Tie";
  return "Automatico";
}

function formatServerCompactSide(side: unknown) {
  const roundSide = normalizeServerSideForTelegram(side);
  if (!roundSide) return "Automatico";
  return `${serverSideCircle(roundSide)}${formatServerSideLabel(roundSide)}`;
}

function formatServerSignalSide(side: CurrentSignalSide | NonNullable<NeuralEntryState["expectedSide"]>) {
  const roundSide = normalizeServerSideForTelegram(side);
  if (!roundSide) return "Automatico";
  return `${serverSideCircle(roundSide)} ${formatServerSideLabel(roundSide).toUpperCase()}`;
}

function serverSignalCircle(side: CurrentSignalSide | NonNullable<NeuralEntryState["expectedSide"]>) {
  const normalized = normalizeServerSideForTelegram(side);
  if (normalized === "B") return "\u{1F534}";
  if (normalized === "P") return "\u{1F535}";
  if (normalized === "T") return "\u{1F7E1}";
  if (side === "BANKER") return "🔴";
  if (side === "PLAYER") return "🔵";
  if (side === "TIE") return "🟡";
  return "";
}

function validatorModuleAllowsRoundEntry(moduleConfig: ValidatorTelegramModuleConfig, side: Round["result"]) {
  if (moduleConfig.entryType === "AUTO") return true;
  if (moduleConfig.entryType === "BANKER") return side === "B";
  if (moduleConfig.entryType === "PLAYER") return side === "P";
  return side === "T";
}

function validatorModuleAllowsSignalEntry(
  moduleConfig: ValidatorTelegramModuleConfig,
  side: CurrentSignalSide | NonNullable<NeuralEntryState["expectedSide"]>,
) {
  if (moduleConfig.entryType === "AUTO") return true;
  return moduleConfig.entryType === side;
}

function validatorModuleTelegramButtons(
  moduleConfig: ValidatorTelegramModuleConfig,
  channel: ValidatorNotificationChannel,
) {
  return normalizeValidatorTelegramButtons(moduleConfig.buttons)
    .filter((button) => button.enabled)
    .map((button) => ({
      label: (button.label || DEFAULT_VALIDATOR_TELEGRAM_BUTTON_LABEL).slice(0, 64),
      url: normalizeTelegramButtonUrl(button.url || channel.buttonLink),
    }))
    .filter((button) => button.label && button.url)
    .slice(0, MAX_VALIDATOR_TELEGRAM_BUTTONS);
}

async function runLimitedValidatorTelegramSends(tasks: Array<() => Promise<boolean>>) {
  const results: boolean[] = [];
  let cursor = 0;
  const workerCount = Math.min(VALIDATOR_TELEGRAM_MAX_PARALLEL_SENDS, tasks.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < tasks.length) {
        const task = tasks[cursor++];
        if (!task) continue;
        try {
          results.push(await task());
        } catch (error) {
          console.warn("Falha ao enviar alerta Telegram do Validador.", error);
          results.push(false);
        }
      }
    }),
  );
  return results;
}

function logValidatorTelegramLatency(
  pattern: SavedValidatorPattern,
  channel: ValidatorNotificationChannel,
  roundId: number,
  status: "sent" | "error",
  latency: Record<string, unknown>,
) {
  const summary = {
    event: "validator_telegram_latency",
    status,
    roundId,
    user: maskTelemetryUserId(pattern.userId),
    patternId: pattern.id,
    channelId: channel.id,
    roundToMatchMs: Math.floor(Number(latency.roundToMatchMs) || 0),
    matchToTelegramStartMs: Math.floor(Number(latency.matchToTelegramStartMs) || 0),
    telegramApiMs: Math.floor(Number(latency.telegramApiMs) || 0),
    totalMs: Math.floor(Number(latency.totalMs) || 0),
    targetMs: VALIDATOR_TELEGRAM_TARGET_MS,
  };
  const line = JSON.stringify(summary);
  if (summary.totalMs > VALIDATOR_TELEGRAM_TARGET_MS) {
    console.warn(line);
    return;
  }
  console.info(line);
}

function maskTelemetryUserId(userId: string) {
  const clean = String(userId || "")
    .trim()
    .toLowerCase();
  const [name, domain] = clean.split("@");
  if (!name || !domain) return clean ? "***" : "";
  return `${name.slice(0, 1)}***@${domain}`;
}

function logPayingNumbersTelegramDecision(
  channel: ValidatorNotificationChannel,
  status: "sent" | "blocked",
  reason: string,
  details: Record<string, unknown> = {},
) {
  const summary = {
    event: status === "sent" ? "[NUMEROS_PAGANTES] enviado" : `[NUMEROS_PAGANTES] descartado: ${reason}`,
    legacyEvent: "telegram_paying_numbers_decision",
    moduleKey: "paying_numbers",
    status,
    reason,
    user: maskTelemetryUserId(channel.userId),
    channelId: channel.id,
    ...details,
  };
  const line = JSON.stringify(summary);
  if (status === "blocked") {
    console.info(line);
    return;
  }
  console.info(line);
}

function shouldMonitorValidatorPattern(pattern: SavedValidatorPattern, latestRound: Round) {
  if (isValidatorPatternDeleted(pattern)) return false;
  if (!pattern.isActive || pattern.destination === "disabled") return false;
  if (!pattern.pattern.length || liveValidatorRoundHistory.length < pattern.pattern.length) return false;
  const cooldown = Math.max(0, Number(pattern.cooldownRounds) || 0);
  if (pattern.lastDetectedRoundId && latestRound.id - pattern.lastDetectedRoundId <= cooldown) return false;
  return true;
}

function validatorNotificationAlreadySent(key: string) {
  return liveValidatorNotifications.some(
    (item) => readString(item, "id") === key && readString(item, "status") === "sent",
  );
}

function validatorPatternAllowsTelegramForward(pattern: SavedValidatorPattern) {
  return pattern.destination !== "disabled" && pattern.destination !== "monitor";
}

function findValidatorTelegramChannelForPattern(pattern: SavedValidatorPattern) {
  const userChannels = liveValidatorChannels.filter((channel) => channel.userId === pattern.userId);
  const preferred = userChannels.find((channel) => channel.id === pattern.telegramChannelId);
  if (isUsableValidatorTelegramChannel(preferred)) return preferred;
  return userChannels.find(isUsableValidatorTelegramChannel) || null;
}

function isUsableValidatorTelegramChannel(channel?: ValidatorNotificationChannel) {
  return Boolean(
    channel?.isActive &&
    channel.chatId &&
    (isCloudValidatorTelegramChannel(channel) || decodeServerToken(channel.botTokenEncoded)),
  );
}

function isCloudValidatorTelegramChannel(channel?: ValidatorNotificationChannel | null) {
  return channel?.botTokenEncoded === "__cloudflare__";
}

async function sendTelegramEngineSignal(
  env: unknown,
  input: {
    userId: string;
    channelId: string;
    moduleKey: ValidatorTelegramModuleKey;
    signalKey: string;
    roundId: number;
    entry: unknown;
    message: string;
    result?: string;
    protection?: string;
    variables?: Record<string, string>;
    buttons?: Array<{ label: string; url: string }>;
    forceMessage?: boolean;
  },
) {
  const config = getTelegramEngineConfig(env);
  if (!config) return { ok: false, status: 503, error: "Cloudflare Telegram Engine nao configurado." };
  const response = await fetch(`${config.url}/engine/signal`, {
    method: "POST",
    cache: "no-store",
    headers: telegramEngineHeaders(config.secret, "", true),
    body: JSON.stringify({
      userId: normalizeValidatorUserId(input.userId),
      channelId: input.channelId,
      moduleKey: input.moduleKey,
      signalKey: input.signalKey,
      roundId: input.roundId,
      entry: normalizeCloudTelegramEntry(input.entry),
      message: input.message,
      result: input.result,
      protection: input.protection,
      variables: input.variables || {},
      buttonLabel: "Abrir Sniper Bo IA",
      buttons: input.buttons || [],
      forceMessage: Boolean(input.forceMessage),
    }),
  }).catch((error) => {
    console.warn("Falha ao chamar Cloudflare Telegram Engine.", error);
    return null;
  });
  if (!response) return { ok: false, status: 502, error: "Cloudflare Telegram Engine indisponivel." };
  const data = (await response.json().catch(() => null)) as {
    sent?: Array<Record<string, unknown>>;
    blocked?: Array<Record<string, unknown>>;
    error?: string;
  } | null;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error || `Cloudflare Telegram retornou ${response.status}.`,
    };
  }
  const sent = Array.isArray(data?.sent) ? data.sent : [];
  const match = sent.find((item) => readString(item, "channelId") === input.channelId) || sent[0];
  if (match) return { ok: true, status: 200, messageId: readTelegramMessageId(match) };
  const blocked = Array.isArray(data?.blocked) ? data.blocked : [];
  const reason = readString(
    blocked.find((item) => readString(item, "channelId") === input.channelId) || blocked[0],
    "reason",
  );
  return { ok: false, status: 409, error: reason || "Cloudflare Telegram nao enviou o sinal." };
}

function normalizeCloudTelegramEntry(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "B" || text.includes("BANKER")) return "BANKER";
  if (text === "P" || text.includes("PLAYER")) return "PLAYER";
  if (text === "T" || text.includes("TIE")) return "TIE";
  return "";
}

async function sendValidatorAnalyzingMessages(
  env: unknown,
  latestRound: Round,
  entryChannelKeys: Set<string>,
  options: ValidatorMonitorOptions,
) {
  let changed = false;
  for (const channel of liveValidatorChannels) {
    if (!shouldSendValidatorAnalyzingMessage(channel, latestRound, entryChannelKeys)) continue;
    const notificationKey = `analysis:${channel.userId}:${channel.id}:${latestRound.id}`;
    const sentAt = new Date().toISOString();
    const message = buildServerValidatorAnalyzingMessage(channel);
    const result = isCloudValidatorTelegramChannel(channel)
      ? await sendTelegramEngineSignal(env, {
          userId: channel.userId,
          channelId: channel.id,
          moduleKey: "validator",
          signalKey: notificationKey,
          roundId: latestRound.id,
          entry: "",
          message,
          forceMessage: true,
        })
      : await sendTelegramMessage({
          botToken: decodeServerToken(channel.botTokenEncoded),
          chatId: channel.chatId,
          message,
          buttonLabel: "Abrir Sniper Bo IA",
          buttonUrl: normalizeTelegramButtonUrl(channel.buttonLink),
          allowInsecureNodeFallback: Boolean(options.allowInsecureTelegramFallback),
        });
    const notification = {
      id: notificationKey,
      type: "analysis",
      userId: channel.userId,
      channelId: channel.id,
      roundId: latestRound.id,
      status: result.ok ? "sent" : "error",
      error: result.ok ? "" : result.error,
      sentAt,
      updatedAt: sentAt,
    };
    liveValidatorNotifications = [
      notification,
      ...liveValidatorNotifications.filter((item) => readString(item, "id") !== notificationKey),
    ].slice(0, 1000);
    void persistValidatorNotification(env, notification);
    changed = true;
  }
  return changed;
}

function shouldSendValidatorAnalyzingMessage(
  channel: ValidatorNotificationChannel,
  latestRound: Round,
  entryChannelKeys: Set<string>,
) {
  if (!channel.isActive || !channel.analyzingEnabled) return false;
  if (!channel.chatId || (!isCloudValidatorTelegramChannel(channel) && !decodeServerToken(channel.botTokenEncoded)))
    return false;
  if (entryChannelKeys.has(validatorChannelKey(channel))) return false;
  if (!validatorChannelHasActivePattern(channel)) return false;
  const notificationKey = `analysis:${channel.userId}:${channel.id}:${latestRound.id}`;
  if (validatorNotificationAlreadySent(notificationKey)) return false;
  const cooldown = Math.max(1, Math.floor(Number(channel.analyzingCooldownRounds) || 3));
  const lastRoundId = lastValidatorAnalysisRoundId(channel);
  return !lastRoundId || latestRound.id - lastRoundId >= cooldown;
}

function validatorChannelHasActivePattern(channel: ValidatorNotificationChannel) {
  return liveValidatorPatterns.some(
    (pattern) =>
      pattern.userId === channel.userId &&
      pattern.isActive &&
      validatorPatternAllowsTelegramForward(pattern) &&
      pattern.pattern.length > 0 &&
      findValidatorTelegramChannelForPattern(pattern)?.id === channel.id,
  );
}

function lastValidatorAnalysisRoundId(channel: ValidatorNotificationChannel) {
  let latest = 0;
  for (const item of liveValidatorNotifications) {
    if (readString(item, "type") !== "analysis") continue;
    if (readString(item, "status") !== "sent") continue;
    if (readString(item, "userId") !== channel.userId) continue;
    if (readString(item, "channelId") !== channel.id) continue;
    const roundId = Number(item.roundId);
    if (Number.isFinite(roundId) && roundId > latest) latest = roundId;
  }
  return latest;
}

function validatorChannelKey(channel: ValidatorNotificationChannel) {
  return `${channel.userId}:${channel.id}`;
}

function matchesServerValidatorPattern(rounds: Round[], pattern: ValidatorPatternToken[]) {
  if (rounds.length !== pattern.length) return false;
  return rounds.every((round, index) => {
    const token = pattern[index];
    if (!token || round.result !== token.side) return false;
    if (!token.score) return true;
    return serverScoreForRound(round, token.side) === token.score;
  });
}

function serverScoreForRound(round: Round, side: Round["result"]) {
  if (side === "B") return round.bankerScore;
  if (side === "P") return round.playerScore;
  return round.bankerScore === round.playerScore ? round.bankerScore : Math.max(round.bankerScore, round.playerScore);
}

function buildServerValidatorTelegramVariables(pattern: SavedValidatorPattern, channel: ValidatorNotificationChannel) {
  const entry = pattern.pulledSide || validatorEntrySide(pattern.entryType);
  const moduleConfig = validatorChannelModuleConfig(channel, "validator");
  const variables: Record<string, string> = {
    pattern: formatServerTelegramPattern(pattern.pattern),
    entry: entry ? formatServerTelegramSide(entry) : "Aguardando",
    entryLabel: entry ? formatServerSideLabel(entry) : "Aguardando",
    entryCompact: entry ? formatServerCompactSide(entry) : "Aguardando",
    gale: formatValidatorModuleGale(pattern.galeLimit),
    wins: String(pattern.wins),
    loss: String(pattern.losses),
    losses: String(pattern.losses),
    percentage: formatServerPercent(pattern.validation?.accuracy),
    table: pattern.tableId || "Bac Bo",
    confidence: formatServerPercent(pattern.validation?.accuracy),
    sequence: String(pattern.currentGreenStreak),
    tieProtection: pattern.tieProtection ? "Ativa" : "Inativa",
    result: "",
    risk: pattern.validation?.risk ?? "",
    mode: "Validador Neural",
  };
  return variables;
}

function buildServerValidatorTelegramMessage(pattern: SavedValidatorPattern, channel: ValidatorNotificationChannel) {
  const moduleConfig = validatorChannelModuleConfig(channel, "validator");
  const variables = buildServerValidatorTelegramVariables(pattern, channel);
  const template =
    pattern.messageOverride?.trim() ||
    moduleConfig.template ||
    channel.templates.entry ||
    DEFAULT_VALIDATOR_MESSAGE_TEMPLATES.entry;
  return renderValidatorTelegramTemplate(enforceServerValidatorTemplateIdentity(template), variables);
}

function enforceServerValidatorTemplateIdentity(template: string) {
  return String(template || DEFAULT_VALIDATOR_MESSAGE_TEMPLATES.entry)
    .replace(/PADR\S*O\s+IA\s+CONFIRMADO/gi, "PADR\u00C3O VALIDADOR")
    .replace(/PADR\S*O\s+IA\b/gi, "PADR\u00C3O VALIDADOR");
}

function buildServerValidatorAnalyzingMessage(channel: ValidatorNotificationChannel) {
  const variables: Record<string, string> = {
    pattern: "Aguardando",
    entry: "Aguardando",
    gale: "",
    wins: "",
    loss: "",
    losses: "",
    percentage: "",
    table: "Bac Bo",
    confidence: "",
    sequence: "",
    tieProtection: "",
    result: "",
    risk: "",
    mode: "Validador Neural",
  };
  const template = channel.templates.analyzing || DEFAULT_VALIDATOR_MESSAGE_TEMPLATES.analyzing;
  return template.replace(/{{\s*([a-zA-Z]+)\s*}}/g, (_, key: string) => variables[key] ?? "");
}

function validatorEntrySide(entryType: ValidatorEntryType): Round["result"] | null {
  if (entryType === "BANKER") return "B";
  if (entryType === "PLAYER") return "P";
  if (entryType === "TIE") return "T";
  return null;
}

function formatServerTelegramPattern(pattern: ValidatorPatternToken[]) {
  return pattern.map((token) => `${serverSideCircle(token.side)}${token.score ?? ""}`).join("");
}

function formatServerTelegramSide(side: Round["result"]) {
  const roundSide = normalizeServerSideForTelegram(side);
  if (!roundSide) return "Automatico";
  return `${serverSideCircle(roundSide)} ${formatServerSideLabel(roundSide).toUpperCase()}`;
}

function serverSideCircle(side: Round["result"]) {
  if (side === "B") return "\u{1F534}";
  if (side === "P") return "\u{1F535}";
  if (side === "T") return "\u{1F7E1}";
  if (side === "B") return "🔴";
  if (side === "P") return "🔵";
  return "🟡";
}

function formatServerTelegramSequenceText(sequence: string[]) {
  return sequence.map(formatServerTelegramSequenceToken).join("");
}

function formatServerTelegramSequenceToken(token: string) {
  const raw = String(token || "").trim();
  const normalized = raw.toUpperCase().replace(/\s+/g, "");
  const side = normalized.startsWith("BANKER") || normalized.startsWith("B")
    ? "B"
    : normalized.startsWith("PLAYER") || normalized.startsWith("P")
      ? "P"
      : normalized.startsWith("TIE") || normalized.startsWith("T")
        ? "T"
        : "";
  if (!side) return raw;
  const score = normalized.match(/\d+/)?.[0] || "";
  return `${serverSideCircle(side as Round["result"])}${score}`;
}

function formatServerPercent(value?: number) {
  if (value === undefined || Number.isNaN(value)) return "sem amostra";
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function publicDashboardSnapshot(dashboard: LiveDashboardData): LiveDashboardData {
  const safeDashboard = liveFeedLooksStale(dashboard) ? pausedDashboardSnapshot(dashboard) : dashboard;
  const signal = safeDashboard.currentSignal;
  const { lateSignalHold: _lateSignalHold, ...publicDashboard } = safeDashboard;
  return {
    ...publicDashboard,
    currentSignal: signal,
  } as LiveDashboardData;
}

function liveFeedLooksStale(dashboard: LiveDashboardData) {
  const updatedAt = Date.parse(readString(dashboard, "updatedAt"));
  if (!Number.isFinite(updatedAt)) return !Array.isArray(dashboard.rounds) || dashboard.rounds.length === 0;
  return Date.now() - updatedAt > LIVE_FEED_STALE_MS;
}

function pausedDashboardSnapshot(dashboard: LiveDashboardData): LiveDashboardData {
  return {
    ...dashboard,
    currentSignal: {
      id: "feed-paused",
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: 0,
      lastResult: null,
    },
    currentTieAlert: {
      id: "feed-paused-tie",
      level: "Baixo",
      confidence: 0,
      validityRounds: 0,
      status: "expired",
    },
    currentSurfAlert: {
      surf_alert: false,
      surf_phase: "SEM_RISCO",
      surf_side: "NONE",
      surf_status: "SEM_RISCO",
      surf_risk: 0,
      surf_break_risk: 0,
      surf_confidence: 0,
      stretched_count: 0,
      correction_count: 0,
      reason: "Feed da mesa pausado. Aguardando nova rodada real antes de liberar sinais.",
      panels: {
        big_road: "Aguardando nova rodada real.",
        big_eye_boy: "Aguardando nova rodada real.",
        small_road: "Aguardando nova rodada real.",
        cockroach_pig: "Aguardando nova rodada real.",
      },
      surf_prediction_side: "NONE",
      surf_prediction_status: "EXPIRED",
      surf_prediction_confidence: 0,
      surf_prediction_window: 0,
    },
    neuralReading: {
      ...(dashboard.neuralReading || { mode: "SCANNING" }),
      mode: "SCANNING",
      paganteStatus: "FEED_PAUSADO",
      paganteAlert: "Aguardando nova rodada real da mesa.",
    },
    engineDecision: {
      state: "AGUARDAR",
      reason: "Feed da mesa pausado. Nenhuma entrada sera liberada ate chegar rodada nova.",
      confidence: 0,
      debug: "feed=stale",
    },
  };
}

async function handleAdaptiveStrategyRequest(request: Request, env: unknown) {
  const url = new URL(request.url);
  if (url.pathname !== "/adaptive-strategy/sync") return null;

  if (request.method === "OPTIONS") return json(null, 204);
  if (request.method !== "POST") return json({ error: "Metodo nao permitido." }, 405);

  if (!(await isDashboardReadAuthorized(request, url, env))) {
    return json({ error: "Nao autorizado." }, 401);
  }

  const config = getSupabasePersistenceConfig(env);
  if (!config) {
    return json({
      mode: "local",
      storage: "local",
      lastSyncedAt: new Date().toISOString(),
      message: "Supabase service role nao configurado no backend. Adaptive Engine mantido no historico local.",
    });
  }

  const payload = readRecord(await request.json().catch(() => ({}))) as AdaptiveStrategySyncPayload;
  const records = normalizeAdaptiveRoundRows(payload.records);
  const patterns = normalizeAdaptivePatternRows(payload.patterns);
  const decision = normalizeAdaptiveDecisionRow(payload.decision, payload.logs);

  const [roundsSaved, patternsSaved, decisionSaved] = await Promise.all([
    saveSupabaseRows(config, "adaptive_strategy_rounds", records, "round_key"),
    saveSupabaseRows(config, "adaptive_strategy_patterns", patterns, "pattern_id"),
    saveSupabaseRows(config, "adaptive_strategy_decision_logs", decision ? [decision] : [], "decision_key"),
  ]);

  if (!roundsSaved || !patternsSaved || !decisionSaved) {
    return json(
      {
        mode: "error",
        storage: "error",
        lastSyncedAt: new Date().toISOString(),
        error: "Nao foi possivel salvar todos os dados do Adaptive Engine no Supabase.",
      },
      502,
    );
  }

  return json({
    mode: "database",
    storage: "database",
    lastSyncedAt: new Date().toISOString(),
    message: "Rodadas, padroes e logs do Adaptive Engine salvos no Supabase.",
  });
}

function normalizeAdaptiveRoundRows(value: unknown[] | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const record = readRecord(item);
      const result = readAdaptiveSide(record.result);
      if (!result) return null;
      const roundKey = readString(record, "key");
      const timestamp = safeIso(readString(record, "timestamp"));
      const capturedAt = safeIso(readString(record, "capturedAt")) || new Date().toISOString();
      if (!roundKey || !timestamp) return null;

      return {
        round_key: roundKey,
        table_name: readString(record, "tableName") || "Mesa principal",
        round_id: Math.floor(Number(record.roundId) || 0),
        day: readString(record, "day") || timestamp.slice(0, 10),
        time_label: readString(record, "time") || "--:--",
        result,
        banker_score: Math.floor(Number(record.bankerScore) || 0),
        player_score: Math.floor(Number(record.playerScore) || 0),
        tie_multiplier: readNullableNumber(record.tieMultiplier),
        previous_sequence: readString(record, "previousSequence"),
        next_result: readAdaptiveSide(record.nextResult),
        played_at: timestamp,
        source_updated_at: safeIso(readString(record, "sourceUpdatedAt")) || null,
        captured_at: capturedAt,
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function normalizeAdaptivePatternRows(value: unknown[] | undefined) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const pattern = readRecord(item);
      const direction = readAdaptiveSide(pattern.direction);
      const patternId = readString(pattern, "id");
      if (!patternId || !direction) return null;

      const sequence = readRecord(pattern.greenRedSequence);
      return {
        pattern_id: patternId,
        label: readString(pattern, "label") || patternId,
        kind: readString(pattern, "kind") || "sequence",
        table_name: readString(pattern, "tableName") || "Mesa principal",
        hour_label: readString(pattern, "hour") || null,
        direction,
        occurrences: safeInteger(pattern.occurrences),
        pulled_player: safeInteger(pattern.pulledPlayer),
        pulled_banker: safeInteger(pattern.pulledBanker),
        pulled_tie: safeInteger(pattern.pulledTie),
        sg: safeInteger(pattern.sg),
        g1: safeInteger(pattern.g1),
        red: safeInteger(pattern.red),
        expired: safeInteger(pattern.expired),
        assertiveness: safeNumber(pattern.assertiveness),
        assertiveness_sg: safeNumber(pattern.assertivenessSg),
        assertiveness_g1: safeNumber(pattern.assertivenessG1),
        last_seen_at: safeIso(readString(pattern, "lastSeenAt")) || null,
        green_red_sequence_type: readString(sequence, "type") || "none",
        green_red_sequence_count: safeInteger(sequence.count),
        status: readAdaptiveStatus(pattern.status),
        score: safeNumber(pattern.score),
        sample_weak: Boolean(pattern.sampleWeak),
        blocked: Boolean(pattern.blocked),
        paused_reason: readString(pattern, "pausedReason") || null,
        updated_at: new Date().toISOString(),
      };
    })
    .filter((row): row is Record<string, unknown> => Boolean(row));
}

function normalizeAdaptiveDecisionRow(decision: Record<string, unknown> | undefined, logs: unknown[] | undefined) {
  const record = readRecord(decision);
  if (!Object.keys(record).length) return null;
  const side = readAdaptiveSide(record.side);
  const finalScore = safeNumber(record.finalScore);
  const allowed = Boolean(record.allowed);
  const explanation = Array.isArray(record.explanation) ? record.explanation : [];
  const parts = Array.isArray(record.parts) ? record.parts : [];
  const rawLogs = Array.isArray(logs) ? logs : [];

  return {
    decision_key: `${new Date().toISOString().slice(0, 16)}:${side ?? "NONE"}:${finalScore}:${allowed}`,
    final_score: finalScore,
    allowed,
    side,
    explanation,
    score_parts: parts,
    raw_logs: rawLogs,
  };
}

async function saveSupabaseRows(
  config: { url: string; key: string },
  table: string,
  rows: Record<string, unknown>[],
  conflictColumn: string,
) {
  if (!rows.length) return true;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumn)}`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      console.warn(`Adaptive Engine: falha ao salvar ${table} (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn(`Adaptive Engine: falha de conexao ao salvar ${table}.`, error);
    return false;
  }
}

function readAdaptiveSide(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "B" || text === "BANKER" || text === "BANCA") return "BANKER";
  if (text === "P" || text === "PLAYER" || text === "JOGADOR") return "PLAYER";
  if (text === "T" || text === "TIE" || text === "EMPATE") return "TIE";
  return null;
}

function readAdaptiveStatus(value: unknown) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "quente" || text === "pausado" || text === "observacao" || text === "frio") {
    return text;
  }
  return "frio";
}

function safeIso(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeInteger(value: unknown) {
  const number = Math.floor(Number(value) || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function safeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function updateDashboardData(current: LiveDashboardData, body: unknown) {
  const cycle = ensureDashboardDailyCycle(current);
  const currentDashboard = cycle.dashboard;
  const incoming = readRecord(readRecord(body).dashboard || body);
  const cycleDate = currentDashboardCycleDate();
  const incomingCycleDate = readDashboardCycleDate(incoming);
  const acceptsCurrentCycle = !incomingCycleDate || incomingCycleDate === cycleDate;
  const acceptsDailyCounters =
    acceptsCurrentCycle && (!currentDashboard.strictDailyCounters || incomingCycleDate === cycleDate);
  const pickedSections = acceptsCurrentCycle ? pickDashboardSections(incoming) : {};
  if (!acceptsDailyCounters) {
    delete pickedSections.mainScoreboard;
    delete pickedSections.tieAlertScoreboard;
    delete pickedSections.surfAnalyzerScoreboard;
    delete pickedSections.entryModeStats;
    if (pickedSections.neuralReading) {
      pickedSections.neuralReading = resetNeuralReadingDailyCounters(pickedSections.neuralReading);
    }
  }
  const incomingRounds =
    acceptsCurrentCycle && Array.isArray(incoming.rounds)
      ? normalizeRounds(incoming.rounds, MAX_SERVER_ROUND_HISTORY)
      : [];
  if (incomingRounds.length) {
    liveValidatorRoundHistory = mergeMonitorRoundHistory(liveValidatorRoundHistory, incomingRounds);
  }

  const neuralPanelCycle = acceptsCurrentCycle
    ? resolveNeuralPanelCycle(currentDashboard, incomingRounds)
    : {
        cycleRounds: [] as Round[],
        resetVersion: currentDashboard.neuralPanelCycleResetVersion,
        resetRoundKey: currentDashboard.neuralPanelCycleResetRoundKey,
      };
  const generatedNeural = acceptsCurrentCycle
    ? buildNumeroPaganteNeural(
        liveValidatorRoundHistory,
        neuralPanelCycle.cycleRounds.length ? neuralPanelCycle.cycleRounds : undefined,
      )
    : null;
  if (generatedNeural) {
    pickedSections.neuralReading = generatedNeural.reading;
    pickedSections.neuralScoreboard = generatedNeural.scoreboard;
  }

  const rounds = incomingRounds.length ? incomingRounds.slice(-30) : currentDashboard.rounds;
  const currentLatestRound = latestRoundFromRoundList(currentDashboard.rounds);
  const incomingLatestRound = latestRoundFromRoundList(incomingRounds);
  const currentLatestKey = currentLatestRound ? roundHistoryKey(currentLatestRound) : "";
  const incomingLatestKey = incomingLatestRound ? roundHistoryKey(incomingLatestRound) : "";
  const receivedNewRound = Boolean(incomingLatestKey && incomingLatestKey !== currentLatestKey);
  const incomingUpdatedAt = readString(incoming, "updatedAt") || readString(incoming, "updated_at");
  const nextUpdatedAt =
    incomingUpdatedAt ||
    (incomingRounds.length
      ? receivedNewRound
        ? new Date().toISOString()
        : currentDashboard.updatedAt || new Date().toISOString()
      : new Date().toISOString());
  const normalizedSignal = acceptsCurrentCycle
    ? normalizeSignal(readMainSignal(incoming), currentDashboard.currentSignal)
    : currentDashboard.currentSignal;
  const bettingTiming = pickedSections.bettingTiming ?? currentDashboard.bettingTiming ?? null;
  let lateSignalHold = currentDashboard.lateSignalHold ?? null;
  const carriedLateSignalHold = Boolean(lateSignalHold && !receivedNewRound);
  let resolvedSignal = acceptsCurrentCycle
    ? resolveSignalImmediatelyFromRound(
        currentDashboard.currentSignal,
        normalizedSignal,
        incomingLatestRound,
        receivedNewRound,
      )
    : currentDashboard.currentSignal;

  if (acceptsCurrentCycle && lateSignalHold && receivedNewRound) {
    const heldResolution = resolveSignalImmediatelyFromRound(
      lateSignalHold,
      normalizedSignal,
      incomingLatestRound,
      receivedNewRound,
    );
    if (heldResolution.status === "g1") {
      resolvedSignal = heldResolution;
    }
    lateSignalHold = null;
  }

  let currentSignal = resolvedSignal;
  if (acceptsCurrentCycle) {
    currentSignal = resolveLateSignalGuard(resolvedSignal, bettingTiming, currentDashboard.currentSignal);
    const hiddenLateEntry =
      isServerEntrySide(resolvedSignal.side) &&
      (resolvedSignal.status === "pending" || resolvedSignal.status === "g1") &&
      currentSignal.side === "NONE" &&
      currentSignal.status === "waiting";
    if (hiddenLateEntry && resolvedSignal.status === "pending" && signalAllowsG1(resolvedSignal.protection)) {
      lateSignalHold = resolvedSignal;
    } else if (!hiddenLateEntry && !carriedLateSignalHold) {
      lateSignalHold = null;
    }
  }
  const nextDashboard: LiveDashboardData = {
    ...currentDashboard,
    ...pickedSections,
    mockMode: false,
    user: { ...currentDashboard.user, ...readRecord(incoming.user) },
    rounds,
    currentSignal,
    lateSignalHold,
    currentTieAlert: normalizeTieAlert(
      acceptsCurrentCycle ? incoming.currentTieAlert || incoming.tieAlert : {},
      currentDashboard.currentTieAlert,
    ),
    pressureSeries:
      acceptsCurrentCycle && Array.isArray(incoming.pressureSeries)
        ? incoming.pressureSeries
        : currentDashboard.pressureSeries,
    updatedAt: nextUpdatedAt,
    cycleDate,
    dailyCycleDate: cycleDate,
    neuralPanelCycleResetVersion: neuralPanelCycle.resetVersion ?? currentDashboard.neuralPanelCycleResetVersion,
    neuralPanelCycleResetRoundKey: neuralPanelCycle.resetRoundKey ?? currentDashboard.neuralPanelCycleResetRoundKey,
    strictDailyCounters: currentDashboard.strictDailyCounters && incomingCycleDate !== cycleDate,
  };

  const hasIncomingNeuralLifecycle =
    acceptsCurrentCycle &&
    (Object.prototype.hasOwnProperty.call(incoming, "neuralEntryState") ||
      Object.prototype.hasOwnProperty.call(incoming, "neuralEntryLastResult"));
  const dashboardWithNeuralEntry = hasIncomingNeuralLifecycle
    ? syncServerNeuralReadingFromIncomingLifecycle(nextDashboard)
    : trackServerNeuralEntryLifecycle(nextDashboard, currentDashboard, incomingLatestRound, receivedNewRound);
  const dashboardWithVisibleNeuralSignal = hasIncomingNeuralLifecycle
    ? dashboardWithNeuralEntry
    : exposeServerNeuralEntryAsCurrentSignal(dashboardWithNeuralEntry);
  const dashboardWithLateSignalGuard =
    acceptsCurrentCycle && !hasIncomingNeuralLifecycle
      ? guardLateServerNeuralSignal(dashboardWithVisibleNeuralSignal, currentDashboard)
      : dashboardWithVisibleNeuralSignal;
  const dashboardWithTieScoreboard = trackServerTieRoundScoreboard(
    dashboardWithLateSignalGuard,
    currentDashboard,
    incomingRounds,
  );
  return trackServerEntryModeStats(trackServerNeuralSequences(dashboardWithTieScoreboard, currentDashboard));
}

function syncServerNeuralReadingFromIncomingLifecycle(dashboard: LiveDashboardData): LiveDashboardData {
  const state = normalizeServerNeuralEntryState(dashboard.neuralEntryState);
  if (state) {
    return {
      ...dashboard,
      neuralEntryState: state,
      neuralReading: neuralReadingForEntryState(state),
    };
  }

  const result = normalizeServerNeuralEntryLastResult(dashboard.neuralEntryLastResult);
  if (!result) return dashboard;
  return {
    ...dashboard,
    neuralEntryState: null,
    neuralEntryLastResult: result,
    neuralReading: neuralReadingForEntryResult(result),
  };
}

function trackServerNeuralEntryLifecycle(
  dashboard: LiveDashboardData,
  previousDashboard: LiveDashboardData,
  latestRound: Round | undefined,
  receivedNewRound: boolean,
): LiveDashboardData {
  const effectiveLatestRound =
    latestRound ??
    (Array.isArray(dashboard.rounds) ? dashboard.rounds[dashboard.rounds.length - 1] : undefined) ??
    liveValidatorRoundHistory[liveValidatorRoundHistory.length - 1];
  const latestRoundKey = effectiveLatestRound ? roundHistoryKey(effectiveLatestRound) : "";
  const previousState = normalizeServerNeuralEntryState(
    previousDashboard.neuralEntryState ?? dashboard.neuralEntryState,
  );
  const incomingResult = normalizeServerNeuralEntryLastResult(dashboard.neuralEntryLastResult);
  const previousResult =
    incomingResult ?? normalizeServerNeuralEntryLastResult(previousDashboard.neuralEntryLastResult);

  if (previousState) {
    let state = previousState;

    if (
      receivedNewRound &&
      effectiveLatestRound &&
      latestRoundKey &&
      latestRoundKey !== state.triggerRoundKey &&
      latestRoundKey !== state.sgRoundKey
    ) {
      const resolution = resolveServerNeuralEntryRound(state, effectiveLatestRound, latestRoundKey);
      if (resolution.result) {
        const scoreboard = applyServerNeuralEntryResult(
          previousDashboard.neuralScoreboard ?? dashboard.neuralScoreboard,
          resolution.result.kind,
        );

        return {
          ...dashboard,
          neuralEntryState: null,
          neuralEntryLastResult: resolution.result,
          neuralScoreboard: scoreboard,
          neuralReading: neuralReadingForEntryResult(resolution.result),
        };
      }
      state = resolution.state ?? state;
    }

    return {
      ...dashboard,
      neuralEntryState: state,
      neuralEntryLastResult: previousResult,
      neuralScoreboard: previousDashboard.neuralScoreboard ?? dashboard.neuralScoreboard,
      neuralReading: neuralReadingForEntryState(state),
    };
  }

  if (previousResult && latestRoundKey && previousResult.resultRoundKey === latestRoundKey && !receivedNewRound) {
    return {
      ...dashboard,
      neuralEntryState: null,
      neuralEntryLastResult: previousResult,
      neuralScoreboard: previousDashboard.neuralScoreboard ?? dashboard.neuralScoreboard,
      neuralReading: neuralReadingForEntryResult(previousResult),
    };
  }

  const nextState = latestRoundKey ? buildServerNeuralEntryState(dashboard.neuralReading, latestRoundKey) : null;
  if (!nextState) {
    return {
      ...dashboard,
      neuralEntryState: null,
      neuralEntryLastResult: previousResult,
    };
  }

  return {
    ...dashboard,
    neuralEntryState: nextState,
    neuralEntryLastResult: previousResult,
    neuralReading: neuralReadingForEntryState(nextState),
  };
}

function exposeServerNeuralEntryAsCurrentSignal(dashboard: LiveDashboardData): LiveDashboardData {
  const state = normalizeServerNeuralEntryState(dashboard.neuralEntryState);
  if (!state) return dashboard;

  const expectedSide = readServerNeuralSide(state.expectedSide);
  if (!expectedSide) return dashboard;

  const currentSignal = dashboard.currentSignal;
  const currentSignalIsIdle =
    !currentSignal ||
    currentSignal.side === "NONE" ||
    currentSignal.status === "waiting" ||
    String(currentSignal.id || "").startsWith("neural-entry:");

  if (!currentSignalIsIdle) return dashboard;

  const snapshot = state.readingSnapshot ?? dashboard.neuralReading;
  const protection = String(snapshot?.validade || currentSignal?.protection || "G1");
  const strength = clampPercent(snapshot?.assertividade ?? snapshot?.confidence ?? currentSignal?.strength ?? 0);

  return {
    ...dashboard,
    currentSignal: {
      id: `neural-entry:${state.key}:${state.triggerRoundKey}`,
      side: expectedSide,
      status: state.status === "awaiting_g1" ? "g1" : "pending",
      protection,
      strength,
      lastResult: null,
    },
  };
}

function buildServerNeuralEntryState(
  reading: DashboardData["neuralReading"],
  triggerRoundKey: string,
): NeuralEntryState | null {
  if (!reading || reading.mode !== "ACTIVE") return null;
  const expectedSide = readServerNeuralSide(reading.direcao ?? reading.origem);
  if (!expectedSide) return null;
  const key = serverNeuralEntryKey(reading);
  if (!key) return null;

  return {
    key,
    numero: typeof reading.numero === "number" ? reading.numero : null,
    origem: readServerNeuralSide(reading.origem),
    origemTipo: reading.origemTipo ?? null,
    expectedSide,
    status: "awaiting_sg",
    triggerRoundKey,
    sgRoundKey: null,
    startedAt: new Date().toISOString(),
    readingSnapshot: {
      ...reading,
      mode: "ACTIVE",
      validade: reading.validade ?? "G1",
    },
  };
}

function resolveServerNeuralEntryRound(
  state: NeuralEntryState,
  round: Round,
  roundKey: string,
): { state?: NeuralEntryState; result?: NeuralEntryLastResult } {
  const expectedSide = readServerNeuralSide(state.expectedSide);
  const snapshot = state.readingSnapshot ?? neuralReadingForEntryState(state);
  const tieMultiplier = round.result === "T" ? serverTieMultiplierFromRound(round) : null;
  const finishedAt = new Date().toISOString();

  if (round.result === "T") {
    const kind = state.status === "awaiting_sg" ? "tie_sg" : "tie_g1";
    return {
      result: {
        id: `${state.key}:${roundKey}:${kind}`,
        key: state.key,
        numero: state.numero,
        origem: state.origem,
        origemTipo: state.origemTipo,
        expectedSide,
        kind,
        outcome: "TIE",
        resultRoundKey: roundKey,
        finishedAt,
        tieMultiplier,
        readingSnapshot: snapshot,
      },
    };
  }

  if (expectedSide && serverRoundMatchesNeuralSide(round, expectedSide)) {
    const kind = state.status === "awaiting_sg" ? "sg" : "g1";
    return {
      result: {
        id: `${state.key}:${roundKey}:${kind}`,
        key: state.key,
        numero: state.numero,
        origem: state.origem,
        origemTipo: state.origemTipo,
        expectedSide,
        kind,
        outcome: "GREEN",
        resultRoundKey: roundKey,
        finishedAt,
        tieMultiplier: null,
        readingSnapshot: snapshot,
      },
    };
  }

  if (state.status === "awaiting_sg") {
    return {
      state: {
        ...state,
        status: "awaiting_g1",
        sgRoundKey: roundKey,
        readingSnapshot: neuralReadingForEntryState({
          ...state,
          status: "awaiting_g1",
          sgRoundKey: roundKey,
        }),
      },
    };
  }

  return {
    result: {
      id: `${state.key}:${roundKey}:red`,
      key: state.key,
      numero: state.numero,
      origem: state.origem,
      origemTipo: state.origemTipo,
      expectedSide,
      kind: "red",
      outcome: "RED",
      resultRoundKey: roundKey,
      finishedAt,
      tieMultiplier: null,
      readingSnapshot: snapshot,
    },
  };
}

function neuralReadingForEntryState(state: NeuralEntryState): NeuralReading {
  const snapshot = state.readingSnapshot ?? {
    mode: "ACTIVE",
    numero: state.numero,
    origem: state.origem,
    origemTipo: state.origemTipo,
    direcao: state.expectedSide,
    validade: "G1",
  };
  const expectedSide = state.expectedSide ?? snapshot.direcao ?? snapshot.origem ?? null;
  const statusLabel = state.status === "awaiting_g1" ? "AGUARDANDO_G1" : "ENTRADA_ATIVA";

  return {
    ...snapshot,
    mode: "ACTIVE",
    numero: state.numero ?? snapshot.numero,
    origem: state.origem ?? snapshot.origem,
    origemTipo: state.origemTipo ?? snapshot.origemTipo,
    direcao: expectedSide,
    validade: snapshot.validade ?? "G1",
    paganteStatus: statusLabel,
    paganteAlert:
      state.status === "awaiting_g1"
        ? "Entrada ativa. SG falhou, aguardando G1 antes de encerrar."
        : "Entrada ativa travada ate fechar SG ou G1.",
  };
}

function neuralReadingForEntryResult(result: NeuralEntryLastResult): NeuralReading {
  const snapshot = result.readingSnapshot ?? {
    mode: "OBSERVING",
    numero: result.numero,
    origem: result.origem,
    origemTipo: result.origemTipo,
    direcao: result.expectedSide,
    validade: "G1",
  };
  const isRed = result.kind === "red";
  const isTie = result.kind === "tie_sg" || result.kind === "tie_g1";
  const status = isRed ? "RED_FECHADO" : isTie ? "GREEN_EMPATE" : result.kind === "g1" ? "GREEN_G1" : "GREEN_SG";
  const multiplierText = isTie && result.tieMultiplier ? ` ${result.tieMultiplier}x` : "";

  return {
    ...snapshot,
    mode: "OBSERVING",
    numero: result.numero ?? snapshot.numero,
    origem: result.origem ?? snapshot.origem,
    origemTipo: result.origemTipo ?? snapshot.origemTipo,
    direcao: result.expectedSide ?? snapshot.direcao ?? snapshot.origem,
    validade: snapshot.validade ?? "G1",
    paganteStatus: status,
    paganteAlert: isRed
      ? "Entrada encerrada em RED depois do G1."
      : isTie
        ? `Entrada encerrada em GREEN EMPATE${multiplierText}.`
        : result.kind === "g1"
          ? "Entrada encerrada em GREEN G1."
          : "Entrada encerrada em GREEN SG.",
  };
}

function applyServerNeuralEntryResult(
  scoreboard: NeuralScoreboard | undefined,
  kind: NeuralEntryLastResult["kind"],
): NeuralScoreboard {
  const current = scoreboard ?? {};
  const greenSemGale = serverSafeCounter(current.greenSemGale);
  const greenG1 = serverSafeCounter(current.greenG1);
  const reds = serverSafeCounter(current.reds ?? current.erros);
  const isRed = kind === "red";
  const isG1 = kind === "g1" || kind === "tie_g1";
  const nextSg = greenSemGale + (!isRed && !isG1 ? 1 : 0);
  const nextG1 = greenG1 + (!isRed && isG1 ? 1 : 0);
  const nextReds = reds + (isRed ? 1 : 0);
  const greens = nextSg + nextG1;
  const previousPositive = serverSafeCounter(current.sequencePositive);
  const previousNegative = serverSafeCounter(current.sequenceNegative);
  const sequencePositive = isRed ? 0 : previousPositive + 1;
  const sequenceNegative = isRed ? previousNegative + 1 : 0;
  const maxSequencePositive = Math.max(serverSafeCounter(current.maxSequencePositive), sequencePositive);
  const maxSequenceNegative = Math.max(serverSafeCounter(current.maxSequenceNegative), sequenceNegative);

  return {
    ...current,
    totalAlerts: greens + nextReds,
    acertos: greens,
    greens,
    greenSemGale: nextSg,
    greenG1: nextG1,
    erros: nextReds,
    reds: nextReds,
    assertividade: calculateMotorAssertiveness(greens, nextReds),
    sequencePositive,
    sequenceNegative,
    maxSequencePositive,
    maxSequenceNegative,
  };
}

function normalizeServerNeuralEntryState(value: unknown): NeuralEntryState | null {
  const record = readRecord(value);
  const key = readString(record, "key");
  const status = readString(record, "status");
  const triggerRoundKey = readString(record, "triggerRoundKey");
  if (!key || !triggerRoundKey || (status !== "awaiting_sg" && status !== "awaiting_g1")) return null;

  return {
    key,
    numero: readNullableNumber(record.numero),
    origem: readServerNeuralSide(record.origem),
    origemTipo: readServerNeuralOriginKind(record.origemTipo),
    expectedSide: readServerNeuralSide(record.expectedSide),
    status,
    triggerRoundKey,
    sgRoundKey: readString(record, "sgRoundKey") || null,
    startedAt: readString(record, "startedAt") || null,
    readingSnapshot: normalizeServerNeuralReading(record.readingSnapshot),
  };
}

function normalizeServerNeuralEntryLastResult(value: unknown): NeuralEntryLastResult | null {
  const record = readRecord(value);
  const id = readString(record, "id");
  const key = readString(record, "key");
  const kind = readString(record, "kind");
  const resultRoundKey = readString(record, "resultRoundKey");
  const finishedAt = readString(record, "finishedAt");
  if (!id || !key || !resultRoundKey || !finishedAt || !["sg", "g1", "red", "tie_sg", "tie_g1"].includes(kind)) {
    return null;
  }

  return {
    id,
    key,
    numero: readNullableNumber(record.numero),
    origem: readServerNeuralSide(record.origem),
    origemTipo: readServerNeuralOriginKind(record.origemTipo),
    expectedSide: readServerNeuralSide(record.expectedSide),
    kind: kind as NeuralEntryLastResult["kind"],
    outcome: readServerNeuralOutcome(record.outcome, kind),
    resultRoundKey,
    finishedAt,
    tieMultiplier: readNullableNumber(record.tieMultiplier),
    readingSnapshot: normalizeServerNeuralReading(record.readingSnapshot),
  };
}

function normalizeServerNeuralReading(value: unknown): NeuralReading | null {
  const record = readRecord(value);
  if (!Object.keys(record).length) return null;
  const mode = readString(record, "mode");
  if (mode !== "ACTIVE" && mode !== "OBSERVING" && mode !== "SCANNING") return null;
  return record as unknown as NeuralReading;
}

function readServerNeuralSide(value: unknown): NeuralEntryState["expectedSide"] {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "BANKER" || text === "B") return "BANKER";
  if (text === "PLAYER" || text === "P") return "PLAYER";
  if (text === "TIE" || text === "T") return "TIE";
  return null;
}

function readServerNeuralOriginKind(value: unknown): NeuralEntryState["origemTipo"] {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "PAGANTE" || text === "OPOSTO" || text === "TIE") return text as NeuralEntryState["origemTipo"];
  return null;
}

function readServerNeuralOutcome(value: unknown, kind: string): NeuralEntryLastResult["outcome"] {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (text === "GREEN" || text === "RED" || text === "TIE") return text as NeuralEntryLastResult["outcome"];
  if (kind === "red") return "RED";
  if (kind === "tie_sg" || kind === "tie_g1") return "TIE";
  return "GREEN";
}

function serverNeuralEntryKey(reading: NeuralReading) {
  const numero = typeof reading.numero === "number" ? reading.numero : "";
  const origem = readServerNeuralSide(reading.origem);
  const origemTipo = readServerNeuralOriginKind(reading.origemTipo);
  const expectedSide = readServerNeuralSide(reading.direcao ?? reading.origem);
  if (numero === "" || !origem || !origemTipo || !expectedSide) return "";
  return `${numero}:${origem}:${origemTipo}:${expectedSide}`;
}

function serverRoundMatchesNeuralSide(round: Round, side: NonNullable<NeuralEntryState["expectedSide"]>) {
  if (side === "BANKER") return round.result === "B";
  if (side === "PLAYER") return round.result === "P";
  return round.result === "T";
}

function serverTieMultiplierFromRound(round: Round) {
  return tieMultiplierFromRound(round);
}

function resolveNeuralPanelCycle(
  dashboard: LiveDashboardData,
  incomingRounds: Round[],
): { cycleRounds: Round[]; resetVersion?: string; resetRoundKey?: string } {
  const latestRound =
    incomingRounds[incomingRounds.length - 1] ?? liveValidatorRoundHistory[liveValidatorRoundHistory.length - 1];
  let resetVersion = dashboard.neuralPanelCycleResetVersion;
  let resetRoundKey = dashboard.neuralPanelCycleResetRoundKey;

  if (resetVersion !== NEURAL_PANEL_CYCLE_RESET_VERSION) {
    resetVersion = NEURAL_PANEL_CYCLE_RESET_VERSION;
    resetRoundKey = latestRound ? roundHistoryKey(latestRound) : "";
  }

  const cycleRounds = resetRoundKey
    ? roundsFromNeuralCycleReset(liveValidatorRoundHistory, resetRoundKey)
    : incomingRounds;

  return {
    cycleRounds: cycleRounds.length ? cycleRounds : incomingRounds,
    resetVersion,
    resetRoundKey,
  };
}

function roundsFromNeuralCycleReset(rounds: Round[], resetRoundKey: string) {
  const sortedRounds = rounds.slice().sort(compareRoundHistory);
  const resetIndex = sortedRounds.findIndex((round) => roundHistoryKey(round) === resetRoundKey);
  if (resetIndex < 0) return [];
  return sortedRounds.slice(resetIndex);
}

function ensureDashboardDailyCycle(
  dashboard: DashboardData & { updatedAt?: string; cycleDate?: string; dailyCycleDate?: string },
) {
  const cycleDate = currentDashboardCycleDate();
  if (readDashboardCycleDate(dashboard) === cycleDate) {
    return {
      dashboard: {
        ...dashboard,
        cycleDate,
        dailyCycleDate: cycleDate,
        strictDailyCounters: (dashboard as unknown as { strictDailyCounters?: boolean }).strictDailyCounters ?? false,
      },
      changed: false,
    };
  }

  return {
    dashboard: resetDashboardDailyCycle(dashboard, cycleDate),
    changed: true,
  };
}

function resetDashboardDailyCycle(
  dashboard: DashboardData & { updatedAt?: string },
  cycleDate = currentDashboardCycleDate(),
): LiveDashboardData {
  return {
    ...dashboard,
    mockMode: false,
    rounds: Array.isArray(dashboard.rounds) ? dashboard.rounds.slice(-30) : [],
    currentSignal: {
      id: "waiting",
      side: "NONE",
      status: "waiting",
      protection: "-",
      strength: 0,
      lastResult: null,
    },
    currentTieAlert: {
      id: "current-tie",
      level: "Baixo",
      confidence: 0,
      validityRounds: 0,
      status: "expired",
    },
    currentSurfAlert: {
      surf_alert: false,
      surf_phase: "SEM_RISCO",
      surf_side: "NONE",
      surf_status: "SEM_RISCO",
      surf_risk: 0,
      surf_break_risk: 0,
      surf_confidence: 0,
      stretched_count: 0,
      correction_count: 0,
      reason: "Novo ciclo diario iniciado. Aguardando leitura atual da mesa.",
      panels: {
        big_road: "Aguardando primeiras rodadas do ciclo.",
        big_eye_boy: "Aguardando primeiras rodadas do ciclo.",
        small_road: "Aguardando primeiras rodadas do ciclo.",
        cockroach_pig: "Aguardando primeiras rodadas do ciclo.",
      },
      surf_prediction_side: "NONE",
      surf_prediction_status: "EXPIRED",
      surf_prediction_confidence: 0,
      surf_prediction_window: 0,
    },
    neuralReading: {
      mode: "SCANNING",
      alertas: 0,
      acertos: 0,
      greenSemGale: 0,
      greenG1: 0,
      erros: 0,
      reds: 0,
      assertividade: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
      maxSequencePositive: 0,
      maxSequenceNegative: 0,
    },
    engineDecision: {
      state: "AGUARDAR",
      reason: "Novo ciclo diario iniciado. Aguardando primeiras rodadas.",
      confidence: 0,
      debug: "cycle=novo",
    },
    mainScoreboard: {
      greens: 0,
      greensG1: 0,
      reds: 0,
      totalGreens: 0,
      totalEntries: 0,
      assertiveness: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
    },
    entryModeStats: emptyServerEntryModeStatsByMode(),
    tieAlertCountedRoundKeys: {},
    entryModeSignalModes: {},
    entryModeCountedResults: {},
    latestEntryModeSignalId: undefined,
    latestEntryModeSignalModes: [],
    neuralSequenceLastOutcome: null,
    neuralEntryState: null,
    neuralEntryLastResult: null,
    tieAlertScoreboard: {
      greenTieAlerts: 0,
      expired: 0,
      totalAlerts: 0,
      assertiveness: 0,
      sequencePositive: 0,
      sequenceExpired: 0,
      multipliers: emptyTieMultiplierCounts(),
      tiePullers: [],
    },
    surfAnalyzerScoreboard: {
      totalAlerts: 0,
      hits: 0,
      fails: 0,
      expired: 0,
      greenSemGale: 0,
      greenG1: 0,
      reds: 0,
      blocked: 0,
      noRisk: 0,
      bankerHits: 0,
      playerHits: 0,
      assertiveness: 0,
      sequencePositive: 0,
      sequenceNegative: 0,
      maxBankerSurfHit: 0,
      maxPlayerSurfHit: 0,
      maxBreakDetected: 0,
      maxRetakeDetected: 0,
      currentHitStreak: 0,
    },
    pressureSeries: [],
    updatedAt: dashboard.updatedAt || new Date().toISOString(),
    cycleDate,
    dailyCycleDate: cycleDate,
    strictDailyCounters: true,
  };
}

function resetNeuralReadingDailyCounters(reading: DashboardData["neuralReading"]): DashboardData["neuralReading"] {
  if (!reading) return reading;
  return {
    ...reading,
    alertas: 0,
    acertos: 0,
    greenSemGale: 0,
    greenG1: 0,
    erros: 0,
    reds: 0,
    assertividade: 0,
    sequencePositive: 0,
    sequenceNegative: 0,
    maxSequencePositive: 0,
    maxSequenceNegative: 0,
  };
}

function trackServerTieRoundScoreboard(
  dashboard: LiveDashboardData,
  previousDashboard: LiveDashboardData,
  incomingRounds: Round[],
): LiveDashboardData {
  const recentRounds = incomingRounds.slice(-MAX_MONITOR_ROUND_HISTORY);
  if (!recentRounds.length) return dashboard;

  const fallbackScoreboard = {
    greenTieAlerts: 0,
    expired: 0,
    totalAlerts: 0,
    assertiveness: 0,
    sequencePositive: 0,
    sequenceExpired: 0,
    multipliers: emptyTieMultiplierCounts(),
    tiePullers: [],
  };
  const currentScoreboard = dashboard.tieAlertScoreboard ?? previousDashboard.tieAlertScoreboard ?? fallbackScoreboard;
  const previousScoreboard = previousDashboard.tieAlertScoreboard ?? fallbackScoreboard;
  const currentGreenTieAlerts = serverSafeCounter(currentScoreboard.greenTieAlerts);
  const previousGreenTieAlerts = serverSafeCounter(previousScoreboard.greenTieAlerts);
  const payloadGreenAlreadyAdvanced = currentGreenTieAlerts > previousGreenTieAlerts;
  const currentMultiplierCounts = normalizeTieMultiplierCounts(currentScoreboard.multipliers);
  const previousMultiplierCounts = normalizeTieMultiplierCounts(previousScoreboard.multipliers);
  const payloadMultipliersAlreadyAdvanced =
    sumTieMultiplierCounts(currentMultiplierCounts) > sumTieMultiplierCounts(previousMultiplierCounts);

  const countedRoundKeys = {
    ...(previousDashboard.tieAlertCountedRoundKeys ?? {}),
    ...(dashboard.tieAlertCountedRoundKeys ?? {}),
  };
  let greenTieAlerts = Math.max(currentGreenTieAlerts, previousGreenTieAlerts);
  const expired = Math.max(serverSafeCounter(currentScoreboard.expired), serverSafeCounter(previousScoreboard.expired));
  let sequencePositive = Math.max(
    serverSafeCounter(currentScoreboard.sequencePositive),
    serverSafeCounter(previousScoreboard.sequencePositive),
  );
  let sequenceExpired = Math.max(
    serverSafeCounter(currentScoreboard.sequenceExpired),
    serverSafeCounter(previousScoreboard.sequenceExpired),
  );
  let multipliers = maxTieMultiplierCounts(currentMultiplierCounts, previousMultiplierCounts);
  let changed = false;

  for (const round of recentRounds.slice().sort(compareRoundHistory)) {
    const key = roundHistoryKey(round);
    if (countedRoundKeys[key]) continue;
    countedRoundKeys[key] = true;
    changed = true;

    if (String(round.result).toUpperCase() === "T") {
      if (!payloadGreenAlreadyAdvanced) {
        greenTieAlerts += 1;
        sequencePositive += 1;
        sequenceExpired = 0;
      }
      if (!payloadMultipliersAlreadyAdvanced) {
        multipliers = incrementTieMultiplierCounts(multipliers, round);
      }
    } else {
      if (!payloadGreenAlreadyAdvanced) sequencePositive = 0;
    }
  }

  const totalAlerts = greenTieAlerts + expired;
  const tieAlertCountedRoundKeys = pruneTieCountedRoundKeys(countedRoundKeys);
  const nextScoreboard = {
    ...currentScoreboard,
    greenTieAlerts,
    expired,
    totalAlerts,
    assertiveness: calculateMotorAssertiveness(greenTieAlerts, expired),
    sequencePositive,
    sequenceExpired,
    multipliers,
    tiePullers: buildTiePullerStats(liveValidatorRoundHistory, 7, 5),
  };
  const scoreboardChanged =
    nextScoreboard.greenTieAlerts !== currentGreenTieAlerts ||
    nextScoreboard.expired !== serverSafeCounter(currentScoreboard.expired) ||
    nextScoreboard.totalAlerts !== serverSafeCounter(currentScoreboard.totalAlerts) ||
    nextScoreboard.sequencePositive !== serverSafeCounter(currentScoreboard.sequencePositive) ||
    nextScoreboard.sequenceExpired !== serverSafeCounter(currentScoreboard.sequenceExpired) ||
    nextScoreboard.assertiveness !== safeNumber(currentScoreboard.assertiveness) ||
    JSON.stringify(nextScoreboard.multipliers) !==
      JSON.stringify(normalizeTieMultiplierCounts(currentScoreboard.multipliers)) ||
    JSON.stringify(nextScoreboard.tiePullers) !== JSON.stringify(currentScoreboard.tiePullers ?? []);

  if (!changed && !scoreboardChanged) return dashboard;

  return {
    ...dashboard,
    tieAlertCountedRoundKeys,
    tieAlertScoreboard: nextScoreboard,
  };
}

function pruneTieCountedRoundKeys(keys: Record<string, true>) {
  const allowedKeys = new Set(liveValidatorRoundHistory.slice(-MAX_MONITOR_ROUND_HISTORY).map(roundHistoryKey));
  const out: Record<string, true> = {};
  for (const key of Object.keys(keys)) {
    if (allowedKeys.has(key)) out[key] = true;
  }
  return out;
}

function sumTieMultiplierCounts(value: ReturnType<typeof normalizeTieMultiplierCounts>) {
  return Object.values(value).reduce((sum, count) => sum + serverSafeCounter(count), 0);
}

function maxTieMultiplierCounts(
  a: ReturnType<typeof normalizeTieMultiplierCounts>,
  b: ReturnType<typeof normalizeTieMultiplierCounts>,
) {
  const out = emptyTieMultiplierCounts();
  for (const label of Object.keys(out) as Array<keyof typeof out>) {
    out[label] = Math.max(serverSafeCounter(a[label]), serverSafeCounter(b[label]));
  }
  return out;
}

function trackServerNeuralSequences(
  dashboard: LiveDashboardData,
  previousDashboard: LiveDashboardData,
): LiveDashboardData {
  if (!dashboard.neuralReading && !dashboard.neuralScoreboard) return dashboard;

  const sequencePositive = Math.max(
    serverSafeCounter(dashboard.neuralScoreboard?.sequencePositive),
    serverSafeCounter(dashboard.neuralReading?.sequencePositive),
  );
  const sequenceNegative = Math.max(
    serverSafeCounter(dashboard.neuralScoreboard?.sequenceNegative),
    serverSafeCounter(dashboard.neuralReading?.sequenceNegative),
  );

  return {
    ...dashboard,
    neuralSequenceLastOutcome: inferServerNeuralOutcome(sequencePositive, sequenceNegative),
  };
}

function serverReadNeuralTotalsFromDashboard(dashboard: Pick<DashboardData, "neuralReading" | "neuralScoreboard">) {
  const reading = dashboard.neuralReading;
  const scoreboard = dashboard.neuralScoreboard;
  const greenSemGale = serverSafeCounter(scoreboard?.greenSemGale ?? reading?.greenSemGale);
  const greenG1 = serverSafeCounter(scoreboard?.greenG1 ?? reading?.greenG1);
  const splitGreens = greenSemGale + greenG1;
  const greens =
    splitGreens > 0 ? splitGreens : serverSafeCounter(scoreboard?.greens ?? scoreboard?.acertos ?? reading?.acertos);
  const reds = serverSafeCounter(scoreboard?.reds ?? scoreboard?.erros ?? reading?.reds ?? reading?.erros);
  return { greens, reds };
}

function inferServerNeuralOutcome(
  sequencePositive: number,
  sequenceNegative: number,
): LiveDashboardData["neuralSequenceLastOutcome"] {
  if (sequencePositive > 0 && sequenceNegative === 0) return "GREEN";
  if (sequenceNegative > 0 && sequencePositive === 0) return "RED";
  return null;
}

function readDashboardCycleDate(value: unknown) {
  const record = readRecord(value);
  const explicit = readString(record, "cycleDate") || readString(record, "dailyCycleDate");
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const updatedAt = readString(record, "updatedAt");
  if (!updatedAt) return "";
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";
  return currentDashboardCycleDate(date);
}

function currentDashboardCycleDate(now = new Date()) {
  const parts = dashboardCycleDateParts(now);
  if (parts.hour === "00" && parts.minute === "00") {
    return dashboardCycleDateParts(new Date(now.getTime() - 60_000)).date;
  }
  return parts.date;
}

function dashboardCycleDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DASHBOARD_CYCLE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: part("hour"),
    minute: part("minute"),
  };
}

function pickDashboardSections(incoming: Record<string, unknown>): Partial<LiveDashboardData> {
  const out: Partial<LiveDashboardData> = {};
  if (incoming.currentSurfAlert) out.currentSurfAlert = incoming.currentSurfAlert as DashboardData["currentSurfAlert"];
  if (incoming.surfAlert) out.currentSurfAlert = incoming.surfAlert as DashboardData["currentSurfAlert"];
  if (incoming.neuralReading) out.neuralReading = incoming.neuralReading as DashboardData["neuralReading"];
  if (incoming.neuralScoreboard) out.neuralScoreboard = incoming.neuralScoreboard as DashboardData["neuralScoreboard"];
  if (incoming.neural_scoreboard)
    out.neuralScoreboard = incoming.neural_scoreboard as DashboardData["neuralScoreboard"];
  if (incoming.neuralEntryState !== undefined)
    out.neuralEntryState = incoming.neuralEntryState as LiveDashboardData["neuralEntryState"];
  if (incoming.neuralEntryLastResult !== undefined)
    out.neuralEntryLastResult = incoming.neuralEntryLastResult as LiveDashboardData["neuralEntryLastResult"];
  if (incoming.moduleToggles) out.moduleToggles = incoming.moduleToggles as DashboardData["moduleToggles"];
  const bettingTiming = normalizeBettingTiming(
    incoming.bettingTiming ?? incoming.betting_timing ?? incoming.tableTiming ?? incoming.table_timing,
  );
  if (bettingTiming) out.bettingTiming = bettingTiming;
  if (incoming.engineDecision) out.engineDecision = incoming.engineDecision as DashboardData["engineDecision"];
  if (incoming.mainScoreboard) out.mainScoreboard = incoming.mainScoreboard as DashboardData["mainScoreboard"];
  if (incoming.tieAlertScoreboard)
    out.tieAlertScoreboard = incoming.tieAlertScoreboard as DashboardData["tieAlertScoreboard"];
  if (incoming.surfAnalyzerScoreboard)
    out.surfAnalyzerScoreboard = incoming.surfAnalyzerScoreboard as DashboardData["surfAnalyzerScoreboard"];
  if (incoming.patternMinerSnapshot || incoming.patternMiner)
    out.patternMinerSnapshot = (incoming.patternMinerSnapshot ||
      incoming.patternMiner) as LiveDashboardData["patternMinerSnapshot"];
  const incomingEntryModeStats = normalizeServerIncomingEntryModeStats(
    incoming.entryModeStats ?? incoming.entry_mode_stats,
  );
  if (incomingEntryModeStats) out.entryModeStats = incomingEntryModeStats;
  if (incoming.entryModeSignalModes)
    out.entryModeSignalModes = normalizeServerSignalModes(incoming.entryModeSignalModes);
  if (incoming.entryModeCountedResults)
    out.entryModeCountedResults = normalizeServerCountedResults(incoming.entryModeCountedResults);
  if (incoming.latestEntryModeSignalId) out.latestEntryModeSignalId = String(incoming.latestEntryModeSignalId);
  if (incoming.latestEntryModeSignalModes)
    out.latestEntryModeSignalModes = normalizeServerModeList(incoming.latestEntryModeSignalModes);
  return out;
}

function readMainSignal(payload: Record<string, unknown>) {
  return readRecord(
    payload.currentSignal ||
      payload.current_signal ||
      payload.mainSignal ||
      payload.main_signal ||
      payload.primarySignal ||
      payload.primary_signal ||
      payload.entradaPrincipal ||
      payload.entrada_principal ||
      payload.sinalPrincipal ||
      payload.sinal_principal ||
      payload.signal ||
      payload.sinal ||
      payload,
  );
}

function resolveSignalImmediatelyFromRound(
  previousSignal: DashboardData["currentSignal"],
  incomingSignal: DashboardData["currentSignal"],
  latestRound: Round | undefined,
  receivedNewRound: boolean,
): DashboardData["currentSignal"] {
  const preservedTerminalSignal = preserveTerminalSignalWhileStale(previousSignal, incomingSignal, receivedNewRound);
  if (preservedTerminalSignal) return preservedTerminalSignal;
  if (!receivedNewRound || !latestRound) return incomingSignal;
  if (terminalSignalStatus(incomingSignal.status) && incomingSignal.lastResult) return incomingSignal;
  if (!isServerEntrySide(previousSignal.side)) return incomingSignal;
  if (previousSignal.status !== "pending" && previousSignal.status !== "g1") return incomingSignal;

  const expectedResult = previousSignal.side === "BANKER" ? "B" : "P";
  if (latestRound.result === "T") {
    return buildResolvedSignalFromRound(previousSignal, latestRound, "tie");
  }

  if (latestRound.result === expectedResult) {
    return buildResolvedSignalFromRound(
      previousSignal,
      latestRound,
      previousSignal.status === "g1" ? "green_g1" : "green",
    );
  }

  if (previousSignal.status === "pending" && signalAllowsG1(previousSignal.protection)) {
    return {
      ...previousSignal,
      status: "g1",
      lastResult: null,
    };
  }

  return buildResolvedSignalFromRound(previousSignal, latestRound, "red");
}

function guardLateServerNeuralSignal(
  dashboard: LiveDashboardData,
  previousDashboard: LiveDashboardData,
): LiveDashboardData {
  const signal = dashboard.currentSignal;
  const guardedSignal = resolveLateSignalGuard(signal, dashboard.bettingTiming, previousDashboard.currentSignal);
  if (guardedSignal === signal) return dashboard;

  const hiddenLateEntry =
    isServerEntrySide(signal.side) &&
    (signal.status === "pending" || signal.status === "g1" || signal.status === "tie_watch") &&
    guardedSignal.side === "NONE" &&
    guardedSignal.status === "waiting";

  let lateSignalHold = dashboard.lateSignalHold ?? null;
  if (hiddenLateEntry && signal.status === "pending" && signalAllowsG1(signal.protection)) {
    lateSignalHold = signal;
  } else if (hiddenLateEntry) {
    lateSignalHold = null;
  }

  return {
    ...dashboard,
    currentSignal: guardedSignal,
    lateSignalHold,
  };
}

function resolveLateSignalGuard(
  signal: DashboardData["currentSignal"],
  bettingTiming: DashboardData["bettingTiming"],
  previousSignal?: DashboardData["currentSignal"],
): DashboardData["currentSignal"] {
  if (!isLateEntryWindow(bettingTiming)) return signal;
  if (signal.status !== "pending" && signal.status !== "g1" && signal.status !== "tie_watch") return signal;

  const sameVisibleSignal = Boolean(
    previousSignal &&
    previousSignal.id === signal.id &&
    previousSignal.side === signal.side &&
    (previousSignal.status === "pending" || previousSignal.status === "g1" || previousSignal.status === "tie_watch"),
  );
  if (sameVisibleSignal) return signal;

  return {
    ...signal,
    side: "NONE",
    status: "waiting",
    protection: "-",
    strength: 0,
    lastResult: signal.lastResult ?? null,
  };
}

function isLateEntryWindow(timing: DashboardData["bettingTiming"]) {
  if (!timing) return false;
  if (!isFreshBettingTiming(timing)) return false;
  if (timing.phase === "CLOSED") return true;
  const remaining = typeof timing.remainingSeconds === "number" ? timing.remainingSeconds : null;
  return timing.phase === "OPEN" && remaining !== null && remaining <= LATE_ENTRY_BLOCK_SECONDS;
}

function isFreshBettingTiming(timing: DashboardData["bettingTiming"]) {
  const updatedAt = Date.parse(String(timing?.updatedAt || ""));
  if (!Number.isFinite(updatedAt)) return true;
  const age = Date.now() - updatedAt;
  return age >= -5_000 && age <= BETTING_TIMING_MAX_AGE_MS;
}

function preserveTerminalSignalWhileStale(
  previousSignal: DashboardData["currentSignal"],
  incomingSignal: DashboardData["currentSignal"],
  receivedNewRound: boolean,
): DashboardData["currentSignal"] | null {
  if (receivedNewRound) return null;
  if (!terminalSignalStatus(previousSignal.status) || !previousSignal.lastResult) return null;
  if (terminalSignalStatus(incomingSignal.status)) return null;
  if (incomingSignal.status !== "pending" && incomingSignal.status !== "g1") return null;
  if (!isServerEntrySide(previousSignal.side) || previousSignal.side !== incomingSignal.side) return null;
  return previousSignal;
}

function buildResolvedSignalFromRound(
  signal: DashboardData["currentSignal"],
  round: Round,
  status: NonNullable<ReturnType<typeof terminalSignalStatus>>,
): DashboardData["currentSignal"] {
  const side = isServerEntrySide(signal.side) ? signal.side : "BANKER";
  const protection = signal.protection || "G1";
  const resultId = `${signal.id || "signal"}:${roundHistoryKey(round)}:${status}`;
  return {
    ...signal,
    side,
    status,
    protection,
    lastResult: {
      id: resultId,
      side,
      status,
      protection,
      finishedAt: new Date().toISOString(),
    },
  };
}

function signalAllowsG1(protection: string) {
  const clean = String(protection || "")
    .trim()
    .toUpperCase();
  if (!clean || clean === "-" || clean === "SG") return false;
  if (clean.includes("G1") || clean.includes("G2") || clean.includes("GALE")) return true;
  const numeric = Number(clean.replace(/[^0-9]+/g, ""));
  return Number.isFinite(numeric) && numeric >= 1;
}

function normalizeSignal(
  signal: Record<string, unknown>,
  fallback: DashboardData["currentSignal"],
): DashboardData["currentSignal"] {
  const side = normalizeSignalSide(signal.side || signal.direcao || signal.entry || signal.entrada);
  const status = normalizeSignalStatus(signal.status || signal.resultado || signal.state, side);
  const protection = String(signal.protection || signal.validade || signal.gale || fallback.protection || "G1");
  const terminalStatus = terminalSignalStatus(status);
  const incomingLastResult = readServerLastResult(signal.lastResult);
  const previousVisibleEntry =
    (fallback.status === "pending" || fallback.status === "g1") &&
    fallback.side === side &&
    (side === "BANKER" || side === "PLAYER");
  const canAcceptTerminalResult = Boolean(
    terminalStatus && (previousVisibleEntry || (incomingLastResult && incomingLastResult.side === side)),
  );
  const canPromoteRecentLastResult = Boolean(
    incomingLastResult &&
    (status === "pending" || status === "g1") &&
    incomingLastResult.side === side &&
    (side === "BANKER" || side === "PLAYER") &&
    isRecentServerSignalResult(incomingLastResult.finishedAt),
  );

  if (canPromoteRecentLastResult && incomingLastResult) {
    const resolvedProtection = incomingLastResult.protection || protection;
    return {
      id: String(signal.id || signal.signalId || fallback.id || incomingLastResult.id),
      side,
      status: incomingLastResult.status,
      protection: resolvedProtection,
      strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
      lastResult: {
        ...incomingLastResult,
        side,
        protection: resolvedProtection,
      },
    };
  }

  if (terminalStatus) {
    if (!canAcceptTerminalResult || (side !== "BANKER" && side !== "PLAYER")) {
      return {
        id: "waiting",
        side: "NONE",
        status: "waiting",
        protection: "-",
        strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
        lastResult: null,
      };
    }

    const lastResult: DashboardData["currentSignal"]["lastResult"] =
      incomingLastResult && incomingLastResult.side === side
        ? incomingLastResult
        : {
            id: String(signal.id || signal.signalId || fallback.id || `result-${Date.now()}`),
            side,
            status: terminalStatus,
            protection,
            finishedAt: readString(signal, "finishedAt") || new Date().toISOString(),
          };

    return {
      id: String(signal.id || signal.signalId || fallback.id || `result-${Date.now()}`),
      side,
      status: terminalStatus,
      protection,
      strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
      lastResult,
    };
  }

  if (status === "g1" && incomingLastResult && (side === "BANKER" || side === "PLAYER")) {
    const resolvedProtection = incomingLastResult.protection || protection;
    return {
      id: String(signal.id || signal.signalId || fallback.id || `result-${Date.now()}`),
      side,
      status: incomingLastResult.status,
      protection: resolvedProtection,
      strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
      lastResult: {
        ...incomingLastResult,
        side,
        protection: resolvedProtection,
      },
    };
  }

  return {
    id: String(signal.id || signal.signalId || `signal-${Date.now()}`),
    side,
    status,
    protection,
    strength: clampPercent(signal.strength ?? signal.confidence ?? signal.forca ?? fallback.strength),
    lastResult: null,
  };
}

function normalizeBettingTiming(value: unknown): DashboardData["bettingTiming"] | null {
  const record = readRecord(value);
  if (!Object.keys(record).length) return null;
  const rawPhase = String(record.phase ?? record.status ?? record.state ?? "")
    .trim()
    .toUpperCase();
  const phase =
    rawPhase === "OPEN" || rawPhase === "ABERTA" || rawPhase === "BETTING_OPEN"
      ? "OPEN"
      : rawPhase === "CLOSED" || rawPhase === "FECHADA" || rawPhase === "BETTING_CLOSED"
        ? "CLOSED"
        : null;
  const remainingValue =
    record.remainingSeconds ??
    record.remaining_seconds ??
    record.secondsLeft ??
    record.seconds_left ??
    record.timeLeft ??
    record.time_left;
  const remainingNumber = Number(remainingValue);
  const remainingSeconds = Number.isFinite(remainingNumber) ? Math.max(0, Math.min(300, remainingNumber)) : null;
  if (!phase && remainingSeconds === null) return null;
  return {
    phase,
    remainingSeconds,
    roundId: (record.roundId ?? record.round_id ?? null) as string | number | null,
    updatedAt: readString(record, "updatedAt") || readString(record, "updated_at") || new Date().toISOString(),
  };
}

function readServerLastResult(value: unknown): DashboardData["currentSignal"]["lastResult"] {
  const record = readRecord(value);
  if (!Object.keys(record).length) return null;
  const side = normalizeSignalSide(record.side || record.direcao || record.entry || record.entrada);
  const status = terminalSignalStatus(normalizeSignalStatus(record.status || record.resultado || record.state, side));
  if (!status || (side !== "BANKER" && side !== "PLAYER")) return null;
  return {
    id: String(record.id || record.signalId || `result-${Date.now()}`),
    side,
    status,
    protection: String(record.protection || record.validade || record.gale || "G1"),
    finishedAt: readString(record, "finishedAt") || new Date().toISOString(),
  };
}

function isRecentServerSignalResult(finishedAt?: string) {
  const time = Date.parse(finishedAt ?? "");
  if (!Number.isFinite(time)) return false;
  const age = Date.now() - time;
  return age >= -5_000 && age <= 95_000;
}

function terminalSignalStatus(status: DashboardData["currentSignal"]["status"]) {
  if (status === "green" || status === "green_g1" || status === "red" || status === "tie") return status;
  return null;
}

function trackServerEntryModeStats(dashboard: LiveDashboardData): LiveDashboardData {
  const signal = dashboard.currentSignal;
  const signalModes = normalizeServerSignalModes(dashboard.entryModeSignalModes);
  const countedResults = normalizeServerCountedResults(dashboard.entryModeCountedResults);
  const stats = normalizeServerEntryModeStatsByMode(dashboard.entryModeStats);
  let latestSignalId = String(dashboard.latestEntryModeSignalId || "");
  let latestSignalModes = normalizeServerModeList(dashboard.latestEntryModeSignalModes);

  if (isServerEntrySide(signal.side) && signal.status === "pending") {
    const modes = serverModesThatWouldAcceptEntry(dashboard);
    if (!sameServerModeList(signalModes[signal.id], modes)) {
      signalModes[signal.id] = modes;
      latestSignalId = signal.id;
      latestSignalModes = modes;
    }
  }

  const result = signal.lastResult;
  if (result) {
    const resultKey = serverEntryModeResultKey(result);
    if (!countedResults[resultKey]) {
      const resultModes = signalModes[result.id] ?? latestSignalModes ?? [];
      for (const mode of resultModes) {
        incrementServerEntryModeStats(stats, mode, result);
      }
      countedResults[resultKey] = true;
    }
  }

  return {
    ...dashboard,
    entryModeStats: stats,
    entryModeSignalModes: pruneServerSignalModes(signalModes),
    entryModeCountedResults: pruneServerCountedResults(countedResults),
    latestEntryModeSignalId: latestSignalId || undefined,
    latestEntryModeSignalModes: latestSignalModes,
  };
}

function serverModesThatWouldAcceptEntry(data: DashboardData) {
  return ACTIVE_ENTRY_MODES.filter((mode) => !serverBuildEntryModeFilter(data, mode));
}

function serverBuildEntryModeFilter(data: DashboardData, mode: ActiveEntryMode) {
  const signal = data.currentSignal;
  if (mode === "aggressive") return null;
  if (signal.status !== "pending" || !isServerEntrySide(signal.side)) return null;

  const confidence = clampPercent(data.engineDecision?.confidence ?? 0);
  const strength = clampPercent(signal.strength ?? 0);
  const surfRisk = serverOppositeSurfRisk(data, signal.side);
  const neuralRisk = serverHasNeuralRisk(data.neuralReading);
  const sniperNeuralGate = serverReadSniperNeuralGate(data.neuralReading, signal.side);
  const tieActive = data.currentTieAlert.status === "active";
  const tieHigh = tieActive && serverNormalizeText(data.currentTieAlert.level).includes("ALTO");
  const engineConfirmed = data.engineDecision.state === "ENTRADA";

  if (mode === "sniper") {
    return Boolean(
      !engineConfirmed ||
      confidence < 80 ||
      strength < 78 ||
      tieActive ||
      surfRisk >= 40 ||
      neuralRisk ||
      !sniperNeuralGate.accepted,
    );
  }

  return Boolean(!engineConfirmed || confidence < 70 || strength < 70 || tieHigh || surfRisk >= 65 || neuralRisk);
}

function incrementServerEntryModeStats(
  statsByMode: Partial<Record<ActiveEntryMode, EntryModeStats>>,
  mode: ActiveEntryMode,
  result: NonNullable<DashboardData["currentSignal"]["lastResult"]>,
) {
  const current = normalizeServerEntryModeStatsRecord(statsByMode[mode]);
  const kind = serverReadEntryModeResultKind(result);
  const sg = serverSafeCounter(current.greenSemGale ?? current.sg ?? current.greens);
  const g1 = serverSafeCounter(current.greenG1 ?? current.greensG1);
  const emp = serverSafeCounter(current.emp ?? current.ties);
  const reds = serverSafeCounter(current.reds);

  const nextSg = kind === "sg" ? sg + 1 : sg;
  const nextG1 = kind === "g1" ? g1 + 1 : g1;
  const nextEmp = kind === "emp" ? emp + 1 : emp;
  const nextReds = kind === "red" ? reds + 1 : reds;
  const totalGreens = nextSg + nextG1;
  const totalEntries = totalGreens + nextReds;

  statsByMode[mode] = {
    sg: nextSg,
    greens: nextSg,
    greenSemGale: nextSg,
    greenG1: nextG1,
    greensG1: nextG1,
    emp: nextEmp,
    ties: nextEmp,
    reds: nextReds,
    totalGreens,
    totalEntries,
    total: totalEntries + nextEmp,
    assertiveness: calculateMotorAssertiveness(totalGreens, nextReds),
  };
}

function serverReadEntryModeResultKind(result: NonNullable<DashboardData["currentSignal"]["lastResult"]>) {
  const record = readRecord(result);
  const status = serverNormalizeText(readString(record, "status"));
  const side = serverNormalizeText(readString(record, "side"));
  const protection = serverNormalizeText(readString(record, "protection"));
  if (
    status.includes("TIE") ||
    status.includes("EMPATE") ||
    status.includes("EMP") ||
    side === "TIE" ||
    side === "EMPATE"
  )
    return "emp";
  if (status.includes("RED") || status.includes("LOSS")) return "red";
  if (status.includes("G1") || protection.includes("G1")) return "g1";
  return "sg";
}

function serverEntryModeResultKey(result: NonNullable<DashboardData["currentSignal"]["lastResult"]>) {
  const record = readRecord(result);
  return [
    readString(record, "id"),
    readString(record, "status"),
    readString(record, "side"),
    readString(record, "protection"),
    readString(record, "finishedAt"),
  ].join(":");
}

function isServerEntrySide(side: CurrentSignalSide): side is SignalSide {
  return side === "BANKER" || side === "PLAYER";
}

function serverOppositeSurfRisk(data: DashboardData, side: SignalSide) {
  const alert = data.currentSurfAlert;
  if (!alert) return 0;
  const surfSide =
    alert.surf_prediction_side && alert.surf_prediction_side !== "NONE" ? alert.surf_prediction_side : alert.surf_side;
  if (surfSide === "NONE" || surfSide === side) return 0;
  return clampPercent(alert.surf_break_risk ?? alert.surf_risk ?? 0);
}

function serverHasNeuralRisk(reading?: NeuralReading | null) {
  if (!reading) return false;
  const status = serverNormalizeText(reading.paganteStatus);
  return Boolean(reading.isRedAlert || reading.isSaturated || status.includes("RISCO") || status.includes("ESTICADO"));
}

function serverReadSniperNeuralGate(reading: NeuralReading | null | undefined, entrySide: SignalSide) {
  if (!reading || reading.mode === "SCANNING" || typeof reading.numero !== "number") return { accepted: false };
  if (reading.origemTipo === "OPOSTO") return { accepted: false };
  if (serverReadPaganteKind(reading) !== "favorable") return { accepted: false };

  const paganteSide = reading.direcao ?? reading.origem ?? null;
  if (paganteSide !== entrySide) return { accepted: false };

  const performance = serverReadNeuralPerformance(reading);
  return {
    accepted: Boolean(performance && performance.assertiveness >= SNIPER_NEURAL_ASSERTIVENESS_MIN),
  };
}

function serverReadPaganteKind(reading?: NeuralReading | null): "favorable" | "watch" | "risk" {
  if (!reading) return "watch";
  const status = serverNormalizeText(reading.paganteStatus);
  if (reading.isRedAlert || reading.isSaturated || status.includes("RISCO") || status.includes("ESTICADO")) {
    return "risk";
  }
  if (
    reading.mode === "OBSERVING" ||
    status.includes("INICIANTE") ||
    status.includes("OBSERV") ||
    status.includes("POS-EMPATE") ||
    status.includes("POS EMPATE")
  ) {
    return "watch";
  }
  return "favorable";
}

function serverReadNeuralPerformance(reading: NeuralReading) {
  const greenSemGale = serverNumberOrZero(reading.greenSemGale ?? null);
  const greenG1 = serverNumberOrZero(reading.greenG1 ?? null);
  const greensFromSplit = greenSemGale + greenG1;
  const greens = greensFromSplit > 0 ? greensFromSplit : serverNumberOrZero(reading.acertos ?? null);
  const reds = serverNumberOrZero(reading.reds ?? reading.erros ?? null);
  const total = greens + reds;
  const providedAssertiveness = serverReadOptionalNumber(reading.assertividade);

  if (total > 0) {
    return {
      greens,
      reds,
      total,
      assertiveness: calculateMotorAssertiveness(greens, reds),
    };
  }

  if (typeof providedAssertiveness === "number") {
    return {
      greens,
      reds,
      total,
      assertiveness: serverClampPercentDecimal(providedAssertiveness),
    };
  }

  return null;
}

function normalizeServerEntryModeStatsByMode(value: unknown): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    stats[mode] = normalizeServerEntryModeStatsRecord(record[mode]);
  }
  return stats;
}

function normalizeServerIncomingEntryModeStats(
  value: unknown,
): Partial<Record<ActiveEntryMode, EntryModeStats>> | undefined {
  const record = readRecord(value);
  const stats: Partial<Record<ActiveEntryMode, EntryModeStats>> = {};
  for (const mode of ACTIVE_ENTRY_MODES) {
    const rawStats = readRecord(record[mode]);
    if (Object.keys(rawStats).length > 0) {
      stats[mode] = normalizeServerEntryModeStatsRecord(rawStats);
    }
  }
  return ACTIVE_ENTRY_MODES.some((mode) => hasServerEntryModeStats(stats[mode])) ? stats : undefined;
}

function normalizeServerEntryModeStatsRecord(value: unknown): EntryModeStats {
  const record = readRecord(value);
  const sg =
    serverReadOptionalNumber(
      serverFirstDefined(record.sg, record.greenSemGale, record.green_sem_gale, record.greens),
    ) ?? 0;
  const g1 =
    serverReadOptionalNumber(serverFirstDefined(record.greenG1, record.green_g1, record.greensG1, record.greens_g1)) ??
    0;
  const emp = serverReadOptionalNumber(serverFirstDefined(record.emp, record.ties, record.tie, record.empates)) ?? 0;
  const reds = serverReadOptionalNumber(serverFirstDefined(record.reds, record.red, record.erros)) ?? 0;
  const totalGreens = serverReadOptionalNumber(serverFirstDefined(record.totalGreens, record.total_greens)) ?? sg + g1;
  const totalEntries =
    serverReadOptionalNumber(serverFirstDefined(record.totalEntries, record.total_entries)) ?? totalGreens + reds;
  const total = serverReadOptionalNumber(record.total) ?? totalEntries + emp;
  return {
    sg,
    greens: sg,
    greenSemGale: sg,
    greenG1: g1,
    greensG1: g1,
    emp,
    ties: emp,
    reds,
    totalGreens,
    totalEntries,
    total,
    assertiveness:
      serverReadOptionalNumber(serverFirstDefined(record.assertiveness, record.assertividade)) ?? undefined,
  };
}

function hasServerEntryModeStats(stats?: EntryModeStats) {
  if (!stats) return false;
  return [
    stats.sg,
    stats.greenSemGale,
    stats.greens,
    stats.greenG1,
    stats.greensG1,
    stats.emp,
    stats.ties,
    stats.reds,
    stats.totalGreens,
    stats.totalEntries,
    stats.total,
  ].some((value) => serverNumberOrZero(serverReadOptionalNumber(value)) > 0);
}

function emptyServerEntryModeStatsByMode(): Partial<Record<ActiveEntryMode, EntryModeStats>> {
  return Object.fromEntries(ACTIVE_ENTRY_MODES.map((mode) => [mode, normalizeServerEntryModeStatsRecord({})]));
}

function normalizeServerSignalModes(value: unknown) {
  const record = readRecord(value);
  const modes: Record<string, ActiveEntryMode[]> = {};
  for (const [key, rawModes] of Object.entries(record)) {
    const modeList = normalizeServerModeList(rawModes);
    if (key && modeList.length > 0) modes[key] = modeList;
  }
  return modes;
}

function normalizeServerModeList(value: unknown) {
  if (value === undefined || value === null || value === "") return [];
  const values = Array.isArray(value) ? value : [value];
  const selected = new Set<ActiveEntryMode>();
  for (const rawMode of values) {
    const text = String(rawMode || "")
      .trim()
      .toLowerCase();
    if (text === "sniper") selected.add("sniper");
    if (text === "hunter" || text === "cacador") selected.add("hunter");
    if (text === "aggressive" || text === "agressivo") selected.add("aggressive");
  }
  return ACTIVE_ENTRY_MODES.filter((mode) => selected.has(mode));
}

function normalizeServerCountedResults(value: unknown) {
  const record = readRecord(value);
  return Object.fromEntries(
    Object.keys(record)
      .filter(Boolean)
      .map((key) => [key, true]),
  );
}

function sameServerModeList(left: ActiveEntryMode[] | undefined, right: ActiveEntryMode[]) {
  const safeLeft = left ?? [];
  if (safeLeft.length !== right.length) return false;
  return ACTIVE_ENTRY_MODES.every((mode) => safeLeft.includes(mode) === right.includes(mode));
}

function pruneServerSignalModes(signalModes: Record<string, ActiveEntryMode[]>) {
  const keys = Object.keys(signalModes);
  if (keys.length <= 300) return signalModes;
  return Object.fromEntries(keys.slice(-220).map((key) => [key, signalModes[key]]));
}

function pruneServerCountedResults(countedResults: Record<string, true>) {
  const keys = Object.keys(countedResults);
  if (keys.length <= 300) return countedResults;
  return Object.fromEntries(keys.slice(-220).map((key) => [key, true]));
}

function serverFirstDefined(...values: unknown[]) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function serverReadOptionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(String(value).replace("%", "").replace(",", ".").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function serverSafeCounter(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function serverNumberOrZero(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function serverClampPercentDecimal(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function serverNormalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function normalizeTieAlert(value: unknown, fallback: DashboardData["currentTieAlert"]) {
  const alert = readRecord(value);
  return {
    ...fallback,
    id: String(alert.id || fallback.id),
    level: normalizeTieLevel(alert.level || alert.nivel || fallback.level),
    confidence: clampPercent(alert.confidence ?? alert.confianca ?? fallback.confidence),
    validityRounds: Number(alert.validityRounds ?? alert.validade ?? fallback.validityRounds),
    status: ["active", "green", "expired"].includes(String(alert.status))
      ? (String(alert.status) as "active" | "green" | "expired")
      : fallback.status,
  };
}

function normalizeRounds(rounds: unknown[], limit = 30) {
  return rounds
    .map((round, index) => {
      const item = readRecord(round);
      const result = normalizeRoundResult(item.result || item.side || item.winner);
      if (!result) return null;
      return {
        id: Number(item.id || item.round || item.roundId || 1000 + index),
        result,
        bankerScore: Number(item.bankerScore ?? item.banker_score ?? item.banker ?? 0),
        playerScore: Number(item.playerScore ?? item.player_score ?? item.player ?? 0),
        tieMultiplier: readNullableNumber(item.tieMultiplier ?? item.tie_multiplier ?? item.multiplier),
        time: String(item.time || item.createdAt || "--:--"),
        recordedAt: normalizeRoundRecordedAt(item),
      };
    })
    .filter((round): round is DashboardData["rounds"][number] => Boolean(round))
    .sort(compareRoundHistory)
    .slice(-Math.max(1, limit));
}

function latestRoundFromRoundList(rounds: Round[] | undefined | null) {
  if (!Array.isArray(rounds) || !rounds.length) return null;
  return [...rounds].sort(compareRoundHistory).at(-1) ?? null;
}

function normalizeRoundsFromPayload(body: unknown, limit = MAX_SERVER_ROUND_HISTORY) {
  const record = readRecord(body);
  const dashboard = readRecord(record.dashboard);
  const sourceRounds = Array.isArray(record.rounds)
    ? record.rounds
    : Array.isArray(dashboard.rounds)
      ? dashboard.rounds
      : [];
  return normalizeRounds(sourceRounds, limit);
}

function mergeRoundHistory(current: Round[], incoming: Round[]) {
  return mergeRoundHistoryWithLimit(current, incoming, MAX_SERVER_ROUND_HISTORY);
}

function mergeMonitorRoundHistory(current: Round[], incoming: Round[]) {
  return mergeRoundHistoryWithLimit(current, incoming, MAX_MONITOR_ROUND_HISTORY);
}

function mergeRoundHistoryWithLimit(current: Round[], incoming: Round[], limit: number) {
  const byKey = new Map<string, Round>();
  for (const round of current) byKey.set(roundHistoryKey(round), round);
  for (const round of incoming) {
    const key = roundHistoryKey(round);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeRoundRecord(existing, round) : round);
  }
  return [...byKey.values()].sort(compareRoundHistory).slice(-Math.max(1, limit));
}

function mergeRoundRecord(existing: Round, incoming: Round): Round {
  const existingRecord = existing as unknown as Record<string, unknown>;
  const incomingRecord = incoming as unknown as Record<string, unknown>;
  return {
    ...existing,
    ...incoming,
    recordedAt: readString(existingRecord, "recordedAt") || readString(incomingRecord, "recordedAt"),
  } as Round;
}

function normalizeStoredRoundHistory(value: unknown) {
  const rows = Array.isArray(value) ? value : [];
  return normalizeRounds(rows, MAX_SERVER_ROUND_HISTORY).sort(compareRoundHistory);
}

function roundHistoryKey(round: Round) {
  return `${round.time}:${round.id}:${round.result}:${round.bankerScore}:${round.playerScore}`;
}

function compareRoundHistory(a: Round, b: Round) {
  const idCompare = a.id - b.id;
  if (idCompare) return idCompare;
  const timeCompare = a.time.localeCompare(b.time);
  if (timeCompare) return timeCompare;
  return `${a.result}:${a.bankerScore}:${a.playerScore}`.localeCompare(`${b.result}:${b.bankerScore}:${b.playerScore}`);
}

function clampRoundHistoryLimit(value: string | null) {
  const limit = Math.floor(Number(value) || 15_000);
  return Math.min(MAX_SERVER_ROUND_HISTORY, Math.max(1, limit));
}

function validatorTableId(value: string | null) {
  const clean = String(value || "bac-bo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || "bac-bo";
}

async function fetchStoredValidatorRounds(env: unknown, limit: number, tableId = "bac-bo") {
  if (!getSupabasePersistenceConfig(env)) return [];
  const rows = await fetchSupabaseRows(
    env,
    VALIDATOR_ROUNDS_TABLE,
    [
      "select=id,table_id,round_id,result,banker_score,player_score,round_time,created_at",
      `table_id=eq.${encodeURIComponent(tableId)}`,
      "order=round_id.desc",
      `limit=${Math.max(1, Math.min(MAX_SERVER_ROUND_HISTORY, limit))}`,
    ].join("&"),
  );
  return rows
    .map(storedValidatorRoundFromRow)
    .filter((round): round is Round => Boolean(round))
    .sort(compareRoundHistory);
}

async function persistValidatorRounds(env: unknown, rounds: Round[], tableId = "bac-bo") {
  if (!rounds.length || !getSupabasePersistenceConfig(env)) return false;
  const byId = new Map<string, Record<string, unknown>>();
  for (const round of rounds.slice(-MAX_VALIDATOR_ROUND_WRITE_BATCH)) {
    const row = storedValidatorRoundToRow(round, tableId);
    byId.set(readString(row, "id"), row);
  }
  const saved = await persistSupabaseRows(env, VALIDATOR_ROUNDS_TABLE, [...byId.values()], "id");
  if (saved) {
    void withTimeout(
      pruneStoredValidatorRounds(env, tableId),
      LIVE_STATE_IO_TIMEOUT_MS,
      "limpar rodadas antigas do Validador",
      false,
    );
  }
  return saved;
}

async function pruneStoredValidatorRounds(env: unknown, tableId = "bac-bo") {
  const cleanTableId = validatorTableId(tableId);
  const now = Date.now();
  const lastPrunedAt = validatorRoundPrunedAt.get(cleanTableId) || 0;
  if (now - lastPrunedAt < VALIDATOR_ROUND_PRUNE_MIN_INTERVAL_MS) return false;
  validatorRoundPrunedAt.set(cleanTableId, now);

  const boundaryRows = await fetchSupabaseRowsRange(
    env,
    VALIDATOR_ROUNDS_TABLE,
    ["select=round_id", `table_id=eq.${encodeURIComponent(cleanTableId)}`, "order=round_id.desc"].join("&"),
    MAX_SERVER_ROUND_HISTORY - 1,
    1,
  );
  const boundaryRoundId = Math.floor(Number(boundaryRows[0]?.round_id) || 0);
  if (!boundaryRoundId) return false;

  await deleteSupabaseRows(
    env,
    VALIDATOR_ROUNDS_TABLE,
    `table_id=eq.${encodeURIComponent(cleanTableId)}&round_id=lt.${boundaryRoundId}`,
  );
  return true;
}

function storedValidatorRoundToRow(round: Round, tableId: string) {
  const recordedAt = getRoundRecordedAt(round) || new Date().toISOString();
  return {
    id: validatorRoundStorageId(round, tableId),
    table_id: tableId,
    round_id: round.id,
    result: round.result,
    banker_score: round.bankerScore,
    player_score: round.playerScore,
    round_time: round.time,
    created_at: recordedAt,
  };
}

function storedValidatorRoundFromRow(row: Record<string, unknown>): Round | null {
  const result = normalizeRoundResult(row.result);
  if (!result) return null;
  const id = Number(row.round_id ?? row.roundId ?? row.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    result,
    bankerScore: Number(row.banker_score ?? row.bankerScore ?? 0),
    playerScore: Number(row.player_score ?? row.playerScore ?? 0),
    tieMultiplier: readNullableNumber(row.tie_multiplier ?? row.tieMultiplier ?? row.multiplier),
    time: readString(row, "round_time") || readString(row, "time") || readString(row, "created_at") || "--:--",
    recordedAt: readString(row, "created_at") || readString(row, "recordedAt") || readString(row, "recorded_at"),
  };
}

function validatorRoundStorageId(round: Round, tableId: string) {
  return `${validatorTableId(tableId)}:${round.id}:${round.time}:${round.result}:${round.bankerScore}:${round.playerScore}`
    .replace(/\s+/g, "_")
    .slice(0, 260);
}

function normalizeSignalSide(value: unknown): CurrentSignalSide {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "BANKER";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "PLAYER";
  if (["T", "TIE", "EMPATE"].includes(text)) return "TIE";
  return "NONE";
}

function normalizeSignalStatus(value: unknown, side: DashboardData["currentSignal"]["side"]): SignalStatus {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (["pending", "entrada", "active", "ativo"].includes(text)) return "pending";
  if (["g1", "gale1"].includes(text)) return "g1";
  if (["green", "win", "sg"].includes(text)) return "green";
  if (["green_g1", "greeng1"].includes(text)) return "green_g1";
  if (["red", "loss"].includes(text)) return "red";
  if (["tie", "tie_result", "empate_resultado", "empate_final"].includes(text)) return "tie";
  if (["tie_watch", "empate"].includes(text)) return "tie_watch";
  if (side === "BANKER" || side === "PLAYER") return "pending";
  if (side === "TIE") return "tie_watch";
  return "waiting";
}

function normalizeRoundResult(value: unknown) {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  if (["B", "BANKER", "BANCA"].includes(text)) return "B";
  if (["P", "PLAYER", "JOGADOR"].includes(text)) return "P";
  if (["T", "TIE", "EMPATE"].includes(text)) return "T";
  return null;
}

function normalizeTieLevel(value: unknown): DashboardData["currentTieAlert"]["level"] {
  const text = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (text.includes("ALTO")) return "Alto";
  if (text.includes("MED")) return "Medio";
  return "Baixo";
}

function clampPercent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

async function isDashboardAuthorized(request: Request, _url: URL, env: unknown) {
  const acceptedTokens = [
    readNamedServerSecret(env, "SNIPER_DASHBOARD_TOKEN", ""),
    readNamedServerSecret(env, "SNIPER_PUBLISHER_TOKEN", ""),
    readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", ""),
  ].filter(Boolean);
  const headerToken = getBearerToken(request);
  if (headerToken && acceptedTokens.includes(headerToken)) return true;
  if (!headerToken) return false;

  const session = await verifySessionToken(env, headerToken);
  if (!session) return false;
  if (session.scope !== "owner" && session.scope !== "admin_approver") return false;
  return sessionMatchesRequestBinding(env, request, session);
}

async function isDashboardWriteAuthorized(request: Request, url: URL, env: unknown) {
  if (await isDashboardAuthorized(request, url, env)) return true;

  const publisherToken = request.headers.get("x-sniper-publisher-token")?.trim() || "";
  if (publisherToken && dashboardPublisherTokens(env).includes(publisherToken)) return true;

  if (!(await isOfficialDashboardPublisherAuthorized(request, env))) return false;

  const token = getBearerToken(request);
  if (!token) return true;

  const session = await verifySessionToken(env, token);
  if (!session) return true;
  if (session.scope !== "owner" && session.scope !== "admin_approver") return false;

  if (await sessionMatchesRequestBinding(env, request, session)) return true;
  return isOfficialDashboardPublisherRequest(request);
}

function dashboardPublisherTokens(env: unknown) {
  return [
    readNamedServerSecret(env, "SNIPER_PUBLISHER_TOKEN", ""),
    readNamedServerSecret(env, "SNIPER_DASHBOARD_TOKEN", ""),
    readNamedServerSecret(env, "SNIPER_ADMIN_TOKEN", ""),
  ].filter(Boolean);
}

async function isOfficialDashboardPublisherAuthorized(request: Request, env: unknown) {
  if (!isOfficialDashboardPublisherRequest(request)) return false;

  const email = (request.headers.get("x-sniper-admin-email") || "").trim().toLowerCase();
  const password = request.headers.get("x-sniper-admin-password") || "";
  const adminRole = email ? getAdminRoleForEmail(env, email) : null;
  if (!adminRole || !password || !hasAdminPasswordConfig(env)) return false;
  return verifyConfiguredAdminPassword(env, password);
}

function isOfficialDashboardPublisherRequest(request: Request) {
  return (request.headers.get("user-agent") || "").toLowerCase().includes("sniperbo-official-publisher");
}

function isLocalDevelopmentRequest(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function isDashboardReadAuthorized(request: Request, url: URL, env: unknown) {
  if (await isDashboardAuthorized(request, url, env)) return true;

  const token = getBearerToken(request);
  if (!token) return false;

  const session = await verifySessionToken(env, token);
  if (!session) return false;
  if (session.scope === "owner") return sessionMatchesRequestBinding(env, request, session);
  if (session.scope !== "client") return false;

  const client = findClientByEmail(session.email);
  if (!client) return false;
  if (!clientHasLiveAccess(client)) return false;

  const sessionCheck = await validateClientSessionBinding(env, request, session, client);
  return sessionCheck.ok;
}

async function getAdminRequestRole(request: Request, env: unknown): Promise<AdminRole | null> {
  const headerToken = getBearerToken(request);
  if (!headerToken) return null;
  const session = await verifySessionToken(env, headerToken);
  if (session?.scope === "owner" && (await sessionMatchesRequestBinding(env, request, session))) {
    return "owner";
  }
  if (session?.scope === "admin_approver" && (await sessionMatchesRequestBinding(env, request, session))) {
    return "admin";
  }
  return null;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  if (!authorization.trim().toLowerCase().startsWith("bearer ")) return "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function getAdminEmails(env: unknown) {
  const defaultOwnerEmails = "gabrielmendespromove@gmail.com";
  return parseEmailList(
    `${defaultOwnerEmails},${readNamedServerSecret(env, "SNIPER_ADMIN_EMAIL", "")},${readNamedServerSecret(
      env,
      "SNIPER_ADMIN_EMAILS",
      "",
    )}`,
  );
}

function getAdminApproverEmails(env: unknown) {
  return parseEmailList(
    `${readNamedServerSecret(env, "SNIPER_ADMIN_APPROVER_EMAIL", "")},${readNamedServerSecret(
      env,
      "SNIPER_ADMIN_APPROVER_EMAILS",
      "",
    )}`,
  ).filter((email) => !getAdminEmails(env).includes(email));
}

function getAdminRoleForEmail(env: unknown, email: string): AdminRole | null {
  const cleanEmail = email.trim().toLowerCase();
  if (getAdminEmails(env).includes(cleanEmail)) return "owner";
  if (getAdminApproverEmails(env).includes(cleanEmail)) return "admin";
  return null;
}

function getAdminPasswordHash(env: unknown) {
  const raw = readNamedServerSecret(env, "SNIPER_ADMIN_PASSWORD_HASH", "")
    .replace(/\\\$/g, "$")
    .replace(/%24/g, "$")
    .trim();
  const bcryptMatch = raw.match(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
  if (bcryptMatch) return bcryptMatch[0];
  const pbkdf2Match = raw.match(/pbkdf2\$[^\s"'<>]+/i);
  if (pbkdf2Match) return pbkdf2Match[0];
  return raw.replace(/\s+/g, "");
}

function getAdminPlainPassword(env: unknown) {
  const plainPassword =
    readNamedServerSecret(env, "SNIPER_ADMIN_PASSWORD", "") || readNamedServerSecret(env, "ADMIN_PASSWORD", "");

  return plainPassword.trim();
}

function hasAdminPasswordConfig(env: unknown) {
  return Boolean(getAdminPasswordHash(env) || getAdminPlainPassword(env));
}

function looksLikePasswordHash(value: string) {
  return (
    value.startsWith("$2a$") || value.startsWith("$2b$") || value.startsWith("$2y$") || value.startsWith("pbkdf2$")
  );
}

async function verifyConfiguredAdminPassword(env: unknown, password: string) {
  const hashOrMaybePlain = getAdminPasswordHash(env);
  if (hashOrMaybePlain) {
    if (looksLikePasswordHash(hashOrMaybePlain)) {
      if (await verifyPassword(password, hashOrMaybePlain)) return true;
    } else if (constantTimeStringEqual(password, hashOrMaybePlain)) {
      return true;
    }
  }

  const plainPassword = getAdminPlainPassword(env);
  return Boolean(plainPassword && constantTimeStringEqual(password, plainPassword));
}

function getMercadoPagoAccessToken(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "MERCADOPAGO_ACCESS_TOKEN", ""));
}

function getMercadoPagoWebhookSecret(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "MERCADOPAGO_WEBHOOK_SECRET", ""));
}

function getMercadoPagoCurrency(env: unknown) {
  return readNamedServerSecret(env, "MERCADOPAGO_CURRENCY", "BRL") || "BRL";
}

function getHublaWebhookToken(env: unknown) {
  const mode = readNamedServerSecret(env, "HUBLA_ENVIRONMENT", "production").toLowerCase();
  const scopedToken =
    mode === "sandbox"
      ? readNamedServerSecret(env, "HUBLA_SANDBOX_WEBHOOK_TOKEN", "")
      : readNamedServerSecret(env, "HUBLA_PRODUCTION_WEBHOOK_TOKEN", "");
  return normalizeSecretValue(scopedToken || readNamedServerSecret(env, "HUBLA_WEBHOOK_TOKEN", ""));
}

function getHublaWebhookHmacSecret(env: unknown) {
  return normalizeSecretValue(readNamedServerSecret(env, "HUBLA_WEBHOOK_HMAC_SECRET", ""));
}

function getHublaDefaultPlan(env: unknown): BillingPlanId {
  const plan = normalizeBillingPlanId(readNamedServerSecret(env, "HUBLA_DEFAULT_PLAN", "vip"));
  return plan && plan !== "free" ? plan : "vip";
}

function getHublaCheckoutUrl(plan: BillingPlanId, env: unknown) {
  if (plan === "free") return "";
  const candidates =
    plan === "premium"
      ? ["HUBLA_PREMIUM_CHECKOUT_URL", "HUBLA_ANUAL_CHECKOUT_URL", "HUBLA_CHECKOUT_URL"]
      : ["HUBLA_MENSAL_CHECKOUT_URL", "HUBLA_VIP_CHECKOUT_URL", "HUBLA_CHECKOUT_URL"];
  for (const key of candidates) {
    const value = readNamedServerSecret(env, key, "");
    if (value && /^https?:\/\//i.test(value)) return value;
  }
  return "";
}

function getBillingPlans(env: unknown) {
  return (["free", "premium", "vip"] as BillingPlanId[]).map((plan) => {
    const config = getBillingPlan(plan, env);
    const hublaCheckoutUrl = getHublaCheckoutUrl(config.id, env);
    return {
      id: config.id,
      name: config.name,
      description: config.description,
      amount: config.amount,
      currency: getMercadoPagoCurrency(env),
      durationDays: config.durationDays,
      features: config.features,
      checkoutEnabled: config.id !== "free" && (Boolean(hublaCheckoutUrl) || Boolean(getMercadoPagoAccessToken(env))),
      checkoutProvider: hublaCheckoutUrl ? "hubla" : getMercadoPagoAccessToken(env) ? "mercadopago" : "",
    };
  });
}

function getBillingPlan(plan: BillingPlanId, env: unknown) {
  const premiumAmount = readServerNumber(env, "MERCADOPAGO_PREMIUM_PRICE", 497);
  const vipAmount = readServerNumber(env, "MERCADOPAGO_VIP_PRICE", 297);
  const plans = {
    free: {
      id: "free" as const,
      name: "Free",
      description: "Cadastro gratuito com acesso limitado e sem sinais premium.",
      amount: 0,
      durationDays: 7,
      features: ["Cadastro no app", "Acesso a telas basicas", "Sem sinais premium ao vivo"],
    },
    vip: {
      id: "vip" as const,
      name: "VIP",
      description: "Acesso VIP mensal ao painel operacional.",
      amount: vipAmount,
      durationDays: 30,
      features: ["Painel ao vivo", "Sinais protegidos", "Surf, Tie e numero pagante", "Assistente IA"],
    },
    premium: {
      id: "premium" as const,
      name: "Premium",
      description: "Acesso Premium mensal com recursos completos.",
      amount: premiumAmount,
      durationDays: 30,
      features: ["Tudo do VIP", "Narracao IA", "Leituras completas", "Prioridade operacional"],
    },
  };
  return plans[plan];
}

function readServerNumber(env: unknown, key: string, fallback: number) {
  const text = readNamedServerSecret(env, key, "");
  if (!String(text).trim()) return fallback;
  const value = Number(String(text).replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function normalizeBillingPlanId(value: unknown): BillingPlanId | null {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "free" || text === "premium" || text === "vip") return text;
  if (text === "mensal" || text === "monthly") return "vip";
  return null;
}

function normalizeHublaWebhookPayload(payload: Record<string, unknown>, request: Request, env: unknown) {
  const event = readRecord(payload.event);
  const user = readRecord(event.user);
  const subscription = readRecord(event.subscription);
  const invoice = readRecord(event.invoice);
  const member = readRecord(event.member);
  const customer = readRecord(event.customer);
  const payment = readRecord(event.payment);
  const product = readRecord(event.product);
  const eventType = readString(payload, "type");
  const email = (
    readString(user, "email") ||
    readString(subscription, "email") ||
    readString(invoice, "email") ||
    readString(member, "email") ||
    readString(customer, "email") ||
    readString(payment, "email") ||
    readString(payload, "email")
  ).toLowerCase();
  const firstName = readString(user, "firstName") || readString(customer, "firstName");
  const lastName = readString(user, "lastName") || readString(customer, "lastName");
  const fullName =
    `${firstName} ${lastName}`.trim() ||
    readString(user, "name") ||
    readString(customer, "name") ||
    readString(payload, "name");
  return {
    email,
    fullName,
    phone: readString(user, "phone") || readString(subscription, "phone") || readString(customer, "phone"),
    status: normalizeHublaStatus(payload),
    eventType,
    idempotencyKey: request.headers.get("x-hubla-idempotency")?.trim() || readString(payload, "idempotencyKey"),
    productId: readString(product, "id") || firstHublaProductId(event) || readString(payload, "productId"),
    plan: getHublaPlanFromPayload(payload, env),
    subscriptionId:
      readString(subscription, "id") || readString(invoice, "subscriptionId") || readString(payload, "subscriptionId"),
    paymentId:
      readString(invoice, "id") ||
      readString(payment, "id") ||
      readString(payload, "paymentId") ||
      readString(payload, "id"),
    amount: readHublaAmount(event),
    currency:
      readString(invoice, "currency") || readString(payment, "currency") || readString(payload, "currency") || "BRL",
    paidAt: readString(invoice, "paidAt") || readString(payment, "paidAt") || readString(subscription, "activatedAt"),
    expiresAt:
      readString(subscription, "expiresAt") ||
      readString(subscription, "expires_at") ||
      readString(subscription, "currentPeriodEnd") ||
      readString(subscription, "current_period_end") ||
      readString(event, "expiresAt"),
    createdAt:
      readString(invoice, "createdAt") || readString(subscription, "createdAt") || readString(payload, "createdAt"),
  };
}

function normalizeHublaStatus(payload: Record<string, unknown>) {
  const event = readRecord(payload.event);
  const text = (
    readString(payload, "status") ||
    readString(readRecord(event.invoice), "status") ||
    readString(readRecord(event.payment), "status") ||
    readString(readRecord(event.subscription), "status") ||
    readString(payload, "type")
  )
    .trim()
    .toLowerCase()
    .replace(/\./g, "_");

  if (["paid", "invoice_paid", "payment_paid", "subscription_activated", "active"].includes(text)) {
    return "paid";
  }
  if (["refunded", "invoice_refunded", "refund_succeeded"].includes(text)) return "refunded";
  if (["chargeback", "charged_back", "invoice_chargeback"].includes(text)) return "chargeback";
  if (["canceled", "cancelled", "subscription_deactivated", "deactivated"].includes(text)) {
    return "canceled";
  }
  return text;
}

function firstHublaProductId(event: Record<string, unknown>) {
  const products = Array.isArray(event.products) ? event.products.map(readRecord) : [];
  for (const product of products) {
    const id = readString(product, "id");
    if (id) return id;
  }
  return "";
}

function getHublaPlanFromPayload(payload: Record<string, unknown>, env: unknown): BillingPlanId | null {
  const event = readRecord(payload.event);
  const product = readRecord(event.product);
  const productId = readString(product, "id") || firstHublaProductId(event);
  const productName = (readString(product, "name") || readString(payload, "productName") || "").toLowerCase();

  if (productName.includes("premium")) return "premium";
  if (productName.includes("vip") || productName.includes("mensal")) return "vip";
  if (productName.includes("free") || productName.includes("trial")) return "free";

  if (productId) {
    const premiumIds = parseCsvList(readNamedServerSecret(env, "HUBLA_PREMIUM_PRODUCT_IDS", ""));
    const vipIds = parseCsvList(readNamedServerSecret(env, "HUBLA_VIP_PRODUCT_IDS", ""));
    if (premiumIds.includes(productId)) return "premium";
    if (vipIds.includes(productId)) return "vip";
  }

  return null;
}

function readHublaAmount(event: Record<string, unknown>) {
  const invoice = readRecord(event.invoice);
  const payment = readRecord(event.payment);
  const amount = readRecord(invoice.amount);
  const candidates = [
    { value: amount.totalCents, cents: true },
    { value: amount.subtotalCents, cents: true },
    { value: amount.total, cents: false },
    { value: invoice.totalCents, cents: true },
    { value: invoice.amount, cents: false },
    { value: invoice.total, cents: false },
    { value: invoice.totalAmount, cents: false },
    { value: readRecord(invoice.total).amount, cents: false },
    { value: readRecord(invoice.total).value, cents: false },
    { value: payment.amount, cents: false },
    { value: payment.total, cents: false },
  ];
  for (const candidate of candidates) {
    const value = Number(String(candidate.value ?? "").replace(",", "."));
    if (Number.isFinite(value)) return candidate.cents ? Number((value / 100).toFixed(2)) : value;
  }
  return 0;
}

function parseCsvList(value: unknown) {
  return String(value || "")
    .split(/[,;\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPublicAppOrigin(request: Request, env: unknown) {
  const configured = readNamedServerSecret(env, "PUBLIC_APP_URL", "") || readNamedServerSecret(env, "APP_URL", "");
  if (configured) return configured.replace(/\/+$/, "");
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function extractMercadoPagoPaymentId(url: URL, payload: Record<string, unknown>) {
  const data = readRecord(payload.data);
  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    readString(data, "id") ||
    readString(payload, "id") ||
    ""
  );
}

async function validateMercadoPagoWebhookSignature(
  request: Request,
  _url: URL,
  _payload: Record<string, unknown>,
  env: unknown,
  dataId: string,
) {
  const secret = getMercadoPagoWebhookSecret(env);
  if (!secret) {
    // The payment is still confirmed server-to-server with Mercado Pago before access is released.
    return true;
  }

  const xSignature = request.headers.get("x-signature") || "";
  const xRequestId = request.headers.get("x-request-id") || "";
  if (!xSignature || !xRequestId) return false;

  const signatureParts = parseMercadoPagoSignature(xSignature);
  if (!signatureParts.ts || !signatureParts.v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${signatureParts.ts};`;
  const expected = bytesToHex(await hmacSign(secret, manifest));
  return constantTimeStringEqual(expected, signatureParts.v1);
}

function parseMercadoPagoSignature(value: string) {
  return value.split(",").reduce(
    (acc, part) => {
      const [key, raw] = part.split("=");
      if (key?.trim() === "ts") acc.ts = String(raw || "").trim();
      if (key?.trim() === "v1") acc.v1 = String(raw || "").trim();
      return acc;
    },
    { ts: "", v1: "" },
  );
}

function parseBillingExternalReference(value: string) {
  const parts = value.split(":");
  if (parts.length >= 4 && parts[0] === "sniperbo") {
    return {
      subscriptionId: parts[1],
      email: parts[2],
      plan: parts[3],
    };
  }
  return { subscriptionId: "", email: "", plan: "" };
}

function upsertLiveClient(client: Record<string, unknown>) {
  if (isEntityDeleted(client)) return;
  const id = readString(client, "id");
  const email = readString(client, "email").toLowerCase();
  const index = liveClients.findIndex((item) => {
    const sameId = id && readString(item, "id") === id;
    const sameEmail = email && readString(item, "email").toLowerCase() === email;
    return sameId || sameEmail;
  });
  liveClients =
    index >= 0
      ? liveClients.map((item, itemIndex) => (itemIndex === index ? { ...item, ...client } : item))
      : [...liveClients, client];
}

function upsertSubscriptionRecord(record: Record<string, unknown>) {
  if (isEntityDeleted(record)) return record;
  const id = readString(record, "id");
  const paymentId = readString(record, "provider_payment_id");
  const externalReference = readString(record, "external_reference");
  const index = liveSubscriptions.findIndex((item) => {
    return (
      (id && readString(item, "id") === id) ||
      (paymentId && readString(item, "provider_payment_id") === paymentId) ||
      (externalReference && readString(item, "external_reference") === externalReference)
    );
  });
  const merged = {
    ...(index >= 0 ? liveSubscriptions[index] : {}),
    ...record,
    updated_at: readString(record, "updated_at") || new Date().toISOString(),
  };
  liveSubscriptions =
    index >= 0
      ? liveSubscriptions.map((item, itemIndex) => (itemIndex === index ? merged : item))
      : [merged, ...liveSubscriptions].slice(0, 500);
  return merged;
}

function upsertPaymentRecord(record: Record<string, unknown>) {
  if (isEntityDeleted(record)) return record;
  const id = readString(record, "id");
  const paymentId = readString(record, "provider_payment_id");
  const preferenceId = readString(record, "provider_preference_id");
  const externalReference = readString(record, "external_reference");
  const index = livePayments.findIndex((item) => {
    return (
      (id && readString(item, "id") === id) ||
      (paymentId && readString(item, "provider_payment_id") === paymentId) ||
      (!paymentId && preferenceId && readString(item, "provider_preference_id") === preferenceId) ||
      (!paymentId && externalReference && readString(item, "external_reference") === externalReference)
    );
  });
  const merged = {
    ...(index >= 0 ? livePayments[index] : {}),
    ...record,
    updated_at: readString(record, "updated_at") || new Date().toISOString(),
  };
  livePayments =
    index >= 0
      ? livePayments.map((item, itemIndex) => (itemIndex === index ? merged : item))
      : [merged, ...livePayments].slice(0, 1000);
  return merged;
}

function findPaymentId(providerPaymentId: string, externalReference: string) {
  const existing = livePayments.find((payment) => {
    return (
      (providerPaymentId && readString(payment, "provider_payment_id") === providerPaymentId) ||
      (externalReference && readString(payment, "external_reference") === externalReference)
    );
  });
  return existing ? readString(existing, "id") : "";
}

function buildBillingOverview(client: Record<string, unknown>) {
  const email = readString(client, "email").toLowerCase();
  const subscription = latestSubscriptionForEmail(email);
  const expiresAt = readString(client, "expires_at") || readString(subscription, "expires_at");
  const expired = isExpiredIso(expiresAt);
  const trial = readString(client, "access_status").toLowerCase() === "trial" && !expired;
  const liveAccess = clientHasLiveAccess(client);
  return {
    email,
    plan: readString(client, "plan") || readString(subscription, "plan") || "free",
    status: expired
      ? "expired"
      : readString(subscription, "status") || readString(client, "access_status") || "pending",
    accessMode: trial ? "demo" : liveAccess ? "full" : expired ? "expired" : "pending",
    approved: liveAccess && !trial,
    starts_at: readString(client, "starts_at") || readString(subscription, "starts_at"),
    expires_at: expiresAt,
    subscription: buildSubscriptionPublic(subscription),
    last_payment: buildPaymentPublic(
      livePayments
        .filter((payment) => readString(payment, "email").toLowerCase() === email)
        .sort((a, b) => readString(b, "updated_at").localeCompare(readString(a, "updated_at")))[0] || {},
    ),
  };
}

function latestSubscriptionForEmail(email: string) {
  return (
    liveSubscriptions
      .filter((subscription) => readString(subscription, "email").toLowerCase() === email)
      .sort((a, b) => readString(b, "updated_at").localeCompare(readString(a, "updated_at")))[0] || {}
  );
}

function buildSubscriptionPublic(subscription: Record<string, unknown>) {
  return {
    id: readString(subscription, "id"),
    plan: readString(subscription, "plan") || "free",
    status: readString(subscription, "status") || "pending",
    starts_at: readString(subscription, "starts_at"),
    expires_at: readString(subscription, "expires_at"),
    provider: readString(subscription, "provider"),
    provider_preference_id: readString(subscription, "provider_preference_id"),
  };
}

function buildPaymentPublic(payment: Record<string, unknown>) {
  return {
    id: readString(payment, "id"),
    plan: readString(payment, "plan") || "free",
    status: readString(payment, "status"),
    amount: Number(payment.amount || 0),
    currency: readString(payment, "currency") || "BRL",
    paid_at: readString(payment, "paid_at"),
    created_at: readString(payment, "created_at"),
    provider_payment_id: readString(payment, "provider_payment_id"),
  };
}

async function handleAdminCrmRequest(request: Request, url: URL, env: unknown, adminRole: AdminRole) {
  if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);

  if (request.method === "GET" && url.pathname === "/admin/crm") {
    return json(await loadCrmResponse(env));
  }

  const match = url.pathname.match(/^\/admin\/crm\/(clients|deals|invoices)(?:\/([^/]+))?$/);
  if (!match) return json({ error: "Rota CRM nao encontrada." }, 404);
  if (!getSupabasePersistenceConfig(env)) {
    return json(
      {
        error: "Persistencia CRM nao configurada. Configure SUPABASE_SERVICE_ROLE_KEY antes de salvar.",
      },
      503,
    );
  }

  const resource = match[1];
  const resourceId = match[2] ? decodeURIComponent(match[2]) : "";
  const body = readRecord(await request.json().catch(() => ({})));
  const actor = adminActorEmailFromRequest(request, env, adminRole);

  if (resource === "clients") {
    if (request.method === "POST" && !resourceId) {
      const client = normalizeCrmClientRow(body, actor);
      if (!client.name || !client.email) {
        return json({ error: "Nome e e-mail sao obrigatorios." }, 400);
      }
      const duplicate = await findCrmClientByEmail(env, client.email);
      if (duplicate) return json({ error: "Ja existe cliente CRM com esse e-mail." }, 409);
      const saved = await persistSupabaseRow(env, CRM_CLIENTS_TABLE, crmClientToRow(client, actor));
      if (!saved) return json({ error: "Nao foi possivel salvar o cliente CRM." }, 503);
      return json({ client }, 201);
    }

    if (request.method === "PATCH" && resourceId) {
      const existing = await loadCrmClientById(env, resourceId);
      if (!existing) return json({ error: "Cliente CRM nao encontrado." }, 404);
      const client = normalizeCrmClientRow({ ...existing, ...body, id: resourceId }, actor);
      if (!client.name || !client.email) {
        return json({ error: "Nome e e-mail sao obrigatorios." }, 400);
      }
      const duplicate = await findCrmClientByEmail(env, client.email);
      if (duplicate && duplicate.id !== resourceId) {
        return json({ error: "Ja existe cliente CRM com esse e-mail." }, 409);
      }
      const saved = await persistSupabaseRow(env, CRM_CLIENTS_TABLE, crmClientToRow(client, actor));
      if (!saved) return json({ error: "Nao foi possivel atualizar o cliente CRM." }, 503);
      return json({ client });
    }

    if (request.method === "DELETE" && resourceId) {
      await deleteSupabaseRows(env, CRM_CLIENTS_TABLE, `id=eq.${encodeURIComponent(resourceId)}`);
      return json({ ok: true });
    }
  }

  if (resource === "deals") {
    if (request.method === "POST" && !resourceId) {
      const deal = normalizeCrmDealRow(body, actor);
      if (!deal.clientId || !deal.title) {
        return json({ error: "Cliente e titulo do negocio sao obrigatorios." }, 400);
      }
      const saved = await persistSupabaseRow(env, CRM_DEALS_TABLE, crmDealToRow(deal, actor));
      if (!saved) return json({ error: "Nao foi possivel salvar o negocio." }, 503);
      return json({ deal }, 201);
    }

    if (request.method === "PATCH" && resourceId) {
      const existing = await loadCrmDealById(env, resourceId);
      if (!existing) return json({ error: "Negocio nao encontrado." }, 404);
      const deal = normalizeCrmDealRow({ ...existing, ...body, id: resourceId }, actor);
      if (!deal.clientId || !deal.title) {
        return json({ error: "Cliente e titulo do negocio sao obrigatorios." }, 400);
      }
      const saved = await persistSupabaseRow(env, CRM_DEALS_TABLE, crmDealToRow(deal, actor));
      if (!saved) return json({ error: "Nao foi possivel atualizar o negocio." }, 503);
      return json({ deal });
    }

    if (request.method === "DELETE" && resourceId) {
      await deleteSupabaseRows(env, CRM_DEALS_TABLE, `id=eq.${encodeURIComponent(resourceId)}`);
      return json({ ok: true });
    }
  }

  if (resource === "invoices") {
    if (request.method === "POST" && !resourceId) {
      const invoice = normalizeCrmInvoiceRow(body, actor);
      if (!invoice.clientId || !invoice.dueDate) {
        return json({ error: "Cliente e vencimento da fatura sao obrigatorios." }, 400);
      }
      const saved = await persistSupabaseRow(env, CRM_INVOICES_TABLE, crmInvoiceToRow(invoice, actor));
      if (!saved) return json({ error: "Nao foi possivel salvar a fatura." }, 503);
      return json({ invoice }, 201);
    }

    if (request.method === "PATCH" && resourceId) {
      const existing = await loadCrmInvoiceById(env, resourceId);
      if (!existing) return json({ error: "Fatura nao encontrada." }, 404);
      const invoice = normalizeCrmInvoiceRow({ ...existing, ...body, id: resourceId }, actor);
      if (!invoice.clientId || !invoice.dueDate) {
        return json({ error: "Cliente e vencimento da fatura sao obrigatorios." }, 400);
      }
      const saved = await persistSupabaseRow(env, CRM_INVOICES_TABLE, crmInvoiceToRow(invoice, actor));
      if (!saved) return json({ error: "Nao foi possivel atualizar a fatura." }, 503);
      return json({ invoice });
    }

    if (request.method === "DELETE" && resourceId) {
      await deleteSupabaseRows(env, CRM_INVOICES_TABLE, `id=eq.${encodeURIComponent(resourceId)}`);
      return json({ ok: true });
    }
  }

  return json({ error: "Metodo nao permitido." }, 405);
}

async function handleAdminClientRegistryBackupRequest(request: Request, env: unknown, adminRole: AdminRole) {
  if (adminRole !== "owner") return json({ error: "Permissao insuficiente." }, 403);

  if (request.method === "GET") {
    await hydrateClientsFromBillingUsers(env);
    const protectedState = await protectClientRegistryBeforeSave(env, buildLiveStateSnapshot(env));
    const backup = extractClientRegistryState(protectedState);
    return json({
      backup,
      counts: readRecord(backup.counts),
      warning: "Backup contem password_hash bcrypt para restaurar login. Nunca transforme isso em senha aberta.",
    });
  }

  if (request.method === "POST") {
    const body = readRecord(await request.json().catch(() => ({})));
    const backup = readRecord(body.backup || body);
    const incoming = extractClientRegistryState(backup);
    if (clientRegistryProtectedCount(incoming) === 0) {
      return json({ error: "Backup vazio ou invalido." }, 400);
    }

    const before = extractClientRegistryState(buildLiveStateSnapshot(env));
    applyClientRegistryState(incoming, env);
    const saveStatus = await saveLiveState(env);
    const after = extractClientRegistryState(buildLiveStateSnapshot(env));
    return json({
      ok: true,
      restored: readRecord(after.counts),
      before: readRecord(before.counts),
      saveStatus,
    });
  }

  return json({ error: "Metodo nao permitido." }, 405);
}

async function loadCrmResponse(env: unknown): Promise<CrmResponse> {
  const storageConfigured = Boolean(getSupabasePersistenceConfig(env));
  const [clientRows, dealRows, invoiceRows] = storageConfigured
    ? await Promise.all([
        fetchSupabaseRowsPaged(env, CRM_CLIENTS_TABLE, "select=*&order=updated_at.desc.nullslast"),
        fetchSupabaseRowsPaged(env, CRM_DEALS_TABLE, "select=*&order=updated_at.desc.nullslast"),
        fetchSupabaseRowsPaged(env, CRM_INVOICES_TABLE, "select=*&order=updated_at.desc.nullslast"),
      ])
    : [[], [], []];

  const clients = clientRows.map(crmClientFromRow).filter((client) => client.email);
  const deals = dealRows.map(crmDealFromRow).filter((deal) => deal.clientId);
  const invoices = invoiceRows.map(crmInvoiceFromRow).filter((invoice) => invoice.clientId);
  return {
    clients,
    deals,
    invoices,
    summary: buildCrmSummary(clients, deals, invoices),
    storageConfigured,
  };
}

async function loadCrmClientById(env: unknown, id: string) {
  const rows = await fetchSupabaseRows(env, CRM_CLIENTS_TABLE, `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? crmClientFromRow(rows[0]) : null;
}

async function loadCrmDealById(env: unknown, id: string) {
  const rows = await fetchSupabaseRows(env, CRM_DEALS_TABLE, `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? crmDealFromRow(rows[0]) : null;
}

async function loadCrmInvoiceById(env: unknown, id: string) {
  const rows = await fetchSupabaseRows(env, CRM_INVOICES_TABLE, `select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] ? crmInvoiceFromRow(rows[0]) : null;
}

async function findCrmClientByEmail(env: unknown, email: string) {
  const rows = await fetchSupabaseRows(
    env,
    CRM_CLIENTS_TABLE,
    `select=*&email=ilike.${encodeURIComponent(email.trim().toLowerCase())}&limit=1`,
  );
  return rows[0] ? crmClientFromRow(rows[0]) : null;
}

function normalizeCrmClientRow(value: Record<string, unknown>, _actor: string): CrmClient {
  const now = new Date().toISOString();
  return {
    id: readString(value, "id") || crypto.randomUUID(),
    name: readString(value, "name") || readString(value, "full_name"),
    email: readString(value, "email").toLowerCase(),
    phone: readString(value, "phone"),
    notes: readString(value, "notes"),
    createdAt: readString(value, "createdAt") || readString(value, "created_at") || now,
    updatedAt: now,
  };
}

function normalizeCrmDealRow(value: Record<string, unknown>, _actor: string): CrmDeal {
  const now = new Date().toISOString();
  return {
    id: readString(value, "id") || crypto.randomUUID(),
    clientId: readString(value, "clientId") || readString(value, "client_id"),
    title: readString(value, "title") || "Novo negocio",
    value: parseCrmMoney(value.value),
    stage: normalizeCrmDealStage(value.stage),
    notes: readString(value, "notes"),
    expectedCloseDate: normalizeCrmDate(
      readString(value, "expectedCloseDate") || readString(value, "expected_close_date"),
    ),
    createdAt: readString(value, "createdAt") || readString(value, "created_at") || now,
    updatedAt: now,
  };
}

function normalizeCrmInvoiceRow(value: Record<string, unknown>, _actor: string): CrmInvoice {
  const now = new Date().toISOString();
  const status = normalizeCrmInvoiceStatus(value.status);
  return {
    id: readString(value, "id") || crypto.randomUUID(),
    clientId: readString(value, "clientId") || readString(value, "client_id"),
    dealId: readString(value, "dealId") || readString(value, "deal_id"),
    amount: parseCrmMoney(value.amount),
    status,
    dueDate: normalizeCrmDate(readString(value, "dueDate") || readString(value, "due_date")),
    paidAt: normalizeCrmDate(readString(value, "paidAt") || readString(value, "paid_at")),
    notes: readString(value, "notes"),
    createdAt: readString(value, "createdAt") || readString(value, "created_at") || now,
    updatedAt: now,
  };
}

function crmClientFromRow(row: Record<string, unknown>): CrmClient {
  return {
    id: readString(row, "id"),
    name: readString(row, "name"),
    email: readString(row, "email").toLowerCase(),
    phone: readString(row, "phone"),
    notes: readString(row, "notes"),
    createdAt: readString(row, "created_at") || readString(row, "createdAt"),
    updatedAt: readString(row, "updated_at") || readString(row, "updatedAt"),
  };
}

function crmDealFromRow(row: Record<string, unknown>): CrmDeal {
  return {
    id: readString(row, "id"),
    clientId: readString(row, "client_id") || readString(row, "clientId"),
    title: readString(row, "title"),
    value: parseCrmMoney(row.value),
    stage: normalizeCrmDealStage(row.stage),
    notes: readString(row, "notes"),
    expectedCloseDate: normalizeCrmDate(readString(row, "expected_close_date") || readString(row, "expectedCloseDate")),
    createdAt: readString(row, "created_at") || readString(row, "createdAt"),
    updatedAt: readString(row, "updated_at") || readString(row, "updatedAt"),
  };
}

function crmInvoiceFromRow(row: Record<string, unknown>): CrmInvoice {
  return {
    id: readString(row, "id"),
    clientId: readString(row, "client_id") || readString(row, "clientId"),
    dealId: readString(row, "deal_id") || readString(row, "dealId"),
    amount: parseCrmMoney(row.amount),
    status: normalizeCrmInvoiceStatus(row.status),
    dueDate: normalizeCrmDate(readString(row, "due_date") || readString(row, "dueDate")),
    paidAt: normalizeCrmDate(readString(row, "paid_at") || readString(row, "paidAt")),
    notes: readString(row, "notes"),
    createdAt: readString(row, "created_at") || readString(row, "createdAt"),
    updatedAt: readString(row, "updated_at") || readString(row, "updatedAt"),
  };
}

function crmClientToRow(client: CrmClient, actor: string) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    notes: client.notes,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    created_by: actor,
    updated_by: actor,
  };
}

function crmDealToRow(deal: CrmDeal, actor: string) {
  return {
    id: deal.id,
    client_id: deal.clientId,
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    notes: deal.notes,
    expected_close_date: deal.expectedCloseDate || null,
    created_at: deal.createdAt,
    updated_at: deal.updatedAt,
    created_by: actor,
    updated_by: actor,
  };
}

function crmInvoiceToRow(invoice: CrmInvoice, actor: string) {
  return {
    id: invoice.id,
    client_id: invoice.clientId,
    deal_id: invoice.dealId || null,
    amount: invoice.amount,
    status: invoice.status,
    due_date: invoice.dueDate || null,
    paid_at: invoice.paidAt || null,
    notes: invoice.notes,
    created_at: invoice.createdAt,
    updated_at: invoice.updatedAt,
    created_by: actor,
    updated_by: actor,
  };
}

function buildCrmSummary(clients: CrmClient[], deals: CrmDeal[], invoices: CrmInvoice[]): CrmSummary {
  const openDeals = deals.filter((deal) => !["ganho", "perdido"].includes(deal.stage));
  const openInvoices = invoices.filter((invoice) => invoice.status === "aberta");
  const overdueInvoices = invoices.filter((invoice) => {
    if (invoice.status === "vencida") return true;
    if (invoice.status !== "aberta" || !invoice.dueDate) return false;
    return new Date(`${invoice.dueDate}T23:59:59`).getTime() < Date.now();
  });
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paga");
  return {
    clients: clients.length,
    openDeals: openDeals.length,
    openDealValue: sumCrmMoney(openDeals.map((deal) => deal.value)),
    openInvoices: openInvoices.length,
    overdueInvoices: overdueInvoices.length,
    paidInvoiceValue: sumCrmMoney(paidInvoices.map((invoice) => invoice.amount)),
    openInvoiceValue: sumCrmMoney(openInvoices.map((invoice) => invoice.amount)),
  };
}

function normalizeCrmDealStage(value: unknown): CrmDealStage {
  const text = String(value || "").toLowerCase();
  if (["novo", "contato", "negociacao", "ganho", "perdido"].includes(text)) {
    return text as CrmDealStage;
  }
  return "novo";
}

function normalizeCrmInvoiceStatus(value: unknown): CrmInvoiceStatus {
  const text = String(value || "").toLowerCase();
  if (["aberta", "paga", "vencida", "cancelada"].includes(text)) {
    return text as CrmInvoiceStatus;
  }
  return "aberta";
}

function normalizeCrmDate(value: string) {
  const text = value.trim();
  if (!text) return "";
  const date = new Date(text.includes("T") ? text : `${text}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function parseCrmMoney(value: unknown) {
  const numeric = Number(
    String(value ?? "0")
      .replace(/\./g, "")
      .replace(",", ".")
      .trim(),
  );
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function sumCrmMoney(values: number[]) {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

async function hydrateClientFromBilling(env: unknown, email: string) {
  const client = await loadBillingClientByEmail(env, email);
  if (!client) return null;
  if (isEntityDeleted(client)) return null;

  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_hydrated_from_billing", {
    ...client,
    detail: "Cliente reconstruido a partir das tabelas de assinatura/pagamento.",
  });
  await saveLiveState(env);
  return findClientByEmail(email) || client;
}

async function loadBillingClientByEmail(env: unknown, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !getSupabasePersistenceConfig(env)) return null;

  const encodedEmail = encodeURIComponent(cleanEmail);
  const [users, subscriptions, payments] = await Promise.all([
    fetchSupabaseRows(env, "users", `select=*&email=ilike.${encodedEmail}&limit=1`),
    fetchSupabaseRows(
      env,
      "subscriptions",
      `select=*&email=ilike.${encodedEmail}&order=updated_at.desc.nullslast&limit=20`,
    ),
    fetchSupabaseRows(env, "payments", `select=*&email=ilike.${encodedEmail}&order=updated_at.desc.nullslast&limit=20`),
  ]);

  const user = users[0] || {};
  const subscription = pickBillingSubscription(subscriptions);
  const payment = pickBillingPayment(payments);
  if (!hasRecordFields(user) && !hasRecordFields(subscription) && !hasRecordFields(payment)) {
    return null;
  }

  return billingClientFromPersistedRows(env, cleanEmail, user, subscription, payment);
}

async function hydrateClientsFromBillingUsers(env: unknown) {
  if (!getSupabasePersistenceConfig(env)) return false;

  const users = await fetchSupabaseRowsPaged(env, "users", "select=*&order=created_at.desc.nullslast");
  if (!users.length) return false;

  let changed = false;
  for (const user of users) {
    const email = readString(user, "email").toLowerCase();
    if (!email || isEntityDeleted(user)) continue;
    const client = billingClientFromPersistedRows(env, email, user, {}, {});
    if (!client || isEntityDeleted(client)) continue;
    upsertLiveClient(client);
    upsertRecipientFromClient(client);
    changed = true;
  }
  return changed;
}

async function recoverClientRegistryForAuth(env: unknown, email: string, reason: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !getSupabasePersistenceConfig(env)) return false;
  if (findClientByEmail(cleanEmail) || findRecipientByEmail(cleanEmail)) return true;

  let recovered = false;
  const dailyId = clientRegistryDailySnapshotId();
  const candidates = await withTimeout(
    Promise.all([
      loadDurableLiveStateById(env, LIVE_STATE_ID),
      loadDurableLiveStateById(env, CLIENT_REGISTRY_SNAPSHOT_LATEST_ID),
      loadDurableLiveStateById(env, dailyId),
    ]),
    LIVE_STATE_IO_TIMEOUT_MS,
    "recuperar cadastro de clientes para login",
    [null, null, null] as Array<Record<string, unknown> | null>,
  );

  for (const candidate of candidates) {
    if (!candidate) continue;
    const registry = extractClientRegistryState(candidate);
    if (clientRegistryProtectedCount(registry) <= 0) continue;
    applyClientRegistryState(registry, env);
    recovered = true;
    if (findClientByEmail(cleanEmail) || findRecipientByEmail(cleanEmail)) break;
  }

  if (!findClientByEmail(cleanEmail) && !findRecipientByEmail(cleanEmail)) {
    recovered = (await hydrateClientsFromBillingUsers(env)) || recovered;
  }

  const client =
    findClientByEmail(cleanEmail) ||
    syncClientFromRecipientEmail(cleanEmail) ||
    syncClientFromAdminUserEmail(env, cleanEmail);

  if (recovered || client) {
    recordAccessEvent("client_registry_recovered_for_auth", {
      email: cleanEmail,
      full_name: readString(client || {}, "full_name") || nameFromEmail(cleanEmail),
      detail: reason,
    });
    await saveLiveState(env);
  }

  return Boolean(client || findClientByEmail(cleanEmail));
}

function billingClientFromPersistedRows(
  env: unknown,
  cleanEmail: string,
  user: Record<string, unknown>,
  subscription: Record<string, unknown>,
  payment: Record<string, unknown>,
) {
  const paidAt = readString(payment, "paid_at") || readString(payment, "created_at");
  const startsAt =
    readString(user, "starts_at") ||
    readString(subscription, "starts_at") ||
    paidAt.slice(0, 10) ||
    readString(user, "created_at") ||
    todayIso();
  const plan =
    normalizeBillingPlanId(readString(user, "plan")) ||
    normalizeBillingPlanId(readString(subscription, "plan")) ||
    normalizeBillingPlanId(readString(payment, "plan")) ||
    "free";
  const planConfig = getBillingPlan(plan, env);
  const expiresAt =
    readString(user, "expires_at") ||
    readString(subscription, "expires_at") ||
    (billingPaymentIsPaid(payment) ? addDaysIso(startsAt, planConfig.durationDays) : "");
  const subscriptionActive = billingSubscriptionIsActive(subscription, expiresAt);
  const paymentActive = billingPaymentIsPaid(payment) && Boolean(expiresAt) && !isExpiredIso(expiresAt);
  const persistedStatus = readString(user, "access_status").toLowerCase();
  const trialActive = persistedStatus === "trial" && Boolean(expiresAt) && !isExpiredIso(expiresAt);
  const enabled =
    readBooleanField(user, "enabled") ||
    subscriptionActive ||
    paymentActive ||
    trialActive ||
    ["approved", "active", "manual_vip"].includes(persistedStatus);
  const accessStatus =
    persistedStatus === "trial" && isExpiredIso(expiresAt)
      ? "expired"
      : persistedStatus ||
        (enabled
          ? subscriptionActive || paymentActive
            ? "approved"
            : "trial"
          : isExpiredIso(expiresAt)
            ? "expired"
            : readString(subscription, "status") || readString(payment, "status") || "expired");

  return {
    id:
      readString(user, "id") ||
      readString(subscription, "user_id") ||
      readString(payment, "user_id") ||
      crypto.randomUUID(),
    full_name: readString(user, "full_name") || nameFromEmail(cleanEmail),
    email: cleanEmail,
    phone: readString(user, "phone"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    password_hash: readString(user, "password_hash"),
    plan,
    access_status: accessStatus,
    enabled: enabled && accessStatus !== "expired",
    starts_at: startsAt,
    validity_days: Number(user.validity_days || planConfig.durationDays || 0),
    expires_at: expiresAt,
    trial_started_at: readString(user, "trial_started_at"),
    trial_expires_at: readString(user, "trial_expires_at") || expiresAt,
    trial_ip_hash: readString(user, "trial_ip_hash"),
    trial_user_agent_hash: readString(user, "trial_user_agent_hash"),
    trial_blocked_reason: readString(user, "trial_blocked_reason"),
    is_blocked: readBooleanField(user, "is_blocked"),
    adminNote: readString(user, "admin_note") || readString(user, "adminNote"),
    created_at: readString(user, "created_at") || readString(subscription, "created_at") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function pickBillingSubscription(rows: Record<string, unknown>[]) {
  const sorted = sortBillingRows(rows).sort(
    (a, b) => Number(billingSubscriptionIsActive(b)) - Number(billingSubscriptionIsActive(a)),
  );
  return sorted[0] || {};
}

function pickBillingPayment(rows: Record<string, unknown>[]) {
  const sorted = sortBillingRows(rows).sort(
    (a, b) => Number(billingPaymentIsPaid(b)) - Number(billingPaymentIsPaid(a)),
  );
  return sorted[0] || {};
}

function sortBillingRows(rows: Record<string, unknown>[]) {
  return [...rows].sort((a, b) => billingRowTime(b) - billingRowTime(a));
}

function billingRowTime(row: Record<string, unknown>) {
  const time = Date.parse(
    readString(row, "updated_at") ||
      readString(row, "paid_at") ||
      readString(row, "created_at") ||
      readString(row, "starts_at") ||
      "",
  );
  return Number.isFinite(time) ? time : 0;
}

function billingSubscriptionIsActive(subscription: Record<string, unknown>, fallbackExpiresAt = "") {
  const status = readString(subscription, "status").toLowerCase();
  const expiresAt = readString(subscription, "expires_at") || fallbackExpiresAt;
  return ["active", "approved", "paid"].includes(status) && (!expiresAt || !isExpiredIso(expiresAt));
}

function billingPaymentIsPaid(payment: Record<string, unknown>) {
  const status = (readString(payment, "status") || readString(payment, "raw_status")).toLowerCase();
  return ["approved", "paid"].includes(status);
}

function refreshExpiredBillingForClient(client: Record<string, unknown>) {
  const expiresAt = readString(client, "expires_at");
  if (!expiresAt || !isExpiredIso(expiresAt)) return false;

  client.enabled = false;
  client.access_status = "expired";
  client.updated_at = new Date().toISOString();
  const email = readString(client, "email").toLowerCase();
  liveSubscriptions = liveSubscriptions.map((subscription) =>
    readString(subscription, "email").toLowerCase() === email &&
    readString(subscription, "status") === "active" &&
    isExpiredIso(readString(subscription, "expires_at"))
      ? { ...subscription, status: "expired", updated_at: new Date().toISOString() }
      : subscription,
  );
  upsertRecipientFromClient(client);
  return true;
}

async function persistBillingRecords(
  env: unknown,
  client: Record<string, unknown>,
  subscription: Record<string, unknown>,
  payment: Record<string, unknown>,
) {
  await Promise.allSettled([
    persistBillingUser(env, client),
    persistSupabaseRow(env, "subscriptions", subscription),
    persistSupabaseRow(env, "payments", payment),
  ]);
}

async function persistBillingUser(env: unknown, client: Record<string, unknown>) {
  const email = readString(client, "email").toLowerCase();
  if (!email) return false;
  const baseRow = {
    id: readString(client, "id") || crypto.randomUUID(),
    email,
    full_name: readString(client, "full_name") || nameFromEmail(email),
    phone: readString(client, "phone"),
    city: readString(client, "city"),
    country: readString(client, "country"),
    password_hash: readString(client, "password_hash"),
    created_at: readString(client, "created_at") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const fullRow = {
    ...baseRow,
    plan: normalizeBillingPlanId(readString(client, "plan")) || "free",
    access_status: readString(client, "access_status") || "expired",
    enabled: Boolean(client.enabled),
    starts_at: readString(client, "starts_at"),
    validity_days: Number(client.validity_days || 0),
    expires_at: readString(client, "expires_at"),
    trial_started_at: readString(client, "trial_started_at"),
    trial_expires_at: readString(client, "trial_expires_at"),
    trial_ip_hash: readString(client, "trial_ip_hash"),
    trial_user_agent_hash: readString(client, "trial_user_agent_hash"),
    trial_blocked_reason: readString(client, "trial_blocked_reason"),
    is_blocked: Boolean(client.isBlocked) || Boolean(client.is_blocked),
    admin_note: readString(client, "adminNote") || readString(client, "notes"),
  };
  const savedFull = await persistSupabaseRow(env, "users", fullRow);
  if (savedFull) return true;
  return persistSupabaseRow(env, "users", baseRow);
}

async function persistClientRegistryAfterClientChange(env: unknown, client: Record<string, unknown>, reason: string) {
  const userPersisted = await persistBillingUser(env, client);
  const saveStatus = await saveLiveState(env);
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  const ok = !durableConfigured || saveStatus.durable || userPersisted;

  if (!ok) {
    console.warn(`Cadastro nao foi gravado de forma duravel: ${reason}.`);
    recordAccessEvent("client_registry_durable_save_failed", {
      ...client,
      risk: "high",
      detail: reason,
    });
  } else if (durableConfigured && (!userPersisted || !saveStatus.durable)) {
    recordAccessEvent("client_registry_partial_durable_save", {
      ...client,
      risk: "medium",
      detail: reason,
      userPersisted,
      liveStateDurable: saveStatus.durable,
    });
  }

  return { ok, userPersisted, saveStatus };
}

function clientRegistryDurableSaveError() {
  return json(
    {
      error: "Cadastro nao foi gravado com seguranca no banco. Tente novamente em alguns segundos ou avise o suporte.",
    },
    503,
  );
}

async function deletePersistedBillingUser(env: unknown, user: Record<string, unknown>) {
  await deletePersistedBillingRecords(env, user, true);
}

async function deletePersistedBillingAccess(env: unknown, user: Record<string, unknown>) {
  await deletePersistedBillingRecords(env, user, false);
}

async function deletePersistedBillingRecords(env: unknown, user: Record<string, unknown>, includeUser: boolean) {
  const email = readString(user, "email").toLowerCase();
  const id = readString(user, "id");
  const encodedEmail = encodeURIComponent(email);
  const encodedId = encodeURIComponent(id);
  const idFilters = isUuidLike(id) ? [`user_id=eq.${encodedId}`] : [];

  await Promise.allSettled([
    ...(email ? [deleteSupabaseRows(env, "payments", `email=eq.${encodedEmail}`)] : []),
    ...idFilters.map((filter) => deleteSupabaseRows(env, "payments", filter)),
    ...(email ? [deleteSupabaseRows(env, "subscriptions", `email=eq.${encodedEmail}`)] : []),
    ...idFilters.map((filter) => deleteSupabaseRows(env, "subscriptions", filter)),
    ...(includeUser && email ? [deleteSupabaseRows(env, "users", `email=eq.${encodedEmail}`)] : []),
    ...(includeUser && isUuidLike(id) ? [deleteSupabaseRows(env, "users", `id=eq.${encodedId}`)] : []),
  ]);
}

async function fetchSupabaseRows(env: unknown, table: string, query: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return [];

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: supabasePersistenceHeaders(config.key),
    });
    if (response.status === 404 || response.status === 406) return [];
    if (!response.ok) {
      console.warn(`Nao foi possivel carregar ${table} (${response.status}).`);
      return [];
    }

    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows.map(readRecord).filter(hasRecordFields) : [];
  } catch (error) {
    console.warn(`Nao foi possivel carregar ${table}.`, error);
    return [];
  }
}

async function fetchSupabaseRowsPaged(env: unknown, table: string, query: string, pageSize = 1000) {
  const rows: Record<string, unknown>[] = [];
  let page = 0;

  while (true) {
    const pageRows = await fetchSupabaseRowsRange(env, table, query, page * pageSize, pageSize);
    rows.push(...pageRows);
    if (pageRows.length < pageSize) break;
    page += 1;
  }

  return rows;
}

async function fetchSupabaseRowsRange(env: unknown, table: string, query: string, offset: number, pageSize: number) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return [];

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      headers: {
        ...supabasePersistenceHeaders(config.key),
        Range: `${offset}-${offset + pageSize - 1}`,
        "Range-Unit": "items",
      },
    });
    if (response.status === 404 || response.status === 406) return [];
    if (!response.ok) {
      console.warn(`Nao foi possivel carregar ${table} (${response.status}).`);
      return [];
    }

    const rows = await response.json().catch(() => null);
    return Array.isArray(rows) ? rows.map(readRecord).filter(hasRecordFields) : [];
  } catch (error) {
    console.warn(`Nao foi possivel carregar ${table}.`, error);
    return [];
  }
}

async function persistSupabaseRow(env: unknown, table: string, row: Record<string, unknown>, onConflict = "id") {
  const config = getSupabasePersistenceConfig(env);
  if (!config || Object.keys(row).length === 0) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(row),
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Nao foi possivel salvar ${table} (${response.status}).`);
      return false;
    }
    return response.ok;
  } catch (error) {
    console.warn(`Nao foi possivel salvar ${table}.`, error);
    return false;
  }
}

async function persistSupabaseRows(env: unknown, table: string, rows: Record<string, unknown>[], onConflict = "id") {
  const config = getSupabasePersistenceConfig(env);
  const payload = rows.filter((row) => Object.keys(row).length > 0);
  if (!config || !payload.length) return false;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Nao foi possivel salvar lote em ${table} (${response.status}).`);
      return false;
    }
    return response.ok;
  } catch (error) {
    console.warn(`Nao foi possivel salvar lote em ${table}.`, error);
    return false;
  }
}

async function deleteSupabaseRows(env: unknown, table: string, query: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config || !query) return;

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
      method: "DELETE",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        Prefer: "return=minimal",
      },
    });
    if (!response.ok && response.status !== 404) {
      console.warn(`Nao foi possivel apagar ${table} (${response.status}).`);
    }
  } catch (error) {
    console.warn(`Nao foi possivel apagar ${table}.`, error);
  }
}

async function deleteSupabaseRowsForReset(env: unknown, table: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return { table, ok: false, status: 0, error: "Supabase nao configurado." };

  try {
    const response = await fetch(`${config.url}/rest/v1/${table}?id=not.is.null`, {
      method: "DELETE",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        Prefer: "return=minimal",
      },
    });
    const ok = response.ok || response.status === 404 || response.status === 406;
    if (!ok) {
      const error = await response.text().catch(() => "");
      console.warn(`Nao foi possivel resetar ${table} (${response.status}).`);
      return { table, ok: false, status: response.status, error };
    }
    return { table, ok: true, status: response.status };
  } catch (error) {
    console.warn(`Nao foi possivel resetar ${table}.`, error);
    return { table, ok: false, status: 0, error: errorMessage(error) };
  }
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getElevenLabsApiKeys(env: unknown) {
  const keys = ELEVENLABS_API_KEY_SECRET_NAMES.map((name) =>
    normalizeSecretValue(readNamedServerSecret(env, name, "")),
  ).filter(Boolean);
  return [...new Set(keys)];
}

function getElevenLabsVoiceId(env: unknown) {
  for (const name of ELEVENLABS_VOICE_ID_SECRET_NAMES) {
    const value = normalizeSecretValue(readNamedServerSecret(env, name, ""));
    if (value) return value;
  }
  return DEFAULT_ELEVENLABS_VOICE_ID;
}

let lastElevenLabsStatus: { code: number | "ok" | "network_error"; at: string } | null = null;
function recordElevenLabsStatus(code: number | "ok" | "network_error") {
  lastElevenLabsStatus = { code, at: new Date().toISOString() };
}

function readServerEnvString(env: unknown, key: string, fallback: string) {
  const envRecord = readRecord(env);
  return readConfigString(readProcessEnv(key) || envRecord[key], fallback);
}

function readNamedServerSecret(env: unknown, key: string, fallback: string) {
  return stripNamedSecretPrefix(readServerEnvString(env, key, fallback), key);
}

function stripNamedSecretPrefix(value: unknown, key: string) {
  let raw = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  const prefix = new RegExp(`^${escapeRegExp(key)}\\s*[:=]\\s*`, "i");
  while (prefix.test(raw)) {
    raw = raw
      .replace(prefix, "")
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
  }
  return raw;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSecretValue(value: unknown) {
  let raw = String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  // Strip common accidental prefixes (env var name pasted in, or auth scheme).
  const prefixes = [
    /^ELEVENLABS_TTS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_API_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_SECRET_KEY\s*[:=]\s*/i,
    /^ELEVENLABS_VOICE_ID\s*[:=]\s*/i,
    /^ELEVENLABS_VOICEID\s*[:=]\s*/i,
    /^ELEVENLABS_VOICE\s*[:=]\s*/i,
    /^VOICE_ID\s*[:=]\s*/i,
    /^Bearer\s+/i,
    /^Token\s+/i,
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of prefixes) {
      if (re.test(raw)) {
        raw = raw
          .replace(re, "")
          .trim()
          .replace(/^["']|["']$/g, "")
          .trim();
        changed = true;
      }
    }
  }
  return raw.replace(/[\s\u200B-\u200D\uFEFF]+/g, "");
}

function elevenLabsErrorStatus(status: number) {
  if (status === 401 || status === 403 || status === 404 || status === 422 || status === 429) {
    return status;
  }
  return 502;
}

function elevenLabsErrorPayload(status: number) {
  if (status === 401 || status === 403) {
    return { error: "API key ElevenLabs invalida ou sem permissao." };
  }
  if (status === 404 || status === 422) {
    return { error: "ELEVENLABS_VOICE_ID invalido ou indisponivel." };
  }
  if (status === 429) {
    return { error: "Quota ou limite da ElevenLabs atingido." };
  }
  return { error: "Falha ao gerar voz ElevenLabs." };
}

function readProcessEnv(key: string) {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return globalWithProcess.process?.env?.[key] || "";
}

function normalizeNarrationText(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function readConfigString(value: unknown, fallback: string) {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeRecipient(recipient: Record<string, unknown>) {
  const startsAt =
    normalizeDateInputIso(readFirstString(recipient, ["starts_at", "startsAt", "currentPeriodStart"]), false) ||
    todayIso();
  const validityDays = Number(recipient.validity_days || 30);
  const expiresAt =
    normalizeDateInputIso(
      readFirstString(recipient, ["expires_at", "expiresAt", "currentPeriodEnd", "validade"]),
      true,
    ) || addDaysIso(startsAt, validityDays || 30);
  const enabled = Boolean(recipient.enabled);
  const accessStatus = normalizeRecipientAccessStatus(readString(recipient, "access_status"), enabled);

  return {
    id: readString(recipient, "id") || crypto.randomUUID(),
    name: readString(recipient, "name") || readString(recipient, "full_name") || "Cliente",
    full_name: readString(recipient, "full_name") || readString(recipient, "name"),
    email: readString(recipient, "email"),
    phone: readString(recipient, "phone"),
    phone_full: readString(recipient, "phone_full") || readString(recipient, "phoneFull"),
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
    country_code: readString(recipient, "country_code") || readString(recipient, "countryCode"),
    chat_id: readString(recipient, "chat_id"),
    kind: ["group", "channel", "user"].includes(readString(recipient, "kind")) ? readString(recipient, "kind") : "user",
    enabled,
    plan: ["free", "premium", "vip"].includes(readString(recipient, "plan")) ? readString(recipient, "plan") : "vip",
    access_status: accessStatus,
    starts_at: startsAt,
    validity_days: Number.isFinite(validityDays) ? validityDays : 30,
    expires_at: expiresAt,
    notes: readString(recipient, "notes"),
    created_at: readString(recipient, "created_at") || new Date().toISOString(),
    updated_at: readString(recipient, "updated_at") || new Date().toISOString(),
  };
}

function approverPatchForPendingApproval(currentRecipient: Record<string, unknown>, body: Record<string, unknown>) {
  const currentStatus = readString(currentRecipient, "access_status");
  const wantsApproval =
    body.enabled === true &&
    readString(body, "access_status") === "approved" &&
    ["premium", "vip"].includes(readString(body, "plan"));

  if (currentStatus !== "pending" || !wantsApproval) return null;

  const startsAt = normalizeDateInputIso(readFirstString(body, ["starts_at", "startsAt"]), false) || todayIso();
  const validityDays = readFirstPositiveNumber(body, ["validity_days", "validityDays", "days"]) || 30;
  const expiresAt =
    normalizeDateInputIso(readFirstString(body, ["expires_at", "expiresAt", "currentPeriodEnd", "validade"]), true) ||
    addDaysIso(startsAt, validityDays || 30);

  return {
    enabled: true,
    access_status: "approved",
    plan: readString(body, "plan") === "vip" ? "vip" : "premium",
    starts_at: startsAt,
    validity_days: Number.isFinite(validityDays) ? validityDays : 30,
    expires_at: expiresAt,
  };
}

function findClientByEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return liveClients.find((item) => readString(item, "email").toLowerCase() === cleanEmail) || null;
}

function findRecipientByEmail(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  return liveRecipients.find((item) => readString(item, "email").toLowerCase() === cleanEmail) || null;
}

function syncClientFromRecipientEmail(email: string) {
  const recipient = findRecipientByEmail(email);
  if (!recipient) return null;
  upsertClientFromRecipient(recipient);
  return findClientByEmail(email);
}

function syncClientFromAdminUserEmail(env: unknown, email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  const adminUser =
    syncAdminManagedUsers(env).find((user) => readString(user, "email").toLowerCase() === cleanEmail) || null;
  if (!adminUser) return null;
  applyAdminManagedUserToClient(adminUser);
  return findClientByEmail(cleanEmail);
}

function clientHasLiveAccess(client: Record<string, unknown>) {
  const status = readString(client, "access_status").toLowerCase();
  if (Boolean(client.isBlocked) || Boolean(client.is_blocked) || status === "blocked") return false;
  if (status === "expired") return false;
  const enabled =
    Boolean(client.enabled) ||
    status === "approved" ||
    status === "active" ||
    status === "manual_vip" ||
    status === "trial";
  return enabled && !isExpiredIso(readString(client, "expires_at"));
}

function normalizeMigrationPaidPlanId(rawPlan: unknown, rawStatus: unknown): BillingPlanId | null {
  const planText = String(rawPlan || "")
    .trim()
    .toLowerCase();
  const statusText = String(rawStatus || "")
    .trim()
    .toLowerCase();
  const plan = normalizeBillingPlanId(planText);
  if (plan && plan !== "free") return plan;
  if (["monthly", "mensal", "vip_manual", "manual_vip"].includes(planText)) return "vip";
  if (planText.includes("premium") || planText.includes("liberado")) return "premium";
  if (statusText === "manual_vip") return "vip";
  if (["approved", "active"].includes(statusText)) return "premium";
  return null;
}

function clientCanBindPasswordDuringMigration(client: Record<string, unknown>) {
  if (readString(client, "password_hash") || readString(client, "password")) return false;
  if (Boolean(client.isBlocked) || Boolean(client.is_blocked)) return false;
  const rawPlan = readString(client, "plan").toLowerCase();
  const status = readString(client, "access_status").toLowerCase();
  if (!normalizeMigrationPaidPlanId(rawPlan, status)) return false;
  if (status === "expired" || status === "blocked" || isExpiredIso(readString(client, "expires_at"))) {
    return false;
  }
  return Boolean(client.enabled) || ["approved", "active", "manual_vip"].includes(status);
}

function buildRegistrationTrialAccess(
  env: unknown,
  email: string,
  existingClient: Record<string, unknown>,
  binding: { ipHash: string; userAgentHash: string },
  now: string,
) {
  const existingStatus = readString(existingClient, "access_status").toLowerCase();
  const existingPlan = normalizeMigrationPaidPlanId(readString(existingClient, "plan"), existingStatus);
  const existingExpiresAt = readString(existingClient, "expires_at");
  const existingTrialExpiresAt = readString(existingClient, "trial_expires_at") || existingExpiresAt;

  if (existingPlan && existingPlan !== "free") {
    return {
      plan: existingPlan,
      accessStatus: existingStatus || "pending",
      enabled: Boolean(existingClient.enabled),
      startsAt: readString(existingClient, "starts_at") || todayIso(),
      validityDays: Number(existingClient.validity_days || 30),
      expiresAt: existingExpiresAt,
      trialStartedAt: readString(existingClient, "trial_started_at"),
      trialExpiresAt: readString(existingClient, "trial_expires_at"),
      trialIpHash: readString(existingClient, "trial_ip_hash"),
      trialUserAgentHash: readString(existingClient, "trial_user_agent_hash"),
      trialBlockedReason: readString(existingClient, "trial_blocked_reason"),
    };
  }

  if (clientHasUsedFreeTrial(existingClient)) {
    const activeTrial = existingStatus === "trial" && !isExpiredIso(existingTrialExpiresAt);
    return {
      plan: "free" as const,
      accessStatus: activeTrial ? "trial" : "expired",
      enabled: activeTrial,
      startsAt: readString(existingClient, "starts_at") || now,
      validityDays: 0,
      expiresAt: existingTrialExpiresAt || now,
      trialStartedAt: readString(existingClient, "trial_started_at") || now,
      trialExpiresAt: existingTrialExpiresAt || now,
      trialIpHash: readString(existingClient, "trial_ip_hash") || binding.ipHash,
      trialUserAgentHash: readString(existingClient, "trial_user_agent_hash") || binding.userAgentHash,
      trialBlockedReason: readString(existingClient, "trial_blocked_reason"),
    };
  }

  const previousTrial = findFreeTrialClaim(email, binding);
  if (previousTrial) {
    return {
      plan: "free" as const,
      accessStatus: "expired",
      enabled: false,
      startsAt: now,
      validityDays: 0,
      expiresAt: now,
      trialStartedAt: now,
      trialExpiresAt: now,
      trialIpHash: binding.ipHash,
      trialUserAgentHash: binding.userAgentHash,
      trialBlockedReason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    };
  }

  const trialExpiresAt = addMinutesIso(now, freeTrialMinutes(env));
  return {
    plan: "free" as const,
    accessStatus: "trial",
    enabled: true,
    startsAt: now,
    validityDays: 0,
    expiresAt: trialExpiresAt,
    trialStartedAt: now,
    trialExpiresAt,
    trialIpHash: binding.ipHash,
    trialUserAgentHash: binding.userAgentHash,
    trialBlockedReason: "",
  };
}

function normalizeRecipientAccessStatus(value: string, enabled: boolean) {
  const status = value.trim().toLowerCase();
  if (
    status === "approved" ||
    status === "paused" ||
    status === "pending" ||
    status === "expired" ||
    status === "blocked" ||
    status === "trial" ||
    status === "manual_vip"
  ) {
    return status;
  }
  return enabled ? "approved" : "pending";
}

function clientHasUsedFreeTrial(client: Record<string, unknown>) {
  return Boolean(
    readString(client, "trial_started_at") ||
    readString(client, "trial_expires_at") ||
    readString(client, "trial_ip_hash") ||
    readString(client, "trial_user_agent_hash") ||
    readString(client, "trial_blocked_reason") ||
    readString(client, "access_status").toLowerCase() === "trial",
  );
}

function findFreeTrialClaim(email: string, binding: { ipHash: string; userAgentHash: string }) {
  const cleanEmail = email.trim().toLowerCase();
  return liveClients.find((client) => {
    if (readString(client, "email").toLowerCase() === cleanEmail) return false;
    if (!clientHasUsedFreeTrial(client)) return false;
    const trialIpHash = readString(client, "trial_ip_hash");
    const trialUserAgentHash = readString(client, "trial_user_agent_hash");
    return Boolean(
      binding.ipHash &&
      binding.userAgentHash &&
      trialIpHash &&
      trialUserAgentHash &&
      trialIpHash === binding.ipHash &&
      trialUserAgentHash === binding.userAgentHash,
    );
  });
}

async function ensureBlockedTrialClientForLogin(env: unknown, request: Request, email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) return null;

  const binding = await requestSessionBinding(env, request);
  const previousTrial = findFreeTrialClaim(cleanEmail, binding);
  if (!previousTrial) return null;

  const now = new Date().toISOString();
  const client = removeLegacyPassword({
    id: crypto.randomUUID(),
    full_name: nameFromEmail(cleanEmail),
    email: cleanEmail,
    phone: "",
    city: "",
    country: "",
    password_hash: await hashPassword(password),
    plan: "free",
    access_status: "expired",
    enabled: false,
    starts_at: now,
    validity_days: 0,
    expires_at: now,
    trial_started_at: now,
    trial_expires_at: now,
    trial_ip_hash: binding.ipHash,
    trial_user_agent_hash: binding.userAgentHash,
    trial_blocked_reason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    created_at: now,
    updated_at: now,
  });

  if (isEntityDeleted(client)) return null;
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_trial_recreated_for_checkout", {
    ...client,
    risk: "medium",
    detail: "Conta recriada como teste expirado para permitir checkout sem novo periodo gratis.",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(cleanEmail) || client;
}

async function ensureSessionClientForExpiredTrial(env: unknown, request: Request, session: SessionPayload) {
  if (session.scope !== "client" || session.approved || session.plan !== "free") return null;
  if (!(await sessionMatchesRequestBinding(env, request, session))) return null;

  const now = new Date().toISOString();
  const client = {
    id: crypto.randomUUID(),
    full_name: nameFromEmail(session.email),
    email: session.email,
    phone: "",
    city: "",
    country: "",
    password_hash: "",
    plan: "free",
    access_status: "expired",
    enabled: false,
    starts_at: now,
    validity_days: 0,
    expires_at: now,
    trial_started_at: now,
    trial_expires_at: now,
    trial_ip_hash: session.iph,
    trial_user_agent_hash: session.ua,
    trial_blocked_reason: "Teste gratuito ja utilizado neste IP ou dispositivo.",
    created_at: now,
    updated_at: now,
  };

  if (isEntityDeleted(client)) return null;
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_trial_session_recovered", {
    ...client,
    risk: "medium",
    detail: "Sessao de teste expirado recuperada para manter checkout disponivel.",
  });
  await saveLiveState(env);
  await persistBillingUser(env, client);
  return findClientByEmail(session.email) || client;
}

async function restoreClientFromApprovedSession(env: unknown, request: Request, session: SessionPayload) {
  if (!(await approvedClientSessionMatchesRequestBinding(env, request, session))) return null;
  const now = new Date().toISOString();
  const plan = session.plan === "vip" ? "vip" : "premium";
  const client: Record<string, unknown> = {
    id: crypto.randomUUID(),
    full_name: nameFromEmail(session.email),
    email: session.email,
    phone: "",
    city: "",
    country: "",
    password_hash: "",
    plan,
    access_status: "approved",
    enabled: true,
    starts_at: now,
    validity_days: plan === "vip" ? 3650 : 30,
    expires_at: "",
    trial_started_at: "",
    trial_expires_at: "",
    trial_ip_hash: "",
    trial_user_agent_hash: "",
    trial_blocked_reason: "",
    created_at: now,
    updated_at: now,
  };
  if (isEntityDeleted(client)) return null;
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  recordAccessEvent("client_restored_from_approved_session", {
    ...client,
    risk: "medium",
    detail: "Cliente premium reconstruido por sessao assinada apos migracao.",
  });
  await persistBillingUser(env, client);
  await saveLiveState(env);
  return findClientByEmail(session.email) || client;
}

async function approvedClientSessionMatchesRequestBinding(env: unknown, request: Request, session: SessionPayload) {
  if (!session.ua) return false;
  const binding = await requestSessionBinding(env, request);
  return session.ua === binding.userAgentHash;
}

async function validateClientSessionBinding(
  env: unknown,
  request: Request,
  session: SessionPayload,
  client: Record<string, unknown>,
) {
  const binding = await requestSessionBinding(env, request);

  if (session.ua && session.ua !== binding.userAgentHash) {
    return { ok: false, reason: "user_agent_changed", ...binding };
  }

  return { ok: true, reason: "", ...binding };
}

async function sessionMatchesRequestBinding(env: unknown, request: Request, session: SessionPayload) {
  if (!session.ua || !session.iph) return false;
  const binding = await requestSessionBinding(env, request);
  return session.ua === binding.userAgentHash && session.iph === binding.ipHash;
}

async function requestSessionBinding(env: unknown, request: Request) {
  const userAgent = request.headers.get("user-agent") || "unknown";
  const ip = getClientIp(request);
  return {
    userAgentHash: await hashSessionValue(env, `ua:${userAgent}`),
    ipHash: await hashSessionValue(env, `ip:${ip}`),
  };
}

async function hashSessionValue(env: unknown, value: string) {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  return bytesToB64Url(await hmacSign(secret, `session-binding:${value}`)).slice(0, 32);
}

async function ownerAccess(env: unknown, email: string, request?: Request) {
  const binding = request ? await requestSessionBinding(env, request) : { userAgentHash: "", ipHash: "" };
  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "owner",
      role: "admin",
      plan: "vip",
      approved: true,
      sid: crypto.randomUUID(),
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    ADMIN_SESSION_TTL_SECONDS,
  );
  return {
    registered: true,
    approved: true,
    access_mode: "full",
    access_status: "owner",
    plan: "vip",
    role: "owner",
    email,
    full_name: nameFromEmail(email),
    expires_at: "",
    reason: "Acesso do administrador.",
    client_token: token,
  };
}

async function approverAccess(env: unknown, email: string, request?: Request) {
  const binding = request ? await requestSessionBinding(env, request) : { userAgentHash: "", ipHash: "" };
  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "admin_approver",
      role: "admin",
      plan: "free",
      approved: false,
      sid: crypto.randomUUID(),
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    ADMIN_SESSION_TTL_SECONDS,
  );
  return {
    registered: true,
    approved: false,
    access_mode: "pending",
    access_status: "admin_approver",
    plan: "free",
    role: "admin",
    email,
    full_name: nameFromEmail(email),
    expires_at: "",
    reason: "Acesso limitado para aprovar clientes.",
    client_token: token,
  };
}

async function clientAccess(
  env: unknown,
  client: Record<string, unknown>,
  request?: Request,
  session?: SessionPayload,
) {
  const rawStatus = readString(client, "access_status").toLowerCase();
  const blocked = Boolean(client.isBlocked) || Boolean(client.is_blocked) || rawStatus === "blocked";
  const trial = rawStatus === "trial";
  const expiresAt = readString(client, "expires_at");
  const enabled =
    !blocked &&
    (Boolean(client.enabled) ||
      rawStatus === "approved" ||
      rawStatus === "active" ||
      rawStatus === "manual_vip" ||
      rawStatus === "trial");
  const expired = !blocked && (rawStatus === "expired" || isExpiredIso(expiresAt));
  if (expired && readString(client, "access_status").toLowerCase() !== "expired") {
    client.enabled = false;
    client.access_status = "expired";
    client.updated_at = new Date().toISOString();
    upsertRecipientFromClient(client);
  }
  const approved = enabled && !expired && !trial;
  const accessStatus = blocked ? "blocked" : readString(client, "access_status") || (enabled ? "approved" : "pending");
  const plan = ["premium", "vip"].includes(readString(client, "plan")) ? readString(client, "plan") : "free";
  const email = readString(client, "email");
  const previousSessionId = readString(client, "active_session_id");
  const sessionId = session?.sid && session.sid === previousSessionId ? session.sid : crypto.randomUUID();
  const binding = request
    ? await requestSessionBinding(env, request)
    : {
        ipHash: readString(client, "active_session_ip_hash"),
        userAgentHash: readString(client, "active_session_user_agent_hash"),
      };

  if (request) {
    if (previousSessionId && previousSessionId !== sessionId) {
      recordAccessEvent("client_session_replaced", {
        ...client,
        risk: "medium",
        detail: "Nova sessao derrubou a sessao anterior.",
        ip_hash: binding.ipHash,
        user_agent_hash: binding.userAgentHash,
      });
    }

    const now = new Date().toISOString();
    client.active_session_id = sessionId;
    client.active_session_user_agent_hash = binding.userAgentHash;
    client.active_session_ip_hash = binding.ipHash;
    client.active_session_started_at =
      previousSessionId === sessionId ? readString(client, "active_session_started_at") || now : now;
    client.active_session_last_seen_at = now;
  }

  const token = await issueSessionToken(
    env,
    {
      email,
      scope: "client",
      role: "user",
      plan,
      approved,
      sid: sessionId,
      ua: binding.userAgentHash,
      iph: binding.ipHash,
    },
    CLIENT_SESSION_TTL_SECONDS,
  );

  return {
    registered: true,
    approved,
    access_mode: expired ? "expired" : trial && enabled ? "demo" : enabled ? "full" : "pending",
    access_status: expired ? "expired" : accessStatus,
    plan,
    role: normalizeManagedUserRole(client.role),
    email,
    full_name: readString(client, "full_name") || readString(client, "name") || readString(client, "email"),
    expires_at: expiresAt,
    reason: expired
      ? "Seu teste gratuito expirou. Atualize seu plano para continuar recebendo sinais."
      : trial && enabled
        ? "Teste gratuito ativo por tempo limitado."
        : enabled
          ? "Acesso liberado pelo administrador."
          : "Aguardando liberacao do administrador.",
    client_token: token,
  };
}

function recordAccessEvent(type: string, source: Record<string, unknown>) {
  const event = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    type,
    email: readString(source, "email"),
    full_name: readString(source, "full_name") || readString(source, "name"),
    city: readString(source, "city"),
    country: readString(source, "country"),
    risk: readString(source, "risk"),
    detail: readString(source, "detail"),
    ip_hash: readString(source, "ip_hash"),
    user_agent_hash: readString(source, "user_agent_hash"),
  };
  liveAccessEvents = [event, ...liveAccessEvents].slice(0, 200);
}

function summarizeSecurityEvents() {
  const summary = { total: liveAccessEvents.length, low: 0, medium: 0, high: 0, critical: 0 };
  for (const event of liveAccessEvents) {
    const risk = readString(event, "risk").toLowerCase();
    if (risk === "critical") summary.critical += 1;
    else if (risk === "high") summary.high += 1;
    else if (risk === "medium") summary.medium += 1;
    else summary.low += 1;
  }
  return summary;
}

function buildAdminSummary() {
  const people = uniquePeople([...liveClients, ...liveRecipients]);
  const approved = people.filter(isActivePaidRecipient);
  const pending = people.filter((person) => readString(person, "access_status") === "pending");
  const paused = people.filter((person) => readString(person, "access_status") === "paused");
  const uniqueAccesses = new Set(liveAccessEvents.map((event) => readString(event, "email")).filter(Boolean)).size;

  return {
    totalRegistrations: people.length,
    approved: approved.length,
    pending: pending.length,
    paused: paused.length,
    totalAccesses: liveAccessEvents.length,
    uniqueAccesses,
    cityBreakdown: buildLocationBreakdown(people, "city"),
    countryBreakdown: buildLocationBreakdown(people, "country"),
    recentAccesses: liveAccessEvents.slice(0, 8).map((event) => ({
      id: readString(event, "id"),
      created_at: readString(event, "created_at"),
      type: readString(event, "type"),
      email: readString(event, "email"),
      full_name: readString(event, "full_name"),
      city: readString(event, "city"),
      country: readString(event, "country"),
    })),
  };
}

function isActivePaidRecipient(person: Record<string, unknown>) {
  const plan = readString(person, "plan").toLowerCase();
  if (plan === "free") return false;
  if (isExpiredIso(readString(person, "expires_at"))) return false;
  return Boolean(person.enabled) || readString(person, "access_status") === "approved";
}

function buildAdminPanelOverview(users = syncAdminManagedUsers()) {
  const now = Date.now();
  const clientUsers = users.filter((user) => normalizeManagedUserRole(user.role) === "user");
  const active = clientUsers.filter(
    (user) =>
      !user.isBlocked &&
      ["active", "manual_vip", "trial"].includes(readString(user, "subscriptionStatus")) &&
      Date.parse(readString(user, "currentPeriodEnd")) > now,
  );
  const paidActive = active.filter((user) => ["active", "manual_vip"].includes(readString(user, "subscriptionStatus")));
  const premium = active.filter((user) => ["premium", "vip_manual"].includes(readString(user, "plan")));
  const trials = active.filter(
    (user) => readString(user, "plan") === "trial" || readString(user, "subscriptionStatus") === "trial",
  );
  const currentSignal = readRecord((liveDashboardData as Record<string, unknown>).currentSignal);
  const side =
    readString(currentSignal, "side") ||
    readString((liveDashboardData as Record<string, unknown>).entrySide) ||
    readString((liveDashboardData as Record<string, unknown>).recommendedSide) ||
    "BANKER";

  return {
    engineStatus: "Online",
    tableStatus: "Conectada",
    activeUsers: active.length,
    activeSubscriptions: paidActive.length,
    activeTrials: trials.length,
    premiumUsers: premium.length,
    onlineNow: countOnlineClientUsers(now),
    lastSignal: side.toUpperCase(),
    lastSignalAt: relativeTimeFromIso(readString(liveDashboardData as Record<string, unknown>, "updatedAt")),
  };
}

function countOnlineClientUsers(now = Date.now()) {
  const onlineEmails = new Set<string>();
  for (const event of liveAccessEvents) {
    const createdAt = Date.parse(readString(event, "created_at"));
    if (!Number.isFinite(createdAt) || now - createdAt >= 5 * 60 * 1000) continue;

    const type = readString(event, "type");
    if (!type.startsWith("client_")) continue;

    const email = readString(event, "email").toLowerCase();
    if (email) onlineEmails.add(email);
  }
  return onlineEmails.size;
}

function syncAdminManagedUsers(env?: unknown) {
  const byEmail = new Map<string, Record<string, unknown>>();

  for (const user of liveAdminUsers) {
    const normalized = normalizeAdminManagedUser(user, env);
    const email = readString(normalized, "email").toLowerCase();
    if (email) byEmail.set(email, { ...(byEmail.get(email) || {}), ...normalized });
  }

  for (const client of [...liveRecipients, ...liveClients]) {
    const user = adminManagedUserFromClient(client, env);
    const email = readString(user, "email").toLowerCase();
    if (email) byEmail.set(email, { ...(byEmail.get(email) || {}), ...user });
  }

  for (const email of getAdminEmails(env)) {
    const existing = byEmail.get(email) || {};
    byEmail.set(
      email,
      normalizeAdminManagedUser(
        {
          ...existing,
          email,
          name: readString(existing, "name") || nameFromEmail(email),
          role: "owner",
          plan: readString(existing, "plan") || "premium",
          subscriptionStatus: "manual_vip",
          currentPeriodEnd: readString(existing, "currentPeriodEnd") || addDaysIso(new Date().toISOString(), 3650),
          isBlocked: false,
        },
        env,
      ),
    );
  }

  for (const email of getAdminApproverEmails(env)) {
    const existing = byEmail.get(email) || {};
    byEmail.set(
      email,
      normalizeAdminManagedUser(
        {
          ...existing,
          email,
          name: readString(existing, "name") || nameFromEmail(email),
          role: "admin",
          plan: readString(existing, "plan") || "free",
          subscriptionStatus: readString(existing, "subscriptionStatus") || "active",
          currentPeriodEnd: readString(existing, "currentPeriodEnd") || addDaysIso(new Date().toISOString(), 3650),
          isBlocked: false,
        },
        env,
      ),
    );
  }

  if (byEmail.size === 0) {
    for (const user of mockAdminManagedUsers()) {
      byEmail.set(readString(user, "email").toLowerCase(), user);
    }
  }

  const users = [...byEmail.values()]
    .map((user) => normalizeAdminManagedUser(user, env))
    .sort((a, b) => readString(a, "name").localeCompare(readString(b, "name")));
  liveAdminUsers = users;
  return users;
}

function findAdminManagedUser(id: string, env?: unknown) {
  return (
    syncAdminManagedUsers(env).find((user) => {
      return readString(user, "id") === id || readString(user, "email").toLowerCase() === id.toLowerCase();
    }) || null
  );
}

function adminManagedUserFromClient(client: Record<string, unknown>, env?: unknown) {
  const email = readString(client, "email").toLowerCase();
  const expiresAt = readString(client, "expires_at") || readString(client, "currentPeriodEnd");
  const blocked =
    Boolean(client.isBlocked) ||
    Boolean(client.is_blocked) ||
    readString(client, "access_status").toLowerCase() === "blocked";
  return normalizeAdminManagedUser(
    {
      id: readString(client, "id") || email || crypto.randomUUID(),
      name: readString(client, "full_name") || readString(client, "name") || nameFromEmail(email),
      email,
      phone: readString(client, "phone"),
      phoneFull: readString(client, "phone_full") || readString(client, "phoneFull"),
      city: readString(client, "city"),
      country: readString(client, "country"),
      countryCode: readString(client, "country_code") || readString(client, "countryCode"),
      role: readString(client, "role"),
      plan: mapClientPlanToAdminPlan(readString(client, "plan"), readString(client, "access_status")),
      subscriptionStatus: mapClientStatusToAdminStatus(client),
      currentPeriodStart:
        readString(client, "starts_at") ||
        readString(client, "currentPeriodStart") ||
        readString(client, "created_at") ||
        new Date().toISOString(),
      currentPeriodEnd: expiresAt || addDaysIso(new Date().toISOString(), 7),
      isBlocked: blocked,
      adminNote: readString(client, "adminNote") || readString(client, "notes"),
      createdAt: readString(client, "created_at") || new Date().toISOString(),
      lastAccess: latestAccessLabel(email),
      lastAccessAt: latestAccessIso(email),
    },
    env,
  );
}

function normalizeAdminManagedUser(user: Record<string, unknown>, env?: unknown) {
  const email = readString(user, "email").toLowerCase();
  const currentPeriodEnd =
    normalizeDateInputIso(
      readFirstString(user, [
        "currentPeriodEnd",
        "current_period_end",
        "expires_at",
        "expiresAt",
        "validade",
        "validUntil",
      ]),
      true,
    ) || addDaysIso(new Date().toISOString(), 7);
  const rawStatus = normalizeAdminSubscriptionStatus(
    readString(user, "subscriptionStatus") ||
      readString(user, "subscription_status") ||
      readString(user, "access_status"),
  );
  const isBlocked = Boolean(user.isBlocked) || Boolean(user.is_blocked) || rawStatus === "blocked";
  const status = isBlocked
    ? "blocked"
    : isExpiredIso(currentPeriodEnd) && rawStatus !== "canceled"
      ? "expired"
      : rawStatus;
  return {
    id: readString(user, "id") || email || crypto.randomUUID(),
    name: readString(user, "name") || readString(user, "full_name") || nameFromEmail(email),
    email,
    phone: readString(user, "phone"),
    phoneFull: readString(user, "phoneFull") || readString(user, "phone_full"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    countryCode: readString(user, "countryCode") || readString(user, "country_code"),
    role: normalizeManagedUserRole(
      isAdminOwnerEmailForEnv(env, email)
        ? "owner"
        : isAdminApproverEmailForEnv(env, email)
          ? "admin"
          : readString(user, "role"),
    ),
    plan: normalizeAdminPlan(readString(user, "plan")),
    subscriptionStatus: status,
    currentPeriodStart:
      normalizeDateInputIso(
        readFirstString(user, ["currentPeriodStart", "current_period_start", "starts_at", "startsAt"]),
        false,
      ) ||
      readString(user, "created_at") ||
      new Date().toISOString(),
    currentPeriodEnd,
    isBlocked,
    adminNote: readString(user, "adminNote") || readString(user, "admin_note") || readString(user, "notes"),
    createdAt: readString(user, "createdAt") || readString(user, "created_at") || new Date().toISOString(),
    lastAccessAt: readString(user, "lastAccessAt") || readString(user, "last_access_at") || latestAccessIso(email),
    lastAccess: readString(user, "lastAccess") || readString(user, "last_access") || latestAccessLabel(email),
  };
}

async function updateAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  body: Record<string, unknown>,
  preferredAction: AdminActionType,
): Promise<{ ok: true; user: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const before = normalizeAdminManagedUser(target, env);
  const actorEmail = adminActorEmailFromRequest(request, env, adminRole);
  const nextRole = Object.hasOwn(body, "role") ? normalizeManagedUserRole(body.role) : before.role;
  const changingRole = nextRole !== before.role;
  const requestedBlocked = Object.hasOwn(body, "isBlocked") ? Boolean(body.isBlocked) : before.isBlocked;

  const permission = canEditAdminManagedUser(adminRole, actorEmail, before, {
    changingRole,
    nextRole,
    requestedBlocked,
  });
  if (!permission.ok) return permission;

  const requestedPlan = Object.hasOwn(body, "plan") ? normalizeAdminPlan(body.plan) : before.plan;
  let status = Object.hasOwn(body, "subscriptionStatus")
    ? normalizeAdminSubscriptionStatus(body.subscriptionStatus)
    : before.subscriptionStatus;
  if (requestedPlan === "free" && ["active", "manual_vip", "trial"].includes(status)) {
    status = "canceled";
  }
  const currentPeriodStart =
    normalizeDateInputIso(
      readFirstString(body, ["currentPeriodStart", "current_period_start", "starts_at", "startsAt"]),
      false,
    ) || before.currentPeriodStart;
  const validityDays = readFirstPositiveNumber(body, ["validityDays", "validity_days", "days", "durationDays"]);
  const explicitPeriodEnd = normalizeDateInputIso(
    readFirstString(body, [
      "currentPeriodEnd",
      "current_period_end",
      "expires_at",
      "expiresAt",
      "validade",
      "validUntil",
    ]),
    true,
  );
  let currentPeriodEnd =
    explicitPeriodEnd ||
    (validityDays ? addDaysIso(currentPeriodStart || new Date().toISOString(), validityDays) : before.currentPeriodEnd);
  if (
    requestedPlan !== "free" &&
    status !== "blocked" &&
    status !== "canceled" &&
    status !== "expired" &&
    (!currentPeriodEnd || isExpiredIso(currentPeriodEnd))
  ) {
    currentPeriodEnd = addDaysIso(
      new Date().toISOString(),
      validityDays || planDurationDaysForAdminPlan(requestedPlan) || 30,
    );
  }
  if (!Object.hasOwn(body, "subscriptionStatus") && requestedPlan === "vip_manual") {
    status = "manual_vip";
  } else if (
    !Object.hasOwn(body, "subscriptionStatus") &&
    requestedPlan !== "free" &&
    requestedPlan !== "trial" &&
    !isExpiredIso(currentPeriodEnd)
  ) {
    status = "active";
  } else if (!Object.hasOwn(body, "subscriptionStatus") && requestedPlan === "trial") {
    status = "trial";
  }
  const updated = normalizeAdminManagedUser(
    {
      ...before,
      name: Object.hasOwn(body, "name") ? readString(body, "name") : before.name,
      email: Object.hasOwn(body, "email") ? readString(body, "email").toLowerCase() : before.email,
      phone: Object.hasOwn(body, "phone") ? readString(body, "phone") : before.phone,
      phoneFull: Object.hasOwn(body, "phoneFull")
        ? readString(body, "phoneFull")
        : Object.hasOwn(body, "phone_full")
          ? readString(body, "phone_full")
          : before.phoneFull,
      city: Object.hasOwn(body, "city") ? readString(body, "city") : before.city,
      country: Object.hasOwn(body, "country") ? readString(body, "country") : before.country,
      countryCode: Object.hasOwn(body, "countryCode")
        ? readString(body, "countryCode")
        : Object.hasOwn(body, "country_code")
          ? readString(body, "country_code")
          : before.countryCode,
      role: nextRole,
      plan: requestedPlan,
      subscriptionStatus: requestedBlocked ? "blocked" : status,
      currentPeriodStart,
      currentPeriodEnd,
      isBlocked: requestedBlocked,
      adminNote: Object.hasOwn(body, "adminNote") ? readString(body, "adminNote") : before.adminNote,
    },
    env,
  );

  upsertAdminManagedUser(updated);
  applyAdminManagedUserToClient(updated);
  if (shouldClearBillingAccessForAdminUpdate(updated)) {
    clearBillingStateForUser(updated);
    await deletePersistedBillingAccess(env, updated);
  }
  recordAdminActionLog(env, request, adminRole, {
    targetUserId: readString(updated, "id"),
    targetEmail: readString(updated, "email"),
    action: inferAdminAction(preferredAction, before, updated),
    beforeJson: before,
    afterJson: updated,
    reason: readString(body, "reason"),
  });
  const persisted = await persistAdminManagedUserChange(env, updated, preferredAction);
  if (!persisted.ok) {
    return {
      ok: false,
      status: 503,
      error: "Alteracao do cliente nao foi gravada com seguranca no banco.",
    };
  }
  return { ok: true, user: updated };
}

async function persistAdminManagedUserChange(env: unknown, user: Record<string, unknown>, reason: string) {
  const email = readString(user, "email").toLowerCase();
  const client = email ? findClientByEmail(email) || syncClientFromAdminUserEmail(env, email) : null;
  if (client) {
    return persistClientRegistryAfterClientChange(env, client, `admin_${reason}`);
  }

  const saveStatus = await saveLiveState(env);
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  return {
    ok: !durableConfigured || saveStatus.durable,
    userPersisted: false,
    saveStatus,
  };
}

async function extendAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  days: number,
  reason: string,
) {
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return { ok: false as const, status: 400, error: "Quantidade de dias invalida." };
  }
  const before = normalizeAdminManagedUser(target, env);
  const baseMs = Date.parse(before.currentPeriodEnd);
  const base = Number.isFinite(baseMs) && baseMs > Date.now() ? new Date(baseMs) : new Date();
  const currentPeriodEnd = addDaysIso(base.toISOString(), days);
  const status =
    before.plan === "vip_manual" || before.subscriptionStatus === "manual_vip"
      ? "manual_vip"
      : before.plan === "trial"
        ? "trial"
        : "active";
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    before,
    {
      currentPeriodEnd,
      subscriptionStatus: status,
      isBlocked: false,
      reason: reason || `Prorrogacao de ${days} dias`,
    },
    "EXTEND_ACCESS",
  );
}

async function blockAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
) {
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    target,
    {
      isBlocked: true,
      subscriptionStatus: "blocked",
      reason: reason || "Bloqueio manual",
    },
    "BLOCK_USER",
  );
}

async function unblockAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
) {
  const before = normalizeAdminManagedUser(target, env);
  const nextStatus = isExpiredIso(before.currentPeriodEnd)
    ? "expired"
    : before.plan === "vip_manual"
      ? "manual_vip"
      : before.plan === "trial"
        ? "trial"
        : "active";
  return updateAdminManagedUser(
    env,
    adminRole,
    request,
    target,
    {
      isBlocked: false,
      subscriptionStatus: nextStatus,
      reason: reason || "Reativacao manual",
    },
    "UNBLOCK_USER",
  );
}

async function deleteAdminManagedUser(
  env: unknown,
  adminRole: AdminRole,
  request: Request,
  target: Record<string, unknown>,
  reason: string,
): Promise<{ ok: true; user: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const before = normalizeAdminManagedUser(target, env);
  const actorEmail = adminActorEmailFromRequest(request, env, adminRole);
  const permission = canDeleteAdminManagedUser(adminRole, actorEmail, before);
  if (!permission.ok) return permission;

  markEntityDeleted(before);
  removeUserEntityEverywhere(before);
  recordAdminActionLog(env, request, adminRole, {
    targetUserId: readString(before, "id"),
    targetEmail: readString(before, "email"),
    action: "DELETE_USER",
    beforeJson: before,
    afterJson: { deleted: true },
    reason: reason || "Exclusao manual de cadastro",
  });
  await deletePersistedBillingUser(env, before);
  const saveStatus = await saveLiveState(env);
  if (getSupabasePersistenceConfig(env) && !saveStatus.durable) {
    return {
      ok: false,
      status: 503,
      error: "Exclusao do cliente nao foi gravada com seguranca no banco.",
    };
  }
  return { ok: true, user: before };
}

function canDeleteAdminManagedUser(
  adminRole: AdminRole,
  actorEmail: string,
  target: Record<string, unknown>,
): { ok: true } | { ok: false; status: number; error: string } {
  if (adminRole !== "owner") {
    return { ok: false, status: 403, error: "Apenas owner pode excluir cadastros." };
  }

  const targetEmail = readString(target, "email").toLowerCase();
  const targetRole = normalizeManagedUserRole(target.role);
  if (targetRole === "owner") {
    const ownerCount = syncAdminManagedUsers().filter((user) => normalizeManagedUserRole(user.role) === "owner").length;
    if (ownerCount <= 1) {
      return { ok: false, status: 403, error: "Nao e permitido excluir o unico owner ativo." };
    }
  }

  if (targetEmail && targetEmail === actorEmail) {
    return {
      ok: false,
      status: 403,
      error: "Nao e permitido excluir o proprio cadastro por esta rota.",
    };
  }

  return { ok: true };
}

function canEditAdminManagedUser(
  adminRole: AdminRole,
  actorEmail: string,
  target: Record<string, unknown>,
  change: { changingRole: boolean; nextRole: AdminManagedUserRole; requestedBlocked: boolean },
): { ok: true } | { ok: false; status: number; error: string } {
  const targetRole = normalizeManagedUserRole(target.role);
  const targetEmail = readString(target, "email").toLowerCase();
  if (adminRole !== "owner" && targetRole !== "user") {
    return { ok: false, status: 403, error: "Admin nao pode alterar outro admin ou owner." };
  }
  if (change.changingRole && adminRole !== "owner") {
    return {
      ok: false,
      status: 403,
      error: "Apenas owner pode alterar permissoes administrativas.",
    };
  }
  if (targetRole === "owner" && adminRole !== "owner") {
    return { ok: false, status: 403, error: "Admin nao pode alterar owner." };
  }
  if (adminRole !== "owner" && targetEmail === actorEmail && (change.changingRole || change.requestedBlocked)) {
    return {
      ok: false,
      status: 403,
      error: "Admin nao pode remover o proprio acesso por esta rota.",
    };
  }
  if (
    targetRole === "owner" &&
    targetEmail === actorEmail &&
    (change.nextRole !== "owner" || change.requestedBlocked)
  ) {
    const ownerCount = syncAdminManagedUsers().filter((user) => normalizeManagedUserRole(user.role) === "owner").length;
    if (ownerCount <= 1) {
      return { ok: false, status: 403, error: "Nao e permitido remover o unico owner ativo." };
    }
  }
  return { ok: true };
}

function upsertAdminManagedUser(user: Record<string, unknown>) {
  const normalized = normalizeAdminManagedUser(user);
  const id = readString(normalized, "id");
  const email = readString(normalized, "email").toLowerCase();
  const index = liveAdminUsers.findIndex((item) => {
    return readString(item, "id") === id || readString(item, "email").toLowerCase() === email;
  });
  liveAdminUsers =
    index >= 0
      ? liveAdminUsers.map((item, itemIndex) => (itemIndex === index ? normalized : item))
      : [normalized, ...liveAdminUsers];
}

function applyAdminManagedUserToClient(user: Record<string, unknown>) {
  const client = adminManagedUserToClient(user);
  clearDeletedEntityForRecord(client);
  upsertLiveClient(client);
  upsertRecipientFromClient(client);
  if (shouldClearBillingAccessForAdminUpdate(user)) {
    clearBillingStateForUser(user);
    return;
  }
  const email = readString(client, "email").toLowerCase();
  if (email) {
    upsertSubscriptionRecord({
      id: `admin-${email}`,
      email,
      plan: readString(user, "plan"),
      status: readString(user, "subscriptionStatus"),
      starts_at: readString(user, "currentPeriodStart"),
      expires_at: readString(user, "currentPeriodEnd"),
      provider: "admin_manual",
      updated_at: new Date().toISOString(),
    });
  }
}

function shouldClearBillingAccessForAdminUpdate(user: Record<string, unknown>) {
  const plan = normalizeAdminPlan(readString(user, "plan"));
  const status = normalizeAdminSubscriptionStatus(readString(user, "subscriptionStatus"));
  return plan === "free" || plan === "trial" || status === "canceled" || status === "blocked" || status === "expired";
}

function adminManagedUserToClient(user: Record<string, unknown>) {
  const status = normalizeAdminSubscriptionStatus(readString(user, "subscriptionStatus"));
  const blocked = Boolean(user.isBlocked) || status === "blocked";
  const expiresAt = readString(user, "currentPeriodEnd");
  const startsAt = readString(user, "currentPeriodStart");
  const validityDays =
    readFirstPositiveNumber(user, ["validityDays", "validity_days"]) ||
    daysBetweenIso(startsAt, expiresAt, planDurationDaysForAdminPlan(normalizeAdminPlan(readString(user, "plan"))));
  const active = !blocked && ["active", "manual_vip", "trial"].includes(status) && !isExpiredIso(expiresAt);
  return {
    id: readString(user, "id"),
    full_name: readString(user, "name"),
    email: readString(user, "email").toLowerCase(),
    phone: readString(user, "phone"),
    phone_full: readString(user, "phoneFull") || readString(user, "phone_full"),
    city: readString(user, "city"),
    country: readString(user, "country"),
    country_code: readString(user, "countryCode") || readString(user, "country_code"),
    role: normalizeManagedUserRole(user.role),
    plan: mapAdminPlanToClientPlan(normalizeAdminPlan(readString(user, "plan"))),
    access_status: blocked ? "blocked" : active ? "approved" : status,
    enabled: active,
    isBlocked: blocked,
    starts_at: startsAt,
    validity_days: validityDays,
    expires_at: expiresAt,
    notes: readString(user, "adminNote"),
    adminNote: readString(user, "adminNote"),
    created_at: readString(user, "createdAt") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function recordAdminActionLog(
  env: unknown,
  request: Request,
  adminRole: AdminRole,
  log: {
    targetUserId: string;
    targetEmail: string;
    action: AdminActionType;
    beforeJson: Record<string, unknown>;
    afterJson: Record<string, unknown>;
    reason: string;
  },
) {
  const adminEmail = adminActorEmailFromRequest(request, env, adminRole);
  const entry = {
    id: crypto.randomUUID(),
    adminUserId: adminEmail || adminRole,
    adminEmail,
    targetUserId: log.targetUserId,
    targetEmail: log.targetEmail,
    action: log.action,
    beforeJson: log.beforeJson,
    afterJson: log.afterJson,
    reason: log.reason,
    createdAt: new Date().toISOString(),
  };
  liveAdminActionLogs = [entry, ...liveAdminActionLogs].slice(0, 500);
  recordAccessEvent("admin_action", {
    email: adminEmail,
    full_name: nameFromEmail(adminEmail),
    detail: `${log.action} em ${log.targetEmail}`,
    risk: "low",
  });
  return entry;
}

function normalizeAdminActionLog(log: Record<string, unknown>) {
  return {
    id: readString(log, "id") || crypto.randomUUID(),
    adminUserId: readString(log, "adminUserId") || readString(log, "admin_user_id"),
    adminEmail: readString(log, "adminEmail") || readString(log, "admin_email"),
    targetUserId: readString(log, "targetUserId") || readString(log, "target_user_id"),
    targetEmail: readString(log, "targetEmail") || readString(log, "target_email"),
    action: normalizeAdminAction(readString(log, "action")),
    beforeJson: readRecord(log.beforeJson || log.before_json),
    afterJson: readRecord(log.afterJson || log.after_json),
    reason: readString(log, "reason"),
    createdAt: readString(log, "createdAt") || readString(log, "created_at") || new Date().toISOString(),
  };
}

function inferAdminAction(
  preferred: AdminActionType,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): AdminActionType {
  if (preferred === "UPDATE_ROLE") return "UPDATE_ROLE";
  if (preferred === "EXTEND_ACCESS") return "EXTEND_ACCESS";
  if (preferred === "BLOCK_USER" || readString(after, "subscriptionStatus") === "blocked") return "BLOCK_USER";
  if (preferred === "UNBLOCK_USER") return "UNBLOCK_USER";
  if (readString(after, "subscriptionStatus") === "manual_vip") return "MANUAL_VIP_GRANTED";
  if (readString(after, "subscriptionStatus") === "canceled") return "CANCEL_ACCESS";
  if (readString(before, "currentPeriodEnd") !== readString(after, "currentPeriodEnd")) return "UPDATE_EXPIRATION_DATE";
  if (readString(before, "plan") !== readString(after, "plan")) return "UPDATE_PLAN";
  if (readString(before, "subscriptionStatus") !== readString(after, "subscriptionStatus"))
    return "UPDATE_SUBSCRIPTION_STATUS";
  return preferred;
}

function mapClientPlanToAdminPlan(plan: string, status: string): AdminManagedUserPlan {
  const cleanPlan = plan.toLowerCase();
  const cleanStatus = status.toLowerCase();
  if (cleanStatus === "trial") return "trial";
  if (cleanStatus === "manual_vip") return "vip_manual";
  if (cleanPlan === "vip") return "premium";
  if (cleanPlan === "premium") return "premium";
  return "free";
}

function mapAdminPlanToClientPlan(plan: AdminManagedUserPlan): BillingPlanId {
  if (plan === "premium" || plan === "monthly") return "premium";
  if (plan === "vip_manual") return "vip";
  return "free";
}

function mapClientStatusToAdminStatus(client: Record<string, unknown>): AdminSubscriptionStatus {
  const status = readString(client, "access_status").toLowerCase();
  if (Boolean(client.isBlocked) || Boolean(client.is_blocked) || status === "blocked") return "blocked";
  if (status === "manual_vip") return "manual_vip";
  if (status === "trial") return "trial";
  if (status === "canceled" || status === "cancelled") return "canceled";
  if (isExpiredIso(readString(client, "expires_at"))) return "expired";
  if (Boolean(client.enabled) || status === "approved" || status === "active") return "active";
  return "expired";
}

function normalizeManagedUserRole(value: unknown): AdminManagedUserRole {
  const text = String(value || "user")
    .trim()
    .toLowerCase();
  if (text === "owner") return "owner";
  if (text === "admin" || text === "approver") return "admin";
  return "user";
}

function normalizeAdminPlan(value: unknown): AdminManagedUserPlan {
  const text = String(value || "free")
    .trim()
    .toLowerCase();
  if (text === "trial" || text === "monthly" || text === "premium" || text === "vip_manual") return text;
  if (text === "vip") return "premium";
  return "free";
}

function normalizeAdminSubscriptionStatus(value: unknown): AdminSubscriptionStatus {
  const text = String(value || "expired")
    .trim()
    .toLowerCase();
  if (
    text === "trial" ||
    text === "active" ||
    text === "expired" ||
    text === "canceled" ||
    text === "blocked" ||
    text === "manual_vip"
  )
    return text;
  if (text === "cancelled") return "canceled";
  if (text === "approved") return "active";
  if (text === "paused") return "blocked";
  return "expired";
}

function normalizeAdminAction(value: string): AdminActionType {
  const actions: AdminActionType[] = [
    "UPDATE_USER",
    "UPDATE_PLAN",
    "UPDATE_SUBSCRIPTION_STATUS",
    "EXTEND_ACCESS",
    "BLOCK_USER",
    "UNBLOCK_USER",
    "UPDATE_ROLE",
    "UPDATE_EXPIRATION_DATE",
    "MANUAL_VIP_GRANTED",
    "CANCEL_ACCESS",
    "REACTIVATE_USER",
    "DELETE_USER",
  ];
  return actions.includes(value as AdminActionType) ? (value as AdminActionType) : "UPDATE_USER";
}

function adminActorEmailFromRequest(request: Request, env: unknown, role: AdminRole) {
  const token = getBearerToken(request);
  const payload = decodeJwtPayload(token);
  return readString(payload, "email").toLowerCase() || role;
}

function decodeJwtPayload(token: string) {
  try {
    const payload = token.split(".")[1];
    if (!payload) return {};
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return readRecord(JSON.parse(atob(padded)));
  } catch {
    return {};
  }
}

function isAdminOwnerEmailForEnv(env: unknown, email: string) {
  return getAdminEmails(env).includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

function isAdminApproverEmailForEnv(env: unknown, email: string) {
  return getAdminApproverEmails(env).includes(
    String(email || "")
      .trim()
      .toLowerCase(),
  );
}

function latestAccessEvent(email: string) {
  return liveAccessEvents.find((item) => readString(item, "email").toLowerCase() === email.toLowerCase());
}

function latestAccessIso(email: string) {
  const event = latestAccessEvent(email);
  return event ? readString(event, "created_at") : "";
}

function latestAccessLabel(email: string) {
  const event = latestAccessEvent(email);
  return event ? relativeTimeFromIso(readString(event, "created_at")) : "Sem registro";
}

function relativeTimeFromIso(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "ha pouco";
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;
  const days = Math.floor(hours / 24);
  return `ha ${days} dias`;
}

function mockAdminManagedUsers() {
  return [
    {
      id: "1",
      name: "Gabriel",
      email: "gabriel@email.com",
      role: "owner",
      plan: "premium",
      subscriptionStatus: "manual_vip",
      currentPeriodStart: "2026-06-01T10:00:00Z",
      currentPeriodEnd: "2026-06-30T23:59:59Z",
      isBlocked: false,
      adminNote: "Mock inicial.",
      createdAt: "2026-06-01T10:00:00Z",
      lastAccess: "ha 5 min",
    },
    {
      id: "2",
      name: "Cliente Teste",
      email: "cliente@email.com",
      role: "user",
      plan: "monthly",
      subscriptionStatus: "active",
      currentPeriodStart: "2026-06-01T12:00:00Z",
      currentPeriodEnd: "2026-06-15T23:59:59Z",
      isBlocked: false,
      adminNote: "",
      createdAt: "2026-06-01T12:00:00Z",
      lastAccess: "ha 2 horas",
    },
    {
      id: "3",
      name: "Usuario Vencido",
      email: "vencido@email.com",
      role: "user",
      plan: "monthly",
      subscriptionStatus: "expired",
      currentPeriodStart: "2026-05-01T12:00:00Z",
      currentPeriodEnd: "2026-05-01T23:59:59Z",
      isBlocked: false,
      adminNote: "",
      createdAt: "2026-05-01T12:00:00Z",
      lastAccess: "ha 3 dias",
    },
    {
      id: "4",
      name: "Usuario Bloqueado",
      email: "bloqueado@email.com",
      role: "user",
      plan: "premium",
      subscriptionStatus: "blocked",
      currentPeriodStart: "2026-05-20T12:00:00Z",
      currentPeriodEnd: "2026-07-01T23:59:59Z",
      isBlocked: true,
      adminNote: "",
      createdAt: "2026-05-20T12:00:00Z",
      lastAccess: "ha 7 dias",
    },
  ];
}

function uniquePeople(records: Array<Record<string, unknown>>) {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    const key = readString(record, "email").toLowerCase() || readString(record, "id");
    if (!key) continue;
    byKey.set(key, { ...(byKey.get(key) || {}), ...record });
  }
  return [...byKey.values()];
}

function buildLocationBreakdown(records: Array<Record<string, unknown>>, field: "city" | "country") {
  const counts = new Map<string, number>();
  for (const record of records) {
    const label = readString(record, field) || "Nao informado";
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function upsertRecipientFromClient(client: Record<string, unknown>) {
  if (isEntityDeleted(client)) return false;
  const email = readString(client, "email").toLowerCase();
  if (!email) return false;
  const existingIndex = liveRecipients.findIndex((recipient) => readString(recipient, "email").toLowerCase() === email);
  const recipient = normalizeRecipient({
    ...(existingIndex >= 0 ? liveRecipients[existingIndex] : {}),
    name: readString(client, "full_name") || email,
    full_name: readString(client, "full_name") || email,
    email,
    phone: readString(client, "phone"),
    phone_full: readString(client, "phone_full") || readString(client, "phoneFull"),
    city: readString(client, "city"),
    country: readString(client, "country"),
    country_code: readString(client, "country_code") || readString(client, "countryCode"),
    enabled: Boolean(client.enabled),
    plan: readString(client, "plan") || "free",
    access_status: readString(client, "access_status") || "pending",
    starts_at: readString(client, "starts_at") || todayIso(),
    validity_days: Number(client.validity_days || 30),
    expires_at: readString(client, "expires_at"),
  });

  liveRecipients =
    existingIndex >= 0
      ? liveRecipients.map((item, index) => (index === existingIndex ? recipient : item))
      : [...liveRecipients, recipient];
  return true;
}

function upsertClientFromRecipient(recipient: Record<string, unknown>) {
  if (isEntityDeleted(recipient)) return;
  const email = readString(recipient, "email").toLowerCase();
  if (!email) return;
  const existingIndex = liveClients.findIndex((client) => readString(client, "email").toLowerCase() === email);
  const client = {
    ...(existingIndex >= 0 ? liveClients[existingIndex] : {}),
    full_name: readString(recipient, "full_name") || readString(recipient, "name") || email,
    email,
    phone: readString(recipient, "phone"),
    phone_full: readString(recipient, "phone_full") || readString(recipient, "phoneFull"),
    city: readString(recipient, "city"),
    country: readString(recipient, "country"),
    country_code: readString(recipient, "country_code") || readString(recipient, "countryCode"),
    plan: readString(recipient, "plan") || "free",
    access_status: readString(recipient, "access_status") || "pending",
    enabled: Boolean(recipient.enabled),
    starts_at: readString(recipient, "starts_at"),
    validity_days: Number(recipient.validity_days || 30),
    expires_at: readString(recipient, "expires_at"),
    ...(readString(recipient, "password_hash") || readString(recipient, "passwordHash")
      ? {
          password_hash: readString(recipient, "password_hash") || readString(recipient, "passwordHash"),
        }
      : {}),
    ...(readString(recipient, "password") ? { password: readString(recipient, "password") } : {}),
    created_at: readString(recipient, "created_at") || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  liveClients =
    existingIndex >= 0
      ? liveClients.map((item, index) => (index === existingIndex ? client : item))
      : [...liveClients, client];
}

async function updateClientPasswordFromBody(clientHint: Record<string, unknown>, body: Record<string, unknown>) {
  const password = readString(body, "password") || readString(body, "new_password");
  if (!password) return false;

  const id = readString(clientHint, "id");
  const email = readString(clientHint, "email").toLowerCase();
  const clientIndex = liveClients.findIndex((client) => {
    const sameId = id && readString(client, "id") === id;
    const sameEmail = email && readString(client, "email").toLowerCase() === email;
    return sameId || sameEmail;
  });
  if (clientIndex === -1) return false;

  const passwordHash = await hashPassword(password);
  liveClients = liveClients.map((client, index) =>
    index === clientIndex
      ? removeLegacyPassword({
          ...client,
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        })
      : client,
  );
  return true;
}

function removeLegacyPassword(client: Record<string, unknown>) {
  const updated = { ...client };
  delete updated.password;
  return updated;
}

function syncRecipientsFromClients() {
  let changed = false;
  for (const client of liveClients) {
    const before = JSON.stringify(liveRecipients);
    const didSync = upsertRecipientFromClient(client);
    changed = changed || (didSync && before !== JSON.stringify(liveRecipients));
  }
  return changed;
}

function isExpiredIso(value: string) {
  if (!value) return false;
  const clean = value.trim();
  const expiration = new Date(clean.includes("T") ? clean : `${clean}T23:59:59`);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration.getTime() < Date.now();
}

function readString(record: Record<string, unknown> | unknown, key?: string) {
  if (typeof key === "string") return String((record as Record<string, unknown>)?.[key] || "").trim();
  return String(record || "").trim();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function readBooleanField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return ["1", "true", "sim", "yes", "on", "approved", "active"].includes(text);
}

function parseEmailList(value: unknown) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,;\s]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Administrador";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(startIso: string, days: number) {
  const clean = startIso.trim();
  const hasTime = clean.includes("T");
  const date = new Date(hasTime ? clean : `${clean}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + Math.max(0, Math.floor(Number(days) || 0)));
    return hasTime ? fallback.toISOString() : fallback.toISOString().slice(0, 10);
  }
  date.setDate(date.getDate() + Math.max(0, Math.floor(Number(days) || 0)));
  return hasTime ? date.toISOString() : date.toISOString().slice(0, 10);
}

function normalizeDateInputIso(value: unknown, endOfDay = false) {
  const text = String(value || "").trim();
  if (!text) return "";

  const brDate = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (brDate) {
    const day = Number(brDate[1]);
    const month = Number(brDate[2]);
    const year = Number(brDate[3].length === 2 ? `20${brDate[3]}` : brDate[3]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020) {
      return new Date(
        Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0),
      ).toISOString();
    }
  }

  const isoDateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const year = Number(isoDateOnly[1]);
    const month = Number(isoDateOnly[2]);
    const day = Number(isoDateOnly[3]);
    return new Date(
      Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0),
    ).toISOString();
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    if (endOfDay && !text.includes("T")) {
      parsed.setUTCHours(23, 59, 59, 0);
    }
    return parsed.toISOString();
  }

  return "";
}

function readFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = readString(record, key);
    if (value) return value;
  }
  return "";
}

function readFirstPositiveNumber(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (!Object.hasOwn(record, key)) continue;
    const value = Number(record[key]);
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return 0;
}

function planDurationDaysForAdminPlan(plan: AdminManagedUserPlan) {
  if (plan === "vip_manual") return 3650;
  if (plan === "trial") return 7;
  if (plan === "premium" || plan === "monthly") return 30;
  return 0;
}

function daysBetweenIso(startIso: string, endIso: string, fallback = 0) {
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return fallback;
  return Math.max(1, Math.ceil((end - start) / 86_400_000));
}

function addMinutesIso(startIso: string, minutes: number) {
  const date = new Date(startIso.trim() || new Date().toISOString());
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  safeDate.setMinutes(safeDate.getMinutes() + Math.max(0, Math.floor(Number(minutes) || 0)));
  return safeDate.toISOString();
}

function freeTrialMinutes(env: unknown) {
  return Math.max(1, Math.floor(readServerNumber(env, "SNIPER_FREE_TRIAL_MINUTES", FREE_TRIAL_MINUTES)));
}

function getLiveStateCache() {
  return (globalThis as { caches?: WorkerCacheStorage }).caches?.default || null;
}

function liveStateCacheRequest() {
  return new Request(LIVE_STATE_CACHE_URL, { method: "GET" });
}

async function loadLiveState(env: unknown) {
  const now = Date.now();
  if (liveStateLoadedAt && now - liveStateLoadedAt < LIVE_STATE_LOAD_MIN_INTERVAL_MS) {
    return;
  }
  if (liveStateLoadPromise) {
    await liveStateLoadPromise;
    return;
  }

  liveStateLoadPromise = loadLiveStateFresh(env).finally(() => {
    liveStateLoadPromise = null;
  });
  await liveStateLoadPromise;
}

async function syncDashboardReadState(env: unknown) {
  const durableState = await loadDurableLiveState(env);
  const durableDashboard = readRecord(durableState?.dashboard);
  if (!hasRecordFields(durableDashboard)) return;
  if (compareDashboardStateFreshness(durableDashboard, liveDashboardData as unknown as Record<string, unknown>) > 0) {
    liveDashboardData = restoreDashboardData(durableDashboard);
  }
}
async function loadLiveStateFresh(env: unknown) {
  const currentSalesSettings = liveSalesSettings;
  const currentSiteContentSettings = liveSiteContentSettings;
  try {
    const [durableState, cacheState] = await withTimeout(
      Promise.all([loadDurableLiveState(env), loadLiveStateCache()]),
      LIVE_STATE_IO_TIMEOUT_MS,
      "carregar estado vivo",
      [null, null] as [Record<string, unknown> | null, Record<string, unknown> | null],
    );
    const state = mergeLiveStates(durableState, cacheState);
    if (state) {
      const shouldPersistRecoveredRegistry = shouldPersistRecoveredClientRegistry(env, durableState, cacheState, state);
      applyLiveState(state);
      if (isSalesSettingsNewer(currentSalesSettings, liveSalesSettings)) {
        liveSalesSettings = currentSalesSettings;
      }
      if (isSiteContentSettingsNewer(currentSiteContentSettings, liveSiteContentSettings)) {
        liveSiteContentSettings = currentSiteContentSettings;
      }
      const recoveredFromBillingUsers = await recoverEmptyClientRegistryFromBillingUsers(env, state);
      if (shouldPersistRecoveredRegistry || recoveredFromBillingUsers) {
        void saveLiveState(env);
      }
    }
  } finally {
    liveStateLoadedAt = Date.now();
  }
}

function shouldPersistRecoveredClientRegistry(
  env: unknown,
  durableState: Record<string, unknown> | null,
  cacheState: Record<string, unknown> | null,
  mergedState: Record<string, unknown>,
) {
  if (!getSupabasePersistenceConfig(env)) return false;
  if (!cacheState) return false;

  const durableCount = clientRegistryProtectedCount(extractClientRegistryState(durableState || {}));
  const cacheCount = clientRegistryProtectedCount(extractClientRegistryState(cacheState));
  const mergedCount = clientRegistryProtectedCount(extractClientRegistryState(mergedState));

  return cacheCount > 0 && mergedCount >= cacheCount && durableCount < cacheCount;
}

async function recoverEmptyClientRegistryFromBillingUsers(env: unknown, loadedState: Record<string, unknown>) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const loadedCount = clientRegistryProtectedCount(extractClientRegistryState(loadedState));
  if (loadedCount > 0) return false;

  const currentCount = clientRegistryProtectedCount(extractClientRegistryState(buildLiveStateSnapshot(env)));
  if (currentCount > 0) return false;

  const hydrated = await hydrateClientsFromBillingUsers(env);
  if (hydrated) {
    console.warn("Cadastro reconstruido a partir da tabela users apos estado vivo vazio.");
  }
  return hydrated;
}

async function loadLiveStateCache() {
  const cache = getLiveStateCache();
  if (!cache) return null;

  try {
    const response = await withTimeout(
      cache.match(liveStateCacheRequest()),
      LIVE_STATE_IO_TIMEOUT_MS,
      "carregar cache de estado vivo",
      undefined,
    );
    if (!response) return null;

    return readRecord(await response.json().catch(() => null));
  } catch (error) {
    console.warn("Nao foi possivel carregar estado vivo do cache.", error);
    return null;
  }
}

function applyLiveState(state: Record<string, unknown>) {
  const dashboard = readRecord(state.dashboard);
  if (Object.keys(dashboard).length > 0) {
    liveDashboardData = restoreDashboardData(dashboard);
  }

  if (Array.isArray(state.validatorRoundHistory)) {
    liveValidatorRoundHistory = normalizeStoredRoundHistory(state.validatorRoundHistory);
  }

  const deletedPatternRefs = normalizeValidatorPatternDeletedRefs(state.validatorPatternDeletedRefs);
  if (deletedPatternRefs.length) liveValidatorPatternDeletedRefs = deletedPatternRefs;
  const deletedChannelRefs = normalizeValidatorChannelDeletedRefs(state.validatorChannelDeletedRefs);
  if (deletedChannelRefs.length) liveValidatorChannelDeletedRefs = deletedChannelRefs;
  const deletedChannelLookup = createValidatorChannelDeletedRefLookup(deletedChannelRefs);

  if (Array.isArray(state.validatorPatterns)) {
    liveValidatorPatterns = state.validatorPatterns
      .map((pattern) => normalizeServerSavedPattern(pattern, readString(readRecord(pattern), "userId")))
      .filter((pattern): pattern is SavedValidatorPattern => Boolean(pattern))
      .filter((pattern) => !isValidatorPatternDeleted(pattern, deletedPatternRefs));
  }

  // Telegram channels are isolated in dedicated channel storage. Do not hydrate
  // them from the broad live-state snapshot, otherwise deleted channels can
  // return from an older cache/durable payload.
  const validatorChannelStore = readRecord(state.validatorChannelStore);
  if (Array.isArray(validatorChannelStore.channels)) {
    liveValidatorChannels = validatorChannelStore.channels
      .map((channel) => normalizeServerNotificationChannel(channel, readString(readRecord(channel), "userId")))
      .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel))
      .filter((channel) => !isValidatorChannelDeleted(channel, deletedChannelLookup));
  }

  if (Array.isArray(state.validatorNotifications)) {
    liveValidatorNotifications = state.validatorNotifications
      .map(readRecord)
      .filter((entry) => Object.keys(entry).length > 0)
      .slice(0, 1000);
  }

  const calendarVersion = readString(state, "neuralCalendarVersion");
  liveNeuralCalendarStorageVersion = NEURAL_CALENDAR_AGGREGATE_VERSION;
  if (calendarVersion === NEURAL_CALENDAR_AGGREGATE_VERSION) {
    applyStoredNeuralCalendarStats(state);

    const calendarKeys = readRecord(state.neuralCalendarCountedRoundKeys);
    if (Object.keys(calendarKeys).length > 0) {
      liveNeuralCalendarCountedRoundKeys = pruneNeuralCalendarCountedKeys(
        Object.keys(calendarKeys).reduce<Record<string, true>>((acc, key) => {
          if (calendarKeys[key]) acc[key] = true;
          return acc;
        }, {}),
      );
    }
  } else {
    liveNeuralCalendarCountedRoundKeys = {};
    neuralCalendarHydratedFromTables = false;
  }
  applyStoredEngineCalendarStats(state);
  applyStoredEngineCalendarBackfillKeys(state);

  if (Array.isArray(state.recipients)) {
    liveRecipients = state.recipients.map(readRecord).filter((recipient) => Object.keys(recipient).length > 0);
  }

  if (Array.isArray(state.clients)) {
    liveClients = state.clients
      .map((client) => removeLegacyPassword(readRecord(client)))
      .filter((client) => Object.keys(client).length > 0);
  }

  if (Array.isArray(state.accessEvents)) {
    liveAccessEvents = state.accessEvents
      .map(readRecord)
      .filter((event) => Object.keys(event).length > 0)
      .slice(0, 200);
  }

  if (Array.isArray(state.subscriptions)) {
    liveSubscriptions = state.subscriptions
      .map(readRecord)
      .filter((subscription) => Object.keys(subscription).length > 0)
      .slice(0, 500);
  }

  if (Array.isArray(state.payments)) {
    livePayments = state.payments
      .map(readRecord)
      .filter((payment) => Object.keys(payment).length > 0)
      .slice(0, 1000);
  }

  if (Array.isArray(state.adminUsers)) {
    liveAdminUsers = state.adminUsers.map(readRecord).filter((user) => Object.keys(user).length > 0);
  }

  if (Array.isArray(state.adminActionLogs)) {
    liveAdminActionLogs = state.adminActionLogs
      .map(readRecord)
      .filter((log) => Object.keys(log).length > 0)
      .slice(0, 500);
  }

  if (Array.isArray(state.deletedEntities)) {
    liveDeletedEntities = state.deletedEntities
      .map(readRecord)
      .filter((entry) => Object.keys(entry).length > 0)
      .slice(0, 1000);
  }

  applyDeletedEntityTombstones();

  const moduleToggles = readRecord(state.moduleToggles);
  if (Object.keys(moduleToggles).length > 0) {
    liveModuleToggles = restoreModuleToggles(moduleToggles);
    liveDashboardData = { ...liveDashboardData, moduleToggles: liveModuleToggles };
  }

  const salesSettings = readRecord(state.salesSettings);
  if (Object.keys(salesSettings).length > 0) {
    liveSalesSettings = restoreSalesSettings(salesSettings);
  }

  const siteContent = readRecord(state.siteContent);
  if (Object.keys(siteContent).length > 0) {
    liveSiteContentSettings = restoreSiteContentSettings(siteContent);
  }

  const localAiSettings = readRecord(state.localAiSettings);
  if (Object.keys(localAiSettings).length > 0) {
    liveLocalAiSettings = normalizeLocalAiSettingsPatch(localAiSettings, getLocalAiSettings({}));
  }

  if (Array.isArray(state.localAiLogs)) {
    liveLocalAiLogs = state.localAiLogs
      .map(readRecord)
      .filter((log) => Object.keys(log).length > 0)
      .slice(0, 250) as LocalAiLog[];
  }
}

function applyStoredNeuralCalendarStats(state: Record<string, unknown>) {
  const dailyStats = parseStoredNeuralCalendarDailyStats(state.neuralCalendarDailyStats);
  if (dailyStats.length) {
    liveNeuralCalendarDailyStats = mergeNeuralCalendarDailyStats([...liveNeuralCalendarDailyStats, ...dailyStats]);
  }

  const hourlyStats = parseStoredNeuralCalendarHourlyStats(state.neuralCalendarHourlyStats);
  if (hourlyStats.length) {
    liveNeuralCalendarHourlyStats = mergeNeuralCalendarHourlyStats([...liveNeuralCalendarHourlyStats, ...hourlyStats]);
  }
}

function applyStoredEngineCalendarStats(state: Record<string, unknown>) {
  const hourlyStats = parseStoredEngineCalendarStats(state.engineHourlyStats, "hourly");
  if (hourlyStats.length) {
    liveEngineHourlyStats = mergeEngineCalendarAggregateStats([...liveEngineHourlyStats, ...hourlyStats]);
  }

  const dailyStats = parseStoredEngineCalendarStats(state.engineDailyStats, "daily");
  if (dailyStats.length) {
    liveEngineDailyStats = mergeEngineCalendarAggregateStats([...liveEngineDailyStats, ...dailyStats]);
  }

  const weeklyStats = parseStoredEngineCalendarStats(state.engineWeeklyStats, "weekly");
  if (weeklyStats.length) {
    liveEngineWeeklyStats = mergeEngineCalendarAggregateStats([...liveEngineWeeklyStats, ...weeklyStats]);
  }

  const monthlyStats = parseStoredEngineCalendarStats(state.engineMonthlyStats, "monthly");
  if (monthlyStats.length) {
    liveEngineMonthlyStats = mergeEngineCalendarAggregateStats([...liveEngineMonthlyStats, ...monthlyStats]);
  }

  const yearlyStats = parseStoredEngineCalendarStats(state.engineYearlyStats, "yearly");
  if (yearlyStats.length) {
    liveEngineYearlyStats = mergeEngineCalendarAggregateStats([...liveEngineYearlyStats, ...yearlyStats]);
  }
}

function applyStoredEngineCalendarBackfillKeys(state: Record<string, unknown>) {
  const engineBackfillKeys = readRecord(state.engineCalendarBackfillKeys);
  if (Object.keys(engineBackfillKeys).length > 0) {
    liveEngineCalendarBackfillKeys = pruneEngineCalendarBackfillKeys({
      ...liveEngineCalendarBackfillKeys,
      ...Object.keys(engineBackfillKeys).reduce<Record<string, true>>((acc, key) => {
        if (engineBackfillKeys[key]) acc[key] = true;
        return acc;
      }, {}),
    });
  }
}

function parseStoredNeuralCalendarDailyStats(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => neuralCalendarDailyFromRow(readRecord(row)))
    .filter((row): row is NeuralCalendarDailyStat => Boolean(row));
}

function parseStoredNeuralCalendarHourlyStats(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => neuralCalendarHourlyFromRow(readRecord(row)))
    .filter((row): row is NeuralCalendarHourlyStat => Boolean(row));
}

function parseStoredEngineCalendarStats(value: unknown, kind: EngineCalendarAggregateKind) {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => engineCalendarAggregateFromRow(readRecord(row), kind))
    .filter((row): row is EngineCalendarAggregateStat => Boolean(row));
}

function mergeLiveStates(durableState: Record<string, unknown> | null, cacheState: Record<string, unknown> | null) {
  if (!durableState && !cacheState) return null;
  const durable = durableState || {};
  const cache = cacheState || {};
  const durableSavedAt = stateSavedAtMs(durable);
  const cacheSavedAt = stateSavedAtMs(cache);
  const deletedEntities = mergeDeletedEntityStates(durable.deletedEntities, cache.deletedEntities).slice(0, 1000);
  const validatorPatternDeletedRefs = mergeValidatorPatternDeletedRefs(
    durable.validatorPatternDeletedRefs,
    cache.validatorPatternDeletedRefs,
  );
  const validatorChannelDeletedRefs = mergeValidatorChannelDeletedRefs(
    durable.validatorChannelDeletedRefs,
    cache.validatorChannelDeletedRefs,
  );
  return {
    ...cache,
    ...durable,
    dashboard: pickDashboardState(durable.dashboard, cache.dashboard),
    validatorRoundHistory: mergeMonitorRoundHistory(
      normalizeStoredRoundHistory(cache.validatorRoundHistory),
      normalizeStoredRoundHistory(durable.validatorRoundHistory),
    ),
    validatorPatterns: mergeEntityStateArrays(
      durable.validatorPatterns,
      cache.validatorPatterns,
      durableSavedAt,
      cacheSavedAt,
    ).filter((pattern) => !isValidatorPatternDeleted(readRecord(pattern), validatorPatternDeletedRefs)),
    validatorPatternDeletedRefs,
    validatorChannelDeletedRefs,
    validatorChannels: [],
    validatorChannelStore: pickStateObjectByUpdatedAt(durable.validatorChannelStore, cache.validatorChannelStore),
    validatorNotifications: mergeStateArrays(durable.validatorNotifications, cache.validatorNotifications).slice(
      0,
      1000,
    ),
    neuralCalendarDailyStats: mergeStateArrays(durable.neuralCalendarDailyStats, cache.neuralCalendarDailyStats),
    neuralCalendarHourlyStats: mergeStateArrays(durable.neuralCalendarHourlyStats, cache.neuralCalendarHourlyStats),
    engineHourlyStats: mergeStateArrays(durable.engineHourlyStats, cache.engineHourlyStats),
    engineDailyStats: mergeStateArrays(durable.engineDailyStats, cache.engineDailyStats),
    engineWeeklyStats: mergeStateArrays(durable.engineWeeklyStats, cache.engineWeeklyStats),
    engineMonthlyStats: mergeStateArrays(durable.engineMonthlyStats, cache.engineMonthlyStats),
    engineYearlyStats: mergeStateArrays(durable.engineYearlyStats, cache.engineYearlyStats),
    neuralCalendarCountedRoundKeys: {
      ...readRecord(cache.neuralCalendarCountedRoundKeys),
      ...readRecord(durable.neuralCalendarCountedRoundKeys),
    },
    recipients: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.recipients, cache.recipients, durableSavedAt, cacheSavedAt, true),
      deletedEntities,
    ),
    clients: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.clients, cache.clients, durableSavedAt, cacheSavedAt, true),
      deletedEntities,
    ),
    accessEvents: mergeStateArrays(durable.accessEvents, cache.accessEvents).slice(0, 200),
    subscriptions: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.subscriptions, cache.subscriptions, durableSavedAt, cacheSavedAt),
      deletedEntities,
    ).slice(0, 500),
    payments: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.payments, cache.payments, durableSavedAt, cacheSavedAt),
      deletedEntities,
    ).slice(0, 1000),
    adminUsers: filterDeletedEntityRows(
      mergeEntityStateArrays(durable.adminUsers, cache.adminUsers, durableSavedAt, cacheSavedAt, true),
      deletedEntities,
    ),
    adminActionLogs: mergeStateArrays(durable.adminActionLogs, cache.adminActionLogs).slice(0, 500),
    deletedEntities,
    moduleToggles: pickStateObject(durable.moduleToggles, cache.moduleToggles),
    salesSettings: pickStateObjectByUpdatedAt(durable.salesSettings, cache.salesSettings),
    siteContent: pickStateObjectByUpdatedAt(durable.siteContent, cache.siteContent),
    savedAt: readString(durable, "savedAt") || readString(cache, "savedAt") || new Date().toISOString(),
  };
}

function pickStateObject(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  if (Object.keys(first).length > 0) return first;
  return readRecord(secondary);
}

function pickStateObjectByUpdatedAt(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  const second = readRecord(secondary);
  if (!hasRecordFields(first)) return second;
  if (!hasRecordFields(second)) return first;

  const firstTime = stateEntityUpdatedAtMs(first);
  const secondTime = stateEntityUpdatedAtMs(second);
  return firstTime >= secondTime ? first : second;
}

function isSalesSettingsNewer(left: SalesSettings, right: SalesSettings) {
  const leftTime = stateEntityUpdatedAtMs(left as unknown as Record<string, unknown>);
  const rightTime = stateEntityUpdatedAtMs(right as unknown as Record<string, unknown>);
  if (leftTime || rightTime) return leftTime > rightTime;
  return left.salesClosed !== right.salesClosed && Boolean(left.updated_at);
}

function isSiteContentSettingsNewer(left: SiteContentSettings, right: SiteContentSettings) {
  const leftTime = stateEntityUpdatedAtMs(left as unknown as Record<string, unknown>);
  const rightTime = stateEntityUpdatedAtMs(right as unknown as Record<string, unknown>);
  if (leftTime || rightTime) return leftTime > rightTime;
  return left.popupId !== right.popupId && Boolean(left.updatedAt);
}

function pickDashboardState(primary: unknown, secondary: unknown) {
  const first = readRecord(primary);
  const second = readRecord(secondary);
  if (!hasRecordFields(first)) return second;
  if (!hasRecordFields(second)) return first;
  return compareDashboardStateFreshness(first, second) >= 0 ? first : second;
}

function compareDashboardStateFreshness(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftScore = dashboardStateFreshnessScore(left);
  const rightScore = dashboardStateFreshnessScore(right);
  for (let index = 0; index < leftScore.length; index += 1) {
    const diff = leftScore[index] - rightScore[index];
    if (diff !== 0) return diff;
  }
  return 0;
}

function dashboardStateFreshnessScore(state: Record<string, unknown>) {
  const cycleDate = currentDashboardCycleDate();
  const rounds = Array.isArray(state.rounds) ? state.rounds.map(readRecord) : [];
  const lastRound = rounds[rounds.length - 1] ?? {};
  const lastRoundId = Number(readString(lastRound, "id") || lastRound.id || 0) || 0;
  const updatedAtMs = Date.parse(readString(state, "updatedAt") || "");
  const hasCurrentCycle = readDashboardCycleDate(state) === cycleDate ? 1 : 0;
  const hasLiveRounds = rounds.length > 0 ? 1 : 0;
  return [hasCurrentCycle, hasLiveRounds, lastRoundId, Number.isFinite(updatedAtMs) ? updatedAtMs : 0, rounds.length];
}

function pickStateArray(primary: unknown, secondary: unknown) {
  const first = Array.isArray(primary) ? primary.map(readRecord).filter(hasRecordFields) : [];
  const second = Array.isArray(secondary) ? secondary.map(readRecord).filter(hasRecordFields) : [];
  return first.length >= second.length ? first : second;
}

function pickStateArrayByFreshness(
  primary: unknown,
  secondary: unknown,
  primarySavedAt: number,
  secondarySavedAt: number,
) {
  const first = Array.isArray(primary) ? primary.map(readRecord).filter(hasRecordFields) : [];
  const second = Array.isArray(secondary) ? secondary.map(readRecord).filter(hasRecordFields) : [];
  if (first.length === 0) return second;
  if (second.length === 0) return first;
  if (primarySavedAt || secondarySavedAt) {
    return primarySavedAt >= secondarySavedAt ? first : second;
  }
  return first.length >= second.length ? first : second;
}

function mergeStateArrays(primary: unknown, secondary: unknown) {
  const rows = [...pickStateArray(primary, []), ...pickStateArray(secondary, [])];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = readString(row, "id") || readString(row, "email").toLowerCase() || JSON.stringify(row);
    byKey.set(key, { ...(byKey.get(key) || {}), ...row });
  }
  return [...byKey.values()];
}

function mergeEntityStateArrays(
  primary: unknown,
  secondary: unknown,
  primarySavedAt: number,
  secondarySavedAt: number,
  preferEmailKey = false,
) {
  const rows = [
    ...pickStateArray(primary, []).map((row) => ({ row, sourceSavedAt: primarySavedAt })),
    ...pickStateArray(secondary, []).map((row) => ({ row, sourceSavedAt: secondarySavedAt })),
  ];
  const byKey = new Map<string, { row: Record<string, unknown>; sourceSavedAt: number }>();

  for (const item of rows) {
    const key = stateEntityKey(item.row, preferEmailKey);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const incomingIsNewer =
      compareStateEntityFreshness(item.row, item.sourceSavedAt, existing.row, existing.sourceSavedAt) >= 0;
    byKey.set(
      key,
      incomingIsNewer
        ? { row: mergeStateEntityRecord(existing.row, item.row), sourceSavedAt: item.sourceSavedAt }
        : {
            row: mergeStateEntityRecord(item.row, existing.row),
            sourceSavedAt: existing.sourceSavedAt,
          },
    );
  }

  return [...byKey.values()].map((item) => item.row);
}

function stateEntityKey(row: Record<string, unknown>, preferEmailKey = false) {
  if (preferEmailKey) {
    return readString(row, "email").toLowerCase() || readString(row, "id") || JSON.stringify(row);
  }

  return (
    readString(row, "id") ||
    readString(row, "provider_payment_id") ||
    readString(row, "external_reference") ||
    readString(row, "email").toLowerCase() ||
    JSON.stringify(row)
  );
}

function compareStateEntityFreshness(
  left: Record<string, unknown>,
  leftSourceSavedAt: number,
  right: Record<string, unknown>,
  rightSourceSavedAt: number,
) {
  const leftScore = [stateEntityUpdatedAtMs(left), leftSourceSavedAt];
  const rightScore = [stateEntityUpdatedAtMs(right), rightSourceSavedAt];
  for (let index = 0; index < leftScore.length; index += 1) {
    const diff = leftScore[index] - rightScore[index];
    if (diff !== 0) return diff;
  }
  return 0;
}

function stateEntityUpdatedAtMs(row: Record<string, unknown>) {
  const time = Date.parse(
    readString(row, "updated_at") ||
      readString(row, "updatedAt") ||
      readString(row, "created_at") ||
      readString(row, "createdAt") ||
      "",
  );
  return Number.isFinite(time) ? time : 0;
}

function mergeStateEntityRecord(base: Record<string, unknown>, preferred: Record<string, unknown>) {
  const merged = { ...base, ...preferred };
  for (const [key, value] of Object.entries(base)) {
    if (isBlankStateValue(merged[key]) && !isBlankStateValue(value)) {
      merged[key] = value;
    }
  }
  return merged;
}

function isBlankStateValue(value: unknown) {
  return value === undefined || value === null || value === "";
}

function mergeDeletedEntityStates(primary: unknown, secondary: unknown) {
  const rows = [...pickStateArray(primary, []), ...pickStateArray(secondary, [])];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = deletedEntityKey(row);
    const existing = byKey.get(key);
    if (!existing || deletedEntityTime(row) >= deletedEntityTime(existing)) {
      byKey.set(key, normalizeDeletedEntity(row));
    }
  }
  return [...byKey.values()];
}

function markEntityDeleted(row: Record<string, unknown>) {
  const deleted = normalizeDeletedEntity({
    id: readString(row, "id"),
    email: readString(row, "email").toLowerCase(),
    deleted_at: new Date().toISOString(),
  });
  if (!readString(deleted, "id") && !readString(deleted, "email")) return;

  liveDeletedEntities = [
    deleted,
    ...liveDeletedEntities.filter((entry) => !deletedEntitiesMatch(entry, deleted)),
  ].slice(0, 1000);
}

function removeUserEntityEverywhere(row: Record<string, unknown>) {
  liveRecipients = liveRecipients.filter((recipient) => !userEntityMatches(recipient, row));
  liveClients = liveClients.filter((client) => !userEntityMatches(client, row));
  liveAdminUsers = liveAdminUsers.filter((user) => !userEntityMatches(user, row));
  clearBillingStateForUser(row);
}

function clearBillingStateForUser(row: Record<string, unknown>) {
  liveSubscriptions = liveSubscriptions.filter((subscription) => !userEntityMatches(subscription, row));
  livePayments = livePayments.filter((payment) => !userEntityMatches(payment, row));
}

function userEntityMatches(row: Record<string, unknown>, target: Record<string, unknown>) {
  const targetId = readString(target, "id");
  const targetEmail = readString(target, "email").toLowerCase();
  const rowId = readString(row, "id");
  const rowUserId = readString(row, "user_id");
  const rowEmail = readString(row, "email").toLowerCase();
  return Boolean(
    (targetId && (rowId === targetId || rowUserId === targetId)) || (targetEmail && rowEmail === targetEmail),
  );
}

function clearDeletedEntityForRecord(row: Record<string, unknown>) {
  liveDeletedEntities = liveDeletedEntities.filter((entry) => !deletedEntitiesMatch(entry, row));
}

function applyDeletedEntityTombstones() {
  liveRecipients = filterDeletedEntityRows(liveRecipients);
  liveClients = filterDeletedEntityRows(liveClients);
  liveAdminUsers = filterDeletedEntityRows(liveAdminUsers);
  liveSubscriptions = filterDeletedEntityRows(liveSubscriptions);
  livePayments = filterDeletedEntityRows(livePayments);
}

function filterDeletedEntityRows(rows: Record<string, unknown>[], deletedEntities = liveDeletedEntities) {
  return rows.filter((row) => !isEntityDeleted(row, deletedEntities));
}

function isEntityDeleted(row: Record<string, unknown>, deletedEntities = liveDeletedEntities) {
  const rowTime = stateEntityUpdatedAtMs(row);
  return deletedEntities.some((entry) => {
    if (!deletedEntitiesMatch(entry, row)) return false;
    const deletedAt = deletedEntityTime(entry);
    return !rowTime || !deletedAt || rowTime <= deletedAt;
  });
}

function deletedEntitiesMatch(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftId = readString(left, "id");
  const rightId = readString(right, "id");
  const leftEmail = readString(left, "email").toLowerCase();
  const rightEmail = readString(right, "email").toLowerCase();
  return Boolean((leftId && rightId && leftId === rightId) || (leftEmail && rightEmail && leftEmail === rightEmail));
}

function normalizeDeletedEntity(row: Record<string, unknown>) {
  return {
    id: readString(row, "id"),
    email: readString(row, "email").toLowerCase(),
    deleted_at: readString(row, "deleted_at") || readString(row, "deletedAt") || new Date().toISOString(),
  };
}

function deletedEntityKey(row: Record<string, unknown>) {
  return readString(row, "email").toLowerCase() || readString(row, "id") || JSON.stringify(row);
}

function deletedEntityTime(row: Record<string, unknown>) {
  const time = Date.parse(readString(row, "deleted_at") || readString(row, "deletedAt") || "");
  return Number.isFinite(time) ? time : 0;
}

function hasRecordFields(record: Record<string, unknown>) {
  return Object.keys(record).length > 0;
}

function stateSavedAtMs(state: Record<string, unknown>) {
  const savedAt = Date.parse(readString(state, "savedAt") || "");
  return Number.isFinite(savedAt) ? savedAt : 0;
}

function buildLiveStateSnapshot(env?: unknown) {
  return {
    dashboard: liveDashboardData,
    validatorRoundHistory: liveValidatorRoundHistory.slice(-MAX_MONITOR_ROUND_HISTORY),
    validatorPatterns: liveValidatorPatterns.filter((pattern) => !isValidatorPatternDeleted(pattern)),
    validatorPatternDeletedRefs: liveValidatorPatternDeletedRefs.slice(0, 2000),
    validatorChannelDeletedRefs: liveValidatorChannelDeletedRefs.slice(0, 2000),
    validatorChannels: [],
    validatorChannelStore: {
      version: 1,
      channels: liveValidatorChannels.filter(
        (channel) => !isValidatorChannelDeleted(channel, createValidatorChannelDeletedRefLookup(liveValidatorChannelDeletedRefs)),
      ),
      updatedAt: new Date().toISOString(),
    },
    validatorNotifications: liveValidatorNotifications.slice(0, 1000),
    neuralCalendarVersion: NEURAL_CALENDAR_AGGREGATE_VERSION,
    neuralCalendarDailyStats: liveNeuralCalendarDailyStats,
    neuralCalendarHourlyStats: liveNeuralCalendarHourlyStats,
    engineHourlyStats: liveEngineHourlyStats,
    engineDailyStats: liveEngineDailyStats,
    engineWeeklyStats: liveEngineWeeklyStats,
    engineMonthlyStats: liveEngineMonthlyStats,
    engineYearlyStats: liveEngineYearlyStats,
    neuralCalendarCountedRoundKeys: liveNeuralCalendarCountedRoundKeys,
    engineCalendarBackfillKeys: liveEngineCalendarBackfillKeys,
    recipients: liveRecipients,
    clients: liveClients.map(removeLegacyPassword),
    accessEvents: liveAccessEvents,
    subscriptions: liveSubscriptions,
    payments: livePayments,
    adminUsers: liveAdminUsers,
    adminActionLogs: liveAdminActionLogs,
    deletedEntities: liveDeletedEntities,
    moduleToggles: liveModuleToggles,
    salesSettings: liveSalesSettings,
    siteContent: liveSiteContentSettings,
    localAiSettings: liveLocalAiSettings,
    localAiLogs: liveLocalAiLogs.slice(0, 250),
    savedAt: new Date().toISOString(),
  };
}

async function saveLiveState(env: unknown): Promise<LiveStateSaveStatus> {
  if (liveStateSavePromise) {
    liveStateSavePending = true;
    return liveStateSavePromise;
  }

  liveStateSavePending = false;
  liveStateSavePromise = (async () => {
    let status = await saveLiveStateNow(env);
    while (liveStateSavePending) {
      liveStateSavePending = false;
      status = await saveLiveStateNow(env);
    }
    return status;
  })().finally(() => {
    liveStateSavePromise = null;
    if (liveStateSavePending) void saveLiveState(env);
  });
  return liveStateSavePromise;
}

async function protectClientRegistryBeforeSave(
  env: unknown,
  state: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!getSupabasePersistenceConfig(env)) return state;

  let protectedState = protectedClientRegistryState
    ? mergeClientRegistryIntoState(state, protectedClientRegistryState)
    : state;
  const cachedCount = protectedClientRegistryState ? clientRegistryProtectedCount(protectedClientRegistryState) : 0;
  const currentCount = clientRegistryProtectedCount(protectedState);
  const shouldRefresh =
    !protectedClientRegistryState ||
    currentCount < cachedCount ||
    Date.now() - protectedClientRegistryLoadedAt > CLIENT_REGISTRY_PROTECTION_INTERVAL_MS;

  if (!shouldRefresh) return protectedState;

  const dailyId = clientRegistryDailySnapshotId();
  const [durableState, latestSnapshot, dailySnapshot] = await withTimeout(
    Promise.all([
      loadDurableLiveStateById(env, LIVE_STATE_ID),
      loadDurableLiveStateById(env, CLIENT_REGISTRY_SNAPSHOT_LATEST_ID),
      loadDurableLiveStateById(env, dailyId),
    ]),
    LIVE_STATE_IO_TIMEOUT_MS,
    "proteger cadastro de clientes",
    [null, null, null] as Array<Record<string, unknown> | null>,
  );

  for (const candidate of [durableState, latestSnapshot, dailySnapshot]) {
    if (candidate) protectedState = mergeClientRegistryIntoState(protectedState, candidate);
  }

  protectedClientRegistryState = extractClientRegistryState(protectedState);
  protectedClientRegistryLoadedAt = Date.now();
  return protectedState;
}

function extractClientRegistryState(state: Record<string, unknown>) {
  const deletedEntities = Array.isArray(state.deletedEntities)
    ? state.deletedEntities.map(readRecord).filter(hasRecordFields)
    : [];
  const registry = {
    snapshotType: "client_registry",
    recipients: filterDeletedEntityRows(pickStateArray(state.recipients, []), deletedEntities),
    clients: filterDeletedEntityRows(pickStateArray(state.clients, []).map(removeLegacyPassword), deletedEntities),
    subscriptions: filterDeletedEntityRows(pickStateArray(state.subscriptions, []), deletedEntities).slice(0, 500),
    payments: filterDeletedEntityRows(pickStateArray(state.payments, []), deletedEntities).slice(0, 1000),
    adminUsers: filterDeletedEntityRows(pickStateArray(state.adminUsers, []), deletedEntities),
    deletedEntities,
    savedAt: readString(state, "savedAt") || new Date().toISOString(),
  };
  return {
    ...registry,
    counts: {
      recipients: registry.recipients.length,
      clients: registry.clients.length,
      subscriptions: registry.subscriptions.length,
      payments: registry.payments.length,
      adminUsers: registry.adminUsers.length,
      deletedEntities: registry.deletedEntities.length,
    },
  };
}

function mergeClientRegistryIntoState(state: Record<string, unknown>, registryLike: Record<string, unknown>) {
  const stateSavedAt = stateSavedAtMs(state);
  const registry = extractClientRegistryState(registryLike);
  const registrySavedAt = stateSavedAtMs(registry);
  const deletedEntities = mergeDeletedEntityStates(state.deletedEntities, registry.deletedEntities).slice(0, 1000);

  return {
    ...state,
    deletedEntities,
    recipients: filterDeletedEntityRows(
      mergeEntityStateArrays(state.recipients, registry.recipients, stateSavedAt, registrySavedAt, true),
      deletedEntities,
    ),
    clients: filterDeletedEntityRows(
      mergeEntityStateArrays(state.clients, registry.clients, stateSavedAt, registrySavedAt, true),
      deletedEntities,
    ).map(removeLegacyPassword),
    subscriptions: filterDeletedEntityRows(
      mergeEntityStateArrays(state.subscriptions, registry.subscriptions, stateSavedAt, registrySavedAt),
      deletedEntities,
    ).slice(0, 500),
    payments: filterDeletedEntityRows(
      mergeEntityStateArrays(state.payments, registry.payments, stateSavedAt, registrySavedAt),
      deletedEntities,
    ).slice(0, 1000),
    adminUsers: filterDeletedEntityRows(
      mergeEntityStateArrays(state.adminUsers, registry.adminUsers, stateSavedAt, registrySavedAt, true),
      deletedEntities,
    ),
  };
}

function clientRegistryProtectedCount(state: Record<string, unknown>) {
  return (
    pickStateArray(state.clients, []).length +
    pickStateArray(state.subscriptions, []).length +
    pickStateArray(state.payments, []).length +
    pickStateArray(state.recipients, []).length +
    pickStateArray(state.adminUsers, []).length
  );
}

function applyClientRegistryState(registryLike: Record<string, unknown>, env?: unknown) {
  const merged = mergeClientRegistryIntoState(buildLiveStateSnapshot(env), registryLike);
  liveDeletedEntities = pickStateArray(merged.deletedEntities, []).slice(0, 1000);
  liveRecipients = filterDeletedEntityRows(pickStateArray(merged.recipients, []), liveDeletedEntities);
  liveClients = filterDeletedEntityRows(
    pickStateArray(merged.clients, []).map(removeLegacyPassword),
    liveDeletedEntities,
  );
  liveSubscriptions = filterDeletedEntityRows(pickStateArray(merged.subscriptions, []), liveDeletedEntities).slice(
    0,
    500,
  );
  livePayments = filterDeletedEntityRows(pickStateArray(merged.payments, []), liveDeletedEntities).slice(0, 1000);
  liveAdminUsers = filterDeletedEntityRows(pickStateArray(merged.adminUsers, []), liveDeletedEntities);
  protectedClientRegistryState = extractClientRegistryState(buildLiveStateSnapshot(env));
  protectedClientRegistryLoadedAt = Date.now();
}

async function maybeSaveClientRegistrySnapshot(env: unknown, state: Record<string, unknown>) {
  if (!getSupabasePersistenceConfig(env)) return false;
  const snapshot = extractClientRegistryState(state);
  const fingerprint = stableClientRegistryFingerprint(snapshot);
  const due =
    fingerprint !== clientRegistrySnapshotFingerprint ||
    Date.now() - clientRegistrySnapshotSavedAt > CLIENT_REGISTRY_SNAPSHOT_INTERVAL_MS;
  if (!due) return false;

  const savedAt = new Date().toISOString();
  const snapshotState = {
    ...snapshot,
    snapshotType: "client_registry",
    savedAt,
  };
  const dailyId = clientRegistryDailySnapshotId();
  const [latestResult, dailyResult] = await Promise.allSettled([
    saveDurableLiveStateById(env, CLIENT_REGISTRY_SNAPSHOT_LATEST_ID, snapshotState),
    saveDurableLiveStateById(env, dailyId, snapshotState),
  ]);

  const ok =
    latestResult.status === "fulfilled" &&
    latestResult.value === true &&
    dailyResult.status === "fulfilled" &&
    dailyResult.value === true;
  if (ok) {
    protectedClientRegistryState = snapshotState;
    protectedClientRegistryLoadedAt = Date.now();
    clientRegistrySnapshotSavedAt = Date.now();
    clientRegistrySnapshotFingerprint = fingerprint;
  }
  return ok;
}

function stableClientRegistryFingerprint(state: Record<string, unknown>) {
  const parts = ["clients", "subscriptions", "payments", "recipients", "adminUsers"].map((key) => {
    const rows = pickStateArray(state[key], [])
      .map((row) => `${stateEntityKey(row, true)}:${stateEntityUpdatedAtMs(row)}`)
      .sort();
    return `${key}:${rows.join("|")}`;
  });
  const deleted = pickStateArray(state.deletedEntities, [])
    .map((row) => `${deletedEntityKey(row)}:${deletedEntityTime(row)}`)
    .sort();
  return [...parts, `deleted:${deleted.join("|")}`].join(";");
}

function clientRegistryDailySnapshotId() {
  return `${CLIENT_REGISTRY_SNAPSHOT_PREFIX}${currentDashboardCycleDate()}`;
}

async function saveLiveStateNow(env: unknown): Promise<LiveStateSaveStatus> {
  const state = await protectClientRegistryBeforeSave(env, buildLiveStateSnapshot(env));
  const durableConfigured = Boolean(getSupabasePersistenceConfig(env));
  const [durableResult, cacheResult, clientBackupResult] = await Promise.allSettled([
    saveDurableLiveState(env, state),
    saveLiveStateCache(state),
    maybeSaveClientRegistrySnapshot(env, state),
  ]);
  liveStateSaveStatus = {
    durable: durableResult.status === "fulfilled" && durableResult.value === true,
    cache: cacheResult.status === "fulfilled" && cacheResult.value === true,
    clientBackup: clientBackupResult.status === "fulfilled" && clientBackupResult.value === true,
    durableConfigured,
    saved_at: new Date().toISOString(),
  };
  liveStateLoadedAt = Date.now();
  return liveStateSaveStatus;
}

async function saveLiveStateCache(state: Record<string, unknown>) {
  const cache = getLiveStateCache();
  if (!cache) return false;

  try {
    await cache.put(
      liveStateCacheRequest(),
      new Response(JSON.stringify(state), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, no-cache, must-revalidate",
          pragma: "no-cache",
        },
      }),
    );
    return true;
  } catch (error) {
    console.warn("Nao foi possivel salvar estado vivo no cache.", error);
    return false;
  }
}

async function loadDurableLiveState(env: unknown) {
  return loadDurableLiveStateById(env, LIVE_STATE_ID);
}

async function loadDurableLiveStateById(env: unknown, id: string) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_STATE_IO_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${config.url}/rest/v1/${LIVE_STATE_TABLE}?id=eq.${encodeURIComponent(id)}&select=state`,
      {
        headers: supabasePersistenceHeaders(config.key),
        signal: controller.signal,
      },
    );
    if (response.status === 404 || response.status === 406) return null;
    if (!response.ok) {
      console.warn(`Estado duravel indisponivel (${response.status}).`);
      return null;
    }

    const rows = await response.json().catch(() => null);
    const row = Array.isArray(rows) ? readRecord(rows[0]) : readRecord(rows);
    const state = readRecord(row.state);
    return Object.keys(state).length > 0 ? state : null;
  } catch (error) {
    console.warn("Nao foi possivel carregar estado duravel.", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function saveDurableLiveState(env: unknown, state: Record<string, unknown>) {
  return saveDurableLiveStateById(env, LIVE_STATE_ID, state);
}

async function saveDurableLiveStateById(env: unknown, id: string, state: Record<string, unknown>) {
  const config = getSupabasePersistenceConfig(env);
  if (!config) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LIVE_STATE_IO_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.url}/rest/v1/${LIVE_STATE_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...supabasePersistenceHeaders(config.key),
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id,
        state,
        updated_at: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`Nao foi possivel salvar estado duravel (${response.status}).`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn("Nao foi possivel salvar estado duravel.", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timeout = setTimeout(() => {
      console.warn(`${label} excedeu ${timeoutMs}ms; seguindo com fallback.`);
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } catch (error) {
    console.warn(`${label} falhou.`, error);
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function getSupabasePersistenceConfig(env: unknown) {
  const urls = [
    readNamedServerSecret(env, "SNIPER_SUPABASE_URL", ""),
    readNamedServerSecret(env, "SUPABASE_URL", ""),
    readNamedServerSecret(env, "VITE_SUPABASE_URL", ""),
  ]
    .map((value) => value.replace(/\/+$/, ""))
    .filter(Boolean);
  const keys = [
    readNamedServerSecret(env, "SNIPER_SUPABASE_SERVICE_ROLE_KEY", ""),
    readNamedServerSecret(env, "SNIPER_SUPABASE_SERVICE_KEY", ""),
    readNamedServerSecret(env, "SUPABASE_SERVICE_ROLE_KEY", ""),
    readNamedServerSecret(env, "SUPABASE_SERVICE_KEY", ""),
  ].filter(Boolean);

  for (const url of urls) {
    for (const key of keys) {
      if (supabaseConfigPairMatches(url, key)) return { url, key };
    }
  }

  if (urls.length && keys.length) {
    console.warn("Supabase URL e service key parecem pertencer a projetos diferentes.");
  }
  return null;
}

function supabaseConfigPairMatches(url: string, key: string) {
  const urlRef = supabaseProjectRefFromUrl(url);
  const keyRef = supabaseProjectRefFromJwt(key);
  if (urlRef && keyRef && urlRef !== keyRef) return false;
  return true;
}

function supabaseProjectRefFromUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const [ref, domain] = host.split(".");
    return domain === "supabase" ? ref : "";
  } catch {
    return "";
  }
}

function supabaseProjectRefFromJwt(value: string) {
  const parts = String(value || "").split(".");
  if (parts.length < 2) return "";
  try {
    const payload = JSON.parse(base64UrlDecodeToString(parts[1]));
    return typeof payload?.ref === "string" ? payload.ref.toLowerCase() : "";
  } catch {
    return "";
  }
}

function base64UrlDecodeToString(value: string) {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return atob(value.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

const DEFAULT_TELEGRAM_ENGINE_URL = "https://sniperbo-telegram-engine.sniperboia.workers.dev";
const TELEGRAM_ENGINE_SECRET_NAMES = [
  "TELEGRAM_ENGINE_SECRET",
  "CLOUDFLARE_TELEGRAM_ENGINE_SECRET",
  "ENGINE_API_SECRET",
  "SNIPER_PUBLISHER_TOKEN",
  "SNIPER_DASHBOARD_TOKEN",
  "SNIPER_ADMIN_TOKEN",
] as const;

function getTelegramEngineConfig(env: unknown) {
  const url = (
    readServerEnvString(env, "TELEGRAM_ENGINE_URL", "") ||
    readServerEnvString(env, "CLOUDFLARE_TELEGRAM_ENGINE_URL", "") ||
    DEFAULT_TELEGRAM_ENGINE_URL
  ).replace(/\/+$/, "");
  const secret = TELEGRAM_ENGINE_SECRET_NAMES.map((name) => readServerEnvString(env, name, "")).find(Boolean) || "";
  if (!url || !secret) return null;
  return { url, secret };
}

async function syncTelegramEngineUserAccess(env: unknown, userId: string, client: Record<string, unknown> | null) {
  const config = getTelegramEngineConfig(env);
  if (!config) return { ok: true, skipped: true, status: 200, error: "" };

  const clientRecord = client || {};
  const normalizedUserId = normalizeValidatorUserId(userId || readString(clientRecord, "email"));
  if (!normalizedUserId) return { ok: false, status: 400, error: "Usuario Telegram obrigatorio." };

  const active = client ? clientHasLiveAccess(clientRecord) : true;
  const path = active ? "/engine/users/provision" : "/engine/users/expire";
  const payload = {
    userId: normalizedUserId,
    email: normalizedUserId,
    active,
    plan: readString(clientRecord, "plan") || (active ? "premium" : "expired"),
    accessStatus: readString(clientRecord, "access_status"),
    expiresAt: readString(clientRecord, "expires_at"),
    graceDays: 5,
    source: active ? "site_premium_access" : "site_expired_access",
  };

  const response = await fetch(`${config.url}${path}`, {
    method: "POST",
    headers: telegramEngineHeaders(config.secret, "", true),
    body: JSON.stringify(payload),
  }).catch((error) => ({ ok: false, status: 502, json: async () => ({ error: errorMessage(error) }) }) as Response);
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status || 502,
      error: readString(data, "error") || "Telegram Engine indisponivel.",
    };
  }
  return { ok: true, skipped: false, status: response.status, error: "" };
}

async function forwardTelegramEngineRequest(request: Request, url: URL, env: unknown, userId: string) {
  const config = getTelegramEngineConfig(env);
  if (!config) return null;
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.clone().text();
  const response = await fetch(`${config.url}${url.pathname}${url.search}`, {
    method: request.method,
    headers: telegramEngineHeaders(config.secret, userId, Boolean(body)),
    body,
  });
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function fetchCloudValidatorChannels(env: unknown, userId = "") {
  const config = getTelegramEngineConfig(env);
  if (!config) return [];
  const normalizedUserId = normalizeValidatorUserId(userId);
  const path = normalizedUserId ? "/validator/channels" : "/engine/channels/active";
  const response = await fetch(`${config.url}${path}`, {
    cache: "no-store",
    headers: telegramEngineHeaders(config.secret, normalizedUserId),
  }).catch(() => null);
  if (!response?.ok) return [];
  const data = (await response.json().catch(() => null)) as { channels?: unknown[] } | null;
  return Array.isArray(data?.channels)
    ? data.channels
        .map((channel) => normalizeCloudValidatorChannel(channel, normalizedUserId))
        .filter((channel): channel is ValidatorNotificationChannel => Boolean(channel))
    : [];
}

function normalizeCloudValidatorChannel(value: unknown, fallbackUserId = "") {
  const record = readRecord(value);
  const userId = normalizeValidatorUserId(readString(record, "userId") || fallbackUserId);
  const id = readString(record, "id");
  if (!userId || !id) return null;
  const templates = readRecord(record.templates);
  return {
    id,
    userId,
    name: readString(record, "name") || "Canal Telegram",
    botTokenMasked: readString(record, "botTokenMasked"),
    botTokenEncoded: "__cloudflare__",
    chatId: readString(record, "chatId"),
    buttonLink: readString(record, "buttonLink"),
    isActive: record.isActive !== false,
    analyzingEnabled: readBooleanField(record, "analyzingEnabled"),
    analyzingCooldownRounds: Math.max(1, Math.floor(Number(record.analyzingCooldownRounds) || 3)),
    templates,
    signalModules: normalizeValidatorChannelSignalModules(record.signalModules || templates.signalModules),
    createdAt: readString(record, "createdAt") || new Date().toISOString(),
    updatedAt: readString(record, "updatedAt") || new Date().toISOString(),
  } as ValidatorNotificationChannel;
}

function telegramEngineHeaders(secret: string, userId: string, withJson = false) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${secret}`,
    ...(userId ? { "X-Validator-User-Id": userId } : {}),
    ...(withJson ? { "Content-Type": "application/json" } : {}),
  };
}

function supabasePersistenceHeaders(key: string) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
}

function restoreDashboardData(value: Record<string, unknown>): LiveDashboardData {
  if (isDefaultMockDashboardState(value)) {
    return resetDashboardDailyCycle(liveDashboardData);
  }

  if (compareDashboardStateFreshness(liveDashboardData as unknown as Record<string, unknown>, value) > 0) {
    return ensureDashboardDailyCycle(liveDashboardData).dashboard;
  }

  const incomingCycleDate = readDashboardCycleDate(value);
  const currentCycleDate = currentDashboardCycleDate();
  if (incomingCycleDate && incomingCycleDate !== currentCycleDate) {
    return ensureDashboardDailyCycle(liveDashboardData).dashboard;
  }

  const restored = updateDashboardData(liveDashboardData, value);
  const cycleDate = incomingCycleDate || restored.cycleDate || currentCycleDate;
  const restoredWithMetadata = {
    ...restored,
    updatedAt: readString(value, "updatedAt") || restored.updatedAt,
    cycleDate,
    dailyCycleDate: cycleDate,
  };
  return ensureDashboardDailyCycle(restoredWithMetadata).dashboard;
}

function isDefaultMockDashboardState(value: Record<string, unknown>) {
  const reading = readRecord(value.neuralReading);
  const signal = readRecord(value.currentSignal);
  const rounds = Array.isArray(value.rounds) ? value.rounds : [];
  return (
    rounds.length === mockDashboardData.rounds.length &&
    readString(signal, "id") === "current" &&
    readString(signal, "side") === "BANKER" &&
    readString(signal, "status") === "pending" &&
    serverSafeCounter(signal.strength) === 82 &&
    serverSafeCounter(reading.alertas) === 177 &&
    serverSafeCounter(reading.acertos) === 77 &&
    serverSafeCounter(reading.greenSemGale) === 52 &&
    serverSafeCounter(reading.greenG1) === 25 &&
    serverSafeCounter(reading.reds ?? reading.erros) === 100
  );
}

function restoreModuleToggles(value: Record<string, unknown>) {
  return {
    tieAlert: typeof value.tieAlert === "boolean" ? value.tieAlert : liveModuleToggles.tieAlert,
    surfAnalyzer: typeof value.surfAnalyzer === "boolean" ? value.surfAnalyzer : liveModuleToggles.surfAnalyzer,
  };
}

function restoreSalesSettings(value: Record<string, unknown>): SalesSettings {
  return {
    salesClosed: typeof value.salesClosed === "boolean" ? value.salesClosed : liveSalesSettings.salesClosed,
    updated_at: readString(value, "updated_at") || readString(value, "updatedAt") || liveSalesSettings.updated_at,
    updated_by: readString(value, "updated_by") || readString(value, "updatedBy") || liveSalesSettings.updated_by,
  };
}

function restoreSiteContentSettings(value: Record<string, unknown>): SiteContentSettings {
  return normalizeSiteContentSettings(value, liveSiteContentSettings);
}

function publicSalesSettings() {
  return {
    salesClosed: liveSalesSettings.salesClosed,
    mode: liveSalesSettings.salesClosed ? "closed" : "open",
  };
}

function publicSiteContentSettings() {
  return {
    ...liveSiteContentSettings,
    updatedBy: "",
  };
}

function adminSalesSettings(env?: unknown, saveStatus = liveStateSaveStatus) {
  const durableConfigured = env ? Boolean(getSupabasePersistenceConfig(env)) : saveStatus.durableConfigured;
  const durableReady = saveStatus.durable || (durableConfigured && !saveStatus.saved_at);
  const warning = !durableConfigured
    ? "Persistencia fixa nao configurada. Configure SUPABASE_SERVICE_ROLE_KEY no Lovable para a chave nao voltar sozinha."
    : saveStatus.saved_at && !saveStatus.durable
      ? "Nao foi possivel confirmar o salvamento duravel. Verifique a tabela sniper_live_state no Supabase."
      : "";
  return {
    ...publicSalesSettings(),
    updated_at: liveSalesSettings.updated_at,
    updated_by: liveSalesSettings.updated_by,
    persistence: durableReady ? "durable" : "temporary",
    storageReady: durableConfigured,
    warning,
  };
}

function adminSiteContentSettings(env?: unknown, saveStatus = liveStateSaveStatus) {
  const durableConfigured = env ? Boolean(getSupabasePersistenceConfig(env)) : saveStatus.durableConfigured;
  const durableReady = saveStatus.durable || (durableConfigured && !saveStatus.saved_at);
  const warning = !durableConfigured
    ? "Persistencia fixa nao configurada. Configure SUPABASE_SERVICE_ROLE_KEY no Lovable para salvar definitivo."
    : saveStatus.saved_at && !saveStatus.durable
      ? "Nao foi possivel confirmar o salvamento duravel. Verifique a tabela sniper_live_state no Supabase."
      : "";
  return {
    ...liveSiteContentSettings,
    persistence: durableReady ? "durable" : "temporary",
    storageReady: durableConfigured,
    warning,
  };
}

async function injectSiteContentHeadResponse(request: Request, response: Response) {
  if (request.method !== "GET") return response;
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const nextHtml = injectSiteContentHead(html, request.url);
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("content-type", "text/html; charset=utf-8");
  return new Response(nextHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function injectSiteContentHead(html: string, requestUrl: string) {
  const settings = publicSiteContentSettings();
  const title = escapeHtmlText(settings.shareTitle);
  const description = escapeHtmlAttribute(settings.shareDescription);
  const imageUrl = absoluteSiteUrl(settings.shareImageUrl, requestUrl);
  const faviconUrl = absoluteSiteUrl(settings.faviconUrl, requestUrl);
  const tags = [
    `<meta name="description" content="${description}">`,
    `<meta property="og:title" content="${escapeHtmlAttribute(settings.shareTitle)}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="website">`,
    imageUrl ? `<meta property="og:image" content="${escapeHtmlAttribute(imageUrl)}">` : "",
    `<meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}">`,
    `<meta name="twitter:title" content="${escapeHtmlAttribute(settings.shareTitle)}">`,
    `<meta name="twitter:description" content="${description}">`,
    imageUrl ? `<meta name="twitter:image" content="${escapeHtmlAttribute(imageUrl)}">` : "",
    faviconUrl ? `<link rel="icon" href="${escapeHtmlAttribute(faviconUrl)}">` : "",
    faviconUrl ? `<link rel="apple-touch-icon" href="${escapeHtmlAttribute(faviconUrl)}">` : "",
  ]
    .filter(Boolean)
    .join("");

  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  if (!/<title>[\s\S]*?<\/title>/i.test(next)) {
    next = next.replace(/<\/head>/i, `<title>${title}</title></head>`);
  }

  next = removeHeadTag(next, "meta", "name", "description");
  next = removeHeadTag(next, "meta", "property", "og:title");
  next = removeHeadTag(next, "meta", "property", "og:description");
  next = removeHeadTag(next, "meta", "property", "og:type");
  next = removeHeadTag(next, "meta", "property", "og:image");
  next = removeHeadTag(next, "meta", "name", "twitter:card");
  next = removeHeadTag(next, "meta", "name", "twitter:title");
  next = removeHeadTag(next, "meta", "name", "twitter:description");
  next = removeHeadTag(next, "meta", "name", "twitter:image");
  next = next.replace(/<link\b(?=[^>]*\brel=["'](?:icon|apple-touch-icon)["'])[^>]*>/gi, "");
  return next.replace(/<\/head>/i, `${tags}</head>`);
}

function removeHeadTag(html: string, tag: string, attribute: string, value: string) {
  const pattern = new RegExp(`<${tag}\\b(?=[^>]*\\b${attribute}=["']${escapeRegex(value)}["'])[^>]*>`, "gi");
  return html.replace(pattern, "");
}

function absoluteSiteUrl(value: string, requestUrl: string) {
  const normalized = normalizeAssetUrl(value);
  if (!normalized) return "";
  try {
    const url = new URL(normalized, requestUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.toString();
  } catch {
    return "";
  }
}

function escapeHtmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseJsonSafe(value: string) {
  if (!value) return {};
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return {};
  }
}

function json(data: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
      "cdn-cache-control": "no-store",
      "cloudflare-cdn-cache-control": "no-store",
      "surrogate-control": "no-store",
      pragma: "no-cache",
      expires: "0",
      vary: "Authorization",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        "Content-Type,Authorization,x-signature,x-request-id,x-hubla-token,x-hubla-idempotency,x-hubla-signature,x-sniper-admin-email,x-sniper-admin-password,x-sniper-publisher-token",
    },
  });
}

// ===== Password hashing (bcrypt) =====
const BCRYPT_ROUNDS = 12;

function bytesToB64Url(bytes: Uint8Array) {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function b64UrlToBytes(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const norm = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function constantTimeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function constantTimeStringEqual(left: string, right: string) {
  return constantTimeEqual(new TextEncoder().encode(left), new TextEncoder().encode(right));
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("$2a$") || stored.startsWith("$2b$") || stored.startsWith("$2y$")) {
    return bcrypt.compare(password, stored);
  }
  return verifyLegacyPbkdf2Password(password, stored);
}

function passwordHashNeedsUpgrade(stored: string) {
  return !stored.startsWith("$2a$") && !stored.startsWith("$2b$") && !stored.startsWith("$2y$");
}

async function verifyLegacyPbkdf2Password(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith("pbkdf2$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 4) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 100_000) return false;
  const salt = b64UrlToBytes(parts[2]);
  const expected = b64UrlToBytes(parts[3]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key,
    expected.length * 8,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

// ===== Session tokens (HMAC-SHA256 signed) =====
type SessionPayload = {
  email: string;
  scope: "client" | "owner" | "admin_approver";
  role: "admin" | "user";
  plan: string;
  approved: boolean;
  sid?: string;
  ua?: string;
  iph?: string;
  exp: number; // unix seconds
};

function getSessionSecret(env: unknown): string {
  return readNamedServerSecret(env, "SNIPER_SESSION_SECRET", "");
}

async function hmacSign(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function issueSessionToken(
  env: unknown,
  payload: Omit<SessionPayload, "exp">,
  ttlSeconds = 60 * 60 * 24,
): Promise<string> {
  const secret = getSessionSecret(env);
  if (!secret) return "";
  const full: SessionPayload = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = bytesToB64Url(new TextEncoder().encode(JSON.stringify(full)));
  const sig = bytesToB64Url(await hmacSign(secret, body));
  return `${body}.${sig}`;
}

export async function verifySessionToken(env: unknown, token: string): Promise<SessionPayload | null> {
  const secret = getSessionSecret(env);
  if (!secret || !token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = bytesToB64Url(await hmacSign(secret, body));
  // length-safe compare
  if (!constantTimeEqual(new TextEncoder().encode(sig), new TextEncoder().encode(expected))) {
    return null;
  }
  try {
    const decoded = JSON.parse(new TextDecoder().decode(b64UrlToBytes(body))) as SessionPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    if (decoded.role !== "admin" && decoded.role !== "user") return null;
    if (decoded.scope === "client" && decoded.role !== "user") return null;
    if ((decoded.scope === "owner" || decoded.scope === "admin_approver") && decoded.role !== "admin") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

// deploy refresh 2026-06-25 admin runtime
