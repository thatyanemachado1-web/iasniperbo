import { Edit3, Mail } from "lucide-react";
import { AdminBadge, planLabel, planTone, roleTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import type { AdminManagedUser } from "@/types/adminPanel";

export function AdminUserCard({
  user,
  onEdit,
}: {
  user: AdminManagedUser;
  onEdit: (user: AdminManagedUser) => void;
}) {
  return (
    <article className="rounded-2xl border border-neon-cyan/15 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black">{user.name}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" />
            {user.email}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onEdit(user)}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan"
          aria-label={`Editar ${user.name}`}
        >
          <Edit3 className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge>
        <AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>{statusLabel(user.subscriptionStatus)}</AdminBadge>
        <AdminBadge tone={roleTone(user.role)}>{user.role}</AdminBadge>
        {user.isBlocked && <AdminBadge tone="blocked">Bloqueado</AdminBadge>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <Info label="Validade" value={formatDate(user.currentPeriodEnd)} />
        <Info label="Criado em" value={formatDate(user.createdAt)} />
        <Info label="Ultimo acesso" value={user.lastAccess || "Sem registro"} />
        <Info label="Status" value={user.isBlocked ? "Bloqueado" : "Ativo"} />
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-secondary/25 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("pt-BR");
}
