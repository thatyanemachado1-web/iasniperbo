export type NeuralCalendarClassification =
  "muito_pagante" | "operavel" | "perigoso" | "sem_amostra";

export type NeuralCalendarForce = "BANKER" | "PLAYER" | "TIE" | "NONE";
export type NeuralCalendarEngineKey =
  | "todos"
  | "neural_pagante"
  | "padroes_quentes_ia"
  | "surf_analyzer"
  | "radar_empates"
  | "numero_pagante_lateral"
  | "motor_empate"
  | "empate_lateral"
  | "validator"
  | "tendencia"
  | "personalizado";

export type NeuralCalendarSampleStatus =
  "sem_dados" | "amostra_baixa" | "em_formacao" | "classificado";

export interface NeuralCalendarModuleStat {
  engineKey: NeuralCalendarEngineKey;
  label: string;
  greens: number;
  greenSG: number;
  greenG1: number;
  reds: number;
  ties: number;
  neutralResults: number;
  completedEntries: number;
  openEntries: number;
  accuracy: number;
  score: number;
  classification: NeuralCalendarClassification;
  sampleStatus: NeuralCalendarSampleStatus;
  sampleLabel: string;
  updatedAt: string;
}

export interface NeuralCalendarDailyStat {
  id: string;
  date: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  totalRounds: number;
  completedEntries?: number;
  openEntries?: number;
  greens: number;
  greenSG?: number;
  greenG1?: number;
  reds: number;
  ties: number;
  neutralResults?: number;
  bankerCount: number;
  playerCount: number;
  tieCount: number;
  accuracy: number;
  score: number;
  classification: NeuralCalendarClassification;
  sampleStatus?: NeuralCalendarSampleStatus;
  sampleLabel?: string;
  bestHour: string;
  worstHour: string;
  bestModule: string;
  bestForce: NeuralCalendarForce;
  observation: string;
  createdAt: string;
  updatedAt: string;
  moduleStats?: NeuralCalendarModuleStat[];
}

export interface NeuralCalendarHourlyStat extends NeuralCalendarDailyStat {
  engineKey?: NeuralCalendarEngineKey;
  totalSignals?: number;
  hour: number;
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
  bestReading: string;
}

export interface NeuralCalendarPayload {
  dataStatus?: "live" | "last_confirmed_snapshot";
  dataSource?: "official_result_events" | string;
  dataStatusMessage?: string;
  timezone: string;
  startDate: string;
  updatedAt: string;
  range: string;
  engineFilter?: {
    mode: NeuralCalendarEngineKey;
    selected: NeuralCalendarEngineKey[];
    available: NeuralCalendarEngineKey[];
  };
  years: number[];
  selected: {
    year: number;
    month: number;
    date: string;
  };
  month: {
    year: number;
    month: number;
    label: string;
    firstWeekday: number;
    days: NeuralCalendarDailyStat[];
    summary: {
      averageScore: number;
      greens?: number;
      reds?: number;
      ties?: number;
      completedEntries?: number;
      sampleStatus?: NeuralCalendarSampleStatus;
      bestDay: NeuralCalendarDailyStat | null;
      worstDay: NeuralCalendarDailyStat | null;
      bestHour: NeuralCalendarHourlyStat | null;
      worstHour: NeuralCalendarHourlyStat | null;
      counts: Record<NeuralCalendarClassification, number>;
    };
    distribution: Record<NeuralCalendarClassification, number>;
    weekdayAverages: Array<{
      weekday: string;
      score: number;
      total: number;
      classification: NeuralCalendarClassification;
    }>;
    heatmap: Array<{
      date: string;
      day: number;
      hour: number;
      score: number;
      classification: NeuralCalendarClassification;
      totalRounds: number;
    }>;
  };
  week?: {
    startDate: string;
    endDate: string;
    days: Array<{
      date: string;
      weekday: string;
      summary: NeuralCalendarDailyStat;
      hours: NeuralCalendarHourlyStat[];
    }>;
  };
  selectedDay: NeuralCalendarDailyStat;
  selectedHours: NeuralCalendarHourlyStat[];
  dailyVision?: NeuralDailyVision;
  rankings: {
    topHours: Array<{ hour: number; label: string; score: number; totalRounds: number }>;
    topWeekdays: Array<{
      weekday: string;
      score: number;
      total: number;
      classification: NeuralCalendarClassification;
    }>;
    topMonthDays: Array<{
      date: string;
      label: string;
      score: number;
      totalRounds: number;
      classification: NeuralCalendarClassification;
    }>;
    topEngines?: Array<{
      engineKey: NeuralCalendarEngineKey;
      label: string;
      score: number;
      totalSignals: number;
      classification: NeuralCalendarClassification;
    }>;
    bestHour?: NeuralCalendarHourlyStat | null;
    bestDay?: NeuralCalendarDailyStat | null;
    bestWeek?: NeuralCalendarDailyStat | null;
    bestMonth?: NeuralCalendarDailyStat | null;
    bestYear?: NeuralCalendarDailyStat | null;
  };
}

export interface NeuralVisionWindowStat {
  greens: number;
  greenSG: number;
  greenG1: number;
  reds: number;
  ties: number;
  neutral: number;
  completedEntries: number;
  accuracy: number;
  classification: NeuralCalendarClassification;
  sampleStatus: NeuralCalendarSampleStatus;
  variation: number | null;
}

export interface NeuralDailyVisionModule {
  engineKey: NeuralCalendarEngineKey;
  label: string;
  windows: {
    oneHour: NeuralVisionWindowStat;
    twoHours: NeuralVisionWindowStat;
    fourHours: NeuralVisionWindowStat;
    today: NeuralVisionWindowStat;
    sameHour7d: NeuralVisionWindowStat;
  };
  sampleStatus: string;
  stability: "ESTAVEL" | "OSCILANDO" | "INSTAVEL" | "EM_FORMACAO" | "SEM_DADOS";
  stabilitySpread: number | null;
  consistencyScore: number;
  recentSequence: string[];
  last5: Record<string, number>;
  last10: Record<string, number>;
  recentRedStreak: number;
  bestWindow: string | null;
  latestEntryAt: string | null;
}

export interface NeuralDailyVision {
  status: "FAVORAVEL" | "ATENCAO" | "DESFAVORAVEL" | "SEM_LEITURA";
  stability: string;
  title: string;
  subtitle: string;
  bestModule: string | null;
  bestEngineKey: NeuralCalendarEngineKey | null;
  assertiveness: number;
  hits: number;
  sample: number;
  bestWindow: string | null;
  mostConsistentHour: string | null;
  alertModule: string | null;
  latestUpdate: string | null;
  summary: string;
  modules: NeuralDailyVisionModule[];
}
