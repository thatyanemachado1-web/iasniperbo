import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  clearAdminSession,
  adminLogin,
  createSignalRecipient,
  deleteSignalRecipient,
  getAdminSummary,
  getInitialApiUrl,
  listSecurityEvents,
  listSignalRecipients,
  readAdminSession,
  saveAdminSession,
  updateSignalRecipient,
  useLocalAdminApiUrl,
} from "@/lib/adminApi";
import { isAdminOwnerEmail, readUserSession, saveUserSession } from "@/lib/userSession";
import type { AdminSession, AdminSummary, RecipientKind, RecipientPlan, SecurityEvent, SecuritySummary, SignalRecipient } from "@/types/admin";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  Edit3,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Power,
  Radio,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  WifiOff,
  X,
} from "lucide-react";

export const Route = createFileRoute("/app/admin")({
  component: AdminPage,
});

const kindLabels: Record<RecipientKind, string> = {
  group: "Grupo",
  channel: "Canal",
  user: "Cliente",
};

const planLabels: Record<RecipientPlan, string> = {
  free: "Free",
  premium: "Premium",
  vip: "VIP",
};

const accessStatusLabels = {
  approved: "Aprovado",
  paused: "Pausado",
  pending: "Pendente",
};

type RecipientEditForm = {
  full_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  chat_id: string;
  kind: RecipientKind;
  plan: RecipientPlan;
  access_status: "approved" | "paused" | "pending";
  starts_at: string;
  validity_months: string;
  validity_days: string;
  expires_at: string;
  notes: string;
};

type AdminView = "resumo" | "clientes" | "seguranca";

