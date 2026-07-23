import { Link } from "@tanstack/react-router";
import { Check, Copy, Link2, Loader2, Power, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  blockAdminUser,
  changeAdminUserPlan,
  deleteAdminUser,
  extendAdminUserAccess,
  getAdminSalesSettings,
  listAdminUsers,
  unblockAdminUser,
  updateAdminSalesSettings,
  updateAdminUser,
} from "@/lib/adminApi";
import { effectiveAdminRole, readEffectiveAdminSession } from "@/lib/adminSession";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { AdminPanelCard } from "@/components/admin/AdminPanelCard";
import { AdminUserCard } from "@/components/admin/AdminUserCard";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";
import { AdminUserEditModal } from "@/components/admin/AdminUserEditModal";
import type { QuickAction } from "@/components/admin/AdminQuickActions";
import { buildWhatsAppUrl, getInternationalPhoneDigits } from "@/lib/phone";
import type { SalesSettings } from "@/lib/accessApi";
import type { AdminSession } from "@/types/admin";
import type { AdminManagedUser, AdminPanelOverview } from "@/types/adminPanel";

type FilterState = {
  search: string;
  plan: string;
  status: string;
  role: string;
  quick: "all" | "active" | "expired" | "blocked";
  sort: "recent" | "oldest" | "name" | "lastAccess";
};

const defaultFilters: FilterState = {
  search: "",
  plan: "all",
  status: "all",
  role: "all",
  quick: "all",
  sort: "recent",
};

