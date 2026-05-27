import { createFileRoute } from "@tanstack/react-router";
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
} from "@/lib/adminApi";
import type { AdminSession, RecipientKind, RecipientPlan, SignalRecipient } from "@/types/admin";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import { AppBadge } from "@/components/ui-app/AppBadge";
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Power,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
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
  user: "Usuario",
};

const planLabels: Record<RecipientPlan, string> = {
  free: "Free",
  premium: "Premium",
  vip: "VIP",
};

function AdminPage() {
  const [session, setSession] = useState<AdminSession | null>(() => readAdminSession());
  const [apiUrl, setApiUrl] = useState(() => readAdminSession()?.apiUrl || getInitialApiUrl());
  const [email, setEmail] = useState(() => readAdminSession()?.email || "gabrielmendespromove@gmail.com");
  const [password, setPassword] = useState("");
  const [recipients, setRecipients] = useState<SignalRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    chat_id: "",
    kind: "group" as RecipientKind,
    plan: "vip" as RecipientPlan,
    expires_at: "",
    notes: "",
  });

  const activeRecipients = useMemo(
    () => recipients.filter((recipient) => recipient.enabled),
    [recipients],
  );
  const activeChatIds = useMemo(
    () => activeRecipients.map((recipient) => recipient.chat_id).join(","),
    [activeRecipients],
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
    refreshRecipients();
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const logged = await adminLogin(apiUrl, email, password);
      saveAdminSession(logged);
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
        enabled: true,
      });
      setRecipients((current) => [...current, recipient]);
      setForm({
        name: "",
        chat_id: "",
        kind: "group",
        plan: "vip",
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
      const updated = await updateSignalRecipient(session, recipient.id, { enabled: nextEnabled });
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
                Admin operacional
              </div>
              <h1 className="mt-1 text-2xl font-black">Controle de quem recebe sinais</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Entre com o admin do bot para cadastrar grupos, canais ou usuarios autorizados.
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Login admin"
            subtitle="Conecta no servidor local do SNIPER BO."
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
          <div className="text-xl font-black">Destinatarios dos sinais</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AppBadge tone="green" pulse>{activeRecipients.length} ativos</AppBadge>
          <AppBadge tone="muted">{recipients.length} cadastrados</AppBadge>
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
            title="Novo acesso"
            subtitle="Cadastre o grupo, canal ou usuario que vai receber os sinais."
            right={<UserPlus className="size-4 text-neon-cyan" />}
          />
          <form className="space-y-3" onSubmit={handleAddRecipient}>
            <AdminInput
              icon={<Users className="size-4" />}
              label="Nome"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              placeholder="Grupo VIP Bac Bo"
            />
            <AdminInput
              icon={<Radio className="size-4" />}
              label="Chat ID Telegram"
              value={form.chat_id}
              onChange={(value) => setForm((current) => ({ ...current, chat_id: value }))}
              placeholder="-1001234567890"
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
            <AdminInput
              icon={<CheckCircle2 className="size-4" />}
              label="Validade"
              type="date"
              value={form.expires_at}
              onChange={(value) => setForm((current) => ({ ...current, expires_at: value }))}
            />
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Observacao
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-border/60 bg-secondary/35 px-3 py-2 text-sm outline-none focus:border-neon-cyan/70"
                placeholder="Origem, dono do grupo, plano, observacoes internas"
              />
            </label>
            <button
              type="submit"
              disabled={saving || !form.chat_id.trim()}
              className="btn-primary-grad inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Cadastrar recebedor
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <SectionTitle
            title="Lista autorizada"
            subtitle="O bot usa esta lista ativa antes de enviar qualquer mensagem."
            right={
              <button
                type="button"
                onClick={copyActiveChats}
                disabled={!activeChatIds}
                className="inline-flex items-center gap-1.5 rounded-lg border border-neon-cyan/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan disabled:opacity-50"
              >
                <Copy className="size-3" /> {copied ? "Copiado" : "Copiar ativos"}
              </button>
            }
          />

          <div className="space-y-2">
            {recipients.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                Nenhum recebedor cadastrado ainda.
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
  return (
    <div className="rounded-xl border border-border/60 bg-secondary/25 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-bold">{recipient.name}</span>
            <AppBadge tone={recipient.enabled ? "green" : "muted"}>
              {recipient.enabled ? "Ativo" : "Pausado"}
            </AppBadge>
            <AppBadge tone={recipient.plan === "vip" ? "gold" : recipient.plan === "premium" ? "purple" : "muted"}>
              {planLabels[recipient.plan] ?? recipient.plan}
            </AppBadge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span>{kindLabels[recipient.kind] ?? recipient.kind}</span>
            <span>{recipient.chat_id}</span>
            {recipient.expires_at && <span>Validade {recipient.expires_at}</span>}
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
            aria-label={recipient.enabled ? "Pausar envio" : "Ativar envio"}
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
