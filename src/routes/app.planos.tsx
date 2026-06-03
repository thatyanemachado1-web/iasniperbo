import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { SalesClosedPanel } from "@/components/ui-app/SalesClosedPanel";
import {
  createBillingCheckout,
  getBillingPlans,
  getSalesSettings,
  type BillingPlan,
} from "@/lib/accessApi";
import { readUserSession } from "@/lib/userSession";
import { Check, Crown, Loader2, ReceiptText, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/planos")({
  component: PlanosPage,
});

const fallbackPlans: BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Cadastro gratuito com acesso limitado.",
    amount: 0,
    currency: "BRL",
    durationDays: 7,
    checkoutEnabled: false,
    features: ["Cadastro no app", "Conta criada", "Sinais premium bloqueados"],
  },
  {
    id: "vip",
    name: "VIP",
    description: "Painel operacional mensal.",
    amount: 297,
    currency: "BRL",
    durationDays: 30,
    checkoutEnabled: false,
    features: ["Dashboard ao vivo", "Surf, Tie e numero pagante", "Assistente IA"],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Acesso completo mensal.",
    amount: 497,
    currency: "BRL",
    durationDays: 30,
    checkoutEnabled: false,
    features: ["Tudo do VIP", "Narracao IA", "Prioridade operacional"],
  },
];

function PlanosPage() {
  const [plans, setPlans] = useState<BillingPlan[]>(fallbackPlans);
  const [loadingPlan, setLoadingPlan] = useState<string>("");
  const [error, setError] = useState("");
  const [salesClosed, setSalesClosed] = useState(false);
  const session = readUserSession();
  const trialExpired =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("trial") === "expired";

  useEffect(() => {
    let active = true;
    getSalesSettings()
      .then((settings) => {
        if (active) setSalesClosed(settings.salesClosed);
      })
      .catch(() => {
        if (active) setSalesClosed(false);
      });
    getBillingPlans()
      .then((loadedPlans) => {
        if (active) setPlans(loadedPlans);
      })
      .catch(() => {
        if (active) setPlans(fallbackPlans);
      });
    return () => {
      active = false;
    };
  }, []);

  const orderedPlans = useMemo(() => {
    const order = new Map([["free", 0], ["vip", 1], ["premium", 2]]);
    return [...plans].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  }, [plans]);

  async function handleCheckout(plan: BillingPlan) {
    if (plan.id === "free") return;
    if (salesClosed) {
      setError("Vendas encerradas no momento. Entre na fila de espera para a próxima abertura.");
      return;
    }
    setError("");
    setLoadingPlan(plan.id);
    try {
      const checkout = await createBillingCheckout(plan.id);
      window.location.href = checkout.checkout_url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Nao foi possivel abrir o checkout.");
      setLoadingPlan("");
    }
  }

  if (salesClosed) {
    return <SalesClosedPanel fullHeight={false} onClientLogin={() => { window.location.href = "/"; }} />;
  }

  return (
    <div className="space-y-6">
      <div className="mx-auto max-w-3xl text-center">
          <AppBadge tone="blue">Assinatura automatica</AppBadge>
          <h1 className="mt-3 text-2xl font-extrabold text-gradient-brand sm:text-3xl">
            Assinar Agora
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
          Escolha o plano, finalize o pagamento na Hubla e o acesso e liberado automaticamente quando o pagamento for aprovado.
          </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {trialExpired && (
        <GlassCard className="border-gold/50 bg-gold/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-black text-gold">Seu teste gratuito expirou.</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Atualize seu plano para continuar recebendo sinais ao vivo.
              </div>
            </div>
            <AppBadge tone="gold">Checkout liberado</AppBadge>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {orderedPlans.map((plan) => {
          const highlighted = plan.id === "premium";
          const current = session.plan === plan.id && session.accessMode === "full";
          const paid = plan.id !== "free";
          return (
            <GlassCard
              key={plan.id}
              className={`flex flex-col ${highlighted ? "relative border-gold/60 glow-gold" : ""}`}
            >
              {highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <AppBadge tone="gold">Mais completo</AppBadge>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-widest text-neon-cyan/80">
                    {plan.name}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{plan.description}</div>
                </div>
                {current && <AppBadge tone="green">Atual</AppBadge>}
              </div>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-3xl font-extrabold">
                  {plan.amount > 0 ? formatMoney(plan.amount, plan.currency) : "Gratis"}
                </span>
                {plan.amount > 0 && <span className="pb-1 text-sm text-muted-foreground">/mes</span>}
              </div>

              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <Check className={`mt-0.5 size-4 ${highlighted ? "text-gold" : "text-neon-cyan"}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {paid ? (
                <button
                  type="button"
                  onClick={() => handleCheckout(plan)}
                  disabled={loadingPlan === plan.id || !plan.checkoutEnabled}
                  className={`mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${
                    highlighted ? "btn-gold-grad glow-gold" : "btn-primary-grad"
                  } disabled:cursor-wait disabled:opacity-70`}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : highlighted ? (
                    <Crown className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {loadingPlan === plan.id
                    ? "Abrindo checkout..."
                    : plan.checkoutEnabled
                    ? plan.checkoutProvider === "hubla"
                      ? "Abrir checkout Hubla"
                      : "Ir para checkout"
                    : "Checkout nao configurado"}
                </button>
              ) : (
                <Link
                  to="/app/assinatura"
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground"
                >
                  <ReceiptText className="size-4" />
                  Ver minha assinatura
                </Link>
              )}
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL",
  }).format(amount);
}
