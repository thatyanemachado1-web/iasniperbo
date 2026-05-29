export type RecipientKind = "group" | "channel" | "user";
export type RecipientPlan = "free" | "premium" | "vip";

export interface SignalRecipient {
  id: string;
  name: string;
  full_name?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  chat_id?: string;
  kind: RecipientKind;
  enabled: boolean;
  plan: RecipientPlan;
  access_status?: "approved" | "paused" | "pending";
  starts_at?: string;
  validity_days?: number;
  expires_at: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  apiUrl: string;
  email: string;
  token: string;
}

export interface SecurityEvent {
  id: string;
  created_at: string;
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  client_ip: string;
  path: string;
  method: string;
  email?: string;
  reason?: string;
  origin?: string;
  user_agent?: string;
}

export interface SecuritySummary {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface AdminSummaryLocation {
  label: string;
  count: number;
}

export interface AdminSummaryAccess {
  id: string;
  created_at: string;
  type: string;
  email: string;
  full_name: string;
  city: string;
  country: string;
}

export interface AdminSummary {
  totalRegistrations: number;
  approved: number;
  pending: number;
  paused: number;
  totalAccesses: number;
  uniqueAccesses: number;
  cityBreakdown: AdminSummaryLocation[];
  countryBreakdown: AdminSummaryLocation[];
  recentAccesses: AdminSummaryAccess[];
}
