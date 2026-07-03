import { saveUserSession, type UserSession } from "@/lib/userSession";

export const LOCAL_DEV_SESSION_EMAIL = "preview@sniperbo.local";
export const LOCAL_DEV_ACCESS_STATUS = "demo_local";
export const LOCAL_DEV_SESSION_TOKEN = "local-dev-preview";
export const LOCAL_DEV_DASHBOARD_API = "https://sniperbo.com";
const DASHBOARD_SOURCE_STORAGE_KEY = "sniper_admin_api_url";
const LOCAL_DEMO_TRIAL_MS = 10 * 60 * 1000;

export function isLocalFrontend() {
  return (
    typeof window !== "undefined" &&
    ["127.0.0.1", "localhost"].includes(window.location.hostname)
  );
}

/** Local preview opens /app without login or stored session. */
export function isLocalOpenAccess() {
  return isLocalFrontend();
}

export function ensureLocalDashboardApi() {
  if (!isLocalOpenAccess()) return;
  window.localStorage.setItem(DASHBOARD_SOURCE_STORAGE_KEY, LOCAL_DEV_DASHBOARD_API);
}

export function isLocalDevPreviewSession(session: Pick<UserSession, "accessStatus">) {
  return isLocalFrontend() && session.accessStatus === LOCAL_DEV_ACCESS_STATUS;
}

export function bootstrapLocalDevSession() {
  if (!isLocalFrontend()) return false;

  saveUserSession(LOCAL_DEV_SESSION_EMAIL, {
    name: "Preview Local",
    accessMode: "full",
    accessStatus: LOCAL_DEV_ACCESS_STATUS,
    plan: "vip",
    registered: true,
    approved: true,
    expiresAt: new Date(Date.now() + LOCAL_DEMO_TRIAL_MS).toISOString(),
    clientToken: LOCAL_DEV_SESSION_TOKEN,
  });

  window.localStorage.setItem(DASHBOARD_SOURCE_STORAGE_KEY, LOCAL_DEV_DASHBOARD_API);
  return true;
}

export function localDevAppUrl() {
  return "/app";
}
