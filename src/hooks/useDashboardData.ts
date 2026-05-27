import { useQuery } from "@tanstack/react-query";
import { mockDashboardData } from "@/data/mockDashboardData";
import type { DashboardData } from "@/types/dashboard";

function configuredDashboardUrl() {
  const directUrl = import.meta.env.VITE_SNIPER_DASHBOARD_URL as string | undefined;
  if (directUrl) return directUrl;

  const apiBase = import.meta.env.VITE_SNIPER_API_URL as string | undefined;
  if (apiBase) return `${apiBase.replace(/\/+$/, "")}/dashboard`;

  if (typeof window !== "undefined") {
    const savedAdminApi = window.localStorage.getItem("sniper_admin_api_url");
    if (savedAdminApi) return `${savedAdminApi.replace(/\/+$/, "")}/dashboard`;
  }

  return "http://127.0.0.1:8787/dashboard";
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