function AdminPage() {
  const userSession = readUserSession();
  const [ownerEmail, setOwnerEmail] = useState(userSession.email);
  const canUseAdmin = isAdminOwnerEmail(ownerEmail);
  const canAttemptAdminLogin = true;
  const [session, setSession] = useState<AdminSession | null>(() =>
    isAdminOwnerEmail(userSession.email) ? readAdminSession() : null,
  );
  const [apiUrl, setApiUrl] = useState(() => readAdminSession()?.apiUrl || getInitialApiUrl());
  const [email, setEmail] = useState(() => readAdminSession()?.email || "");
  const [password, setPassword] = useState("");
  const [recipients, setRecipients] = useState<SignalRecipient[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securitySummary, setSecuritySummary] = useState<SecuritySummary>({
    total: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  });
  const [adminSummary, setAdminSummary] = useState<AdminSummary>(() => emptyAdminSummary());
  const [adminView, setAdminView] = useState<AdminView>("resumo");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [exported, setExported] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState<RecipientEditForm | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    chat_id: "",
    kind: "user" as RecipientKind,
    plan: "vip" as RecipientPlan,
    starts_at: "",
    validity_months: "1",
    validity_days: "30",
    expires_at: "",
    notes: "",
  });

  useEffect(() => {
    if (!canAttemptAdminLogin) {
      clearAdminSession();
      setSession(null);
    }
  }, [canAttemptAdminLogin]);

  const activeRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.enabled),
    [recipients],
  );
  const activeChatIds = useMemo(
    () => activeRecipients.map((recipient) => recipient.chat_id).filter(Boolean).join(","),
    [activeRecipients],
  );
  const vipClients = useMemo(
    () => recipients.filter((recipient) => recipient.plan === "vip" && recipient.enabled),
    [recipients],
  );
  const premiumClients = useMemo(
    () => recipients.filter((recipient) => recipient.plan === "premium" && recipient.enabled),
    [recipients],
  );
  const pendingClients = useMemo(
    () => recipients.filter((recipient) => recipient.access_status === "pending"),
    [recipients],
  );
  const formDates = useMemo(
    () => datesFromNewClientForm(form.starts_at, form.validity_months, form.validity_days),
    [form.starts_at, form.validity_months, form.validity_days],
  );

  async function refreshRecipients(currentSession = session) {
    if (!currentSession) return;
    setLoading(true);
    setError("");
    try {
      setRecipients(await listSignalRecipients(currentSession));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar destinatarios.");
      setSession(readAdminSession());
    } finally {
      setLoading(false);
    }
  }

  async function refreshSecurityEvents(currentSession = session) {
    if (!currentSession) return;
    try {
      const data = await listSecurityEvents(currentSession);
      setSecurityEvents(data.events ?? []);
      setSecuritySummary(
        data.summary ?? {
          total: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar alertas de seguranca.");
    }
  }

  async function refreshAdminSummary(currentSession = session) {
    if (!currentSession) return;
    try {
      setAdminSummary(await getAdminSummary(currentSession));
    } catch {
      setAdminSummary(summaryFromRecipients(recipients, securitySummary));
    }
  }

  useEffect(() => {
    if (canUseAdmin) {
      refreshRecipients();
      refreshSecurityEvents();
      refreshAdminSummary();
    }
  }, [canUseAdmin]);

  if (!canAttemptAdminLogin) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <GlassCard className="border-destructive/35">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl border border-destructive/40 bg-destructive/10 flex items-center justify-center">
              <ShieldCheck className="size-6 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.22em] text-destructive/80">
                ADM restrito
              </div>
              <h1 className="mt-1 text-2xl font-black">Acesso permitido somente ao dono</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Esta área aparece apenas para o email administrador autorizado.
              </p>
              <Link
                to="/"
                className="mt-4 inline-flex items-center justify-center rounded-xl border border-neon-cyan/30 px-4 py-2 text-sm font-bold text-neon-cyan hover:bg-neon-cyan/10"
              >
                Entrar com email autorizado
              </Link>
            </div>
          </div>
        </GlassCard>
      </div>
    );
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const logged = await adminLogin(apiUrl, email, password);
      saveUserSession(logged.email, {
        name: "Gabriel Mendes",
        accessMode: "full",
        accessStatus: "owner",
        plan: "vip",
        registered: true,
        approved: true,
      });
      saveAdminSession(logged);
      setOwnerEmail(logged.email);
      setSession(logged);
      setApiUrl(logged.apiUrl);
      setEmail(logged.email);
      setPassword("");
      await refreshRecipients(logged);
      await refreshSecurityEvents(logged);
      await refreshAdminSummary(logged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel entrar no admin.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAddRecipient(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving(true);
    setError("");
    try {
      const recipient = await createSignalRecipient(session, {
        ...form,
        name: form.full_name,
        starts_at: formDates.starts_at,
        validity_days: formDates.validity_days,
        expires_at: formDates.expires_at || form.expires_at,
        enabled: true,
        access_status: "approved",
      });
      setRecipients((current) => [...current, recipient]);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        city: "",
        country: "",
        chat_id: "",
        kind: "user",
        plan: "vip",
        starts_at: "",
        validity_months: "1",
        validity_days: "30",
        expires_at: "",
        notes: "",
      });
      await refreshAdminSummary(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipient(recipient: SignalRecipient) {
    if (!session) return;
    setError("");
    const nextEnabled = !recipient.enabled || isRecipientExpired(recipient);
    const startsAt = nextEnabled ? recipient.starts_at || todayIso() : recipient.starts_at;
    const expiresAt =
      nextEnabled && (!recipient.expires_at || isRecipientExpired(recipient))
        ? addMonthsIso(startsAt || todayIso(), 1)
        : recipient.expires_at;
    setRecipients((current) =>
      current.map((item) => (item.id === recipient.id ? { ...item, enabled: nextEnabled } : item)),
    );
    try {
      const updated = await updateSignalRecipient(session, recipient.id, {
        enabled: nextEnabled,
        access_status: nextEnabled ? "approved" : "paused",
        plan: nextEnabled && recipient.plan === "free" ? "premium" : recipient.plan,
        starts_at: startsAt,
        validity_days: nextEnabled ? daysBetweenIso(startsAt || todayIso(), expiresAt || addMonthsIso(todayIso(), 1)) : recipient.validity_days,
        expires_at: expiresAt,
      });
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? updated : item)),
      );
      await refreshAdminSummary(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel atualizar.");
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? recipient : item)),
      );
    }
  }

  async function removeRecipient(recipient: SignalRecipient) {
    if (!session) return;
    setError("");
    const previous = recipients;
    setRecipients((current) => current.filter((item) => item.id !== recipient.id));
    try {
      await deleteSignalRecipient(session, recipient.id);
      await refreshAdminSummary(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel remover.");
      setRecipients(previous);
    }
  }

  async function copyActiveChats() {
    if (!activeChatIds) return;
    await navigator.clipboard.writeText(`TELEGRAM_CHAT_IDS=${activeChatIds}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function exportClients(kind: "all" | "emails" | "phones") {
    if (kind === "emails") {
      const content = recipients.map((recipient) => recipient.email).filter(Boolean).join("\n");
      downloadText("sniper-clientes-emails.txt", content);
      setExported("Emails exportados");
      return;
    }
    if (kind === "phones") {
      const content = recipients.map((recipient) => recipient.phone).filter(Boolean).join("\n");
      downloadText("sniper-clientes-telefones.txt", content);
      setExported("Telefones exportados");
      return;
    }
    downloadText("sniper-clientes.csv", recipientsToCsv(recipients));
    setExported("Clientes exportados");
  }

  function startEdit(recipient: SignalRecipient) {
    setEditingId(recipient.id);
    setEditForm(recipientToEditForm(recipient));
  }

  function cancelEdit() {
    setEditingId("");
    setEditForm(null);
  }

  async function saveEdit(recipient: SignalRecipient) {
    if (!session || !editForm) return;
    setSaving(true);
    setError("");
    const updatedDates = datesFromEditForm(editForm);
    try {
      const updated = await updateSignalRecipient(session, recipient.id, {
        name: editForm.full_name,
        full_name: editForm.full_name,
        email: editForm.email,
        phone: editForm.phone,
        city: editForm.city,
        country: editForm.country,
        chat_id: editForm.chat_id,
        kind: editForm.kind,
        plan: editForm.plan,
        access_status: editForm.access_status,
        enabled: editForm.access_status === "approved",
        starts_at: updatedDates.starts_at,
        validity_days: updatedDates.validity_days,
        expires_at: updatedDates.expires_at,
        notes: editForm.notes,
      });
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? updated : item)),
      );
      cancelEdit();
      await refreshAdminSummary(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar edicao.");
    } finally {
      setSaving(false);
    }
  }

  async function quickApprove(recipient: SignalRecipient, months: number) {
    if (!session) return;
    setSaving(true);
    setError("");
    const startsAt = todayIso();
    const expiresAt = addMonthsIso(startsAt, months);
    try {
      const updated = await updateSignalRecipient(session, recipient.id, {
        enabled: true,
        access_status: "approved",
        plan: recipient.plan === "free" ? "premium" : recipient.plan,
        starts_at: startsAt,
        validity_days: daysBetweenIso(startsAt, expiresAt),
        expires_at: expiresAt,
      });
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? updated : item)),
      );
      await refreshAdminSummary(session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel liberar acesso.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearAdminSession();
    setSession(null);
    setRecipients([]);
    setSecurityEvents([]);
    setSecuritySummary({ total: 0, low: 0, medium: 0, high: 0, critical: 0 });
    setAdminSummary(emptyAdminSummary());
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <GlassCard className="border-neon-cyan/35">
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-2xl btn-primary-grad flex items-center justify-center glow-blue">
              <ShieldCheck className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-[0.22em] text-neon-cyan/80">
                Acesso restrito
              </div>
              <h1 className="mt-1 text-2xl font-black">Área do administrador</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre para liberar clientes VIP/Premium e controlar quem recebe os sinais.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Login admin"
            subtitle="Painel privado do dono do SNIPER BO."
            right={<AppBadge tone="blue">API local</AppBadge>}
          />
          <form className="space-y-3" onSubmit={handleLogin}>
            <AdminInput
              icon={<Server className="size-4" />}
              label="URL da API"
              value={apiUrl}
              onChange={setApiUrl}
              placeholder="http://127.0.0.1:8787"
            />
            <button
              type="button"
              onClick={() => {
                clearAdminSession();
                setSession(null);
                setApiUrl(useLocalAdminApiUrl());
                setError("");
              }}
              className="inline-flex w-full items-center justify-center rounded-xl border border-neon-cyan/30 px-3 py-2 text-xs font-bold text-neon-cyan hover:bg-neon-cyan/10"
            >
              Usar API local do bot
            </button>
            <AdminInput
              icon={<ShieldCheck className="size-4" />}
              label="Email admin"
              value={email}
              onChange={setEmail}
              placeholder="admin@sniperbo.local"
            />
            <AdminInput
              icon={<KeyRound className="size-4" />}
              label="Senha"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Senha cadastrada no bot"
            />
            {error && <StatusMessage tone="red" icon={<WifiOff className="size-4" />} text={error} />}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary-grad inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Entrar no painel
            </button>
          </form>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-muted-foreground">Admin conectado</div>
          <div className="text-xl font-black">Cantinho do administrador</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone="green" pulse>{activeRecipients.length} liberados</AppBadge>
          <AppBadge tone="gold">{vipClients.length} VIP</AppBadge>
          <AppBadge tone="purple">{premiumClients.length} Premium</AppBadge>
          <AppBadge tone="amber">{pendingClients.length} pendentes</AppBadge>
          <AppBadge tone="muted">{recipients.length} cadastros</AppBadge>
          <button
            type="button"
            onClick={() => {
              refreshRecipients();
              refreshSecurityEvents();
              refreshAdminSummary();
            }}
            className="glass inline-flex size-10 items-center justify-center rounded-xl hover:glow-blue"
            aria-label="Atualizar lista"
          >
            <RefreshCw className={`size-4 text-neon-cyan ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={logout}
            className="glass inline-flex size-10 items-center justify-center rounded-xl hover:glow-blue"
            aria-label="Sair do admin"
          >
            <Power className="size-4 text-destructive" />
          </button>
        </div>
      </div>

      {error && <StatusMessage tone="red" icon={<WifiOff className="size-4" />} text={error} />}
      {exported && <StatusMessage tone="green" icon={<Check className="size-4" />} text={exported} />}

      <div className="grid grid-cols-3 rounded-2xl border border-border/70 bg-secondary/30 p-1">
        <AdminTabButton active={adminView === "resumo"} onClick={() => setAdminView("resumo")}>
          Resumo
        </AdminTabButton>
        <AdminTabButton active={adminView === "clientes"} onClick={() => setAdminView("clientes")}>
          Clientes
        </AdminTabButton>
        <AdminTabButton active={adminView === "seguranca"} onClick={() => setAdminView("seguranca")}>
          Seguranca
        </AdminTabButton>
      </div>

      {adminView === "resumo" && <AdminSummaryPanel summary={adminSummary} />}

      {adminView === "seguranca" && (
      <GlassCard className="py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
              Seguranca
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <AppBadge tone="muted">{securitySummary.total} rastros</AppBadge>
              <AppBadge tone={securitySummary.critical ? "red" : "muted"}>
                {securitySummary.critical} criticos
              </AppBadge>
              <AppBadge tone={securitySummary.high ? "amber" : "muted"}>
                {securitySummary.high} altos
              </AppBadge>
            </div>
          </div>
          <button
            type="button"
            onClick={() => refreshSecurityEvents()}
            className="glass inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan hover:glow-blue"
          >
            <RefreshCw className="size-3.5" /> Atualizar rastros
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {securityEvents.length === 0 && (
            <div className="rounded-xl border border-border/60 bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
              Nenhuma tentativa suspeita registrada nesta execucao da API.
            </div>
          )}
          {securityEvents.slice(0, 5).map((event) => (
            <div
              key={event.id}
              className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <AppBadge tone={securityTone(event.severity)}>{event.severity}</AppBadge>
                  <span className="truncate text-xs font-bold">{securityTypeLabel(event.type)}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {formatDateTimeBR(event.created_at)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>IP {event.client_ip || "unknown"}</span>
                <span>{event.method} {event.path}</span>
                {event.email && <span>{event.email}</span>}
              </div>
              {event.reason && <div className="mt-1 text-[11px] text-muted-foreground">{event.reason}</div>}
            </div>
          ))}
        </div>
      </GlassCard>
      )}

      {adminView === "clientes" && (
        <>
      <GlassCard className="py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-neon-cyan">
              Exportacao de clientes
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Baixe a lista completa em CSV ou gere listas simples de emails e telefones.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => exportClients("all")}
              className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan hover:glow-blue"
            >
              <Download className="size-3.5" /> Todos CSV
            </button>
            <button
              type="button"
              onClick={() => exportClients("emails")}
              className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan hover:glow-blue"
            >
              <Mail className="size-3.5" /> Emails
            </button>
            <button
              type="button"
              onClick={() => exportClients("phones")}
              className="glass inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan hover:glow-blue"
            >
              <Phone className="size-3.5" /> Telefones
            </button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 xl:grid-cols-[0.78fr_1.22fr] gap-4">
        <GlassCard>
          <SectionTitle
            title="Adicionar cliente"
            subtitle="Cadastre quem comprou; o painel calcula a validade do plano automaticamente."
            right={<UserPlus className="size-4 text-neon-cyan" />}
          />
          <form className="space-y-3" onSubmit={handleAddRecipient}>
            <AdminInput
              icon={<Users className="size-4" />}
              label="Nome completo"
              value={form.full_name}
              onChange={(value) => setForm((current) => ({ ...current, full_name: value }))}
              placeholder="Nome do cliente"
            />
            <AdminInput
              icon={<Mail className="size-4" />}
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
              placeholder="cliente@email.com"
            />
            <AdminInput
              icon={<Phone className="size-4" />}
              label="Telefone"
              value={form.phone}
              onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
              placeholder="+55 11 99999-9999"
            />
            <div className="grid grid-cols-2 gap-2">
              <AdminInput
                icon={<MapPin className="size-4" />}
                label="Cidade"
                value={form.city}
                onChange={(value) => setForm((current) => ({ ...current, city: value }))}
                placeholder="São Paulo"
              />
              <AdminInput
                icon={<Globe2 className="size-4" />}
                label="País"
                value={form.country}
                onChange={(value) => setForm((current) => ({ ...current, country: value }))}
                placeholder="Brasil"
              />
            </div>
            <AdminInput
              icon={<Radio className="size-4" />}
              label="Chat ID Telegram opcional"
              value={form.chat_id}
              onChange={(value) => setForm((current) => ({ ...current, chat_id: value }))}
              placeholder="-1001234567890 para receber sinais"
            />
            <div className="grid grid-cols-2 gap-2">
              <AdminSelect
                label="Tipo"
                value={form.kind}
                onChange={(value) => setForm((current) => ({ ...current, kind: value as RecipientKind }))}
                options={kindLabels}
              />
              <AdminSelect
                label="Plano"
                value={form.plan}
                onChange={(value) => setForm((current) => ({ ...current, plan: value as RecipientPlan }))}
                options={planLabels}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <AdminInput
                icon={<CalendarDays className="size-4" />}
                label="Data início"
                type="date"
                value={form.starts_at}
                onChange={(value) => setForm((current) => ({ ...current, starts_at: value }))}
              />
              <AdminInput
                icon={<CalendarDays className="size-4" />}
                label="Meses"
                type="number"
                value={form.validity_months}
                onChange={(value) => setForm((current) => ({ ...current, validity_months: value }))}
                placeholder="1"
              />
              <AdminInput
                icon={<CalendarDays className="size-4" />}
                label="Dias"
                type="number"
                value={form.validity_days}
                onChange={(value) => setForm((current) => ({ ...current, validity_days: value }))}
                placeholder="30"
              />
            </div>
            <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-2 text-xs text-muted-foreground">
              Vencimento calculado:{" "}
              <span className="font-bold text-neon-cyan">
                {formDates.expires_at ? formatDateBR(formDates.expires_at) : "informe inicio e meses"}
              </span>
            </div>
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Observacao
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-sm outline-none focus:border-neon-cyan/70"
                placeholder="Origem da compra, observações internas, renovação, suporte"
              />
            </label>
            <button
              type="submit"
              disabled={saving || ![form.full_name, form.email, form.phone, form.chat_id].some((value) => value.trim())}
              className="btn-primary-grad inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <UserCheck className="size-4" />}
              Adicionar e aprovar plano
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Painel de cadastros"
            subtitle="Aprove, pause, edite validade/data de expiracao, exclua e acompanhe todos em um lugar."
            right={
              <button
                type="button"
                onClick={copyActiveChats}
                disabled={!activeChatIds}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan disabled:opacity-50"
              >
                <Copy className="size-3" /> {copied ? "Copiado" : "Copiar chats"}
              </button>
            }
          />

          <div className="space-y-2">
            {recipients.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado ainda.
              </div>
            )}
            {recipients.map((recipient) => (
              <RecipientRowV2
                key={recipient.id}
                recipient={recipient}
                onToggle={() => toggleRecipient(recipient)}
                onDelete={() => removeRecipient(recipient)}
                onEdit={() => startEdit(recipient)}
                onQuickApprove={(months) => quickApprove(recipient, months)}
                isEditing={editingId === recipient.id}
                editForm={editingId === recipient.id ? editForm : null}
                onEditFormChange={setEditForm}
                onSave={() => saveEdit(recipient)}
                onCancel={cancelEdit}
                saving={saving}
              />
            ))}
          </div>
        </GlassCard>
      </div>
        </>
      )}
    </div>
  );
}

function AdminTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs font-black transition ${
        active ? "btn-primary-grad glow-blue" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function AdminSummaryPanel({ summary }: { summary: AdminSummary }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <SummaryMetric label="Cadastros" value={summary.totalRegistrations} tone="text-neon-cyan" />
        <SummaryMetric label="Acessos" value={summary.totalAccesses} tone="text-success" />
        <SummaryMetric label="Unicos" value={summary.uniqueAccesses} tone="text-gold" />
        <SummaryMetric label="Aprovados" value={summary.approved} tone="text-success" />
        <SummaryMetric label="Pendentes" value={summary.pending} tone="text-warning" />
        <SummaryMetric label="Pausados" value={summary.paused} tone="text-muted-foreground" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <GlassCard>
          <SectionTitle title="Cidades" subtitle="Onde os cadastros informaram origem." right={<MapPin className="size-4 text-neon-cyan" />} />
          <LocationList items={summary.cityBreakdown} emptyText="Nenhuma cidade informada ainda." />
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Paises" subtitle="Resumo por pais informado." right={<Globe2 className="size-4 text-neon-cyan" />} />
          <LocationList items={summary.countryBreakdown} emptyText="Nenhum pais informado ainda." />
        </GlassCard>
        <GlassCard>
          <SectionTitle title="Ultimos acessos" subtitle="Log simples desta execucao." right={<Users className="size-4 text-neon-cyan" />} />
          <div className="space-y-2">
            {summary.recentAccesses.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
                Nenhum acesso registrado ainda.
              </div>
            )}
            {summary.recentAccesses.map((event) => (
              <div key={event.id} className="rounded-xl border border-border/60 bg-secondary/25 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-xs font-bold">{event.full_name || event.email || "Visitante"}</div>
                  <AppBadge tone={event.type.includes("register") ? "blue" : "green"}>{event.type.includes("register") ? "cadastro" : "acesso"}</AppBadge>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  {event.email && <span>{event.email}</span>}
                  {(event.city || event.country) && <span>{[event.city, event.country].filter(Boolean).join(" / ")}</span>}
                  {event.created_at && <span>{formatDateTimeBR(event.created_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <GlassCard className="py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div>
    </GlassCard>
  );
}

function LocationList({
  items,
  emptyText,
}: {
  items: AdminSummary["cityBreakdown"];
  emptyText: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/70 p-5 text-center text-xs text-muted-foreground">
          {emptyText}
        </div>
      )}
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/60 bg-secondary/25 p-3">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-bold">{item.label}</span>
            <span className="text-neon-cyan font-black">{item.count}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-secondary/70">
            <div className="h-full rounded-full bg-neon-cyan" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecipientRow({
  recipient,
  onToggle,
  onDelete,
}: {
  recipient: SignalRecipient;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isPending = recipient.access_status === "pending";
  const expired = isRecipientExpired(recipient);
  const active = recipient.enabled && !expired;
  const statusLabel = expired ? "Expirado" : isPending ? "Pendente" : active ? "Liberado" : "Bloqueado";
  const statusTone: "amber" | "green" | "muted" | "red" = expired
    ? "red"
    : isPending
    ? "amber"
    : active
    ? "green"
    : "muted";

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold">{recipient.full_name || recipient.name}</span>
            <AppBadge tone={statusTone}>{statusLabel}</AppBadge>
            <AppBadge tone={recipient.plan === "vip" ? "gold" : recipient.plan === "premium" ? "purple" : "muted"}>
              {planLabels[recipient.plan] ?? recipient.plan}
            </AppBadge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            {recipient.email && <span>{recipient.email}</span>}
            {recipient.phone && <span>{recipient.phone}</span>}
            {(recipient.city || recipient.country) && (
              <span>{[recipient.city, recipient.country].filter(Boolean).join(" / ")}</span>
            )}
            {recipient.chat_id && <span>Telegram {recipient.chat_id}</span>}
            {recipient.starts_at && <span>Início {formatDateBR(recipient.starts_at)}</span>}
            {recipient.validity_days ? <span>{recipient.validity_days} dias</span> : null}
            {recipient.expires_at && <span>Expira {formatDateBR(recipient.expires_at)}</span>}
          </div>
          {recipient.notes && <div className="mt-2 text-xs text-muted-foreground">{recipient.notes}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            className={`inline-flex size-10 items-center justify-center rounded-xl border ${
              recipient.enabled
                ? "border-success/40 bg-success/15 text-success"
                : "border-border bg-secondary/40 text-muted-foreground"
            }`}
            aria-label={recipient.enabled ? "Bloquear acesso" : "Liberar acesso"}
          >
            <Power className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive"
            aria-label="Remover recebedor"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function RecipientRowV2({
  recipient,
  onToggle,
  onDelete,
  onEdit,
  onQuickApprove,
  isEditing,
  editForm,
  onEditFormChange,
  onSave,
  onCancel,
  saving,
}: {
  recipient: SignalRecipient;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onQuickApprove: (months: number) => void;
  isEditing: boolean;
  editForm: RecipientEditForm | null;
  onEditFormChange: (form: RecipientEditForm | null) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isPending = recipient.access_status === "pending";
  const expired = isRecipientExpired(recipient);
  const active = recipient.enabled && !expired;
  const statusLabel = expired ? "Expirado" : isPending ? "Pendente" : active ? "Liberado" : "Bloqueado";
  const statusTone: "amber" | "green" | "muted" | "red" = expired
    ? "red"
    : isPending
    ? "amber"
    : active
    ? "green"
    : "muted";
  const updateEdit = (field: keyof RecipientEditForm, value: string) => {
    if (!editForm) return;
    onEditFormChange({ ...editForm, [field]: value });
  };

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 p-3">
      {isEditing && editForm ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-black">Editar cadastro</div>
              <div className="text-[11px] text-muted-foreground">
                Altere plano, status, inicio, meses e dados do cliente.
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="glass inline-flex size-9 items-center justify-center rounded-xl text-muted-foreground"
                aria-label="Cancelar edicao"
              >
                <X className="size-4" />
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="btn-primary-grad inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Salvar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <AdminInput icon={<Users className="size-4" />} label="Nome completo" value={editForm.full_name} onChange={(value) => updateEdit("full_name", value)} />
            <AdminInput icon={<Mail className="size-4" />} label="Email" type="email" value={editForm.email} onChange={(value) => updateEdit("email", value)} />
            <AdminInput icon={<Phone className="size-4" />} label="Telefone" value={editForm.phone} onChange={(value) => updateEdit("phone", value)} />
            <AdminInput icon={<Radio className="size-4" />} label="Chat ID Telegram" value={editForm.chat_id} onChange={(value) => updateEdit("chat_id", value)} />
            <AdminInput icon={<MapPin className="size-4" />} label="Cidade" value={editForm.city} onChange={(value) => updateEdit("city", value)} />
            <AdminInput icon={<Globe2 className="size-4" />} label="Pais" value={editForm.country} onChange={(value) => updateEdit("country", value)} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <AdminSelect label="Tipo" value={editForm.kind} onChange={(value) => updateEdit("kind", value)} options={kindLabels} />
            <AdminSelect label="Plano" value={editForm.plan} onChange={(value) => updateEdit("plan", value)} options={planLabels} />
            <AdminSelect label="Status" value={editForm.access_status} onChange={(value) => updateEdit("access_status", value)} options={accessStatusLabels} />
            <AdminInput icon={<CalendarDays className="size-4" />} label="Meses" type="number" value={editForm.validity_months} onChange={(value) => updateEdit("validity_months", value)} placeholder="1, 3, 6, 12" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <AdminInput icon={<CalendarDays className="size-4" />} label="Data inicio" type="date" value={editForm.starts_at} onChange={(value) => updateEdit("starts_at", value)} />
            <AdminInput icon={<CalendarDays className="size-4" />} label="Dias" type="number" value={editForm.validity_days} onChange={(value) => updateEdit("validity_days", value)} />
            <AdminInput icon={<CalendarDays className="size-4" />} label="Expira em" type="date" value={editForm.expires_at} onChange={(value) => updateEdit("expires_at", value)} />
          </div>

          <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 px-3 py-2 text-xs text-muted-foreground">
            Se preencher meses, o sistema usa a data de inicio e calcula automaticamente o vencimento.
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Observacao interna
            </span>
            <textarea
              value={editForm.notes}
              onChange={(event) => updateEdit("notes", event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-sm outline-none focus:border-neon-cyan/70"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-bold">{recipient.full_name || recipient.name}</span>
                <AppBadge tone={statusTone}>{statusLabel}</AppBadge>
                <AppBadge tone={recipient.plan === "vip" ? "gold" : recipient.plan === "premium" ? "purple" : "muted"}>
                  {planLabels[recipient.plan] ?? recipient.plan}
                </AppBadge>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                {recipient.email && <span>{recipient.email}</span>}
                {recipient.phone && <span>{recipient.phone}</span>}
                {(recipient.city || recipient.country) && (
                  <span>{[recipient.city, recipient.country].filter(Boolean).join(" / ")}</span>
                )}
                {recipient.chat_id && <span>Telegram {recipient.chat_id}</span>}
                {recipient.starts_at && <span>Inicio {formatDateBR(recipient.starts_at)}</span>}
                {recipient.validity_days ? <span>{recipient.validity_days} dias</span> : null}
                {recipient.expires_at && <span>Expira {formatDateBR(recipient.expires_at)}</span>}
              </div>
              {recipient.notes && <div className="mt-2 text-xs text-muted-foreground">{recipient.notes}</div>}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onToggle}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-black ${
                  active
                    ? "border-warning/40 bg-warning/10 text-warning"
                    : "border-success/40 bg-success/15 text-success"
                }`}
              >
                <UserCheck className="size-3.5" />
                {active ? "Pausar" : "Aprovar"}
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex size-10 items-center justify-center rounded-xl border border-neon-cyan/35 bg-neon-cyan/10 text-neon-cyan"
                aria-label="Editar cadastro"
              >
                <Edit3 className="size-4" />
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex size-10 items-center justify-center rounded-xl border border-destructive/40 bg-destructive/10 text-destructive"
                aria-label="Remover recebedor"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Liberar rapido
            </span>
            {[1, 3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => onQuickApprove(months)}
                className="rounded-lg border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1 text-[10px] font-black text-neon-cyan hover:bg-neon-cyan/15"
              >
                Aprovar {months}m
              </button>
            ))}
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-gold/25 bg-gold/10 px-2.5 py-1 text-[10px] font-black text-gold"
            >
              Editar tudo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminInput({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 focus-within:border-neon-cyan/70">
        <span className="text-neon-cyan">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </span>
    </label>
  );
}

function AdminSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-sm outline-none focus:border-neon-cyan/70"
      >
        {Object.entries(options).map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function emptyAdminSummary(): AdminSummary {
  return {
    totalRegistrations: 0,
    approved: 0,
    pending: 0,
    paused: 0,
    totalAccesses: 0,
    uniqueAccesses: 0,
    cityBreakdown: [],
    countryBreakdown: [],
    recentAccesses: [],
  };
}

function summaryFromRecipients(recipients: SignalRecipient[], securitySummary: SecuritySummary): AdminSummary {
  return {
    totalRegistrations: recipients.length,
    approved: recipients.filter((recipient) => recipient.enabled || recipient.access_status === "approved").length,
    pending: recipients.filter((recipient) => recipient.access_status === "pending").length,
    paused: recipients.filter((recipient) => recipient.access_status === "paused").length,
    totalAccesses: securitySummary.total,
    uniqueAccesses: 0,
    cityBreakdown: locationBreakdown(recipients, "city"),
    countryBreakdown: locationBreakdown(recipients, "country"),
    recentAccesses: [],
  };
}

function locationBreakdown(recipients: SignalRecipient[], field: "city" | "country") {
  const counts = new Map<string, number>();
  for (const recipient of recipients) {
    const label = String(recipient[field] || "Nao informado").trim();
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function calculateExpiryDate(startsAt: string, daysText: string) {
  const days = Number(daysText);
  if (!startsAt || !Number.isFinite(days) || days <= 0) return "";
  const date = new Date(`${startsAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Math.floor(days));
  return date.toISOString().slice(0, 10);
}

function datesFromNewClientForm(startsAtText: string, monthsText: string, daysText: string) {
  const startsAt = startsAtText || todayIso();
  const months = Number(monthsText);
  if (Number.isFinite(months) && months > 0) {
    const expiresAt = addMonthsIso(startsAt, months);
    return {
      starts_at: startsAt,
      validity_days: daysBetweenIso(startsAt, expiresAt),
      expires_at: expiresAt,
    };
  }

  const days = Number(daysText) || 30;
  const expiresAt = calculateExpiryDate(startsAt, String(days));
  return {
    starts_at: startsAt,
    validity_days: days,
    expires_at: expiresAt,
  };
}

function recipientToEditForm(recipient: SignalRecipient): RecipientEditForm {
  return {
    full_name: recipient.full_name || recipient.name || "",
    email: recipient.email || "",
    phone: recipient.phone || "",
    city: recipient.city || "",
    country: recipient.country || "",
    chat_id: recipient.chat_id || "",
    kind: recipient.kind || "user",
    plan: recipient.plan || "free",
    access_status: recipient.access_status || (recipient.enabled ? "approved" : "paused"),
    starts_at: recipient.starts_at || todayIso(),
    validity_months: "",
    validity_days: String(recipient.validity_days || 30),
    expires_at: recipient.expires_at || "",
    notes: recipient.notes || "",
  };
}

function datesFromEditForm(form: RecipientEditForm) {
  const startsAt = form.starts_at || todayIso();
  const months = Number(form.validity_months);
  if (Number.isFinite(months) && months > 0) {
    const expiresAt = addMonthsIso(startsAt, months);
    return {
      starts_at: startsAt,
      validity_days: daysBetweenIso(startsAt, expiresAt),
      expires_at: expiresAt,
    };
  }
  const calculated = calculateExpiryDate(startsAt, form.validity_days);
  return {
    starts_at: startsAt,
    validity_days: Number(form.validity_days) || 0,
    expires_at: calculated || form.expires_at,
  };
}

function addMonthsIso(startsAt: string, months: number) {
  const date = new Date(`${startsAt || todayIso()}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + Math.max(0, Math.floor(months)));
  return date.toISOString().slice(0, 10);
}

function daysBetweenIso(startIso: string, endIso: string) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function isRecipientExpired(recipient: SignalRecipient) {
  if (!recipient.expires_at) return false;
  const expiration = new Date(`${recipient.expires_at}T23:59:59`);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration.getTime() < Date.now();
}

function recipientsToCsv(recipients: SignalRecipient[]) {
  const headers = [
    "nome",
    "email",
    "telefone",
    "cidade",
    "pais",
    "plano",
    "status",
    "inicio",
    "dias",
    "expira",
    "chat_id",
    "observacao",
  ];
  const rows = recipients.map((recipient) => [
    recipient.full_name || recipient.name || "",
    recipient.email || "",
    recipient.phone || "",
    recipient.city || "",
    recipient.country || "",
    recipient.plan || "",
    recipient.access_status || (recipient.enabled ? "approved" : "paused"),
    recipient.starts_at || "",
    String(recipient.validity_days || 0),
    recipient.expires_at || "",
    recipient.chat_id || "",
    recipient.notes || "",
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatDateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function securityTone(severity: SecurityEvent["severity"]) {
  if (severity === "critical") return "red";
  if (severity === "high") return "amber";
  if (severity === "medium") return "blue";
  return "muted";
}

function securityTypeLabel(type: string) {
  const labels: Record<string, string> = {
    admin_api_unauthorized: "Admin sem token",
    admin_login_failed: "Login admin falhou",
    admin_login_rate_limited: "Admin bloqueado por excesso",
    admin_password_in_client_login: "Senha admin errada",
    client_login_rate_limited: "Cliente bloqueado por excesso",
    client_password_invalid: "Senha de cliente errada",
    dashboard_unauthorized: "Dashboard sem sessao",
    suspicious_probe: "Sondagem suspeita",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

function StatusMessage({
  icon,
  text,
  tone,
}: {
  icon: ReactNode;
  text: string;
  tone: "red" | "green";
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        tone === "red"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-success/40 bg-success/10 text-success"
      }`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
