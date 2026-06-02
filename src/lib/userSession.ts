export interface UserSession {
  email: string;
  name: string;
  role: "user" | "admin" | "owner";
  accessMode: "none" | "demo" | "pending" | "full" | "expired";
  accessStatus: string;
  plan: "free" | "premium" | "vip";
  expiresAt: string;
  registered: boolean;
  approved: boolean;
  clientToken?: string;
}

const USER_SESSION_KEY = "sniper_user_session";
// Admin owner emails are configured via env var (not hardcoded to avoid leaking PII in the bundle).
// Leave VITE_ADMIN_OWNER_EMAIL unset to disable client-side owner shortcuts entirely;
// real authorization must be enforced server-side.
export const ADMIN_OWNER_EMAILS = parseAdminEmails(
  `${(import.meta.env.VITE_ADMIN_OWNER_EMAIL as string | undefined) || ""},${
    (import.meta.env.VITE_ADMIN_OWNER_EMAILS as string | undefined) || ""
  }`,
);
export const ADMIN_APPROVER_EMAILS = parseAdminEmails(
  `${(import.meta.env.VITE_ADMIN_APPROVER_EMAIL as string | undefined) || ""},${
    (import.meta.env.VITE_ADMIN_APPROVER_EMAILS as string | undefined) || ""
  }`,
);
export const ADMIN_OWNER_EMAIL = ADMIN_OWNER_EMAILS[0] || "";

export function readUserSession(): UserSession {
  if (typeof window === "undefined") {
    return emptyUserSession();
  }
  const raw = window.localStorage.getItem(USER_SESSION_KEY);
  if (!raw) return emptyUserSession();
  try {
    const session = JSON.parse(raw) as Partial<UserSession>;
    const email = String(session.email || "").trim();
    const name = String(session.name || "").trim() || nameFromEmail(email);
    const accessMode = normalizeAccessMode(session.accessMode);
    const plan = normalizePlan(session.plan);
    const owner = isAdminOwnerEmail(email);
    const approver = isAdminApproverEmail(email);
    const role = normalizeUserRole(session.role || (owner ? "owner" : approver ? "admin" : "user"));
    return {
      email,
      name,
      role,
      accessMode,
      accessStatus: String(session.accessStatus || accessMode),
      plan,
      expiresAt: String(session.expiresAt || ""),
      registered: owner || session.registered === true,
      approved: owner || session.approved === true || accessMode === "full",
      clientToken: typeof session.clientToken === "string" ? session.clientToken : "",
    };
  } catch {
    return emptyUserSession();
  }
}

export function saveUserSession(email: string, partial: Partial<UserSession> = {}) {
  if (typeof window === "undefined") return;
  const cleanEmail = email.trim();
  const owner = isAdminOwnerEmail(cleanEmail);
  const approver = isAdminApproverEmail(cleanEmail);
  const role = normalizeUserRole(partial.role || (owner ? "owner" : approver ? "admin" : "user"));
  const accessMode = normalizeAccessMode(
    partial.accessMode || (owner ? "full" : "none"),
  );
  const plan = normalizePlan(partial.plan || (accessMode === "full" ? "vip" : "free"));
  window.localStorage.setItem(
    USER_SESSION_KEY,
    JSON.stringify({
      email: cleanEmail,
      name: partial.name || nameFromEmail(cleanEmail),
      role,
      accessMode,
      accessStatus: partial.accessStatus || accessMode,
      plan,
      expiresAt: partial.expiresAt || "",
      registered: partial.registered ?? owner,
      approved: partial.approved ?? (owner || accessMode === "full"),
      clientToken: partial.clientToken || "",
    }),
  );
}

export function saveDemoSession(email: string, name?: string) {
  saveUserSession(email, {
    name: name || nameFromEmail(email),
    accessMode: "demo",
    accessStatus: "demo",
    plan: "free",
    registered: true,
    approved: false,
  });
}

export function clearUserSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(USER_SESSION_KEY);
}

export function isAdminOwnerEmail(email?: string | null) {
  if (ADMIN_OWNER_EMAILS.length === 0) return false;
  return ADMIN_OWNER_EMAILS.includes(normalizeEmail(email));
}

export function isAdminApproverEmail(email?: string | null) {
  if (ADMIN_APPROVER_EMAILS.length === 0) return false;
  const cleanEmail = normalizeEmail(email);
  return !isAdminOwnerEmail(cleanEmail) && ADMIN_APPROVER_EMAILS.includes(cleanEmail);
}

export function canAccessAdminPanel(email?: string | null) {
  return isAdminOwnerEmail(email) || isAdminApproverEmail(email);
}

export function hasAdminRole(session: Pick<UserSession, "role" | "email"> | null | undefined) {
  if (!session) return false;
  return session.role === "admin" || session.role === "owner" || canAccessAdminPanel(session.email);
}

export function hasOwnerRole(session: Pick<UserSession, "role" | "email"> | null | undefined) {
  if (!session) return false;
  return session.role === "owner" || isAdminOwnerEmail(session.email);
}

export function hasFullAccess(session: UserSession = readUserSession()) {
  return session.approved || session.accessMode === "full" || isAdminOwnerEmail(session.email);
}

export function hasSignalAccess(session: UserSession = readUserSession()) {
  return hasFullAccess(session) || session.accessMode === "demo";
}

export function isLimitedAccess(session: UserSession = readUserSession()) {
  return !hasFullAccess(session);
}

function emptyUserSession(): UserSession {
  return {
    email: "",
    name: "Usuario",
    role: "user",
    accessMode: "none",
    accessStatus: "none",
    plan: "free",
    expiresAt: "",
    registered: false,
    approved: false,
    clientToken: "",
  };
}

function normalizeAccessMode(value: unknown): UserSession["accessMode"] {
  const text = String(value || "none").trim().toLowerCase();
  if (text === "demo" || text === "pending" || text === "full" || text === "expired") {
    return text;
  }
  return "none";
}

function normalizePlan(value: unknown): UserSession["plan"] {
  const text = String(value || "free").trim().toLowerCase();
  if (text === "premium" || text === "vip") return text;
  return "free";
}

function normalizeUserRole(value: unknown): UserSession["role"] {
  const text = String(value || "user").trim().toLowerCase();
  if (text === "owner") return "owner";
  if (text === "admin" || text === "approver") return "admin";
  return "user";
}

function parseAdminEmails(value: unknown) {
  return Array.from(
    new Set(
      String(value || "")
        .split(/[,;\s]+/)
        .map((email) => normalizeEmail(email))
        .filter(Boolean),
    ),
  );
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return "Usuario";
  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
