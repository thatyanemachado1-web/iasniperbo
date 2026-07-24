import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

const isDeployVerification = process.argv.includes("--deploy");
const deployArtifactPath = resolve(".output/server/index.mjs");
const deployWranglerPath = resolve(".output/server/wrangler.json");
const deployPublicPath = resolve(".output/public");
const artifactPaths = isDeployVerification
  ? [deployArtifactPath]
  : [resolve("dist/server/index.mjs"), deployArtifactPath];
const artifactPath = artifactPaths.find((candidate) => existsSync(candidate));
if (!artifactPath) {
  throw new Error(`Cloudflare build artifact not found:\n- ${artifactPaths.join("\n- ")}`);
}
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
  [
    "Durable Object class is present in the generated Worker",
    /\bclass\s+DashboardLatestSnapshotDO\b/.test(artifact),
  ],
  [
    "D1 binding DASHBOARD_RESULTS_DB is configured",
    /"binding"\s*:\s*"DASHBOARD_RESULTS_DB"/.test(wrangler),
  ],
  [
    "Durable Object binding is configured",
    /"name"\s*:\s*"DASHBOARD_LATEST_SNAPSHOT_DO"/.test(wrangler),
  ],
  ["sniperbo.com route is configured", /"sniperbo\.com\/\*"/.test(wrangler)],
  ["www.sniperbo.com route is configured", /"www\.sniperbo\.com\/\*"/.test(wrangler)],
];

if (isDeployVerification) {
  if (!existsSync(deployWranglerPath)) {
    throw new Error(`Generated Cloudflare deploy config not found: ${deployWranglerPath}`);
  }
  if (!existsSync(deployPublicPath)) {
    throw new Error(`Generated Cloudflare public assets not found: ${deployPublicPath}`);
  }

  const [deployWranglerSource, publicEntries] = await Promise.all([
    readFile(deployWranglerPath, "utf8"),
    readdir(deployPublicPath),
  ]);
  const deployWrangler = JSON.parse(deployWranglerSource);
  const deployRoutes = (deployWrangler.routes ?? []).map((route) =>
    typeof route === "string" ? route : route.pattern,
  );
  const deployD1 = (deployWrangler.d1_databases ?? []).find(
    (database) => database.binding === "DASHBOARD_RESULTS_DB",
  );
  const deployDurableObject = (deployWrangler.durable_objects?.bindings ?? []).find(
    (binding) => binding.name === "DASHBOARD_LATEST_SNAPSHOT_DO",
  );
  const deployMigrations = deployWrangler.migrations ?? [];
  const deployMigration = deployMigrations[0];
  const migrationIsExactlyExpected =
    deployMigrations.length === 1 &&
    deployMigration?.tag === "dashboard_latest_snapshot_do_v1" &&
    deployMigration?.new_sqlite_classes?.length === 1 &&
    deployMigration.new_sqlite_classes[0] === "DashboardLatestSnapshotDO" &&
    Object.keys(deployMigration).every((key) => key === "tag" || key === "new_sqlite_classes");
  const configuredAssetsPath = deployWrangler.assets?.directory
    ? resolve(dirname(deployWranglerPath), deployWrangler.assets.directory)
    : null;
  const assetsPathMatches =
    configuredAssetsPath !== null && relative(deployPublicPath, configuredAssetsPath) === "";

  checks.push(
    ["generated deploy config targets sniper-bo-ia", deployWrangler.name === "sniper-bo-ia"],
    ["generated deploy config targets index.mjs", deployWrangler.main === "index.mjs"],
    [
      "generated deploy config uses the ASSETS binding",
      deployWrangler.assets?.binding === "ASSETS",
    ],
    ["generated deploy config points to .output/public", assetsPathMatches],
    ["generated public assets are not empty", publicEntries.length > 0],
    [
      "generated deploy config preserves the dashboard D1 database",
      deployD1?.database_name === "sniperbo-dashboard-results" &&
        deployD1?.database_id === "12452654-13f8-4b28-8c82-29c77fdfdfb5",
    ],
    [
      "generated deploy config preserves the dashboard Durable Object",
      deployDurableObject?.class_name === "DashboardLatestSnapshotDO",
    ],
    [
      "generated deploy config has only the expected non-destructive Durable Object migration",
      migrationIsExactlyExpected,
    ],
    ["generated deploy config preserves sniperbo.com", deployRoutes.includes("sniperbo.com/*")],
    [
      "generated deploy config preserves www.sniperbo.com",
      deployRoutes.includes("www.sniperbo.com/*"),
    ],
    [
      "generated deploy config preserves the dashboard refresh schedule",
      deployWrangler.triggers?.crons?.includes("*/1 * * * *") === true,
    ],
    ["generated deploy config keeps workers.dev disabled", deployWrangler.workers_dev === false],
  );
}

const failures = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failures.length > 0) {
  throw new Error(`Cloudflare build verification failed:\n- ${failures.join("\n- ")}`);
}

console.log(
  isDeployVerification
    ? "Cloudflare deploy verified: Worker, assets, D1, Durable Object, schedule and production routes are aligned."
    : "Cloudflare build verified: Durable Object export, D1 binding and production routes are present.",
);
