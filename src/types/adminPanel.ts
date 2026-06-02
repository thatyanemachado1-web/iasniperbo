export type AdminUserRole = "user" | "admin" | "owner";
export type AdminUserPlan = "free" | "trial" | "monthly" | "premium" | "vip_manual";
export type AdminSubscriptionStatus =
  | "trial"
  | "active"
  | "expired"
  | "canceled"
  | "blocked"
  | "manual_vip";

export type AdminActionType =
  | "UPDATE_USER"
  | "UPDATE_PLAN"
  | "UPDATE_SUBSCRIPTION_STATUS"
  | "EXTEND_ACCESS"
  | "BLOCK_USER"
  | "UNBLOCK_USER"
  | "UPDATE_ROLE"
  | "UPDATE_EXPIRATION_DATE"
  | "MANUAL_VIP_GRANTED"
  | "CANCEL_ACCESS"
  | "REACTIVATE_USER";

export interface AdminManagedUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  plan: AdminUserPlan;
  subscriptionStatus: AdminSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  isBlocked: boolean;
  adminNote: string;
  createdAt: string;
  lastAccess: string;
}

export interface AdminPanelOverview {
  engineStatus: string;
  tableStatus: string;
  activeUsers: number;
  activeSubscriptions: number;
  activeTrials: number;
  premiumUsers: number;
  onlineNow: number;
  lastSignal: string;
  lastSignalAt: string;
}

export interface AdminActionLog {
  id: string;
  adminUserId: string;
  adminEmail?: string;
  targetUserId: string;
  targetEmail?: string;
  action: AdminActionType;
  beforeJson: Record<string, unknown>;
  afterJson: Record<string, unknown>;
  reason: string;
  createdAt: string;
}

export interface AdminUsersResponse {
  users: AdminManagedUser[];
  overview: AdminPanelOverview;
}

export interface AdminLogsResponse {
  logs: AdminActionLog[];
}
