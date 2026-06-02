import { Link } from "@tanstack/react-router";
import { RefreshCw, Search, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  blockAdminUser,
  changeAdminUserPlan,
  changeAdminUserRole,
  extendAdminUserAccess,
  listAdminUsers,
  unblockAdminUser,
  updateAdminUser,
} from "@/lib/adminApi";
import { effectiveAdminRole, readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AdminPanelCard } from "@/components/admin/AdminPanelCard";
import { AdminUserCard } from "@/components/admin/AdminUserCard";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminUserEditModal } from "@/components/admin/AdminUserEditModal";
import type { QuickAction } from "@/components/admin/AdminQuickActions";
import type { AdminSession } from "@/types/admin";
import type { AdminManagedUser, AdminPanelOverview } from "@/types/adminPanel";

type FilterState = {
  search: string;
  plan: string;
  status: string;
  role: string;
  quick: "all" | "active" | "expired" | "blocked";
};

const defaultFilters: FilterState = {
  search: "",
  plan: "all",
  status: "all",
  role: "all",
  quick: "all",
};

export function AdminUsersPage() {
  const session = readEffectiveAdminSession();
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [overview, setOverview] = useState<AdminPanelOverview | undefined>();
  const [filters, setFilters] = useState(defaultFilters);
  const [selected, setSelected] = useState<AdminManagedUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const canOpen = Boolean(session);

  async function load() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const data = await listAdminUsers(session);
      setUsers(data.users ?? []);
      setOverview(data.overview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canOpen) void load();
  }, [canOpen]);

  const filteredUsers = useMemo(() => applyFilters(users, filters), [users, filters]);
  const groupedUsers = useMemo(() => splitClientGroups(filteredUsers), [filteredUsers]);

  if (!canOpen) {
    return (
      <GlassCard className="mx-auto max-w-2xl border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">
          Esta area existe somente para usuarios com permissao admin ou owner.
        </p>
        <Link to="/app/admin" className="mt-4 inline-flex rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 text-sm font-black text-neon-cyan">
          Fazer login administrativo
        </Link>
      </GlassCard>
    );
  }

  const role = effectiveAdminRole(session);

  async function saveUser(payload: Partial<AdminManagedUser> & { reason?: string }) {
    if (!session || !selected) return;
    setBusy(true);
    setError("");
    try {
      const updated = await updateAdminUser(session, selected.id, payload);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuario.");
    } finally {
      setBusy(false);
    }
  }

  async function runQuickAction(action: QuickAction, user: AdminManagedUser) {
    if (!session) return;
    setBusy(true);
    setError("");
    try {
      const updated = await performQuickAction(session, user, action);
      setUsers((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      if (selected?.id === updated.id) setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar acao.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPanelCard overview={overview} />

      <GlassCard className="border-neon-cyan/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle
            title="GERENCIAR USUARIOS"
            subtitle="Busque, filtre, aprove, prorrogue e bloqueie acessos."
            right={<ShieldCheck className="size-5 text-neon-cyan" />}
          />
          <button
            type="button"
            onClick={() => void load()}
            className="glass inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-neon-cyan"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.9fr]">
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 focus-within:border-neon-cyan/70">
            <Search className="size-4 text-neon-cyan" />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Buscar por nome/email"
            />
          </label>
          <FilterSelect label="Plano" value={filters.plan} onChange={(plan) => setFilters({ ...filters, plan })} options={["all", "free", "trial", "monthly", "premium", "vip_manual"]} />
          <FilterSelect label="Status" value={filters.status} onChange={(status) => setFilters({ ...filters, status })} options={["all", "trial", "active", "expired", "canceled", "blocked", "manual_vip"]} />
          <FilterSelect label="Role" value={filters.role} onChange={(roleValue) => setFilters({ ...filters, role: roleValue })} options={["all", "user", "admin", "owner"]} />
          <FilterSelect label="Filtro" value={filters.quick} onChange={(quick) => setFilters({ ...filters, quick: quick as FilterState["quick"] })} options={["all", "active", "expired", "blocked"]} />
        </div>

        {error && <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <UserGroupSection
          title="Clientes"
          subtitle="Pagantes, aprovados ou premium com acesso ativo."
          users={groupedUsers.clients}
          emptyMessage="Nenhum cliente pagante encontrado com os filtros atuais."
          onEdit={setSelected}
          onQuickAction={(action, user) => void runQuickAction(action, user)}
          actionsDisabled={(user) => busy || !canRunUserAction(role, user)}
        />
        <UserGroupSection
          title="Nao clientes"
          subtitle="Free, trial, pendentes ou sem pagamento ativo."
          users={groupedUsers.nonClients}
          emptyMessage="Nenhum cadastro free/pendente encontrado com os filtros atuais."
          onEdit={setSelected}
          onQuickAction={(action, user) => void runQuickAction(action, user)}
          actionsDisabled={(user) => busy || !canRunUserAction(role, user)}
        />
      </div>

      {!loading && filteredUsers.length === 0 && (
        <GlassCard className="text-center text-sm text-muted-foreground">
          Nenhum usuario encontrado com os filtros atuais.
        </GlassCard>
      )}

      <AdminUserEditModal
        user={selected}
        currentAdminRole={role}
        busy={busy}
        error={error}
        onClose={() => setSelected(null)}
        onSave={saveUser}
        onQuickAction={runQuickAction}
      />
    </div>
  );
}

function UserGroupSection({
  title,
  subtitle,
  users,
  emptyMessage,
  onEdit,
  onQuickAction,
  actionsDisabled,
}: {
  title: string;
  subtitle: string;
  users: AdminManagedUser[];
  emptyMessage: string;
  onEdit: (user: AdminManagedUser) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
  actionsDisabled: (user: AdminManagedUser) => boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 border-b border-border/50 pb-2">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-xs font-black text-neon-cyan">
          {users.length}
        </span>
      </div>

      {users.length > 0 ? (
        <>
          <AdminUsersTable
            users={users}
            onEdit={onEdit}
            onQuickAction={onQuickAction}
            actionsDisabled={actionsDisabled}
          />
          <div className="grid gap-3 lg:hidden">
            {users.map((user) => (
              <AdminUserCard
                key={user.id}
                user={user}
                onEdit={onEdit}
                onQuickAction={onQuickAction}
                actionsDisabled={actionsDisabled(user)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-border/55 bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )}
    </section>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2">
      <SlidersHorizontal className="size-4 text-neon-cyan" />
      <span className="sr-only">{label}</span>
      <select className="w-full bg-transparent text-sm outline-none" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option === "all" ? label : option}</option>
        ))}
      </select>
    </label>
  );
}

function applyFilters(users: AdminManagedUser[], filters: FilterState) {
  const search = filters.search.trim().toLowerCase();
  const now = Date.now();
  return users.filter((user) => {
    if (search && !`${user.name} ${user.email}`.toLowerCase().includes(search)) return false;
    if (filters.plan !== "all" && user.plan !== filters.plan) return false;
    if (filters.status !== "all" && user.subscriptionStatus !== filters.status) return false;
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (filters.quick === "active" && (user.isBlocked || Date.parse(user.currentPeriodEnd) <= now)) return false;
    if (filters.quick === "expired" && Date.parse(user.currentPeriodEnd) > now) return false;
    if (filters.quick === "blocked" && !user.isBlocked) return false;
    return true;
  });
}

function splitClientGroups(users: AdminManagedUser[]) {
  return users.reduce(
    (groups, user) => {
      if (isPayingClient(user)) {
        groups.clients.push(user);
      } else {
        groups.nonClients.push(user);
      }
      return groups;
    },
    { clients: [] as AdminManagedUser[], nonClients: [] as AdminManagedUser[] },
  );
}

function isPayingClient(user: AdminManagedUser) {
  if (user.isBlocked) return false;
  if (Date.parse(user.currentPeriodEnd) <= Date.now()) return false;
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "manual_vip") return true;
  return user.plan === "monthly" || user.plan === "premium" || user.plan === "vip_manual";
}

function canRunUserAction(currentAdminRole: "admin" | "owner", user: AdminManagedUser) {
  return currentAdminRole === "owner" || user.role === "user";
}

async function performQuickAction(session: AdminSession, user: AdminManagedUser, action: QuickAction) {
  const now = new Date();
  const end = (days: number) => addDays(now, days);
  if (action === "trial7") {
    return changeAdminUserPlan(session, user.id, { plan: "trial", subscriptionStatus: "trial", currentPeriodEnd: end(7), reason: "Liberar Trial 7 dias" });
  }
  if (action === "monthly30") {
    return changeAdminUserPlan(session, user.id, { plan: "monthly", subscriptionStatus: "active", currentPeriodEnd: end(30), reason: "Liberar Mensal 30 dias" });
  }
  if (action === "premium30") {
    return changeAdminUserPlan(session, user.id, { plan: "premium", subscriptionStatus: "active", currentPeriodEnd: end(30), reason: "Liberar Premium 30 dias" });
  }
  if (action === "vip30") {
    return changeAdminUserPlan(session, user.id, { plan: "vip_manual", subscriptionStatus: "manual_vip", currentPeriodEnd: end(30), reason: "Liberar VIP Manual 30 dias" });
  }
  if (action === "extend7") return extendAdminUserAccess(session, user.id, 7, "Prorrogar +7 dias");
  if (action === "extend15") return extendAdminUserAccess(session, user.id, 15, "Prorrogar +15 dias");
  if (action === "extend30") return extendAdminUserAccess(session, user.id, 30, "Prorrogar +30 dias");
  if (action === "extend90") return extendAdminUserAccess(session, user.id, 90, "Prorrogar +90 dias");
  if (action === "cancel") return updateAdminUser(session, user.id, { subscriptionStatus: "canceled", reason: "Cancelar acesso" });
  if (action === "block") return blockAdminUser(session, user.id);
  if (action === "unblock") return unblockAdminUser(session, user.id);
  if (action === "makeAdmin") return changeAdminUserRole(session, user.id, "admin");
  return changeAdminUserRole(session, user.id, "user");
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
