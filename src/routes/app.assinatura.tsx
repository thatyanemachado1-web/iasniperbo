import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SectionTitle } from "@/components/ui-app/SectionTitle";
import {
  getBillingSubscription,
  refreshAccessSession,
  type BillingPlan,
  type BillingSubscriptionOverview,
} from "@/lib/accessApi";
import { readUserSession } from "@/lib/userSession";
import { CalendarClock, CheckCircle2, CreditCard, Loader2, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/app/assinatura")({
  component: MinhaAssinaturaPage,
});

function MinhaAssinaturaPage() {
  const [subscription, setSubscription] = useState<BillingSubscriptionOverview | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const session = readUserSession();

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        await refreshAccessSession().catch(() => null);
        const data = await getBillingSubscription();
        if (!active) return;
        setSubscription(data.subscription);
        setPlans(data.plans ?? []);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar a assinatura.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const currentPlan = plans.find((plan) => plan.id === (subscription?.plan || session.plan));
  const approved = subscription?.approved || session.approved;
  const expired = subscription?.accessMode === "expired" || session.accessMode === "expired";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <AppBadge tone={approved ? "green" : expired ? "amber" : "blue"}>
            {approved ? "Conta liberada" : expired ? "Assinatura expirada" : "Assinatura pendente"}
          </AppBadge>
          <h1 className="mt-3 text-2xl font-extrabold text-gradient-brand">Minha Assinatura</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acompanhe plano, validade e ultimo pagamento aprovado.
          </p>
        </div>
        <Link
          to="/app/pagamentos"
          className="btn-primary-grad inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
        >
          <ReceiptText className="size-4" />
          Historico de pagamentos
        </Link>
      </div>

      {loading && (
        <GlassCard className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-neon-cyan" />
          Carregando assinatura...
        </GlassCard>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <GlassCard className="border-neon-cyan/35">
            <SectionTitle title="Status do acesso" />
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric
                icon={<CreditCard className="size-4" />}
                label="Plano"
                value={currentPlan?.name || subscription?.plan || session.plan}
              />
              <Metric
                icon={<CheckCircle2 className="size-4" />}
                label="Status"
                value={subscription?.status || session.accessStatus}
                tone={approved ? "green" : expired ? "amber" : "blue"}
              />
              <Metric
                icon={<CalendarClock className="size-4" />}
                label="Validade"
                value={formatDateBR(subscription?.expires_at || session.expiresAt) || "Sem data"}
              />
            </div>

            <div className="mt-5 rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
              {approved
                ? "Seu acesso premium esta ativo. Se a assinatura vencer, o painel de analises fica bloqueado automaticamente."
                : expired
                ? "Sua assinatura venceu. Renove para liberar novamente o painel de analises."
                : "Finalize o checkout e aguarde a confirmacao do Mercado Pago para liberar o painel automaticamente."}
            </div>

            {!approved && (
              <Link
                to="/app/planos"
                className="mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold btn-gold-grad glow-gold"
              >
                Assinar agora
              </Link>
            )}
          </GlassCard>

          <GlassCard>
            <SectionTitle title="Ultimo pagamento" />
            {subscription?.last_payment?.id ? (
              <div className="mt-4 space-y-3 text-sm">
                <Field label="Status" value={subscription.last_payment.status} />
                <Field label="Valor" value={formatMoney(subscription.last_payment.amount, subscription.last_payment.currency)} />
                <Field label="Criado em" value={formatDateTimeBR(subscription.last_payment.created_at)} />
                <Field label="Pago em" value={formatDateTimeBR(subscription.last_payment.paid_at) || "Aguardando"} />
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-border/70 bg-secondary/20 p-4 text-sm text-muted-foreground">
                Nenhum pagamento registrado ainda.
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone = "blue",
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: "blue" | "green" | "amber";
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/35 p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
        <span className={tone === "green" ? "text-green-400" : tone === "amber" ? "text-amber-300" : "text-neon-cyan"}>
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-lg font-black">{value}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(amount || 0);
}

function formatDateBR(value?: string) {
  if (!value) return "";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatDateTimeBR(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDateBR(value);
  return date.toLocaleString("pt-BR");
}
