import type {
  MainScoreboard,
  MainSignal,
  PressurePoint,
  Round,
  TieAlert,
  TieAlertScoreboard,
} from "@/types/dashboard";

export function calculateBankerFrequency(rounds: Round[]) {
  if (!rounds.length) return 0;
  return (rounds.filter((r) => r.result === "B").length / rounds.length) * 100;
}

export function calculatePlayerFrequency(rounds: Round[]) {
  if (!rounds.length) return 0;
  return (rounds.filter((r) => r.result === "P").length / rounds.length) * 100;
}

export function calculateTieFrequency(rounds: Round[]) {
  if (!rounds.length) return 0;
  return (rounds.filter((r) => r.result === "T").length / rounds.length) * 100;
}

export function calculateCurrentStreak(rounds: Round[]) {
  if (!rounds.length) return { side: null as Round["result"] | null, count: 0 };
  const last = rounds[rounds.length - 1].result;
  let count = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].result === last) count++;
    else break;
  }
  return { side: last, count };
}

export function calculateAlternationRate(rounds: Round[]) {
  if (rounds.length < 2) return 0;
  let switches = 0;
  for (let i = 1; i < rounds.length; i++) {
    if (rounds[i].result !== rounds[i - 1].result) switches++;
  }
  return (switches / (rounds.length - 1)) * 100;
}

export function calculateTiePressure(rounds: Round[]) {
  const recent = rounds.slice(-15);
  return (recent.filter((r) => r.result === "T").length / Math.max(recent.length, 1)) * 100;
}

export function calculateMainAssertiveness(signals: MainSignal[]): MainScoreboard {
  const greens = signals.filter((s) => s.status === "green").length;
  const greensG1 = signals.filter((s) => s.status === "green_g1").length;
  const reds = signals.filter((s) => s.status === "red").length;
  const totalGreens = greens + greensG1;
  const totalEntries = totalGreens + reds;
  const assertiveness = totalEntries ? (totalGreens / totalEntries) * 100 : 0;
  return { greens, greensG1, reds, totalGreens, totalEntries, assertiveness };
}

export function calculateTieAlertAssertiveness(alerts: TieAlert[]): TieAlertScoreboard {
  const greenTieAlerts = alerts.filter((a) => a.status === "green").length;
  const expired = alerts.filter((a) => a.status === "expired").length;
  const totalAlerts = greenTieAlerts + expired;
  const assertiveness = totalAlerts ? (greenTieAlerts / totalAlerts) * 100 : 0;
  return { greenTieAlerts, expired, totalAlerts, assertiveness };
}

/**
 * Builds an exponentially-decayed pressure series.
 * Each round adds weight to its side. Streaks compound; alternation softens.
 */
export function buildPressureSeries(rounds: Round[]): PressurePoint[] {
  const series: PressurePoint[] = [];
  let b = 0, p = 0, t = 0;
  const decay = 0.82;
  let streakSide: Round["result"] | null = null;
  let streak = 0;

  rounds.forEach((r, i) => {
    b *= decay;
    p *= decay;
    t *= decay;
    if (r.result === streakSide) streak++;
    else { streak = 1; streakSide = r.result; }
    const boost = 1 + Math.min(streak - 1, 4) * 0.25;
    if (r.result === "B") b += 1.0 * boost;
    if (r.result === "P") p += 1.0 * boost;
    if (r.result === "T") t += 1.4;
    series.push({
      index: i + 1,
      banker: +b.toFixed(3),
      player: +p.toFixed(3),
      tie: +t.toFixed(3),
    });
  });

  return series;
}