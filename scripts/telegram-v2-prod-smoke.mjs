const baseUrl = process.env.SNIPER_PROD_URL || "https://sniperbo.com";
const token =
  process.env.SNIPER_ADMIN_TOKEN ||
  process.env.SNIPER_DASHBOARD_TOKEN ||
  process.env.SNIPER_PUBLISHER_TOKEN ||
  "";

if (!token) {
  console.error("Missing SNIPER_ADMIN_TOKEN, SNIPER_DASHBOARD_TOKEN or SNIPER_PUBLISHER_TOKEN");
  process.exit(1);
}

async function request(path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: response.status, json };
}

const latestRound = {
  id: Number(process.env.SMOKE_ROUND_ID || Date.now() % 1_000_000),
  result: "B",
  bankerScore: 8,
  playerScore: 5,
  time: new Date().toISOString(),
};

const publishPayload = {
  updatedAt: new Date().toISOString(),
  rounds: [latestRound],
  neuralReading: {
    mode: "ACTIVE",
    paganteStatus: "ENTRADA CONFIRMADA",
    direcao: "BANKER",
    origem: "BANKER",
    origemTipo: "PAGANTE",
    numero: 7,
    validade: "G1",
    assertividade: 84,
  },
  currentSignal: {
    id: `smoke-neural-entry:7:B:round:${latestRound.id}`,
    side: "BANKER",
    status: "pending",
    protection: "G1",
    strength: 84,
  },
  neuralEntryState: {
    key: "7:BANKER:PAGANTE:B:G1",
    numero: 7,
    origem: "BANKER",
    origemTipo: "PAGANTE",
    expectedSide: "BANKER",
    status: "awaiting_sg",
    triggerRoundKey: String(latestRound.id),
    startedAt: new Date().toISOString(),
  },
};

const diagGet = await request("/telegram/v2/diagnostics");
console.log("diagnostics GET", diagGet.status, JSON.stringify(diagGet.json, null, 2));

const publish = await request("/dashboard/publish", {
  method: "POST",
  body: publishPayload,
});
console.log("dashboard/publish", publish.status, JSON.stringify(publish.json, null, 2));

const smokeBot = process.env.SNIPER_V2_SMOKE_BOT_TOKEN || "";
const smokeChat = process.env.SNIPER_V2_SMOKE_CHAT_ID || "";
const diagRunBody =
  smokeBot && smokeChat
    ? {
        smokeChannel: {
          botToken: smokeBot,
          chatId: smokeChat,
          userId: process.env.SNIPER_V2_SMOKE_USER_ID || "smoke@sniperbo.local",
        },
      }
    : undefined;

const diagRun = await request("/telegram/v2/diagnostics?execute=1", {
  method: "POST",
  body: diagRunBody,
});
console.log("diagnostics execute", diagRun.status, JSON.stringify(diagRun.json, null, 2));
