import { cn } from "@/lib/utils";
import type { AdminManagedUser } from "@/types/adminPanel";

type BadgeTone =
  | "free"
  | "trial"
  | "monthly"
  | "premium"
  | "vip"
  | "expired"
  | "blocked"
  | "active"
  | "role";

const badgeToneClass: Record<BadgeTone, string> = {
  free: "border-border bg-muted/40 text-muted-foreground",
  trial: "border-neon-blue/35 bg-neon-blue/12 text-neon-blue",
  monthly: "border-neon-cyan/35 bg-neon-cyan/12 text-neon-cyan",
  premium: "border-gold/45 bg-gold/15 text-gold",
  vip: "border-gold/50 bg-neon-purple/15 text-gold",
  expired: "border-warning/30 bg-warning/10 text-warning",
  blocked: "border-destructive/40 bg-destructive/15 text-destructive",
  active: "border-success/35 bg-success/12 text-success",
  role: "border-neon-purple/35 bg-neon-purple/15 text-neon-purple",
};

export function AdminBadge({
  children,
  tone = "free",
  className,
}: {
  children: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]",
        badgeToneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function planTone(plan: AdminManagedUser["plan"]): BadgeTone {
  if (plan === "trial") return "trial";
  if (plan === "monthly") return "monthly";
  if (plan === "premium") return "premium";
  if (plan === "vip_manual") return "vip";
  return "free";
}

export function statusTone(status: AdminManagedUser["subscriptionStatus"], blocked: boolean): BadgeTone {
  if (blocked || status === "blocked") return "blocked";
  if (status === "expired" || status === "canceled") return "expired";
  if (status === "trial") return "trial";
  if (status === "manual_vip") return "vip";
  return "active";
}

export function roleTone(role: AdminManagedUser["role"]): BadgeTone {
  return role === "user" ? "free" : "role";
}

export function planLabel(plan: AdminManagedUser["plan"]) {
  const labels: Record<AdminManagedUser["plan"], string> = {
    free: "Free",
    trial: "Trial",
    monthly: "Mensal",
    premium: "Premium",
    vip_manual: "Manual VIP",
  };
  return labels[plan];
}

export function statusLabel(status: AdminManagedUser["subscriptionStatus"]) {
  const labels: Record<AdminManagedUser["subscriptionStatus"], string> = {
    trial: "Trial",
    active: "Ativo",
    expired: "Vencido",
    canceled: "Cancelado",
    blocked: "Bloqueado",
    manual_vip: "Manual VIP",
  };
  return labels[status];
}
