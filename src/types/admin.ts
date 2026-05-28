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
