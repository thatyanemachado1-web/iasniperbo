import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  clearAdminSession,
  adminLogin,
  createSignalRecipient,
  deleteSignalRecipient,
  getInitialApiUrl,
  listSignalRecipients,
  readAdminSession,
  saveAdminSession,
  updateSignalRecipient,
  useLocalAdminApiUrl,
} from "@/lib/adminApi";
import { isAdminOwnerEmail, readUserSession, saveUserSession } from "@/lib/userSession";
import type { AdminSession, RecipientKind, RecipientPlan, SignalRecipient } from "@/types/admin";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import {
  CalendarDays,
  Copy,
  Globe2,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Power,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  WifiOff,
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

function AdminPage() {
  const userSession = readUserSession();
  const [ownerEmail, setOwnerEmail] = useState(userSession.email);
  const canUseAdmin = isAdminOwnerEmail(ownerEmail);
  const canAttemptAdminLogin = true;
  const [session, setSession] = useState<AdminSession | null>(() =>
    isAdminOwnerEmail(userSession.email) ? readAdminSession() : null,
  );
  const [apiUrl, setApiUrl] = useState(() => readAdminSession()?.apiUrl || getInitialApiUrl());
  const [email, setEmail] = useState(() => readAdminSession()?.email || "gabrielmendespromove@gmail.com");
  const [password, setPassword] = useState("");
  const [recipients, setRecipients] = useState<SignalRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
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
  const calculatedExpiresAt = useMemo(
    () => calculateExpiryDate(form.starts_at, form.validity_days),
    [form.starts_at, form.validity_days],
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

  useEffect(() => {
    if (canUseAdmin) refreshRecipients();
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
        validity_days: Number(form.validity_days) || 0,
        expires_at: calculatedExpiresAt || form.expires_at,
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
        validity_days: "30",
        expires_at: "",
        notes: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel cadastrar.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecipient(recipient: SignalRecipient) {
    if (!session) return;
    setError("");
    const nextEnabled = !recipient.enabled;
    setRecipients((current) =>
      current.map((item) => (item.id === recipient.id ? { ...item, enabled: nextEnabled } : item)),
    );
    try {
      const updated = await updateSignalRecipient(session, recipient.id, {
        enabled: nextEnabled,
        access_status: nextEnabled ? "approved" : "paused",
        plan: nextEnabled && recipient.plan === "free" ? "premium" : recipient.plan,
        starts_at: nextEnabled ? recipient.starts_at || todayIso() : recipient.starts_at,
        validity_days: nextEnabled ? recipient.validity_days || 30 : recipient.validity_days,
      });
      setRecipients((current) =>
        current.map((item) => (item.id === recipient.id ? updated : item)),
      );
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

  function logout() {
    clearAdminSession();
    setSession(null);
    setRecipients([]);
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
          <div className="text-xl font-black">Clientes VIP/Premium</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone="green" pulse>{activeRecipients.length} liberados</AppBadge>
          <AppBadge tone="gold">{vipClients.length} VIP</AppBadge>
          <AppBadge tone="purple">{premiumClients.length} Premium</AppBadge>
          <AppBadge tone="amber">{pendingClients.length} pendentes</AppBadge>
          <AppBadge tone="muted">{recipients.length} cadastros</AppBadge>
          <button
            type="button"
            onClick={() => refreshRecipients()}
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

      <div className="grid grid-cols-1 xl:grid-cols-[0.78fr_1.22fr] gap-4">
        <GlassCard>
          <SectionTitle
            title="Novo cliente"
            subtitle="Cadastre quem comprou e libere o acesso manualmente."
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
            <div className="grid grid-cols-[1fr_0.72fr] gap-2">
              <AdminInput
                icon={<CalendarDays className="size-4" />}
                label="Data início"
                type="date"
                value={form.starts_at}
                onChange={(value) => setForm((current) => ({ ...current, starts_at: value }))}
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
                {calculatedExpiresAt ? formatDateBR(calculatedExpiresAt) : "informe início e dias"}
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
              Cadastrar e liberar acesso
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Cadastros liberados"
            subtitle="Clientes aprovados aqui ficam com acesso VIP/Premium controlado por você."
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
              <RecipientRow
                key={recipient.id}
                recipient={recipient}
                onToggle={() => toggleRecipient(recipient)}
                onDelete={() => removeRecipient(recipient)}
              />
            ))}
          </div>
        </GlassCard>
      </div>
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
  const statusLabel = isPending ? "Pendente" : recipient.enabled ? "Liberado" : "Bloqueado";
  const statusTone = isPending ? "amber" : recipient.enabled ? "green" : "muted";

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

function calculateExpiryDate(startsAt: string, daysText: string) {
  const days = Number(daysText);
  if (!startsAt || !Number.isFinite(days) || days <= 0) return "";
  const date = new Date(`${startsAt}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Math.floor(days));
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateBR(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
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
