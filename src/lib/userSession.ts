export interface UserSession {
  email: string;
  name: string;
}

const USER_SESSION_KEY = "sniper_user_session";
export const ADMIN_OWNER_EMAIL = "gabrielmendespromove@gmail.com";

export function readUserSession(): UserSession {
  if (typeof window === "undefined") {
    return { email: "", name: "Usuário" };
  }
  const raw = window.localStorage.getItem(USER_SESSION_KEY);
  if (!raw) return { email: "", name: "Usuário" };
  try {
    const session = JSON.parse(raw) as Partial<UserSession>;
    const email = String(session.email || "").trim();
    const name = String(session.name || "").trim() || nameFromEmail(email);
    return { email, name };
  } catch {
    return { email: "", name: "Usuário" };
  }
}

export function saveUserSession(email: string) {
  if (typeof window === "undefined") return;
  const cleanEmail = email.trim();
  window.localStorage.setItem(
    USER_SESSION_KEY,
    JSON.stringify({
      email: cleanEmail,
      name: nameFromEmail(cleanEmail),
    }),
  );
}

export function clearUserSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_SESSION_KEY);
}

export function isAdminOwnerEmail(email?: string | null) {
  return String(email || "").trim().toLowerCase() === ADMIN_OWNER_EMAIL;
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Usuário";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
