#!/usr/bin/env node
/**
 * Diagnóstico end-to-end do fluxo Telegram live:
 * site → dashboard → monitor V2 → Telegram Engine → canais/módulos.
 *
 * Uso:
 *   SNIPER_DASHBOARD_TOKEN=... node scripts/telegram-live-diagnostic.mjs
 *   SNIPER_ENGINE_BRIDGE=... SNIPER_TEST_USER=gabrielmendespromove2@gmail.com node scripts/telegram-live-diagnostic.mjs
 *
 * Variáveis opcionais:
 *   SNIPER_PROD_URL          (default https://sniperbo.com)
 *   SNIPER_ENGINE_URL        (default https://sniperbo-telegram-engine.sniperboia.workers.dev)
 *   SNIPER_DASHBOARD_TOKEN | SNIPER_PUBLISHER_TOKEN | SNIPER_ADMIN_TOKEN | SNIPER_V2_DIAG_TOKEN
 *   SNIPER_ENGINE_BRIDGE | ENGINE_API_SECRET | TELEGRAM_ENGINE_SECRET
 *   SNIPER_TEST_USER         filtra canais do Engine por e-mail
 *   EXECUTE_MONITOR=1        roda POST /telegram/v2/diagnostics?execute=1
 */

const siteUrl = (process.env.SNIPER_PROD_URL || "https://sniperbo.com").replace(/\/+$/, "");
const engineUrl = (
  process.env.SNIPER_ENGINE_URL ||
  process.env.TELEGRAM_ENGINE_URL ||
  "https://sniperbo-telegram-engine.sniperboia.workers.dev"
).replace(/\/+$/, "");
const testUser = (process.env.SNIPER_TEST_USER || "").trim().toLowerCase();
const executeMonitor = ["1", "true", "yes", "on"].includes(
  String(process.env.EXECUTE_MONITOR || "").trim().toLowerCase(),
);

const dashboardToken =
  process.env.SNIPER_DASHBOARD_TOKEN ||
  process.env.SNIPER_PUBLISHER_TOKEN ||
  process.env.SNIPER_ADMIN_TOKEN ||
  process.env.SNIPER_V2_DIAG_TOKEN ||
  "";

const engineSecret =
  process.env.SNIPER_ENGINE_BRIDGE ||
  process.env.ENGINE_API_SECRET ||
  process.env.TELEGRAM_ENGINE_SECRET ||
  process.env.CLOUDFLARE_TELEGRAM_ENGINE_SECRET ||
  "";

const MODULE_LABELS = {
  ai_patterns: "Padrões IA",
  paying_numbers: "Números Pagantes",
  surf_alert: "Surf Alert",
  ties_only: "Empates",
  validator: "Validador",
};

function pickToken() {
  if (!dashboardToken) {
    console.error(
      "Defina SNIPER_DASHBOARD_TOKEN, SNIPER_PUBLISHER_TOKEN, SNIPER_ADMIN_TOKEN ou SNIPER_V2_DIAG_TOKEN.",
    );
    process.exit(1);
  }
  return dashboardToken;
}

async function fetchJson(url, { method = "GET", token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  const started = Date.now();
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }).catch((error) => ({
    ok: false,
    status: 0,
    _networkError: error instanceof Error ? error.message : String(error),
    json: async () => ({ error: error instanceof Error ? error.message : String(error) }),
    text: async () => "",
  }));
  const elapsedMs = Date.now() - started;
  const text = await response.text().catch(() => "");
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return {
    ok: response.ok,
    status: response.status || 0,
    elapsedMs,
    json,
    networkError: response._networkError || "",
  };
}

function ageSeconds(iso) {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round((Date.now() - ms) / 1000));
}

