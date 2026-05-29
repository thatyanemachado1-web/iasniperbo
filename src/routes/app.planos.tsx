import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/ui-app/GlassCard";
import { AppBadge } from "@/components/ui-app/AppBadge";
import { Check, Crown, Sparkles } from "lucide-react";

export const Route = createFileRoute("/app/planos")({
  component: PlanosPage,
});

const plans = [
  {
    name: "FREE / TRIAL",
    price: "Grátis",
    badge: "7 dias",
    items: [
      "Acesso ao painel demonstrativo",
      "Placares limitados",
      "Assistente IA limitado",
      "Recursos premium bloqueados",
    ],
    cta: "Ativar Trial",
    tone: "muted" as const,
  },
  {
    name: "MENSAL",
    price: "R$ 297",
    suffix: "/mês",
    items: [
      "Acesso completo ao painel",
      "Alertas estatísticos em tempo real",
      "Tie Alert estatístico",
      "Histórico completo",
      "Assistente IA",
    ],
    cta: "Selecionar Mensal",
    tone: "blue" as const,
  },
  {
    name: "PREMIUM",
    price: "R$ 497",
    suffix: "/mês",
    badge: "Mais completo",
    items: [
      "Tudo do Mensal",
      "Narrador IA",
      "Configurações avançadas",
      "Leitura completa da engine",
      "Suporte prioritário",
      "Acesso antecipado a novas funções",
    ],
    cta: "Desbloquear Premium",
    tone: "gold" as const,
    highlight: true,
  },
];

function PlanosPage() {
  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gradient-brand">Escolha seu plano</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Desbloqueie leitura estatística em tempo real, assistente IA e recursos premium.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <GlassCard
            key={p.name}
            className={`flex flex-col ${p.highlight ? "border-gold/60 glow-gold relative" : ""}`}
          >
            {p.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <AppBadge tone="gold">Recomendado</AppBadge>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-neon-cyan/80">{p.name}</div>
              {p.badge && <AppBadge tone={p.tone}>{p.badge}</AppBadge>}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-extrabold">{p.price}</span>
              {p.suffix && <span className="text-sm text-muted-foreground">{p.suffix}</span>}
            </div>
            <ul className="mt-4 space-y-2 flex-1">
              {p.items.map((it) => (
                <li key={it} className="flex items-start gap-2 text-sm">
                  <Check className={`size-4 mt-0.5 ${p.highlight ? "text-gold" : "text-neon-cyan"}`} />
                  {it}
                </li>
              ))}
            </ul>
            <button
              className={`mt-5 rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 ${
                p.highlight ? "btn-gold-grad glow-gold" : "btn-primary-grad"
              }`}
            >
              {p.highlight ? <Crown className="size-4" /> : <Sparkles className="size-4" />}
              {p.cta}
            </button>
          </GlassCard>
        ))}
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Pagamento seguro. Cancele quando quiser.
      </div>
    </div>
  );
}
