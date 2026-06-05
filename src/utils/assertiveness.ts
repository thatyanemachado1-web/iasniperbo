export const MIN_GREENS_FOR_PERFECT_ASSERTIVENESS = 2;

export function calculateMotorAssertiveness(greens: unknown, reds: unknown) {
  const greenCount = safePositiveNumber(greens);
  const redCount = safePositiveNumber(reds);
  const total = greenCount + redCount;

  if (total <= 0) return 0;
  if (redCount <= 0) return greenCount >= MIN_GREENS_FOR_PERFECT_ASSERTIVENESS ? 100 : 0;
  return roundPercent((greenCount / total) * 100);
}

export function roundPercent(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 10) / 10;
}

function safePositiveNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}
