import { CalendarClock, FileText, Settings2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { AdminBadge, planLabel, planTone, roleTone, statusLabel, statusTone } from "@/components/admin/AdminBadge";
import { AdminQuickActions, type QuickAction } from "@/components/admin/AdminQuickActions";
import { cn } from "@/lib/utils";
import type { AdminManagedUser } from "@/types/adminPanel";

type DetailTab = "resumo" | "acesso" | "acoes" | "nota";

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "acesso", label: "Acesso" },
  { id: "acoes", label: "Ações" },
  { id: "nota", label: "Nota" },
];

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
  const [tab, setTab] = useState<DetailTab>("resumo");

  return (
    <div className="rounded-2xl border border-neon-cyan/15 bg-background/55 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <AdminBadge tone={planTone(user.plan)}>{planLabel(user.plan)}</AdminBadge>
          <AdminBadge tone={statusTone(user.subscriptionStatus, user.isBlocked)}>{statusLabel(user.subscriptionStatus)}</AdminBadge>
          <AdminBadge tone={roleTone(user.role)}>{user.role}</AdminBadge>
          {user.isBlocked && <AdminBadge tone="blocked">Bloqueado</AdminBadge>}
        </div>
        <button
          type="button"
          onClick={() => onEdit(user)}
          className="rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-3 py-2 text-xs font-black text-neon-cyan hover:bg-neon-cyan/12"
        >
          Editar completo
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 rounded-xl border border-border/55 bg-black/20 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-[0.14em] transition",
              tab === item.id
                ? "bg-neon-cyan/12 text-neon-cyan shadow-[0_0_18px_-12px_rgba(0,229,255,0.8)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "resumo" && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Info icon={<ShieldCheck className="size-4" />} label="E-mail" value={user.email || "-"} />
            <Info icon={<CalendarClock className="size-4" />} label="Criado em" value={formatDate(user.createdAt)} />
            <Info icon={<CalendarClock className="size-4" />} label="Último acesso" value={user.lastAccess || "Sem registro"} />
            <Info icon={<Settings2 className="size-4" />} label="Role" value={user.role} />
          </div>
        )}

        {tab === "acesso" && (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Info label="Plano atual" value={planLabel(user.plan)} />
            <Info label="Status" value={statusLabel(user.subscriptionStatus)} />
            <Info label="Início" value={formatDate(user.currentPeriodStart)} />
            <Info label="Validade" value={formatDate(user.currentPeriodEnd)} />
            <Info label="Acesso" value={user.isBlocked ? "Bloqueado" : "Ativo"} />
            <Info label="Pode acessar sinais" value={hasLiveAccess(user) ? "Sim" : "Não"} />
          </div>
        )}

        {tab === "acoes" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Use essas ações para liberar, prorrogar, bloquear ou reativar o acesso sem poluir a lista principal.
            </p>
            <AdminQuickActions disabled={actionsDisabled} onAction={(action) => onQuickAction(action, user)} compact />
          </div>
        )}

        {tab === "nota" && (
          <div className="rounded-xl border border-border/45 bg-secondary/20 p-3">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              <FileText className="size-4 text-neon-cyan" />
              Observação interna
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-foreground/85">
              {user.adminNote || "Nenhuma observação registrada para este cliente."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border/45 bg-secondary/18 px-3 py-2">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-bold text-foreground/90">{value}</div>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleDateString("pt-BR");
}

function hasLiveAccess(user: AdminManagedUser) {
  if (user.isBlocked) return false;
  if (!["active", "manual_vip", "trial"].includes(user.subscriptionStatus)) return false;
  const end = Date.parse(user.currentPeriodEnd);
  return Number.isFinite(end) && end > Date.now();
}
