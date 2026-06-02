import { getInitialApiUrl, readAdminSession } from "@/lib/adminApi";
import { hasAdminRole, readUserSession, type UserSession } from "@/lib/userSession";
import type { AdminSession } from "@/types/admin";

export function readEffectiveAdminSession(): AdminSession | null {
  const adminSession = readAdminSession();
  const userSession = readUserSession();
  return resolveEffectiveAdminSession(adminSession, userSession);
}

export function canSeeAdminUi() {
  const userSession = readUserSession();
  const adminSession = readAdminSession();
  return (hasAdminRole(userSession) && Boolean(userSession.clientToken)) || isAdminSession(adminSession);
}

export function effectiveAdminRole(session: AdminSession | null): "admin" | "owner" {
  return session?.role === "owner" ? "owner" : "admin";
}

function resolveEffectiveAdminSession(adminSession: AdminSession | null, userSession: UserSession): AdminSession | null {
  if (isAdminSession(adminSession)) {
    return {
      ...adminSession,
      role: adminSession.role === "owner" ? "owner" : "admin",
    };
  }

  if (!hasAdminRole(userSession) || !userSession.clientToken) return null;
  return {
    apiUrl: getInitialApiUrl(),
    email: userSession.email,
    token: userSession.clientToken,
    role: userSession.role === "owner" ? "owner" : "admin",
  };
}

function isAdminSession(session: AdminSession | null): session is AdminSession {
  return Boolean(
    session?.token &&
      (session.role === "owner" || session.role === "admin" || session.role === "approver"),
  );
}
