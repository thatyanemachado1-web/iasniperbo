import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import { readAdminSession } from "@/lib/adminApi";
import { readUserSession } from "@/lib/userSession";
import type { DashboardData } from "@/types/dashboard";

const PUBLIC_API_URL = "https://sniperbo.com";
const PUBLIC_DASHBOARD_URL = `${PUBLIC_API_URL}/dashboard`;
const ALLOWED_REMOTE_API_HOSTS = new Set([
  "sniperbo.com",
  "www.sniperbo.com",
]);

function configuredDashboardUrl() {
  const directUrl = import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined;
  if (directUrl) return directUrl;

  const apiBase = import.meta.env.VITE_SNIPER_API_URL as string | undefined;
  if (apiBase) return `${apiBase.replace(/\/+$/, "")}/dashboard`;

  if (typeof window !== "undefined") {
    const queryUrl = dashboardUrlFromQuery(window.location.search);
    if (queryUrl) {
      window.localStorage.setItem("sniper_admin_api_url", stripDashboardPath(queryUrl));
      return queryUrl;
    }

    const savedAdminApi = window.localStorage.getItem("sniper_admin_api_url");
    if (savedAdminApi && isSameOriginApiBaseUrl(savedAdminApi)) {
      window.localStorage.removeItem("sniper_admin_api_url");
      return defaultDashboardUrl();
    }
    if (savedAdminApi && isAllowedApiBaseUrl(savedAdminApi)) return ensureDashboardPath(savedAdminApi);
    if (savedAdminApi) window.localStorage.removeItem("sniper_admin_api_url");
  }

  return defaultDashboardUrl();
}

function dashboardUrlFromQuery(search: string) {
  const params = new URLSearchParams(search);
  const rawUrl = params.get("sniper_api") || params.get("api");
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (!isAllowedParsedUrl(parsed)) {
      return null;
    }
    return ensureDashboardPath(parsed.toString());
  } catch {
    return null;
  }
}

function isAllowedApiBaseUrl(url: string) {
  try {
    return isAllowedParsedUrl(new URL(url));
  } catch {
    return false;
  }
}

function isSameOriginApiBaseUrl(url: string) {
  try {
    return typeof window !== "undefined" && new URL(url).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

function isAllowedParsedUrl(parsed: URL) {
  if (["127.0.0.1", "localhost"].includes(parsed.hostname)) return true;
  if (typeof window !== "undefined" && parsed.hostname === window.location.hostname) return parsed.protocol === "https:";
  return parsed.protocol === "https:" && ALLOWED_REMOTE_API_HOSTS.has(parsed.hostname);
}

function ensureDashboardPath(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/dashboard") ? trimmed : `${trimmed}/dashboard`;
}

function stripDashboardPath(url: string) {
  return url.replace(/\/dashboard\/?$/, "");
}

function defaultDashboardUrl() {
  if (typeof window === "undefined") return "";
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
    return `${window.location.origin}/dashboard`;
  }
  return PUBLIC_DASHBOARD_URL;
}

async function fetchDashboardData(): Promise<DashboardData> {
  const url = configuredDashboardUrl();
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  const token = adminSession?.token || userSession.clientToken;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Dashboard API returned ${response.status}`);
  }

  return response.json();
}

export function useDashboardData() {
  const dashboardUrl = configuredDashboardUrl();
  const query = useQuery({
    queryKey: ["dashboard-data", dashboardUrl],
    queryFn: fetchDashboardData,
    enabled: Boolean(dashboardUrl) && typeof window !== "undefined",
    initialData: mockDashboardData,
    refetchInterval: dashboardUrl ? 4000 : false,
    retry: 1,
  });

  return {
    data: query.data ?? mockDashboardData,
    mode: !dashboardUrl ? "mock" : query.isError ? "fallback" : query.isLoading ? "connecting" : "live",
    error: query.error,
  } as const;
}
