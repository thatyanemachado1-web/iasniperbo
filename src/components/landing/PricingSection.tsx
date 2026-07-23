import { Check } from "lucide-react";

const INCLUDED = [
  "Plataforma completa de análise",
  "Validador de estratégias",
  "Monitoramento em tempo real",
  "Inteligência artificial para padrões",
  "Central Telegram",
  "Estratégias e histórico salvos",
  "Atualizações da plataforma",
];

interface PricingSectionProps {
  onCta: () => void;
}

export function PricingSection({ onCta }: PricingSectionProps) {
  return (
    <section id="plano" className="relative bg-[#080D1A]">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <header className="mb-10 text-center">
          <h2 className="text-2xl font-black tracking-tight text-[#F7F8FC] sm:text-3xl lg:text-4xl">
            Plano Sniper BO IA
          </h2>
          <p className="mt-3 text-[15px] text-[#B6C0D3]">
            Acesso completo à plataforma de análise.
          </p>
        </header>

        <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0D1425] p-8 shadow-[0_40px_80px_-40px_rgba(37,139,255,0.35)] sm:p-10">
          <div
            aria-hidden="true"
            className="mb-6 h-px w-full bg-[linear-gradient(90deg,transparent,rgba(19,200,255,0.4),rgba(133,84,255,0.4),transparent)]"
          />
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black tracking-tight text-[#F7F8FC] sm:text-6xl">
              R$ 297
            </span>
            <span className="text-sm text-[#7F8BA5]">/ mês</span>
          </div>

          <ul className="mt-7 space-y-3">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-3 text-[14px] text-[#B6C0D3]">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#13C8FF,#8554FF)] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onCta}
            className="mt-8 inline-flex w-full items-center justify-center rounded-2xl bg-[linear-gradient(90deg,#13C8FF_0%,#258BFF_45%,#8554FF_100%)] px-6 py-4 text-sm font-black uppercase tracking-wider text-white shadow-[0_18px_45px_-15px_rgba(37,139,255,0.65)] transition hover:brightness-110"
          >
            Acessar a plataforma
          </button>
        </div>
      </div>
    </section>
  );
}
