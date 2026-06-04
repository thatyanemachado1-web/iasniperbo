import { getInitialApiUrl } from "@/lib/adminApi";
import {
  DEFAULT_SITE_CONTENT_SETTINGS,
  normalizeSiteContentSettings,
  type SiteContentSettings,
} from "@/lib/siteContent";

export async function getPublicSiteContent(signal?: AbortSignal): Promise<SiteContentSettings> {
  const response = await fetch(`${publicApiBaseUrl()}/site-content`, {
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return DEFAULT_SITE_CONTENT_SETTINGS;
  const data = (await response.json().catch(() => ({}))) as { siteContent?: unknown };
  return normalizeSiteContentSettings(data.siteContent);
}

function publicApiBaseUrl() {
  if (typeof window === "undefined") return "";
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return window.location.origin;
  }
  return normalizeBaseUrl(getInitialApiUrl());
}

function normalizeBaseUrl(apiUrl: string) {
  try {
    return new URL(apiUrl).origin;
  } catch {
    return apiUrl.replace(/\/+$/, "");
  }
}
