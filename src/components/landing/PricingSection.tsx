import { Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "R$ 0",
    period: "/ mês",
    description: "Comece a conhecer a plataforma sem custo.",
    features: [
      "Cadastro na plataforma",
      "Acesso ao painel demonstrativo",
      "Visão limitada das análises",
      "Sem salas de sinais",
    ],
    cta: "Criar conta grátis",
  },
  {
    id: "premium",
    name: "Premium",
    price: "R$ 297",
    period: "/ mês",
    description: "Ideal para quem quer começar a operar com análise IA.",
    features: [
      "1 sala de sinais liberada",
      "Ferramentas de análise principais",
      "Leitura Neural e Surf Analyzer",
      "Radar de padrões IA",
      "Central Telegram (1 canal)",
      "Atualizações da plataforma",
    ],
    cta: "Assinar Premium",
  },
  {
    id: "black",
    name: "Premium Black",
    price: "R$ 497",
    period: "/ mês",
    description: "Acesso completo à plataforma e todas as salas.",
    features: [
      "Todas as salas de sinais liberadas",
      "Ferramentas de análise completas",
      "Leitura Neural avançada",
      "Radar IA + Padrões premium",
      "Central Telegram (multi-canais)",
      "Assistente IA operacional",
      "Prioridade em novas features",
    ],
    cta: "Assinar Black",
    highlighted: true,
    badge: "Mais completo",
  },
];

interface PricingSectionProps {
  onCta: () => void;
}

export function PricingSection({ onCta }: PricingSectionProps) {
  return (
    <section id="plano" className="relative bg-[#080D1A]">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <header className="mb-12 text-center">
          <h2 className="text-2xl font-black tracking-tight text-[#F7F8FC] sm:text-3xl lg:text-4xl">
            Escolha seu plano
          </h2>
          <p className="mt-3 text-[15px] text-[#B6C0D3]">
            Três níveis de acesso à plataforma de análise Sniper BO IA.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-3xl border p-8 transition ${
                plan.highlighted
                  ? "border-transparent bg-[#0D1425] shadow-[0_40px_80px_-40px_rgba(133,84,255,0.55)] ring-1 ring-[rgba(133,84,255,0.5)]"
                  : "border-white/[0.08] bg-[#0B1220]"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(90deg,#13C8FF,#8554FF)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  {plan.badge}
                </div>
              )}

              {plan.highlighted && (
                <div
                  aria-hidden="true"
                  className="mb-6 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(19,200,255,0.4),rgba(133,84,255,0.4),transparent)]"
                />
              )}

              <div className="text-xs font-black uppercase tracking-widest text-[#7F8BA5]">
                {plan.name}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-black tracking-tight text-[#F7F8FC]">
                  {plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-[#7F8BA5]">{plan.period}</span>
                )}
              </div>
              <p className="mt-3 text-[13px] text-[#B6C0D3]">{plan.description}</p>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-[13px] text-[#B6C0D3]"
                  >
                    <span
                      className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                        plan.highlighted
                          ? "bg-[linear-gradient(135deg,#13C8FF,#8554FF)]"
                          : "bg-white/[0.08]"
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={onCta}
                className={`mt-8 inline-flex w-full items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-black uppercase tracking-wider transition ${
                  plan.highlighted
                    ? "bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] text-white shadow-[0_18px_45px_-15px_rgba(37,139,255,0.65)] hover:brightness-110"
                    : "border border-white/[0.12] bg-white/[0.03] text-[#F7F8FC] hover:bg-white/[0.06]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
