/**
 * Cloudflare-specific named exports included by Nitro in the generated Worker.
 *
 * Keep Durable Object exports here so a clean build preserves the contract
 * declared in wrangler.jsonc without editing .output artifacts.
 */
export class DashboardLatestSnapshotDO {
  constructor(
    private readonly state: unknown,
    private readonly env: unknown,
  ) {}

  async fetch(): Promise<Response> {
    return new Response(JSON.stringify({ ok: true, durableObject: "DashboardLatestSnapshotDO" }), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}
