import { ChevronDown, Settings2 } from "lucide-react";
import { Fragment, useState } from "react";
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
    <div className="hidden overflow-hidden rounded-2xl border border-neon-cyan/15 bg-background/35 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Plano</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Validade</th>
            <th className="px-4 py-3">Acesso</th>
            <th className="px-4 py-3 text-right">Configurar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const open = openUserId === user.id;
            return (
              <Fragment key={user.id}>
                <tr className={cn("border-t border-border/45 hover:bg-neon-cyan/5", open && "bg-neon-cyan/5")}>
                  <td className="px-4 py-3">
                    <div className="font-bold">{user.name || "Sem nome"}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{user.email || "-"}</div>
                  </td>
                  <td className="px-4 py-3"><AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge></td>
                  <td className="px-4 py-3"><AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>{statusLabel(user.subscriptionStatus)}</AdminBadge></td>
                  <td className="px-4 py-3">{formatDate(user.currentPeriodEnd)}</td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={user.isBlocked ? "blocked" : "active"}>{user.isBlocked ? "Bloqueado" : "Ativo"}</AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setOpenUserId(open ? "" : user.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-3 py-2 text-xs font-black text-neon-cyan hover:bg-neon-cyan/12"
                    >
                      <Settings2 className="size-3.5" />
                      {open ? "Fechar" : "Abrir"}
                      <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="border-t border-border/30">
                    <td colSpan={6} className="px-4 py-4">
                      <AdminUserDetailsPanel
                        user={user}
                        onEdit={onEdit}
                        onQuickAction={onQuickAction}
                        actionsDisabled={actionsDisabled(user)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("pt-BR");
}
