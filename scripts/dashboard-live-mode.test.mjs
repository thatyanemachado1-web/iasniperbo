import assert from "node:assert/strict";

function isLiveDashboardPayload(data) {
  if (!data || data.mockMode === true) return false;
  if (data.updatedAt) return true;
  return Array.isArray(data.rounds) && data.rounds.length > 0;
}

function resolveDashboardMode(dashboardUrl, query) {
  if (!dashboardUrl) return "mock";
  const hasLivePayload = isLiveDashboardPayload(query.data) && !query.isPlaceholderData;
  if (hasLivePayload) return "live";
  if (query.isPending || (query.isFetching && !hasLivePayload)) return "connecting";
  if (query.isError) return "fallback";
  return "fallback";
}

const livePayload = {
  mockMode: false,
  updatedAt: "2026-07-02T19:00:00.000Z",
  neuralReading: { mode: "ACTIVE", numero: 9, origem: "PLAYER", direcao: "BANKER" },
  currentSurfAlert: { surf_phase: "CONTINUIDADE", surf_side: "BANKER" },
  currentTieAlert: { status: "active", level: "Alto", confidence: 72 },
  rounds: [{ id: 1107382, result: "B" }],
};

assert.equal(
  resolveDashboardMode("https://sniperbo.com/dashboard", {
    data: livePayload,
    isPlaceholderData: false,
    isPending: false,
    isFetching: true,
    isError: false,
  }),
  "live",
  "keeps live mode while refetching real payload",
);

assert.equal(
  resolveDashboardMode("https://sniperbo.com/dashboard", {
    data: { mockMode: true, rounds: livePayload.rounds },
    isPlaceholderData: true,
    isPending: true,
    isFetching: true,
    isError: false,
  }),
  "connecting",
  "placeholder mock must not unlock live mode",
);

assert.equal(
  resolveDashboardMode("https://sniperbo.com/dashboard", {
    data: undefined,
    isPlaceholderData: false,
    isPending: false,
    isFetching: false,
    isError: true,
  }),
  "fallback",
  "failed fetch without live payload stays fallback",
);

assert.equal(isLiveDashboardPayload(livePayload), true);
assert.equal(isLiveDashboardPayload({ mockMode: true, updatedAt: "x" }), false);

console.log("dashboard-live-mode.test.mjs OK");
