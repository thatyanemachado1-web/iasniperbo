import { Edit3 } from "lucide-react";
import { AdminBadge, planLabel, planTone, roleTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import type { AdminManagedUser } from "@/types/adminPanel";

export function AdminUsersTable({
  users,
  onEdit,
}: {
  users: AdminManagedUser[];
  onEdit: (user: AdminManagedUser) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-neon-cyan/15 bg-background/35 lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-secondary/40 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Plano</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Validade</th>
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Acesso</th>
            <th className="px-4 py-3">Criado em</th>
            <th className="px-4 py-3">Ultimo acesso</th>
            <th className="px-4 py-3 text-right">Editar</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-border/45 hover:bg-neon-cyan/5">
              <td className="px-4 py-3 font-bold">{user.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3"><AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge></td>
              <td className="px-4 py-3"><AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>{statusLabel(user.subscriptionStatus)}</AdminBadge></td>
              <td className="px-4 py-3">{formatDate(user.currentPeriodEnd)}</td>
              <td className="px-4 py-3"><AdminBadge tone={roleTone(user.role)}>{user.role}</AdminBadge></td>
              <td className="px-4 py-3">
                <AdminBadge tone={user.isBlocked ? "blocked" : "active"}>{user.isBlocked ? "Bloqueado" : "Ativo"}</AdminBadge>
              </td>
              <td className="px-4 py-3">{formatDate(user.createdAt)}</td>
              <td className="px-4 py-3">{user.lastAccess || "-"}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onEdit(user)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-3 py-2 text-xs font-black text-neon-cyan hover:bg-neon-cyan/15"
                >
                  <Edit3 className="size-3.5" />
                  Editar
                </button>
              </td>
            </tr>
          ))}
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
