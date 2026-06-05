import { ChevronDown, Mail, MapPin, MessageCircle, Settings2 } from "lucide-react";
import { useState } from "react";
import { AdminBadge, planLabel, planTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import { AdminUserDetailsPanel } from "@/components/admin/AdminUserDetailsPanel";
import type { QuickAction } from "@/components/admin/AdminQuickActions";
import { buildWhatsAppUrl, formatPhoneDisplay } from "@/lib/phone";
import { cn } from "@/lib/utils";
import type { AdminManagedUser } from "@/types/adminPanel";

export function AdminUserCard({
  user,
  onEdit,
  onQuickAction,
  actionsDisabled,
}: {
  user: AdminManagedUser;
  onEdit: (user: AdminManagedUser) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
  actionsDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const phone = formatPhoneDisplay(user.phoneFull || user.phone, user.countryCode);

  return (
    <article className="rounded-2xl border border-neon-cyan/15 bg-background/45 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-black">{user.name || "Sem nome"}</h3>
          <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs text-muted-foreground">
            <Mail className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">{user.email || "-"}</span>
          </p>
          {phone ? (
            <a
              href={buildWhatsAppUrl(user.phoneFull || user.phone, user.countryCode)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-bold text-neon-cyan"
            >
              <MessageCircle className="size-3.5 shrink-0" />
              <span className="break-words">{phone}</span>
            </a>
          ) : (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <MessageCircle className="size-3.5" />
              Sem WhatsApp
            </p>
          )}
          {(user.city || user.country) && (
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" />
              <span className="break-words">{[user.city, user.country].filter(Boolean).join(" / ")}</span>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan"
          aria-label={`Abrir configuracoes de ${user.name}`}
        >
          <Settings2 className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge>
        <AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>{statusLabel(user.subscriptionStatus)}</AdminBadge>
        {user.isBlocked && <AdminBadge tone="blocked">Bloqueado</AdminBadge>}
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground"
        >
          {open ? "Fechar" : "Abrir"}
          <ChevronDown className={cn("size-3 transition", open && "rotate-180")} />
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <AdminUserDetailsPanel
            user={user}
            onEdit={onEdit}
            onQuickAction={onQuickAction}
            actionsDisabled={actionsDisabled}
          />
        </div>
      )}
    </article>
  );
}
