import { definePlugin } from "nitro";

import { ensureTrialClaimHistoryBackfilled } from "../src/server";

export default definePlugin((nitroApp) => {
  nitroApp.hooks.hook("cloudflare:scheduled", async ({ env }) => {
    try {
      const ok = await ensureTrialClaimHistoryBackfilled(env);
      if (!ok) console.error("[TRIAL_ANTI_ABUSE] Automatic history backfill failed.");
    } catch (error) {
      console.error("[TRIAL_ANTI_ABUSE] Automatic history backfill crashed.", error);
    }
  });
});
