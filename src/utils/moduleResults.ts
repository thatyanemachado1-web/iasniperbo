import type {
  MainResult,
  MainScoreboard,
  NeuralReading,
  NeuralResult,
  SurfAnalyzerScoreboard,
  SurfResult,
  TieAlertScoreboard,
  TieResult,
} from "@/types/dashboard";

export function calculateMainResult(scoreboard: MainScoreboard): MainResult {
  const greenSemGale = safeNumber(scoreboard.greens);
  const greenG1 = safeNumber(scoreboard.greensG1);
  const reds = safeNumber(scoreboard.reds);
  const greens = greenSemGale + greenG1;

  return {
    greenSemGale,
    greenG1,
    reds,
    assertiveness: percentage(greens, greens + reds),
  };
}

export function calculateTieResult(scoreboard: TieAlertScoreboard): TieResult {
  const greens = safeNumber(scoreboard.greenTieAlerts);
  const expired = safeNumber(scoreboard.expired);
  const calculatedTotal = greens + expired;
  const total = calculatedTotal || safeNumber(scoreboard.totalAlerts);

  return {
    greens,
    expired,
    total,
    assertiveness: percentage(greens, total),
  };
}

export function calculateNeuralResult(reading?: NeuralReading): NeuralResult {
  const hitFallback = safeNumber(reading?.acertos);
  const greenSemGale = safeNumber(reading?.greenSemGale ?? hitFallback);
  const greenG1 = safeNumber(reading?.greenG1 ?? Math.max(0, hitFallback - greenSemGale));
  const reds = safeNumber(reading?.reds ?? reading?.erros);
  const greens = greenSemGale + greenG1;
  const totalAlerts = safeNumber(reading?.alertas ?? greens + reds);

  return {
    totalAlerts,
    greens,
    greenSemGale,
    greenG1,
    reds,
    assertiveness: percentage(greens, greens + reds),
  };
}

export function calculateSurfResult(scoreboard?: SurfAnalyzerScoreboard): SurfResult {
  const hasSplitGreens =
    typeof scoreboard?.greenSemGale === "number" || typeof scoreboard?.greenG1 === "number";
  const greenSemGale = hasSplitGreens
    ? safeNumber(scoreboard?.greenSemGale)
    : safeNumber(scoreboard?.hits);
  const greenG1 = hasSplitGreens ? safeNumber(scoreboard?.greenG1) : 0;
  const greens = greenSemGale + greenG1;
  const reds = safeNumber(scoreboard?.reds ?? scoreboard?.fails);
  const totalAlerts = safeNumber(scoreboard?.totalAlerts ?? greens + reds);

  return {
    totalAlerts,
    greens,
    greenSemGale,
    greenG1,
    reds,
    blocked: safeNumber(scoreboard?.blocked),
    noRisk: safeNumber(scoreboard?.noRisk),
    assertiveness: percentage(greens, greens + reds),
  };
}

function safeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