export function AdminUsersPage() {
  const session = readEffectiveAdminSession();
  const [users, setUsers] = useState<AdminManagedUser[] | null>(null);
  const [overview, setOverview] = useState<AdminPanelOverview | null>(null);
  const [filters, setFilters] = useState(defaultFilters);
  const [selected, setSelected] = useState<AdminManagedUser | null>(null);
  const [loading, setLoading] = useState(Boolean(session));
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [salesSettings, setSalesSettings] = useState<SalesSettings>({
    salesClosed: false,
    mode: "open",
  });
  const [salesSaving, setSalesSaving] = useState(false);
  const [salesNotice, setSalesNotice] = useState("");
  const [exportNotice, setExportNotice] = useState("");

  const canOpen = Boolean(session);

  async function load() {
    if (!session) return;
    setLoading(true);
    setLoadError("");
    try {
      const data = await listAdminUsers(session);
      setUsers(data.users ?? []);
      setOverview(data.overview);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Não foi possível carregar usuários.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSalesSettings() {
    if (!session) return;
    try {
      setSalesSettings(await getAdminSalesSettings(session));
    } catch (err) {
      setSalesNotice(
        err instanceof Error ? err.message : "Não foi possível carregar status das vagas.",
      );
    }
  }

  useEffect(() => {
    if (canOpen) {
      void load();
      void loadSalesSettings();
    }
  }, [canOpen]);

  const filteredUsers = useMemo(
    () => (users === null ? [] : applyFilters(users, filters)),
    [users, filters],
  );
  const groupedUsers = useMemo(() => splitClientGroups(filteredUsers), [filteredUsers]);
  const realOverview = useMemo(
    () => (users === null ? null : buildOverviewFromUsers(users, overview ?? undefined)),
    [users, overview],
  );
  const hasLoadedUsers = users !== null;
  const initialLoading = loading && !hasLoadedUsers;
  const refreshing = loading && hasLoadedUsers;
  const unavailable = Boolean(loadError) && !hasLoadedUsers;

  if (!canOpen) {
    return (
      <GlassCard className="mx-auto max-w-2xl border-destructive/35">
        <SectionTitle title="Acesso administrativo bloqueado" />
        <p className="text-sm text-muted-foreground">
          Esta área existe somente para usuários com permissão admin ou owner.
        </p>
        <Link
          to="/app/admin"
          className="mt-4 inline-flex rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 px-4 py-3 text-sm font-black text-neon-cyan"
        >
          Fazer login administrativo
        </Link>
      </GlassCard>
    );
  }

  const role = effectiveAdminRole(session);

  async function handleSalesSettingsChange(nextClosed: boolean) {
    if (!session || salesSaving || salesSettings.salesClosed === nextClosed) return;
    setSalesSaving(true);
    setSalesNotice("");
    const previous = salesSettings;
    setSalesSettings({
      ...previous,
      salesClosed: nextClosed,
      mode: nextClosed ? "closed" : "open",
    });
    try {
      const updated = await updateAdminSalesSettings(session, { salesClosed: nextClosed });
      setSalesSettings(updated);
      setSalesNotice(
        nextClosed
          ? "Vagas encerradas. Novos cadastros e checkout foram bloqueados."
          : "Vagas abertas. Cadastro e checkout foram liberados.",
      );
    } catch (err) {
      setSalesSettings(previous);
      setSalesNotice(err instanceof Error ? err.message : "Não foi possível atualizar as vagas.");
    } finally {
      setSalesSaving(false);
    }
  }

  async function saveUser(payload: Partial<AdminManagedUser> & { reason?: string }) {
    if (!session || !selected) return;
    setBusy(true);
    setError("");
    setSuccessNotice("");
    try {
      const updated = await updateAdminUser(session, selected.id, payload);
      setUsers((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      setSelected(null);
      setSuccessNotice("Alteracoes salvas com sucesso.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar usuário.");
    } finally {
      setBusy(false);
    }
  }

  async function copyRemarketingContacts(kind: "numbers" | "links") {
    setExportNotice("");
    const source = groupedUsers.nonClients;
    const rows = source
      .map((user) => {
        if (kind === "numbers") {
          const digits = getInternationalPhoneDigits(user.phoneFull || user.phone, user.countryCode);
          return digits ? `+${digits}` : "";
        }
        return buildWhatsAppUrl(user.phoneFull || user.phone, user.countryCode);
      })
      .filter(Boolean);

    if (!rows.length) {
      setExportNotice("Nenhum WhatsApp encontrado nos não clientes filtrados.");
      return;
    }

    try {
      await navigator.clipboard.writeText(rows.join("\n"));
      setExportNotice(
        kind === "numbers"
          ? `${rows.length} número(s) copiado(s).`
          : `${rows.length} link(s) wa.me copiado(s).`,
      );
    } catch {
      setExportNotice("Não foi possível copiar automaticamente. Abra o navegador e tente de novo.");
    }
  }

  async function runQuickAction(action: QuickAction, user: AdminManagedUser) {
    if (!session) return;
    if (action === "deleteUser") {
      if (role !== "owner") {
        setError("Apenas owner pode excluir cadastros definitivamente.");
        return;
      }
      const confirmed = window.confirm(
        `Excluir definitivamente o cadastro de ${user.email}? Esta ação remove o usuário do painel e do banco persistente.`,
      );
      if (!confirmed) return;
    }
    setBusy(true);
    setError("");
    setSuccessNotice("");
    try {
      if (action === "deleteUser") {
        await deleteAdminUser(session, user.id, "Excluir cadastro sem pagamento");
        const deletedEmail = user.email.trim().toLowerCase();
        setUsers((current) =>
          current?.filter(
            (item) => item.id !== user.id && item.email.trim().toLowerCase() !== deletedEmail,
          ) ?? null,
        );
        if (selected?.id === user.id) setSelected(null);
        setSuccessNotice("Cadastro excluido com sucesso.");
        return;
      }
      const updated = await performQuickAction(session, user, action);
      setUsers((current) =>
        current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      if (selected?.id === updated.id) setSelected(updated);
      setSuccessNotice(successMessageForAction(action));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao executar ação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPanelCard
        overview={realOverview}
        loading={initialLoading}
        unavailable={unavailable}
      />

      <AdminSalesControlCard
        settings={salesSettings}
        saving={salesSaving}
        notice={salesNotice}
        onChange={handleSalesSettingsChange}
      />

      <GlassCard className="border-neon-cyan/25">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <SectionTitle
            title="GERENCIAR USUÁRIOS"
            subtitle="Busque, filtre, aprove, prorrogue e bloqueie acessos."
            right={<ShieldCheck className="size-5 text-neon-cyan" />}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyRemarketingContacts("numbers")}
              className="glass inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-success"
            >
              <Copy className="size-4" />
              Copiar números
            </button>
            <button
              type="button"
              onClick={() => void copyRemarketingContacts("links")}
              className="glass inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-neon-cyan"
            >
              <Link2 className="size-4" />
              Copiar wa.me
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setError("");
                setSuccessNotice("");
                void load();
                void loadSalesSettings();
              }}
              className="glass inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-neon-cyan disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr_0.9fr_0.9fr]">
          <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/25 px-3 py-2 focus-within:border-neon-cyan/70">
            <Search className="size-4 text-neon-cyan" />
            <input
              value={filters.search}
              onChange={(event) => setFilters({ ...filters, search: event.target.value })}
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Buscar nome, e-mail ou WhatsApp"
            />
          </label>
          <FilterSelect
            label="Plano"
            value={filters.plan}
            onChange={(plan) => setFilters({ ...filters, plan })}
            options={["all", "free", "trial", "monthly", "premium", "vip_manual"]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(status) => setFilters({ ...filters, status })}
            options={["all", "trial", "active", "expired", "canceled", "blocked", "manual_vip"]}
          />
          <FilterSelect
            label="Perfil"
            value={filters.role}
            onChange={(roleValue) => setFilters({ ...filters, role: roleValue })}
            options={["all", "user", "admin", "owner"]}
          />
          <FilterSelect
            label="Filtro"
            value={filters.quick}
            onChange={(quick) => setFilters({ ...filters, quick: quick as FilterState["quick"] })}
            options={["all", "active", "expired", "blocked"]}
          />
          <FilterSelect
            label="Ordem"
            value={filters.sort}
            onChange={(sort) => setFilters({ ...filters, sort: sort as FilterState["sort"] })}
            options={["recent", "oldest", "name", "lastAccess"]}
          />
        </div>

        {initialLoading && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-3 py-3 text-sm font-semibold text-neon-cyan"
          >
            <Loader2 className="size-4 animate-spin" />
            Carregando os cadastros confirmados…
          </div>
        )}
        {refreshing && (
          <div
            role="status"
            className="mt-4 flex items-center gap-2 rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-2 text-xs font-semibold text-neon-cyan"
          >
            <Loader2 className="size-3.5 animate-spin" />
            Atualizando em segundo plano. A última lista confirmada continua visível.
          </div>
        )}
        {loadError && (
          <div
            role="alert"
            className="mt-4 flex flex-col gap-3 rounded-xl border border-warning/35 bg-warning/10 px-3 py-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="font-black">
                {hasLoadedUsers
                  ? "Atualização temporariamente indisponível"
                  : "Cadastros temporariamente indisponíveis"}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {loadError}
                {hasLoadedUsers
                  ? " A última lista confirmada foi preservada abaixo."
                  : " Nenhuma contagem foi presumida enquanto a fonte não responder."}
              </p>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load()}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs font-black text-warning transition hover:bg-warning/15 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              Tentar novamente
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {successNotice && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {successNotice}
          </div>
        )}
        {exportNotice && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm font-semibold text-success">
            {exportNotice}
          </div>
        )}
      </GlassCard>

      <div className="grid min-w-0 gap-5">
        <UserGroupSection
          title="Clientes"
          subtitle="Pagantes, aprovados ou premium com acesso ativo."
          users={groupedUsers.clients}
          state={initialLoading ? "loading" : unavailable ? "unavailable" : "ready"}
          emptyMessage="Nenhum cliente pagante encontrado com os filtros atuais."
          onEdit={setSelected}
          onQuickAction={(action, user) => void runQuickAction(action, user)}
          actionsDisabled={(user) => busy || !canRunUserAction(role, user)}
        />
        <UserGroupSection
          title="Não clientes"
          subtitle="Free, trial, pendentes ou sem pagamento ativo."
          users={groupedUsers.nonClients}
          state={initialLoading ? "loading" : unavailable ? "unavailable" : "ready"}
          emptyMessage="Nenhum cadastro free/pendente encontrado com os filtros atuais."
          onEdit={setSelected}
          onQuickAction={(action, user) => void runQuickAction(action, user)}
          actionsDisabled={(user) => busy || !canRunUserAction(role, user)}
        />
      </div>

      {users !== null && !loading && filteredUsers.length === 0 && (
        <GlassCard className="text-center text-sm text-muted-foreground">
          Nenhum usuário encontrado com os filtros atuais.
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

function buildOverviewFromUsers(
  users: AdminManagedUser[],
  overview?: AdminPanelOverview,
): AdminPanelOverview {
  const now = Date.now();
  const clientUsers = users.filter((user) => user.role === "user");
  const activeUsers = clientUsers.filter((user) => isActiveUser(user, now));
  const paidUsers = activeUsers.filter(
    (user) => user.subscriptionStatus === "active" || user.subscriptionStatus === "manual_vip",
  );
  const trialUsers = activeUsers.filter(
    (user) => user.plan === "trial" || user.subscriptionStatus === "trial",
  );
  const premiumUsers = activeUsers.filter(
    (user) => user.plan === "premium" || user.plan === "vip_manual",
  );

  return {
    engineStatus: overview?.engineStatus || "Online",
    tableStatus: overview?.tableStatus || "Conectada",
    activeUsers: activeUsers.length,
    activeSubscriptions: paidUsers.length,
    activeTrials: trialUsers.length,
    premiumUsers: premiumUsers.length,
    onlineNow: countOnlineUsers(clientUsers),
    lastSignal: overview?.lastSignal || "Aguardando",
    lastSignalAt: overview?.lastSignalAt || "sem sinal",
  };
}

function AdminSalesControlCard({
  settings,
  saving,
  notice,
  onChange,
}: {
  settings: SalesSettings;
  saving: boolean;
  notice: string;
  onChange: (salesClosed: boolean) => void;
}) {
  const closed = settings.salesClosed;
  return (
    <GlassCard className={`border ${closed ? "border-destructive/35" : "border-success/30"}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex size-10 items-center justify-center rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan">
              <Settings2 className="size-4" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neon-cyan">
                Chave de vagas
              </div>
              <h2 className="mt-1 text-lg font-black">Liberar ou fechar novos cadastros</h2>
            </div>
            <AppBadge tone={closed ? "red" : "green"} pulse>
              {closed ? "Vagas encerradas" : "Vagas abertas"}
            </AppBadge>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {closed
              ? "Novos cadastros, planos e checkout ficam bloqueados. Clientes liberados continuam entrando."
              : "Cadastro, planos e checkout estao liberados para novos clientes."}
          </p>
          {settings.updated_at && (
            <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Última alteração: {formatDateTime(settings.updated_at)}
            </div>
          )}
          {notice && (
            <div className="mt-3 rounded-xl border border-neon-cyan/25 bg-neon-cyan/8 px-3 py-2 text-xs font-semibold text-neon-cyan">
              {notice}
            </div>
          )}
          {(settings.warning || settings.persistence === "temporary") && (
            <div className="mt-3 rounded-xl border border-warning/35 bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
              {settings.warning || "Atenção: esta chave ainda não foi confirmada em armazenamento fixo."}
            </div>
          )}
        </div>

        <div className="grid min-w-full grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-secondary/30 p-1 sm:min-w-[340px]">
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange(false)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-60 ${
              !closed
                ? "border border-success/40 bg-success/20 text-success"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            {saving && closed ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            Vagas abertas
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onChange(true)}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition disabled:opacity-60 ${
              closed
                ? "border border-destructive/40 bg-destructive/18 text-destructive"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            }`}
          >
            {saving && !closed ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
            Vagas encerradas
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function isActiveUser(user: AdminManagedUser, now = Date.now()) {
  if (user.isBlocked) return false;
  if (!["active", "manual_vip", "trial"].includes(user.subscriptionStatus)) return false;
  return parseAccessDate(user.currentPeriodEnd) > now;
}

function parseAccessDate(value: string) {
  if (!value) return 0;
  const normalized = value.includes("T") ? value : `${value}T23:59:59`;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function countOnlineUsers(users: AdminManagedUser[]) {
  return users.filter((user) => isRecentAccessLabel(user.lastAccess)).length;
}

function isRecentAccessLabel(value: string) {
  const label = value.trim().toLowerCase();
  if (!label) return false;
  if (label === "agora") return true;
  const minutes = label.match(/h[aá]\s+(\d+)\s+min/i);
  if (!minutes) return false;
  return Number(minutes[1]) < 5;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function UserGroupSection({
  title,
  subtitle,
  users,
  state,
  emptyMessage,
  onEdit,
  onQuickAction,
  actionsDisabled,
}: {
  title: string;
  subtitle: string;
  users: AdminManagedUser[];
  state: "loading" | "unavailable" | "ready";
  emptyMessage: string;
  onEdit: (user: AdminManagedUser) => void;
  onQuickAction: (action: QuickAction, user: AdminManagedUser) => void;
  actionsDisabled: (user: AdminManagedUser) => boolean;
}) {
  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-end justify-between gap-3 border-b border-border/50 pb-2">
        <div>
          <h2 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
            {title}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-xs font-black text-neon-cyan">
          {state === "loading" ? "..." : state === "unavailable" ? "—" : users.length}
        </span>
      </div>

      {state === "loading" ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 rounded-2xl border border-neon-cyan/20 bg-neon-cyan/5 px-4 py-6 text-sm font-semibold text-neon-cyan"
        >
          <Loader2 className="size-4 animate-spin" />
          Carregando cadastros…
        </div>
      ) : state === "unavailable" ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/8 px-4 py-6 text-center text-sm text-muted-foreground">
          Contagem indisponível até a fonte de cadastros responder.
        </div>
      ) : users.length > 0 ? (
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
      <select
        className="w-full bg-transparent text-sm outline-none"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {optionLabel(option, label)}
          </option>
        ))}
      </select>
    </label>
  );
}

function optionLabel(option: string, fallbackLabel: string) {
  const labels: Record<string, string> = {
    all: fallbackLabel,
    free: "Free",
    trial: "Trial",
    monthly: "Mensal",
    premium: "Premium",
    vip_manual: "VIP manual",
    active: "Ativos",
    expired: "Vencidos",
    canceled: "Cancelados",
    blocked: "Bloqueados",
    manual_vip: "VIP manual",
    user: "Cliente",
    admin: "Admin",
    owner: "Owner",
    recent: "Mais recentes",
    oldest: "Mais antigos",
    name: "Nome A-Z",
    lastAccess: "Ultimo acesso",
  };
  return labels[option] || option;
}

function applyFilters(users: AdminManagedUser[], filters: FilterState) {
  const search = filters.search.trim().toLowerCase();
  const now = Date.now();
  return users.filter((user) => {
    if (
      search &&
      !`${user.name} ${user.email} ${user.phone} ${user.phoneFull} ${user.countryCode} ${user.country} ${user.city}`
        .toLowerCase()
        .includes(search)
    )
      return false;
    if (filters.plan !== "all" && user.plan !== filters.plan) return false;
    if (filters.status !== "all" && user.subscriptionStatus !== filters.status) return false;
    if (filters.role !== "all" && user.role !== filters.role) return false;
    if (
      filters.quick === "active" &&
      (user.isBlocked || parseAccessDate(user.currentPeriodEnd) <= now)
    )
      return false;
    if (filters.quick === "expired" && parseAccessDate(user.currentPeriodEnd) > now) return false;
    if (filters.quick === "blocked" && !user.isBlocked) return false;
    return true;
  }).sort((a, b) => compareUsers(a, b, filters.sort));
}

function compareUsers(
  a: AdminManagedUser,
  b: AdminManagedUser,
  sort: FilterState["sort"],
) {
  if (sort === "name") return a.name.localeCompare(b.name);
  if (sort === "oldest") return parseAccessDate(a.createdAt) - parseAccessDate(b.createdAt);
  if (sort === "lastAccess") return accessLabelScore(a.lastAccess) - accessLabelScore(b.lastAccess);
  return parseAccessDate(b.createdAt) - parseAccessDate(a.createdAt);
}

function accessLabelScore(value: string) {
  const label = value.trim().toLowerCase();
  if (!label) return Number.MAX_SAFE_INTEGER;
  if (label === "agora") return 0;
  const minutes = label.match(/h[aÃ¡]\s+(\d+)\s+min/i);
  if (minutes) return Number(minutes[1]);
  const hours = label.match(/h[aÃ¡]\s+(\d+)\s+h/i);
  if (hours) return Number(hours[1]) * 60;
  const days = label.match(/h[aÃ¡]\s+(\d+)\s+d/i);
  if (days) return Number(days[1]) * 24 * 60;
  return Number.MAX_SAFE_INTEGER;
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
  if (parseAccessDate(user.currentPeriodEnd) <= Date.now()) return false;
  if (user.subscriptionStatus === "active" || user.subscriptionStatus === "manual_vip") return true;
  return user.plan === "monthly" || user.plan === "premium" || user.plan === "vip_manual";
}

function canRunUserAction(currentAdminRole: "admin" | "owner", user: AdminManagedUser) {
  return currentAdminRole === "owner" || user.role === "user";
}

async function performQuickAction(
  session: AdminSession,
  user: AdminManagedUser,
  action: QuickAction,
) {
  const now = new Date();
  const end = (days: number) => addDays(now, days);
  if (action === "trial7") {
    return changeAdminUserPlan(session, user.id, {
      plan: "trial",
      subscriptionStatus: "trial",
      currentPeriodEnd: end(7),
      reason: "Liberar Trial 7 dias",
    });
  }
  if (action === "monthly30") {
    return changeAdminUserPlan(session, user.id, {
      plan: "monthly",
      subscriptionStatus: "active",
      currentPeriodEnd: end(30),
      reason: "Liberar Mensal 30 dias",
    });
  }
  if (action === "premium30") {
    return changeAdminUserPlan(session, user.id, {
      plan: "premium",
      subscriptionStatus: "active",
      currentPeriodEnd: end(30),
      reason: "Liberar Premium 30 dias",
    });
  }
  if (action === "vip30") {
    return changeAdminUserPlan(session, user.id, {
      plan: "vip_manual",
      subscriptionStatus: "manual_vip",
      currentPeriodEnd: end(30),
      reason: "Liberar VIP Manual 30 dias",
    });
  }
  if (action === "extend7") return extendAdminUserAccess(session, user.id, 7, "Prorrogar +7 dias");
  if (action === "extend15")
    return extendAdminUserAccess(session, user.id, 15, "Prorrogar +15 dias");
  if (action === "extend30")
    return extendAdminUserAccess(session, user.id, 30, "Prorrogar +30 dias");
  if (action === "extend90")
    return extendAdminUserAccess(session, user.id, 90, "Prorrogar +90 dias");
  if (action === "cancel")
    return updateAdminUser(session, user.id, {
      subscriptionStatus: "canceled",
      reason: "Cancelar acesso",
    });
  if (action === "block") return blockAdminUser(session, user.id);
  return unblockAdminUser(session, user.id);
}

function successMessageForAction(action: QuickAction) {
  const messages: Record<QuickAction, string> = {
    trial7: "Trial liberado com sucesso.",
    monthly30: "Mensal liberado com sucesso.",
    premium30: "Premium liberado com sucesso.",
    vip30: "VIP manual liberado com sucesso.",
    extend7: "Acesso prorrogado com sucesso.",
    extend15: "Acesso prorrogado com sucesso.",
    extend30: "Acesso prorrogado com sucesso.",
    extend90: "Acesso prorrogado com sucesso.",
    cancel: "Acesso cancelado com sucesso.",
    block: "Usuario bloqueado com sucesso.",
    unblock: "Usuario reativado com sucesso.",
    deleteUser: "Cadastro excluido com sucesso.",
  };
  return messages[action] || "Acao concluida com sucesso.";
}

function addDays(base: Date, days: number) {
  const date = new Date(base);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
