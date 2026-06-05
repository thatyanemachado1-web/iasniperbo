import { ChevronDown, Settings2 } from "lucide-react";
import { Fragment, useState } from "react";
import type { ReactNode } from "react";
import { AdminBadge, planLabel, planTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import { AdminUserDetailsPanel } from "@/components/admin/AdminUserDetailsPanel";
import type { QuickAction } from "@/components/admin/AdminQuickActions";
import { cn } from "@/lib/utils";
import type { AdminManagedUser } from "@/types/adminPanel";

export function AdminUsersTable({
  users,
  onEdit,
  onQuickAction,
  actionsDisabled,
}: {
  users: AdminManagedUser[];
  onEdit: (user: AdminManagedUser) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
  actionsDisabled: (user: AdminManagedUser) => boolean;
}) {
  const [openUserId, setOpenUserId] = useState("");

  return (
    <div className="hidden max-w-full overflow-hidden rounded-2xl border border-neon-cyan/15 bg-background/35 lg:block">
      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3 border-b border-border/45 bg-secondary/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground xl:grid-cols-[minmax(0,1fr)_8rem]">
        <span>Cliente</span>
        <span className="text-right">Ações</span>
      </div>

      <div className="divide-y divide-border/45">
        {users.map((user) => {
          const open = openUserId === user.id;
          return (
            <Fragment key={user.id}>
              <article className={cn("px-3 py-3 transition hover:bg-neon-cyan/5", open && "bg-neon-cyan/5")}>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-black leading-snug">
                      {user.name || "Sem nome"}
                    </div>
                    <div className="mt-1 break-all text-[11px] leading-snug text-muted-foreground">
                      {user.email || "-"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenUserId(open ? "" : user.id)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-2.5 py-2 text-[11px] font-black text-neon-cyan hover:bg-neon-cyan/12"
                  >
                    <Settings2 className="size-3.5" />
                    {open ? "Fechar" : "Abrir"}
                    <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
                  </button>
                </div>

                <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 xl:grid-cols-4">
                  <InfoPill label="Plano">
                    <AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge>
                  </InfoPill>
                  <InfoPill label="Status">
                    <AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>
                      {statusLabel(user.subscriptionStatus)}
                    </AdminBadge>
                  </InfoPill>
                  <InfoPill label="Validade">
                    <span className="text-xs font-black text-foreground">{formatDate(user.currentPeriodEnd)}</span>
                  </InfoPill>
                  <InfoPill label="Acesso">
                    <AdminBadge tone={user.isBlocked ? "blocked" : "active"}>
                      {user.isBlocked ? "Bloqueado" : "Ativo"}
                    </AdminBadge>
                  </InfoPill>
                </div>
              </article>

              {open && (
                <div className="border-t border-border/30 px-3 py-4">
                  <AdminUserDetailsPanel
                    user={user}
                    onEdit={onEdit}
                    onQuickAction={onQuickAction}
                    actionsDisabled={actionsDisabled(user)}
                  />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function InfoPill({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <div className="mb-1 text-[9px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("pt-BR");
}
