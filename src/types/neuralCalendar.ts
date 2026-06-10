export type NeuralCalendarClassification =
  | "muito_pagante"
  | "operavel"
  | "perigoso"
  | "sem_amostra";

export type NeuralCalendarForce = "BANKER" | "PLAYER" | "TIE" | "NONE";

export interface NeuralCalendarDailyStat {
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
  bestModule: string;
  bestForce: NeuralCalendarForce;
  observation: string;
  createdAt: string;
  updatedAt: string;
}

export interface NeuralCalendarHourlyStat extends NeuralCalendarDailyStat {
  hour: number;
  bankerPercent: number;
  playerPercent: number;
  tiePercent: number;
  bestReading: string;
}

export interface NeuralCalendarPayload {
  timezone: string;
  startDate: string;
  updatedAt: string;
  range: string;
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
  selectedDay: NeuralCalendarDailyStat;
  selectedHours: NeuralCalendarHourlyStat[];
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
  };
}
