import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import type { DashboardData } from "@/types/dashboard";

const PUBLIC_DASHBOARD_URL = "https://courts-slides-pretty-escape.trycloudflare.com/dashboard";

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
    if (savedAdminApi) return ensureDashboardPath(savedAdminApi);
  }

  return PUBLIC_DASHBOARD_URL;
}

function dashboardUrlFromQuery(search: string) {
  const params = new URLSearchParams(search);
  const rawUrl = params.get("sniper_api") || params.get("api");
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
      return null;
    }
    return ensureDashboardPath(parsed.toString());
  } catch {
    return null;
  }
}

function ensureDashboardPath(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/dashboard") ? trimmed : `${trimmed}/dashboard`;
}

function stripDashboardPath(url: string) {
  return url.replace(/\/dashboard\/?$/, "");
}

async function fetchDashboardData(): Promise<DashboardData> {
  const url = configuredDashboardUrl();
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
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
