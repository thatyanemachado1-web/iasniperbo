const baseUrl = process.env.SNIPER_PROD_URL || "https://sniperbo.com";
const token =
  process.env.SNIPER_CLIENT_TOKEN ||
  process.env.SNIPER_DASHBOARD_TOKEN ||
  process.env.SNIPER_ADMIN_TOKEN ||
  "";

if (!token) {
  console.error("Defina SNIPER_CLIENT_TOKEN, SNIPER_DASHBOARD_TOKEN ou SNIPER_ADMIN_TOKEN");
  process.exit(1);
}

async function request(path) {
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  const elapsedMs = Date.now() - startedAt;
  const json = await response.json().catch(() => null);
  return { status: response.status, elapsedMs, json };
}

const history = await request("/dashboard/round-history?limit=1");
const dashboard = await request("/dashboard");

const historyRound = history.json?.rounds?.at(-1) ?? null;
const dashboardRound = dashboard.json?.rounds?.at(-1) ?? null;

const report = {
  baseUrl,
  history: {
    status: history.status,
    elapsedMs: history.elapsedMs,
    latestRound: historyRound,
    updatedAt: history.json?.updatedAt ?? null,
  },
  dashboard: {
    status: dashboard.status,
    elapsedMs: dashboard.elapsedMs,
    roundCount: Array.isArray(dashboard.json?.rounds) ? dashboard.json.rounds.length : 0,
    latestRound: dashboardRound,
    latestRoundId: dashboard.json?.latestRoundId ?? null,
    revision: dashboard.json?.revision ?? null,
    displayState: dashboard.json?.displayState ?? null,
    side: dashboard.json?.side ?? dashboard.json?.currentSignal?.side ?? null,
    updatedAt: dashboard.json?.updatedAt ?? null,
    mockMode: dashboard.json?.mockMode ?? null,
  },
  parity: {
    sameLatestRoundId: historyRound?.id === dashboardRound?.id,
    dashboardNotEmptyWhenHistoryHasRound: Boolean(!historyRound || dashboardRound),
    bothUnder1500ms: history.elapsedMs < 1500 && dashboard.elapsedMs < 1500,
    revisionAboveStaleBaseline: !historyRound || (dashboard.json?.revision ?? 2) > 2,
  },
};

console.log(JSON.stringify(report, null, 2));

const ok =
  history.status === 200 &&
  dashboard.status === 200 &&
  report.parity.sameLatestRoundId &&
  report.parity.dashboardNotEmptyWhenHistoryHasRound &&
  report.parity.bothUnder1500ms;

process.exit(ok ? 0 : 1);
