import { Edit3, MessageCircle } from "lucide-react";
import { AdminBadge, planLabel, planTone, roleTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import { AdminQuickActions, type QuickAction } from "@/components/admin/AdminQuickActions";
import { buildRemarketingMessage, buildWhatsAppUrl, formatPhoneDisplay } from "@/lib/phone";
import type { AdminManagedUser } from "@/types/adminPanel";

export function AdminUserDetailsPanel({
  user,
  actionsDisabled,
  onEdit,
  onQuickAction,
}: {
  user: AdminManagedUser;
  actionsDisabled?: boolean;
  onEdit: (user: AdminManagedUser) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
}) {
  const phone = formatPhoneDisplay(user.phoneFull || user.phone, user.countryCode);

  return (
    <div className="rounded-2xl border border-neon-cyan/15 bg-background/55 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge>
          <AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>
            {statusLabel(user.subscriptionStatus)}
          </AdminBadge>
          <AdminBadge tone={roleTone(user.role)}>{user.role}</AdminBadge>
          {user.isBlocked && <AdminBadge tone="blocked">Bloqueado</AdminBadge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RemarketingButton user={user} />
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="inline-flex items-center gap-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 px-3 py-2 text-xs font-black text-neon-cyan hover:bg-neon-cyan/15"
          >
            <Edit3 className="size-3.5" />
            Editar acesso
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <SummaryItem label="Validade" value={formatDate(user.currentPeriodEnd)} />
        <SummaryItem label="WhatsApp" value={phone || "Sem telefone"} />
        <SummaryItem label="Ultimo acesso" value={formatAccessDateTime(user)} />
      </div>

      <div className="mt-3">
        <AdminQuickActions disabled={actionsDisabled} onAction={(action) => onQuickAction(action, user)} compact />
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/45 bg-secondary/18 px-3 py-2">
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-bold text-foreground/90">{value}</div>
    </div>
  );
}

function RemarketingButton({ user }: { user: AdminManagedUser }) {
  if (hasLiveAccess(user)) return null;
  const url = buildWhatsAppUrl(user.phoneFull || user.phone, user.countryCode, buildRemarketingMessage(user.name));
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs font-black text-success hover:bg-success/15"
    >
      <MessageCircle className="size-3.5" />
      Remarketing
    </a>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatAccessDateTime(user: AdminManagedUser) {
  if (user.lastAccessAt) return formatDateTime(user.lastAccessAt);
  return user.lastAccess || "Sem registro";
}

function hasLiveAccess(user: AdminManagedUser) {
  if (user.isBlocked) return false;
  if (!["active", "manual_vip", "trial"].includes(user.subscriptionStatus)) return false;
  const end = Date.parse(user.currentPeriodEnd);
  return Number.isFinite(end) && end > Date.now();
}
