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
  const total = greens + reds;

  return {
    greenSemGale,
    greenG1,
    reds,
    total,
    assertiveness: calculateAssertiveness(greens, total),
    sequencePositive: safeNumber(scoreboard.sequencePositive),
    sequenceNegative: safeNumber(scoreboard.sequenceNegative),
    breakdown: `SG ${greenSemGale} / G1 ${greenG1} / RED ${reds}`,
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
    assertiveness: calculateAssertiveness(greens, total),
    sequencePositive: safeNumber(scoreboard.sequencePositive),
    sequenceExpired: safeNumber(scoreboard.sequenceExpired),
    breakdown: `Green ${greens} / Exp. ${expired}`,
  };
}

export function calculateNeuralResult(reading?: NeuralReading): NeuralResult {
  const hitFallback = optionalNumber(reading?.acertos);
  const explicitSg = optionalNumber(reading?.greenSemGale);
  const explicitG1 = optionalNumber(reading?.greenG1);
  const hasSplitGreens = explicitSg !== null || explicitG1 !== null;
  const greenSemGale = explicitSg ?? (hasSplitGreens ? 0 : safeNumber(hitFallback));
  const greenG1 = explicitG1 ?? 0;
  const greens = hasSplitGreens ? greenSemGale + greenG1 : safeNumber(hitFallback);
  const reds = safeNumber(reading?.reds ?? reading?.erros);
  const total = greens + reds;
  const totalAlerts = safeNumber(reading?.alertas ?? total);
  const providedAssertiveness = optionalNumber(reading?.assertividade);

  return {
    totalAlerts,
    greens,
    greenSemGale,
    greenG1,
    reds,
    total,
    assertiveness: total > 0 ? calculateAssertiveness(greens, total) : safeNumber(providedAssertiveness),
    sequencePositive: safeNumber(reading?.sequencePositive),
    sequenceNegative: safeNumber(reading?.sequenceNegative),
    breakdown: `SG ${greenSemGale} / G1 ${greenG1} / RED ${reds}`,
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
  const total = greens + reds;
  const totalAlerts = safeNumber(scoreboard?.totalAlerts ?? total);

  return {
    totalAlerts,
    greens,
    greenSemGale,
    greenG1,
    reds,
    total,
    blocked: safeNumber(scoreboard?.blocked),
    noRisk: safeNumber(scoreboard?.noRisk),
    assertiveness: calculateAssertiveness(greens, total),
    sequencePositive: safeNumber(scoreboard?.sequencePositive ?? scoreboard?.currentHitStreak),
    sequenceNegative: safeNumber(scoreboard?.sequenceNegative),
    breakdown: `SG ${greenSemGale} / G1 ${greenG1} / RED ${reds}`,
  };
}

function safeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function calculateAssertiveness(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
