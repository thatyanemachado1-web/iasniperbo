/** Sinais ao vivo publicos — sem login no dashboard principal. */
export const PUBLIC_LIVE_SIGNALS = true;

export function isPublicLiveSignalsEnabled() {
  return PUBLIC_LIVE_SIGNALS;
}

export function isPublicLiveDashboardPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/app";
  return path === "/app";
}
