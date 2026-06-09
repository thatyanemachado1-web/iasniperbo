import { Link } from "@tanstack/react-router";
import {
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  createCrmClient,
  createCrmDeal,
  createCrmInvoice,
  deleteCrmClient,
  deleteCrmDeal,
  deleteCrmInvoice,
  getAdminCrm,
  readAdminSession,
  updateCrmClient,
  updateCrmDeal,
  updateCrmInvoice,
} from "@/lib/adminApi";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import type {
  CrmClient,
  CrmDeal,
  CrmDealStage,
  CrmInvoice,
  CrmInvoiceStatus,
  CrmResponse,
} from "@/types/crm";

const emptyCrm: CrmResponse = {
  clients: [],
  deals: [],
  invoices: [],
  summary: {
    clients: 0,
    openDeals: 0,
    openDealValue: 0,
    openInvoices: 0,
    overdueInvoices: 0,
    paidInvoiceValue: 0,
    openInvoiceValue: 0,
  },
  storageConfigured: false,
};

const dealStageLabels: Record<CrmDealStage, string> = {
  novo: "Novo",
  contato: "Contato",
  negociacao: "Negociacao",
  ganho: "Ganho",
  perdido: "Perdido",
};

const invoiceStatusLabels: Record<CrmInvoiceStatus, string> = {
  aberta: "Aberta",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

type ClientForm = Pick<CrmClient, "name" | "email" | "phone" | "notes">;
type DealForm = Pick<CrmDeal, "clientId" | "title" | "value" | "stage" | "expectedCloseDate" | "notes">;
type InvoiceForm = Pick<CrmInvoice, "clientId" | "dealId" | "amount" | "status" | "dueDate" | "paidAt" | "notes">;

const initialClientForm: ClientForm = { name: "", email: "", phone: "", notes: "" };
const initialDealForm: DealForm = {
  clientId: "",
  title: "",
  value: 0,
  stage: "novo",
  expectedCloseDate: "",
  notes: "",
};
const initialInvoiceForm: InvoiceForm = {
  clientId: "",
  dealId: "",
  amount: 0,
  status: "aberta",
  dueDate: "",
  paidAt: "",
  notes: "",
};

export function AdminCrmPage() {
  const [session] = useState(() => readAdminSession());
  const [crm, setCrm] = useState<CrmResponse>(emptyCrm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clientForm, setClientForm] = useState<ClientForm>(initialClientForm);
  const [dealForm, setDealForm] = useState<DealForm>(initialDealForm);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceForm>(initialInvoiceForm);
  const [editingClientId, setEditingClientId] = useState("");
  const [editingDealId, setEditingDealId] = useState("");
  const [editingInvoiceId, setEditingInvoiceId] = useState("");

  const clientOptions = crm.clients;
  const dealOptions = useMemo(
    () => crm.deals.filter((deal) => !["ganho", "perdido"].includes(deal.stage)),
    [crm.deals],
  );

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    void reload();
  }, [session]);

  async function reload() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      setCrm(await getAdminCrm(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel carregar o CRM.");
    } finally {
      setLoading(false);
    }
  }

  async function submitClient(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving("client");
    setError("");
    try {
      if (editingClientId) {
        await updateCrmClient(session, editingClientId, clientForm);
        setNotice("Cliente atualizado.");
      } else {
        await createCrmClient(session, clientForm);
        setNotice("Cliente cadastrado.");
      }
      setClientForm(initialClientForm);
      setEditingClientId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o cliente.");
    } finally {
      setSaving("");
    }
  }

  async function submitDeal(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving("deal");
    setError("");
    try {
      if (editingDealId) {
        await updateCrmDeal(session, editingDealId, dealForm);
        setNotice("Negocio atualizado.");
      } else {
        await createCrmDeal(session, dealForm);
        setNotice("Negocio cadastrado.");
      }
      setDealForm({ ...initialDealForm, clientId: dealForm.clientId });
      setEditingDealId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar o negocio.");
    } finally {
      setSaving("");
    }
  }

  async function submitInvoice(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    setSaving("invoice");
    setError("");
    try {
      if (editingInvoiceId) {
        await updateCrmInvoice(session, editingInvoiceId, invoiceForm);
        setNotice("Fatura atualizada.");
      } else {
        await createCrmInvoice(session, invoiceForm);
        setNotice("Fatura cadastrada.");
      }
      setInvoiceForm({ ...initialInvoiceForm, clientId: invoiceForm.clientId });
      setEditingInvoiceId("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar a fatura.");
    } finally {
      setSaving("");
    }
  }

  async function removeClient(client: CrmClient) {
    if (!session || !confirm(`Apagar ${client.name}? Negocios e faturas ligados tambem saem.`)) return;
    setSaving(client.id);
    try {
      await deleteCrmClient(session, client.id);
      setNotice("Cliente apagado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel apagar o cliente.");
    } finally {
      setSaving("");
    }
  }

  async function removeDeal(deal: CrmDeal) {
    if (!session || !confirm(`Apagar negocio "${deal.title}"?`)) return;
    setSaving(deal.id);
    try {
      await deleteCrmDeal(session, deal.id);
      setNotice("Negocio apagado.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel apagar o negocio.");
    } finally {
      setSaving("");
    }
  }

  async function removeInvoice(invoice: CrmInvoice) {
    if (!session || !confirm("Apagar esta fatura?")) return;
    setSaving(invoice.id);
    try {
      await deleteCrmInvoice(session, invoice.id);
      setNotice("Fatura apagada.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel apagar a fatura.");
    } finally {
      setSaving("");
    }
  }

  function editClient(client: CrmClient) {
    setEditingClientId(client.id);
    setClientForm({
      name: client.name,
      email: client.email,
      phone: client.phone,
      notes: client.notes,
    });
  }

  function editDeal(deal: CrmDeal) {
    setEditingDealId(deal.id);
    setDealForm({
      clientId: deal.clientId,
      title: deal.title,
      value: deal.value,
      stage: deal.stage,
      expectedCloseDate: deal.expectedCloseDate,
      notes: deal.notes,
    });
  }

  function editInvoice(invoice: CrmInvoice) {
    setEditingInvoiceId(invoice.id);
    setInvoiceForm({
      clientId: invoice.clientId,
      dealId: invoice.dealId,
      amount: invoice.amount,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
      notes: invoice.notes,
    });
  }

  function exportJson() {
    downloadFile(
      `sniper-crm-backup-${todayFileName()}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), ...crm }, null, 2),
      "application/json;charset=utf-8",
    );
  }

  function exportCsv() {
    const rows = [
      ["tipo", "id", "cliente", "email", "telefone", "titulo", "valor", "status", "vencimento", "observacoes"],
      ...crm.clients.map((client) => [
        "cliente",
        client.id,
        client.name,
        client.email,
        client.phone,
        "",
        "",
        "",
        "",
        client.notes,
      ]),
      ...crm.deals.map((deal) => {
        const client = clientById(crm.clients, deal.clientId);
        return [
          "negocio",
          deal.id,
          client?.name || "",
          client?.email || "",
          client?.phone || "",
          deal.title,
          String(deal.value),
          dealStageLabels[deal.stage],
          deal.expectedCloseDate,
          deal.notes,
        ];
      }),
      ...crm.invoices.map((invoice) => {
        const client = clientById(crm.clients, invoice.clientId);
        return [
          "fatura",
          invoice.id,
          client?.name || "",
          client?.email || "",
          client?.phone || "",
          "",
          String(invoice.amount),
          invoiceStatusLabels[invoice.status],
          invoice.dueDate,
          invoice.notes,
        ];
      }),
    ];
    downloadFile(`sniper-crm-backup-${todayFileName()}.csv`, toCsv(rows), "text/csv;charset=utf-8");
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <GlassCard className="border-neon-cyan/35">
          <SectionTitle title="CRM protegido" subtitle="Entre no painel admin para ver clientes, negocios e faturas." />
          <Link
            to="/app/admin"
            className="btn-primary-grad mt-4 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black"
          >
            <ShieldCheck className="size-4" />
            Entrar como admin
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-neon-cyan/80">
            Banco seguro por tabelas
          </div>
          <h1 className="mt-1 text-2xl font-black text-gradient-brand">Gestao de Clientes</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Clientes, negocios e faturas ficam em tabelas separadas no Supabase, com backup em arquivo quando voce quiser.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan" onClick={() => void reload()}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button className="glass inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-neon-cyan" onClick={exportCsv}>
            <Download className="size-4" />
            CSV
          </button>
          <button className="btn-primary-grad inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black" onClick={exportJson}>
            <Download className="size-4" />
            JSON backup
          </button>
        </div>
      </div>

      {!crm.storageConfigured && (
        <div className="rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
          Configure `SUPABASE_SERVICE_ROLE_KEY` e publique a migration do CRM para salvar definitivo.
        </div>
      )}
      {error && <Status tone="red" text={error} />}
      {notice && <Status tone="green" text={notice} />}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Users className="size-4" />} label="Clientes" value={crm.summary.clients} />
        <Metric icon={<BriefcaseBusiness className="size-4" />} label="Negocios abertos" value={crm.summary.openDeals} />
        <Metric icon={<Banknote className="size-4" />} label="Valor em aberto" value={formatMoney(crm.summary.openDealValue)} />
        <Metric icon={<FileText className="size-4" />} label="Faturas abertas" value={crm.summary.openInvoices} />
        <Metric icon={<CalendarClock className="size-4" />} label="Vencidas" value={crm.summary.overdueInvoices} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <GlassCard>
          <SectionTitle
            title={editingClientId ? "Editar cliente" : "Registrar cliente"}
            subtitle="Dados ficam em linha propria, fora do estado vivo do app."
            right={<AppBadge tone="blue">Privado</AppBadge>}
          />
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitClient}>
            <Field label="Nome">
              <input className="crm-input" value={clientForm.name} onChange={(event) => setClientForm({ ...clientForm, name: event.target.value })} required />
            </Field>
            <Field label="E-mail">
              <input className="crm-input" type="email" value={clientForm.email} onChange={(event) => setClientForm({ ...clientForm, email: event.target.value })} required />
            </Field>
            <Field label="Telefone">
              <input className="crm-input" value={clientForm.phone} onChange={(event) => setClientForm({ ...clientForm, phone: event.target.value })} />
            </Field>
            <Field label="Observacoes" className="md:col-span-2">
              <textarea className="crm-input min-h-20 resize-y" value={clientForm.notes} onChange={(event) => setClientForm({ ...clientForm, notes: event.target.value })} />
            </Field>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button className="btn-primary-grad inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-60" disabled={saving === "client"}>
                {saving === "client" ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {editingClientId ? "Atualizar cliente" : "Salvar cliente"}
              </button>
              {editingClientId && (
                <button type="button" className="glass rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground" onClick={() => {
                  setEditingClientId("");
                  setClientForm(initialClientForm);
                }}>
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </GlassCard>

        <GlassCard>
          <SectionTitle title="Backup manual" subtitle="Baixe uma copia sempre que mexer em clientes." />
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>O banco separado evita perder tudo por sobrescrita de JSON.</p>
            <p>O arquivo JSON guarda clientes, negocios e faturas para restauracao futura.</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <button className="btn-primary-grad rounded-xl px-4 py-3 text-sm font-black" onClick={exportJson}>
                Baixar backup JSON
              </button>
              <button className="glass rounded-xl px-4 py-3 text-sm font-bold text-neon-cyan" onClick={exportCsv}>
                Baixar planilha CSV
              </button>
            </div>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard>
          <SectionTitle title={editingDealId ? "Editar negocio" : "Negocio em andamento"} />
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitDeal}>
            <Field label="Cliente">
              <select className="crm-input" value={dealForm.clientId} onChange={(event) => setDealForm({ ...dealForm, clientId: event.target.value })} required>
                <option value="">Selecione</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Titulo">
              <input className="crm-input" value={dealForm.title} onChange={(event) => setDealForm({ ...dealForm, title: event.target.value })} required />
            </Field>
            <Field label="Valor">
              <input className="crm-input" type="number" min="0" step="0.01" value={dealForm.value} onChange={(event) => setDealForm({ ...dealForm, value: Number(event.target.value) })} />
            </Field>
            <Field label="Estagio">
              <select className="crm-input" value={dealForm.stage} onChange={(event) => setDealForm({ ...dealForm, stage: event.target.value as CrmDealStage })}>
                {Object.entries(dealStageLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Previsao">
              <input className="crm-input" type="date" value={dealForm.expectedCloseDate} onChange={(event) => setDealForm({ ...dealForm, expectedCloseDate: event.target.value })} />
            </Field>
            <Field label="Observacoes">
              <input className="crm-input" value={dealForm.notes} onChange={(event) => setDealForm({ ...dealForm, notes: event.target.value })} />
            </Field>
            <button className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-60 md:col-span-2" disabled={saving === "deal" || !clientOptions.length}>
              {saving === "deal" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editingDealId ? "Atualizar negocio" : "Salvar negocio"}
            </button>
          </form>
        </GlassCard>

        <GlassCard>
          <SectionTitle title={editingInvoiceId ? "Editar fatura" : "Gerenciar fatura"} />
          <form className="grid gap-3 md:grid-cols-2" onSubmit={submitInvoice}>
            <Field label="Cliente">
              <select className="crm-input" value={invoiceForm.clientId} onChange={(event) => setInvoiceForm({ ...invoiceForm, clientId: event.target.value })} required>
                <option value="">Selecione</option>
                {clientOptions.map((client) => (
                  <option key={client.id} value={client.id}>{client.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Negocio">
              <select className="crm-input" value={invoiceForm.dealId} onChange={(event) => setInvoiceForm({ ...invoiceForm, dealId: event.target.value })}>
                <option value="">Sem vinculo</option>
                {dealOptions.map((deal) => (
                  <option key={deal.id} value={deal.id}>{deal.title}</option>
                ))}
              </select>
            </Field>
            <Field label="Valor">
              <input className="crm-input" type="number" min="0" step="0.01" value={invoiceForm.amount} onChange={(event) => setInvoiceForm({ ...invoiceForm, amount: Number(event.target.value) })} />
            </Field>
            <Field label="Status">
              <select className="crm-input" value={invoiceForm.status} onChange={(event) => setInvoiceForm({ ...invoiceForm, status: event.target.value as CrmInvoiceStatus })}>
                {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="Vencimento">
              <input className="crm-input" type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm({ ...invoiceForm, dueDate: event.target.value })} required />
            </Field>
            <Field label="Pagamento">
              <input className="crm-input" type="date" value={invoiceForm.paidAt} onChange={(event) => setInvoiceForm({ ...invoiceForm, paidAt: event.target.value })} />
            </Field>
            <Field label="Observacoes" className="md:col-span-2">
              <input className="crm-input" value={invoiceForm.notes} onChange={(event) => setInvoiceForm({ ...invoiceForm, notes: event.target.value })} />
            </Field>
            <button className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black disabled:opacity-60 md:col-span-2" disabled={saving === "invoice" || !clientOptions.length}>
              {saving === "invoice" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {editingInvoiceId ? "Atualizar fatura" : "Salvar fatura"}
            </button>
          </form>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ListCard title="Clientes" empty="Nenhum cliente no CRM.">
          {crm.clients.map((client) => (
            <Row key={client.id}>
              <div className="min-w-0">
                <div className="font-black">{client.name}</div>
                <div className="truncate text-xs text-muted-foreground">{client.email}</div>
                <div className="text-xs text-muted-foreground">{client.phone || "Sem telefone"}</div>
              </div>
              <RowActions onEdit={() => editClient(client)} onDelete={() => void removeClient(client)} busy={saving === client.id} />
            </Row>
          ))}
        </ListCard>

        <ListCard title="Negocios" empty="Nenhum negocio cadastrado.">
          {crm.deals.map((deal) => (
            <Row key={deal.id}>
              <div className="min-w-0">
                <div className="font-black">{deal.title}</div>
                <div className="text-xs text-muted-foreground">{clientById(crm.clients, deal.clientId)?.name || "Cliente removido"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Badge>{dealStageLabels[deal.stage]}</Badge>
                  <span className="font-bold text-neon-cyan">{formatMoney(deal.value)}</span>
                </div>
              </div>
              <RowActions onEdit={() => editDeal(deal)} onDelete={() => void removeDeal(deal)} busy={saving === deal.id} />
            </Row>
          ))}
        </ListCard>

        <ListCard title="Faturas" empty="Nenhuma fatura cadastrada.">
          {crm.invoices.map((invoice) => (
            <Row key={invoice.id}>
              <div className="min-w-0">
                <div className="font-black">{formatMoney(invoice.amount)}</div>
                <div className="text-xs text-muted-foreground">{clientById(crm.clients, invoice.clientId)?.name || "Cliente removido"}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <Badge tone={invoice.status === "vencida" ? "red" : invoice.status === "paga" ? "green" : "blue"}>{invoiceStatusLabels[invoice.status]}</Badge>
                  <span className="text-muted-foreground">{invoice.dueDate || "Sem vencimento"}</span>
                </div>
              </div>
              <RowActions onEdit={() => editInvoice(invoice)} onDelete={() => void removeInvoice(invoice)} busy={saving === invoice.id} />
            </Row>
          ))}
        </ListCard>
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neon-cyan/15 bg-background/35 px-3 py-3">
      <div className="flex items-center gap-2 text-neon-cyan">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      </div>
      <div className="mt-2 text-xl font-black">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ListCard({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <GlassCard className="min-h-72">
      <SectionTitle title={title} />
      <div className="space-y-2">
        {hasChildren ? children : <div className="rounded-xl border border-border/50 bg-background/35 px-3 py-5 text-sm text-muted-foreground">{empty}</div>}
      </div>
    </GlassCard>
  );
}

function Row({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/45 bg-background/35 px-3 py-3">
      {children}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
  busy,
}: {
  onEdit: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" className="glass rounded-lg px-2 py-1 text-xs font-bold text-neon-cyan" onClick={onEdit}>
        Editar
      </button>
      <button type="button" className="glass inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold text-destructive" onClick={onDelete} disabled={busy}>
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
      </button>
    </div>
  );
}

function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "red" }) {
  const className =
    tone === "green"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "red"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan";
  return <span className={`rounded-full border px-2 py-0.5 font-bold ${className}`}>{children}</span>;
}

function Status({ tone, text }: { tone: "green" | "red"; text: string }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-bold ${
        tone === "green"
          ? "border-success/30 bg-success/10 text-success"
          : "border-destructive/30 bg-destructive/10 text-destructive"
      }`}
    >
      {text}
    </div>
  );
}

function clientById(clients: CrmClient[], id: string) {
  return clients.find((client) => client.id === id);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function todayFileName() {
  return new Date().toISOString().slice(0, 10);
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}
