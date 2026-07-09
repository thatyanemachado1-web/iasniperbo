import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const artifactPath = resolve(".output/server/index.mjs");
const wranglerPath = resolve("wrangler.jsonc");

const [artifact, wrangler] = await Promise.all([
  readFile(artifactPath, "utf8"),
  readFile(wranglerPath, "utf8"),
]);

const checks = [
  [
    "generated Worker exports DashboardLatestSnapshotDO",
    /export\s*\{[\s\S]{0,2000}\bDashboardLatestSnapshotDO\b[\s\S]{0,2000}\}/m.test(artifact),
  ],
  ["Durable Object class is present in the generated Worker", /\bclass\s+DashboardLatestSnapshotDO\b/.test(artifact)],
  ["D1 binding DASHBOARD_RESULTS_DB is configured", /"binding"\s*:\s*"DASHBOARD_RESULTS_DB"/.test(wrangler)],
  ["Durable Object binding is configured", /"name"\s*:\s*"DASHBOARD_LATEST_SNAPSHOT_DO"/.test(wrangler)],
  ["sniperbo.com route is configured", /"sniperbo\.com\/\*"/.test(wrangler)],
  ["www.sniperbo.com route is configured", /"www\.sniperbo\.com\/\*"/.test(wrangler)],
];

const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failures.length > 0) {
  throw new Error(`Cloudflare build verification failed:\n- ${failures.join("\n- ")}`);
}

console.log("Cloudflare build verified: Durable Object export, D1 binding and production routes are present.");
