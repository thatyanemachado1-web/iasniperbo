import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { getBillingPayments, type BillingPayment } from "@/lib/accessApi";
import { ArrowLeft, Loader2, ReceiptText } from "lucide-react";

export const Route = createFileRoute("/app/pagamentos")({
  component: HistoricoPagamentosPage,
});

function HistoricoPagamentosPage() {
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getBillingPayments()
      .then((items) => {
        if (active) setPayments(items);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar pagamentos.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <AppBadge tone="blue">Mercado Pago</AppBadge>
          <h1 className="mt-3 text-2xl font-extrabold text-gradient-brand">Histórico de Pagamentos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Registro dos checkouts criados e pagamentos confirmados.
          </p>
        </div>
        <Link
          to="/app/assinatura"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Minha assinatura
        </Link>
      </div>

      {loading && (
        <GlassCard className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-neon-cyan" />
          Carregando pagamentos...
        </GlassCard>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !payments.length && !error && (
        <GlassCard className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-secondary/30">
            <ReceiptText className="size-5 text-neon-cyan" />
          </div>
          <div className="mt-3 font-bold">Nenhum pagamento registrado</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Assim que um checkout for criado, ele aparece aqui.
          </p>
          <Link
            to="/app/planos"
            className="mt-4 inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold btn-primary-grad"
          >
            Assinar agora
          </Link>
        </GlassCard>
      )}

      <div className="space-y-3">
        {payments.map((payment) => (
          <GlassCard key={payment.id || `${payment.created_at}-${payment.status}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-neon-cyan/80">
                  {payment.plan}
                </div>
                <div className="mt-1 text-lg font-black">
                  {formatMoney(payment.amount, payment.currency)}
                </div>
              </div>
              <AppBadge tone={payment.status === "approved" ? "green" : payment.status === "pending" ? "amber" : "muted"}>
                {payment.status || "pending"}
              </AppBadge>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
              <Info label="Criado em" value={formatDateTimeBR(payment.created_at) || "-"} />
              <Info label="Pago em" value={formatDateTimeBR(payment.paid_at) || "Aguardando"} />
              <Info label="Pagamento" value={payment.provider_payment_id || "Pendente"} />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(amount || 0);
}

function formatDateTimeBR(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}