function formatAge(iso) {
  const seconds = ageSeconds(iso);
  if (seconds === null) return "desconhecido";
  if (seconds < 60) return `${seconds}s atrás`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min atrás`;
  return `${Math.round(seconds / 3600)}h atrás`;
}

function statusIcon(ok) {
  return ok ? "OK" : "FALHA";
}

function summarizeModules(channel) {
  const modules = channel?.signalModules || channel?.modules || {};
  return Object.entries(MODULE_LABELS)
    .map(([key, label]) => {
      const cfg = modules[key] || {};
      const enabled = Boolean(cfg.enabled);
      return `${label}: ${enabled ? "ON" : "off"}`;
    })
    .join(", ");
}

function filterUserChannels(channels) {
  if (!testUser) return channels;
  return channels.filter((channel) => String(channel.userId || channel.email || "").trim().toLowerCase() === testUser);
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

function printChecklist(items) {
  for (const item of items) {
    console.log(`  [${item.ok ? "x" : " "}] ${item.label}${item.detail ? ` — ${item.detail}` : ""}`);
  }
}

async function main() {
  const token = pickToken();
  const report = { generatedAt: new Date().toISOString(), siteUrl, engineUrl, testUser: testUser || null };
  const checklist = [];

  printSection("1. Versão do site");
  const version = await fetchJson(`${siteUrl}/__sniperbo/version`);
  console.log(`  status=${version.status} (${version.elapsedMs}ms)`);
  if (version.json) {
    console.log(`  build=${version.json.buildId || version.json.version || "?"}`);
    console.log(`  deployedAt=${version.json.deployedAt || version.json.updatedAt || "?"}`);
  }
  checklist.push({
    ok: version.ok,
    label: "Site responde /__sniperbo/version",
    detail: version.ok ? String(version.json?.buildId || version.json?.version || "ok") : `HTTP ${version.status}`,
  });

  printSection("2. Dashboard (publisher)");
  const dashboard = await fetchJson(`${siteUrl}/dashboard`, { token });
  const updatedAt = dashboard.json?.updatedAt || dashboard.json?.dashboard?.updatedAt || "";
  const dashboardAge = ageSeconds(updatedAt);
  const publisherFresh = dashboardAge !== null && dashboardAge <= 120;
  console.log(`  status=${dashboard.status} (${dashboard.elapsedMs}ms)`);
  console.log(`  updatedAt=${updatedAt || "ausente"} (${formatAge(updatedAt)})`);
  if (dashboard.json) {
    const neural = dashboard.json.neuralReading || {};
    const signal = dashboard.json.currentSignal || {};
    console.log(`  neural.mode=${neural.mode || "-"} status=${neural.paganteStatus || "-"}`);
    console.log(`  signal.side=${signal.side || "-"} status=${signal.status || "-"}`);
    const rounds = Array.isArray(dashboard.json.rounds) ? dashboard.json.rounds.length : 0;
    console.log(`  rounds=${rounds}`);
  }
  checklist.push({
    ok: dashboard.ok,
    label: "Dashboard acessível com token",
    detail: dashboard.ok ? "autorizado" : `HTTP ${dashboard.status}`,
  });
  checklist.push({
    ok: publisherFresh,
    label: "Publisher atualizando dashboard (< 2 min)",
    detail: publisherFresh
      ? formatAge(updatedAt)
      : updatedAt
        ? `stale: ${formatAge(updatedAt)}`
        : "sem updatedAt — publisher provavelmente parado",
  });

  printSection("3. Diagnóstico Telegram V2 (Worker principal)");
  const diagPath = executeMonitor ? "/telegram/v2/diagnostics?execute=1" : "/telegram/v2/diagnostics";
  const diagMethod = executeMonitor ? "POST" : "GET";
  const diagnostics = await fetchJson(`${siteUrl}${diagPath}`, { method: diagMethod, token });
  console.log(`  status=${diagnostics.status} executed=${executeMonitor}`);
  const diag = diagnostics.json?.diagnostics || diagnostics.json || {};
  if (diag.runtime) {
    console.log(`  cloudEngineConfigured=${diag.runtime.cloudEngineConfigured}`);
    console.log(`  engineHealth=${JSON.stringify(diag.runtime.engineHealth || {})}`);
  }
  if (diag.dashboard) {
    console.log(
      `  cards confirmados=${(diag.confirmedModules || []).join(", ") || "nenhum"} tasks=${diag.tasksBuilt ?? "?"}`,
    );
    console.log(
      `  canais elegíveis=${diag.eligiblePremiumChannels ?? "?"} / cache=${diag.cachedChannels ?? "?"}`,
    );
  }
  if (Array.isArray(diag.channels) && diag.channels.length) {
    console.log("  canais:");
    for (const channel of diag.channels) {
      console.log(
        `    - ${channel.channelId} user=${channel.user} connected=${channel.connected} modules=[${(channel.activeModules || []).join(", ")}]`,
      );
    }
  }
  if (Array.isArray(diag.lastSendErrors) && diag.lastSendErrors.length) {
    console.log("  últimos erros de envio:");
    for (const err of diag.lastSendErrors) {
      console.log(`    - ${err.moduleKey || err.id}: ${err.error || err.status}`);
    }
  }
  if (executeMonitor && diagnostics.json?.monitorResult !== undefined) {
    console.log(`  monitorResult=${diagnostics.json.monitorResult}`);
  }
  checklist.push({
    ok: diagnostics.ok,
    label: "Endpoint /telegram/v2/diagnostics",
    detail: diagnostics.ok ? `${diag.confirmedModules?.length || 0} módulos confirmados` : `HTTP ${diagnostics.status}`,
  });
  checklist.push({
    ok: Boolean(diag.runtime?.cloudEngineConfigured),
    label: "Worker principal configurado com Telegram Engine",
    detail: diag.runtime?.cloudEngineConfigured ? "sim" : "não — verifique SNIPER_ENGINE_BRIDGE",
  });
  checklist.push({
    ok: Boolean(diag.runtime?.engineHealth?.ok),
    label: "Engine health via Worker principal",
    detail: diag.runtime?.engineHealth?.ok ? "online" : diag.runtime?.engineHealth?.error || "offline",
  });

  printSection("4. Telegram Engine (Cloudflare)");
  if (!engineSecret) {
    console.log("  SNIPER_ENGINE_BRIDGE não definido — pulando chamadas diretas ao Engine.");
    checklist.push({
      ok: false,
      label: "Chamadas diretas ao Engine",
      detail: "defina SNIPER_ENGINE_BRIDGE para checar monitor e canais",
    });
  } else {
    const health = await fetchJson(`${engineUrl}/health`, { token: engineSecret });
    console.log(`  /health status=${health.status} service=${health.json?.service || "?"}`);

    const monitor = await fetchJson(`${engineUrl}/engine/monitor/status`, { token: engineSecret });
    const last = monitor.json?.last || {};
    const lastError = monitor.json?.lastError || null;
    const alarmAt = monitor.json?.alarmAt;
    console.log(`  /engine/monitor/status status=${monitor.status}`);
    console.log(`  alarmAt=${alarmAt ? new Date(Number(alarmAt)).toISOString() : "n/a"}`);
    console.log(`  last.checkedAt=${last.checkedAt || last.at || "?"} (${formatAge(last.checkedAt || last.at)})`);
    if (lastError) {
      console.log(`  lastError=${JSON.stringify(lastError).slice(0, 240)}`);
    }

    const channelsResp = await fetchJson(`${engineUrl}/engine/channels/active`, { token: engineSecret });
    const allChannels = Array.isArray(channelsResp.json?.channels) ? channelsResp.json.channels : [];
    const userChannels = filterUserChannels(allChannels);
    console.log(`  canais ativos=${allChannels.length}${testUser ? ` (filtrado: ${userChannels.length})` : ""}`);
    for (const channel of userChannels.slice(0, 10)) {
      console.log(
        `    - id=${channel.id} user=${channel.userId} chat=${channel.chatId} status=${channel.connectionStatus || channel.status || "?"} ${summarizeModules(channel)}`,
      );
    }

    checklist.push({ ok: health.ok, label: "Engine /health", detail: health.ok ? "online" : `HTTP ${health.status}` });
    checklist.push({
      ok: monitor.ok,
      label: "Engine monitor status",
      detail: monitor.ok ? `último check ${formatAge(last.checkedAt || last.at)}` : `HTTP ${monitor.status}`,
    });
    checklist.push({
      ok: userChannels.some((channel) =>
        Object.values(channel?.signalModules || channel?.modules || {}).some((cfg) => cfg?.enabled),
      ),
      label: testUser ? `Canal de ${testUser} com módulo ativo` : "Pelo menos um canal com módulo ativo",
      detail: testUser
        ? userChannels.length
          ? summarizeModules(userChannels[0])
          : "canal não encontrado no Engine"
        : `${allChannels.length} canal(is) no Engine`,
    });
  }

  printSection("5. Checklist resumido");
  printChecklist(checklist);

  const failed = checklist.filter((item) => !item.ok);
  printSection("Resultado");
  if (!failed.length) {
    console.log("  Tudo OK. Se sinais ainda não chegam, confirme publisher Windows rodando e Lovable publicado.");
    process.exit(0);
  }

  console.log(`  ${failed.length} item(ns) com problema:`);
  for (const item of failed) {
    console.log(`    - ${item.label}: ${item.detail || "falhou"}`);
  }

  if (!publisherFresh) {
    console.log("\n  Ação provável: iniciar o publisher no Windows:");
    console.log("    powershell -File scripts/start_official_publisher.ps1");
    console.log("    ou scripts/watch_sniperbo_official.ps1 para watchdog completo.");
  }

  process.exit(failed.some((item) => item.label.includes("Dashboard") || item.label.includes("Publisher")) ? 2 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
